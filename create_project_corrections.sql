-- Create project_corrections table
CREATE TABLE IF NOT EXISTS public.project_corrections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  calculation_id UUID REFERENCES public.calculations(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL, -- Human readable project number
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'resolved')),
  points JSONB NOT NULL, -- Array of correction points
  requested_by TEXT,
  requested_by_id UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.project_corrections ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Everyone can view corrections" ON public.project_corrections;
DROP POLICY IF EXISTS "Logistics and managers can manage corrections" ON public.project_corrections;
DROP POLICY IF EXISTS "Approved users can resolve corrections" ON public.project_corrections;

-- 1. Everyone can view corrections for projects they have access to
-- (For simplicity, mirroring calculations RLS: approved users can see all)
CREATE POLICY "Everyone can view corrections" ON public.project_corrections
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND approved = TRUE
    )
  );

-- 2. Logistics and managers can manage all corrections
CREATE POLICY "Logistics and managers can manage corrections" ON public.project_corrections
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND (role IN ('logistics', 'manager') OR is_admin = TRUE)
    )
  );

-- 3. Engineers/Specialists can mark corrections as resolved
CREATE POLICY "Approved users can resolve corrections" ON public.project_corrections
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND approved = TRUE
    )
  )
  WITH CHECK (
    status = 'resolved'
  );

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_project_corrections_calculation_id ON public.project_corrections(calculation_id);
CREATE INDEX IF NOT EXISTS idx_project_corrections_status ON public.project_corrections(status);
CREATE INDEX IF NOT EXISTS idx_project_corrections_project_id ON public.project_corrections(project_id);
