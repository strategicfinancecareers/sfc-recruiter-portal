import { createClient } from '@supabase/supabase-js';

// GET /api/admin-pending-counts?adminUserId={uuid}
//   → { candidates: number, recruiters: number }
//
// Two cheap COUNTs used to drive the "pending" badges on the admin
// dashboard tabs. Service-role; admin/owner auth required (no anon
// surface).

const RECRUITER_ROLE_ID = 'e7b112a8-8493-46e6-bc02-ab8ca66a746a';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { adminUserId } = req.query;
  if (!adminUserId) return res.status(400).json({ error: 'adminUserId required' });

  // Auth: admin or owner only
  const { data: userRow, error: userErr } = await supabase
    .from('users')
    .select('id, is_active, roles ( name )')
    .eq('id', adminUserId)
    .maybeSingle();
  if (userErr) {
    console.error('[admin-pending-counts] user lookup failed:', JSON.stringify(userErr));
    return res.status(500).json({ error: userErr.message });
  }
  const roleName = userRow?.roles?.name;
  if (!userRow || userRow.is_active === false || (roleName !== 'admin' && roleName !== 'owner')) {
    console.warn('[admin-pending-counts] auth FAIL — role:', roleName);
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Counts in parallel — head:true skips returning rows
  const [candRes, recRes] = await Promise.all([
    supabase
      .from('candidates')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role_id', RECRUITER_ROLE_ID)
      .eq('recruiter_status', 'pending'),
  ]);

  if (candRes.error || recRes.error) {
    console.error('[admin-pending-counts] count error:', JSON.stringify({
      cand: candRes.error, rec: recRes.error,
    }));
    return res.status(500).json({ error: (candRes.error || recRes.error)?.message });
  }

  return res.status(200).json({
    candidates: candRes.count ?? 0,
    recruiters: recRes.count ?? 0,
  });
}
