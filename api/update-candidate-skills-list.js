import { createClient } from '@supabase/supabase-js';
import { verifyBearerEmail } from './_shared/verifyBearerEmail.js';

// ─────────────────────────────────────────────────────────────────────────────
// /api/update-candidate-skills-list — candidate-self skills writer
//
// Lets the candidate edit their OWN entries in the candidate_skills
// join table (the legacy free-text model that still feeds the recruiter
// card). Adds the post-submission edit path that was previously
// admin-only.
//
// NOT to be confused with /api/update-candidate-skills (Phase 1 of the
// retired-but-existing capability-bands rework). That endpoint writes
// cap_data / cap_modeling / cap_analytics / cap_systems +
// detailed_experience on the candidates row. This endpoint writes the
// skills join. They serve different models and must not be conflated;
// this file does NOT touch cap_* or detailed_experience.
//
// SECURITY MODEL — mirrors /api/candidate-profile and
// /api/update-candidate-skills exactly:
//   - Bearer JWT in Authorization → validated against the auth server
//     via supabase.auth.getUser(jwt). 401 missing/invalid/expired.
//   - The candidate row id is supplied in the body. The row's email is
//     loaded server-side and compared (case-insensitive) to the
//     verified token email. 403 on mismatch — never trust a
//     client-supplied identity.
//   - Service-role client is used only AFTER ownership is verified.
//
// VALIDATION:
//   - body.skills must be string[] (400 on shape mismatch).
//   - Each entry trimmed; empties dropped; deduped case-insensitive
//     (keeping the first occurrence's casing).
//   - Per-entry length capped at MAX_SKILL_LENGTH; overlong entries
//     are dropped silently with a warning.
//   - Total count clamped to MAX_SKILLS; extras dropped with a
//     warning surfaced in the response so the UI can warn the user.
//   - An empty array is allowed and means "clear my skills".
//
// WRITE PATTERN (mirrors Admin.tsx delete-then-insert, server-side):
//   1. For each accepted skill name: upsert into skills (onConflict:
//      'skill') to get or create the row, returning its id.
//   2. Delete the candidate's existing rows from candidate_skills.
//   3. Insert the new candidate_skills rows in one bulk insert.
//   The UNIQUE(candidate_id, skill_id) constraint on candidate_skills
//   protects against double-insert; the dedup pass before write keeps
//   the insert payload itself clean.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_SKILLS = 30;
const MAX_SKILL_LENGTH = 60;

export default async function handler(req, res) {
  console.log('[update-candidate-skills-list] env check:', {
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
    if (!('skills' in body)) {
      return res.status(400).json({ error: 'skills required (array of strings; pass [] to clear)' });
    }
    if (!Array.isArray(body.skills)) {
      return res.status(400).json({ error: 'skills must be an array of strings' });
    }

    // ── Step 0: verify bearer token ──────────────────────────────────────
    const auth = await verifyBearerEmail(req, supabase);
    if (auth.error) {
      console.warn('[update-candidate-skills-list] auth FAIL:', auth.error);
      return res.status(auth.status).json({ error: auth.error });
    }

    // ── Step 1: load target row's email + verify ownership ───────────────
    const { data: target, error: lookupErr } = await supabase
      .from('candidates')
      .select('id, email, status')
      .eq('id', id)
      .maybeSingle();
    if (lookupErr) {
      console.error('[update-candidate-skills-list] lookup FAILED:', JSON.stringify(lookupErr));
      return res.status(500).json({ error: lookupErr.message });
    }
    if (!target || target.status === 'deleted') {
      return res.status(404).json({ error: 'Candidate not found' });
    }
    const ownerEmail = String(target.email || '').toLowerCase().trim();
    if (!ownerEmail || ownerEmail !== auth.email) {
      console.warn('[update-candidate-skills-list] ownership FAIL:', { verified: auth.email, owner: ownerEmail, id });
      return res.status(403).json({ error: 'Forbidden' });
    }

    // ── Step 2: validate + normalize incoming skills ─────────────────────
    // Per-entry: must be string, trim, drop empties, drop overlong.
    // Set-level: dedupe case-insensitive (keep first casing), clamp to
    // MAX_SKILLS. Diagnostics returned in the response.
    const droppedTypes = [];     // non-string entries
    const droppedTooLong = [];   // entries past MAX_SKILL_LENGTH
    const droppedDupes = [];     // case-insensitive duplicates after the first
    let droppedPastCap = [];     // count past MAX_SKILLS

    const seenLower = new Set();
    const accepted = [];
    for (const raw of body.skills) {
      if (typeof raw !== 'string') { droppedTypes.push(raw); continue; }
      const trimmed = raw.trim();
      if (!trimmed) continue;
      if (trimmed.length > MAX_SKILL_LENGTH) { droppedTooLong.push(trimmed); continue; }
      const lower = trimmed.toLowerCase();
      if (seenLower.has(lower)) { droppedDupes.push(trimmed); continue; }
      seenLower.add(lower);
      accepted.push(trimmed);
    }
    if (accepted.length > MAX_SKILLS) {
      droppedPastCap = accepted.slice(MAX_SKILLS);
      accepted.length = MAX_SKILLS;
    }
    if (droppedTypes.length || droppedTooLong.length || droppedDupes.length || droppedPastCap.length) {
      console.warn('[update-candidate-skills-list] normalized payload:', {
        id,
        accepted_count: accepted.length,
        droppedTypes_count: droppedTypes.length,
        droppedTooLong_count: droppedTooLong.length,
        droppedDupes_count: droppedDupes.length,
        droppedPastCap_count: droppedPastCap.length,
      });
    }

    // ── Step 3: upsert each skill name into the skills table ─────────────
    // skills.skill is UNIQUE; onConflict returns the existing row.
    // We run sequentially to keep error reporting per-skill and to
    // mirror the existing submit-candidate.ts pattern. The set is at
    // most MAX_SKILLS (30) entries so the round-trip cost is small.
    const skillIds = [];
    for (const skillName of accepted) {
      const { data: row, error: upsertErr } = await supabase
        .from('skills')
        .upsert({ skill: skillName }, { onConflict: 'skill' })
        .select('id')
        .single();
      if (upsertErr || !row?.id) {
        console.error('[update-candidate-skills-list] skills upsert failed for', JSON.stringify(skillName), ':', JSON.stringify(upsertErr));
        return res.status(500).json({ error: upsertErr?.message || 'Failed to upsert skill row' });
      }
      skillIds.push({ id: row.id, skill: skillName });
    }

    // ── Step 4: replace the candidate's skills set (delete-then-insert) ──
    // Atomicity caveat: PostgREST doesn't expose a single transaction
    // for this delete+insert pair from JS. The insert can race against
    // a concurrent edit, but the worst case is a UNIQUE-violation 409
    // which the client can retry. For the candidate-self edit case
    // (single user, single browser) the practical race window is the
    // ~tens-of-milliseconds between delete and insert and the same
    // candidate id can't realistically issue two saves that close.
    const { error: deleteErr } = await supabase
      .from('candidate_skills')
      .delete()
      .eq('candidate_id', id);
    if (deleteErr) {
      console.error('[update-candidate-skills-list] delete existing failed:', JSON.stringify(deleteErr));
      return res.status(500).json({ error: deleteErr.message });
    }

    if (skillIds.length > 0) {
      const { error: insertErr } = await supabase
        .from('candidate_skills')
        .insert(skillIds.map(s => ({ candidate_id: id, skill_id: s.id })));
      if (insertErr) {
        console.error('[update-candidate-skills-list] bulk insert failed:', JSON.stringify(insertErr));
        return res.status(500).json({ error: insertErr.message });
      }
    }

    // ── Step 5: return the canonical saved set ───────────────────────────
    return res.status(200).json({
      success: true,
      skills: skillIds.map(s => s.skill),
      ...(droppedTypes.length ? { droppedTypes } : {}),
      ...(droppedTooLong.length ? { droppedTooLong } : {}),
      ...(droppedDupes.length ? { droppedDupes } : {}),
      ...(droppedPastCap.length ? { droppedPastCap } : {}),
    });
  } catch (err) {
    console.error('[update-candidate-skills-list] handler FAILED:', JSON.stringify({
      message: err?.message,
      stack: err?.stack,
    }));
    return res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
