package controllers

import (
	"net/http"
	"time"

	"clinic-backend/internal/config"
	"clinic-backend/internal/models"
	"github.com/gin-gonic/gin"
)

// Req struct
type RegisterPatientReq struct {
	NationalID			string		`json:"national_id" binding:"required,len=13"`
	FullName			string		`json:"fullname" binding:"required"`
	BirthDate			string		`json:"birthdate" binding:"required"`
	Address				string		`json:"address"`
	PhoneNumber			string		`json:"phone_number" binding:"required"`
	EmergencyContact	string		`json:"emergency_contact"`
}


// error handling and reg new patient
func RegisterPatient(c *gin.Context) {
	var req RegisterPatientReq

	// required check
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "กรุณากรอกเลขบัตรประชาชนให้ครบ 3 หลัก และกรอกชื่อ-เบอร์โทรให้ถูกต้อง"})
		return
	}

	// birth date format check
	parsedBirthDate, err := time.Parse("2006-01-02", req.BirthDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รูปแบบวันเกิดไม่ถูกต้อง กรุณาใช้ YYYY-MM-DD"})
		return
	}

	// query checking in DB 
	var existingPatient models.Patient
	check := config.DB.Where("national_id = ?" , req.NationalID).First(&existingPatient)
	if check.Error == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "เลขบัตรประชาชนนี้เคยลงทะเบียนในระบบแล้ว"})
		return
	}

	// define new patient
	newPatient := models.Patient{
		NationalID:				req.NationalID,
		FullName:				req.FullName,
		BirthDate:				parsedBirthDate,
		Address:				req.Address,
		PhoneNumber:			req.PhoneNumber,
		EmergencyContact:		req.EmergencyContact,
	}

	// add new patient to DB (DB.Create return as Error Type)
	if err := config.DB.Create(&newPatient).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถบันทึกข้อมูลคนไข้ได้"})
		return
	}

	// send json object to frontend
	c.JSON(http.StatusCreated, gin.H{
		"message": "ลงทะเบียนคนไข้ใหม่สำเร็จ",
		"patient": newPatient,
	})
}

// searching func
func SearchPatient(c *gin.Context) {
	// get national id by json parameter 
	nationalID := c.Param("national_id")

	// national id len check
	if len(nationalID) != 13 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "เลขบัตรประชาชนต้องมี 13 หลักเท่านั้น"})
		return
	}

	var patient models.Patient

	// DB query and get first line
	result := config.DB.Where("national_id = ?", nationalID).First(&patient)
	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบประวัติคนไข้รายนี้ในระบบ"})
		return
	}

	c.JSON(http.StatusOK, patient)
}