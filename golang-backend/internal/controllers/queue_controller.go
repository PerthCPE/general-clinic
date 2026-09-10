package controllers

import (
	"fmt"
	"log"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"clinic-backend/internal/config"
	"clinic-backend/internal/models"
	"clinic-backend/internal/services"
	"clinic-backend/internal/ws"
	"github.com/gin-gonic/gin"
)

// CreateQueueReq - ข้อมูลสำหรับออกบัตรคิวใหม่
type CreateQueueReq struct {
	PatientID  uint   `json:"patient_id" binding:"required"`
	Department string `json:"department"`
	Note       string `json:"note"`
}

// UpdateQueueStatusReq - ข้อมูลสำหรับอัปเดตสถานะคิว/ส่งต่อแผนก
type UpdateQueueStatusReq struct {
	Status     string `json:"status" binding:"required"` // รอคัดกรอง, รอพบแพทย์, กำลังตรวจ, รอทำหัตถการ, รอชำระเงิน, รอรับยา, เสร็จสิ้น, ยกเลิกคิว
	Department string `json:"department"`
	Note       string `json:"note"`
}

// GetQueueList - ดึงรายการคิวทั้งหมด พร้อมข้อมูลผู้ป่วย (Server-Side Pagination & Filtered COUNT)
func GetQueueList(c *gin.Context) {
	pageStr := c.Query("page")
	limitStr := c.Query("limit")
	status := strings.TrimSpace(c.Query("status"))
	search := strings.TrimSpace(c.Query("search"))
	category := strings.TrimSpace(c.Query("category"))

	// Base query with joined patient table for search
	baseQuery := config.DB.Model(&models.Queue{}).Joins("LEFT JOIN patients ON patients.id = queues.patient_id")

	// 1. Status & Category Filtering
	if status != "" && status != "all" {
		if strings.Contains(status, ",") {
			statuses := strings.Split(status, ",")
			baseQuery = baseQuery.Where("queues.status IN ?", statuses)
		} else if status == "in_service_all" {
			baseQuery = baseQuery.Where("queues.status IN ?", []string{"รอคัดกรอง", "รอพบแพทย์", "กำลังตรวจ", "รอทำหัตถการ"})
		} else if status == "cash_pharmacy_all" {
			baseQuery = baseQuery.Where("queues.status IN ?", []string{"รอชำระเงิน", "รอรับยา"})
		} else if status == "completed_cancelled_all" {
			baseQuery = baseQuery.Where("queues.status IN ?", []string{"เสร็จสิ้น", "ยกเลิกคิว"})
		} else {
			baseQuery = baseQuery.Where("queues.status = ?", status)
		}
	} else if category != "" {
		if category == "all" {
			baseQuery = baseQuery.Where("queues.status NOT IN ?", []string{"เสร็จสิ้น", "ยกเลิกคิว"})
		} else if category == "in_service" {
			baseQuery = baseQuery.Where("queues.status IN ?", []string{"รอคัดกรอง", "รอพบแพทย์", "กำลังตรวจ", "รอทำหัตถการ"})
		} else if category == "cash_pharmacy" {
			baseQuery = baseQuery.Where("queues.status IN ?", []string{"รอชำระเงิน", "รอรับยา"})
		} else if category == "completed_cancelled" {
			baseQuery = baseQuery.Where("queues.status IN ?", []string{"เสร็จสิ้น", "ยกเลิกคิว"})
		}
	}

	// 2. Search Query Filtering (Queue Number, Patient Name, National ID, Phone)
	if search != "" {
		searchTerm := "%" + search + "%"
		cleanSearch := strings.ReplaceAll(strings.ReplaceAll(search, "-", ""), " ", "")
		baseQuery = baseQuery.Where(
			"queues.queue_number ILIKE ? OR patients.full_name ILIKE ? OR REPLACE(REPLACE(patients.national_id, '-', ''), ' ', '') ILIKE ? OR patients.phone_number ILIKE ?",
			searchTerm, searchTerm, "%"+cleanSearch+"%", searchTerm,
		)
	}

	// A3. Backward compatibility: If no page or limit param is provided, return unpaginated array
	if pageStr == "" && limitStr == "" {
		var queues []models.Queue
		if err := baseQuery.Preload("Patient").Order("queues.created_at ASC, queues.id ASC").Find(&queues).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถดึงรายการคิวได้"})
			return
		}
		if queues == nil {
			queues = []models.Queue{}
		}
		c.JSON(http.StatusOK, queues)
		return
	}

	// A1. Server-side Pagination with Parameter Clamping
	page, _ := strconv.Atoi(pageStr)
	if page < 1 {
		page = 1
	}

	rawLimit, _ := strconv.Atoi(limitStr)
	var limit int
	if rawLimit <= 10 {
		limit = 10
	} else if rawLimit <= 25 {
		limit = 25
	} else {
		limit = 50
	}

	// Filtered COUNT (Counts matching rows only)
	var total int64
	if err := baseQuery.Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถนับจำนวนคิวได้"})
		return
	}

	totalPages := int(math.Ceil(float64(total) / float64(limit)))
	if totalPages == 0 {
		totalPages = 1
	}

	offset := (page - 1) * limit
	var queues []models.Queue
	if err := baseQuery.Preload("Patient").Order("queues.created_at ASC, queues.id ASC").Limit(limit).Offset(offset).Find(&queues).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถดึงรายการคิวได้"})
		return
	}

	if queues == nil {
		queues = []models.Queue{}
	}

	// Calculate overall statistics for top cards without full table egress
	type StatusCount struct {
		Status string
		Count  int
	}
	var statusCounts []StatusCount
	config.DB.Model(&models.Queue{}).Select("status, count(*) as count").Group("status").Scan(&statusCounts)

	stats := gin.H{
		"total":            0,
		"active":           0,
		"waitingScreening": 0,
		"waitingDoctor":    0,
		"inExamination":    0,
		"waitingTreatment": 0,
		"waitingBilling":   0,
		"waitingPharmacy":  0,
		"completed":        0,
		"cancelled":        0,
	}
	totalAll := 0
	for _, sc := range statusCounts {
		totalAll += sc.Count
		switch sc.Status {
		case "รอคัดกรอง":
			stats["waitingScreening"] = sc.Count
		case "รอพบแพทย์":
			stats["waitingDoctor"] = sc.Count
		case "กำลังตรวจ":
			stats["inExamination"] = sc.Count
		case "รอทำหัตถการ":
			stats["waitingTreatment"] = sc.Count
		case "รอชำระเงิน":
			stats["waitingBilling"] = sc.Count
		case "รอรับยา":
			stats["waitingPharmacy"] = sc.Count
		case "เสร็จสิ้น":
			stats["completed"] = sc.Count
		case "ยกเลิกคิว":
			stats["cancelled"] = sc.Count
		}
	}
	stats["total"] = totalAll
	stats["active"] = totalAll - (stats["completed"].(int) + stats["cancelled"].(int))

	c.JSON(http.StatusOK, gin.H{
		"data":        queues,
		"total":       total,
		"page":        page,
		"limit":       limit,
		"total_pages": totalPages,
		"stats":       stats,
	})
}

// CreateQueue - ออกบัตรคิวใหม่ (Atomic Daily Sequential Numbering)
func CreateQueue(c *gin.Context) {
	var req CreateQueueReq

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ข้อมูลการออกคิวไม่ถูกต้อง กรุณาระบุรหัสผู้ป่วย"})
		return
	}

	var patient models.Patient
	if err := config.DB.First(&patient, req.PatientID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบข้อมูลผู้ป่วยในระบบ"})
		return
	}

	// ดึง ID ของผู้ใช้ที่ออกคิวจาก JWT
	var userID uint
	if val, exists := c.Get("userID"); exists {
		if idFloat, ok := val.(float64); ok {
			userID = uint(idFloat)
		} else if idUint, ok := val.(uint); ok {
			userID = idUint
		}
	}

	department := req.Department
	if strings.TrimSpace(department) == "" {
		department = "แผนกคัดกรอง"
	}

	nowBkk := time.Now().In(services.BangkokLocation())
	serviceDate := time.Date(nowBkk.Year(), nowBkk.Month(), nowBkk.Day(), 0, 0, 0, 0, time.UTC)

	// ตรวจสอบคิว Active เดิมในวันเดียวกัน (BUG-C1-03 / งาน D1)
	var existingActiveQueue models.Queue
	errActive := config.DB.Where("patient_id = ? AND service_date = ? AND status NOT IN (?, ?, ?)",
		req.PatientID, serviceDate, "เสร็จสิ้น", "ยกเลิกคิว", "ยกเลิก",
	).Order("id DESC").First(&existingActiveQueue).Error

	if errActive == nil && existingActiveQueue.ID > 0 {
		c.JSON(http.StatusConflict, gin.H{
			"error":          fmt.Sprintf("คนไข้รายนี้มีคิว %s สถานะ %s อยู่แล้ว", existingActiveQueue.QueueNumber, existingActiveQueue.Status),
			"code":           "DUPLICATE_ACTIVE_QUEUE",
			"existing_queue": existingActiveQueue,
		})
		return
	}

	var createdQueue models.Queue
	maxRetries := 5
	var lastErr error

	for attempt := 0; attempt < maxRetries; attempt++ {
		tx := config.DB.Begin()
		if tx.Error != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถเริ่ม Transaction ได้"})
			return
		}

		queueNo, err := services.NextQueueNumber(config.DB, nowBkk)
		if err != nil {
			tx.Rollback()
			lastErr = err
			continue
		}

		newQueue := models.Queue{
			PatientID:       req.PatientID,
			CreatedByUserID: userID,
			QueueNumber:     queueNo,
			ServiceDate:     serviceDate,
			Status:          "รอคัดกรอง",
			Department:      department,
			Note:            req.Note,
			CreatedAt:       nowBkk,
			UpdatedAt:       nowBkk,
		}

		if err := tx.Create(&newQueue).Error; err != nil {
			tx.Rollback()
			if strings.Contains(err.Error(), "idx_active_queue_per_patient") {
				var duplicateQueue models.Queue
				config.DB.Where("patient_id = ? AND service_date = ? AND status NOT IN (?, ?, ?)",
					req.PatientID, serviceDate, "เสร็จสิ้น", "ยกเลิกคิว", "ยกเลิก",
				).Order("id DESC").First(&duplicateQueue)
				c.JSON(http.StatusConflict, gin.H{
					"error":          fmt.Sprintf("คนไข้รายนี้มีคิว %s สถานะ %s อยู่แล้ว", duplicateQueue.QueueNumber, duplicateQueue.Status),
					"code":           "DUPLICATE_ACTIVE_QUEUE",
					"existing_queue": duplicateQueue,
				})
				return
			}
			lastErr = err
			log.Printf("[COLLISION RETRY] Attempt %d/%d encountered collision for queue %s: %v. Retrying with next sequence...", attempt+1, maxRetries, queueNo, err)
			time.Sleep(10 * time.Millisecond) // Short backoff on collision
			continue
		}

		if err := tx.Commit().Error; err != nil {
			lastErr = err
			continue
		}

		createdQueue = newQueue
		lastErr = nil
		break
	}

	if lastErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("ไม่สามารถออกบัตรคิวได้: %v", lastErr)})
		return
	}

	config.DB.Preload("Patient").First(&createdQueue, createdQueue.ID)

	// ส่ง WebSocket Broadcast แจ้งเตือนทุกเครื่องว่ามีคิวใหม่ถูกสร้างขึ้นหลัง commit สำเร็จ
	ws.BroadcastEvent("QUEUE_CREATED", createdQueue)

	c.JSON(http.StatusCreated, gin.H{
		"message": "ออกบัตรคิวสำเร็จ",
		"queue":   createdQueue,
	})
}

// ResolveDepartmentForStatus คืนค่าชื่อจุดบริการ/แผนกที่สอดคล้องกับสถานะคิว
func ResolveDepartmentForStatus(queue models.Queue, targetStatus string) string {
	targetStatus = strings.TrimSpace(targetStatus)
	switch targetStatus {
	case "รอคัดกรอง":
		dept := strings.TrimSpace(queue.Department)
		if strings.Contains(dept, "คัดกรอง") {
			return dept
		}
		return "จุดคัดกรอง"

	case "รอพบแพทย์", "กำลังตรวจ":
		dept := strings.TrimSpace(queue.Department)
		if strings.HasPrefix(dept, "ห้องตรวจ") {
			return dept
		}

		var doctorID uint
		if queue.AssignedDoctorID != nil && *queue.AssignedDoctorID > 0 {
			doctorID = *queue.AssignedDoctorID
		} else if queue.VisitID != nil && *queue.VisitID > 0 {
			var visit models.VisitRecord
			if err := config.DB.Select("doctor_id").First(&visit, *queue.VisitID).Error; err == nil && visit.DoctorID > 0 {
				doctorID = visit.DoctorID
			}
		}

		if doctorID > 0 {
			var docProfile models.Doctor
			// 1. ดึงข้อมูลจากตาราง doctors ผ่าน user_id (Source of Truth)
			if err := config.DB.Where("user_id = ?", doctorID).First(&docProfile).Error; err == nil && strings.TrimSpace(docProfile.Room) != "" {
				roomName := strings.TrimSpace(docProfile.Room)
				shortDocName := ""
				if strings.Contains(docProfile.FullName, "สุดา") {
					shortDocName = "พญ.สุดา"
				} else if strings.Contains(docProfile.FullName, "วิชัย") {
					shortDocName = "นพ.วิชัย"
				} else if strings.Contains(docProfile.FullName, "เกศรา") {
					shortDocName = "พญ.เกศรา"
				} else {
					parts := strings.Split(docProfile.FullName, " ")
					if len(parts) > 0 {
						shortDocName = parts[0]
					}
				}
				if shortDocName != "" {
					return fmt.Sprintf("%s (%s)", roomName, shortDocName)
				}
				return roomName
			}

			// 2. ดึงจากตาราง doctors ผ่าน doctor.id
			if err := config.DB.First(&docProfile, doctorID).Error; err == nil && strings.TrimSpace(docProfile.Room) != "" {
				roomName := strings.TrimSpace(docProfile.Room)
				shortDocName := ""
				if strings.Contains(docProfile.FullName, "สุดา") {
					shortDocName = "พญ.สุดา"
				} else if strings.Contains(docProfile.FullName, "วิชัย") {
					shortDocName = "นพ.วิชัย"
				} else if strings.Contains(docProfile.FullName, "เกศรา") {
					shortDocName = "พญ.เกศรา"
				} else {
					parts := strings.Split(docProfile.FullName, " ")
					if len(parts) > 0 {
						shortDocName = parts[0]
					}
				}
				if shortDocName != "" {
					return fmt.Sprintf("%s (%s)", roomName, shortDocName)
				}
				return roomName
			}

			// 3. Fallback: ตรวจสอบจากชื่อแพทย์ในตาราง users
			var doc models.User
			if err := config.DB.First(&doc, doctorID).Error; err == nil {
				if strings.Contains(doc.FullName, "สุดา") {
					return "ห้องตรวจ 1 (พญ.สุดา)"
				} else if strings.Contains(doc.FullName, "วิชัย") {
					return "ห้องตรวจ 2 (นพ.วิชัย)"
				} else if strings.Contains(doc.FullName, "เกศรา") {
					return "ห้องตรวจ 3 (พญ.เกศรา)"
				}
			}
		}
		return "ห้องตรวจ 1 (พญ.สุดา)"

	case "รอทำหัตถการ":
		return "ห้องหัตถการ (ทำแผล/ฉีดยา)"

	case "รอชำระเงิน":
		return "ห้องการเงิน (แคชเชียร์)"

	case "รอรับยา":
		return "ห้องจ่ายยาและเภสัชกรรม"

	case "เสร็จสิ้น":
		return "เสร็จสิ้นขั้นตอนการรักษา"

	case "ยกเลิกคิว", "ยกเลิก":
		if strings.TrimSpace(queue.Department) != "" {
			return queue.Department
		}
		return "จุดคัดกรอง"

	default:
		if strings.TrimSpace(queue.Department) != "" {
			return queue.Department
		}
		return "จุดคัดกรอง"
	}
}

// UpdateQueueStatus - อัปเดตสถานะคิว หรือส่งต่อแผนก
func UpdateQueueStatus(c *gin.Context) {
	queueID := c.Param("id")
	var req UpdateQueueStatusReq

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "กรุณาระบุสถานะคิวที่ต้องการอัปเดต"})
		return
	}

	var queue models.Queue
	if err := config.DB.First(&queue, queueID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบคิวที่ระบุ"})
		return
	}

	// State Machine Transition Guard (BUG-C1-04 / งาน C)
	validTransitions := map[string][]string{
		"รอคัดกรอง":    {"รอพบแพทย์", "กำลังตรวจ", "ยกเลิกคิว", "ยกเลิก"},
		"รอพบแพทย์":    {"กำลังตรวจ", "ยกเลิกคิว", "ยกเลิก"},
		"กำลังตรวจ":    {"รอทำหัตถการ", "รอชำระเงิน", "รอรับยา", "เสร็จสิ้น", "ยกเลิกคิว", "ยกเลิก"},
		"รอทำหัตถการ":  {"รอชำระเงิน", "รอรับยา", "กำลังตรวจ", "เสร็จสิ้น", "ยกเลิกคิว", "ยกเลิก"},
		"รอชำระเงิน":   {"รอรับยา", "เสร็จสิ้น", "ยกเลิกคิว", "ยกเลิก"},
		"รอรับยา":      {"เสร็จสิ้น", "ยกเลิกคิว", "ยกเลิก"},
		"เสร็จสิ้น":    {}, // Terminal
		"ยกเลิกคิว":    {}, // Terminal
		"ยกเลิก":        {}, // Terminal
	}

	curStatus := strings.TrimSpace(queue.Status)
	if curStatus == "" {
		curStatus = "รอคัดกรอง"
	}
	newStatus := strings.TrimSpace(req.Status)

	if curStatus != newStatus {
		allowedNext, exists := validTransitions[curStatus]
		isAllowed := false
		if exists {
			for _, allowed := range allowedNext {
				if allowed == newStatus {
					isAllowed = true
					break
				}
			}
		}

		if !isAllowed {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": fmt.Sprintf("ไม่สามารถเปลี่ยนสถานะจาก \"%s\" เป็น \"%s\" ได้", curStatus, newStatus),
				"code":  "INVALID_STATE_TRANSITION",
			})
			return
		}
	}

	queue.Status = req.Status
	if strings.TrimSpace(req.Department) != "" {
		queue.Department = strings.TrimSpace(req.Department)
	} else {
		queue.Department = ResolveDepartmentForStatus(queue, req.Status)
	}

	if strings.TrimSpace(req.Note) != "" {
		queue.Note = req.Note
	}

	if err := config.DB.Save(&queue).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถอัปเดตสถานะคิวได้"})
		return
	}

	config.DB.Preload("Patient").First(&queue, queue.ID)

	// ส่ง WebSocket Broadcast แจ้งเตือนทุกเครื่องว่าสถานะคิวเปลี่ยนแปลง
	ws.BroadcastEvent("QUEUE_UPDATED", queue)

	c.JSON(http.StatusOK, gin.H{
		"message": "อัปเดตสถานะคิวเรียบร้อยแล้ว",
		"queue":   queue,
	})
}
