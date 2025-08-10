-- Ensure trigger exists to insert into public.users when a new auth user is created
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE t.tgname = 'on_auth_user_created'
      AND n.nspname = 'auth'
      AND c.relname = 'users'
  ) THEN
    CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;

-- Backfill any missing rows in public.users from existing auth.users
INSERT INTO public.users (id, email, first_name, last_name, role_id, has_accepted_terms)
SELECT
  u.id,
  u.email,
  COALESCE(
    u.raw_user_meta_data->>'first_name',
    CASE
      WHEN position(' ' in COALESCE(u.raw_user_meta_data->>'full_name', '')) > 0 THEN split_part(u.raw_user_meta_data->>'full_name', ' ', 1)
      ELSE u.raw_user_meta_data->>'full_name'
    END
  ) AS first_name,
  COALESCE(
    u.raw_user_meta_data->>'last_name',
    CASE
      WHEN position(' ' in COALESCE(u.raw_user_meta_data->>'full_name', '')) > 0 THEN substring(u.raw_user_meta_data->>'full_name' from position(' ' in u.raw_user_meta_data->>'full_name') + 1)
      ELSE NULL
    END
  ) AS last_name,
  (SELECT id FROM public.roles WHERE name = 'recruiter') AS role_id,
  FALSE AS has_accepted_terms
FROM auth.users u
LEFT JOIN public.users p ON p.id = u.id
WHERE p.id IS NULL;

-- Promote the specified user to admin (and ensure active)
UPDATE public.users
SET role_id = (SELECT id FROM public.roles WHERE name = 'admin'),
    is_active = TRUE
WHERE email = 'zuhayr.daya@gmail.com';