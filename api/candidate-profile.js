import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Env check — logged on every request so we can confirm vars are present in prod
  console.log('[candidate-profile] env check:', {
    hasUrl: !!process.env.SUPABASE_URL,
    hasKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    if (req.method === 'GET') {
      const email = req.query.email;
      if (!email) return res.status(400).json({ error: 'email required' });

      const emailStr = email.toLowerCase().trim();
      console.log('[candidate-profile] looking up:', emailStr);

      // ── Step 1: candidate row ────────────────────────────────────────────────
      console.log('[candidate-profile] step 1: querying candidates by email');

      // Candidates can view their OWN profile in any state (pending, active,
      // rejected) — only 'deleted' rows are hidden. Recruiter-side queries
      // filter by status='active' separately in useCandidates / API endpoints.
      const { data: candidate, error: candidateError } = await supabase
        .from('candidates')
        .select('id, name, display_name, email, label, profile_description, open_to_opportunities, location, experience, education, highest_education_level, status, work_preference, target_salary, preferred_cities, target_roles, linkedin_url, primary_background, secondary_backgrounds')
        .eq('email', emailStr)
        .neq('status', 'deleted')
        .maybeSingle();

      if (candidateError) {
        console.error('[candidate-profile] step 1 FAILED:', JSON.stringify({
          message: candidateError.message,
          code: candidateError.code,
          hint: candidateError.hint,
          details: candidateError.details,
        }));
        return res.status(500).json({ error: candidateError.message });
      }

      console.log('[candidate-profile] step 1 done: found =', !!candidate);

      if (!candidate) return res.status(404).json({ error: 'No candidate found' });

      // ── Step 2: skills ───────────────────────────────────────────────────────
      console.log('[candidate-profile] step 2: querying skills for candidate_id', candidate.id);

      const { data: skillsData, error: skillsError } = await supabase
        .from('candidate_skills')
        .select('skills(skill)')
        .eq('candidate_id', candidate.id);

      if (skillsError) {
        console.error('[candidate-profile] step 2 FAILED:', JSON.stringify({
          message: skillsError.message,
          code: skillsError.code,
          hint: skillsError.hint,
          details: skillsError.details,
        }));
        return res.status(500).json({ error: skillsError.message });
      }

      const skills = (skillsData || []).map(s => s.skills?.skill).filter(Boolean);
      console.log('[candidate-profile] step 2 done: skills count =', skills.length);

      return res.status(200).json({ candidate: { ...candidate, skills } });
    }

    if (req.method === 'PATCH') {
      const { id, ...updates } = req.body;
      if (!id) return res.status(400).json({ error: 'id required' });

      console.log('[candidate-profile] PATCH candidate id:', id);

      const { error: patchError } = await supabase.from('candidates').update(updates).eq('id', id);
      if (patchError) {
        console.error('[candidate-profile] PATCH FAILED:', JSON.stringify({
          message: patchError.message,
          code: patchError.code,
          hint: patchError.hint,
          details: patchError.details,
        }));
        return res.status(500).json({ error: patchError.message });
      }
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[candidate-profile] handler FAILED:', JSON.stringify({
      message: err?.message,
      stack: err?.stack,
    }));
    return res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
