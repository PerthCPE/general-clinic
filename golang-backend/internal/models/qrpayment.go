package models

import "time"

// QR Code สำหรับชำระเงิน (db) (4) บุญ
type QRPayment struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	BillingID   uint      `gorm:"not null" json:"billing_id"`
	QRCodeData  string    `gorm:"not null" json:"qr_code_data"`
	PromptPayID string    `gorm:"not null" json:"promptpay_id"`
	Amount      float64   `gorm:"not null" json:"amount"`
	Status      string    `gorm:"default:'pending'" json:"status"`
	ExpiredAt   time.Time `json:"expired_at"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`

	Billing Billing `gorm:"foreignKey:BillingID" json:"billing"`
}
