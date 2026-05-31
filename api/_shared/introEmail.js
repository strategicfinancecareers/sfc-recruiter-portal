// Shared "new opportunity" intro email — used by /api/send-intro-email
// (first send when the recruiter creates the intro) and
// /api/resend-intro-email (admin nudge on a still-pending intro).
//
// These two endpoints both ship the SAME candidate-facing email. They
// previously kept independent copies of the template and drifted:
//   - send-intro-email rendered "at undefined" when company was null
//   - send-intro-email's CTA still referenced "Sign in with Google"
//     even though Google SSO is no longer in the product
// This module is the single source of truth so future copy changes flip
// both call sites at once. Each endpoint owns its own auth, DB lookups,
// and trigger — they only share the rendered subject + html.
//
// Pure JS (no .d.ts) so it imports cleanly from both .ts and .js call
// sites; the .ts side does `// @ts-ignore` on the import.

const APP_BASE = 'https://sfc-recruiter-portal.vercel.app';
const BRAND = '#0F6E56'; // Email brand color — kept as-is per spec; a
                         // separate pass will reconcile this with the
                         // dashboard's #008037.

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Builds the subject + html for the candidate-facing intro email.
// Inputs:
//   introId   — uuid; used to build accept/decline links
//   intro     — { message?: string }  (the recruiter's optional note)
//   job       — { title?, company?, location?, salary_range?,
//                  job_description_url? }  (any field may be null)
//
// Behaviour:
//   - Subject and headline degrade cleanly when company is missing:
//     "New opportunity: <title>" rather than "<title> at undefined".
//   - When job_description_url is set we render a single "View Job
//     Posting" button. When it isn't, we render the structured
//     job-detail table (title/company/location/salary).
//   - Dashboard CTA sub-copy is the post-Google-SSO wording ("All your
//     introduction requests are tracked in one place.") — the stale
//     "Sign in with Google" line was the bug we de-duplicated to kill.
function buildIntroEmail({ introId, intro, job }) {
  const title = job?.title ? String(job.title) : '';
  const company = job?.company ? String(job.company) : '';

  // "<title> at <company>", or just one, or 'a new role' as last resort.
  const roleAndCompany = title && company
    ? `<strong>${escapeHtml(title)}</strong> role at <strong>${escapeHtml(company)}</strong>`
    : title
      ? `<strong>${escapeHtml(title)}</strong> role`
      : company
        ? `role at <strong>${escapeHtml(company)}</strong>`
        : 'a new role';

  const subjectTitle = title || 'role';
  const subjectCompany = company ? ` at ${company}` : '';
  const subject = `New opportunity: ${subjectTitle}${subjectCompany}`;

  const yesUrl = `${APP_BASE}/api/respond-to-intro?introId=${encodeURIComponent(introId)}&response=yes`;
  const noUrl  = `${APP_BASE}/api/respond-to-intro?introId=${encodeURIComponent(introId)}&response=no`;
  const dashboardUrl = `${APP_BASE}/candidate-dashboard`;

  const jobDetailBlock = job?.job_description_url
    ? `<div style="margin:20px 0"><a href="${escapeHtml(job.job_description_url)}" style="display:inline-block;background:${BRAND};color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">View Job Posting →</a></div>`
    : `<div style="background:#f8f9fa;border:1px solid #e9ecef;border-radius:8px;padding:16px;margin:20px 0">`
      + `<table style="border-collapse:collapse;width:100%">`
      + `<tr><td style="padding:4px 0;color:#666;font-size:14px;width:110px">Job Title</td><td style="padding:4px 0;font-size:14px;font-weight:600">${escapeHtml(title || '—')}</td></tr>`
      + `<tr><td style="padding:4px 0;color:#666;font-size:14px">Company</td><td style="padding:4px 0;font-size:14px">${escapeHtml(company || '—')}</td></tr>`
      + `<tr><td style="padding:4px 0;color:#666;font-size:14px">Location</td><td style="padding:4px 0;font-size:14px">${escapeHtml(job?.location || '—')}</td></tr>`
      + (job?.salary_range ? `<tr><td style="padding:4px 0;color:#666;font-size:14px">Salary</td><td style="padding:4px 0;font-size:14px">${escapeHtml(job.salary_range)}</td></tr>` : '')
      + `</table></div>`;

  const messageBlock = intro?.message
    ? `<p style="color:#555;font-style:italic">"${escapeHtml(intro.message)}"</p>`
    : '';

  const html =
    '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">'
    + `<img src="${APP_BASE}/logo.png" height="40" style="margin-bottom:24px" />`
    + `<h2 style="color:${BRAND}">You have a new opportunity</h2>`
    + '<p>Hi there,</p>'
    + `<p>A company is interested in connecting with you about ${roleAndCompany}.</p>`
    + messageBlock
    + jobDetailBlock
    + '<p>Are you open to connecting?</p>'
    + '<table style="border-collapse:collapse;margin:28px 0"><tr>'
    + `<td style="padding-right:12px"><a href="${yesUrl}" style="display:inline-block;background:${BRAND};color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">✅ Yes, I&#39;m interested</a></td>`
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

  return { subject, html };
}

export { buildIntroEmail };
