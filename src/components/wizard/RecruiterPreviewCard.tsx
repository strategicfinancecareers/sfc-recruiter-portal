import { useMemo } from 'react';
import { MapPin, Briefcase, GraduationCap, Sparkles, ShieldCheck, CheckCircle2, Pencil, Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { parseDegrees } from '@/lib/parseEducation';

// RecruiterPreviewCard — the live "what recruiters will see" surface
// rendered in the wizard's right rail (lg+), inside a mobile Sheet
// (< lg), and centered as the focal element on the Review step.
// Standalone by design: the real AnonymousCandidateCard is the
// recruiter-facing dossier and must keep its current shape. This
// card is a fresh, single-column preview that reads the same data so
// substance matches what recruiters see, but its chrome is built for
// the signup context (generous whitespace, brand-green primary
// signal, scannable section headers, no internal split).
//
// Pure render — no state, no effects, no writes. The wizard owns the
// FormState; this card reads it and rerenders on every change.
//
// Read-only mode (Phase 1.6) drives the Review-step layout: each
// editable section grows a small pencil affordance that calls
// onEditSection with the wizard step number that owns the field, so
// the candidate can jump back to fix something without leaving the
// preview-first Review surface.

// Minimum shape we read from FormState. Defined here instead of
// importing FormState from CandidateApply.tsx to keep coupling loose
// and avoid a circular import (the wizard imports this component).
// Every field maps to one already on FormState — see CandidateApply.tsx
// where FormState lives.
export interface PreviewFormShape {
  // Identity / role
  currentRole: string;
  primaryBackground: string;
  secondaryBackgrounds: string[];
  // Snapshot
  location: string;
  yearsExperience: string;          // free-text years from parse
  experience: string;               // bucket — 'under2'|'2to5'|'5to10'|'10plus'
  education: string;
  educationLevel: string;
  // Profile body
  bio: string;
  // Skills surfaces
  areasOfExpertise: string[];
  skills: string[];
  // Industries the candidate has worked in (collected on step 3).
  industries: string[];
  // Stages the candidate has WORKED at (collected on step 3, paired
  // with the new candidates.company_stage_experience column).
  companyStageExperience: string[];
  // Job-pref signals shown on the preview
  jobSearchStatus: string;
  workPreferences: string[];
  // Auth / gates surfaced for completion %
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  linkedin: string;
  committed: boolean;
  resumeParsed: any | null;
  targetComp: string;
  preferredCities: string[];
  targetRoles: string[];
  workAuthorizedUs: boolean | null;
  requiresSponsorship: boolean | null;
}

// Bucket → integer fallback when the parsed yearsExperience hasn't
// been set yet. Matches the candidate-self save mapping in
// CandidateApply.tsx handleEditSave so the preview chip never lies
// about the number the wizard will write.
const BUCKET_TO_YRS: Record<string, number> = {
  under2: 1,
  '2to5': 3,
  '5to10': 7,
  '10plus': 12,
};

// ── profile completion % ────────────────────────────────────────────
//
// Pure derived from form. Weights chosen per inspection §5 so that
// (a) reaching the last step gates ≥ 80%; (b) the last 20% comes
// from richer profile signals that map directly to recruiter card
// content; (c) it can never report 100% on something that wouldn't
// ship (each gated chunk maps to a canProceedStepN validator).
//
//   Contact gates           15%
//   Resume parsed           15%
//   Professional Experience 25%   (primaryBackground + areas[≥1] + experience bucket)
//   Job preferences         15%
//   Work auth               10%
//   Quality (5×4%)          20%   (bio, skills≥3, secondaryBackgrounds≥1,
//                                  targetRoles≥1, preferredCities≥1)
//
// Returns a 0-100 integer.
export function profileCompletion(form: PreviewFormShape): number {
  let pct = 0;

  // Contact gates (15%) — every field independently weighted so the
  // bar moves as the candidate fills the first tab rather than
  // jumping by 15 all at once.
  const contactBits = [
    !!form.firstName,
    !!form.lastName,
    !!form.email,
    form.phone.trim().length >= 7,
    !!form.linkedin.trim(),
    form.committed,
  ];
  pct += (contactBits.filter(Boolean).length / contactBits.length) * 15;

  // Resume parsed (15%) — binary; either we have a parsed resume
  // (create flow) or we don't. Edit mode keeps an existing resume on
  // the row but the preview doesn't know about that here — the
  // wizard's canProceedStep2 covers the edit-mode equivalent, the
  // preview just shows what's in form-state.
  if (form.resumeParsed !== null) pct += 15;

  // Professional Experience (25%) — three bits, even split.
  const expBits = [
    !!form.primaryBackground,
    form.areasOfExpertise.length > 0,
    !!form.experience,
  ];
  pct += (expBits.filter(Boolean).length / expBits.length) * 25;

  // Job preferences (15%).
  const prefBits = [
    !!form.jobSearchStatus,
    !!form.targetComp,
    form.workPreferences.length > 0,
  ];
  pct += (prefBits.filter(Boolean).length / prefBits.length) * 15;

  // Work auth (10%).
  const authBits = [
    form.workAuthorizedUs !== null,
    form.requiresSponsorship !== null,
  ];
  pct += (authBits.filter(Boolean).length / authBits.length) * 10;

  // Quality (20%) — non-gated, recruiter-card-facing depth.
  const qualBits = [
    form.bio.trim().length > 0,
    form.skills.length >= 3,
    form.secondaryBackgrounds.length >= 1,
    form.targetRoles.length >= 1,
    form.preferredCities.length >= 1,
  ];
  pct += (qualBits.filter(Boolean).length / qualBits.length) * 20;

  return Math.max(0, Math.min(100, Math.round(pct)));
}

interface Props {
  form: PreviewFormShape;
  step: number;
  isEditMode: boolean;
  // Read-only mode hides the empty state and surfaces a small pencil
  // on every editable section that wires back through onEditSection
  // to the step that owns that field. Used by the Review step where
  // the preview is the focal editable surface; left undefined on
  // steps 1-5 where the right rail is just a passive mirror.
  readOnly?: boolean;
  onEditSection?: (step: number) => void;
}

// Section header with an optional pencil affordance. Renders the
// pencil only when readOnly + onEditSection are both supplied (i.e.
// on the Review step's centered preview). Step argument is the
// wizard step number the field lives on so the parent's setStep
// jumps cleanly back there.
function SectionLabel({
  children,
  step,
  readOnly,
  onEdit,
  ariaLabel,
}: {
  children: React.ReactNode;
  step: number;
  readOnly?: boolean;
  onEdit?: (step: number) => void;
  ariaLabel: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 mb-3">
      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{children}</p>
      {readOnly && onEdit && (
        <button
          type="button"
          onClick={() => onEdit(step)}
          aria-label={ariaLabel}
          className="inline-flex items-center justify-center w-6 h-6 rounded-md text-gray-400 hover:text-[#006a2d] hover:bg-[#008037]/8 transition-colors"
        >
          <Pencil className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

export default function RecruiterPreviewCard({ form, step, isEditMode, readOnly, onEditSection }: Props) {
  const pct = useMemo(() => profileCompletion(form), [form]);

  // Derived display values — bucket fallback so the experience chip
  // doesn't read "0 yrs" before the parse runs / when the candidate
  // hasn't yet hit the Review tab to set yearsExperience explicitly.
  const yrsFromBucket = BUCKET_TO_YRS[form.experience] ?? 0;
  const experience = Number(form.yearsExperience) || yrsFromBucket;

  const label = form.currentRole || form.primaryBackground || 'Finance Professional';
  const location = form.location || 'Location not set';

  // Education: render one line per degree, each with its own
  // GraduationCap icon. We parse form.education (a single string like
  // "MBA Finance; BS Financial Economics") into structured degree
  // rows via the shared parseDegrees helper; the row labels then
  // render as "Degree, Specialization" (or just "Degree" when no
  // specialization is present). The standalone educationLevel line
  // is gone — the level field duplicated whatever degree the user
  // already typed in education, producing the "MBA shown twice"
  // bug. If parseDegrees returns nothing (no education typed yet),
  // we fall back to "Education not set" so the slot doesn't render
  // empty.
  const degrees = parseDegrees(form.education);

  const bio = (form.bio || '').trim();
  const areas = form.areasOfExpertise.filter(Boolean);
  const skills = form.skills.filter(Boolean);
  const secondaries = form.secondaryBackgrounds.filter(Boolean);
  const industries = (form.industries || []).filter(Boolean);
  const companyStageExp = (form.companyStageExperience || []).filter(Boolean);
  const workPrefs = form.workPreferences.filter(Boolean);

  // Availability indicator — three tiers now that "Passively Looking"
  // is supported on the form. Recruiters still see "open" for both
  // Actively and Passively (the DB bool stays the same), but the
  // preview surfaces the candidate's chosen nuance so they can see
  // exactly how their selection lands. "Not Active" hides the
  // indicator entirely — same as the previous behavior.
  const availability: { tone: 'strong' | 'soft'; label: string } | null =
    form.jobSearchStatus === 'Actively Looking'
      ? { tone: 'strong', label: 'Open to opportunities' }
      : form.jobSearchStatus === 'Passively Looking'
        ? { tone: 'soft', label: 'Open to the right opportunity' }
        : null;

  // Empty state for early-step previews. Auto-removes once
  // completion crosses 30% (~ end of step 1 + a resume parse).
  // Edit mode never shows the empty state — the prefill always
  // hydrates real values. Read-only mode also suppresses it
  // (Review is post-fill by definition).
  const showEmptyState = !isEditMode && !readOnly && pct <= 30 && step <= 2;

  // Step ownership map for the pencil affordances. The role caption,
  // profile summary, and technical skills sections are populated by
  // the résumé parse on step 2 — that's where their editors now
  // live, so clicking the pencil returns the candidate to step 2.
  // Backgrounds + areas + industries live on step 3. Availability +
  // work preference live on step 4.
  const STEP_RESUME = 2;
  const STEP_EXPERIENCE = 3;
  const STEP_PREFERENCES = 4;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      {/* Header strip — Phase 2a de-squish: matches the body's px-6
          and the new vertical rhythm. */}
      <div className="px-6 pt-5 pb-5 border-b border-gray-100">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-gray-900 tracking-tight">Recruiter Preview</h3>
          {/* Reworded privacy affordance: states what the preview is
              ("how recruiters see your profile") with a small info
              button that opens a Popover explaining the anonymity +
              hand-off-on-accept contract in full. Uses the project's
              existing Radix-based Popover primitive — no new
              dependency added. Brand-green tokens for parity with
              the rest of the card. */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="What recruiters see"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-[#004a1f] bg-[#008037]/8 border border-[#008037]/25 rounded-full px-2 py-0.5 hover:bg-[#008037]/12 transition-colors"
              >
                This is how recruiters see your profile
                <Info className="w-3 h-3" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              sideOffset={6}
              className="w-72 text-xs leading-relaxed text-gray-700 border-[#008037]/25"
            >
              <p className="font-semibold text-[#004a1f] mb-1.5">What recruiters see</p>
              <p>
                Recruiters only see this anonymized profile. Your name, email, phone, and résumé stay hidden until you accept an introduction — then the recruiter receives your résumé and contact details.
              </p>
            </PopoverContent>
          </Popover>
        </div>

        <div className="mt-4">
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-xs font-medium text-gray-500">{pct}% complete</span>
            {pct === 100 && (
              <span className="text-[11px] font-semibold text-[#006a2d] inline-flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Ready to submit
              </span>
            )}
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#008037] rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Body — Phase 2a de-squish: more generous padding + larger
          inter-section rhythm so the card breathes like the Linear /
          Stripe references rather than stacking blocks edge-to-edge. */}
      <div className="p-6 space-y-6">

        {showEmptyState ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-full bg-[#008037]/8 border border-[#008037]/20 flex items-center justify-center mx-auto mb-3">
              <Sparkles className="w-5 h-5 text-[#006a2d]" />
            </div>
            <p className="text-sm font-semibold text-gray-800">Your profile is taking shape</p>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed max-w-[240px] mx-auto">
              Keep going — this is the view recruiters will see once you publish.
            </p>
          </div>
        ) : (
          <>
            {/* Identity. The role label + the small caption below are
                the recruiter-facing headline — the caption makes that
                explicit so candidates understand the line they typed
                in "Current / most recent role" is what shows up at
                the top of their listing. */}
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h4 className="text-base font-semibold text-gray-900 leading-tight">{label}</h4>
                  <p className="text-[11px] text-gray-400 mt-0.5">This is the title recruiters will see</p>
                </div>
                {readOnly && onEditSection && (
                  <button
                    type="button"
                    onClick={() => onEditSection(STEP_RESUME)}
                    aria-label="Edit role and headline"
                    className="inline-flex items-center justify-center w-6 h-6 rounded-md text-gray-400 hover:text-[#006a2d] hover:bg-[#008037]/8 transition-colors shrink-0"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                )}
              </div>

              <div className="mt-3 space-y-2 text-xs text-gray-600">
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                  <span>{location}</span>
                </div>
                <div className="flex items-start gap-2">
                  <Briefcase className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                  <span>{experience > 0 ? `${experience} yrs experience` : 'Experience not set'}</span>
                </div>
                {degrees.length === 0 ? (
                  <div className="flex items-start gap-2">
                    <GraduationCap className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                    <span className="text-gray-400">Education not set</span>
                  </div>
                ) : (
                  // One line per degree, each with its own GraduationCap.
                  // Renders "Degree, Specialization" when both halves
                  // are present, "Degree" alone otherwise. break-words
                  // protects long specialization strings from
                  // overflowing the narrow right rail.
                  degrees.map((d, i) => (
                    <div key={`${d.degree}|${d.specialization}|${i}`} className="flex items-start gap-2">
                      <GraduationCap className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                      <p className="break-words">
                        {d.specialization
                          ? <>{d.degree}, <span className="text-gray-500">{d.specialization}</span></>
                          : d.degree}
                      </p>
                    </div>
                  ))
                )}
              </div>

              {availability && (
                <div className="mt-3 flex items-center gap-2">
                  {availability.tone === 'strong' ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#004a1f] bg-[#008037]/12 border border-[#008037]/30 rounded-full px-2 py-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#008037]" />
                      {availability.label}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#005a26] bg-[#008037]/5 border border-[#008037]/20 rounded-full px-2 py-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#008037]/50" />
                      {availability.label}
                    </span>
                  )}
                  {readOnly && onEditSection && (
                    <button
                      type="button"
                      onClick={() => onEditSection(STEP_PREFERENCES)}
                      aria-label="Edit availability"
                      className="inline-flex items-center justify-center w-5 h-5 rounded-md text-gray-400 hover:text-[#006a2d] hover:bg-[#008037]/8 transition-colors"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Profile summary — FULL bio, no truncation. Long bios
                flow onto multiple lines; the centered Review step has
                the width to hold them, and the narrow right rail
                wraps. whitespace-pre-line preserves any double-newline
                paragraph breaks the candidate typed. */}
            {bio && (
              <div>
                <SectionLabel
                  step={STEP_RESUME}
                  readOnly={readOnly}
                  onEdit={onEditSection}
                  ariaLabel="Edit profile summary"
                >
                  Profile summary
                </SectionLabel>
                <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line break-words">
                  {bio}
                </p>
              </div>
            )}

            {/* Primary Background — the headline experience category.
                Solid gray-900 chip mirrors how the wizard radio renders
                the candidate's primary selection. */}
            {form.primaryBackground && (
              <div>
                <SectionLabel
                  step={STEP_EXPERIENCE}
                  readOnly={readOnly}
                  onEdit={onEditSection}
                  ariaLabel="Edit primary background"
                >
                  Primary Background
                </SectionLabel>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1.5 bg-gray-900 text-white rounded-full text-[11px] font-medium">
                    {form.primaryBackground}
                  </span>
                </div>
              </div>
            )}

            {/* Additional Experience — secondary backgrounds rendered
                as neutral chips so they read as "also has done" rather
                than competing visually with the primary signal. */}
            {secondaries.length > 0 && (
              <div>
                <SectionLabel
                  step={STEP_EXPERIENCE}
                  readOnly={readOnly}
                  onEdit={onEditSection}
                  ariaLabel="Edit additional experience"
                >
                  Additional Experience
                </SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {secondaries.map(s => (
                    <span key={s} className="px-3 py-1.5 bg-gray-100 border border-gray-200 text-gray-700 rounded-full text-[11px] font-medium">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Areas of Expertise — the primary recruiter-matching signal.
                Brand-green is reserved for this section: it's what makes
                the candidate show up in a recruiter's filtered search. */}
            {areas.length > 0 && (
              <div>
                <SectionLabel
                  step={STEP_EXPERIENCE}
                  readOnly={readOnly}
                  onEdit={onEditSection}
                  ariaLabel="Edit areas of expertise"
                >
                  Areas of Expertise
                </SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {areas.map(a => (
                    <span key={a} className="px-3 py-1.5 bg-[#008037]/12 border border-[#008037]/30 text-[#004a1f] rounded-full text-[11px] font-semibold">
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Industries — sectors the candidate has worked in.
                Collected on step 3 alongside the areas/background
                pickers. Neutral chip treatment because it's recruiter-
                filter context rather than a matching headline. */}
            {industries.length > 0 && (
              <div>
                <SectionLabel
                  step={STEP_EXPERIENCE}
                  readOnly={readOnly}
                  onEdit={onEditSection}
                  ariaLabel="Edit industries"
                >
                  Industries
                </SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {industries.map(i => (
                    <span key={i} className="px-3 py-1.5 bg-gray-100 border border-gray-200 text-gray-700 rounded-full text-[11px] font-medium">
                      {i}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Company Stage Experience — stages the candidate has
                worked at. Optional field (no validator gate).
                Neutral chips like Industries; pencil routes back to
                step 3 where the picker lives. */}
            {companyStageExp.length > 0 && (
              <div>
                <SectionLabel
                  step={STEP_EXPERIENCE}
                  readOnly={readOnly}
                  onEdit={onEditSection}
                  ariaLabel="Edit company stage experience"
                >
                  Company Stage Experience
                </SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {companyStageExp.map(s => (
                    <span key={s} className="px-3 py-1.5 bg-gray-100 border border-gray-200 text-gray-700 rounded-full text-[11px] font-medium">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Tools / Technical Skills. Edited on the résumé step
                (post-parse) in the new layout, so the pencil routes
                back to step 2 — same as the role/headline/summary. */}
            {skills.length > 0 && (
              <div>
                <SectionLabel
                  step={STEP_RESUME}
                  readOnly={readOnly}
                  onEdit={onEditSection}
                  ariaLabel="Edit technical skills"
                >
                  Technical Skills
                </SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {skills.map(s => (
                    <span key={s} className="px-3 py-1.5 bg-[#008037]/5 border border-[#008037]/25 text-[#005a26] rounded-full text-[11px] font-medium">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Work Preference — Remote / Hybrid / Onsite chips from
                form.workPreferences (collected on the Preferences
                step). Neutral chip treatment because the preference
                set is recruiter-filter context, not a primary
                matching signal. Only renders when at least one is
                picked. */}
            {workPrefs.length > 0 && (
              <div>
                <SectionLabel
                  step={STEP_PREFERENCES}
                  readOnly={readOnly}
                  onEdit={onEditSection}
                  ariaLabel="Edit work preference"
                >
                  Work Preference
                </SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {workPrefs.map(w => (
                    <span key={w} className="px-3 py-1.5 bg-gray-50 border border-gray-200 text-gray-700 rounded-full text-[11px] font-medium">
                      {w}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Reassurance — shown in both empty and filled states so the
            anonymity contract is always visible while the candidate
            builds their profile. */}
        <div className="flex items-start gap-2 pt-1">
          <ShieldCheck className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-gray-500 leading-relaxed">
            Your name, company, and contact details are never shared without your permission.
          </p>
        </div>
      </div>
    </div>
  );
}
