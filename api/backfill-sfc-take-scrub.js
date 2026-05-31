import { createClient } from '@supabase/supabase-js';
import { scrubSfcTakeFields } from './_shared/scrubName.js';

// POST /api/backfill-sfc-take-scrub
//   body: { adminUserId }
//
// One-shot administrative cleanup that re-scrubs every existing
// candidate row's SFC Take + bullet arrays so any rows written
// BEFORE the generator-side / publish-side scrubs were added stop
// containing the candidate's real name.
//
// Run this ONCE after deploying the recruiter-payload-name-removal
// change. Idempotent — re-running it is harmless (the scrubber is a
// no-op on already-clean text).
//
// Admin/owner only. Iterates every candidate that has any SFC Take
// content (sfc_take OR any of the three bullet arrays non-empty)
// regardless of status, because pending/inactive rows can still
// become active and serve their take to recruiters later.

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { adminUserId } = req.body || {};
  if (!adminUserId) return res.status(400).json({ error: 'adminUserId required' });

  // Auth: admin|owner only.
  const { data: userRow, error: userErr } = await supabase
    .from('users')
    .select('id, is_active, roles ( name )')
    .eq('id', adminUserId)
    .maybeSingle();
  if (userErr) {
    console.error('[backfill-sfc-take-scrub] user lookup failed:', JSON.stringify(userErr));
    return res.status(500).json({ error: userErr.message });
  }
  const roleName = userRow?.roles?.name;
  if (!userRow || userRow.is_active === false || (roleName !== 'admin' && roleName !== 'owner')) {
    console.warn('[backfill-sfc-take-scrub] auth FAIL — role:', roleName);
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Fetch every candidate that has any SFC Take content. We can't
  // filter on "non-empty array" cheaply in PostgREST so we pull all
  // rows with non-null name and non-null sfc_take OR any non-empty
  // array; the in-JS check below skips no-op rows.
  const { data: rows, error: fetchErr } = await supabase
    .from('candidates')
    .select('id, name, display_name, sfc_take, sfc_role_fit, sfc_strengths, sfc_considerations')
    .not('name', 'is', null);
  if (fetchErr) {
    console.error('[backfill-sfc-take-scrub] fetch failed:', JSON.stringify(fetchErr));
    return res.status(500).json({ error: fetchErr.message });
  }

  let inspected = 0;
  let updated = 0;
  const errors = [];

  for (const r of rows || []) {
    inspected++;
    const hasContent =
      (typeof r.sfc_take === 'string' && r.sfc_take.length > 0) ||
      (Array.isArray(r.sfc_role_fit) && r.sfc_role_fit.length > 0) ||
      (Array.isArray(r.sfc_strengths) && r.sfc_strengths.length > 0) ||
      (Array.isArray(r.sfc_considerations) && r.sfc_considerations.length > 0);
    if (!hasContent) continue;

    const scrubbed = scrubSfcTakeFields(
      {
        sfc_take: r.sfc_take,
        sfc_role_fit: r.sfc_role_fit,
        sfc_strengths: r.sfc_strengths,
        sfc_considerations: r.sfc_considerations,
      },
      r.name,
      r.display_name
    );

    // Skip the write if scrub was a no-op (already-clean rows
    // stay untouched, so updated_at doesn't churn).
    const changed =
      scrubbed.sfc_take !== r.sfc_take ||
      JSON.stringify(scrubbed.sfc_role_fit) !== JSON.stringify(r.sfc_role_fit) ||
      JSON.stringify(scrubbed.sfc_strengths) !== JSON.stringify(r.sfc_strengths) ||
      JSON.stringify(scrubbed.sfc_considerations) !== JSON.stringify(r.sfc_considerations);
    if (!changed) continue;

    const { error: upErr } = await supabase
      .from('candidates')
      .update({
        sfc_take: scrubbed.sfc_take,
        sfc_role_fit: scrubbed.sfc_role_fit,
        sfc_strengths: scrubbed.sfc_strengths,
        sfc_considerations: scrubbed.sfc_considerations,
        updated_at: new Date().toISOString(),
      })
      .eq('id', r.id);
    if (upErr) {
      console.error('[backfill-sfc-take-scrub] update failed for', r.id, ':', upErr.message);
      errors.push({ id: r.id, error: upErr.message });
      continue;
    }
    updated++;
  }

  return res.status(200).json({
    success: true,
    inspected,
    updated,
    ...(errors.length ? { errors } : {}),
  });
}
