import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
// @ts-ignore - ESM JS helper, no .d.ts file
import { sendIntroEmailForIntro } from './_shared/sendIntroEmail.js';
// @ts-ignore — ESM JS helper, no .d.ts file
import { getAuthedUser } from './_shared/requireAuth.js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { candidate_id, job_id, message } = req.body;

  // Requester identity comes from the verified bearer token — the legacy
  // requester_id body field is ignored so intros cannot be forged on
  // another recruiter's behalf.
  const caller = await getAuthedUser(req, supabase);
  if ((caller as any).error) {
    return res.status((caller as any).status).json({ error: (caller as any).error });
  }
  const requester_id = (caller as any).userId as string;

  if (!candidate_id) {
    return res.status(400).json({ error: 'candidate_id required' });
  }

  try {
    const { data: intro, error } = await supabase
      .from('introduction_requests')
      .insert({
        requester_id,
        candidate_id,
        job_id: job_id || null,
        message: typeof message === 'string' && message.trim() ? message.trim().slice(0, 1000) : null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    // Email the candidate IN-PROCESS (awaited — Vercel freezes the lambda
    // after res.json). This used to be an HTTP hop to /api/send-intro-email
    // gated on INTERNAL_API_SECRET, which was never set in Vercel, so the
    // call 401'd and candidates silently never heard about their intros.
    const resend = new Resend(process.env.RESEND_API_KEY);
    const emailOutcome = await sendIntroEmailForIntro({ supabase, resend, introId: intro.id });
    if (emailOutcome.ok) {
      console.log('[submit-intro] candidate email sent for intro', intro.id, JSON.stringify(emailOutcome.emailResult));
    } else {
      console.error('[submit-intro] candidate email FAILED for intro', intro.id, '-', emailOutcome.error);
    }

    return res.status(200).json({ success: true, introId: intro.id, emailSent: emailOutcome.ok });
  } catch (error: any) {
    console.error('[submit-intro] error:', error.message, JSON.stringify(error));
    return res.status(500).json({ error: error.message });
  }
}
