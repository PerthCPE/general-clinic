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

// POST /api/system/simulate-prescription - จำลองหมอกด Submit ใบสั่งยา ลง Supabase Database จริง
func SimulateDoctorPrescription(c *gin.Context) {
	names := []string{"นายสมชาย ใจดี", "นางสาวกานดา มณีรัตน์", "นายอนันต์ สุขี", "นางสาวจินตนา มานิน", "นายบุญมี มีทรัพย์"}
	hns := []string{"HN-0089", "HN-0112", "HN-0789", "HN-0512", "HN-0309"}

	randIdx := int(time.Now().UnixNano() % int64(len(names)))
	patientName := names[randIdx]
	hn := hns[randIdx]

	var patient models.Patient
	if err := config.DB.Where("hn = ?", hn).First(&patient).Error; err != nil {
		patient = models.Patient{
			HN:          hn,
			FullName:    patientName,
			PhoneNumber: "081-999-8888",
			SchemeType:  "บัตรทอง (สปสช.)",
		}
		config.DB.Create(&patient)
	}

	queueNo := fmt.Sprintf("Q-%03d", time.Now().Unix()%1000)
	queue := models.Queue{
		PatientID:   patient.ID,
		QueueNumber: queueNo,
		Status:      "pharmacy_waiting",
		Department:  "ห้องยา",
		Note:        "มีไข้ ไอ เจ็บคอ แพทย์สั่งจ่ายยา",
	}
	config.DB.Create(&queue)

	// สร้าง VisitRecord
	visit := models.VisitRecord{
		PatientID: patient.ID,
		VisitDate: time.Now(),
	}
	config.DB.Create(&visit)

	ws.BroadcastEvent("QUEUE_CREATED", queue)
	ws.BroadcastEvent("QUEUE_UPDATED", queue)

	c.JSON(http.StatusOK, gin.H{
		"status":       "success",
		"message":      "Prescription submitted to DB successfully",
		"queue":        queue,
		"patient_name": patientName,
		"hn":           hn,
		"visit_id":     visit.ID,
	})
}
