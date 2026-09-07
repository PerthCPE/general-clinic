//go:build ignore

package main

import (
	"log"
	"clinic-backend/internal/config"
)

func main() {
	config.LoadConfig()
	config.ConnectDB()

	// Drop the incorrect constraint if it exists
	err := config.DB.Exec(`ALTER TABLE appointments DROP CONSTRAINT IF EXISTS fk_doctors_appointments`).Error
	if err != nil {
		log.Println("Error dropping constraint fk_doctors_appointments:", err)
	} else {
		log.Println("Constraint fk_doctors_appointments dropped successfully")
	}

	// Just to be sure, also drop fk_appointments_doctor if we need to let AutoMigrate recreate it fresh
	err2 := config.DB.Exec(`ALTER TABLE appointments DROP CONSTRAINT IF EXISTS fk_appointments_doctor`).Error
	if err2 != nil {
		log.Println("Error dropping constraint fk_appointments_doctor:", err2)
	} else {
		log.Println("Constraint fk_appointments_doctor dropped successfully")
	}
}
