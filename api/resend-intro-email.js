import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

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
// failure mode entirely. Template is intentionally kept in sync with
// /api/send-intro-email.ts; if you change one, change both. (Cleaner
// long-term: extract to api/_shared/sendIntroEmail.js — flagged for a
// future cleanup pass.)

const APP_BASE = 'https://sfc-recruiter-portal.vercel.app';
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

  // ── Build the candidate-facing email (same template as send-intro-email.ts) ──
  const yesUrl = `${APP_BASE}/api/respond-to-intro?introId=${introId}&response=yes`;
  const noUrl = `${APP_BASE}/api/respond-to-intro?introId=${introId}&response=no`;
  const dashboardUrl = `${APP_BASE}/candidate-dashboard`;

  const jobDetailBlock = job?.job_description_url
    ? `<div style="margin:20px 0"><a href="${job.job_description_url}" style="display:inline-block;background:#0F6E56;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">View Job Posting →</a></div>`
    : `<div style="background:#f8f9fa;border:1px solid #e9ecef;border-radius:8px;padding:16px;margin:20px 0"><table style="border-collapse:collapse;width:100%"><tr><td style="padding:4px 0;color:#666;font-size:14px;width:110px">Job Title</td><td style="padding:4px 0;font-size:14px;font-weight:600">${job?.title ?? '—'}</td></tr><tr><td style="padding:4px 0;color:#666;font-size:14px">Company</td><td style="padding:4px 0;font-size:14px">${job?.company ?? '—'}</td></tr><tr><td style="padding:4px 0;color:#666;font-size:14px">Location</td><td style="padding:4px 0;font-size:14px">${job?.location ?? '—'}</td></tr>${job?.salary_range ? `<tr><td style="padding:4px 0;color:#666;font-size:14px">Salary</td><td style="padding:4px 0;font-size:14px">${job.salary_range}</td></tr>` : ''}</table></div>`;

  const html = '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">'
    + `<img src="${APP_BASE}/logo.png" height="40" style="margin-bottom:24px" />`
    + '<h2 style="color:#0F6E56">You have a new opportunity</h2>'
    + '<p>Hi there,</p>'
    + `<p>A company is interested in connecting with you about a <strong>${job?.title ?? 'role'}</strong>${job?.company ? ` at <strong>${job.company}</strong>` : ''}.</p>`
    + (intro.message ? `<p style="color:#555;font-style:italic">"${intro.message}"</p>` : '')
    + jobDetailBlock
    + '<p>Are you open to connecting?</p>'
    + '<table style="border-collapse:collapse;margin:28px 0"><tr>'
    + `<td style="padding-right:12px"><a href="${yesUrl}" style="display:inline-block;background:#0F6E56;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">✅ Yes, I&#39;m interested</a></td>`
    + `<td><a href="${noUrl}" style="display:inline-block;background:#f3f4f6;color:#333;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">❌ No thanks</a></td>`
    + '</tr></table>'
    + '<p style="color:#666;font-size:14px">This introduction was facilitated by SFC Talent. Your contact details will only be shared if you click Yes.</p>'
    + '<div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:16px;margin:20px 0">'
    + '<p style="margin:0 0 8px;font-weight:600;font-size:14px;color:#111">View this in your dashboard</p>'
    + '<p style="margin:0 0 12px;color:#6B7280;font-size:13px">All your introduction requests are tracked in one place.</p>'
    + `<a href="${dashboardUrl}" style="display:inline-block;background:#0A0A0A;color:white;text-decoration:none;padding:10px 20px;border-radius:6px;font-weight:600;font-size:13px">Open Dashboard →</a>`
    + '</div>'
    + '<hr style="border:none;border-top:1px solid #eee;margin:24px 0" />'
    + '<p style="color:#999;font-size:12px">SFC Talent · strategicfinancecareers.com</p>'
    + '</div>';

  try {
    const result = await resend.emails.send({
      from: FROM_ADDR,
      to: candidate.email,
      subject: `New opportunity: ${job?.title ?? 'role'}${job?.company ? ` at ${job.company}` : ''}`,
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
