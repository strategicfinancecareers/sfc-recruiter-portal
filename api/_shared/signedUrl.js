// Shared helper for generating Supabase Storage signed URLs for candidate resumes.
// Both /api/get-resume-url and /api/respond-to-intro use this so we avoid an
// internal HTTP round-trip. Files in api/_shared are not exposed as endpoints
// by Vercel (leading underscore).

const RESUMES_BUCKET = 'resumes';
const MAX_EXPIRES_IN = 7 * 24 * 60 * 60; // 7 days

/**
 * Generate a signed download URL for a candidate's resume.
 *
 * @param {object} supabase  - service-role Supabase client
 * @param {string} candidateId
 * @param {number} expiresIn - seconds; clamped to [60, 604800]
 * @returns {Promise<{ url?: string, status: number, error?: string }>}
 *   status mirrors the HTTP status the caller should return on failure;
 *   200 on success.
 */
export async function generateResumeSignedUrl(supabase, candidateId, expiresIn) {
  if (!candidateId) {
    return { status: 400, error: 'candidateId required' };
  }

  const safeExpires = Math.max(60, Math.min(MAX_EXPIRES_IN, Number(expiresIn) || 3600));

  // Look up the storage path stored in candidates.resume_full_url.
  const { data: candidate, error: lookupErr } = await supabase
    .from('candidates')
    .select('id, resume_full_url')
    .eq('id', candidateId)
    .maybeSingle();

  if (lookupErr) {
    console.error('[signedUrl] candidate lookup failed:', JSON.stringify({
      message: lookupErr.message,
      code: lookupErr.code,
      details: lookupErr.details,
    }));
    return { status: 500, error: lookupErr.message };
  }

  if (!candidate) {
    return { status: 404, error: 'candidate not found' };
  }

  if (!candidate.resume_full_url) {
    return { status: 404, error: 'no resume on file for this candidate' };
  }

  const { data: signed, error: signedErr } = await supabase.storage
    .from(RESUMES_BUCKET)
    .createSignedUrl(candidate.resume_full_url, safeExpires);

  if (signedErr || !signed?.signedUrl) {
    console.error('[signedUrl] createSignedUrl failed:', JSON.stringify({
      message: signedErr?.message,
      name: signedErr?.name,
      statusCode: signedErr?.statusCode,
      error: signedErr?.error,
      path: candidate.resume_full_url,
    }));
    return { status: 500, error: signedErr?.message || 'failed to generate signed URL' };
  }

  console.log('[signedUrl] signed URL generated, expires in', safeExpires, 's');
  return { status: 200, url: signed.signedUrl };
}
