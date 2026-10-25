import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
// @ts-ignore — ESM JS helper, no .d.ts file
import { sendIntroEmailForIntro } from './_shared/sendIntroEmail.js';
// @ts-ignore — ESM JS helper, no .d.ts file
import { requireAdmin } from './_shared/requireAuth.js';

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

  // ── Auth: internal call (x-internal-call secret, used by submit-intro)
  //    or a verified admin bearer token. Never callable anonymously —
  //    this endpoint emails candidates.
  const internalHeader = req.headers['x-internal-call'];
  const internalCall =
    typeof internalHeader === 'string' &&
    internalHeader.length > 0 &&
    !!process.env.INTERNAL_API_SECRET &&
    internalHeader === process.env.INTERNAL_API_SECRET;
  if (!internalCall) {
    const caller = await requireAdmin(req, supabase);
    if ((caller as any).error) {
      console.warn('[send-intro-email] auth FAIL:', (caller as any).error);
      return res.status((caller as any).status).json({ error: (caller as any).error });
    }
  }

  // Check env vars are present
  console.log('RESEND_API_KEY exists:', !!process.env.RESEND_API_KEY);
  console.log('[send-intro-email] env check — RESEND_API_KEY:', !!process.env.RESEND_API_KEY, '| SUPABASE_URL:', !!process.env.SUPABASE_URL, '| SERVICE_ROLE_KEY:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);

  const outcome = await sendIntroEmailForIntro({ supabase, resend, introId });
  if (!outcome.ok) {
    console.error('[send-intro-email] failed:', outcome.error);
    return res.status(outcome.status || 500).json({ error: outcome.error });
  }
  console.log('[send-intro-email] Resend result:', JSON.stringify(outcome.emailResult));
  return res.status(200).json({ success: true, emailResult: outcome.emailResult });
}
