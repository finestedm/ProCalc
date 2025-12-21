-- Final migration step to remove the 'calc' column from the main table
-- This resolves the "null value in column calc violates not-null constraint" error
-- because the code now writes to calculations_details instead.

DO $$
BEGIN
    -- Only drop if it exists to avoid errors on re-run
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calculations' AND column_name = 'calc') THEN
        ALTER TABLE public.calculations DROP COLUMN calc;
    END IF;
END $$;
