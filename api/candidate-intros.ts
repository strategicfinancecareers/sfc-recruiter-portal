import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    console.log('[candidate-intros] starting');
    console.log('SUPABASE_URL:', !!process.env.SUPABASE_URL);
    console.log('SERVICE_KEY:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);

    const { createClient } = await import('@supabase/supabase-js');
    console.log('[candidate-intros] supabase imported');

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    console.log('[candidate-intros] client created');

    const { candidateId } = req.query;
    console.log('[candidate-intros] candidateId:', candidateId);

    if (!candidateId) return res.status(400).json({ error: 'candidateId required' });

    const { data, error } = await supabase
      .from('introduction_requests')
      .select('*, jobs(title, company, location, salary_range)')
      .eq('candidate_id', candidateId as string)
      .order('created_at', { ascending: false });

    console.log('[candidate-intros] results:', data?.length, 'error:', error?.message);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ requests: data || [] });

  } catch (err: any) {
    console.error('[candidate-intros] CRASH:', err.message, err.stack);
    return res.status(500).json({ error: err.message });
  }
}
