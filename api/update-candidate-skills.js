import { createClient } from '@supabase/supabase-js';
import { verifyBearerEmail } from './_shared/verifyBearerEmail.js';

// ─────────────────────────────────────────────────────────────────────────────
// /api/update-candidate-skills — candidate-self only
//
// Phase 1 of the skills rework. Writes the new skills model (the four
// capability bands + the Expertise list reusing detailed_experience)
// to the candidate's own row. The legacy free-text candidate_skills
// join table is intentionally NOT touched here — it continues to
// feed the recruiter card until Phase 3 replaces that surface, and
// any rewrite of that join lives in a separate endpoint.
//
// SECURITY MODEL — mirrors /api/candidate-profile:
//   - Bearer JWT in Authorization header → validated against the
//     auth server via supabase.auth.getUser(jwt). 401 on missing /
//     invalid / expired.
//   - The candidate row's id is taken from the body. The row's email
//     is loaded server-side and compared (case-insensitive) to the
//     verified token's email. 403 on mismatch — never trust a
//     client-supplied identity.
//   - Service-role client is used only AFTER ownership is verified.
//
// VALIDATION / WHITELIST:
//   Default-deny. Only the five fields below are writable; anything
//   else in the body is silently dropped (same forgiving pattern as
//   /api/candidate-profile PATCH so a future client extension doesn't
//   error on existing servers). Per-field rules:
//     cap_data, cap_modeling, cap_analytics, cap_systems
//       — must be 'basic' | 'proficient' | 'advanced'; explicit null
//         clears the field. Invalid values are dropped with a warning
//         (NOT a hard reject — single bad field shouldn't fail the
//         whole save). The DB CHECK constraint is the backstop.
//     detailed_experience
//       — must be string[]; non-string entries dropped; clamped to
//         the first 5 entries. The truncation is reported back in the
//         response so the UI can surface "we kept the first 5" if it
//         wants to. Empty array is allowed (clears the list).
//
// Excluded from this endpoint by design (would be a privilege
// escalation):
//   - status, approved_at, approved_by, rejection_reason
//   - id, email, name, display_name (identity / anonymity keys)
//   - sfc_* (admin-curated)
//   - everything else on candidates that isn't one of the five above
// ─────────────────────────────────────────────────────────────────────────────

const CAP_FIELDS = ['cap_data', 'cap_modeling', 'cap_analytics', 'cap_systems'];
const ALLOWED_CAP_VALUES = new Set(['basic', 'proficient', 'advanced']);
const EXPERTISE_MAX = 5;

export default async function handler(req, res) {
  console.log('[update-candidate-skills] env check:', {
    hasUrl: !!process.env.SUPABASE_URL,
    hasKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const body = req.body || {};
    const { id } = body;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'id required' });
    }

    // ── Step 0: verify bearer token ──────────────────────────────────────
    const auth = await verifyBearerEmail(req, supabase);
    if (auth.error) {
      console.warn('[update-candidate-skills] auth FAIL:', auth.error);
      return res.status(auth.status).json({ error: auth.error });
    }

    // ── Step 1: load target row's email + verify ownership ───────────────
    // Looked up server-side (NOT trusting any client-supplied email).
    const { data: target, error: lookupErr } = await supabase
      .from('candidates')
      .select('id, email, status')
      .eq('id', id)
      .maybeSingle();
    if (lookupErr) {
      console.error('[update-candidate-skills] lookup FAILED:', JSON.stringify(lookupErr));
      return res.status(500).json({ error: lookupErr.message });
    }
    if (!target || target.status === 'deleted') {
      return res.status(404).json({ error: 'Candidate not found' });
    }
    const ownerEmail = String(target.email || '').toLowerCase().trim();
    if (!ownerEmail || ownerEmail !== auth.email) {
      console.warn('[update-candidate-skills] ownership FAIL:', { verified: auth.email, owner: ownerEmail, id });
      return res.status(403).json({ error: 'Forbidden' });
    }

    // ── Step 2: validate + whitelist the incoming payload ────────────────
    const safeUpdates = {};
    const droppedKeys = [];
    const droppedCapValues = {}; // { field: rawValue } for fields with bad values
    let truncatedExpertise = null; // { kept: 5, dropped: ['x','y'] } if clamped

    // Identify keys that aren't in the allow-set so we can log them.
    const ALLOWED_KEYS = new Set([...CAP_FIELDS, 'detailed_experience']);
    for (const k of Object.keys(body)) {
      if (k === 'id') continue;
      if (!ALLOWED_KEYS.has(k)) droppedKeys.push(k);
    }

    // Capability bands. Each can be:
    //   - explicit null  → clear the column (write NULL)
    //   - 'basic'|'proficient'|'advanced' → write that value
    //   - anything else  → drop with warning
    //   - omitted        → leave the column untouched
    for (const field of CAP_FIELDS) {
      if (!(field in body)) continue;
      const v = body[field];
      if (v === null) {
        safeUpdates[field] = null;
        continue;
      }
      if (typeof v === 'string' && ALLOWED_CAP_VALUES.has(v)) {
        safeUpdates[field] = v;
        continue;
      }
      droppedCapValues[field] = v;
    }

    // detailed_experience (Expertise list). Must be a string[], non-strings
    // dropped, clamped to EXPERTISE_MAX entries. Empty array allowed (=
    // clear the list). Absent from body = leave untouched.
    if ('detailed_experience' in body) {
      const raw = body.detailed_experience;
      if (!Array.isArray(raw)) {
        return res.status(400).json({ error: 'detailed_experience must be an array of strings' });
      }
      const trimmedAll = raw
        .filter(v => typeof v === 'string')
        .map(v => v.trim())
        .filter(Boolean);
      const kept = trimmedAll.slice(0, EXPERTISE_MAX);
      const dropped = trimmedAll.slice(EXPERTISE_MAX);
      if (dropped.length > 0) {
        truncatedExpertise = { kept: kept.length, dropped };
        console.warn('[update-candidate-skills] expertise truncated past cap:', { id, dropped });
      }
      safeUpdates.detailed_experience = kept;
    }

    if (droppedKeys.length > 0) {
      console.warn('[update-candidate-skills] dropped non-whitelisted keys:', droppedKeys);
    }
    if (Object.keys(droppedCapValues).length > 0) {
      console.warn('[update-candidate-skills] dropped bad cap values:', droppedCapValues);
    }
    if (Object.keys(safeUpdates).length === 0) {
      // Nothing valid to write — treat as a no-op success, mirror the
      // candidate-profile PATCH empty-payload behavior.
      return res.status(200).json({
        success: true,
        noop: true,
        ...(droppedKeys.length ? { dropped: droppedKeys } : {}),
        ...(Object.keys(droppedCapValues).length ? { droppedCapValues } : {}),
      });
    }

    // ── Step 3: apply the update ─────────────────────────────────────────
    const { error: updateErr } = await supabase
      .from('candidates')
      .update(safeUpdates)
      .eq('id', id);
    if (updateErr) {
      console.error('[update-candidate-skills] update FAILED:', JSON.stringify({
        message: updateErr.message,
        code: updateErr.code,
        hint: updateErr.hint,
        details: updateErr.details,
      }));
      return res.status(500).json({ error: updateErr.message });
    }

    // ── Step 4: re-read + return the new values ──────────────────────────
    // The five whitelisted fields only — never echo anything else.
    const { data: updated, error: reReadErr } = await supabase
      .from('candidates')
      .select('cap_data, cap_modeling, cap_analytics, cap_systems, detailed_experience')
      .eq('id', id)
      .maybeSingle();
    if (reReadErr) {
      // The write succeeded; the re-read is best-effort. Don't fail
      // the response just because we couldn't echo the new values.
      console.warn('[update-candidate-skills] re-read after update failed (write succeeded):', reReadErr.message);
    }

    return res.status(200).json({
      success: true,
      updated: updated || null,
      ...(droppedKeys.length ? { dropped: droppedKeys } : {}),
      ...(Object.keys(droppedCapValues).length ? { droppedCapValues } : {}),
      ...(truncatedExpertise ? { truncatedExpertise } : {}),
    });
  } catch (err) {
    console.error('[update-candidate-skills] handler FAILED:', JSON.stringify({
      message: err?.message,
      stack: err?.stack,
    }));
    return res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
