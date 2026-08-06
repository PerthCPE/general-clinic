package models

import "time"

// ข้อมูลแพทย์ (db) เชื่อมกับ User ผ่าน UserID (4) ตารางบุญ
type Doctor struct {
	DoctorID      uint      `gorm:"primaryKey" json:"doctor_id"`
	UserID        uint      `gorm:"uniqueIndex;not null" json:"user_id"`
	FullName      string    `gorm:"not null" json:"full_name"`
	LicenseNumber string    `gorm:"uniqueIndex" json:"license_number"`
	Specialty     string    `json:"specialty"`
	Phone         string    `json:"phone"`
	Email         string    `json:"email"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}
