import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { recruiterId } = req.query;
  if (!recruiterId) return res.status(400).json({ error: 'recruiterId required' });

  try {
    // FK hints required: introduction_requests has 2 FKs each to candidates,
    // jobs, and users (auto-generated *_fkey + explicit fk_* from migration
    // 20250809023925). Without a hint PostgREST returns 500.
    // candidate.resume_full_url is a storage path — consumers must call
    // /api/get-resume-url to obtain a signed download URL.
    const { data, error } = await supabase
      .from('introduction_requests')
      .select(`
        *,
        candidate:candidates!fk_introduction_requests_candidate(id, name, display_name, email, phone, location, experience, education, highest_education_level, label, profile_description, resume_full_url),
        requester:users!fk_introduction_requests_requester(id, first_name, last_name, email),
        job:jobs!fk_introduction_requests_job(id, title, company, location)
      `)
      .eq('requester_id', recruiterId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[recruiter-intros] query error:', error);
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json({ requests: data || [] });
  } catch (err) {
    console.error('[recruiter-intros] handler error:', err);
    return res.status(500).json({ error: err.message });
  }
}
