-- Create roles table
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default roles
INSERT INTO roles (name, description) VALUES 
  ('recruiter', 'Standard recruiter role with access to candidate search and job posting'),
  ('admin', 'Administrator with full system access'),
  ('candidate', 'Job candidate with profile management access');

-- Add role_id column to profiles table
ALTER TABLE profiles ADD COLUMN role_id UUID REFERENCES roles(id);

-- Migrate existing role data to use role_id
UPDATE profiles SET role_id = (
  SELECT id FROM roles WHERE name = profiles.role::text
);

-- Make role_id NOT NULL after migration
ALTER TABLE profiles ALTER COLUMN role_id SET NOT NULL;

-- Drop existing policies that depend on the role column
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

-- Drop the old role column (CASCADE to remove dependent objects)
ALTER TABLE profiles DROP COLUMN role CASCADE;

-- Drop the app_role enum since we're using the roles table now
DROP TYPE app_role;

-- Enable RLS on roles table
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- Create policy for roles table (everyone can read roles)
CREATE POLICY "Anyone can view roles" ON roles
  FOR SELECT USING (true);

-- Create function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles p
    JOIN roles r ON p.role_id = r.id
    WHERE p.id = auth.uid() AND r.name = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Create new admin policies using the function
CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (public.is_current_user_admin());

CREATE POLICY "Admins can update all profiles" ON profiles
  FOR UPDATE USING (public.is_current_user_admin());

-- Update the handle_new_user function to use role_id
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role_id, has_accepted_terms)
  VALUES (
    NEW.id, 
    NEW.email, 
    NEW.raw_user_meta_data->>'name', 
    (SELECT id FROM roles WHERE name = 'recruiter'),
    FALSE
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;