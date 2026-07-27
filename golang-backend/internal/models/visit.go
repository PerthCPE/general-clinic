package models

import "time"

type VisitRecord struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	PatientID uint      `gorm:"not null" json:"patient_id"`
	DoctorID  uint      `json:"doctor_id"`
	VisitDate time.Time `json:"visit_date"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	Doctor  User    `gorm:"foreignKey:DoctorID" json:"user"`
	Patient Patient `gorm:"foreignKey:PatientID" json:"patient"`
}

// ค่าที่ต้องวัดแยกไป table คัดกรอง
// แยกตารางคิว
// เช็คสิทธิ์ พนักงานสามารถสร้างข้อมูลสิทธิ์ แก้ไขได้ คือทำ mock up ตรวจสอบเหมือนเดิม แต่ต้องมีคนไปทำ ui บันทึกเอง table เดียวกัน
