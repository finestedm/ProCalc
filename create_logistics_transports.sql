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

-- RLS
ALTER TABLE logistics_transports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read logistics_transports"
ON logistics_transports FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to insert/update logistics_transports"
ON logistics_transports FOR ALL TO authenticated
USING (true)
WITH CHECK (true);
