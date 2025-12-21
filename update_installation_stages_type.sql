-- Update installation_stages to support different types of timeline items
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'installation_stages' AND column_name = 'stage_type') THEN
        ALTER TABLE public.installation_stages ADD COLUMN stage_type TEXT DEFAULT 'STAGE';
    END IF;
END $$;

-- Update sync logic in SupabaseStorage will handle the rest.
-- For backfill of custom items:
DO $$
DECLARE
    calc_record RECORD;
    custom_item JSONB;
BEGIN
    FOR calc_record IN SELECT id, calc FROM public.calculations_details LOOP
        FOR custom_item IN SELECT jsonb_array_elements(
                COALESCE(calc_record.calc->'appState'->'initial'->'installation'->'customTimelineItems', 
                         calc_record.calc->'appState'->'final'->'installation'->'customTimelineItems',
                         calc_record.calc->'installation'->'customTimelineItems',
                         '[]'::jsonb)
            ) LOOP
            
            INSERT INTO public.installation_stages (calculation_id, stage_id, name, start_date, end_date, progress, stage_type)
            VALUES (
                calc_record.id,
                custom_item->>'id',
                custom_item->>'name',
                (NULLIF(custom_item->>'startDate', ''))::DATE,
                (NULLIF(custom_item->>'endDate', ''))::DATE,
                0,
                'CUSTOM'
            )
            ON CONFLICT DO NOTHING;
        END LOOP;
    END LOOP;
END $$;
