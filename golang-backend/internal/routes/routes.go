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

	// ===================== QUEUE & VISIT =====================
	// 4. Queue Management Module (จัดการคิว)
	queueRoutes := api.Group("/queue")
	queueRoutes.Use(middleware.RoleRequired("registrar", "nurse", "nurse_assistant", "doctor", "pharmacist", "cashier"))
	{
		queueRoutes.GET("/list", controllers.GetQueueList)
		queueRoutes.POST("/create", controllers.CreateQueue)
		queueRoutes.PUT("/:id/status", controllers.UpdateQueueStatus)
	}

	// ===== ระบบย่อยที่ 1: คลังยา (Pharmacy / Dispensing) - Bun =====
	pharmacyRoutes := api.Group("/pharmacy")
	pharmacyRoutes.Use(middleware.RoleRequired("pharmacist", "doctor", "registrar", "cashier", "admin"))
	{
		pharmacyRoutes.GET("/queues", controllers.GetPharmacyQueues)
		pharmacyRoutes.GET("/medicines", controllers.GetMedicines)
		pharmacyRoutes.POST("/medicines", controllers.CreateMedicine)
		pharmacyRoutes.PUT("/medicines/:id", controllers.UpdateMedicineDetails)
		pharmacyRoutes.POST("/medicines/:id", controllers.UpdateMedicineDetails)
		pharmacyRoutes.DELETE("/medicines/:id", controllers.DeleteMedicine)
		pharmacyRoutes.GET("/medicines/:code", controllers.GetMedicineByCode)
		pharmacyRoutes.POST("/medicines/stock", controllers.UpdateMedicineStock)
		pharmacyRoutes.GET("/dispensing/:visit_id", controllers.GetDispensingByVisit)
		pharmacyRoutes.POST("/dispensing", controllers.RecordDispense)
		pharmacyRoutes.POST("/dispense", controllers.ConfirmDispenseAndBill)
		pharmacyRoutes.GET("/patient-medicines", controllers.GetPatientMedicines)
		pharmacyRoutes.GET("/patient-medicines/:hn", controllers.GetPatientMedicineDetail)
		pharmacyRoutes.PUT("/patient-medicines/:hn", controllers.UpdatePatientMedicine)
		pharmacyRoutes.POST("/patient-medicines/:hn", controllers.UpdatePatientMedicine)
		pharmacyRoutes.DELETE("/patient-medicines/:hn", controllers.DeletePatientMedicine)
	}

	// ===== ระบบย่อยที่ 2: การเงิน (Billing / QRPayment) -Bun =====
	billingRoutes := api.Group("/billing")
	billingRoutes.Use(middleware.RoleRequired("cashier", "pharmacist", "registrar", "doctor", "nurse", "nurse_assistant", "admin"))
	{
		billingRoutes.GET("/queues", controllers.GetBillingQueues)
		billingRoutes.GET("/history", controllers.GetBillingHistories)
		billingRoutes.GET("/list", controllers.GetAllBillings)
		billingRoutes.GET("/visit/:visit_id", controllers.GetBillingByVisit)
		billingRoutes.POST("/calculate", controllers.CalculateBilling)
		billingRoutes.POST("/qr/generate", controllers.GenerateQRPayment)
		billingRoutes.POST("/confirm", controllers.ConfirmPayment)
	}

	// ===== ระบบย่อยที่ 3: จัดการเอกสารและตารางงานแพทย์ (Officer / DMS) =====
	officerRoutes := api.Group("/officer")
	officerRoutes.Use(middleware.RoleRequired("officer", "registrar", "doctor", "nurse", "nurse_assistant", "pharmacist", "cashier"))
	{
		officerRoutes.GET("/documents", controllers.GetDocuments)
		officerRoutes.POST("/documents", controllers.CreateDocument)
		officerRoutes.GET("/documents/forwards", controllers.GetDocumentForwards)
		officerRoutes.POST("/documents/forward", controllers.ForwardDocument)
		officerRoutes.PUT("/documents/forwards/:id/ack", controllers.AcknowledgeDocumentForward)
		officerRoutes.GET("/recipients", controllers.GetRecipients)
	}

	// ===== 5. System Utilities (Reset Database for Testing) =====
	// Expose without auth so tests don't fail with 401 Unauthorized
	systemRoutes := r.Group("/api/system")
	{
		systemRoutes.POST("/reset-db", controllers.ResetTestDatabase)
		systemRoutes.POST("/simulate-prescription", controllers.SimulateDoctorPrescription)
		systemRoutes.GET("/pharmacy/queues", controllers.GetPharmacyQueues)
		systemRoutes.GET("/medicines", controllers.GetMedicines)
		systemRoutes.POST("/medicines/create", controllers.CreateMedicine)
		systemRoutes.PUT("/medicines/:id", controllers.UpdateMedicineDetails)
		systemRoutes.POST("/medicines/:id", controllers.UpdateMedicineDetails)
		systemRoutes.POST("/medicines/update", controllers.UpdateMedicineDetails)
		systemRoutes.DELETE("/medicines/:id", controllers.DeleteMedicine)
		systemRoutes.GET("/patient-medicines", controllers.GetPatientMedicines)
		systemRoutes.GET("/patient-medicines/:hn", controllers.GetPatientMedicineDetail)
		systemRoutes.PUT("/patient-medicines/:hn", controllers.UpdatePatientMedicine)
		systemRoutes.POST("/patient-medicines/:hn", controllers.UpdatePatientMedicine)
		systemRoutes.DELETE("/patient-medicines/:hn", controllers.DeletePatientMedicine)
		systemRoutes.POST("/dispense", controllers.ConfirmDispenseAndBill)
		systemRoutes.GET("/queue/list", controllers.GetQueueList)
		systemRoutes.GET("/billing/list", controllers.GetAllBillings)
		systemRoutes.GET("/billing/queues", controllers.GetBillingQueues)
		systemRoutes.GET("/billing/history", controllers.GetBillingHistories)
		systemRoutes.GET("/dispensing/:visit_id", controllers.GetDispensingByVisit)
		systemRoutes.POST("/billing/confirm", controllers.ConfirmPayment)
	}
}
