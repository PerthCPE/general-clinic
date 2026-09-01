package models

import "time"

// ข้อมูลแพทย์ (db) เชื่อมกับ User ผ่าน UserID (4) ตารางบุญ
//
// หมายเหตุการออกแบบ: ตารางนี้เป็น "โปรไฟล์เสริม" ของแพทย์เท่านั้น
// FK ที่ชี้ไปหาตัวแพทย์ในตารางอื่น (visit_records.doctor_id,
// screenings.assigned_doctor_id, queues.assigned_doctor_id) ให้ชี้ไปที่
// users.id ทั้งหมด เพื่อให้สอดคล้องกับ JWT และ GetDoctors ที่มีอยู่เดิม
type Doctor struct {
	DoctorID      uint      `gorm:"primaryKey" json:"doctor_id"`
	UserID        uint      `gorm:"uniqueIndex;not null" json:"user_id"`
	FullName      string    `gorm:"not null" json:"full_name"`
	LicenseNumber string    `gorm:"uniqueIndex" json:"license_number"`
	Specialty     string    `json:"specialty"`
	Phone         string    `json:"phone"`
	Email         string    `json:"email"`
	Room          string    `json:"room"`                          // ห้องตรวจประจำ
	IsActive      bool      `gorm:"default:true" json:"is_active"` // ปิดการใช้งานแทนการลบ
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`

	User User `gorm:"foreignKey:UserID" json:"user"`
}
