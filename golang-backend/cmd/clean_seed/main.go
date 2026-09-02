package main

import (
	"fmt"
	"log"
	"time"

	"clinic-backend/internal/config"
	"clinic-backend/internal/models"
)

func main() {
	config.LoadConfig()
	config.ConnectDB()

	db := config.DB
	log.Println("Starting database cleanup for B6706265 modules...")

	// 1. Delete dependent records first to maintain referential integrity
	tables := []string{
		"qr_payments",
		"billings",
		"billing_queues",
		"billing_histories",
		"medicine_queues",
		"dispensings",
		"prescription_items",
		"examinations",
		"diagnoses",
		"patient_medicines",
		"patient_histories",
		"screenings",
		"queues",
		"visit_records",
		"medical_eligibilities",
		"patients",
	}
	for _, tbl := range tables {
		if err := db.Exec("DELETE FROM " + tbl).Error; err != nil {
			log.Printf("Clean table %s note: %v", tbl, err)
		} else {
			log.Println("Cleaned table:", tbl)
		}
	}

	log.Println("All test data cleaned successfully! Now seeding fresh clean records...")

	// Fetch users for relations
	var registrar models.User
	var nurse models.User
	var assistant models.User
	var doc1 models.User
	var doc2 models.User
	var doc3 models.User

	db.Where("username = ?", "registrar1").First(&registrar)
	db.Where("username = ?", "nurse1").First(&nurse)
	db.Where("username = ?", "assistant1").First(&assistant)
	db.Where("username = ?", "doctor1").First(&doc1)
	db.Where("username = ?", "doctor2").First(&doc2)
	db.Where("username = ?", "doctor3").First(&doc3)

	if doc1.ID == 0 {
		var anyDoc models.User
		db.Where("role = ?", "doctor").First(&anyDoc)
		doc1 = anyDoc
	}
	if doc2.ID == 0 {
		doc2 = doc1
	}
	if doc3.ID == 0 {
		doc3 = doc1
	}
	if nurse.ID == 0 {
		db.Where("role = ?", "nurse").First(&nurse)
	}
	if assistant.ID == 0 {
		assistant = nurse
	}
	if registrar.ID == 0 {
		db.Where("role = ?", "registrar").First(&registrar)
	}

	parseDate := func(d string) time.Time {
		t, _ := time.Parse("2006-01-02", d)
		return t
	}

	// 2. Seed Standard 8 Patients (HN0001 - HN0008)
	patients := []models.Patient{
		{
			HN:               "HN0001",
			NationalID:       "1234567890123",
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
			HN:               "HN0002",
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
			HN:               "HN0003",
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
			HN:               "HN0004",
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
			HN:               "HN0005",
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
			HN:               "HN0006",
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
			HN:               "HN0007",
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
			HN:               "HN0008",
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
		if err := db.Create(&patients[i]).Error; err != nil {
			log.Printf("Error seeding patient %s: %v", patients[i].FullName, err)
		} else {
			log.Printf("Seeded patient %s (ID: %d, HN: %s)", patients[i].FullName, patients[i].ID, patients[i].HN)
		}
	}
	log.Printf("Seeded %d patients successfully.", len(patients))

	// 3. Seed Medical Eligibilities
	pID := func(idx int) *uint {
		id := patients[idx].ID
		return &id
	}
	regID := &registrar.ID

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
		db.Create(&eligibilities[i])
	}
	log.Printf("Seeded %d eligibilities successfully.", len(eligibilities))

	// 4. Seed Clean Standard Queues (Q0001 - Q0008)
	queues := []models.Queue{
		{PatientID: patients[0].ID, CreatedByUserID: registrar.ID, QueueNumber: "Q0001", Status: "รอคัดกรอง", Department: "จุดคัดกรอง", Note: "รอวัดความดันโลหิตและสัญญาณชีพ"},
		{PatientID: patients[1].ID, CreatedByUserID: registrar.ID, QueueNumber: "Q0002", Status: "รอพบแพทย์", Department: "ห้องตรวจ 1 (พญ.สุดา)", Note: "คัดกรองแล้ว: เร่งด่วน (Urgent) (BP: 142/92, HR: 98)"},
		{PatientID: patients[2].ID, CreatedByUserID: registrar.ID, QueueNumber: "Q0003", Status: "รอพบแพทย์", Department: "ห้องตรวจ 2 (นพ.วิชัย)", Note: "ผู้ป่วย Walk-in มีอาการปวดศีรษะ"},
		{PatientID: patients[3].ID, CreatedByUserID: registrar.ID, QueueNumber: "Q0004", Status: "กำลังตรวจ", Department: "ห้องตรวจ 3 (พญ.เกศรา)", Note: "เข้าห้องตรวจกุมารแพทย์แล้ว"},
		{PatientID: patients[4].ID, CreatedByUserID: registrar.ID, QueueNumber: "Q0005", Status: "รอทำหัตถการ", Department: "ห้องหัตถการ (ทำแผล/ฉีดยา)", Note: "ส่งทำแผล / ฉีดยา / พ่นยา"},
		{PatientID: patients[5].ID, CreatedByUserID: registrar.ID, QueueNumber: "Q0006", Status: "รอชำระเงิน", Department: "ห้องการเงิน (แคชเชียร์)", Note: "ตรวจเสร็จสิ้น รอชำระค่ารักษาพยาบาล"},
		{PatientID: patients[6].ID, CreatedByUserID: registrar.ID, QueueNumber: "Q0007", Status: "รอรับยา", Department: "ห้องจ่ายยาและเภสัชกรรม", Note: "ชำระเงินแล้ว รอจัดยาและรับคำแนะนำ"},
		{PatientID: patients[7].ID, CreatedByUserID: registrar.ID, QueueNumber: "Q0008", Status: "เสร็จสิ้น", Department: "ห้องจ่ายยาและเภสัชกรรม", Note: "รับยาและเสร็จสิ้นขั้นตอนการรักษา"},
	}
	for i := range queues {
		db.Create(&queues[i])
	}
	log.Printf("Seeded %d queues successfully.", len(queues))

	// 5. Seed Visits & Screenings
	visits := []models.VisitRecord{
		{PatientID: patients[0].ID, DoctorID: doc1.ID, VisitDate: time.Now().AddDate(0, -1, 0)},
		{PatientID: patients[0].ID, DoctorID: doc2.ID, VisitDate: time.Now().AddDate(0, -2, 0)},
		{PatientID: patients[1].ID, DoctorID: doc1.ID, VisitDate: time.Now().Add(-2 * time.Hour)},
		{PatientID: patients[2].ID, DoctorID: doc2.ID, VisitDate: time.Now().Add(-1 * time.Hour)},
		{PatientID: patients[3].ID, DoctorID: doc2.ID, VisitDate: time.Now().Add(-30 * time.Minute)},
		{PatientID: patients[4].ID, DoctorID: doc3.ID, VisitDate: time.Now().Add(-15 * time.Minute)},
		{PatientID: patients[5].ID, DoctorID: doc3.ID, VisitDate: time.Now().Add(-3 * time.Hour)},
		{PatientID: patients[6].ID, DoctorID: doc2.ID, VisitDate: time.Now().AddDate(0, -1, -5)},
	}
	for i := range visits {
		db.Create(&visits[i])
	}

	screenings := []models.Screening{
		{
			VisitID:          visits[0].ID,
			ScreenedByUserID: nurse.ID,
			AssignedDoctorID: doc1.ID,
			TriageLevel:      "ไม่ฉุกเฉิน (Non-Urgent)",
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
			ScreenedByUserID: nurse.ID,
			AssignedDoctorID: doc2.ID,
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
			ScreenedByUserID: nurse.ID,
			AssignedDoctorID: doc1.ID,
			TriageLevel:      "ฉุกเฉินเร่งด่วน (Urgent)",
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
			ScreenedByUserID: assistant.ID,
			AssignedDoctorID: doc2.ID,
			TriageLevel:      "ไม่ฉุกเฉิน (Non-Urgent)",
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
			ScreenedByUserID: nurse.ID,
			AssignedDoctorID: doc2.ID,
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
			ScreenedByUserID: assistant.ID,
			AssignedDoctorID: doc3.ID,
			TriageLevel:      "ไม่ฉุกเฉิน (Non-Urgent)",
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
			ScreenedByUserID: nurse.ID,
			AssignedDoctorID: doc3.ID,
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
			ScreenedByUserID: nurse.ID,
			AssignedDoctorID: doc2.ID,
			TriageLevel:      "ฉุกเฉินวิกฤต (Resuscitation)",
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
		db.Create(&screenings[i])
	}
	log.Printf("Seeded %d screenings successfully.", len(screenings))

	fmt.Println("\n=======================================================")
	fmt.Println("🎉 Database reset and clean seeding completed successfully!")
	fmt.Println("=======================================================")
}
