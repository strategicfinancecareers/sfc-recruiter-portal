import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// GET /api/keep-alive — invoked daily by the Vercel cron in vercel.json.
//
// Supabase pauses FREE-tier projects after 7 days without API activity,
// which twice took this portal down mid-testing. One trivial read per day
// resets that clock, making the inactivity pause impossible while we stay
// on the free plan. (A pause triggered by QUOTA overruns is a different
// animal this cannot prevent; the dashboard usage page is the check for
// that.)
//
// Deliberately unauthenticated: it exposes nothing (a row count only in
// logs, not the response) and mutates nothing, so a stray public hit is
// harmless.

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const { count, error } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true });
    if (error) {
      console.error('[keep-alive] query failed:', error.message);
      return res.status(500).json({ ok: false });
    }
    console.log('[keep-alive] ok — users:', count);
    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('[keep-alive] threw:', err?.message);
    return res.status(500).json({ ok: false });
  }
}
