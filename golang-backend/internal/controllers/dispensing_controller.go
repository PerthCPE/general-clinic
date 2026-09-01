package controllers

import (
	"net/http"

	"clinic-backend/internal/config"
	"clinic-backend/internal/models"
	"clinic-backend/internal/ws"

	"github.com/gin-gonic/gin"
)

type RecordDispenseRequest struct {
	VisitID      uint   `json:"visit_id" binding:"required"`
	MedicineID   uint   `json:"medicine_id" binding:"required"`
	DoctorID     uint   `json:"doctor_id" binding:"required"`
	Quantity     int    `json:"quantity" binding:"required,min=1"`
	Dosage       string `json:"dosage"`
	Instructions string `json:"instructions"`
}

// GET /api/pharmacy/dispensing/:visit_id - ดึงรายการจ่ายยาตาม Visit ID
func GetDispensingByVisit(c *gin.Context) {
	visitID := c.Param("visit_id")
	var items []models.Dispensing

	if err := config.DB.Preload("Medicine").Preload("Doctor").Where("visit_id = ?", visitID).Find(&items).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch dispensing records: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":     "success",
		"dispensing": items,
	})
}

// POST /api/pharmacy/dispensing - บันทึกคำสั่งจ่ายยาและหักสต็อก
func RecordDispense(c *gin.Context) {
	var req RecordDispenseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 1. ตรวจสอบว่ามียาในสต็อกพอหรือไม่
	var medicine models.Medicine
	if err := config.DB.First(&medicine, req.MedicineID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Medicine not found"})
		return
	}

	if medicine.StockQuantity < req.Quantity {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Insufficient stock in inventory"})
		return
	}

	// 2. สร้างรายการ Dispensing
	dispense := models.Dispensing{
		VisitID:      req.VisitID,
		MedicineID:   req.MedicineID,
		DoctorID:     req.DoctorID,
		Quantity:     req.Quantity,
		Dosage:       req.Dosage,
		Instructions: req.Instructions,
	}

	tx := config.DB.Begin()
	if err := tx.Create(&dispense).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to record dispensing: " + err.Error()})
		return
	}

	// 3. ตัดสต็อกยา
	medicine.StockQuantity -= req.Quantity
	if err := tx.Save(&medicine).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update stock: " + err.Error()})
		return
	}

	tx.Commit()

	c.JSON(http.StatusOK, gin.H{
		"status":     "success",
		"message":    "Medication dispensed and stock deducted successfully",
		"dispensing": dispense,
		"medicine":   medicine,
	})
}

// POST /api/pharmacy/dispense - ยืนยันการจ่ายยา ตัดสต็อก และสร้างบิลการเงิน พร้อมยิง WebSocket
func ConfirmDispenseAndBill(c *gin.Context) {
	var req struct {
		VisitID uint `json:"visit_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var dispensings []models.Dispensing
	if err := config.DB.Preload("Medicine").Where("visit_id = ?", req.VisitID).Find(&dispensings).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch dispensing records: " + err.Error()})
		return
	}

	totalAmount := 0.0
	tx := config.DB.Begin()

	// วนลูปตัดสต็อกยาแต่ละตัวที่ถูกสั่งจ่าย และรวมราคา
	for _, d := range dispensings {
		var med models.Medicine
		if err := tx.First(&med, d.MedicineID).Error; err == nil {
			if med.StockQuantity >= d.Quantity {
				med.StockQuantity -= d.Quantity
				tx.Save(&med)
			}
			totalAmount += float64(d.Quantity) * med.UnitPrice
		}
	}

	// ถ้าไม่มีราคายาเลย (เช่น ทดสอบข้อมูล) ให้ตั้งค่าเริ่มต้น
	if totalAmount == 0 {
		totalAmount = 350.0 // ค่าธรรมเนียมแพทย์หรือค่าเริ่มต้น
	}

	// สร้างบิลการเงิน
	billing := models.Billing{
		VisitID:                 req.VisitID,
		TotalAmount:             totalAmount,
		DiscountFromEligibility: 0,
		NetAmount:               totalAmount,
		PaymentStatus:           "pending",
	}
	if err := tx.Create(&billing).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create billing record: " + err.Error()})
		return
	}

	// อัปเดตสถานะคิวเป็นรอชำระเงิน
	var queue models.Queue
	var visit models.VisitRecord
	if err := tx.First(&visit, req.VisitID).Error; err == nil {
		if err := tx.Where("patient_id = ? AND status = 'pharmacy_waiting'", visit.PatientID).First(&queue).Error; err == nil {
			queue.Status = "billing_waiting"
			queue.Department = "การเงิน"
			tx.Save(&queue)
		}
	}

	tx.Commit()

	// ยิง WebSocket แจ้งเตือนการเงินและอัปเดตคิว
	ws.BroadcastEvent("DISPENSE_RECORDED", gin.H{"visit_id": req.VisitID, "action": "dispensed"})
	ws.BroadcastEvent("BILLING_CREATED", billing)
	ws.BroadcastEvent("QUEUE_UPDATED", queue)

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Dispensing confirmed and billed successfully",
		"billing": billing,
	})
}

