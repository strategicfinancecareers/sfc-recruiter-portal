import { createClient } from '@supabase/supabase-js';

// GET /api/admin-recruiter-detail?recruiterUserId=X&adminUserId=Y
//
// Admin-only drill-down for one recruiter: profile row, auth metadata
// (last sign-in, email confirmation — passwords are hashed by Supabase
// and can never be read, by anyone), and a high-level activity summary
// (jobs posted, favorites, introduction requests with statuses).
//
// Auth pattern matches review-recruiter.js: the caller passes their
// admin user id and we verify role + is_active server-side with the
// service-role client.

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { recruiterUserId, adminUserId } = req.query;
  if (!recruiterUserId || !adminUserId) {
    return res.status(400).json({ error: 'recruiterUserId and adminUserId required' });
  }

  try {
    // ── Auth: admin or owner only ────────────────────────────────────────
    const { data: adminRow, error: adminErr } = await supabase
      .from('users')
      .select('id, is_active, roles ( name )')
      .eq('id', adminUserId)
      .maybeSingle();
    if (adminErr) {
      console.error('[admin-recruiter-detail] admin lookup failed:', JSON.stringify(adminErr));
      return res.status(500).json({ error: adminErr.message });
    }
    const roleName = adminRow?.roles?.name;
    if (!adminRow || adminRow.is_active === false || (roleName !== 'admin' && roleName !== 'owner')) {
      console.warn('[admin-recruiter-detail] auth FAIL — role:', roleName);
      return res.status(403).json({ error: 'Forbidden' });
    }

    // ── Recruiter profile row ────────────────────────────────────────────
    const { data: recruiter, error: recErr } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, company, linkedin_url, recruiter_status, rejection_reason, approved_at, approved_by, created_at, updated_at, is_active, roles ( name )')
      .eq('id', recruiterUserId)
      .maybeSingle();
    if (recErr) {
      console.error('[admin-recruiter-detail] recruiter lookup failed:', JSON.stringify(recErr));
      return res.status(500).json({ error: recErr.message });
    }
    if (!recruiter) return res.status(404).json({ error: 'Recruiter not found' });

    // ── Auth metadata (last login, email confirmation) ───────────────────
    // Best-effort: if the auth lookup fails we still return the rest.
    let auth = null;
    try {
      const { data: authData, error: authErr } = await supabase.auth.admin.getUserById(recruiterUserId);
      if (authErr) {
        console.warn('[admin-recruiter-detail] auth lookup failed:', authErr.message);
      } else if (authData?.user) {
        auth = {
          last_sign_in_at: authData.user.last_sign_in_at || null,
          email_confirmed_at: authData.user.email_confirmed_at || null,
          auth_created_at: authData.user.created_at || null,
          // Sign-in providers (e.g. ['email'] or ['google']) — the closest
          // safe thing to "password information": HOW they sign in. The
          // password itself is a hash and unreadable by design.
          providers: (authData.user.identities || []).map(i => i.provider).filter(Boolean),
        };
      }
    } catch (e) {
      console.warn('[admin-recruiter-detail] auth lookup threw:', e?.message);
    }

    // ── Activity: intros, jobs, favorites (parallel, each best-effort) ───
    const [introsRes, jobsRes, favsRes] = await Promise.all([
      supabase
        .from('introduction_requests')
        .select(`
          id, status, created_at, responded_at,
          candidate:candidates!fk_introduction_requests_candidate(display_name, name),
          job:jobs!fk_introduction_requests_job(title, company)
        `)
        .eq('requester_id', recruiterUserId)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('jobs')
        .select('id, title, company, status, created_at')
        .eq('user_id', recruiterUserId)
        .order('created_at', { ascending: false })
        .limit(25),
      supabase
        .from('user_favorites')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', recruiterUserId),
    ]);

    if (introsRes.error) console.warn('[admin-recruiter-detail] intros query error:', introsRes.error.message);
    if (jobsRes.error)   console.warn('[admin-recruiter-detail] jobs query error:', jobsRes.error.message);
    if (favsRes.error)   console.warn('[admin-recruiter-detail] favorites count error:', favsRes.error.message);

    return res.status(200).json({
      recruiter,
      auth,
      intros: introsRes.data || [],
      jobs: jobsRes.data || [],
      favoritesCount: favsRes.count ?? 0,
    });
  } catch (err) {
    console.error('[admin-recruiter-detail] error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
