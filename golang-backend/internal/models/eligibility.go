package models

import "time"

// สิทธิ์การรักษา (Medical Eligibility Entity)
type MedicalEligibility struct {
	ID              uint      `gorm:"primaryKey" json:"id"`
	PatientID       *uint     `gorm:"index" json:"patient_id"` // ใส่ * เพื่อให้เป็นสิทธิ์ของพนักงานแทนได้
	UserID          *uint     `gorm:"index" json:"user_id"`    // เพิ่มการเชื่อมสิทธิ์ของพนักงาน
	SchemeType      string    `gorm:"not null" json:"scheme_type"`
	CoverageDetails string    `json:"coverage_details"`
	HospitalName    string    `json:"hospital_name"`
	Status          string    `json:"status"` // ใช้งานได้, หมดอายุ, รอตรวจสอบ
	ExpireDate      string    `json:"expire_date"`
	VerifiedAt      time.Time `json:"verified_at"`

	Patient Patient `gorm:"foreignKey:PatientID" json:"patient"`
	User    User    `gorm:"foreignKey:UserID" json:"user"` // ดึงข้อมูลพนักงานมาโชว์คู่กับสิทธิ์ได้
}
