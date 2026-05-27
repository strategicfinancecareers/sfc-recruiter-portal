-- =============================================================================
-- Candidate approval workflow (Batch 1)
-- =============================================================================
-- Adds SFC review columns, flips default status from 'active' to 'pending',
-- locks status to a known vocabulary via CHECK constraint, and indexes the
-- (status, created_at DESC) tuple for fast queue queries.
--
-- Idempotent: safe to re-run via IF NOT EXISTS guards everywhere.

-- ---------- 1) New SFC-review columns ----------------------------------------
ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS sfc_take TEXT,
  ADD COLUMN IF NOT EXISTS sfc_role_fit        TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  ADD COLUMN IF NOT EXISTS sfc_strengths       TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  ADD COLUMN IF NOT EXISTS sfc_considerations  TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  ADD COLUMN IF NOT EXISTS approved_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by         UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS rejection_reason    TEXT;

-- ---------- 2) Backfill any NULL statuses to 'active' ------------------------
-- Pre-existing rows from before this approval workflow existed are
-- grandfathered as already-approved (recruiters were already seeing them).
UPDATE public.candidates SET status = 'active' WHERE status IS NULL;

-- ---------- 3) Flip default to 'pending' -------------------------------------
ALTER TABLE public.candidates
  ALTER COLUMN status SET DEFAULT 'pending';

-- ---------- 4) CHECK constraint on status vocabulary -------------------------
-- 'deleted' is kept in the allowed set because api/submit-candidate.ts treats
-- it as a re-application sentinel and api/delete-candidate-profile.ts sets it.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'candidates_status_check'
  ) THEN
    ALTER TABLE public.candidates
      ADD CONSTRAINT candidates_status_check
      CHECK (status IN ('pending', 'active', 'rejected', 'inactive', 'deleted'));
  END IF;
END $$;

-- ---------- 5) Queue-query index ---------------------------------------------
-- Pending list is the hot query; oldest-first FIFO ordering.
CREATE INDEX IF NOT EXISTS candidates_status_created_at_idx
  ON public.candidates (status, created_at DESC);
