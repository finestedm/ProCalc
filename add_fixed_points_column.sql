ALTER TABLE project_corrections 
ADD COLUMN IF NOT EXISTS fixed_points INTEGER[] DEFAULT '{}';
