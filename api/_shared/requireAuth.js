// Shared bearer-token authorization helpers for role-gated endpoints.
//
// Replaces the legacy pattern of trusting a caller-supplied adminUserId /
// requesterId / recruiterId. Those ids are not secrets (candidates.approved_by
// exposed admin ids, intro rows expose recruiter ids), so authorization must
// come from the validated JWT, never from a request parameter. Companion to
// verifyBearerEmail.js, which stays as-is for candidate-self endpoints that
// key on email rather than users.id.
//
// getAuthedUser(req, supabase) →
//   { userId, email, role, isActive, recruiterStatus }   — success
//   { error: '<message>', status: 401 }                  — missing/invalid token
//
// requireAdmin(req, supabase) →
//   { userId, email, role }                              — active admin/owner
//   { error, status: 401|403 }                           — otherwise
//
// `supabase` must be a service-role client (the users lookup bypasses RLS).

export async function getAuthedUser(req, supabase) {
  const authHeader = req.headers?.authorization || req.headers?.Authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(authHeader);
  if (!match || !match[1].trim()) {
    return { error: 'Missing Authorization bearer token', status: 401 };
  }

  // Validates signature + expiry against the live auth server — do not
  // trust an un-validated JWT.
  const { data, error } = await supabase.auth.getUser(match[1].trim());
  if (error || !data?.user?.id) {
    return { error: 'Invalid or expired session', status: 401 };
  }

  const { data: row, error: rowErr } = await supabase
    .from('users')
    .select('id, is_active, recruiter_status, roles ( name )')
    .eq('id', data.user.id)
    .maybeSingle();
  if (rowErr) {
    return { error: rowErr.message, status: 500 };
  }

  return {
    userId: data.user.id,
    email: (data.user.email || '').toLowerCase().trim(),
    role: row?.roles?.name || null,
    isActive: row ? row.is_active !== false : false,
    recruiterStatus: row?.recruiter_status || null,
  };
}

export async function requireAdmin(req, supabase) {
  const caller = await getAuthedUser(req, supabase);
  if (caller.error) return caller;
  if (!caller.isActive || (caller.role !== 'admin' && caller.role !== 'owner')) {
    return { error: 'Forbidden', status: 403 };
  }
  return caller;
}
