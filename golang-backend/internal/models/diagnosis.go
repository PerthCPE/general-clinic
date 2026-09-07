package models

import (
	"time"

	"gorm.io/gorm"
)

// Diagnosis - ผลการวินิจฉัยโรคของการมาตรวจหนึ่งครั้ง
//
// แยกออกมาเป็นตารางของตัวเองแทนที่จะเป็นคอลัมน์ใน examinations เพราะ
// การตรวจหนึ่งครั้งมีการวินิจฉัยได้หลายรายการ (primary 1 + secondary หลายตัว)
// และต้องค้นย้อนหลังด้วยรหัส ICD-10 ได้
type Diagnosis struct {
	ID      uint `gorm:"primaryKey" json:"id"`
	VisitID uint `gorm:"index;not null" json:"visit_id"`

	ICDCode string `gorm:"index" json:"icd_code"` // เช่น J06.9
	NameEN  string `json:"name_en"`
	NameTH  string `json:"name_th"`

	// IsPrimary ควรเป็น true ได้แถวเดียวต่อ visit
	// (บังคับในชั้น controller ตอนบันทึก ไม่ได้บังคับที่ระดับฐานข้อมูล
	//  เพราะ Postgres ต้องใช้ partial unique index ซึ่ง AutoMigrate สร้างให้ไม่ได้)
	IsPrimary bool `gorm:"index" json:"is_primary"`
	SortOrder int  `json:"sort_order"` // ลำดับที่แสดงของ secondary diagnosis

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	VisitRecord VisitRecord `gorm:"foreignKey:VisitID" json:"-"`
}
