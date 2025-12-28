```sql
-- ProCalc Authentication System Migration
-- Execute this script in Supabase SQL Editor

-- 1. Utworzenie tabeli users
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('engineer', 'specialist', 'manager', 'logistics')),
  pending_role TEXT CHECK (pending_role IN ('engineer', 'specialist', 'manager', 'logistics')),
  approved BOOLEAN DEFAULT FALSE,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 1a. Aktualizacja tabeli users (jeśli istnieje)
DO $$
BEGIN
    -- Dodaj nową kolumnę pending_role (jeśli nie istnieje)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'pending_role') THEN
        ALTER TABLE public.users ADD COLUMN pending_role TEXT CHECK (pending_role IN ('engineer', 'specialist', 'manager', 'logistics'));
    END IF;

    -- Aktualizacja constrainta dla role (Drop & Add) aby uwzględnić 'logistics'
    ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
    ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('engineer', 'specialist', 'manager', 'logistics'));

    -- Aktualizacja constrainta dla pending_role
    ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_pending_role_check;
    ALTER TABLE public.users ADD CONSTRAINT users_pending_role_check CHECK (pending_role IN ('engineer', 'specialist', 'manager', 'logistics'));
    
    -- Migracja starych ról 'admin' -> 'manager' (dla wstecznej kompatybilności)
    UPDATE public.users SET role = 'manager' WHERE role = 'admin';
END $$;

-- 1b. Uzupełnienie brakujących profili (Backfill)
INSERT INTO public.users (id, email, full_name, role, approved, is_admin)
SELECT 
  id, 
  email, 
  raw_user_meta_data->>'full_name', 
  COALESCE(raw_user_meta_data->>'role', 'engineer'),
  CASE WHEN (SELECT count(*) FROM public.users) = 0 THEN TRUE ELSE FALSE END, -- Pierwszy user to admin
  CASE WHEN (SELECT count(*) FROM public.users) = 0 THEN TRUE ELSE FALSE END
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.users);

-- 2. Tabela calculations
CREATE TABLE IF NOT EXISTS public.calculations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  specialist TEXT,
  engineer TEXT,
  customer_name TEXT,
  project_id TEXT, -- Nr Projektu
  order_date TIMESTAMP WITH TIME ZONE,
  close_date TIMESTAMP WITH TIME ZONE,
  total_cost NUMERIC,
  total_price NUMERIC,
  is_locked BOOLEAN DEFAULT FALSE, -- [NEW] Mechanizm blokady edycji
  calc JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.1 Dodanie kolumny is_locked do calculations (jeśli nie istnieje)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calculations' AND column_name = 'is_locked') THEN
        ALTER TABLE public.calculations ADD COLUMN is_locked BOOLEAN DEFAULT FALSE;
    END IF;
END $$;


-- 3. Trigger do automatycznego tworzenia profilu użytkownika
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_count INTEGER;
  user_role TEXT;
BEGIN
  SELECT COUNT(*) INTO user_count FROM public.users;
  user_role := NEW.raw_user_meta_data->>'role';
  
  -- Pierwszy użytkownik to zawsze manager/admin
  IF user_count = 0 AND user_role IS NULL THEN
    user_role := 'manager';
  END IF;
  
  -- Mapowanie starego 'admin'
  IF user_role = 'admin' THEN
    user_role := 'manager';
  END IF;
  
  INSERT INTO public.users (id, email, full_name, role, approved, is_admin)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    user_role,
    CASE WHEN user_count = 0 THEN TRUE ELSE FALSE END,
    CASE WHEN user_count = 0 OR user_role = 'manager' THEN TRUE ELSE FALSE END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Usuń trigger jeśli istnieje i utwórz nowy
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Helper to check if user is admin without recursion
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND is_admin = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper to check if user can bypass lock (Logistics, Admin, Manager)
CREATE OR REPLACE FUNCTION public.can_bypass_lock()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND (role IN ('logistics', 'manager') OR is_admin = TRUE)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Helper to check if user is approved without recursion
CREATE OR REPLACE FUNCTION public.is_approved()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND approved = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RLS Policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calculations ENABLE ROW LEVEL SECURITY;

-- Usuń istniejące polityki jeśli istnieją
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.users;
DROP POLICY IF EXISTS "Admins can update profiles" ON public.users;
DROP POLICY IF EXISTS "Approved users can read own calculations" ON public.calculations;
DROP POLICY IF EXISTS "Approved users can insert calculations" ON public.calculations;
DROP POLICY IF EXISTS "Approved users can delete own calculations" ON public.calculations;

-- Polityki dla users:
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.users; -- Correct name
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.users; -- Old name cleanup
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.users;

-- Każdy widzi swój profil
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

-- Każdy zatwierdzony użytkownik widzi listę innych użytkowników (potrzebne do wyboru inżyniera/specjalisty)
CREATE POLICY "Users can view all profiles" ON public.users
  FOR SELECT USING (
    public.is_approved()
  );

-- Admin widzi wszystko (redundantne z powyższym, ale dla porządku)
-- ...

-- Update własnego profilu
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Admin może edytować wszystko
CREATE POLICY "Admins can update all profiles" ON public.users
  FOR UPDATE USING (public.is_admin());


-- Polityki dla calculations:
-- Polityki dla calculations:
DROP POLICY IF EXISTS "Users can view their own calculations" ON public.calculations;
DROP POLICY IF EXISTS "Users can view all calculations" ON public.calculations; -- Correct name
DROP POLICY IF EXISTS "Admins can view all calculations" ON public.calculations;
DROP POLICY IF EXISTS "Users can insert own calculations" ON public.calculations;
DROP POLICY IF EXISTS "Users can insert calculations" ON public.calculations; -- Correct name
DROP POLICY IF EXISTS "Users can update own calculations" ON public.calculations;
DROP POLICY IF EXISTS "Update calculations logic" ON public.calculations; -- Correct name
DROP POLICY IF EXISTS "Users can delete own calculations" ON public.calculations;
DROP POLICY IF EXISTS "Owner can delete own calculations" ON public.calculations; -- Correct name

-- SELECT: Wszyscy zatwierdzeni widzą wszystkie kalkulacje (wymaganie klienta)
-- SELECT: Wszyscy zatwierdzeni widzą wszystkie kalkulacje (wymaganie klienta)
CREATE POLICY "Users can view all calculations" ON public.calculations
  FOR SELECT USING (
    public.is_approved() OR public.is_admin()
  );

-- INSERT: Każdy zatwierdzony może dodawać
CREATE POLICY "Users can insert calculations" ON public.calculations
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    public.is_approved()
  );

-- UPDATE:
-- 1. Właściciel może edytować JEŚLI nie jest zablokowana (is_locked = FALSE)
-- 2. Admin lub Logistyka może edytować ZAWSZE (i zakładać/zdejmować blokadę)
CREATE POLICY "Update calculations logic" ON public.calculations
  FOR UPDATE USING (
    (auth.uid() = user_id AND is_locked = FALSE) OR -- Właściciel, niezablokowane
    public.can_bypass_lock() -- Logistyka, Manager lub Admin (zawsze)
  );

-- DELETE: Tylko właściciel może usuwać swoje kalkulacje (wymaganie klienta)
CREATE POLICY "Owner can delete own calculations" ON public.calculations
  FOR DELETE USING (auth.uid() = user_id);


-- 5. Indeksy dla lepszej wydajności
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_approved ON public.users(approved);
CREATE INDEX IF NOT EXISTS idx_calculations_user_id ON public.calculations(user_id);
CREATE INDEX IF NOT EXISTS idx_calculations_is_locked ON public.calculations(is_locked);

-- 6. Archiwizacja
-- Add is_archived column to calculations table
ALTER TABLE calculations
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;

-- Update existing records to have is_archived = false
UPDATE calculations SET is_archived = false WHERE is_archived IS NULL;
```
