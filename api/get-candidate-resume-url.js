import { createClient } from '@supabase/supabase-js';
import { verifyBearerEmail } from './_shared/verifyBearerEmail.js';
import { generateResumeSignedUrlForResume } from './_shared/signedUrl.js';

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/get-candidate-resume-url?id=<resume_id>
//
// Candidate-self path — the previously missing "let me preview my own
// resume" URL. The existing /api/get-resume-url has admin and
// approved-recruiter paths only, by design (a candidate's own
// resume URL is candidate-self auth, not approved-intro auth, so it
// belongs in its own endpoint with its own gate).
//
// SECURITY MODEL:
//   - Bearer JWT via verifyBearerEmail. 401 missing/invalid.
//   - Load candidate_resumes row by id; join candidate; the verified
//     token's email must match the candidate row's email. 403 mismatch,
//     404 missing/deleted.
//   - Returns a 1-hour signed URL via the shared helper.
// ─────────────────────────────────────────────────────────────────────────────

const EXPIRES_IN = 60 * 60; // 1 hour — matches /api/get-resume-url's recruiter path

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { id } = req.query || {};
    if (!id || typeof id !== 'string') return res.status(400).json({ error: 'id (resume id) required' });

    // ── Auth ────────────────────────────────────────────────────────
    const auth = await verifyBearerEmail(req, supabase);
    if (auth.error) {
      console.warn('[get-candidate-resume-url] auth FAIL:', auth.error);
      return res.status(auth.status).json({ error: auth.error });
    }

    // ── Ownership ───────────────────────────────────────────────────
    const { data: row, error: lookupErr } = await supabase
      .from('candidate_resumes')
      .select('id, candidate_id, candidates!candidate_resumes_candidate_id_fkey ( id, email, status )')
      .eq('id', id)
      .maybeSingle();
    if (lookupErr) {
      console.error('[get-candidate-resume-url] lookup FAILED:', JSON.stringify(lookupErr));
      return res.status(500).json({ error: lookupErr.message });
    }
    if (!row) return res.status(404).json({ error: 'Resume not found' });
    const cand = row.candidates;
    if (!cand || cand.status === 'deleted') return res.status(404).json({ error: 'Candidate not found' });
    const ownerEmail = String(cand.email || '').toLowerCase().trim();
    if (!ownerEmail || ownerEmail !== auth.email) {
      console.warn('[get-candidate-resume-url] ownership FAIL:', { verified: auth.email, owner: ownerEmail });
      return res.status(403).json({ error: 'Forbidden' });
    }

    const result = await generateResumeSignedUrlForResume(supabase, id, EXPIRES_IN);
    if (result.status !== 200) return res.status(result.status).json({ error: result.error });
    return res.status(200).json({ url: result.url });
  } catch (err) {
    console.error('[get-candidate-resume-url] handler FAILED:', JSON.stringify({ message: err?.message, stack: err?.stack }));
    return res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
