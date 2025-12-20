-- Add logistics_status column to calculations
ALTER TABLE public.calculations 
ADD COLUMN IF NOT EXISTS logistics_status TEXT CHECK (logistics_status IN ('PENDING', 'PROCESSED'));

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_calculations_logistics_status ON public.calculations(logistics_status);

-- Function to lock entire project
CREATE OR REPLACE FUNCTION public.lock_project(p_project_id TEXT, p_lock_state BOOLEAN)
RETURNS VOID AS $$
BEGIN
  -- Validate input
  IF p_project_id IS NULL OR p_project_id = 'BezNumeru' THEN
    RETURN;
  END IF;

  UPDATE public.calculations
  SET is_locked = p_lock_state
  WHERE project_id = p_project_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
