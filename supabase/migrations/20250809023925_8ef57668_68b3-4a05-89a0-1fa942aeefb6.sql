-- Fix Introduction Requests backend relationships and permissions
-- 1) Add foreign keys to enable PostgREST embeddings used by the frontend

-- candidate_id -> candidates.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_introduction_requests_candidate'
  ) THEN
    ALTER TABLE public.introduction_requests
      ADD CONSTRAINT fk_introduction_requests_candidate
      FOREIGN KEY (candidate_id)
      REFERENCES public.candidates(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- requester_id -> users.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_introduction_requests_requester'
  ) THEN
    ALTER TABLE public.introduction_requests
      ADD CONSTRAINT fk_introduction_requests_requester
      FOREIGN KEY (requester_id)
      REFERENCES public.users(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- job_id -> jobs.id (nullable)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_introduction_requests_job'
  ) THEN
    ALTER TABLE public.introduction_requests
      ADD CONSTRAINT fk_introduction_requests_job
      FOREIGN KEY (job_id)
      REFERENCES public.jobs(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- 2) Add missing DELETE policies so users can cancel their own requests and admins can manage all
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'introduction_requests'
      AND policyname = 'Users can delete their own introduction requests'
  ) THEN
    CREATE POLICY "Users can delete their own introduction requests"
    ON public.introduction_requests
    FOR DELETE
    USING (auth.uid() = requester_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'introduction_requests'
      AND policyname = 'Admins can delete all introduction requests'
  ) THEN
    CREATE POLICY "Admins can delete all introduction requests"
    ON public.introduction_requests
    FOR DELETE
    USING (public.is_current_user_admin());
  END IF;
END $$;
