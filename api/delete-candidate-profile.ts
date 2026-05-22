import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user?.email) return res.status(401).json({ error: 'Unauthorized' });

  try {
    // Fetch candidate id
    const { data: cand } = await supabase
      .from('candidates')
      .select('id')
      .eq('email', user.email)
      .single();

    if (cand?.id) {
      // Delete candidate_skills first (FK constraint)
      await supabase.from('candidate_skills').delete().eq('candidate_id', cand.id);
      // Delete candidate row
      await supabase.from('candidates').delete().eq('id', cand.id);
    }

    // Delete Supabase auth user
    await supabase.auth.admin.deleteUser(user.id);

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error('[delete-candidate-profile] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
