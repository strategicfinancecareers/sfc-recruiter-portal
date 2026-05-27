import { createClient } from '@supabase/supabase-js';

// GET /api/admin-intros?adminUserId={uuid}
//   → platform-wide list of introduction_requests with embedded candidate,
//     job, and requester. Service-role client bypasses RLS; admin/owner
//     authorization is enforced server-side.
//
// Why this exists separately from /api/recruiter-intros:
//   The browser embed of users!fk_introduction_requests_requester(...)
//   resolves the public.users → auth.users → public.users chain in a way
//   that PostgREST refuses without the service role (permission denied,
//   PG code 42501). Routing through the service role sidesteps the
//   resolution entirely.

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { adminUserId } = req.query;
  if (!adminUserId) return res.status(400).json({ error: 'adminUserId required' });

  // ── Auth: admin or owner only ──────────────────────────────────────────────
  const { data: userRow, error: userErr } = await supabase
    .from('users')
    .select('id, is_active, roles ( name )')
    .eq('id', adminUserId)
    .maybeSingle();

  if (userErr) {
    console.error('[admin-intros] user lookup failed:', JSON.stringify({
      message: userErr.message, code: userErr.code, details: userErr.details,
    }));
    return res.status(500).json({ error: userErr.message });
  }

  if (!userRow) {
    console.warn('[admin-intros] auth FAIL: user not found', adminUserId);
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (userRow.is_active === false) {
    console.warn('[admin-intros] auth FAIL: user inactive', adminUserId);
    return res.status(403).json({ error: 'Forbidden' });
  }

  const roleName = userRow.roles?.name;
  if (roleName !== 'admin' && roleName !== 'owner') {
    console.warn('[admin-intros] auth FAIL: role is', roleName, 'for user', adminUserId);
    return res.status(403).json({ error: 'Forbidden' });
  }

  // ── Platform-wide intros (FK hints required — see Batch 1.5 commit) ───────
  const { data, error } = await supabase
    .from('introduction_requests')
    .select(`
      *,
      candidate:candidates!fk_introduction_requests_candidate(id, display_name, email, name, phone),
      job:jobs!fk_introduction_requests_job(title, company, location, salary_range),
      requester:users!fk_introduction_requests_requester(id, first_name, last_name, email)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[admin-intros] query failed:', JSON.stringify({
      message: error.message, code: error.code, hint: error.hint, details: error.details,
    }));
    return res.status(500).json({ error: error.message });
  }

  console.log('[admin-intros] returned', (data || []).length, 'rows for admin', adminUserId);
  return res.status(200).json({ requests: data || [] });
}
