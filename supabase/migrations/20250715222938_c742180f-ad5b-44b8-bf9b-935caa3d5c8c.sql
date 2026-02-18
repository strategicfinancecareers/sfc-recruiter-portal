-- Move role back to profiles table and remove user_roles table

-- Add role column to profiles table
ALTER TABLE profiles ADD COLUMN role app_role DEFAULT 'recruiter' NOT NULL;

-- Migrate existing role data from user_roles to profiles
UPDATE profiles 
SET role = ur.role 
FROM user_roles ur 
WHERE profiles.id = ur.user_id;

-- Drop the user_roles table and related policies
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON user_roles;
DROP TABLE user_roles;

-- Update RLS policies to use the role column directly
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (role = 'admin');

CREATE POLICY "Admins can update all profiles" ON profiles
  FOR UPDATE USING (role = 'admin');

-- Update the handle_new_user function to set role directly on profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, has_accepted_terms)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'name', 'recruiter', FALSE);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the security definer functions that are no longer needed
DROP FUNCTION IF EXISTS public.has_role(_user_id UUID, _role app_role);
DROP FUNCTION IF EXISTS public.get_current_user_roles();