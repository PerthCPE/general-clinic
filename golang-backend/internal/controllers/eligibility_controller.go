package controllers

import (
	"net/http"
	"strings"
	"time"

	"clinic-backend/internal/config"
	"clinic-backend/internal/models"
	"clinic-backend/internal/ws"
	"github.com/gin-gonic/gin"
)

// external check for eligibility
func CheckExternalEligibility(c *gin.Context) {
	nationalID := c.Param("national_id")

	// national id len check
	if len(nationalID) != 13 {	
		c.JSON(http.StatusBadRequest, gin.H{"error": "เลขบัตรประชาชนต้องมี 13 หลักเท่านั้น"})
		return
	}

	var patient models.Patient

	// national id DB query
	if err := config.DB.Where("national_id = ?", nationalID).First(&patient).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบประวัติคนไข้รายนี้ในระบบ"})
		return
	}

	// ตรวจสอบว่ามีบันทึกสิทธิ์เดิมในฐานข้อมูลหรือไม่
	var existingEligibility models.MedicalEligibility
	if err := config.DB.Where("patient_id = ?", patient.ID).Order("verified_at desc").First(&existingEligibility).Error; err == nil {
		c.JSON(http.StatusOK, gin.H{
			"patient_id":        patient.ID,
			"fullname":          patient.FullName,
			"national_id":       patient.NationalID,
			"scheme_type":       existingEligibility.SchemeType,
			"coverage_details":  existingEligibility.CoverageDetails,
			"hospital_name":     existingEligibility.HospitalName,
			"status":            existingEligibility.Status,
			"expire_date":       existingEligibility.ExpireDate,
			"verified_at":       existingEligibility.VerifiedAt,
		})
		return
	}

	// หากยังไม่มีประวัติสิทธิ์เดิม ให้ใช้สิทธิ์ที่ลงทะเบียนไว้กับคนไข้
	schemeType := patient.SchemeType
	if schemeType == "" {
		schemeType = "บัตรทอง (สปสช.)"
	}
	details := "ครอบคลุมการรักษาโรคทั่วไป ยกเว้นค่ายานอกบัญชีและค่าบริการพิเศษ"
	if strings.Contains(schemeType, "ประกันสังคม") {
		details = "ผู้ประกันตนมาตรา 33 ครอบคลุมการรักษาตามเกณฑ์ สปส."
	} else if strings.Contains(schemeType, "ข้าราชการ") {
		details = "จ่ายตรงกรมบัญชีกลาง เบิกค่ายาและค่ารักษาได้ตามสิทธิ์"
	} else if strings.Contains(schemeType, "เอกชน") {
		details = "คุ้มครองตามวงเงินกรมธรรม์ประกันสุขภาพ"
	} else if strings.Contains(schemeType, "ชำระเงินเอง") {
		details = "ชำระค่ารักษาพยาบาลด้วยตนเอง"
	}

	c.JSON(http.StatusOK, gin.H{
		"patient_id":        patient.ID,
		"fullname":          patient.FullName,
		"national_id":       patient.NationalID,
		"scheme_type":       schemeType,
		"coverage_details":  details,
		"hospital_name":     "โรงพยาบาลคลินิกเวชกรรมชุมชน",
		"status":            "ใช้งานได้",
		"expire_date":       "31/12/2026",
		"verified_at":       time.Now(),
	})
}

// Eligibility Struct Req
type SaveEligibilityReq struct {
	PatientID       uint   `json:"patient_id" binding:"required"`
	SchemeType      string `json:"scheme_type" binding:"required"`
	CoverageDetails string `json:"coverage_details"`
	HospitalName    string `json:"hospital_name"`
	Status          string `json:"status"`
	ExpireDate      string `json:"expire_date"`
}

// GetEligibilityHistory - ดึงประวัติการตรวจสอบสิทธิ์ทั้งหมด
func GetEligibilityHistory(c *gin.Context) {
	var histories []models.MedicalEligibility

	err := config.DB.Preload("Patient").
		Preload("User").
		Order("verified_at desc").
		Find(&histories).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถดึงประวัติการตรวจสอบสิทธิ์ได้"})
		return
	}

	c.JSON(http.StatusOK, histories)
}

func SavePatientEligibility(c *gin.Context) {
	var req SaveEligibilityReq

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ข้อมูลการบันทึกสิทธิ์ไม่ถูกต้อง"})
		return
	}

	var patient models.Patient
	if err := config.DB.First(&patient, req.PatientID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบคนไข้ในระบบ"})
		return
	}

	// ดึง ID ผู้ใช้จาก JWT
	var userID *uint
	if val, exists := c.Get("userID"); exists {
		if idFloat, ok := val.(float64); ok {
			u := uint(idFloat)
			userID = &u
		} else if idUint, ok := val.(uint); ok {
			userID = &idUint
		}
	}

	hospitalName := req.HospitalName
	if hospitalName == "" {
		hospitalName = "โรงพยาบาลคลินิกเวชกรรมชุมชน"
	}
	status := req.Status
	if status == "" {
		status = "ใช้งานได้"
	}
	expireDate := req.ExpireDate
	if expireDate == "" {
		expireDate = "31/12/2026"
	}

	var existingEligibility models.MedicalEligibility
	result := config.DB.Where("patient_id = ?", req.PatientID).First(&existingEligibility)

	if result.Error == nil {
		existingEligibility.SchemeType = req.SchemeType
		existingEligibility.CoverageDetails = req.CoverageDetails
		existingEligibility.HospitalName = hospitalName
		existingEligibility.Status = status
		existingEligibility.ExpireDate = expireDate
		existingEligibility.UserID = userID
		existingEligibility.VerifiedAt = time.Now()
		if err := config.DB.Save(&existingEligibility).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถอัปเดตข้อมูลสิทธิ์การรักษาได้"})
			return
		}
	} else {
		newEligibility := models.MedicalEligibility{
			PatientID:       &req.PatientID,
			UserID:          userID,
			SchemeType:      req.SchemeType,
			CoverageDetails: req.CoverageDetails,
			HospitalName:    hospitalName,
			Status:          status,
			ExpireDate:      expireDate,
			VerifiedAt:      time.Now(),
		}
		if err := config.DB.Create(&newEligibility).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถบันทึกข้อมูลสิทธิ์การรักษาใหม่ได้"})
			return
		}
	}

	// อัปเดตสิทธิ์ใน Patient Entity ด้วยเพื่อให้สอดคล้องกัน
	patient.SchemeType = req.SchemeType
	config.DB.Save(&patient)

	// ส่ง WebSocket Broadcast แจ้งเตือนทุกเครื่องว่ามีการบันทึกสิทธิ์การรักษา
	ws.BroadcastEvent("ELIGIBILITY_SAVED", gin.H{
		"patient_id":  patient.ID,
		"scheme_type": patient.SchemeType,
	})

	c.JSON(http.StatusOK, gin.H{"message": "บันทึกและยืนยันสิทธิ์การรักษาเรียบร้อยแล้ว"})
}

