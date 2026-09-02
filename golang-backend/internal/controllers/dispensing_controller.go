package controllers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"clinic-backend/internal/config"
	"clinic-backend/internal/models"
	"clinic-backend/internal/ws"

	"github.com/gin-gonic/gin"
)

type RecordDispenseRequest struct {
	VisitID      uint   `json:"visit_id" binding:"required"`
	MedicineID   uint   `json:"medicine_id" binding:"required"`
	DoctorID     uint   `json:"doctor_id" binding:"required"`
	Quantity     int    `json:"quantity" binding:"required,min=1"`
	Dosage       string `json:"dosage"`
	Instructions string `json:"instructions"`
}

// GET /api/pharmacy/dispensing/:visit_id - ดึงรายการจ่ายยาตาม Visit ID
func GetDispensingByVisit(c *gin.Context) {
	visitID := c.Param("visit_id")
	var items []models.Dispensing

	if err := config.DB.Preload("Medicine").Preload("Doctor").Where("visit_id = ?", visitID).Find(&items).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch dispensing records: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":     "success",
		"dispensing": items,
	})
}

// POST /api/pharmacy/dispensing - บันทึกคำสั่งจ่ายยาและหักสต็อก
func RecordDispense(c *gin.Context) {
	var req RecordDispenseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 1. ตรวจสอบว่ามียาในสต็อกพอหรือไม่
	var medicine models.Medicine
	if err := config.DB.First(&medicine, req.MedicineID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Medicine not found"})
		return
	}

	if medicine.StockQuantity < req.Quantity {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Insufficient stock in inventory"})
		return
	}

	// 2. สร้างรายการ Dispensing
	dispense := models.Dispensing{
		VisitID:      req.VisitID,
		MedicineID:   req.MedicineID,
		DoctorID:     req.DoctorID,
		Quantity:     req.Quantity,
		Dosage:       req.Dosage,
		Instructions: req.Instructions,
	}

	tx := config.DB.Begin()
	if err := tx.Create(&dispense).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to record dispensing: " + err.Error()})
		return
	}

	// 3. ตัดสต็อกยา
	medicine.StockQuantity -= req.Quantity
	if err := tx.Save(&medicine).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update stock: " + err.Error()})
		return
	}

	tx.Commit()

	c.JSON(http.StatusOK, gin.H{
		"status":     "success",
		"message":    "Medication dispensed and stock deducted successfully",
		"dispensing": dispense,
		"medicine":   medicine,
	})
}

// POST /api/pharmacy/dispense - ยืนยันการจ่ายยา ตัดสต็อก และสร้างบิลการเงิน พร้อมยิง WebSocket
func ConfirmDispenseAndBill(c *gin.Context) {
	var req struct {
		QueueID         interface{}              `json:"queue_id"`
		QueueNumber     string                   `json:"queue_number"`
		VisitID         uint                     `json:"visit_id"`
		HN              string                   `json:"hn"`
		PatientName     string                   `json:"patient_name"`
		NationalID      string                   `json:"national_id"`
		Gender          string                   `json:"gender"`
		Age             int                      `json:"age"`
		BloodType       string                   `json:"blood_type"`
		SchemeType      string                   `json:"scheme_type"`
		Allergies       string                   `json:"allergies"`
		ChronicDiseases string                   `json:"chronic_diseases"`
		PhoneNumber     string                   `json:"phone_number"`
		DoctorAdvice    string                   `json:"doctor_advice"`
		Medications     []map[string]interface{} `json:"medications"`
	}
	if err := c.ShouldBindJSON(&req); err != nil && req.VisitID == 0 && req.HN == "" && req.PatientName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var qID uint
	if req.QueueID != nil {
		switch v := req.QueueID.(type) {
		case float64:
			qID = uint(v)
		case string:
			clean := strings.TrimPrefix(v, "MQ-")
			if num, err := strconv.ParseUint(clean, 10, 64); err == nil {
				qID = uint(num)
			}
		}
	}

	// 1. ตรวจสอบ / ดึงข้อมูลคนไข้จริงจาก Database
	var patient models.Patient
	if req.VisitID > 0 {
		var visit models.VisitRecord
		if err := config.DB.Preload("Patient").First(&visit, req.VisitID).Error; err == nil {
			patient = visit.Patient
		}
	}
	if patient.ID == 0 && req.HN != "" {
		config.DB.Where("hn = ? OR hn = ?", req.HN, "HN-"+req.HN).First(&patient)
	}
	if patient.ID == 0 && req.PatientName != "" {
		config.DB.Where("fullname = ?", req.PatientName).First(&patient)
	}
	if patient.ID == 0 && req.PatientName != "" {
		newHN := req.HN
		if newHN == "" {
			newHN = fmt.Sprintf("HN%04d", time.Now().Unix()%10000)
		}
		patient = models.Patient{
			HN:              newHN,
			FullName:        req.PatientName,
			NationalID:      req.NationalID,
			Gender:          req.Gender,
			SchemeType:      req.SchemeType,
			Allergies:       req.Allergies,
			ChronicDiseases: req.ChronicDiseases,
			PhoneNumber:     req.PhoneNumber,
		}
		config.DB.Create(&patient)
	}

	// 2. ตรวจสอบ / สร้าง VisitRecord เพื่อป้องกัน Foreign Key Constraint Error
	var visit models.VisitRecord
	if req.VisitID > 0 {
		config.DB.First(&visit, req.VisitID)
	}
	if visit.ID == 0 && patient.ID > 0 {
		config.DB.Where("patient_id = ?", patient.ID).Order("id desc").First(&visit)
	}
	if visit.ID == 0 && patient.ID > 0 {
		visit = models.VisitRecord{
			PatientID: patient.ID,
			VisitDate: time.Now(),
			Status:    "completed",
			VN:        fmt.Sprintf("VN%d", time.Now().Unix()),
		}
		config.DB.Create(&visit)
	}
	if visit.ID > 0 {
		req.VisitID = visit.ID
	}

	var dispensings []models.Dispensing
	if req.VisitID > 0 {
		config.DB.Preload("Medicine").Where("visit_id = ?", req.VisitID).Find(&dispensings)
	}

	totalAmount := 0.0
	tx := config.DB.Begin()

	var medList []gin.H

	// วนลูปตัดสต็อกยาแต่ละตัวที่ถูกสั่งจ่าย และรวมราคาจริง
	for _, d := range dispensings {
		var med models.Medicine
		if err := tx.Where("id = ?", d.MedicineID).First(&med).Error; err == nil {
			if med.StockQuantity >= d.Quantity {
				med.StockQuantity -= d.Quantity
				tx.Save(&med)
			}
			price := med.UnitPrice
			totalAmount += float64(d.Quantity) * price

			medList = append(medList, gin.H{
				"medId":        med.MedicineCode,
				"name":         med.Name,
				"genericName":  med.GenericName,
				"category":     med.Category,
				"properties":   med.Properties,
				"dosage":       d.Dosage,
				"instructions": d.Instructions,
				"price":        price,
				"quantity":     d.Quantity,
				"stock":        med.StockQuantity,
				"stockStatus":  "พร้อมจ่าย",
			})
		}
	}

	// หากยังไม่มีในตาราง dispensings แต่มีรายการยาจาก frontend ให้บันทึกลง dispensings
	if len(dispensings) == 0 && len(req.Medications) > 0 {
		for _, mObj := range req.Medications {
			name, _ := mObj["name"].(string)
			dosage, _ := mObj["dosage"].(string)
			inst, _ := mObj["instructions"].(string)
			if inst == "" {
				inst = dosage
			}
			qty := 1
			if qVal, ok := mObj["quantity"]; ok {
				if qNum, ok := qVal.(float64); ok {
					qty = int(qNum)
				}
			}

			var med models.Medicine
			tx.Where("name = ? OR generic_name = ? OR medicine_code = ?", name, name, mObj["medId"]).First(&med)
			if med.ID > 0 {
				if req.VisitID > 0 {
					dRec := models.Dispensing{
						VisitID:      req.VisitID,
						MedicineID:   med.ID,
						Quantity:     qty,
						Dosage:       dosage,
						Instructions: inst,
					}
					tx.Create(&dRec)
				}

				if med.StockQuantity >= qty {
					med.StockQuantity -= qty
					tx.Save(&med)
				}
				price := med.UnitPrice
				totalAmount += float64(qty) * price

				medList = append(medList, gin.H{
					"medId":        med.MedicineCode,
					"name":         med.Name,
					"genericName":  med.GenericName,
					"category":     med.Category,
					"properties":   med.Properties,
					"dosage":       dosage,
					"instructions": inst,
					"price":        price,
					"quantity":     qty,
					"stock":        med.StockQuantity,
					"stockStatus":  "พร้อมจ่าย",
				})
			}
		}
	}

	var billing models.Billing
	if req.VisitID > 0 {
		billing = models.Billing{
			VisitID:                 req.VisitID,
			TotalAmount:             totalAmount,
			DiscountFromEligibility: 0,
			NetAmount:               totalAmount,
			PaymentStatus:           "pending",
		}
		tx.Create(&billing)
	}

	targetHN := req.HN
	if targetHN == "" && patient.HN != "" {
		targetHN = patient.HN
	}

	targetName := req.PatientName
	if targetName == "" && patient.FullName != "" {
		targetName = patient.FullName
	}
	if targetName == "" {
		targetName = "ผู้ป่วย"
	}

	nationalID := req.NationalID
	if nationalID == "" && patient.NationalID != "" {
		nationalID = patient.NationalID
	}
	if nationalID == "" {
		nationalID = "-"
	}

	schemeType := req.SchemeType
	if schemeType == "" && patient.SchemeType != "" {
		schemeType = patient.SchemeType
	}
	if schemeType == "" {
		schemeType = "บัตรทอง (สปสช.)"
	}

	age := req.Age
	if age == 0 && patient.ID > 0 && patient.BirthDate.Year() > 1900 {
		age = time.Now().Year() - patient.BirthDate.Year()
	}
	if age == 0 {
		age = 35
	}

	// สร้างหมายเลขคิวการเงินเฉพาะ (Billing Queue: B-XXX)
	var bCount int64
	tx.Model(&models.BillingQueue{}).Count(&bCount)
	bQueueNo := fmt.Sprintf("B-%03d", bCount+1)

	// บันทึกลงตาราง BillingQueue โมเดลคิวการเงินโดยเฉพาะ
	medsJSON, _ := json.Marshal(medList)
	billingQueue := models.BillingQueue{
		QueueNumber:  bQueueNo,
		HN:           targetHN,
		PatientName:  targetName,
		NationalID:   nationalID,
		Gender:       req.Gender,
		Age:          age,
		SchemeType:   schemeType,
		VisitID:      req.VisitID,
		TotalAmount:  totalAmount,
		Status:       "pending",
		DoctorAdvice: req.DoctorAdvice,
		Medications:  string(medsJSON),
	}
	tx.Create(&billingQueue)

	// อัปเดต/สร้างลงตาราง patient_medicines ใน Supabase DB ทันที!
	cleanHN := strings.TrimPrefix(targetHN, "HN-")
	cleanHN = strings.TrimPrefix(cleanHN, "HN")
	var patMed models.PatientMedicine
	if err := tx.Where("hn = ? OR hn = ? OR hn = ?", targetHN, "HN"+cleanHN, "HN-"+cleanHN).First(&patMed).Error; err != nil {
		patMed = models.PatientMedicine{
			HN:              targetHN,
			NationalID:      nationalID,
			FullName:        targetName,
			Gender:          req.Gender,
			Age:             age,
			SchemeType:      schemeType,
			Allergies:       req.Allergies,
			ChronicDiseases: req.ChronicDiseases,
			PhoneNumber:     req.PhoneNumber,
			BloodType:       req.BloodType,
			VisitCount:      1,
		}
		if patMed.Allergies == "" {
			patMed.Allergies = patient.Allergies
		}
		if patMed.ChronicDiseases == "" {
			patMed.ChronicDiseases = patient.ChronicDiseases
		}
		if patMed.PhoneNumber == "" {
			patMed.PhoneNumber = patient.PhoneNumber
		}
		if patMed.Gender == "" {
			patMed.Gender = patient.Gender
		}
		if patMed.BloodType == "" {
			patMed.BloodType = "O+"
		}
		tx.Create(&patMed)
	} else {
		patMed.FullName = targetName
		patMed.NationalID = nationalID
		patMed.SchemeType = schemeType
		if req.Allergies != "" {
			patMed.Allergies = req.Allergies
		}
		if req.ChronicDiseases != "" {
			patMed.ChronicDiseases = req.ChronicDiseases
		}
		if req.PhoneNumber != "" {
			patMed.PhoneNumber = req.PhoneNumber
		}
		if req.BloodType != "" {
			patMed.BloodType = req.BloodType
		}
		patMed.VisitCount += 1
		tx.Save(&patMed)
	}

	tx.Commit()
	ws.BroadcastEvent("PATIENT_MEDICINE_UPDATED", patMed)

	billingPayload := gin.H{
		"id":           billingQueue.ID,
		"queue_id":     billingQueue.ID,
		"queue_number": bQueueNo,
		"visit_id":     billingQueue.VisitID,
		"patient_name": targetName,
		"hn":           targetHN,
		"national_id":  nationalID,
		"gender":       req.Gender,
		"age":          age,
		"scheme_type":  schemeType,
		"total_amount": billingQueue.TotalAmount,
		"net_amount":   billingQueue.TotalAmount,
		"status":       billingQueue.Status,
		"doctor_advice": req.DoctorAdvice,
		"medications":  medList,
		"created_at":   billingQueue.CreatedAt,
	}

	// ปรับสถานะใน medicine_queues เป็น dispensed
	if req.VisitID > 0 {
		config.DB.Model(&models.MedicineQueue{}).Where("visit_id = ?", req.VisitID).Update("status", "dispensed")
	}
	if req.QueueNumber != "" {
		config.DB.Model(&models.MedicineQueue{}).Where("queue_number = ?", req.QueueNumber).Update("status", "dispensed")
	}
	if req.HN != "" {
		config.DB.Model(&models.MedicineQueue{}).Where("hn = ?", req.HN).Update("status", "dispensed")
	}
	if qID > 0 {
		config.DB.Model(&models.MedicineQueue{}).Where("id = ?", qID).Update("status", "dispensed")
	}

	// ปรับสถานะคิวตรวจของคลินิกเป็น รอชำระเงิน ให้ย้ายออกจากห้องยา 100%
	if req.VisitID > 0 {
		config.DB.Model(&models.Queue{}).Where("visit_id = ?", req.VisitID).Update("status", "รอชำระเงิน")
	}
	if patient.ID > 0 {
		config.DB.Model(&models.Queue{}).Where("patient_id = ? AND status NOT IN ('เสร็จสิ้น', 'ยกเลิกคิว')", patient.ID).Update("status", "รอชำระเงิน")
	}
	if req.QueueNumber != "" {
		config.DB.Model(&models.Queue{}).Where("queue_number = ?", req.QueueNumber).Update("status", "รอชำระเงิน")
	}
	if qID > 0 {
		config.DB.Model(&models.Queue{}).Where("id = ?", qID).Update("status", "รอชำระเงิน")
	}

	ws.BroadcastEvent("DISPENSE_RECORDED", gin.H{"visit_id": req.VisitID, "action": "dispensed"})
	ws.BroadcastEvent("BILLING_CREATED", billingPayload)
	ws.BroadcastEvent("QUEUE_UPDATED", gin.H{"action": "status_changed", "status": "รอชำระเงิน", "visit_id": req.VisitID})

	c.JSON(http.StatusOK, gin.H{
		"status":        "success",
		"message":       "Dispensing confirmed and billed successfully",
		"billing_queue": billingQueue,
	})
}

// GET /api/pharmacy/patient-medicines - ดึงประวัติผู้ป่วยและการรับยาทั้งหมดจากตาราง patient_medicines
func GetPatientMedicines(c *gin.Context) {
	var records []models.PatientMedicine
	if err := config.DB.Order("id desc").Find(&records).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch patient medicines: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":            "success",
		"patient_medicines": records,
	})
}

// GET /api/pharmacy/patient-medicines/:hn - ดึงประวัติการรับยาของป่วยรายบุคคลตาม HN
func GetPatientMedicineDetail(c *gin.Context) {
	hn := c.Param("hn")
	var patMed models.PatientMedicine
	if err := config.DB.Where("hn = ? OR hn = ?", hn, "HN-"+hn).First(&patMed).Error; err != nil {
		var patient models.Patient
		if errP := config.DB.Where("hn = ? OR hn = ?", hn, "HN-"+hn).First(&patient).Error; errP == nil {
			patMed = models.PatientMedicine{
				HN:              patient.HN,
				NationalID:      patient.NationalID,
				FullName:        patient.FullName,
				Gender:          patient.Gender,
				Age:             time.Now().Year() - patient.BirthDate.Year(),
				SchemeType:      patient.SchemeType,
				Allergies:       patient.Allergies,
				ChronicDiseases: patient.ChronicDiseases,
				PhoneNumber:     patient.PhoneNumber,
				VisitCount:      1,
			}
		} else {
			c.JSON(http.StatusNotFound, gin.H{"error": "Patient history not found"})
			return
		}
	}

	var patient models.Patient
	var dispensings []models.Dispensing
	if errP := config.DB.Where("hn = ?", patMed.HN).First(&patient).Error; errP == nil {
		var visitIDs []uint
		config.DB.Model(&models.VisitRecord{}).Where("patient_id = ?", patient.ID).Pluck("id", &visitIDs)
		if len(visitIDs) > 0 {
			config.DB.Preload("Medicine").Preload("Doctor").Where("visit_id IN ?", visitIDs).Find(&dispensings)
		}
	}

	// Fallback: หากยังไม่เจอยาใน dispensings ให้ดึงจาก medications ใน BillingQueue
	if len(dispensings) == 0 {
		var bQueues []models.BillingQueue
		config.DB.Where("hn = ? OR hn = ?", hn, "HN-"+hn).Order("id desc").Find(&bQueues)
		for _, bq := range bQueues {
			if bq.Medications != "" {
				var parsed []map[string]interface{}
				if err := json.Unmarshal([]byte(bq.Medications), &parsed); err == nil {
					for _, mObj := range parsed {
						mName, _ := mObj["name"].(string)
						mCode, _ := mObj["medId"].(string)
						dosage, _ := mObj["dosage"].(string)
						inst, _ := mObj["instructions"].(string)
						qty := 1
						if qVal, ok := mObj["quantity"]; ok {
							if qNum, ok := qVal.(float64); ok {
								qty = int(qNum)
							}
						}
						dispensings = append(dispensings, models.Dispensing{
							VisitID:      bq.VisitID,
							Quantity:     qty,
							Dosage:       dosage,
							Instructions: inst,
							Medicine: models.Medicine{
								MedicineCode: mCode,
								Name:         mName,
								Properties:   "ยาตามแพทย์สั่งจ่าย",
							},
							CreatedAt: bq.CreatedAt,
						})
					}
				}
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"status":           "success",
		"patient_medicine": patMed,
		"dispensings":      dispensings,
	})
}

// GET /api/pharmacy/queues - ดึงรายการคิวรอจ่ายยาจากระบบตรวจแพทย์ (เฉพาะข้อมูลจริง ไม่สร้างข้อมูลสุ่ม)
func GetPharmacyQueues(c *gin.Context) {
	type PharmacyQueueItem struct {
		ID              string    `json:"id"`
		VisitID         uint      `json:"visit_id"`
		QueueNumber     string    `json:"queue_number"`
		HN              string    `json:"hn"`
		PatientName     string    `json:"patient_name"`
		NationalID      string    `json:"national_id"`
		Gender          string    `json:"gender"`
		Age             int       `json:"age"`
		SchemeType      string    `json:"scheme_type"`
		Allergies       string    `json:"allergies"`
		ChronicDiseases string    `json:"chronic_diseases"`
		DoctorAdvice    string    `json:"doctor_advice"`
		Medications     []gin.H   `json:"medications"`
		CreatedAt       time.Time `json:"created_at"`
	}

	var results []PharmacyQueueItem

	// 1. ดึงจากตารางคิวห้องยาเฉพาะ models.MedicineQueue เรียงล่าสุดขึ้นบนสุด
	var medQueues []models.MedicineQueue
	config.DB.Where("status = ?", "pending").Order("id desc, created_at desc").Find(&medQueues)
	for _, mq := range medQueues {
		var medList []gin.H
		if mq.Medications != "" {
			var parsed []gin.H
			if err := json.Unmarshal([]byte(mq.Medications), &parsed); err == nil {
				medList = parsed
			}
		}
		if medList == nil {
			medList = []gin.H{}
		}

		results = append(results, PharmacyQueueItem{
			ID:              fmt.Sprintf("MQ-%d", mq.ID),
			VisitID:         mq.VisitID,
			QueueNumber:     mq.QueueNumber,
			HN:              mq.HN,
			PatientName:     mq.PatientName,
			NationalID:      mq.NationalID,
			Gender:          mq.Gender,
			Age:             mq.Age,
			SchemeType:      mq.SchemeType,
			Allergies:       "ปฏิเสธการแพ้ยา",
			ChronicDiseases: "ไม่มี",
			DoctorAdvice:    mq.DoctorAdvice,
			Medications:     medList,
			CreatedAt:       mq.CreatedAt,
		})
	}

	// 2. ดึงจากคิวตรวจแพทย์ models.Queue เรียงล่าสุดขึ้นบนสุด (เฉพาะคิวที่ยังไม่ได้อยู่ใน medQueues)
	var queues []models.Queue
	config.DB.Preload("Patient").
		Where("status IN ?", []string{"รอรับยา", "pharmacy_waiting", "Pending Pharmacy"}).
		Order("id desc").
		Find(&queues)

	for _, q := range queues {
		visitID := uint(0)
		if q.VisitID != nil {
			visitID = *q.VisitID
		} else {
			var v models.VisitRecord
			if err := config.DB.Where("patient_id = ?", q.PatientID).Order("id desc").First(&v).Error; err == nil {
				visitID = v.ID
			}
		}

		// เช็คไม่ให้ซ้ำกับ MedicineQueue ที่มี visit_id เดียวกัน
		alreadyInList := false
		for _, r := range results {
			if visitID > 0 && r.VisitID == visitID {
				alreadyInList = true
				break
			}
		}
		if alreadyInList {
			continue
		}

		// ดึงรายการยาที่แพทย์สั่งจริงจากตาราง dispensings
		var dispensings []models.Dispensing
		if visitID > 0 {
			config.DB.Preload("Medicine").Where("visit_id = ?", visitID).Find(&dispensings)
		}

		var medList []gin.H
		for _, d := range dispensings {
			medList = append(medList, gin.H{
				"medId":        d.Medicine.MedicineCode,
				"name":         d.Medicine.Name,
				"genericName":  d.Medicine.GenericName,
				"category":     d.Medicine.Category,
				"properties":   d.Medicine.Properties,
				"dosage":       d.Dosage,
				"instructions": d.Instructions,
				"price":        d.Medicine.UnitPrice,
				"quantity":     d.Quantity,
				"stock":        d.Medicine.StockQuantity,
				"stockStatus":  "พร้อมจ่าย",
			})
		}
		if medList == nil {
			medList = []gin.H{}
		}

		age := 35
		if q.Patient.BirthDate.Year() > 1900 {
			age = time.Now().Year() - q.Patient.BirthDate.Year()
		}

		pName := q.Patient.FullName
		if pName == "" {
			pName = "ผู้ป่วย"
		}
		hn := q.Patient.HN
		if hn == "" {
			hn = fmt.Sprintf("HN-%d", q.PatientID)
		}

		results = append(results, PharmacyQueueItem{
			ID:              fmt.Sprintf("%d", q.ID),
			VisitID:         visitID,
			QueueNumber:     q.QueueNumber,
			HN:              hn,
			PatientName:     pName,
			NationalID:      q.Patient.NationalID,
			Gender:          q.Patient.Gender,
			Age:             age,
			SchemeType:      q.Patient.SchemeType,
			Allergies:       q.Patient.Allergies,
			ChronicDiseases: q.Patient.ChronicDiseases,
			DoctorAdvice:    q.Note,
			Medications:     medList,
			CreatedAt:       q.CreatedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"queues": results,
	})
}
