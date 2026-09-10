package controllers

import (
	"fmt"
	"log"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"clinic-backend/internal/config"
	"clinic-backend/internal/models"
	"clinic-backend/internal/services"
	"clinic-backend/internal/ws"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm/clause"
)

type RecordVitalsReq struct {
	QueueID             uint    `json:"queue_id"`
	PatientID           uint    `json:"patient_id"`
	QueueNumber         string  `json:"queue_number"`
	ChiefComplaint      string  `json:"chief_complaint"`
	Weight              float64 `json:"weight"`
	Height              float64 `json:"height"`
	Temperature         float64 `json:"temperature"`
	SystolicBP          int     `json:"systolic_bp"`
	DiastolicBP         int     `json:"diastolic_bp"`
	HeartRate           int     `json:"heart_rate"`
	RespiratoryRate     int     `json:"respiratory_rate"`
	SpO2                int     `json:"spo2"`
	PainScore           int     `json:"pain_score"`
	BloodSugar          int     `json:"blood_sugar"`
	FoodAllergies       string  `json:"food_allergies"`
	CurrentMedications  string  `json:"current_medications"`
	SmokingHistory      string  `json:"smoking_history"`
	AlcoholHistory      string  `json:"alcohol_history"`
	Allergies           string  `json:"allergies"`
	MedicalHistory      string  `json:"medical_history"`
	NurseNotes          string  `json:"nurse_notes"`
	HerbalMedicines     string  `json:"herbal_medicines"`
	DietarySupplements  string  `json:"dietary_supplements"`
	HasURI              *bool   `json:"has_uri"`
	HasTB               *bool   `json:"has_tb"`
	OnAnticoagulant     *bool   `json:"on_anticoagulant"`
	PrecautionType      string  `json:"precaution_type"`
	IsPregnant          *bool   `json:"is_pregnant"`
	IsBreastfeeding     *bool   `json:"is_breastfeeding"`
	LastMenstrualPeriod string  `json:"last_menstrual_period"`
	Q2Depressed         *bool   `json:"q2_depressed"`
	Q2Anhedonia         *bool   `json:"q2_anhedonia"`
	AssignedDoctorID    uint    `json:"assigned_doctor_id"`
	TriageLevel         any     `json:"triage_level"` // Supports int 1-4 or legacy string with deprecation warning
}

// triageLabelFromInt returns the human-readable Thai label for triage level 1-4
func triageLabelFromInt(level int) string {
	return models.TriageLabelTH(level)
}

// parseTriageLevel converts numeric or textual triage level into canonical integer 1..4
func parseTriageLevel(raw any, sysBP, diaBP, hr, spo2 int, temp float64) (int, error) {
	if raw == nil {
		return autoClassifyTriage(sysBP, diaBP, hr, spo2, temp), nil
	}

	switch v := raw.(type) {
	case float64:
		intVal := int(v)
		if intVal >= 1 && intVal <= 4 {
			return intVal, nil
		}
		return 0, fmt.Errorf("ระดับ Triage ต้องเป็นตัวเลขระหว่าง 1 ถึง 4 (ได้รับ: %d)", intVal)
	case int:
		if v >= 1 && v <= 4 {
			return v, nil
		}
		return 0, fmt.Errorf("ระดับ Triage ต้องเป็นตัวเลขระหว่าง 1 ถึง 4 (ได้รับ: %d)", v)
	case string:
		str := strings.TrimSpace(v)
		if str == "" {
			return autoClassifyTriage(sysBP, diaBP, hr, spo2, temp), nil
		}
		if num, err := strconv.Atoi(str); err == nil {
			if num >= 1 && num <= 4 {
				return num, nil
			}
			return 0, fmt.Errorf("ระดับ Triage ต้องเป็นตัวเลขระหว่าง 1 ถึง 4 (ได้รับ: %d)", num)
		}

		// Backward-compatible mapping for legacy Thai/English strings
		var mapped int
		if strings.Contains(str, "วิกฤต") || strings.Contains(str, "Resuscitation") {
			mapped = 1
		} else if strings.Contains(str, "กึ่ง") || strings.Contains(str, "Semi-Urgent") {
			mapped = 3
		} else if strings.Contains(str, "ฉุกเฉิน") || strings.Contains(str, "เร่งด่วน") || strings.Contains(str, "Urgent") || strings.Contains(str, "Emergency") {
			mapped = 2
		} else if strings.Contains(str, "ปกติ") || strings.Contains(str, "Normal") {
			mapped = 4
		} else {
			mapped = autoClassifyTriage(sysBP, diaBP, hr, spo2, temp)
		}
		log.Printf("[WARN] DEPRECATED: string triage_level received '%s', mapped to canonical integer %d", str, mapped)
		return mapped, nil
	default:
		return autoClassifyTriage(sysBP, diaBP, hr, spo2, temp), nil
	}
}

// autoClassifyTriage determines triage acuity (1-4) based on vital signs
func autoClassifyTriage(sysBP, diaBP, hr, spo2 int, temp float64) int {
	if sysBP >= 180 || diaBP >= 110 || hr >= 130 || temp >= 39.5 || (spo2 > 0 && spo2 < 90) {
		return 1 // วิกฤต (Resuscitation)
	}
	if sysBP >= 160 || diaBP >= 100 || hr >= 110 || temp >= 38.5 || (spo2 > 0 && spo2 < 95) {
		return 2 // ฉุกเฉินเร่งด่วน (Urgent)
	}
	if sysBP >= 140 || diaBP >= 90 || hr >= 100 || temp >= 37.5 {
		return 3 // กึ่งฉุกเฉิน (Semi-Urgent)
	}
	return 4 // ปกติ (Normal)
}

func RecordVitalsAndTriage(c *gin.Context) {
	var req RecordVitalsReq

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("ข้อมูลสัญญาณชีพไม่ถูกต้อง: %v", err)})
		return
	}

	// 1. ตรวจสอบความถูกต้องของสัญญาณชีพทางการแพทย์ (Clinical Bounds Validation)
	if err := services.ValidateClinicalVitals(
		req.Weight,
		req.Height,
		req.Temperature,
		req.SystolicBP,
		req.DiastolicBP,
		req.HeartRate,
		req.SpO2,
		req.RespiratoryRate,
		req.PainScore,
		req.BloodSugar,
	); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 2. ตรวจสอบและแปลงระดับ Triage เป็น Canonical Integer (1..4)
	triageInt, err := parseTriageLevel(req.TriageLevel, req.SystolicBP, req.DiastolicBP, req.HeartRate, req.SpO2, req.Temperature)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 2.1 ตรวจสอบ PrecautionType
	cleanPrecaution := strings.TrimSpace(req.PrecautionType)
	if cleanPrecaution != "" {
		switch strings.ToLower(cleanPrecaution) {
		case "standard":
			cleanPrecaution = "Standard"
		case "contact":
			cleanPrecaution = "Contact"
		case "droplet":
			cleanPrecaution = "Droplet"
		case "airborne":
			cleanPrecaution = "Airborne"
		case "none", "ยังไม่ระบุ":
			cleanPrecaution = ""
		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": "ประเภทข้อควรระวัง (Precaution Type) ไม่ถูกต้อง"})
			return
		}
	}

	// ตรวจสอบพยาบาลผู้คัดกรอง
	var nurseID uint
	if val, exists := c.Get("userID"); exists {
		if idFloat, ok := val.(float64); ok {
			nurseID = uint(idFloat)
		} else if idUint, ok := val.(uint); ok {
			nurseID = idUint
		}
	}

	// 3. เริ่ม Transaction พร้อม Row-Locking เพื่อป้องกัน Race Condition & Duplicate Visit
	tx := config.DB.Begin()
	if tx.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถเริ่ม Transaction ได้"})
		return
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	var targetQueue models.Queue
	var patient models.Patient

	// ค้นหาคิวและ Lock แถว (SELECT ... FOR UPDATE)
	if req.QueueID > 0 {
		tx.Clauses(clause.Locking{Strength: "UPDATE"}).Preload("Patient").First(&targetQueue, req.QueueID)
	}

	if targetQueue.ID == 0 && req.QueueNumber != "" {
		cleanQ := strings.TrimSpace(req.QueueNumber)
		cleanQTrimmed := strings.TrimLeft(strings.TrimPrefix(strings.ToUpper(cleanQ), "Q"), "0")
		var candidateQueueNumbers []string
		candidateQueueNumbers = append(candidateQueueNumbers, cleanQ)
		if cleanQTrimmed != "" {
			candidateQueueNumbers = append(candidateQueueNumbers,
				"Q"+cleanQTrimmed,
				fmt.Sprintf("Q%03s", cleanQTrimmed),
				fmt.Sprintf("Q%04s", cleanQTrimmed),
				cleanQTrimmed,
			)
		}
		tx.Clauses(clause.Locking{Strength: "UPDATE"}).Preload("Patient").Where("queue_number IN ?", candidateQueueNumbers).Order("id asc").First(&targetQueue)
	}

	// ตรวจสอบสถานะคิว (BUG-C1-01 / งาน F)
	if targetQueue.ID > 0 {
		if targetQueue.Status == "ยกเลิก" || targetQueue.Status == "ยกเลิกคิว" || strings.EqualFold(targetQueue.Status, "cancelled") {
			tx.Rollback()
			c.JSON(http.StatusConflict, gin.H{
				"error":        "คิวนี้ถูกยกเลิกแล้ว ไม่สามารถบันทึกสัญญาณชีพได้",
				"code":         "QUEUE_CANCELLED",
				"queue_number": targetQueue.QueueNumber,
			})
			return
		}

		var existingVisit models.VisitRecord
		hasExistingVisit := false
		if targetQueue.VisitID != nil && *targetQueue.VisitID > 0 {
			if err := tx.First(&existingVisit, *targetQueue.VisitID).Error; err == nil {
				hasExistingVisit = true
			}
		}
		if !hasExistingVisit {
			if err := tx.Where("queue_id = ?", targetQueue.ID).First(&existingVisit).Error; err == nil {
				hasExistingVisit = true
			}
		}

		isPreScreeningStatus := targetQueue.Status == "" || targetQueue.Status == "รอคัดกรอง" || targetQueue.Status == "รอซักประวัติ" || targetQueue.Status == "รอเรียก" || strings.EqualFold(targetQueue.Status, "waiting")
		if hasExistingVisit || !isPreScreeningStatus {
			var existingScreening models.Screening
			if existingVisit.ID > 0 {
				_ = tx.Where("visit_id = ?", existingVisit.ID).First(&existingScreening)
			}

			// ตรวจสอบความเหมือนของ payload ทุก field (tolerance 0.01 สำหรับ float)
			isExactMatch := false
			if existingScreening.ID > 0 {
				diffWeight := math.Abs(existingScreening.Weight - req.Weight)
				diffHeight := math.Abs(existingScreening.Height - req.Height)
				isNurseMatch := (nurseID == 0 || existingScreening.ScreenedByUserID == nurseID)
				isBPMatch := existingScreening.SystolicBP == req.SystolicBP && existingScreening.DiastolicBP == req.DiastolicBP
				isVitalsMatch := existingScreening.HeartRate == req.HeartRate &&
					existingScreening.RespiratoryRate == req.RespiratoryRate &&
					existingScreening.SpO2 == req.SpO2 &&
					existingScreening.TriageLevel == triageInt

				if diffWeight <= 0.01 && diffHeight <= 0.01 && isNurseMatch && isBPMatch && isVitalsMatch {
					isExactMatch = true
				}
			}

			tx.Rollback()

			if isExactMatch {
				// Idempotent replay: คืน HTTP 200 OK โดยไม่สร้าง record ใหม่และไม่ยิง WebSocket
				c.JSON(http.StatusOK, gin.H{
					"message":           "บันทึกข้อมูลการคัดกรองเรียบร้อยแล้ว",
					"screening_id":      existingScreening.ID,
					"visit_id":          existingVisit.ID,
					"queue_number":      targetQueue.QueueNumber,
					"bmi":               existingScreening.BMI,
					"triage_level":      existingScreening.TriageLevel,
					"idempotent_replay": true,
					"screening":         existingScreening,
					"visit":             existingVisit,
				})
				return
			}

			// Payload แตกต่าง: คืน HTTP 409 Conflict
			c.JSON(http.StatusConflict, gin.H{
				"error":        "คิวนี้ได้รับการคัดกรองและส่งต่อห้องตรวจแล้ว",
				"code":         "QUEUE_ALREADY_SCREENED",
				"screening_id": existingScreening.ID,
				"visit_id":     existingVisit.ID,
				"triage_level": existingScreening.TriageLevel,
				"queue_number": targetQueue.QueueNumber,
			})
			return
		}
	}

	// ดึง Patient จากคิว หรือจาก PatientID
	if targetQueue.ID > 0 {
		if targetQueue.Patient.ID > 0 {
			patient = targetQueue.Patient
		} else if targetQueue.PatientID > 0 {
			tx.First(&patient, targetQueue.PatientID)
		}
	}

	if patient.ID == 0 && req.PatientID > 0 {
		tx.First(&patient, req.PatientID)
	}

	if patient.ID == 0 {
		tx.Rollback()
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบข้อมูลผู้ป่วยหรือคิวในระบบ กรุณาเลือกคิวที่ถูกต้อง"})
		return
	}

	// 2.2 ตรวจสอบข้อมูลคัดกรองเพศหญิงกับเพศของผู้ป่วย
	isMale := strings.Contains(patient.Gender, "ชาย") || strings.EqualFold(patient.Gender, "male") || strings.EqualFold(patient.Gender, "m")
	if isMale {
		if req.IsPregnant != nil || req.IsBreastfeeding != nil || strings.TrimSpace(req.LastMenstrualPeriod) != "" {
			tx.Rollback()
			c.JSON(http.StatusBadRequest, gin.H{"error": "ไม่สามารถระบุข้อมูลนี้สำหรับผู้ป่วยชาย"})
			return
		}
	}

	// 2.3 ตรวจสอบวันที่มีประจำเดือนครั้งสุดท้าย (LMP)
	var lmpText string
	if strings.TrimSpace(req.LastMenstrualPeriod) != "" {
		lmpDate, err := services.ParseFlexibleDate(req.LastMenstrualPeriod)
		if err != nil {
			tx.Rollback()
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("วันที่มีประจำเดือนครั้งสุดท้ายไม่ถูกต้อง: %v", err)})
			return
		}
		nowBkk := time.Now().In(services.BangkokLocation())
		today := time.Date(nowBkk.Year(), nowBkk.Month(), nowBkk.Day(), 23, 59, 59, 0, nowBkk.Location())
		if lmpDate.After(today) {
			tx.Rollback()
			c.JSON(http.StatusBadRequest, gin.H{"error": "วันที่มีประจำเดือนครั้งสุดท้ายต้องไม่อยู่ในอนาคต"})
			return
		}
		lmpText = lmpDate.Format("2006-01-02")
	}

	// 2.4 คำนวณผลประเมิน 2Q (screening_positive)
	var screeningPositive *bool
	if (req.Q2Depressed != nil && *req.Q2Depressed) || (req.Q2Anhedonia != nil && *req.Q2Anhedonia) {
		pos := true
		screeningPositive = &pos
	} else if (req.Q2Depressed != nil && !*req.Q2Depressed) && (req.Q2Anhedonia != nil && !*req.Q2Anhedonia) {
		pos := false
		screeningPositive = &pos
	}

	// 3. คำนวณ BMI (Asian WHO standard)
	HeightMeter := req.Height / 100
	BMI := 0.0
	if HeightMeter > 0 && req.Weight > 0 {
		BMI = math.Round((req.Weight/(HeightMeter*HeightMeter))*100) / 100.0
	}

	// 4. ตรวจสอบแพทย์ประจำห้องตรวจ (User ID ที่มี role doctor)
	assignedDoctorID := req.AssignedDoctorID
	var doctor models.User
	if assignedDoctorID > 0 {
		if err := tx.Where("id = ? AND role = ?", assignedDoctorID, "doctor").First(&doctor).Error; err != nil {
			assignedDoctorID = 0
		}
	}
	if assignedDoctorID == 0 {
		if errDoc := tx.Where("role = ?", "doctor").First(&doctor).Error; errDoc == nil {
			assignedDoctorID = doctor.ID
		}
	}
	if assignedDoctorID == 0 {
		assignedDoctorID = 4 // Fallback doctor1 ID
	}

	// 5. ตรวจสอบพยาบาลผู้คัดกรอง (หากยังไม่มี ให้ fallback)
	if nurseID == 0 {
		var defaultNurse models.User
		if err := tx.Where("role IN ?", []string{"nurse", "nurse_assistant"}).First(&defaultNurse).Error; err == nil {
			nurseID = defaultNurse.ID
		} else {
			nurseID = 2 // Fallback nurse1 ID
		}
	}

	// 6. กำหนดชื่อแผนก/ห้องตรวจ
	roomNumber := 1
	shortDocName := ""
	docID := assignedDoctorID
	if doctor.ID > 0 {
		docID = doctor.ID
	}
	if docID == 4 || docID == 1 || strings.Contains(doctor.FullName, "สุดา") {
		roomNumber = 1
		shortDocName = "พญ.สุดา"
	} else if docID == 5 || docID == 2 || strings.Contains(doctor.FullName, "วิชัย") {
		roomNumber = 2
		shortDocName = "นพ.วิชัย"
	} else if docID == 6 || docID == 3 || strings.Contains(doctor.FullName, "เกศรา") {
		roomNumber = 3
		shortDocName = "พญ.เกศรา"
	} else if docID > 0 {
		roomNumber = int((docID-1)%3) + 1
		parts := strings.Split(doctor.FullName, " ")
		if len(parts) > 0 {
			shortDocName = parts[0]
		}
	}

	deptName := fmt.Sprintf("ห้องตรวจ %d", roomNumber)
	if shortDocName != "" {
		deptName = fmt.Sprintf("ห้องตรวจ %d (%s)", roomNumber, shortDocName)
	} else if doctor.FullName != "" {
		deptName = fmt.Sprintf("ห้องตรวจ %d (%s)", roomNumber, doctor.FullName)
	}

	// 7. สร้าง VisitRecord พร้อมบันทึก QueueID และ QueueNumber (Traceability & Idempotency)
	var qID *uint
	qNo := ""
	if targetQueue.ID > 0 {
		qID = &targetQueue.ID
		qNo = targetQueue.QueueNumber
	} else if req.QueueNumber != "" {
		qNo = req.QueueNumber
	}

	newVisitRecord := models.VisitRecord{
		PatientID:   patient.ID,
		DoctorID:    assignedDoctorID,
		QueueID:     qID,
		QueueNumber: qNo,
		VisitDate:   time.Now(),
		Status:      models.VisitStatusWaiting,
		Department:  deptName,
		VisitType:   "walk-in",
	}

	if err := tx.Create(&newVisitRecord).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("ไม่สามารถบันทึกการเข้าตรวจได้: %v", err)})
		return
	}

	// ออกเลข VN ทันที
	if newVisitRecord.VN == "" {
		vn := fmt.Sprintf("69%02d%04d", time.Now().Year()%100, (newVisitRecord.ID*7)%9000+1000)
		tx.Model(&models.VisitRecord{}).Where("id = ?", newVisitRecord.ID).Update("vn", vn)
		newVisitRecord.VN = vn
	}

	// 8. สร้าง Screening Record (Canonical TriageLevel: int 1..4)
	cc := strings.TrimSpace(req.ChiefComplaint)
	if cc == "" {
		cc = "ตรวจสุขภาพและคัดกรองทั่วไป"
	}
	temp := req.Temperature
	if temp <= 0 {
		temp = 36.5
	}

	newScreening := models.Screening{
		VisitID:             newVisitRecord.ID,
		ScreenedByUserID:    nurseID,
		AssignedDoctorID:    assignedDoctorID,
		TriageLevel:         triageInt,
		ChiefComplaint:      cc,
		Allergies:           req.Allergies,
		MedicalHistory:      req.MedicalHistory,
		NurseNotes:          strings.TrimSpace(req.NurseNotes),
		Weight:              req.Weight,
		Height:              req.Height,
		BMI:                 BMI,
		Temperature:         temp,
		SystolicBP:          req.SystolicBP,
		DiastolicBP:         req.DiastolicBP,
		HeartRate:           req.HeartRate,
		RespiratoryRate:     req.RespiratoryRate,
		SpO2:                req.SpO2,
		PainScore:           req.PainScore,
		BloodSugar:          req.BloodSugar,
		FoodAllergies:       req.FoodAllergies,
		CurrentMedications:  req.CurrentMedications,
		SmokingHistory:      req.SmokingHistory,
		AlcoholHistory:      req.AlcoholHistory,
		HerbalMedicines:     strings.TrimSpace(req.HerbalMedicines),
		DietarySupplements:  strings.TrimSpace(req.DietarySupplements),
		HasURI:              req.HasURI,
		HasTB:               req.HasTB,
		OnAnticoagulant:     req.OnAnticoagulant,
		PrecautionType:      cleanPrecaution,
		IsPregnant:          req.IsPregnant,
		IsBreastfeeding:     req.IsBreastfeeding,
		LastMenstrualPeriod: lmpText,
		Q2Depressed:         req.Q2Depressed,
		Q2Anhedonia:         req.Q2Anhedonia,
		ScreeningPositive:   screeningPositive,
	}

	if err := tx.Create(&newScreening).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("ไม่สามารถบันทึกข้อมูลการคัดกรองได้: %v", err)})
		return
	}

	// 9. อัปเดตสถานะคิวคนไข้เป็น "รอพบแพทย์"
	triageLabel := triageLabelFromInt(triageInt)
	noteText := fmt.Sprintf("คัดกรองแล้ว: %s (BP: %d/%d, T: %.1f°C, HR: %d)", triageLabel, req.SystolicBP, req.DiastolicBP, temp, req.HeartRate)
	vID := newVisitRecord.ID

	if targetQueue.ID > 0 {
		targetQueue.VisitID = &vID
		targetQueue.AssignedDoctorID = &assignedDoctorID
		targetQueue.Status = "รอพบแพทย์"
		targetQueue.Department = deptName
		targetQueue.Note = noteText
		if err := tx.Save(&targetQueue).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถอัปเดตสถานะคิวได้"})
			return
		}
	}

	// 10. อัปเดตประวัติแพ้ยาและโรคประจำตัวใน Patient
	if req.Allergies != "" {
		patient.Allergies = req.Allergies
	}
	if req.MedicalHistory != "" {
		patient.ChronicDiseases = req.MedicalHistory
	}
	tx.Save(&patient)

	// Commit Transaction
	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถบันทึกข้อมูล (Commit Failed)"})
		return
	}

	// 11. ส่ง WebSocket Broadcast แจ้งเตือนทุกเครื่องหลังจาก Commit สำเร็จเท่านั้น (Strict Post-Commit Emission)
	if targetQueue.ID > 0 {
		ws.BroadcastEvent("QUEUE_UPDATED", targetQueue)
	}
	ws.BroadcastEvent("VITALS_RECORDED", newScreening)

	c.JSON(http.StatusCreated, gin.H{
		"message":            "บันทึกข้อมูลการคัดกรองและส่งต่อคิวเรียบร้อยแล้ว",
		"screening_id":       newScreening.ID,
		"visit_id":           newVisitRecord.ID,
		"queue_number":       qNo,
		"bmi":                BMI,
		"triage_level":       triageInt,
		"screening_positive": screeningPositive,
		"screening":          newScreening,
	})
}

// GetDoctors - ดึงรายชื่อแพทย์ทั้งหมดที่พร้อมให้บริการ
func GetDoctors(c *gin.Context) {
	var doctors []models.User
	config.DB.Where("role = ?", "doctor").Order("id asc").Find(&doctors)

	if len(doctors) == 0 {
		defaultDoctors := []models.User{
			{Username: "doctor1", Password: "$2a$10$7sWf7aR9b3yK4q7E2fG5/.3h1mP6W8f2T8V0X4mJ8q8u0W8b2T8V.", Role: "doctor", FullName: "พญ.สุดา สุขสมบูรณ์", Phone: "081-222-0001"},
			{Username: "doctor2", Password: "$2a$10$7sWf7aR9b3yK4q7E2fG5/.3h1mP6W8f2T8V0X4mJ8q8u0W8b2T8V.", Role: "doctor", FullName: "นพ.วิชัย ชาญการแพทย์", Phone: "081-222-0002"},
			{Username: "doctor3", Password: "$2a$10$7sWf7aR9b3yK4q7E2fG5/.3h1mP6W8f2T8V0X4mJ8q8u0W8b2T8V.", Role: "doctor", FullName: "พญ.เกศรา รักษาดี", Phone: "081-222-0003"},
		}
		for i := range defaultDoctors {
			var existing models.User
			if err := config.DB.Where("username = ?", defaultDoctors[i].Username).First(&existing).Error; err != nil {
				config.DB.Create(&defaultDoctors[i])
				doctors = append(doctors, defaultDoctors[i])
			} else {
				doctors = append(doctors, existing)
			}
		}
	}

	c.JSON(http.StatusOK, doctors)
}

// GetAllScreeningHistory - ดึงประวัติการคัดกรองทั้งหมดสำหรับ Dashboard (Server-Side Pagination & Filtered COUNT)
func GetAllScreeningHistory(c *gin.Context) {
	pageStr := c.Query("page")
	limitStr := c.Query("limit")
	search := strings.TrimSpace(c.Query("search"))
	triage := strings.TrimSpace(c.Query("triage"))
	datePreset := strings.TrimSpace(c.Query("date_preset"))

	baseQuery := config.DB.Model(&models.Screening{}).
		Joins("LEFT JOIN visit_records ON visit_records.id = screenings.visit_id").
		Joins("LEFT JOIN patients ON patients.id = visit_records.patient_id")

	// 1. Search Filter (Patient Name, National ID, Phone, HN)
	if search != "" {
		searchTerm := "%" + search + "%"
		cleanSearch := strings.ReplaceAll(strings.ReplaceAll(search, "-", ""), " ", "")
		baseQuery = baseQuery.Where(
			"patients.full_name ILIKE ? OR REPLACE(REPLACE(patients.national_id, '-', ''), ' ', '') ILIKE ? OR patients.phone_number ILIKE ? OR patients.hn ILIKE ?",
			searchTerm, "%"+cleanSearch+"%", searchTerm, searchTerm,
		)
	}

	// 2. Triage Level Filter
	if triage != "" && triage != "all" {
		triageNum := 0
		switch {
		case triage == "1" || strings.Contains(triage, "วิกฤต"):
			triageNum = 1
		case triage == "2" || strings.Contains(triage, "เร่งด่วน"):
			triageNum = 2
		case triage == "3" || strings.Contains(triage, "กึ่ง"):
			triageNum = 3
		case triage == "4" || strings.Contains(triage, "ปกติ"):
			triageNum = 4
		default:
			triageNum, _ = strconv.Atoi(triage)
		}
		if triageNum > 0 {
			baseQuery = baseQuery.Where("screenings.triage_level = ?", triageNum)
		}
	}

	// 3. Date Preset Filter
	nowBkk := time.Now().In(services.BangkokLocation())
	if datePreset == "today" {
		startOfDay := time.Date(nowBkk.Year(), nowBkk.Month(), nowBkk.Day(), 0, 0, 0, 0, nowBkk.Location())
		baseQuery = baseQuery.Where("screenings.created_at >= ?", startOfDay)
	} else if datePreset == "this-month" {
		startOfMonth := time.Date(nowBkk.Year(), nowBkk.Month(), 1, 0, 0, 0, 0, nowBkk.Location())
		baseQuery = baseQuery.Where("screenings.created_at >= ?", startOfMonth)
	}

	// Backward Compatibility: If no page or limit, return unpaginated slice
	if pageStr == "" && limitStr == "" {
		var screenings []models.Screening
		if err := baseQuery.Preload("VisitRecord.Patient").
			Preload("ScreenedBy").
			Preload("AssignedDoctor").
			Order("screenings.created_at DESC, screenings.id DESC").
			Find(&screenings).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถดึงประวัติการคัดกรองได้"})
			return
		}
		if screenings == nil {
			screenings = []models.Screening{}
		}
		c.JSON(http.StatusOK, screenings)
		return
	}

	// Server-side pagination
	page, _ := strconv.Atoi(pageStr)
	if page < 1 {
		page = 1
	}

	rawLimit, _ := strconv.Atoi(limitStr)
	var limit int
	if rawLimit <= 10 {
		limit = 10
	} else if rawLimit <= 25 {
		limit = 25
	} else {
		limit = 50
	}

	var total int64
	if err := baseQuery.Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถนับจำนวนประวัติการคัดกรองได้"})
		return
	}

	totalPages := int(math.Ceil(float64(total) / float64(limit)))
	if totalPages == 0 {
		totalPages = 1
	}

	offset := (page - 1) * limit
	var screenings []models.Screening
	if err := baseQuery.Preload("VisitRecord.Patient").
		Preload("ScreenedBy").
		Preload("AssignedDoctor").
		Order("screenings.created_at DESC, screenings.id DESC").
		Limit(limit).Offset(offset).
		Find(&screenings).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถดึงประวัติการคัดกรองได้"})
		return
	}

	if screenings == nil {
		screenings = []models.Screening{}
	}

	c.JSON(http.StatusOK, gin.H{
		"data":        screenings,
		"total":       total,
		"page":        page,
		"limit":       limit,
		"total_pages": totalPages,
	})
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
