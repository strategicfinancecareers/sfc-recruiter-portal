-- Add policies for candidate management
CREATE POLICY "Admins can insert candidates" 
ON public.candidates 
FOR INSERT 
WITH CHECK (is_current_user_admin());

CREATE POLICY "Admins can delete candidates" 
ON public.candidates 
FOR DELETE 
USING (is_current_user_admin());

-- Add policies for candidate skills management
CREATE POLICY "Admins can insert candidate skills" 
ON public.candidate_skills 
FOR INSERT 
WITH CHECK (is_current_user_admin());

CREATE POLICY "Admins can update candidate skills" 
ON public.candidate_skills 
FOR UPDATE 
USING (is_current_user_admin());

CREATE POLICY "Admins can delete candidate skills" 
ON public.candidate_skills 
FOR DELETE 
USING (is_current_user_admin());

-- Add policies for skills management
CREATE POLICY "Admins can insert skills" 
ON public.skills 
FOR INSERT 
WITH CHECK (is_current_user_admin());

CREATE POLICY "Admins can update skills" 
ON public.skills 
FOR UPDATE 
USING (is_current_user_admin());

CREATE POLICY "Admins can delete skills" 
ON public.skills 
FOR DELETE 
USING (is_current_user_admin());