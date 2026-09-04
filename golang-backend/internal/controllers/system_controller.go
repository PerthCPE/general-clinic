package controllers

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"time"

	"clinic-backend/internal/config"
	"clinic-backend/internal/models"
	"clinic-backend/internal/ws"

	"github.com/gin-gonic/gin"
)

// POST /api/system/reset-db - ลบข้อมูลทดสอบในระบบ
func ResetTestDatabase(c *gin.Context) {
	db := config.DB

	// ลบข้อมูลตารางลูกที่อ้างอิง Foreign Key ก่อนตามลำดับ เพื่อให้ DELETE FROM patients และ visit_records สำเร็จ 100%
	tables := []string{
		"qr_payments",
		"billings",
		"billing_queues",
		"billing_histories",
		"medicine_queues",
		"dispensings",
		"prescription_items",
		"examinations",
		"diagnoses",
		"patient_medicines",
		"patient_histories",
		"screenings",
		"queues",
		"visit_records",
		"medical_eligibilities",
		"patients",
	}
	for _, tbl := range tables {
		if err := db.Exec("DELETE FROM " + tbl).Error; err != nil {
			// Fallback TRUNCATE CASCADE if exists
			db.Exec("TRUNCATE TABLE " + tbl + " CASCADE")
		}
	}

	// กระจายข่าวผ่าน WebSocket ให้ทุกหน้าจอรีเฟรชทันที
	ws.BroadcastEvent("QUEUE_UPDATED", gin.H{"action": "db_reset"})
	ws.BroadcastEvent("PATIENT_REGISTERED", gin.H{"action": "db_reset"})

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "ล้างข้อมูลทดสอบทั้งหมดในระบบเรียบร้อยแล้ว",
	})
}

// POST /api/system/simulate-prescription
// จำลองหมอกด Submit ใบสั่งยา — สุ่มดึงผู้ป่วยจริงจากตาราง patient_histories + ยาจริงจากตาราง medicines
func SimulateDoctorPrescription(c *gin.Context) {
	// 1. ดึงผู้ป่วยจริงจากตาราง patients เดิม
	var patients []models.Patient
	config.DB.Limit(30).Order("id desc").Find(&patients)

	if len(patients) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "ไม่มีข้อมูลผู้ป่วยในตาราง patients กรุณา Seed ข้อมูลก่อน",
		})
		return
	}

	// 2. สุ่มเลือกผู้ป่วย 1 คนจาก patients
	rng := rand.New(rand.NewSource(time.Now().UnixNano()))
	patient := patients[rng.Intn(len(patients))]
	age := time.Now().Year() - patient.BirthDate.Year()

	// 3. จำลอง BloodType (เพราะใน patients ไม่มี)
	bloodTypes := []string{"A+", "B+", "O+", "AB+", "O-"}
	bloodType := bloodTypes[rng.Intn(len(bloodTypes))]

	// 4. ดึงข้อมูล Medicine จริงจาก DB
	var medicines []models.Medicine
	config.DB.Limit(30).Find(&medicines)

	if len(medicines) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "ไม่มีข้อมูลยาในฐานข้อมูล กรุณาเพิ่มข้อมูลยาก่อน",
		})
		return
	}

	// 5. ดึงเจ้าหน้าที่ (User) มา 1 คนเพื่อใช้เป็นผู้สร้างรายการ
	var systemUser models.User
	config.DB.First(&systemUser)
	if systemUser.ID == 0 {
		systemUser.ID = 1
	}

	// 6. สร้าง Queue (มาตรฐาน Hexadecimal 4 หลัก Q0001 - QFFFF)
	queueNo := fmt.Sprintf("Q%04X", rng.Intn(0xFFFF)+1)
	queue := models.Queue{
		PatientID:       patient.ID,
		CreatedByUserID: systemUser.ID,
		QueueNumber:     queueNo,
		Status:          "pharmacy_waiting",
		Department:      "ห้องยา",
		Note:            "มีไข้ ไอ เจ็บคอ แพทย์สั่งจ่ายยา",
	}
	config.DB.Create(&queue)

	// 7. สร้าง VisitRecord
	visit := models.VisitRecord{
		PatientID: patient.ID,
		DoctorID:  systemUser.ID,
		VisitDate: time.Now(),
	}
	config.DB.Create(&visit)

	// 8. สุ่มยา 1-3 รายการจาก DB แล้วสร้าง Dispensing
	var dispensedMeds []gin.H
	numMeds := rng.Intn(3) + 1 // สุ่ม 1-3 ตัว
	usedIdx := make(map[int]bool)

	for i := 0; i < numMeds && i < len(medicines); i++ {
		var medIdx int
		for {
			medIdx = rng.Intn(len(medicines))
			if !usedIdx[medIdx] {
				usedIdx[medIdx] = true
				break
			}
		}
		med := medicines[medIdx]
		qty := rng.Intn(3) + 1 // สุ่มจำนวน 1-3

		dispensing := models.Dispensing{
			VisitID:      visit.ID,
			MedicineID:   med.ID,
			DoctorID:     systemUser.ID,
			Quantity:     qty,
			Dosage:       "1 เม็ด วันละ 3 ครั้ง หลังอาหาร",
			Instructions: "รับประทานต่อเนื่องจนหมด",
		}
		config.DB.Create(&dispensing)

		status := "in-stock"
		if med.StockQuantity == 0 {
			status = "out-stock"
		} else if med.StockQuantity < 50 {
			status = "low-stock"
		}

		dispensedMeds = append(dispensedMeds, gin.H{
			"medId":        med.MedicineCode,
			"name":         med.Name,
			"genericName":  med.GenericName,
			"category":     med.Category,
			"properties":   med.Properties,
			"dosage":       dispensing.Dosage,
			"instructions": dispensing.Instructions,
			"price":        med.UnitPrice,
			"quantity":     qty,
			"stock":        med.StockQuantity,
			"stockStatus":  status,
		})
	}

	// 8.5. บันทึก/อัปเดตลงตาราง patient_medicines เพื่อให้หน้าประวัติรับยาเห็นทันที
	var patMed models.PatientMedicine
	if err := config.DB.Where("hn = ?", patient.HN).First(&patMed).Error; err != nil {
		patMed = models.PatientMedicine{
			HN:              patient.HN,
			NationalID:      patient.NationalID,
			FullName:        patient.FullName,
			Gender:          patient.Gender,
			Age:             age,
			SchemeType:      patient.SchemeType,
			Allergies:       patient.Allergies,
			ChronicDiseases: patient.ChronicDiseases,
			PhoneNumber:     patient.PhoneNumber,
			BloodType:       bloodType,
			VisitCount:      1,
		}
		config.DB.Create(&patMed)
	} else {
		patMed.VisitCount += 1
		config.DB.Save(&patMed)
	}
	ws.BroadcastEvent("PATIENT_MEDICINE_UPDATED", patMed)

	// 8.6. บันทึกลงตารางคิวห้องยาเฉพาะ medicine_queues
	var mqCount int64
	config.DB.Model(&models.MedicineQueue{}).Count(&mqCount)
	mQueueNo := fmt.Sprintf("M-%03d", mqCount+1)
	dispensedJSON, _ := json.Marshal(dispensedMeds)

	medicineQueue := models.MedicineQueue{
		QueueNumber:  mQueueNo,
		HN:           patient.HN,
		PatientName:  patient.FullName,
		NationalID:   patient.NationalID,
		Gender:       patient.Gender,
		Age:          age,
		SchemeType:   patient.SchemeType,
		VisitID:      visit.ID,
		DoctorAdvice: "มีไข้ ไอ เจ็บคอ แพทย์สั่งจ่ายยา",
		Status:       "pending",
		Medications:  string(dispensedJSON),
	}
	config.DB.Create(&medicineQueue)

	// 9. Broadcast	// ยิง WebSocket ไปบอกระบบจัดการคิวห้องยา
	ws.BroadcastEvent("QUEUE_CREATED", gin.H{
		"id":              medicineQueue.ID,
		"patient_id":      patient.ID,
		"queue_number":    medicineQueue.QueueNumber,
		"status":          medicineQueue.Status,
		"patient_name":    patient.FullName,
		"hn":              patient.HN,
		"national_id":     patient.NationalID,
		"scheme_type":     patient.SchemeType,
		"age":             age,
		"gender":          patient.Gender,
		"blood_type":      bloodType,
		"allergies":       patient.Allergies,
		"chronic_diseases": patient.ChronicDiseases,
		"visit_count":     1, // We will calculate this accurately in the dispensing phase
		"phone":           patient.PhoneNumber,
		"medications":     dispensedMeds,
		"visit_id":        visit.ID,
	})
	ws.BroadcastEvent("QUEUE_UPDATED", queue)

	c.JSON(http.StatusOK, gin.H{
		"status":       "success",
		"message":      "Prescription submitted to Supabase DB successfully",
		"queue":        queue,
		"patient_name": patient.FullName,
		"hn":           patient.HN,
		"visit_id":     visit.ID,
		"patient":      patient,
		"medications":  dispensedMeds,
	})
}
