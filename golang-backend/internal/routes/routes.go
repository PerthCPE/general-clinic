package routes

import (
	"clinic-backend/internal/controllers"
	"clinic-backend/internal/middleware"
	"clinic-backend/internal/ws"
	"github.com/gin-gonic/gin"
)

// API Routes Auth And Set Up Role 
func SetUpRoutes(r *gin.Engine) {
	// เปิดใช้งาน CORS Middleware
	r.Use(middleware.CORSMiddleware())

	// WebSocket Endpoint สำหรับ Real-time Sync
	r.GET("/ws", ws.ServeWS)

	// ส่งข้อมูลเพื่อ login และเช็ค role
	r.POST("/login", controllers.Login)

	// create group for inherit
	api := r.Group("api")
	// check jwt bearer token และแจก role
	api.Use(middleware.AuthRequired())
	
	// Common Endpoints
	api.GET("/doctors", controllers.GetDoctors)

	// 1. Registrar Module (ลงทะเบียน, ค้นหาผู้ป่วย, ตรวจสอบสิทธิ์)
	registrarRoutes := api.Group("/registrar")
	registrarRoutes.Use(middleware.RoleRequired("registrar"))
	{
		registrarRoutes.GET("/patients", controllers.GetPatients)
		registrarRoutes.POST("/patients", controllers.RegisterPatient)
		registrarRoutes.GET("/patients/search", controllers.SearchPatient)
		registrarRoutes.GET("/patients/search/:query", controllers.SearchPatient)
		
		registrarRoutes.GET("/eligibility/check/:national_id", controllers.CheckExternalEligibility)
		registrarRoutes.POST("/eligibility/save", controllers.SavePatientEligibility)
		registrarRoutes.GET("/eligibility/history", controllers.GetEligibilityHistory)
	}
		
	// 2. Nurse & Nurse Assistant Module (คัดกรอง, วัดสัญญาณชีพ, ประวัติคัดกรอง)
	nurseRoutes := api.Group("/nurse")
	nurseRoutes.Use(middleware.RoleRequired("nurse", "nurse_assistant"))
	{
		nurseRoutes.GET("/doctors", controllers.GetDoctors)
		nurseRoutes.POST("/vitals", controllers.RecordVitalsAndTriage)
		nurseRoutes.GET("/vitals/history", controllers.GetAllScreeningHistory)
		nurseRoutes.GET("/vitals/history/:patient_id", controllers.GetScreeningHistory)
	}

	// 3. Queue Management Module (จัดการคิว สำหรับ Registrar, Nurse, Nurse Assistant)
	queueRoutes := api.Group("/queue")
	queueRoutes.Use(middleware.RoleRequired("registrar", "nurse", "nurse_assistant"))
	{
		queueRoutes.GET("/list", controllers.GetQueueList)
		queueRoutes.POST("/create", controllers.CreateQueue)
		queueRoutes.PUT("/:id/status", controllers.UpdateQueueStatus)
	}	
}