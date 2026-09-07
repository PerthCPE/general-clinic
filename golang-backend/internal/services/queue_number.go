package services

import (
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"
)

var (
	ErrQueueNumberOverflow = errors.New("queue number exceeded maximum daily capacity of 65535 (QFFFF)")
)

// BangkokLocation returns the *time.Location for Asia/Bangkok (UTC+7)
func BangkokLocation() *time.Location {
	loc, err := time.LoadLocation("Asia/Bangkok")
	if err != nil {
		return time.FixedZone("Asia/Bangkok", 7*3600)
	}
	return loc
}

// NextQueueNumber generates an atomic, sequential queue number reset daily in Q0001 - QFFFF format
func NextQueueNumber(tx *gorm.DB, date time.Time) (string, error) {
	bkkDate := date.In(BangkokLocation())
	serviceDateStr := bkkDate.Format("2006-01-02")

	var lastNum int

	// Atomic upsert with RETURNING in PostgreSQL
	err := tx.Raw(`
		INSERT INTO queue_counters (service_date, last_number, created_at, updated_at)
		VALUES (?, 1, NOW(), NOW())
		ON CONFLICT (service_date)
		DO UPDATE SET last_number = queue_counters.last_number + 1, updated_at = NOW()
		RETURNING last_number
	`, serviceDateStr).Scan(&lastNum).Error

	if err != nil {
		return "", fmt.Errorf("failed to generate next queue number: %w", err)
	}

	if lastNum > 65535 {
		return "", ErrQueueNumberOverflow
	}

	return fmt.Sprintf("Q%04X", lastNum), nil
}
