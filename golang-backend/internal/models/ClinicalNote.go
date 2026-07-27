package models

import (
	"gorm.io/gorm"
)

type ClinicalNote struct {
	gorm.Model
	VisitID uint `gorm:"not null;uniqueIndex" json:"visit_id"`
	// Relation เชื่อมไปตารางหลักของเพื่อน (ทำให้ Supabase วาดเส้นเชื่อม FK)
	VisitRecord VisitRecord `gorm:"foreignKey:VisitID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"visit_record,omitempty"`

	SymptomDuration       string `json:"symptom_duration"`
	PresentIllness        string `json:"present_illness"`
	NurseNotes            string `json:"nurse_notes"`
	ImportantDoctorAlerts string `json:"important_doctor_alerts"`

	// Physical Examination System Findings
	PhysicalGeneral     string `json:"physical_general"`
	PhysicalHEENT       string `json:"physical_heent"`
	PhysicalCardio      string `json:"physical_cardio"`
	PhysicalRespiratory string `json:"physical_respiratory"`
	PhysicalAbdomen     string `json:"physical_abdomen"`
	PhysicalMSK         string `json:"physical_msk"`
}
