-- Create access_requests table
CREATE TABLE IF NOT EXISTS public.access_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  calculation_id UUID REFERENCES public.calculations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

-- Policies for public.access_requests
DROP POLICY IF EXISTS "Users can view own requests" ON public.access_requests;
DROP POLICY IF EXISTS "Users can create requests" ON public.access_requests;
DROP POLICY IF EXISTS "Managers and logistics can view all requests" ON public.access_requests;
DROP POLICY IF EXISTS "Managers and logistics can update requests" ON public.access_requests;

-- 1. Users can view their own requests
CREATE POLICY "Users can view own requests" ON public.access_requests
  FOR SELECT USING (auth.uid() = user_id);

-- 2. Users can create requests
CREATE POLICY "Users can create requests" ON public.access_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 3. Managers and logistics can view all requests
CREATE POLICY "Managers and logistics can view all requests" ON public.access_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND (role IN ('logistics', 'manager') OR is_admin = TRUE)
    )
  );

-- 4. Managers and logistics can update requests (to approve/reject)
CREATE POLICY "Managers and logistics can update requests" ON public.access_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND (role IN ('logistics', 'manager') OR is_admin = TRUE)
    )
  );

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_access_requests_calculation_id ON public.access_requests(calculation_id);
CREATE INDEX IF NOT EXISTS idx_access_requests_status ON public.access_requests(status);
