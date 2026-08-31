package routes

import (
	"clinic-backend/internal/controllers"
	"clinic-backend/internal/middleware"
	"github.com/gin-gonic/gin"
)

// API Routes Auth And Set Up Role 
func SetUpRoutes(r *gin.Engine) {
	// ส่งข้อมูลเพื่อ login และเช็ค role
	r.POST("/login", controllers.Login)

	// create group for inherit
	api := r.Group("api")
	// check jwt bearer token และแจก role
	api.Use(middleware.AuthRequired())
	
	registrarRoutes := api.Group("/registrar")
	// role check
	registrarRoutes.Use(middleware.RoleRequired("registrar"))
	{
		registrarRoutes.POST("/patients", controllers.RegisterPatient)
		// add patient registeration feature
		registrarRoutes.GET("/patients/search/:national_id", controllers.SearchPatient)
		// add patient search feature
		registrarRoutes.GET("/eligibility/check/:national_id", controllers.CheckExternalEligibility)
		// add eligibility check feature (U2)
		registrarRoutes.POST("/eligibility/save", controllers.SavePatientEligibility)
		// add eligibility save feature (U2)
	}
		
		
	nurseRoutes := api.Group("/nurse")
	nurseRoutes.Use(middleware.RoleRequired("nurse", "nurse_assistant"))
	// role check
	{
		nurseRoutes.POST("/vitals", controllers.RecordVitalsAndTriage)
		nurseRoutes.GET("/vitals/history/:patient_id", controllers.GetScreeningHistory)
	}

	queueRoutes := api.Group("/queue")
	// role check 
	queueRoutes.Use(middleware.RoleRequired("registrar", "nurse", "nurse_assistant"))
	{
		queueRoutes.GET("/list", func(c *gin.Context) {
			// Mock up for waiting func, (c * gin.Context) is just universal mailbox
			c.JSON(200, gin.H{"message": "Retrieved queue list"})
		})
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