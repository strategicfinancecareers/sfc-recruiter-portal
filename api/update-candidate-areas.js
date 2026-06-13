import { createClient } from '@supabase/supabase-js';
import { verifyBearerEmail } from './_shared/verifyBearerEmail.js';

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/update-candidate-areas — candidate-self Areas of Expertise.
//
// Phase 1 of the skills redesign. Writes candidates.areas_of_expertise
// (the new controlled-taxonomy field; primary recruiter-matching
// signal). Does NOT touch detailed_experience or candidate_skills —
// those live in their own write paths and are sunset / kept in
// later phases.
//
// SECURITY MODEL — mirrors every other candidate-self writer
// (/api/candidate-profile, /api/update-candidate-skills,
// /api/update-candidate-skills-list, /api/upload-candidate-resume):
//   - Bearer JWT in Authorization → verifyBearerEmail (shared helper)
//     validates signature + expiry against the auth server. 401 on
//     missing/invalid/expired.
//   - candidateId from body; server-side load of the row's email +
//     case-insensitive match against the verified token. 403 mismatch,
//     404 missing/deleted. Never trusts a client-supplied identity.
//   - Service-role client used only AFTER ownership is verified.
//
// VALIDATION (default-deny):
//   - candidateId      — required, string.
//   - areasOfExpertise — required, string[]. 400 on shape mismatch.
//                        Each entry is trimmed, empties dropped,
//                        deduped case-insensitively (keeps the first
//                        casing seen — replaced by the canonical
//                        casing from the taxonomy on the write).
//   - Taxonomy normalize (Phase 4 change) — entries that match the
//                        canonical taxonomy case-insensitively are
//                        rewritten to canonical casing. Unknown tags
//                        are KEPT — the search-and-suggest picker
//                        lets candidates add custom entries (e.g.
//                        a tool the taxonomy doesn't have yet),
//                        which become part of areas_of_expertise so
//                        we can grow the taxonomy from real usage.
//                        The previous "drop unknowns" behavior is
//                        gone.
//   - Hard limit       — server caps at AREAS_HARD_MAX (25). UI
//                        guidance suggests 10 (a soft cap), but
//                        candidates may legitimately need more, and
//                        the server only stops them at the abuse
//                        threshold. Past-cap entries are reported in
//                        truncatedPastHardLimit so the UI can warn.
//   - Empty array is allowed (= "clear my Areas of Expertise"; writes
//     []).
//
// Whitelist: areasOfExpertise is the ONLY writable field through
// this endpoint. Anything else in the body is silently dropped.
// status, identity, sfc_*, detailed_experience, the cap_* columns,
// the candidate_skills join — none are reachable from here.
// ─────────────────────────────────────────────────────────────────────────────

// Canonical taxonomy — MUST stay in sync with the typed source of
// truth at src/lib/areasOfExpertise.ts. Inlined here as a flat array
// because Vercel bundles api/*.js independently of the frontend TS
// build; importing the TS module would pull in a transitive type-
// system dep that isn't worth the friction for a 32-string list.
// When you change the taxonomy, change it in BOTH places — the
// /lib file drives every UI surface, this file drives validation.
const ALL_AREA_TAGS = [
  // Planning & Performance
  'Strategic Planning',
  'FP&A',
  'Long Range Planning',
  'Forecasting & Budgeting',
  'Performance Management',
  'Business Partnering',
  // Commercial Finance & Growth
  'Pricing & Packaging',
  'Revenue Strategy',
  'Product Finance',
  'Sales Finance',
  'Marketing Finance',
  'GTM Finance',
  // Corporate Strategy & Capital Markets
  'Corporate Development',
  'M&A',
  'Fundraising',
  'Investor Relations',
  'Board Reporting',
  'Capital Markets',
  'Investment Banking',
  'Private Equity',
  'Venture Capital',
  // Capital & Operations
  'Treasury',
  'Capital Allocation',
  'Business Operations',
  'Revenue Operations',
  'International Expansion',
  // Analytics & Decision Support
  'Financial Modeling',
  'Scenario Planning',
  'Data Analytics',
  'Market & Competitive Analysis',
];
const CANONICAL_BY_LOWER = ALL_AREA_TAGS.reduce((acc, t) => {
  acc[t.toLowerCase()] = t;
  return acc;
}, {});
// Server hard limit — stops abuse, not the candidate-visible cap.
// The wizard surfaces a soft "10 max" guidance hint; this is the
// absolute upper bound the DB will accept on a single write.
const AREAS_HARD_MAX = 25;
// Per-entry length cap — same shape as the skills-list endpoint's
// MAX_SKILL_LENGTH; protects against an attacker stuffing a single
// huge string and bloating the row.
const MAX_AREA_LENGTH = 80;
const ALLOWED_KEYS = new Set(['areasOfExpertise']);

export default async function handler(req, res) {
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const body = req.body || {};
    const { candidateId } = body;
    if (!candidateId || typeof candidateId !== 'string') {
      return res.status(400).json({ error: 'candidateId required' });
    }
    if (!('areasOfExpertise' in body)) {
      return res.status(400).json({ error: 'areasOfExpertise required (string[]; pass [] to clear)' });
    }
    if (!Array.isArray(body.areasOfExpertise)) {
      return res.status(400).json({ error: 'areasOfExpertise must be an array of strings' });
    }

    // ── Step 0: bearer ──────────────────────────────────────────────
    const auth = await verifyBearerEmail(req, supabase);
    if (auth.error) {
      console.warn('[update-candidate-areas] auth FAIL:', auth.error);
      return res.status(auth.status).json({ error: auth.error });
    }

    // ── Step 1: ownership ──────────────────────────────────────────
    const { data: target, error: lookupErr } = await supabase
      .from('candidates')
      .select('id, email, status')
      .eq('id', candidateId)
      .maybeSingle();
    if (lookupErr) {
      console.error('[update-candidate-areas] candidate lookup FAILED:', JSON.stringify(lookupErr));
      return res.status(500).json({ error: lookupErr.message });
    }
    if (!target || target.status === 'deleted') {
      return res.status(404).json({ error: 'Candidate not found' });
    }
    const ownerEmail = String(target.email || '').toLowerCase().trim();
    if (!ownerEmail || ownerEmail !== auth.email) {
      console.warn('[update-candidate-areas] ownership FAIL:', { verified: auth.email, owner: ownerEmail });
      return res.status(403).json({ error: 'Forbidden' });
    }

    // ── Step 2: whitelist + validate + normalize ───────────────────
    // Default-deny on any keys we didn't ask for. Reported to the
    // client only for diagnostics — same forgiving pattern as
    // /api/update-candidate-skills and /api/update-candidate-skills-list.
    const droppedKeys = [];
    for (const k of Object.keys(body)) {
      if (k === 'candidateId') continue;
      if (!ALLOWED_KEYS.has(k)) droppedKeys.push(k);
    }
    if (droppedKeys.length > 0) {
      console.warn('[update-candidate-areas] dropped non-whitelisted keys:', droppedKeys);
    }

    // Per-entry: type, trim, drop empty, drop over-length, dedupe
    // case-insensitively. Phase 4: custom (non-taxonomy) entries are
    // ALLOWED — they get stored as-typed (just trimmed); known
    // taxonomy entries are rewritten to canonical casing. The
    // "droppedUnknown" diagnostic is gone — there's no rejection
    // path for non-taxonomy values anymore.
    const droppedTypes = [];
    const droppedTooLong = [];
    const droppedDupes = [];
    const seenLower = new Set();
    const accepted = []; // canonical-cased where applicable, else as-typed

    for (const raw of body.areasOfExpertise) {
      if (typeof raw !== 'string') { droppedTypes.push(raw); continue; }
      const trimmed = raw.trim();
      if (!trimmed) continue;
      if (trimmed.length > MAX_AREA_LENGTH) { droppedTooLong.push(trimmed); continue; }
      const lower = trimmed.toLowerCase();
      if (seenLower.has(lower)) { droppedDupes.push(trimmed); continue; }
      seenLower.add(lower);
      // Canonical-case rewrite for known taxonomy tags; pass-through
      // for custom entries (kept exactly as the candidate typed it,
      // minus whitespace).
      accepted.push(CANONICAL_BY_LOWER[lower] || trimmed);
    }

    // Server hard cap (25). UI surfaces 10 as a soft guidance hint
    // but doesn't block — the server stops the truly abusive case.
    const truncatedPastHardLimit = accepted.length > AREAS_HARD_MAX ? accepted.slice(AREAS_HARD_MAX) : [];
    if (truncatedPastHardLimit.length > 0) accepted.length = AREAS_HARD_MAX;

    if (droppedTypes.length || droppedTooLong.length || droppedDupes.length || truncatedPastHardLimit.length) {
      console.warn('[update-candidate-areas] normalized payload:', {
        id: candidateId,
        accepted_count: accepted.length,
        droppedTypes_count: droppedTypes.length,
        droppedTooLong_count: droppedTooLong.length,
        droppedDupes_count: droppedDupes.length,
        truncatedPastHardLimit_count: truncatedPastHardLimit.length,
      });
    }

    // ── Step 3: write (single column update) ───────────────────────
    const { error: updateErr } = await supabase
      .from('candidates')
      .update({ areas_of_expertise: accepted })
      .eq('id', candidateId);
    if (updateErr) {
      console.error('[update-candidate-areas] UPDATE FAILED:', JSON.stringify({
        message: updateErr.message,
        code: updateErr.code,
        hint: updateErr.hint,
        details: updateErr.details,
      }));
      return res.status(500).json({ error: updateErr.message });
    }

    return res.status(200).json({
      success: true,
      areasOfExpertise: accepted,
      ...(droppedKeys.length ? { droppedKeys } : {}),
      ...(droppedTypes.length ? { droppedTypes } : {}),
      ...(droppedTooLong.length ? { droppedTooLong } : {}),
      ...(droppedDupes.length ? { droppedDupes } : {}),
      ...(truncatedPastHardLimit.length ? { truncatedPastHardLimit } : {}),
    });
  } catch (err) {
    console.error('[update-candidate-areas] handler FAILED:', JSON.stringify({
      message: err?.message,
      stack: err?.stack,
    }));
    return res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
