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
		VisitID     uint   `json:"visit_id"`
		HN          string `json:"hn"`
		PatientName string `json:"patient_name"`
	}
	if err := c.ShouldBindJSON(&req); err != nil && req.VisitID == 0 && req.HN == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var dispensings []models.Dispensing
	if req.VisitID > 0 {
		config.DB.Preload("Medicine").Where("visit_id = ?", req.VisitID).Find(&dispensings)
	}

	totalAmount := 0.0
	tx := config.DB.Begin()

	// วนลูปตัดสต็อกยาแต่ละตัวที่ถูกสั่งจ่าย และรวมราคา
	for _, d := range dispensings {
		var med models.Medicine
		if err := tx.Where("id = ?", d.MedicineID).First(&med).Error; err == nil {
			if med.StockQuantity >= d.Quantity {
				med.StockQuantity -= d.Quantity
				tx.Save(&med)
			}
			totalAmount += float64(d.Quantity) * med.UnitPrice
		}
	}

	if totalAmount == 0 {
		totalAmount = 350.0
	}

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

	var queue models.Queue
	var visit models.VisitRecord
	var patient models.Patient

	if req.VisitID > 0 {
		tx.Preload("Patient").First(&visit, req.VisitID)
		if visit.PatientID > 0 {
			patient = visit.Patient
			if err := tx.Where("patient_id = ? AND status != 'completed' AND status != 'เสร็จสิ้น'", visit.PatientID).First(&queue).Error; err == nil {
				queue.Status = "billing_waiting"
				queue.Department = "การเงิน"
				tx.Save(&queue)
			}
		}
	}

	if patient.ID == 0 && req.HN != "" {
		tx.Where("hn = ? OR hn = ?", req.HN, "HN-"+req.HN).First(&patient)
	}

	targetHN := patient.HN
	if targetHN == "" {
		targetHN = req.HN
	}
	if targetHN == "" {
		targetHN = fmt.Sprintf("HN-%d", time.Now().Unix()%10000)
	}

	targetName := patient.FullName
	if targetName == "" {
		targetName = req.PatientName
	}
	if targetName == "" {
		targetName = "ผู้ป่วย"
	}

	// อัปเดต/สร้างลงตาราง patient_medicines ใน Supabase DB ทันที!
	var patMed models.PatientMedicine
	if err := tx.Where("hn = ?", targetHN).First(&patMed).Error; err != nil {
		age := 35
		if patient.ID > 0 && patient.BirthDate.Year() > 1900 {
			age = time.Now().Year() - patient.BirthDate.Year()
		}
		patMed = models.PatientMedicine{
			HN:              targetHN,
			NationalID:      patient.NationalID,
			FullName:        targetName,
			Gender:          patient.Gender,
			Age:             age,
			SchemeType:      patient.SchemeType,
			Allergies:       patient.Allergies,
			ChronicDiseases: patient.ChronicDiseases,
			PhoneNumber:     patient.PhoneNumber,
			VisitCount:      1,
		}
		tx.Create(&patMed)
	} else {
		patMed.VisitCount += 1
		tx.Save(&patMed)
	}

	ws.BroadcastEvent("PATIENT_MEDICINE_UPDATED", patMed)
	tx.Commit()

	billingPayload := gin.H{
		"id":           billing.ID,
		"queue_id":     queue.ID,
		"queue_number": queue.QueueNumber,
		"visit_id":     billing.VisitID,
		"patient_name": targetName,
		"hn":           targetHN,
		"total_amount": billing.TotalAmount,
		"net_amount":   billing.NetAmount,
		"status":       billing.PaymentStatus,
		"created_at":   billing.CreatedAt,
	}

	ws.BroadcastEvent("DISPENSE_RECORDED", gin.H{"visit_id": req.VisitID, "action": "dispensed"})
	ws.BroadcastEvent("BILLING_CREATED", billingPayload)
	ws.BroadcastEvent("QUEUE_UPDATED", queue)

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Dispensing confirmed and billed successfully",
		"billing": billing,
	})
}

// GET /api/pharmacy/patient-medicines - ดึงประวัติผู้ป่วยและการรับยาทั้งหมดจากตาราง patient_medicines
func GetPatientMedicines(c *gin.Context) {
	var records []models.PatientMedicine
	if err := config.DB.Order("id desc").Find(&records).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch patient medicines: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":            "success",
		"patient_medicines": records,
	})
}

// GET /api/pharmacy/patient-medicines/:hn - ดึงประวัติการรับยาของป่วยรายบุคคลตาม HN
func GetPatientMedicineDetail(c *gin.Context) {
	hn := c.Param("hn")
	var patMed models.PatientMedicine
	if err := config.DB.Where("hn = ? OR hn = ?", hn, "HN-"+hn).First(&patMed).Error; err != nil {
		var patient models.Patient
		if errP := config.DB.Where("hn = ? OR hn = ?", hn, "HN-"+hn).First(&patient).Error; errP == nil {
			patMed = models.PatientMedicine{
				HN:              patient.HN,
				NationalID:      patient.NationalID,
				FullName:        patient.FullName,
				Gender:          patient.Gender,
				Age:             time.Now().Year() - patient.BirthDate.Year(),
				SchemeType:      patient.SchemeType,
				Allergies:       patient.Allergies,
				ChronicDiseases: patient.ChronicDiseases,
				PhoneNumber:     patient.PhoneNumber,
				VisitCount:      1,
			}
		} else {
			c.JSON(http.StatusNotFound, gin.H{"error": "Patient history not found"})
			return
		}
	}

	var patient models.Patient
	var dispensings []models.Dispensing
	if errP := config.DB.Where("hn = ?", patMed.HN).First(&patient).Error; errP == nil {
		var visitIDs []uint
		config.DB.Model(&models.VisitRecord{}).Where("patient_id = ?", patient.ID).Pluck("id", &visitIDs)
		if len(visitIDs) > 0 {
			config.DB.Preload("Medicine").Preload("Doctor").Where("visit_id IN ?", visitIDs).Find(&dispensings)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"status":           "success",
		"patient_medicine": patMed,
		"dispensings":      dispensings,
	})
}

