import { createClient } from '@supabase/supabase-js';

// POST /api/resend-intro-email
//   body: { introId, adminUserId }
// Auth: adminUserId must resolve to a user with role 'admin' or 'owner'.
// Behaviour: looks up the intro request, refuses if not 'pending', then
// internally invokes /api/send-intro-email to fire the same templated
// email submit-intro originally sent. Calling the existing endpoint
// (rather than duplicating the Resend logic) keeps the email template
// in one place.

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

  // ── Auth: admin/owner only ─────────────────────────────────────────────────
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

  // ── Intro must exist and be pending ────────────────────────────────────────
  const { data: intro, error: introErr } = await supabase
    .from('introduction_requests')
    .select('id, status, candidate_id')
    .eq('id', introId)
    .maybeSingle();

  if (introErr) {
    console.error('[resend-intro-email] intro lookup failed:', JSON.stringify(introErr));
    return res.status(500).json({ error: introErr.message });
  }
  if (!intro) {
    console.warn('[resend-intro-email] intro not found:', introId);
    return res.status(404).json({ error: 'intro not found' });
  }
  if (intro.status !== 'pending') {
    console.warn('[resend-intro-email] refusing resend — status is', intro.status);
    return res.status(400).json({
      error: `Cannot resend: intro is already ${intro.status}. Only pending intros can be re-sent.`,
    });
  }

  // ── Internally call /api/send-intro-email ──────────────────────────────────
  // Vercel doesn't expose a "self URL" without VERCEL_URL, but the candidate
  // emails already hardcode the production base URL (see send-intro-email.ts),
  // so reuse the same constant.
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'https://sfc-recruiter-portal.vercel.app';

  try {
    const sendRes = await fetch(`${baseUrl}/api/send-intro-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ introId }),
    });
    const body = await sendRes.json().catch(() => ({}));
    if (!sendRes.ok) {
      console.error('[resend-intro-email] send-intro-email returned non-OK:', sendRes.status, body);
      return res.status(502).json({
        error: 'Failed to resend email',
        detail: body?.error || body?.message || `status ${sendRes.status}`,
      });
    }
    console.log('[resend-intro-email] success for introId:', introId);
    return res.status(200).json({ success: true, message: 'Email resent' });
  } catch (err) {
    console.error('[resend-intro-email] caught error:', err?.message || String(err));
    return res.status(500).json({ error: 'Resend failed', message: err?.message || String(err) });
  }
}
