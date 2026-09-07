package models

import "time"

// สถานะของการมาตรวจหนึ่งครั้ง
//
// ใช้ค่าชุดเดียวกับ QueueStatus ใน react-frontend/src/pages/doctor/types.ts
// เก็บลงฐานข้อมูลด้วยค่านี้ตรงๆ จะได้ไม่ต้องแปลงไปมาระหว่างสองฝั่ง
const (
	VisitStatusWaiting         = "Waiting"          // คัดกรองแล้ว รอแพทย์เรียก
	VisitStatusScreened        = "Screened"         // ผ่านการคัดกรอง (สำรองไว้ให้ฝั่งพยาบาลใช้)
	VisitStatusExamining       = "Examining"        // แพทย์เรียกเข้าตรวจแล้ว
	VisitStatusPendingPharmacy = "Pending Pharmacy" // ตรวจจบ ส่งต่อห้องยา
	VisitStatusCompleted       = "Completed"        // จบกระบวนการของแพทย์
	VisitStatusCancelled       = "Cancelled"        // ยกเลิก
)

type VisitRecord struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	PatientID uint      `gorm:"not null" json:"patient_id"`
	DoctorID  uint      `json:"doctor_id"`
	VisitDate time.Time `json:"visit_date"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	// --- เพิ่มสำหรับ Role แพทย์ ---
	// เลข Visit Number ออกตอนแพทย์เรียกเข้าตรวจ
	// ใช้ index ธรรมดา ไม่ใช่ uniqueIndex เพราะแถวเดิมในฐานข้อมูลจะได้ค่า ''
	// ซึ่งจะชนกันเองทันทีที่ migrate (Postgres ถือว่า '' เป็นค่าหนึ่ง ไม่ใช่ NULL)
	VN         string     `gorm:"index" json:"vn"`
	Status     string     `gorm:"index;default:'waiting'" json:"status"` // waiting, examining, completed, cancelled
	Department string     `json:"department"`                            // ห้องตรวจที่รับ
	VisitType  string     `gorm:"default:'walk-in'" json:"visit_type"`   // walk-in, นัดหมาย, ฉุกเฉิน
	StartedAt  *time.Time `json:"started_at"`                            // เวลาที่แพทย์เรียกเข้าตรวจ (ใช้คำนวณเวลารอ)
	EndedAt    *time.Time `json:"ended_at"`                              // เวลาที่ปิดการตรวจ (ใช้ทำรายงาน)

	Doctor  User    `gorm:"foreignKey:DoctorID" json:"user"`
	Patient Patient `gorm:"foreignKey:PatientID" json:"patient"`
}

// ค่าที่ต้องวัดแยกไป table คัดกรอง
// แยกตารางคิว
// เช็คสิทธิ์ พนักงานสามารถสร้างข้อมูลสิทธิ์ แก้ไขได้ คือทำ mock up ตรวจสอบเหมือนเดิม แต่ต้องมีคนไปทำ ui บันทึกเอง table เดียวกัน
