package models

import "time"

// ข้อมูลคลังยา (db) (3) ตารางบุญ
type Medicine struct {
	ID            uint      `gorm:"primaryKey" json:"id"`                      //คือรหัสประจำตัวของยาในฐานข้อมูล
	MedicineCode  string    `gorm:"uniqueIndex;not null" json:"medicine_code"` //คือรหัสเฉพาะของยา
	Name          string    `gorm:"not null" json:"name"`                      //คือชื่อของยา
	GenericName   string    `json:"generic_name"`                              //ชื่อสามัญทางยา
	Category      string    `json:"category"`                                  //ชนิด / หมวดหมู่ยา
	Properties    string    `json:"properties"`                                //สรรพคุณ
	Dosage        string    `json:"dosage"`                                    //ขนาดและวิธีใช้
	Instructions  string    `json:"instructions"`                              //คำแนะนำในการใช้ยา / ฉลากยา
	ExpiryDate    string    `json:"expiry_date"`                               //วันหมดอายุ (เช่น "2027-12-31")
	Manufacturer  string    `json:"manufacturer"`                              //ผู้ผลิต/บริษัท
	StockQuantity int       `gorm:"not null;default:0" json:"stock_quantity"`  //คือจำนวนคงเหลือของยาในคลัง
	UnitPrice     float64   `gorm:"not null" json:"unit_price"`                //คือราคาต่อหน่วยของยา
	CreatedAt     time.Time `json:"created_at"`                                //คือเวลาที่ข้อมูลยาถูกสร้างขึ้น
	UpdatedAt     time.Time `json:"updated_at"`                                //คือเวลาที่ข้อมูลยาถูกแก้ไขล่าสุด
}
