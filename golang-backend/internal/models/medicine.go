package models

import "time"

// ข้อมูลคลังยา (db)
type Medicine struct {
	ID            uint      `gorm:"primaryKey" json:"id"`                      //คือรหัสประจำตัวของยาในฐานข้อมูล
	MedicineCode  string    `gorm:"uniqueIndex;not null" json:"medicine_code"` //คือรหัสเฉพาะของยา
	Name          string    `gorm:"not null" json:"name"`                      //คือชื่อของยา
	StockQuantity int       `gorm:"not null;default:0" json:"stock_quantity"`  //คือจำนวนคงเหลือของยาในคลัง
	UnitPrice     float64   `gorm:"not null" json:"unit_price"`                //คือราคาต่อหน่วยของยา
	CreatedAt     time.Time `json:"created_at"`                                //คือเวลาที่ข้อมูลยาถูกสร้างขึ้น
	UpdatedAt     time.Time `json:"updated_at"`                                //คือเวลาที่ข้อมูลยาถูกแก้ไขล่าสุด
}
