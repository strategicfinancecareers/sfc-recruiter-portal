-- Update Sarah/Sara Johnson to anonymized, role-based display name
UPDATE public.candidates
SET display_name = 'Senior Corporate Accountant (CPA)'
WHERE lower(name) IN ('sara johnson', 'sarah johnson');