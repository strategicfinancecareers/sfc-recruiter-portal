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
    // TODO: this is now a storage path, not a URL — generate a signed URL via /api/get-resume-url (to be built) before using.
    const { data, error } = await supabase
      .from('introduction_requests')
      .select(`
        *,
        candidate:candidates(id, name, display_name, email, phone, location, experience, education, highest_education_level, label, profile_description, resume_full_url),
        requester:users(id, first_name, last_name, email),
        job:jobs(id, title, company, location)
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
