package controllers

import (
	"net/http"
	"strconv"
	"time"

	"clinic-backend/internal/config"
	"clinic-backend/internal/models"
	"clinic-backend/internal/ws"

	"github.com/gin-gonic/gin"
)

// Request Structures
type CreateDocumentReq struct {
	ExternalDocRef string `json:"external_doc_ref"`
	SenderName     string `json:"sender_name" binding:"required"`
	Subject        string `json:"subject" binding:"required"`
	FileURL        string `json:"file_url"`
}

type ForwardDocumentReq struct {
	DocID       uint `json:"doc_id" binding:"required"`
	ForwardedTo uint `json:"forwarded_to" binding:"required"`
}

// 1. GetDocuments - ดึงรายการเอกสารทั้งหมดจาก Database
func GetDocuments(c *gin.Context) {
	var docs []models.Document
	err := config.DB.Preload("Creator").Order("created_at desc").Find(&docs).Error
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถดึงข้อมูลเอกสารได้"})
		return
	}

	c.JSON(http.StatusOK, docs)
}

// 2. CreateDocument - บันทึกและลงทะเบียนเอกสารใหม่เข้าระบบ
func CreateDocument(c *gin.Context) {
	var req CreateDocumentReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "กรุณากรอกข้อมูลเอกสารให้ครบถ้วน"})
		return
	}

	// หา User ID ของผู้สร้างจาก JWT Context
	userIDVal, exists := c.Get("user_id")
	var userID uint = 1
	if exists {
		if uid, ok := userIDVal.(float64); ok {
			userID = uint(uid)
		} else if uid, ok := userIDVal.(uint); ok {
			userID = uid
		}
	}

	// สร้างเลขที่หนังสืออัตโนมัติหากไม่ได้ระบุ
	docRef := req.ExternalDocRef
	if docRef == "" {
		var count int64
		config.DB.Model(&models.Document{}).Count(&count)
		docRef = "DOC-" + time.Now().Format("2006") + "-" + strconv.FormatInt(count+1, 10)
	}

	newDoc := models.Document{
		ExternalDocRef: docRef,
		SenderName:     req.SenderName,
		Subject:        req.Subject,
		FileURL:        req.FileURL,
		CreatedBy:      userID,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	if err := config.DB.Create(&newDoc).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถบันทึกเอกสารได้"})
		return
	}

	config.DB.Preload("Creator").First(&newDoc, newDoc.ID)

	// แจ้งเตือน WebSocket Hub
	ws.BroadcastEvent("DOCUMENT_CREATED", newDoc)

	c.JSON(http.StatusCreated, gin.H{
		"message":  "บันทึกเอกสารเรียบร้อยแล้ว",
		"document": newDoc,
	})
}

// 3. GetDocumentForwards - ดึงประวัติการส่งต่อเอกสารทั้งหมด
func GetDocumentForwards(c *gin.Context) {
	var forwards []models.DocumentForward
	err := config.DB.Preload("Document").
		Preload("Document.Creator").
		Preload("Recipient").
		Order("created_at desc").
		Find(&forwards).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถดึงข้อมูลการส่งต่อเอกสารได้"})
		return
	}

	c.JSON(http.StatusOK, forwards)
}

// 4. ForwardDocument - ส่งต่อเอกสารไปยังแพทย์หรือเจ้าหน้าที่
func ForwardDocument(c *gin.Context) {
	var req ForwardDocumentReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ข้อมูลการส่งต่อเอกสารไม่ถูกต้อง"})
		return
	}

	var doc models.Document
	if err := config.DB.First(&doc, req.DocID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบเอกสารที่ระบุ"})
		return
	}

	var recipient models.User
	if err := config.DB.First(&recipient, req.ForwardedTo).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบผู้รับเอกสาร"})
		return
	}

	newForward := models.DocumentForward{
		DocID:       req.DocID,
		ForwardedTo: req.ForwardedTo,
		Status:      "Pending",
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if err := config.DB.Create(&newForward).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถส่งต่อเอกสารได้"})
		return
	}

	config.DB.Preload("Document").Preload("Recipient").First(&newForward, newForward.ID)

	// แจ้งเตือน WebSocket Hub
	ws.BroadcastEvent("DOCUMENT_FORWARDED", newForward)

	c.JSON(http.StatusCreated, gin.H{
		"message": "ส่งต่อเอกสารสำเร็จ",
		"forward": newForward,
	})
}

// 5. AcknowledgeDocumentForward - กดรับทราบเอกสารที่ส่งต่อมา
func AcknowledgeDocumentForward(c *gin.Context) {
	idParam := c.Param("id")
	forwardID, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รหัสการส่งต่อไม่ถูกต้อง"})
		return
	}

	var forward models.DocumentForward
	if err := config.DB.First(&forward, uint(forwardID)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบรายการส่งต่อเอกสาร"})
		return
	}

	now := time.Now()
	forward.Status = "Acknowledged"
	forward.AcknowledgedAt = &now
	forward.UpdatedAt = now

	if err := config.DB.Save(&forward).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถอัปเดตสถานะได้"})
		return
	}

	config.DB.Preload("Document").Preload("Recipient").First(&forward, forward.ID)

	// แจ้งเตือน WebSocket Hub
	ws.BroadcastEvent("DOCUMENT_ACKNOWLEDGED", forward)

	c.JSON(http.StatusOK, gin.H{
		"message": "รับทราบเอกสารเรียบร้อยแล้ว",
		"forward": forward,
	})
}

// 6. GetRecipients - ดึงรายชื่อบุคลากรทั้งหมดที่สามารถรับเอกสารได้
func GetRecipients(c *gin.Context) {
	var users []models.User
	err := config.DB.Order("role asc, full_name asc").Find(&users).Error
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถดึงรายชื่อผู้รับได้"})
		return
	}

	c.JSON(http.StatusOK, users)
}
