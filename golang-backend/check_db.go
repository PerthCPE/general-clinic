package main
import (
	"fmt"
	"clinic-backend/internal/config"
	"clinic-backend/internal/models"
)
func main() {
	config.LoadConfig()
	if config.AppConfig == nil || config.AppConfig.DBHost == "" {
		config.AppConfig = &config.Config{
			DBHost:     "aws-0-ap-southeast-1.pooler.supabase.com",
			DBUser:     "postgres.kcazbnexepowjvuhmwkl",
			DBPassword: "SACLINICDATABASEPASSWORD",
			DBName:     "postgres",
			DBPort:     "6543",
			DBSSLMode:  "require",
		}
	}
	config.ConnectDB()
	db := config.DB
	
	var pc, vc, sc, mc, dc, bc, qc, docCount, fwdCount, schCount, swpCount int64
	db.Model(&models.Patient{}).Count(&pc)
	db.Model(&models.VisitRecord{}).Count(&vc)
	db.Model(&models.Screening{}).Count(&sc)
	db.Model(&models.Medicine{}).Count(&mc)
	db.Model(&models.Dispensing{}).Count(&dc)
	db.Model(&models.Billing{}).Count(&bc)
	db.Model(&models.QRPayment{}).Count(&qc)
	db.Model(&models.Document{}).Count(&docCount)
	db.Model(&models.DocumentForward{}).Count(&fwdCount)
	db.Model(&models.DoctorSchedule{}).Count(&schCount)
	db.Model(&models.ShiftSwapRequest{}).Count(&swpCount)

	fmt.Printf("\n--- DB COUNTS ---\nPatients: %d, Visits: %d, Screenings: %d, Medicines: %d, Dispensings: %d, Billings: %d, QRPayments: %d\nDocuments: %d, Forwards: %d, Doctor Schedules: %d, Swap Requests: %d\n", pc, vc, sc, mc, dc, bc, qc, docCount, fwdCount, schCount, swpCount)
}
