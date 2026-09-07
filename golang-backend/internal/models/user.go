package models

import "time"

// ระบบของพนักงาน(db)
type User struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Username  string    `gorm:"uniqueIndex; not null" json:"username"`
	Email     string    `gorm:"uniqueIndex" json:"email"`
	Password  string    `gorm:"not null" json:"-"`
	Role      string    `gorm:"not null" json:"role"`

	FullName       string         `json:"fullname"`
	Phone          string         `json:"phone"`
	EmployeeID     string         `json:"employee_id"`
	Status         string         `gorm:"default:'active'" json:"status"`
	RequiresPasswordChange bool   `gorm:"default:true" json:"requires_password_change"`

	SystemAccesses []SystemAccess `gorm:"foreignKey:UserID" json:"system_accesses"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}