// Areas of Expertise — Phase 1 of the skills redesign.
//
// Single source of truth for the controlled-taxonomy field that the
// candidate wizard, the recruiter filter panel, and the server-side
// validator in /api/update-candidate-areas all reference. Storing
// the taxonomy here (not in the DB) keeps the migration trivial when
// we relabel a tag or rebalance the groups — change one constant,
// the picker UI, recruiter filter, and the server validator all
// move in lockstep.
//
// The tags are flat strings on the DB column (candidates.areas_of_expertise
// is text[]). The group structure is purely UI/UX — it informs the
// wizard's grouped picker and the (later phase) primary-background-
// scoped ordering, but the DB doesn't know which tag belongs to which
// group. ALL_TAGS / TAG_SET are derived for fast validation lookups.
//
// Caveats and house rules:
//   - Tags are case-sensitive on storage. The server-side normalizer
//     dedupes case-insensitively but writes back the canonical casing
//     defined here.
//   - Cap of 10 entries per candidate is enforced server-side in
//     /api/update-candidate-areas (not via a DB constraint — the only
//     writer is the service-role endpoint with bearer ownership
//     gated, so a DB trigger would just duplicate the check).
//   - Custom tags are NOT allowed for Areas of Expertise. Free-text
//     belongs in the Tools & Technical Skills field, which lives on
//     the existing candidate_skills join.

export type AreaGroup =
  | 'Planning & Performance'
  | 'Commercial Finance & Growth'
  | 'Corporate Strategy & Capital Markets'
  | 'Capital & Operations'
  | 'Analytics & Decision Support';

export interface AreaGroupDef {
  group: AreaGroup;
  tags: readonly string[];
}

export const AREA_GROUPS: readonly AreaGroupDef[] = [
  {
    group: 'Planning & Performance',
    tags: [
      'Strategic Planning',
      'FP&A',
      'Long Range Planning',
      'Forecasting & Budgeting',
      'Performance Management',
      'Business Partnering',
    ],
  },
  {
    group: 'Commercial Finance & Growth',
    tags: [
      'Pricing & Packaging',
      'Revenue Strategy',
      'Product Finance',
      'Sales Finance',
      'Marketing Finance',
      'GTM Finance',
    ],
  },
  {
    group: 'Corporate Strategy & Capital Markets',
    tags: [
      'Corporate Development',
      'M&A',
      'Fundraising',
      'Investor Relations',
      'Board Reporting',
      'Capital Markets',
      'Investment Banking',
      'Private Equity',
      'Venture Capital',
    ],
  },
  {
    group: 'Capital & Operations',
    tags: [
      'Treasury',
      'Capital Allocation',
      'Business Operations',
      'Revenue Operations',
      'International Expansion',
    ],
  },
  {
    group: 'Analytics & Decision Support',
    tags: [
      'Financial Modeling',
      'Scenario Planning',
      'Data Analytics',
      'Market & Competitive Analysis',
    ],
  },
] as const;

// Flat list of every valid tag, in declaration order (Group A's tags,
// then Group B's, etc.). Consumed by the server validator and as the
// default render order in the wizard before primary-background-aware
// ordering kicks in (Phase 2).
export const ALL_AREA_TAGS: readonly string[] = AREA_GROUPS.flatMap(g => g.tags);

// Case-insensitive lookup set used by the server endpoint to validate
// each incoming tag in O(1). Keys are lowercased; resolve a payload
// tag back to its canonical casing via CANONICAL_BY_LOWER.
export const TAG_SET_LOWER: ReadonlySet<string> = new Set(ALL_AREA_TAGS.map(t => t.toLowerCase()));
export const CANONICAL_BY_LOWER: Readonly<Record<string, string>> = Object.freeze(
  ALL_AREA_TAGS.reduce<Record<string, string>>((acc, t) => {
    acc[t.toLowerCase()] = t;
    return acc;
  }, {})
);

// Cap that /api/update-candidate-areas enforces. Exported as a const
// so future UI code (Phase 2 picker) can pull it from the same place.
export const AREAS_MAX = 10;

// Helper: given a candidate's primary_background string, return the
// group most relevant to them. Used by Phase 2's wizard ordering to
// surface in-group tags first. NULL primary_background → null group
// (caller falls back to default declaration order).
//
// The mapping intentionally lives next to the taxonomy so a future
// rebalance keeps both files in sync. Keys are the
// CandidateApply.tsx PRIMARY_BACKGROUNDS values (post the Phase B
// relabel — kept identical here, not re-imported from CandidateApply
// so this module stays UI-free).
export function groupForPrimaryBackground(primaryBackground: string | null | undefined): AreaGroup | null {
  if (!primaryBackground) return null;
  switch (primaryBackground) {
    case 'Strategic Finance & Business Finance': return 'Planning & Performance';
    case 'FP&A & Corporate Finance':             return 'Planning & Performance';
    case 'Capital Markets & Investing':          return 'Corporate Strategy & Capital Markets';
    case 'Strategy & Operations':                return 'Capital & Operations';
    case 'Accounting & Compliance':              return 'Capital & Operations';
    default:                                     return null;
  }
}
