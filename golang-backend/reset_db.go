package main
import (
	"log"
	"clinic-backend/internal/config"
	"clinic-backend/internal/models"
)
func main() {
	config.AppConfig = &config.Config{
		DBHost: "aws-0-ap-southeast-1.pooler.supabase.com",
		DBUser: "postgres.kcazbnexepowjvuhmwkl",
		DBPassword: "SACLINICDATABASEPASSWORD",
		DBName: "postgres",
		DBPort: "6543",
		DBSSLMode: "require",
	}
	config.ConnectDB()
	db := config.DB
	
	log.Println("Dropping all tables...")
	db.Migrator().DropTable(&models.QRPayment{}, &models.Billing{}, &models.Dispensing{}, &models.Screening{}, &models.Queue{}, &models.VisitRecord{}, &models.MedicalEligibility{}, &models.Patient{}, &models.Medicine{}, &models.Doctor{}, &models.User{})
	log.Println("Tables dropped.")
}
