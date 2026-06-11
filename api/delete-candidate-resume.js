import { createClient } from '@supabase/supabase-js';
import { verifyBearerEmail } from './_shared/verifyBearerEmail.js';

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/delete-candidate-resume — candidate-self resume delete.
//
// Removes the candidate_resumes row + the underlying bucket object.
// If the deleted row was is_default and the candidate has a
// remaining row, promotes the earliest remaining sibling to default.
// Allows deletion of the LAST remaining resume but returns a
// warning in the response so the UI can surface a confirmation
// ("you'll have no resume on file") — the actual "ask before
// deleting last" UX is a UI concern, not a server one.
//
// introduction_requests.selected_resume_id is FK ON DELETE SET NULL,
// so any intro that had pinned this resume falls through to the
// signedUrl fallback chain (default → deprecated column) on the next
// download request.
//
// SECURITY MODEL:
//   - Bearer JWT via verifyBearerEmail. 401 missing/invalid.
//   - Row loaded by id; joined candidate's email compared to verified
//     token. 403 mismatch, 404 missing/deleted candidate.
//   - Service-role writes only after ownership is verified.
// ─────────────────────────────────────────────────────────────────────────────

const RESUMES_BUCKET = 'resumes';

export default async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { id } = req.body || {};
    if (!id || typeof id !== 'string') return res.status(400).json({ error: 'id required' });

    // ── Auth ────────────────────────────────────────────────────────
    const auth = await verifyBearerEmail(req, supabase);
    if (auth.error) {
      console.warn('[delete-candidate-resume] auth FAIL:', auth.error);
      return res.status(auth.status).json({ error: auth.error });
    }

    // ── Ownership ───────────────────────────────────────────────────
    const { data: row, error: lookupErr } = await supabase
      .from('candidate_resumes')
      .select('id, candidate_id, label, storage_path, is_default, candidates!candidate_resumes_candidate_id_fkey ( id, email, status )')
      .eq('id', id)
      .maybeSingle();
    if (lookupErr) {
      console.error('[delete-candidate-resume] lookup FAILED:', JSON.stringify(lookupErr));
      return res.status(500).json({ error: lookupErr.message });
    }
    if (!row) return res.status(404).json({ error: 'Resume not found' });
    const cand = row.candidates;
    if (!cand || cand.status === 'deleted') return res.status(404).json({ error: 'Candidate not found' });
    const ownerEmail = String(cand.email || '').toLowerCase().trim();
    if (!ownerEmail || ownerEmail !== auth.email) {
      console.warn('[delete-candidate-resume] ownership FAIL:', { verified: auth.email, owner: ownerEmail });
      return res.status(403).json({ error: 'Forbidden' });
    }

    // ── Delete the row ──────────────────────────────────────────────
    // We delete the row FIRST so the FK ON DELETE SET NULL on
    // introduction_requests fires before we touch the bucket. If the
    // bucket delete then fails, the orphan file is a minor cost; if
    // we deleted the file first and the row delete failed, the row
    // would point at a missing file — worse outcome.
    const { error: deleteErr } = await supabase
      .from('candidate_resumes')
      .delete()
      .eq('id', id);
    if (deleteErr) {
      console.error('[delete-candidate-resume] row delete FAILED:', JSON.stringify(deleteErr));
      return res.status(500).json({ error: deleteErr.message });
    }

    // ── Bucket cleanup (best-effort) ────────────────────────────────
    if (row.storage_path) {
      const { error: removeErr } = await supabase.storage
        .from(RESUMES_BUCKET)
        .remove([row.storage_path]);
      if (removeErr) {
        console.warn('[delete-candidate-resume] bucket remove failed (row already deleted):', removeErr.message);
      }
    }

    // ── Promote next sibling to default + mirror to deprecated col ──
    let promoted = null;
    if (row.is_default) {
      const { data: sibling, error: sibErr } = await supabase
        .from('candidate_resumes')
        .select('id, storage_path')
        .eq('candidate_id', row.candidate_id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (sibErr) {
        console.warn('[delete-candidate-resume] sibling lookup failed:', sibErr.message);
      } else if (sibling) {
        const { error: promoteErr } = await supabase
          .from('candidate_resumes')
          .update({ is_default: true })
          .eq('id', sibling.id);
        if (promoteErr) {
          console.warn('[delete-candidate-resume] promote sibling failed:', promoteErr.message);
        } else {
          promoted = sibling.id;
          // Mirror to deprecated candidates.resume_full_url so Phase A
          // single-resume readers keep returning a working file.
          const { error: mirrorErr } = await supabase
            .from('candidates')
            .update({ resume_full_url: sibling.storage_path })
            .eq('id', row.candidate_id);
          if (mirrorErr) {
            console.warn('[delete-candidate-resume] mirror to candidates.resume_full_url failed:', mirrorErr.message);
          }
        }
      } else {
        // No sibling left — clear the deprecated mirror too so single-
        // resume readers return "no resume on file" cleanly. The
        // bucket object is already gone above.
        const { error: clearErr } = await supabase
          .from('candidates')
          .update({ resume_full_url: null })
          .eq('id', row.candidate_id);
        if (clearErr) {
          console.warn('[delete-candidate-resume] clear deprecated mirror failed:', clearErr.message);
        }
      }
    }

    // ── Surface "you have no resumes left" so the UI can warn ──────
    const { count, error: countErr } = await supabase
      .from('candidate_resumes')
      .select('*', { count: 'exact', head: true })
      .eq('candidate_id', row.candidate_id);
    if (countErr) console.warn('[delete-candidate-resume] count after delete failed:', countErr.message);
    const remaining = count ?? 0;
    const warning = remaining === 0 ? 'You have no resumes on file. Recruiters will not be able to view a resume on this intro.' : null;

    return res.status(200).json({
      success: true,
      deleted: row.id,
      promotedDefault: promoted,
      remaining,
      ...(warning ? { warning } : {}),
    });
  } catch (err) {
    console.error('[delete-candidate-resume] handler FAILED:', JSON.stringify({ message: err?.message, stack: err?.stack }));
    return res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
