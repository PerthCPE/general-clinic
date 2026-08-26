package dto

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type UserInfo struct {
	ID       uint   `json:"id"`
	Username string `json:"username"`
	FullName string `json:"fullname"`
	Role     string `json:"role"`
	Phone    string `json:"phone"`
}

type LoginResponse struct {
	Token string   `json:"token"`
	Role  string   `json:"role"`
	User  UserInfo `json:"user"`
}