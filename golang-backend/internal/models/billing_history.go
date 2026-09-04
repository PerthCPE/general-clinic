package models

import "time"

// BillingHistory - ตารางประวัติการชำระเงินและออกใบเสร็จ สำหรับแสดงบน Dashboard
type BillingHistory struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	ReceiptNumber string    `gorm:"uniqueIndex" json:"receipt_number"`
	VisitID       uint      `json:"visit_id"`
	HN            string    `gorm:"not null;index" json:"hn"`
	PatientName   string    `gorm:"not null" json:"patient_name"`
	NationalID    string    `json:"national_id"`
	DoctorName    string    `json:"doctor_name"`
	TotalAmount   float64   `gorm:"not null;default:0" json:"total_amount"`
	Discount      float64   `gorm:"default:0" json:"discount"`
	NetAmount     float64   `gorm:"not null;default:0" json:"net_amount"`
	PaymentMethod string    `gorm:"not null" json:"payment_method"` // "QR Code", "เงินสด", "บัตรเครดิต"
	PaymentStatus string    `gorm:"not null;default:'completed'" json:"payment_status"`
	Medications   string    `json:"medications"` // JSON string
	CashReceived  float64   `gorm:"default:0" json:"cash_received"`
	ChangeAmount  float64   `gorm:"default:0" json:"change_amount"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}
