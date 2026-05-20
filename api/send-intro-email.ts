import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[send-intro-email] hit —', req.method, JSON.stringify(req.body));

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { introId } = req.body;
  console.log('[send-intro-email] introId:', introId);

  if (!introId) {
    console.error('[send-intro-email] missing introId');
    return res.status(400).json({ error: 'introId required' });
  }

  // Check env vars are present
  console.log('[send-intro-email] env check — RESEND_API_KEY:', !!process.env.RESEND_API_KEY, '| SUPABASE_URL:', !!process.env.SUPABASE_URL, '| SERVICE_ROLE_KEY:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);

  try {
    console.log('[send-intro-email] fetching intro from Supabase...');
    const { data: intro, error: introError } = await supabase
      .from('introduction_requests')
      .select('*')
      .eq('id', introId)
      .single();

    if (introError) {
      console.error('[send-intro-email] intro fetch error:', JSON.stringify(introError));
      return res.status(500).json({ error: 'DB error', detail: introError.message });
    }
    if (!intro) {
      console.error('[send-intro-email] intro not found for id:', introId);
      return res.status(404).json({ error: 'Not found' });
    }

    // Fetch candidate and job separately to avoid FK ambiguity
    const [{ data: candidate, error: candError }, { data: job, error: jobError }] = await Promise.all([
      supabase.from('candidates').select('*').eq('id', intro.candidate_id).single(),
      supabase.from('jobs').select('*').eq('id', intro.job_id).single(),
    ]);

    if (candError) console.error('[send-intro-email] candidate fetch error:', JSON.stringify(candError));
    if (jobError) console.error('[send-intro-email] job fetch error:', JSON.stringify(jobError));

    console.log('[send-intro-email] intro loaded — candidate email:', candidate?.email, '| job:', job?.title, '@', job?.company);

    const baseUrl = 'https://sfc-recruiter-portal.vercel.app';
    const yesUrl = `${baseUrl}/api/respond-to-intro?introId=${introId}&response=yes`;
    const noUrl = `${baseUrl}/api/respond-to-intro?introId=${introId}&response=no`;

    // Build the job detail block: link if URL exists, else clean summary
    const jobDetailBlock = job?.job_description_url
      ? `<div style="margin: 20px 0;">
           <a href="${job.job_description_url}" style="background: #0F6E56; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">View Job Posting →</a>
         </div>`
      : `<div style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 16px; margin: 20px 0;">
           <table style="border-collapse: collapse; width: 100%;">
             <tr><td style="padding: 4px 0; color: #666; font-size: 14px; width: 110px;">Job Title</td><td style="padding: 4px 0; font-size: 14px; font-weight: 600;">${job?.title ?? '—'}</td></tr>
             <tr><td style="padding: 4px 0; color: #666; font-size: 14px;">Company</td><td style="padding: 4px 0; font-size: 14px;">${job?.company ?? '—'}</td></tr>
             <tr><td style="padding: 4px 0; color: #666; font-size: 14px;">Location</td><td style="padding: 4px 0; font-size: 14px;">${job?.location ?? '—'}</td></tr>
             ${job?.salary_range ? `<tr><td style="padding: 4px 0; color: #666; font-size: 14px;">Salary</td><td style="padding: 4px 0; font-size: 14px;">${job.salary_range}</td></tr>` : ''}
           </table>
         </div>`;

    console.log('[send-intro-email] sending email to:', candidate?.email);
    const emailResult = await resend.emails.send({
      from: 'SFC Talent <noreply@strategicfinancecareers.com>',
      to: candidate?.email,
      subject: `New opportunity: ${job?.title} at ${job?.company}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <img src="https://sfc-recruiter-portal.vercel.app/logo.png" height="40" style="margin-bottom: 24px;" />
          <h2 style="color: #0F6E56;">You have a new opportunity</h2>
          <p>Hi there,</p>
          <p>A company is interested in connecting with you about a <strong>${job?.title}</strong> role at <strong>${job?.company}</strong>.</p>
          ${intro.message ? `<p style="color: #555; font-style: italic;">"${intro.message}"</p>` : ''}
          ${jobDetailBlock}
          <p>Are you open to connecting?</p>
          <div style="margin: 32px 0; display: flex; gap: 12px;">
            <a href="${yesUrl}" style="background: #0F6E56; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; margin-right: 12px;">✅ Yes, I'm interested</a>
            <a href="${noUrl}" style="background: #f3f4f6; color: #333; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">❌ No thanks</a>
          </div>
          <p style="color: #666; font-size: 14px;">This introduction was facilitated by SFC Talent. Your contact details will only be shared if you click Yes.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #999; font-size: 12px;">SFC Talent · strategicfinancecareers.com</p>
        </div>
      `
    });

    console.log('[send-intro-email] Resend result:', JSON.stringify(emailResult));
    return res.status(200).json({ success: true, emailResult });
  } catch (error: any) {
    console.error('[send-intro-email] caught error:', error?.message || String(error));
    return res.status(500).json({ error: 'Failed to send email', message: error?.message || String(error) });
  }
}
