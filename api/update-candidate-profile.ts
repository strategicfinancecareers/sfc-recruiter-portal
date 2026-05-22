import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Verify the caller is an authenticated candidate
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user?.email) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const {
      bio, skills, jobSearchStatus, targetComp,
      workPreference, preferredCities, email, phone,
      openToOpportunities, currentRole, location,
    } = req.body;

    // Build profile_description (bio + availability metadata)
    const availNote = [
      jobSearchStatus ? `Job search status: ${jobSearchStatus}.` : '',
      targetComp ? `Target comp: ${targetComp}.` : '',
      workPreference ? `Work preference: ${workPreference}.` : '',
      Array.isArray(preferredCities) && preferredCities.length > 0
        ? `Preferred cities: ${preferredCities.join(', ')}.` : '',
    ].filter(Boolean).join(' ');
    const profileDescription = [bio, availNote].filter(Boolean).join('\n\n');

    // Update core candidate fields
    const { error: updateError } = await supabase
      .from('candidates')
      .update({
        profile_description: profileDescription || null,
        label: currentRole || undefined,
        location: location || undefined,
        email: email || undefined,
        phone: phone || null,
        open_to_opportunities: openToOpportunities,
      } as any)
      .eq('email', user.email);

    if (updateError) {
      console.error('[update-candidate-profile] update error:', JSON.stringify(updateError));
      return res.status(500).json({ error: updateError.message });
    }

    // Refresh skills if provided
    if (Array.isArray(skills)) {
      // Fetch candidate id
      const { data: cand } = await supabase
        .from('candidates').select('id').eq('email', user.email).single();
      if (cand?.id) {
        // Delete existing skills for this candidate
        await supabase.from('candidate_skills').delete().eq('candidate_id', cand.id);
        // Re-insert
        for (const skillName of skills) {
          if (!skillName?.trim()) continue;
          const { data: skillRow } = await supabase
            .from('skills')
            .upsert({ skill: skillName.trim() }, { onConflict: 'skill' })
            .select('id').single();
          if (skillRow?.id) {
            await supabase.from('candidate_skills').insert({
              candidate_id: cand.id,
              skill_id: skillRow.id,
            });
          }
        }
      }
    }

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error('[update-candidate-profile] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
