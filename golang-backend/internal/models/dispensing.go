package models

import "time"

// รายการจ่ายยาให้ผู้ป่วย (db) (2) ตารางบุญ
type Dispensing struct {
	ID           uint      `gorm:"primaryKey" json:"id"` //คือรหัสประจำตัวของรายการจ่ายยา
	VisitID      uint      `gorm:"not null" json:"visit_id"`
	MedicineID   uint      `gorm:"not null" json:"medicine_id"`
	Quantity     int       `gorm:"not null" json:"quantity"`
	Dosage       string    `json:"dosage"`
	Instructions string    `json:"instructions"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`

	VisitRecord VisitRecord `gorm:"foreignKey:VisitID" json:"visit_record"`
	Medicine    Medicine    `gorm:"foreignKey:MedicineID" json:"medicine"`

	DoctorID uint   `json:"doctor_id"`                         // ดึงข้อมูลจาก VisitRecord เพื่อให้ได้ DoctorID ของแพทย์ที่สั่งจ่ายยา
	Doctor   Doctor `gorm:"foreignKey:DoctorID" json:"doctor"` // ดึงข้อมูล Doctor โดยใช้ DoctorID เป็น foreign key
}
