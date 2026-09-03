package controllers

import (
	"fmt"
	"math"
	"net/http"
	"strings"
	"time"

	"clinic-backend/internal/config"
	"clinic-backend/internal/models"
	"clinic-backend/internal/ws"

	"github.com/gin-gonic/gin"
)

type RecordVitalsReq struct {
	QueueID          uint    `json:"queue_id"`
	PatientID        uint    `json:"patient_id"`
	QueueNumber      string  `json:"queue_number"`
	ChiefComplaint   string  `json:"chief_complaint"`
	Weight           float64 `json:"weight"`
	Height           float64 `json:"height"`
	Temperature      float64 `json:"temperature"`
	SystolicBP       int     `json:"systolic_bp"`
	DiastolicBP      int     `json:"diastolic_bp"`
	HeartRate        int     `json:"heart_rate"`
	RespiratoryRate  int     `json:"respiratory_rate"`
	SpO2             int     `json:"spo2"`
	PainScore        int     `json:"pain_score"`
	BloodSugar       int     `json:"blood_sugar"`
	FoodAllergies    string  `json:"food_allergies"`
	CurrentMedications string `json:"current_medications"`
	SmokingHistory   string  `json:"smoking_history"`
	AlcoholHistory   string  `json:"alcohol_history"`
	Allergies        string  `json:"allergies"`
	MedicalHistory   string  `json:"medical_history"`
	NurseNotes       string  `json:"nurse_notes"`
	AssignedDoctorID uint    `json:"assigned_doctor_id"`
	TriageLevel      string  `json:"triage_level"`
}

func RecordVitalsAndTriage(c *gin.Context) {
	var req RecordVitalsReq

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("ข้อมูลสัญญาณชีพไม่ถูกต้อง: %v", err)})
		return
	}

	// 1. ค้นหาคิวที่เฉพาะเจาะจงเป็นหลัก (Queue-Centric Resolution)
	var targetQueue models.Queue
	var patient models.Patient

	// ค้นหาคิวตาม QueueID ก่อน
	if req.QueueID > 0 {
		config.DB.Preload("Patient").First(&targetQueue, req.QueueID)
	}

	// ถ้าไม่พบ ให้ค้นหาคิวตาม QueueNumber ที่ตรงกัน
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
		config.DB.Preload("Patient").Where("queue_number IN ?", candidateQueueNumbers).Order("id asc").First(&targetQueue)
	}

	// ดึง Patient จากคิวนั้น
	if targetQueue.ID > 0 {
		if targetQueue.Patient.ID > 0 {
			patient = targetQueue.Patient
		} else if targetQueue.PatientID > 0 {
			config.DB.First(&patient, targetQueue.PatientID)
		}
	}

	// ถ้ายังไม่พบจากคิว ให้ค้นหาจาก PatientID เป็น fallback
	if patient.ID == 0 && req.PatientID > 0 {
		config.DB.First(&patient, req.PatientID)
	}

	if patient.ID == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบข้อมูลผู้ป่วยหรือคิวในระบบ กรุณาเลือกคิวที่ถูกต้อง"})
		return
	}

	// 2. คำนวณ BMI (Asian WHO standard)
	HeightMeter := req.Height / 100
	BMI := 0.0
	if HeightMeter > 0 && req.Weight > 0 {
		BMI = math.Round((req.Weight/(HeightMeter*HeightMeter))*100) / 100.0
	}

	// 3. กำหนดระดับ Triage
	triageLevel := req.TriageLevel
	if strings.TrimSpace(triageLevel) == "" {
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

	// 4. ตรวจสอบแพทย์ประจำห้องตรวจ (ต้องเป็น User ID ที่มีอยู่ใน DB จริงเท่านั้น ป้องกัน FK Constraint)
	assignedDoctorID := req.AssignedDoctorID
	var doctor models.User
	if assignedDoctorID > 0 {
		if err := config.DB.Where("id = ? AND role = ?", assignedDoctorID, "doctor").First(&doctor).Error; err != nil {
			assignedDoctorID = 0
		}
	}
	if assignedDoctorID == 0 {
		if errDoc := config.DB.Where("role = ?", "doctor").First(&doctor).Error; errDoc == nil {
			assignedDoctorID = doctor.ID
		}
	}
	if assignedDoctorID == 0 {
		assignedDoctorID = 4 // Fallback user ID 4 (doctor1)
	}

	// 5. ตรวจสอบพยาบาลผู้คัดกรอง
	var nurseID uint
	if val, exists := c.Get("userID"); exists {
		if idFloat, ok := val.(float64); ok {
			nurseID = uint(idFloat)
		} else if idUint, ok := val.(uint); ok {
			nurseID = idUint
		}
	}
	if nurseID == 0 {
		var defaultNurse models.User
		if err := config.DB.Where("role IN ?", []string{"nurse", "nurse_assistant"}).First(&defaultNurse).Error; err == nil {
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

	// 7. สร้าง VisitRecord
	newVisitRecord := models.VisitRecord{
		PatientID:  patient.ID,
		DoctorID:   assignedDoctorID,
		VisitDate:  time.Now(),
		Status:     models.VisitStatusWaiting,
		Department: deptName,
		VisitType:  "walk-in",
	}

	if err := config.DB.Create(&newVisitRecord).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("ไม่สามารถบันทึกการเข้าตรวจได้: %v", err)})
		return
	}

	// ออกเลข VN ทันที
	if newVisitRecord.VN == "" {
		vn := fmt.Sprintf("69%02d%04d", time.Now().Year()%100, (newVisitRecord.ID*7)%9000+1000)
		config.DB.Model(&models.VisitRecord{}).Where("id = ?", newVisitRecord.ID).Update("vn", vn)
		newVisitRecord.VN = vn
	}

	// 8. สร้าง Screening Record
	cc := strings.TrimSpace(req.ChiefComplaint)
	if cc == "" {
		cc = "ตรวจสุขภาพและคัดกรองทั่วไป"
	}
	temp := req.Temperature
	if temp <= 0 {
		temp = 36.5
	}

	newScreening := models.Screening{
		VisitID:          newVisitRecord.ID,
		ScreenedByUserID: nurseID,
		AssignedDoctorID: assignedDoctorID,
		TriageLevel:      triageLevel,
		ChiefComplaint:   cc,
		Allergies:        req.Allergies,
		MedicalHistory:   req.MedicalHistory,
		NurseNotes:       req.NurseNotes,
		Weight:           req.Weight,
		Height:           req.Height,
		BMI:              BMI,
		Temperature:      temp,
		SystolicBP:       req.SystolicBP,
		DiastolicBP:      req.DiastolicBP,
		HeartRate:        req.HeartRate,
		RespiratoryRate:  req.RespiratoryRate,
		SpO2:             req.SpO2,
		PainScore:        req.PainScore,
		BloodSugar:       req.BloodSugar,
		FoodAllergies:    req.FoodAllergies,
		CurrentMedications: req.CurrentMedications,
		SmokingHistory:   req.SmokingHistory,
		AlcoholHistory:   req.AlcoholHistory,
	}

	if err := config.DB.Create(&newScreening).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("ไม่สามารถบันทึกข้อมูลการคัดกรองได้: %v", err)})
		return
	}

	// 9. อัปเดตสถานะคิวคนไข้เป็น "รอพบแพทย์"
	noteText := fmt.Sprintf("คัดกรองแล้ว: %s (BP: %d/%d, T: %.1f°C, HR: %d)", triageLevel, req.SystolicBP, req.DiastolicBP, temp, req.HeartRate)
	vID := newVisitRecord.ID

	if targetQueue.ID > 0 {
		targetQueue.VisitID = &vID
		targetQueue.AssignedDoctorID = &assignedDoctorID
		targetQueue.Status = "รอพบแพทย์"
		targetQueue.Department = deptName
		targetQueue.Note = noteText
		config.DB.Save(&targetQueue)
		ws.BroadcastEvent("QUEUE_UPDATED", targetQueue)
	} else {
		cleanQ := strings.TrimSpace(req.QueueNumber)
		if cleanQ == "" {
			cleanQ = fmt.Sprintf("Q%04X", patient.ID)
		}
		newQ := models.Queue{
			PatientID:        patient.ID,
			VisitID:          &vID,
			AssignedDoctorID: &assignedDoctorID,
			CreatedByUserID:  nurseID,
			QueueNumber:      cleanQ,
			Status:           "รอพบแพทย์",
			Department:       deptName,
			Note:             noteText,
		}
		config.DB.Create(&newQ)
		ws.BroadcastEvent("QUEUE_CREATED", newQ)
	}

	// 9. อัปเดตประวัติแพ้ยาและโรคประจำตัวใน Patient
	if req.Allergies != "" {
		patient.Allergies = req.Allergies
	}
	if req.MedicalHistory != "" {
		patient.ChronicDiseases = req.MedicalHistory
	}
	config.DB.Save(&patient)

	// 10. ส่ง WebSocket Broadcast แจ้งเตือนทุกเครื่อง
	ws.BroadcastEvent("VITALS_RECORDED", newScreening)

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
