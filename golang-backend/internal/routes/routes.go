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
	nurseRoutes.Use(middleware.RoleRequired("nurse"))
	// role check
	{
		nurseRoutes.POST("/vitals", func(c *gin.Context) {
			// Mock up for waiting func, (c * gin.Context) is just universal mailbox
			c.JSON(200, gin.H{"message": "Nurse recoreded vitals successfully"})
		}) 
	}

	queueRoutes := api.Group("/queue")
	// role check 
	queueRoutes.Use(middleware.RoleRequired("registrar", "nurse"))
	{
		queueRoutes.GET("/list", func(c *gin.Context) {
			// Mock up for waiting func, (c * gin.Context) is just universal mailbox
			c.JSON(200, gin.H{"message": "Retrieved queue list"})
		})
	}	
}