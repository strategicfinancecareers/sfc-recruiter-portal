import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { requesterId, candidateIds } = req.query;

  if (!requesterId) return res.status(400).json({ error: 'requesterId required' });

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
