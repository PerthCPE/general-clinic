// เครื่องมือสร้างข้อมูลทดสอบสำหรับ Role แพทย์
//
// สร้างคิวผู้ป่วยของ "วันนี้" พร้อมผลคัดกรองจากพยาบาลครบชุด เพื่อให้ทดสอบ
// หน้าคิวผู้ป่วย / หน้าบันทึกการตรวจ ได้โดยไม่ต้องรอเพื่อนร่วมทีมลงข้อมูลให้
//
// วิธีใช้ (รันในโฟลเดอร์ golang-backend):
//
//	go run ./cmd/seed-doctor-demo              สร้างคิวทดสอบ 5 คิวให้ doctor1
//	go run ./cmd/seed-doctor-demo -n 3         สร้าง 3 คิว
//	go run ./cmd/seed-doctor-demo -doctor doctor2   ให้คิวไปอยู่กับ doctor2
//	go run ./cmd/seed-doctor-demo -reset       ลบเฉพาะข้อมูลทดสอบชุดนี้ทิ้ง
//
// ทุกคิวที่เครื่องมือนี้สร้างจะมีข้อความกำกับในคอลัมน์ note ตาม demoNote
// ตอนล้างข้อมูลจึงลบเฉพาะของตัวเอง ไม่ไปแตะคิวจริงที่คนอื่นสร้างไว้
package main

import (
	"flag"
	"fmt"
	"log"
	"strconv"
	"time"

	"clinic-backend/internal/config"
	"clinic-backend/internal/models"
)

// ข้อความกำกับข้อมูลทดสอบ ใช้ค้นหาตอนล้างข้อมูล
const demoNote = "ข้อมูลทดสอบระบบแพทย์ (seed-doctor-demo)"

// demoCase - ข้อมูลหนึ่งเคสที่จะสร้าง
type demoCase struct {
	QueueNumber    string
	Room           string
	TriageLevel    string // ข้อความไทยชุดเดียวกับที่พยาบาลบันทึก
	ChiefComplaint string
	Allergies      string
	MedicalHistory string
	NurseNotes     string
	WaitedMinutes  int  // ออกคิวมาแล้วกี่นาที (ใช้ทดสอบคอลัมน์เวลารอ)
	Examining      bool // true = ให้เริ่มที่สถานะ "กำลังตรวจ" เลย

	Weight          float64
	Height          float64
	Temperature     float64
	SystolicBP      int
	DiastolicBP     int
	HeartRate       int
	RespiratoryRate int
	SpO2            int
}

var demoCases = []demoCase{
	{
		QueueNumber:     "Q901",
		Room:            "ห้องตรวจ 1",
		TriageLevel:     "ปกติ (Normal)",
		ChiefComplaint:  "ไข้ต่ำๆ ไอมีเสมหะ เจ็บคอ มา 3 วัน",
		Allergies:       "ปฏิเสธการแพ้ยา",
		MedicalHistory:  "ไม่มีโรคประจำตัว",
		NurseNotes:      "รู้สึกตัวดี เดินได้เอง ไม่มีภาวะขาดน้ำ",
		WaitedMinutes:   42,
		Weight:          68.5,
		Height:          172,
		Temperature:     37.8,
		SystolicBP:      124,
		DiastolicBP:     78,
		HeartRate:       88,
		RespiratoryRate: 20,
		SpO2:            98,
	},
	{
		QueueNumber:     "Q902",
		Room:            "ห้องตรวจ 1",
		TriageLevel:     "เร่งด่วน (Urgent)",
		ChiefComplaint:  "ปวดท้องบิดเป็นพักๆ บริเวณท้องน้อยขวา มา 1 วัน",
		Allergies:       "แพ้ยา Penicillin (ผื่นลมพิษ)",
		MedicalHistory:  "เคยผ่าตัดไส้ติ่งเมื่อ 10 ปีก่อน",
		NurseNotes:      "สีหน้าเจ็บปวด กดเจ็บบริเวณท้องน้อยขวา ยังไม่มีไข้",
		WaitedMinutes:   27,
		Weight:          54.2,
		Height:          158,
		Temperature:     37.1,
		SystolicBP:      132,
		DiastolicBP:     84,
		HeartRate:       96,
		RespiratoryRate: 22,
		SpO2:            99,
	},
	{
		QueueNumber:     "Q903",
		Room:            "ห้องตรวจ 2",
		TriageLevel:     "ฉุกเฉิน (Emergency)",
		ChiefComplaint:  "แน่นหน้าอก เหนื่อยหอบ ร้าวไปแขนซ้าย เริ่มมา 2 ชั่วโมง",
		Allergies:       "ปฏิเสธการแพ้ยา",
		MedicalHistory:  "ความดันโลหิตสูง ไขมันในเลือดสูง สูบบุหรี่",
		NurseNotes:      "ให้ออกซิเจน 3 LPM แล้ว ทำ EKG รอแพทย์อ่านผลด่วน",
		WaitedMinutes:   6,
		Weight:          82,
		Height:          170,
		Temperature:     36.9,
		SystolicBP:      158,
		DiastolicBP:     96,
		HeartRate:       112,
		RespiratoryRate: 26,
		SpO2:            94,
	},
	{
		QueueNumber:     "Q904",
		Room:            "ห้องตรวจ 1",
		TriageLevel:     "ปกติ (Normal)",
		ChiefComplaint:  "มาตามนัดรับยาความดัน ไม่มีอาการผิดปกติ",
		Allergies:       "ปฏิเสธการแพ้ยา",
		MedicalHistory:  "ความดันโลหิตสูง คุมได้ดีด้วยยา Amlodipine",
		NurseNotes:      "ผู้ป่วยนัดติดตามอาการ 3 เดือน ยาเดิมหมดพอดี",
		WaitedMinutes:   15,
		Examining:       true,
		Weight:          71.4,
		Height:          165,
		Temperature:     36.6,
		SystolicBP:      138,
		DiastolicBP:     86,
		HeartRate:       74,
		RespiratoryRate: 18,
		SpO2:            98,
	},
	{
		QueueNumber:     "Q905",
		Room:            "ห้องตรวจ 2",
		TriageLevel:     "เร่งด่วน (Urgent)",
		ChiefComplaint:  "เวียนศีรษะ บ้านหมุน คลื่นไส้ ลุกยืนแล้วเป็นมากขึ้น",
		Allergies:       "แพ้อาหารทะเล",
		MedicalHistory:  "เบาหวานชนิดที่ 2 กินยา Metformin",
		NurseNotes:      "เจาะน้ำตาลปลายนิ้วได้ 168 mg/dL ให้นั่งพักก่อนเข้าตรวจ",
		WaitedMinutes:   33,
		Weight:          63.8,
		Height:          160,
		Temperature:     36.7,
		SystolicBP:      118,
		DiastolicBP:     72,
		HeartRate:       82,
		RespiratoryRate: 19,
		SpO2:            97,
	},
}

func main() {
	reset := flag.Bool("reset", false, "ลบเฉพาะข้อมูลทดสอบชุดนี้ แล้วจบการทำงาน")
	doctorUsername := flag.String("doctor", "doctor1", "username ของแพทย์ที่จะรับคิวทดสอบ")
	count := flag.Int("n", len(demoCases), "จำนวนคิวที่ต้องการสร้าง")
	flag.Parse()

	config.LoadConfig()
	config.ConnectDB()

	removed := cleanupDemoData()
	if removed > 0 {
		log.Printf("ล้างข้อมูลทดสอบชุดเดิมแล้ว %d คิว", removed)
	}
	if *reset {
		log.Println("โหมด -reset: ลบข้อมูลทดสอบเรียบร้อย ไม่ได้สร้างข้อมูลใหม่")
		return
	}

	n := *count
	if n < 1 {
		n = 1
	}
	if n > len(demoCases) {
		n = len(demoCases)
	}

	doctor, err := findUserByUsername(*doctorUsername)
	if err != nil {
		log.Fatalf("ไม่พบ user '%s' ที่เป็นแพทย์ในฐานข้อมูล: %v", *doctorUsername, err)
	}
	if doctor.Role != "doctor" {
		log.Fatalf("user '%s' มี role เป็น '%s' ไม่ใช่ doctor", *doctorUsername, doctor.Role)
	}

	// พยาบาลผู้คัดกรอง กับเจ้าหน้าที่ผู้ออกคิว ถ้าไม่มีในระบบให้ใช้แพทย์แทน
	nurse := findUserByRoles([]string{"nurse", "nurse_assistant"}, doctor)
	registrar := findUserByRoles([]string{"registrar"}, doctor)

	patients, err := pickPatients(n)
	if err != nil {
		log.Fatalf("เตรียมข้อมูลผู้ป่วยไม่สำเร็จ: %v", err)
	}

	now := time.Now()
	created := 0

	for i := 0; i < n; i++ {
		c := demoCases[i]
		p := patients[i]

		queuedAt := now.Add(-time.Duration(c.WaitedMinutes) * time.Minute)

		visit := models.VisitRecord{
			PatientID:  p.ID,
			DoctorID:   doctor.ID,
			VisitDate:  queuedAt,
			Status:     models.VisitStatusWaiting,
			Department: c.Room,
			VisitType:  "walk-in",
			CreatedAt:  queuedAt,
			UpdatedAt:  queuedAt,
		}

		queueStatus := "รอพบแพทย์"
		var calledAt *time.Time

		// เคสที่ให้เริ่มที่ "กำลังตรวจ" ต้องมีเลข VN และเวลาที่เรียกเข้าตรวจ
		if c.Examining {
			calledTime := now.Add(-5 * time.Minute)
			visit.Status = models.VisitStatusExamining
			visit.VN = buildVN(now, i+1)
			visit.StartedAt = &calledTime
			queueStatus = "กำลังตรวจ"
			calledAt = &calledTime
		}

		if err := config.DB.Create(&visit).Error; err != nil {
			log.Printf("สร้าง visit ของ %s ไม่สำเร็จ: %v", p.FullName, err)
			continue
		}

		screening := models.Screening{
			VisitID:          visit.ID,
			ScreenedByUserID: nurse.ID,
			AssignedDoctorID: doctor.ID,
			TriageLevel:      c.TriageLevel,
			ChiefComplaint:   c.ChiefComplaint,
			Allergies:        c.Allergies,
			MedicalHistory:   c.MedicalHistory,
			NurseNotes:       c.NurseNotes,
			Weight:           c.Weight,
			Height:           c.Height,
			BMI:              calcBMI(c.Weight, c.Height),
			Temperature:      c.Temperature,
			SystolicBP:       c.SystolicBP,
			DiastolicBP:      c.DiastolicBP,
			HeartRate:        c.HeartRate,
			RespiratoryRate:  c.RespiratoryRate,
			SpO2:             c.SpO2,
			CreatedAt:        queuedAt,
			UpdatedAt:        queuedAt,
		}
		if err := config.DB.Create(&screening).Error; err != nil {
			log.Printf("สร้างผลคัดกรองของ %s ไม่สำเร็จ: %v", p.FullName, err)
		}

		visitID := visit.ID
		doctorID := doctor.ID

		queue := models.Queue{
			PatientID:        p.ID,
			CreatedByUserID:  registrar.ID,
			QueueNumber:      c.QueueNumber,
			Status:           queueStatus,
			Department:       c.Room,
			Note:             demoNote,
			VisitID:          &visitID,
			AssignedDoctorID: &doctorID,
			CalledAt:         calledAt,
			CreatedAt:        queuedAt,
			UpdatedAt:        queuedAt,
		}
		if err := config.DB.Create(&queue).Error; err != nil {
			log.Printf("สร้างคิวของ %s ไม่สำเร็จ: %v", p.FullName, err)
			continue
		}

		created++
		log.Printf("  %s  %-28s  %-12s  %s", c.QueueNumber, p.FullName, queueStatus, c.TriageLevel)
	}

	log.Printf("สร้างคิวทดสอบเรียบร้อย %d คิว ให้แพทย์ %s (%s)", created, doctor.FullName, doctor.Username)
	log.Println("เปิดหน้าคิวผู้ป่วยในเว็บแล้วกดรีเฟรชได้เลย")
}

// cleanupDemoData - ลบข้อมูลทดสอบที่เครื่องมือนี้เคยสร้างไว้
//
// ไล่ลบจากตารางลูกขึ้นไปหาตารางแม่ เพื่อไม่ให้เหลือแถวที่ชี้ไปหา visit ที่ถูกลบแล้ว
// examinations กับ diagnoses ใช้ soft delete จึงต้อง Unscoped ให้ลบออกจริง
func cleanupDemoData() int {
	var queues []models.Queue
	if err := config.DB.Where("note = ?", demoNote).Find(&queues).Error; err != nil {
		log.Printf("อ่านคิวทดสอบเดิมไม่สำเร็จ: %v", err)
		return 0
	}
	if len(queues) == 0 {
		return 0
	}

	visitIDs := make([]uint, 0, len(queues))
	for _, q := range queues {
		if q.VisitID != nil && *q.VisitID > 0 {
			visitIDs = append(visitIDs, *q.VisitID)
		}
	}

	if len(visitIDs) > 0 {
		config.DB.Unscoped().Where("visit_id IN ?", visitIDs).Delete(&models.Diagnosis{})
		config.DB.Unscoped().Where("visit_id IN ?", visitIDs).Delete(&models.Examination{})
		config.DB.Where("visit_id IN ?", visitIDs).Delete(&models.Screening{})
	}

	config.DB.Where("note = ?", demoNote).Delete(&models.Queue{})

	if len(visitIDs) > 0 {
		config.DB.Where("id IN ?", visitIDs).Delete(&models.VisitRecord{})
	}

	return len(queues)
}

func findUserByUsername(username string) (models.User, error) {
	var u models.User
	err := config.DB.Where("username = ?", username).First(&u).Error
	return u, err
}

// findUserByRoles - หา user คนแรกที่มี role ตามที่ระบุ ถ้าไม่เจอให้ใช้ fallback
func findUserByRoles(roles []string, fallback models.User) models.User {
	var u models.User
	if err := config.DB.Where("role IN ?", roles).Order("id asc").First(&u).Error; err != nil {
		return fallback
	}
	return u
}

// pickPatients - เลือกผู้ป่วยที่มีอยู่แล้วมาใช้ ถ้ามีไม่พอจึงสร้างเพิ่ม
func pickPatients(n int) ([]models.Patient, error) {
	var patients []models.Patient
	if err := config.DB.Order("id asc").Limit(n).Find(&patients).Error; err != nil {
		return nil, err
	}

	fillerNames := []string{
		"นายทดสอบ ระบบแพทย์",
		"นางสาวสมหญิง ทดลองดี",
		"นายวีระชัย ตรวจสอบ",
		"นางมาลี ทดสอบสุข",
		"นายกิตติ ระบบดี",
	}
	genders := []string{"ชาย", "หญิง", "ชาย", "หญิง", "ชาย"}

	for i := len(patients); i < n; i++ {
		birth := time.Date(1985+i, time.Month(i+1), 10+i, 0, 0, 0, 0, time.Local)

		p := models.Patient{
			HN:               fmt.Sprintf("HN-9%03d", i+1),
			NationalID:       fmt.Sprintf("99%011d", i+1),
			FullName:         fillerNames[i%len(fillerNames)],
			Gender:           genders[i%len(genders)],
			BirthDate:        birth,
			Address:          "ที่อยู่สำหรับข้อมูลทดสอบระบบ",
			PhoneNumber:      fmt.Sprintf("08%d-000-%04d", i, i+1),
			EmergencyContact: "ผู้ติดต่อฉุกเฉิน 080-000-0000",
			SchemeType:       "บัตรทอง (สปสช.)",
			Allergies:        "ปฏิเสธการแพ้ยา",
			ChronicDiseases:  "ไม่มีโรคประจำตัว",
		}

		if err := config.DB.Create(&p).Error; err != nil {
			return nil, fmt.Errorf("สร้างผู้ป่วยทดสอบไม่สำเร็จ: %w", err)
		}
		patients = append(patients, p)
	}

	if len(patients) < n {
		return nil, fmt.Errorf("มีผู้ป่วยในระบบไม่พอ (ต้องการ %d ได้ %d)", n, len(patients))
	}

	return patients, nil
}

// buildVN - สร้างเลข VN รูปแบบเดียวกับที่ controller ของแพทย์ออกให้
// ปี พ.ศ. 2 หลัก + เดือน + วัน + เวลา HHmm + ลำดับที่ของวัน
func buildVN(now time.Time, seq int) string {
	shortYear := strconv.Itoa(now.Year() + 543)
	if len(shortYear) > 2 {
		shortYear = shortYear[len(shortYear)-2:]
	}

	return fmt.Sprintf("%s%d%d%s%d",
		shortYear,
		int(now.Month()),
		now.Day(),
		now.Format("1504"),
		seq,
	)
}

// calcBMI - น้ำหนัก (kg) / ส่วนสูง (m) ยกกำลังสอง ปัดเหลือทศนิยม 1 ตำแหน่ง
func calcBMI(weightKg, heightCm float64) float64 {
	if weightKg <= 0 || heightCm <= 0 {
		return 0
	}
	m := heightCm / 100
	bmi := weightKg / (m * m)
	return float64(int(bmi*10+0.5)) / 10
}
