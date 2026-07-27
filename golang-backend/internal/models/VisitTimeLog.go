package models

import (
	"time"

	"gorm.io/gorm"
)

type VisitTimeLog struct {
	gorm.Model
	VisitID uint `json:"visit_id"`
	// Relation เชื่อมไปตารางหลักของเพื่อน
	VisitRecord VisitRecord `gorm:"foreignKey:VisitID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"visit_record,omitempty"`

	QueueID uint `json:"queue_id"`
	// Relation เชื่อมไปตาราง Queue ของเพื่อน
	Queue Queue `gorm:"foreignKey:QueueID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"queue,omitempty"`

	CheckInTime   time.Time  `json:"check_in_time"`
	ExamStartTime *time.Time `json:"exam_start_time"`
	ExamEndTime   *time.Time `json:"exam_end_time"`
	WaitTimeMin   float64    `json:"wait_time_min"`
	ExamDuration  float64    `json:"exam_duration"`
}
