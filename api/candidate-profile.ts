import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'email required' });

  const emailStr = (email as string).toLowerCase().trim();
  console.log('Looking up candidate for email:', emailStr);

  const { data: candidate, error } = await supabase
    .from('candidates')
    .select(`
      id, name, display_name, email, label,
      profile_description, open_to_opportunities,
      location, experience, education,
      highest_education_level, status,
      primary_background, secondary_backgrounds,
      work_preference, target_salary, preferred_cities,
      phone, linkedin_url, created_at,
      candidate_skills(skills(skill))
    `)
    .eq('email', emailStr)
    .eq('status', 'active')
    .maybeSingle();

  console.log('Candidate found:', candidate?.id, 'Error:', error);

  if (error) return res.status(500).json({ error: error.message });
  if (!candidate) return res.status(404).json({ error: 'No candidate found' });

  return res.status(200).json({ candidate });
}
