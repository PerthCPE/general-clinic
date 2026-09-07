-- Migration 001: Convert triage_level from string to integer (1-4)
-- Canonical Mapping:
-- 1 = ฉุกเฉินวิกฤต (Resuscitation)
-- 2 = ฉุกเฉินเร่งด่วน (Urgent / Emergency)
-- 3 = กึ่งฉุกเฉิน (Semi-Urgent)
-- 4 = ปกติ (Normal)

DO $$
BEGIN
    -- 1. Check if triage_level is not yet integer
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'screenings' 
          AND column_name = 'triage_level' 
          AND data_type IN ('text', 'character varying')
    ) THEN
        -- Temporarily map existing textual values to integers
        UPDATE screenings
        SET triage_level = CASE
            WHEN triage_level LIKE '%วิกฤต%' OR triage_level LIKE '%Resuscitation%' OR triage_level = '1' THEN '1'
            WHEN triage_level LIKE '%กึ่ง%' OR triage_level LIKE '%Semi-Urgent%' OR triage_level = '3' THEN '3'
            WHEN triage_level LIKE '%ฉุกเฉิน%' OR triage_level LIKE '%เร่งด่วน%' OR triage_level LIKE '%Urgent%' OR triage_level LIKE '%Emergency%' OR triage_level = '2' THEN '2'
            WHEN triage_level LIKE '%ปกติ%' OR triage_level LIKE '%Normal%' OR triage_level = '4' THEN '4'
            ELSE '4'
        END;

        -- Alter column to integer
        ALTER TABLE screenings 
        ALTER COLUMN triage_level TYPE integer USING (triage_level::integer);
    END IF;

    -- 2. Ensure column is not null and has default 4
    ALTER TABLE screenings ALTER COLUMN triage_level SET DEFAULT 4;
    ALTER TABLE screenings ALTER COLUMN triage_level SET NOT NULL;

    -- 3. Add CHECK constraint if it does not already exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage 
        WHERE table_name = 'screenings' 
          AND constraint_name = 'chk_screenings_triage_level'
    ) THEN
        ALTER TABLE screenings 
        ADD CONSTRAINT chk_screenings_triage_level CHECK (triage_level BETWEEN 1 AND 4);
    END IF;
END $$;
