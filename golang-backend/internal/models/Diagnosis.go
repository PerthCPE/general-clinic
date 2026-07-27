package models

import (
	"gorm.io/gorm"
)

type Diagnosis struct {
	gorm.Model
	VisitID uint `gorm:"not null;index" json:"visit_id"`
	// Relation เชื่อมไปตารางหลักของเพื่อน
	VisitRecord VisitRecord `gorm:"foreignKey:VisitID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"visit_record,omitempty"`

	ICD10Code       string `json:"icd10_code"`
	DiagnosisName   string `json:"diagnosis_name"`
	IsPrimary       bool   `json:"is_primary"`
	AssessmentNotes string `json:"assessment_notes"`
	TreatmentPlan   string `json:"treatment_plan"`
}
