package controllers

import (
	"net/http"
	"strings"
	"time"

	"clinic-backend/internal/dto"
	"clinic-backend/internal/models"
	"clinic-backend/internal/services"

	"clinic-backend/internal/ws"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// AppointmentController จัดการนัดหมาย
type AppointmentController struct {
	DB *gorm.DB
}

func NewAppointmentController(db *gorm.DB) *AppointmentController {
	return &AppointmentController{DB: db}
}

// สถานะที่ถือว่า "จบแล้ว" ของนัดหมาย — ใช้ชื่อคงที่กลางที่นี่ที่เดียว กันสะกดพลาด/ค่าไม่ตรงกันระหว่างจุดต่างๆ
const (
	statusPendingDefault = "รอยืนยัน"   // ค่าเริ่มต้นตอนสร้างนัดหมายใหม่ ตรงกับตัวเลือกใน dropdown ฝั่งหน้าบ้าน
	statusLegacyScheduled = "scheduled" // ค่าเก่าก่อนเปลี่ยน default — มีอยู่ในนัดหมายเก่าที่สร้างไว้ก่อนหน้านี้เท่านั้น
	statusCompleted       = "เข้ารับการรักษาแล้ว"
	statusCancelled       = "ยกเลิกนัด"
)

// authUserID - ดึง user id ของผู้ใช้ที่ล็อกอินอยู่จาก JWT context (เหมือน doctorAuthUserID ใน
// doctor_controller.go แต่ appointment_controller.go ต้องใช้กับหลาย role ไม่ใช่แค่ doctor)
func authUserID(c *gin.Context) uint {
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

func authRole(c *gin.Context) string {
	val, exists := c.Get("role")
	if !exists {
		return ""
	}
	roleStr, _ := val.(string)
	return roleStr
}

// normalizeStatus - นัดหมายเก่าที่ยังเป็นค่า default เดิม ("scheduled") ให้แสดง/นับเป็น "รอยืนยัน"
// เสมอตอนส่งออกไป frontend โดยไม่แก้ค่าจริงในฐานข้อมูล (ตามที่ตกลงกันไว้)
func normalizeStatus(status string) string {
	if status == statusLegacyScheduled {
		return statusPendingDefault
	}
	return status
}

// isCancelled - เช็คว่านัดหมายนี้ถูกยกเลิกไปแล้วหรือยัง (บล็อกการแก้ไขทุกชนิดต่อจากนี้ ไม่ว่า role ไหน)
func isCancelled(status string) bool {
	return status == statusCancelled
}

// isAppointmentDateNotPassed - "วันนัดยังไม่ผ่านไป" นับวันนี้รวมอยู่ด้วย เทียบด้วยเวลาโซน Asia/Bangkok
// ให้สอดคล้องกับที่อื่นในระบบ (ดู services.BangkokLocation)
func isAppointmentDateNotPassed(apptDate string) bool {
	today := time.Now().In(services.BangkokLocation()).Format("2006-01-02")
	return apptDate >= today
}

// checkDoctorCanModify - เงื่อนไขที่แพทย์ต้องผ่านทั้งหมดถึงจะแก้ไขนัดหมาย (วันเวลา/ประเภทนัด/เหตุผล/
// คำแนะนำ/หมายเหตุ/สถานะ) ได้: ต้องเป็นนัดของตัวเอง + ยังไม่เข้ารับการรักษา + วันนัดยังไม่ผ่านไป
// ("ยกเลิกแล้ว" ถูกกันไว้ก่อนหน้านี้แล้วด้วย isCancelled แบบ blanket ทุก role จึงไม่เช็คซ้ำที่นี่)
// ใช้เฉพาะ endpoint แก้ไข (status/schedule/details) เท่านั้น — CancelAppointment เช็คแยกเอง (เบากว่า)
func checkDoctorCanModify(appt models.Appointment, uid uint) (bool, string) {
	if appt.DoctorID != uid {
		return false, "คุณสามารถแก้ไขได้เฉพาะนัดหมายของตัวเองเท่านั้น"
	}
	if appt.Status == statusCompleted {
		return false, "นัดหมายนี้เข้ารับการรักษาแล้ว ไม่สามารถแก้ไขได้"
	}
	if !isAppointmentDateNotPassed(appt.AppointmentDate) {
		return false, "นัดหมายนี้เลยวันนัดไปแล้ว ไม่สามารถแก้ไขได้"
	}
	return true, ""
}

func (ctrl *AppointmentController) GetAppointments(c *gin.Context) {
	var appointments []models.Appointment
	// ดึงข้อมูลการนัดหมาย พร้อมดึงข้อมูลหมอ, คนไข้, ผู้ทำนัด, ผู้ยกเลิก (ถ้ามี)
	if err := ctrl.DB.Preload("Doctor").Preload("Patient").Preload("Register").Preload("CancelledByUser").Find(&appointments).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch appointments"})
		return
	}
	for i := range appointments {
		appointments[i].Status = normalizeStatus(appointments[i].Status)
	}
	c.JSON(http.StatusOK, appointments)
}

func (ctrl *AppointmentController) CreateAppointment(c *gin.Context) {
	var req dto.CreateAppointmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	appointment := models.Appointment{
		DoctorID:         req.DoctorID,
		PatientID:        req.PatientID,
		AppointmentDate:  req.AppointmentDate,
		AppointmentTime:  req.AppointmentTime,
		Department:       req.Department,
		ClinicalNote:     req.ClinicalNote,
		AppointmentType:  req.AppointmentType,
		Reason:           req.Reason,
		PrepInstructions: req.PrepInstructions,
		Status:           statusPendingDefault,
	}
	if req.RegisterID != 0 {
		appointment.RegisterID = &req.RegisterID
	}

	if err := ctrl.DB.Create(&appointment).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create appointment"})
		return
	}

	ctrl.DB.Preload("Doctor").Preload("Patient").Preload("Register").First(&appointment, appointment.ID)
	ws.BroadcastEvent("APPOINTMENT_CREATED", appointment)

	c.JSON(http.StatusCreated, appointment)
}

func (ctrl *AppointmentController) UpdateAppointmentStatus(c *gin.Context) {
	id := c.Param("id")
	var req dto.UpdateAppointmentStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// ยกเลิกนัดต้องผ่าน /cancel เท่านั้น (บังคับกรอกเหตุผล + บันทึกผู้ยกเลิก) ห้ามตั้งสถานะนี้ผ่านช่องทางนี้
	if req.Status == statusCancelled {
		c.JSON(http.StatusBadRequest, gin.H{"error": "กรุณาใช้ปุ่ม \"ยกเลิกนัดหมาย\" แทน (ต้องระบุเหตุผลการยกเลิก)"})
		return
	}

	var appt models.Appointment
	if err := ctrl.DB.First(&appt, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบนัดหมายนี้"})
		return
	}

	// นัดหมายที่ถูกยกเลิกแล้ว แก้ไขต่อไม่ได้ ไม่ว่า role ไหน
	if isCancelled(appt.Status) {
		c.JSON(http.StatusConflict, gin.H{"error": "นัดหมายนี้ถูกยกเลิกไปแล้ว ไม่สามารถแก้ไขได้"})
		return
	}

	// สิทธิ์แพทย์: แก้ได้เฉพาะนัดของตัวเอง สถานะยังไม่เข้ารับการรักษา และวันนัดยังไม่ผ่านไป
	// nurse_assistant/admin ไม่ถูกจำกัดเพิ่ม (คงสิทธิ์เดิม)
	if authRole(c) == "doctor" {
		if ok, msg := checkDoctorCanModify(appt, authUserID(c)); !ok {
			c.JSON(http.StatusForbidden, gin.H{"error": msg})
			return
		}
	}

	updates := map[string]interface{}{
		"status": req.Status,
	}
	if req.ClinicalNote != "" {
		updates["clinical_note"] = req.ClinicalNote
	}

	if err := ctrl.DB.Model(&models.Appointment{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update appointment status"})
		return
	}

	var updatedAppt models.Appointment
	ctrl.DB.Preload("Doctor").Preload("Patient").Preload("Register").First(&updatedAppt, id)
	ws.BroadcastEvent("APPOINTMENT_UPDATED", updatedAppt)

	c.JSON(http.StatusOK, gin.H{"message": "Appointment updated successfully", "appointment": updatedAppt})
}

func (ctrl *AppointmentController) UpdateAppointmentSchedule(c *gin.Context) {
	id := c.Param("id")
	var req dto.UpdateAppointmentScheduleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var appt models.Appointment
	if err := ctrl.DB.First(&appt, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบนัดหมายนี้"})
		return
	}

	if isCancelled(appt.Status) {
		c.JSON(http.StatusConflict, gin.H{"error": "นัดหมายนี้ถูกยกเลิกไปแล้ว ไม่สามารถแก้ไขได้"})
		return
	}

	if authRole(c) == "doctor" {
		if ok, msg := checkDoctorCanModify(appt, authUserID(c)); !ok {
			c.JSON(http.StatusForbidden, gin.H{"error": msg})
			return
		}
	}

	updates := map[string]interface{}{}
	if req.AppointmentDate != "" {
		updates["appointment_date"] = req.AppointmentDate
	}
	if req.AppointmentTime != "" {
		updates["appointment_time"] = req.AppointmentTime
	}

	if err := ctrl.DB.Model(&models.Appointment{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update appointment schedule"})
		return
	}

	var updatedAppt models.Appointment
	ctrl.DB.Preload("Doctor").Preload("Patient").Preload("Register").First(&updatedAppt, id)
	ws.BroadcastEvent("APPOINTMENT_UPDATED", updatedAppt)

	c.JSON(http.StatusOK, gin.H{"message": "Appointment schedule updated successfully", "appointment": updatedAppt})
}

// UpdateAppointmentDetails - แก้ไขวันเวลา/ประเภทนัด/เหตุผล/คำแนะนำก่อนมาตามนัด/หมายเหตุ ในคำขอเดียว
// ไม่รับ department เลย (แก้แผนกไม่ได้หลังสร้างนัดหมายแล้วโดยตั้งใจ) — ใช้ role gate เดียวกับ
// status/schedule (doctor, admin, nurse_assistant) บวกเงื่อนไขเดียวกันทุกประการสำหรับ doctor
func (ctrl *AppointmentController) UpdateAppointmentDetails(c *gin.Context) {
	id := c.Param("id")
	var req dto.UpdateAppointmentDetailsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var appt models.Appointment
	if err := ctrl.DB.First(&appt, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบนัดหมายนี้"})
		return
	}

	if isCancelled(appt.Status) {
		c.JSON(http.StatusConflict, gin.H{"error": "นัดหมายนี้ถูกยกเลิกไปแล้ว ไม่สามารถแก้ไขได้"})
		return
	}

	if authRole(c) == "doctor" {
		if ok, msg := checkDoctorCanModify(appt, authUserID(c)); !ok {
			c.JSON(http.StatusForbidden, gin.H{"error": msg})
			return
		}
	}

	updates := map[string]interface{}{}
	if req.AppointmentDate != "" {
		updates["appointment_date"] = req.AppointmentDate
	}
	if req.AppointmentTime != "" {
		updates["appointment_time"] = req.AppointmentTime
	}
	if req.AppointmentType != "" {
		updates["appointment_type"] = req.AppointmentType
	}
	if req.Reason != "" {
		updates["reason"] = req.Reason
	}
	if req.PrepInstructions != "" {
		updates["prep_instructions"] = req.PrepInstructions
	}
	if req.ClinicalNote != "" {
		updates["clinical_note"] = req.ClinicalNote
	}

	if len(updates) > 0 {
		if err := ctrl.DB.Model(&models.Appointment{}).Where("id = ?", id).Updates(updates).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update appointment details"})
			return
		}
	}

	var updatedAppt models.Appointment
	ctrl.DB.Preload("Doctor").Preload("Patient").Preload("Register").First(&updatedAppt, id)
	ws.BroadcastEvent("APPOINTMENT_UPDATED", updatedAppt)

	c.JSON(http.StatusOK, gin.H{"message": "Appointment details updated successfully", "appointment": updatedAppt})
}

// CancelAppointment - ยกเลิกนัดหมาย (แทนการลบ ไม่มี endpoint ลบนัดหมายในระบบนี้)
// บังคับกรอกเหตุผลเสมอ บันทึกว่าใครยกเลิกและเมื่อไหร่ ยกเลิกแล้วแก้ไข/ยกเลิกซ้ำไม่ได้
// แพทย์ยกเลิกได้เฉพาะนัดของตัวเอง (ไม่เช็คสถานะ/วันนัดเพิ่มเติม ต่างจากการแก้ไขทั่วไป — ยกเลิกนัดที่
// เลยวันไปแล้วหรือเข้ารับการรักษาแล้วก็ยังทำได้ เช่น บันทึกย้อนหลังว่าผู้ป่วยไม่มา)
// admin/nurse_assistant ยกเลิกได้ทุกนัด แต่ต้องกรอกเหตุผลเหมือนกันทุก role ไม่มีข้อยกเว้น
func (ctrl *AppointmentController) CancelAppointment(c *gin.Context) {
	id := c.Param("id")
	var req dto.CancelAppointmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "กรุณาระบุเหตุผลการยกเลิกนัดหมาย"})
		return
	}
	if strings.TrimSpace(req.Reason) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "กรุณาระบุเหตุผลการยกเลิกนัดหมาย"})
		return
	}

	var appt models.Appointment
	if err := ctrl.DB.First(&appt, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบนัดหมายนี้"})
		return
	}

	if isCancelled(appt.Status) {
		c.JSON(http.StatusConflict, gin.H{"error": "นัดหมายนี้ถูกยกเลิกไปแล้ว"})
		return
	}

	if authRole(c) == "doctor" && appt.DoctorID != authUserID(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "คุณสามารถยกเลิกได้เฉพาะนัดหมายของตัวเองเท่านั้น"})
		return
	}

	uid := authUserID(c)
	now := time.Now()
	updates := map[string]interface{}{
		"status":        statusCancelled,
		"cancel_reason": req.Reason,
		"cancelled_by":  uid,
		"cancelled_at":  &now,
	}

	if err := ctrl.DB.Model(&models.Appointment{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to cancel appointment"})
		return
	}

	var updatedAppt models.Appointment
	ctrl.DB.Preload("Doctor").Preload("Patient").Preload("Register").Preload("CancelledByUser").First(&updatedAppt, id)
	ws.BroadcastEvent("APPOINTMENT_UPDATED", updatedAppt)

	c.JSON(http.StatusOK, gin.H{"message": "Appointment cancelled successfully", "appointment": updatedAppt})
}
