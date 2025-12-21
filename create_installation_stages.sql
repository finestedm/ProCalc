-- Migration to create relational installation_stages table
CREATE TABLE IF NOT EXISTS public.installation_stages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    calculation_id UUID REFERENCES public.calculations(id) ON DELETE CASCADE,
    stage_id TEXT NOT NULL, -- The ID from the JSON data
    name TEXT NOT NULL,
    start_date DATE,
    end_date DATE,
    progress NUMERIC DEFAULT 0,
    stage_type TEXT DEFAULT 'STAGE', -- [NEW] Distinguish standard stages from custom items
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookup by calculation
CREATE INDEX IF NOT EXISTS idx_installation_stages_calc_id ON public.installation_stages(calculation_id);

-- Enable RLS
ALTER TABLE public.installation_stages ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view all installation stages" ON public.installation_stages
  FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.calculations c
        WHERE c.id = public.installation_stages.calculation_id
        AND (public.is_approved() OR public.is_admin())
    )
  );

CREATE POLICY "Owner/Bypass can edit stages" ON public.installation_stages
  FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.calculations c
        WHERE c.id = public.installation_stages.calculation_id
        AND ((auth.uid() = c.user_id AND c.is_locked = FALSE) OR public.can_bypass_lock())
    )
  );

-- Backfill from existing JSON data
DO $$
DECLARE
    calc_record RECORD;
    stage_item JSONB;
BEGIN
    FOR calc_record IN SELECT id, calc FROM public.calculations_details LOOP
        FOR stage_item IN SELECT jsonb_array_elements(
                COALESCE(calc_record.calc->'appState'->'initial'->'installation'->'stages', 
                         calc_record.calc->'appState'->'final'->'installation'->'stages',
                         calc_record.calc->'installation'->'stages',
                         '[]'::jsonb)
            ) LOOP
            
            INSERT INTO public.installation_stages (calculation_id, stage_id, name, start_date, end_date, progress, stage_type)
            VALUES (
                calc_record.id,
                stage_item->>'id',
                stage_item->>'name',
                (NULLIF(stage_item->>'startDate', ''))::DATE,
                (NULLIF(stage_item->>'endDate', ''))::DATE,
                COALESCE((stage_item->>'progress')::NUMERIC, 0),
                'STAGE'
            )
            ON CONFLICT DO NOTHING;
        END LOOP;
    END LOOP;
END $$;
