import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
// @ts-ignore — ESM JS helper, no .d.ts file
import { getAuthedUser } from './_shared/requireAuth.js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { candidateIds } = req.query;

  // Identity comes from the verified bearer token — the legacy requesterId
  // query param is ignored (recruiter ids are not secrets).
  const caller = await getAuthedUser(req, supabase);
  if ((caller as any).error) {
    return res.status((caller as any).status).json({ error: (caller as any).error });
  }
  const requesterId = (caller as any).userId as string;

  const ids = typeof candidateIds === 'string' ? candidateIds.split(',').filter(Boolean) : [];
  if (ids.length === 0) return res.status(200).json({ statuses: [] });

  const { data, error } = await supabase
    .from('introduction_requests')
    .select('candidate_id, status')
    .eq('requester_id', requesterId)
    .in('candidate_id', ids);

  if (error) {
    console.error('[intro-statuses] error:', error.message);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ statuses: data || [] });
}
