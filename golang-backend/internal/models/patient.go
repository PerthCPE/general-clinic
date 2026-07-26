package models

import "time"

//ข้อมูลของผู้ป่วย(db)
type Patient struct {
	ID               uint      `gorm:"primaryKey" json:"id"`
	NationalID       string    `gorm:"uniqueIndex;not null" json:"national_id"`
	FullName         string    `gorm:"not null" json:"fullname"`
	BirthDate        time.Time `gorm:"not null" json:"birthdate"`
	Address          string    `json:"address"`
	PhoneNumber      string    `gorm:"not null" json:"phone_number"`
	EmergencyContact string    `json:"emergency_contact"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}
