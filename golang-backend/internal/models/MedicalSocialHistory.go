package models

import (
	"gorm.io/gorm"
)

type MedicalSocialHistory struct {
	gorm.Model
	PatientID uint `gorm:"not null;index" json:"patient_id"`
	// Relation เชื่อมไปตาราง Patient ของเพื่อน
	Patient Patient `gorm:"foreignKey:PatientID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"patient,omitempty"`

	DrugAllergies      string `json:"drug_allergies"`
	FoodAllergies      string `json:"food_allergies"`
	CurrentMedications string `json:"current_medications"`
	SmokingHistory     string `json:"smoking_history"`
	AlcoholDrinking    string `json:"alcohol_drinking"`
}
