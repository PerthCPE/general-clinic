package controllers

import (
	"fmt"
	"math"
	"net/http"
	"time"

	"clinic-backend/internal/config"
	"clinic-backend/internal/models"
	"clinic-backend/internal/ws"

	"github.com/gin-gonic/gin"
)

type RecordVitalsReq struct {
	PatientID        uint    `json:"patient_id" binding:"required"`
	QueueNumber      string  `json:"queue_number"`
	ChiefComplaint   string  `json:"chief_complaint" binding:"required"`
	Weight           float64 `json:"weight" binding:"required"`
	Height           float64 `json:"height" binding:"required"`
	Temperature      float64 `json:"temperature" binding:"required"`
	SystolicBP       int     `json:"systolic_bp" binding:"required"`
	DiastolicBP      int     `json:"diastolic_bp" binding:"required"`
	HeartRate        int     `json:"heart_rate" binding:"required"`
	RespiratoryRate  int     `json:"respiratory_rate"`
	SpO2             int     `json:"spo2"`
	Allergies        string  `json:"allergies"`
	MedicalHistory   string  `json:"medical_history"`
	NurseNotes       string  `json:"nurse_notes"`
	AssignedDoctorID uint    `json:"assigned_doctor_id"`
	TriageLevel      string  `json:"triage_level"`
}

func RecordVitalsAndTriage(c *gin.Context) {
	var req RecordVitalsReq

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "กรุณากรอกข้อมูลสัญญาณชีพให้ครบถ้วน"})
		return
	}

	var patient models.Patient
	if err := config.DB.First(&patient, req.PatientID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบผู้ป่วยรายนี้ในระบบ"})
		return
	}

	HeightMeter := req.Height / 100
	BMI := 0.0
	if HeightMeter > 0 {
		BMI = math.Round((req.Weight/(HeightMeter*HeightMeter))*100) / 100.0
	}

	// กำหนดระดับ Triage มาตรฐานทางการแพทย์ (ปราศจาก Unicode Emojis ตามกฎของโปรเจกต์)
	triageLevel := req.TriageLevel
	if triageLevel == "" {
		if req.SystolicBP >= 180 || req.DiastolicBP >= 110 || req.HeartRate >= 130 || req.Temperature >= 39.5 || (req.SpO2 > 0 && req.SpO2 < 90) {
			triageLevel = "วิกฤต (Resuscitation)"
		} else if req.SystolicBP >= 160 || req.DiastolicBP >= 100 || req.HeartRate >= 110 || req.Temperature >= 38.5 || (req.SpO2 > 0 && req.SpO2 < 95) {
			triageLevel = "ฉุกเฉิน (Emergency)"
		} else if req.SystolicBP >= 140 || req.DiastolicBP >= 90 || req.HeartRate >= 100 || req.Temperature >= 37.5 {
			triageLevel = "เร่งด่วน (Urgent)"
		} else {
			triageLevel = "ปกติ (Normal)"
		}
	}

	// สร้าง VisitRecord
	newVisitRecord := models.VisitRecord{
		PatientID: req.PatientID,
		DoctorID:  req.AssignedDoctorID,
		VisitDate: time.Now(),
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
		VisitID:          newVisitRecord.ID,
		ScreenedByUserID: nurseID,
		AssignedDoctorID: req.AssignedDoctorID,
		TriageLevel:      triageLevel,
		ChiefComplaint:   req.ChiefComplaint,
		Allergies:        req.Allergies,
		MedicalHistory:   req.MedicalHistory,
		NurseNotes:       req.NurseNotes,
		Weight:           req.Weight,
		Height:           req.Height,
		BMI:              BMI,
		Temperature:      req.Temperature,
		SystolicBP:       req.SystolicBP,
		DiastolicBP:      req.DiastolicBP,
		HeartRate:        req.HeartRate,
		RespiratoryRate:  req.RespiratoryRate,
		SpO2:             req.SpO2,
	}

	if err := config.DB.Create(&newScreening).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถบันทึกข้อมูลการคัดกรองได้"})
		return
	}

	// อัปเดตสถานะคิวคนไข้ (ทั้งกรณีค้นหาจาก queue_number หรือ patient_id)
	var queue models.Queue
	queueQuery := config.DB.Where("patient_id = ? AND status IN ?", req.PatientID, []string{"รอคัดกรอง", "รอซักประวัติ"})
	if req.QueueNumber != "" {
		queueQuery = config.DB.Where("queue_number = ? AND status IN ?", req.QueueNumber, []string{"รอคัดกรอง", "รอซักประวัติ"})
	}

	if err := queueQuery.First(&queue).Error; err == nil {
		queue.Status = "รอพบแพทย์"
		if req.AssignedDoctorID > 0 {
			var doc models.User
			if err := config.DB.First(&doc, req.AssignedDoctorID).Error; err == nil {
				queue.Department = fmt.Sprintf("ห้องตรวจ %d (%s)", req.AssignedDoctorID, doc.FullName)
			} else {
				queue.Department = fmt.Sprintf("ห้องตรวจ %d", req.AssignedDoctorID)
			}
		}
		queue.Note = fmt.Sprintf("คัดกรองแล้ว: %s (BP: %d/%d, T: %.1f°C, HR: %d)", triageLevel, req.SystolicBP, req.DiastolicBP, req.Temperature, req.HeartRate)
		config.DB.Save(&queue)
	}

	// อัปเดตประวัติแพ้ยาและโรคประจำตัวใน Patient
	if req.Allergies != "" {
		patient.Allergies = req.Allergies
	}
	if req.MedicalHistory != "" {
		patient.ChronicDiseases = req.MedicalHistory
	}
	config.DB.Save(&patient)

	// ส่ง WebSocket Broadcast แจ้งเตือนทุกเครื่องว่ามีการคัดกรองใหม่และคิวเปลี่ยนสถานะ
	ws.BroadcastEvent("VITALS_RECORDED", newScreening)
	if queue.ID > 0 {
		ws.BroadcastEvent("QUEUE_UPDATED", queue)
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":      "บันทึกข้อมูลการคัดกรองและส่งต่อคิวเรียบร้อยแล้ว",
		"screening_id": newScreening.ID,
		"bmi":          BMI,
		"triage_level": triageLevel,
	})
}

// GetDoctors - ดึงรายชื่อแพทย์ทั้งหมดที่พร้อมให้บริการ
func GetDoctors(c *gin.Context) {
	var doctors []models.User
	err := config.DB.Where("role = ?", "doctor").
		Order("id asc").
		Find(&doctors).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถดึงรายชื่อแพทย์ได้"})
		return
	}

	c.JSON(http.StatusOK, doctors)
}

// GetAllScreeningHistory - ดึงประวัติการคัดกรองทั้งหมดสำหรับ Dashboard
func GetAllScreeningHistory(c *gin.Context) {
	var screenings []models.Screening

	err := config.DB.Preload("VisitRecord.Patient").
		Preload("ScreenedBy").
		Preload("AssignedDoctor").
		Order("created_at desc").
		Find(&screenings).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถดึงประวัติการคัดกรองได้"})
		return
	}

	c.JSON(http.StatusOK, screenings)
}

// GetScreeningHistory - ดึงประวัติการคัดกรองย้อนหลังของผู้ป่วยรายบุคคล
func GetScreeningHistory(c *gin.Context) {
	patientID := c.Param("patient_id")

	var screenings []models.Screening
	err := config.DB.Joins("JOIN visit_records ON visit_records.id = screenings.visit_id").
		Where("visit_records.patient_id = ?", patientID).
		Preload("VisitRecord.Patient").
		Preload("ScreenedBy").
		Preload("AssignedDoctor").
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
