package dto

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type UserInfo struct {
	ID       uint   `json:"id"`
	Username string `json:"username"`
	Email    string `json:"email"`
	FullName string `json:"fullname"`
	Role     string `json:"role"`
	Phone    string `json:"phone"`
}

type LoginResponse struct {
	Token                  string   `json:"token"`
	Role                   string   `json:"role"`
	RequiresPasswordChange bool     `json:"requires_password_change"`
	User                   UserInfo `json:"user"`
}

type ChangePasswordRequest struct {
	OldPassword string `json:"old_password" binding:"required"`
	NewPassword string `json:"new_password" binding:"required"`
}

// QuickLoginRequest ใช้กับปุ่ม "Quick Test Login" (dev only) เท่านั้น — ไม่มีฟิลด์ password
// เพราะจุดประสงค์คือข้ามการเช็ค credential ไปเลย รับแค่ role แล้ว backend หาบัญชี seed ที่ตายตัว
// ของ role นั้นให้เอง (ดู QuickLogin ใน auth.go)
type QuickLoginRequest struct {
	Role string `json:"role" binding:"required"`
}

