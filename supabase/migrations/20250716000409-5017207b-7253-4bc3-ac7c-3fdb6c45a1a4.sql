-- Create demo users with known passwords
-- Insert demo admin user
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  email_change_confirm_status,
  raw_user_meta_data
) VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'admin@demo.com',
  crypt('admin123', gen_salt('bf')),
  now(),
  now(),
  now(),
  0,
  '{"first_name": "Demo", "last_name": "Admin"}'::jsonb
) ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  encrypted_password = EXCLUDED.encrypted_password,
  raw_user_meta_data = EXCLUDED.raw_user_meta_data;

-- Insert demo recruiter user
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  email_change_confirm_status,
  raw_user_meta_data
) VALUES (
  '00000000-0000-0000-0000-000000000002'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'recruiter@demo.com',
  crypt('recruiter123', gen_salt('bf')),
  now(),
  now(),
  now(),
  0,
  '{"first_name": "Demo", "last_name": "Recruiter"}'::jsonb
) ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  encrypted_password = EXCLUDED.encrypted_password,
  raw_user_meta_data = EXCLUDED.raw_user_meta_data;

-- Get role IDs and create profiles
DO $$
DECLARE
  admin_role_id uuid;
  recruiter_role_id uuid;
BEGIN
  -- Get admin role ID
  SELECT id INTO admin_role_id FROM public.roles WHERE name = 'admin';
  
  -- Get recruiter role ID  
  SELECT id INTO recruiter_role_id FROM public.roles WHERE name = 'recruiter';
  
  -- Insert or update admin profile
  INSERT INTO public.profiles (
    id,
    email,
    first_name,
    last_name,
    role_id,
    has_accepted_terms,
    created_at,
    updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000001'::uuid,
    'admin@demo.com',
    'Demo',
    'Admin',
    admin_role_id,
    true,
    now(),
    now()
  ) ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    role_id = EXCLUDED.role_id,
    has_accepted_terms = EXCLUDED.has_accepted_terms,
    updated_at = now();
    
  -- Insert or update recruiter profile
  INSERT INTO public.profiles (
    id,
    email,
    first_name,
    last_name,
    role_id,
    has_accepted_terms,
    created_at,
    updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000002'::uuid,
    'recruiter@demo.com',
    'Demo',
    'Recruiter',
    recruiter_role_id,
    true,
    now(),
    now()
  ) ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    role_id = EXCLUDED.role_id,
    has_accepted_terms = EXCLUDED.has_accepted_terms,
    updated_at = now();
END $$;