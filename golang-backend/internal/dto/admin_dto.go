package dto

// DTO สำหรับการสร้าง Account ใหม่ (User)
type CreateAccountRequest struct {
	Username   string `json:"username"`
	Password   string `json:"password"`
	Role       string `json:"role" binding:"required"`
	FullName   string `json:"fullname"`
	EmployeeID string `json:"employee_id"`
	Phone      string `json:"phone"`
	Department string `json:"department"`
}

type UpdateAccountStatusRequest struct {
	Status string `json:"status" binding:"required"`
}

// DTO สำหรับแก้ไขบัญชีทั้งใบ (ต่างจาก UpdateAccountStatusRequest ที่แก้ได้แค่ status)
// ทุกฟิลด์เป็น optional — ส่งเฉพาะฟิลด์ที่ต้องการแก้ ฟิลด์ที่เว้นว่างจะไม่ถูกแตะต้อง
// Email ถูกตัดออกแล้ว (งานลบ users.email เฟส 1 — ดู PLAN.md) — UpdateAccount ไม่รับแก้ email
// จาก UI แล้ว ยังไม่ลบคอลัมน์ email ในตารางเอง
type UpdateAccountRequest struct {
	FullName   string `json:"fullname"`
	Phone      string `json:"phone"`
	Role       string `json:"role"`
	Department string `json:"department"`
	Status     string `json:"status"`
}

// DTO สำหรับ System Access
type CreateSystemAccessRequest struct {
	UserID      uint   `json:"user_id" binding:"required"`
	AccessLevel int    `json:"access_level" binding:"required"`
	ModuleName  string `json:"module_name" binding:"required"`
}

type UpdateSystemAccessRequest struct {
	AccessLevel int    `json:"access_level" binding:"required"`
}

// DTO สำหรับ Treatment Right
type CreateTreatmentRightRequest struct {
	RightName     string  `json:"right_name" binding:"required"`
	Provider      string  `json:"provider" binding:"required"`
	CoverageLimit float64 `json:"coverage_limit"`
}

type UpdateTreatmentRightRequest struct {
	RightName     string  `json:"right_name"`
	Provider      string  `json:"provider"`
	CoverageLimit float64 `json:"coverage_limit"`
}
