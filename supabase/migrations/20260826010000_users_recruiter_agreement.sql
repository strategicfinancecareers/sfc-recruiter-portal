-- Recruiter Agreement click-through (typed initials + version), recorded
-- at checkout before payment. Distinct from the legacy has_accepted_terms
-- boolean. Reversible: drop the three columns.
-- (Applied live via Supabase MCP on 2026-08-26; this file is the repo record.)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS recruiter_agreement_accepted_at timestamptz;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS recruiter_agreement_initials text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS recruiter_agreement_version text;
COMMENT ON COLUMN public.users.recruiter_agreement_accepted_at IS 'When the recruiter agreed to the SFC Talent Recruiter Agreement (checkout gate).';
COMMENT ON COLUMN public.users.recruiter_agreement_initials IS 'Typed initials entered at agreement time (acceptance evidence).';
COMMENT ON COLUMN public.users.recruiter_agreement_version IS 'Version string of the agreement text that was accepted.';
