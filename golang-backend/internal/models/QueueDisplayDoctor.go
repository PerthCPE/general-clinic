package models

import (
	"gorm.io/gorm"
)

type QueueDisplayDoctor struct {
	gorm.Model
	QueueID uint `gorm:"not null;uniqueIndex" json:"queue_id"`
	// Relation เชื่อมไปตาราง Queue ของเพื่อน
	Queue Queue `gorm:"foreignKey:QueueID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"queue,omitempty"`

	ChiefComplaint string `json:"chief_complaint"`
}
