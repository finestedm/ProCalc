-- Fix RLS for users table to allow all authenticated users to see profiles
-- This is necessary for the personnel selection suggestions to work
DROP POLICY IF EXISTS "Users can view all profiles" ON public.users;

CREATE POLICY "Authenticated users can view profiles" ON public.users
    FOR SELECT
    TO authenticated
    USING (true);
