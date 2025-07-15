-- Update the handle_new_user function to handle OAuth users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_first_name TEXT;
  user_last_name TEXT;
  full_name TEXT;
BEGIN
  -- Extract first_name and last_name from metadata
  user_first_name := NEW.raw_user_meta_data->>'first_name';
  user_last_name := NEW.raw_user_meta_data->>'last_name';
  full_name := NEW.raw_user_meta_data->>'full_name';
  
  -- If we don't have separate names but have full_name (OAuth providers like Google)
  IF (user_first_name IS NULL OR user_last_name IS NULL) AND full_name IS NOT NULL THEN
    -- Split full_name into first and last name
    IF position(' ' in full_name) > 0 THEN
      user_first_name := split_part(full_name, ' ', 1);
      user_last_name := substring(full_name from position(' ' in full_name) + 1);
    ELSE
      user_first_name := full_name;
      user_last_name := NULL;
    END IF;
  END IF;
  
  INSERT INTO public.profiles (id, email, first_name, last_name, role_id, has_accepted_terms)
  VALUES (
    NEW.id, 
    NEW.email, 
    user_first_name,
    user_last_name,
    (SELECT id FROM roles WHERE name = 'recruiter'),
    FALSE
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;