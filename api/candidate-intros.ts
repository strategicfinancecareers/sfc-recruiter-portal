import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('SUPABASE_URL exists:', !!supabaseUrl);
  console.log('SUPABASE_SERVICE_ROLE_KEY exists:', !!supabaseKey);

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Missing Supabase credentials' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { candidateId } = req.query;

  console.log('candidateId received:', candidateId);

  if (!candidateId) return res.status(400).json({ error: 'candidateId required' });

  const { data, error } = await supabase
    .from('introduction_requests')
    .select('*, jobs(title, company, location, salary_range)')
    .eq('candidate_id', candidateId as string)
    .order('created_at', { ascending: false });

  console.log('Results:', data?.length, 'Error:', error?.message);

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ requests: data || [] });
}
