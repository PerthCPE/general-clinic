package controllers

import (
	"fmt"
	"math/rand"
	"net/http"
	"time"

	"clinic-backend/internal/config"
	"clinic-backend/internal/models"
	"clinic-backend/internal/ws"

	"github.com/gin-gonic/gin"
)

// POST /api/system/reset-db - รีเซ็ตข้อมูลทดสอบให้กลับมาเป็นค่าเริ่มต้นสำหรับ Re-testing
func ResetTestDatabase(c *gin.Context) {
	// ลบข้อมูลการทดสอบชั่วคราวออกทั้งหมด
	config.DB.Exec("DELETE FROM qr_payments")
	config.DB.Exec("DELETE FROM billings")
	config.DB.Exec("DELETE FROM dispensings")
	config.DB.Exec("DELETE FROM prescription_items")
	config.DB.Exec("DELETE FROM screenings")
	config.DB.Exec("DELETE FROM queues")
	config.DB.Exec("DELETE FROM visit_records")

	// รีเซ็ตสต็อกยาทุกตัวกลับค่าเดิม (100)
	config.DB.Model(&models.Medicine{}).Where("1=1").Update("stock_quantity", 100)

	// กระจายข่าวผ่าน WebSocket ให้ทุกหน้าจอรีเฟรชทันที
	ws.BroadcastEvent("QUEUE_UPDATED", gin.H{"action": "db_reset"})
	ws.BroadcastEvent("MEDICINE_STOCK_UPDATED", gin.H{"action": "db_reset"})

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Database reset successfully for E2E testing",
	})
}

// POST /api/system/simulate-prescription
// จำลองหมอกด Submit ใบสั่งยา — สุ่มดึงผู้ป่วยจริงจากตาราง patient_histories + ยาจริงจากตาราง medicines
func SimulateDoctorPrescription(c *gin.Context) {
	// 1. ดึงผู้ป่วยจริงจากตาราง patient_histories
	var patientHistories []models.Patient_Hisstory
	config.DB.Find(&patientHistories)

	// ถ้าตาราง patient_histories ว่าง → seed ข้อมูลตัวอย่าง 4 คน
	if len(patientHistories) == 0 {
		patientHistories = []models.Patient_Hisstory{
			{
				HN: "HN0045", NationalID: "1100501234567", FullName: "นาย สมชาย ใจดี",
				Gender: "ชาย", Age: 45, BloodType: "O+",
				SchemeType: "สิทธิ 30 บาท (สปสช.)", Allergies: "ปฏิเสธการแพ้ยา",
				ChronicDiseases: "ความดันโลหิตสูง, เบาหวาน", VisitCount: 5,
				PhoneNumber: "081-234-5678",
			},
			{
				HN: "HN0112", NationalID: "3100598765432", FullName: "นาง มะลิวัน จันทร์เพ็ญ",
				Gender: "หญิง", Age: 62, BloodType: "A-",
				SchemeType: "ประกันสังคม", Allergies: "แพ้ยา Penicillin",
				ChronicDiseases: "ไม่มี", VisitCount: 8,
				PhoneNumber: "089-876-5432",
			},
			{
				HN: "HN0018", NationalID: "1101455443219", FullName: "นาย พงศกร รัตนสังข์",
				Gender: "ชาย", Age: 28, BloodType: "B+",
				SchemeType: "ประกันสุขภาพเอกชน", Allergies: "ปฏิเสธการแพ้ยา",
				ChronicDiseases: "หอบหืด", VisitCount: 11,
				PhoneNumber: "086-555-4321",
			},
			{
				HN: "HN0884", NationalID: "5102011223345", FullName: "นางสาว ศิริพร แก้วมณี",
				Gender: "หญิง", Age: 34, BloodType: "AB+",
				SchemeType: "สิทธิ 30 บาท (สปสช.)", Allergies: "ปฏิเสธการแพ้ยา",
				ChronicDiseases: "ไม่มี", VisitCount: 2,
				PhoneNumber: "084-111-2233",
			},
		}
		for i := range patientHistories {
			config.DB.Create(&patientHistories[i])
		}
	}

	// 2. สุ่มเลือกผู้ป่วย 1 คนจาก patient_histories (ใช้ math/rand ให้ได้คนละคนทุกครั้ง)
	rng := rand.New(rand.NewSource(time.Now().UnixNano()))
	target := patientHistories[rng.Intn(len(patientHistories))]

	// เพิ่ม visit_count ของผู้ป่วยคนนี้
	config.DB.Model(&target).Update("visit_count", target.VisitCount+1)

	// 3. สร้าง/ดึงผู้ป่วยในตาราง patients เดิม (สำหรับ FK ของ Queue, Visit, Dispensing)
	var patient models.Patient
	if err := config.DB.Where("hn = ?", target.HN).First(&patient).Error; err != nil {
		patient = models.Patient{
			HN:              target.HN,
			NationalID:      target.NationalID,
			FullName:        target.FullName,
			Gender:          target.Gender,
			PhoneNumber:     target.PhoneNumber,
			SchemeType:      target.SchemeType,
			Allergies:       target.Allergies,
			ChronicDiseases: target.ChronicDiseases,
		}
		config.DB.Create(&patient)
	}

	// 4. ดึงข้อมูล Medicine จริงจาก DB
	var medicines []models.Medicine
	config.DB.Find(&medicines)

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

	// 6. สร้าง Queue
	queueNo := fmt.Sprintf("Q-%03d", rng.Intn(999)+1)
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

	// 9. Broadcast WebSocket → หน้าจ่ายยารับข้อมูลเรียลไทม์
	ws.BroadcastEvent("QUEUE_CREATED", gin.H{
		"id":              queue.ID,
		"patient_id":      patient.ID,
		"queue_number":    queue.QueueNumber,
		"status":          queue.Status,
		"patient_name":    target.FullName,
		"hn":              target.HN,
		"national_id":     target.NationalID,
		"scheme_type":     target.SchemeType,
		"age":             target.Age,
		"gender":          target.Gender,
		"blood_type":      target.BloodType,
		"allergies":       target.Allergies,
		"chronic_diseases": target.ChronicDiseases,
		"visit_count":     target.VisitCount + 1,
		"phone":           target.PhoneNumber,
		"medications":     dispensedMeds,
		"visit_id":        visit.ID,
	})
	ws.BroadcastEvent("QUEUE_UPDATED", queue)

	c.JSON(http.StatusOK, gin.H{
		"status":       "success",
		"message":      "Prescription submitted to Supabase DB successfully",
		"queue":        queue,
		"patient_name": target.FullName,
		"hn":           target.HN,
		"visit_id":     visit.ID,
	})
}
