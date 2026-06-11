-- Skills redesign Phase 1: add candidates.areas_of_expertise.
--
-- Reversible: ALTER TABLE public.candidates DROP COLUMN areas_of_expertise;
--
-- The new controlled-taxonomy field is the primary recruiter-matching
-- signal. Candidate-self writes happen via /api/update-candidate-areas
-- which validates against the canonical taxonomy in
-- src/lib/areasOfExpertise.ts, dedupes case-insensitively, and caps
-- the array at 10 entries server-side. Through the transition,
-- detailed_experience stays in place as a dual-written mirror so the
-- SFC Take prompt + admin notify email keep reading the legacy value
-- — Phase 5 drops it after the new field replaces every reader.

ALTER TABLE public.candidates
  ADD COLUMN areas_of_expertise TEXT[];

COMMENT ON COLUMN public.candidates.areas_of_expertise IS
  'Controlled-taxonomy Areas of Expertise (~30 tags across 5 groups; see src/lib/areasOfExpertise.ts). Capped at 10 entries, validated against the canonical list, deduped case-insensitively. Candidate-self writes via /api/update-candidate-areas (bearer + email-ownership). Phase 1 of the skills redesign; replaces the legacy detailed_experience array, which is kept dual-written through the transition.';
