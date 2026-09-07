package models

import "time"

// MedicineQueue - ตารางคิวสำหรับห้องยาโดยเฉพาะ (แยกตารางอิสระจากตารางคิวอื่น)
type MedicineQueue struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	QueueNumber  string    `gorm:"not null" json:"queue_number"`
	HN           string    `gorm:"not null;index" json:"hn"`
	PatientName  string    `gorm:"not null" json:"patient_name"`
	NationalID   string    `json:"national_id"`
	Gender       string    `json:"gender"`
	Age          int       `json:"age"`
	SchemeType   string    `json:"scheme_type"` // สิทธิการรักษา
	VisitID      uint      `gorm:"not null" json:"visit_id"`
	DoctorAdvice string    `json:"doctor_advice"`
	Status       string    `gorm:"not null;default:'pending'" json:"status"` // pending, dispensed, cancelled
	Medications  string    `json:"medications"`                              // JSON string ของรายการยาที่แพทย์สั่ง
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`

	VisitRecord VisitRecord `gorm:"foreignKey:VisitID" json:"visit_record"`
}

// TableName กำหนดชื่อตารางใน DB ให้เป็น medicine_queues
func (MedicineQueue) TableName() string {
	return "medicine_queues"
}
