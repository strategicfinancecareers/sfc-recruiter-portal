import { useMemo } from 'react';
import { Eye, MapPin, Briefcase, GraduationCap, Sparkles, ShieldCheck, CheckCircle2 } from 'lucide-react';

// RecruiterPreviewCard — the live "what recruiters will see" surface
// rendered in the wizard's right rail (lg+) and inside a mobile Sheet
// (< lg). Standalone by design: the real AnonymousCandidateCard is the
// recruiter-facing dossier and must keep its current shape. This card
// is a fresh, single-column, ~360px-clean preview that reads the same
// data so substance matches what recruiters see, but its chrome is
// built for the signup context (generous whitespace, brand-green
// primary signal, scannable section headers, no internal split).
//
// Pure render — no state, no effects, no writes. The wizard owns the
// FormState; this card reads it and rerenders on every change.

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
  // Job-pref signal
  jobSearchStatus: string;
  // Auth / gates surfaced for completion %
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  linkedin: string;
  committed: boolean;
  resumeParsed: any | null;
  targetComp: string;
  workPreferences: string[];
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
}

export default function RecruiterPreviewCard({ form, step, isEditMode }: Props) {
  const pct = useMemo(() => profileCompletion(form), [form]);

  // Derived display values — bucket fallback so the experience chip
  // doesn't read "0 yrs" before the parse runs / when the candidate
  // hasn't yet hit the Review tab to set yearsExperience explicitly.
  const yrsFromBucket = BUCKET_TO_YRS[form.experience] ?? 0;
  const experience = Number(form.yearsExperience) || yrsFromBucket;

  const label = form.currentRole || form.primaryBackground || 'Finance Professional';
  const location = form.location || 'Location not set';
  const education = form.educationLevel || form.education || 'Education not set';

  const bio = (form.bio || '').trim();
  const areas = form.areasOfExpertise.filter(Boolean);
  const skills = form.skills.filter(Boolean);
  const secondaries = form.secondaryBackgrounds.filter(Boolean);
  const openToOpps = form.jobSearchStatus === 'Actively Looking';

  // Empty state for early-step previews. Auto-removes once
  // completion crosses 30% (~ end of step 1 + a resume parse).
  // Edit mode never shows the empty state — the prefill always
  // hydrates real values.
  const showEmptyState = !isEditMode && pct <= 30 && step <= 2;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      {/* Header strip */}
      <div className="px-5 pt-5 pb-4 border-b border-gray-100">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-gray-900 tracking-tight">Recruiter Preview</h3>
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#004a1f] bg-[#008037]/8 border border-[#008037]/25 rounded-full px-2 py-0.5">
            <Eye className="w-3 h-3" />
            Visible anonymously
          </span>
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

      {/* Body */}
      <div className="p-5 space-y-5">

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
            {/* Identity */}
            <div>
              <h4 className="text-base font-semibold text-gray-900 leading-tight">{label}</h4>
              <div className="mt-2 space-y-1.5 text-xs text-gray-600">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span>{location}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span>{experience > 0 ? `${experience} yrs experience` : 'Experience not set'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span className="truncate">{education}</span>
                </div>
              </div>

              {openToOpps && (
                <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-[#004a1f] bg-[#008037]/12 border border-[#008037]/30 rounded-full px-2 py-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#008037]" />
                  Open to opportunities
                </span>
              )}
            </div>

            {/* Bio */}
            {bio && (
              <div>
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Profile summary</p>
                <p className="text-xs text-gray-600 leading-relaxed">
                  {bio.length > 240 ? bio.slice(0, 240).trimEnd() + '…' : bio}
                </p>
              </div>
            )}

            {/* Background chips */}
            {(form.primaryBackground || secondaries.length > 0) && (
              <div>
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Background</p>
                <div className="flex flex-wrap gap-1.5">
                  {form.primaryBackground && (
                    <span className="px-2.5 py-1 bg-gray-900 text-white rounded-full text-[11px] font-medium">
                      {form.primaryBackground}
                    </span>
                  )}
                  {secondaries.map(s => (
                    <span key={s} className="px-2.5 py-1 bg-gray-100 border border-gray-200 text-gray-700 rounded-full text-[11px] font-medium">
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
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Areas of Expertise</p>
                <div className="flex flex-wrap gap-1.5">
                  {areas.map(a => (
                    <span key={a} className="px-2.5 py-1 bg-[#008037]/12 border border-[#008037]/30 text-[#004a1f] rounded-full text-[11px] font-semibold">
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Tools / Technical Skills */}
            {skills.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Technical Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {skills.map(s => (
                    <span key={s} className="px-2.5 py-1 bg-[#008037]/5 border border-[#008037]/25 text-[#005a26] rounded-full text-[11px] font-medium">
                      {s}
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
