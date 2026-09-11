package controllers

import (
	"errors"
	"net/http"
	"time"

	"clinic-backend/internal/config"
	"clinic-backend/internal/dto"
	"clinic-backend/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

func Login(c *gin.Context) {
	var req dto.LoginRequest

	// check frontend for sended valid json following dto
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request parameters"})
		return
	}

	if req.Username == "" || req.Password == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน"})
		return
	}

	var user models.User

	// username, email, หรือ employee_id (รหัสพนักงาน) ก็ใช้ login ได้
	result := config.DB.Where("username = ? OR email = ? OR employee_id = ?", req.Username, req.Username, req.Username).First(&user)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid username or password"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error: unable to connect or query user table"})
		return
	}

	// บัญชีที่ถูกระงับ (suspended) หรือปิดใช้งาน (inactive) ห้าม login สำเร็จ แม้รหัสผ่านจะถูกต้องก็ตาม
	if user.Status == "suspended" || user.Status == "inactive" {
		c.JSON(http.StatusForbidden, gin.H{"error": "บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ"})
		return
	}

	// password checking with bcrypt
	err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid username or password"})
		return
	}

	// token generate struct setting
	claims := jwt.MapClaims {
		"user_id": user.ID,
		"role": user.Role,
		"exp": time.Now().Add(time.Hour * 24).Unix(),
	}
	
	// create jwt_token expired 24 hr
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(config.AppConfig.JWTSecret))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error" : "Failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, dto.LoginResponse{
		Token:                  tokenString,
		Role:                   user.Role,
		RequiresPasswordChange: user.RequiresPasswordChange,
		User: dto.UserInfo{
			ID:       user.ID,
			Username: user.Username,
			Email:    user.Email,
			FullName: user.FullName,
			Role:     user.Role,
			Phone:    user.Phone,
		},
	})
}
// roleToQuickLoginEmployeeID คือ whitelist ตายตัวของบัญชี seed 8 บัญชีที่ผูกกับปุ่ม Quick Test
// Login ในหน้า login (ไม่ query by role ตรงๆ เพราะบาง role เช่น doctor มีหลายบัญชีในระบบจริง
// (doctor1/doctor2/doctor3) ปุ่ม Quick Test ต้องการแค่บัญชีเดียวที่คงที่เสมอต่อ role)
var roleToQuickLoginEmployeeID = map[string]string{
	"registrar":       "REC001",
	"nurse":           "NUR001",
	"nurse_assistant": "NUR002",
	"doctor":          "DOC001",
	"pharmacist":      "PHA001",
	"cashier":         "CAS001",
	"admin":           "ADM001",
	"officer":         "OFF001",
}

// QuickLogin คือทางลัด dev/test เท่านั้นสำหรับปุ่ม "Quick Test Login" — ไม่เช็ค password และ
// รีเซ็ต status ของบัญชี seed กลับเป็น active ให้เสมอก่อน login เพื่อให้กดใช้ได้ทุกครั้งไม่ว่า
// บัญชีนั้นจะถูกตั้ง suspended/inactive ไว้ก่อนหน้า (เช่น ระหว่างทดสอบ flow ระงับบัญชี) ต่างจาก
// Login() ปกติที่ต้องเช็ค password และ status ตามจริงทุกประการ ไม่ถูกแตะเลยในไฟล์นี้
//
// กันไว้สองชั้นไม่ให้ใช้ได้ตอน production: (1) เช็ค config.AppConfig.DevMode ตรงนี้ (2) routes.go
// ไม่ผูก route นี้เลยถ้า DevMode เป็น false ตั้งแต่แรก (endpoint ไม่มีอยู่จริงด้วยซ้ำ ไม่ใช่แค่ตอบ 403)
func QuickLogin(c *gin.Context) {
	if !config.AppConfig.DevMode {
		c.JSON(http.StatusForbidden, gin.H{"error": "Quick login is only available in dev mode"})
		return
	}

	var req dto.QuickLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request parameters"})
		return
	}

	employeeID, ok := roleToQuickLoginEmployeeID[req.Role]
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Unknown role for quick login"})
		return
	}

	var user models.User
	if err := config.DB.Where("employee_id = ?", employeeID).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Seed account not found"})
		return
	}

	// รีเซ็ต status กลับเป็น active เสมอไม่ว่าจะถูกตั้งเป็นอะไรไว้ก่อนหน้า — จุดประสงค์หลักของ
	// endpoint นี้ ทำเฉพาะบัญชี seed ที่ whitelist ไว้ข้างบนเท่านั้น ไม่กระทบบัญชีจริงอื่นใด
	if user.Status != "active" {
		if err := config.DB.Model(&user).Update("status", "active").Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reset account status"})
			return
		}
		user.Status = "active"
	}

	claims := jwt.MapClaims{
		"user_id": user.ID,
		"role":    user.Role,
		"exp":     time.Now().Add(time.Hour * 24).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(config.AppConfig.JWTSecret))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, dto.LoginResponse{
		Token:                  tokenString,
		Role:                   user.Role,
		RequiresPasswordChange: user.RequiresPasswordChange,
		User: dto.UserInfo{
			ID:       user.ID,
			Username: user.Username,
			Email:    user.Email,
			FullName: user.FullName,
			Role:     user.Role,
			Phone:    user.Phone,
		},
	})
}

func ChangePassword(c *gin.Context) {
	var req dto.ChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request parameters"})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var user models.User
	if err := config.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.OldPassword))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid old password"})
		return
	}

	hashPassword, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), 10)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	user.Password = string(hashPassword)
	user.RequiresPasswordChange = false
	if err := config.DB.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update password"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Password changed successfully"})
}
