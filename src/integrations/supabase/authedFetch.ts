import { supabase } from './client';

// Tiny wrapper around fetch that attaches the current Supabase session's
// access token as a Bearer Authorization header. Used by candidate-self
// endpoints (e.g. /api/candidate-profile) where the server validates the
// JWT via supabase.auth.getUser(token) before returning or mutating the
// caller's own row.
//
// If there is no live session the request is sent WITHOUT an Authorization
// header — the server will then return 401 and the caller can surface
// that as a sign-in prompt. We deliberately don't throw here so callers
// can keep their existing res.ok / res.status branches intact.
export async function authedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const headers = new Headers(init.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);

  return fetch(input, { ...init, headers });
}
