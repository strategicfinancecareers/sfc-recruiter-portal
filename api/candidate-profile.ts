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
      .select('id, name, display_name, email, label, profile_description, open_to_opportunities, location, experience, education, highest_education_level, status, work_preference, target_salary, linkedin_url, candidate_skills(skills(skill))')
      .eq('email', emailStr)
      .eq('status', 'active')
      .maybeSingle();

    console.log('Result:', candidate ? 'found' : 'not found', error?.message);

    if (error) return res.status(500).json({ error: error.message });
    if (!candidate) return res.status(404).json({ error: 'No candidate found' });
    return res.status(200).json({ candidate });
  }

  if (req.method === 'PATCH') {
    const { id, skills: skillsArr, ...updates } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });

    // Try full update first
    const { error: updateErr } = await supabase.from('candidates').update(updates).eq('id', id);

    if (updateErr) {
      // Some columns may not exist yet — retry with only confirmed-safe columns
      console.warn('[candidate-profile] PATCH full update failed, retrying with safe columns:', updateErr.message);
      const safeColumns = [
        'profile_description', 'work_preference', 'target_salary',
        'open_to_opportunities', 'linkedin_url',
      ];
      const safeUpdates: Record<string, any> = {};
      for (const col of safeColumns) {
        if (col in updates) safeUpdates[col] = (updates as Record<string, any>)[col];
      }
      if (Object.keys(safeUpdates).length > 0) {
        const { error: safeErr } = await supabase.from('candidates').update(safeUpdates).eq('id', id);
        if (safeErr) return res.status(500).json({ error: safeErr.message });
      }
    }

    // Handle skills if provided — delete + re-insert via join table
    if (Array.isArray(skillsArr)) {
      await supabase.from('candidate_skills').delete().eq('candidate_id', id);
      for (const skillName of skillsArr) {
        if (!skillName?.trim()) continue;
        const { data: skillRow } = await supabase
          .from('skills')
          .upsert({ skill: skillName.trim() }, { onConflict: 'skill' })
          .select('id')
          .single();
        if (skillRow?.id) {
          await supabase.from('candidate_skills').insert({ candidate_id: id, skill_id: skillRow.id });
        }
      }
    }

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
