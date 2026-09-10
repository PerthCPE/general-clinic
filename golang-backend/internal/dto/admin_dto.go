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
