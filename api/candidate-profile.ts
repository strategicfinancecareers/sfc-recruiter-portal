import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

console.log('SUPABASE_URL exists:', !!process.env.SUPABASE_URL);
console.log('SUPABASE_SERVICE_ROLE_KEY exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // PATCH — update candidate fields by id
  if (req.method === 'PATCH') {
    const { id, ...updates } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { error } = await supabase.from('candidates').update(updates).eq('id', id);
    if (error) {
      console.error('[candidate-profile] PATCH error:', JSON.stringify(error));
      return res.status(500).json({ error: error.message, details: JSON.stringify(error) });
    }
    return res.status(200).json({ success: true });
  }

  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'email required' });

  const emailStr = (email as string).toLowerCase().trim();
  console.log('[candidate-profile] looking up email:', emailStr);

  const { data: candidate, error } = await supabase
    .from('candidates')
    .select(`
      id, name, display_name, email, label,
      profile_description, open_to_opportunities,
      location, experience, education,
      highest_education_level, status,
      primary_background, secondary_backgrounds,
      work_preference, target_salary,
      phone, linkedin_url, created_at,
      candidate_skills(skills(skill))
    `)
    .eq('email', emailStr)
    .eq('status', 'active')
    .maybeSingle();

  console.log('[candidate-profile] result — id:', candidate?.id ?? 'null', '| error:', error?.message ?? null);

  if (error) {
    console.error('[candidate-profile] supabase error:', JSON.stringify(error));
    return res.status(500).json({ error: error.message, details: JSON.stringify(error) });
  }
  if (!candidate) return res.status(404).json({ error: 'No candidate found' });

  return res.status(200).json({ candidate });
}
