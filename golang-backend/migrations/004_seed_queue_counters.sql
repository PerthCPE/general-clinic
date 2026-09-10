-- Migration 004: Seed & Synchronize queue_counters from historical queues
-- Converts hexadecimal queue_numbers (e.g. Q0001..QFFFF) to integers and seeds queue_counters for all historical service dates

INSERT INTO queue_counters (service_date, last_number, created_at, updated_at)
SELECT 
    service_date,
    COALESCE(MAX(('x' || lpad(SUBSTRING(queue_number FROM 2), 8, '0'))::bit(32)::bigint), 0) AS last_number,
    NOW(),
    NOW()
FROM queues
WHERE service_date IS NOT NULL 
  AND queue_number ~* '^Q[0-9A-Fa-f]{1,4}$'
GROUP BY service_date
ON CONFLICT (service_date) DO UPDATE
SET last_number = GREATEST(queue_counters.last_number, EXCLUDED.last_number),
    updated_at = NOW();
