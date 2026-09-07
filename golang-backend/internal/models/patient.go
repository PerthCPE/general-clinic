package models

import "time"

// ข้อมูลของผู้ป่วย (Patient Entity) — ตารางเดิม patients (อย่ายุ่ง!)
type Patient struct {
	ID               uint      `gorm:"primaryKey" json:"id"`
	HN               string    `gorm:"uniqueIndex" json:"hn"`
	NationalID       string    `gorm:"uniqueIndex;not null" json:"national_id"`
	FullName         string    `gorm:"not null" json:"fullname"`
	Gender           string    `json:"gender"`
	BirthDate        time.Time `gorm:"not null" json:"birthdate"`

	// Structured Address Fields (Sprint 3)
	HouseNo          string    `gorm:"type:varchar(50)" json:"house_no"`
	VillageNo        string    `gorm:"type:varchar(20)" json:"village_no"`
	VillageName      string    `gorm:"type:varchar(150)" json:"village_name"`
	Alley            string    `gorm:"type:varchar(150)" json:"alley"`
	Road             string    `gorm:"type:varchar(150)" json:"road"`
	SubDistrict      string    `gorm:"type:varchar(150)" json:"sub_district"`
	District         string    `gorm:"type:varchar(150);default:''" json:"district"`
	Province         string    `gorm:"type:varchar(150);default:''" json:"province"`
	PostalCode       string    `gorm:"type:varchar(5)" json:"postal_code"`

	// Legacy: ข้อความที่อยู่แบบเต็ม คงไว้เพื่อความเข้ากันได้กับข้อมูลเดิม
	//         และโมดูลอื่นที่อาจอ่านฟิลด์นี้ (ใบเสร็จ/ใบรับรองแพทย์/หน้าจอแพทย์)
	Address          string    `json:"address"`
	PhoneNumber      string    `gorm:"not null" json:"phone_number"`
	EmergencyContact string    `json:"emergency_contact"`
	SchemeType       string    `json:"scheme_type"`
	Allergies        string    `json:"allergies"`
	ChronicDiseases  string    `json:"chronic_diseases"`
	CreatedAt        time.Time     `json:"created_at"`
	UpdatedAt        time.Time     `json:"updated_at"`

	Appointments     []Appointment `gorm:"foreignKey:PatientID" json:"appointments"`
}
