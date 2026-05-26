import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { requester_id, candidate_id, job_id, message } = req.body;

  if (!requester_id || !candidate_id) {
    return res.status(400).json({ error: 'requester_id and candidate_id required' });
  }

  try {
    const { data: intro, error } = await supabase
      .from('introduction_requests')
      .insert({
        requester_id,
        candidate_id,
        job_id: job_id || null,
        message: message || null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    // Send email to candidate — must be AWAITED before returning (Vercel freezes Lambda on res.json)
    console.log('[submit-intro] calling send-intro-email for introId:', intro.id);
    try {
      const emailRes = await fetch(
        `${process.env.VITE_APP_URL || 'https://sfc-recruiter-portal.vercel.app'}/api/send-intro-email`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ introId: intro.id }),
        }
      );
      const emailBody = await emailRes.json().catch(() => null);
      console.log('[submit-intro] send-intro-email response status:', emailRes.status, '| body:', JSON.stringify(emailBody));
    } catch (emailErr: any) {
      console.error('[submit-intro] send-intro-email fetch threw:', emailErr.message);
    }

    return res.status(200).json({ success: true, introId: intro.id });
  } catch (error: any) {
    console.error('[submit-intro] error:', error.message, JSON.stringify(error));
    return res.status(500).json({ error: error.message });
  }
}
