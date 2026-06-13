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

// Degree-prefix splitter. Recognizes a known degree abbreviation
// occurring anywhere in the string and treats each occurrence as
// the start of a new entry. This is what lets us split
// "MBA Finance, BS Financial Economics" into TWO entries — the
// comma alone is ambiguous (it's also used WITHIN a single
// "Degree, Specialization" entry), so we use the next degree
// prefix as the boundary instead.
//
// The trailing lookahead `(?=[\s.,;]|$)` accepts a trailing period
// or punctuation without consuming it, so "B.S." and "B.Sc." both
// match cleanly even though `\b` doesn't naturally land after the
// dot.
const DEGREE_PREFIX_RE = /\b(?:MBA|Ph\.?\s*D|Doctorate|J\.?\s*D|B\.?\s*Sc|B\.?\s*S|M\.?\s*Sc|M\.?\s*S|B\.?\s*A|M\.?\s*A|Bachelor(?:'s)?|Master(?:'s)?|Associate(?:'s)?)(?=[\s.,;]|$)/gi;

function splitOnDegreePrefixes(chunk: string): string[] {
  const text = chunk;
  const positions: number[] = [];
  let m: RegExpExecArray | null;
  // Reset the regex's lastIndex by constructing a fresh instance
  // each call so concurrent splits don't interfere.
  const re = new RegExp(DEGREE_PREFIX_RE.source, 'gi');
  while ((m = re.exec(text)) !== null) {
    positions.push(m.index);
    // Guard against zero-length matches (none expected, but safe).
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  if (positions.length === 0) return [text];
  const out: string[] = [];
  // Any leading content before the first match (e.g. "I have ")
  // survives as its own entry so we never silently drop typed
  // content.
  if (positions[0] > 0) {
    const pre = text.slice(0, positions[0]).replace(/[\s,;]+$|\sand$/gi, '').trim();
    if (pre) out.push(pre);
  }
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i];
    const end = i + 1 < positions.length ? positions[i + 1] : text.length;
    // Trim the trailing comma/space/and that separates this entry
    // from the next; the next entry starts at its degree prefix.
    const slice = text.slice(start, end).replace(/[\s,;]+$|\sand$/gi, '').trim();
    if (slice) out.push(slice);
  }
  return out;
}

// Split the full education string into degree-level entries.
//
// Two-pass split:
//   1. Pre-split on explicit separators (";", newline, " and ").
//   2. Within each chunk, run splitOnDegreePrefixes so a comma-
//      separated list of degrees ("MBA Finance, BS Financial
//      Economics") is split at each degree-prefix boundary.
//
// Comma is intentionally NOT a top-level separator — a single
// "Degree, Specialization" entry uses comma between its two
// halves, and treating comma as an entry boundary at the outer
// level would break that. The degree-prefix scanner handles the
// case where two distinct degrees are separated by a comma.
function splitEntries(education: string): string[] {
  return education
    .split(/\s*(?:;|\n|\sand\s)\s*/i)
    .flatMap(splitOnDegreePrefixes)
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
