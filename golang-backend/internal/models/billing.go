package models

import "time"

// บิล/ใบเสร็จรับเงิน (db)
type Billing struct {
	ID                      uint      `gorm:"primaryKey" json:"id"`                       //อันนี้เป็น primary key ของตาราง Billing
	VisitID                 uint      `gorm:"not null" json:"visit_id"`                   //อันนี้เป็น foreign key ที่เชื่อมกับตาราง VisitRecord
	TotalAmount             float64   `gorm:"not null;default:0" json:"total_amount"`     //อันนี้เป็นจำนวนเงินรวมทั้งหมดของบิล
	DiscountFromEligibility float64   `gorm:"default:0" json:"discount_from_eligibility"` //คือส่วนลดที่ได้จากสิทธิ์การรักษา
	NetAmount               float64   `gorm:"not null;default:0" json:"net_amount"`       //คือจำนวนเงินสุทธิหลังจากหักส่วนลดแล้ว
	PaymentMethod           string    `json:"payment_method"`                             //คือวิธีการชำระเงิน เช่น เงินสด บัตรเครดิต หรือโอนเงิน
	PaymentStatus           string    `gorm:"default:'pending'" json:"payment_status"`    //คือสถานะการชำระเงิน เช่น pending, paid, หรือ failed
	ReceiptNumber           string    `gorm:"uniqueIndex" json:"receipt_number"`          //คือหมายเลขใบเสร็จรับเงินที่ไม่ซ้ำกัน
	CreatedAt               time.Time `json:"created_at"`                                 //คือเวลาที่บิลถูกสร้างขึ้น
	UpdatedAt               time.Time `json:"updated_at"`                                 //คือเวลาที่บิลถูกแก้ไขล่าสุด

	VisitRecord VisitRecord `gorm:"foreignKey:VisitID" json:"visit_record"` //คือข้อมูลการเยี่ยมชมที่เกี่ยวข้องกับบิลนี้
}
