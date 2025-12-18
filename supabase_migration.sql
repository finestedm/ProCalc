-- ProCalc Authentication System Migration
-- Execute this script in Supabase SQL Editor

-- 1. Utworzenie tabeli users
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('engineer', 'specialist', 'admin')),
  approved BOOLEAN DEFAULT FALSE,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Dodanie kolumny user_id do calculations
ALTER TABLE public.calculations 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE CASCADE;

-- 3. Trigger do automatycznego tworzenia profilu użytkownika
-- Pierwszy użytkownik jest automatycznie adminem i zatwierdzony
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_count INTEGER;
  user_role TEXT;
BEGIN
  -- Sprawdź ile użytkowników już istnieje
  SELECT COUNT(*) INTO user_count FROM public.users;
  
  -- Pobierz rolę z metadanych użytkownika
  user_role := NEW.raw_user_meta_data->>'role';
  
  -- Pierwszy użytkownik (user_count = 0) jest automatycznie adminem i zatwierdzony
  -- Jeśli to pierwszy użytkownik i wybrał rolę 'admin', zachowaj ją
  -- W przeciwnym razie dla pierwszego użytkownika ustaw 'admin'
  IF user_count = 0 AND user_role IS NULL THEN
    user_role := 'admin';
  END IF;
  
  INSERT INTO public.users (id, email, full_name, role, approved, is_admin)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    user_role,
    CASE WHEN user_count = 0 THEN TRUE ELSE FALSE END,
    CASE WHEN user_count = 0 OR user_role = 'admin' THEN TRUE ELSE FALSE END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Usuń trigger jeśli istnieje i utwórz nowy
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Row Level Security (RLS) Policies

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calculations ENABLE ROW LEVEL SECURITY;

-- Usuń istniejące polityki jeśli istnieją
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.users;
DROP POLICY IF EXISTS "Admins can update profiles" ON public.users;
DROP POLICY IF EXISTS "Approved users can read own calculations" ON public.calculations;
DROP POLICY IF EXISTS "Approved users can insert calculations" ON public.calculations;
DROP POLICY IF EXISTS "Approved users can delete own calculations" ON public.calculations;

-- Users: każdy może czytać swój profil
CREATE POLICY "Users can read own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

-- Users: admini mogą czytać wszystkie profile
CREATE POLICY "Admins can read all profiles"
  ON public.users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- Users: admini mogą aktualizować profile (zatwierdzać)
CREATE POLICY "Admins can update profiles"
  ON public.users FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- Calculations: tylko zatwierdzeni użytkownicy mogą czytać swoje projekty
CREATE POLICY "Approved users can read own calculations"
  ON public.calculations FOR SELECT
  USING (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND approved = TRUE
    )
  );

-- Calculations: tylko zatwierdzeni użytkownicy mogą tworzyć projekty
CREATE POLICY "Approved users can insert calculations"
  ON public.calculations FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND approved = TRUE
    )
  );

-- Calculations: tylko zatwierdzeni użytkownicy mogą usuwać swoje projekty
CREATE POLICY "Approved users can delete own calculations"
  ON public.calculations FOR DELETE
  USING (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND approved = TRUE
    )
  );

-- 5. Indeksy dla lepszej wydajności
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_approved ON public.users(approved);
CREATE INDEX IF NOT EXISTS idx_calculations_user_id ON public.calculations(user_id);
