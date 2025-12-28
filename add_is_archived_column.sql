-- Add is_archived column to calculations table
ALTER TABLE calculations
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;

-- Update existing records to have is_archived = false (if null, though default handles new ones)
UPDATE calculations SET is_archived = false WHERE is_archived IS NULL;
