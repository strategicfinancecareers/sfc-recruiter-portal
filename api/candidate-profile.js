import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
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

      const { data: candidate, error } = await supabase
        .from('candidates')
        .select('id, name, display_name, email, label, profile_description, open_to_opportunities, location, experience, education, highest_education_level, status, work_preference, target_salary, preferred_cities, target_roles, linkedin_url, primary_background, secondary_backgrounds')
        .eq('email', emailStr)
        .eq('status', 'active')
        .maybeSingle();

      console.log('[candidate-profile] found:', !!candidate, 'error:', error?.message);

      if (error) return res.status(500).json({ error: error.message });
      if (!candidate) return res.status(404).json({ error: 'No candidate found' });

      // Fetch skills separately to avoid join serialization issues
      const { data: skillsData } = await supabase
        .from('candidate_skills')
        .select('skills(skill)')
        .eq('candidate_id', candidate.id);

      const skills = (skillsData || []).map(s => s.skills?.skill).filter(Boolean);

      return res.status(200).json({ candidate: { ...candidate, skills } });
    }

    if (req.method === 'PATCH') {
      const { id, ...updates } = req.body;
      if (!id) return res.status(400).json({ error: 'id required' });
      const { error } = await supabase.from('candidates').update(updates).eq('id', id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[candidate-profile] CRASH:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
