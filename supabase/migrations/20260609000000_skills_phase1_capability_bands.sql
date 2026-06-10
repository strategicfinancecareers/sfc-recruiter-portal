-- Phase 1 of the skills rework: add 4 capability-band columns to the
-- candidates table. Each candidate self-rates Basic / Proficient /
-- Advanced (or NULL = not yet rated) across the four dimensions:
--   cap_data      — Data & querying
--   cap_modeling  — Financial modeling
--   cap_analytics — Analytics & methods
--   cap_systems   — Systems & tooling
--
-- Reversible: DROP COLUMN cap_data, cap_modeling, cap_analytics,
-- cap_systems from candidates undoes this migration cleanly.
--
-- The old free-text candidate_skills + skills tables remain untouched
-- — they continue feeding the recruiter card until Phase 3 replaces
-- it. The 11 existing candidate rows are not backfilled; cap_* default
-- to NULL and will be filled by candidates via the new
-- /api/update-candidate-skills endpoint.

ALTER TABLE public.candidates
  ADD COLUMN cap_data      TEXT,
  ADD COLUMN cap_modeling  TEXT,
  ADD COLUMN cap_analytics TEXT,
  ADD COLUMN cap_systems   TEXT;

ALTER TABLE public.candidates
  ADD CONSTRAINT candidates_cap_data_check
    CHECK (cap_data IS NULL OR cap_data IN ('basic', 'proficient', 'advanced')),
  ADD CONSTRAINT candidates_cap_modeling_check
    CHECK (cap_modeling IS NULL OR cap_modeling IN ('basic', 'proficient', 'advanced')),
  ADD CONSTRAINT candidates_cap_analytics_check
    CHECK (cap_analytics IS NULL OR cap_analytics IN ('basic', 'proficient', 'advanced')),
  ADD CONSTRAINT candidates_cap_systems_check
    CHECK (cap_systems IS NULL OR cap_systems IN ('basic', 'proficient', 'advanced'));

COMMENT ON COLUMN public.candidates.cap_data      IS 'Capability band for Data & querying: basic | proficient | advanced | NULL (not yet rated). Set by the candidate via /api/update-candidate-skills.';
COMMENT ON COLUMN public.candidates.cap_modeling  IS 'Capability band for Financial modeling: basic | proficient | advanced | NULL (not yet rated). Set by the candidate via /api/update-candidate-skills.';
COMMENT ON COLUMN public.candidates.cap_analytics IS 'Capability band for Analytics & methods: basic | proficient | advanced | NULL (not yet rated). Set by the candidate via /api/update-candidate-skills.';
COMMENT ON COLUMN public.candidates.cap_systems   IS 'Capability band for Systems & tooling: basic | proficient | advanced | NULL (not yet rated). Set by the candidate via /api/update-candidate-skills.';
