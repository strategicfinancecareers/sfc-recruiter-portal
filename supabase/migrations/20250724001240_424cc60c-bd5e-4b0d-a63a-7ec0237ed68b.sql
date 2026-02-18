-- Make job_id nullable in introduction_requests table to allow introductions without specific jobs
ALTER TABLE public.introduction_requests 
ALTER COLUMN job_id DROP NOT NULL;