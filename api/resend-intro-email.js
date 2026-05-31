import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { buildIntroEmail } from './_shared/introEmail.js';

// POST /api/resend-intro-email
//   body: { introId, adminUserId }
//
// Re-fires the "New opportunity" email to the candidate for a pending
// intro request. Admin/owner-only.
//
// Inlines the email send rather than calling /api/send-intro-email via
// HTTP — the old internal-fetch pattern was returning 502s in production
// because VERCEL_URL points to deployment hostnames that Vercel's
// deployment protection may reject. Sending directly here removes that
// failure mode entirely. The subject + html themselves come from the
// shared api/_shared/introEmail.js module so /api/send-intro-email and
// this endpoint can no longer drift (they used to — this file's wording
// of the dashboard CTA was the corrected version while send-intro-email
// still referenced "Sign in with Google").

const FROM_ADDR = 'SFC Talent <noreply@strategicfinancecareers.com>';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { introId, adminUserId } = req.body || {};
  console.log('[resend-intro-email] entry — introId:', introId, 'adminUserId:', adminUserId);

  if (!introId || !adminUserId) {
    return res.status(400).json({ error: 'introId and adminUserId required' });
  }

  // ── Auth: admin/owner only ────────────────────────────────────────────────
  const { data: userRow, error: userErr } = await supabase
    .from('users')
    .select('id, is_active, roles ( name )')
    .eq('id', adminUserId)
    .maybeSingle();
  if (userErr) {
    console.error('[resend-intro-email] user lookup failed:', JSON.stringify(userErr));
    return res.status(500).json({ error: userErr.message });
  }
  const roleName = userRow?.roles?.name;
  if (!userRow || userRow.is_active === false || (roleName !== 'admin' && roleName !== 'owner')) {
    console.warn('[resend-intro-email] auth FAIL — role:', roleName);
    return res.status(403).json({ error: 'Forbidden' });
  }

  // ── Intro must exist and be pending ───────────────────────────────────────
  const { data: intro, error: introErr } = await supabase
    .from('introduction_requests')
    .select('id, status, candidate_id, job_id, message')
    .eq('id', introId)
    .maybeSingle();
  if (introErr) {
    console.error('[resend-intro-email] intro lookup failed:', JSON.stringify(introErr));
    return res.status(500).json({ error: introErr.message });
  }
  if (!intro) return res.status(404).json({ error: 'intro not found' });
  if (intro.status !== 'pending') {
    return res.status(400).json({
      error: `Cannot resend: intro is already ${intro.status}. Only pending intros can be re-sent.`,
    });
  }

  // ── Fetch candidate + job (parallel, no embed to avoid FK ambiguity) ─────
  const [{ data: candidate, error: candError }, { data: job, error: jobError }] = await Promise.all([
    supabase.from('candidates').select('email, name, display_name').eq('id', intro.candidate_id).single(),
    intro.job_id
      ? supabase.from('jobs').select('title, company, location, salary_range, job_description_url').eq('id', intro.job_id).single()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (candError) {
    console.error('[resend-intro-email] candidate fetch error:', JSON.stringify(candError));
    return res.status(500).json({ error: candError.message });
  }
  if (jobError) {
    console.error('[resend-intro-email] job fetch error:', JSON.stringify(jobError));
    // Don't bail — we can still send a job-less email
  }
  if (!candidate?.email) {
    console.error('[resend-intro-email] candidate has no email on file');
    return res.status(422).json({ error: 'Candidate email missing' });
  }
  if (!process.env.RESEND_API_KEY) {
    console.error('[resend-intro-email] RESEND_API_KEY missing');
    return res.status(500).json({ error: 'Email service not configured' });
  }

  // Build the candidate-facing email via the shared module so this
  // endpoint and /api/send-intro-email always render identically.
  const { subject, html } = buildIntroEmail({ introId, intro, job });

  try {
    const result = await resend.emails.send({
      from: FROM_ADDR,
      to: candidate.email,
      subject,
      html,
    });
    if (result?.error) {
      console.error('[resend-intro-email] Resend error:', JSON.stringify(result.error));
      return res.status(502).json({ error: result.error.message || String(result.error) });
    }
    console.log('[resend-intro-email] sent to', candidate.email);
  } catch (err) {
    console.error('[resend-intro-email] send threw:', err?.message || String(err));
    return res.status(500).json({ error: err?.message || String(err) });
  }

  // ── Stamp last_nudged_at (best-effort — email is already sent) ────────────
  const nowIso = new Date().toISOString();
  const { error: stampErr } = await supabase
    .from('introduction_requests')
    .update({ last_nudged_at: nowIso, updated_at: nowIso })
    .eq('id', introId);
  if (stampErr) {
    console.warn('[resend-intro-email] last_nudged_at UPDATE failed (email already sent):', JSON.stringify(stampErr));
  }

  return res.status(200).json({
    success: true,
    message: 'Email resent',
    last_nudged_at: stampErr ? null : nowIso,
  });
}
