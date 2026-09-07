-- Migration 003: Idempotency & Traceability for VisitRecord
-- Adds queue_id and queue_number to visit_records and enforces partial unique index on queue_id

-- 1. Add queue_id and queue_number to visit_records
ALTER TABLE visit_records ADD COLUMN IF NOT EXISTS queue_id BIGINT;
ALTER TABLE visit_records ADD COLUMN IF NOT EXISTS queue_number VARCHAR(20) DEFAULT '';

-- 2. Create partial unique index on queue_id for non-null visits
CREATE UNIQUE INDEX IF NOT EXISTS idx_visit_queue_unique ON visit_records (queue_id) WHERE queue_id IS NOT NULL;

-- 3. Create index for fast queue_number lookup
CREATE INDEX IF NOT EXISTS idx_visit_records_queue_number ON visit_records (queue_number);
