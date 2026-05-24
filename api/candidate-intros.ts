import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { candidateId } = req.query;
  if (!candidateId || typeof candidateId !== 'string') {
    return res.status(400).json({ error: 'candidateId required' });
  }

  const { data, error } = await supabase
    .from('introduction_requests')
    .select('*, jobs(title, company, location, salary_range)')
    .eq('candidate_id', candidateId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[candidate-intros] query error:', error.message);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ requests: data || [] });
}
