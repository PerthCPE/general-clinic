package models

import "time"

// สิทธิ์การเข้าถึงโมดูลต่างๆ ในระบบ (อ้างอิงจาก SystemAccess diagram)
type SystemAccess struct {
	ID          uint      `gorm:"primaryKey" json:"id"` // accessID
	UserID      uint      `gorm:"not null" json:"user_id"` // อ้างอิงไปที่ Account (User)
	AccessLevel int       `gorm:"not null" json:"access_level"`
	ModuleName  string    `gorm:"not null" json:"module_name"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`

	User        User      `gorm:"foreignKey:UserID" json:"user"`
}
