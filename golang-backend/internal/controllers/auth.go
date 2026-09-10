package controllers

import (
	"net/http"
	"time"

	"clinic-backend/internal/dto"
	"clinic-backend/internal/config"
	"clinic-backend/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

func Login(c *gin.Context) {
	var req dto.LoginRequest

	// check frontend for sended valid json following dto
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request parameters"})
		return
	}

	var user models.User

	// username, email, หรือ employee_id (รหัสพนักงาน) ก็ใช้ login ได้ — employee_id คือ
	// ตัวที่พนักงานรู้จักจริงและถูกใช้เป็นรหัสผ่านเริ่มต้นด้วย (ดู CreateAccount) จึงต้อง match
	// ตรงๆ ไม่พึ่งพาว่า username จะถูกแปลงรูปแบบ (เช่น lowercase) ตรงกับ employee_id เป๊ะหรือไม่
	result := config.DB.Where("username = ? OR email = ? OR employee_id = ?", req.Username, req.Username, req.Username).First(&user)
	if result.Error != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error" : "Invalid username or password"})
		return
	}

	// บัญชีที่ถูกระงับ (suspended) หรือปิดใช้งาน (inactive) ห้าม login สำเร็จ แม้รหัสผ่านจะถูกต้องก็ตาม
	// เดิมจุดนี้ไม่เคยเช็ค status เลย — บัญชีที่ถูกระงับก็ยังล็อกอินได้ตามปกติ (พบระหว่างสำรวจ
	// จริง: pharmacist1 มี status="inactive" แต่ยังล็อกอินผ่านได้)
	if user.Status == "suspended" || user.Status == "inactive" {
		c.JSON(http.StatusForbidden, gin.H{"error": "บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ"})
		return
	}

	// password checking
	err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error" : "Invalid username or password"})
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
