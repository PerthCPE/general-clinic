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
	Department     string         `json:"department"`
	Status         string         `gorm:"default:'active'" json:"status"`
	RequiresPasswordChange bool   `gorm:"default:true" json:"requires_password_change"`

	SystemAccesses []SystemAccess `gorm:"foreignKey:UserID" json:"system_accesses"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// TestAccountUsernames - รายชื่อ username ตายตัวของบัญชีทดสอบ 10 บัญชีที่ระบบ seed ให้ตั้งแต่ต้น
// (ดู seedDatabase ใน config/db.go) เจตนาให้ "ใช้ได้เสมอ" ไม่ว่าจะถูกทดสอบเปลี่ยนรหัสผ่าน/สถานะ/
// ข้อมูลอื่นไปอย่างไรก่อนหน้าก็ตาม — รายชื่อนี้เป็นที่มาเดียว (single source of truth) ที่ตัดสินว่า
// บัญชีไหนเป็นบัญชีทดสอบ ใช้ระบุด้วย username ตรงๆ เท่านั้น ห้ามเดาจาก pattern ของ employee_id
// (เช่น ลงท้าย "001") เพราะบัญชีจริงที่ admin สร้างขึ้นทีหลังก็ตั้ง pattern ชนกันได้
//
// ใช้ร่วมกันทั้งฝั่ง seed (config/db.go เขียนทับค่าบัญชีเหล่านี้ทุก startup) และฝั่งบล็อกสิทธิ์
// (admin_controller.go, auth.go — ห้ามแก้ไข/รีเซ็ตรหัส/ระงับ/เปลี่ยน role/ลบ/เปลี่ยนรหัสเอง)
var TestAccountUsernames = map[string]bool{
	"officer1":    true,
	"registrar1":  true,
	"nurse1":      true,
	"assistant1":  true,
	"pharmacist1": true,
	"cashier1":    true,
	"doctor1":     true,
	"doctor2":     true,
	"doctor3":     true,
	"admin1":      true,
}

// IsTestAccountUsername เช็คว่า username นี้เป็นหนึ่งในบัญชีทดสอบตายตัวหรือไม่
func IsTestAccountUsername(username string) bool {
	return TestAccountUsernames[username]
}