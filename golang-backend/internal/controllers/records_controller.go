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

	items := make([]dto.DoctorQueueItem, 0, len(patients))
	for i := range patients {
		items = append(items, buildRecordItem(patients[i]))
	}

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

// buildRecordItem - ประกอบข้อมูลผู้ป่วย 1 คน ให้อยู่ในรูปเดียวกับ item ของคิว
//
// ดึงการมาตรวจครั้งล่าสุดของผู้ป่วยคนนั้น พร้อมผลคัดกรอง คิว และการวินิจฉัยหลัก
// ถ้าผู้ป่วยยังไม่เคยมาตรวจเลย จะคืนเฉพาะข้อมูลส่วนตัว
func buildRecordItem(p models.Patient) dto.DoctorQueueItem {
	item := dto.DoctorQueueItem{
		// ใช้ p- นำหน้าเพื่อไม่ให้ id ชนกับ q- ที่มาจากหน้าคิว
		ID:      fmt.Sprintf("p-%d", p.ID),
		Status:  models.VisitStatusCompleted,
		Patient: toPatientBrief(p),
	}

	// นับว่าเคยมาตรวจกี่ครั้ง หน้าจอใช้แยกว่าเป็นผู้ป่วยใหม่หรือมีประวัติแล้ว
	var visitCount int64
	config.DB.Model(&models.VisitRecord{}).Where("patient_id = ?", p.ID).Count(&visitCount)
	item.VisitCount = int(visitCount)

	var visit models.VisitRecord
	if err := config.DB.Where("patient_id = ?", p.ID).
		Order("visit_date desc").
		First(&visit).Error; err != nil {
		// ยังไม่เคยมาตรวจ - คืนเฉพาะข้อมูลผู้ป่วย รอวันที่เข้ามาตรวจครั้งแรก
		item.Status = models.VisitStatusWaiting
		return item
	}

	// เคสเก่าที่ยังไม่มีเลข VN ให้เติมให้ด้วย จะได้ค้นหาด้วย VN เจอทุกคน
	// (เติมครั้งเดียวต่อ visit ครั้งถัดไปจะข้ามไปเอง)
	ensureVN(&visit)

	visitDate, visitTime := splitVisitDateTime(visit.VisitDate)

	item.VisitID = visit.ID
	item.VN = visit.VN
	item.VisitDate = visitDate
	item.VisitTime = visitTime
	item.Department = visit.Department
	item.QueuedAt = visit.VisitDate
	item.Status = normalizeVisitStatus(visit.Status)
	item.AssignedDoctorID = visit.DoctorID

	if visit.DoctorID > 0 {
		var doc models.User
		if err := config.DB.First(&doc, visit.DoctorID).Error; err == nil {
			item.AssignedDoctorName = doc.FullName
		}
	}

	// เวลารอของครั้งนั้น นับจากเวลาที่ออกคิวถึงเวลาที่แพทย์เรียกเข้าตรวจ
	var queue models.Queue
	if err := config.DB.Where("visit_id = ?", visit.ID).
		Order("id desc").
		First(&queue).Error; err == nil {
		item.QueueID = queue.ID
		item.QueueNumber = queue.QueueNumber
		item.QueueStatus = queue.Status
		item.Note = queue.Note
		item.QueuedAt = queue.CreatedAt

		endTime := time.Now()
		if queue.CalledAt != nil {
			endTime = *queue.CalledAt
		}
		if minutes := int(endTime.Sub(queue.CreatedAt).Minutes()); minutes > 0 {
			item.WaitingMinutes = minutes
		}
	}

	var screening models.Screening
	if err := config.DB.Preload("ScreenedBy").
		Where("visit_id = ?", visit.ID).
		Order("id desc").
		First(&screening).Error; err == nil {
		brief := toScreeningBrief(screening)
		item.Screening = &brief
	}

	// การวินิจฉัยหลักของครั้งนั้น ใช้โชว์บนการ์ดในหน้าประวัติ
	var diagnosis models.Diagnosis
	if err := config.DB.Where("visit_id = ? AND is_primary = ?", visit.ID, true).
		First(&diagnosis).Error; err == nil {
		item.Diagnosis = diagnosis.NameTH
		if item.Diagnosis == "" {
			item.Diagnosis = diagnosis.NameEN
		}
		item.ICDCode = diagnosis.ICDCode
	}

	return item
}
