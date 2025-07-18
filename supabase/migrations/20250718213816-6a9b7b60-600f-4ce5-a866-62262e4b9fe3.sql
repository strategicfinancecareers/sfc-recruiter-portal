-- Create storage buckets for resumes
INSERT INTO storage.buckets (id, name, public) 
VALUES ('resumes-full', 'resumes-full', false);

INSERT INTO storage.buckets (id, name, public) 
VALUES ('resumes-redacted', 'resumes-redacted', false);

-- Create storage policies for resumes
CREATE POLICY "Authenticated users can view full resumes" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'resumes-full' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can upload full resumes" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'resumes-full' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view redacted resumes" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'resumes-redacted' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can upload redacted resumes" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'resumes-redacted' AND auth.uid() IS NOT NULL);

-- Create skills reference table
CREATE TABLE public.skills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for skills
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view skills" 
ON public.skills 
FOR SELECT 
USING (true);

-- Create candidates table
CREATE TABLE public.candidates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  location TEXT NOT NULL,
  experience INTEGER NOT NULL,
  education TEXT NOT NULL,
  label TEXT NOT NULL, -- job title/role
  profile_description TEXT,
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  resume_full_url TEXT, -- Path to full resume in storage
  resume_redacted_url TEXT, -- Path to redacted resume in storage
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create candidate_skills junction table
CREATE TABLE public.candidate_skills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(candidate_id, skill_id)
);

-- Enable RLS
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_skills ENABLE ROW LEVEL SECURITY;

-- Create policies for candidates
CREATE POLICY "Authenticated users can view all candidates" 
ON public.candidates 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update candidate favorites" 
ON public.candidates 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

-- Create policies for candidate_skills
CREATE POLICY "Authenticated users can view candidate skills" 
ON public.candidate_skills 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_candidates_updated_at
BEFORE UPDATE ON public.candidates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample skills
INSERT INTO public.skills (name) VALUES 
('JavaScript'),
('TypeScript'),
('React'),
('Node.js'),
('Python'),
('Java'),
('SQL'),
('AWS'),
('Docker'),
('Kubernetes'),
('GraphQL'),
('MongoDB'),
('PostgreSQL'),
('Redis'),
('Git'),
('Agile'),
('Scrum'),
('DevOps'),
('CI/CD'),
('TDD'),
('Machine Learning'),
('Data Analysis'),
('UI/UX Design'),
('Product Management'),
('Leadership'),
('Communication'),
('Problem Solving'),
('Team Collaboration'),
('Project Management'),
('Strategic Planning');

-- Insert sample candidates
INSERT INTO public.candidates (name, display_name, email, phone, location, experience, education, label, profile_description, is_favorite) VALUES 
('John Smith', 'Senior Software Engineer in San Francisco', 'john.smith@email.com', '+1-555-0101', 'San Francisco, CA', 5, 'BS Computer Science', 'Senior Software Engineer', 'Experienced full-stack developer with expertise in modern web technologies and cloud platforms.', false),
('Sarah Johnson', 'Product Manager in New York', 'sarah.johnson@email.com', '+1-555-0102', 'New York, NY', 7, 'MBA, BS Engineering', 'Product Manager', 'Strategic product leader with a track record of launching successful digital products.', true),
('Michael Chen', 'Data Scientist in Seattle', 'michael.chen@email.com', '+1-555-0103', 'Seattle, WA', 4, 'MS Data Science', 'Data Scientist', 'ML engineer specializing in predictive analytics and large-scale data processing.', false),
('Emily Davis', 'UX Designer in Austin', 'emily.davis@email.com', '+1-555-0104', 'Austin, TX', 6, 'MFA Design', 'UX Designer', 'Creative designer focused on user-centered design and design system development.', true),
('David Wilson', 'DevOps Engineer in Denver', 'david.wilson@email.com', '+1-555-0105', 'Denver, CO', 8, 'BS Computer Engineering', 'DevOps Engineer', 'Infrastructure expert with extensive experience in cloud automation and CI/CD.', false);

-- Link candidates to skills
INSERT INTO public.candidate_skills (candidate_id, skill_id) 
SELECT c.id, s.id FROM public.candidates c, public.skills s 
WHERE (c.name = 'John Smith' AND s.name IN ('JavaScript', 'TypeScript', 'React', 'Node.js', 'AWS', 'Docker'))
   OR (c.name = 'Sarah Johnson' AND s.name IN ('Product Management', 'Strategic Planning', 'Leadership', 'Agile', 'Communication'))
   OR (c.name = 'Michael Chen' AND s.name IN ('Python', 'Machine Learning', 'Data Analysis', 'SQL', 'PostgreSQL', 'AWS'))
   OR (c.name = 'Emily Davis' AND s.name IN ('UI/UX Design', 'Problem Solving', 'Communication', 'Team Collaboration'))
   OR (c.name = 'David Wilson' AND s.name IN ('AWS', 'Docker', 'Kubernetes', 'DevOps', 'CI/CD', 'Python', 'Git'));