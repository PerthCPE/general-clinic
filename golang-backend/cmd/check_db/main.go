package main

import (
	"clinic-backend/internal/config"
	"clinic-backend/internal/models"
	"fmt"
)

func main() {
	config.AppConfig = &config.Config{
		DBHost:     "aws-0-ap-southeast-1.pooler.supabase.com",
		DBUser:     "postgres.kcazbnexepowjvuhmwkl",
		DBPassword: "SACLINICDATABASEPASSWORD",
		DBName:     "postgres",
		DBPort:     "6543",
		DBSSLMode:  "require",
	}
	config.ConnectDB()
	db := config.DB

	var pc, vc, sc, mc, dc, bc, qc int64
	db.Model(&models.Patient{}).Count(&pc)
	db.Model(&models.VisitRecord{}).Count(&vc)
	db.Model(&models.Screening{}).Count(&sc)
	db.Model(&models.Medicine{}).Count(&mc)
	db.Model(&models.Dispensing{}).Count(&dc)
	db.Model(&models.Billing{}).Count(&bc)
	db.Model(&models.QRPayment{}).Count(&qc)
	fmt.Printf("\n--- DB COUNTS ---\nPatients: %d, Visits: %d, Screenings: %d, Medicines: %d, Dispensings: %d, Billings: %d, QRPayments: %d\n", pc, vc, sc, mc, dc, bc, qc)
}
