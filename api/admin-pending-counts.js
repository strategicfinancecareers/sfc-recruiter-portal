import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from './_shared/requireAuth.js';

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

  // Auth: verified bearer token, admin or owner only
  const caller = await requireAdmin(req, supabase);
  if (caller.error) {
    console.warn('[admin-pending-counts] auth FAIL:', caller.error);
    return res.status(caller.status).json({ error: caller.error });
  }

  // Counts in parallel — head:true skips returning rows
  const [candRes, recRes, introRes] = await Promise.all([
    supabase
      .from('candidates')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role_id', RECRUITER_ROLE_ID)
      .eq('recruiter_status', 'pending'),
    supabase
      .from('introduction_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
  ]);

  if (candRes.error || recRes.error || introRes.error) {
    console.error('[admin-pending-counts] count error:', JSON.stringify({
      cand: candRes.error, rec: recRes.error, intro: introRes.error,
    }));
    return res.status(500).json({ error: (candRes.error || recRes.error || introRes.error)?.message });
  }

  return res.status(200).json({
    candidates: candRes.count ?? 0,
    recruiters: recRes.count ?? 0,
    intros: introRes.count ?? 0,
  });
}
