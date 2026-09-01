package controllers

import (
	"net/http"

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

	// สร้างคิวทดสอบตั้งต้นสำหรับ Flow ทั้ง 5 สถานะ
	queues := []models.Queue{
		{
			PatientID:   1,
			QueueNumber: "Q-001",
			Status:      "waiting",
			Department:  "แผนกคัดกรอง",
			Note:        "มีไข้ ไอ เจ็บคอ 2 วัน",
		},
		{
			PatientID:   2,
			QueueNumber: "Q-002",
			Status:      "doctor_waiting",
			Department:  "ห้องตรวจ 1",
			Note:        "ปวดท้องลิ้นปี่ คลื่นไส้",
		},
		{
			PatientID:   3,
			QueueNumber: "Q-003",
			Status:      "pharmacy_waiting",
			Department:  "ห้องยา",
			Note:        "ตรวจติดตามความดันโลหิต",
		},
		{
			PatientID:   4,
			QueueNumber: "Q-004",
			Status:      "billing_waiting",
			Department:  "ห้องชำระเงิน",
			Note:        "ผื่นคันตามแขนขา",
		},
	}

	for i := range queues {
		config.DB.Create(&queues[i])
	}

	// กระจายข่าวผ่าน WebSocket ให้ทุกหน้าจอรีเฟรชทันที
	ws.BroadcastEvent("QUEUE_UPDATED", gin.H{"action": "db_reset"})
	ws.BroadcastEvent("MEDICINE_STOCK_UPDATED", gin.H{"action": "db_reset"})

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Database reset successfully for E2E testing",
	})
}
