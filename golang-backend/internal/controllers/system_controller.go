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

// POST /api/system/simulate-prescription - จำลองหมอกด Submit ใบสั่งยา สุ่มดึง/สร้างผู้ป่วย 10+ รายชื่อลง Supabase DB จริง
func SimulateDoctorPrescription(c *gin.Context) {
	patientPool := []struct {
		Name       string
		Scheme     string
		Gender     string
		Age        int
		NationalID string
	}{
		{Name: "นายสมชาย ใจดี", Scheme: "บัตรทอง (สปสช.)", Gender: "ชาย", Age: 42, NationalID: "1101800234567"},
		{Name: "นางสาวกานดา มณีรัตน์", Scheme: "ประกันสังคม (ม.33)", Gender: "หญิง", Age: 29, NationalID: "1101800234568"},
		{Name: "นายบุญค้ำ โยลัย", Scheme: "สิทธิ 30 บาท (สปสช.)", Gender: "ชาย", Age: 55, NationalID: "1101800234569"},
		{Name: "นายอนันต์ สุขี", Scheme: "จ่ายตรง / ข้าราชการ", Gender: "ชาย", Age: 48, NationalID: "1101800234570"},
		{Name: "นางสาวจินตนา มานิน", Scheme: "ประกันสุขภาพเอกชน", Gender: "หญิง", Age: 34, NationalID: "1101800234571"},
		{Name: "นายบุญมี มีทรัพย์", Scheme: "บัตรทอง (สปสช.)", Gender: "ชาย", Age: 61, NationalID: "1101800234572"},
		{Name: "นางสาวสุภาสิทธิ์ ดวงใจ", Scheme: "ประกันสังคม (ม.33)", Gender: "หญิง", Age: 27, NationalID: "1101800234573"},
		{Name: "นายวิโรจน์ แสงสุริยา", Scheme: "จ่ายตรง / ข้าราชการ", Gender: "ชาย", Age: 50, NationalID: "1101800234574"},
		{Name: "นางสาวกุหลาบ สุขี", Scheme: "ประกันสุขภาพเอกชน", Gender: "หญิง", Age: 31, NationalID: "1101800234575"},
		{Name: "นายธนกร วรรณศิลป์", Scheme: "บัตรทอง (สปสช.)", Gender: "ชาย", Age: 39, NationalID: "1101800234576"},
	}

	randIdx := int(time.Now().UnixNano() % int64(len(patientPool)))
	target := patientPool[randIdx]

	var patient models.Patient
	if err := config.DB.Where("full_name = ?", target.Name).First(&patient).Error; err != nil {
		patient = models.Patient{
			HN:          fmt.Sprintf("HN-%04d", (time.Now().UnixNano()/1e6)%10000),
			NationalID:  target.NationalID,
			FullName:    target.Name,
			Gender:      target.Gender,
			PhoneNumber: "081-999-8888",
			SchemeType:  target.Scheme,
		}
		config.DB.Create(&patient)
	}

	// 2. ดึงข้อมูล Medicine จริงจาก DB
	var medicines []models.Medicine
	config.DB.Find(&medicines)

	queueNo := fmt.Sprintf("Q-%03d", (time.Now().UnixNano()/1e6)%1000)
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

	ws.BroadcastEvent("QUEUE_CREATED", gin.H{
		"id":           queue.ID,
		"patient_id":   patient.ID,
		"queue_number": queue.QueueNumber,
		"status":       queue.Status,
		"patient_name": patient.FullName,
		"hn":           patient.HN,
		"national_id":  patient.NationalID,
		"scheme_type":  patient.SchemeType,
	})
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
