-- Multi-resume Phase A: add candidate_resumes table + introduction_requests
-- selected_resume_id, backfill from the single-resume column. Reversible:
--   ALTER TABLE public.introduction_requests DROP COLUMN selected_resume_id;
--   DROP TABLE public.candidate_resumes CASCADE;
--
-- candidates.resume_full_url and candidates.resume_redacted_url are
-- left in place as deprecated single-resume mirrors. Every existing
-- reader (api/get-resume-url, api/respond-to-intro, api/_shared/signedUrl,
-- candidate dashboard, recruiter dossier, admin) keeps working through
-- Phase A; Phase C drops the mirrors after every reader is migrated.

CREATE TABLE public.candidate_resumes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id  uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  label         text NOT NULL,
  storage_path  text NOT NULL,
  is_default    boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (candidate_id, label)
);

COMMENT ON TABLE  public.candidate_resumes              IS 'Per-candidate uploaded resumes (Phase A of multi-resume). Cap of 2 per candidate is enforced server-side in /api/upload-candidate-resume. The 2-cap is intentionally NOT enforced via a DB trigger because the only writer is the service-role-key endpoint with bearer ownership already gated; adding a trigger here would just duplicate the check.';
COMMENT ON COLUMN public.candidate_resumes.storage_path IS 'Path inside the private "resumes" bucket; resolve to a download URL via api/_shared/signedUrl.js. NOT a public URL.';
COMMENT ON COLUMN public.candidate_resumes.label        IS 'Candidate-given label (e.g. "CFO resume"). UNIQUE per candidate so a single candidate cannot have two "CFO resume" rows.';
COMMENT ON COLUMN public.candidate_resumes.is_default   IS 'Exactly one row per candidate is the default. Enforced by /api/update-candidate-resume which clears is_default on siblings when promoting; on delete of the default, /api/delete-candidate-resume promotes the earliest remaining sibling.';

CREATE TRIGGER update_candidate_resumes_updated_at
BEFORE UPDATE ON public.candidate_resumes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.introduction_requests
  ADD COLUMN selected_resume_id uuid NULL
  REFERENCES public.candidate_resumes(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.introduction_requests.selected_resume_id IS 'Set by /api/respond-to-intro when the candidate accepts and (Phase B) picks which resume to send. NULL while pending, or when the candidate only has one resume. ON DELETE SET NULL so deleting a resume after acceptance never breaks an intro row.';

INSERT INTO public.candidate_resumes (candidate_id, label, storage_path, is_default)
SELECT id, 'Resume', resume_full_url, true
FROM public.candidates
WHERE resume_full_url IS NOT NULL AND resume_full_url <> ''
ON CONFLICT (candidate_id, label) DO NOTHING;
