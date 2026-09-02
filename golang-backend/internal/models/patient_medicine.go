package models

import "time"

// PatientMedicine — ตารางแยกสำหรับระบบจ่ายยาและการเงิน
// เก็บข้อมูลผู้ป่วยที่เข้ารับการรักษา แสดงในหน้า Frontend ของเภสัชกร
type PatientMedicine struct {
	ID              uint      `gorm:"primaryKey" json:"id"`
	HN              string    `gorm:"uniqueIndex" json:"hn"`
	NationalID      string    `json:"national_id"`
	FullName        string    `gorm:"not null" json:"fullname"`
	Gender          string    `json:"gender"`
	Age             int       `json:"age"`
	BloodType       string    `json:"blood_type"`
	SchemeType      string    `json:"scheme_type"`
	Allergies       string    `json:"allergies"`
	ChronicDiseases string    `json:"chronic_diseases"`
	VisitCount      int       `gorm:"default:0" json:"visit_count"`
	PhoneNumber     string    `json:"phone_number"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// TableName กำหนดชื่อตารางใน DB
func (PatientMedicine) TableName() string {
	return "patient_medicines"
}
