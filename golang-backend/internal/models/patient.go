package models

import "time"

// ข้อมูลของผู้ป่วย (Patient Entity)
type Patient struct {
	ID               uint      `gorm:"primaryKey" json:"id"`
	HN               string    `gorm:"uniqueIndex" json:"hn"`
	NationalID       string    `gorm:"uniqueIndex;not null" json:"national_id"`
	FullName         string    `gorm:"not null" json:"fullname"`
	Gender           string    `json:"gender"`
	BirthDate        time.Time `gorm:"not null" json:"birthdate"`
	Address          string    `json:"address"`
	PhoneNumber      string    `gorm:"not null" json:"phone_number"`
	EmergencyContact string    `json:"emergency_contact"`
	SchemeType       string    `json:"scheme_type"`
	Allergies        string    `json:"allergies"`
	ChronicDiseases  string    `json:"chronic_diseases"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}
