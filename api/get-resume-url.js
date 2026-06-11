import { createClient } from '@supabase/supabase-js';
import { generateResumeSignedUrl, generateBestResumeSignedUrlForIntro } from './_shared/signedUrl.js';

// Multi-resume Phase A: both GET and POST now accept an optional
// resumeId / selected_resume_id. When supplied, the helper prefers
// that specific candidate_resumes row; otherwise it falls back to the
// candidate's default candidate_resumes row, then to the deprecated
// candidates.resume_full_url. Recruiter + admin auth gates are
// unchanged — only the URL-resolution path picks up the new model.

// Note: introduction_requests.status uses 'approved' (not 'accepted') —
// see api/respond-to-intro.ts where the row is updated.
const APPROVED = 'approved';

export default async function handler(req, res) {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  if (req.method === 'GET') {
    const { candidateId, requesterId, adminUserId, resumeId } = req.query;
    console.log('[get-resume-url] entry:', { method: 'GET', candidateId, requesterId, adminUserId, resumeId });

    if (!candidateId || (!requesterId && !adminUserId)) {
      return res.status(400).json({ error: 'candidateId and (requesterId | adminUserId) required' });
    }

    // ── Admin path: any admin/owner can download any candidate's resume ────
    if (adminUserId) {
      const { data: userRow, error: userErr } = await supabase
        .from('users')
        .select('id, is_active, roles ( name )')
        .eq('id', adminUserId)
        .maybeSingle();

      if (userErr) {
        console.error('[get-resume-url] admin lookup failed:', JSON.stringify(userErr));
        return res.status(500).json({ error: userErr.message });
      }
      const roleName = userRow?.roles?.name;
      if (!userRow || userRow.is_active === false || (roleName !== 'admin' && roleName !== 'owner')) {
        console.warn('[get-resume-url] auth FAIL (admin): user/role invalid');
        return res.status(403).json({ error: 'Forbidden' });
      }

      const result = await generateBestResumeSignedUrlForIntro({
        supabase, candidateId, selectedResumeId: resumeId || null, expiresIn: 3600,
      });
      if (result.status !== 200) return res.status(result.status).json({ error: result.error });
      return res.status(200).json({ url: result.url });
    }

    // ── Recruiter path: must have an approved intro request for this candidate ──
    const { data: intro, error: introErr } = await supabase
      .from('introduction_requests')
      .select('id')
      .eq('candidate_id', candidateId)
      .eq('requester_id', requesterId)
      .eq('status', APPROVED)
      .limit(1)
      .maybeSingle();

    if (introErr) {
      console.error('[get-resume-url] auth check (GET) failed:', JSON.stringify({
        message: introErr.message, code: introErr.code, details: introErr.details,
      }));
      return res.status(500).json({ error: introErr.message });
    }

    if (!intro) {
      console.warn('[get-resume-url] auth FAIL (GET): no approved intro for candidate+requester');
      return res.status(403).json({ error: 'No approved introduction request for this candidate' });
    }

    // Phase A: prefer ?resumeId (matches what the recruiter modal will
    // pass once Phase B's "selected resume" UI lands), then fall back
    // to the candidate's default candidate_resumes row, then to the
    // deprecated candidates.resume_full_url. Recruiter auth (approved
    // intro) unchanged.
    const result = await generateBestResumeSignedUrlForIntro({
      supabase, candidateId, selectedResumeId: resumeId || null, expiresIn: 3600,
    });
    if (result.status !== 200) {
      return res.status(result.status).json({ error: result.error });
    }
    return res.status(200).json({ url: result.url });
  }

  if (req.method === 'POST') {
    const { introId, expiresIn, resumeId } = req.body || {};
    console.log('[get-resume-url] entry:', { method: 'POST', introId, expiresIn, resumeId });

    if (!introId) {
      return res.status(400).json({ error: 'introId required' });
    }

    // Authorization: the intro must exist and be approved. We also
    // read selected_resume_id so the helper can prefer the resume the
    // candidate explicitly chose for this intro (Phase B UI).
    const { data: intro, error: introErr } = await supabase
      .from('introduction_requests')
      .select('status, candidate_id, selected_resume_id')
      .eq('id', introId)
      .maybeSingle();

    if (introErr) {
      console.error('[get-resume-url] auth check (POST) failed:', JSON.stringify({
        message: introErr.message, code: introErr.code, details: introErr.details,
      }));
      return res.status(500).json({ error: introErr.message });
    }

    if (!intro) {
      console.warn('[get-resume-url] auth FAIL (POST): intro not found');
      return res.status(404).json({ error: 'intro not found' });
    }

    if (intro.status !== APPROVED) {
      console.warn('[get-resume-url] auth FAIL (POST): intro status is', intro.status);
      return res.status(403).json({ error: 'introduction request is not approved' });
    }

    const result = await generateBestResumeSignedUrlForIntro({
      supabase,
      candidateId: intro.candidate_id,
      // Explicit body resumeId beats the intro's selected_resume_id —
      // the caller may want a specific one. Otherwise fall through to
      // the intro's selection, then the candidate's default, then the
      // deprecated mirror.
      selectedResumeId: resumeId || intro.selected_resume_id || null,
      expiresIn,
    });
    if (result.status !== 200) {
      return res.status(result.status).json({ error: result.error });
    }
    return res.status(200).json({ url: result.url });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
