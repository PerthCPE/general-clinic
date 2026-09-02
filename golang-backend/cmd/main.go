package main

import (
	"log"

	"clinic-backend/internal/config"
	"clinic-backend/internal/routes"
	"clinic-backend/internal/simulator"
	"clinic-backend/internal/ws"

	"github.com/gin-gonic/gin"
)

func main() {
	// Load .env
	config.LoadConfig()

	// Connect postgres and update table
	config.ConnectDB()

	// Start WebSocket Hub in background
	go ws.GlobalHub.Run()

	// Start Auto-Emitter Simulator in background (ยิงคิว & คนไข้ลงทะเบียนอัตโนมัติ)
	simulator.StartAutoEmitter()

	// Start Gin API Router
	r := gin.Default()

	routes.SetUpRoutes(r)

	log.Printf("Server is starting on port %s", config.AppConfig.Port)

	err := r.Run(":" + config.AppConfig.Port)

	if err != nil {
		log.Fatal("Failed to start server. Error: ", err)
	}
}
