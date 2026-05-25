import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('SUPABASE_URL exists:', !!supabaseUrl);
  console.log('SUPABASE_SERVICE_ROLE_KEY exists:', !!supabaseKey);

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Missing Supabase credentials' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  if (req.method === 'GET') {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'email required' });

    const emailStr = (email as string).toLowerCase().trim();
    console.log('Looking up email:', emailStr);

    const { data: candidate, error } = await supabase
      .from('candidates')
      .select('id, name, display_name, email, label, profile_description, open_to_opportunities, location, experience, education, highest_education_level, status, candidate_skills(skills(skill))')
      .eq('email', emailStr)
      .eq('status', 'active')
      .maybeSingle();

    console.log('Result:', candidate ? 'found' : 'not found', error?.message);

    if (error) return res.status(500).json({ error: error.message });
    if (!candidate) return res.status(404).json({ error: 'No candidate found' });
    return res.status(200).json({ candidate });
  }

  if (req.method === 'PATCH') {
    const { id, ...updates } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { error } = await supabase.from('candidates').update(updates).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
