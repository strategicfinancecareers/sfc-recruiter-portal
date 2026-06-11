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
//   - Taxonomy gate    — each entry is matched against the canonical
//                        taxonomy below. Unknown tags are dropped
//                        silently with a per-key warning and reported
//                        in droppedUnknown. The whole request does
//                        NOT 400 on unknowns — that would break a
//                        client that's running stale taxonomy after
//                        we add a new tag.
//   - 10-cap           — kept entries are clamped to the first
//                        AREAS_MAX. Past-cap entries are reported in
//                        truncatedPastCap so the UI can warn.
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
const TAG_SET_LOWER = new Set(ALL_AREA_TAGS.map(t => t.toLowerCase()));
const CANONICAL_BY_LOWER = ALL_AREA_TAGS.reduce((acc, t) => {
  acc[t.toLowerCase()] = t;
  return acc;
}, {});
const AREAS_MAX = 10;
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

    // Per-entry: type, trim, drop empty, dedupe case-insensitively.
    const droppedTypes = [];
    const droppedDupes = [];
    const droppedUnknown = [];
    const seenLower = new Set();
    const accepted = []; // canonical-cased, in incoming order

    for (const raw of body.areasOfExpertise) {
      if (typeof raw !== 'string') { droppedTypes.push(raw); continue; }
      const trimmed = raw.trim();
      if (!trimmed) continue;
      const lower = trimmed.toLowerCase();
      if (seenLower.has(lower)) { droppedDupes.push(trimmed); continue; }
      if (!TAG_SET_LOWER.has(lower)) { droppedUnknown.push(trimmed); continue; }
      seenLower.add(lower);
      accepted.push(CANONICAL_BY_LOWER[lower]);
    }

    // 10-cap clamp.
    const truncatedPastCap = accepted.length > AREAS_MAX ? accepted.slice(AREAS_MAX) : [];
    if (truncatedPastCap.length > 0) accepted.length = AREAS_MAX;

    if (droppedTypes.length || droppedDupes.length || droppedUnknown.length || truncatedPastCap.length) {
      console.warn('[update-candidate-areas] normalized payload:', {
        id: candidateId,
        accepted_count: accepted.length,
        droppedTypes_count: droppedTypes.length,
        droppedDupes_count: droppedDupes.length,
        droppedUnknown_count: droppedUnknown.length,
        truncatedPastCap_count: truncatedPastCap.length,
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
      ...(droppedDupes.length ? { droppedDupes } : {}),
      ...(droppedUnknown.length ? { droppedUnknown } : {}),
      ...(truncatedPastCap.length ? { truncatedPastCap } : {}),
    });
  } catch (err) {
    console.error('[update-candidate-areas] handler FAILED:', JSON.stringify({
      message: err?.message,
      stack: err?.stack,
    }));
    return res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
