-- Add potentially missing columns to calculations table
ALTER TABLE public.calculations ADD COLUMN IF NOT EXISTS engineer_id UUID REFERENCES auth.users(id);
ALTER TABLE public.calculations ADD COLUMN IF NOT EXISTS specialist_id UUID REFERENCES auth.users(id);
ALTER TABLE public.calculations ADD COLUMN IF NOT EXISTS sales_person_1_id UUID REFERENCES auth.users(id);
ALTER TABLE public.calculations ADD COLUMN IF NOT EXISTS sales_person_2_id UUID REFERENCES auth.users(id);

-- Also ensure text equivalents exist if used
ALTER TABLE public.calculations ADD COLUMN IF NOT EXISTS engineer TEXT;
ALTER TABLE public.calculations ADD COLUMN IF NOT EXISTS specialist TEXT;

-- Reload the schema cache is usually automatic, but just in case we can force a notify or just trust the client to retry.
-- This script should strictly handle the schema addition.
