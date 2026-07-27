package models

import (
	"gorm.io/gorm"
)

type Prescription struct {
	gorm.Model
	VisitID uint `gorm:"not null;index" json:"visit_id"`
	// Relation เชื่อมไปตารางหลักของเพื่อน
	VisitRecord VisitRecord `gorm:"foreignKey:VisitID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"visit_record,omitempty"`

	MedicineName string `json:"medicine_name"`
	Dosage       string `json:"dosage"`
	Frequency    string `json:"frequency"`
	Duration     string `json:"duration"`
	Quantity     int    `json:"quantity"`
	Route        string `json:"route"`
	MealTiming   string `json:"meal_timing"`
}
