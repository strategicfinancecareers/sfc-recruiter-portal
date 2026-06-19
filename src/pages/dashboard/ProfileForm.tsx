import { useMemo, useState } from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authedFetch } from '@/integrations/supabase/authedFetch';
import { ALL_AREA_TAGS, AREAS_MAX } from '@/lib/areasOfExpertise';
import { ALL_TOOL_TAGS } from '@/lib/toolsAndTechnicalSkills';
// Reuse the wizard's field components + option constants verbatim
// (exported from CandidateApply.tsx — export keyword only, no logic
// change there). This Profile page is a flat single-scroll surface
// over the SAME field bindings the wizard uses in edit mode; the
// only thing that differs is the container: explicit Save instead of
// the stepped Next/Back, and no resume upload / parse / live preview.
import {
  RadioGroup,
  ChipGrid,
  CheckboxGrid,
  EducationRowsEditor,
  SearchAndSuggest,
  PRIMARY_BACKGROUNDS,
  SECTORS,
  SECTOR_OTHER,
  TARGET_ROLES,
  COMPANY_STAGES,
  COMPANY_STAGE_EXPERIENCE_OPTIONS,
  PREFERRED_CITIES,
  CITY_OTHER,
  COMP_OPTIONS,
  SFC_PROGRAMS,
  SFC_COACHES,
  AVAILABILITY_OPTIONS,
  WORK_PREFERENCES,
} from '@/pages/CandidateApply';

// ─── ProfileForm ──────────────────────────────────────────────────────────────
//
// The candidate's editable profile, rendered as a single stacked
// scrolling page on the dashboard's "Profile" tab. Replaces the old
// read-only summary + "Edit Profile" deep-link to /apply?edit=1.
//
// Save model: EXPLICIT. The candidate edits freely (local state); a
// "Save changes" button commits everything via the three PATCH
// endpoints the wizard's handleEditSave uses:
//   1. PATCH /api/candidate-profile          — scalar / array columns
//   2. PATCH /api/update-candidate-areas      — areas_of_expertise (own endpoint)
//   3. PATCH /api/update-candidate-skills-list — candidate_skills join
// No autosave, no debounce. The button is disabled until the form is
// dirty (current state !== the snapshot hydrated from the DB).
//
// NOT here (by design): resume upload / parse / "change resume" UI
// (lives on the separate Resume tab), and the live RecruiterPreviewCard
// (lives on the Recruiter View tab). The parsed-detail FIELDS (role,
// location, years, education, bio) ARE here — they're profile data,
// not resume management.
//
// No FormState import from the wizard — this owns a local subset shape
// (ProfileFormState) so the two surfaces stay decoupled. Every field
// here maps to the exact same DB column the wizard writes.

interface ProfileFormState {
  // Contact (firstName / lastName / email read-only; phone + linkedin editable)
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  linkedin: string;
  // Profile details
  currentRole: string;
  location: string;
  yearsExperience: string;
  education: string;
  educationLevel: string;
  bio: string;
  // Experience
  primaryBackground: string;
  secondaryBackgrounds: string[];
  areasOfExpertise: string[];
  skills: string[];
  companyStageExperience: string[];
  industries: string[];
  industriesOther: string;
  // Preferences
  jobSearchStatus: string;
  targetComp: string;
  workPreferences: string[];
  preferredCities: string[];
  preferredCitiesOther: string;
  companyStages: string[];
  targetRoles: string[];
  // Work auth
  workAuthorizedUs: boolean | null;
  requiresSponsorship: boolean | null;
  // SFC
  isSfcAlum: boolean | null;
  sfcProgram: string;
  sfcCoach: string;
  // Preserved-but-not-edited: keep new_areas as hydrated so the PATCH
  // re-writes its existing value rather than clobbering it (the form
  // doesn't surface this field, but the column is in the PATCH
  // whitelist — sending the prefilled value keeps it non-destructive).
  newAreas: string[];
}

// Hydrate ProfileFormState from the candidate-profile GET row. Mirrors
// the wizard's edit-mode dbForm mapping (CandidateApply.tsx) field for
// field — same fallbacks, same availability-string parse, same name
// split. The candidate row + flat skills[] are already loaded by the
// dashboard, so no extra fetch is needed.
function hydrate(candidate: any, skills: string[]): ProfileFormState {
  const fullName: string = candidate.name || '';
  const splitIdx = fullName.indexOf(' ');
  const firstName = splitIdx === -1 ? fullName : fullName.slice(0, splitIdx);
  const lastName = splitIdx === -1 ? '' : fullName.slice(splitIdx + 1);

  // Bio = first paragraph of profile_description (strip the appended
  // "Availability: …" note the same way the wizard + card do).
  const bio = (candidate.profile_description || '').split('\n\n')[0].trim();

  // years int → string for the number input.
  const yrs = typeof candidate.experience === 'number'
    ? candidate.experience
    : Number(candidate.experience) || 0;

  // Availability: prefer the lossless string in profile_description,
  // fall back to the open_to_opportunities boolean. Same logic as the
  // wizard's edit-prefill.
  const availabilityNoteMatch = String(candidate.profile_description || '')
    .match(/(?:Availability|Job search status):\s*([^.\n]+?)\./);
  const noteValue = availabilityNoteMatch ? availabilityNoteMatch[1].trim() : '';
  const KNOWN_AVAILABILITY = new Set(['Actively Looking', 'Passively Looking', 'Not Active']);
  const jobSearchStatus =
    noteValue && KNOWN_AVAILABILITY.has(noteValue)
      ? noteValue
      : candidate.open_to_opportunities === true
        ? 'Actively Looking'
        : candidate.open_to_opportunities === false
          ? 'Not Active'
          : '';

  return {
    firstName,
    lastName,
    email: candidate.email || '',
    phone: candidate.phone || '',
    linkedin: candidate.linkedin_url || '',

    currentRole: candidate.label || '',
    location: candidate.location || '',
    yearsExperience: String(yrs),
    education: candidate.education || '',
    educationLevel: candidate.highest_education_level || '',
    bio,

    primaryBackground: candidate.primary_background || '',
    secondaryBackgrounds: Array.isArray(candidate.secondary_backgrounds) ? candidate.secondary_backgrounds : [],
    // areas_of_expertise first, falling back to detailed_experience —
    // same one-time mirror the wizard uses for pre-Phase-2 candidates.
    areasOfExpertise: Array.isArray(candidate.areas_of_expertise) && candidate.areas_of_expertise.length > 0
      ? candidate.areas_of_expertise
      : (Array.isArray(candidate.detailed_experience) ? candidate.detailed_experience : []),
    skills: Array.isArray(skills) ? skills : [],
    companyStageExperience: Array.isArray(candidate.company_stage_experience) ? candidate.company_stage_experience : [],
    industries: Array.isArray(candidate.industries) ? candidate.industries : [],
    industriesOther: candidate.industries_other || '',

    jobSearchStatus,
    targetComp: candidate.target_salary || '',
    workPreferences: Array.isArray(candidate.work_preferences)
      ? candidate.work_preferences
      : (candidate.work_preference ? [candidate.work_preference] : []),
    preferredCities: Array.isArray(candidate.preferred_cities) ? candidate.preferred_cities : [],
    preferredCitiesOther: candidate.preferred_cities_other || '',
    companyStages: Array.isArray(candidate.target_company_stages) ? candidate.target_company_stages : [],
    targetRoles: Array.isArray(candidate.target_roles) ? candidate.target_roles : [],

    workAuthorizedUs: typeof candidate.work_authorized_us === 'boolean' ? candidate.work_authorized_us : null,
    requiresSponsorship: typeof candidate.requires_sponsorship === 'boolean' ? candidate.requires_sponsorship : null,

    isSfcAlum: typeof candidate.is_sfc_alum === 'boolean' ? candidate.is_sfc_alum : null,
    sfcProgram: candidate.sfc_program || '',
    sfcCoach: candidate.sfc_coach || '',

    newAreas: Array.isArray(candidate.new_areas) ? candidate.new_areas : [],
  };
}

// Section header — flat-page equivalent of the wizard's
// "text-base font-semibold" labels. No icons (consistent with the
// no-icon base). Optional description renders smaller / lighter.
function SectionTitle({ children, description }: { children: React.ReactNode; description?: string }) {
  return (
    <div className="mb-1">
      <h3 className="text-base font-semibold text-gray-900 leading-snug">{children}</h3>
      {description && <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{description}</p>}
    </div>
  );
}

// A labelled question block inside a section — matches the wizard's
// inline <Label>…</Label> + control rhythm.
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-base font-semibold text-gray-900 leading-snug">
        {label}
        {hint && <span className="ml-2 text-sm font-normal text-gray-500">{hint}</span>}
      </Label>
      {children}
    </div>
  );
}

type SaveStatus = 'idle' | 'saving' | 'error';

export default function ProfileForm({
  candidate,
  skills,
  onSaved,
}: {
  candidate: any;
  skills: string[];
  // Called after a fully successful save so the dashboard can re-GET
  // the canonical row (keeps the rest of the dashboard in sync).
  onSaved: () => Promise<void> | void;
}) {
  // Snapshot hydrated once on mount. We intentionally do NOT re-hydrate
  // when the candidate prop changes mid-edit (that would clobber the
  // candidate's in-progress edits). A fresh mount (tab switch away and
  // back) re-hydrates from the latest GET.
  const initial = useMemo(() => hydrate(candidate, skills), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [form, setForm] = useState<ProfileFormState>(initial);
  const [baseline, setBaseline] = useState<ProfileFormState>(initial);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const set = <K extends keyof ProfileFormState>(key: K, value: ProfileFormState[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  // Dirty = current state differs from the last-saved baseline. Plain
  // JSON compare — every field is a string / string[] / boolean|null,
  // all stable under JSON.stringify.
  const dirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(baseline),
    [form, baseline],
  );

  // Secondary background options = every primary-background category
  // except the chosen primary (same derivation as the wizard).
  const secondaryOptions = PRIMARY_BACKGROUNDS.filter(b => b.value !== form.primaryBackground);

  const handleSave = async () => {
    if (!dirty || status === 'saving') return;
    setStatus('saving');
    setErrorMsg('');
    try {
      // Re-append the availability note to profile_description so the
      // string keeps the shape the card + edit-prefill expect. Same as
      // the wizard's handleEditSave.
      const availabilityNote = form.jobSearchStatus ? `Availability: ${form.jobSearchStatus}.` : '';
      const profileDescription = [form.bio, availabilityNote].filter(Boolean).join('\n\n');

      // Years int — the Profile page captures years directly as a
      // number input, so no bucket round-trip is needed.
      const experienceInt = Number(form.yearsExperience) || 0;

      // ── PATCH 1: scalar / array columns (candidate-profile) ──────
      const payload: Record<string, unknown> = {
        id: candidate.id,
        phone: form.phone || null,
        linkedin_url: form.linkedin || null,
        primary_background: form.primaryBackground || null,
        secondary_backgrounds: form.secondaryBackgrounds,
        // Dual-write detailed_experience with the same array as areas
        // (legacy readers still consume it — mirrors the wizard).
        detailed_experience: form.areasOfExpertise,
        experience: experienceInt,
        industries: form.industries,
        industries_other: form.industriesOther || null,
        target_company_stages: form.companyStages,
        company_stage_experience: form.companyStageExperience,
        // Preserved value (form doesn't edit it) — re-write keeps it
        // non-destructive.
        new_areas: form.newAreas,
        label: form.currentRole || null,
        location: form.location || null,
        education: form.education || null,
        highest_education_level: form.educationLevel || null,
        profile_description: profileDescription || null,
        target_salary: form.targetComp || null,
        open_to_opportunities:
          form.jobSearchStatus === 'Actively Looking' ||
          form.jobSearchStatus === 'Passively Looking',
        work_preferences: form.workPreferences,
        work_preference: form.workPreferences[0] || null,
        preferred_cities: form.preferredCities,
        preferred_cities_other: form.preferredCitiesOther || null,
        target_roles: form.targetRoles,
        work_authorized_us: form.workAuthorizedUs,
        requires_sponsorship: form.requiresSponsorship,
        is_sfc_alum: form.isSfcAlum,
        sfc_program: form.sfcProgram || null,
        sfc_coach: form.sfcCoach || null,
      };
      const res = await authedFetch('/api/candidate-profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setErrorMsg('Could not save your profile — please try again.');
        setStatus('error');
        return;
      }

      // ── PATCH 2: areas_of_expertise (own endpoint) ──────────────
      const areasRes = await authedFetch('/api/update-candidate-areas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId: candidate.id, areasOfExpertise: form.areasOfExpertise }),
      });
      if (!areasRes.ok) {
        setErrorMsg('Your profile saved, but Areas of Expertise failed — please save again.');
        setStatus('error');
        return;
      }

      // ── PATCH 3: skills (candidate_skills join) ─────────────────
      const skillsRes = await authedFetch('/api/update-candidate-skills-list', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: candidate.id, skills: form.skills }),
      });
      if (!skillsRes.ok) {
        setErrorMsg('Your profile saved, but your skills failed — please save again.');
        setStatus('error');
        return;
      }

      // All three landed — re-baseline so the button disables again,
      // then let the dashboard re-fetch the canonical row.
      setBaseline(form);
      setStatus('idle');
      await onSaved();
    } catch (err) {
      console.error('[ProfileForm] save failed:', err);
      setErrorMsg('Could not save — please try again.');
      setStatus('error');
    }
  };

  return (
    <div className="bg-white border rounded-2xl p-6 md:p-8" style={{ borderColor: 'rgba(14,14,13,.08)' }}>
      <div className="max-w-2xl">
        {/* Page heading */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Your Profile</h2>
          <p className="text-sm text-gray-500 mt-1">
            Edit your details below, then click <span className="font-medium">Save changes</span>. Your résumé is managed on the Résumé tab.
          </p>
        </div>

        <div className="space-y-10">

          {/* ── Contact ─────────────────────────────────────────────── */}
          <section className="space-y-5">
            <SectionTitle description="Your name and email are locked — contact support to change them.">Contact</SectionTitle>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>First name</Label>
                <Input value={form.firstName} readOnly disabled className="mt-2" />
              </div>
              <div>
                <Label>Last name</Label>
                <Input value={form.lastName} readOnly disabled className="mt-2" />
              </div>
            </div>
            <div>
              <Label>Email</Label>
              <Input value={form.email} readOnly disabled className="mt-2" />
            </div>
            <div>
              <Label>Phone number</Label>
              <Input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)}
                placeholder="+1 (555) 000-0000" className="mt-2" />
            </div>
            <div>
              <Label>LinkedIn profile URL</Label>
              <Input value={form.linkedin} onChange={e => set('linkedin', e.target.value)}
                placeholder="https://linkedin.com/in/janesmith" className="mt-2" />
              <p className="text-xs text-gray-500 mt-1.5">🔒 Never shown to recruiters — used for internal vetting only.</p>
            </div>
          </section>

          <hr className="border-gray-100" />

          {/* ── Profile details ─────────────────────────────────────── */}
          <section className="space-y-5">
            <SectionTitle>Profile details</SectionTitle>
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
                <select
                  value={['Bachelors', 'Masters', 'MBA', 'PhD'].includes(form.educationLevel) ? form.educationLevel : ''}
                  onChange={e => set('educationLevel', e.target.value)}
                  className="mt-2 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#008037]/40 focus:border-[#008037]"
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
              <p className="text-xs text-gray-400 mt-0.5 mb-2">One row per degree. Add another to include both — both will show on your recruiter card.</p>
              <EducationRowsEditor value={form.education} onChange={next => set('education', next)} />
            </div>
            <div>
              <Label>Your anonymous bio</Label>
              <textarea
                value={form.bio}
                onChange={e => set('bio', e.target.value)}
                rows={5}
                placeholder="Your anonymous bio. You can edit it here."
                className="mt-2 w-full border border-gray-200 rounded-lg px-3 py-3 text-sm text-gray-700 leading-relaxed bg-white focus:outline-none focus:ring-2 focus:ring-[#008037]/40 focus:border-[#008037] resize-none"
              />
            </div>
          </section>

          <hr className="border-gray-100" />

          {/* ── Experience ──────────────────────────────────────────── */}
          <section className="space-y-7">
            <SectionTitle>Experience</SectionTitle>

            <Field label="What best describes your primary background?">
              <div className="space-y-3 mt-3">
                {PRIMARY_BACKGROUNDS.map(bg => (
                  <button key={bg.value} type="button"
                    onClick={() => {
                      set('primaryBackground', bg.value);
                      set('secondaryBackgrounds', form.secondaryBackgrounds.filter(s => s !== bg.value));
                    }}
                    className={`w-full text-left p-4 border-2 rounded-xl transition-all ${
                      form.primaryBackground === bg.value
                        ? 'border-[#008037] bg-[#008037]/5'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        form.primaryBackground === bg.value ? 'border-[#008037]' : 'border-gray-300'
                      }`}>
                        {form.primaryBackground === bg.value && <div className="w-2 h-2 rounded-full bg-[#008037]" />}
                      </div>
                      <span className={`font-semibold text-sm ${form.primaryBackground === bg.value ? 'text-[#004a1f]' : 'text-gray-800'}`}>
                        {bg.value}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed ml-6">{bg.subtitle}</p>
                  </button>
                ))}
              </div>
            </Field>

            {form.primaryBackground && (
              <Field label="Any additional areas of experience?" hint="Optional — select all that apply">
                <div className="space-y-2 mt-3">
                  {secondaryOptions.map(bg => (
                    <label key={bg.value} className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
                      form.secondaryBackgrounds.includes(bg.value)
                        ? 'border-[#008037] bg-[#008037]/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}>
                      <input type="checkbox" checked={form.secondaryBackgrounds.includes(bg.value)}
                        onChange={() => {
                          const next = form.secondaryBackgrounds.includes(bg.value)
                            ? form.secondaryBackgrounds.filter(s => s !== bg.value)
                            : [...form.secondaryBackgrounds, bg.value];
                          set('secondaryBackgrounds', next);
                        }} className="mt-0.5 accent-[#008037]" />
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{bg.value}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{bg.subtitle}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </Field>
            )}

            <Field label="What areas have you developed meaningful experience in?">
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">Select up to 10 — choose only what feels accurate.</p>
              <div className="mt-3">
                <SearchAndSuggest
                  value={form.areasOfExpertise}
                  onChange={v => set('areasOfExpertise', v)}
                  suggestions={[]}
                  taxonomy={ALL_AREA_TAGS}
                  allowCustom={true}
                  softCap={AREAS_MAX}
                  searchPlaceholder="Search pricing, treasury, board reporting…"
                  suggestionsButtonLabel="See résumé suggestions"
                  suggestionsTitle="Areas we found in your résumé"
                  suggestionsSubtitle="Tap the ones that fit."
                />
              </div>
            </Field>

            <Field label="What tools and technical skills have you used professionally?">
              <div className="mt-2 p-3 rounded-lg border border-[#008037]/25 bg-[#008037]/5 text-xs text-[#004a1f] leading-relaxed">
                <span className="font-semibold">Pro tip:</span> Focus on hard tools and systems you've used — e.g. NetSuite, SQL, Tableau, HubSpot, Anaplan.
              </div>
              <div className="mt-3">
                <SearchAndSuggest
                  value={form.skills}
                  onChange={v => set('skills', v)}
                  suggestions={[]}
                  taxonomy={ALL_TOOL_TAGS}
                  allowCustom={true}
                  searchPlaceholder="Search Excel, NetSuite, Looker, Mixpanel…"
                  suggestionsButtonLabel="See résumé suggestions"
                  suggestionsTitle="Tools we found in your résumé"
                  suggestionsSubtitle="Tap the ones that fit."
                />
              </div>
            </Field>

            <Field label="What company stages have you worked at?">
              <p className="text-xs text-gray-400 mt-0.5">Select all that apply.</p>
              <ChipGrid options={COMPANY_STAGE_EXPERIENCE_OPTIONS} selected={form.companyStageExperience}
                onChange={v => set('companyStageExperience', v)} />
            </Field>

            <Field label="Industries / sectors">
              <p className="text-xs text-gray-400 mt-0.5">Select all that apply.</p>
              <CheckboxGrid options={SECTORS} selected={form.industries} onChange={v => set('industries', v)} />
              {form.industries.includes(SECTOR_OTHER) && (
                <Input value={form.industriesOther} onChange={e => set('industriesOther', e.target.value)}
                  placeholder="Tell us which industry" className="mt-3" />
              )}
            </Field>
          </section>

          <hr className="border-gray-100" />

          {/* ── Preferences ─────────────────────────────────────────── */}
          <section className="space-y-6">
            <SectionTitle>Preferences</SectionTitle>

            <Field label="What's your current availability?">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                {AVAILABILITY_OPTIONS.map(opt => (
                  <button key={opt.value} type="button" onClick={() => set('jobSearchStatus', opt.value)}
                    className={`p-4 border rounded-xl text-left transition-all ${
                      form.jobSearchStatus === opt.value
                        ? 'border-[#008037] bg-[#008037]/5'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}>
                    <div className="text-xl mb-2">{opt.emoji}</div>
                    <p className={`text-sm font-semibold leading-tight ${form.jobSearchStatus === opt.value ? 'text-[#004a1f]' : 'text-gray-800'}`}>{opt.label}</p>
                    <p className="text-xs text-gray-400 mt-1 leading-snug">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </Field>

            <Field label="What is your total cash compensation target?">
              <RadioGroup name="targetComp" value={form.targetComp} onChange={v => set('targetComp', v)} options={COMP_OPTIONS} />
            </Field>

            <Field label="Work preference" hint="Select all that apply">
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
                      className={`flex flex-col items-center gap-1 p-4 border rounded-xl transition-all text-center ${
                        selected ? 'border-[#008037] bg-[#008037]/5' : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}>
                      <span className="text-xl">{wp.label.split(' ')[0]}</span>
                      <span className={`text-xs font-semibold ${selected ? 'text-[#004a1f]' : 'text-gray-700'}`}>
                        {wp.label.split(' ').slice(1).join(' ')}
                      </span>
                      <span className="text-xs text-gray-400 leading-tight">{wp.desc}</span>
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="Which cities would you consider?" hint="Select all that apply">
              <ChipGrid options={PREFERRED_CITIES} selected={form.preferredCities} onChange={v => set('preferredCities', v)} />
              {form.preferredCities.includes(CITY_OTHER) && (
                <Input value={form.preferredCitiesOther} onChange={e => set('preferredCitiesOther', e.target.value)}
                  placeholder="Tell us which city or region" className="mt-3" />
              )}
            </Field>

            <Field label="What company stages are you targeting?" hint="Select all that interest you">
              <ChipGrid options={COMPANY_STAGES} selected={form.companyStages} onChange={v => set('companyStages', v)} />
            </Field>

            <Field label="Target Seniority" hint="Select all that apply">
              <ChipGrid options={TARGET_ROLES} selected={form.targetRoles} onChange={v => set('targetRoles', v)} />
            </Field>
          </section>

          <hr className="border-gray-100" />

          {/* ── Work Authorization ──────────────────────────────────── */}
          <section className="space-y-6">
            <SectionTitle>Work Authorization</SectionTitle>

            <Field label="Are you legally authorized to work in the United States?">
              <div className="space-y-2 mt-3">
                {[{ value: true, label: 'Yes' }, { value: false, label: 'No' }].map(opt => (
                  <label key={String(opt.value)} className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
                    form.workAuthorizedUs === opt.value ? 'border-[#008037] bg-[#008037]/5 text-[#004a1f]' : 'border-gray-200 hover:border-gray-300'
                  }`}>
                    <input type="radio" name="workAuthorizedUs" checked={form.workAuthorizedUs === opt.value}
                      onChange={() => set('workAuthorizedUs', opt.value)} className="sr-only" />
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      form.workAuthorizedUs === opt.value ? 'border-[#008037]' : 'border-gray-300'
                    }`}>
                      {form.workAuthorizedUs === opt.value && <div className="w-2 h-2 rounded-full bg-[#008037]" />}
                    </div>
                    <span className="text-sm font-medium">{opt.label}</span>
                  </label>
                ))}
              </div>
            </Field>

            <Field label="Will you now or in the future require sponsorship for employment visa status (e.g. H-1B)?">
              <div className="space-y-2 mt-3">
                {[{ value: true, label: 'Yes' }, { value: false, label: 'No' }].map(opt => (
                  <label key={String(opt.value)} className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
                    form.requiresSponsorship === opt.value ? 'border-[#008037] bg-[#008037]/5 text-[#004a1f]' : 'border-gray-200 hover:border-gray-300'
                  }`}>
                    <input type="radio" name="requiresSponsorship" checked={form.requiresSponsorship === opt.value}
                      onChange={() => set('requiresSponsorship', opt.value)} className="sr-only" />
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      form.requiresSponsorship === opt.value ? 'border-[#008037]' : 'border-gray-300'
                    }`}>
                      {form.requiresSponsorship === opt.value && <div className="w-2 h-2 rounded-full bg-[#008037]" />}
                    </div>
                    <span className="text-sm font-medium">{opt.label}</span>
                  </label>
                ))}
              </div>
            </Field>
          </section>

          <hr className="border-gray-100" />

          {/* ── SFC ─────────────────────────────────────────────────── */}
          <section className="space-y-8">
            <SectionTitle description="Optional — tell us if you've worked with us before.">Strategic Finance Careers</SectionTitle>

            <Field label="Are you a current student or alumni with Strategic Finance Careers?">
              <div className="space-y-2 mt-3">
                {[{ value: true, label: 'Yes' }, { value: false, label: 'No' }].map(opt => (
                  <label key={String(opt.value)} className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
                    form.isSfcAlum === opt.value ? 'border-[#008037] bg-[#008037]/5 text-[#004a1f]' : 'border-gray-200 hover:border-gray-300'
                  }`}>
                    <input type="radio" name="isSfcAlum" checked={form.isSfcAlum === opt.value}
                      onChange={() => set('isSfcAlum', opt.value)} className="sr-only" />
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      form.isSfcAlum === opt.value ? 'border-[#008037]' : 'border-gray-300'
                    }`}>
                      {form.isSfcAlum === opt.value && <div className="w-2 h-2 rounded-full bg-[#008037]" />}
                    </div>
                    <span className="text-sm font-medium">{opt.label}</span>
                  </label>
                ))}
              </div>
            </Field>

            {/* Q2 + Q3 always visible, disabled until Q1 = Yes (same UX
                nudge as the wizard's SFC step). */}
            <div className={form.isSfcAlum === true ? '' : 'opacity-50 pointer-events-none'}>
              <Label className="text-base font-semibold text-gray-900 leading-snug">Which program did you enroll in?</Label>
              <div className="space-y-2 mt-3">
                {SFC_PROGRAMS.map(opt => (
                  <label key={opt} className={`flex items-center gap-3 p-3 border rounded-lg transition-all ${
                    form.isSfcAlum === true ? 'cursor-pointer' : 'cursor-default'
                  } ${form.sfcProgram === opt ? 'border-[#008037] bg-[#008037]/5 text-[#004a1f]' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input type="radio" name="sfcProgram" checked={form.sfcProgram === opt}
                      onChange={() => set('sfcProgram', opt)} disabled={form.isSfcAlum !== true} className="sr-only" />
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      form.sfcProgram === opt ? 'border-[#008037]' : 'border-gray-300'
                    }`}>
                      {form.sfcProgram === opt && <div className="w-2 h-2 rounded-full bg-[#008037]" />}
                    </div>
                    <span className="text-sm font-medium">{opt}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className={form.isSfcAlum === true ? '' : 'opacity-50 pointer-events-none'}>
              <Label className="text-base font-semibold text-gray-900 leading-snug">Which coach did you work with?</Label>
              <div className="space-y-2 mt-3">
                {SFC_COACHES.map(opt => (
                  <label key={opt} className={`flex items-center gap-3 p-3 border rounded-lg transition-all ${
                    form.isSfcAlum === true ? 'cursor-pointer' : 'cursor-default'
                  } ${form.sfcCoach === opt ? 'border-[#008037] bg-[#008037]/5 text-[#004a1f]' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input type="radio" name="sfcCoach" checked={form.sfcCoach === opt}
                      onChange={() => set('sfcCoach', opt)} disabled={form.isSfcAlum !== true} className="sr-only" />
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      form.sfcCoach === opt ? 'border-[#008037]' : 'border-gray-300'
                    }`}>
                      {form.sfcCoach === opt && <div className="w-2 h-2 rounded-full bg-[#008037]" />}
                    </div>
                    <span className="text-sm font-medium">{opt}</span>
                  </label>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* ── Save bar — sticky at the bottom of the scroll ──────────── */}
        <div className="sticky bottom-0 mt-10 -mx-6 md:-mx-8 px-6 md:px-8 py-4 bg-white/95 backdrop-blur border-t border-gray-100 flex items-center justify-end gap-4">
          {status === 'error' && <span className="text-xs text-red-600">{errorMsg}</span>}
          {status !== 'error' && dirty && <span className="text-xs text-gray-400">Unsaved changes</span>}
          {status !== 'error' && !dirty && status !== 'saving' && (
            <span className="text-xs text-[#006a2d] inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Saved</span>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || status === 'saving'}
            className="inline-flex items-center gap-2 bg-[#008037] hover:bg-[#006a2d] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors"
          >
            {status === 'saving'
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
              : status === 'error'
                ? 'Save failed — retry'
                : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
