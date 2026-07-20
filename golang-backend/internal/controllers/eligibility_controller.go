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
	schemeType := "จ่ายเงินด้วยตนเอง"
	details := "ชำระเงินเต็มจำนวนตามใบเสร็จ"

	if lastDigit % 3 == 0 {
		schemeType = "บัตรทอง (สปสช.)"
		details = "ครอบคลุมการรักษาโรคทั่วไป ยกเว้นค่ายานอกบัญชีและค่าบริการพิเศษ"
	} else if lastDigit % 3 == 1 {
		schemeType = "ประกันสังคม"
		details = "ครอบคลุมสิทธิ์ตามโรงพยาบาลคู่สัญญา ค่าบริการส่วนเกินคนไข้ชำระเอง"
	} else if lastDigit % 3 == 2 {
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
type SaveEligibilityReq struct {
	PatientID			uint		`json:"patient_id" binding:"required"`
	SchemeType			string		`json:"scheme_type" binding:"required"`
	CoverageDetails		string		`json:"coverage_details"`
}


func SavePatientEligibility(c *gin.Context) {
	var req SaveEligibilityReq

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ข้อมูลการบันทึกสิทธิ์ไม่ถูกต้อง"})
		return
	}

	var patient models.Patient
	if err := config.DB.First(&patient, req.PatientID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบคนไข้ในระบบ"})
		return
	}
	
	var existingEligibility models.MedicalEligibility
	result := config.DB.Where("patient_id = ?", req.PatientID).First(&existingEligibility)
	// 6. แก้ไขลอจิกแบ่งบล็อกอัปเดต / บันทึกใหม่ ให้ถูกต้อง
	if result.Error == nil {
		// ถ้ามีอยู่แล้ว ➡️ อัปเดตข้อมูล
		existingEligibility.SchemeType = req.SchemeType
		existingEligibility.CoverageDetails = req.CoverageDetails
		existingEligibility.VerifiedAt = time.Now()
		if err := config.DB.Save(&existingEligibility).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถอัปเดตข้อมูลสิทธิ์การรักษาได้"})
			return
		}
	} else {
		// ถ้ายังไม่มี ➡️ บันทึกตัวใหม่
		newEligibility := models.MedicalEligibility{
			PatientID:       req.PatientID,   // 5. แก้ไขสะกดคำเป็น PatientID
			SchemeType:      req.SchemeType,
			CoverageDetails: req.CoverageDetails, // แก้ไข: ให้บันทึกค่ารายละเอียดสิทธิ์จริง
			VerifiedAt:      time.Now(),
		}
		if err := config.DB.Create(&newEligibility).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถบันทึกข้อมูลสิทธิ์การรักษาใหม่ได้"})
			return
		}
	}
	c.JSON(http.StatusOK, gin.H{"message": "บันทึกและยืนยันสิทธิ์การรักษาเรียบร้อยแล้ว"})
}

