package models

import "time"

type Queue struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	PatientID   uint      `gorm:"not null" json:"patient_id"`
	QueueNumber string    `json:"queue_number"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`

	Patient Patient `gorm:"foreignKey:PatientID" json:"patient"`
}
