import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const candidateId = req.query.candidateId;
    console.log('[candidate-intros] candidateId:', candidateId);

    if (!candidateId) return res.status(400).json({ error: 'candidateId required' });

    const { data, error } = await supabase
      .from('introduction_requests')
      .select('*, jobs(title, company, location, salary_range)')
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: false });

    console.log('[candidate-intros] results:', data?.length, 'error:', error?.message);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ requests: data || [] });
  } catch (err) {
    console.error('[candidate-intros] CRASH:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
