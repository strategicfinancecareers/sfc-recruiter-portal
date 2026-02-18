-- Add an opt-in flag for admin email notifications on new introduction requests
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS notify_intro_requests boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.notify_intro_requests IS
  'If true, this user (typically an admin) will receive email notifications when a recruiter creates a new introduction request.';