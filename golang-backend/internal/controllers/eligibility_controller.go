package controllers

import (
	"net/http"
	"time"

	"clinic-backend/internal/config"
	"clinic-backend/internal/models"
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

	// mock up for example to show on frontend
	lastDigit := int(nationalID[12] - '0')
	schemeType = "จ่ายเงินด้วยตนเอง"
	details = "ชำระเงินเต็มจำนวนตามใบเสร็จ"

	if lastDigit % 3 == 0 {
		schemeType = "บัตรทอง (สปสช.)"
		details = "ครอบคลุมการรักษาโรคทั่วไป ยกเว้นค่ายานอกบัญชีและค่าบริการพิเศษ"
	}
	else if lastDigit % 3 == 1 {
		schemeType = "ประกันสังคม"
		details = "ครอบคลุมสิทธิ์ตามโรงพยาบาลคู่สัญญา ค่าบริการส่วนเกินคนไข้ชำระเอง"
	}
	else if lastDigit % 3 == 2 {
		schemeType = "ประกันสุขภาพเอกชน"
		details = "ครอบคลุมค่ารักษาพยาบาลไม่เกิน 5,000 บาท/ครั้ง ส่วนเกินเบิกตามเงื่อนไขกรมธรรม์"
	}

	// send json object to show mock up on frontend
	c.JSON(http.StatusOK, gin.H{
		"patient_id":			patient.ID,
		"fullname":				patient.FullName,
		"national_id":			patient.NationalID,
		"scheme_type":			schemeType,
		"coverage_details":		details,
		"verified_at":			time.Now(),
	})
}

// Eligibility Struct Req
func SaveEligibilityReq struct (
	PatientID			uint		`json:"patient_id" binding:"required"`
	SchemeType			string		`json:"scheme_type" binding:"required"`
	CoverageDetails		string		`json:"coverage_details"`
)

func SavePatientEligibility(c *gin.Context) {
	var req SaveEligibilityReq

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ข้อมูลการบันทึกสิทธิ์ไม่ถูกต้อง"})
		return
	}

	var patient models.Patient
	if err := config.DB.Frist(&patient, req.PatientID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบคนไข้ในระบบ"})
		return
	}
}

