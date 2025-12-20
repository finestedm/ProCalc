-- Add columns for personnel IDs to calculations table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calculations' AND column_name = 'engineer_id') THEN
        ALTER TABLE public.calculations ADD COLUMN engineer_id UUID REFERENCES public.users(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calculations' AND column_name = 'specialist_id') THEN
        ALTER TABLE public.calculations ADD COLUMN specialist_id UUID REFERENCES public.users(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calculations' AND column_name = 'sales_person_1_id') THEN
        ALTER TABLE public.calculations ADD COLUMN sales_person_1_id UUID REFERENCES public.users(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calculations' AND column_name = 'sales_person_2_id') THEN
        ALTER TABLE public.calculations ADD COLUMN sales_person_2_id UUID REFERENCES public.users(id);
    END IF;
END $$;
