import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { introId } = req.body;

  try {
    const { data: intro } = await supabase
      .from('introduction_requests')
      .select(`*, candidates(*), jobs(*)`)
      .eq('id', introId)
      .single();

    if (!intro) return res.status(404).json({ error: 'Not found' });

    const baseUrl = 'https://sfc-recruiter-portal.vercel.app';
    const yesUrl = `${baseUrl}/api/respond-to-intro?introId=${introId}&response=yes`;
    const noUrl = `${baseUrl}/api/respond-to-intro?introId=${introId}&response=no`;

    await resend.emails.send({
      from: 'SFC Talent <noreply@strategicfinancecareers.com>',
      to: intro.candidates?.email,
      subject: `New opportunity: ${intro.jobs?.title} at ${intro.jobs?.company}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <img src="https://sfc-recruiter-portal.vercel.app/logo.png" height="40" style="margin-bottom: 24px;" />
          <h2 style="color: #0F6E56;">You have a new opportunity</h2>
          <p>Hi there,</p>
          <p>A company is interested in connecting with you about a <strong>${intro.jobs?.title}</strong> role at <strong>${intro.jobs?.company}</strong> in <strong>${intro.jobs?.location}</strong>.</p>
          ${intro.jobs?.salary_range ? `<p>💰 Salary range: <strong>${intro.jobs?.salary_range}</strong></p>` : ''}
          ${intro.message ? `<p>Message from the recruiter: <em>"${intro.message}"</em></p>` : ''}
          <p>Are you open to connecting?</p>
          <div style="margin: 32px 0;">
            <a href="${yesUrl}" style="background: #0F6E56; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; margin-right: 12px;">✅ Yes, I'm interested</a>
            <a href="${noUrl}" style="background: #f3f4f6; color: #333; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">❌ No thanks</a>
          </div>
          <p style="color: #666; font-size: 14px;">This introduction was facilitated by SFC Talent. Your contact details will only be shared if you click Yes.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #999; font-size: 12px;">SFC Talent · strategicfinancecareers.com</p>
        </div>
      `
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Failed to send email' });
  }
}
