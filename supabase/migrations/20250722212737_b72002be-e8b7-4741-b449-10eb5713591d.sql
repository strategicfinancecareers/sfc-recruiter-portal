-- Add is_active column to users table to support account deactivation
ALTER TABLE public.users ADD COLUMN is_active BOOLEAN DEFAULT true NOT NULL;

-- Update RLS policies to check if user is active
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
CREATE POLICY "Users can view their own profile" ON public.users
  FOR SELECT USING (auth.uid() = id AND is_active = true);

-- Create function to check if current user is active
CREATE OR REPLACE FUNCTION public.is_current_user_active()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;