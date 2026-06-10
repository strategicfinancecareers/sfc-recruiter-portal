// Shared Core-Expertise / Technical-Skills bucketer.
//
// Originally inlined in AnonymousCandidateCard.tsx. Extracted here so
// the candidate dashboard's own profile view can display skills with
// the SAME split recruiters see — single source of truth, no drift.
//
// The bucketer is a hardcoded allow-list of finance-functional terms.
// Any skill whose lowercased value is in the set falls under
// "Core Expertise"; everything else falls under "Technical Skills".
// This is a stopgap classifier on the free-text legacy model — the
// planned controlled-vocabulary model (Phase 3 of the skills rework)
// will replace this with structured data and this module can be
// retired then.

export const CORE_FINANCE = new Set<string>([
  'strategic finance', 'fp&a', 'fpa', 'm&a', 'corporate development', 'capital raising',
  'private equity', 'investment banking', 'equity research', 'financial modeling', 'financial modelling',
  'valuation', 'dcf', 'lbo', 'budgeting', 'forecasting', 'budgeting & forecasting', 'treasury',
  'corporate finance', 'portfolio management', 'credit analysis', 'risk management',
  'investor relations', 'mergers & acquisitions', 'due diligence', 'capital markets',
  'leveraged buyout', 'discounted cash flow', 'financial analysis', 'corporate strategy',
  'business development', 'restructuring',
]);

// Split a flat list of skill strings into the same Core / Technical
// buckets the recruiter card uses. Skill comparison is lowercase.
export function bucketSkills(skills: string[]): { core: string[]; tech: string[] } {
  const core: string[] = [];
  const tech: string[] = [];
  for (const s of skills) {
    if (!s) continue;
    if (CORE_FINANCE.has(s.toLowerCase())) core.push(s);
    else tech.push(s);
  }
  return { core, tech };
}
