package controllers

import (
	"fmt"
	"net/http"
	"strings"

	"clinic-backend/internal/config"
	"clinic-backend/internal/models"
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

// GetQueueList - ดึงรายการคิวทั้งหมด พร้อมข้อมูลผู้ป่วย
func GetQueueList(c *gin.Context) {
	var queues []models.Queue

	err := config.DB.Preload("Patient").
		Preload("CreatedBy").
		Order("created_at asc").
		Find(&queues).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถดึงรายการคิวได้"})
		return
	}

	c.JSON(http.StatusOK, queues)
}

// CreateQueue - ออกบัตรคิวใหม่
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

	// สร้างหมายเลขคิวอัตโนมัติ ฐาน 16 ความยาว 4 หลัก เช่น Q0001, Q0002, ... Q000A, ... QFFFF
	var lastQueue models.Queue
	var queueNo string
	if err := config.DB.Order("id desc").First(&lastQueue).Error; err == nil {
		var lastNum int
		cleanHex := strings.TrimPrefix(strings.ToUpper(lastQueue.QueueNumber), "Q")
		fmt.Sscanf(cleanHex, "%X", &lastNum)
		if lastNum > 0 {
			queueNo = fmt.Sprintf("Q%04X", lastNum+1)
		} else {
			queueNo = fmt.Sprintf("Q%04X", lastQueue.ID+1)
		}
	} else {
		var count int64
		config.DB.Model(&models.Queue{}).Count(&count)
		queueNo = fmt.Sprintf("Q%04X", count+1)
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

	newQueue := models.Queue{
		PatientID:       req.PatientID,
		CreatedByUserID: userID,
		QueueNumber:     queueNo,
		Status:          "รอคัดกรอง",
		Department:      department,
		Note:            req.Note,
	}

	if err := config.DB.Create(&newQueue).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถออกบัตรคิวได้"})
		return
	}

	config.DB.Preload("Patient").First(&newQueue, newQueue.ID)

	// ส่ง WebSocket Broadcast แจ้งเตือนทุกเครื่องว่ามีคิวใหม่ถูกสร้างขึ้น
	ws.BroadcastEvent("QUEUE_CREATED", newQueue)

	c.JSON(http.StatusCreated, gin.H{
		"message": "ออกบัตรคิวสำเร็จ",
		"queue":   newQueue,
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
