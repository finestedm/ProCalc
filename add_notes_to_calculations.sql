-- Migration to add project_notes column to calculations table
ALTER TABLE public.calculations ADD COLUMN IF NOT EXISTS project_notes TEXT;

-- Backfill from EXISTING data
UPDATE public.calculations c
SET project_notes = COALESCE(cd.calc->'appState'->'initial'->>'projectNotes', 
                             cd.calc->'appState'->'final'->>'projectNotes',
                             cd.calc->>'projectNotes',
                             '')
FROM public.calculations_details cd
WHERE c.id = cd.id 
AND (c.project_notes IS NULL OR c.project_notes = '');
