-- Create jobs table
CREATE TABLE public.jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('full-time', 'part-time', 'contract', 'remote')),
  salary_range TEXT,
  description TEXT,
  requirements TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'closed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view all active jobs" 
ON public.jobs 
FOR SELECT 
USING (status = 'active' OR auth.uid() = user_id);

CREATE POLICY "Users can create their own jobs" 
ON public.jobs 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own jobs" 
ON public.jobs 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own jobs" 
ON public.jobs 
FOR DELETE 
USING (auth.uid() = user_id);

-- Admins can view all jobs
CREATE POLICY "Admins can view all jobs" 
ON public.jobs 
FOR SELECT 
USING (is_current_user_admin());

-- Admins can update all jobs
CREATE POLICY "Admins can update all jobs" 
ON public.jobs 
FOR UPDATE 
USING (is_current_user_admin());

-- Admins can delete all jobs
CREATE POLICY "Admins can delete all jobs" 
ON public.jobs 
FOR DELETE 
USING (is_current_user_admin());

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_jobs_updated_at
BEFORE UPDATE ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some dummy data
INSERT INTO public.jobs (user_id, title, company, location, type, salary_range, description, requirements, status) VALUES
(
  '00000000-0000-0000-0000-000000000000', -- Placeholder user_id, will need to be updated with real user IDs
  'Senior Software Engineer',
  'TechCorp Inc.',
  'San Francisco, CA',
  'full-time',
  '$120,000 - $160,000',
  'We are looking for a Senior Software Engineer to join our growing team. You will be responsible for designing and developing scalable web applications using modern technologies.',
  'Requirements: 5+ years of experience with React, Node.js, TypeScript, and cloud platforms. Strong problem-solving skills and ability to work in a fast-paced environment.',
  'active'
),
(
  '00000000-0000-0000-0000-000000000000',
  'Product Manager',
  'StartupXYZ',
  'New York, NY',
  'full-time',
  '$100,000 - $130,000',
  'Join our product team to help define and execute our product roadmap. You will work closely with engineering, design, and business teams to deliver exceptional user experiences.',
  'Requirements: 3+ years of product management experience, strong analytical skills, experience with agile methodologies, excellent communication skills.',
  'active'
),
(
  '00000000-0000-0000-0000-000000000000',
  'Frontend Developer',
  'DesignStudio',
  'Remote',
  'remote',
  '$80,000 - $110,000',
  'We are seeking a talented Frontend Developer to create beautiful and intuitive user interfaces. You will work with our design team to bring mockups to life.',
  'Requirements: 3+ years of experience with React, CSS, HTML, responsive design, experience with design systems and component libraries.',
  'active'
),
(
  '00000000-0000-0000-0000-000000000000',
  'Data Scientist',
  'DataCorp',
  'Boston, MA',
  'contract',
  '$90,000 - $120,000',
  'Analyze large datasets to derive actionable insights for business decisions. Build machine learning models and work with cross-functional teams.',
  'Requirements: Masters in Data Science or related field, experience with Python, R, SQL, machine learning frameworks, statistical analysis.',
  'paused'
)