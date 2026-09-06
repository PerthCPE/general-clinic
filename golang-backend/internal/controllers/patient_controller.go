package controllers

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"clinic-backend/internal/config"
	"clinic-backend/internal/models"
	"clinic-backend/internal/ws"
	"github.com/gin-gonic/gin"
)

// Req struct
type RegisterPatientReq struct {
	HN               string `json:"hn"`
	NationalID       string `json:"national_id" binding:"required,len=13"`
	FullName         string `json:"fullname" binding:"required"`
	Gender           string `json:"gender"`
	BirthDate        string `json:"birthdate" binding:"required"`
	Address          string `json:"address"`
	PhoneNumber      string `json:"phone_number" binding:"required"`
	EmergencyContact string `json:"emergency_contact"`
	SchemeType       string `json:"scheme_type"`
	Allergies        string `json:"allergies"`
	ChronicDiseases  string `json:"chronic_diseases"`
}

// GetPatients - ดึงรายชื่อคนไข้ทั้งหมด
func GetPatients(c *gin.Context) {
	var patients []models.Patient
	if err := config.DB.Order("created_at desc").Find(&patients).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถดึงรายชื่อผู้ป่วยได้"})
		return
	}
	c.JSON(http.StatusOK, patients)
}

// error handling and reg new patient
func RegisterPatient(c *gin.Context) {
	var req RegisterPatientReq

	// required check
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "กรุณากรอกเลขบัตรประชาชนให้ครบ 13 หลัก และกรอกชื่อ-เบอร์โทรให้ถูกต้อง"})
		return
	}

	// birth date format check with Buddhist Era (พ.ศ.) auto-conversion
	var parsedBirthDate time.Time
	cleanBD := strings.TrimSpace(req.BirthDate)
	if parsed, err := time.Parse("2006-01-02", cleanBD); err == nil {
		parsedBirthDate = parsed
	} else if parsed, err := time.Parse("02/01/2006", cleanBD); err == nil {
		parsedBirthDate = parsed
	} else if parsed, err := time.Parse("2006/01/02", cleanBD); err == nil {
		parsedBirthDate = parsed
	} else {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รูปแบบวันเกิดไม่ถูกต้อง กรุณาใช้ DD/MM/YYYY หรือ YYYY-MM-DD"})
		return
	}

	// หากปีเกิดเป็น พ.ศ. (>= 2400) ให้แปลงเป็น ค.ศ. (ลบ 543 ปี)
	if parsedBirthDate.Year() >= 2400 {
		parsedBirthDate = parsedBirthDate.AddDate(-543, 0, 0)
	}

	// query checking in DB
	var existingPatient models.Patient
	check := config.DB.Where("national_id = ?", req.NationalID).First(&existingPatient)
	if check.Error == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "เลขบัตรประชาชนนี้เคยลงทะเบียนในระบบแล้ว"})
		return
	}

	// Auto generate HN if empty (strictly HN + 4-digit decimal format: HN0001, HN0002, etc.)
	hn := req.HN
	if strings.TrimSpace(hn) == "" {
		var allPatients []models.Patient
		config.DB.Select("hn, id").Find(&allPatients)
		maxNum := 0
		for _, p := range allPatients {
			clean := strings.TrimPrefix(strings.TrimPrefix(strings.ToUpper(p.HN), "HN-"), "HN")
			var num int
			if _, err := fmt.Sscanf(clean, "%d", &num); err == nil && num > maxNum {
				maxNum = num
			}
			if int(p.ID) > maxNum {
				maxNum = int(p.ID)
			}
		}
		hn = fmt.Sprintf("HN%04d", maxNum+1)
	}

	// define new patient
	newPatient := models.Patient{
		HN:               hn,
		NationalID:       req.NationalID,
		FullName:         req.FullName,
		Gender:           req.Gender,
		BirthDate:        parsedBirthDate,
		Address:          req.Address,
		PhoneNumber:      req.PhoneNumber,
		EmergencyContact: req.EmergencyContact,
		SchemeType:       req.SchemeType,
		Allergies:        req.Allergies,
		ChronicDiseases:  req.ChronicDiseases,
	}

	// add new patient to DB
	if err := config.DB.Create(&newPatient).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถบันทึกข้อมูลคนไข้ได้"})
		return
	}

	// สร้างข้อมูลสิทธิ์การรักษาเริ่มต้นให้สอดคล้องกันทันที
	schemeType := req.SchemeType
	if schemeType == "" {
		schemeType = "บัตรทอง (สปสช.)"
	}
	coverage := "ครอบคลุมการรักษาโรคทั่วไปตามสิทธิ์"
	if strings.Contains(schemeType, "บัตรทอง") {
		coverage = "ครอบคลุมการรักษาโรคทั่วไป ยกเว้นค่ายานอกบัญชีและบริการพิเศษ"
	} else if strings.Contains(schemeType, "ประกันสังคม") {
		coverage = "ผู้ประกันตนมาตรา 33 ครอบคลุมการรักษาตามเกณฑ์ สปส."
	} else if strings.Contains(schemeType, "ข้าราชการ") {
		coverage = "จ่ายตรงกรมบัญชีกลาง เบิกค่ายาและค่ารักษาได้ตามสิทธิ์"
	} else if strings.Contains(schemeType, "เอกชน") {
		coverage = "คุ้มครองตามวงเงินกรมธรรม์ประกันสุขภาพ"
	} else if strings.Contains(schemeType, "ชำระเงินเอง") {
		coverage = "ชำระค่ารักษาพยาบาลด้วยตนเอง"
	}

	initialEligibility := models.MedicalEligibility{
		PatientID:       &newPatient.ID,
		SchemeType:      schemeType,
		CoverageDetails: coverage,
		HospitalName:    "โรงพยาบาลคลินิกเวชกรรมชุมชน",
		Status:          "ใช้งานได้",
		ExpireDate:      "31/12/2026",
		VerifiedAt:      time.Now(),
	}
	config.DB.Create(&initialEligibility)

	// สร้างคิวรอคัดกรองให้อัตโนมัติ เพื่อส่งต่อเข้าสู่ระบบคัดกรองทันที
	var qCount int64
	config.DB.Model(&models.Queue{}).Count(&qCount)
	queueNo := fmt.Sprintf("Q%04d", qCount+1)

	var creatorID uint = 2
	if val, exists := c.Get("userID"); exists {
		if idFloat, ok := val.(float64); ok {
			creatorID = uint(idFloat)
		} else if idUint, ok := val.(uint); ok {
			creatorID = idUint
		}
	}

	newQueue := models.Queue{
		PatientID:       newPatient.ID,
		CreatedByUserID: creatorID,
		QueueNumber:     queueNo,
		Status:          "รอคัดกรอง",
		Department:      "จุดคัดกรอง",
		Note:            "ส่งเข้าคิวจากการลงทะเบียน",
	}
	config.DB.Create(&newQueue)
	ws.BroadcastEvent("QUEUE_CREATED", newQueue)

	// ส่ง WebSocket Broadcast แจ้งเตือนทุกเครื่องว่ามีผู้ป่วยใหม่ลงทะเบียน
	ws.BroadcastEvent("PATIENT_REGISTERED", newPatient)

	// send json object to frontend
	c.JSON(http.StatusCreated, gin.H{
		"message": "ลงทะเบียนคนไข้ใหม่และส่งเข้าคิวคัดกรองสำเร็จ",
		"patient": newPatient,
		"queue":   newQueue,
	})
}

// SearchPatient - ค้นหาผู้ป่วยแบบยืดหยุ่น รองรับทั้งเลขบัตรประชาชน 13 หลัก, ชื่อ, นามสกุล, หรือ HN
func SearchPatient(c *gin.Context) {
	query := strings.TrimSpace(c.Query("q"))
	if query == "" {
		query = strings.TrimSpace(c.Param("query"))
	}
	if query == "" {
		query = strings.TrimSpace(c.Param("national_id"))
	}

	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "กรุณาระบุคำค้นหา"})
		return
	}

	cleanDigits := strings.ReplaceAll(strings.ReplaceAll(query, "-", ""), " ", "")
	words := strings.Fields(query)

	var patients []models.Patient
	tx := config.DB.Model(&models.Patient{})

	if len(cleanDigits) == 13 {
		// 1. เลขประจำตัวประชาชน 13 หลัก
		tx = tx.Where("national_id = ?", cleanDigits)
	} else if len(words) > 1 {
		// 2. ค้นหาหลายคำ เช่น "สมชาย ใจดี" หรือ "นาย สมชาย"
		for _, w := range words {
			tx = tx.Where("full_name ILIKE ?", "%"+w+"%")
		}
	} else {
		// 3. คำค้นหาเดี่ยว: ชื่อ หรือ นามสกุล หรือ เลขบัตรบางส่วน หรือ HN หรือ เบอร์โทร
		tx = tx.Where(
			"full_name ILIKE ? OR national_id LIKE ? OR hn ILIKE ? OR phone_number LIKE ?",
			"%"+query+"%",
			"%"+cleanDigits+"%",
			"%"+query+"%",
			"%"+cleanDigits+"%",
		)
	}

	err := tx.Order("id desc").Limit(20).Find(&patients).Error
	if err != nil || len(patients) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบประวัติคนไข้รายนี้ในระบบ"})
		return
	}

	c.JSON(http.StatusOK, patients)
}