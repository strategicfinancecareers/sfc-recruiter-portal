import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/pending-candidates?userId={uuid}
 *   → list of candidates with status='pending', oldest first
 *
 * GET /api/pending-candidates?userId={uuid}&id={candidateUuid}
 *   → single candidate (any status) with full data including skills
 *
 * Both forms require userId to belong to a user with role IN ('admin', 'owner').
 * Service-role client bypasses RLS; auth check is enforced server-side.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { userId, id } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  // ── Auth: userId must resolve to an admin/owner ─────────────────────────────
  const { data: userRow, error: userErr } = await supabase
    .from('users')
    .select('id, is_active, roles ( name )')
    .eq('id', userId)
    .maybeSingle();

  if (userErr) {
    console.error('[pending-candidates] user lookup failed:', JSON.stringify({
      message: userErr.message, code: userErr.code, details: userErr.details,
    }));
    return res.status(500).json({ error: userErr.message });
  }

  if (!userRow) {
    console.warn('[pending-candidates] auth FAIL: user not found', userId);
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (userRow.is_active === false) {
    console.warn('[pending-candidates] auth FAIL: user inactive', userId);
    return res.status(403).json({ error: 'Forbidden' });
  }

  const roleName = userRow.roles?.name;
  if (roleName !== 'admin' && roleName !== 'owner') {
    console.warn('[pending-candidates] auth FAIL: role is', roleName, 'for user', userId);
    return res.status(403).json({ error: 'Forbidden' });
  }

  // ── Single candidate path ───────────────────────────────────────────────────
  if (id) {
    const { data: candidate, error: candErr } = await supabase
      .from('candidates')
      .select(`
        id, name, email, phone, display_name, label, location, experience,
        education, highest_education_level, profile_description,
        target_roles, primary_background, secondary_backgrounds,
        target_salary, work_preference, preferred_cities, linkedin_url,
        resume_full_url, status, created_at,
        sfc_take, sfc_role_fit, sfc_strengths, sfc_considerations,
        rejection_reason, approved_at, approved_by
      `)
      .eq('id', id)
      .maybeSingle();

    if (candErr) {
      console.error('[pending-candidates] single fetch failed:', JSON.stringify(candErr));
      return res.status(500).json({ error: candErr.message });
    }
    if (!candidate) return res.status(404).json({ error: 'Candidate not found' });

    const { data: skillsData, error: skillsErr } = await supabase
      .from('candidate_skills')
      .select('skills(skill)')
      .eq('candidate_id', candidate.id);

    if (skillsErr) {
      console.error('[pending-candidates] skills fetch failed:', JSON.stringify(skillsErr));
      return res.status(500).json({ error: skillsErr.message });
    }

    const skills = (skillsData || []).map(s => s.skills?.skill).filter(Boolean);
    return res.status(200).json({ candidate: { ...candidate, skills } });
  }

  // ── List path ───────────────────────────────────────────────────────────────
  // FIFO queue: oldest pending applications first.
  const { data: pending, error: listErr } = await supabase
    .from('candidates')
    .select(`
      id, name, email, phone, display_name, label, location, experience,
      education, profile_description, target_roles, primary_background,
      secondary_backgrounds, target_salary, work_preference,
      resume_full_url, created_at,
      candidate_skills(count)
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (listErr) {
    console.error('[pending-candidates] list fetch failed:', JSON.stringify(listErr));
    return res.status(500).json({ error: listErr.message });
  }

  // Flatten the count aggregate into a plain integer.
  const candidates = (pending || []).map(row => {
    const skillsCount = Array.isArray(row.candidate_skills) && row.candidate_skills[0]?.count
      ? row.candidate_skills[0].count
      : 0;
    const { candidate_skills, ...rest } = row;
    return { ...rest, skills_count: skillsCount };
  });

  return res.status(200).json({ candidates });
}
