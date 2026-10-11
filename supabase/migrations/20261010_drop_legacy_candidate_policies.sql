-- Critical security fix, part B — apply AFTER the frontend deploy that
-- switches recruiter reads to the candidate_directory view (part A:
-- 20261010_candidate_directory_and_admin_policies.sql).
--
-- Drops the two Lovable-era policies that let ANY authenticated user
-- read and write every column of every candidates row:
--   - SELECT "Authenticated users can view all candidates"
--   - UPDATE "Authenticated users can update candidate favorites"
--     (leftover from a long-dropped favorites column; user_favorites
--     has owned this concern for months)

drop policy "Authenticated users can view all candidates" on public.candidates;
drop policy "Authenticated users can update candidate favorites" on public.candidates;
