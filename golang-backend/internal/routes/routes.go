package routes

import (
	"clinic-backend/internal/config"
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

	// create group for inherit
	api := r.Group("/api")

	// ส่งข้อมูลเพื่อ login และเช็ค role (รองรับทั้ง /api/login และ /api/auth/login)
	api.POST("/login", controllers.Login)
	api.POST("/auth/login", controllers.Login)

	// Quick Test Login (dev only) — ไม่ผูก route นี้เลยถ้าไม่ใช่ dev mode กันไม่ให้ทางลัดที่
	// ไม่เช็ค password หลุดไปอยู่ใน production โดยไม่ได้ตั้งใจ (endpoint ไม่มีอยู่จริงเลย ไม่ใช่
	// แค่ตอบ 403 — ดู QuickLogin ใน controllers/auth.go สำหรับการเช็คชั้นที่สอง)
	if config.AppConfig.DevMode {
		api.POST("/dev/quick-login", controllers.QuickLogin)
	}

	// check jwt bearer token และแจก role
	api.Use(middleware.AuthRequired())

	authRoutes := api.Group("/auth")
	{
		authRoutes.PUT("/change-password", controllers.ChangePassword)
	}

	// Common Endpoints
	api.GET("/doctors", controllers.GetDoctors)

	// 1. Registrar Module (ลงทะเบียน, ค้นหาผู้ป่วย, ตรวจสอบสิทธิ์)
	registrarRoutes := api.Group("/registrar")
	{
		// Read endpoints (ค้นหา/ดูผู้ป่วย และประวัติสิทธิ์) -> registrar, nurse, nurse_assistant, doctor
		regRead := registrarRoutes.Group("")
		regRead.Use(middleware.RoleRequired("registrar", "nurse", "nurse_assistant", "doctor"))
		{
			regRead.GET("/patients", controllers.GetPatients)
			regRead.GET("/patients/search", controllers.SearchPatient)
			regRead.GET("/patients/search/:query", controllers.SearchPatient)
			regRead.GET("/eligibility/check/:national_id", controllers.CheckExternalEligibility)
			regRead.GET("/eligibility/history", controllers.GetEligibilityHistory)
		}

		// Write endpoints (สร้างผู้ป่วย และบันทึกสิทธิ์) -> registrar เท่านั้น
		regWrite := registrarRoutes.Group("")
		regWrite.Use(middleware.RoleRequired("registrar"))
		{
			regWrite.POST("/patients", controllers.RegisterPatient)
			regWrite.PUT("/patients/:id", controllers.UpdatePatient)
			regWrite.POST("/eligibility/save", controllers.SavePatientEligibility)
		}
	}

	// 2. Nurse & Nurse Assistant Module (คัดกรอง, วัดสัญญาณชีพ, ประวัติคัดกรอง)
	nurseRoutes := api.Group("/nurse")
	{
		// Read endpoints -> nurse, nurse_assistant, registrar, doctor
		nurseRead := nurseRoutes.Group("")
		nurseRead.Use(middleware.RoleRequired("nurse", "nurse_assistant", "doctor", "registrar"))
		{
			nurseRead.GET("/doctors", controllers.GetDoctors)
			nurseRead.GET("/vitals/history", controllers.GetAllScreeningHistory)
			nurseRead.GET("/vitals/history/:patient_id", controllers.GetScreeningHistory)
		}

		// Write endpoints (บันทึกสัญญาณชีพ / Triage) -> nurse, nurse_assistant เท่านั้น
		nurseWrite := nurseRoutes.Group("")
		nurseWrite.Use(middleware.RoleRequired("nurse", "nurse_assistant"))
		{
			nurseWrite.POST("/vitals", controllers.RecordVitalsAndTriage)
		}
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
	billingRoutes.Use(middleware.RoleRequired("cashier", "admin"))
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
		officerRoutes.GET("/documents/:id", controllers.GetDocumentByID)
		officerRoutes.POST("/documents", controllers.CreateDocument)
		officerRoutes.DELETE("/documents/:id", controllers.DeleteDocument)
		officerRoutes.PUT("/documents/:id/approve", controllers.ApproveDocument)
		officerRoutes.PUT("/documents/:id/status", controllers.UpdateDocumentStatus)
		officerRoutes.GET("/storage/stats", controllers.GetStorageStats)
		officerRoutes.GET("/documents/forwards", controllers.GetDocumentForwards)
		officerRoutes.POST("/documents/forward", controllers.ForwardDocument)
		officerRoutes.PUT("/documents/forwards/:id/ack", controllers.AcknowledgeDocumentForward)
		officerRoutes.DELETE("/documents/forwards/:id", controllers.DeleteDocumentForward)
		officerRoutes.GET("/recipients", controllers.GetRecipients)
	}

	// ===== 5. Admin Module =====
	adminCtrl := controllers.NewAdminController(config.DB)
	adminRoutes := api.Group("/admin")
	adminRoutes.Use(middleware.RoleRequired("admin"))
	{
		adminRoutes.GET("/users", adminCtrl.GetAccounts)
		adminRoutes.POST("/users", adminCtrl.CreateAccount)
		adminRoutes.PUT("/users/:id", adminCtrl.UpdateAccount)
		adminRoutes.PUT("/users/:id/status", adminCtrl.UpdateAccountStatus)
		adminRoutes.PUT("/users/:id/reset-password", adminCtrl.ResetPassword)
		adminRoutes.POST("/system-access", adminCtrl.CreateSystemAccess)
		adminRoutes.POST("/system-access/bulk", adminCtrl.BulkUpdateSystemAccess)
	}

	// ===== 6. Appointments Module =====
	//
	// สิทธิ์เข้าหน้าแดชบอร์ดนัดหมายเปลี่ยนนโยบายรอบนี้ (ย้อนกลับ registrar, เพิ่ม nurse_assistant
	// แบบแก้ไขได้เต็ม, เพิ่ม nurse แบบดูอย่างเดียว) แบ่งเป็น 3 กลุ่มสิทธิ์ให้ตรงกับพฤติกรรมจริง:
	apptCtrl := controllers.NewAppointmentController(config.DB)
	apptRoutes := api.Group("/appointments")
	{
		// ดูรายการนัดหมาย -> ทุก role ที่เข้าหน้านี้ได้ (PAGE_PERMISSIONS['appointment-dashboard']
		// = doctor, nurse_assistant, nurse) รวม admin ไว้ด้วยเผื่ออนาคต — nurse ดูได้อย่างเดียว
		// จึงต้องอยู่ในกลุ่มนี้ (GET) แต่ห้ามอยู่ในกลุ่มแก้ไข/สร้างด้านล่าง
		apptRead := apptRoutes.Group("")
		apptRead.Use(middleware.RoleRequired("doctor", "admin", "nurse_assistant", "nurse"))
		{
			apptRead.GET("", apptCtrl.GetAppointments)
		}

		// แก้ไขนัดหมายที่มีอยู่แล้ว (วันที่/เวลา/สถานะ) -> doctor, admin, nurse_assistant
		// registrar ถูกตัดออกทั้งหมดตามนโยบายใหม่ (เคยเพิ่มไว้ก่อนหน้านี้ ย้อนกลับแล้ว)
		// nurse ไม่อยู่ในกลุ่มนี้โดยตั้งใจ — nurse ได้สิทธิ์แบบดูอย่างเดียวเท่านั้น
		apptEdit := apptRoutes.Group("")
		apptEdit.Use(middleware.RoleRequired("doctor", "admin", "nurse_assistant"))
		{
			apptEdit.PUT("/:id/status", apptCtrl.UpdateAppointmentStatus)
			apptEdit.PUT("/:id/schedule", apptCtrl.UpdateAppointmentSchedule)
		}

		// สร้างนัดหมายใหม่ -> doctor, admin เท่านั้น (หน้า "สร้างนัดหมาย" ฝั่ง frontend เปิดให้
		// เฉพาะ doctor ผ่าน PAGE_PERMISSIONS['appointment-form'] อยู่แล้ว)
		// nurse_assistant ไม่รวม (เหมือน registrar เดิม — ได้แค่ดู/แก้ไขนัดหมายที่มีอยู่ ไม่ใช่สร้างใหม่)
		// nurse ไม่รวมเช่นกัน (read-only ต้องไม่มีสิทธิ์เขียนใดๆ เลยแม้จะยิง API ตรงก็ตาม)
		apptWrite := apptRoutes.Group("")
		apptWrite.Use(middleware.RoleRequired("doctor", "admin"))
		{
			apptWrite.POST("", apptCtrl.CreateAppointment)
		}
	}

	// ===== 7. System Utilities (Reset Database for Testing) =====
	// Expose without auth so tests don't fail with 401 Unauthorized
	systemRoutes := r.Group("/api/system")
	{
		systemRoutes.POST("/reset-db", controllers.ResetTestDatabase)
		systemRoutes.POST("/simulate-prescription", controllers.SimulateDoctorPrescription)
		systemRoutes.GET("/storage/stats", controllers.GetStorageStats)
		systemRoutes.GET("/pharmacy/queues", controllers.GetPharmacyQueues)
		systemRoutes.GET("/medicines", controllers.GetMedicines)
		systemRoutes.POST("/medicines/create", controllers.CreateMedicine)
		systemRoutes.POST("/medicines/stock", controllers.UpdateMedicineStock)
		systemRoutes.POST("/pharmacy/medicines/stock", controllers.UpdateMedicineStock)
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

