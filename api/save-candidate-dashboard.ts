import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email, bio, workPreference, targetComp, openToOpportunities } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    // Rebuild profile_description: preserve existing meta, replace known keys
    const { data: cand } = await supabase
      .from('candidates')
      .select('id, profile_description')
      .eq('email', email.trim().toLowerCase())
      .single();

    if (!cand) return res.status(404).json({ error: 'Candidate not found' });

    // Extract existing meta parts (everything except the ones we're overwriting)
    const oldDesc = cand.profile_description || '';
    const oldParts = oldDesc.split('\n\n');
    const oldMeta = oldParts.slice(1).join(' ').trim();

    // Rebuild meta line
    const metaParts: string[] = [];
    if (workPreference) metaParts.push(`Work preference: ${workPreference}.`);
    if (targetComp) metaParts.push(`Target comp: ${targetComp}.`);
    // Preserve other meta (job search status, preferred cities) from existing
    const jobStatusMatch = oldMeta.match(/Job search status: ([^.]+)\.?/);
    const citiesMatch = oldMeta.match(/Preferred cities: ([^.]+)\.?/);
    if (jobStatusMatch) metaParts.push(`Job search status: ${jobStatusMatch[1]}.`);
    if (citiesMatch) metaParts.push(`Preferred cities: ${citiesMatch[1]}.`);

    const newMeta = metaParts.join(' ');
    const newDesc = [bio, newMeta].filter(Boolean).join('\n\n');

    await supabase
      .from('candidates')
      .update({
        profile_description: newDesc || null,
        open_to_opportunities: openToOpportunities,
      } as any)
      .eq('id', cand.id);

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error('[save-candidate-dashboard] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
