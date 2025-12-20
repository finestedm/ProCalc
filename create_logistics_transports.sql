-- Create logistics_transports table
CREATE TABLE IF NOT EXISTS logistics_transports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_number TEXT NOT NULL,
    transport_id TEXT NOT NULL,
    
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_by UUID REFERENCES auth.users(id),
    
    UNIQUE(project_number, transport_id)
);

-- Safely add new relational columns if they don't exist
DO $$
BEGIN
    BEGIN
        ALTER TABLE logistics_transports ADD COLUMN calc_id UUID REFERENCES calculations(id);
    EXCEPTION
        WHEN duplicate_column THEN RAISE NOTICE 'column calc_id already exists in logistics_transports.';
    END;
    BEGIN
        ALTER TABLE logistics_transports ADD COLUMN supplier_id TEXT;
    EXCEPTION
        WHEN duplicate_column THEN RAISE NOTICE 'column supplier_id already exists in logistics_transports.';
    END;
    BEGIN
        ALTER TABLE logistics_transports ADD COLUMN carrier TEXT;
    EXCEPTION
        WHEN duplicate_column THEN RAISE NOTICE 'column carrier already exists in logistics_transports.';
    END;
    BEGIN
        ALTER TABLE logistics_transports ADD COLUMN delivery_date DATE;
    EXCEPTION
        WHEN duplicate_column THEN RAISE NOTICE 'column delivery_date already exists in logistics_transports.';
    END;
    BEGIN
        ALTER TABLE logistics_transports ADD COLUMN pickup_date DATE;
    EXCEPTION
        WHEN duplicate_column THEN RAISE NOTICE 'column pickup_date already exists in logistics_transports.';
    END;
END $$;

-- RLS
ALTER TABLE logistics_transports ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow authenticated users to read logistics_transports" ON logistics_transports;
DROP POLICY IF EXISTS "Allow authenticated users to insert/update logistics_transports" ON logistics_transports;

-- Re-create policies
CREATE POLICY "Allow authenticated users to read logistics_transports"
ON logistics_transports FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to insert/update logistics_transports"
ON logistics_transports FOR ALL TO authenticated
USING (true)
WITH CHECK (true);
