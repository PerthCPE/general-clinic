package controllers

import (
	"clinic-backend/internal/dto"
	"clinic-backend/internal/models"
	crand "crypto/rand"
	"fmt"
	"math/big"
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
	// Order("id asc") ให้ผลลัพธ์มาตามลำดับคงที่เสมอ — เดิมไม่มี ORDER BY เลย ทำให้ Postgres
	// คืนแถวตามลำดับที่ไม่รับประกัน (โดยเฉพาะหลัง UPDATE แถวใดแถวหนึ่ง ตำแหน่งจริงในผลลัพธ์อาจ
	// เปลี่ยนได้) ฝั่ง UserManagement.tsx ตัดแสดงแค่ itemsPerPage แถวแรกโดยไม่มีปุ่มไปหน้าถัดไป
	// ผู้ใช้ที่เพิ่งถูก UPDATE (เช่น รีเซ็ตรหัสผ่าน) จึงเสี่ยงเด้งหลุดออกจากรายการที่มองเห็นได้
	if err := ctrl.DB.Preload("SystemAccesses").Order("id asc").Find(&users).Error; err != nil {
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
		Department:             req.Department,
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

// UpdateAccount แก้ไขบัญชีทั้งใบ (ชื่อ/อีเมล/เบอร์โทร/ตำแหน่ง/แผนก/สถานะ)
// ต่างจาก UpdateAccountStatus ที่แก้ได้แค่ status อย่างเดียว
func (ctrl *AdminController) UpdateAccount(c *gin.Context) {
	id := c.Param("id")
	var req dto.UpdateAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// ส่งเฉพาะฟิลด์ที่ไม่ว่าง เพื่อรองรับการแก้แบบ partial ไม่ให้ฟิลด์ที่ไม่ได้ส่งมาถูกเคลียร์ทิ้ง
	updates := map[string]interface{}{}
	if req.FullName != "" {
		updates["full_name"] = req.FullName
	}
	if req.Email != "" {
		updates["email"] = req.Email
	}
	if req.Phone != "" {
		updates["phone"] = req.Phone
	}
	if req.Role != "" {
		updates["role"] = req.Role
	}
	if req.Department != "" {
		updates["department"] = req.Department
	}
	if req.Status != "" {
		updates["status"] = req.Status
	}

	if len(updates) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No fields to update"})
		return
	}

	if err := ctrl.DB.Model(&models.User{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update account"})
		return
	}

	var user models.User
	if err := ctrl.DB.First(&user, id).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "Account updated successfully"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Account updated successfully", "user": user})
}

// ResetPassword ตั้งรหัสผ่านชั่วคราวใหม่ให้บัญชี (admin-assisted, ไม่มีระบบส่งอีเมล)
// สุ่มรหัสผ่านใหม่, บังคับ RequiresPasswordChange=true (ใช้ flow เดิมที่มีอยู่แล้ว
// ตอน login ครั้งถัดไปผู้ใช้จะถูกบังคับให้ตั้งรหัสผ่านของตัวเองใหม่ทันที — ดู ChangePassword)
// แล้วส่งรหัสผ่านชั่วคราวนี้กลับไปให้ admin นำไปแจ้งพนักงานเอง (ทางวาจา/แชท ฯลฯ)
func (ctrl *AdminController) ResetPassword(c *gin.Context) {
	id := c.Param("id")

	var user models.User
	if err := ctrl.DB.First(&user, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	tempPassword, err := generateTempPassword(10)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate temporary password"})
		return
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(tempPassword), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	if err := ctrl.DB.Model(&models.User{}).Where("id = ?", id).Updates(map[string]interface{}{
		"password":                 string(hashed),
		"requires_password_change": true,
	}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reset password"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":             "Password reset successfully",
		"temporary_password":  tempPassword,
		"requires_password_change": true,
	})
}

// generateTempPassword สุ่มรหัสผ่านชั่วคราวจาก charset ที่ตัดตัวอักษรที่สับสนง่ายออก
// (ไม่มี 0/O, 1/l/I) เพราะ admin ต้องอ่านออกเสียง/พิมพ์บอกพนักงานเอง
func generateTempPassword(length int) (string, error) {
	const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"
	result := make([]byte, length)
	for i := range result {
		n, err := crand.Int(crand.Reader, big.NewInt(int64(len(charset))))
		if err != nil {
			return "", err
		}
		result[i] = charset[n.Int64()]
	}
	return string(result), nil
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
