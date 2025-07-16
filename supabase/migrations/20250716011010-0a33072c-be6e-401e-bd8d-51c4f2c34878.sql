-- Add RLS policy to allow users to insert their own profile during signup
CREATE POLICY "Users can insert their own profile during signup" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = id);

-- Also add policy to allow the trigger to insert profiles
CREATE POLICY "System can insert profiles" 
ON public.profiles 
FOR INSERT 
WITH CHECK (true);