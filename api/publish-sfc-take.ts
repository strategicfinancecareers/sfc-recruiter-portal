import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// POST /api/publish-sfc-take
// body: { candidateId, adminUserId, unpublish?: boolean }
//
// Flips candidates.sfc_take_published_at to NOW() (or NULL when
// unpublish=true). This is the ONLY action that makes a Take visible
// to recruiters. Admin-only.

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );

  const { candidateId, adminUserId, unpublish } = (req.body || {}) as {
    candidateId?: string; adminUserId?: string; unpublish?: boolean;
  };
  console.log('[publish-sfc-take] entry — candidateId:', candidateId, 'adminUserId:', adminUserId, 'unpublish:', !!unpublish);

  if (!candidateId || !adminUserId) {
    return res.status(400).json({ error: 'candidateId and adminUserId required' });
  }

  // Auth: admin|owner only
  const { data: userRow, error: userErr } = await supabase
    .from('users')
    .select('id, is_active, roles ( name )')
    .eq('id', adminUserId)
    .maybeSingle();
  if (userErr) {
    console.error('[publish-sfc-take] user lookup failed:', JSON.stringify(userErr));
    return res.status(500).json({ error: userErr.message });
  }
  const roleName = (userRow as any)?.roles?.name;
  if (!userRow || (userRow as any).is_active === false || (roleName !== 'admin' && roleName !== 'owner')) {
    console.warn('[publish-sfc-take] auth FAIL — role:', roleName);
    return res.status(403).json({ error: 'Forbidden' });
  }

  const nowIso = new Date().toISOString();
  const publishedAt = unpublish ? null : nowIso;

  const { error: updateErr } = await supabase
    .from('candidates')
    .update({ sfc_take_published_at: publishedAt, updated_at: nowIso })
    .eq('id', candidateId);
  if (updateErr) {
    console.error('[publish-sfc-take] update failed:', JSON.stringify(updateErr));
    return res.status(500).json({ error: updateErr.message });
  }

  return res.status(200).json({ success: true, published_at: publishedAt });
}
