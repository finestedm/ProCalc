-- FIX: 502 Bad Gateway / Infinite Recursion in RLS
-- Run this in the Supabase SQL Editor

-- 1. Drop the potentially recursive policy
DROP POLICY IF EXISTS "Users can view all profiles" ON public.users;

-- 2. Make sure the is_approved function is owned by postgres (to bypass RLS when called via SECURITY DEFINER)
-- Note: You might need to be a superuser/owner to run this.
ALTER FUNCTION public.is_approved() OWNER TO postgres;

-- 3. Re-create the policy (it should be safe now if the function bypasses RLS)
CREATE POLICY "Users can view all profiles" ON public.users
  FOR SELECT USING (
    public.is_approved()
  );

-- 4. Alternative Safer Function (If the above fails)
-- This function reads directly from matching ID without complex logic, 
-- but ensuring OWNER TO postgres is the key.
CREATE OR REPLACE FUNCTION public.is_approved()
RETURNS BOOLEAN AS $$
BEGIN
  -- This query runs with the privileges of the function owner (postgres)
  -- so it bypasses RLS on public.users, preventing the loop.
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND approved = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
ALTER FUNCTION public.is_approved() OWNER TO postgres;

-- 5. Diagnostic: Check if you can read your own user
-- SELECT * FROM public.users WHERE id = auth.uid();
