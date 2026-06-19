import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Recruiter-facing candidate shape. Narrowed deliberately to ONLY the
// columns the recruiter browse/search and AnonymousCandidateCard
// actually render. The pre-narrowing version was a select('*') that
// shipped every candidate's email/phone/linkedin/resume path/work
// authorization/sponsorship/comp target/etc. to every recruiter's
// browser even though no component displayed them — a quiet leak of
// the candidate's anonymity model. Adding a column back here means
// committing to surfacing it in the recruiter UI.
//
// `name` (real name) is gated behind the includeName flag and is set
// ONLY when the caller is an admin or owner. Recruiters never receive
// the real name in the payload; the SFC Take is server-scrubbed at
// generation + publish so it can be rendered as-is.
export interface Candidate {
  id: string;
  display_name: string;
  label: string;
  location: string;
  experience: number;
  education: string;
  highest_education_level?: string;
  profile_description?: string;
  primary_background?: string;
  secondary_backgrounds?: string[];
  open_to_opportunities?: boolean;
  skills: Array<{ id: string; skill: string }>;
  // Phase 3 of the skills redesign. areas_of_expertise is the new
  // controlled-taxonomy primary matching signal. detailed_experience
  // is its predecessor, kept as the fallback for the 11 existing
  // candidates who have NULL areas_of_expertise until they re-edit.
  // The recruiter card + filter read areas_of_expertise first and
  // fall back to detailed_experience client-side.
  areas_of_expertise?: string[] | null;
  detailed_experience?: string[] | null;
  // Industries the candidate has worked in (collected on the
  // Professional Experience step). Surfaced on the recruiter card as
  // a chip row alongside Areas of Expertise / Technical Skills —
  // recruiter-safe (it's profile-shape metadata, not PII).
  industries?: string[] | null;
  // Company stages the candidate has WORKED at (experience). Paired
  // with the candidates.company_stage_experience column added in the
  // 20260612 migration. Recruiter-safe; rendered on the card as a
  // neutral chip row near Industries.
  company_stage_experience?: string[] | null;
  // Whether the candidate is a current Strategic Finance Careers
  // student / alumni. Surfaced to recruiters as a small "SFC Alum"
  // badge on the card when true. sfc_program / sfc_coach are
  // intentionally NOT selected — those are internal coaching
  // details, not recruiter-facing.
  is_sfc_alum?: boolean | null;
  is_favorite?: boolean; // Computed in the hook from user_favorites — not selected.
  // SFC Take (Batch 2) — recruiters see these ONLY when sfc_take_published_at is non-null.
  // Filter happens at render time, not in the SELECT, so the hook can stay shared with admin views.
  sfc_take?: string | null;
  sfc_role_fit?: string[] | null;
  sfc_take_published_at?: string | null;
  // Admin-only: real name is included in the payload ONLY when
  // includeName=true is passed to useCandidates by an admin/owner
  // caller. Undefined for recruiters.
  name?: string;
}

// Recruiter-safe column allow-list. NO sensitive PII (email, phone,
// linkedin_url, resume_full_url, resume_redacted_url, work_authorized_us,
// requires_sponsorship), NO unused preference fields (target_salary,
// target_roles, etc.), NO unused SFC Take fields (sfc_strengths,
// sfc_considerations are not rendered by any recruiter component),
// NO real name. Admin includeName=true appends `name` to this list
// at query time. `industries` is now surfaced on the recruiter card
// (added Phase 1.6 as a chip row) so it's included.
const RECRUITER_COLUMNS = [
  'id',
  'display_name',
  'label',
  'location',
  'experience',
  'education',
  'highest_education_level',
  'profile_description',
  'primary_background',
  'secondary_backgrounds',
  'open_to_opportunities',
  // Phase 3: Areas of Expertise (primary matching signal) + its
  // legacy predecessor for the client-side fallback. Both are
  // recruiter-safe — they're the same content surfaced as chips on
  // the card, and detailed_experience is being deprecated rather
  // than re-categorized as sensitive. Drop detailed_experience in
  // Phase 5 once it's fully retired.
  'areas_of_expertise',
  'detailed_experience',
  'industries',
  'company_stage_experience',
  // SFC alum boolean — recruiters see a small "SFC Alum" badge on
  // the card when true. The companion columns sfc_program and
  // sfc_coach are deliberately NOT in this allow-list (internal
  // coaching details only — not for recruiters).
  'is_sfc_alum',
  'sfc_take',
  'sfc_take_published_at',
  'sfc_role_fit',
].join(', ');

export function useCandidates(opts: { includeName?: boolean } = {}) {
  const { includeName = false } = opts;
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchCandidates = async () => {
    try {
      // Admin/owner callers pass includeName=true so the real-name
      // subtitle on /browse + /favorites can still render. Recruiters
      // never get `name` in the payload (the SFC Take is server-side
      // name-scrubbed in api/generate-sfc-take + api/publish-sfc-take
      // so no client-side scrub needs the real name).
      const columns = includeName
        ? `${RECRUITER_COLUMNS}, name`
        : RECRUITER_COLUMNS;
      const { data: candidatesData, error: candidatesError } = await supabase
        .from('candidates')
        .select(`
          ${columns},
          candidate_skills!inner(
            skill_id,
            skills!inner(
              id,
              skill
            )
          )
        `)
        // Recruiters only see approved (status='active') candidates.
        // Pending/rejected/inactive are filtered out. The candidate-approval
        // migration backfills NULL statuses to 'active' so no null check needed.
        .eq('status', 'active');

      if (candidatesError) throw candidatesError;

      // Get user favorites
      const { data: { user } } = await supabase.auth.getUser();
      let userFavorites: string[] = [];
      
      if (user) {
        const { data: favoritesData } = await supabase
          .from('user_favorites')
          .select('candidate_id')
          .eq('user_id', user.id);
        
        userFavorites = favoritesData?.map(f => f.candidate_id) || [];
      }

      // Transform the data to group skills by candidate
      const transformedCandidates = candidatesData?.map(candidate => ({
        ...candidate,
        skills: candidate.candidate_skills?.map((cs: any) => ({
          id: cs.skills.id,
          skill: cs.skills.skill
        })) || [],
        is_favorite: userFavorites.includes(candidate.id)
      })) || [];

      setCandidates(transformedCandidates);
    } catch (error) {
      console.error('Error fetching candidates:', error);
      toast({
        title: "Error",
        description: "Failed to load candidates",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = async (candidateId: string) => {
    try {
      const candidate = candidates.find(c => c.id === candidateId);
      if (!candidate) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Error",
          description: "You must be logged in to favorite candidates",
          variant: "destructive",
        });
        return;
      }

      if (candidate.is_favorite) {
        // Remove from favorites
        const { error } = await supabase
          .from('user_favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('candidate_id', candidateId);

        if (error) throw error;
      } else {
        // Add to favorites
        const { error } = await supabase
          .from('user_favorites')
          .insert({
            user_id: user.id,
            candidate_id: candidateId
          });

        if (error) throw error;
      }

      setCandidates(prev => 
        prev.map(c => 
          c.id === candidateId 
            ? { ...c, is_favorite: !c.is_favorite }
            : c
        )
      );

      toast({
        title: candidate.is_favorite ? "Removed from favorites" : "Added to favorites",
        description: candidate.is_favorite 
          ? `${candidate.display_name} removed from favorites`
          : `${candidate.display_name} added to favorites`,
      });
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast({
        title: "Error",
        description: "Failed to update favorite status",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, []);

  return {
    candidates,
    loading,
    toggleFavorite,
    refetch: fetchCandidates
  };
}