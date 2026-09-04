package controllers

import (
	"math"
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
	Subject        string `json:"subject" binding:"required"`
	FileURL        string `json:"file_url"`
	FileSize       int64  `json:"file_size"`
	DocType        string `json:"doc_type"`
	Status         string `json:"status"`
}

type StorageBreakdown struct {
	Type      string  `json:"type"`
	SizeBytes int64   `json:"size_bytes"`
	SizeMB    float64 `json:"size_mb"`
	Count     int64   `json:"count"`
}

type StorageStatsResponse struct {
	QuotaBytes     int64              `json:"quota_bytes"`
	QuotaMB        float64            `json:"quota_mb"`
	UsedBytes      int64              `json:"used_bytes"`
	UsedMB         float64            `json:"used_mb"`
	RemainingBytes int64              `json:"remaining_bytes"`
	RemainingMB    float64            `json:"remaining_mb"`
	Percentage     float64            `json:"percentage"`
	TotalFiles     int64              `json:"total_files"`
	Breakdown      []StorageBreakdown `json:"breakdown"`
}

type UpdateDocumentStatusReq struct {
	Status string `json:"status"`
}

type ForwardDocumentReq struct {
	DocID       uint `json:"doc_id" binding:"required"`
	ForwardedTo uint `json:"forwarded_to" binding:"required"`
}

// 1. GetDocuments - ดึงรายการเอกสารทั้งหมดจาก Database
func GetDocuments(c *gin.Context) {
	var docs []models.Document
	err := config.DB.Preload("Creator").Preload("Approver").Order("created_at desc").Find(&docs).Error
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถดึงข้อมูลเอกสารได้"})
		return
	}

	c.JSON(http.StatusOK, docs)
}

// 1.1 GetDocumentByID - ดึงข้อมูลรายละเอียดเอกสารรายชิ้น
func GetDocumentByID(c *gin.Context) {
	idParam := c.Param("id")
	docID, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รหัสเอกสารไม่ถูกต้อง"})
		return
	}

	var doc models.Document
	if err := config.DB.Preload("Creator").Preload("Approver").First(&doc, uint(docID)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบข้อมูลเอกสาร"})
		return
	}

	c.JSON(http.StatusOK, doc)
}

// 2. CreateDocument - บันทึกและลงทะเบียนเอกสารใหม่เข้าระบบ (สถานะเริ่มต้น: reviewing / รอตรวจสอบ)
func CreateDocument(c *gin.Context) {
	var req CreateDocumentReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "กรุณาระบุชื่อเรื่อง / หัวข้อเอกสาร"})
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

	docType := req.DocType
	if docType == "" {
		docType = "เอกสารราชการ/ส่งตัว"
	}

	status := req.Status
	if status == "" {
		status = "reviewing" // เอกสารที่เพิ่มใหม่จะอยู่ในสถานะ "รอตรวจสอบ" ตามที่ผู้ใช้กำหนด
	}

	newDoc := models.Document{
		ExternalDocRef: docRef,
		Subject:        req.Subject,
		FileURL:        req.FileURL,
		FileSize:       req.FileSize,
		DocType:        docType,
		Status:         status,
		CreatedBy:      userID,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	if newDoc.FileSize <= 0 {
		newDoc.FileSize = 1048576 // ค่าเริ่มต้น 1 MB หากไม่ได้ระบุขนาดไฟล์
	}

	if err := config.DB.Create(&newDoc).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถบันทึกเอกสารได้"})
		return
	}

	config.DB.Preload("Creator").Preload("Approver").First(&newDoc, newDoc.ID)

	// แจ้งเตือน WebSocket Hub
	ws.BroadcastEvent("DOCUMENT_CREATED", newDoc)

	c.JSON(http.StatusCreated, gin.H{
		"message":  "บันทึกเอกสารเรียบร้อยแล้ว (สถานะ: รอตรวจสอบ)",
		"document": newDoc,
	})
}

// 2.0 GetStorageStats - ดึงข้อมูลสถิติพื้นที่จัดเก็บจริงจาก Supabase (PostgreSQL / Document Files)
func GetStorageStats(c *gin.Context) {
	// Supabase Free Tier Storage / Database Quota = 500 MB (524,288,000 bytes)
	const quotaBytes int64 = 524288000
	const quotaMB float64 = 500.0

	var totalBytes int64
	config.DB.Model(&models.Document{}).Select("COALESCE(SUM(file_size), 0)").Scan(&totalBytes)

	var totalFiles int64
	config.DB.Model(&models.Document{}).Count(&totalFiles)

	// แยกสรุปตามประเภทเอกสาร
	type TypeSum struct {
		DocType string
		Total   int64
		Count   int64
	}
	var typeSums []TypeSum
	config.DB.Model(&models.Document{}).
		Select("COALESCE(doc_type, 'ทั่วไป') as doc_type, COALESCE(SUM(file_size), 0) as total, COUNT(*) as count").
		Group("doc_type").
		Scan(&typeSums)

	breakdown := make([]StorageBreakdown, 0)
	for _, ts := range typeSums {
		sizeMB := float64(ts.Total) / (1024.0 * 1024.0)
		breakdown = append(breakdown, StorageBreakdown{
			Type:      ts.DocType,
			SizeBytes: ts.Total,
			SizeMB:    math.Round(sizeMB*100) / 100,
			Count:     ts.Count,
		})
	}

	usedMB := float64(totalBytes) / (1024.0 * 1024.0)
	remainingBytes := quotaBytes - totalBytes
	if remainingBytes < 0 {
		remainingBytes = 0
	}
	remainingMB := float64(remainingBytes) / (1024.0 * 1024.0)
	percentage := (float64(totalBytes) / float64(quotaBytes)) * 100.0

	resp := StorageStatsResponse{
		QuotaBytes:     quotaBytes,
		QuotaMB:        quotaMB,
		UsedBytes:      totalBytes,
		UsedMB:         math.Round(usedMB*100) / 100,
		RemainingBytes: remainingBytes,
		RemainingMB:    math.Round(remainingMB*100) / 100,
		Percentage:     math.Round(percentage*100) / 100,
		TotalFiles:     totalFiles,
		Breakdown:      breakdown,
	}

	c.JSON(http.StatusOK, resp)
}

// 2.1 ApproveDocument - อนุมัติเอกสาร
func ApproveDocument(c *gin.Context) {
	idParam := c.Param("id")
	docID, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รหัสเอกสารไม่ถูกต้อง"})
		return
	}

	var doc models.Document
	if err := config.DB.First(&doc, uint(docID)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบข้อมูลเอกสาร"})
		return
	}

	userIDVal, exists := c.Get("user_id")
	var userID uint = 1
	if exists {
		if uid, ok := userIDVal.(float64); ok {
			userID = uint(uid)
		} else if uid, ok := userIDVal.(uint); ok {
			userID = uid
		}
	}

	doc.Status = "approved"
	doc.ApprovedBy = &userID
	doc.UpdatedAt = time.Now()

	if err := config.DB.Save(&doc).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถอนุมัติเอกสารได้"})
		return
	}

	config.DB.Preload("Creator").Preload("Approver").First(&doc, doc.ID)

	ws.BroadcastEvent("DOCUMENT_APPROVED", doc)

	c.JSON(http.StatusOK, gin.H{
		"message":  "อนุมัติเอกสารเรียบร้อยแล้ว",
		"document": doc,
	})
}

// 2.2 UpdateDocumentStatus - อัปเดตสถานะเอกสาร
func UpdateDocumentStatus(c *gin.Context) {
	idParam := c.Param("id")
	docID, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รหัสเอกสารไม่ถูกต้อง"})
		return
	}

	var req UpdateDocumentStatusReq
	if err := c.ShouldBindJSON(&req); err != nil || req.Status == "" {
		req.Status = "approved"
	}

	var doc models.Document
	if err := config.DB.First(&doc, uint(docID)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบข้อมูลเอกสาร"})
		return
	}

	userIDVal, exists := c.Get("user_id")
	var userID uint = 1
	if exists {
		if uid, ok := userIDVal.(float64); ok {
			userID = uint(uid)
		} else if uid, ok := userIDVal.(uint); ok {
			userID = uid
		}
	}

	doc.Status = req.Status
	if req.Status == "approved" {
		doc.ApprovedBy = &userID
	}
	doc.UpdatedAt = time.Now()

	if err := config.DB.Save(&doc).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถอัปเดตสถานะเอกสารได้"})
		return
	}

	config.DB.Preload("Creator").Preload("Approver").First(&doc, doc.ID)

	ws.BroadcastEvent("DOCUMENT_STATUS_UPDATED", doc)

	c.JSON(http.StatusOK, gin.H{
		"message":  "อัปเดตสถานะเอกสารเรียบร้อยแล้ว",
		"document": doc,
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
