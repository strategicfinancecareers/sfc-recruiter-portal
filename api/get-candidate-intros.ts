import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.query;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'email required' });
  }

  try {
    // Look up candidate by email
    const { data: candidate, error: candErr } = await supabase
      .from('candidates')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .or('status.eq.active,status.is.null')
      .maybeSingle();

    if (candErr) {
      console.error('[get-candidate-intros] candidate lookup error:', candErr);
      return res.status(500).json({ error: candErr.message });
    }
    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    // Fetch intro requests using service role (bypasses RLS)
    const { data: intros, error: introsErr } = await supabase
      .from('introduction_requests')
      // FK hint required: 2 FKs between introduction_requests and jobs.
      .select('*, jobs!fk_introduction_requests_job(title, company, salary_range, location)')
      .eq('candidate_id', candidate.id)
      .order('created_at', { ascending: false });

    if (introsErr) {
      console.error('[get-candidate-intros] intros fetch error:', introsErr);
      return res.status(500).json({ error: introsErr.message });
    }

    return res.status(200).json({ intros: intros || [] });
  } catch (err: any) {
    console.error('[get-candidate-intros] unhandled:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
