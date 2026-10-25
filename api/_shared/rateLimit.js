// Shared fixed-window rate limiter backed by public.api_rate_limits
// (migration 20261025_api_rate_limits). Atomic via the bump_rate_limit
// SECURITY DEFINER function — callable only with the service role.
//
// Fails OPEN: if the DB call errors we allow the request and log, so a
// Supabase hiccup never takes down the apply flow. The limits exist to
// stop runaway/abusive AI spend, not to be a hard security boundary.

export async function rateLimit(supabase, bucket, { windowSeconds, max }) {
  try {
    const { data, error } = await supabase.rpc('bump_rate_limit', {
      p_bucket: bucket,
      p_window_seconds: windowSeconds,
      p_max: max,
    });
    if (error) {
      console.error('[rateLimit] bump failed for', bucket, '-', error.message);
      return true;
    }
    if (data !== true) {
      console.warn('[rateLimit] limit exceeded for', bucket);
    }
    return data === true;
  } catch (err) {
    console.error('[rateLimit] unexpected error for', bucket, '-', err?.message || err);
    return true;
  }
}

// Client IP as Vercel reports it. Good enough for abuse throttling;
// never used for authorization.
export function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length > 0) return xf.split(',')[0].trim();
  const real = req.headers['x-real-ip'];
  if (typeof real === 'string' && real.length > 0) return real;
  return 'unknown';
}
