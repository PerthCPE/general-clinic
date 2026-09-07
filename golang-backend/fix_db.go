package main

import (
	"log"
	"clinic-backend/internal/config"
)

func main() {
	config.LoadConfig()
	config.ConnectDB()

	err := config.DB.Exec(`ALTER TABLE appointments DROP CONSTRAINT IF EXISTS fk_doctors_appointments`).Error
	if err != nil {
		log.Println("Error dropping constraint:", err)
	} else {
		log.Println("Constraint dropped successfully")
	}

	// Also fix appointment_time column type if needed
	err2 := config.DB.Exec(`ALTER TABLE appointments ALTER COLUMN appointment_time TYPE time USING appointment_time::time`).Error
	if err2 != nil {
		log.Println("Error altering column:", err2)
	} else {
		log.Println("Column altered successfully")
	}
}
