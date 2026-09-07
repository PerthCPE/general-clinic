package main

// บุญเอาไว้รัน Docker
import (
	"fmt"
	"log"
	"time"

	"clinic-backend/internal/models"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func main() {
	fmt.Println("==================================================")
	fmt.Println("🚀 กำลังเริ่มดึงข้อมูลจาก Supabase Cloud มายัง Local Database...")
	fmt.Println("==================================================")

	// 1. เชื่อมต่อ Supabase (Source)
	remoteDSN := "host=aws-0-ap-southeast-1.pooler.supabase.com user=postgres.kcazbnexepowjvuhmwkl password=SACLINICDATABASEPASSWORD dbname=postgres port=6543 sslmode=require TimeZone=Asia/Bangkok"
	remoteDB, err := gorm.Open(postgres.New(postgres.Config{
		DSN:                  remoteDSN,
		PreferSimpleProtocol: true,
	}), &gorm.Config{})
	if err != nil {
		log.Fatalf("❌ ไม่สามารถเชื่อมต่อ Supabase Cloud ได้: %v", err)
	}
	fmt.Println("✅ 1/3 เชื่อมต่อ Supabase Cloud สำเร็จ")

	// 2. เชื่อมต่อ Local PostgreSQL (Destination)
	localDSN := "host=localhost user=postgres password=postgres dbname=general_clinic port=5433 sslmode=disable TimeZone=Asia/Bangkok"
	localDB, err := gorm.Open(postgres.Open(localDSN), &gorm.Config{})
	if err != nil {
		log.Fatalf("❌ ไม่สามารถเชื่อมต่อ Local PostgreSQL (localhost:5432) ได้\nกรุณาตรวจสอบว่าเปิด Docker และรัน 'docker compose up -d' แล้วหรือยัง: %v", err)
	}
	fmt.Println("✅ 2/3 เชื่อมต่อ Local PostgreSQL สำเร็จ")

	// 3. ทำ AutoMigrate ใน Local เพื่อสร้าง Table ทั้งหมด
	fmt.Println("⏳ กำลังเตรียมโครงสร้างตาราง (Migrate) ใน Local Database...")
	err = localDB.AutoMigrate(
		&models.User{},
		&models.Doctor{},
		&models.Patient{},
		&models.PatientMedicine{},
		&models.MedicalEligibility{},
		&models.VisitRecord{},
		&models.Queue{},
		&models.Screening{},
		&models.Medicine{},
		&models.Dispensing{},
		&models.Billing{},
		&models.BillingQueue{},
		&models.BillingHistory{},
		&models.MedicineQueue{},
		&models.QRPayment{},
		&models.Document{},
		&models.DocumentForward{},
		&models.DoctorSchedule{},
		&models.LeaveRequest{},
		&models.ShiftSwapRequest{},
		&models.PatientHistory{},
		&models.Examination{},
		&models.Diagnosis{},
	)
	if err != nil {
		log.Fatalf("❌ AutoMigrate ล้มเหลว: %v", err)
	}

	// 4. ทำการคัดลอกข้อมูลทุก Table จาก Supabase มายัง Local
	fmt.Println("⏳ กำลังคัดลอกข้อมูลทุกตาราง...")
	startTime := time.Now()

	syncTable(remoteDB, localDB, "users", &[]models.User{})
	syncTable(remoteDB, localDB, "doctors", &[]models.Doctor{})
	syncTable(remoteDB, localDB, "patients", &[]models.Patient{})
	syncTable(remoteDB, localDB, "medicines", &[]models.Medicine{})
	syncTable(remoteDB, localDB, "patient_medicines", &[]models.PatientMedicine{})
	syncTable(remoteDB, localDB, "medical_eligibilities", &[]models.MedicalEligibility{})
	syncTable(remoteDB, localDB, "visit_records", &[]models.VisitRecord{})
	syncTable(remoteDB, localDB, "queues", &[]models.Queue{})
	syncTable(remoteDB, localDB, "screenings", &[]models.Screening{})
	syncTable(remoteDB, localDB, "dispensings", &[]models.Dispensing{})
	syncTable(remoteDB, localDB, "billings", &[]models.Billing{})
	syncTable(remoteDB, localDB, "billing_queues", &[]models.BillingQueue{})
	syncTable(remoteDB, localDB, "billing_histories", &[]models.BillingHistory{})
	syncTable(remoteDB, localDB, "medicine_queues", &[]models.MedicineQueue{})
	syncTable(remoteDB, localDB, "qr_payments", &[]models.QRPayment{})
	syncTable(remoteDB, localDB, "documents", &[]models.Document{})
	syncTable(remoteDB, localDB, "document_forwards", &[]models.DocumentForward{})
	syncTable(remoteDB, localDB, "doctor_schedules", &[]models.DoctorSchedule{})
	syncTable(remoteDB, localDB, "leave_requests", &[]models.LeaveRequest{})
	syncTable(remoteDB, localDB, "shift_swap_requests", &[]models.ShiftSwapRequest{})
	syncTable(remoteDB, localDB, "patient_histories", &[]models.PatientHistory{})
	syncTable(remoteDB, localDB, "examinations", &[]models.Examination{})
	syncTable(remoteDB, localDB, "diagnoses", &[]models.Diagnosis{})

	duration := time.Since(startTime)
	fmt.Println("==================================================")
	fmt.Printf("🎉 ดึงข้อมูลจาก Supabase มายังเครื่องเสร็จสมบูรณ์ 100%%! (ใช้เวลาเพียง %.2f วินาที)\n", duration.Seconds())
	fmt.Println("👉 ตอนนี้คุณสามารถรัน 'go run ./cmd/main.go' แล้วใช้งานได้แบบเร็วแรง 0-2 ms ทันที!")
	fmt.Println("==================================================")
}

func syncTable(remoteDB, localDB *gorm.DB, tableName string, slicePtr interface{}) {
	// ดึงข้อมูลทั้งหมดจาก Supabase
	if err := remoteDB.Find(slicePtr).Error; err != nil {
		fmt.Printf("⚠️  ข้ามตาราง %s (ไม่พบหรือยังไม่มีข้อมูลใน Cloud)\n", tableName)
		return
	}

	// บันทึก/อัปเดตลง Local Database
	if err := localDB.Clauses(clause.OnConflict{UpdateAll: true}).Create(slicePtr).Error; err != nil {
		localDB.Save(slicePtr)
	}

	var count int64
	localDB.Table(tableName).Count(&count)
	fmt.Printf("  ✓ ตาราง '%s': ซิงค์แล้ว %d รายการ\n", tableName, count)
}
