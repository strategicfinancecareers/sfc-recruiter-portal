import { useState, useRef, useEffect, useMemo } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet, SheetContent,
} from '@/components/ui/sheet';
import {
  CheckCircle2, Upload, Loader2, ChevronRight, ChevronLeft,
  X, Plus, RefreshCw, Mail, FileText, Sparkles, Check, Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { authedFetch } from '@/integrations/supabase/authedFetch';

// Newsreader needed for the right-side value panel heading on the auth
// screen so the /apply page matches the landing's serif identity. Other
// landing tokens (cream / ink / brand green) are inlined via style /
// Tailwind on the relevant elements; no new CSS file required.
// (These import side-effects are deduped per-build by Vite if the same
// packages are already imported elsewhere in the app, e.g. Home.tsx.)
import '@fontsource-variable/newsreader';

// Phase 1 of the wizard two-column redesign: the persistent right-rail
// preview is a fresh, single-column card built for the signup context
// (RecruiterPreviewCard, below). The real recruiter dossier
// (AnonymousCandidateCard) keeps its current shape for /browse and the
// dashboard's Recruiter View tab; this wizard surface no longer
// embeds it. Substance still matches what recruiters will see — both
// cards read the same FormState-derived fields — but the chrome is
// tuned for the in-progress build flow (narrow column, scannable
// sections, completion %, brand-green primary signal).
import RecruiterPreviewCard, { profileCompletion } from '@/components/wizard/RecruiterPreviewCard';
// Phase 4 swap-in: the search-and-suggest picker consumes the flat
// taxonomy lists (ALL_*_TAGS) rather than the grouped structures.
// The grouped structures + groupForPrimaryBackground helper are no
// longer needed here (the picker has its own search-driven UX); kept
// in @/lib/areasOfExpertise / @/lib/toolsAndTechnicalSkills for other
// consumers (the recruiter filter panel imports AREA_GROUPS, the
// taxonomy module's server-side validator imports CANONICAL_BY_LOWER,
// etc.).
import { ALL_AREA_TAGS, AREAS_MAX } from '@/lib/areasOfExpertise';
import { ALL_TOOL_TAGS } from '@/lib/toolsAndTechnicalSkills';
import { parseDegrees, joinDegrees, type DegreeRow } from '@/lib/parseEducation';

// ─── Constants ────────────────────────────────────────────────────────────────

const COMPANY_LOGOS = [
  'Goldman Sachs', 'McKinsey', 'Google', 'Meta', 'Stripe',
  'Blackstone', 'KKR', 'Citadel', 'JP Morgan', 'Bain', 'BCG', 'Sequoia',
];

// Primary-background groups + their scoped detailed-experience areas.
// The 5-group structure here is the source of truth: PRIMARY_BACKGROUNDS
// values flow to candidates.primary_background (also reused as
// secondary background options), and the DETAILED_EXPERIENCE_MAP keys
// MUST match those values exactly (background-scoped lookup keys the
// detail-area list at the Tab 2 render). The keys/values are passed
// as raw strings everywhere downstream (admin views, SFC Take prompt,
// the recruiter card) — no pattern matching on specific labels, so
// relabeling here propagates cleanly. Existing candidates whose stored
// values reference older labels will simply have to re-pick on their
// next edit (test data; orphaned strings are acceptable per spec).
const PRIMARY_BACKGROUNDS = [
  {
    value: 'Strategic Finance & Business Finance',
    subtitle: 'Strategic Finance, Fundraising, Product and Marketing Finance, Pricing & Revenue Strategy, Mergers and Acquisitions, Investor and Board Work',
  },
  {
    value: 'FP&A & Corporate Finance',
    subtitle: 'FP&A, Corporate Finance, Treasury, Forecasting & Budgeting',
  },
  {
    value: 'Capital Markets & Investing',
    subtitle: 'Investment Banking, Private Equity, Venture Capital, Equity Research, Corporate Banking, Investor Relations',
  },
  {
    value: 'Strategy & Operations',
    subtitle: 'Management Consulting, Strategy, Business Operations, Revenue Operations, Chief of Staff, Analytics',
  },
  {
    value: 'Accounting & Compliance',
    subtitle: 'Accounting, Audit, Tax, Payroll, AP/AR, Compliance',
  },
];

const DETAILED_EXPERIENCE_MAP: Record<string, string[]> = {
  'Strategic Finance & Business Finance': [
    'Strategic Finance', 'Fundraising', 'Product and Marketing Finance',
    'Pricing & Revenue Strategy', 'Mergers and Acquisitions', 'Investor and Board Work',
  ],
  'FP&A & Corporate Finance': [
    'FP&A', 'Corporate Finance', 'Treasury', 'Forecasting & Budgeting',
  ],
  'Capital Markets & Investing': [
    'Investment Banking', 'Private Equity', 'Venture Capital', 'Equity Research',
    'Corporate Banking', 'Investor Relations',
  ],
  'Strategy & Operations': [
    'Management Consulting', 'Strategy', 'Business Operations',
    'Revenue Operations', 'Chief of Staff', 'Analytics',
  ],
  'Accounting & Compliance': [
    'Accounting', 'Audit', 'Tax', 'Payroll', 'AP/AR', 'Compliance',
  ],
};

const SECTORS = [
  'Fintech', 'Consumer/CPG', 'SaaS/Technology', 'Healthcare',
  'Real Estate', 'Private Equity', 'Investment Banking', 'Consulting',
  'Energy', 'Media', 'Marketplace', 'Financial Services',
  'Other',
];
// Sentinel for the industries "Other" picker — selecting this reveals
// the free-text input that lands in candidates.industries_other.
const SECTOR_OTHER = 'Other';

const TARGET_ROLES = [
  'Strategic Finance',
  'Corporate Development',
  'Strategy & Operations',
  'FP&A',
  'Chief of Staff',
  'Finance Manager / Director',
  'VP Finance / CFO',
];

// New areas of interest (finance specializations the candidate wants to
// move INTO). Multi-select → candidates.new_areas[].
const NEW_AREAS = [
  'Strategic Finance',
  'Corporate Development / M&A',
  'FP&A leadership',
  'Investor Relations',
  'Treasury / Capital Markets',
  'Business Operations / Chief of Staff',
  'Revenue Operations',
  'Data & Analytics (finance)',
  'Startup CFO / first finance hire',
  'Fund finance / portfolio finance',
];

// Target company stages — PREFERENCE list (which stages the candidate
// wants to work at next). Multi-select → candidates.target_company_stages[].
// The picker that uses this constant lives on the Preferences step;
// see COMPANY_STAGE_EXPERIENCE_OPTIONS below for the parallel
// EXPERIENCE list (where they've actually worked), which lives on
// the Experience step and writes the separate
// candidates.company_stage_experience column.
const COMPANY_STAGES = [
  'Pre-seed / Seed',
  'Series A',
  'Series B',
  'Series C+',
  'Pre-IPO / Late-stage private',
  'Public company (small-mid cap)',
  'Public company (large cap / Fortune 500)',
  'PE-backed',
  'Bootstrapped / Founder-owned',
  'Government / Non-profit',
];

// Phase: company-stage EXPERIENCE — what the candidate has actually
// worked at, distinct from `COMPANY_STAGES` above which currently
// drives target_company_stages (a preference). The new field
// company_stage_experience uses this shorter taxonomy (7 entries)
// chosen by the product spec. Stored on form.companyStageExperience
// and written to candidates.company_stage_experience[] on submit +
// edit-save.
const COMPANY_STAGE_EXPERIENCE_OPTIONS = [
  'Pre-seed / Seed',
  'Series A',
  'Series B',
  'Series C+',
  'PE-backed',
  'Public company (small-mid cap)',
  'Public company (large cap / Fortune 500)',
];

const PREFERRED_CITIES = [
  'New York', 'San Francisco / Bay Area', 'Los Angeles', 'Chicago',
  'Boston', 'Austin', 'Miami', 'Seattle', 'Denver', 'Washington D.C.',
  'Open to relocation', 'No preference',
  'Other',
];
// Sentinel for the cities "Other" picker — selecting reveals free-text.
const CITY_OTHER = 'Other';

// Under-$70k removed per spec (the comp question now lives only on the
// Future Job Preferences tab; the global disqualifier on it is gone).
const COMP_OPTIONS = [
  { value: '70k-100k', label: '$70k – $100k' },
  { value: '100k-150k', label: '$100k – $150k' },
  { value: '150k-200k', label: '$150k – $200k' },
  { value: '200k-300k', label: '$200k – $300k' },
  { value: '300k-plus', label: '$300k+' },
];

// Three-tier availability. Stored as the string literal on
// candidates.profile_description (as "Availability: <value>.") and
// mapped to the boolean open_to_opportunities column on save:
//   Actively Looking  → open_to_opportunities=true  (strong signal)
//   Passively Looking → open_to_opportunities=true  (still open, softer)
//   Not Active        → open_to_opportunities=false (hidden from "open" filters)
// The preview surfaces the nuance directly from the string; recruiters
// who filter by "open" still see Passively-Looking candidates.
const AVAILABILITY_OPTIONS = [
  {
    value: 'Actively Looking',
    emoji: '🟢',
    label: 'Actively Looking',
    desc: "I'm open to new opportunities right now",
  },
  {
    value: 'Passively Looking',
    emoji: '🟡',
    label: 'Passively Looking',
    desc: "I'm not actively searching but open to the right role",
  },
  {
    value: 'Not Active',
    emoji: '⏸️',
    label: 'Not Active',
    desc: "I'm not looking right now but want to stay in the network",
  },
];

const WORK_PREFERENCES = [
  { value: 'Remote', label: '🏠 Remote', desc: 'Fully remote only' },
  { value: 'Hybrid', label: '🏢 Hybrid', desc: 'Mix of remote and in-office' },
  { value: 'In-Office', label: '🏙️ In-Office', desc: 'Prefer to be in office' },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type Screen = 'landing' | 'auth' | 'verify-email' | 'form' | 'disqualified' | 'success';

// Form-rework field grouping (matches the new 6-tab wizard).
// One comp field total (targetComp on the Future Job Preferences tab).
// workPreferences is an array (was string). Industries collected on the
// Professional Experience tab. Work-auth two-question pair at the end.
interface FormState {
  // Tab 1 — Contact Information
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  linkedin: string;
  committed: boolean;

  // Tab 2 — Professional Experience
  primaryBackground: string;
  secondaryBackgrounds: string[];
  detailedExperience: string[];
  // Phase 2 of the skills redesign: the new candidate-facing field
  // backed by candidates.areas_of_expertise. detailedExperience is
  // kept on FormState for the dual-write transition (Phase 3 drops
  // it from this file once readers re-point); on save we write the
  // same array to both columns so existing readers (SFC Take prompt,
  // admin notify email) keep working unmodified until then.
  areasOfExpertise: string[];
  // Phase 4: résumé-driven suggestions for the Areas and Tools
  // pickers. Immutable snapshots from the most-recent parse —
  // selecting/adding/removing chips never mutates these. The picker
  // uses them to render the "Recommended from your résumé" row.
  // Both are autosaved (plain string[]) so a refresh after a parse
  // still shows the recommended chips. Empty in edit mode (parse
  // doesn't re-run on edit) → "Recommended" section just hides.
  suggestedAreas: string[];
  suggestedTools: string[];
  experience: string;              // years bucket: under2 / 2to5 / 5to10 / 10plus
  industries: string[];            // moved from old Step 4; → candidates.industries[]
  industriesOther: string;         // free text when 'Other' is in industries[]
  companyStages: string[];         // NEW → candidates.target_company_stages[]
  // What stages the candidate has WORKED at (experience), distinct
  // from companyStages above which captures the stages they WANT to
  // work at next. Optional — no validator gate. Persists to the
  // new candidates.company_stage_experience text[] column.
  companyStageExperience: string[];
  newAreas: string[];              // NEW → candidates.new_areas[]

  // Tab 3 — Resume Upload (resume only)
  resumeFile: File | null;
  resumeBase64: string;
  resumeParsed: any | null;
  parseWarning: boolean;
  // Parsed-resume fallout (still surfaced + editable on the review tab,
  // but we keep the fields here so /api/parse-resume can populate them).
  currentRole: string;
  location: string;
  yearsExperience: string;
  education: string;
  educationLevel: string;
  skills: string[];
  bio: string;

  // Tab 4 — Future Job Preferences
  jobSearchStatus: string;
  targetComp: string;              // ONLY comp field; lives here
  workPreferences: string[];       // multi-select
  preferredCities: string[];
  preferredCitiesOther: string;    // free text when 'Other' is in preferredCities[]
  targetRoles: string[];

  // Tab 5 — Work Authorization
  // null = unanswered; the validator requires both to be non-null before
  // the user can move forward. Two-question pair, no filtering on values.
  workAuthorizedUs: boolean | null;
  requiresSponsorship: boolean | null;
}

const INITIAL_FORM: FormState = {
  // Tab 1
  firstName: '', lastName: '', email: '', phone: '', linkedin: '', committed: false,
  // Tab 2
  primaryBackground: '', secondaryBackgrounds: [], detailedExperience: [], areasOfExpertise: [], suggestedAreas: [], suggestedTools: [], experience: '',
  industries: [], industriesOther: '',
  companyStages: [], companyStageExperience: [], newAreas: [],
  // Tab 3
  resumeFile: null, resumeBase64: '', resumeParsed: null, parseWarning: false,
  currentRole: '', location: '', yearsExperience: '', education: '',
  educationLevel: '', skills: [], bio: '',
  // Tab 4
  jobSearchStatus: '', targetComp: '',
  workPreferences: [], preferredCities: [], preferredCitiesOther: '', targetRoles: [],
  // Tab 5
  workAuthorizedUs: null, requiresSponsorship: null,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Only the "<2 years experience" gate remains — the comp lower bound is
// gone (under-70k removed from the option list entirely).
function isDisqualified(form: FormState): boolean {
  return form.experience === 'under2';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RadioGroup({ name, options, value, onChange }: {
  name: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2 mt-2">
      {options.map(opt => (
        <label key={opt.value} className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
          value === opt.value ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-gray-200 hover:border-gray-300'
        }`}>
          <input type="radio" name={name} value={opt.value} checked={value === opt.value}
            onChange={() => onChange(opt.value)} className="sr-only" />
          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
            value === opt.value ? 'border-emerald-500' : 'border-gray-300'
          }`}>
            {value === opt.value && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
          </div>
          <span className="text-sm font-medium">{opt.label}</span>
        </label>
      ))}
    </div>
  );
}

function ChipGrid({ options, selected, onChange }: {
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (val: string) =>
    onChange(selected.includes(val) ? selected.filter(s => s !== val) : [...selected, val]);
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {options.map(opt => (
        <button key={opt} type="button" onClick={() => toggle(opt)}
          className={`px-3 py-1.5 rounded-full text-sm border font-medium transition-all ${
            selected.includes(opt)
              ? 'bg-emerald-600 text-white border-emerald-600'
              : 'bg-white text-gray-700 border-gray-300 hover:border-emerald-400'
          }`}>
          {opt}
        </button>
      ))}
    </div>
  );
}

function CheckboxGrid({ options, selected, onChange }: {
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (val: string) =>
    onChange(selected.includes(val) ? selected.filter(s => s !== val) : [...selected, val]);
  return (
    <div className="grid grid-cols-2 gap-2 mt-2">
      {options.map(opt => (
        <label key={opt} className={`flex items-center gap-2 p-2.5 border rounded-lg cursor-pointer text-sm transition-all ${
          selected.includes(opt) ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-gray-200 hover:border-gray-300 text-gray-700'
        }`}>
          <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)} className="sr-only" />
          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
            selected.includes(opt) ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300'
          }`}>
            {selected.includes(opt) && <CheckCircle2 className="w-3 h-3 text-white" />}
          </div>
          {opt}
        </label>
      ))}
    </div>
  );
}

// ─── Education editor (per-degree rows over the single form.education string) ──
//
// Phase 2a clarity fix: the previous single-input "Education (degree
// + field)" made two degrees look like a text glitch (e.g.
// "MBA Finance; BS Financial Economics" came through as one long
// blob). We now render one row per degree with the degree + the
// specialization split into two visible inputs, plus an "+ Add
// another degree" button and per-row remove.
//
// CRITICAL: the underlying FormState.education stays a SINGLE STRING.
// This component is a UI representation over that string — we parse
// it on hydrate (so prefilled data shows as structured rows), and on
// every edit we join the rows back into the same
// "Degree Specialization; Degree Specialization" format the storage
// already expects. Submit / edit-save / dual-write flow are entirely
// unchanged.
//
// Local row state lives here (not on FormState) so the user can keep
// an empty "second degree" row open without it polluting
// form.education. When the user types into the row we join + push;
// when form.education changes externally (résumé parse, edit
// prefill), the effect below reparses to refresh the rows.
function EducationRowsEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const initialRows = useMemo(() => {
    const parsed = parseDegrees(value);
    // Always keep at least one row visible so the editor never
    // renders empty.
    return parsed.length > 0 ? parsed : [{ degree: '', specialization: '' }];
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps
  const [rows, setRows] = useState<DegreeRow[]>(initialRows);
  // Track the string we last wrote so a self-induced value change
  // doesn't reparse and clobber the empty trailing row.
  const lastEmittedRef = useRef<string>(joinDegrees(initialRows));

  // External value sync: when a résumé parse / edit prefill / page
  // mount feeds in a new `value` that DIDN'T come from this
  // editor's own onChange, reparse to refresh the rows.
  useEffect(() => {
    if (value === lastEmittedRef.current) return;
    const parsed = parseDegrees(value);
    setRows(parsed.length > 0 ? parsed : [{ degree: '', specialization: '' }]);
    lastEmittedRef.current = value;
  }, [value]);

  const commit = (next: DegreeRow[]) => {
    setRows(next);
    const joined = joinDegrees(next);
    lastEmittedRef.current = joined;
    onChange(joined);
  };
  const updateRow = (i: number, patch: Partial<DegreeRow>) => {
    commit(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  };
  const addRow = () => {
    // Don't commit yet — an empty row contributes nothing to the
    // joined string. The first keystroke in the new row triggers
    // commit, which is when form.education actually grows.
    setRows([...rows, { degree: '', specialization: '' }]);
  };
  const removeRow = (i: number) => {
    const next = rows.filter((_, j) => j !== i);
    // Guarantee at least one row stays visible.
    commit(next.length > 0 ? next : [{ degree: '', specialization: '' }]);
  };

  return (
    <div className="space-y-3">
      {rows.map((row, i) => (
        <div key={i} className="flex items-end gap-2">
          <div className="flex-1 min-w-0">
            {i === 0 && (
              <Label className="text-xs font-medium text-gray-500">Degree</Label>
            )}
            <Input
              value={row.degree}
              onChange={e => updateRow(i, { degree: e.target.value })}
              placeholder="e.g. MBA"
              className={i === 0 ? 'mt-1' : ''}
            />
          </div>
          <div className="flex-[2] min-w-0">
            {i === 0 && (
              <Label className="text-xs font-medium text-gray-500">Specialization</Label>
            )}
            <Input
              value={row.specialization}
              onChange={e => updateRow(i, { specialization: e.target.value })}
              placeholder="e.g. Finance"
              className={i === 0 ? 'mt-1' : ''}
            />
          </div>
          {rows.length > 1 && (
            <button
              type="button"
              onClick={() => removeRow(i)}
              aria-label={`Remove degree ${i + 1}`}
              className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={addRow}
        className="inline-flex items-center gap-1 text-xs font-medium text-[#006a2d] hover:text-[#004a1f] mt-1"
      >
        <Plus className="w-3.5 h-3.5" />
        Add another degree
      </button>
    </div>
  );
}

function SkillsInput({ skills, onChange }: { skills: string[]; onChange: (s: string[]) => void }) {
  const [inputVal, setInputVal] = useState('');
  const add = () => {
    const t = inputVal.trim();
    if (t && !skills.includes(t)) onChange([...skills, t]);
    setInputVal('');
  };
  return (
    <div>
      <div className="flex gap-2 mt-2">
        <Input value={inputVal} onChange={e => setInputVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder="e.g. Financial Modeling, LBO, SQL..." className="flex-1" />
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-2 mt-3">
        {skills.map(s => (
          <span key={s} className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-sm">
            {s}
            <button type="button" onClick={() => onChange(skills.filter(x => x !== s))}>
              <X className="w-3 h-3 hover:text-red-500" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Phase 4 skills picker (search + résumé-suggestions popup) ──────────────

/**
 * SearchAndSuggest — reusable picker used twice on the wizard's
 * Professional Experience tab (Areas of Expertise, Tools & Technical
 * Skills).
 *
 * Layout:
 *   1. Solid selected-chip row — the single source of truth for what
 *      ends up on the profile. Each chip has an × to remove. No
 *      visual distinction between AI-suggested and user-added —
 *      once selected, everything is just "selected."
 *   2. Search input with a type-ahead dropdown: taxonomy matches
 *      first (top 8 by declaration order), then a "+ Add '<typed>'"
 *      option at the bottom when allowCustom is true and the typed
 *      query isn't already in the taxonomy or selected list.
 *   3. "See résumé suggestions" button — ONLY rendered when
 *      `suggestions.length > 0`. Hidden in edit mode (parse doesn't
 *      run on edit; suggestions stays []), hidden when parse failed
 *      or returned nothing for this field.
 *   4. Modal popup (shadcn Dialog) opened by that button. Lists
 *      `suggestions` as ghost/outline + chips. Tapping one adds to
 *      `value`. Already-added suggestions render with a Check icon
 *      + solid styling + disabled — preventing double-add.
 *
 * `softCap` is GUIDANCE ONLY — the picker never blocks adding past
 * it. The hint surfaces as amber once past the cap.
 *
 * Storage: `value` is the single flat string[]; `suggestions` is the
 * immutable snapshot from the most-recent parse (set by parent into
 * form.suggestedAreas / form.suggestedTools and passed in here).
 */
function SearchAndSuggest({
  value,
  onChange,
  suggestions,
  taxonomy,
  allowCustom,
  softCap,
  searchPlaceholder,
  suggestionsButtonLabel,
  suggestionsTitle,
  suggestionsSubtitle,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  suggestions: string[];
  taxonomy: readonly string[];
  allowCustom: boolean;
  softCap?: number;
  searchPlaceholder: string;
  suggestionsButtonLabel: string;
  suggestionsTitle: string;
  suggestionsSubtitle: string;
}) {
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const [popupOpen, setPopupOpen] = useState(false);

  const valueLower = new Set(value.map(v => v.toLowerCase()));
  const taxonomyLower = new Set(taxonomy.map(t => t.toLowerCase()));

  // Search dropdown matches.
  const q = query.trim();
  const qLower = q.toLowerCase();
  const matches: string[] = q
    ? taxonomy.filter(t => !valueLower.has(t.toLowerCase()) && t.toLowerCase().includes(qLower)).slice(0, 8)
    : [];
  const isExactTaxonomyMatch = q && taxonomyLower.has(qLower);
  const isAlreadySelected = q && valueLower.has(qLower);
  const showCustomOption = allowCustom && q.length > 0 && !isExactTaxonomyMatch && !isAlreadySelected;
  const dropdownOptions: Array<{ kind: 'taxonomy' | 'custom'; label: string }> = [
    ...matches.map(m => ({ kind: 'taxonomy' as const, label: m })),
    ...(showCustomOption ? [{ kind: 'custom' as const, label: q }] : []),
  ];
  const dropdownOpen = q.length > 0 && dropdownOptions.length > 0;

  const addTag = (tag: string) => {
    const t = tag.trim();
    if (!t) return;
    if (valueLower.has(t.toLowerCase())) return;
    onChange([...value, t]);
    setQuery('');
    setHighlight(0);
  };
  const remove = (tag: string) => {
    onChange(value.filter(v => v.toLowerCase() !== tag.toLowerCase()));
  };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (dropdownOpen) addTag(dropdownOptions[Math.max(0, Math.min(highlight, dropdownOptions.length - 1))].label);
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(h + 1, Math.max(dropdownOptions.length - 1, 0))); return; }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)); return; }
    if (e.key === 'Escape')    { setQuery(''); setHighlight(0); return; }
  };

  const past = softCap !== undefined && value.length > softCap;
  const atOrPast = softCap !== undefined && value.length >= softCap;
  const hasSuggestions = suggestions.length > 0;

  return (
    <div>
      {/* Selected chips — the canonical list. Solid brand-green so the
          candidate sees exactly what's on their profile at a glance. */}
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-2 mb-3">
          {value.map(tag => (
            <span
              key={tag}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#008037] text-white rounded-full text-xs font-semibold"
            >
              {tag}
              <button
                type="button"
                onClick={() => remove(tag)}
                aria-label={`Remove ${tag}`}
                className="hover:text-white/70"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-400 mb-3 italic">Nothing selected yet — search below or browse résumé suggestions.</p>
      )}

      {/* Search input + type-ahead dropdown */}
      <div className="relative">
        <Input
          value={query}
          onChange={e => { setQuery(e.target.value); setHighlight(0); }}
          onKeyDown={handleKeyDown}
          placeholder={searchPlaceholder}
          className="pr-3"
        />
        {dropdownOpen && (
          <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {dropdownOptions.map((opt, idx) => (
              <button
                key={`${opt.kind}-${opt.label}`}
                type="button"
                onMouseEnter={() => setHighlight(idx)}
                onClick={() => addTag(opt.label)}
                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                  idx === highlight ? 'bg-emerald-50' : 'bg-white'
                } ${opt.kind === 'custom' ? 'border-t border-gray-100 text-emerald-700 font-semibold' : 'text-gray-800'}`}
              >
                {opt.kind === 'custom' ? `+ Add "${opt.label}"` : opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Bottom row: soft-cap hint + résumé-suggestions button. The
          button is hidden when there are no suggestions for this
          field (parse failed, returned empty, or edit mode where
          parse doesn't run). */}
      <div className="mt-2 flex items-center justify-between gap-3 flex-wrap">
        {softCap !== undefined ? (
          <p className={`text-xs ${past ? 'text-amber-700 font-semibold' : atOrPast ? 'text-amber-600' : 'text-gray-500'}`}>
            {value.length} of {softCap} selected
            {past && ' — over the suggested limit, but you can add more'}
          </p>
        ) : (
          <span /> /* spacer so the suggestions button stays right-aligned */
        )}
        {hasSuggestions && (
          <button
            type="button"
            onClick={() => setPopupOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {suggestionsButtonLabel}
            <span className="text-gray-400 font-normal">({suggestions.length})</span>
          </button>
        )}
      </div>

      {/* Suggestions popup. Only renders when hasSuggestions — we
          mount the Dialog conditionally so an edit-mode entry never
          attaches a Dialog node it can't open. */}
      {hasSuggestions && (
        <Dialog open={popupOpen} onOpenChange={setPopupOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{suggestionsTitle}</DialogTitle>
              <DialogDescription>{suggestionsSubtitle}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-wrap gap-2 py-2">
              {suggestions.map(tag => {
                const alreadyAdded = valueLower.has(tag.toLowerCase());
                return (
                  <button
                    key={tag}
                    type="button"
                    disabled={alreadyAdded}
                    onClick={() => addTag(tag)}
                    className={
                      alreadyAdded
                        ? 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#008037]/12 border border-[#008037]/30 text-[#004a1f] cursor-default'
                        : 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white border-2 border-dashed border-gray-300 text-gray-700 hover:border-[#008037] hover:text-[#008037] transition-colors'
                    }
                  >
                    {alreadyAdded ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                    {tag}
                  </button>
                );
              })}
            </div>
            <DialogFooter>
              <Button type="button" onClick={() => setPopupOpen(false)}>
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}


// ─── Landing sub-components ───────────────────────────────────────────────────

const LANDING_LOGOS = [
  'Goldman Sachs', 'McKinsey', 'Stripe', 'Blackstone', 'Google',
  'KKR', 'JP Morgan', 'Bain', 'BCG', 'Sequoia', 'Citadel',
  'Andreessen Horowitz', 'Two Sigma', 'Apollo',
];

const LANDING_CSS = `
@keyframes sfc-marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
@keyframes sfc-float { 0%,100% { transform: rotate(2deg) translateY(0); } 50% { transform: rotate(2deg) translateY(-3px); } }
.sfc-marquee-track { display:flex; width:max-content; animation: sfc-marquee 30s linear infinite; }
.sfc-marquee-track:hover { animation-play-state: paused; }
.sfc-float-card { animation: sfc-float 4s ease-in-out infinite; }
.sfc-fade { opacity:0; transform:translateY(12px); transition: opacity 0.5s ease, transform 0.5s ease; }
.sfc-fade.visible { opacity:1; transform:translateY(0); }
`;

function useFadeIn() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { el.classList.add('visible'); obs.disconnect(); }
    }, { threshold: 0.15 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

function LandingSection({ onStart, onSignIn }: { onStart: () => void; onSignIn: () => void }) {
  const s2 = useFadeIn(); const s3 = useFadeIn(); const s4 = useFadeIn();
  const s5 = useFadeIn(); const s6 = useFadeIn();
  const doubled = [...LANDING_LOGOS, ...LANDING_LOGOS];

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#FFFFFF', color: '#0A0A0A' }}>
      <style>{LANDING_CSS}</style>

      {/* ── Nav ── */}
      <nav style={{ padding: '20px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F3F4F6' }}>
        <span style={{ fontWeight: 600, fontSize: 16, letterSpacing: '-0.01em', color: '#0A0A0A' }}>SFC Talent</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={onSignIn}
            style={{ background: 'none', border: 'none', padding: '8px 16px', fontSize: 14, fontWeight: 500, color: '#6B7280', cursor: 'pointer' }}
          >
            Sign in
          </button>
          <button
            onClick={onStart}
            style={{ background: '#0F6E56', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 14, fontWeight: 500, color: 'white', cursor: 'pointer' }}
          >
            Join the Network
          </button>
        </div>
      </nav>

      {/* ── SECTION 1: HERO ── */}
      <section style={{ minHeight: 'calc(100vh - 65px)', display: 'flex', alignItems: 'center', padding: '80px 40px', maxWidth: 1200, margin: '0 auto' }}>
        {/* Left */}
        <div style={{ flex: 1, maxWidth: 580 }}>
          {/* Badge */}
          <div style={{ display: 'inline-block', marginBottom: 28, padding: '6px 14px', background: '#F0FDF4', border: '1px solid #D1FAE5', borderRadius: 100 }}>
            <span style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.05em', color: '#065F46', textTransform: 'uppercase' }}>
              Private Network · By Application Only
            </span>
          </div>

          {/* Headline */}
          <h1 style={{ fontSize: 'clamp(40px, 5vw, 64px)', fontWeight: 600, lineHeight: 1.1, marginBottom: 24, color: '#0A0A0A', letterSpacing: '-0.02em' }}>
            Stay <span style={{ color: '#0F6E56' }}>Anonymous</span>.<br />
            Get Introduced to<br />
            <span style={{ color: '#0F6E56' }}>Top Finance Teams</span>.
          </h1>

          {/* Sub */}
          <p style={{ fontSize: 18, fontWeight: 400, color: '#6B7280', lineHeight: 1.6, maxWidth: 520, marginBottom: 40 }}>
            A curated private network for strategic finance professionals. No recruiters. No spam. Just selective introductions.
          </p>

          {/* CTA */}
          <button
            onClick={onStart}
            style={{
              background: '#0F6E56', color: 'white', border: 'none', borderRadius: 8,
              padding: '14px 32px', fontSize: 15, fontWeight: 500, cursor: 'pointer',
              transition: 'background 0.2s ease, transform 0.2s ease', marginBottom: 16,
            }}
            onMouseEnter={e => { (e.target as HTMLElement).style.background = '#0A5C47'; (e.target as HTMLElement).style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { (e.target as HTMLElement).style.background = '#0F6E56'; (e.target as HTMLElement).style.transform = 'translateY(0)'; }}
          >
            Join the Network
          </button>

          <p style={{ fontSize: 13, color: '#9CA3AF', marginTop: 4, marginBottom: 20 }}>
            Takes 5 minutes · 100% free · Fully anonymous
          </p>

          <button
            onClick={onSignIn}
            style={{
              background: 'none', border: '1px solid #E5E7EB', borderRadius: 8,
              padding: '12px 28px', fontSize: 14, fontWeight: 500, color: '#374151',
              cursor: 'pointer', transition: 'border-color 0.2s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#9CA3AF'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#E5E7EB'; }}
          >
            Already have a profile? Sign in →
          </button>
        </div>

        {/* Right — floating dark card (desktop) */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }} className="hidden lg:flex">
          <div
            className="sfc-float-card"
            style={{
              background: '#0F172A', borderRadius: 16, padding: 28, width: 280,
              border: '1px solid #1E293B',
            }}
          >
            {/* Anonymous badge */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#052E16', border: '1px solid #166534', borderRadius: 100, padding: '4px 10px', marginBottom: 20 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E' }} />
              <span style={{ fontSize: 11, color: '#86EFAC', fontWeight: 500, letterSpacing: '0.04em' }}>ANONYMOUS</span>
            </div>

            {/* Avatar + role */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#134E4A', display: 'flex', alignItems: 'center', justifyContent: 'center', filter: 'blur(2px)', flexShrink: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#5EEAD4' }}>SF</span>
              </div>
              <div>
                <p style={{ fontSize: 16, fontWeight: 500, color: '#F1F5F9', lineHeight: 1.3, margin: 0 }}>VP Finance · Fintech</p>
                <p style={{ fontSize: 12, color: '#64748B', margin: '2px 0 0', fontWeight: 400 }}>8 yrs experience</p>
              </div>
            </div>

            {/* Skill chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
              {['Strategic Finance', 'FP&A', 'M&A'].map(s => (
                <span key={s} style={{ background: '#1E293B', color: '#E2E8F0', borderRadius: 100, padding: '4px 10px', fontSize: 12, fontWeight: 500 }}>{s}</span>
              ))}
            </div>

            {/* Lock footer */}
            <div style={{ borderTop: '1px solid #1E293B', paddingTop: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4"/>
              </svg>
              <span style={{ fontSize: 12, color: '#64748B' }}>Identity protected</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 2: LOGO MARQUEE ── */}
      <section ref={s2} className="sfc-fade" style={{ background: '#F9FAFB', padding: '48px 0', overflow: 'hidden' }}>
        <p style={{ textAlign: 'center', fontSize: 11, fontWeight: 500, letterSpacing: '0.1em', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 24 }}>
          Professionals from
        </p>
        <div className="sfc-marquee-track">
          {doubled.map((name, i) => (
            <span
              key={i}
              style={{ margin: '0 36px', fontSize: 15, fontWeight: 600, color: '#D1D5DB', letterSpacing: '0.02em', whiteSpace: 'nowrap', cursor: 'default', transition: 'color 0.2s' }}
              onMouseEnter={e => ((e.target as HTMLElement).style.color = '#6B7280')}
              onMouseLeave={e => ((e.target as HTMLElement).style.color = '#D1D5DB')}
            >
              {name}
            </span>
          ))}
        </div>
      </section>

      {/* ── SECTION 3: VALUE PROPS ── */}
      <section ref={s3} className="sfc-fade" style={{ background: '#FFFFFF', padding: '96px 40px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.1em', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 16 }}>Why SFC Talent</p>
          <h2 style={{ fontSize: 40, fontWeight: 600, color: '#0A0A0A', letterSpacing: '-0.02em', lineHeight: 1.15, marginBottom: 16 }}>Built for serious finance professionals.</h2>
          <p style={{ fontSize: 18, color: '#6B7280', marginBottom: 64 }}>Not a job board. Not a recruiter. A private introduction network.</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
            {[
              {
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                  </svg>
                ),
                title: 'You stay anonymous',
                body: 'Your name, employer, and contact details are never revealed to recruiters without your explicit consent.',
              },
              {
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
                  </svg>
                ),
                title: 'Curated, not broadcast',
                body: 'Every introduction is reviewed and selective. You won\'t be mass-applied to roles or spammed by recruiters.',
              },
              {
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/>
                  </svg>
                ),
                title: 'You control every intro',
                body: 'Accept or decline any introduction request within 48 hours. No pressure, no obligation, no awkward calls.',
              },
            ].map(card => (
              <div
                key={card.title}
                style={{
                  background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12,
                  padding: 32, textAlign: 'left', transition: 'border-color 0.2s',
                }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.borderColor = '#0F6E56')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = '#E5E7EB')}
              >
                <div style={{ marginBottom: 16 }}>{card.icon}</div>
                <h3 style={{ fontSize: 18, fontWeight: 600, color: '#0A0A0A', marginBottom: 12 }}>{card.title}</h3>
                <p style={{ fontSize: 15, color: '#6B7280', lineHeight: 1.6, margin: 0 }}>{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 4: HOW IT WORKS ── */}
      <section ref={s4} className="sfc-fade" style={{ background: '#F9FAFB', padding: '96px 40px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.1em', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 16, textAlign: 'center' }}>How it works</p>
          <h2 style={{ fontSize: 40, fontWeight: 600, color: '#0A0A0A', letterSpacing: '-0.02em', lineHeight: 1.15, marginBottom: 64, textAlign: 'center' }}>From anonymous to introduced in days.</h2>

          <div style={{ position: 'relative', paddingLeft: 48 }}>
            {/* Vertical line */}
            <div style={{ position: 'absolute', left: 14, top: 14, bottom: 14, width: 1, background: '#E5E7EB' }} />

            {[
              { n: '1', title: 'Create your anonymous profile', body: 'Upload your resume. Our AI extracts your experience, skills, and background — no manual entry.', delay: 0 },
              { n: '2', title: 'Get discovered by top companies', body: 'Recruiters browse anonymous profiles. They see your role, experience, and skills — never your identity.', delay: 100 },
              { n: '3', title: 'Receive curated introduction requests', body: 'When a company is interested, you get a direct message. One tap to accept or decline.', delay: 200 },
              { n: '4', title: 'Connect on your terms', body: 'Only if you accept does your contact information get shared. You stay in full control throughout.', delay: 300 },
            ].map(step => (
              <TimelineStep key={step.n} step={step} />
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 5: PRIVACY STATEMENT ── */}
      <section ref={s5} className="sfc-fade" style={{ background: '#0A0A0A', padding: '80px 40px', textAlign: 'center' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <h2 style={{ fontSize: 36, fontWeight: 600, color: '#FFFFFF', letterSpacing: '-0.02em', marginBottom: 24 }}>Your privacy is the product.</h2>
          <p style={{ fontSize: 16, color: '#9CA3AF', lineHeight: 1.7, marginBottom: 56 }}>
            Many candidates in our network are currently employed and exploring discreetly. We built SFC Talent around the principle that your career information belongs to you — not to recruiters, not to job boards, and not to us.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 64, flexWrap: 'wrap' }}>
            {[
              { stat: '100%', label: 'Anonymous by default' },
              { stat: '0', label: 'Recruiter cold calls' },
              { stat: '48hr', label: 'Response window' },
            ].map(({ stat, label }) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 28, fontWeight: 600, color: '#FFFFFF', margin: '0 0 4px' }}>{stat}</p>
                <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 6: FINAL CTA ── */}
      <section ref={s6} className="sfc-fade" style={{ background: '#FFFFFF', padding: '96px 40px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 48, fontWeight: 600, color: '#0A0A0A', letterSpacing: '-0.02em', marginBottom: 20 }}>Ready to be discovered?</h2>
        <p style={{ fontSize: 18, color: '#6B7280', marginBottom: 40, maxWidth: 560, margin: '0 auto 40px' }}>
          Join a network of strategic finance professionals being approached by top companies.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 24 }}>
          <button
            onClick={onStart}
            style={{
              background: '#0F6E56', color: 'white', border: 'none', borderRadius: 8,
              padding: '14px 32px', fontSize: 15, fontWeight: 500, cursor: 'pointer',
              transition: 'background 0.2s ease, transform 0.2s ease',
            }}
            onMouseEnter={e => { (e.target as HTMLElement).style.background = '#0A5C47'; (e.target as HTMLElement).style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { (e.target as HTMLElement).style.background = '#0F6E56'; (e.target as HTMLElement).style.transform = 'translateY(0)'; }}
          >
            Join the Network
          </button>
          <a
            href="#how-it-works"
            onClick={e => { e.preventDefault(); s4.current?.scrollIntoView({ behavior: 'smooth' }); }}
            style={{
              background: 'transparent', color: '#374151', border: '1px solid #E5E7EB', borderRadius: 8,
              padding: '14px 32px', fontSize: 15, fontWeight: 500, cursor: 'pointer',
              textDecoration: 'none', display: 'inline-block', transition: 'border-color 0.2s',
            }}
          >
            Learn how it works
          </a>
        </div>
        <button
          onClick={onSignIn}
          style={{
            background: 'none', border: '1px solid #E5E7EB', borderRadius: 8,
            padding: '12px 28px', fontSize: 14, fontWeight: 500, color: '#374151',
            cursor: 'pointer', transition: 'border-color 0.2s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#9CA3AF'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#E5E7EB'; }}
        >
          Already have a profile? Sign in →
        </button>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: '#FFFFFF', borderTop: '1px solid #F3F4F6', padding: '32px 40px', textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>
          © 2025 SFC Talent · strategicfinancecareers.com · talent@strategicfinancecareers.com
        </p>
      </footer>
    </div>
  );
}

function TimelineStep({ step }: { step: { n: string; title: string; body: string; delay: number } }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setTimeout(() => { el.style.opacity = '1'; el.style.transform = 'translateY(0)'; }, step.delay);
        obs.disconnect();
      }
    }, { threshold: 0.2 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [step.delay]);

  return (
    <div
      ref={ref}
      style={{ display: 'flex', gap: 24, marginBottom: 48, opacity: 0, transform: 'translateY(12px)', transition: 'opacity 0.4s ease, transform 0.4s ease' }}
    >
      <div style={{ flexShrink: 0, width: 28, height: 28, borderRadius: '50%', background: '#0F6E56', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, marginTop: 2 }}>
        {step.n}
      </div>
      <div>
        <h3 style={{ fontSize: 17, fontWeight: 600, color: '#0A0A0A', marginBottom: 8, marginTop: 4 }}>{step.title}</h3>
        <p style={{ fontSize: 15, color: '#6B7280', lineHeight: 1.6, margin: 0 }}>{step.body}</p>
      </div>
    </div>
  );
}

// ─── Success Screen ───────────────────────────────────────────────────────────

function SuccessScreen({ firstName }: { firstName: string }) {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6 py-16">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-8 h-8 text-emerald-600" />
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-3">Application submitted ✓</h2>
        <p className="text-gray-500 leading-relaxed mb-8">
          {firstName ? `Thanks, ${firstName}. ` : ''}Your profile is <strong>under review</strong>. We manually vet every candidate — we'll email you once it's approved (usually within 1–2 business days).
        </p>

        {/* Dashboard access box */}
        <div className="border border-emerald-200 bg-emerald-50 rounded-xl p-6 mb-4 text-left">
          <p className="text-sm font-semibold text-emerald-900 mb-1">Your dashboard</p>
          <p className="text-xs text-emerald-700 mb-4 leading-relaxed">
            Access your dashboard anytime at{' '}
            <span className="font-medium">sfc-recruiter-portal.vercel.app/candidate-dashboard</span>
          </p>
          <a
            href="/candidate-dashboard"
            className="w-full flex items-center justify-center bg-[#0F6E56] hover:bg-[#0a5942] text-white rounded-lg px-6 py-3 text-sm font-semibold transition-colors"
          >
            Go to Dashboard →
          </a>
        </div>
        <p className="text-xs text-gray-400">Bookmark this page — you'll use your email to sign in</p>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const TOTAL_STEPS = 6;

export default function CandidateApply() {
  // Landing for the marketing surface now lives at "/" (src/pages/Home.tsx).
  // /apply opens directly on the auth screen (signup tab by default), so
  // hitting this route from the new home page lands on the form, not on
  // the embedded LandingSection. The LandingSection component is still in
  // this file for the unlikely case anyone navigates back to 'landing'
  // via setScreen, but the initial state skips it.
  // ── Edit-mode autosave + deep-link helpers ───────────────────────────────
  // ONLY applied when ?edit=1. Create flow gets no draft persistence —
  // new applicants fill and submit, and abandoning the wizard
  // intentionally discards the work (the alternative would silently
  // persist someone's email/phone/resume metadata to localStorage
  // before they've consented, which we never want).
  //
  // Storage shape (versioned so a future field rename or shape change
  // can invalidate stale drafts cleanly without a crash):
  //   { version: 1, savedAt: ISO, form: <stripped FormState> }
  // Stripped = no resumeFile (File object isn't JSON-serializable),
  // no resumeBase64 (potentially huge), no resumeParsed (transient
  // parse result). The resume itself is handled out-of-band — the
  // existing single-resume model on the DB row stands until a
  // multi-resume build replaces it.
  const DRAFT_VERSION = 1;
  const draftKey = (candidateId: string) => `sfc:wizard-draft:${candidateId}`;
  type DraftEnvelope = { version: number; savedAt: string; form: Partial<FormState> };

  const stripFormForDraft = (f: FormState): Partial<FormState> => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { resumeFile, resumeBase64, resumeParsed, parseWarning, ...rest } = f;
    return rest;
  };

  const loadDraft = (candidateId: string): Partial<FormState> | null => {
    try {
      const raw = localStorage.getItem(draftKey(candidateId));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as DraftEnvelope;
      if (!parsed || parsed.version !== DRAFT_VERSION || !parsed.form) return null;
      return parsed.form;
    } catch (err) {
      console.warn('[CandidateApply] loadDraft failed — discarding stale draft:', err);
      return null;
    }
  };
  const saveDraft = (candidateId: string, f: FormState) => {
    try {
      const envelope: DraftEnvelope = {
        version: DRAFT_VERSION,
        savedAt: new Date().toISOString(),
        form: stripFormForDraft(f),
      };
      localStorage.setItem(draftKey(candidateId), JSON.stringify(envelope));
    } catch (err) {
      // localStorage can throw on quota / disabled / private mode.
      // Autosave is a nice-to-have, never the source of truth —
      // swallow + warn.
      console.warn('[CandidateApply] saveDraft failed:', err);
    }
  };
  const clearDraft = (candidateId: string) => {
    try { localStorage.removeItem(draftKey(candidateId)); } catch {}
  };

  const [draftRestored, setDraftRestored] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);

  // Baseline snapshot captured AT prefill time — the DB version of the
  // form, stripped of resume fields (same shape as what saveDraft
  // persists). isDirty compares the current form against this; a
  // restored draft counts as dirty because draft != DB. After "Save
  // Changes" succeeds we navigate away, so the baseline doesn't need
  // to be re-stamped mid-session.
  const [editBaseline, setEditBaseline] = useState<Partial<FormState> | null>(null);
  // Cancel-confirmation modal state. Controlled so we can open it
  // programmatically (when dirty) or bypass it (when clean).
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  // Mobile preview drawer state — Sheet at < lg containing the same
  // RecruiterPreviewCard instance the desktop right rail renders.
  // Controlled (rather than uncontrolled SheetTrigger) so a step
  // change can auto-close it if we ever want to. For now it just
  // opens on the floating pill click and the user closes it.
  const [previewSheetOpen, setPreviewSheetOpen] = useState(false);
  const navigate = useNavigate();

  // Map ?tab=<name> → step index. Both ?tab=preferences and ?step=4
  // are accepted (numeric wins if both are present). Out-of-range or
  // unknown values silently fall back to step 1.
  // Phase B reorder: resume=2, experience=3 (swapped). Deep-link
  // callers (e.g. /apply?edit=1&tab=experience) keep using the same
  // ?tab names; only the resolved step indices changed.
  const TAB_TO_STEP: Record<string, number> = {
    contact: 1,
    resume: 2,
    experience: 3,
    preferences: 4,
    'work-auth': 5,
    review: 6,
  };
  const resolveInitialStep = (): number => {
    const raw = (searchParams.get('step') || '').trim();
    if (raw) {
      const n = Number(raw);
      if (Number.isInteger(n) && n >= 1 && n <= 6) return n;
    }
    const tab = (searchParams.get('tab') || '').toLowerCase().trim();
    if (tab && TAB_TO_STEP[tab]) return TAB_TO_STEP[tab];
    return 1;
  };

  // ── Edit mode ──────────────────────────────────────────────────────────────
  // /apply?edit=1 puts the wizard into "edit existing candidate" mode.
  // In this mode we skip every create-only branch (signup, email
  // verification, candidate INSERT) and instead prefill the wizard from
  // the candidate-profile GET, save via PATCH to the same endpoint, and
  // route back to the dashboard on success. Status stays whatever it
  // was (active candidates stay active — edits go live immediately;
  // the PATCH whitelist server-side enforces that status/approval
  // fields can't be written). Create flow for NEW candidates is the
  // default — this mode is a strictly additive branch.
  const [searchParams] = useSearchParams();
  const isEditMode = searchParams.get('edit') === '1';

  // Initial screen: edit mode jumps straight to the form (prefill
  // effect below will populate FormState); create mode goes through
  // 'auth' as before.
  const [screen, setScreen] = useState<Screen>(isEditMode ? 'form' : 'auth');
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [parsing, setParsing] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit-mode-only state: the loaded candidate id (target of PATCH),
  // the existing resume filename for the read-only resume tab display,
  // and a loading flag while the prefill is in flight.
  const [editCandidateId, setEditCandidateId] = useState<string | null>(null);
  const [editResumeFilename, setEditResumeFilename] = useState<string>('');
  const [editLoading, setEditLoading] = useState(isEditMode);
  const [editPrefillError, setEditPrefillError] = useState('');

  // Auth state
  // Initial tab honors ?mode=signin in the URL so the landing's
  // "Professional login" link can deep-link returning users straight to
  // the Sign-in tab. Anything else (including absence of the param)
  // keeps the existing default of 'signup'. Read synchronously at
  // first render via initialState — no useEffect needed.
  const [authTab, setAuthTab] = useState<'signup' | 'signin'>(() => {
    if (typeof window === 'undefined') return 'signup';
    const params = new URLSearchParams(window.location.search);
    return params.get('mode') === 'signin' ? 'signin' : 'signup';
  });
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  const set = (field: keyof FormState, value: any) =>
    setForm(prev => ({ ...prev, [field]: value }));

  // ── Edit-mode prefill ─────────────────────────────────────────────────────
  // Runs once on mount when ?edit=1 is present. Verifies there's a live
  // session, then loads /api/candidate-profile (bearer-gated to
  // candidate-self) and maps each DB column back to its FormState
  // field. If anything fails (no session, 401/403/404, network),
  // surface the error inline and let the user retry — do not silently
  // route them through the create flow.
  useEffect(() => {
    if (!isEditMode) return;
    let cancelled = false;

    (async () => {
      try {
        await supabase.auth.refreshSession();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.email) {
          // Not signed in — kick to dashboard which will route to the
          // landing/sign-in surface. Edit mode requires a session.
          window.location.href = '/candidate-dashboard';
          return;
        }
        const email = session.user.email.toLowerCase();
        const res = await authedFetch(`/api/candidate-profile?email=${encodeURIComponent(email)}`);
        if (!res.ok) {
          if (cancelled) return;
          setEditPrefillError(
            res.status === 404
              ? "We couldn't find your profile. Please contact support."
              : 'Could not load your profile to edit. Please try again in a moment.'
          );
          setEditLoading(false);
          return;
        }
        const { candidate: c } = await res.json();
        if (cancelled) return;

        // ── DB → FormState mapping (inverse of handleSubmit payload) ─
        // name comes back as a single column; split on the first space
        // for the wizard's two-field display. If the name has no space
        // the whole thing becomes firstName.
        const fullName: string = c.name || '';
        const splitIdx = fullName.indexOf(' ');
        const firstName = splitIdx === -1 ? fullName : fullName.slice(0, splitIdx);
        const lastName = splitIdx === -1 ? '' : fullName.slice(splitIdx + 1);

        // profile_description on insert is `[bio, availabilityNote].filter(Boolean).join('\n\n')`.
        // Strip the appended availability paragraph the same way the
        // AnonymousCandidateCard does to reconstruct just the bio.
        const bio = (c.profile_description || '').split('\n\n')[0].trim();

        // years bucket — the wizard stores experience as a years-bucket
        // string ('under2' / '2to5' / '5to10' / '10plus'). The DB column
        // is an int. Translate back to the bucket the UI shows.
        const yrs = typeof c.experience === 'number' ? c.experience : Number(c.experience) || 0;
        const yearsBucket =
          yrs < 2 ? 'under2'
          : yrs < 5 ? '2to5'
          : yrs < 10 ? '5to10'
          : '10plus';

        // jobSearchStatus is stored two ways: the precise string ends
        // up in profile_description as an appended "Availability:
        // <value>." paragraph (lossless for all three tiers); the
        // open_to_opportunities boolean column is the recruiter-side
        // filter signal (true for both Actively + Passively, false
        // for Not Active). We try the string first so a candidate
        // who picked "Passively Looking" gets that exact tier back
        // on edit; if the note isn't present (older candidate, or
        // the value was somehow stripped), we fall back to the bool
        // — which can only distinguish open vs not-open and so
        // defaults to 'Actively Looking' when true.
        // Two prefix formats exist in the wild — edit-save writes
        // "Availability: <value>." on its own paragraph; the initial
        // submit writes "Job search status: <value>." joined with
        // sibling notes by a single space on one paragraph
        // ("Job search status: X. Target comp: Y. ...").
        // The capture stops at the first '.' so the rest of the
        // sentence chain doesn't bleed in.
        const availabilityNoteMatch = String(c.profile_description || '')
          .match(/(?:Availability|Job search status):\s*([^.\n]+?)\./);
        const noteValue = availabilityNoteMatch ? availabilityNoteMatch[1].trim() : '';
        const KNOWN_AVAILABILITY = new Set(['Actively Looking', 'Passively Looking', 'Not Active']);
        const jobSearchStatus =
          noteValue && KNOWN_AVAILABILITY.has(noteValue)
            ? noteValue
            : c.open_to_opportunities === true
              ? 'Actively Looking'
              : c.open_to_opportunities === false
                ? 'Not Active'
                : '';

        setEditCandidateId(c.id);
        // Filename from the resume storage path; the file itself isn't
        // re-uploaded in edit mode (single-resume model preserved).
        setEditResumeFilename(c.resume_full_url ? String(c.resume_full_url).split('/').pop() || '' : '');

        // Build the DB→FormState map into a local const so we can both
        // setForm() it AND snapshot it as the dirty-detection baseline
        // before the draft overlay potentially mutates it.
        const dbForm: FormState = {
          firstName,
          lastName,
          email: c.email || email,
          phone: c.phone || '',
          linkedin: c.linkedin_url || '',
          committed: true, // already accepted on initial submit; not re-collected

          primaryBackground: c.primary_background || '',
          secondaryBackgrounds: Array.isArray(c.secondary_backgrounds) ? c.secondary_backgrounds : [],
          detailedExperience: Array.isArray(c.detailed_experience) ? c.detailed_experience : [],
          // Phase 2 prefill: hydrate areasOfExpertise from the new
          // column when present, else fall back to detailed_experience
          // as a one-time mirror so the 11 existing candidates' values
          // surface on their first edit. After they Save Changes, the
          // dual-write keeps both columns in sync.
          areasOfExpertise: Array.isArray((c as any).areas_of_expertise) && (c as any).areas_of_expertise.length > 0
            ? (c as any).areas_of_expertise
            : (Array.isArray(c.detailed_experience) ? c.detailed_experience : []),
          experience: yearsBucket,
          industries: Array.isArray(c.industries) ? c.industries : [],
          industriesOther: c.industries_other || '',
          companyStages: Array.isArray(c.target_company_stages) ? c.target_company_stages : [],
          companyStageExperience: Array.isArray((c as any).company_stage_experience) ? (c as any).company_stage_experience : [],
          newAreas: Array.isArray(c.new_areas) ? c.new_areas : [],

          // Resume file slots stay empty in edit mode — the existing
          // resume is shown read-only via editResumeFilename.
          resumeFile: null,
          resumeBase64: '',
          resumeParsed: null,
          parseWarning: false,

          currentRole: c.label || '',
          location: c.location || '',
          yearsExperience: String(yrs),
          education: c.education || '',
          educationLevel: c.highest_education_level || '',
          skills: Array.isArray(c.skills) ? c.skills : [],
          bio,

          jobSearchStatus,
          targetComp: c.target_salary || '',
          workPreferences: Array.isArray(c.work_preferences)
            ? c.work_preferences
            : (c.work_preference ? [c.work_preference] : []),
          preferredCities: Array.isArray(c.preferred_cities) ? c.preferred_cities : [],
          preferredCitiesOther: c.preferred_cities_other || '',
          targetRoles: Array.isArray(c.target_roles) ? c.target_roles : [],

          workAuthorizedUs: typeof c.work_authorized_us === 'boolean' ? c.work_authorized_us : null,
          requiresSponsorship: typeof c.requires_sponsorship === 'boolean' ? c.requires_sponsorship : null,
        };
        setForm(dbForm);
        // Snapshot the DB version as the dirty-detection baseline.
        // Stripping the resume fields keeps baseline comparable with
        // the same-shape stripped form passed to JSON.stringify below
        // — resume re-upload state is never a "dirty" signal in edit
        // mode anyway (the existing file is shown read-only).
        setEditBaseline(stripFormForDraft(dbForm));

        // ── Draft overlay (autosave restore) + initial step jump ──
        // Smart overlay (fix for the stale-empty-draft clobber bug):
        // a previous testing session could leave a draft in
        // localStorage whose fields are empty strings / nulls / empty
        // arrays. The previous spread-merge let those empty values
        // overwrite the freshly-loaded DB values (name, email,
        // linkedin all rendered blank because the stale draft's
        // empty strings won the merge). Three guards now:
        //   1. Strip resume fields defensively (same as before).
        //   2. Per-field overlay: only include keys whose draft value
        //      is "meaningful" — non-empty string, non-empty array,
        //      non-null. This protects good DB values from being
        //      clobbered by empty fields in a stale draft. Trade-off:
        //      a user who explicitly CLEARED a field won't see the
        //      cleared state restored across reload; they need to
        //      re-clear after restoring. Acceptable until we move to
        //      a per-field dirty-tracking model.
        //   3. If the meaningful overlay contributes nothing beyond
        //      the DB baseline, discard the draft entirely (clearDraft
        //      + skip the restore banner). Stops legacy / test-noise
        //      drafts from showing a misleading "we restored your
        //      edits" banner when there's nothing real to restore.
        const isMeaningful = (v: unknown): boolean => {
          if (v == null) return false;
          if (typeof v === 'string') return v.trim().length > 0;
          if (Array.isArray(v)) return v.length > 0;
          return true; // booleans, numbers, objects all count as set
        };
        const draft = loadDraft(c.id);
        if (draft && typeof draft === 'object') {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { resumeFile, resumeBase64, resumeParsed, parseWarning, ...safe } = draft as any;
          const overlay: Record<string, unknown> = {};
          for (const k of Object.keys(safe)) {
            if (isMeaningful(safe[k])) overlay[k] = safe[k];
          }
          const overlaid = { ...dbForm, ...overlay } as FormState;
          const baselineStr = JSON.stringify(stripFormForDraft(dbForm));
          const overlaidStr = JSON.stringify(stripFormForDraft(overlaid));
          if (overlaidStr === baselineStr) {
            // Draft contributes nothing — clean it up so it stops
            // haunting future sessions / triggering the banner.
            clearDraft(c.id);
          } else {
            setForm(overlaid);
            setDraftRestored(true);
          }
        }
        setStep(resolveInitialStep());
        setEditLoading(false);
      } catch (err: any) {
        if (cancelled) return;
        console.error('[CandidateApply] edit prefill failed:', err);
        setEditPrefillError('Could not load your profile to edit. Please try again in a moment.');
        setEditLoading(false);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode]);

  // ── Edit-mode dirty detection ────────────────────────────────────────────
  // True when the current form differs from the prefilled DB baseline.
  // A restored draft counts as dirty by definition (draft != DB). We
  // compare via JSON.stringify on the stripped form — same shape as
  // baseline, so resume re-upload state never registers as dirty.
  const isDirty = useMemo(() => {
    if (!isEditMode || !editBaseline) return false;
    try {
      return JSON.stringify(stripFormForDraft(form)) !== JSON.stringify(editBaseline);
    } catch {
      return false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, editBaseline, isEditMode]);

  // Back/Cancel handler: open the confirm dialog when dirty, navigate
  // straight through when clean. Bound to the header button below.
  const handleEditCancel = () => {
    if (isDirty) {
      setCancelDialogOpen(true);
    } else {
      navigate('/candidate-dashboard');
    }
  };
  // Confirmed-leave: clear the autosave draft (so it doesn't shadow
  // the real DB state on next entry — no orphaned drafts), reset the
  // restore banner, then navigate. After this branch, the only way a
  // draft survives a leave is tab-close / refresh — Cancel always
  // discards.
  const handleConfirmLeave = () => {
    if (editCandidateId) clearDraft(editCandidateId);
    setDraftSavedAt(null);
    setDraftRestored(false);
    setCancelDialogOpen(false);
    navigate('/candidate-dashboard');
  };

  // ── Edit-mode debounced autosave ─────────────────────────────────────────
  // Persists in-progress edits to localStorage (keyed by candidate id)
  // so a refresh/navigate doesn't lose them. Does NOT write to the
  // live candidate row and does NOT fire admin-notify — both happen
  // only on explicit Save Changes via handleEditSave.
  //
  // Gates: edit mode + a candidate id is known + initial prefill done
  // + still inside the form (skip the success screen so the post-save
  // clearDraft can't be immediately overwritten).
  useEffect(() => {
    if (!isEditMode || !editCandidateId || editLoading || screen !== 'form') return;
    const handle = setTimeout(() => {
      saveDraft(editCandidateId, form);
      setDraftSavedAt(new Date().toISOString());
    }, 800);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, isEditMode, editCandidateId, editLoading, screen]);

  // ── Edit-mode save ────────────────────────────────────────────────────────
  // PATCHes only the whitelisted fields to /api/candidate-profile (the
  // server enforces the whitelist regardless, but sending the minimum
  // set keeps logs clean). On 200, route back to /candidate-dashboard
  // via the 'success' screen which renders edit-flavored copy.
  const handleEditSave = async () => {
    if (!editCandidateId) {
      setSubmitError('No candidate loaded to save. Please reload.');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      // bio is the bio paragraph the candidate edited; we re-append the
      // availability note the same way submit-candidate.ts does so the
      // profile_description string keeps its shape.
      const availabilityNote = form.jobSearchStatus
        ? `Availability: ${form.jobSearchStatus}.`
        : '';
      const profileDescription = [form.bio, availabilityNote].filter(Boolean).join('\n\n');

      // yearsBucket → integer column. The PATCH endpoint also validates
      // server-side, but we coerce here so the client log is honest.
      const yrsBucketToInt: Record<string, number> = { under2: 1, '2to5': 3, '5to10': 7, '10plus': 12 };
      const experienceInt = yrsBucketToInt[form.experience] ?? Number(form.yearsExperience) ?? 0;

      const payload: Record<string, unknown> = {
        id: editCandidateId,
        // Tab 1 (only linkedin + phone editable; firstName/lastName/email read-only in UI)
        phone: form.phone || null,
        linkedin_url: form.linkedin || null,
        // Tab 2
        primary_background: form.primaryBackground || null,
        secondary_backgrounds: form.secondaryBackgrounds,
        // Phase 2 dual-write: write the legacy detailed_experience
        // column with the same array the candidate just picked for
        // areasOfExpertise. detailedExperience is no longer a
        // separately-editable field — the picker only writes
        // form.areasOfExpertise — but every existing reader (SFC
        // Take prompt, admin notify email) still consumes
        // detailed_experience until Phase 3 re-points them, so we
        // keep the mirror populated. Phase 5 drops the column.
        detailed_experience: form.areasOfExpertise,
        experience: experienceInt,
        industries: form.industries,
        industries_other: form.industriesOther || null,
        target_company_stages: form.companyStages,
        company_stage_experience: form.companyStageExperience,
        new_areas: form.newAreas,
        // Tab 3 (resume itself read-only; parsed-resume side effects editable)
        label: form.currentRole || null,
        location: form.location || null,
        education: form.education || null,
        highest_education_level: form.educationLevel || null,
        // skills are NOT sent — candidates.skills isn't a column (writes
        // would error). Read-only in edit mode; tracked follow-up endpoint
        // will own the candidate_skills join writes.
        profile_description: profileDescription || null,
        // Tab 4
        target_salary: form.targetComp || null,
        // open_to_opportunities is the recruiter-side "is this person
        // open?" filter. Both Actively + Passively map to true; only
        // Not Active maps to false. The precise tier round-trips
        // through the "Availability: <value>." line we re-append to
        // profile_description below.
        open_to_opportunities:
          form.jobSearchStatus === 'Actively Looking' ||
          form.jobSearchStatus === 'Passively Looking',
        work_preferences: form.workPreferences,
        // Deprecated singular mirror — keep populated like submit-candidate does.
        work_preference: form.workPreferences[0] || null,
        preferred_cities: form.preferredCities,
        preferred_cities_other: form.preferredCitiesOther || null,
        target_roles: form.targetRoles,
        // Tab 5
        work_authorized_us: form.workAuthorizedUs,
        requires_sponsorship: form.requiresSponsorship,
      };

      const res = await authedFetch('/api/candidate-profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setSubmitError('Could not save changes — please try again.');
        return;
      }

      // ── Areas of Expertise write (Phase 2) ────────────────────────
      // candidates.areas_of_expertise is the new controlled-taxonomy
      // field; it's NOT in the candidate-profile PATCH whitelist by
      // design (its writes go through a dedicated endpoint with its
      // own cap-10 + taxonomy validation server-side). We send the
      // same array we just dual-wrote to detailed_experience above.
      // Partial-failure handling matches the skills write below: if
      // the profile PATCH succeeded but Areas fails, we surface an
      // actionable message and preserve the draft so the user can
      // retry without losing in-progress edits.
      const areasRes = await authedFetch('/api/update-candidate-areas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId: editCandidateId, areasOfExpertise: form.areasOfExpertise }),
      });
      if (!areasRes.ok) {
        let detail = '';
        try { detail = (await areasRes.json())?.error || ''; } catch { /* keep blank */ }
        console.error('[CandidateApply] areas save failed after profile saved:', areasRes.status, detail);
        setSubmitError(
          'Your profile changes were saved, but your Areas of Expertise update failed. Please try saving again.'
        );
        return;
      }

      // ── Skills write (separate endpoint by design) ───────────────
      // candidates.skills doesn't exist as a column — skills live in
      // the candidate_skills join table. So skills are not part of
      // the PATCH payload above (the candidate-profile whitelist
      // excludes them). We post them to a dedicated endpoint that
      // mirrors the same bearer+ownership auth model and writes the
      // join. If the PATCH succeeded but skills fail, we surface a
      // partial-failure message so the user knows profile fields are
      // saved but skills aren't — never silently lose data.
      const skillsRes = await authedFetch('/api/update-candidate-skills-list', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editCandidateId, skills: form.skills }),
      });
      if (!skillsRes.ok) {
        let detail = '';
        try { detail = (await skillsRes.json())?.error || ''; } catch { /* keep blank */ }
        console.error('[CandidateApply] skills save failed after profile saved:', skillsRes.status, detail);
        setSubmitError(
          'Your profile changes were saved, but your skills update failed. Please try saving again.'
        );
        // Don't clear the autosave draft — the in-progress skills
        // state matters; the next save attempt should still have it.
        // Don't navigate away either; let the user retry.
        return;
      }

      // Clear the autosave draft now that the live row holds the
      // canonical version. Leaving the draft in place would shadow
      // the freshly-saved data on the next /apply?edit=1 visit and
      // make stale local edits look authoritative.
      if (editCandidateId) clearDraft(editCandidateId);
      setDraftSavedAt(null);
      setDraftRestored(false);
      setScreen('success');
    } catch (err: any) {
      console.error('[CandidateApply] edit save failed:', err);
      setSubmitError('Could not save changes — please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Route a confirmed session: check profile, go to dashboard or form ─────────
  const routeConfirmedSession = async (email: string) => {
    set('email', email);
    const profileRes = await authedFetch(`/api/candidate-profile?email=${encodeURIComponent(email.toLowerCase())}`);
    if (profileRes.ok) {
      window.location.href = '/candidate-dashboard';
    } else {
      setScreen('form');
      setStep(1);
    }
  };

  // ── Session-leak guard ───────────────────────────────────────────────────────
  // If user A is signed in and clicks user B's verification link in the same
  // browser, Supabase's localStorage session for A can "win" over the
  // verification URL processing. Detect verification params in the URL on
  // mount and sign out any existing local session FIRST so Supabase
  // reconciles the verification token cleanly. Local-scope signOut only
  // clears localStorage — the verification token itself stays valid.
  // This runs ONCE at mount and ONLY when verification params are present —
  // it never fires on plain dashboard/apply navigation.
  useEffect(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash || '' : '';
    const search = typeof window !== 'undefined' ? window.location.search || '' : '';
    const verificationRegex = /(access_token=|refresh_token=|token_hash=|type=(signup|recovery|magiclink|invite|email_change))/;
    const hasVerificationParams = verificationRegex.test(hash) || verificationRegex.test(search);

    if (!hasVerificationParams) return;

    (async () => {
      const { data: { session: existing } } = await supabase.auth.getSession();
      if (existing?.user?.email) {
        console.log('[CandidateApply] verification URL detected — clearing existing local session for', existing.user.email);
        await supabase.auth.signOut({ scope: 'local' });
      }
    })().catch(err => console.error('[CandidateApply] session-leak guard error:', err));
  }, []);

  // ── Only listen for email confirmation while on verify-email screen ───────────
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, _session) => {
      if (
        (event === 'SIGNED_IN' || event === 'USER_UPDATED') &&
        screen === 'verify-email'
      ) {
        // FIX 2 — defensive: never trust the cached session. Refresh against
        // the server so we route based on the freshest confirmed identity.
        const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
        if (refreshErr) {
          console.warn('[CandidateApply] refreshSession error:', refreshErr.message);
        }
        const freshSession = refreshed?.session ?? (await supabase.auth.getSession()).data.session;
        if (!freshSession?.user?.email_confirmed_at) return;

        const email = freshSession.user.email ?? authEmail;
        await routeConfirmedSession(email);
      }
    });
    return () => subscription.unsubscribe();
  }, [screen, authEmail]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived ─────────────────────────────────────────────────────────────────

  // Profile completion % — shown on the floating mobile preview pill
  // and on the right-rail preview card's progress bar. Pure derived
  // from form; the helper lives alongside the preview component so
  // the card and the pill stay in sync (one source of truth). Memoed
  // on the form reference because the helper iterates every gated
  // field on every change.
  const profileCompletionPct = useMemo(() => profileCompletion(form), [form]);

  const detailOptions = DETAILED_EXPERIENCE_MAP[form.primaryBackground] ?? [];
  // Secondary backgrounds = all categories except primary
  const secondaryOptions = PRIMARY_BACKGROUNDS.filter(b => b.value !== form.primaryBackground);

  // ── Validation (per the new 6-tab order) ──────────────────────────────────
  //   1) Contact Information
  //   2) Professional Experience
  //   3) Resume Upload
  //   4) Future Job Preferences
  //   5) Work Authorization
  //   6) Review
  // Forward navigation is gated by these. Back is always free, and tabs
  // are clickable for any step the user has at least one of the gates
  // satisfied for (see canVisitStep below).

  const canProceedStep1 =
    !!(form.firstName && form.lastName && form.email && form.phone.trim().length >= 7 && form.linkedin.trim() && form.committed);

  // Phase B reorder: Resume is now step 2, Professional Experience is step 3.
  // In CREATE mode step 2 requires a parsed resume; in EDIT mode an
  // already-uploaded resume (signalled by editResumeFilename, derived
  // from resume_full_url during the edit prefill) also satisfies the
  // gate.
  const canProceedStep2 = form.resumeParsed !== null || (isEditMode && !!editResumeFilename);

  // Phase 2: the picker on this step writes form.areasOfExpertise
  // (the new field), not form.detailedExperience (kept on FormState
  // only as the dual-write target). At least one area must be
  // selected — same shape as the legacy gate.
  const canProceedStep3 =
    !!(form.primaryBackground && form.areasOfExpertise.length > 0 && form.experience);

  // Tab 4: comp is now mandatory here (only place it's asked); work
  // preferences must be at least one selected (multi-select); job-status
  // (Active/Not Active) remains required.
  const canProceedStep4 =
    !!(form.jobSearchStatus && form.targetComp && form.workPreferences.length > 0);

  // Tab 5: both work-auth questions must be answered (yes/no on each).
  const canProceedStep5 =
    form.workAuthorizedUs !== null && form.requiresSponsorship !== null;

  const canProceed = [null, canProceedStep1, canProceedStep2, canProceedStep3, canProceedStep4, canProceedStep5, true][step];

  // Tab bar click-to-navigate: a user can always visit an earlier step,
  // and can visit a later step only if every step before it is valid.
  // Step 6 (Review) requires every prior validator to be true.
  const stepValidators = [null, canProceedStep1, canProceedStep2, canProceedStep3, canProceedStep4, canProceedStep5] as const;
  const canVisitStep = (target: number): boolean => {
    // EDIT mode: the profile is already complete (admin-approved),
    // so every tab is freely clickable from any step. The forward-
    // gating that walks earlier validators is a CREATE-mode safety
    // for new applicants only — it would otherwise block an editor
    // who briefly emptied a required field (e.g. cleared LinkedIn
    // while updating it) from jumping to other tabs to look around.
    if (isEditMode) return true;
    if (target <= step) return true;          // backward / current always ok
    for (let i = 1; i < target; i++) {
      if (!stepValidators[i]) return false;
    }
    return true;
  };

  // ── Navigation ──────────────────────────────────────────────────────────────

  const handleNext = () => {
    // Disqualifier check moved to Tab 2 (where the years-experience radio
    // now lives). Comp no longer triggers any disqualifier — under-70k
    // was removed from the option list.
    // In edit mode an already-approved candidate must not be soft-blocked
    // back to the disqualified screen — they're editing an existing
    // active profile. Admins can deactivate if needed via the admin
    // tools; the disqualifier is a CREATE-flow gate only.
    // Phase B reorder: Professional Experience is now step 3; the
    // <2-years-experience disqualifier was previously checked when
    // advancing OFF step 2 (Experience). Same intent, new step index.
    if (!isEditMode && step === 3 && isDisqualified(form)) {
      setScreen('disqualified');
      return;
    }
    if (step < TOTAL_STEPS) setStep(s => s + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(s => s - 1);
    // /apply no longer owns the landing surface — back from step 1 goes
    // to the canonical front door at "/".
    else window.location.href = '/';
  };

  const handleStepClick = (target: number) => {
    if (canVisitStep(target)) setStep(target);
  };

  // ── Resume Upload & Parse ───────────────────────────────────────────────────

  const callParseAPI = async (base64: string): Promise<any> => {
    const res = await fetch('/api/parse-resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resumeBase64: base64, filename: form.resumeFile?.name }),
    });
    return res.json();
  };

  const applyParsed = (parsed: any) => {
    if (parsed.parseError) {
      set('parseWarning', true);
    } else {
      set('parseWarning', false);
      if (parsed.currentRole) set('currentRole', parsed.currentRole);
      if (parsed.location) set('location', parsed.location);
      if (parsed.yearsExperience != null) set('yearsExperience', String(parsed.yearsExperience));
      if (parsed.education) set('education', parsed.education);
      if (parsed.educationLevel) set('educationLevel', parsed.educationLevel);
      if (parsed.bio) set('bio', parsed.bio);
      if (Array.isArray(parsed.sectors) && parsed.sectors.length > 0) set('sectors', parsed.sectors);
      // Phase 4 revision: record résumé suggestions immutably for
      // the popup-driven UI. NO auto-seeding of form.areasOfExpertise
      // or form.skills — suggestions remain unselected until the
      // candidate explicitly taps them from the "See résumé
      // suggestions" popup (or adds via search). Previously the
      // parse auto-filled the selected list; that pre-selection is
      // gone so candidates explicitly choose what fits, matching
      // the "Tap the ones that fit — we pulled these from your
      // résumé" framing.
      const sa = Array.isArray(parsed.suggestedAreas) ? parsed.suggestedAreas.filter((s: unknown) => typeof s === 'string' && (s as string).trim()) : [];
      const st = Array.isArray(parsed.skills) ? parsed.skills.filter((s: unknown) => typeof s === 'string' && (s as string).trim()) : [];
      set('suggestedAreas', sa);
      set('suggestedTools', st);
    }
    set('resumeParsed', parsed);
  };

  const handleResumeUpload = async (file: File) => {
    set('resumeFile', file);
    set('resumeParsed', null);
    set('parseWarning', false);
    setParsing(true);

    try {
      // Read as ArrayBuffer, convert to base64 — PDFs are binary, cannot use readAsText
      const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target?.result as ArrayBuffer);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      });

      // Safe base64 encoding that handles large files
      const uint8 = new Uint8Array(arrayBuffer);
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < uint8.length; i += chunkSize) {
        binary += String.fromCharCode(...uint8.subarray(i, i + chunkSize));
      }
      const base64 = btoa(binary);
      set('resumeBase64', base64);

      const parsed = await callParseAPI(base64);
      applyParsed(parsed);
    } catch (err: any) {
      console.warn('[resume upload] error:', err.message);
      set('parseWarning', true);
      set('resumeParsed', { parseError: true });
    } finally {
      setParsing(false);
    }
  };

  const handleRegenerateBio = async () => {
    if (!form.resumeBase64) return;
    setRegenerating(true);
    try {
      const parsed = await callParseAPI(form.resumeBase64);
      if (!parsed.parseError && parsed.bio) {
        set('bio', parsed.bio);
      }
    } catch (err: any) {
      console.warn('[regenerate bio] error:', err.message);
    } finally {
      setRegenerating(false);
    }
  };

  // ── Submit ──────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch('/api/submit-candidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Identity / contact
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone,
          linkedin: form.linkedin || null,
          // Parsed-resume / review fields
          currentRole: form.currentRole,
          location: form.location,
          yearsExperience: Number(form.yearsExperience) || 0,
          education: form.education,
          educationLevel: form.educationLevel,
          bio: form.bio,
          skills: form.skills,
          // Professional experience (industries moved here; new fields added)
          industries: form.industries,
          industriesOther: form.industriesOther || null,
          companyStages: form.companyStages,
          companyStageExperience: form.companyStageExperience,
          newAreas: form.newAreas,
          primaryBackground: form.primaryBackground,
          secondaryBackgrounds: form.secondaryBackgrounds,
          // Phase 2 dual-write — submit-candidate.ts now accepts
          // areasOfExpertise as the new source of truth; the
          // detailedExperience field is sent as a mirror so the
          // server's existing detailed_experience column write keeps
          // populating the legacy column that readers still consume.
          // The server writes both columns to the same array.
          detailedExperience: form.areasOfExpertise,
          areasOfExpertise: form.areasOfExpertise,
          // Future Job Preferences (single comp source of truth)
          jobSearchStatus: form.jobSearchStatus,
          targetComp: form.targetComp,
          workPreferences: form.workPreferences,
          preferredCities: form.preferredCities,
          preferredCitiesOther: form.preferredCitiesOther || null,
          targetRoles: form.targetRoles,
          // Work authorization (two questions, store-only)
          workAuthorizedUs: form.workAuthorizedUs,
          requiresSponsorship: form.requiresSponsorship,
          // Resume
          resumeBase64: form.resumeBase64 || null,
          resumeFileName: form.resumeFile?.name || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Submission failed');
      }

      setScreen('success');
    } catch (err: any) {
      setSubmitError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Landing ─────────────────────────────────────────────────────────────────

  // "Join the Network" → create account first
  const handleStart = () => { setAuthTab('signup'); setAuthError(''); setScreen('auth'); };

  // "Already have a profile?" → sign in tab
  const handleSignIn = () => { setAuthTab('signin'); setAuthError(''); setScreen('auth'); };

  // ── Edit-mode loading / error gate ───────────────────────────────────────
  // While the prefill is in flight, hide the wizard chrome entirely.
  // If it fails, surface a single error screen rather than letting the
  // user edit an empty form and accidentally PATCH defaults over their
  // real data.
  if (isEditMode && editLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
      </div>
    );
  }
  if (isEditMode && editPrefillError) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Couldn't load your profile</h1>
          <p className="text-sm text-gray-500 mb-6">{editPrefillError}</p>
          <Link
            to="/candidate-dashboard"
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Create-only screens — defensively skipped in edit mode (the
  // initial-screen state already routes edit mode straight to 'form',
  // and the prefill effect won't call setScreen back to any of these,
  // so this guard is belt-and-suspenders).
  if (!isEditMode && screen === 'landing') {
    return <LandingSection onStart={handleStart} onSignIn={handleSignIn} />;
  }

  // ── Verify Email ─────────────────────────────────────────────────────────────

  if (!isEditMode && screen === 'verify-email') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-6">
            <Mail className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-3">Check your inbox</h1>
          <p className="text-gray-600 mb-2 leading-relaxed">
            We sent a verification link to <strong>{authEmail}</strong>. Click it to verify your account and continue.
          </p>
          <p className="text-sm text-gray-400 mb-8">
            Once verified, you'll be brought back here to complete your profile.
          </p>

          <button
            onClick={async () => {
              // Refresh first so we don't act on a stale cached session
              // (e.g. user A's session from another tab).
              await supabase.auth.refreshSession().catch(() => {});
              const { data: { session } } = await supabase.auth.getSession();
              if (session?.user?.email_confirmed_at) {
                await routeConfirmedSession(session.user.email ?? authEmail);
              } else {
                setAuthError('Email not verified yet. Please click the link in your inbox.');
                // show error below button
              }
            }}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors mb-4"
          >
            Already verified? Continue →
          </button>

          {authError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 mb-4">{authError}</p>
          )}

          <button
            onClick={async () => {
              setAuthError('');
              const { error } = await supabase.auth.resend({ type: 'signup', email: authEmail });
              if (error) setAuthError(error.message);
              else setAuthError('Verification email resent!');
            }}
            className="text-sm text-emerald-600 hover:text-emerald-700 underline"
          >
            Resend email
          </button>
        </div>
      </div>
    );
  }

  // ── Auth (Create Account / Sign In) ─────────────────────────────────────────

  if (!isEditMode && screen === 'auth') {
    return (
      // Split-screen shell mirrors src/pages/SignUp.tsx so the /apply
      // (professional) and /signup (recruiter) pages read as a matched
      // pair. Left panel layout/spacing/responsive break match SignUp.tsx
      // exactly. Right panel uses the landing tokens (cream / ink / brand
      // green / Newsreader) so the professional side stays visually
      // anchored to the marketing surface at "/".
      <div className="min-h-screen flex">
        {/* ── Left panel — form (mirrors SignUp.tsx) ── */}
        <div className="w-full min-[860px]:w-[480px] xl:w-[540px] flex flex-col bg-[#f8f8f8] px-10 py-12 shrink-0">
          {/* Top row: brand + Back. SignUp.tsx omits the Back button; we keep
              it because /apply is the only auth route that's typically
              reached from "/" (not from a return visit), so a quick
              escape hatch is useful. */}
          <div className="mb-10 flex items-center justify-between">
            <span className="font-bold text-lg text-gray-900 tracking-tight">SFC Talent</span>
            <button
              type="button"
              onClick={() => { window.location.href = '/'; }}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          </div>

          <div className="flex-1 flex flex-col justify-center max-w-sm w-full mx-auto min-[860px]:mx-0">
            {/* Heading mirrors SignUp.tsx's "Apply as a recruiter" */}
            <h1 className="text-2xl font-semibold text-gray-900 mb-1">Join as a professional</h1>
            <p className="text-sm text-gray-500 mb-6">Stay anonymous until you choose to say yes. Free, no recruiter spam — usually takes 5 minutes.</p>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 mb-8">
            {(['signup', 'signin'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => { setAuthTab(tab); setAuthError(''); }}
                className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                  authTab === tab
                    ? 'border-b-2 border-emerald-600 text-emerald-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'signup' ? 'Create Account' : 'Sign In'}
              </button>
            ))}
          </div>

          {authTab === 'signup' ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setAuthError('');
                if (authPassword !== authConfirmPassword) {
                  setAuthError('Passwords do not match.');
                  return;
                }
                if (authPassword.length < 8) {
                  setAuthError('Password must be at least 8 characters.');
                  return;
                }
                setAuthLoading(true);
                try {
                  const { error } = await supabase.auth.signUp({
                    email: authEmail,
                    password: authPassword,
                    // emailRedirectTo lands the candidate back on /apply
                    // with the Sign In tab pre-selected via ?mode=signin,
                    // so they don't see "Create Account" again after
                    // they just verified. The ?mode=signin lazy-initializer
                    // in this same file's authTab useState picks it up.
                    options: { emailRedirectTo: 'https://sfc-recruiter-portal.vercel.app/apply?mode=signin' },
                  });
                  if (error) {
                    if (error.message.toLowerCase().includes('already registered')) {
                      setAuthError('Account already exists. Sign in instead.');
                      setAuthTab('signin');
                    } else {
                      setAuthError(error.message);
                    }
                    return;
                  }
                  // Don't go to form yet — wait for email verification
                  setScreen('verify-email');
                } finally {
                  setAuthLoading(false);
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm text-gray-700 mb-1.5">Email</label>
                <input
                  type="email"
                  value={authEmail}
                  onChange={e => setAuthEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoFocus
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1.5">Password</label>
                <input
                  type="password"
                  value={authPassword}
                  onChange={e => setAuthPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1.5">Confirm Password</label>
                <input
                  type="password"
                  value={authConfirmPassword}
                  onChange={e => setAuthConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              {authError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">{authError}</p>
              )}
              <button
                type="submit"
                disabled={authLoading}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors"
              >
                {authLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Account
              </button>
            </form>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setAuthError('');
                setAuthLoading(true);
                try {
                  const { error } = await supabase.auth.signInWithPassword({
                    email: authEmail,
                    password: authPassword,
                  });
                  if (error) {
                    setAuthError('Invalid email or password.');
                    return;
                  }
                  // Check if candidate profile exists
                  // Just signed in above; authedFetch attaches the fresh session token.
                  const profileRes = await authedFetch(`/api/candidate-profile?email=${encodeURIComponent(authEmail.toLowerCase().trim())}`);
                  if (profileRes.ok) {
                    window.location.href = '/candidate-dashboard';
                  } else {
                    // Auth succeeded but no profile yet — go to intake form
                    set('email', authEmail);
                    setScreen('form');
                    setStep(1);
                  }
                } finally {
                  setAuthLoading(false);
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm text-gray-700 mb-1.5">Email</label>
                <input
                  type="email"
                  value={authEmail}
                  onChange={e => setAuthEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoFocus
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1.5">Password</label>
                <input
                  type="password"
                  value={authPassword}
                  onChange={e => setAuthPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              {authError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">{authError}</p>
              )}
              <button
                type="submit"
                disabled={authLoading}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors"
              >
                {authLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Sign In
              </button>
              {/* Audience=professional so the recovery email link points
                  at /reset-password (cream/Newsreader), not the recruiter
                  variant. */}
              <p className="text-xs text-center text-gray-500 mt-2">
                <a
                  href="/forgot-password?audience=professional"
                  className="hover:underline"
                >
                  Forgot password?
                </a>
              </p>
            </form>
          )}

          {/* Terms footer mirrors SignUp.tsx */}
          <p className="text-xs text-gray-400 mt-10 leading-relaxed max-w-sm mx-auto min-[860px]:mx-0">
            By continuing, you agree to SFC Talent&rsquo;s{' '}
            <a href="https://strategicfinancecareers.com" className="underline hover:text-gray-600">Terms of Service</a>
            {' '}and{' '}
            <a href="https://strategicfinancecareers.com" className="underline hover:text-gray-600">Privacy Policy</a>.
          </p>
        </div>
        {/* End left panel inner */}
        </div>
        {/* End left panel */}

        {/* ── Right panel — professional-framed value panel (landing tokens) ── */}
        <div
          className="hidden min-[860px]:flex flex-1 items-center justify-center px-16"
          style={{ background: '#f4f1ea', color: '#0e0e0d' }}
        >
          <div className="max-w-md w-full">
            <p
              className="mb-7"
              style={{
                fontFamily: '"Geist Mono Variable", "Geist Mono", ui-monospace, monospace',
                fontSize: '10.5px',
                fontWeight: 500,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: 'rgba(14,14,13,.55)',
              }}
            >
              For professionals
            </p>

            <h2
              className="leading-tight tracking-tight mb-5"
              style={{
                fontFamily: '"Newsreader Variable", "Newsreader", Georgia, serif',
                fontWeight: 500,
                fontSize: 'clamp(28px, 3vw, 38px)',
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
              }}
            >
              Stay{' '}
              <em style={{ fontStyle: 'italic', color: '#008037', fontWeight: 400 }}>anonymous</em>.
              <br />Stay open.
            </h2>

            <p className="mb-9" style={{ color: 'rgba(14,14,13,.65)', fontSize: '15px', lineHeight: 1.6, maxWidth: '38ch' }}>
              Get warm introductions from top firms — without your employer or network ever knowing.
            </p>

            <ul className="space-y-4">
              {[
                'Profile stays hidden until you approve an intro',
                'Free — no recruiter spam, ever',
                '~5-minute form to join',
                'Pass on anything that doesn’t fit, no questions asked',
              ].map(line => (
                <li key={line} className="flex items-start gap-3" style={{ fontSize: '14px', color: '#0e0e0d' }}>
                  <span
                    aria-hidden="true"
                    style={{
                      width: 22, height: 22, flex: 'none',
                      borderRadius: 4,
                      background: 'rgba(0,128,55,.1)',
                      border: '1px solid rgba(0,128,55,.25)',
                      display: 'inline-grid',
                      placeItems: 'center',
                      color: '#008037',
                      marginTop: 1,
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
                      <path d="M5 12l5 5L20 6" />
                    </svg>
                  </span>
                  <span style={{ lineHeight: 1.5 }}>{line}</span>
                </li>
              ))}
            </ul>

            <p
              className="mt-10"
              style={{
                fontFamily: '"Geist Mono Variable", "Geist Mono", ui-monospace, monospace',
                fontSize: '10.5px',
                fontWeight: 500,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'rgba(14,14,13,.45)',
              }}
            >
              SFC Talent — Strategic Finance Careers
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Disqualified ─────────────────────────────────────────────────────────────

  if (screen === 'disqualified') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-6">
            <span className="text-2xl">👋</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Not Quite a Fit Right Now</h2>
          <p className="text-gray-500 mb-6 leading-relaxed">
            Thank you for your interest in SFC Talent. At the moment, our platform focuses on
            finance professionals with at least 2 years of experience and a target compensation
            above $70k. We hope to expand our reach in the future.
          </p>
          <p className="text-gray-500 mb-8 text-sm">We've noted your interest — if our criteria expand, we may be in touch.</p>
          <Button variant="outline" onClick={() => { setScreen('form'); setStep(1); }} className="mr-3">Go Back</Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => { window.location.href = 'https://strategicfinancecareers.com'; }}>
            Visit SFC
          </Button>
        </div>
      </div>
    );
  }

  // ── Success ──────────────────────────────────────────────────────────────────

  if (screen === 'success') {
    if (isEditMode) {
      return (
        <div className="min-h-screen bg-white flex items-center justify-center px-6">
          <div className="max-w-md text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Changes saved</h1>
            <p className="text-sm text-gray-500 mb-8 leading-relaxed">
              Your profile is updated. Recruiters will see the new details next time they view your card.
            </p>
            <Link
              to="/candidate-dashboard"
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors"
            >
              Back to dashboard <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      );
    }
    return <SuccessScreen firstName={form.firstName} />;
  }

  // ── Multi-step Form ──────────────────────────────────────────────────────────

  // Step labels for the clickable tab bar. Order matches the validators.
  // Long form for >=md screens, short form below — never truncates to
  // single letters at narrow widths.
  // Phase B wizard reorder: Resume moves BEFORE Professional Experience
  // so the parse-derived fields (currentRole, location, education,
  // skills, bio) are available on the Experience screen instead of
  // arriving a step later. The parse flow itself is unchanged — the
  // upload still POSTs to /api/parse-resume and seeds form fields;
  // it just happens one step earlier in the user's path.
  const STEP_LABELS_LONG = [
    'Contact Information',
    'Resume Upload',
    'Professional Experience',
    'Future Job Preferences',
    'Work Authorization',
    'Review your profile',
  ];
  const STEP_LABELS_SHORT = [
    'Contact',
    'Resume',
    'Experience',
    'Preferences',
    'Work Auth',
    'Review',
  ];

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {/* "Back to dashboard" on the LEFT in edit mode — visible
              and labeled. When the form has unsaved edits relative to
              the DB baseline (typed-now OR restored from a prior
              session's draft), clicking opens a confirm dialog so an
              accidental click doesn't silently lose work. When clean,
              navigates straight through. Confirmed-leave clears the
              localStorage draft so a stale Cancel-path draft can
              never shadow the real saved data on next entry. */}
          {isEditMode && (
            <button
              type="button"
              onClick={handleEditCancel}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-300 rounded-lg px-3 py-1.5"
            >
              <ChevronLeft className="w-4 h-4" /> Back to dashboard
            </button>
          )}
          <span className="font-bold text-lg text-gray-900 tracking-tight">SFC Talent</span>
          {isEditMode && (
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
              Editing your profile
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 shrink-0">
          {/* Autosave indicator — only shown in edit mode after the
              first autosave fires. Low-emphasis: confirms work isn't
              being lost without competing with the primary CTA. */}
          {isEditMode && draftSavedAt && (
            <span className="text-xs text-gray-400" title={`Autosaved at ${draftSavedAt}`}>
              Draft saved
            </span>
          )}
          <span className="text-sm text-gray-400">Step {step} of {TOTAL_STEPS}</span>
        </div>
      </div>
      {isEditMode && draftRestored && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 text-xs text-amber-900 flex items-center justify-between gap-3">
          <span>
            We restored your in-progress edits from this browser. Click <strong>Save Changes</strong> on the Review tab to apply them, or
            {' '}
            <button
              type="button"
              onClick={() => {
                if (!editCandidateId) return;
                clearDraft(editCandidateId);
                // Re-run the prefill effect by reloading; simplest
                // way to discard the overlay without re-implementing
                // the whole DB→FormState mapping inline here.
                window.location.reload();
              }}
              className="underline font-medium hover:text-amber-700"
            >
              discard them and reload your saved profile
            </button>.
          </span>
          <button
            type="button"
            onClick={() => setDraftRestored(false)}
            aria-label="Dismiss"
            className="text-amber-700 hover:text-amber-900 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Clickable step bar. Earlier steps always navigable; later
          steps unlocked once every previous validator passes.

          Layout:
          - Constrained to the same max-w-5xl container as the form
            body so the bar can't bleed past the edge.
          - SHORT labels only (Contact / Experience / Resume /
            Preferences / Work Auth / Review) — the long label still
            ships as the title= tooltip on hover.
          - At sm+ the 6 steps split evenly via flex-1; no horizontal
            scroll; every label always fully visible.
          - Below sm the row wraps to a second line (flex-wrap) rather
            than clipping. Each button is min-w-0 + truncate as a
            belt-and-suspenders guarantee — no character ever cut. */}
      <div className="border-b border-gray-100 bg-gray-50/50">
        <div className="max-w-5xl mx-auto px-6 md:px-8">
          <div className="flex flex-wrap sm:flex-nowrap items-stretch gap-1 py-2">
            {STEP_LABELS_LONG.map((longLabel, idx) => {
              const shortLabel = STEP_LABELS_SHORT[idx];
              const n = idx + 1;
              const active = n === step;
              const visitable = canVisitStep(n);
              const completed = stepValidators[n] === true && n < step;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => handleStepClick(n)}
                  disabled={!visitable}
                  className={[
                    'flex-1 min-w-0 flex items-center justify-center sm:justify-start gap-2 px-2 sm:px-3 py-2 rounded-md text-xs font-medium transition-colors',
                    active
                      ? 'bg-emerald-600 text-white'
                      : visitable
                        ? 'text-gray-700 hover:bg-gray-100'
                        : 'text-gray-300 cursor-not-allowed',
                  ].join(' ')}
                  aria-current={active ? 'step' : undefined}
                  title={longLabel}
                >
                  <span className={[
                    'inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-semibold shrink-0',
                    active ? 'bg-white text-emerald-700' :
                    completed ? 'bg-emerald-100 text-emerald-700' :
                    'bg-gray-200 text-gray-600',
                  ].join(' ')}>
                    {completed ? '✓' : n}
                  </span>
                  <span className="truncate">{shortLabel}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="h-1 bg-gray-100">
          <div className="h-1 bg-emerald-500 transition-all duration-500"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} />
        </div>
      </div>

      {/* Outer container — widened from max-w-5xl to max-w-7xl in the
          wizard two-column redesign (Phase 1) so the persistent right-
          rail RecruiterPreviewCard has its 360px column without
          squeezing the form. The step bar above keeps its own
          max-w-5xl container (unchanged) — the wider grid only applies
          to the content row.

          Layout at lg+:
            ┌───────────────────────────┬─────────────────┐
            │ form column (min-w-0)     │ <aside>         │
            │ — existing per-step blocks│  sticky top-6   │
            │ — Back / Continue footer  │  RecruiterPreviewCard │
            └───────────────────────────┴─────────────────┘
          Below lg the grid collapses to a single column and the
          preview is reachable via the floating "Preview · N%" pill
          that opens a Sheet (below the closing footer block).

          Inside the form column the per-step blocks and the Back /
          Continue footer are kept VERBATIM — only the wrapping
          container changed. Every load-bearing piece (FormState,
          validators, autosave, edit-prefill, deep-links, the
          disqualification guard, handleEditSave/handleSubmit) lives
          outside this JSX and is untouched.

          STEP 6 EXCEPTION (Phase 1.5): on the Review tab the right
          rail is hidden and the preview moves to center as the
          focal editable element (the editor block lives below it
          inside the form column). The grid collapses to a single
          column on this step so the centered preview isn't pinned
          to the left track. */}
      <div className={
        step === 6
          ? 'max-w-7xl mx-auto px-6 md:px-8 py-10'
          : 'max-w-7xl mx-auto px-6 md:px-8 py-10 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-10'
      }>

        {/* ── Left column: the form ─────────────────────────────────────
            min-w-0 protects the existing inner max-w-xl wrappers from
            being pushed wider by long words in the grid track. */}
        <div className="min-w-0">

        {/* ── Tab 1: Contact Information ───────────────────────────────── */}
        {step === 1 && (
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Contact Information</h2>
            <p className="text-gray-500 mb-8 text-sm">Kept private — only shared with your explicit consent.</p>

            <div className="space-y-5">
              {/* In edit mode firstName/lastName/email are read-only —
                  changing them post-signup has identity and anonymity
                  implications (display_name was derived from currentRole
                  at submit time and recruiters may reference live intros
                  by name/email). A short note points to support. */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>First name {!isEditMode && <span className="text-red-500">*</span>}</Label>
                  <Input value={form.firstName} onChange={e => set('firstName', e.target.value)}
                    placeholder="Jane" className="mt-2"
                    readOnly={isEditMode} disabled={isEditMode} />
                </div>
                <div>
                  <Label>Last name {!isEditMode && <span className="text-red-500">*</span>}</Label>
                  <Input value={form.lastName} onChange={e => set('lastName', e.target.value)}
                    placeholder="Smith" className="mt-2"
                    readOnly={isEditMode} disabled={isEditMode} />
                </div>
              </div>

              <div>
                <Label>Email address {!isEditMode && <span className="text-red-500">*</span>}</Label>
                <Input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                  placeholder="you@example.com" className="mt-2"
                  readOnly={isEditMode} disabled={isEditMode} />
              </div>

              <div>
                <Label>Phone number <span className="text-red-500">*</span></Label>
                <Input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)}
                  placeholder="+1 (555) 000-0000" className="mt-2" />
                <p className="text-xs text-gray-500 mt-1.5">
                  Required — you must be reachable for introduction requests within 48 hours.
                </p>
              </div>

              <div>
                <Label>LinkedIn profile URL <span className="text-red-500">*</span></Label>
                <Input value={form.linkedin} onChange={e => set('linkedin', e.target.value)}
                  placeholder="https://linkedin.com/in/janesmith" className="mt-2" />
                <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1">
                  🔒 Never shown to recruiters — used for internal vetting only.
                </p>
              </div>

              <div className="p-4 border border-gray-200 rounded-xl bg-gray-50">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={form.committed}
                    onChange={e => set('committed', e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-emerald-600" />
                  <div>
                    <p className="text-sm text-gray-700 font-medium leading-snug">
                      I commit to responding to all introduction requests within 48 hours via email or text.
                    </p>
                    <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                      Non-responses will result in your profile being deprioritized. Repeated non-responses may result in removal from the platform.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab 2: Professional Experience ───────────────────────────── */}
        {step === 3 && (
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Professional Experience</h2>
            <p className="text-gray-500 mb-8 text-sm leading-relaxed">
              Tell us about your background and what you've worked on.
            </p>

            <div className="space-y-7">
              <div>
                <Label className="text-sm font-semibold text-gray-800">
                  What best describes your primary background? <span className="text-red-500">*</span>
                </Label>
                <div className="space-y-3 mt-3">
                  {PRIMARY_BACKGROUNDS.map(bg => (
                    <button key={bg.value} type="button"
                      onClick={() => {
                        set('primaryBackground', bg.value);
                        set('detailedExperience', []);
                        set('secondaryBackgrounds', form.secondaryBackgrounds.filter(s => s !== bg.value));
                      }}
                      className={`w-full text-left p-4 border-2 rounded-xl transition-all ${
                        form.primaryBackground === bg.value
                          ? 'border-emerald-500 bg-emerald-50'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}>
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          form.primaryBackground === bg.value ? 'border-emerald-500' : 'border-gray-300'
                        }`}>
                          {form.primaryBackground === bg.value && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
                        </div>
                        <span className={`font-semibold text-sm ${form.primaryBackground === bg.value ? 'text-emerald-900' : 'text-gray-800'}`}>
                          {bg.value}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed ml-6">{bg.subtitle}</p>
                    </button>
                  ))}
                </div>
              </div>

              {form.primaryBackground && (
                <div>
                  <Label className="text-sm font-semibold text-gray-800">
                    Any additional areas of experience?
                    <span className="ml-2 text-xs font-normal text-gray-400">Optional — select all that apply</span>
                  </Label>
                  <div className="space-y-2 mt-3">
                    {secondaryOptions.map(bg => (
                      <label key={bg.value} className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
                        form.secondaryBackgrounds.includes(bg.value)
                          ? 'border-emerald-400 bg-emerald-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}>
                        <input type="checkbox" checked={form.secondaryBackgrounds.includes(bg.value)}
                          onChange={() => {
                            const next = form.secondaryBackgrounds.includes(bg.value)
                              ? form.secondaryBackgrounds.filter(s => s !== bg.value)
                              : [...form.secondaryBackgrounds, bg.value];
                            set('secondaryBackgrounds', next);
                          }} className="mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{bg.value}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{bg.subtitle}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Phase 4: Areas of Expertise — search-and-suggest
                  picker (replaces the Phase 2 pill grid). Seeded from
                  the résumé parse on Tab 2 (résumé tab); candidates
                  refine here. Soft cap 10 is UI guidance only;
                  server hard limit is 25. Taxonomy comes from
                  src/lib/areasOfExpertise.ts. */}
              <div>
                <Label className="text-sm font-semibold text-gray-800">
                  What areas have you developed meaningful experience in throughout your career? <span className="text-red-500">*</span>
                </Label>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  Select up to 10. Browse résumé suggestions or search the catalogue — choose only what feels accurate.
                </p>
                <div className="mt-3">
                  <SearchAndSuggest
                    value={form.areasOfExpertise}
                    onChange={v => set('areasOfExpertise', v)}
                    suggestions={form.suggestedAreas}
                    taxonomy={ALL_AREA_TAGS}
                    allowCustom={true}
                    softCap={AREAS_MAX}
                    searchPlaceholder="Search pricing, treasury, board reporting…"
                    suggestionsButtonLabel="See résumé suggestions"
                    suggestionsTitle="Areas we found in your résumé"
                    suggestionsSubtitle="Tap the ones that fit — we pulled these from your résumé."
                  />
                </div>
              </div>

              {/* Phase 4: Tools & Technical Skills — same component,
                  no cap, tools taxonomy. The "Pro tip" is prominent
                  per spec to steer candidates toward hard tools/systems
                  rather than functional concepts (which belong in
                  Areas above). Writes form.skills — same store as
                  the Review-tab SkillsInput. */}
              <div>
                <Label className="text-sm font-semibold text-gray-800">
                  What tools and technical skills have you used professionally?
                </Label>
                <div className="mt-2 p-3 rounded-lg border border-emerald-200 bg-emerald-50 text-xs text-emerald-900 leading-relaxed">
                  <span className="font-semibold">Pro tip:</span> Focus on hard tools and systems you've used — e.g. NetSuite, SQL, Tableau, HubSpot, Anaplan.
                </div>
                <div className="mt-3">
                  <SearchAndSuggest
                    value={form.skills}
                    onChange={v => set('skills', v)}
                    suggestions={form.suggestedTools}
                    taxonomy={ALL_TOOL_TAGS}
                    allowCustom={true}
                    searchPlaceholder="Search Excel, NetSuite, Looker, Mixpanel…"
                    suggestionsButtonLabel="See résumé suggestions"
                    suggestionsTitle="Tools we found in your résumé"
                    suggestionsSubtitle="Tap the ones that fit — we pulled these from your résumé."
                  />
                </div>
              </div>

              <div>
                <Label>Years of full-time professional experience? <span className="text-red-500">*</span></Label>
                <RadioGroup name="experience" value={form.experience} onChange={v => set('experience', v)}
                  options={[
                    { value: 'under2', label: 'Under 2 years' },
                    { value: '2to5', label: '2 – 5 years' },
                    { value: '5to10', label: '5 – 10 years' },
                    { value: '10plus', label: '10+ years' },
                  ]} />
              </div>

              {/* company_stage_experience — stages the candidate has
                  WORKED at. The legacy "Company-stage experience"
                  picker that used to live here actually wrote to
                  target_company_stages (a PREFERENCE, not experience)
                  — it was mislabeled. That picker has moved to the
                  Preferences step (step 4) and been relabeled "What
                  company stages are you targeting?" The new picker
                  below is the real experience field, writing to the
                  new candidates.company_stage_experience column.
                  Optional, no validator gate. */}
              <div>
                <Label className="text-sm font-semibold text-gray-800">
                  What company stages have you worked at?
                </Label>
                <p className="text-xs text-gray-400 mt-0.5">Select all that apply.</p>
                <ChipGrid
                  options={COMPANY_STAGE_EXPERIENCE_OPTIONS}
                  selected={form.companyStageExperience}
                  onChange={v => set('companyStageExperience', v)}
                />
              </div>

              <div>
                <Label className="text-sm font-semibold text-gray-800">Industries / sectors</Label>
                <p className="text-xs text-gray-400 mt-0.5">Select all that apply</p>
                <CheckboxGrid options={SECTORS} selected={form.industries} onChange={v => set('industries', v)} />
                {form.industries.includes(SECTOR_OTHER) && (
                  <Input
                    value={form.industriesOther}
                    onChange={e => set('industriesOther', e.target.value)}
                    placeholder="Tell us which industry"
                    className="mt-3"
                  />
                )}
              </div>

              <div>
                <Label className="text-sm font-semibold text-gray-800">
                  New areas you'd like to move into
                  <span className="ml-2 text-xs font-normal text-gray-400">Optional — multi-select</span>
                </Label>
                <ChipGrid options={NEW_AREAS} selected={form.newAreas} onChange={v => set('newAreas', v)} />
              </div>
            </div>
          </div>
        )}

        {/* ── Tab 3: Resume Upload (resume only) ──────────────────────── */}
        {step === 2 && isEditMode && (
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Your Resume</h2>
            <p className="text-gray-500 mb-8 text-sm">
              We're staying on a single-resume model for now. Replace coming soon.
            </p>
            {editResumeFilename ? (
              <div className="flex items-start gap-3 p-4 rounded-xl border bg-emerald-50/40 border-emerald-200">
                <FileText className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-emerald-900 truncate" title={editResumeFilename}>{editResumeFilename}</p>
                  <p className="text-xs text-emerald-700 mt-0.5">On file with SFC Talent</p>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-600">
                No resume on file yet. Self-serve upload is coming soon — for now, email it to{' '}
                <a href="mailto:talent@strategicfinancecareers.com" className="text-emerald-700 underline font-medium">talent@strategicfinancecareers.com</a>.
              </div>
            )}
          </div>
        )}
        {step === 2 && !isEditMode && (
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Upload Your Resume</h2>
            <p className="text-gray-500 mb-8 text-sm">
              We'll use AI to extract your profile automatically. PDF format required.
            </p>

            {form.parseWarning && form.resumeParsed && (
              <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl mb-4">
                <span className="text-amber-500 text-base shrink-0 mt-0.5">⚠️</span>
                <p className="text-sm text-amber-800">
                  We couldn't automatically parse your résumé — no worries. You can fill in the details below.
                </p>
              </div>
            )}

            {!form.resumeParsed && (
              <div onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/30 transition-all">
                <input ref={fileInputRef} type="file" accept=".pdf" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleResumeUpload(f); }} />
                {parsing ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                    <p className="text-sm text-gray-500">Parsing your resume with AI…</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <Upload className="w-8 h-8 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Click to upload your resume</p>
                      <p className="text-xs text-gray-400 mt-1">PDF only · Max 10MB</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {form.resumeParsed && (
              <>
                <div className={`flex items-center gap-3 p-4 border rounded-lg ${
                  form.parseWarning ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'
                }`}>
                  {form.parseWarning
                    ? <span className="text-amber-500 shrink-0">⚠️</span>
                    : <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  }
                  <div>
                    <p className={`text-sm font-semibold ${form.parseWarning ? 'text-amber-800' : 'text-emerald-800'}`}>
                      {form.parseWarning ? 'Resume uploaded — fill details on the Review tab' : 'Resume parsed successfully!'}
                    </p>
                    <p className={`text-xs ${form.parseWarning ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {form.resumeFile?.name}
                    </p>
                  </div>
                  <button className="ml-auto text-xs text-gray-400 hover:text-gray-600 underline"
                    onClick={() => {
                      set('resumeParsed', null); set('resumeFile', null);
                      set('resumeBase64', ''); set('parseWarning', false);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}>
                    Change
                  </button>
                </div>

                {/* Reassurance + handoff: the AI extract isn't final.
                    Candidates can edit the parsed fields (role, location,
                    years, education, bio, skills) right here in the
                    block below — no need to wait for Review. The
                    centered Review preview ends up read-only and
                    pencils route any further fixes back to this step. */}
                {!form.parseWarning && (
                  <div className="mt-3 flex items-start gap-2 p-3 border border-[#008037]/25 bg-[#008037]/5 rounded-lg">
                    <Sparkles className="w-4 h-4 text-[#006a2d] shrink-0 mt-0.5" />
                    <p className="text-xs text-[#004a1f] leading-relaxed">
                      We've pulled details from your résumé — review and adjust them below before continuing.
                    </p>
                  </div>
                )}

                {/* ── Editable parsed-details block ─────────────────────
                    Moved here from the old Review-tab editor. Renders
                    whenever a résumé is loaded (success OR warning) so
                    candidates whose parse failed can still type their
                    details in directly. Bound to the same FormState
                    fields the Review tab previously wrote to —
                    form.currentRole / location / yearsExperience /
                    educationLevel / education / bio / skills — so
                    submit + edit-save payloads are unchanged. */}
                <div className="mt-5 space-y-5 border border-gray-200 rounded-xl p-5 bg-gray-50">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Profile details (edit if needed)
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label>Current / most recent role</Label>
                      <Input value={form.currentRole} onChange={e => set('currentRole', e.target.value)}
                        placeholder="e.g. Senior Finance Manager" className="mt-2" />
                    </div>
                    <div>
                      <Label>Location</Label>
                      <Input value={form.location} onChange={e => set('location', e.target.value)}
                        placeholder="e.g. New York, NY" className="mt-2" />
                    </div>
                    <div>
                      <Label>Years of experience</Label>
                      <Input type="number" min={0} max={50} value={form.yearsExperience}
                        onChange={e => set('yearsExperience', e.target.value)}
                        placeholder="e.g. 5" className="mt-2" />
                    </div>
                    <div>
                      <Label>Education level</Label>
                      {/* Same option set as the previous radio group.
                          The empty <option value=""> renders as the
                          placeholder when form.educationLevel is empty
                          OR holds a value that isn't in the known list
                          (e.g. a résumé parser returned an unmapped
                          string) — the <select> falls back to value=""
                          rather than throwing. State key / writes are
                          unchanged: still set('educationLevel', v) →
                          submit payload still sends
                          highest_education_level. */}
                      <select
                        value={
                          ['Bachelors', 'Masters', 'MBA', 'PhD'].includes(form.educationLevel)
                            ? form.educationLevel
                            : ''
                        }
                        onChange={e => set('educationLevel', e.target.value)}
                        className="mt-2 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      >
                        <option value="">Select education level</option>
                        <option value="Bachelors">Bachelor&rsquo;s</option>
                        <option value="Masters">Master&rsquo;s</option>
                        <option value="MBA">MBA</option>
                        <option value="PhD">PhD</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <Label>Education</Label>
                    <p className="text-xs text-gray-400 mt-0.5 mb-2">
                      One row per degree. Add another to include both — both will show on your recruiter card.
                    </p>
                    <EducationRowsEditor
                      value={form.education}
                      onChange={next => set('education', next)}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label>Your anonymous bio <span className="text-xs font-normal text-gray-400">(AI-generated, editable)</span></Label>
                      {form.resumeBase64 && (
                        <button
                          type="button"
                          onClick={handleRegenerateBio}
                          disabled={regenerating}
                          className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium disabled:opacity-50"
                        >
                          {regenerating
                            ? <><Loader2 className="w-3 h-3 animate-spin" /> Regenerating…</>
                            : <><RefreshCw className="w-3 h-3" /> Regenerate</>
                          }
                        </button>
                      )}
                    </div>
                    <textarea
                      value={form.bio}
                      onChange={e => set('bio', e.target.value)}
                      rows={5}
                      placeholder="Your anonymous bio. You can edit it here."
                      className="mt-2 w-full border border-gray-200 rounded-lg px-3 py-3 text-sm text-gray-700 leading-relaxed bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                    />
                  </div>

                  {/* Skills input was removed from this step-2 editor:
                      form.skills is now owned exclusively by the
                      Experience step's search-and-suggest picker
                      (Phase 4 / 1.5). The résumé parse still seeds
                      form.suggestedTools via applyParsed; nothing
                      writes form.skills here. The Experience picker
                      remains the single edit surface so we don't
                      duplicate the input or split state. */}
                </div>
                {/* End editable parsed-details block */}
              </>
            )}
          </div>
        )}

        {/* ── Tab 4: Future Job Preferences ───────────────────────────── */}
        {step === 4 && (
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Future Job Preferences</h2>
            <p className="text-gray-500 mb-8 text-sm">Help us match you with the right opportunities.</p>

            <div className="space-y-6">
              <div>
                <Label>What's your current availability? <span className="text-red-500">*</span></Label>
                {/* 3-up grid for the three availability tiers. Stacks
                    on narrow viewports so each option keeps room for
                    its description copy. */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                  {AVAILABILITY_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => set('jobSearchStatus', opt.value)}
                      className={`p-4 border-2 rounded-xl text-left transition-all ${
                        form.jobSearchStatus === opt.value
                          ? 'border-emerald-500 bg-emerald-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="text-xl mb-2">{opt.emoji}</div>
                      <p className={`text-sm font-semibold leading-tight ${form.jobSearchStatus === opt.value ? 'text-emerald-800' : 'text-gray-800'}`}>
                        {opt.label}
                      </p>
                      <p className="text-xs text-gray-400 mt-1 leading-snug">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label>What is your total cash compensation target? <span className="text-red-500">*</span></Label>
                <RadioGroup name="targetComp" value={form.targetComp} onChange={v => set('targetComp', v)}
                  options={COMP_OPTIONS} />
              </div>

              <div>
                <Label>Work preference <span className="text-red-500">*</span><span className="ml-2 text-xs font-normal text-gray-400">Select all that apply</span></Label>
                <div className="grid grid-cols-3 gap-3 mt-2">
                  {WORK_PREFERENCES.map(wp => {
                    const selected = form.workPreferences.includes(wp.value);
                    return (
                      <button key={wp.value} type="button"
                        onClick={() => {
                          const next = selected
                            ? form.workPreferences.filter(v => v !== wp.value)
                            : [...form.workPreferences, wp.value];
                          set('workPreferences', next);
                        }}
                        className={`flex flex-col items-center gap-1 p-4 border-2 rounded-xl transition-all text-center ${
                          selected
                            ? 'border-emerald-500 bg-emerald-50'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}>
                        <span className="text-xl">{wp.label.split(' ')[0]}</span>
                        <span className={`text-xs font-semibold ${selected ? 'text-emerald-800' : 'text-gray-700'}`}>
                          {wp.label.split(' ').slice(1).join(' ')}
                        </span>
                        <span className="text-xs text-gray-400 leading-tight">{wp.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Target company stages — preference, NOT experience.
                  Moved here from step 3 in the Phase 1.7 dedup pass:
                  it was previously labeled "Company-stage experience"
                  on the Experience step but its storage
                  (target_company_stages) is a preference signal. Now
                  sits alongside the other preference pickers (comp,
                  work mode, cities, target roles) with copy that
                  matches what the column actually represents.
                  form.companyStages → target_company_stages wiring is
                  unchanged. Optional — no validator gate. */}
              <div>
                <Label>What company stages are you targeting?
                  <span className="ml-2 text-xs font-normal text-gray-400">Select all that interest you</span>
                </Label>
                <ChipGrid options={COMPANY_STAGES} selected={form.companyStages}
                  onChange={v => set('companyStages', v)} />
              </div>

              <div>
                <Label>Which cities would you consider?
                  <span className="ml-2 text-xs font-normal text-gray-400">Select all that apply</span>
                </Label>
                <ChipGrid options={PREFERRED_CITIES} selected={form.preferredCities}
                  onChange={v => set('preferredCities', v)} />
                {form.preferredCities.includes(CITY_OTHER) && (
                  <Input
                    value={form.preferredCitiesOther}
                    onChange={e => set('preferredCitiesOther', e.target.value)}
                    placeholder="Tell us which city or region"
                    className="mt-3"
                  />
                )}
              </div>

              <div>
                <Label>Target roles (select all that apply)</Label>
                <ChipGrid options={TARGET_ROLES} selected={form.targetRoles}
                  onChange={v => set('targetRoles', v)} />
              </div>
            </div>
          </div>
        )}

        {/* ── Tab 5: Work Authorization ──────────────────────────────── */}
        {step === 5 && (
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Work Authorization</h2>
            <p className="text-gray-500 mb-8 text-sm leading-relaxed">
              Two standard questions — we collect these as-is and never filter introductions on your answer.
            </p>

            <div className="space-y-6">
              <div>
                <Label className="text-sm font-semibold text-gray-800">
                  Are you legally authorized to work in the United States? <span className="text-red-500">*</span>
                </Label>
                <div className="space-y-2 mt-3">
                  {[
                    { value: true,  label: 'Yes' },
                    { value: false, label: 'No' },
                  ].map(opt => (
                    <label key={String(opt.value)} className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
                      form.workAuthorizedUs === opt.value ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-gray-200 hover:border-gray-300'
                    }`}>
                      <input
                        type="radio"
                        name="workAuthorizedUs"
                        checked={form.workAuthorizedUs === opt.value}
                        onChange={() => set('workAuthorizedUs', opt.value)}
                        className="sr-only"
                      />
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        form.workAuthorizedUs === opt.value ? 'border-emerald-500' : 'border-gray-300'
                      }`}>
                        {form.workAuthorizedUs === opt.value && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
                      </div>
                      <span className="text-sm font-medium">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-sm font-semibold text-gray-800">
                  Will you now or in the future require sponsorship for employment visa status (e.g. H-1B)? <span className="text-red-500">*</span>
                </Label>
                <div className="space-y-2 mt-3">
                  {[
                    { value: true,  label: 'Yes' },
                    { value: false, label: 'No' },
                  ].map(opt => (
                    <label key={String(opt.value)} className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
                      form.requiresSponsorship === opt.value ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-gray-200 hover:border-gray-300'
                    }`}>
                      <input
                        type="radio"
                        name="requiresSponsorship"
                        checked={form.requiresSponsorship === opt.value}
                        onChange={() => set('requiresSponsorship', opt.value)}
                        className="sr-only"
                      />
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        form.requiresSponsorship === opt.value ? 'border-emerald-500' : 'border-gray-300'
                      }`}>
                        {form.requiresSponsorship === opt.value && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
                      </div>
                      <span className="text-sm font-medium">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab 6: Review your profile ─────────────────────────────── */}
        {/* Phase 1.5 layout: the right-rail preview hides (above) and
            the same RecruiterPreviewCard renders centered at the top
            of the form column as the focal element, followed by the
            editable profile-details block. Live-bound to the same
            form state, so edits in the block animate the preview in
            real time. Graceful fade-in via tailwindcss-animate's
            animate-in fade-in (no animation library was added —
            tailwindcss-animate is already a project dependency for
            shadcn). The preview slides to its new home on the very
            first paint of step 6 only; a true cross-step slide would
            require coordinated layout animation, which we degrade to
            a clean fade instead of shipping jank. */}
        {step === 6 && (
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Review your profile</h2>
            <p className="text-gray-500 mb-6 text-sm">
              This is exactly what recruiters will see — your real name, contact info, and résumé stay hidden until you accept an introduction. Tap the pencil on any section to jump back and adjust it.
            </p>

            {/* Centered live preview — the focal editable surface on
                the Review step (Phase 1.6). readOnly mode swaps each
                section header for a pencil button that calls
                onEditSection(stepNumber) to jump back to the step
                that owns the field; the candidate fixes things in
                place and returns to Review. The fade-in plays once
                on mount of step 6 (React remounts the conditional
                subtree on step change) so it never replays on
                keystrokes inside the editors. */}
            <div className="mb-6 animate-in fade-in duration-500">
              <RecruiterPreviewCard
                form={form}
                step={step}
                isEditMode={isEditMode}
                readOnly
                onEditSection={(s) => setStep(s)}
              />
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 mt-6">
              <strong>Note:</strong> Your profile will be reviewed by our team before going live.
              We'll email you at <strong>{form.email}</strong> once it's approved.
            </div>
            {submitError && (
              <p className="text-sm text-red-600 p-3 bg-red-50 rounded-lg mt-4">{submitError}</p>
            )}
          </div>
        )}

        {/* Nav buttons */}
        <div className="flex gap-3 mt-10">
          <Button variant="outline" onClick={handleBack} disabled={submitting} className="flex-1">
            <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </Button>

          {step < TOTAL_STEPS ? (
            <Button onClick={handleNext} disabled={!canProceed}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-40">
              Continue <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={isEditMode ? handleEditSave : handleSubmit} disabled={submitting}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
              {submitting
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {isEditMode ? 'Saving…' : 'Submitting…'}</>
                : isEditMode
                  ? <>Save Changes <CheckCircle2 className="w-4 h-4 ml-1" /></>
                  : <>Submit <ChevronRight className="w-4 h-4 ml-1" /></>
              }
            </Button>
          )}
        </div>
        </div>
        {/* ── End left (form) column ─────────────────────────────────── */}

        {/* ── Right column: persistent live recruiter preview ───────────
            Hidden below lg — that breakpoint is served by the mobile
            Sheet (below). At lg+ the card sticks to the top so it
            stays in view as the candidate scrolls long steps. Reads
            form directly; React rerenders the card on every set() /
            setForm() call so "live binding" is automatic.

            Suppressed entirely on step 6 (Review): on that tab the
            preview moves to center as the focal editable element,
            making a sticky duplicate in the rail redundant. */}
        {step !== 6 && (
          <aside className="hidden lg:block">
            <div className="sticky top-6">
              <RecruiterPreviewCard form={form} step={step} isEditMode={isEditMode} />
            </div>
          </aside>
        )}
      </div>

      {/* ── Mobile preview trigger + Sheet ─────────────────────────────
          Below lg: a floating brand-green pill at bottom-right (above
          the Back/Continue footer) opens a right-side Sheet containing
          the same RecruiterPreviewCard instance. The pill sits at
          z-30 so it stays under any modal overlay (Radix Dialog +
          AlertDialog overlays render at z-50, so they always cover
          this pill — no z-fight with the Cancel confirmation or the
          résumé-suggestions Dialog). The Sheet itself uses the
          default Radix z-50 stack; opening it from a button at z-30
          doesn't conflict because the Sheet portals to the body root.

          The trigger is wired through controlled state so future
          phases can auto-close on step change if we ever want it. */}
      {screen === 'form' && (
        <>
          <button
            type="button"
            onClick={() => setPreviewSheetOpen(true)}
            className="lg:hidden fixed bottom-24 right-4 z-30 inline-flex items-center gap-1.5 bg-[#008037] hover:bg-[#006a2d] text-white text-xs font-semibold rounded-full shadow-lg px-4 py-2.5 transition-colors"
            aria-label="Open recruiter preview"
          >
            <Eye className="w-3.5 h-3.5" />
            Preview · {profileCompletionPct}%
          </button>
          <Sheet open={previewSheetOpen} onOpenChange={setPreviewSheetOpen}>
            <SheetContent side="right" className="w-[90vw] sm:max-w-md overflow-y-auto p-4">
              <div className="mt-6">
                <RecruiterPreviewCard form={form} step={step} isEditMode={isEditMode} />
              </div>
            </SheetContent>
          </Sheet>
        </>
      )}

      {/* Edit-mode Cancel confirmation. Controlled — opens only when
          handleEditCancel finds the form dirty. "Leave without saving"
          clears the localStorage draft (so a Cancel-path draft never
          shadows the real DB row on next entry) and navigates;
          "Keep editing" dismisses. Hidden entirely in create mode. */}
      {isEditMode && (
        <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
              <AlertDialogDescription>
                You have unsaved changes. If you leave now, your changes will be lost and nothing new will be saved.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep editing</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmLeave}
                className="bg-red-600 hover:bg-red-700 focus:ring-red-500"
              >
                Leave without saving
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
