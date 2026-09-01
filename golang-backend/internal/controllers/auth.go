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

	// username checking
	result := config.DB.Where("username = ?", req.Username).First(&user)
	if result.Error != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error" : "Invalid username or password"})
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
		Token: tokenString,
		Role:  user.Role,
		User: dto.UserInfo{
			ID:       user.ID,
			Username: user.Username,
			FullName: user.FullName,
			Role:     user.Role,
			Phone:    user.Phone,
		},
	})
}