package main
import (
	"log"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"clinic-backend/internal/models"
)
func main() {
	dsn := "host=aws-0-ap-southeast-1.pooler.supabase.com user=postgres.kcazbnexepowjvuhmwkl password=SACLINICDATABASEPASSWORD dbname=postgres port=6543 sslmode=require TimeZone=Asia/Bangkok"
	db, err := gorm.Open(postgres.New(postgres.Config{
		DSN: dsn,
		PreferSimpleProtocol: true,
	}), &gorm.Config{ PrepareStmt: false })
	if err != nil {
		log.Fatal(err)
	}
	
	log.Println("Dropping all tables...")
	err = db.Migrator().DropTable(&models.QRPayment{}, &models.Billing{}, &models.Dispensing{}, &models.Screening{}, &models.Queue{}, &models.VisitRecord{}, &models.MedicalEligibility{}, &models.Patient{}, &models.Medicine{}, &models.DoctorSchedule{}, &models.LeaveRequest{}, &models.ShiftSwapRequest{}, &models.DocumentForward{}, &models.Document{}, &models.Doctor{}, &models.User{})
	if err != nil {
		log.Fatal(err)
	}
	log.Println("Tables dropped.")
}
