package models

import "time"

//สิทธิ์การรักษา(db) และ auto load patient data(go)
type MedicalEligibility struct {
	ID					uint		`gorm:"primaryKey" json:"id"`
	PatientID			uint		`gorm:"uniqueIndex;not null" json:"patient_id"`
	SchemeType			string		`gorm:"not null" json:"scheme_type"`
	CoverageDetails		string		`json:"coverage_details"`
	VerifiedAt			time.Time	`json:"verified_at"`
	
	Patient				Patient		`gorm:"foreignKey:PatientID" json:"patient"`
}