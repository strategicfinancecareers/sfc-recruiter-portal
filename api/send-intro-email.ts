import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
// @ts-ignore — ESM JS helper, no .d.ts file
import { buildIntroEmail } from './_shared/introEmail.js';

const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[send-intro-email] hit —', req.method, JSON.stringify(req.body));

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { introId } = req.body;
  console.log('send-intro-email called with introId:', introId);

  if (!introId) {
    console.error('[send-intro-email] missing introId');
    return res.status(400).json({ error: 'introId required' });
  }

  // Check env vars are present
  console.log('RESEND_API_KEY exists:', !!process.env.RESEND_API_KEY);
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

    console.log('Candidate email:', candidate?.email);
    console.log('[send-intro-email] intro loaded — candidate email:', candidate?.email, '| job:', job?.title, '@', job?.company);

    if (!candidate?.email) {
      console.error('[send-intro-email] candidate email is missing — cannot send');
      return res.status(422).json({ error: 'Candidate email missing' });
    }

    console.log('[send-intro-email] sending email to:', candidate?.email);

    // Subject + html come from the shared template module so this
    // endpoint and /api/resend-intro-email cannot drift again. Pre-fix,
    // this site rendered "at undefined" when company was null and
    // pitched a non-existent "Sign in with Google" CTA; both are gone
    // now by virtue of using the shared builder.
    const { subject, html } = buildIntroEmail({ introId, intro, job });

    const emailResult = await resend.emails.send({
      from: 'SFC Talent <noreply@strategicfinancecareers.com>',
      to: candidate?.email,
      subject,
      html,
    });

    console.log('[send-intro-email] Resend result:', JSON.stringify(emailResult));
    return res.status(200).json({ success: true, emailResult });
  } catch (error: any) {
    console.error('[send-intro-email] caught error:', error?.message || String(error));
    return res.status(500).json({ error: 'Failed to send email', message: error?.message || String(error) });
  }
}
