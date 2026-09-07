package models

import "time"

// กำหนดประเภทสิทธิ์การรักษา (อ้างอิงจาก TreatmentRight diagram)
type TreatmentRight struct {
	ID            uint      `gorm:"primaryKey" json:"id"` // rightID
	RightName     string    `gorm:"not null" json:"right_name"`
	Provider      string    `gorm:"not null" json:"provider"`
	CoverageLimit float64   `json:"coverage_limit"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}
