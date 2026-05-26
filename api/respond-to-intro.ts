import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
// @ts-ignore — ESM JS helper, no .d.ts file
import { generateResumeSignedUrl } from './_shared/signedUrl.js';

const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const TEST_CC_EMAIL = 'lillian.daya@gmail.com';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { introId, response } = req.query;

  console.log('[respond-to-intro] introId:', introId, 'response:', response);

  if (!introId || !response) {
    return res.status(400).send('Invalid request');
  }

  try {
    // Get intro request
    const { data: intro, error: introErr } = await supabase
      .from('introduction_requests')
      .select('*')
      .eq('id', introId)
      .single();

    console.log('[respond-to-intro] intro:', JSON.stringify(intro), 'introErr:', JSON.stringify(introErr));

    if (!intro) return res.status(404).send('Not found');

    const accepted = response === 'yes';

    // Update status in database
    const { error: updateErr } = await supabase
      .from('introduction_requests')
      .update({ status: accepted ? 'approved' : 'rejected' })
      .eq('id', introId);
    console.log('[respond-to-intro] status update error:', JSON.stringify(updateErr));

    // Fetch candidate, job, and recruiter user in parallel
    const [{ data: candidate }, { data: job }, { data: recruiterUser }] = await Promise.all([
      supabase.from('candidates').select('*').eq('id', intro.candidate_id).single(),
      supabase.from('jobs').select('*').eq('id', intro.job_id).single(),
      intro.requester_id
        ? supabase.from('users').select('email, first_name, last_name').eq('id', intro.requester_id).single()
        : Promise.resolve({ data: null }),
    ]);

    console.log('[respond-to-intro] recruiterUser:', JSON.stringify(recruiterUser));
    console.log('[respond-to-intro] job:', JSON.stringify({ id: job?.id, title: job?.title, company: job?.company, user_id: job?.user_id }));

    // Determine recruiter email: prefer user lookup, fallback to TEST_CC
    const recruiterEmail: string = (recruiterUser as any)?.email || TEST_CC_EMAIL;
    const toList = recruiterEmail === TEST_CC_EMAIL ? [TEST_CC_EMAIL] : [recruiterEmail, TEST_CC_EMAIL];
    console.log('[respond-to-intro] sending email to:', JSON.stringify(toList));

    console.log('[respond-to-intro] candidate fields:', JSON.stringify({ name: candidate?.name, display_name: candidate?.display_name, email: candidate?.email, phone: candidate?.phone, has_resume: !!candidate?.resume_full_url }));

    const candidateName = candidate?.name || candidate?.display_name || 'The candidate';
    const jobTitle = job?.title;
    const company = job?.company;

    if (accepted) {
      // Generate a 7-day signed URL for the recruiter to download the resume.
      // If signed-URL generation fails for any reason, fall back to a portal
      // link — don't fail the whole acceptance flow over an email cosmetic.
      let resumeDownloadUrl: string | null = null;
      if (candidate?.resume_full_url && candidate?.id) {
        const result = await generateResumeSignedUrl(supabase, candidate.id, 7 * 24 * 60 * 60);
        if (result.status === 200 && result.url) {
          resumeDownloadUrl = result.url;
        } else {
          console.warn('[respond-to-intro] signed URL fallback:', result.status, result.error);
        }
      }

      const resumeBlock = resumeDownloadUrl
        ? `<div style="margin:16px 0"><a href="${resumeDownloadUrl}" style="display:inline-block;background:#0F6E56;color:white;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600">📎 Download Resume</a><p style="margin:8px 0 0;color:#999;font-size:12px">Link valid for 7 days.</p></div>`
        : (candidate?.resume_full_url
            ? '<p style="color:#888;font-size:13px">Resume download will be available in the SFC portal.</p>'
            : '');

      const yesHtml = '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">'
        + '<img src="https://sfc-recruiter-portal.vercel.app/logo.png" height="40" style="margin-bottom:24px" />'
        + '<h2 style="color:#0F6E56">Great news — they\'re interested!</h2>'
        + `<p><strong>${candidateName}</strong> has accepted your introduction request for the <strong>${jobTitle}</strong> role at <strong>${company}</strong>.</p>`
        + '<div style="background:#f0faf6;border-left:4px solid #0F6E56;padding:16px;border-radius:4px;margin:24px 0">'
        + '<p style="margin:0 0 10px"><strong>Candidate Details:</strong></p>'
        + `<p style="margin:0 0 6px">👤 <strong>${candidateName}</strong></p>`
        + `<p style="margin:0 0 6px">📧 <a href="mailto:${candidate?.email}" style="color:#0F6E56">${candidate?.email}</a></p>`
        + (candidate?.phone ? `<p style="margin:0">📱 <a href="tel:${candidate?.phone}" style="color:#0F6E56">${candidate?.phone}</a></p>` : '')
        + '</div>'
        + resumeBlock
        + '<p style="color:#666;font-size:14px">We recommend reaching out within 24 hours while their interest is fresh.</p>'
        + '<hr style="border:none;border-top:1px solid #eee;margin:24px 0" />'
        + '<p style="color:#999;font-size:12px">SFC Talent · strategicfinancecareers.com</p>'
        + '</div>';

      console.log('[respond-to-intro] sending YES email, signed URL included:', !!resumeDownloadUrl);
      const { data: emailData, error: emailErr } = await resend.emails.send({
        from: 'SFC Talent <noreply@strategicfinancecareers.com>',
        to: toList,
        subject: `✅ ${candidateName} is interested in your ${jobTitle} role`,
        html: yesHtml,
      });
      console.log('[respond-to-intro] YES email result:', JSON.stringify({ emailData, emailErr }));
    } else {
      console.log('[respond-to-intro] sending NO email');
      const { data: noEmailData, error: noEmailErr } = await resend.emails.send({
        from: 'SFC Talent <noreply@strategicfinancecareers.com>',
        to: toList,
        subject: `${candidateName} passed on the ${jobTitle} role`,
        html: '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">'
          + '<img src="https://sfc-recruiter-portal.vercel.app/logo.png" height="40" style="margin-bottom:24px" />'
          + '<h2 style="color:#333">Update on your introduction request</h2>'
          + `<p><strong>${candidateName}</strong> has passed on the <strong>${jobTitle}</strong> opportunity at this time.</p>`
          + `<p>Don't worry — there are more great candidates available. <a href="https://sfc-recruiter-portal.vercel.app/browse" style="color:#0F6E56">Browse candidates</a> to find your next match.</p>`
          + '<hr style="border:none;border-top:1px solid #eee;margin:24px 0" />'
          + '<p style="color:#999;font-size:12px">SFC Talent · strategicfinancecareers.com</p>'
          + '</div>',
      });
      console.log('[respond-to-intro] NO email result:', JSON.stringify({ noEmailData, noEmailErr }));
    }

    // Return a clean HTML response page
    return res.status(200).send(`
      <html>
        <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f9f9f9;">
          <div style="text-align: center; padding: 40px; background: white; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); max-width: 400px;">
            <div style="font-size: 48px; margin-bottom: 16px;">${accepted ? '✅' : '👋'}</div>
            <h2 style="color: #333; margin: 0 0 8px;">${accepted ? "You're connected!" : 'No problem!'}</h2>
            <p style="color: #666;">${accepted ? 'The recruiter has been notified with your contact details. Expect to hear from them soon.' : "We've let the recruiter know. We'll be in touch if other opportunities come up."}</p>
          </div>
        </body>
      </html>
    `);

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).send('Something went wrong');
  }
}
