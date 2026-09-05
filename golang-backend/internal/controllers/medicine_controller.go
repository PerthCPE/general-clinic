package controllers

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"clinic-backend/internal/config"
	"clinic-backend/internal/models"
	"clinic-backend/internal/ws"

	"github.com/gin-gonic/gin"
)

// DTO สำหรับการอัปเดตสต็อกยา
type UpdateStockRequest struct {
	MedicineCode string `json:"medicine_code" binding:"required"`
	Action       string `json:"action" binding:"required"` // "add" หรือ "reduce"
	Quantity     int    `json:"quantity" binding:"required,min=1"`
}

// GET /api/pharmacy/medicines - ดึงรายการยาทั้งหมดในคลัง (⚡ RAM Cache 0.01 ms)
func GetMedicines(c *gin.Context) {
	query := strings.TrimSpace(c.Query("query"))
	category := strings.TrimSpace(c.Query("category"))

	allMeds := GetCachedMedicines()
	if len(allMeds) == 0 {
		if err := config.DB.Find(&allMeds).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch medicines: " + err.Error()})
			return
		}
	}

	if query == "" && (category == "" || category == "all") {
		c.JSON(http.StatusOK, gin.H{
			"status":    "success",
			"medicines": allMeds,
		})
		return
	}

	lowerQuery := strings.ToLower(query)
	lowerCategory := strings.ToLower(category)

	var filtered []models.Medicine
	for _, m := range allMeds {
		if lowerCategory != "" && lowerCategory != "all" && !strings.Contains(strings.ToLower(m.Category), lowerCategory) {
			continue
		}
		if lowerQuery != "" {
			mCode := strings.ToLower(m.MedicineCode)
			mName := strings.ToLower(m.Name)
			mGeneric := strings.ToLower(m.GenericName)
			mUsage := strings.ToLower(m.UsageMethod)
			mProps := strings.ToLower(m.Properties)
			if !strings.Contains(mCode, lowerQuery) && !strings.Contains(mName, lowerQuery) && !strings.Contains(mGeneric, lowerQuery) && !strings.Contains(mUsage, lowerQuery) && !strings.Contains(mProps, lowerQuery) {
				continue
			}
		}
		filtered = append(filtered, m)
	}

	c.JSON(http.StatusOK, gin.H{
		"status":    "success",
		"medicines": filtered,
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

	ws.BroadcastEvent("MEDICINE_STOCK_UPDATED", medicine)
	InvalidateMedicinesCache()

	c.JSON(http.StatusOK, gin.H{
		"status":   "success",
		"message":  "Stock updated successfully",
		"medicine": medicine,
	})
}

// DTO สำหรับการเพิ่มยาใหม่เข้าคลัง
type CreateMedicineRequest struct {
	MedicineCode  string  `json:"medicine_code"`
	Name          string  `json:"name" binding:"required"`
	GenericName   string  `json:"generic_name"`
	Category      string  `json:"category"`
	Properties    string  `json:"properties"`
	Dosage        string  `json:"dosage"`
	UsageMethod   string  `json:"usage_method"`
	Instructions  string  `json:"instructions"`
	ExpiryDate    string  `json:"expiry_date"`
	Manufacturer  string  `json:"manufacturer"`
	StockQuantity int     `json:"stock_quantity"`
	UnitPrice     float64 `json:"unit_price"`
}

// POST /api/pharmacy/medicines - เพิ่มยาใหม่เข้าคลัง
func CreateMedicine(c *gin.Context) {
	var req CreateMedicineRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	code := strings.TrimSpace(req.MedicineCode)
	if code == "" {
		// หาเลขรหัสยาสูงสุดที่มีอยู่แล้วใน DB เพื่อรันลำดับต่ออัตโนมัติ ไม่ให้ชนกัน
		var allCodes []string
		config.DB.Model(&models.Medicine{}).Pluck("medicine_code", &allCodes)

		maxNum := 0
		for _, cStr := range allCodes {
			clean := strings.TrimPrefix(cStr, "MED-")
			clean = strings.TrimPrefix(clean, "MED")
			if n, err := strconv.Atoi(clean); err == nil {
				if n > maxNum {
					maxNum = n
				}
			}
		}

		var count int64
		config.DB.Model(&models.Medicine{}).Count(&count)
		if int(count) > maxNum {
			maxNum = int(count)
		}

		code = fmt.Sprintf("MED-%03d", maxNum+1)
	}

	medicine := models.Medicine{
		MedicineCode:  code,
		Name:          req.Name,
		GenericName:   req.GenericName,
		Category:      req.Category,
		Properties:    req.Properties,
		Dosage:        req.Dosage,
		UsageMethod:   req.UsageMethod,
		Instructions:  req.Instructions,
		ExpiryDate:    req.ExpiryDate,
		Manufacturer:  req.Manufacturer,
		StockQuantity: req.StockQuantity,
		UnitPrice:     req.UnitPrice,
	}

	if err := config.DB.Create(&medicine).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create medicine: " + err.Error()})
		return
	}

	ws.BroadcastEvent("MEDICINE_STOCK_UPDATED", medicine)
	InvalidateMedicinesCache()

	c.JSON(http.StatusCreated, gin.H{
		"status":   "success",
		"message":  "Medicine created successfully",
		"medicine": medicine,
	})
}

// DELETE /api/pharmacy/medicines/:id - ลบยาออกจากคลัง
func DeleteMedicine(c *gin.Context) {
	param := strings.TrimSpace(c.Param("id"))

	var medicine models.Medicine
	var err error

	// ค้นหาอย่างยืดหยุ่น: ทั้ง ID ตัวเลข, medicine_code, MED-xxx, และ Name
	if id, parseErr := strconv.Atoi(param); parseErr == nil {
		err = config.DB.Where("id = ? OR medicine_code = ? OR medicine_code = ?", id, param, fmt.Sprintf("MED-%03d", id)).First(&medicine).Error
	}
	if err != nil || medicine.ID == 0 {
		cleanCode := strings.TrimPrefix(param, "MED-")
		cleanCode = strings.TrimPrefix(cleanCode, "MED")
		err = config.DB.Where("medicine_code = ? OR medicine_code = ? OR name = ? OR generic_name = ?", param, "MED-"+cleanCode, param, param).First(&medicine).Error
	}

	if err != nil || medicine.ID == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Medicine not found"})
		return
	}

	// ลบรายการอ้างอิงใน dispensings เพื่อไม่ให้ติด Foreign Key Constraint
	config.DB.Where("medicine_id = ?", medicine.ID).Delete(&models.Dispensing{})

	if err := config.DB.Delete(&medicine).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete medicine: " + err.Error()})
		return
	}

	ws.BroadcastEvent("MEDICINE_STOCK_UPDATED", gin.H{"deleted_code": medicine.MedicineCode, "deleted_id": medicine.ID})
	InvalidateMedicinesCache()

	c.JSON(http.StatusOK, gin.H{
		"status":       "success",
		"message":      "Medicine deleted successfully",
		"deleted_id":   medicine.ID,
		"deleted_code": medicine.MedicineCode,
	})
}

// DTO สำหรับการแก้ไขข้อมูลรายละเอียดตัวยา
type UpdateMedicineDetailsRequest struct {
	Name          string   `json:"name"`
	GenericName   string   `json:"generic_name"`
	Category      string   `json:"category"`
	Properties    string   `json:"properties"`
	Dosage        string   `json:"dosage"`
	UsageMethod   string   `json:"usage_method"`
	Instructions  string   `json:"instructions"`
	ExpiryDate    string   `json:"expiry_date"`
	Manufacturer  string   `json:"manufacturer"`
	StockQuantity *int     `json:"stock_quantity"`
	UnitPrice     *float64 `json:"unit_price"`
}

// PUT /api/pharmacy/medicines/:id หรือ POST /api/pharmacy/medicines/:id/update - แก้ไขข้อมูลรายละเอียดตัวยาใน DB ทันที
func UpdateMedicineDetails(c *gin.Context) {
	param := strings.TrimSpace(c.Param("id"))

	var req UpdateMedicineDetailsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var medicine models.Medicine
	var err error

	// ค้นหาตัวยาด้วย ID ตัวเลข, medicine_code (เช่น MED-002) หรือ Name
	if id, parseErr := strconv.Atoi(param); parseErr == nil {
		err = config.DB.Where("id = ? OR medicine_code = ?", id, param).First(&medicine).Error
	}
	if err != nil || medicine.ID == 0 {
		cleanCode := strings.TrimPrefix(param, "MED-")
		cleanCode = strings.TrimPrefix(cleanCode, "MED")
		err = config.DB.Where("medicine_code = ? OR medicine_code = ? OR name = ?", param, "MED-"+cleanCode, param).First(&medicine).Error
	}

	if err != nil || medicine.ID == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Medicine not found"})
		return
	}

	// อัปเดตฟิลด์ต่างๆ หากมีการส่งค่ามา
	if strings.TrimSpace(req.Name) != "" {
		medicine.Name = strings.TrimSpace(req.Name)
	}
	if strings.TrimSpace(req.GenericName) != "" {
		medicine.GenericName = strings.TrimSpace(req.GenericName)
	}
	if strings.TrimSpace(req.Category) != "" {
		medicine.Category = strings.TrimSpace(req.Category)
	}
	if strings.TrimSpace(req.Properties) != "" {
		medicine.Properties = strings.TrimSpace(req.Properties)
	}
	if strings.TrimSpace(req.Dosage) != "" {
		medicine.Dosage = strings.TrimSpace(req.Dosage)
	}
	if strings.TrimSpace(req.UsageMethod) != "" {
		medicine.UsageMethod = strings.TrimSpace(req.UsageMethod)
	}
	if strings.TrimSpace(req.Instructions) != "" {
		medicine.Instructions = strings.TrimSpace(req.Instructions)
	}
	if strings.TrimSpace(req.ExpiryDate) != "" {
		medicine.ExpiryDate = strings.TrimSpace(req.ExpiryDate)
	}
	if strings.TrimSpace(req.Manufacturer) != "" {
		medicine.Manufacturer = strings.TrimSpace(req.Manufacturer)
	}
	if req.UnitPrice != nil && *req.UnitPrice >= 0 {
		medicine.UnitPrice = *req.UnitPrice
	}
	if req.StockQuantity != nil && *req.StockQuantity >= 0 {
		medicine.StockQuantity = *req.StockQuantity
	}

	// บันทึกลง Database ทันที
	if err := config.DB.Save(&medicine).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update medicine: " + err.Error()})
		return
	}

	// ส่งสัญญาณ Real-time แจ้งทุกไคลเอนต์ให้ซิงก์ข้อมูลคลังยาตรงกัน
	ws.BroadcastEvent("MEDICINE_UPDATED", medicine)
	ws.BroadcastEvent("MEDICINE_STOCK_UPDATED", medicine)
	InvalidateMedicinesCache()

	c.JSON(http.StatusOK, gin.H{
		"status":   "success",
		"message":  "Medicine details updated successfully in database",
		"medicine": medicine,
	})
}

