package controllers

import (
	"net/http"
	"time"

	"clinic-backend/internal/config"
	"clinic-backend/internal/models"
	"clinic-backend/internal/ws"

	"github.com/gin-gonic/gin"
)

// POST /api/system/reset-db - ลบข้อมูลทดสอบในระบบ และสร้างข้อมูลตั้งต้นสำหรับทดสอบคัดกรอง
func ResetTestDatabase(c *gin.Context) {
	if !config.AppConfig.DevMode {
		c.JSON(http.StatusForbidden, gin.H{"error": "Reset database is only available in dev mode"})
		return
	}

	db := config.DB

	// 1. ล้างแคช In-Memory ใน RAM ทันที
	InvalidatePharmacyQueueCache()
	InvalidateBillingQueueCache()
	InvalidateMedicinesCache()

	// 2. ลบข้อมูลตารางลูกที่อ้างอิง Foreign Key ตามลำดับ
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

	// 3. Seed ผู้ป่วยตั้งต้นมาตรฐาน 8 คน (HN0001 - HN0008)
	parseDate := func(d string) time.Time {
		t, _ := time.Parse("2006-01-02", d)
		return t
	}

	basePatients := []models.Patient{
		{
			HN:               "HN0001",
			NationalID:       "1234567890123",
			FullName:         "นายสมชาย ใจดี",
			Gender:           "ชาย",
			BirthDate:        parseDate("1990-05-15"),
			Address:          "123/45 ถนนพหลโยธิน แขวงลาดยาว เขตจตุจักร กรุงเทพฯ",
			PhoneNumber:      "081-234-5678",
			EmergencyContact: "นางสมศรี (ภรรยา) 089-999-1111",
			SchemeType:       "บัตรทอง (สปสช.)",
			Allergies:        "ปฏิเสธการแพ้ยา",
			ChronicDiseases:  "ความดันโลหิตสูง (คุมได้ดี)",
		},
		{
			HN:               "HN0002",
			NationalID:       "3100598765432",
			FullName:         "นางสาววิภาดา มณีรัตน์",
			Gender:           "หญิง",
			BirthDate:        parseDate("1995-11-22"),
			Address:          "88/12 ซอยสุขุมวิท 55 แขวงคลองตันเหนือ เขตวัฒนา กรุงเทพฯ",
			PhoneNumber:      "089-876-5432",
			EmergencyContact: "นายประสิทธิ์ (บิดา) 081-444-2222",
			SchemeType:       "ประกันสังคม (ม.33)",
			Allergies:        "แพ้ยา Penicillin",
			ChronicDiseases:  "ไมเกรน",
		},
		{
			HN:               "HN0003",
			NationalID:       "1101455443219",
			FullName:         "นายอาทิตย์ มีสุข",
			Gender:           "ชาย",
			BirthDate:        parseDate("1982-03-10"),
			Address:          "45/6 ถนนงามวงศ์วาน ตำบลบางเขน อำเภอเมือง นนทบุรี",
			PhoneNumber:      "086-555-4321",
			EmergencyContact: "นางวรรณา (มารดา) 082-333-8888",
			SchemeType:       "สิทธิ์ข้าราชการ",
			Allergies:        "ปฏิเสธการแพ้ยา",
			ChronicDiseases:  "ความดันโลหิตสูง",
		},
		{
			HN:               "HN0004",
			NationalID:       "5102011223345",
			FullName:         "นางสมศรี รักษาดี",
			Gender:           "หญิง",
			BirthDate:        parseDate("1975-08-05"),
			Address:          "99/8 ซอยลาดพร้าว 71 แขวงสะพานสอง เขตวังทองหลาง กรุงเทพฯ",
			PhoneNumber:      "084-111-2233",
			EmergencyContact: "นายธนา (บุตรชาย) 087-654-3210",
			SchemeType:       "บัตรทอง (สปสช.)",
			Allergies:        "ปฏิเสธการแพ้ยา",
			ChronicDiseases:  "เบาหวานชนิดที่ 2",
		},
		{
			HN:               "HN0005",
			NationalID:       "1103377889901",
			FullName:         "นายธนกฤต กิตติพงษ์",
			Gender:           "ชาย",
			BirthDate:        parseDate("1998-09-14"),
			Address:          "15/9 ถนนเพชรเกษม แขวงบางแคเหนือ เขตบางแค กรุงเทพฯ",
			PhoneNumber:      "083-999-8877",
			EmergencyContact: "นางกาญจนา (พี่สาว) 081-333-4455",
			SchemeType:       "ประกันสุขภาพเอกชน",
			Allergies:        "ปฏิเสธการแพ้ยา",
			ChronicDiseases:  "ไม่มี",
		},
		{
			HN:               "HN0006",
			NationalID:       "1104488990123",
			FullName:         "เด็กหญิงกัญญา มีทรัพย์",
			Gender:           "หญิง",
			BirthDate:        parseDate("2018-04-12"),
			Address:          "24/1 ถนนพระราม 2 ซอย 50 แขวงแสมดำ เขตบางขุนเทียน กรุงเทพฯ",
			PhoneNumber:      "082-123-4567",
			EmergencyContact: "นายเกรียงไกร (บิดา) 082-123-4567",
			SchemeType:       "บัตรทอง (สปสช.)",
			Allergies:        "ปฏิเสธการแพ้ยา",
			ChronicDiseases:  "ไม่มี",
		},
		{
			HN:               "HN0007",
			NationalID:       "3102233445567",
			FullName:         "นายประเสริฐ ยืนยง",
			Gender:           "ชาย",
			BirthDate:        parseDate("1958-01-20"),
			Address:          "67/3 ถนนสุขาภิบาล 5 แขวงท่าแร้ง เขตบางเขน กรุงเทพฯ",
			PhoneNumber:      "085-678-9012",
			EmergencyContact: "นางรัตนา (ภรรยา) 089-123-4567",
			SchemeType:       "สิทธิ์ข้าราชการ",
			Allergies:        "แพ้ยา Sulfa",
			ChronicDiseases:  "โรคหัวใจขาดเลือด, ความดันโลหิตสูง",
		},
		{
			HN:               "HN0008",
			NationalID:       "2105566778890",
			FullName:         "นางสาวมณีรัตน์ วงศ์สว่าง",
			Gender:           "หญิง",
			BirthDate:        parseDate("2002-07-30"),
			Address:          "302/11 ถนนรัชดาภิเษก แขวงจันทร์เกษม เขตจตุจักร กรุงเทพฯ",
			PhoneNumber:      "088-765-4321",
			EmergencyContact: "นายสมบัติ (บิดา) 086-789-0123",
			SchemeType:       "ชำระเงินเอง",
			Allergies:        "ปฏิเสธการแพ้ยา",
			ChronicDiseases:  "ไม่มี",
		},
	}

	for i := range basePatients {
		db.Create(&basePatients[i])
	}

	// 4. ดึง User ID ผู้บันทึก (เจ้าหน้าที่ลงทะเบียน)
	var regUser models.User
	db.Where("role = ?", "registrar").First(&regUser)
	regID := regUser.ID
	if regID == 0 {
		regID = 1
	}

	// 5. Seed สิทธิ์การรักษาเริ่มต้นให้ตรงกับผู้ป่วย
	defaultExp := time.Date(2026, 12, 31, 0, 0, 0, 0, time.UTC)
	for _, p := range basePatients {
		elig := models.MedicalEligibility{
			PatientID:       &p.ID,
			UserID:          &regID,
			SchemeType:      p.SchemeType,
			CoverageDetails: "ครอบคลุมการรักษาโรคทั่วไปตามสิทธิ์",
			HospitalName:    "โรงพยาบาลคลินิกเวชกรรมชุมชน",
			Status:          "ใช้งานได้",
			ExpireDate:      &defaultExp,
			VerifiedAt:      time.Now(),
		}
		db.Create(&elig)
	}

	// 6. Seed คิวตั้งต้นสำหรับระบบคัดกรอง 2 คิว (สถานะ: รอคัดกรอง)
	// เพื่อให้หน้าคัดกรอง (Screening/Vitals) มีผู้ป่วยพร้อมบันทึกสัญญาณชีพและส่งต่อให้แพทย์ได้ทันที
	baseQueues := []models.Queue{
		{
			PatientID:       basePatients[0].ID,
			CreatedByUserID: regID,
			QueueNumber:     "Q0001",
			Status:          "รอคัดกรอง",
			Department:      "จุดคัดกรอง",
			Note:            "รอวัดความดันโลหิตและสัญญาณชีพ",
		},
		{
			PatientID:       basePatients[1].ID,
			CreatedByUserID: regID,
			QueueNumber:     "Q0002",
			Status:          "รอคัดกรอง",
			Department:      "จุดคัดกรอง",
			Note:            "รอวัดความดันโลหิตและสัญญาณชีพ",
		},
	}
	for i := range baseQueues {
		db.Create(&baseQueues[i])
	}

	// 7. กระจายข่าวผ่าน WebSocket ให้ทุกหน้าจอรีเฟรชทันที
	ws.BroadcastEvent("QUEUE_UPDATED", gin.H{"action": "db_reset"})
	ws.BroadcastEvent("PATIENT_REGISTERED", gin.H{"action": "db_reset"})
	ws.BroadcastEvent("SYSTEM_RESET", gin.H{"action": "db_reset"})

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "ล้างข้อมูลทดสอบและสร้างข้อมูลตั้งต้นสำหรับคัดกรองเรียบร้อยแล้ว",
	})
}
