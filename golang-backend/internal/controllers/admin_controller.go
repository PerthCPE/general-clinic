package controllers

import (
	"clinic-backend/internal/dto"
	"clinic-backend/internal/models"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// AdminController จัดการระบบสิทธิ์และบัญชี
type AdminController struct {
	DB *gorm.DB
}

func NewAdminController(db *gorm.DB) *AdminController {
	return &AdminController{DB: db}
}

// --- Accounts ---

func (ctrl *AdminController) GetAccounts(c *gin.Context) {
	var users []models.User
	if err := ctrl.DB.Preload("SystemAccesses").Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch accounts"})
		return
	}
	c.JSON(http.StatusOK, users)
}

func (ctrl *AdminController) CreateAccount(c *gin.Context) {
	var req dto.CreateAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Auto-generate employee_id if not provided
	if req.EmployeeID == "" {
		var count int64
		ctrl.DB.Model(&models.User{}).Count(&count)
		req.EmployeeID = fmt.Sprintf("EMP%04d", count+1)
	}

	// Auto-generate username if not provided
	if req.Username == "" {
		req.Username = req.EmployeeID
	}

	// Auto-generate password if not provided
	tempPassword := req.Password
	if tempPassword == "" {
		tempPassword = req.EmployeeID // temp password = employee_id
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(tempPassword), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	user := models.User{
		Username:               req.Username,
		Email:                  req.Username + "@clinic.com",
		Password:               string(hashed),
		Role:                   req.Role,
		FullName:               req.FullName,
		EmployeeID:             req.EmployeeID,
		Phone:                  req.Phone,
		Status:                 "active",
		RequiresPasswordChange: true,
	}

	if err := ctrl.DB.Create(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create account"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"user": user, "temporary_password": tempPassword})
}

func (ctrl *AdminController) UpdateAccountStatus(c *gin.Context) {
	id := c.Param("id")
	var req dto.UpdateAccountStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := ctrl.DB.Model(&models.User{}).Where("id = ?", id).Update("status", req.Status).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update status"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Status updated successfully"})
}

// --- System Access ---

func (ctrl *AdminController) CreateSystemAccess(c *gin.Context) {
	var req dto.CreateSystemAccessRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	access := models.SystemAccess{
		UserID:      req.UserID,
		AccessLevel: req.AccessLevel,
		ModuleName:  req.ModuleName,
	}

	if err := ctrl.DB.Create(&access).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to assign access"})
		return
	}
	c.JSON(http.StatusCreated, access)
}

func (ctrl *AdminController) BulkUpdateSystemAccess(c *gin.Context) {
	var req struct {
		UserID   uint `json:"user_id"`
		Accesses []struct {
			ModuleName  string `json:"module_name"`
			AccessLevel int    `json:"access_level"`
		} `json:"accesses"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tx := ctrl.DB.Begin()
	// Clear existing access
	if err := tx.Where("user_id = ?", req.UserID).Delete(&models.SystemAccess{}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to clear existing access"})
		return
	}

	// Insert new access
	for _, acc := range req.Accesses {
		if acc.AccessLevel > 0 {
			newAcc := models.SystemAccess{
				UserID:      req.UserID,
				ModuleName:  acc.ModuleName,
				AccessLevel: acc.AccessLevel,
			}
			if err := tx.Create(&newAcc).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to assign access"})
				return
			}
		}
	}
	tx.Commit()
	c.JSON(http.StatusOK, gin.H{"message": "System access updated successfully"})
}
