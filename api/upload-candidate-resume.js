import { createClient } from '@supabase/supabase-js';
import { verifyBearerEmail } from './_shared/verifyBearerEmail.js';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/upload-candidate-resume — candidate-self resume upload.
//
// Phase A of the multi-resume rework. Uploads a PDF to the private
// `resumes` bucket and INSERTs a corresponding candidate_resumes row.
// Enforces the 2-cap server-side; auto-assigns is_default=true when
// the candidate has no other resumes.
//
// SECURITY MODEL — mirrors /api/candidate-profile and the other
// candidate-self writers:
//   - Bearer JWT in Authorization → validated via the shared
//     verifyBearerEmail helper. 401 missing/invalid/expired.
//   - candidateId in body; server-side lookup of the row's email +
//     case-insensitive match against the verified token. 403 mismatch,
//     404 missing/deleted.
//   - Service-role client used only after ownership is verified.
//
// VALIDATION (default-deny on every field):
//   - candidateId        — required, string.
//   - resumeBase64       — required, string. Decoded byte length capped
//                          at MAX_RESUME_BYTES (5 MB).
//   - fileName           — optional; used only for the storage object
//                          name. Defaults to a timestamp.
//   - label              — required, string; trimmed; non-empty;
//                          capped at MAX_LABEL_LENGTH (40).
//
// 2-CAP ENFORCEMENT:
//   COUNT(*) FROM candidate_resumes WHERE candidate_id = $1.
//   If >= 2, return 409 with a clear error so the UI can surface
//   "delete one of your existing resumes first." Never allow a write
//   that would land a 3rd row.
// ─────────────────────────────────────────────────────────────────────────────

const RESUMES_BUCKET = 'resumes';
const MAX_RESUMES_PER_CANDIDATE = 2;
const MAX_RESUME_BYTES = 5 * 1024 * 1024;   // 5 MB after base64 decode
const MAX_LABEL_LENGTH = 40;

function slugifyName(name) {
  return (name || 'candidate').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'candidate';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { candidateId, resumeBase64, fileName, label } = req.body || {};
    if (!candidateId || typeof candidateId !== 'string') {
      return res.status(400).json({ error: 'candidateId required' });
    }
    if (!resumeBase64 || typeof resumeBase64 !== 'string') {
      return res.status(400).json({ error: 'resumeBase64 required' });
    }
    if (!label || typeof label !== 'string' || !label.trim()) {
      return res.status(400).json({ error: 'label required (non-empty string)' });
    }
    const labelTrimmed = label.trim().slice(0, MAX_LABEL_LENGTH);

    // ── Auth ────────────────────────────────────────────────────────
    const auth = await verifyBearerEmail(req, supabase);
    if (auth.error) {
      console.warn('[upload-candidate-resume] auth FAIL:', auth.error);
      return res.status(auth.status).json({ error: auth.error });
    }

    // ── Ownership ───────────────────────────────────────────────────
    const { data: target, error: lookupErr } = await supabase
      .from('candidates')
      .select('id, name, email, status')
      .eq('id', candidateId)
      .maybeSingle();
    if (lookupErr) {
      console.error('[upload-candidate-resume] candidate lookup FAILED:', JSON.stringify(lookupErr));
      return res.status(500).json({ error: lookupErr.message });
    }
    if (!target || target.status === 'deleted') return res.status(404).json({ error: 'Candidate not found' });
    const ownerEmail = String(target.email || '').toLowerCase().trim();
    if (!ownerEmail || ownerEmail !== auth.email) {
      console.warn('[upload-candidate-resume] ownership FAIL:', { verified: auth.email, owner: ownerEmail });
      return res.status(403).json({ error: 'Forbidden' });
    }

    // ── 2-cap (server-side, before doing any work) ──────────────────
    const { count, error: countErr } = await supabase
      .from('candidate_resumes')
      .select('*', { count: 'exact', head: true })
      .eq('candidate_id', candidateId);
    if (countErr) {
      console.error('[upload-candidate-resume] count FAILED:', JSON.stringify(countErr));
      return res.status(500).json({ error: countErr.message });
    }
    const existing = count ?? 0;
    if (existing >= MAX_RESUMES_PER_CANDIDATE) {
      return res.status(409).json({
        error: `You can have at most ${MAX_RESUMES_PER_CANDIDATE} resumes on file. Delete one first.`,
        existing,
        cap: MAX_RESUMES_PER_CANDIDATE,
      });
    }

    // ── Decode + size validate ──────────────────────────────────────
    let buffer;
    try {
      buffer = Buffer.from(resumeBase64, 'base64');
    } catch (err) {
      return res.status(400).json({ error: 'resumeBase64 is not valid base64' });
    }
    if (buffer.length === 0) return res.status(400).json({ error: 'Empty file' });
    if (buffer.length > MAX_RESUME_BYTES) {
      return res.status(413).json({ error: `Resume too large (${buffer.length} bytes; max ${MAX_RESUME_BYTES})` });
    }

    // ── Upload — same path convention as submit-candidate.ts ────────
    const nameSlug = slugifyName(target.name);
    const safeFileName = `${Date.now()}_${nameSlug}.pdf`;
    const objectPath = `candidates/${safeFileName}`;
    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from(RESUMES_BUCKET)
      .upload(objectPath, buffer, { contentType: 'application/pdf', upsert: false });
    if (uploadErr || !uploadData?.path) {
      console.error('[upload-candidate-resume] storage upload FAILED:', JSON.stringify({
        message: uploadErr?.message, statusCode: uploadErr?.statusCode, attemptedPath: objectPath,
      }));
      return res.status(500).json({ error: uploadErr?.message || 'Storage upload failed' });
    }

    // ── INSERT candidate_resumes (is_default=true if first) ─────────
    // UNIQUE(candidate_id, label) means a duplicate label returns 409
    // from PostgREST; surface that cleanly so the UI knows to ask for
    // a different label. Roll back the bucket upload on failure so
    // we don't leak orphan files when a duplicate-label happens.
    const isDefault = existing === 0;
    const { data: row, error: insertErr } = await supabase
      .from('candidate_resumes')
      .insert({
        candidate_id: candidateId,
        label: labelTrimmed,
        storage_path: uploadData.path,
        is_default: isDefault,
      })
      .select('*')
      .single();
    if (insertErr) {
      console.error('[upload-candidate-resume] INSERT FAILED:', JSON.stringify(insertErr));
      // Best-effort cleanup of the just-uploaded object.
      await supabase.storage.from(RESUMES_BUCKET).remove([uploadData.path]).catch(() => {});
      if (insertErr.code === '23505') {
        return res.status(409).json({ error: `You already have a resume labeled "${labelTrimmed}".` });
      }
      return res.status(500).json({ error: insertErr.message });
    }

    // ── Keep the deprecated single-resume mirror in sync ────────────
    // candidates.resume_full_url is the column current readers fall
    // back to during Phase A. If this upload is the candidate's NEW
    // default (i.e. their first resume), mirror its storage_path
    // there so the old readers stay correct.
    if (isDefault) {
      const { error: mirrorErr } = await supabase
        .from('candidates')
        .update({ resume_full_url: uploadData.path })
        .eq('id', candidateId);
      if (mirrorErr) {
        console.warn('[upload-candidate-resume] mirror to candidates.resume_full_url failed:', mirrorErr.message);
      }
    }

    return res.status(200).json({ success: true, resume: row });
  } catch (err) {
    console.error('[upload-candidate-resume] handler FAILED:', JSON.stringify({ message: err?.message, stack: err?.stack }));
    return res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
