package controllers

import (
	"fmt"
	"log"
	"net/http"
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

// GetQueueList - ดึงรายการคิวทั้งหมด พร้อมข้อมูลผู้ป่วย (Optimize Query)
func GetQueueList(c *gin.Context) {
	var queues []models.Queue

	err := config.DB.Preload("Patient").
		Order("created_at asc").
		Find(&queues).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถดึงรายการคิวได้"})
		return
	}

	c.JSON(http.StatusOK, queues)
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

	queue.Status = req.Status
	if strings.TrimSpace(req.Department) != "" {
		queue.Department = req.Department
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
