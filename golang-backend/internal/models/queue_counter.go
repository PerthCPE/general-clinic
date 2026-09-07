package models

import "time"

type QueueCounter struct {
	ServiceDate time.Time `gorm:"primaryKey;type:date" json:"service_date"`
	LastNumber  int       `gorm:"not null;default:0" json:"last_number"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
