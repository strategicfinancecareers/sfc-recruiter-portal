import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { introId, response } = req.query;

  if (!introId || !response) {
    return res.status(400).send('Invalid request');
  }

  try {
    // Get intro request
    const { data: intro } = await supabase
      .from('introduction_requests')
      .select('*')
      .eq('id', introId)
      .single();

    if (!intro) return res.status(404).send('Not found');

    const accepted = response === 'yes';

    // Update status in database
    await supabase
      .from('introduction_requests')
      .update({ status: accepted ? 'approved' : 'rejected' })
      .eq('id', introId);

    // Fetch candidate, job, and recruiter separately to avoid FK ambiguity
    const [{ data: candidate }, { data: job }] = await Promise.all([
      supabase.from('candidates').select('*').eq('id', intro.candidate_id).single(),
      supabase.from('jobs').select('*, users:user_id(*)').eq('id', intro.job_id).single(),
    ]);

    // Email the recruiter
    const recruiterEmail = (job?.users as any)?.email;
    const candidateName = candidate?.display_name;
    const jobTitle = job?.title;
    const company = job?.company;

    if (recruiterEmail) {
      if (accepted) {
        await resend.emails.send({
          from: 'SFC Talent <noreply@strategicfinancecareers.com>',
          to: recruiterEmail,
          subject: `✅ ${candidateName} is interested in your ${jobTitle} role`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
              <img src="https://sfc-recruiter-portal.vercel.app/logo.png" height="40" style="margin-bottom: 24px;" />
              <h2 style="color: #0F6E56;">Great news — they're interested!</h2>
              <p><strong>${candidateName}</strong> has accepted your introduction request for the <strong>${jobTitle}</strong> role at <strong>${company}</strong>.</p>
              <div style="background: #f0faf6; border-left: 4px solid #0F6E56; padding: 16px; border-radius: 4px; margin: 24px 0;">
                <p style="margin: 0 0 8px;"><strong>Contact Details:</strong></p>
                <p style="margin: 0;">📧 ${candidate?.email}</p>
                ${candidate?.phone ? `<p style="margin: 4px 0 0;">📱 ${candidate?.phone}</p>` : ''}
              </div>
              <p style="color: #666; font-size: 14px;">We recommend reaching out within 24 hours while their interest is fresh.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
              <p style="color: #999; font-size: 12px;">SFC Talent · strategicfinancecareers.com</p>
            </div>
          `
        });
      } else {
        await resend.emails.send({
          from: 'SFC Talent <noreply@strategicfinancecareers.com>',
          to: recruiterEmail,
          subject: `${candidateName} passed on the ${jobTitle} role`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
              <img src="https://sfc-recruiter-portal.vercel.app/logo.png" height="40" style="margin-bottom: 24px;" />
              <h2 style="color: #333;">Update on your introduction request</h2>
              <p><strong>${candidateName}</strong> has passed on the <strong>${jobTitle}</strong> opportunity at this time.</p>
              <p>Don't worry — there are more great candidates available. <a href="https://sfc-recruiter-portal.vercel.app/browse" style="color: #0F6E56;">Browse candidates</a> to find your next match.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
              <p style="color: #999; font-size: 12px;">SFC Talent · strategicfinancecareers.com</p>
            </div>
          `
        });
      }
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
