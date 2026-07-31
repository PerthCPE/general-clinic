package controllers

import (
	"math"
	"net/http"

	"clinic-backend/internal/config"
	"clinic-backend/internal/models"

	"github.com/gin-gonic/gin"
)

type RecordVitalsReq struct {
	PatientID      uint    `json:"patient_id" binding:"required"`
	QueueNumber    string  `json:"queue_number" binding:"required"`
	ChiefComplaint string  `json:"chief_complaint" binding:"required"`
	Weight         float64 `json:"weight" binding:"required"`
	Height         float64 `json:"height" binding:"required"`
	Temperature    float64 `json:"temperature" binding:"required"`
	SystolicBP     int     `json:"systolic_bp" binding:"required"`
	DiastolicBP    int     `json:"diastolic_bp" binding:"required"`
	HeartRate      int     `json:"heart_rate" binding:"required"`
	Allergies      string  `json:"allergies"`
	MedicalHistory string  `json:"medical_history"`
}

func RecordVitalsAndTriage(c *gin.Context) {
	var req RecordVitalsReq

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "กรอกข้อมูลที่ระบบต้องการให้ครบ"})
		return
	}

	if err := config.DB.First(&models.Patient{}, req.PatientID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบผู้ป่วยรายนี้ในระบบ"})
		return
	}

	HeightMeter := req.Height / 100
	BMI := math.Round((req.Weight/(HeightMeter*HeightMeter))*100) / 100.0

	triageLevel := "ปกติ (🟢)"

	if req.SystolicBP >= 180 || req.HeartRate >= 120 || req.Temperature >= 39.5 {
		triageLevel = "ฉุกเฉิน (🔴)"
	} else if req.SystolicBP >= 140 || req.HeartRate >= 100 || req.Temperature >= 38.0 {
		triageLevel = "เร่งด่วน (🟡)"
	}

	newVisitRecord := models.VisitRecord{
		PatientID: req.PatientID,
	}

	if err := config.DB.Create(&newVisitRecord).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถบันทึกข้อมูลการเข้ารับบริการได้"})
		return
	}

	// ดึง ID ของพยาบาลจาก Token JWT Context
	var nurseID uint
	if val, exists := c.Get("userID"); exists {
		if idFloat, ok := val.(float64); ok {
			nurseID = uint(idFloat)
		} else if idUint, ok := val.(uint); ok {
			nurseID = idUint
		}
	}

	newScreening := models.Screening{
		ChiefComplaint:   req.ChiefComplaint,
		Weight:           req.Weight,
		Height:           req.Height,
		Temperature:      req.Temperature,
		SystolicBP:       req.SystolicBP,
		DiastolicBP:      req.DiastolicBP,
		HeartRate:        req.HeartRate,
		Allergies:        req.Allergies,
		MedicalHistory:   req.MedicalHistory,
		BMI:              BMI,
		TriageLevel:      triageLevel,
		VisitID:          newVisitRecord.ID,
		ScreenedByUserID: nurseID, // ผูกกับ ID ของพยาบาลผู้ทำการตรวจ
	}

	if err := config.DB.Create(&newScreening).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถบันทึกข้อมูลการคัดกรองได้"})
		return
	}

	var queue models.Queue

	if err := config.DB.Where("patient_id = ? AND status = ?", req.PatientID, "รอซักประวัติ").First(&queue).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถอัปเดตสถานะคิวคนไข้ได้"})
		return
	}

	queue.Status = "รอพบแพทย์"
	if err := config.DB.Save(&queue).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถอัปเดตสถานะคิวคนไข้ได้"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":      "บันทึกข้อมูลการคัดกรองและส่งต่อคิวเรียบร้อยแล้ว",
		"bmi":          BMI,
		"triage_level": triageLevel,
	})
}

// GetScreeningHistory - ดึงประวัติการคัดกรองย้อนหลังของผู้ป่วย
func GetScreeningHistory(c *gin.Context) {
	patientID := c.Param("patient_id")

	var screenings []models.Screening
	err := config.DB.Joins("JOIN visit_records ON visit_records.id = screenings.visit_id").
		Where("visit_records.patient_id = ?", patientID).
		Preload("ScreenedBy").
		Order("screenings.created_at desc").
		Find(&screenings).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถดึงประวัติการคัดกรองได้"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"patient_id": patientID,
		"history":    screenings,
	})
}
