-- Add Owner role and extend admin check to include Owner
-- Insert role 'owner' if it does not already exist
INSERT INTO public.roles (name, description)
SELECT 'owner', 'Highest privilege role above admin'
WHERE NOT EXISTS (
  SELECT 1 FROM public.roles WHERE name = 'owner'
);

-- Update is_current_user_admin to include owners as admins
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users p
    JOIN public.roles r ON p.role_id = r.id
    WHERE p.id = auth.uid() AND r.name IN ('admin', 'owner')
  );
END;
$function$;