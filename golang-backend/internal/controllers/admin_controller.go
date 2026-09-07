package controllers

import (
	"clinic-backend/internal/dto"
	"clinic-backend/internal/models"
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

	hashed, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	user := models.User{
		Username:   req.Username,
		Email:      req.Username + "@clinic.com", // Add default email for new accounts
		Password:   string(hashed),
		Role:       req.Role,
		FullName:   req.FullName,
		EmployeeID: req.EmployeeID,
		Phone:      req.Phone,
		Status:     "active",
	}

	if err := ctrl.DB.Create(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create account"})
		return
	}
	c.JSON(http.StatusCreated, user)
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

// --- Treatment Right ---

func (ctrl *AdminController) GetTreatmentRights(c *gin.Context) {
	var rights []models.TreatmentRight
	if err := ctrl.DB.Find(&rights).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch rights"})
		return
	}
	c.JSON(http.StatusOK, rights)
}

func (ctrl *AdminController) CreateTreatmentRight(c *gin.Context) {
	var req dto.CreateTreatmentRightRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	right := models.TreatmentRight{
		RightName:     req.RightName,
		Provider:      req.Provider,
		CoverageLimit: req.CoverageLimit,
	}

	if err := ctrl.DB.Create(&right).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create treatment right"})
		return
	}
	c.JSON(http.StatusCreated, right)
}
