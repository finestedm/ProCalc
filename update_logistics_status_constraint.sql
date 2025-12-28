-- Migration to allow 'CORRECTION' status in the logistics queue
-- 1. Drop the old constraint
ALTER TABLE public.calculations 
DROP CONSTRAINT IF EXISTS calculations_logistics_status_check;

-- 2. Add the new expanded constraint
ALTER TABLE public.calculations 
ADD CONSTRAINT calculations_logistics_status_check 
CHECK (logistics_status IN ('PENDING', 'PROCESSED', 'CORRECTION'));
