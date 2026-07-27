package models

import (
	"gorm.io/gorm"
)

type FollowupAppointment struct {
	gorm.Model
	VisitID uint `gorm:"not null;uniqueIndex" json:"visit_id"`
	// Relation เชื่อมไปตารางหลักของเพื่อน
	VisitRecord VisitRecord `gorm:"foreignKey:VisitID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"visit_record,omitempty"`

	FollowupDate        string `json:"followup_date"`
	ReasonForFollowup   string `json:"reason_for_followup"`
	PatientInstructions string `json:"patient_instructions"`
}
