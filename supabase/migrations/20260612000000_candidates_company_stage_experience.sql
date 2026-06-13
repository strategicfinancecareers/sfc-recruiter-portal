-- candidates.company_stage_experience
--
-- Stages the candidate has WORKED AT (experience), distinct from
-- candidates.target_company_stages which captures the stages they
-- WANT to work at next (preference). Two separate signals; recruiters
-- filter by experience to find people who've operated at a given
-- scale, and by target preference to find people open to a stage.
--
-- Nullable text[] — optional field, no validator gate. Reversible.

ALTER TABLE candidates
  ADD COLUMN company_stage_experience text[];

COMMENT ON COLUMN candidates.company_stage_experience IS
  'Company stages the candidate has WORKED at (experience), distinct from target_company_stages (preference).';

-- DOWN:
-- ALTER TABLE candidates DROP COLUMN company_stage_experience;
