import { createClient } from '@supabase/supabase-js';
import { generateResumeSignedUrl } from './_shared/signedUrl.js';

// Note: introduction_requests.status uses 'approved' (not 'accepted') —
// see api/respond-to-intro.ts where the row is updated.
const APPROVED = 'approved';

export default async function handler(req, res) {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  if (req.method === 'GET') {
    const { candidateId, requesterId } = req.query;
    console.log('[get-resume-url] entry:', { method: 'GET', candidateId, requesterId });

    if (!candidateId || !requesterId) {
      return res.status(400).json({ error: 'candidateId and requesterId required' });
    }

    // Authorization: recruiter must have an approved intro request for this candidate.
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

    const result = await generateResumeSignedUrl(supabase, candidateId, 3600); // 1 hour
    if (result.status !== 200) {
      return res.status(result.status).json({ error: result.error });
    }
    return res.status(200).json({ url: result.url });
  }

  if (req.method === 'POST') {
    const { introId, expiresIn } = req.body || {};
    console.log('[get-resume-url] entry:', { method: 'POST', introId, expiresIn });

    if (!introId) {
      return res.status(400).json({ error: 'introId required' });
    }

    // Authorization: the intro must exist and be approved.
    const { data: intro, error: introErr } = await supabase
      .from('introduction_requests')
      .select('status, candidate_id')
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

    const result = await generateResumeSignedUrl(supabase, intro.candidate_id, expiresIn);
    if (result.status !== 200) {
      return res.status(result.status).json({ error: result.error });
    }
    return res.status(200).json({ url: result.url });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
