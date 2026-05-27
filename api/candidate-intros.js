import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { candidateId } = req.query;
    if (!candidateId) return res.status(400).json({ error: 'candidateId required' });

    const { data, error } = await supabase
      .from('introduction_requests')
      // FK hints required: there are 2 FKs each between introduction_requests
      // and jobs / users (auto-generated *_fkey + explicit fk_*).
      // Recruiter (requester) details are full-reveal on the candidate side
      // — recruiters are vetted at signup so no anonymity in this direction.
      .select(`
        *,
        jobs!fk_introduction_requests_job(title, company, location, salary_range, job_description_url),
        requester:users!fk_introduction_requests_requester(first_name, last_name, company)
      `)
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[candidate-intros] query error:', error);
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json({ requests: data || [] });
  } catch (err) {
    console.error('[candidate-intros] handler error:', err);
    return res.status(500).json({ error: err.message });
  }
}
