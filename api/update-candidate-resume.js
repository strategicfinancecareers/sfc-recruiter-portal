import { createClient } from '@supabase/supabase-js';
import { verifyBearerEmail } from './_shared/verifyBearerEmail.js';
import { parseResumeWithClaude } from './_shared/parseResumeWithClaude.js';

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/update-candidate-resume — candidate-self resume edit.
//
// Three orthogonal operations, any subset can be in one call:
//   - rename:       { id, label }
//   - set default:  { id, isDefault: true }
//   - replace file: { id, replaceBase64, replaceFileName?, reparse?: boolean }
//
// SECURITY MODEL — same shape as upload/delete:
//   - Bearer JWT validated via verifyBearerEmail. 401 missing/invalid.
//   - candidate_resumes row loaded by id; joined candidate's email
//     compared (case-insensitive) to the verified token email.
//     403 on mismatch, 404 missing/deleted.
//   - Service-role writes only after ownership is verified.
//
// VALIDATION (default-deny):
//   - id              — required, string.
//   - label           — optional, string; trimmed; 1..MAX_LABEL_LENGTH.
//                       UNIQUE(candidate_id, label) — duplicate returns
//                       409 with a clear message.
//   - isDefault       — optional, must be boolean true (no other
//                       value writes is_default). To DEMOTE a default
//                       the candidate must promote a different row.
//   - replaceBase64   — optional, string; decoded byte length capped
//                       at MAX_RESUME_BYTES (5 MB).
//   - replaceFileName — optional; only used for the new object name.
//   - reparse         — optional, boolean. ONLY meaningful when
//                       replaceBase64 is present AND this row is
//                       (becoming) the default. Triggers the Claude
//                       parser and returns the suggested fields in the
//                       response under `parsed`. The candidate's
//                       profile fields are NEVER auto-overwritten —
//                       the UI is expected to surface the parsed
//                       suggestions and let the candidate accept.
// ─────────────────────────────────────────────────────────────────────────────

const RESUMES_BUCKET = 'resumes';
const MAX_RESUME_BYTES = 5 * 1024 * 1024;
const MAX_LABEL_LENGTH = 40;

function slugifyName(name) {
  return (name || 'candidate').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'candidate';
}

export default async function handler(req, res) {
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { id, label, isDefault, replaceBase64, replaceFileName, reparse } = req.body || {};
    if (!id || typeof id !== 'string') return res.status(400).json({ error: 'id required' });

    // ── Auth ────────────────────────────────────────────────────────
    const auth = await verifyBearerEmail(req, supabase);
    if (auth.error) {
      console.warn('[update-candidate-resume] auth FAIL:', auth.error);
      return res.status(auth.status).json({ error: auth.error });
    }

    // ── Ownership: load the resume row + the owning candidate's email
    const { data: row, error: lookupErr } = await supabase
      .from('candidate_resumes')
      .select('id, candidate_id, label, storage_path, is_default, candidates!candidate_resumes_candidate_id_fkey ( id, name, email, status )')
      .eq('id', id)
      .maybeSingle();
    if (lookupErr) {
      console.error('[update-candidate-resume] lookup FAILED:', JSON.stringify(lookupErr));
      return res.status(500).json({ error: lookupErr.message });
    }
    if (!row) return res.status(404).json({ error: 'Resume not found' });
    const cand = row.candidates;
    if (!cand || cand.status === 'deleted') return res.status(404).json({ error: 'Candidate not found' });
    const ownerEmail = String(cand.email || '').toLowerCase().trim();
    if (!ownerEmail || ownerEmail !== auth.email) {
      console.warn('[update-candidate-resume] ownership FAIL:', { verified: auth.email, owner: ownerEmail });
      return res.status(403).json({ error: 'Forbidden' });
    }

    // ── Validate the requested edits ────────────────────────────────
    const updates = {};
    if (label !== undefined) {
      if (typeof label !== 'string' || !label.trim()) {
        return res.status(400).json({ error: 'label must be a non-empty string' });
      }
      updates.label = label.trim().slice(0, MAX_LABEL_LENGTH);
    }
    let promoteDefault = false;
    if (isDefault !== undefined) {
      if (isDefault !== true) {
        return res.status(400).json({ error: 'isDefault may only be set to true; demote by promoting a different row.' });
      }
      promoteDefault = true;
    }
    let willReplaceFile = false;
    let newPath = null;
    if (replaceBase64 !== undefined) {
      if (typeof replaceBase64 !== 'string') return res.status(400).json({ error: 'replaceBase64 must be a string' });
      let buffer;
      try { buffer = Buffer.from(replaceBase64, 'base64'); }
      catch { return res.status(400).json({ error: 'replaceBase64 is not valid base64' }); }
      if (buffer.length === 0) return res.status(400).json({ error: 'Empty file' });
      if (buffer.length > MAX_RESUME_BYTES) {
        return res.status(413).json({ error: `Resume too large (${buffer.length} bytes; max ${MAX_RESUME_BYTES})` });
      }
      // Upload new object before swapping the row's path — so a failed
      // upload doesn't leave the row pointing at a missing file.
      const nameSlug = slugifyName(cand.name);
      const safeFileName = `${Date.now()}_${nameSlug}.pdf`;
      const objectPath = `candidates/${safeFileName}`;
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from(RESUMES_BUCKET)
        .upload(objectPath, buffer, { contentType: 'application/pdf', upsert: false });
      if (uploadErr || !uploadData?.path) {
        console.error('[update-candidate-resume] storage upload FAILED:', JSON.stringify({
          message: uploadErr?.message, statusCode: uploadErr?.statusCode, attemptedPath: objectPath,
        }));
        return res.status(500).json({ error: uploadErr?.message || 'Storage upload failed' });
      }
      newPath = uploadData.path;
      updates.storage_path = newPath;
      willReplaceFile = true;
    }

    if (Object.keys(updates).length === 0 && !promoteDefault) {
      return res.status(400).json({ error: 'Nothing to update (provide label, isDefault, and/or replaceBase64)' });
    }

    // ── Promote-default operation: clear sibling defaults first ─────
    // candidate_resumes has no partial unique on (candidate_id) where
    // is_default — we keep "exactly one default" by clearing other
    // rows before setting this one. Worst-case race: two near-
    // simultaneous promotions briefly leave zero or two defaults
    // until the second write completes. Acceptable; the next read
    // returns one default again.
    if (promoteDefault && !row.is_default) {
      const { error: clearErr } = await supabase
        .from('candidate_resumes')
        .update({ is_default: false })
        .eq('candidate_id', row.candidate_id)
        .neq('id', id);
      if (clearErr) {
        console.error('[update-candidate-resume] clear sibling defaults FAILED:', JSON.stringify(clearErr));
        if (willReplaceFile) await supabase.storage.from(RESUMES_BUCKET).remove([newPath]).catch(() => {});
        return res.status(500).json({ error: clearErr.message });
      }
      updates.is_default = true;
    }

    // ── Apply the row update ───────────────────────────────────────
    const { data: updatedRow, error: updateErr } = await supabase
      .from('candidate_resumes')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();
    if (updateErr) {
      console.error('[update-candidate-resume] UPDATE FAILED:', JSON.stringify(updateErr));
      if (willReplaceFile) await supabase.storage.from(RESUMES_BUCKET).remove([newPath]).catch(() => {});
      if (updateErr.code === '23505') {
        return res.status(409).json({ error: `You already have a resume with that label.` });
      }
      return res.status(500).json({ error: updateErr.message });
    }

    // ── Delete the old file on a successful replace ────────────────
    if (willReplaceFile && row.storage_path && row.storage_path !== newPath) {
      const { error: removeErr } = await supabase.storage
        .from(RESUMES_BUCKET)
        .remove([row.storage_path]);
      if (removeErr) {
        console.warn('[update-candidate-resume] old file cleanup failed (row updated OK):', removeErr.message);
      }
    }

    // ── Mirror to deprecated candidates.resume_full_url if this row
    //    is now the candidate's default (Phase A back-compat). ─────
    if (updatedRow.is_default && (willReplaceFile || promoteDefault)) {
      const { error: mirrorErr } = await supabase
        .from('candidates')
        .update({ resume_full_url: updatedRow.storage_path })
        .eq('id', row.candidate_id);
      if (mirrorErr) {
        console.warn('[update-candidate-resume] mirror to candidates.resume_full_url failed:', mirrorErr.message);
      }
    }

    // ── Optional reparse (only meaningful when default + replace) ──
    // Never auto-applies — the UI calls this and decides whether to
    // surface the parsed fields to the candidate as suggestions.
    let parsed = null;
    if (reparse === true && willReplaceFile && updatedRow.is_default) {
      try {
        parsed = await parseResumeWithClaude(replaceBase64);
      } catch (err) {
        console.warn('[update-candidate-resume] reparse failed (write still OK):', err?.message);
      }
    }

    return res.status(200).json({
      success: true,
      resume: updatedRow,
      ...(parsed ? { parsed } : {}),
    });
  } catch (err) {
    console.error('[update-candidate-resume] handler FAILED:', JSON.stringify({ message: err?.message, stack: err?.stack }));
    return res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
