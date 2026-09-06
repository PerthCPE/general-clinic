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

	"github.com/gin-gonic/gin"
)

// ==============================================================================
// ระบบจัดการข้อมูลการรักษา - ส่วนค้นหาประวัติเวชระเบียน
// ==============================================================================
// GET /api/doctor/queue คืนเฉพาะคิวที่ยังเดินอยู่ กับคิวที่ปิดไปแล้ววันนี้
// เพราะแดชบอร์ดต้องนับตัวเลขของวันนี้ ผลข้างเคียงคือผู้ป่วยที่ตรวจจบไป
// เมื่อวานหรือก่อนหน้านั้นจะหายไปจากหน้าประวัติเวชระเบียนด้วย
//
// ไฟล์นี้จึงแยก endpoint สำหรับหน้าประวัติโดยเฉพาะ: ไม่จำกัดวัน ไม่จำกัดสถานะ
// ค้นได้จากชื่อ / HN / VN / เลขบัตรประชาชน / เบอร์โทร

// จำนวนผู้ป่วยสูงสุดที่คืนในครั้งเดียว
const (
	recordsDefaultLimit = 100
	recordsMaxLimit     = 300
)

// GetPatientRecords - GET /api/doctor/patients/records
//
// query param:
//
//	q     คำค้น (ชื่อ, HN, VN, เลขบัตรประชาชน, เบอร์โทร) เว้นว่างได้
//	limit จำนวนสูงสุดที่ต้องการ (ค่าเริ่มต้น 100 สูงสุด 300)
//
// คืนผู้ป่วย 1 แถวต่อ 1 คน โดยใช้ข้อมูลจากการมาตรวจ "ครั้งล่าสุด" ของคนนั้น
// รูปแบบเดียวกับ item ของ /queue เพื่อให้หน้าจอใช้ตัวแปลงชุดเดิมได้เลย
func GetPatientRecords(c *gin.Context) {
	doctorID := doctorAuthUserID(c)
	if doctorID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "ไม่พบข้อมูลผู้ใช้งานใน token"})
		return
	}

	keyword := strings.TrimSpace(c.Query("q"))

	limit := recordsDefaultLimit
	if raw := c.Query("limit"); raw != "" {
		if n, err := strconv.Atoi(raw); err == nil && n > 0 {
			limit = n
		}
	}
	if limit > recordsMaxLimit {
		limit = recordsMaxLimit
	}

	patients, err := findRecordPatients(keyword, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถค้นหาประวัติผู้ป่วยได้"})
		return
	}

	items := buildRecordItems(patients)

	c.JSON(http.StatusOK, dto.DoctorPatientRecordsResponse{
		Query: keyword,
		Total: len(items),
		Items: items,
	})
}

// findRecordPatients - หาผู้ป่วยที่ตรงกับคำค้น
//
// ถ้าไม่ใส่คำค้น จะคืนผู้ป่วยที่เคยมาตรวจแล้ว เรียงจากคนที่มาล่าสุด
// ถ้าใส่คำค้น จะค้นจากตาราง patients ก่อน แล้วรวมกับผู้ป่วยที่เลข VN ตรงกัน
func findRecordPatients(keyword string, limit int) ([]models.Patient, error) {
	if keyword == "" {
		return recentPatients(limit)
	}

	like := "%" + strings.ToLower(keyword) + "%"

	var patients []models.Patient
	err := config.DB.
		Where("LOWER(full_name) LIKE ?", like).
		Or("LOWER(hn) LIKE ?", like).
		Or("LOWER(national_id) LIKE ?", like).
		Or("LOWER(phone_number) LIKE ?", like).
		Order("id asc").
		Limit(limit).
		Find(&patients).Error

	if err != nil {
		return nil, err
	}

	// ค้นด้วยเลข VN ด้วย เพราะ VN อยู่ในตาราง visit_records ไม่ได้อยู่ใน patients
	var vnPatientIDs []uint
	if err := config.DB.Model(&models.VisitRecord{}).
		Where("LOWER(vn) LIKE ?", like).
		Distinct().
		Pluck("patient_id", &vnPatientIDs).Error; err != nil {
		return nil, err
	}

	if len(vnPatientIDs) > 0 {
		seen := make(map[uint]bool, len(patients))
		for _, p := range patients {
			seen[p.ID] = true
		}

		missing := make([]uint, 0, len(vnPatientIDs))
		for _, id := range vnPatientIDs {
			if !seen[id] {
				missing = append(missing, id)
			}
		}

		if len(missing) > 0 {
			var extra []models.Patient
			if err := config.DB.Where("id IN ?", missing).Find(&extra).Error; err == nil {
				patients = append(patients, extra...)
			}
		}
	}

	if len(patients) > limit {
		patients = patients[:limit]
	}

	return patients, nil
}

// recentPatients - ผู้ป่วยสำหรับหน้าประวัติ เรียงคนที่มาตรวจล่าสุดไว้บนสุด
//
// แฟ้มผู้ป่วยต้องมีตั้งแต่วันที่ลงทะเบียน ไม่ใช่รอให้ตรวจก่อน
// จึงเรียงเป็นสองชั้น
//  1. คนที่เคยมาตรวจ เรียงจากครั้งล่าสุด (ไล่จากตาราง visit_records)
//  2. คนที่เพิ่งลงทะเบียนแต่ยังไม่เคยเข้าตรวจ เรียงจากคนที่ลงทะเบียนล่าสุด
func recentPatients(limit int) ([]models.Patient, error) {
	var visits []models.VisitRecord
	if err := config.DB.
		Select("patient_id", "visit_date", "id").
		Order("visit_date desc").
		Limit(limit * 4). // เผื่อผู้ป่วยคนเดียวมาหลายครั้ง
		Find(&visits).Error; err != nil {
		return nil, err
	}

	orderedIDs := make([]uint, 0, len(visits))
	seen := make(map[uint]bool, len(visits))
	for _, v := range visits {
		if seen[v.PatientID] {
			continue
		}
		seen[v.PatientID] = true
		orderedIDs = append(orderedIDs, v.PatientID)
		if len(orderedIDs) >= limit {
			break
		}
	}

	sorted := make([]models.Patient, 0, limit)

	if len(orderedIDs) > 0 {
		var visited []models.Patient
		if err := config.DB.Where("id IN ?", orderedIDs).Find(&visited).Error; err != nil {
			return nil, err
		}

		// เรียงกลับให้ตรงลำดับที่หามาได้ (ฐานข้อมูลคืนมาเรียงตาม id)
		byID := make(map[uint]models.Patient, len(visited))
		for _, p := range visited {
			byID[p.ID] = p
		}
		for _, id := range orderedIDs {
			if p, ok := byID[id]; ok {
				sorted = append(sorted, p)
			}
		}
	}

	// เติมคนที่ลงทะเบียนไว้แล้วแต่ยังไม่เคยเข้าตรวจ ต่อท้ายรายการ
	if len(sorted) < limit {
		var fresh []models.Patient
		q := config.DB.Order("id desc").Limit(limit - len(sorted))
		if len(seen) > 0 {
			ids := make([]uint, 0, len(seen))
			for id := range seen {
				ids = append(ids, id)
			}
			q = q.Where("id NOT IN ?", ids)
		}

		if err := q.Find(&fresh).Error; err != nil {
			return nil, err
		}
		sorted = append(sorted, fresh...)
	}

	return sorted, nil
}

// ==============================================================================
// buildRecordItems - ประกอบข้อมูลผู้ป่วยทั้งหน้าให้เสร็จในไม่กี่ query
// ==============================================================================
// เดิมเป็น buildRecordItem() ที่ทำงานทีละคน ข้างในยิง query แยก 5-6 ชุด
//
//	นับจำนวนครั้งที่มาตรวจ / การมาตรวจล่าสุด / ชื่อแพทย์ / คิว / ผลคัดกรอง / การวินิจฉัย
//
// พอเรียกในลูป 200 คน จึงกลายเป็นมากกว่า 1,000 query ต่อการเปิดหน้าหนึ่งครั้ง
//
// วัดของจริงบน Supabase ได้ประมาณ 40 มิลลิวินาทีต่อ query
// (ไม่ได้ช้าเพราะ query หนัก แต่เพราะต้องวิ่งข้ามเน็ตไปกลับทุกครั้ง)
// 200 คน x 5 query x 40ms = ราว 40 วินาทีต่อการเปิดหน้าประวัติหนึ่งครั้ง
// ซึ่งตรงกับที่เห็นใน log จริง: GET /api/doctor/patient-records ใช้เวลา 38-40 วินาที
//
// เวอร์ชันนี้ดึงเป็นก้อนเดียวด้วย WHERE ... IN (?) แล้วค่อยจับคู่ในหน่วยความจำ
// จำนวน query คงที่ที่ 7 ชุด ไม่ว่าจะมีผู้ป่วยกี่คน (200 คนก็ 7 เท่าเดิม)
//
// ใช้ DISTINCT ON ของ PostgreSQL สำหรับ "เอาแถวล่าสุดของแต่ละกลุ่ม"
// เขียนเป็น raw SQL เพราะ GORM ไม่มี API ให้ ถ้าย้ายฐานข้อมูลไปตัวอื่นที่ไม่ใช่
// PostgreSQL ต้องเขียนส่วนนี้ใหม่ (ทั้งสองจุดมีคอมเมนต์กำกับไว้)
// ตารางกลุ่มนี้ไม่ได้ใช้ soft delete จึงข้าม GORM ไปเขียน SQL ตรงๆ ได้ ไม่มีแถวที่ถูกลบหลุดมา
// ==============================================================================
func buildRecordItems(patients []models.Patient) []dto.DoctorQueueItem {
	items := make([]dto.DoctorQueueItem, 0, len(patients))
	if len(patients) == 0 {
		return items
	}

	patientIDs := make([]uint, 0, len(patients))
	for _, p := range patients {
		patientIDs = append(patientIDs, p.ID)
	}

	// ---- 1. จำนวนครั้งที่เคยมาตรวจ ของทุกคนในคราวเดียว ----
	type visitCountRow struct {
		PatientID uint
		Total     int
	}
	var countRows []visitCountRow
	config.DB.Model(&models.VisitRecord{}).
		Select("patient_id, COUNT(*) AS total").
		Where("patient_id IN ?", patientIDs).
		Group("patient_id").
		Scan(&countRows)

	visitCountByPatient := make(map[uint]int, len(countRows))
	for _, r := range countRows {
		visitCountByPatient[r.PatientID] = r.Total
	}

	// ---- 2. การมาตรวจครั้งล่าสุดของแต่ละคน ----
	// DISTINCT ON (patient_id) + ORDER BY patient_id, visit_date DESC
	// = หยิบแถวแรกของแต่ละ patient_id หลังเรียงแล้ว (เฉพาะ PostgreSQL)
	var latestVisits []models.VisitRecord
	config.DB.Raw(`
		SELECT DISTINCT ON (patient_id) *
		FROM visit_records
		WHERE patient_id IN ?
		ORDER BY patient_id, visit_date DESC, id DESC
	`, patientIDs).Scan(&latestVisits)

	visitByPatient := make(map[uint]models.VisitRecord, len(latestVisits))
	visitIDs := make([]uint, 0, len(latestVisits))
	doctorIDSet := make(map[uint]bool)
	for i := range latestVisits {
		// เคสเก่าที่ยังไม่มีเลข VN เติมให้ด้วย จะได้ค้นหาด้วย VN เจอทุกคน
		// เขียนลงฐานข้อมูลเฉพาะแถวที่ยังว่าง ปกติจึงไม่มี query เพิ่มเลย
		ensureVN(&latestVisits[i])

		v := latestVisits[i]
		visitByPatient[v.PatientID] = v
		visitIDs = append(visitIDs, v.ID)
		if v.DoctorID > 0 {
			doctorIDSet[v.DoctorID] = true
		}
	}

	// ---- 3. ชื่อแพทย์เจ้าของเคส ----
	doctorNameByID := make(map[uint]string, len(doctorIDSet))
	if len(doctorIDSet) > 0 {
		doctorIDs := make([]uint, 0, len(doctorIDSet))
		for id := range doctorIDSet {
			doctorIDs = append(doctorIDs, id)
		}
		var docs []models.User
		config.DB.Where("id IN ?", doctorIDs).Find(&docs)
		for _, d := range docs {
			doctorNameByID[d.ID] = d.FullName
		}
	}

	queueByVisit := make(map[uint]models.Queue, len(visitIDs))
	screeningByVisit := make(map[uint]models.Screening, len(visitIDs))
	diagnosisByVisit := make(map[uint]models.Diagnosis, len(visitIDs))

	if len(visitIDs) > 0 {
		// ---- 4. คิวล่าสุดของแต่ละการมาตรวจ ----
		var queues []models.Queue
		config.DB.Raw(`
			SELECT DISTINCT ON (visit_id) *
			FROM queues
			WHERE visit_id IN ?
			ORDER BY visit_id, id DESC
		`, visitIDs).Scan(&queues)
		// Queue.VisitID เป็น *uint (คิวที่ยังไม่ผูกกับการมาตรวจจะเป็น nil)
		// ต้องเช็คก่อน deref ไม่งั้น panic ตอนเจอคิวที่ยังไม่มี visit
		for _, q := range queues {
			if q.VisitID != nil {
				queueByVisit[*q.VisitID] = q
			}
		}

		// ---- 5. ผลคัดกรองล่าสุดของแต่ละการมาตรวจ ----
		var screenings []models.Screening
		config.DB.Raw(`
			SELECT DISTINCT ON (visit_id) *
			FROM screenings
			WHERE visit_id IN ?
			ORDER BY visit_id, id DESC
		`, visitIDs).Scan(&screenings)

		// ---- 6. ชื่อพยาบาลผู้คัดกรอง ----
		// raw SQL ไม่ทำ Preload ให้ ต้องดึงเองอีกก้อน (ยังเป็นก้อนเดียวอยู่)
		nurseIDSet := make(map[uint]bool)
		for _, s := range screenings {
			if s.ScreenedByUserID > 0 {
				nurseIDSet[s.ScreenedByUserID] = true
			}
		}
		nurseByID := make(map[uint]models.User, len(nurseIDSet))
		if len(nurseIDSet) > 0 {
			nurseIDs := make([]uint, 0, len(nurseIDSet))
			for id := range nurseIDSet {
				nurseIDs = append(nurseIDs, id)
			}
			var nurses []models.User
			config.DB.Where("id IN ?", nurseIDs).Find(&nurses)
			for _, n := range nurses {
				nurseByID[n.ID] = n
			}
		}
		for i := range screenings {
			if n, ok := nurseByID[screenings[i].ScreenedByUserID]; ok {
				screenings[i].ScreenedBy = n
			}
			screeningByVisit[screenings[i].VisitID] = screenings[i]
		}

		// ---- 7. การวินิจฉัยหลักของแต่ละการมาตรวจ ----
		var diagnoses []models.Diagnosis
		config.DB.Where("visit_id IN ? AND is_primary = ?", visitIDs, true).
			Order("id asc").
			Find(&diagnoses)
		for _, d := range diagnoses {
			if _, exists := diagnosisByVisit[d.VisitID]; !exists {
				diagnosisByVisit[d.VisitID] = d
			}
		}
	}

	// ---- ประกอบผลลัพธ์จากข้อมูลในหน่วยความจำ ไม่มี query เพิ่มอีกแล้ว ----
	for _, p := range patients {
		item := dto.DoctorQueueItem{
			// ใช้ p- นำหน้าเพื่อไม่ให้ id ชนกับ q- ที่มาจากหน้าคิว
			ID:         fmt.Sprintf("p-%d", p.ID),
			Status:     models.VisitStatusCompleted,
			Patient:    toPatientBrief(p),
			VisitCount: visitCountByPatient[p.ID],
		}

		visit, hasVisit := visitByPatient[p.ID]
		if !hasVisit {
			// ยังไม่เคยมาตรวจ - คืนเฉพาะข้อมูลผู้ป่วย รอวันที่เข้ามาตรวจครั้งแรก
			item.Status = models.VisitStatusWaiting
			items = append(items, item)
			continue
		}

		visitDate, visitTime := splitVisitDateTime(visit.VisitDate)

		item.VisitID = visit.ID
		item.VN = visit.VN
		item.VisitDate = visitDate
		item.VisitTime = visitTime
		item.Department = visit.Department
		item.QueuedAt = visit.VisitDate
		item.Status = normalizeVisitStatus(visit.Status)
		item.AssignedDoctorID = visit.DoctorID
		item.AssignedDoctorName = doctorNameByID[visit.DoctorID]

		queue, hasQueue := queueByVisit[visit.ID]
		if hasQueue {
			item.QueueID = queue.ID
			item.QueueNumber = queue.QueueNumber
			item.QueueStatus = queue.Status
			item.Note = queue.Note
			item.QueuedAt = queue.CreatedAt
		}

		screening, hasScreening := screeningByVisit[visit.ID]
		if hasScreening {
			brief := toScreeningBrief(screening)
			item.Screening = &brief
		}

		// เวลารอ นับจากคัดกรองเสร็จ ถึงเวลาที่แพทย์เรียกเข้าตรวจ
		// ใช้เกณฑ์เดียวกับหน้าคิว (ดู waitingMinutesSince ใน doctor_controller.go)
		// ถ้าครั้งนั้นไม่มีผลคัดกรอง ให้ถอยไปนับจากเวลาที่ออกคิวแทน
		if hasQueue || hasScreening {
			waitFrom := queue.CreatedAt
			if hasScreening && !screening.CreatedAt.IsZero() {
				waitFrom = screening.CreatedAt
			}

			var calledAt *time.Time
			if hasQueue {
				calledAt = queue.CalledAt
			}
			item.WaitingMinutes = waitingMinutesSince(waitFrom, calledAt)
		}

		// การวินิจฉัยหลักของครั้งนั้น ใช้โชว์บนการ์ดในหน้าประวัติ
		if d, ok := diagnosisByVisit[visit.ID]; ok {
			item.Diagnosis = d.NameTH
			if item.Diagnosis == "" {
				item.Diagnosis = d.NameEN
			}
			item.ICDCode = d.ICDCode
		}

		items = append(items, item)
	}

	return items
}
