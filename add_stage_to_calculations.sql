-- Migration to add project_stage column to calculations table
ALTER TABLE public.calculations ADD COLUMN IF NOT EXISTS project_stage TEXT;

-- Backfill project_stage from calc JSONB
UPDATE public.calculations 
SET project_stage = COALESCE(calc->>'stage', calc->'appState'->>'stage', 'DRAFT')
WHERE project_stage IS NULL;
