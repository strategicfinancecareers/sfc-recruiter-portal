// Shared bearer-token verification helper for candidate-self endpoints.
//
// Pulled out of api/candidate-profile.js so any new candidate-self
// endpoint (e.g. /api/update-candidate-skills) can use the same
// validated-against-the-auth-server check instead of duplicating it.
// Same contract, same return shape — drop-in replacement.
//
// Returns either:
//   { email: '<lowercased verified email>' }                — success
//   { error: '<message>', status: 401 }                     — missing/invalid token
//
// Callers should forward the error+status to the response if present.
// The `supabase` argument can be either an anon-key or service-role
// client; .auth.getUser(jwt) hits the auth server regardless of which
// key the client was created with — it validates the JWT signature
// and expiry against the live auth server, NOT against any RLS state.

export async function verifyBearerEmail(req, supabase) {
  const authHeader = req.headers?.authorization || req.headers?.Authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(authHeader);
  if (!match) {
    return { error: 'Missing Authorization bearer token', status: 401 };
  }
  const token = match[1].trim();
  if (!token) return { error: 'Missing Authorization bearer token', status: 401 };

  // supabase.auth.getUser(jwt) hits the auth server to validate
  // signature + expiry — do not trust an un-validated JWT.
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user?.email) {
    return { error: 'Invalid or expired session', status: 401 };
  }
  return { email: data.user.email.toLowerCase().trim() };
}
