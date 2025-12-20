-- Consolidated Fix for Logistics and Locking
-- 1. Ensure `logistics_status` column exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calculations' AND column_name = 'logistics_status') THEN
        ALTER TABLE public.calculations ADD COLUMN logistics_status TEXT CHECK (logistics_status IN ('PENDING', 'PROCESSED'));
        CREATE INDEX IF NOT EXISTS idx_calculations_logistics_status ON public.calculations(logistics_status);
    END IF;
END $$;

-- 2. Ensure `is_locked` column exists (should be in supabase_migration, but ensuring here)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calculations' AND column_name = 'is_locked') THEN
        ALTER TABLE public.calculations ADD COLUMN is_locked BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- 3. Correct `project_id` column type if it acts as numeric
-- The error "column project_id is of type numeric" implies a schema mismatch.
-- Project Numbers (e.g. "2024-123") must be TEXT.
DO $$
BEGIN
    -- Check if it is not text (e.g. numeric) and convert it
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'calculations' 
        AND column_name = 'project_id' 
        AND data_type != 'text'
    ) THEN
        ALTER TABLE public.calculations ALTER COLUMN project_id TYPE TEXT USING project_id::text;
    END IF;
END $$;

-- 4. Backfill `project_id`
UPDATE public.calculations
SET project_id = NULLIF(COALESCE(
  calc->'appState'->'initial'->'meta'->>'projectNumber',
  calc->'initial'->'meta'->>'projectNumber',
  calc->'meta'->>'projectNumber'
), '')
WHERE (project_id IS NULL OR project_id = '' OR project_id = 'BezNumeru')
  AND calc IS NOT NULL;

-- 4. Ensure RLS policies allow update of `logistics_status` and `is_locked` for Logistics/Manager roles
-- (Assuming `supabase_migration.sql` policies are active, they rely on `can_bypass_lock()` which is good)
