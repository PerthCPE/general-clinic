package controllers

import (
	"fmt"
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

	// รีเซ็ตสต็อกยาตัวอย่างกลับค่าเดิม (เช่น 50, 100)
	config.DB.Model(&models.Medicine{}).Where("medicine_code = ?", "MED-0231").Update("stock_quantity", 342)
	config.DB.Model(&models.Medicine{}).Where("medicine_code = ?", "MED-0187").Update("stock_quantity", 48)
	config.DB.Model(&models.Medicine{}).Where("medicine_code = ?", "MED-0402").Update("stock_quantity", 0)
	config.DB.Model(&models.Medicine{}).Where("medicine_code = ?", "MED-0119").Update("stock_quantity", 215)
	config.DB.Model(&models.Medicine{}).Where("medicine_code = ?", "MED-0356").Update("stock_quantity", 76)

	// กระจายข่าวผ่าน WebSocket ให้ทุกหน้าจอรีเฟรชทันที
	ws.BroadcastEvent("QUEUE_UPDATED", gin.H{"action": "db_reset"})
	ws.BroadcastEvent("MEDICINE_STOCK_UPDATED", gin.H{"action": "db_reset"})

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Database reset successfully for E2E testing",
	})
}

// POST /api/system/simulate-prescription - จำลองหมอกด Submit ใบสั่งยา สุ่มดึงข้อมูลจาก Patient และ Medicine ใน Supabase DB จริง
func SimulateDoctorPrescription(c *gin.Context) {
	// 1. ดึงข้อมูล Patient จริงจาก DB
	var patients []models.Patient
	config.DB.Find(&patients)

	var patient models.Patient
	if len(patients) > 0 {
		randPatientIdx := int(time.Now().UnixNano() % int64(len(patients)))
		patient = patients[randPatientIdx]
	} else {
		patient = models.Patient{
			HN:          fmt.Sprintf("HN-%04d", time.Now().Unix()%10000),
			FullName:    "นายสมชาย ใจดี",
			PhoneNumber: "081-999-8888",
			SchemeType:  "บัตรทอง (สปสช.)",
		}
		config.DB.Create(&patient)
	}

	// 2. ดึงข้อมูล Medicine จริงจาก DB
	var medicines []models.Medicine
	config.DB.Find(&medicines)

	queueNo := fmt.Sprintf("Q-%03d", time.Now().Unix()%1000)
	queue := models.Queue{
		PatientID:   patient.ID,
		QueueNumber: queueNo,
		Status:      "pharmacy_waiting",
		Department:  "ห้องยา",
		Note:        "มีไข้ ไอ เจ็บคอ แพทย์สั่งจ่ายยา",
	}
	config.DB.Create(&queue)

	// สร้าง VisitRecord จริงลง DB
	visit := models.VisitRecord{
		PatientID: patient.ID,
		VisitDate: time.Now(),
	}
	config.DB.Create(&visit)

	// สร้าง Dispensing บันทึกลง DB จริง สุ่มยา 1-2 รายการจาก DB
	if len(medicines) > 0 {
		randMedIdx := int(time.Now().UnixNano() % int64(len(medicines)))
		med1 := medicines[randMedIdx]
		dispensing1 := models.Dispensing{
			VisitID:      visit.ID,
			MedicineID:   med1.ID,
			Quantity:     1,
			Dosage:       "1 เม็ด วันละ 3 ครั้ง หลังอาหาร",
			Instructions: "รับประทานต่อเนื่องจนหมด",
		}
		config.DB.Create(&dispensing1)
	}

	ws.BroadcastEvent("QUEUE_CREATED", queue)
	ws.BroadcastEvent("QUEUE_UPDATED", queue)

	c.JSON(http.StatusOK, gin.H{
		"status":       "success",
		"message":      "Prescription submitted to Supabase DB successfully",
		"queue":        queue,
		"patient_name": patient.FullName,
		"hn":           patient.HN,
		"visit_id":     visit.ID,
	})
}
