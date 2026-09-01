package models

import "time"

// Patient_Hisstory — ตารางใหม่ patient_histories (5) บุญ
// เก็บข้อมูลผู้ป่วยสำหรับระบบจ่ายยาและการเงิน (แยกจากตาราง patients เดิม)
type Patient_Hisstory struct {
	ID               uint      `gorm:"primaryKey" json:"id"`
	HN               string    `gorm:"uniqueIndex" json:"hn"`
	NationalID       string    `gorm:"uniqueIndex;not null" json:"national_id"`
	FullName         string    `gorm:"not null" json:"fullname"`
	Gender           string    `json:"gender"`
	Age              int       `json:"age"`
	BloodType        string    `json:"blood_type"`
	BirthDate        time.Time `json:"birthdate"`
	Address          string    `json:"address"`
	PhoneNumber      string    `json:"phone_number"`
	EmergencyContact string    `json:"emergency_contact"`
	SchemeType       string    `json:"scheme_type"`
	Allergies        string    `json:"allergies"`
	ChronicDiseases  string    `json:"chronic_diseases"`
	VisitCount       int       `gorm:"default:0" json:"visit_count"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

// TableName กำหนดชื่อตารางใน DB ให้ตรงกับ Supabase
func (Patient_Hisstory) TableName() string {
	return "patient_histories"
}
