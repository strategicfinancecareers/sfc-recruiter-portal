// Shared parser/joiner for the candidate's education string.
//
// FormState.education stays a SINGLE STRING (no schema change) — these
// helpers only translate between that string and a row-shaped UI:
//
//   parseDegrees("MBA Finance; BS Financial Economics")
//     → [
//         { degree: 'MBA',   specialization: 'Finance' },
//         { degree: 'B.Sc.', specialization: 'Financial Economics' },
//       ]
//
//   joinDegrees([
//     { degree: 'MBA',   specialization: 'Finance' },
//     { degree: 'B.Sc.', specialization: 'Financial Economics' },
//   ])
//     → "MBA Finance; B.Sc. Financial Economics"
//
// Used by:
//   - RecruiterPreviewCard.tsx — renders "Degree, Specialization"
//     one line per parsed degree on the recruiter preview.
//   - CandidateApply.tsx step 2 — drives the per-degree editor rows;
//     join feeds back into form.education so submit/edit-save flow
//     unchanged.

export interface DegreeRow {
  degree: string;
  specialization: string;
}

// Forgiving canonicalization of common degree prefixes. The KEY is a
// lowercased dotless variant the input matches against; the VALUE is
// the canonical display form we render and store.
//
// Order matters when prefixes overlap — longer first. "B.S." has to
// be matched before "B" alone would, etc. We anchor each pattern to
// a word boundary so "BSCS" doesn't get split as "B.Sc." + "CS".
const DEGREE_PATTERNS: Array<{ pattern: RegExp; canonical: string }> = [
  { pattern: /^(MBA)\b/i,                                   canonical: 'MBA' },
  { pattern: /^(Ph\.?\s*D\.?|Doctorate)\b/i,                canonical: 'Ph.D.' },
  { pattern: /^(J\.?\s*D\.?)\b/i,                           canonical: 'J.D.' },
  { pattern: /^(B\.?\s*Sc\.?|B\.?\s*S\.?)\b/i,              canonical: 'B.Sc.' },
  { pattern: /^(M\.?\s*Sc\.?|M\.?\s*S\.?)\b/i,              canonical: 'M.Sc.' },
  { pattern: /^(B\.?\s*A\.?)\b/i,                           canonical: 'B.A.' },
  { pattern: /^(M\.?\s*A\.?)\b/i,                           canonical: 'M.A.' },
  { pattern: /^(Bachelor(?:'s)?(?: of [A-Za-z]+)?)\b/i,     canonical: 'Bachelor' },
  { pattern: /^(Master(?:'s)?(?: of [A-Za-z]+)?)\b/i,       canonical: 'Master' },
  { pattern: /^(Associate(?:'s)?)\b/i,                      canonical: 'Associate' },
];

// Split the full education string into degree-level entries. The
// recognized separators are ";", newline, and " and " — comma is
// NOT used at this level because a single "Degree, Specialization"
// line uses comma between its two halves, and confusing the two
// would split a single entry into two bad ones.
function splitEntries(education: string): string[] {
  return education
    .split(/\s*(?:;|\n|\sand\s)\s*/i)
    .map(s => s.trim())
    .filter(Boolean);
}

// Split one "Degree Specialization" or "Degree, Specialization" or
// "Degree in Specialization" entry into its two parts. Tries to
// match a canonical degree prefix first; if no prefix matches,
// falls back to splitting on the first comma, then the first
// space. If nothing splits (e.g. just "Bachelors"), returns the
// whole entry as the degree with empty specialization.
function splitEntry(entry: string): DegreeRow {
  for (const { pattern, canonical } of DEGREE_PATTERNS) {
    const m = entry.match(pattern);
    if (m) {
      const rest = entry.slice(m[0].length).replace(/^[\s,]+(?:in\s+)?/i, '').trim();
      return { degree: canonical, specialization: rest };
    }
  }
  const commaIdx = entry.indexOf(',');
  if (commaIdx > 0) {
    return {
      degree: entry.slice(0, commaIdx).trim(),
      specialization: entry.slice(commaIdx + 1).trim(),
    };
  }
  const spaceIdx = entry.indexOf(' ');
  if (spaceIdx > 0) {
    return {
      degree: entry.slice(0, spaceIdx).trim(),
      specialization: entry.slice(spaceIdx + 1).trim(),
    };
  }
  return { degree: entry, specialization: '' };
}

export function parseDegrees(education: string | null | undefined): DegreeRow[] {
  if (!education || !education.trim()) return [];
  return splitEntries(education).map(splitEntry);
}

// Inverse of parseDegrees — joins rows back into a single string that
// matches the storage format read by submit-candidate.ts /
// handleEditSave. Drops fully-empty rows (no degree AND no
// specialization). When a row has only a degree or only a
// specialization, that single token is emitted as the entry.
export function joinDegrees(rows: DegreeRow[]): string {
  return rows
    .map(r => ({ degree: r.degree.trim(), specialization: r.specialization.trim() }))
    .filter(r => r.degree || r.specialization)
    .map(r => [r.degree, r.specialization].filter(Boolean).join(' '))
    .join('; ');
}

// Round-trip helper for the rare case the preview wants the
// normalized version of the raw string (e.g. "BS Finance" →
// "B.Sc. Finance"). Not currently called — keeping joinDegrees +
// parseDegrees composable enough that callers can decide.
export function normalizeEducationString(education: string): string {
  return joinDegrees(parseDegrees(education));
}
