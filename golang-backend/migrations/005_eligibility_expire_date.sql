-- Migration 005: Convert medical_eligibilities.expire_date from VARCHAR to DATE
-- Handles DD/MM/YYYY, YYYY-MM-DD, and Buddhist Era years, setting unparseable dates to NULL

DO $$
BEGIN
    -- 1. Check if expire_date is varchar / text
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'medical_eligibilities' 
          AND column_name = 'expire_date' 
          AND data_type IN ('character varying', 'text', 'varchar')
    ) THEN
        -- 2. Format existing values into ISO-8601 YYYY-MM-DD
        UPDATE medical_eligibilities
        SET expire_date = CASE
            -- Already YYYY-MM-DD format
            WHEN expire_date ~ '^\d{4}-\d{2}-\d{2}$' THEN expire_date
            -- DD/MM/YYYY CE format (e.g. 31/12/2026)
            WHEN expire_date ~ '^\d{2}/\d{2}/\d{4}$' AND (SUBSTRING(expire_date FROM 7 FOR 4))::int < 2400 THEN 
                TO_CHAR(TO_DATE(expire_date, 'DD/MM/YYYY'), 'YYYY-MM-DD')
            -- DD/MM/YYYY BE format (e.g. 31/12/2569)
            WHEN expire_date ~ '^\d{2}/\d{2}/\d{4}$' AND (SUBSTRING(expire_date FROM 7 FOR 4))::int >= 2400 THEN 
                TO_CHAR(TO_DATE((SUBSTRING(expire_date FROM 1 FOR 6) || ((SUBSTRING(expire_date FROM 7 FOR 4))::int - 543)::text), 'DD/MM/YYYY'), 'YYYY-MM-DD')
            ELSE NULL
        END;

        -- 3. Alter column to DATE type
        ALTER TABLE medical_eligibilities 
        ALTER COLUMN expire_date TYPE date 
        USING (expire_date::date);
    END IF;
END $$;
