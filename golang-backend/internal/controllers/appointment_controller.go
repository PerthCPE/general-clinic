package controllers

import (
	"clinic-backend/internal/dto"
	"clinic-backend/internal/models"
	"net/http"

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

func (ctrl *AppointmentController) GetAppointments(c *gin.Context) {
	var appointments []models.Appointment
	// ดึงข้อมูลการนัดหมาย พร้อมดึงข้อมูลหมอ, คนไข้, ผู้ทำนัด
	if err := ctrl.DB.Preload("Doctor").Preload("Patient").Preload("Register").Find(&appointments).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch appointments"})
		return
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
		DoctorID:        req.DoctorID,
		PatientID:       req.PatientID,
		AppointmentDate: req.AppointmentDate,
		AppointmentTime: req.AppointmentTime,
		ClinicalNote:    req.ClinicalNote,
		Status:          "scheduled",
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
