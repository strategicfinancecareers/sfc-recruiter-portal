import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
// @ts-ignore - ESM JS helpers, no .d.ts files
import { getAuthedUser } from './_shared/requireAuth.js';
// @ts-ignore - ESM JS helpers, no .d.ts files
import { FREE_MONTHS_CODES, FREE_TRIAL_DAYS, normalizeCode } from './_shared/promoCodes.js';
// @ts-ignore - ESM JS helpers, no .d.ts files
import { rateLimit } from './_shared/rateLimit.js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// POST { code } -> { valid, kind: 'subscription', trialDays } | { valid: false }
//
// Lets the pricing UI confirm a subscription promo BEFORE checkout so the
// recruiter sees what they're getting (and can still enter the placement
// code) instead of being bounced straight to Stripe. Signed-in users only
// + per-user rate limit, so the code list cannot be enumerated anonymously.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const caller = await getAuthedUser(req, supabase);
  if ((caller as any).error) {
    return res.status((caller as any).status).json({ error: (caller as any).error });
  }

  const allowed = await rateLimit(supabase, `promo:${(caller as any).userId}`, { windowSeconds: 600, max: 15 });
  if (!allowed) {
    return res.status(429).json({ error: 'Too many attempts. Please wait a few minutes.' });
  }

  const code = normalizeCode((req.body || {}).code);
  if (!code) return res.status(400).json({ error: 'code required' });

  if (FREE_MONTHS_CODES.includes(code)) {
    return res.status(200).json({ valid: true, kind: 'subscription', trialDays: FREE_TRIAL_DAYS });
  }
  return res.status(200).json({ valid: false });
}
