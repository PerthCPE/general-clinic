package controllers

import (
	"net/http"

	"clinic-backend/internal/config"
	"clinic-backend/internal/models"

	"github.com/gin-gonic/gin"
)

// DTO สำหรับการอัปเดตสต็อกยา
type UpdateStockRequest struct {
	MedicineCode string `json:"medicine_code" binding:"required"`
	Action       string `json:"action" binding:"required"` // "add" หรือ "reduce"
	Quantity     int    `json:"quantity" binding:"required,min=1"`
}

// GET /api/pharmacy/medicines - ดึงรายการยาทั้งหมดในคลัง
func GetMedicines(c *gin.Context) {
	var medicines []models.Medicine
	query := c.Query("query")

	dbQuery := config.DB
	if query != "" {
		dbQuery = dbQuery.Where(
			"LOWER(medicine_code) LIKE LOWER(?) OR LOWER(name) LIKE LOWER(?) OR LOWER(medicine_code) LIKE LOWER(?)",
			"%"+query+"%",
			"%"+query+"%",
			"%MED-%"+query+"%",
		)
	}

	if err := dbQuery.Find(&medicines).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch medicines: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":    "success",
		"medicines": medicines,
	})
}

// GET /api/pharmacy/medicines/:code - ค้นหายาตาม MedicineCode
func GetMedicineByCode(c *gin.Context) {
	code := c.Param("code")
	var medicine models.Medicine

	if err := config.DB.Where("medicine_code = ?", code).First(&medicine).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Medicine not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":   "success",
		"medicine": medicine,
	})
}

// POST /api/pharmacy/medicines/stock - ปรับปรุงจำนวนสต็อกยา
func UpdateMedicineStock(c *gin.Context) {
	var req UpdateStockRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var medicine models.Medicine
	if err := config.DB.Where("medicine_code = ?", req.MedicineCode).First(&medicine).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Medicine not found"})
		return
	}

	if req.Action == "add" {
		medicine.StockQuantity += req.Quantity
	} else if req.Action == "reduce" {
		if medicine.StockQuantity < req.Quantity {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Insufficient stock in inventory"})
			return
		}
		medicine.StockQuantity -= req.Quantity
	} else {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid action. Use 'add' or 'reduce'"})
		return
	}

	if err := config.DB.Save(&medicine).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update stock: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":   "success",
		"message":  "Stock updated successfully",
		"medicine": medicine,
	})
}
