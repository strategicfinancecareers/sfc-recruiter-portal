// Shared helper for generating Supabase Storage signed URLs for candidate resumes.
// Used by /api/get-resume-url, /api/respond-to-intro, /api/get-candidate-resume-url,
// and submit-candidate's admin email. Files in api/_shared are not
// exposed as endpoints by Vercel (leading underscore).
//
// Three entry points are exported:
//   - generateResumeSignedUrl(supabase, candidateId, expiresIn)
//       Legacy: signs candidates.resume_full_url. KEPT FOR BACKWARD
//       COMPATIBILITY with single-resume callers during Phase A; the
//       deprecated column remains populated as a mirror of the
//       candidate's default candidate_resumes row.
//   - generateResumeSignedUrlForResume(supabase, resumeId, expiresIn)
//       New: signs the specific candidate_resumes row's storage_path,
//       regardless of whether it's the default. Used by the new
//       /api/get-candidate-resume-url endpoint and by callers that
//       already know which resume_id to serve.
//   - generateBestResumeSignedUrlForIntro({ supabase, candidateId,
//       selectedResumeId, expiresIn })
//       New: implements the Phase-A fallback chain for intro flows.
//       Tries the intro's explicitly-selected resume first, then the
//       candidate's default candidate_resumes row, then the
//       deprecated candidates.resume_full_url. Returns the same
//       { status, url, error } shape as the others.

const RESUMES_BUCKET = 'resumes';
const MAX_EXPIRES_IN = 7 * 24 * 60 * 60; // 7 days

function clampExpires(expiresIn) {
  return Math.max(60, Math.min(MAX_EXPIRES_IN, Number(expiresIn) || 3600));
}

async function signPath(supabase, path, expiresIn) {
  const safeExpires = clampExpires(expiresIn);
  const { data: signed, error: signedErr } = await supabase.storage
    .from(RESUMES_BUCKET)
    .createSignedUrl(path, safeExpires);
  if (signedErr || !signed?.signedUrl) {
    console.error('[signedUrl] createSignedUrl failed:', JSON.stringify({
      message: signedErr?.message,
      name: signedErr?.name,
      statusCode: signedErr?.statusCode,
      error: signedErr?.error,
      path,
    }));
    return { status: 500, error: signedErr?.message || 'failed to generate signed URL' };
  }
  console.log('[signedUrl] signed URL generated, expires in', safeExpires, 's');
  return { status: 200, url: signed.signedUrl };
}

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
  if (!candidateId) return { status: 400, error: 'candidateId required' };

  const { data: candidate, error: lookupErr } = await supabase
    .from('candidates')
    .select('id, resume_full_url')
    .eq('id', candidateId)
    .maybeSingle();

  if (lookupErr) {
    console.error('[signedUrl] candidate lookup failed:', JSON.stringify({
      message: lookupErr.message, code: lookupErr.code, details: lookupErr.details,
    }));
    return { status: 500, error: lookupErr.message };
  }
  if (!candidate) return { status: 404, error: 'candidate not found' };
  if (!candidate.resume_full_url) return { status: 404, error: 'no resume on file for this candidate' };

  return signPath(supabase, candidate.resume_full_url, expiresIn);
}

// Phase A: sign a specific candidate_resumes row by id. No fallback —
// caller is responsible for handling 404 (row doesn't exist) the way
// they want.
export async function generateResumeSignedUrlForResume(supabase, resumeId, expiresIn) {
  if (!resumeId) return { status: 400, error: 'resumeId required' };

  const { data: row, error: lookupErr } = await supabase
    .from('candidate_resumes')
    .select('id, candidate_id, storage_path')
    .eq('id', resumeId)
    .maybeSingle();
  if (lookupErr) {
    console.error('[signedUrl] candidate_resumes lookup failed:', JSON.stringify({
      message: lookupErr.message, code: lookupErr.code, details: lookupErr.details,
    }));
    return { status: 500, error: lookupErr.message };
  }
  if (!row) return { status: 404, error: 'resume not found' };
  if (!row.storage_path) return { status: 404, error: 'resume row has no storage path' };

  return signPath(supabase, row.storage_path, expiresIn);
}

// Phase A intro-flow fallback chain. Used by respond-to-intro and by
// the recruiter intro modal endpoint:
//   1. If selectedResumeId is set on the intro, sign that resume.
//   2. Else find the candidate's default candidate_resumes row and
//      sign it.
//   3. Else fall back to the deprecated candidates.resume_full_url.
// Returns a 404 only if all three paths fail. Caller treats this as a
// best-effort URL — if it 404s, the email/modal degrades gracefully
// (e.g. shows "no resume on file").
export async function generateBestResumeSignedUrlForIntro({
  supabase, candidateId, selectedResumeId, expiresIn,
}) {
  if (!candidateId) return { status: 400, error: 'candidateId required' };

  // 1. Explicit selection on the intro.
  if (selectedResumeId) {
    const r = await generateResumeSignedUrlForResume(supabase, selectedResumeId, expiresIn);
    if (r.status === 200) return r;
    console.warn('[signedUrl] selected_resume_id sign failed, falling through to default:', r.error);
  }

  // 2. Candidate's default candidate_resumes row.
  const { data: defaultRow, error: defErr } = await supabase
    .from('candidate_resumes')
    .select('id, storage_path')
    .eq('candidate_id', candidateId)
    .eq('is_default', true)
    .maybeSingle();
  if (defErr) {
    console.warn('[signedUrl] default-resume lookup failed, falling through to legacy column:', defErr.message);
  } else if (defaultRow?.storage_path) {
    const r = await signPath(supabase, defaultRow.storage_path, expiresIn);
    if (r.status === 200) return r;
    console.warn('[signedUrl] default-resume sign failed, falling through to legacy column:', r.error);
  }

  // 3. Deprecated single-resume column (always populated through Phase A
  //    because the backfill mirrored it, but kept as the last resort
  //    so this helper is robust if someone deletes a candidate_resumes
  //    row without updating the mirror).
  return generateResumeSignedUrl(supabase, candidateId, expiresIn);
}
