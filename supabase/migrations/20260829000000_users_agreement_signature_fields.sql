-- Per-clause initials + typed signature for the Recruiter Terms.
-- Supersedes the single recruiter_agreement_initials column (kept for any
-- rows written before this change). Reversible: drop the three columns.
-- (Applied live via Supabase MCP on 2026-08-29; this file is the repo record.)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS recruiter_agreement_initials_fee text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS recruiter_agreement_initials_comms text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS recruiter_agreement_signature text;
COMMENT ON COLUMN public.users.recruiter_agreement_initials_fee IS 'Initials on the Placement Fee clause (Section 5).';
COMMENT ON COLUMN public.users.recruiter_agreement_initials_comms IS 'Initials on the Communications clause (Section 6).';
COMMENT ON COLUMN public.users.recruiter_agreement_signature IS 'Typed full legal name submitted as the electronic signature.';
COMMENT ON COLUMN public.users.recruiter_agreement_initials IS 'LEGACY single-initials field from agreement v1.0 pre-signature-block. New signings write the _fee / _comms columns instead.';
