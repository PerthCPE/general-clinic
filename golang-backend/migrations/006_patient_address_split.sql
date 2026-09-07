-- Migration 006: Add structured address columns to patients table
-- Preserves existing address column and data intact (100% backwards compatible)

DO $$
BEGIN
    -- 1. Add house_no (บ้านเลขที่)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'patients' AND column_name = 'house_no'
    ) THEN
        ALTER TABLE patients ADD COLUMN house_no VARCHAR(50);
    END IF;

    -- 2. Add village_no (หมู่ที่)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'patients' AND column_name = 'village_no'
    ) THEN
        ALTER TABLE patients ADD COLUMN village_no VARCHAR(20);
    END IF;

    -- 3. Add village_name (ชื่อหมู่บ้าน/อาคาร)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'patients' AND column_name = 'village_name'
    ) THEN
        ALTER TABLE patients ADD COLUMN village_name VARCHAR(150);
    END IF;

    -- 4. Add alley (ซอย/ตรอก)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'patients' AND column_name = 'alley'
    ) THEN
        ALTER TABLE patients ADD COLUMN alley VARCHAR(150);
    END IF;

    -- 5. Add road (ถนน)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'patients' AND column_name = 'road'
    ) THEN
        ALTER TABLE patients ADD COLUMN road VARCHAR(150);
    END IF;

    -- 6. Add sub_district (ตำบล/แขวง)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'patients' AND column_name = 'sub_district'
    ) THEN
        ALTER TABLE patients ADD COLUMN sub_district VARCHAR(150);
    END IF;

    -- 7. Add district (อำเภอ/เขต - DEFAULT '')
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'patients' AND column_name = 'district'
    ) THEN
        ALTER TABLE patients ADD COLUMN district VARCHAR(150) NOT NULL DEFAULT '';
    END IF;

    -- 8. Add province (จังหวัด - DEFAULT '')
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'patients' AND column_name = 'province'
    ) THEN
        ALTER TABLE patients ADD COLUMN province VARCHAR(150) NOT NULL DEFAULT '';
    END IF;

    -- 9. Add postal_code (รหัสไปรษณีย์)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'patients' AND column_name = 'postal_code'
    ) THEN
        ALTER TABLE patients ADD COLUMN postal_code VARCHAR(5);
    END IF;
END $$;
