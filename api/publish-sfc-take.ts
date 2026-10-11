import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
// @ts-ignore — ESM JS helper, no .d.ts file
import { requireAdmin } from './_shared/requireAuth.js';
// @ts-ignore — ESM JS helper, no .d.ts file
import { scrubSfcTakeFields } from './_shared/scrubName.js';

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

  const { candidateId, unpublish } = (req.body || {}) as {
    candidateId?: string; unpublish?: boolean;
  };
  console.log('[publish-sfc-take] entry — candidateId:', candidateId, 'unpublish:', !!unpublish);

  if (!candidateId) {
    return res.status(400).json({ error: 'candidateId required' });
  }

  // Auth: verified bearer token, admin|owner only
  const caller = await requireAdmin(req, supabase);
  if ((caller as any).error) {
    console.warn('[publish-sfc-take] auth FAIL:', (caller as any).error);
    return res.status((caller as any).status).json({ error: (caller as any).error });
  }

  const nowIso = new Date().toISOString();
  const publishedAt = unpublish ? null : nowIso;

  // On PUBLISH (not unpublish), re-scrub the take + bullet arrays
  // before flipping published_at. The admin SfcTakeEditor saves the
  // draft directly to Supabase from the browser (handleSave in
  // src/components/admin/SfcTakeEditor.tsx writes via supabase.from(...)
  // .update(...) — bypassing any server hook), so without this pass an
  // admin who edits the draft and pastes the candidate's real name
  // back in would publish a take that recruiters render as-is. This
  // also cleans any legacy row that pre-dates the generator-side
  // scrub — admin just needs to re-trigger publish on each. The
  // unpublish branch leaves the take body alone (no need to scrub
  // when hiding) so unpublishing is still a single-column flip.
  let updatePayload: Record<string, unknown> = { sfc_take_published_at: publishedAt, updated_at: nowIso };

  if (!unpublish) {
    const { data: row, error: rowErr } = await supabase
      .from('candidates')
      .select('name, display_name, sfc_take, sfc_role_fit, sfc_strengths, sfc_considerations')
      .eq('id', candidateId)
      .maybeSingle();
    if (rowErr) {
      console.error('[publish-sfc-take] pre-publish row fetch failed:', JSON.stringify(rowErr));
      return res.status(500).json({ error: rowErr.message });
    }
    if (!row) return res.status(404).json({ error: 'Candidate not found' });

    const scrubbed = scrubSfcTakeFields(
      {
        sfc_take: (row as any).sfc_take,
        sfc_role_fit: (row as any).sfc_role_fit,
        sfc_strengths: (row as any).sfc_strengths,
        sfc_considerations: (row as any).sfc_considerations,
      },
      (row as any).name,
      (row as any).display_name
    );
    updatePayload = {
      ...updatePayload,
      sfc_take: scrubbed.sfc_take,
      sfc_role_fit: scrubbed.sfc_role_fit,
      sfc_strengths: scrubbed.sfc_strengths,
      sfc_considerations: scrubbed.sfc_considerations,
    };
  }

  const { error: updateErr } = await supabase
    .from('candidates')
    .update(updatePayload)
    .eq('id', candidateId);
  if (updateErr) {
    console.error('[publish-sfc-take] update failed:', JSON.stringify(updateErr));
    return res.status(500).json({ error: updateErr.message });
  }

  return res.status(200).json({ success: true, published_at: publishedAt });
}
