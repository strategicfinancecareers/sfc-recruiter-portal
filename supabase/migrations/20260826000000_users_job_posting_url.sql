-- Google-auth recruiter completion step: optional link to a live job
-- posting / careers page, used by admins to vet that an applicant is a
-- real recruiter or hiring manager. Nullable; standard signup leaves it
-- NULL. Reversible: ALTER TABLE public.users DROP COLUMN job_posting_url;
-- (Applied live via Supabase MCP on 2026-08-26; this file is the repo record.)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS job_posting_url text;
COMMENT ON COLUMN public.users.job_posting_url IS
  'Optional link to a live job posting or careers page, collected during recruiter signup (Google OAuth completion step) for vetting.';
