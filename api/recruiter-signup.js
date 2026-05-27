import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

// POST /api/recruiter-signup
// body: { authUserId, email, first_name, last_name, linkedin_url, company }
//
// Called by /signup AFTER supabase.auth.signUp() has succeeded on the
// client. Service-role insert into public.users with recruiter role +
// recruiter_status='pending', then fires two emails (admin notify +
// applicant confirmation). Returns success even if emails fail —
// the public.users row is the source of truth.

const RECRUITER_ROLE_ID = 'e7b112a8-8493-46e6-bc02-ab8ca66a746a';
const ADMIN_NOTIFY_EMAIL = 'zu@strategicfinancecareers.com';
const APP_URL = 'https://sfc-recruiter-portal.vercel.app';
const FROM_ADDR = 'SFC Talent <noreply@strategicfinancecareers.com>';

const resend = new Resend(process.env.RESEND_API_KEY);

const isLinkedInUrl = (url) => typeof url === 'string' && /linkedin\.com\/in\//i.test(url);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { authUserId, email, first_name, last_name, linkedin_url, company } = req.body || {};
  console.log('[recruiter-signup] entry:', { authUserId, email });

  // ── Validate ───────────────────────────────────────────────────────────────
  if (!authUserId || !email || !first_name || !last_name || !linkedin_url || !company) {
    return res.status(400).json({
      error: 'authUserId, email, first_name, last_name, linkedin_url, company all required',
    });
  }
  if (!isLinkedInUrl(linkedin_url)) {
    return res.status(400).json({ error: 'linkedin_url must contain linkedin.com/in/' });
  }

  const emailNorm = email.toLowerCase().trim();

  // ── Insert public.users (service role bypasses RLS) ────────────────────────
  // RLS policy "Users can insert their own profile during signup" with
  // WITH CHECK auth.uid() = id would also accept this from the client, but
  // doing it server-side lets us atomically fire emails too and avoids
  // races with email verification flows.
  const nowIso = new Date().toISOString();
  const { error: insertErr } = await supabase
    .from('users')
    .insert({
      id: authUserId,
      email: emailNorm,
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      linkedin_url: linkedin_url.trim(),
      company: company.trim(),
      role_id: RECRUITER_ROLE_ID,
      recruiter_status: 'pending',
      created_at: nowIso,
      updated_at: nowIso,
    });

  if (insertErr) {
    console.error('[recruiter-signup] insert failed:', JSON.stringify({
      message: insertErr.message, code: insertErr.code, details: insertErr.details, hint: insertErr.hint,
    }));
    // 23505 = unique violation (already signed up) — friendly response
    if (insertErr.code === '23505') {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    return res.status(500).json({ error: insertErr.message });
  }
  console.log('[recruiter-signup] inserted user', authUserId, '— sending emails');

  // ── Best-effort emails ─────────────────────────────────────────────────────
  let adminEmailSent = false;
  let applicantEmailSent = false;
  const emailErrors = [];

  if (process.env.RESEND_API_KEY) {
    const fullName = `${first_name.trim()} ${last_name.trim()}`;

    // Admin notification
    try {
      const adminHtml = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
        <h2 style="color:#0F6E56">New recruiter signup pending review</h2>
        <table style="width:100%;border-collapse:collapse;margin:20px 0">
          <tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888;width:38%">Name</td><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600">${fullName}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888">Email</td><td style="padding:8px 0;border-bottom:1px solid #eee">${emailNorm}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888">Company</td><td style="padding:8px 0;border-bottom:1px solid #eee">${company}</td></tr>
          <tr><td style="padding:8px 0;color:#888">LinkedIn</td><td style="padding:8px 0"><a href="${linkedin_url}" style="color:#0F6E56">${linkedin_url}</a></td></tr>
        </table>
        <div style="margin:24px 0"><a href="${APP_URL}/admin" style="display:inline-block;background:#0F6E56;color:white;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600">Review in admin panel →</a></div>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
        <p style="color:#999;font-size:12px">SFC Talent · strategicfinancecareers.com</p>
      </div>`;
      const r = await resend.emails.send({
        from: FROM_ADDR,
        to: ADMIN_NOTIFY_EMAIL,
        subject: `New recruiter signup pending review: ${fullName}`,
        html: adminHtml,
      });
      if (r?.error) {
        emailErrors.push(`admin: ${r.error.message || String(r.error)}`);
      } else {
        adminEmailSent = true;
      }
    } catch (err) {
      emailErrors.push(`admin: ${err?.message || String(err)}`);
    }

    // Applicant confirmation — recruiter framing, NOT "application"
    try {
      const applicantHtml = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
        <h2 style="color:#0F6E56">We received your submission</h2>
        <p>Hi ${first_name},</p>
        <p>Thanks for submitting your details to SFC Talent. We personally vet every recruiter on the platform to keep quality high on both sides.</p>
        <p>We typically approve submissions within a few hours during US business hours (PDT). You'll get an email at this address as soon as your account is live.</p>
        <div style="background:#f8f9fa;border:1px solid #e9ecef;border-radius:8px;padding:16px;margin:20px 0">
          <p style="margin:0 0 8px;color:#666;font-size:13px;font-weight:600">A reminder of what you submitted:</p>
          <ul style="margin:0;padding-left:18px;color:#333;font-size:14px;line-height:1.7">
            <li>Company: <strong>${company}</strong></li>
            <li>LinkedIn: <a href="${linkedin_url}" style="color:#0F6E56">${linkedin_url}</a></li>
          </ul>
        </div>
        <p>If any of that needs to change, just reply to this email.</p>
        <p style="color:#666;font-size:14px">— The SFC Talent team</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
        <p style="color:#999;font-size:12px">SFC Talent · strategicfinancecareers.com</p>
      </div>`;
      const r = await resend.emails.send({
        from: FROM_ADDR,
        to: emailNorm,
        subject: 'We received your SFC Talent recruiter submission',
        html: applicantHtml,
      });
      if (r?.error) {
        emailErrors.push(`applicant: ${r.error.message || String(r.error)}`);
      } else {
        applicantEmailSent = true;
      }
    } catch (err) {
      emailErrors.push(`applicant: ${err?.message || String(err)}`);
    }
  } else {
    emailErrors.push('RESEND_API_KEY missing');
  }

  if (emailErrors.length) {
    console.warn('[recruiter-signup] email warnings:', emailErrors.join(' | '));
  }

  return res.status(200).json({
    success: true,
    userId: authUserId,
    adminEmailSent,
    applicantEmailSent,
    ...(emailErrors.length ? { emailErrors } : {}),
  });
}
