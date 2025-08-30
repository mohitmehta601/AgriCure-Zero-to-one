/*
  # Add sowing date field to farms table

  1. Schema Changes
    - Add `sowing_date` column to `farms` table
    - Column type: DATE (allows null for existing records)
    - Add index for performance on date queries

  2. Benefits
    - Track planting schedules for better farm management
    - Enable seasonal analysis and recommendations
    - Support crop rotation planning
*/

-- Add sowing_date column to farms table
ALTER TABLE farms 
ADD COLUMN IF NOT EXISTS sowing_date DATE;

-- Add index for performance on date-based queries
CREATE INDEX IF NOT EXISTS idx_farms_sowing_date ON farms(sowing_date);

-- Add comment for documentation
COMMENT ON COLUMN farms.sowing_date IS 'Date when the crop was sown/planted in this farm field';

-- Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'farms' 
AND column_name = 'sowing_date';