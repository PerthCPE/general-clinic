package models

import "time"

type Queue struct {
	ID              uint      `gorm:"primaryKey" json:"id"`
	PatientID       uint      `gorm:"not null" json:"patient_id"`
	CreatedByUserID uint      `json:"created_by_user_id"` // เจ้าหน้าที่ลงทะเบียนที่ออกคิวให้
	QueueNumber     string    `gorm:"not null" json:"queue_number"`
	Status          string    `gorm:"not null" json:"status"` // รอคัดกรอง, รอพบแพทย์, กำลังตรวจ, เสร็จสิ้น, ยกเลิกคิว
	Department      string    `json:"department"`             // แผนกคัดกรอง, ห้องตรวจ 1, ห้องตรวจ 2, ฯลฯ
	Note            string    `json:"note"`                   // หมายเหตุเพิ่มเติม
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`

	Patient   Patient `gorm:"foreignKey:PatientID" json:"patient"`
	CreatedBy User    `gorm:"foreignKey:CreatedByUserID" json:"created_by"` // ดึงข้อมูล Registrar ผู้ออกคิว
}
