import { useState } from 'react';
import { MapPin, Handshake, Shield, ChevronDown, ChevronUp, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// Anonymous candidate card — the full dossier view shown to recruiters
// when they click "View Profile" on /browse, and now also used to render
// the final preview step of the /apply form.
//
// Extracted verbatim from src/pages/CandidateSearch.tsx (the inline
// JSX inside the "Profile Dialog — Executive Dossier" block) so the
// preview at /apply shows EXACTLY what recruiters will see.
//
// Two render modes:
//   'recruiter' — original behavior. Parent supplies insightBullets +
//                 insightLoading (cached across opens in CandidateSearch)
//                 and an onRequestIntro callback for the CTA.
//   'preview'   — used by /apply. Hides the Request Introduction CTA,
//                 shows a top badge "This is what recruiters will see",
//                 suppresses the "Why This Candidate Stands Out" AI
//                 section entirely (no fetch, no skeleton), and never
//                 shows the SFC Take.

export interface AnonymousCandidateCardData {
  id?: string;
  // Anonymized identity
  label: string;
  display_name?: string;
  // Real name — passed only for admin-mode subtitle (recruiter-mode shows
  // it under the title when isAdmin=true to match the source dialog).
  name?: string;
  // Snapshot
  location: string;
  experience: number;
  education: string;
  highest_education_level?: string | null;
  profile_description?: string | null;
  primary_background?: string | null;
  secondary_backgrounds?: string[] | null;
  open_to_opportunities?: boolean | null;
  // Skills come in the same shape as the recruiter Candidate interface
  skills: Array<{ id?: string | number; skill: string }>;
}

interface RecruiterModeProps {
  mode: 'recruiter';
  // Insight bullets are computed by the parent (CandidateSearch caches
  // across opens). Pass undefined to render the "no insights yet" state.
  insightBullets?: string[];
  insightLoading?: boolean;
  onRequestIntro?: () => void;
  introCtaLabel?: string;          // "Request Introduction" | "Intro Requested" | "Intro Complete"
  introCtaDisabled?: boolean;
  showSubscribeHint?: boolean;     // small helper under the CTA
  isAdmin?: boolean;               // shows real name under the title
}

interface PreviewModeProps {
  mode: 'preview';
}

type Props = { candidate: AnonymousCandidateCardData } & (RecruiterModeProps | PreviewModeProps);

const BIO_LIMIT = 320;

const CORE_FINANCE = new Set([
  'strategic finance', 'fp&a', 'fpa', 'm&a', 'corporate development', 'capital raising',
  'private equity', 'investment banking', 'equity research', 'financial modeling', 'financial modelling',
  'valuation', 'dcf', 'lbo', 'budgeting', 'forecasting', 'budgeting & forecasting', 'treasury',
  'corporate finance', 'portfolio management', 'credit analysis', 'risk management',
  'investor relations', 'mergers & acquisitions', 'due diligence', 'capital markets',
  'leveraged buyout', 'discounted cash flow', 'financial analysis', 'corporate strategy',
  'business development', 'restructuring',
]);

export default function AnonymousCandidateCard(props: Props) {
  const { candidate: c } = props;
  const isPreview = props.mode === 'preview';
  const [showFullBio, setShowFullBio] = useState(false);

  // Bio = first paragraph of profile_description (strip appended metadata
  // like availability lines that submit-candidate.ts concatenates).
  const bio = (c.profile_description || '').split('\n\n')[0].trim();
  const bioTruncated = bio.length > BIO_LIMIT && !showFullBio;

  // Skills split (verbatim from source)
  const allSkills = (c.skills || []).map(s => s.skill).filter(Boolean);
  const coreSkills = allSkills.filter(s => CORE_FINANCE.has(s.toLowerCase()));
  const techSkills = allSkills.filter(s => !CORE_FINANCE.has(s.toLowerCase()));

  // Executive chips (verbatim from source)
  const chips: string[] = [];
  chips.push(`${c.experience}+ Yrs Experience`);
  if (c.highest_education_level && ['MBA', 'Masters', 'PhD'].includes(c.highest_education_level)) {
    chips.push(c.highest_education_level);
  }
  if (c.primary_background) chips.push(c.primary_background);
  if (c.open_to_opportunities) chips.push('Open to Opportunities');

  // Insight bullets only render in recruiter mode (preview suppresses
  // the entire "Why This Candidate Stands Out" section per spec)
  const recruiterProps = !isPreview ? (props as RecruiterModeProps) : null;
  const insightLoading = recruiterProps?.insightLoading ?? false;
  const insightBullets = recruiterProps?.insightBullets ?? [];
  const isAdmin = recruiterProps?.isAdmin ?? false;

  return (
    <div className="flex flex-col lg:flex-row h-full max-h-[90vh]">
      {/* ── Left column (scrollable) ── */}
      <div className="flex-[3] overflow-y-auto p-6 space-y-6">

        {/* Preview-mode banner — the "this is what recruiters see" cue */}
        {isPreview && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium">
            <Eye className="w-3.5 h-3.5" />
            This is what recruiters will see — your real name and contact details stay hidden until you accept an introduction.
          </div>
        )}

        {/* Header */}
        <div>
          <div className="flex items-start gap-3 mb-2">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 leading-tight">{c.label}</h2>
              {/* Admin-only real-name subtitle, recruiter mode only */}
              {!isPreview && isAdmin && c.name && (
                <p className="text-xs text-gray-400 mt-0.5">{c.name}</p>
              )}
            </div>
            <Badge className="mt-1 bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
              {c.label}
            </Badge>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-gray-500 flex-wrap">
            <MapPin className="h-3.5 w-3.5" />
            <span>{c.location}</span>
            <span className="text-gray-300">·</span>
            <span>{c.experience} yrs experience</span>
            <span className="text-gray-300">·</span>
            <span>{c.highest_education_level || c.education}</span>
          </div>
        </div>

        {/* Executive summary chips */}
        <div className="flex flex-wrap gap-2">
          {chips.map(chip => (
            <span key={chip} className="px-3 py-1 bg-gray-100 border border-gray-200 text-gray-700 rounded-full text-xs font-medium">
              {chip}
            </span>
          ))}
        </div>

        {/* Professional Summary */}
        {bio && (
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Professional Summary</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              {bioTruncated ? bio.slice(0, BIO_LIMIT) + '…' : bio}
            </p>
            {bio.length > BIO_LIMIT && (
              <button
                type="button"
                onClick={() => setShowFullBio(v => !v)}
                className="mt-1.5 flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
              >
                {showFullBio ? <><ChevronUp className="w-3 h-3" /> Show less</> : <><ChevronDown className="w-3 h-3" /> Show more</>}
              </button>
            )}
          </div>
        )}

        {/* Skills */}
        {allSkills.length > 0 && (
          <div className="space-y-3">
            {coreSkills.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Core Expertise</h3>
                <div className="flex flex-wrap gap-1.5">
                  {coreSkills.map(s => (
                    <span key={s} className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-full text-xs font-medium">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {techSkills.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Technical Skills</h3>
                <div className="flex flex-wrap gap-1.5">
                  {techSkills.map(s => (
                    <span key={s} className="px-2.5 py-1 bg-gray-100 border border-gray-200 text-gray-700 rounded-full text-xs font-medium">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {coreSkills.length === 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Skills</h3>
                <div className="flex flex-wrap gap-1.5">
                  {allSkills.map(s => (
                    <span key={s} className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-full text-xs font-medium">{s}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Why This Candidate Stands Out — recruiter mode only.
            Preview mode suppresses entirely (no fetch, no skeleton). */}
        {!isPreview && (
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Why This Candidate Stands Out ✦</h3>
            {insightLoading ? (
              <div className="space-y-2">
                {[80, 65, 90].map(w => (
                  <div key={w} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-200 shrink-0" />
                    <div className="h-3.5 bg-gray-100 rounded animate-pulse" style={{ width: `${w}%` }} />
                  </div>
                ))}
              </div>
            ) : insightBullets.length > 0 ? (
              <ul className="space-y-2">
                {insightBullets.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    {b}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400 italic">Upload complete profile to generate insights.</p>
            )}
          </div>
        )}

        {/* Anonymity note — shown in both modes (it's a useful reminder
            of the contract in both contexts). */}
        <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
          <Shield className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-0.5">Candidate Identity Protected</p>
            <p className="text-xs text-gray-500 leading-relaxed">
              Full name, detailed company history, resume, and contact information are revealed only after
              the candidate accepts the introduction request.
            </p>
          </div>
        </div>

      </div>

      {/* ── Right column (sticky snapshot + CTA in recruiter mode) ── */}
      <div className="lg:w-72 shrink-0 border-t lg:border-t-0 lg:border-l border-gray-100 bg-gray-50/50">
        <div className="sticky top-0 p-5 space-y-5">

          {/* Snapshot */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Candidate Snapshot</h3>
            <div className="space-y-3">
              {([
                { icon: '📍', label: 'Location', value: c.location },
                { icon: '💼', label: 'Experience', value: `${c.experience} years` },
                { icon: '🎓', label: 'Education', value: c.highest_education_level || c.education },
                { icon: '📊', label: 'Primary Background', value: c.primary_background || null },
                {
                  icon: '📋', label: 'Secondary Background',
                  value: Array.isArray(c.secondary_backgrounds) && c.secondary_backgrounds.length > 0
                    ? c.secondary_backgrounds.join(' · ')
                    : null,
                },
                { icon: '✅', label: 'Availability', value: c.open_to_opportunities ? 'Open to opportunities' : null },
              ] as Array<{ icon: string; label: string; value: string | null }>).filter(row => row.value).map(row => (
                <div key={row.label} className="flex items-start gap-2 text-sm pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                  <span className="text-base shrink-0 leading-none mt-0.5">{row.icon}</span>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400 leading-none mb-0.5">{row.label}</p>
                    <p className="text-gray-800 font-medium leading-snug text-xs">{row.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CTA — recruiter mode only. Preview mode replaces it with a
              passive "you're previewing your own profile" label. */}
          <div className="space-y-2 pt-1">
            {isPreview ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-900 leading-relaxed">
                <strong>Preview only.</strong> Recruiters will see this view and tap "Request Introduction" to ask SFC for a warm intro.
              </div>
            ) : (
              <>
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                  disabled={recruiterProps?.introCtaDisabled}
                  onClick={() => recruiterProps?.onRequestIntro?.()}
                >
                  <Handshake className="mr-2 h-4 w-4" />
                  {recruiterProps?.introCtaLabel ?? 'Request Introduction'}
                </Button>
                {recruiterProps?.showSubscribeHint && (
                  <p className="text-xs text-gray-400 text-center">
                    Subscribing unlocks unlimited introductions
                  </p>
                )}
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
