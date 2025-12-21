-- Migration to add all missing metadata columns for performance optimization
DO $$
BEGIN
    -- Core Metadata
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calculations' AND column_name = 'project_id') THEN
        ALTER TABLE public.calculations ADD COLUMN project_id TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calculations' AND column_name = 'project_stage') THEN
        ALTER TABLE public.calculations ADD COLUMN project_stage TEXT DEFAULT 'DRAFT';
    END IF;

    -- Financials
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calculations' AND column_name = 'total_cost') THEN
        ALTER TABLE public.calculations ADD COLUMN total_cost NUMERIC DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calculations' AND column_name = 'total_price') THEN
        ALTER TABLE public.calculations ADD COLUMN total_price NUMERIC DEFAULT 0;
    END IF;

    -- Dates
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calculations' AND column_name = 'order_date') THEN
        ALTER TABLE public.calculations ADD COLUMN order_date DATE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calculations' AND column_name = 'close_date') THEN
        ALTER TABLE public.calculations ADD COLUMN close_date DATE;
    END IF;

    -- Status & Sync
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calculations' AND column_name = 'is_locked') THEN
        ALTER TABLE public.calculations ADD COLUMN is_locked BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calculations' AND column_name = 'logistics_status') THEN
        ALTER TABLE public.calculations ADD COLUMN logistics_status TEXT;
    END IF;

    -- Personnel IDs
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calculations' AND column_name = 'specialist_id') THEN
        ALTER TABLE public.calculations ADD COLUMN specialist_id UUID;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calculations' AND column_name = 'engineer_id') THEN
        ALTER TABLE public.calculations ADD COLUMN engineer_id UUID;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calculations' AND column_name = 'sales_person_1_id') THEN
        ALTER TABLE public.calculations ADD COLUMN sales_person_1_id UUID;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calculations' AND column_name = 'sales_person_2_id') THEN
        ALTER TABLE public.calculations ADD COLUMN sales_person_2_id UUID;
    END IF;

END $$;

-- Backfill from calculations_details
UPDATE public.calculations c
SET 
  project_id = COALESCE(cd.calc->'appState'->'initial'->'meta'->>'projectNumber', cd.calc->'meta'->>'projectNumber', 'BezNumeru'),
  project_stage = COALESCE(cd.calc->>'stage', cd.calc->'appState'->>'stage', 'DRAFT'),
  total_price = COALESCE((cd.calc->'appState'->>'manualPrice')::NUMERIC, (cd.calc->'totalPrice')::NUMERIC, 0),
  is_locked = COALESCE((cd.calc->'appState'->>'isLocked')::BOOLEAN, FALSE),
  order_date = (NULLIF(cd.calc->'appState'->'initial'->'meta'->>'orderDate', ''))::DATE,
  close_date = (NULLIF(cd.calc->'appState'->'initial'->'meta'->>'protocolDate', ''))::DATE
FROM public.calculations_details cd
WHERE c.id = cd.id;
