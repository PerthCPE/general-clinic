package models

import "time"

// ข้อมูลการนัดหมาย (อ้างอิงจาก Appointment diagram)
type Appointment struct {
	ID              uint      `gorm:"primaryKey" json:"id"` // appointmentID
	DoctorID        uint      `gorm:"not null" json:"doctor_id"`
	PatientID       uint      `gorm:"not null" json:"patient_id"`
	RegisterID      *uint     `json:"register_id"` // User ที่รับนัด Registrar (optional)
	AppointmentDate string    `gorm:"type:date;not null" json:"appointment_date"`
	AppointmentTime string    `gorm:"type:time;not null" json:"appointment_time"`
	// ค่าเริ่มต้นตอนสร้างคือ "รอยืนยัน" ให้ตรงกับตัวเลือกที่ dropdown ฝั่งหน้าบ้านใช้จริง
	// (เดิมเคยเป็น "scheduled" ซึ่งไม่ตรงกับตัวเลือกไหนเลย — นัดหมายเก่าที่ยังเป็นค่านี้อยู่ใน DB
	// ไม่ได้ถูกแก้ย้อนหลัง แต่ backend จะ normalize เป็น "รอยืนยัน" ตอนส่งออกเสมอ ดู normalizeStatus())
	Status          string    `gorm:"default:'รอยืนยัน'" json:"status"`
	// แผนกการรักษา — ค่าเทียบได้ตรงๆ (ตรงกับ doctors.specialty) ไม่ใช่ข้อความฝังใน ClinicalNote แบบเดิม
	// ไม่มี endpoint ไหนแก้ไขคอลัมน์นี้ได้หลังสร้างนัดหมายแล้ว โดยตั้งใจ
	Department      string    `gorm:"default:''" json:"department"`
	ClinicalNote    string    `json:"clinical_note"`
	// ฟิลด์เสริมสำหรับฟอร์มนัดหมายแบบคลินิกทั่วไป — ทั้งหมด optional ไม่บังคับกรอก
	// นัดหมายเก่าก่อนมีคอลัมน์เหล่านี้จะได้ค่าว่าง ('') ไม่กระทบโค้ดเดิม
	AppointmentType  string   `gorm:"default:''" json:"appointment_type"`  // ประเภทนัด: ติดตามอาการ/ฟังผลตรวจ/ทำหัตถการ/อื่นๆ
	Reason           string   `gorm:"default:''" json:"reason"`            // เหตุผลการนัด
	PrepInstructions string   `gorm:"default:''" json:"prep_instructions"` // คำแนะนำก่อนมาตามนัด เช่น งดน้ำงดอาหาร
	// ข้อมูลการยกเลิกนัด — optional ทั้งหมด มีค่าเฉพาะนัดหมายที่ถูกยกเลิกผ่าน CancelAppointment เท่านั้น
	CancelReason string     `gorm:"default:''" json:"cancel_reason"`
	CancelledBy  *uint      `json:"cancelled_by"`
	CancelledAt  *time.Time `json:"cancelled_at"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`

	Doctor          User    `gorm:"foreignKey:DoctorID" json:"doctor"`
	Patient         Patient   `gorm:"foreignKey:PatientID" json:"patient"`
	Register        User      `gorm:"foreignKey:RegisterID" json:"register"` // ใช้ User แทนพนักงานเวชระเบียน
	CancelledByUser User      `gorm:"foreignKey:CancelledBy" json:"cancelled_by_user"`
}
