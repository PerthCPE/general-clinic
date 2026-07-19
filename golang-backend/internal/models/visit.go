package models

import "time"

type VisitRecord struct {
	ID				uint		`gorm:"primaryKey" json:"id"`
	PatientID		uint		`gorm:"not null" json:"patient_id"`
	QueueNumber		string		`gorm:"not null" json:"queue"`
	Status			string		`gorm:"not null" json:"status"`
	TriageLevel		string		`json:"triage_level"`
	Weight			float64		`json:"weight"`
	Height			float64		`json:"height"`
	BMI				float64		`json:"bmi"`
	SystolicBP		int			`json:"systolic_bp"`
	DiastolicBP		int			`json:"diastolic_bp"`
	HeartRate		int			`json:"heart_rate"`
	Temperature		float64		`json:"temperature"`
	ChiefComplaint	string		`json:"chief_complaint"`
	Allergies		string		`json:"allergies"`
	MedicalHistory	string		`json:"medical_history"`
	CreatedAt		time.Time	`json:"created_at"` 
	UpdatedAt		time.Time	`json:"updated_at"` 

	Patient			Patient		`gorm:"foreignKey:PatientID" json:"patient"`
}