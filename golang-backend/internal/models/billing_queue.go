package models

import "time"

// BillingQueue - ตารางคิวสำหรับการเงินโดยเฉพาะ เพื่อรับช่วงต่อจากห้องยา
type BillingQueue struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	QueueNumber  string    `gorm:"not null" json:"queue_number"`
	HN           string    `gorm:"not null;index" json:"hn"`
	PatientName  string    `gorm:"not null" json:"patient_name"`
	NationalID   string    `json:"national_id"`
	Gender       string    `json:"gender"`
	Age          int       `json:"age"`
	SchemeType   string    `json:"scheme_type"` // สิทธิการรักษา
	VisitID      uint      `gorm:"not null" json:"visit_id"`
	TotalAmount  float64   `gorm:"not null;default:0" json:"total_amount"`
	Status       string    `gorm:"not null;default:'pending'" json:"status"` // pending, paid, cancelled
	DoctorAdvice string    `json:"doctor_advice"`
	Medications  string    `json:"medications"` // JSON string ของรายการยา
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`

	VisitRecord VisitRecord `gorm:"foreignKey:VisitID" json:"visit_record"`
}
