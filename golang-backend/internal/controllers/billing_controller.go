package controllers

import (
	"fmt"
	"net/http"
	"time"

	"clinic-backend/internal/config"
	"clinic-backend/internal/models"
	"clinic-backend/internal/ws"

	"github.com/gin-gonic/gin"
)

// DTO สำหรับการสร้างหรือยืนยันบิล
type ConfirmPaymentRequest struct {
	VisitID       uint    `json:"visit_id" binding:"required"`
	PaymentMethod string  `json:"payment_method" binding:"required"` // "Cash" หรือ "QR Code"
	CashReceived  float64 `json:"cash_received"`
}

type GenerateQRRequest struct {
	BillingID   uint    `json:"billing_id" binding:"required"`
	PromptPayID string  `json:"promptpay_id" binding:"required"`
	Amount      float64 `json:"amount" binding:"required"`
}

// GET /api/billing/queues - ดึงรายการคิวรอชำระเงินทั้งหมดจากตาราง billing_queues
func GetBillingQueues(c *gin.Context) {
	var queues []models.BillingQueue
	if err := config.DB.Preload("VisitRecord").Preload("VisitRecord.Patient").Where("status = ?", "pending").Order("created_at asc").Find(&queues).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch billing queues: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"queues": queues,
	})
}

// GET /api/billing/list - ดึงรายการบิลการเงินทั้งหมดจาก Database
func GetAllBillings(c *gin.Context) {
	var billings []models.Billing
	if err := config.DB.Preload("VisitRecord").Preload("VisitRecord.Patient").Order("created_at desc").Find(&billings).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch billings: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":   "success",
		"billings": billings,
	})
}

// GET /api/billing/history - ดึงประวัติการชำระเงินทั้งหมดสำหรับแสดงใน Dashboard
func GetBillingHistories(c *gin.Context) {
	var histories []models.BillingHistory
	if err := config.DB.Order("created_at desc").Find(&histories).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch billing history: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":    "success",
		"histories": histories,
	})
}

// GET /api/billing/visit/:visit_id - ดึงข้อมูลบิลตาม Visit ID
func GetBillingByVisit(c *gin.Context) {
	visitID := c.Param("visit_id")
	var billing models.Billing

	if err := config.DB.Preload("VisitRecord").Where("visit_id = ?", visitID).First(&billing).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Billing record not found for this visit"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"billing": billing,
	})
}

// POST /api/billing/calculate - คำนวณยอดเงินและสร้างบิล (Billing)
func CalculateBilling(c *gin.Context) {
	var req struct {
		VisitID                 uint    `json:"visit_id" binding:"required"`
		TotalAmount             float64 `json:"total_amount" binding:"required"`
		DiscountFromEligibility float64 `json:"discount_from_eligibility"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	netAmount := req.TotalAmount - req.DiscountFromEligibility
	if netAmount < 0 {
		netAmount = 0
	}

	var billing models.Billing
	err := config.DB.Where("visit_id = ?", req.VisitID).First(&billing).Error

	if err != nil {
		// สร้างใหม่หากยังไม่มีบิล
		billing = models.Billing{
			VisitID:                 req.VisitID,
			TotalAmount:             req.TotalAmount,
			DiscountFromEligibility: req.DiscountFromEligibility,
			NetAmount:               netAmount,
			PaymentStatus:           "pending",
		}
		if err := config.DB.Create(&billing).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create billing record: " + err.Error()})
			return
		}
	} else {
		// อัปเดตข้อมูลหากมีบิลอยู่แล้ว
		billing.TotalAmount = req.TotalAmount
		billing.DiscountFromEligibility = req.DiscountFromEligibility
		billing.NetAmount = netAmount
		if err := config.DB.Save(&billing).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update billing record: " + err.Error()})
			return
		}
	}

	ws.BroadcastEvent("BILLING_CREATED", billing)

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"billing": billing,
	})
}

// POST /api/billing/qr/generate - สร้างข้อมูล QR Code ชำระเงิน (QRPayment)
func GenerateQRPayment(c *gin.Context) {
	var req GenerateQRRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var billing models.Billing
	if err := config.DB.First(&billing, req.BillingID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Billing record not found"})
		return
	}

	// Payload จำลองสำหรับ EMVCo PromptPay
	qrData := fmt.Sprintf("00020101021229370016A00000067701011101130066%s5802TH53037645406%.2f6304", req.PromptPayID, req.Amount)
	expiredAt := time.Now().Add(15 * time.Minute)

	qrPayment := models.QRPayment{
		BillingID:   billing.ID,
		QRCodeData:  qrData,
		PromptPayID: req.PromptPayID,
		Amount:      req.Amount,
		Status:      "pending",
		ExpiredAt:   expiredAt,
	}

	if err := config.DB.Create(&qrPayment).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate QR payment: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":     "success",
		"qr_payment": qrPayment,
	})
}

// POST /api/billing/confirm - ยืนยันการชำระเงิน และออกใบเสร็จรับเงิน
func ConfirmPayment(c *gin.Context) {
	var req ConfirmPaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var billing models.Billing
	if err := config.DB.Where("visit_id = ?", req.VisitID).First(&billing).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Billing record not found"})
		return
	}

	if req.PaymentMethod == "Cash" && req.CashReceived < billing.NetAmount {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cash received is less than net amount"})
		return
	}

	// ออกหมายเลขใบเสร็จแบบ Unique (เช่น REC-YYYYMMDD-XXXX)
	receiptNo := fmt.Sprintf("REC-%s-%04d", time.Now().Format("20060102"), billing.ID)

	billing.PaymentMethod = req.PaymentMethod
	billing.PaymentStatus = "paid"
	billing.ReceiptNumber = receiptNo

	if err := config.DB.Save(&billing).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to confirm payment: " + err.Error()})
		return
	}

	// หากชำระผ่าน QR ให้ปรับสถานะ QRPayment เป็น completed
	if req.PaymentMethod == "QR Code" {
		config.DB.Model(&models.QRPayment{}).Where("billing_id = ?", billing.ID).Update("status", "completed")
	}

	// ปรับสถานะในตาราง billing_queues และ queues เป็น completed
	config.DB.Model(&models.BillingQueue{}).Where("visit_id = ?", req.VisitID).Update("status", "completed")
	var visit models.VisitRecord
	if err := config.DB.First(&visit, req.VisitID).Error; err == nil && visit.PatientID > 0 {
		config.DB.Model(&models.Queue{}).Where("patient_id = ?", visit.PatientID).Update("status", "completed")
	}

	changeAmount := 0.0
	if req.PaymentMethod == "Cash" {
		changeAmount = req.CashReceived - billing.NetAmount
	}

	// ดึงข้อมูลผู้ป่วยและยามาสร้างประวัติการชำระเงิน BillingHistory
	var bQueue models.BillingQueue
	config.DB.Where("visit_id = ?", req.VisitID).Order("id desc").First(&bQueue)

	patName := bQueue.PatientName
	if patName == "" {
		patName = "ผู้ป่วย"
	}
	hn := bQueue.HN
	if hn == "" {
		hn = fmt.Sprintf("HN-%d", req.VisitID)
	}

	history := models.BillingHistory{
		ReceiptNumber: receiptNo,
		VisitID:       req.VisitID,
		HN:            hn,
		PatientName:   patName,
		NationalID:    bQueue.NationalID,
		DoctorName:    "นพ. วรปรัชญ์ สิทธิโชค",
		TotalAmount:   billing.TotalAmount,
		Discount:      billing.DiscountFromEligibility,
		NetAmount:     billing.NetAmount,
		PaymentMethod: req.PaymentMethod,
		PaymentStatus: "completed",
		Medications:   bQueue.Medications,
		CashReceived:  req.CashReceived,
		ChangeAmount:  changeAmount,
		CreatedAt:     time.Now(),
	}
	config.DB.Create(&history)

	// Broadcast Event ให้ทุกแผนกทราบแบบ Real-time
	ws.BroadcastEvent("PAYMENT_CONFIRMED", billing)
	ws.BroadcastEvent("BILLING_HISTORY_CREATED", history)
	ws.BroadcastEvent("QUEUE_UPDATED", gin.H{"action": "payment_completed", "visit_id": req.VisitID})

	c.JSON(http.StatusOK, gin.H{
		"status":         "success",
		"message":        "Payment confirmed successfully",
		"billing":        billing,
		"history":        history,
		"receipt_number": receiptNo,
		"change_amount":  changeAmount,
	})
}
