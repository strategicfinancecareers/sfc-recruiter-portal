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
        candidate:candidates!fk_introduction_requests_candidate(id, name, display_name, email, phone, linkedin_url, location, experience, education, highest_education_level, label, profile_description, resume_full_url, sfc_take, sfc_role_fit, sfc_strengths, sfc_considerations, sfc_take_published_at),
        requester:users!fk_introduction_requests_requester(id, first_name, last_name, email),
        job:jobs!fk_introduction_requests_job(id, title, company, location)
      `)
      .eq('requester_id', recruiterId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[recruiter-intros] query error:', error);
      return res.status(500).json({ error: error.message });
    }

    // ── Anonymity scrub ───────────────────────────────────────────────────
    // Strict rule: a recruiter only sees the candidate's real identity
    // when the candidate has explicitly accepted the introduction
    // (status='approved'). For pending/rejected/anything-else, strip
    // every PII field server-side so the network payload contains zero
    // identifying data — UI gates downstream are a second line of defence,
    // not the primary one.
    //
    // Fields kept (anonymized profile): id, display_name, label, location,
    // experience, education, highest_education_level, profile_description.
    // Fields stripped on non-approved: name, email, phone, resume_full_url,
    // sfc_take, sfc_role_fit, sfc_strengths, sfc_considerations,
    // sfc_take_published_at (the SFC Take is a post-approval reveal too
    // when surfaced via an intro context).
    const scrubbed = (data || []).map((req) => {
      if (req.status === 'approved') return req;
      const c = req.candidate;
      if (!c) return req;
      return {
        ...req,
        candidate: {
          id: c.id,
          display_name: c.display_name,
          label: c.label,
          location: c.location,
          experience: c.experience,
          education: c.education,
          highest_education_level: c.highest_education_level,
          profile_description: c.profile_description,
          // Explicitly null the PII so the type shape stays consistent
          // for the downstream IntroductionRequest hook transform.
          name: null,
          email: null,
          phone: null,
          linkedin_url: null,
          resume_full_url: null,
          sfc_take: null,
          sfc_role_fit: null,
          sfc_strengths: null,
          sfc_considerations: null,
          sfc_take_published_at: null,
        },
      };
    });

    return res.status(200).json({ requests: scrubbed });
  } catch (err) {
    console.error('[recruiter-intros] handler error:', err);
    return res.status(500).json({ error: err.message });
  }
}
