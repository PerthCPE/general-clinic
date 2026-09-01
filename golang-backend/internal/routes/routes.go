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
	registrarRoutes.Use(middleware.RoleRequired("registrar", "nurse", "nurse_assistant", "doctor"))
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
	nurseRoutes.Use(middleware.RoleRequired("nurse", "nurse_assistant", "registrar", "doctor"))
	{
		nurseRoutes.GET("/doctors", controllers.GetDoctors)
		nurseRoutes.POST("/vitals", controllers.RecordVitalsAndTriage)
		nurseRoutes.GET("/vitals/history", controllers.GetAllScreeningHistory)
		nurseRoutes.GET("/vitals/history/:patient_id", controllers.GetScreeningHistory)
	}

	// 3. Doctor Module (คิวตรวจ, เปิดเคสตรวจ, เปลี่ยนสถานะการตรวจ)
	doctorRoutes := api.Group("/doctor")
	doctorRoutes.Use(middleware.RoleRequired("doctor"))
	{
		doctorRoutes.GET("/me", controllers.GetMyDoctorProfile)
		doctorRoutes.GET("/queue", controllers.GetDoctorQueue)
		doctorRoutes.GET("/visits/:id", controllers.GetDoctorVisitDetail)
		doctorRoutes.PUT("/visits/:id/status", controllers.UpdateVisitStatus)

		// บันทึกผลการตรวจและวินิจฉัยโรค
		doctorRoutes.GET("/visits/:id/examination", controllers.GetExamination)
		doctorRoutes.PUT("/visits/:id/examination", controllers.SaveExamination)

		// ค้นหาประวัติเวชระเบียน (รวมผู้ป่วยที่ตรวจเสร็จไปแล้ว ไม่จำกัดวัน)
		//
		// ตั้งเป็น /patient-records ไม่ใช่ /patients/records เพราะกลุ่มนี้มี
		// /patients/:id/visits อยู่แล้ว การมี segment คงที่ปนกับ :id ในตำแหน่ง
		// เดียวกัน เสี่ยงทำให้ router ชนกันตอนเริ่มเซิร์ฟเวอร์
		doctorRoutes.GET("/patient-records", controllers.GetPatientRecords)

		// ประวัติการมาตรวจย้อนหลังของผู้ป่วย
		doctorRoutes.GET("/patients/:id/visits", controllers.GetPatientVisitHistory)
	}

	// 4. Queue Management Module (จัดการคิว สำหรับ Registrar, Nurse, Nurse Assistant)
	queueRoutes := api.Group("/queue")
	queueRoutes.Use(middleware.RoleRequired("registrar", "nurse", "nurse_assistant", "doctor"))
	{
		queueRoutes.GET("/list", controllers.GetQueueList)
		queueRoutes.POST("/create", controllers.CreateQueue)
		queueRoutes.PUT("/:id/status", controllers.UpdateQueueStatus)
	}

	// ===== ระบบย่อยที่ 1: คลังยา (Pharmacy / Dispensing) - Boonkum (B6741990) =====
	pharmacyRoutes := api.Group("/pharmacy")
	pharmacyRoutes.Use(middleware.RoleRequired("pharmacist", "doctor", "registrar"))
	{
		pharmacyRoutes.GET("/medicines", controllers.GetMedicines)
		pharmacyRoutes.GET("/medicines/:code", controllers.GetMedicineByCode)
		pharmacyRoutes.POST("/medicines/stock", controllers.UpdateMedicineStock)
		pharmacyRoutes.GET("/dispensing/:visit_id", controllers.GetDispensingByVisit)
		pharmacyRoutes.POST("/dispensing", controllers.RecordDispense)
	}

	// ===== ระบบย่อยที่ 2: การเงิน (Billing / QRPayment) - Boonkum (B6741990) =====
	billingRoutes := api.Group("/billing")
	billingRoutes.Use(middleware.RoleRequired("cashier", "pharmacist", "registrar"))
	{
		billingRoutes.GET("/visit/:visit_id", controllers.GetBillingByVisit)
		billingRoutes.POST("/calculate", controllers.CalculateBilling)
		billingRoutes.POST("/qr/generate", controllers.GenerateQRPayment)
		billingRoutes.POST("/confirm", controllers.ConfirmPayment)
	}
}
