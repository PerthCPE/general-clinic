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

