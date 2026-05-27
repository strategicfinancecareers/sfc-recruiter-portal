import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

// POST /api/review-candidate
// body: { candidateId, adminUserId, action, rejectionReason? }
//   action ∈ 'approve' | 'reject' | 'reactivate' | 'deactivate'
//
// Flips candidates.status and writes audit columns (approved_at,
// approved_by, rejection_reason), then sends a best-effort notification
// email to the candidate via Resend. Email failures do NOT fail the
// request — the status flip is the source of truth.

const resend = new Resend(process.env.RESEND_API_KEY);

const DASHBOARD_URL = 'https://sfc-recruiter-portal.vercel.app/candidate-dashboard';
const FROM_ADDR = 'SFC Talent <noreply@strategicfinancecareers.com>';

const VALID_ACTIONS = new Set(['approve', 'reject', 'reactivate', 'deactivate']);

// Allowed source status → action table. Keeps validation in one place.
function canTransition(currentStatus, action) {
  switch (action) {
    case 'approve':    return ['pending', 'rejected', 'inactive'].includes(currentStatus);
    case 'reject':     return currentStatus === 'pending';
    case 'reactivate': return ['inactive', 'rejected'].includes(currentStatus);
    case 'deactivate': return currentStatus === 'active';
    default:           return false;
  }
}

function buildEmail(action, candidate) {
  const firstName = (candidate.name || '').split(' ')[0] || 'there';
  const hello = `Hi ${firstName},`;
  const footer = '<hr style="border:none;border-top:1px solid #eee;margin:24px 0" /><p style="color:#999;font-size:12px">SFC Talent · strategicfinancecareers.com</p></div>';
  const wrap = (inner) => `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">${inner}${footer}`;

  switch (action) {
    case 'approve':
      return {
        subject: 'Your SFC Talent profile is now live',
        html: wrap(
          '<h2 style="color:#0F6E56">You\'re in 🎉</h2>'
          + `<p>${hello}</p>`
          + '<p>Great news — your profile has been approved and is now visible to recruiters on our platform. They can browse you anonymously and request introductions.</p>'
          + '<p>You\'ll get an email any time a recruiter requests an intro. You have 48 hours to accept or decline each one.</p>'
          + `<div style="margin:24px 0"><a href="${DASHBOARD_URL}" style="display:inline-block;background:#0F6E56;color:white;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600">Open My Dashboard →</a></div>`
          + '<p style="color:#666;font-size:14px">Your identity stays protected. We never share your contact details without your explicit consent.</p>'
        ),
      };

    case 'reject':
      // Intentionally does NOT include rejectionReason — that column is
      // internal-only per spec. Keep the message generic and inviting
      // of further dialogue.
      return {
        subject: 'About your SFC Talent application',
        html: wrap(
          '<h2 style="color:#333">Thanks for applying to SFC Talent</h2>'
          + `<p>${hello}</p>`
          + '<p>Thank you for taking the time to apply. After review, we\'re not able to add your profile to our platform at this time.</p>'
          + '<p>If you have any questions, just reply to this email — we read every response.</p>'
          + '<p style="color:#666;font-size:14px">We wish you the very best in your career.</p>'
        ),
      };

    case 'reactivate':
      return {
        subject: 'Welcome back to SFC Talent',
        html: wrap(
          '<h2 style="color:#0F6E56">Welcome back 👋</h2>'
          + `<p>${hello}</p>`
          + '<p>Your profile is live again on our platform and visible to recruiters. You\'ll start receiving intro requests as they come in.</p>'
          + `<div style="margin:24px 0"><a href="${DASHBOARD_URL}" style="display:inline-block;background:#0F6E56;color:white;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600">Open My Dashboard →</a></div>`
        ),
      };

    case 'deactivate':
      return {
        subject: 'Your SFC Talent profile is paused',
        html: wrap(
          '<h2 style="color:#333">Your profile is now paused</h2>'
          + `<p>${hello}</p>`
          + '<p>Your profile has been paused and is no longer visible to recruiters on our platform. You won\'t receive any new introduction requests.</p>'
          + '<p>If this was a mistake or you\'d like to reactivate, just reply to this email and we\'ll sort it out.</p>'
        ),
      };

    default:
      return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { candidateId, adminUserId, action, rejectionReason } = req.body || {};
  console.log('[review-candidate] entry:', { candidateId, adminUserId, action });

  if (!candidateId || !adminUserId || !action) {
    return res.status(400).json({ error: 'candidateId, adminUserId, and action required' });
  }
  if (!VALID_ACTIONS.has(action)) {
    return res.status(400).json({ error: `Invalid action: ${action}` });
  }

  // ── Auth: admin or owner only ──────────────────────────────────────────────
  const { data: userRow, error: userErr } = await supabase
    .from('users')
    .select('id, is_active, roles ( name )')
    .eq('id', adminUserId)
    .maybeSingle();

  if (userErr) {
    console.error('[review-candidate] user lookup failed:', JSON.stringify(userErr));
    return res.status(500).json({ error: userErr.message });
  }
  const roleName = userRow?.roles?.name;
  if (!userRow || userRow.is_active === false || (roleName !== 'admin' && roleName !== 'owner')) {
    console.warn('[review-candidate] auth FAIL — role:', roleName);
    return res.status(403).json({ error: 'Forbidden' });
  }

  // ── Load candidate ──────────────────────────────────────────────────────────
  const { data: candidate, error: candErr } = await supabase
    .from('candidates')
    .select('id, name, email, display_name, status')
    .eq('id', candidateId)
    .maybeSingle();

  if (candErr) {
    console.error('[review-candidate] candidate lookup failed:', JSON.stringify(candErr));
    return res.status(500).json({ error: candErr.message });
  }
  if (!candidate) {
    return res.status(404).json({ error: 'Candidate not found' });
  }

  // ── Transition validation ──────────────────────────────────────────────────
  const currentStatus = candidate.status || 'pending';
  if (!canTransition(currentStatus, action)) {
    const msg = `Cannot ${action} a candidate with status '${currentStatus}'.`;
    console.warn('[review-candidate]', msg);
    return res.status(400).json({ error: msg });
  }

  // ── Build update payload per action ────────────────────────────────────────
  const nowIso = new Date().toISOString();
  let update;
  let newStatus;
  switch (action) {
    case 'approve':
      newStatus = 'active';
      update = { status: newStatus, approved_at: nowIso, approved_by: adminUserId, rejection_reason: null };
      break;
    case 'reject':
      newStatus = 'rejected';
      update = { status: newStatus, rejection_reason: (rejectionReason || '').trim() || null, approved_at: null, approved_by: null };
      break;
    case 'reactivate':
      newStatus = 'active';
      update = { status: newStatus, approved_at: nowIso, approved_by: adminUserId };
      break;
    case 'deactivate':
      newStatus = 'inactive';
      update = { status: newStatus };
      break;
  }

  // ── Apply the update ───────────────────────────────────────────────────────
  const { error: updateErr } = await supabase
    .from('candidates')
    .update(update)
    .eq('id', candidateId);

  if (updateErr) {
    console.error('[review-candidate] update failed:', JSON.stringify({
      message: updateErr.message, code: updateErr.code, hint: updateErr.hint, details: updateErr.details,
    }));
    return res.status(500).json({ error: updateErr.message });
  }
  console.log('[review-candidate]', action, 'OK — candidate', candidateId, 'now', newStatus);

  // ── Send notification email (best-effort) ──────────────────────────────────
  let emailSent = false;
  let emailError = null;

  if (!candidate.email) {
    emailError = 'candidate has no email on file';
    console.warn('[review-candidate] skipping email:', emailError);
  } else if (!process.env.RESEND_API_KEY) {
    emailError = 'RESEND_API_KEY missing';
    console.warn('[review-candidate] skipping email:', emailError);
  } else {
    try {
      const tpl = buildEmail(action, candidate);
      if (tpl) {
        const result = await resend.emails.send({
          from: FROM_ADDR,
          to: candidate.email,
          subject: tpl.subject,
          html: tpl.html,
        });
        if (result?.error) {
          emailError = result.error.message || String(result.error);
          console.error('[review-candidate] Resend error:', emailError);
        } else {
          emailSent = true;
          console.log('[review-candidate] email sent to', candidate.email);
        }
      }
    } catch (err) {
      emailError = err?.message || String(err);
      console.error('[review-candidate] email send threw:', emailError);
    }
  }

  return res.status(200).json({
    success: true,
    candidateId,
    newStatus,
    emailSent,
    ...(emailError ? { emailError } : {}),
  });
}
