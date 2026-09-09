-- Migration 007: Create partial unique index on queues for active queues per patient per day
-- Ensures at most one active queue exists per patient per service date

CREATE UNIQUE INDEX IF NOT EXISTS idx_active_queue_per_patient
ON queues (patient_id, service_date)
WHERE status NOT IN ('เสร็จสิ้น', 'ยกเลิกคิว', 'ยกเลิก');
