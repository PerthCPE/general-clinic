-- Migration 002: Queue number daily sequence & unique constraint
-- Tracks daily queue counters for atomic reset and enforces unique queue number per day

-- 1. Create queue_counters table
CREATE TABLE IF NOT EXISTS queue_counters (
    service_date DATE PRIMARY KEY,
    last_number INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Add service_date to queues table if missing
ALTER TABLE queues ADD COLUMN IF NOT EXISTS service_date DATE DEFAULT CURRENT_DATE;

-- 3. Populate existing rows with date from created_at
UPDATE queues SET service_date = DATE(created_at AT TIME ZONE 'Asia/Bangkok') WHERE service_date IS NULL;

-- 4. Create unique index for queue number per service date
CREATE UNIQUE INDEX IF NOT EXISTS idx_queue_daily ON queues (service_date, queue_number);
