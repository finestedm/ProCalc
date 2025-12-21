-- Migration to split calculations table into metadata and detail tables
-- 1. Create the details table
CREATE TABLE IF NOT EXISTS public.calculations_details (
    id UUID PRIMARY KEY REFERENCES public.calculations(id) ON DELETE CASCADE,
    calc JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Migrate existing data
INSERT INTO public.calculations_details (id, calc)
SELECT id, calc FROM public.calculations
ON CONFLICT (id) DO UPDATE SET calc = EXCLUDED.calc;

-- 3. Enable RLS on the new table
ALTER TABLE public.calculations_details ENABLE ROW LEVEL SECURITY;

-- 4. Policies for calculations_details
-- Use same logic as calculations: everyone approved can read, owner or bypass can update

CREATE POLICY "Users can view all calculation details" ON public.calculations_details
  FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.calculations c
        WHERE c.id = public.calculations_details.id
        AND (public.is_approved() OR public.is_admin())
    )
  );

CREATE POLICY "Owner/Bypass can update details" ON public.calculations_details
  FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.calculations c
        WHERE c.id = public.calculations_details.id
        AND ((auth.uid() = c.user_id AND c.is_locked = FALSE) OR public.can_bypass_lock())
    )
  );

CREATE POLICY "Owner can insert details" ON public.calculations_details
  FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.calculations c
        WHERE c.id = public.calculations_details.id
        AND auth.uid() = c.user_id
    )
  );

-- 5. Note: We keep the 'calc' column in 'calculations' for now to prevent breaking the app 
-- until the code is fully updated. We will drop it in a separate step or just stop using it.
-- ALTER TABLE public.calculations DROP COLUMN calc; 
