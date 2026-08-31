import { useState } from 'react';
import { MapPin, Handshake, Shield, ChevronDown, ChevronUp, Eye, GraduationCap, Mail, Phone, Linkedin, Download, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { gmailComposeUrl, CC_REMINDER } from '@/lib/emailCandidate';

// Anonymous candidate card — the full dossier view shown to recruiters
// when they click "View Profile" on /browse, and now also used to render
// the final preview step of the /apply form.
//
// Extracted verbatim from src/pages/CandidateSearch.tsx (the inline
// JSX inside the "Profile Dialog — Executive Dossier" block) so the
// preview at /apply shows EXACTLY what recruiters will see.
//
// Three render modes, matching the product's three reveal states:
//   'recruiter' — pre-request Browse dossier. Anonymous. Parent supplies
//                 insightBullets + insightLoading (cached across opens in
//                 CandidateSearch) and an onRequestIntro callback for the
//                 CTA. Shows the "Candidate Identity Protected" note.
//   'preview'   — the candidate's own "this is what recruiters see" view
//                 (/apply final step + dashboard Recruiter View tab).
//                 Candidate-addressed banner + passive rail note.
//   'revealed'  — POST-ACCEPTANCE recruiter view (approved-intro modal).
//                 Identity is unlocked: real-name subtitle, contact
//                 details + resume download + "introduction accepted"
//                 note in the right rail, SFC Take in the body. No CTA,
//                 no identity-protected note, no candidate-addressed
//                 copy, no AI-insights section.

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
  // Phase 3 of the skills redesign. New controlled-taxonomy field
  // (the primary recruiter-matching signal). Renders above the
  // Technical Skills section as brand-green chips. Fallback chain
  // when areas_of_expertise is null/empty:
  //   areas_of_expertise → detailed_experience → render nothing
  // detailed_experience is kept as the fallback for the 11 existing
  // candidates who have NULL areas_of_expertise until they re-edit.
  // Both fields stay populated via the Phase 2 dual-write so this
  // fallback is bulletproof; Phase 5 drops detailed_experience.
  areas_of_expertise?: string[] | null;
  detailed_experience?: string[] | null;
  // Industries the candidate has worked in. Surfaced as a chip row
  // between Areas of Expertise and Technical Skills (Phase 1.6
  // addition). Recruiter-safe — it's profile-shape metadata.
  industries?: string[] | null;
  // Company stages the candidate has WORKED at (experience). Paired
  // with the candidates.company_stage_experience column. Surfaced
  // as a chip row alongside Industries. Recruiter-safe — same
  // profile-shape metadata category.
  company_stage_experience?: string[] | null;
  // Whether the candidate is a current SFC student / alumni. When
  // true, the card renders a featured brand-green "SFC Alum" credential
  // callout (GraduationCap icon + label) under the title block.
  // sfc_program / sfc_coach are deliberately NOT exposed here — those
  // are internal coaching details, not recruiter-facing.
  is_sfc_alum?: boolean | null;
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

interface RevealedModeProps {
  mode: 'revealed';
  // Unlocked contact details (post-acceptance reveal).
  email?: string | null;
  phone?: string | null;
  linkedinUrl?: string | null;
  // Resume download — parent owns the signed-URL fetch.
  resumeAvailable?: boolean;
  resumeDownloading?: boolean;
  resumeError?: string | null;
  onDownloadResume?: () => void;
  // SFC Take (already-published only — parent gates on published_at).
  sfcTake?: {
    take: string;
    roleFit?: string[] | null;
    strengths?: string[] | null;
    considerations?: string[] | null;
  } | null;
}

type Props = { candidate: AnonymousCandidateCardData } & (RecruiterModeProps | PreviewModeProps | RevealedModeProps);

const BIO_LIMIT = 320;

export default function AnonymousCandidateCard(props: Props) {
  const { candidate: c } = props;
  const isPreview = props.mode === 'preview';
  const [showFullBio, setShowFullBio] = useState(false);

  // Bio = first paragraph of profile_description (strip appended metadata
  // like availability lines that submit-candidate.ts concatenates).
  const bio = (c.profile_description || '').split('\n\n')[0].trim();
  const bioTruncated = bio.length > BIO_LIMIT && !showFullBio;

  // All candidate-typed skills render as a single "Technical Skills"
  // section. The previous Core Expertise / Technical Skills split
  // (a hardcoded CORE_FINANCE allow-list bucketer) was removed so the
  // recruiter card and the candidate dashboard show every skill the
  // candidate typed in one flat list.
  const allSkills = (c.skills || []).map(s => s.skill).filter(Boolean);

  // Phase 3: Areas of Expertise (primary matching signal). Reads
  // areas_of_expertise first; falls back to detailed_experience so
  // pre-Phase-2 candidates still display until their first re-edit.
  const areasSource: string[] = (Array.isArray(c.areas_of_expertise) && c.areas_of_expertise.length > 0)
    ? c.areas_of_expertise
    : (Array.isArray(c.detailed_experience) ? c.detailed_experience : []);
  const areas = areasSource.filter(Boolean);

  // Insight bullets only render in recruiter mode (preview and revealed
  // both suppress the entire "Why This Candidate Stands Out" section).
  const recruiterProps = props.mode === 'recruiter' ? props : null;
  const revealedProps = props.mode === 'revealed' ? props : null;
  const isRevealed = props.mode === 'revealed';
  const insightLoading = recruiterProps?.insightLoading ?? false;
  const insightBullets = recruiterProps?.insightBullets ?? [];
  const isAdmin = recruiterProps?.isAdmin ?? false;

  return (
    <div className="flex flex-col lg:flex-row h-full max-h-[90vh]">
      {/* ── Left column (scrollable) ── */}
      <div className="flex-[3] overflow-y-auto p-6 space-y-6">

        {/* Preview-mode banner — the "this is what recruiters see" cue */}
        {isPreview && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#008037]/5 border border-[#008037]/25 text-[#004a1f] text-xs font-medium">
            <Eye className="w-3.5 h-3.5" />
            This is what recruiters will see — your real name and contact details stay hidden until you accept an introduction.
          </div>
        )}

        {/* Header — big title + the inline location · experience ·
            education line. The duplicate title pill and the redundant
            executive chip row were removed (Phase: card-header-
            cleanup) — all of that data already lives in the right-rail
            Candidate Snapshot, so the chips were pure duplication. */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 leading-tight">{c.label}</h2>
          {/* Real-name subtitle: admins in recruiter mode, and always in
              revealed mode (identity is unlocked post-acceptance). */}
          {((isAdmin && !isPreview) || isRevealed) && c.name && (
            <p className="text-xs text-gray-400 mt-0.5">{c.name}</p>
          )}
          <div className="flex items-center gap-1.5 text-sm text-gray-500 flex-wrap mt-2">
            <MapPin className="h-3.5 w-3.5" />
            <span>{c.location}</span>
            <span className="text-gray-300">·</span>
            <span>{c.experience} yrs experience</span>
            <span className="text-gray-300">·</span>
            <span>{c.highest_education_level || c.education}</span>
          </div>
        </div>

        {/* SFC Alum credential callout — featured, not a small pill.
            Renders ONLY when is_sfc_alum === true (false / null /
            undefined → renders nothing). This is the one intentional
            icon on the card: a GraduationCap fronting a prominent
            brand-green banner so the alum credential stands out as a
            differentiator. Companion columns sfc_program / sfc_coach
            stay internal — NOT surfaced to recruiters. */}
        {c.is_sfc_alum === true && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#008037]/10 border border-[#008037]/30">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#008037] shrink-0">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#004a1f] leading-tight">SFC Alum</p>
              <p className="text-xs text-[#006a2d] leading-tight mt-0.5">Strategic Finance Careers alumnus</p>
            </div>
          </div>
        )}

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
                className="mt-1.5 flex items-center gap-1 text-xs text-[#008037] hover:text-[#006a2d] font-medium"
              >
                {showFullBio ? <><ChevronUp className="w-3 h-3" /> Show less</> : <><ChevronDown className="w-3 h-3" /> Show more</>}
              </button>
            )}
          </div>
        )}

        {/* Phase 3: Areas of Expertise — the primary matching signal,
            shown above Technical Skills with brand-green chip
            treatment to distinguish it from the neutral skills below.
            Renders in both recruiter mode AND preview mode (the
            candidate's own "Recruiter View" tab shows the same
            thing). Hidden when both areas_of_expertise and
            detailed_experience are empty (e.g. a hypothetical
            future candidate with neither field set). */}
        {areas.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Areas of Expertise</h3>
            <div className="flex flex-wrap gap-1.5">
              {areas.map(a => (
                <span key={a} className="px-2.5 py-1 bg-[#008037]/12 border border-[#008037]/30 text-[#004a1f] rounded-full text-xs font-semibold">{a}</span>
              ))}
            </div>
          </div>
        )}

        {/* Industries — sectors the candidate has worked in
            (collected on the wizard's Professional Experience step).
            Neutral chip treatment so it reads as profile context
            rather than competing with the brand-green primary
            matching signal above. Only renders when non-empty.
            Added Phase 1.6 — additive only; no other change to the
            recruiter card layout. */}
        {Array.isArray(c.industries) && c.industries.filter(Boolean).length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Industries</h3>
            <div className="flex flex-wrap gap-1.5">
              {c.industries.filter(Boolean).map(i => (
                <span key={i} className="px-2.5 py-1 bg-gray-100 border border-gray-200 text-gray-700 rounded-full text-xs font-medium">{i}</span>
              ))}
            </div>
          </div>
        )}

        {/* Company Stage Experience — stages the candidate has
            worked at. Distinct from any future "stages they want to
            work at" surface. Neutral chip treatment so it reads as
            profile context rather than competing with Areas of
            Expertise (the brand-green primary matching signal).
            Additive only — no other change to the recruiter card. */}
        {Array.isArray(c.company_stage_experience) && c.company_stage_experience.filter(Boolean).length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Company Stage Experience</h3>
            <div className="flex flex-wrap gap-1.5">
              {c.company_stage_experience.filter(Boolean).map(s => (
                <span key={s} className="px-2.5 py-1 bg-gray-100 border border-gray-200 text-gray-700 rounded-full text-xs font-medium">{s}</span>
              ))}
            </div>
          </div>
        )}

        {/* Technical Skills — single flat list of every skill the
            candidate typed. Brand-green chip treatment kept for the
            recruiter card; the dashboard's mirror of this section
            uses the same label. */}
        {allSkills.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Technical Skills</h3>
            <div className="flex flex-wrap gap-1.5">
              {allSkills.map(s => (
                <span key={s} className="px-2.5 py-1 bg-[#008037]/5 border border-[#008037]/25 text-[#005a26] rounded-full text-xs font-medium">{s}</span>
              ))}
            </div>
          </div>
        )}

        {/* Why This Candidate Stands Out — recruiter mode only.
            Preview and revealed modes suppress entirely. */}
        {recruiterProps && (
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
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#008037] shrink-0" />
                    {b}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400 italic">Upload complete profile to generate insights.</p>
            )}
          </div>
        )}

        {/* SFC Take — revealed mode only (post-acceptance full reveal).
            Recruiter mode surfaces its own insights; preview never shows it. */}
        {isRevealed && revealedProps?.sfcTake?.take && (
          <div className="border-t border-gray-100 pt-4 space-y-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider font-semibold text-[#006a2d] italic mb-1.5">SFC Take</p>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{revealedProps.sfcTake.take}</p>
            </div>
            {([
              { title: 'Role fit', items: revealedProps.sfcTake.roleFit },
              { title: 'Strengths', items: revealedProps.sfcTake.strengths },
              { title: 'Considerations', items: revealedProps.sfcTake.considerations },
            ] as Array<{ title: string; items?: string[] | null }>).filter(s => s.items && s.items.length > 0).map(s => (
              <div key={s.title}>
                <p className="text-xs uppercase tracking-wide text-gray-400 font-medium mb-1.5">{s.title}</p>
                <div className="flex flex-wrap gap-1">
                  {s.items!.map((item, i) => (
                    <span key={`${s.title}-${i}`} className="px-2.5 py-1 rounded-full text-xs font-medium border border-[#008037]/25 bg-[#008037]/5 text-[#005a26]">{item}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Anonymity note — Browse + preview only. Nonsensical once the
            candidate has ACCEPTED (revealed mode): identity and contact
            are unlocked, so the "protected" promise no longer applies. */}
        {!isRevealed && (
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
        )}

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

          {/* Rail action area, one branch per mode:
              preview  → passive "you're previewing your own profile" note
              revealed → unlocked contact details + resume download +
                         "introduction accepted" confirmation
              recruiter→ Request Introduction CTA */}
          <div className="space-y-2 pt-1">
            {isPreview ? (
              <div className="rounded-lg border border-[#008037]/25 bg-[#008037]/5 px-3 py-2.5 text-xs text-[#004a1f] leading-relaxed">
                <strong>Preview only.</strong> Recruiters will see this view and tap "Request Introduction" to ask SFC for a warm intro.
              </div>
            ) : isRevealed ? (
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Contact</h3>
                  <div className="space-y-2.5">
                    {revealedProps?.email && (
                      <>
                        <a
                          href={gmailComposeUrl(revealedProps.email, `Introduction via SFC Talent`)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full inline-flex items-center justify-center gap-2 bg-[#008037] hover:bg-[#006a2d] text-white rounded-lg px-3 py-2 text-xs font-semibold transition-colors"
                        >
                          <Mail className="w-3.5 h-3.5 shrink-0" />
                          Email candidate
                        </a>
                        <p className="text-[10px] text-gray-500 leading-relaxed">
                          Opens Gmail with talent@strategicfinancecareers.com cc'd. {CC_REMINDER}
                        </p>
                        <p className="flex items-center gap-2 text-xs font-medium text-[#005a26] min-w-0">
                          <Mail className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate select-all">{revealedProps.email}</span>
                        </p>
                      </>
                    )}
                    {revealedProps?.phone && (
                      <a href={`tel:${revealedProps.phone}`} className="flex items-center gap-2 text-xs font-medium text-[#005a26] hover:underline">
                        <Phone className="w-3.5 h-3.5 shrink-0" />
                        {revealedProps.phone}
                      </a>
                    )}
                    {revealedProps?.linkedinUrl && (
                      <a href={revealedProps.linkedinUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs font-medium text-[#005a26] hover:underline min-w-0">
                        <Linkedin className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">LinkedIn profile</span>
                      </a>
                    )}
                  </div>
                </div>
                {revealedProps?.resumeAvailable && (
                  <div className="space-y-1.5">
                    <Button
                      variant="outline"
                      className="w-full border-[#008037]/30 text-[#005a26] hover:bg-[#008037]/5 font-semibold"
                      disabled={revealedProps?.resumeDownloading}
                      onClick={() => revealedProps?.onDownloadResume?.()}
                    >
                      {revealedProps?.resumeDownloading
                        ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating link…</>
                        : <><Download className="mr-2 h-4 w-4" /> Download Resume</>}
                    </Button>
                    {revealedProps?.resumeError && (
                      <p className="text-xs text-red-600">{revealedProps.resumeError}</p>
                    )}
                  </div>
                )}
                <div className="flex items-start gap-2 rounded-lg border border-[#008037]/25 bg-[#008037]/5 px-3 py-2.5 text-xs text-[#004a1f] leading-relaxed">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>Introduction accepted. We recommend reaching out within 24 hours while their interest is fresh.</span>
                </div>
              </div>
            ) : (
              <>
                <Button
                  className="w-full bg-[#008037] hover:bg-[#006a2d] text-white font-semibold"
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
