package config

import (
	"fmt"
	"log"
	"time"

	"clinic-backend/internal/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"golang.org/x/crypto/bcrypt"
)

// define global db for handler/controller
var	DB *gorm.DB

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
		PreferSimpleProtocol: true, // ปิด Prepared Statement Cache แก้ปัญหา prepared statement does not exist (SQLSTATE 26000)
	}), &gorm.Config{
		PrepareStmt: false,
	})

	if err != nil {
		log.Fatal("Failed to connect database. Error: ", err)
	}

	log.Println("Database Connection Established Successfully")

	// table create by migration (AutoMigrate ครบทุก Model ในระบบ 100%)
	err = database.AutoMigrate(
		&models.User{},
		&models.Doctor{},
		&models.Patient{},
		&models.MedicalEligibility{},
		&models.VisitRecord{},
		&models.Queue{},
		&models.Screening{},
		&models.Medicine{},
		&models.Dispensing{},
		&models.Billing{},
		&models.QRPayment{},
		&models.Document{},
		&models.DocumentForward{},
		&models.DoctorSchedule{},
		&models.LeaveRequest{},
		&models.ShiftSwapRequest{},
	)

	// if error founded, notice
	if err != nil {
		log.Fatal("Database Migration Failed. Error: ", err)
	}
	log.Println("Database Migration Complete.")

	DB = database

	seedDatabase()
}

func seedDatabase() {
	hashPassword, _ := bcrypt.GenerateFromPassword([]byte("password"), 10)
	passStr := string(hashPassword)

	// 1. Seed Users & Doctors (Always ensure all required roles and doctors exist in DB)
	users := []models.User{
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
		} else {
			users[i].ID = existing.ID
		}
	}
	log.Println("Users & Doctors verified and seeded successfully.")

	// 2. Seed Patients
	var patientCount int64
	DB.Model(&models.Patient{}).Count(&patientCount)
	if patientCount == 0 {
		parseDate := func(d string) time.Time {
			t, _ := time.Parse("2006-01-02", d)
			return t
		}

		patients := []models.Patient{
			{
				HN:               "HN-0089",
				NationalID:       "0123456789012",
				FullName:         "นายสมชาย ใจดี",
				Gender:           "ชาย",
				BirthDate:        parseDate("1990-05-15"),
				Address:          "123/45 ถนนพหลโยธิน แขวงลาดยาว เขตจตุจักร กรุงเทพฯ",
				PhoneNumber:      "081-234-5678",
				EmergencyContact: "นางสมศรี (ภรรยา) 089-999-1111",
				SchemeType:       "บัตรทอง (สปสช.)",
				Allergies:        "ปฏิเสธการแพ้ยา",
				ChronicDiseases:  "ความดันโลหิตสูง (คุมได้ดี)",
			},
			{
				HN:               "HN-0090",
				NationalID:       "3100598765432",
				FullName:         "นางสาววิภาดา มณีรัตน์",
				Gender:           "หญิง",
				BirthDate:        parseDate("1995-11-22"),
				Address:          "88/12 ซอยสุขุมวิท 55 แขวงคลองตันเหนือ เขตวัฒนา กรุงเทพฯ",
				PhoneNumber:      "089-876-5432",
				EmergencyContact: "นายประสิทธิ์ (บิดา) 081-444-2222",
				SchemeType:       "ประกันสังคม (ม.33)",
				Allergies:        "แพ้ยา Penicillin",
				ChronicDiseases:  "ไมเกรน",
			},
			{
				HN:               "HN-0091",
				NationalID:       "1101455443219",
				FullName:         "นายอาทิตย์ มีสุข",
				Gender:           "ชาย",
				BirthDate:        parseDate("1982-03-10"),
				Address:          "45/6 ถนนงามวงศ์วาน ตำบลบางเขน อำเภอเมือง นนทบุรี",
				PhoneNumber:      "086-555-4321",
				EmergencyContact: "นางวรรณา (มารดา) 082-333-8888",
				SchemeType:       "สิทธิ์ข้าราชการ",
				Allergies:        "ปฏิเสธการแพ้ยา",
				ChronicDiseases:  "ความดันโลหิตสูง",
			},
			{
				HN:               "HN-0092",
				NationalID:       "5102011223345",
				FullName:         "นางสมศรี รักษาดี",
				Gender:           "หญิง",
				BirthDate:        parseDate("1975-08-05"),
				Address:          "99/8 ซอยลาดพร้าว 71 แขวงสะพานสอง เขตวังทองหลาง กรุงเทพฯ",
				PhoneNumber:      "084-111-2233",
				EmergencyContact: "นายธนา (บุตรชาย) 087-654-3210",
				SchemeType:       "บัตรทอง (สปสช.)",
				Allergies:        "ปฏิเสธการแพ้ยา",
				ChronicDiseases:  "เบาหวานชนิดที่ 2",
			},
			{
				HN:               "HN-0093",
				NationalID:       "1103377889901",
				FullName:         "นายธนกฤต กิตติพงษ์",
				Gender:           "ชาย",
				BirthDate:        parseDate("1998-09-14"),
				Address:          "15/9 ถนนเพชรเกษม แขวงบางแคเหนือ เขตบางแค กรุงเทพฯ",
				PhoneNumber:      "083-999-8877",
				EmergencyContact: "นางกาญจนา (พี่สาว) 081-333-4455",
				SchemeType:       "ประกันสุขภาพเอกชน",
				Allergies:        "ปฏิเสธการแพ้ยา",
				ChronicDiseases:  "ไม่มี",
			},
			{
				HN:               "HN-0094",
				NationalID:       "1104488990123",
				FullName:         "เด็กหญิงกัญญา มีทรัพย์",
				Gender:           "หญิง",
				BirthDate:        parseDate("2018-04-12"),
				Address:          "24/1 ถนนพระราม 2 ซอย 50 แขวงแสมดำ เขตบางขุนเทียน กรุงเทพฯ",
				PhoneNumber:      "082-123-4567",
				EmergencyContact: "นายเกรียงไกร (บิดา) 082-123-4567",
				SchemeType:       "บัตรทอง (สปสช.)",
				Allergies:        "ปฏิเสธการแพ้ยา",
				ChronicDiseases:  "ไม่มี",
			},
			{
				HN:               "HN-0095",
				NationalID:       "3102233445567",
				FullName:         "นายประเสริฐ ยืนยง",
				Gender:           "ชาย",
				BirthDate:        parseDate("1958-01-20"),
				Address:          "67/3 ถนนสุขาภิบาล 5 แขวงท่าแร้ง เขตบางเขน กรุงเทพฯ",
				PhoneNumber:      "085-678-9012",
				EmergencyContact: "นางรัตนา (ภรรยา) 089-123-4567",
				SchemeType:       "สิทธิ์ข้าราชการ",
				Allergies:        "แพ้ยา Sulfa",
				ChronicDiseases:  "โรคหัวใจขาดเลือด, ความดันโลหิตสูง",
			},
			{
				HN:               "HN-0096",
				NationalID:       "2105566778890",
				FullName:         "นางสาวมณีรัตน์ วงศ์สว่าง",
				Gender:           "หญิง",
				BirthDate:        parseDate("2002-07-30"),
				Address:          "302/11 ถนนรัชดาภิเษก แขวงจันทร์เกษม เขตจตุจักร กรุงเทพฯ",
				PhoneNumber:      "088-765-4321",
				EmergencyContact: "นายสมบัติ (บิดา) 086-789-0123",
				SchemeType:       "ชำระเงินเอง",
				Allergies:        "ปฏิเสธการแพ้ยา",
				ChronicDiseases:  "ไม่มี",
			},
		}

		for i := range patients {
			DB.Create(&patients[i])
		}
		log.Println("Patients seeded successfully.")

		// 3. Seed Medical Eligibilities
		pID := func(idx int) *uint {
			id := patients[idx].ID
			return &id
		}
		regID := &users[0].ID

		eligibilities := []models.MedicalEligibility{
			{PatientID: pID(0), UserID: regID, SchemeType: "บัตรทอง (สปสช.)", CoverageDetails: "ครอบคลุมการรักษาโรคทั่วไป ยกเว้นค่ายานอกบัญชีและบริการพิเศษ", HospitalName: "โรงพยาบาลคลินิกเวชกรรมชุมชน", Status: "ใช้งานได้", ExpireDate: "31/12/2026", VerifiedAt: time.Now()},
			{PatientID: pID(1), UserID: regID, SchemeType: "ประกันสังคม (ม.33)", CoverageDetails: "ผู้ประกันตนมาตรา 33 ครอบคลุมการรักษาตามเกณฑ์ สปส.", HospitalName: "โรงพยาบาลประกันสังคมสาขา 1", Status: "ใช้งานได้", ExpireDate: "31/12/2026", VerifiedAt: time.Now()},
			{PatientID: pID(2), UserID: regID, SchemeType: "สิทธิ์ข้าราชการ", CoverageDetails: "จ่ายตรงกรมบัญชีกลาง เบิกค่ายาและค่ารักษาได้ตามสิทธิ์", HospitalName: "โรงพยาบาลรัฐบาลหลัก", Status: "ใช้งานได้", ExpireDate: "ตลอดอายุราชการ", VerifiedAt: time.Now()},
			{PatientID: pID(3), UserID: regID, SchemeType: "บัตรทอง (สปสช.)", CoverageDetails: "ครอบคลุมการรักษาโรคทั่วไปและโรคเรื้อรัง", HospitalName: "โรงพยาบาลศูนย์สุขภาพปฐมภูมิ", Status: "ใช้งานได้", ExpireDate: "31/12/2026", VerifiedAt: time.Now()},
			{PatientID: pID(4), UserID: regID, SchemeType: "ประกันสุขภาพเอกชน", CoverageDetails: "AIA Care Max คุ้มครองผู้ป่วยนอก 2,000 บ./ครั้ง", HospitalName: "โรงพยาบาลคู่สัญญาเอกชน", Status: "ใช้งานได้", ExpireDate: "15/05/2027", VerifiedAt: time.Now()},
			{PatientID: pID(5), UserID: regID, SchemeType: "บัตรทอง (สปสช.)", CoverageDetails: "สิทธิ์คุ้มครองเด็กเล็กและทันตกรรมพื้นฐาน", HospitalName: "โรงพยาบาลส่งเสริมสุขภาพประจำตำบล", Status: "ใช้งานได้", ExpireDate: "31/12/2026", VerifiedAt: time.Now()},
			{PatientID: pID(6), UserID: regID, SchemeType: "สิทธิ์ข้าราชการ", CoverageDetails: "สิทธิ์ข้าราชการบำนาญ จ่ายตรงเบิกได้เต็มจำนวน", HospitalName: "โรงพยาบาลรัฐบาลหลัก", Status: "ใช้งานได้", ExpireDate: "ตลอดชีพ", VerifiedAt: time.Now()},
			{PatientID: pID(7), UserID: regID, SchemeType: "ชำระเงินเอง", CoverageDetails: "ชำระเงินเต็มจำนวนตามอัตราค่าบริการของคลินิก", HospitalName: "คลินิกเวชกรรมทั่วไป", Status: "ใช้งานได้", ExpireDate: "-", VerifiedAt: time.Now()},
		}
		for i := range eligibilities {
			DB.Create(&eligibilities[i])
		}
		log.Println("Medical Eligibilities seeded successfully.")

		// 4. Seed Queues
		queues := []models.Queue{
			{PatientID: patients[0].ID, CreatedByUserID: users[0].ID, QueueNumber: "Q001", Status: "รอคัดกรอง", Department: "แผนกคัดกรอง", Note: "รอวัดความดันโลหิต"},
			{PatientID: patients[1].ID, CreatedByUserID: users[0].ID, QueueNumber: "Q002", Status: "รอพบแพทย์", Department: "ห้องตรวจ 1 (พญ.สุดา)", Note: "คัดกรองแล้ว สัญญาณชีพปกติ"},
			{PatientID: patients[2].ID, CreatedByUserID: users[0].ID, QueueNumber: "Q003", Status: "รอคัดกรอง", Department: "แผนกคัดกรอง", Note: "ผู้ป่วย Walk-in ปวดศีรษะ"},
			{PatientID: patients[3].ID, CreatedByUserID: users[0].ID, QueueNumber: "Q004", Status: "กำลังตรวจ", Department: "ห้องตรวจ 2 (นพ.วิชัย)", Note: "เข้าห้องตรวจแพทย์แล้ว"},
			{PatientID: patients[4].ID, CreatedByUserID: users[0].ID, QueueNumber: "Q005", Status: "รอคัดกรอง", Department: "แผนกคัดกรอง", Note: "ตรวจสุขภาพประจำปี"},
			{PatientID: patients[5].ID, CreatedByUserID: users[0].ID, QueueNumber: "Q006", Status: "เสร็จสิ้น", Department: "ห้องจ่ายยาและการเงิน", Note: "ตรวจเสร็จสิ้น รอรับยาและชำระเงิน"},
		}
		for i := range queues {
			DB.Create(&queues[i])
		}
		log.Println("Queues seeded successfully.")

		// 5. Seed Visits & Screenings
		visits := []models.VisitRecord{
			{PatientID: patients[0].ID, DoctorID: users[3].ID, VisitDate: time.Now().AddDate(0, -1, 0)},
			{PatientID: patients[0].ID, DoctorID: users[4].ID, VisitDate: time.Now().AddDate(0, -2, 0)},
			{PatientID: patients[1].ID, DoctorID: users[3].ID, VisitDate: time.Now().Add(-2 * time.Hour)},
			{PatientID: patients[2].ID, DoctorID: users[4].ID, VisitDate: time.Now().Add(-1 * time.Hour)},
			{PatientID: patients[3].ID, DoctorID: users[4].ID, VisitDate: time.Now().Add(-30 * time.Minute)},
			{PatientID: patients[4].ID, DoctorID: users[5].ID, VisitDate: time.Now().Add(-15 * time.Minute)},
			{PatientID: patients[5].ID, DoctorID: users[5].ID, VisitDate: time.Now().Add(-3 * time.Hour)},
			{PatientID: patients[6].ID, DoctorID: users[4].ID, VisitDate: time.Now().AddDate(0, -1, -5)},
		}
		for i := range visits {
			DB.Create(&visits[i])
		}

		screenings := []models.Screening{
			{
				VisitID:          visits[0].ID,
				ScreenedByUserID: users[1].ID,
				AssignedDoctorID: users[3].ID,
				TriageLevel:      "ปกติ (Normal)",
				ChiefComplaint:   "มาตรวจสุขภาพประจำปี รู้สึกอ่อนเพลียเล็กน้อย",
				Allergies:        "ปฏิเสธการแพ้ยา",
				MedicalHistory:   "ความดันโลหิตสูง (คุมได้ดี)",
				NurseNotes:       "สัญญาณชีพปกติ แนะนำออกกำลังกายสม่ำเสมอ",
				Weight:           70.0,
				Height:           175.0,
				BMI:              22.86,
				Temperature:      36.6,
				SystolicBP:       128,
				DiastolicBP:      84,
				HeartRate:        74,
				RespiratoryRate:  18,
				SpO2:             99,
			},
			{
				VisitID:          visits[1].ID,
				ScreenedByUserID: users[1].ID,
				AssignedDoctorID: users[4].ID,
				TriageLevel:      "กึ่งฉุกเฉิน (Semi-Urgent)",
				ChiefComplaint:   "ปวดศีรษะท้ายทอยช่วงบ่าย ทานยาแก้ปวดแล้วไม่ดีขึ้น",
				Allergies:        "ปฏิเสธการแพ้ยา",
				MedicalHistory:   "ความดันโลหิตสูง",
				NurseNotes:       "ความดันค่อนข้างสูง ให้นั่งพัก 15 นาทีแล้ววัดซ้ำได้ 134/86",
				Weight:           72.5,
				Height:           175.0,
				BMI:              23.67,
				Temperature:      36.8,
				SystolicBP:       138,
				DiastolicBP:      88,
				HeartRate:        78,
				RespiratoryRate:  18,
				SpO2:             98,
			},
			{
				VisitID:          visits[2].ID,
				ScreenedByUserID: users[1].ID,
				AssignedDoctorID: users[3].ID,
				TriageLevel:      "เร่งด่วน (Urgent)",
				ChiefComplaint:   "ปวดศีรษะไมเกรนรุนแรง ตาพร่ามัว คลื่นไส้",
				Allergies:        "แพ้ยา Penicillin",
				MedicalHistory:   "ไมเกรน",
				NurseNotes:       "ส่งเข้าห้องตรวจ 1 ทันที เพื่อรับยาระงับอาการปวด",
				Weight:           54.0,
				Height:           162.0,
				BMI:              20.57,
				Temperature:      37.2,
				SystolicBP:       142,
				DiastolicBP:      92,
				HeartRate:        98,
				RespiratoryRate:  20,
				SpO2:             98,
			},
			{
				VisitID:          visits[3].ID,
				ScreenedByUserID: users[2].ID,
				AssignedDoctorID: users[4].ID,
				TriageLevel:      "ปกติ (Normal)",
				ChiefComplaint:   "รับยาความดันต่อเนื่องตามนัด สบายดี ไม่มีอาการผิดปกติ",
				Allergies:        "ปฏิเสธการแพ้ยา",
				MedicalHistory:   "ความดันโลหิตสูง",
				NurseNotes:       "วัดความดันได้ปกติ ยาเดิมทานครบสม่ำเสมอ",
				Weight:           68.0,
				Height:           170.0,
				BMI:              23.53,
				Temperature:      36.5,
				SystolicBP:       122,
				DiastolicBP:      80,
				HeartRate:        72,
				RespiratoryRate:  16,
				SpO2:             99,
			},
			{
				VisitID:          visits[4].ID,
				ScreenedByUserID: users[1].ID,
				AssignedDoctorID: users[4].ID,
				TriageLevel:      "กึ่งฉุกเฉิน (Semi-Urgent)",
				ChiefComplaint:   "ตรวจระดับน้ำตาลในเลือดสะสม ปัสสาวะบ่อยตอนกลางคืน",
				Allergies:        "ปฏิเสธการแพ้ยา",
				MedicalHistory:   "เบาหวานชนิดที่ 2",
				NurseNotes:       "แนะนำงดของหวานและคุมอาหารต่อเนื่อง",
				Weight:           65.0,
				Height:           158.0,
				BMI:              26.04,
				Temperature:      36.7,
				SystolicBP:       135,
				DiastolicBP:      85,
				HeartRate:        76,
				RespiratoryRate:  18,
				SpO2:             98,
			},
			{
				VisitID:          visits[5].ID,
				ScreenedByUserID: users[2].ID,
				AssignedDoctorID: users[5].ID,
				TriageLevel:      "ปกติ (Normal)",
				ChiefComplaint:   "ตรวจสุขภาพทั่วไป เพื่อขอใบรับรองแพทย์ทำใบขับขี่",
				Allergies:        "ปฏิเสธการแพ้ยา",
				MedicalHistory:   "ไม่มี",
				NurseNotes:       "สุขภาพแข็งแรง สัญญาณชีพและผลตรวจร่างกายทั่วไปปกติ",
				Weight:           75.0,
				Height:           178.0,
				BMI:              23.67,
				Temperature:      36.6,
				SystolicBP:       118,
				DiastolicBP:      76,
				HeartRate:        68,
				RespiratoryRate:  16,
				SpO2:             99,
			},
			{
				VisitID:          visits[6].ID,
				ScreenedByUserID: users[1].ID,
				AssignedDoctorID: users[5].ID,
				TriageLevel:      "ฉุกเฉิน (Emergency)",
				ChiefComplaint:   "มีไข้สูง 39.2 องศา หนาวสั่น ไอมีเสมหะ ซึมลง",
				Allergies:        "ปฏิเสธการแพ้ยา",
				MedicalHistory:   "ไม่มี",
				NurseNotes:       "เช็ดตัวลดไข้ทันที ส่งพบกุมารแพทย์ห้องตรวจ 3 ด่วน",
				Weight:           25.0,
				Height:           125.0,
				BMI:              16.00,
				Temperature:      39.2,
				SystolicBP:       105,
				DiastolicBP:      65,
				HeartRate:        128,
				RespiratoryRate:  26,
				SpO2:             96,
			},
			{
				VisitID:          visits[7].ID,
				ScreenedByUserID: users[1].ID,
				AssignedDoctorID: users[4].ID,
				TriageLevel:      "วิกฤต (Resuscitation)",
				ChiefComplaint:   "แน่นหน้าอกร้าวไปกรามซ้าย หายใจเหนื่อยหอบ เหงื่อแตก",
				Allergies:        "แพ้ยา Sulfa",
				MedicalHistory:   "โรคหัวใจขาดเลือด, ความดันโลหิตสูง",
				NurseNotes:       "ให้ออกซิเจนแคนนูลา 3 LPM EKG 12 Lead ส่งห้องตรวจแพทย์ทันที",
				Weight:           62.0,
				Height:           165.0,
				BMI:              22.77,
				Temperature:      36.4,
				SystolicBP:       178,
				DiastolicBP:      108,
				HeartRate:        115,
				RespiratoryRate:  24,
				SpO2:             92,
			},
		}

		for i := range screenings {
			DB.Create(&screenings[i])
		}
		log.Println("Screenings and Vitals seeded successfully.")

		// 6. Seed Medicines
		var medCount int64
		DB.Model(&models.Medicine{}).Count(&medCount)
		var medicines []models.Medicine
		if medCount == 0 {
			medicines = []models.Medicine{
				{MedicineCode: "MED-001", Name: "Paracetamol 500mg", StockQuantity: 1000, UnitPrice: 10.0},
				{MedicineCode: "MED-002", Name: "Amoxicillin 500mg", StockQuantity: 500, UnitPrice: 50.0},
				{MedicineCode: "MED-003", Name: "Ibuprofen 400mg", StockQuantity: 800, UnitPrice: 30.0},
				{MedicineCode: "MED-004", Name: "Cetirizine 10mg", StockQuantity: 600, UnitPrice: 15.0},
				{MedicineCode: "MED-005", Name: "Omeprazole 20mg", StockQuantity: 400, UnitPrice: 25.0},
				{MedicineCode: "MED-006", Name: "Amlodipine 5mg", StockQuantity: 300, UnitPrice: 20.0},
				{MedicineCode: "MED-007", Name: "Metformin 500mg", StockQuantity: 700, UnitPrice: 12.0},
				{MedicineCode: "MED-008", Name: "Losartan 50mg", StockQuantity: 450, UnitPrice: 40.0},
			}
			for i := range medicines {
				DB.Create(&medicines[i])
			}
			log.Println("Medicines seeded successfully.")
		} else {
			DB.Find(&medicines)
		}

		// 7. Seed Dispensing & Billing
		var dispensingCount int64
		DB.Model(&models.Dispensing{}).Count(&dispensingCount)
		if dispensingCount == 0 && len(medicines) > 0 {
			dispensings := []models.Dispensing{
				{VisitID: visits[0].ID, MedicineID: medicines[0].ID, Quantity: 20, Dosage: "500mg", Instructions: "ทานครั้งละ 1 เม็ด ทุก 4-6 ชั่วโมง เวลามีไข้", DoctorID: users[3].ID},
				{VisitID: visits[0].ID, MedicineID: medicines[3].ID, Quantity: 10, Dosage: "10mg", Instructions: "ทานครั้งละ 1 เม็ด วันละ 1 ครั้ง ก่อนนอน", DoctorID: users[3].ID},
				{VisitID: visits[1].ID, MedicineID: medicines[2].ID, Quantity: 15, Dosage: "400mg", Instructions: "ทานครั้งละ 1 เม็ด วันละ 3 ครั้ง หลังอาหาร", DoctorID: users[4].ID},
				{VisitID: visits[3].ID, MedicineID: medicines[5].ID, Quantity: 30, Dosage: "5mg", Instructions: "ทานครั้งละ 1 เม็ด วันละ 1 ครั้ง หลังอาหารเช้า", DoctorID: users[4].ID},
			}
			for i := range dispensings {
				DB.Create(&dispensings[i])
			}
			log.Println("Dispensing seeded successfully.")
		}

		var billingCount int64
		DB.Model(&models.Billing{}).Count(&billingCount)
		if billingCount == 0 {
			billings := []models.Billing{
				{VisitID: visits[0].ID, TotalAmount: 550.0, DiscountFromEligibility: 50.0, NetAmount: 500.0, PaymentMethod: "QR Code", PaymentStatus: "paid", ReceiptNumber: "REC-2607-001"},
				{VisitID: visits[1].ID, TotalAmount: 850.0, DiscountFromEligibility: 0.0, NetAmount: 850.0, PaymentMethod: "เงินสด", PaymentStatus: "pending", ReceiptNumber: "REC-2607-002"},
				{VisitID: visits[3].ID, TotalAmount: 1200.0, DiscountFromEligibility: 1200.0, NetAmount: 0.0, PaymentMethod: "-", PaymentStatus: "paid", ReceiptNumber: "REC-2607-003"},
			}
			for i := range billings {
				DB.Create(&billings[i])
			}
			log.Println("Billings seeded successfully.")

			qrPayments := []models.QRPayment{
				{BillingID: billings[0].ID, QRCodeData: "00020101021129370016A000000677010111011300668999911115802TH53037645405500.006304EE88", PromptPayID: "089-999-1111", Amount: 500.0, Status: "paid"},
			}
			for i := range qrPayments {
				DB.Create(&qrPayments[i])
			}
			log.Println("QRPayments seeded successfully.")
		}
	}
}