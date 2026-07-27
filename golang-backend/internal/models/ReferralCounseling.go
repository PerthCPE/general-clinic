package models

import (
	"gorm.io/gorm"
)

type ReferralCounseling struct {
	gorm.Model
	VisitID uint `gorm:"not null;uniqueIndex" json:"visit_id"`
	// Relation เชื่อมไปตารางหลักของเพื่อน
	VisitRecord VisitRecord `gorm:"foreignKey:VisitID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"visit_record,omitempty"`

	ReferralDepartment   string `json:"referral_department"`
	ReasonForReferral    string `json:"reason_for_referral"`
	MedicationDietAdvice string `json:"medication_diet_advice"`
	LifestyleGuidance    string `json:"lifestyle_guidance"`
}
