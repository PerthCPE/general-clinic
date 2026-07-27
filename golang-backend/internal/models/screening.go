package models

import "time"

type Screening struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	VisitID        uint      `gorm:"not null" json:"visit_id"`
	TriageLevel    string    `json:"triage_level"`
	ChiefComplaint string    `json:"chief_complaint"`
	Allergies      string    `json:"allergies"`
	MedicalHistory string    `json:"medical_history"`
	Weight         float64   `json:"weight"`
	Height         float64   `json:"height"`
	BMI            float64   `json:"bmi"`
	Temperature    float64   `json:"temperature"`
	SystolicBP     int       `json:"systolic_bp"`
	DiastolicBP    int       `json:"diastolic_bp"`
	HeartRate      int       `json:"heart_rate"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`

	VisitRecord VisitRecord `gorm:"foreignKey:VisitID" json:"visit_record"`
}
