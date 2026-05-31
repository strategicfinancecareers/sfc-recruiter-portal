import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

// POST /api/review-recruiter
// body: { recruiterUserId, adminUserId, action: 'approve'|'reject', rejectionReason? }
//
// Flips users.recruiter_status for a pending recruiter and notifies them
// via Resend. Same shape as /api/review-candidate but for recruiter
// vetting (the second side of the platform).

const APP_URL = 'https://sfc-recruiter-portal.vercel.app';
const FROM_ADDR = 'SFC Talent <noreply@strategicfinancecareers.com>';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { recruiterUserId, adminUserId, action, rejectionReason } = req.body || {};
  console.log('[review-recruiter] entry:', { recruiterUserId, adminUserId, action });

  if (!recruiterUserId || !adminUserId || !action) {
    return res.status(400).json({ error: 'recruiterUserId, adminUserId, action required' });
  }
  if (action !== 'approve' && action !== 'reject') {
    return res.status(400).json({ error: `Invalid action: ${action}` });
  }
  if (action === 'reject' && !(rejectionReason && rejectionReason.trim())) {
    return res.status(400).json({ error: 'rejectionReason required when action=reject' });
  }

  // ── Auth: admin or owner only ──────────────────────────────────────────────
  const { data: adminRow, error: adminErr } = await supabase
    .from('users')
    .select('id, is_active, roles ( name )')
    .eq('id', adminUserId)
    .maybeSingle();
  if (adminErr) {
    console.error('[review-recruiter] admin lookup failed:', JSON.stringify(adminErr));
    return res.status(500).json({ error: adminErr.message });
  }
  const roleName = adminRow?.roles?.name;
  if (!adminRow || adminRow.is_active === false || (roleName !== 'admin' && roleName !== 'owner')) {
    console.warn('[review-recruiter] auth FAIL — role:', roleName);
    return res.status(403).json({ error: 'Forbidden' });
  }

  // ── Load target recruiter ──────────────────────────────────────────────────
  const { data: recruiter, error: recErr } = await supabase
    .from('users')
    .select('id, email, first_name, last_name, recruiter_status')
    .eq('id', recruiterUserId)
    .maybeSingle();
  if (recErr) {
    console.error('[review-recruiter] recruiter lookup failed:', JSON.stringify(recErr));
    return res.status(500).json({ error: recErr.message });
  }
  if (!recruiter) return res.status(404).json({ error: 'Recruiter not found' });

  if (recruiter.recruiter_status !== 'pending') {
    return res.status(400).json({
      error: `Cannot ${action} a recruiter with status '${recruiter.recruiter_status || 'null'}'. Only pending recruiters can be reviewed.`,
    });
  }

  // ── Update ─────────────────────────────────────────────────────────────────
  const nowIso = new Date().toISOString();
  const update = action === 'approve'
    ? { recruiter_status: 'approved', approved_at: nowIso, approved_by: adminUserId, rejection_reason: null }
    : { recruiter_status: 'rejected', rejection_reason: rejectionReason.trim(), approved_by: adminUserId };

  const { error: updateErr } = await supabase
    .from('users')
    .update(update)
    .eq('id', recruiterUserId);
  if (updateErr) {
    console.error('[review-recruiter] update failed:', JSON.stringify(updateErr));
    return res.status(500).json({ error: updateErr.message });
  }
  console.log('[review-recruiter]', action, 'OK — recruiter', recruiterUserId);

  // ── Best-effort email ─────────────────────────────────────────────────────
  let emailSent = false;
  let emailError = null;
  if (!recruiter.email) {
    emailError = 'recruiter has no email on file';
  } else if (!process.env.RESEND_API_KEY) {
    emailError = 'RESEND_API_KEY missing';
  } else {
    const firstName = recruiter.first_name || 'there';
    try {
      let subject, html;
      if (action === 'approve') {
        subject = "You're approved — welcome to SFC Talent";
        html = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
          <h2 style="color:#0F6E56">Welcome to SFC Talent 🎉</h2>
          <p>Hi ${firstName},</p>
          <p>Great news — your recruiter application has been approved. You can now sign in and start browsing our network of vetted finance candidates.</p>
          <div style="margin:24px 0"><a href="${APP_URL}/signup?mode=signin" style="display:inline-block;background:#0F6E56;color:white;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600">Sign in →</a></div>
          <p style="color:#666;font-size:14px">A few notes:</p>
          <ul style="color:#666;font-size:14px">
            <li>Candidates are pre-vetted by our team and stay anonymous until they accept an intro</li>
            <li>You can request as many intros as you'd like; candidates have 48 hours to respond</li>
            <li>Reply to this email if you have any questions</li>
          </ul>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
          <p style="color:#999;font-size:12px">SFC Talent · strategicfinancecareers.com</p>
        </div>`;
      } else {
        subject = 'About your SFC Talent recruiter application';
        html = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
          <h2 style="color:#333">Thanks for applying to SFC Talent</h2>
          <p>Hi ${firstName},</p>
          <p>Thank you for your interest in joining SFC Talent as a recruiter. After review, we're not able to approve your application at this time.</p>
          <div style="background:#f9f9f9;border-left:3px solid #ccc;padding:12px 16px;margin:16px 0;color:#444;font-size:14px;white-space:pre-line">${rejectionReason.trim()}</div>
          <p>If you'd like to discuss this further or reapply later, just reply to this email — we read every response.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
          <p style="color:#999;font-size:12px">SFC Talent · strategicfinancecareers.com</p>
        </div>`;
      }
      const result = await resend.emails.send({
        from: FROM_ADDR,
        to: recruiter.email,
        subject,
        html,
      });
      if (result?.error) {
        emailError = result.error.message || String(result.error);
        console.error('[review-recruiter] Resend error:', emailError);
      } else {
        emailSent = true;
      }
    } catch (err) {
      emailError = err?.message || String(err);
      console.error('[review-recruiter] email send threw:', emailError);
    }
  }

  return res.status(200).json({
    success: true,
    recruiterUserId,
    newStatus: action === 'approve' ? 'approved' : 'rejected',
    emailSent,
    ...(emailError ? { emailError } : {}),
  });
}
