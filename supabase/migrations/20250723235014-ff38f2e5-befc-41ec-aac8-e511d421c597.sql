-- Create introduction_requests table
CREATE TABLE public.introduction_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.introduction_requests ENABLE ROW LEVEL SECURITY;

-- Create policies for introduction_requests
CREATE POLICY "Users can view their own introduction requests" 
ON public.introduction_requests 
FOR SELECT 
USING (auth.uid() = requester_id);

CREATE POLICY "Users can create their own introduction requests" 
ON public.introduction_requests 
FOR INSERT 
WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Users can update their own introduction requests" 
ON public.introduction_requests 
FOR UPDATE 
USING (auth.uid() = requester_id);

CREATE POLICY "Admins can view all introduction requests" 
ON public.introduction_requests 
FOR SELECT 
USING (is_current_user_admin());

CREATE POLICY "Admins can update all introduction requests" 
ON public.introduction_requests 
FOR UPDATE 
USING (is_current_user_admin());

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_introduction_requests_updated_at
BEFORE UPDATE ON public.introduction_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_introduction_requests_requester_id ON public.introduction_requests(requester_id);
CREATE INDEX idx_introduction_requests_candidate_id ON public.introduction_requests(candidate_id);
CREATE INDEX idx_introduction_requests_job_id ON public.introduction_requests(job_id);
CREATE INDEX idx_introduction_requests_status ON public.introduction_requests(status);