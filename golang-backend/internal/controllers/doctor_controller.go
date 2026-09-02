package controllers

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"clinic-backend/internal/config"
	"clinic-backend/internal/dto"
	"clinic-backend/internal/models"
	"clinic-backend/internal/ws"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ==============================================================================
// Doctor Module Controller
// ==============================================================================
// endpoint ทั้งหมดในไฟล์นี้อยู่ใต้ /api/doctor และผ่าน RoleRequired("doctor")
//
// หมายเหตุเรื่องการเชื่อมข้อมูล:
// ระบบเดิม queues ผูกกับ patient_id ส่วน screenings ผูกกับ visit_id ทำให้
// จากคิวหาการคัดกรองไม่เจอ ไฟล์นี้จึงมี resolveVisitForQueue() ที่หา visit
// ของคิวนั้นให้ แล้วเติม visit_id กลับลงในแถวคิวเพื่อให้ครั้งต่อไปหาได้ทันที
// (เขียนไว้ฝั่งแพทย์ทั้งหมด ไม่ต้องแก้โค้ดของ registrar และ nurse)
//
// หมายเหตุเรื่องรูปแบบข้อมูล:
// ค่าที่ส่งออกจากไฟล์นี้จัดรูปแบบให้ตรงกับ types.ts ของหน้าจอแพทย์แล้ว
// ทั้งชุดค่า status, เลข VN, ความดันแบบ "120/80" และระดับ triage แบบ Level 1-5
// เพื่อให้ฝั่ง React เอาไปใช้ได้เลยโดยไม่ต้องเขียนตัวแปลงเพิ่ม

// สถานะคิว (ภาษาไทย) ชุดเดิมของระบบ
const (
	queueStatusScreening     = "รอคัดกรอง"
	queueStatusWaitingDoctor = "รอพบแพทย์"
	queueStatusExamining     = "กำลังตรวจ"
	queueStatusWaitingMed    = "รอรับยา"
	queueStatusWaitingPay    = "รอชำระเงิน"
	queueStatusDone          = "เสร็จสิ้น"
	queueStatusCancelled     = "ยกเลิกคิว"
)

// doctorAuthUserID - ดึง user id ของแพทย์ที่ล็อกอินอยู่จาก JWT context
func doctorAuthUserID(c *gin.Context) uint {
	val, exists := c.Get("userID")
	if !exists {
		return 0
	}
	switch id := val.(type) {
	case float64:
		return uint(id)
	case uint:
		return id
	case int:
		return uint(id)
	}
	return 0
}

// startOfToday - เที่ยงคืนของวันนี้ตามเวลาเครื่อง (ไม่ใช้ Truncate เพราะ
// Truncate ตัดจากเวลา UTC ทำให้เขต Asia/Bangkok ได้ 07:00 ของวันนั้นแทน)
func startOfToday() time.Time {
	now := time.Now()
	return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
}

// calcAge - คำนวณอายุเป็นปีจากวันเกิด
func calcAge(birth time.Time) int {
	if birth.IsZero() {
		return 0
	}
	now := time.Now()
	age := now.Year() - birth.Year()
	if now.YearDay() < birth.YearDay() {
		age--
	}
	if age < 0 {
		return 0
	}
	return age
}

// normalizeVisitStatus - แปลงค่า status ที่รับเข้ามาให้เป็นชุดค่าของ types.ts
//
// รับได้ทั้ง "examining" แบบพิมพ์เล็ก (ค่าที่เคยใช้ตอนเฟส 1 และแถวเก่าใน DB)
// และ "Examining" แบบที่ frontend ใช้ คืนค่าว่างถ้าไม่รู้จัก
func normalizeVisitStatus(s string) string {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "waiting":
		return models.VisitStatusWaiting
	case "screened":
		return models.VisitStatusScreened
	case "examining":
		return models.VisitStatusExamining
	case "pending pharmacy", "pending_pharmacy":
		return models.VisitStatusPendingPharmacy
	case "completed":
		return models.VisitStatusCompleted
	case "cancelled", "canceled":
		return models.VisitStatusCancelled
	}
	return ""
}

// queueStatusToFrontend - แปลงสถานะคิวภาษาไทยเป็นชุดค่าของ types.ts
// ใช้เป็นตัวสำรองเมื่อแถว visit ยังไม่มี status
func queueStatusToFrontend(thai string) string {
	switch strings.TrimSpace(thai) {
	case queueStatusExamining:
		return models.VisitStatusExamining
	case queueStatusWaitingMed, queueStatusWaitingPay:
		return models.VisitStatusPendingPharmacy
	case queueStatusDone:
		return models.VisitStatusCompleted
	case queueStatusCancelled:
		return models.VisitStatusCancelled
	}
	return models.VisitStatusWaiting
}

// visitStatusToQueueStatus - แปลงกลับเป็นสถานะคิวภาษาไทยของระบบเดิม
func visitStatusToQueueStatus(status string) string {
	switch status {
	case models.VisitStatusExamining:
		return queueStatusExamining
	case models.VisitStatusPendingPharmacy, models.VisitStatusCompleted:
		// แพทย์ตรวจจบแล้ว คิวเดินต่อไปที่ห้องยา
		return queueStatusWaitingMed
	case models.VisitStatusCancelled:
		return queueStatusCancelled
	case models.VisitStatusScreened, models.VisitStatusWaiting:
		return queueStatusWaitingDoctor
	}
	return queueStatusWaitingDoctor
}

// triageInfo - แปลงระดับ triage ภาษาไทยของพยาบาล เป็นรูปแบบ Level 1-5
// ที่ ExaminationView ใช้ พร้อมระดับความสำคัญ
func triageInfo(thai string) (code string, priority string) {
	t := strings.TrimSpace(thai)
	switch {
	case t == "":
		return "", ""
	case strings.Contains(t, "วิกฤต"), strings.Contains(t, "Resuscitation"):
		return "Level 1: Resuscitation", "High"
	case strings.Contains(t, "ฉุกเฉิน"), strings.Contains(t, "Emergency"):
		return "Level 2: Emergency", "High"
	case strings.Contains(t, "เร่งด่วน"), strings.Contains(t, "Urgent"):
		return "Level 3: Urgent", "Medium"
	case strings.Contains(t, "ปกติ"), strings.Contains(t, "Normal"):
		return "Level 5: Non-Urgent", "Low"
	}
	return "Level 4: Less Urgent", "Low"
}

// formatBP - รวมความดันเป็นสตริงเดียว "120/80" ตามที่ vitals.bp ต้องการ
func formatBP(systolic, diastolic int) string {
	if systolic <= 0 && diastolic <= 0 {
		return ""
	}
	return fmt.Sprintf("%d/%d", systolic, diastolic)
}

// splitVisitDateTime - แยกวันกับเวลาให้ตรงรูปแบบที่หน้าจอแพทย์ใช้
// visitDate = 2026-08-28, visitTime = 02:04 PM
//
// ต้องเรียก .Local() ก่อนเสมอ เพราะ pgx อ่านค่า timestamp กลับมาเป็น UTC
// ถ้าฟอร์แมตตรงๆ จะได้เวลาเร็วไป 7 ชั่วโมง และเคสที่มาตรวจช่วงเที่ยงคืน
// ถึงตี 7 จะได้วันที่ย้อนไปหนึ่งวัน ทำให้หายจากคิวของวันนั้น
func splitVisitDateTime(t time.Time) (string, string) {
	if t.IsZero() {
		return "", ""
	}
	local := t.Local()
	return local.Format("2006-01-02"), local.Format("03:04 PM")
}

// toPatientBrief - แปลง model ผู้ป่วยเป็นรูปแบบที่หน้าจอแพทย์ใช้
func toPatientBrief(p models.Patient) dto.PatientBrief {
	return dto.PatientBrief{
		ID:              p.ID,
		HN:              p.HN,
		NationalID:      p.NationalID,
		FullName:        p.FullName,
		Gender:          p.Gender,
		BirthDate:       p.BirthDate,
		Age:             calcAge(p.BirthDate),
		PhoneNumber:     p.PhoneNumber,
		SchemeType:      p.SchemeType,
		Allergies:       p.Allergies,
		ChronicDiseases: p.ChronicDiseases,
	}
}

// toScreeningBrief - แปลงผลคัดกรองเป็นรูปแบบที่หน้าจอแพทย์ใช้
func toScreeningBrief(s models.Screening) dto.ScreeningBrief {
	code, priority := triageInfo(s.TriageLevel)

	return dto.ScreeningBrief{
		ID:              s.ID,
		ChiefComplaint:  s.ChiefComplaint,
		Allergies:       s.Allergies,
		MedicalHistory:  s.MedicalHistory,
		NurseNotes:      s.NurseNotes,
		TriageLevel:     s.TriageLevel,
		TriageCode:      code,
		TriagePriority:  priority,
		BP:              formatBP(s.SystolicBP, s.DiastolicBP),
		SystolicBP:      s.SystolicBP,
		DiastolicBP:     s.DiastolicBP,
		Weight:          s.Weight,
		Height:          s.Height,
		BMI:             s.BMI,
		Temperature:     s.Temperature,
		HeartRate:       s.HeartRate,
		RespiratoryRate: s.RespiratoryRate,
		SpO2:            s.SpO2,
		ScreenedByName:  s.ScreenedBy.FullName,
		ScreenedAt:      s.CreatedAt,
	}
}

// generateVN - ออกเลข Visit Number ด้วยสูตรเดียวกับ utils/vnGenerator.ts
//
// ปีพุทธศักราช 2 หลักท้าย + เดือน + วัน + เวลา HHmm + ลำดับที่ของวันนั้น
// เช่น 28 ส.ค. 2026 เวลา 12:55 คิวที่ 1 -> 6982812551
func generateVN(tx *gorm.DB) string {
	return generateVNAt(tx, time.Now())
}

// generateVNAt - ออกเลข VN โดยอิงเวลาที่กำหนด
//
// แยกออกมาเพราะการออกเลขย้อนหลังให้เคสที่มาตรวจไปแล้ว ควรใช้เวลาที่ผู้ป่วย
// มาจริง ไม่ใช่เวลาที่ระบบเพิ่งมาเติมเลขให้ ไม่งั้นเลข VN จะสื่อเวลาผิด
func generateVNAt(tx *gorm.DB, at time.Time) string {
	local := at.Local()
	if local.IsZero() {
		local = time.Now()
	}

	beYear := local.Year() + 543
	shortYear := strconv.Itoa(beYear)
	if len(shortYear) > 2 {
		shortYear = shortYear[len(shortYear)-2:]
	}

	// นับเฉพาะเลขที่ออกไปแล้วใน "วันเดียวกับเคสนี้" ไม่ใช่ของวันนี้เสมอไป
	// เพราะการเติมเลขย้อนหลังให้เคสเก่า ต้องได้ลำดับที่ไม่ชนกันเองในวันนั้น
	dayStart := time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, local.Location())
	dayEnd := dayStart.AddDate(0, 0, 1)

	var issuedThatDay int64
	tx.Model(&models.VisitRecord{}).
		Where("vn <> '' AND vn IS NOT NULL AND visit_date >= ? AND visit_date < ?", dayStart, dayEnd).
		Count(&issuedThatDay)

	return fmt.Sprintf("%s%d%d%s%d",
		shortYear,
		int(local.Month()),
		local.Day(),
		local.Format("1504"),
		issuedThatDay+1,
	)
}

// ensureVN - เติมเลข VN ให้การมาตรวจที่ยังไม่มี แล้วบันทึกลงฐานข้อมูล
//
// เดิมเลข VN ออกตอนแพทย์กดเรียกตรวจเท่านั้น ผู้ป่วยที่ยังรอตรวจจึงไม่มีเลข
// ทำให้ค้นหาด้วย VN ไม่เจอ และหน้าจอต้องแสดงขีดแทน
//
// จุดที่ถูกต้องจริงๆ ในระยะยาวคือออกเลขตั้งแต่ตอนเปิด visit ซึ่งอยู่ใน
// vitals_controller.go (ขั้นตอนคัดกรองของพยาบาล) แต่นั่นเป็นไฟล์ของเพื่อน
// ร่วมทีม จึงเติมจากฝั่งแพทย์ไปก่อนตอนดึงคิว โดยเติมเฉพาะเคสที่ยังว่าง
// ถ้าภายหลังฝั่งพยาบาลออกเลขให้ตั้งแต่ต้น โค้ดนี้จะไม่ไปทับของเดิม
func ensureVN(visit *models.VisitRecord) {
	if visit == nil || strings.TrimSpace(visit.VN) != "" {
		return
	}

	stamp := visit.VisitDate
	if stamp.IsZero() {
		stamp = visit.CreatedAt
	}

	vn := generateVNAt(config.DB, stamp)
	if err := config.DB.Model(&models.VisitRecord{}).
		Where("id = ?", visit.ID).
		Update("vn", vn).Error; err != nil {
		return
	}

	visit.VN = vn
}

// applyVisitStatusTx - เปลี่ยนสถานะของการมาตรวจ พร้อมขยับคิวให้สอดคล้องกัน
//
// แยกออกมาเป็นฟังก์ชันกลางเพราะมีสองทางที่ทำให้สถานะเปลี่ยน
// คือแพทย์กดปุ่มบนหน้าคิว (UpdateVisitStatus) และแพทย์เซ็นปิดการตรวจ
// (SaveExamination) ทั้งสองทางต้องอัปเดต visit และ queue แบบเดียวกันเป๊ะ
//
// คืนค่าแถวคิวที่ถูกแก้ และ flag ว่าเจอคิวหรือไม่ (บางเคสเปิดย้อนหลังจะไม่มีคิว)
func applyVisitStatusTx(tx *gorm.DB, visit *models.VisitRecord, newStatus string,
	doctorID uint, note string, now time.Time) (models.Queue, bool, error) {

	visit.Status = newStatus
	visit.DoctorID = doctorID

	if newStatus == models.VisitStatusExamining {
		if visit.StartedAt == nil {
			visit.StartedAt = &now
		}
		if strings.TrimSpace(visit.VN) == "" {
			visit.VN = generateVN(tx)
		}
	}

	if newStatus == models.VisitStatusCompleted || newStatus == models.VisitStatusPendingPharmacy {
		visit.EndedAt = &now
	}

	if err := tx.Save(visit).Error; err != nil {
		return models.Queue{}, false, err
	}

	// หาแถวคิวที่คู่กับ visit นี้
	var queue models.Queue
	qErr := tx.Where("visit_id = ?", visit.ID).Order("id desc").First(&queue).Error
	if qErr != nil {
		qErr = tx.Where("patient_id = ? AND status IN ?", visit.PatientID,
			[]string{queueStatusWaitingDoctor, queueStatusExamining}).
			Order("id desc").First(&queue).Error
	}
	if qErr != nil {
		return models.Queue{}, false, nil
	}

	queue.Status = visitStatusToQueueStatus(newStatus)
	queue.VisitID = &visit.ID
	queue.AssignedDoctorID = &doctorID

	if newStatus == models.VisitStatusExamining && queue.CalledAt == nil {
		queue.CalledAt = &now
	}
	if strings.TrimSpace(note) != "" {
		queue.Note = note
	}

	if err := tx.Save(&queue).Error; err != nil {
		return models.Queue{}, false, err
	}

	return queue, true, nil
}

// resolveVisitForQueue - หา visit ของคิวหนึ่งใบ
//
// ลำดับการหา: ใช้ queue.visit_id ก่อน ถ้ายังว่างค่อยหา visit ล่าสุดของผู้ป่วย
// คนนั้นในวันเดียวกัน (ซึ่งเป็นแถวที่พยาบาลสร้างตอนคัดกรอง) แล้วเติมกลับลงคิว
func resolveVisitForQueue(q *models.Queue) *models.VisitRecord {
	var visit models.VisitRecord

	if q.VisitID != nil && *q.VisitID > 0 {
		if err := config.DB.First(&visit, *q.VisitID).Error; err == nil {
			ensureVN(&visit)
			return &visit
		}
	}

	err := config.DB.Where("patient_id = ? AND visit_date >= ?", q.PatientID, startOfToday()).
		Order("id desc").
		First(&visit).Error

	if err != nil {
		return nil
	}

	// เติม visit_id กลับลงในคิว เพื่อให้ครั้งหน้าไม่ต้องเดาอีก
	visitID := visit.ID
	config.DB.Model(&models.Queue{}).Where("id = ?", q.ID).Update("visit_id", visitID)
	q.VisitID = &visitID

	ensureVN(&visit)

	return &visit
}

// GetDoctorQueue - GET /api/doctor/queue
//
// คืนคิวของวันนี้ทั้งหมด พร้อมผลคัดกรองของแต่ละคิวในชุดเดียว
// รวมเคสที่ตรวจจบไปแล้วด้วย เพราะแดชบอร์ดนับการ์ด "ผู้ป่วยวันนี้" และ
// "ตรวจเสร็จแล้ว" จาก array ชุดเดียวกันนี้
//
// query param: ?scope=all เพื่อดูคิวของแพทย์ทุกคน (ค่าเริ่มต้นคือเฉพาะของตัวเอง)
func GetDoctorQueue(c *gin.Context) {
	doctorID := doctorAuthUserID(c)
	if doctorID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "ไม่พบข้อมูลผู้ใช้งานใน token"})
		return
	}

	var me models.User
	if err := config.DB.First(&me, doctorID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบข้อมูลแพทย์ผู้ใช้งาน"})
		return
	}

	showAll := strings.EqualFold(c.Query("scope"), "all")

	// คิวที่ยังเดินอยู่ดึงมาทั้งหมดไม่จำกัดวัน (กันคิวค้างข้ามวันหาย)
	// ส่วนคิวที่จบแล้วเอาเฉพาะของวันนี้ ไว้ให้แดชบอร์ดนับ
	activeStatuses := []string{queueStatusWaitingDoctor, queueStatusExamining}
	finishedStatuses := []string{queueStatusWaitingMed, queueStatusWaitingPay, queueStatusDone}

	var queues []models.Queue
	err := config.DB.Preload("Patient").
		Where("status IN ?", activeStatuses).
		Or("status IN ? AND created_at >= ?", finishedStatuses, startOfToday()).
		Order("created_at asc").
		Find(&queues).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถดึงคิวผู้ป่วยได้"})
		return
	}

	items := make([]dto.DoctorQueueItem, 0, len(queues))
	totalWait := 0
	waitingCount := 0
	examiningCount := 0
	completedCount := 0

	for i := range queues {
		q := &queues[i]

		visit := resolveVisitForQueue(q)

		var screening models.Screening
		hasScreening := false
		if visit != nil {
			if err := config.DB.Preload("ScreenedBy").
				Where("visit_id = ?", visit.ID).
				Order("id desc").
				First(&screening).Error; err == nil {
				hasScreening = true
			}
		}

		// หาว่าคิวนี้เป็นของแพทย์คนไหน ไล่จากที่เจาะจงที่สุดก่อน
		assignedID := uint(0)
		if q.AssignedDoctorID != nil {
			assignedID = *q.AssignedDoctorID
		}
		if assignedID == 0 && hasScreening {
			assignedID = screening.AssignedDoctorID
		}
		if assignedID == 0 && visit != nil {
			assignedID = visit.DoctorID
		}

		// เติม assigned_doctor_id กลับลงในคิว ถ้ายังว่างอยู่
		if q.AssignedDoctorID == nil && assignedID > 0 {
			config.DB.Model(&models.Queue{}).Where("id = ?", q.ID).Update("assigned_doctor_id", assignedID)
			q.AssignedDoctorID = &assignedID
		}

		// คิวที่ยังไม่ระบุแพทย์ ให้แสดงกับทุกคน จะได้ไม่มีคิวตกหล่น
		if !showAll && assignedID > 0 && assignedID != doctorID {
			continue
		}

		assignedName := ""
		if assignedID == doctorID {
			assignedName = me.FullName
		} else if assignedID > 0 {
			var doc models.User
			if err := config.DB.First(&doc, assignedID).Error; err == nil {
				assignedName = doc.FullName
			}
		}

		// เวลารอ: ถ้าถูกเรียกแล้วนับถึงเวลาที่เรียก ถ้ายังไม่ถูกเรียกนับถึงตอนนี้
		endTime := time.Now()
		if q.CalledAt != nil {
			endTime = *q.CalledAt
		}
		waitMinutes := int(endTime.Sub(q.CreatedAt).Minutes())
		if waitMinutes < 0 {
			waitMinutes = 0
		}

		// สถานะที่หน้าจออ่าน เอาจาก visit ก่อน ถ้าไม่มีค่อยแปลงจากสถานะคิว
		status := ""
		if visit != nil {
			status = normalizeVisitStatus(visit.Status)
		}
		if status == "" {
			status = queueStatusToFrontend(q.Status)
		}

		// วันและเวลาที่มาตรวจ ใช้ของ visit ก่อน ถ้าไม่มีใช้เวลาที่ออกคิว
		stamp := q.CreatedAt
		if visit != nil && !visit.VisitDate.IsZero() {
			stamp = visit.VisitDate
		}
		visitDate, visitTime := splitVisitDateTime(stamp)

		item := dto.DoctorQueueItem{
			ID:                 fmt.Sprintf("q-%d", q.ID),
			Status:             status,
			QueueID:            q.ID,
			QueueNumber:        q.QueueNumber,
			QueueStatus:        q.Status,
			Department:         q.Department,
			Note:               q.Note,
			QueuedAt:           q.CreatedAt,
			VisitDate:          visitDate,
			VisitTime:          visitTime,
			WaitingMinutes:     waitMinutes,
			AssignedDoctorID:   assignedID,
			AssignedDoctorName: assignedName,
			Patient:            toPatientBrief(q.Patient),
		}

		if visit != nil {
			item.VisitID = visit.ID
			item.VN = visit.VN
			// คิวที่เดินอยู่ย่อมมีการมาตรวจแล้วอย่างน้อยหนึ่งครั้ง
			// ใส่ค่านี้ให้ตรงกันกับหน้าประวัติ จะได้ไม่ขึ้นป้าย "ผู้ป่วยใหม่" ผิด
			item.VisitCount = 1
		}

		if hasScreening {
			brief := toScreeningBrief(screening)
			item.Screening = &brief
		}

		switch status {
		case models.VisitStatusExamining:
			examiningCount++
		case models.VisitStatusCompleted, models.VisitStatusPendingPharmacy:
			completedCount++
		default:
			waitingCount++
			totalWait += waitMinutes
		}

		items = append(items, item)
	}

	avgWait := 0
	if waitingCount > 0 {
		avgWait = totalWait / waitingCount
	}

	c.JSON(http.StatusOK, dto.DoctorQueueResponse{
		DoctorID:   doctorID,
		DoctorName: me.FullName,
		Summary: dto.DoctorQueueStats{
			TotalToday:     len(items),
			Waiting:        waitingCount,
			Examining:      examiningCount,
			CompletedToday: completedCount,
			AvgWaitMinutes: avgWait,
		},
		Items: items,
	})
}

// GetDoctorVisitDetail - GET /api/doctor/visits/:id
//
// ข้อมูลชุดเต็มสำหรับเปิดหน้าตรวจหนึ่งเคส
func GetDoctorVisitDetail(c *gin.Context) {
	visitID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รหัสการเข้ารับบริการไม่ถูกต้อง"})
		return
	}

	var visit models.VisitRecord
	if err := config.DB.Preload("Patient").Preload("Doctor").
		First(&visit, uint(visitID)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบข้อมูลการเข้ารับบริการนี้"})
		return
	}

	visitDate, visitTime := splitVisitDateTime(visit.VisitDate)

	status := normalizeVisitStatus(visit.Status)
	if status == "" {
		status = models.VisitStatusWaiting
	}

	detail := dto.DoctorVisitDetail{
		Status:     status,
		VisitID:    visit.ID,
		VN:         visit.VN,
		VisitDate:  visitDate,
		VisitTime:  visitTime,
		VisitAt:    visit.VisitDate,
		VisitType:  visit.VisitType,
		Department: visit.Department,
		StartedAt:  visit.StartedAt,
		EndedAt:    visit.EndedAt,
		DoctorID:   visit.DoctorID,
		DoctorName: visit.Doctor.FullName,
		Patient:    toPatientBrief(visit.Patient),
	}

	// ผลคัดกรองของ visit นี้
	var screening models.Screening
	if err := config.DB.Preload("ScreenedBy").
		Where("visit_id = ?", visit.ID).
		Order("id desc").
		First(&screening).Error; err == nil {
		brief := toScreeningBrief(screening)
		detail.Screening = &brief
	}

	// คิวที่ผูกกับ visit นี้ (ถ้ายังไม่ผูก ให้หาคิวที่ยังไม่ปิดของผู้ป่วยคนนี้)
	var queue models.Queue
	queueErr := config.DB.Where("visit_id = ?", visit.ID).Order("id desc").First(&queue).Error
	if queueErr != nil {
		queueErr = config.DB.Where("patient_id = ? AND status IN ?", visit.PatientID,
			[]string{queueStatusScreening, queueStatusWaitingDoctor, queueStatusExamining}).
			Order("id desc").First(&queue).Error
	}
	if queueErr == nil {
		detail.ID = fmt.Sprintf("q-%d", queue.ID)
		detail.QueueID = queue.ID
		detail.QueueNumber = queue.QueueNumber
		detail.QueueStatus = queue.Status
	} else {
		// ไม่เจอคิว (เช่นเปิดดูเคสย้อนหลัง) ใช้ visit เป็นตัวระบุแทน
		detail.ID = fmt.Sprintf("v-%d", visit.ID)
	}

	// สิทธิ์การรักษาล่าสุดของผู้ป่วย
	var eligibility models.MedicalEligibility
	if err := config.DB.Where("patient_id = ?", visit.PatientID).
		Order("id desc").First(&eligibility).Error; err == nil {
		detail.Eligibility = &dto.EligibilityBrief{
			SchemeType:      eligibility.SchemeType,
			CoverageDetails: eligibility.CoverageDetails,
			HospitalName:    eligibility.HospitalName,
			Status:          eligibility.Status,
			ExpireDate:      eligibility.ExpireDate,
		}
	}

	c.JSON(http.StatusOK, detail)
}

// UpdateVisitStatus - PUT /api/doctor/visits/:id/status
//
// เรียกเข้าตรวจ / พักคิวกลับไปรอ / ปิดการตรวจ
// รับ status เป็นชุดค่าเดียวกับ types.ts (Waiting, Examining, Pending Pharmacy,
// Completed, Cancelled) อัปเดตทั้ง visit และ queue ในทรานแซกชันเดียว
// แล้ว broadcast ให้ทุกเครื่อง
func UpdateVisitStatus(c *gin.Context) {
	doctorID := doctorAuthUserID(c)
	if doctorID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "ไม่พบข้อมูลผู้ใช้งานใน token"})
		return
	}

	visitID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รหัสการเข้ารับบริการไม่ถูกต้อง"})
		return
	}

	var req dto.UpdateVisitStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "กรุณาระบุสถานะที่ต้องการเปลี่ยน"})
		return
	}

	newStatus := normalizeVisitStatus(req.Status)
	if newStatus == "" || newStatus == models.VisitStatusScreened {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "สถานะไม่ถูกต้อง ใช้ได้เฉพาะ Waiting, Examining, Pending Pharmacy, Completed, Cancelled",
		})
		return
	}

	var visit models.VisitRecord
	if err := config.DB.First(&visit, uint(visitID)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบข้อมูลการเข้ารับบริการนี้"})
		return
	}

	// กันแพทย์คนอื่นแก้เคสที่ไม่ใช่ของตัวเอง (เคสที่ยังไม่ระบุแพทย์เปิดให้รับได้)
	if visit.DoctorID != 0 && visit.DoctorID != doctorID {
		c.JSON(http.StatusForbidden, gin.H{"error": "เคสนี้อยู่ในความดูแลของแพทย์ท่านอื่น"})
		return
	}

	var updatedQueue models.Queue
	hasQueue := false
	now := time.Now()

	txErr := config.DB.Transaction(func(tx *gorm.DB) error {
		q, ok, err := applyVisitStatusTx(tx, &visit, newStatus, doctorID, req.Note, now)
		if err != nil {
			return err
		}
		updatedQueue, hasQueue = q, ok
		return nil
	})

	if txErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถอัปเดตสถานะการตรวจได้"})
		return
	}

	// แจ้งทุกเครื่องแบบ real-time ผ่าน hub เดิมของระบบ
	ws.BroadcastEvent("VISIT_UPDATED", visit)
	if hasQueue {
		config.DB.Preload("Patient").First(&updatedQueue, updatedQueue.ID)
		ws.BroadcastEvent("QUEUE_UPDATED", updatedQueue)
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "อัปเดตสถานะการตรวจเรียบร้อยแล้ว",
		"status":  newStatus,
		"vn":      visit.VN,
		"visit":   visit,
	})
}

// GetMyDoctorProfile - GET /api/doctor/me
//
// โปรไฟล์ของแพทย์ที่ล็อกอินอยู่ ใช้แสดงหัวข้อบนแดชบอร์ดและหน้าตารางเวร
func GetMyDoctorProfile(c *gin.Context) {
	doctorID := doctorAuthUserID(c)
	if doctorID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "ไม่พบข้อมูลผู้ใช้งานใน token"})
		return
	}

	var user models.User
	if err := config.DB.First(&user, doctorID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบข้อมูลผู้ใช้งาน"})
		return
	}

	var profile models.Doctor
	hasProfile := config.DB.Where("user_id = ?", doctorID).First(&profile).Error == nil

	res := gin.H{
		"user_id":  user.ID,
		"username": user.Username,
		"fullname": user.FullName,
		"phone":    user.Phone,
		"role":     user.Role,
	}

	if hasProfile {
		// เพื่อนร่วมทีมเปลี่ยนชื่อ primary key ของตาราง doctors จาก DoctorID เป็น ID
		// คีย์ที่ส่งออกยังเป็น doctor_id เหมือนเดิม เพื่อไม่ให้ฝั่งหน้าจอต้องแก้ตาม
		res["doctor_id"] = profile.ID
		res["license_number"] = profile.LicenseNumber
		res["specialty"] = profile.Specialty
		res["room"] = profile.Room
		res["email"] = profile.Email
		res["is_active"] = profile.IsActive
	}

	c.JSON(http.StatusOK, res)
}
