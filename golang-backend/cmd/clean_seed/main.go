package main

import (
	"fmt"
	"log"
	"time"

	"clinic-backend/internal/config"
	"clinic-backend/internal/models"
	"clinic-backend/internal/services"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	config.LoadConfig()
	config.ConnectDB()

	db := config.DB
	log.Println("Starting database cleanup & seed for General Clinic (Docker / Local Dev)...")

	// 1. Delete dependent transactional records first to maintain referential integrity
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
		"queue_counters",
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

	// Reset primary key sequences for transactional tables so IDs start cleanly from 1
	seqs := []string{
		"patients_id_seq",
		"queues_id_seq",
		"visit_records_id_seq",
		"screenings_id_seq",
		"medical_eligibilities_id_seq",
		"diagnoses_id_seq",
		"examinations_id_seq",
		"patient_medicines_id_seq",
		"billings_id_seq",
		"medicine_queues_id_seq",
	}
	for _, seq := range seqs {
		db.Exec("ALTER SEQUENCE IF EXISTS " + seq + " RESTART WITH 1")
	}

	log.Println("All transactional test data cleaned and sequences reset! Now seeding fresh clean records...")

	// 2. Seed All Required Users with default password "password"
	hashPassword, _ := bcrypt.GenerateFromPassword([]byte("password"), 10)
	passStr := string(hashPassword)

	seedUsers := []models.User{
		{Username: "officer1", Password: passStr, Role: "officer", FullName: "คุณสมจิต ดีใจ", Phone: "081-555-0001"},
		{Username: "registrar1", Password: passStr, Role: "registrar", FullName: "คุณสุภาพร เวชระเบียน", Phone: "081-111-0001"},
		{Username: "nurse1", Password: passStr, Role: "nurse", FullName: "พว. กานดา คัดกรอง", Phone: "081-111-0002"},
		{Username: "assistant1", Password: passStr, Role: "nurse_assistant", FullName: "นายสมคิด ช่วยเหลือดี", Phone: "081-111-0003"},
		{Username: "pharmacist1", Password: passStr, Role: "pharmacist", FullName: "ดร.บุญ สั่งยา", Phone: "081-333-0001"},
		{Username: "cashier1", Password: passStr, Role: "cashier", FullName: "นส.รวย การเงิน", Phone: "081-444-0001"},
		{Username: "doctor1", Password: passStr, Role: "doctor", FullName: "พญ.สุดา สุขสมบูรณ์", Phone: "081-222-0001"},
		{Username: "doctor2", Password: passStr, Role: "doctor", FullName: "นพ.วิชัย ชาญการแพทย์", Phone: "081-222-0002"},
		{Username: "doctor3", Password: passStr, Role: "doctor", FullName: "พญ.เกศรา รักษาดี", Phone: "081-222-0003"},
		{Username: "admin1", Password: passStr, Role: "admin", FullName: "ผู้ดูแลระบบ คลินิก", Phone: "081-999-0001"},
	}

	for i := range seedUsers {
		var existing models.User
		if err := db.Where("username = ?", seedUsers[i].Username).First(&existing).Error; err != nil {
			db.Create(&seedUsers[i])
			log.Printf("Created user: %s (%s)", seedUsers[i].Username, seedUsers[i].Role)
		} else {
			db.Model(&existing).Updates(map[string]interface{}{
				"full_name": seedUsers[i].FullName,
				"role":      seedUsers[i].Role,
				"phone":     seedUsers[i].Phone,
				"password":  passStr,
			})
			seedUsers[i] = existing
			log.Printf("Updated user: %s (%s)", seedUsers[i].Username, seedUsers[i].Role)
		}
	}

	// Fetch users for FK relations
	var registrar, nurse, assistant, doc1, doc2, doc3 models.User
	db.Where("username = ?", "registrar1").First(&registrar)
	db.Where("username = ?", "nurse1").First(&nurse)
	db.Where("username = ?", "assistant1").First(&assistant)
	db.Where("username = ?", "doctor1").First(&doc1)
	db.Where("username = ?", "doctor2").First(&doc2)
	db.Where("username = ?", "doctor3").First(&doc3)

	// Ensure Doctor profiles
	doctorProfiles := []models.Doctor{
		{UserID: doc1.ID, FullName: doc1.FullName, LicenseNumber: "ว.11234", Specialty: "อายุรกรรมทั่วไป", Room: "ห้องตรวจ 1", Phone: doc1.Phone, IsActive: true},
		{UserID: doc2.ID, FullName: doc2.FullName, LicenseNumber: "ว.22345", Specialty: "เวชศาสตร์ครอบครัว", Room: "ห้องตรวจ 2", Phone: doc2.Phone, IsActive: true},
		{UserID: doc3.ID, FullName: doc3.FullName, LicenseNumber: "ว.33456", Specialty: "กุมารเวชกรรม", Room: "ห้องตรวจ 3", Phone: doc3.Phone, IsActive: true},
	}
	for _, dp := range doctorProfiles {
		var existingDP models.Doctor
		if err := db.Where("user_id = ?", dp.UserID).First(&existingDP).Error; err != nil {
			db.Create(&dp)
		} else {
			db.Model(&existingDP).Updates(map[string]interface{}{
				"full_name":      dp.FullName,
				"license_number": dp.LicenseNumber,
				"specialty":      dp.Specialty,
				"room":           dp.Room,
				"phone":          dp.Phone,
				"is_active":      true,
			})
		}
	}

	parseDate := func(d string) time.Time {
		t, _ := time.Parse("2006-01-02", d)
		return t
	}

	// 3. Seed 20 Patients (HN0001 - HN0014 in 4-digit Hex)
	patients := []models.Patient{
		{HN: "HN0001", NationalID: "1234567890123", FullName: "นายสมชาย ใจดี", Gender: "ชาย", BirthDate: parseDate("1990-05-15"), Address: "123/45 ถนนพหลโยธิน แขวงลาดยาว เขตจตุจักร กรุงเทพฯ", Province: "กรุงเทพมหานคร", District: "จตุจักร", SubDistrict: "ลาดยาว", PostalCode: "10900", PhoneNumber: "081-234-5678", EmergencyContact: "นางสมศรี (ภรรยา) 089-999-1111", SchemeType: "บัตรทอง (สปสช.)", Allergies: "ปฏิเสธการแพ้ยา", ChronicDiseases: "ความดันโลหิตสูง (คุมได้ดี)"},
		{HN: "HN0002", NationalID: "3100598765432", FullName: "นางสาววิภาดา มณีรัตน์", Gender: "หญิง", BirthDate: parseDate("1995-11-22"), Address: "88/12 ซอยสุขุมวิท 55 แขวงคลองตันเหนือ เขตวัฒนา กรุงเทพฯ", Province: "กรุงเทพมหานคร", District: "วัฒนา", SubDistrict: "คลองตันเหนือ", PostalCode: "10110", PhoneNumber: "089-876-5432", EmergencyContact: "นายประสิทธิ์ (บิดา) 081-444-2222", SchemeType: "ประกันสังคม (ม.33)", Allergies: "แพ้ยา Penicillin", ChronicDiseases: "ไมเกรน"},
		{HN: "HN0003", NationalID: "1101455443219", FullName: "นายอาทิตย์ มีสุข", Gender: "ชาย", BirthDate: parseDate("1982-03-10"), Address: "45/6 ถนนงามวงศ์วาน ตำบลบางเขน อำเภอเมือง นนทบุรี", Province: "นนทบุรี", District: "เมืองนนทบุรี", SubDistrict: "บางเขน", PostalCode: "11000", PhoneNumber: "086-555-4321", EmergencyContact: "นางวรรณา (มารดา) 082-333-8888", SchemeType: "สิทธิ์ข้าราชการ", Allergies: "ปฏิเสธการแพ้ยา", ChronicDiseases: "ความดันโลหิตสูง"},
		{HN: "HN0004", NationalID: "5102011223345", FullName: "นางสมศรี รักษาดี", Gender: "หญิง", BirthDate: parseDate("1975-08-05"), Address: "99/8 ซอยลาดพร้าว 71 แขวงสะพานสอง เขตวังทองหลาง กรุงเทพฯ", Province: "กรุงเทพมหานคร", District: "วังทองหลาง", SubDistrict: "สะพานสอง", PostalCode: "10310", PhoneNumber: "084-111-2233", EmergencyContact: "นายธนา (บุตรชาย) 087-654-3210", SchemeType: "บัตรทอง (สปสช.)", Allergies: "ปฏิเสธการแพ้ยา", ChronicDiseases: "เบาหวานชนิดที่ 2"},
		{HN: "HN0005", NationalID: "1103377889901", FullName: "นายธนกฤต กิตติพงษ์", Gender: "ชาย", BirthDate: parseDate("1998-09-14"), Address: "15/9 ถนนเพชรเกษม แขวงบางแคเหนือ เขตบางแค กรุงเทพฯ", Province: "กรุงเทพมหานคร", District: "บางแค", SubDistrict: "บางแคเหนือ", PostalCode: "10160", PhoneNumber: "083-999-8877", EmergencyContact: "นางกาญจนา (พี่สาว) 081-333-4455", SchemeType: "ประกันสุขภาพเอกชน", Allergies: "ปฏิเสธการแพ้ยา", ChronicDiseases: "ไม่มี"},
		{HN: "HN0006", NationalID: "1104488990123", FullName: "เด็กหญิงกัญญา มีทรัพย์", Gender: "หญิง", BirthDate: parseDate("2018-04-12"), Address: "24/1 ถนนพระราม 2 ซอย 50 แขวงแสมดำ เขตบางขุนเทียน กรุงเทพฯ", Province: "กรุงเทพมหานคร", District: "บางขุนเทียน", SubDistrict: "แสมดำ", PostalCode: "10150", PhoneNumber: "082-123-4567", EmergencyContact: "นายเกรียงไกร (บิดา) 082-123-4567", SchemeType: "บัตรทอง (สปสช.)", Allergies: "ปฏิเสธการแพ้ยา", ChronicDiseases: "ไม่มี"},
		{HN: "HN0007", NationalID: "3102233445567", FullName: "นายประเสริฐ ยืนยง", Gender: "ชาย", BirthDate: parseDate("1958-01-20"), Address: "67/3 ถนนสุขาภิบาล 5 แขวงท่าแร้ง เขตบางเขน กรุงเทพฯ", Province: "กรุงเทพมหานคร", District: "บางเขน", SubDistrict: "ท่าแร้ง", PostalCode: "10220", PhoneNumber: "085-678-9012", EmergencyContact: "นางรัตนา (ภรรยา) 089-123-4567", SchemeType: "สิทธิ์ข้าราชการ", Allergies: "แพ้ยา Sulfa", ChronicDiseases: "โรคหัวใจขาดเลือด, ความดันโลหิตสูง"},
		{HN: "HN0008", NationalID: "2105566778890", FullName: "นางสาวมณีรัตน์ วงศ์สว่าง", Gender: "หญิง", BirthDate: parseDate("2002-07-30"), Address: "302/11 ถนนรัชดาภิเษก แขวงจันทร์เกษม เขตจตุจักร กรุงเทพฯ", Province: "กรุงเทพมหานคร", District: "จตุจักร", SubDistrict: "จันทรเกษม", PostalCode: "10900", PhoneNumber: "088-765-4321", EmergencyContact: "นายสมบัติ (บิดา) 086-789-0123", SchemeType: "ชำระเงินเอง", Allergies: "ปฏิเสธการแพ้ยา", ChronicDiseases: "ไม่มี"},
		{HN: "HN0009", NationalID: "1100223344556", FullName: "นายสุรชัย ชนะภัย", Gender: "ชาย", BirthDate: parseDate("1985-04-18"), Address: "54/2 หมู่ 3 ตำบลบางกร่าง อำเภอเมือง นนทบุรี", Province: "นนทบุรี", District: "เมืองนนทบุรี", SubDistrict: "บางกร่าง", PostalCode: "11000", PhoneNumber: "081-555-6789", EmergencyContact: "นางอรนุช (ภรรยา) 081-555-6780", SchemeType: "ประกันสังคม (ม.33)", Allergies: "ปฏิเสธการแพ้ยา", ChronicDiseases: "ไขมันในเลือดสูง"},
		{HN: "HN000A", NationalID: "3100334455667", FullName: "นางนภา เลิศเกียรติ", Gender: "หญิง", BirthDate: parseDate("1979-12-05"), Address: "12/8 ซอยลาดพร้าว 101 แขวงคลองจั่น เขตบางกะปิ กรุงเทพฯ", Province: "กรุงเทพมหานคร", District: "บางกะปิ", SubDistrict: "คลองจั่น", PostalCode: "10240", PhoneNumber: "089-111-2244", EmergencyContact: "นายเกียรติ (สามี) 089-111-2245", SchemeType: "บัตรทอง (สปสช.)", Allergies: "ปฏิเสธการแพ้ยา", ChronicDiseases: "ภูมิแพ้อากาศ"},
		{HN: "HN000B", NationalID: "1100445566778", FullName: "นายพงศธร รัตนพงษ์", Gender: "ชาย", BirthDate: parseDate("1993-08-25"), Address: "77/4 ถนนพุทธมณฑลสาย 2 แขวงบางไผ่ เขตบางแค กรุงเทพฯ", Province: "กรุงเทพมหานคร", District: "บางแค", SubDistrict: "บางไผ่", PostalCode: "10160", PhoneNumber: "086-222-3355", EmergencyContact: "นางพรรณี (มารดา) 086-222-3356", SchemeType: "ประกันสุขภาพเอกชน", Allergies: "แพ้ยา Aspirin", ChronicDiseases: "ไม่มี"},
		{HN: "HN000C", NationalID: "3100556677889", FullName: "นางสาวอรทัย บุณยเกียรติ", Gender: "หญิง", BirthDate: parseDate("2000-02-14"), Address: "9/99 ซอยอารีย์ แขวงสามเสนใน เขตพญาไท กรุงเทพฯ", Province: "กรุงเทพมหานคร", District: "พญาไท", SubDistrict: "สามเสนใน", PostalCode: "10400", PhoneNumber: "084-333-4466", EmergencyContact: "นายสมเกียรติ (บิดา) 084-333-4467", SchemeType: "สิทธิ์ข้าราชการ", Allergies: "ปฏิเสธการแพ้ยา", ChronicDiseases: "ไม่มี"},
		{HN: "HN000D", NationalID: "1100667788990", FullName: "นายธนาธิป สุวรรณโชติ", Gender: "ชาย", BirthDate: parseDate("1968-10-30"), Address: "101/5 ถนนแจ้งวัฒนะ ตำบลคลองเกลือ อำเภอปากเกร็ด นนทบุรี", Province: "นนทบุรี", District: "ปากเกร็ด", SubDistrict: "คลองเกลือ", PostalCode: "11120", PhoneNumber: "083-444-5577", EmergencyContact: "นางวันดี (ภรรยา) 083-444-5578", SchemeType: "บัตรทอง (สปสช.)", Allergies: "ปฏิเสธการแพ้ยา", ChronicDiseases: "เกาต์, ความดันโลหิตสูง"},
		{HN: "HN000E", NationalID: "3100778899001", FullName: "นางรุ่งนภา พัฒนกิจ", Gender: "หญิง", BirthDate: parseDate("1988-06-19"), Address: "33/1 ซอยสุขุมวิท 101/1 แขวงบางจาก เขตพระโขนง กรุงเทพฯ", Province: "กรุงเทพมหานคร", District: "พระโขนง", SubDistrict: "บางจาก", PostalCode: "10260", PhoneNumber: "082-555-6688", EmergencyContact: "นายพัฒนะ (สามี) 082-555-6689", SchemeType: "ประกันสังคม (ม.33)", Allergies: "ปฏิเสธการแพ้ยา", ChronicDiseases: "ไทรอยด์"},
		{HN: "HN000F", NationalID: "1100889900112", FullName: "เด็กชายธีรภัทร เมธากุล", Gender: "ชาย", BirthDate: parseDate("2020-09-08"), Address: "8/12 ถนนประชาชื่น ตำบลท่าทราย อำเภอเมือง นนทบุรี", Province: "นนทบุรี", District: "เมืองนนทบุรี", SubDistrict: "ท่าทราย", PostalCode: "11000", PhoneNumber: "081-666-7799", EmergencyContact: "นางกุลธิดา (มารดา) 081-666-7799", SchemeType: "บัตรทอง (สปสช.)", Allergies: "ปฏิเสธการแพ้ยา", ChronicDiseases: "ไม่มี"},
		{HN: "HN0010", NationalID: "1100990011223", FullName: "นายวรพจน์ ธนสารสมบัติ", Gender: "ชาย", BirthDate: parseDate("1972-01-11"), Address: "25/3 ถนนพระราม 9 แขวงห้วยขวาง เขตห้วยขวาง กรุงเทพฯ", Province: "กรุงเทพมหานคร", District: "ห้วยขวาง", SubDistrict: "ห้วยขวาง", PostalCode: "10310", PhoneNumber: "087-777-8800", EmergencyContact: "นางจิตรา (ภรรยา) 087-777-8801", SchemeType: "สิทธิ์ข้าราชการ", Allergies: "ปฏิเสธการแพ้ยา", ChronicDiseases: "ไขมันในเลือดสูง"},
		{HN: "HN0011", NationalID: "3100112233445", FullName: "นางสาวสิริกร ภัทรเดชา", Gender: "หญิง", BirthDate: parseDate("1997-03-28"), Address: "44/5 ซอยเอกมัย 12 แขวงคลองตันเหนือ เขตวัฒนา กรุงเทพฯ", Province: "กรุงเทพมหานคร", District: "วัฒนา", SubDistrict: "คลองตันเหนือ", PostalCode: "10110", PhoneNumber: "088-888-9911", EmergencyContact: "นางเดชา (มารดา) 088-888-9912", SchemeType: "ชำระเงินเอง", Allergies: "ปฏิเสธการแพ้ยา", ChronicDiseases: "ไม่มี"},
		{HN: "HN0012", NationalID: "1100123456789", FullName: "นายชาญวิทย์ วงศ์ประสิทธิ์", Gender: "ชาย", BirthDate: parseDate("1980-11-03"), Address: "90/2 ถนนเพชรบุรีตัดใหม่ แขวงบางกะปิ เขตห้วยขวาง กรุงเทพฯ", Province: "กรุงเทพมหานคร", District: "ห้วยขวาง", SubDistrict: "บางกะปิ", PostalCode: "10310", PhoneNumber: "089-999-0022", EmergencyContact: "นางวิไล (ภรรยา) 089-999-0023", SchemeType: "ประกันสังคม (ม.33)", Allergies: "ปฏิเสธการแพ้ยา", ChronicDiseases: "โรคกระเพาะ"},
		{HN: "HN0013", NationalID: "3100234567890", FullName: "นางพิมพ์ใจ มั่นคง", Gender: "หญิง", BirthDate: parseDate("1965-07-16"), Address: "15/7 ซอยพหลโยธิน 34 แขวงเสนานิคม เขตจตุจักร กรุงเทพฯ", Province: "กรุงเทพมหานคร", District: "จตุจักร", SubDistrict: "เสนานิคม", PostalCode: "10900", PhoneNumber: "086-000-1133", EmergencyContact: "นายมั่นคง (สามี) 086-000-1134", SchemeType: "บัตรทอง (สปสช.)", Allergies: "ปฏิเสธการแพ้ยา", ChronicDiseases: "โรคข้อเข่าเสื่อม"},
		{HN: "HN0014", NationalID: "1100345678901", FullName: "นายจตุรงค์ โชคดี", Gender: "ชาย", BirthDate: parseDate("1991-12-24"), Address: "88/9 ถนนรังสิต-นครนายก ตำบลประชาธิปัตย์ อำเภอธัญบุรี ปทุมธานี", Province: "ปทุมธานี", District: "ธัญบุรี", SubDistrict: "ประชาธิปัตย์", PostalCode: "12130", PhoneNumber: "085-111-2244", EmergencyContact: "นางดวงใจ (พี่สาว) 085-111-2245", SchemeType: "ชำระเงินเอง", Allergies: "ปฏิเสธการแพ้ยา", ChronicDiseases: "ไม่มี"},
	}

	for i := range patients {
		db.Create(&patients[i])
	}
	log.Printf("Seeded %d patients successfully (HN0001 - HN0014).", len(patients))

	// 4. Seed Medical Eligibilities
	d2026 := time.Date(2026, 12, 31, 0, 0, 0, 0, time.UTC)
	d2027 := time.Date(2027, 5, 15, 0, 0, 0, 0, time.UTC)
	dLife := time.Date(2099, 12, 31, 0, 0, 0, 0, time.UTC)

	for i, p := range patients {
		pID := p.ID
		regID := registrar.ID
		var scheme, cov, hosp, stat string
		var exp *time.Time

		switch i % 5 {
		case 0:
			scheme = "บัตรทอง (สปสช.)"
			cov = "ครอบคลุมการรักษาโรคทั่วไป ยกเว้นค่ายานอกบัญชีและบริการพิเศษ"
			hosp = "โรงพยาบาลคลินิกเวชกรรมชุมชน"
			stat = "ใช้งานได้"
			exp = &d2026
		case 1:
			scheme = "ประกันสังคม (ม.33)"
			cov = "ผู้ประกันตนมาตรา 33 ครอบคลุมการรักษาตามเกณฑ์ สปส."
			hosp = "โรงพยาบาลประกันสังคมสาขา 1"
			stat = "ใช้งานได้"
			exp = &d2026
		case 2:
			scheme = "สิทธิ์ข้าราชการ"
			cov = "จ่ายตรงกรมบัญชีกลาง เบิกค่ายาและค่ารักษาได้ตามสิทธิ์"
			hosp = "โรงพยาบาลรัฐบาลหลัก"
			stat = "ใช้งานได้"
			exp = &dLife
		case 3:
			scheme = "ประกันสุขภาพเอกชน"
			cov = "AIA Care Max คุ้มครองผู้ป่วยนอก 2,000 บ./ครั้ง"
			hosp = "โรงพยาบาลคู่สัญญาเอกชน"
			stat = "ใช้งานได้"
			exp = &d2027
		default:
			scheme = "ชำระเงินเอง"
			cov = "ชำระเงินเต็มจำนวนตามอัตราค่าบริการของคลินิก"
			hosp = "คลินิกเวชกรรมทั่วไป"
			stat = "ใช้งานได้"
			exp = nil
		}

		elig := models.MedicalEligibility{
			PatientID:       &pID,
			UserID:          &regID,
			SchemeType:      scheme,
			CoverageDetails: cov,
			HospitalName:    hosp,
			Status:          stat,
			ExpireDate:      exp,
			VerifiedAt:      time.Now(),
		}
		db.Create(&elig)
	}
	log.Printf("Seeded %d eligibilities successfully.", len(patients))

	// 5. Seed 15 Queues Today (Q0001 - Q000F in Hex) with mixed clinical statuses
	nowBkk := time.Now().In(services.BangkokLocation())
	today := time.Date(nowBkk.Year(), nowBkk.Month(), nowBkk.Day(), 0, 0, 0, 0, time.UTC)
	queueDefs := []struct {
		QueueNo string
		Status  string
		Dept    string
		Note    string
	}{
		{"Q0001", "รอคัดกรอง", "จุดคัดกรอง", "รอวัดความดันโลหิตและสัญญาณชีพ"},
		{"Q0002", "รอคัดกรอง", "จุดคัดกรอง", "ผู้ป่วย Walk-in มีอาการไข้หวัด"},
		{"Q0003", "รอคัดกรอง", "จุดคัดกรอง", "นัดติดตามอาการโรคความดันโลหิตสูง"},
		{"Q0004", "รอพบแพทย์", "ห้องตรวจ 1 (พญ.สุดา)", "คัดกรองแล้ว: เร่งด่วน (Urgent) (BP: 142/92, HR: 98)"},
		{"Q0005", "รอพบแพทย์", "ห้องตรวจ 2 (นพ.วิชัย)", "คัดกรองแล้ว: สัญญาณชีพปกติ รอเรียกเข้าห้องตรวจ"},
		{"Q0006", "รอพบแพทย์", "ห้องตรวจ 3 (พญ.เกศรา)", "คัดกรองแล้ว: กุมารแพทย์ รอคิวห้อง 3"},
		{"Q0007", "กำลังตรวจ", "ห้องตรวจ 1 (พญ.สุดา)", "แพทย์กำลังซักประวัติและตรวจร่างกาย"},
		{"Q0008", "กำลังตรวจ", "ห้องตรวจ 2 (นพ.วิชัย)", "แพทย์กำลังวินิจฉัยและสั่งยา"},
		{"Q0009", "รอทำหัตถการ", "ห้องหัตถการ (ทำแผล/ฉีดยา)", "ส่งทำแผล / ฉีดยา / พ่นยา"},
		{"Q000A", "รอทำหัตถการ", "ห้องหัตถการ (ทำแผล/ฉีดยา)", "ฉีดยาฆ่าเชื้อและสังเกตอาการ 15 นาที"},
		{"Q000B", "รอชำระเงิน", "ห้องการเงิน (แคชเชียร์)", "ตรวจเสร็จสิ้น รอชำระค่ารักษาพยาบาล"},
		{"Q000C", "รอชำระเงิน", "ห้องการเงิน (แคชเชียร์)", "รอคำนวณสิทธิการรักษาและออกใบเสร็จ"},
		{"Q000D", "รอรับยา", "ห้องจ่ายยาและเภสัชกรรม", "ชำระเงินแล้ว รอจัดยาและรับคำแนะนำ"},
		{"Q000E", "เสร็จสิ้น", "ห้องจ่ายยาและเภสัชกรรม", "รับยาและเสร็จสิ้นขั้นตอนการรักษา"},
		{"Q000F", "ยกเลิกคิว", "จุดคัดกรอง", "ผู้ป่วยขอยกเลิกคิวเนื่องจากมีธุระด่วน"},
	}

	for i, qd := range queueDefs {
		q := models.Queue{
			PatientID:       patients[i].ID,
			CreatedByUserID: registrar.ID,
			QueueNumber:     qd.QueueNo,
			Status:          qd.Status,
			Department:      qd.Dept,
			Note:            qd.Note,
			ServiceDate:     today,
		}
		db.Create(&q)
	}
	log.Printf("Seeded %d queues successfully (Q0001 - Q000F).", len(queueDefs))

	// Seed Queue Counter for Q000F (decimal 15)
	counter := models.QueueCounter{
		ServiceDate: today,
		LastNumber:  15,
	}
	db.Save(&counter)

	// 6. Seed Visits & 10 Screenings (Triage Levels 1-4 canonical integers)
	visits := make([]models.VisitRecord, 10)
	for i := 0; i < 10; i++ {
		doc := doc1
		if i%3 == 1 {
			doc = doc2
		} else if i%3 == 2 {
			doc = doc3
		}
		visits[i] = models.VisitRecord{
			PatientID:   patients[i].ID,
			DoctorID:    doc.ID,
			VisitDate:   time.Now().Add(-time.Duration(i*30) * time.Minute),
			QueueNumber: queueDefs[i].QueueNo,
		}
		db.Create(&visits[i])
	}

	screeningsData := []struct {
		Triage      int
		Complaint   string
		Allergies   string
		History     string
		Notes       string
		Weight      float64
		Height      float64
		BMI         float64
		Temp        float64
		SysBP       int
		DiaBP       int
		HR          int
		RR          int
		SpO2        int
		Pain        int
		Sugar       int
	}{
		{1, "แน่นหน้าอกร้าวไปกรามซ้าย หายใจเหนื่อยหอบ เหงื่อแตก", "แพ้ยา Sulfa", "โรคหัวใจขาดเลือด, ความดันโลหิตสูง", "ให้ออกซิเจนแคนนูลา 3 LPM EKG 12 Lead ส่งห้องตรวจแพทย์ทันที", 62.0, 165.0, 22.77, 36.4, 178, 108, 115, 24, 92, 8, 140},
		{2, "ปวดศีรษะไมเกรนรุนแรง ตาพร่ามัว คลื่นไส้", "แพ้ยา Penicillin", "ไมเกรน", "ส่งเข้าห้องตรวจ 1 ทันที เพื่อรับยาระงับอาการปวด", 54.0, 162.0, 20.57, 37.2, 142, 92, 98, 20, 98, 7, 110},
		{2, "มีไข้สูง 39.2 องศา หนาวสั่น ไอมีเสมหะ ซึมลง", "ปฏิเสธการแพ้ยา", "ไม่มี", "เช็ดตัวลดไข้ทันที ส่งพบกุมารแพทย์ห้องตรวจ 3 ด่วน", 25.0, 125.0, 16.00, 39.2, 105, 65, 128, 26, 96, 4, 95},
		{3, "ปวดศีรษะท้ายทอยช่วงบ่าย ทานยาแก้ปวดแล้วไม่ดีขึ้น", "ปฏิเสธการแพ้ยา", "ความดันโลหิตสูง", "ความดันค่อนข้างสูง ให้นั่งพัก 15 นาทีแล้ววัดซ้ำ", 72.5, 175.0, 23.67, 36.8, 138, 88, 78, 18, 98, 5, 120},
		{3, "ตรวจระดับน้ำตาลในเลือดสะสม ปัสสาวะบ่อยตอนกลางคืน", "ปฏิเสธการแพ้ยา", "เบาหวานชนิดที่ 2", "แนะนำงดของหวานและคุมอาหารต่อเนื่อง", 65.0, 158.0, 26.04, 36.7, 135, 85, 76, 18, 98, 2, 180},
		{3, "ปวดท้องบิดเป็นพักๆ ถ่ายเหลว 3 ครั้ง อ่อนเพลีย", "ปฏิเสธการแพ้ยา", "ไม่มี", "ให้ดื่มเกลือแร่ ORS รอพบแพทย์เพื่อตรวจประเมินภาวะขาดน้ำ", 58.0, 168.0, 20.55, 37.0, 115, 75, 82, 18, 99, 5, 100},
		{4, "มาตรวจสุขภาพประจำปี รู้สึกอ่อนเพลียเล็กน้อย", "ปฏิเสธการแพ้ยา", "ความดันโลหิตสูง (คุมได้ดี)", "สัญญาณชีพปกติ แนะนำออกกำลังกายสม่ำเสมอ", 70.0, 175.0, 22.86, 36.6, 128, 84, 74, 18, 99, 0, 95},
		{4, "รับยาความดันต่อเนื่องตามนัด สบายดี ไม่มีอาการผิดปกติ", "ปฏิเสธการแพ้ยา", "ความดันโลหิตสูง", "วัดความดันได้ปกติ ยาเดิมทานครบสม่ำเสมอ", 68.0, 170.0, 23.53, 36.5, 122, 80, 72, 16, 99, 0, 105},
		{4, "ตรวจสุขภาพทั่วไป เพื่อขอใบรับรองแพทย์ทำใบขับขี่", "ปฏิเสธการแพ้ยา", "ไม่มี", "สุขภาพแข็งแรง สัญญาณชีพและผลตรวจร่างกายทั่วไปปกติ", 75.0, 178.0, 23.67, 36.6, 118, 76, 68, 16, 99, 0, 90},
		{4, "ขอรับยาแก้แพ้อากาศต่อเนื่อง คัดจมูกช่วงเช้า", "ปฏิเสธการแพ้ยา", "ภูมิแพ้อากาศ", "อาการคงที่ ให้รับยาแก้แพ้ตัวเดิม", 60.0, 165.0, 22.04, 36.5, 120, 78, 70, 16, 99, 1, 92},
	}

	for i, sd := range screeningsData {
		scr := models.Screening{
			VisitID:          visits[i].ID,
			ScreenedByUserID: nurse.ID,
			AssignedDoctorID: visits[i].DoctorID,
			TriageLevel:      sd.Triage,
			ChiefComplaint:   sd.Complaint,
			Allergies:        sd.Allergies,
			MedicalHistory:   sd.History,
			NurseNotes:       sd.Notes,
			Weight:           sd.Weight,
			Height:           sd.Height,
			BMI:              sd.BMI,
			Temperature:      sd.Temp,
			SystolicBP:       sd.SysBP,
			DiastolicBP:      sd.DiaBP,
			HeartRate:        sd.HR,
			RespiratoryRate:  sd.RR,
			SpO2:             sd.SpO2,
			PainScore:        sd.Pain,
			BloodSugar:       sd.Sugar,
		}
		db.Create(&scr)
	}
	log.Printf("Seeded %d screenings successfully (Triage 1-4).", len(screeningsData))

	fmt.Println("\n=======================================================")
	fmt.Println("[SUCCESS] Database reset and clean seeding completed successfully!")
	fmt.Println("=======================================================")
}
