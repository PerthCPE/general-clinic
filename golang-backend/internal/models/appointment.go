package models

import "time"

// ข้อมูลการนัดหมาย (อ้างอิงจาก Appointment diagram)
type Appointment struct {
	ID              uint      `gorm:"primaryKey" json:"id"` // appointmentID
	DoctorID        uint      `gorm:"not null" json:"doctor_id"`
	PatientID       uint      `gorm:"not null" json:"patient_id"`
	RegisterID      uint      `gorm:"not null" json:"register_id"` // ผูกกับ User ที่เป็น Registrar
	AppointmentDate string    `gorm:"type:date;not null" json:"appointment_date"`
	AppointmentTime string    `gorm:"type:time;not null" json:"appointment_time"`
	Status          string    `gorm:"default:'scheduled'" json:"status"`
	ClinicalNote    string    `json:"clinical_note"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`

	Doctor          User    `gorm:"foreignKey:DoctorID" json:"doctor"`
	Patient         Patient   `gorm:"foreignKey:PatientID" json:"patient"`
	Register        User      `gorm:"foreignKey:RegisterID" json:"register"` // ใช้ User แทนพนักงานเวชระเบียน
}
