// Tools & Technical Skills — Phase 2 of the skills redesign.
//
// Suggested groupings of tags surfaced in the wizard's Tools picker.
// Reuses the existing candidate_skills store + the existing
// /api/update-candidate-skills-list endpoint — clicking a suggestion
// is identical to typing it. No new schema; this file is purely a
// UI affordance.
//
// Custom tags are first-class: anything the candidate types in the
// free-text input goes through the same upsert as suggested tags
// and is deduped case-insensitively by the existing
// /api/update-candidate-skills-list endpoint.
//
// Suggested groups intentionally lean current-platform and finance-
// adjacent — the goal is fast recognition for a finance professional,
// not a complete vendor catalog. Generic categories (ERP / FP&A /
// Accounting / CRM Systems) sit alongside named tools so candidates
// who use less-common tools can pick a category and add the specific
// name as a custom tag.

export type ToolGroup =
  | 'Financial Analysis'
  | 'Data & Analytics'
  | 'AI & Automation'
  | 'Finance Systems'
  | 'Marketing & Growth Tools'
  | 'Product & Business Intelligence';

export interface ToolGroupDef {
  group: ToolGroup;
  tags: readonly string[];
}

export const TOOL_GROUPS: readonly ToolGroupDef[] = [
  {
    group: 'Financial Analysis',
    tags: [
      'Excel',
      'Financial Modeling',
      'Valuation',
      'Scenario Analysis',
      'Three Statement Modeling',
      'Regression Modeling',
      'Statistical Analysis',
    ],
  },
  {
    group: 'Data & Analytics',
    tags: ['SQL', 'Python', 'R', 'Tableau', 'Power BI', 'Looker', 'Data Visualization'],
  },
  {
    group: 'AI & Automation',
    tags: ['ChatGPT', 'Claude', 'Prompt Engineering', 'AI Workflow Design', 'Automation Tools'],
  },
  {
    group: 'Finance Systems',
    tags: ['ERP Systems', 'FP&A Systems', 'Accounting Systems', 'CRM Systems'],
  },
  {
    group: 'Marketing & Growth Tools',
    tags: ['Google Analytics', 'Mixpanel', 'Amplitude', 'Segment', 'HubSpot', 'Marketing Attribution'],
  },
  {
    group: 'Product & Business Intelligence',
    tags: ['Product Analytics', 'A/B Testing', 'Product Metrics', 'Cohort Analysis', 'User Segmentation'],
  },
] as const;

export const ALL_TOOL_TAGS: readonly string[] = TOOL_GROUPS.flatMap(g => g.tags);
