package controllers

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"clinic-backend/internal/config"
	"clinic-backend/internal/models"
	"clinic-backend/internal/services"
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
	PhoneNumber      string `json:"phone_number" binding:"required"`
	EmergencyContact string `json:"emergency_contact"`
	SchemeType       string `json:"scheme_type"`
	Allergies        string `json:"allergies"`
	ChronicDiseases  string `json:"chronic_diseases"`

	// Structured Address Fields (Sprint 3)
	HouseNo          string `json:"house_no"`
	VillageNo        string `json:"village_no"`
	VillageName      string `json:"village_name"`
	Alley            string `json:"alley"`
	Road             string `json:"road"`
	SubDistrict      string `json:"sub_district"`
	District         string `json:"district"`
	Province         string `json:"province"`
	PostalCode       string `json:"postal_code"`

	// Auto Queue Issuance Flag (Sprint 3.2 - default: false)
	IssueQueue       bool   `json:"issue_queue"`

	// Legacy Address fallback
	Address          string `json:"address"`
}

// ComposeAddress ประกอบฟิลด์ย่อยของที่อยู่เข้าเป็นสตริงเดียวกันตามมาตรฐาน
func ComposeAddress(houseNo, villageNo, villageName, alley, road, subDistrict, district, province, postalCode, fallback string) string {
	return composeAddress(houseNo, villageNo, villageName, alley, road, subDistrict, district, province, postalCode, fallback)
}

// composeAddress ประกอบฟิลด์ย่อยของที่อยู่เข้าเป็นสตริงเดียวกันตามมาตรฐาน
func composeAddress(houseNo, villageNo, villageName, alley, road, subDistrict, district, province, postalCode, fallback string) string {
	var parts []string
	if h := strings.TrimSpace(houseNo); h != "" {
		parts = append(parts, h)
	}
	if vNo := strings.TrimSpace(villageNo); vNo != "" {
		if strings.HasPrefix(vNo, "หมู่") {
			parts = append(parts, vNo)
		} else {
			parts = append(parts, "หมู่ "+vNo)
		}
	}
	if vName := strings.TrimSpace(villageName); vName != "" {
		parts = append(parts, vName)
	}
	if a := strings.TrimSpace(alley); a != "" {
		if strings.HasPrefix(a, "ซ.") || strings.HasPrefix(a, "ซอย") || strings.HasPrefix(a, "ตรอก") {
			parts = append(parts, a)
		} else {
			parts = append(parts, "ซ."+a)
		}
	}
	if r := strings.TrimSpace(road); r != "" {
		if strings.HasPrefix(r, "ถ.") || strings.HasPrefix(r, "ถนน") {
			parts = append(parts, r)
		} else {
			parts = append(parts, "ถ."+r)
		}
	}

	pTrim := strings.TrimSpace(province)
	isBkk := pTrim == "กรุงเทพมหานคร" || pTrim == "กทม." || strings.Contains(pTrim, "กรุงเทพ")

	if sd := strings.TrimSpace(subDistrict); sd != "" {
		if isBkk {
			if strings.HasPrefix(sd, "แขวง") {
				parts = append(parts, sd)
			} else {
				cleanSd := strings.TrimPrefix(strings.TrimPrefix(sd, "ตำบล"), "ต.")
				parts = append(parts, "แขวง"+strings.TrimSpace(cleanSd))
			}
		} else {
			if strings.HasPrefix(sd, "ต.") || strings.HasPrefix(sd, "ตำบล") {
				parts = append(parts, sd)
			} else {
				parts = append(parts, "ต."+sd)
			}
		}
	}

	if d := strings.TrimSpace(district); d != "" {
		if isBkk {
			if strings.HasPrefix(d, "เขต") {
				parts = append(parts, d)
			} else {
				cleanD := strings.TrimPrefix(strings.TrimPrefix(d, "อำเภอ"), "อ.")
				parts = append(parts, "เขต"+strings.TrimSpace(cleanD))
			}
		} else {
			if strings.HasPrefix(d, "อ.") || strings.HasPrefix(d, "อำเภอ") {
				parts = append(parts, d)
			} else {
				parts = append(parts, "อ."+d)
			}
		}
	}

	if pTrim != "" {
		if isBkk {
			parts = append(parts, "กรุงเทพมหานคร")
		} else if strings.HasPrefix(pTrim, "จ.") || strings.HasPrefix(pTrim, "จังหวัด") {
			parts = append(parts, pTrim)
		} else {
			parts = append(parts, "จ."+pTrim)
		}
	}

	if pc := strings.TrimSpace(postalCode); pc != "" {
		parts = append(parts, pc)
	}

	composed := strings.Join(parts, " ")
	if strings.TrimSpace(composed) != "" {
		return composed
	}
	return strings.TrimSpace(fallback)
}

func isOnlyDigits(s string) bool {
	for _, c := range s {
		if c < '0' || c > '9' {
			return false
		}
	}
	return len(s) > 0
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

	// Address Validation (Sprint 3: บังคับจังหวัดและอำเภอ)
	cleanProvince := strings.TrimSpace(req.Province)
	cleanDistrict := strings.TrimSpace(req.District)
	cleanPostal := strings.TrimSpace(req.PostalCode)

	if cleanProvince == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "กรุณาระบุจังหวัด"})
		return
	}
	if cleanDistrict == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "กรุณาระบุอำเภอ/เขต"})
		return
	}
	if cleanPostal != "" && (len(cleanPostal) != 5 || !isOnlyDigits(cleanPostal)) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก"})
		return
	}

	// birth date format check with Buddhist Era (พ.ศ.) auto-conversion
	cleanBD := strings.TrimSpace(req.BirthDate)
	parsedBirthDate, err := services.ParseFlexibleDate(cleanBD)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รูปแบบวันเกิดไม่ถูกต้อง กรุณาใช้ DD/MM/YYYY หรือ YYYY-MM-DD"})
		return
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

	composedAddr := composeAddress(
		req.HouseNo,
		req.VillageNo,
		req.VillageName,
		req.Alley,
		req.Road,
		req.SubDistrict,
		cleanDistrict,
		cleanProvince,
		cleanPostal,
		req.Address,
	)

	// define new patient
	newPatient := models.Patient{
		HN:               hn,
		NationalID:       req.NationalID,
		FullName:         req.FullName,
		Gender:           req.Gender,
		BirthDate:        parsedBirthDate,
		HouseNo:          strings.TrimSpace(req.HouseNo),
		VillageNo:        strings.TrimSpace(req.VillageNo),
		VillageName:      strings.TrimSpace(req.VillageName),
		Alley:            strings.TrimSpace(req.Alley),
		Road:             strings.TrimSpace(req.Road),
		SubDistrict:      strings.TrimSpace(req.SubDistrict),
		District:         cleanDistrict,
		Province:         cleanProvince,
		PostalCode:       cleanPostal,
		Address:          composedAddr,
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

	defaultExp := time.Date(2026, 12, 31, 0, 0, 0, 0, time.UTC)
	initialEligibility := models.MedicalEligibility{
		PatientID:       &newPatient.ID,
		SchemeType:      schemeType,
		CoverageDetails: coverage,
		HospitalName:    "โรงพยาบาลคลินิกเวชกรรมชุมชน",
		Status:          "ใช้งานได้",
		ExpireDate:      &defaultExp,
		VerifiedAt:      time.Now(),
	}
	config.DB.Create(&initialEligibility)

	// Sprint 3.2: ตรวจสอบ issue_queue flag (Default = false: ไม่ออกคิว)
	if req.IssueQueue {
		// สร้างคิวรอคัดกรองให้อัตโนมัติ เพื่อส่งต่อเข้าสู่ระบบคัดกรองทันที (Atomic Daily Sequential Queue)
		nowBkk := time.Now().In(services.BangkokLocation())
		serviceDate := time.Date(nowBkk.Year(), nowBkk.Month(), nowBkk.Day(), 0, 0, 0, 0, time.UTC)
		queueNo, qErr := services.NextQueueNumber(config.DB, nowBkk)
		if qErr != nil {
			var qCount int64
			config.DB.Model(&models.Queue{}).Where("service_date = ?", serviceDate).Count(&qCount)
			queueNo = fmt.Sprintf("Q%04X", qCount+1)
		}

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
			ServiceDate:     serviceDate,
			Status:          "รอคัดกรอง",
			Department:      "จุดคัดกรอง",
			Note:            "ส่งเข้าคิวจากการลงทะเบียน",
			CreatedAt:       nowBkk,
			UpdatedAt:       nowBkk,
		}
		config.DB.Create(&newQueue)

		// ส่ง WebSocket Broadcast แจ้งเตือนทุกเครื่องว่ามีผู้ป่วยใหม่และมีการสร้างคิว
		ws.BroadcastEvent("PATIENT_REGISTERED", newPatient)
		ws.BroadcastEvent("QUEUE_CREATED", newQueue)

		// คืน Response พร้อมข้อมูลคิวและ flag queue_issued: true
		c.JSON(http.StatusCreated, gin.H{
			"message":      "ลงทะเบียนคนไข้ใหม่และส่งเข้าคิวคัดกรองสำเร็จ",
			"patient":      newPatient,
			"hn":           newPatient.HN,
			"patient_id":   newPatient.ID,
			"queue_number": newQueue.QueueNumber,
			"queue_id":     newQueue.ID,
			"queue_issued": true,
			"queue":        newQueue,
		})
		return
	}

	// กรณี issue_queue == false (หรือไม่ได้ส่งมา): ออกแค่ HN และไม่ออกคิว
	ws.BroadcastEvent("PATIENT_REGISTERED", newPatient)

	c.JSON(http.StatusCreated, gin.H{
		"message":      "ลงทะเบียนคนไข้ใหม่สำเร็จ (ยังไม่ออกบัตรคิว)",
		"patient":      newPatient,
		"hn":           newPatient.HN,
		"patient_id":   newPatient.ID,
		"queue_issued": false,
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

// UpdatePatientReq struct
type UpdatePatientReq struct {
	FullName         string `json:"fullname"`
	Gender           string `json:"gender"`
	BirthDate        string `json:"birthdate"`
	PhoneNumber      string `json:"phone_number"`
	EmergencyContact string `json:"emergency_contact"`
	SchemeType       string `json:"scheme_type"`
	Allergies        string `json:"allergies"`
	ChronicDiseases  string `json:"chronic_diseases"`

	// Structured Address Fields (Sprint 3)
	HouseNo     string `json:"house_no"`
	VillageNo   string `json:"village_no"`
	VillageName string `json:"village_name"`
	Alley       string `json:"alley"`
	Road        string `json:"road"`
	SubDistrict string `json:"sub_district"`
	District    string `json:"district"`
	Province    string `json:"province"`
	PostalCode  string `json:"postal_code"`

	// Legacy Address fallback
	Address string `json:"address"`
}

// UpdatePatient - แก้ไขข้อมูลคนไข้ พร้อม Re-compose Address ใหม่ทุกครั้ง
func UpdatePatient(c *gin.Context) {
	id := c.Param("id")
	var patient models.Patient
	if err := config.DB.Where("id = ? OR hn = ?", id, id).First(&patient).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบข้อมูลผู้ป่วย"})
		return
	}

	var req UpdatePatientReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ข้อมูลที่ส่งมาไม่ถูกต้อง"})
		return
	}

	if req.FullName != "" {
		patient.FullName = req.FullName
	}
	if req.Gender != "" {
		patient.Gender = req.Gender
	}
	if strings.TrimSpace(req.BirthDate) != "" {
		parsedBirthDate, err := services.ParseFlexibleDate(req.BirthDate)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "รูปแบบวันเกิดไม่ถูกต้อง กรุณาใช้ DD/MM/YYYY หรือ YYYY-MM-DD"})
			return
		}
		patient.BirthDate = parsedBirthDate
	}
	if req.PhoneNumber != "" {
		patient.PhoneNumber = req.PhoneNumber
	}
	if req.EmergencyContact != "" {
		patient.EmergencyContact = req.EmergencyContact
	}
	if req.SchemeType != "" {
		patient.SchemeType = req.SchemeType
	}
	if req.Allergies != "" {
		patient.Allergies = req.Allergies
	}
	if req.ChronicDiseases != "" {
		patient.ChronicDiseases = req.ChronicDiseases
	}

	// Update structured address fields
	if req.HouseNo != "" {
		patient.HouseNo = strings.TrimSpace(req.HouseNo)
	}
	if req.VillageNo != "" {
		patient.VillageNo = strings.TrimSpace(req.VillageNo)
	}
	if req.VillageName != "" {
		patient.VillageName = strings.TrimSpace(req.VillageName)
	}
	if req.Alley != "" {
		patient.Alley = strings.TrimSpace(req.Alley)
	}
	if req.Road != "" {
		patient.Road = strings.TrimSpace(req.Road)
	}
	if req.SubDistrict != "" {
		patient.SubDistrict = strings.TrimSpace(req.SubDistrict)
	}
	if req.District != "" {
		patient.District = strings.TrimSpace(req.District)
	}
	if req.Province != "" {
		patient.Province = strings.TrimSpace(req.Province)
	}
	if req.PostalCode != "" {
		patient.PostalCode = strings.TrimSpace(req.PostalCode)
	}

	// Re-compose Address every time patient is updated
	composedAddr := composeAddress(
		patient.HouseNo,
		patient.VillageNo,
		patient.VillageName,
		patient.Alley,
		patient.Road,
		patient.SubDistrict,
		patient.District,
		patient.Province,
		patient.PostalCode,
		req.Address,
	)
	patient.Address = composedAddr

	if err := config.DB.Save(&patient).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถบันทึกการแก้ไขข้อมูลผู้ป่วยได้"})
		return
	}

	ws.BroadcastEvent("PATIENT_UPDATED", patient)

	c.JSON(http.StatusOK, gin.H{
		"message": "แก้ไขข้อมูลผู้ป่วยสำเร็จ",
		"patient": patient,
	})
}