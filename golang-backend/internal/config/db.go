package config

import (
	"fmt"
	"log"
	"time" // [เพิ่ม] ใช้งานสำหรับตั้งค่า Connection Pool Timeouts Bun เพิ่มมา

	"clinic-backend/internal/models"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// define global db for handler/controller
var DB *gorm.DB

func ConnectDB() {
	// ประกอบ Data from AppConfig
	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=%s TimeZone=Asia/Bangkok",
		AppConfig.DBHost,
		AppConfig.DBUser,
		AppConfig.DBPassword,
		AppConfig.DBName,
		AppConfig.DBPort,
		AppConfig.DBSSLMode,
	)

	// gorm connect to db (เปิด PreferSimpleProtocol: true เพื่อรองรับ Supabase / PgBouncer Pooler)
	database, err := gorm.Open(postgres.New(postgres.Config{
		DSN:                  dsn,
		PreferSimpleProtocol: true,
	}), &gorm.Config{
		PrepareStmt: false,
	})

	if err != nil {
		log.Fatal("Failed to connect database. Error: ", err)
	}

	// ========================================================================= Bun เพิ่มมา
	// [เพิ่มตรงนี้] ⚡ ตั้งค่า Database Connection Pool เพื่อเพิ่มความเร็วในการ Query
	// ช่วย Reuse TCP/SSL Connection เดิม ไม่ต้องเสียเวลา Handshake ใหม่ทุกครั้งที่ส่งคำสั่ง SQL
	// =========================================================================
	sqlDB, err := database.DB()
	if err == nil {
		sqlDB.SetMaxIdleConns(10)                  // จำนวน Connection สำรองรอใช้งาน (ลดเวลาสร้าง connection ใหม่)
		sqlDB.SetMaxOpenConns(50)                  // จำนวน Connection สูงสุดที่เปิดพร้อมกัน
		sqlDB.SetConnMaxLifetime(time.Hour)        // อายุสูงสุดของ Connection (1 ชั่วโมง)
		sqlDB.SetConnMaxIdleTime(10 * time.Minute) // ระยะเวลาพัก Connection ถ้าไม่ได้ใช้งาน
		log.Println("Database Connection Pool Configured Successfully (Idle: 10, Max: 50)")
	}
	// =========================================================================

	log.Println("Database Connection Established Successfully")

	var tableCount int64
	database.Raw(`SELECT count(*) FROM information_schema.tables
		WHERE table_schema = CURRENT_SCHEMA()
		  AND table_name IN (
			'users', 'patients', 'queues', 'screenings',
			'patient_medicines', 'patient_histories', 'examinations', 'diagnoses'
		)`).Scan(&tableCount)

	if tableCount < 8 {
		log.Println("Tables missing or incomplete. Running AutoMigrate...")
		err = database.AutoMigrate(
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
			&models.PatientMedicine{},
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
			log.Fatal("Database Migration Failed. Error: ", err)
		}
		log.Println("Database Migration Complete.")
	} else {
		// Always ensure new models are migrated
		database.AutoMigrate(&models.PatientMedicine{}, &models.BillingQueue{}, &models.MedicineQueue{})
		log.Println("Database schema already up to date. Skipped redundant AutoMigrate.")
	}

	database.Exec("ALTER TABLE screenings ADD COLUMN IF NOT EXISTS pain_score integer DEFAULT 0")
	database.Exec("ALTER TABLE screenings ADD COLUMN IF NOT EXISTS blood_sugar integer DEFAULT 0")
	database.Exec("ALTER TABLE screenings ADD COLUMN IF NOT EXISTS food_allergies text DEFAULT ''")
	database.Exec("ALTER TABLE screenings ADD COLUMN IF NOT EXISTS current_medications text DEFAULT ''")
	database.Exec("ALTER TABLE screenings ADD COLUMN IF NOT EXISTS smoking_history text DEFAULT ''")
	database.Exec("ALTER TABLE screenings ADD COLUMN IF NOT EXISTS alcohol_history text DEFAULT ''")

	// ⚡ Database Indexes สำหรับเร่งความเร็วการ Query คิว, คนไข้, ประวัติการเงิน บน Supabase
	database.Exec("CREATE INDEX IF NOT EXISTS idx_queues_created_at ON queues(created_at)")
	database.Exec("CREATE INDEX IF NOT EXISTS idx_queues_status ON queues(status)")
	database.Exec("CREATE INDEX IF NOT EXISTS idx_queues_status_dept ON queues(status, department)")
	database.Exec("CREATE INDEX IF NOT EXISTS idx_queues_visit_id ON queues(visit_id)")
	database.Exec("CREATE INDEX IF NOT EXISTS idx_medicine_queues_status_visit ON medicine_queues(status, visit_id)")
	database.Exec("CREATE INDEX IF NOT EXISTS idx_medicine_queues_hn ON medicine_queues(hn)")
	database.Exec("CREATE INDEX IF NOT EXISTS idx_billing_queues_status ON billing_queues(status)")
	database.Exec("CREATE INDEX IF NOT EXISTS idx_billing_queues_status_visit ON billing_queues(status, visit_id)")
	database.Exec("CREATE INDEX IF NOT EXISTS idx_billings_visit_status ON billings(visit_id, payment_status)")
	database.Exec("CREATE INDEX IF NOT EXISTS idx_billing_histories_created_at ON billing_histories(created_at)")
	database.Exec("CREATE INDEX IF NOT EXISTS idx_billing_histories_visit_hn ON billing_histories(visit_id, hn)")
	database.Exec("CREATE INDEX IF NOT EXISTS idx_dispensings_visit_id ON dispensings(visit_id)")
	database.Exec("CREATE INDEX IF NOT EXISTS idx_patient_medicines_hn ON patient_medicines(hn)")
	database.Exec("CREATE INDEX IF NOT EXISTS idx_patients_hn ON patients(hn)")
	database.Exec("CREATE INDEX IF NOT EXISTS idx_medicines_code_name ON medicines(medicine_code, name)")
	database.Exec("CREATE INDEX IF NOT EXISTS idx_visit_records_patient_id ON visit_records(patient_id)")

	DB = database

	seedDoctorProfiles()
	seedDatabase()
}

func seedDoctorProfiles() {
	var doctorUsers []models.User
	if err := DB.Where("role = ?", "doctor").Order("id asc").Find(&doctorUsers).Error; err != nil {
		log.Println("Skip doctor profile seeding:", err)
		return
	}

	specialties := []string{"อายุรกรรมทั่วไป", "เวชศาสตร์ครอบครัว", "กุมารเวชกรรม"}
	created := 0

	for i, u := range doctorUsers {
		var count int64
		DB.Model(&models.Doctor{}).Where("user_id = ?", u.ID).Count(&count)
		if count > 0 {
			continue
		}

		profile := models.Doctor{
			UserID:        u.ID,
			FullName:      u.FullName,
			LicenseNumber: fmt.Sprintf("MD-%05d", u.ID),
			Specialty:     specialties[i%len(specialties)],
			Phone:         u.Phone,
			Email:         fmt.Sprintf("%s@clinic.local", u.Username),
			Room:          fmt.Sprintf("ห้องตรวจ %d", i+1),
			IsActive:      true,
		}

		if err := DB.Create(&profile).Error; err != nil {
			log.Printf("Failed to seed doctor profile for user %d: %v", u.ID, err)
			continue
		}
		created++
	}

	if created > 0 {
		log.Printf("Doctor profiles seeded successfully (%d records).", created)
	}
}

func seedDatabase() {
	hashPassword, _ := bcrypt.GenerateFromPassword([]byte("password"), 10)
	passStr := string(hashPassword)

	// 1. Seed Users & Doctors
	users := []models.User{
		{Username: "officer1", Password: passStr, Role: "officer", FullName: "คุณสมจิต ดีใจ", Phone: "081-555-0001"},
		{Username: "registrar1", Password: passStr, Role: "registrar", FullName: "นายสมเกียรติ ยินดีต้อนรับ", Phone: "081-111-0001"},
		{Username: "nurse1", Password: passStr, Role: "nurse", FullName: "พว. กานดา คัดกรอง", Phone: "081-111-0002"},
		{Username: "assistant1", Password: passStr, Role: "nurse_assistant", FullName: "นายสมคิด ช่วยเหลือดี", Phone: "081-111-0003"},
		{Username: "pharmacist1", Password: passStr, Role: "pharmacist", FullName: "ภก.บุญชู เภสัชกร", Phone: "081-333-0001"},
		{Username: "cashier1", Password: passStr, Role: "cashier", FullName: "นส.รวย การเงิน", Phone: "081-444-0001"},
		{Username: "doctor1", Password: passStr, Role: "doctor", FullName: "พญ.สุดา สุขสมบูรณ์", Phone: "081-222-0001"},
		{Username: "doctor2", Password: passStr, Role: "doctor", FullName: "นพ.วิชัย ชาญการแพทย์", Phone: "081-222-0002"},
		{Username: "doctor3", Password: passStr, Role: "doctor", FullName: "พญ.เกศรา รักษาดี", Phone: "081-222-0003"},
	}
	for i := range users {
		var existing models.User
		if err := DB.Where("username = ?", users[i].Username).First(&existing).Error; err != nil {
			DB.Create(&users[i])
		}
	}
	log.Println("Users & Doctors verified and seeded successfully.")

	// 2. Seed Medicines (if empty)
	var medCount int64
	DB.Model(&models.Medicine{}).Count(&medCount)
	if medCount == 0 {
		medicines := []models.Medicine{
			{MedicineCode: "MED-001", Name: "Paracetamol 500mg", GenericName: "Paracetamol (Acetaminophen)", Category: "ยาลดไข้ บรรเทาปวด", Properties: "บรรเทาอาการปวดเล็กน้อยถึงปานกลาง และลดไข้", Dosage: "ครั้งละ 1-2 เม็ด ทุก 4-6 ชม.", Manufacturer: "สยามเภสัช", StockQuantity: 1000, UnitPrice: 10.0},
			{MedicineCode: "MED-002", Name: "Amoxicillin 500mg", GenericName: "Amoxicillin Trihydrate", Category: "ยาปฏิชีวนะ ฆ่าเชื้อแบคทีเรีย", Properties: "รักษาการติดเชื้อแบคทีเรียระบบทางเดินหายใจ ทางเดินปัสสาวะ", Dosage: "ครั้งละ 1 แคปซูล วันละ 3 ครั้ง หลังอาหาร", Manufacturer: "องค์การเภสัชกรรม (GPO)", StockQuantity: 48, UnitPrice: 50.0},
			{MedicineCode: "MED-003", Name: "Ibuprofen 400mg", GenericName: "Ibuprofen (NSAID)", Category: "ยาต้านการอักเสบ (NSAIDs)", Properties: "ลดการอักเสบ ปวดข้อ ปวดกล้ามเนื้อ ปวดฟัน", Dosage: "ครั้งละ 1 เม็ด วันละ 2-3 ครั้ง หลังอาหารทันที", Manufacturer: "เบอร์ลินซัพพลาย", StockQuantity: 0, UnitPrice: 30.0},
			{MedicineCode: "MED-004", Name: "Cetirizine 10mg", GenericName: "Cetirizine Dihydrochloride", Category: "ยาแก้อาการแพ้ ต้านฮิสตามีน", Properties: "รักษาอาการแพ้อากาศ ลมพิษ น้ำมูกไหล จาม คันตา", Dosage: "ครั้งละ 1 เม็ด วันละ 1 ครั้ง ก่อนนอน", Manufacturer: "เมดฮับ ฟาร์มาซูติคอล", StockQuantity: 600, UnitPrice: 15.0},
			{MedicineCode: "MED-005", Name: "Omeprazole 20mg", GenericName: "Omeprazole Magnesium", Category: "ยาลดกรดในกระเพาะอาหาร", Properties: "รักษาโรคกรดไหลย้อน แผลในกระเพาะอาหาร", Dosage: "ครั้งละ 1 เม็ด วันละ 1 ครั้ง ก่อนอาหารเช้า 30 นาที", Manufacturer: "แอสตร้าเซนเนก้า", StockQuantity: 400, UnitPrice: 25.0},
			{MedicineCode: "MED-006", Name: "Amlodipine 5mg", GenericName: "Amlodipine Besylate", Category: "ยาลดความดันโลหิต", Properties: "ควบคุมระดับความดันโลหิต ป้องกันภาวะเจ็บหน้าอก", Dosage: "ครั้งละ 1 เม็ด วันละ 1 ครั้ง ตอนเช้า", Manufacturer: "ไฟเซอร์ (Pfizer)", StockQuantity: 30, UnitPrice: 20.0},
			{MedicineCode: "MED-007", Name: "Metformin 500mg", GenericName: "Metformin Hydrochloride", Category: "ยาควบคุมระดับน้ำตาล (เบาหวาน)", Properties: "ลดการสร้างน้ำตาลที่ตับ และเพิ่มความไวต่ออินซูลิน", Dosage: "ครั้งละ 1 เม็ด พร้อมอาหารเช้า-เย็น", Manufacturer: "สยามเภสัช", StockQuantity: 700, UnitPrice: 12.0},
			{MedicineCode: "MED-008", Name: "Losartan 50mg", GenericName: "Losartan Potassium", Category: "ยาลดความดันโลหิต", Properties: "ขยายหลอดเลือด ลดความดันโลหิตและปกป้องไต", Dosage: "ครั้งละ 1 เม็ด วันละ 1 ครั้ง", Manufacturer: "เอ็มเอสดี (MSD)", StockQuantity: 450, UnitPrice: 40.0},
			{MedicineCode: "MED-009", Name: "Bromhexine 8mg", GenericName: "Bromhexine Hydrochloride", Category: "ยาละลายเสมหะ", Properties: "ช่วยขับเสมหะ ละลายเสมหะที่เหนียวข้นในทางเดินหายใจ", Dosage: "ครั้งละ 1 เม็ด วันละ 3 ครั้ง หลังอาหาร", Manufacturer: "เมดฮับ ฟาร์มาซูติคอล", StockQuantity: 350, UnitPrice: 18.0},
			{MedicineCode: "MED-010", Name: "Dextromethorphan 15mg", GenericName: "Dextromethorphan HBr", Category: "ยากดอาการไอ", Properties: "บรรเทาอาการไอแห้ง ไอไม่มีเสมหะ", Dosage: "ครั้งละ 1 เม็ด ทุก 6-8 ชั่วโมง เมื่อมีอาการ", Manufacturer: "สยามเภสัช", StockQuantity: 25, UnitPrice: 15.0},
			{MedicineCode: "MED-011", Name: "ORSLyte Oral Rehydration Salts", GenericName: "Oral Rehydration Salts (ORS)", Category: "เกลือแร่ทดแทนน้ำ", Properties: "ชดเชยการสูญเสียน้ำและเกลือแร่จากอาการท้องเสีย ท้องร่วง", Dosage: "ละลายน้ำสะอาด 250ml จิบเรื่อยๆ เมื่อถ่ายเหลว", Manufacturer: "องค์การเภสัชกรรม (GPO)", StockQuantity: 800, UnitPrice: 8.0},
			{MedicineCode: "MED-012", Name: "Simethicone 80mg", GenericName: "Simethicone Chewable", Category: "ยาขับลม ขับแก๊ส", Properties: "บรรเทาอาการท้องอืด ท้องเฟ้อ แน่นท้อง จากแก๊สในกระเพาะ", Dosage: "เคี้ยวครั้งละ 1 เม็ด หลังอาหาร 3 เวลา", Manufacturer: "เบอร์ลินซัพพลาย", StockQuantity: 500, UnitPrice: 10.0},
		}
		for i := range medicines {
			DB.Create(&medicines[i])
		}
		log.Println("Medicines seeded successfully with full metadata.")
	}
	// 8. Seed Documents & Document Forwards (Officer Module - Independent check)
	var docCount int64
	DB.Model(&models.Document{}).Count(&docCount)
	if docCount == 0 {
		var officerUser models.User
		if err := DB.Where("username = ?", "officer1").First(&officerUser).Error; err != nil {
			officerUser = users[0]
		}

		docs := []models.Document{
			{ExternalDocRef: "สธ 0201/2569", Subject: "แนวทางการควบคุมโรคติดต่อทางเดินหายใจ ประจำปี 2569", FileURL: "https://example.com/docs/guidelines_2569.pdf", CreatedBy: officerUser.ID},
			{ExternalDocRef: "สปสช. 1102/2569", Subject: "ประกาศปรับปรุงอัตราค่าชดเชยค่าบริการทางการแพทย์ใหม่", FileURL: "https://example.com/docs/nhso_rates.pdf", CreatedBy: officerUser.ID},
			{ExternalDocRef: "อย. 4405/2569", Subject: "แจ้งเตือนการเฝ้าระวังยาควบคุมพิเศษกลุ่มต้านการอักเสบ", FileURL: "https://example.com/docs/fda_alert.pdf", CreatedBy: officerUser.ID},
			{ExternalDocRef: "รพ. 8812/2569", Subject: "หนังสือประสานงานแนวทางการส่งต่อผู้ป่วยฉุกเฉิน (Referral System)", FileURL: "https://example.com/docs/referral_network.pdf", CreatedBy: officerUser.ID},
		}
		for i := range docs {
			DB.Create(&docs[i])
		}
		log.Println("Documents seeded successfully into Database.")

		var doctorUser, nurseUser, cashierUser, pharmacistUser models.User
		DB.Where("username = ?", "doctor1").First(&doctorUser)
		DB.Where("username = ?", "nurse1").First(&nurseUser)
		DB.Where("username = ?", "cashier1").First(&cashierUser)
		DB.Where("username = ?", "pharmacist1").First(&pharmacistUser)

		forwards := []models.DocumentForward{
			{DocID: docs[0].ID, ForwardedTo: doctorUser.ID, Status: "Acknowledged"},
			{DocID: docs[0].ID, ForwardedTo: nurseUser.ID, Status: "Pending"},
			{DocID: docs[1].ID, ForwardedTo: cashierUser.ID, Status: "Pending"},
			{DocID: docs[2].ID, ForwardedTo: pharmacistUser.ID, Status: "Acknowledged"},
		}
		for i := range forwards {
			if forwards[i].ForwardedTo > 0 {
				DB.Create(&forwards[i])
			}
		}
		log.Println("Document Forwards seeded successfully into Database.")
	}

	// 9. Seed Doctor Schedules (Officer Module - Independent check)
	var schCount int64
	DB.Model(&models.DoctorSchedule{}).Count(&schCount)
	if schCount == 0 {
		var doctorProfiles []models.Doctor
		DB.Order("id asc").Find(&doctorProfiles)
		if len(doctorProfiles) > 0 {
			var officerUser models.User
			DB.Where("username = ?", "officer1").First(&officerUser)

			now := time.Now()
			for d := 0; d < 7; d++ {
				workDate := now.AddDate(0, 0, d)
				for i, doc := range doctorProfiles {
					shiftType := "Morning"
					if (i+d)%2 == 1 {
						shiftType = "Afternoon"
					}
					sch := models.DoctorSchedule{
						DoctorID:  doc.ID,
						WorkDate:  workDate,
						ShiftType: shiftType,
						Status:    "Published",
						CreatedBy: officerUser.ID,
					}
					DB.Create(&sch)
				}
			}
			log.Println("Doctor Schedules seeded successfully into Database.")
		}
	}
}
