import { createClient } from '@supabase/supabase-js';
import { verifyBearerEmail } from './_shared/verifyBearerEmail.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { candidateId } = req.query;
    if (!candidateId) return res.status(400).json({ error: 'candidateId required' });

    // ── Auth: the caller's verified email must own this candidate row ──
    const authResult = await verifyBearerEmail(req, supabase);
    if (authResult.error) {
      return res.status(authResult.status).json({ error: authResult.error });
    }
    const { data: candRow, error: candRowErr } = await supabase
      .from('candidates')
      .select('id, email')
      .eq('id', candidateId)
      .maybeSingle();
    if (candRowErr) {
      console.error('[candidate-intros] candidate lookup error:', candRowErr);
      return res.status(500).json({ error: candRowErr.message });
    }
    if (!candRow || (candRow.email || '').toLowerCase().trim() !== authResult.email) {
      console.warn('[candidate-intros] auth FAIL: token email does not own candidateId');
      return res.status(403).json({ error: 'Forbidden' });
    }

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
