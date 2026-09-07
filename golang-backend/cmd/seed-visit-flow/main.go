// เครื่องมือจำลองขั้นตอนก่อนถึงมือแพทย์
//
// เดินตาม flow จริงของระบบผ่าน REST API ทีละขั้น ไม่ได้เขียนลงฐานข้อมูลตรงๆ
// จึงได้ทดสอบโค้ดของเพื่อนร่วมทีมไปพร้อมกัน
//
//  1. login registrar1  -> POST /api/registrar/patients  (ลงทะเบียนผู้ป่วยใหม่)
//  2. -> POST /api/queue/create        (ออกบัตรคิว สถานะ "รอคัดกรอง")
//  3. login nurse1      -> POST /api/nurse/vitals        (คัดกรอง + ส่งต่อให้แพทย์)
//
// จบขั้นที่ 3 คิวจะเป็น "รอพบแพทย์" และถูกมอบหมายให้แพทย์ที่ระบุไว้
// พร้อมให้เข้าไปกดตรวจในหน้าจอแพทย์ได้ทันที
//
// วิธีใช้ (รันในโฟลเดอร์ golang-backend ขณะที่เซิร์ฟเวอร์เปิดอยู่):
//
//	go run ./cmd/seed-visit-flow                     สร้างผู้ป่วย 3 คนให้ doctor1
//	go run ./cmd/seed-visit-flow -n 1                สร้างคนเดียว
//	go run ./cmd/seed-visit-flow -doctor doctor2     ส่งต่อให้แพทย์คนอื่น
//	go run ./cmd/seed-visit-flow -url http://127.0.0.1:8080
//
// เลขบัตรประชาชนสร้างจากเวลาปัจจุบัน จึงไม่ซ้ำกับของเดิม รันกี่รอบก็ได้
package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net/http"
	"os"
	"strings"
	"time"
)

// visitCase - ข้อมูลผู้ป่วยหนึ่งรายที่จะเดินผ่าน flow
type visitCase struct {
	FullName        string
	Gender          string
	BirthDate       string // YYYY-MM-DD
	Phone           string
	Address         string
	Emergency       string
	SchemeType      string
	Allergies       string
	ChronicDiseases string

	ChiefComplaint     string
	MedicalHistory     string
	NurseNotes         string
	TriageLevel        string // เว้นว่างได้ backend จะประเมินจากสัญญาณชีพให้เอง
	PainScore          int
	BloodSugar         float64
	FoodAllergies      string
	CurrentMedications string
	SmokingHistory     string
	AlcoholHistory     string

	Weight          float64
	Height          float64
	Temperature     float64
	SystolicBP      int
	DiastolicBP     int
	HeartRate       int
	RespiratoryRate int
	SpO2            int
}

var cases = []visitCase{
	{
		FullName:        "นายสมศักดิ์ ภักดีชน",
		Gender:          "ชาย",
		BirthDate:       "1992-03-18",
		Phone:           "081-700-0001",
		Address:         "119/2 ถนนสุรนารายณ์ ตำบลในเมือง อำเภอเมือง นครราชสีมา",
		Emergency:       "นางสมพร (มารดา) 089-700-0001",
		SchemeType:      "บัตรทอง (สปสช.)",
		Allergies:       "ปฏิเสธการแพ้ยา",
		ChronicDiseases: "ไม่มีโรคประจำตัว",

		ChiefComplaint:     "ไข้ต่ำๆ ไอมีเสมหะ เจ็บคอ มา 3 วัน",
		MedicalHistory:     "ไม่มีโรคประจำตัว ไม่เคยผ่าตัด",
		NurseNotes:         "รู้สึกตัวดี เดินได้เอง ไม่มีภาวะขาดน้ำ",
		TriageLevel:        "ปกติ (Normal)",
		PainScore:          1,
		BloodSugar:         98.0,
		FoodAllergies:      "ปฏิเสธการแพ้อาหาร",
		CurrentMedications: "ไม่มี",
		SmokingHistory:     "ไม่สูบ",
		AlcoholHistory:     "ไม่ดื่ม",

		Weight: 68.5, Height: 172, Temperature: 37.8,
		SystolicBP: 124, DiastolicBP: 78,
		HeartRate: 88, RespiratoryRate: 20, SpO2: 98,
	},
	{
		FullName:        "นางสาวนภาลัย สว่างแดน",
		Gender:          "หญิง",
		BirthDate:       "1996-11-02",
		Phone:           "081-700-0002",
		Address:         "45/7 ซอยมิตรภาพ 12 ตำบลในเมือง อำเภอเมือง นครราชสีมา",
		Emergency:       "นายวิรัตน์ (สามี) 089-700-0002",
		SchemeType:      "ประกันสังคม (ม.33)",
		Allergies:       "แพ้ยา Penicillin (ผื่นลมพิษ)",
		ChronicDiseases: "ไมเกรน",

		ChiefComplaint:     "ปวดศีรษะข้างเดียว คลื่นไส้ ตาพร่ามัว มา 6 ชั่วโมง",
		MedicalHistory:     "ไมเกรน มีประวัติแพ้ยา Penicillin",
		NurseNotes:         "นอนพักห้องสังเกตอาการ อาการปวดศีรษะปานกลาง",
		TriageLevel:        "กึ่งฉุกเฉิน (Semi-Urgent)",
		PainScore:          6,
		BloodSugar:         102.0,
		FoodAllergies:      "ปฏิเสธการแพ้อาหาร",
		CurrentMedications: "Paracetamol 500mg, Cafergot",
		SmokingHistory:     "ไม่สูบ",
		AlcoholHistory:     "ดื่มเข้าสังคม",

		Weight: 54.2, Height: 158, Temperature: 36.8,
		SystolicBP: 130, DiastolicBP: 82,
		HeartRate: 84, RespiratoryRate: 18, SpO2: 99,
	},
	{
		FullName:        "นายประยุทธ จันทร์สว่าง",
		Gender:          "ชาย",
		BirthDate:       "1971-07-25",
		Phone:           "081-700-0003",
		Address:         "88 หมู่ 4 ตำบลหนองจะบก อำเภอเมือง นครราชสีมา",
		Emergency:       "นางสาวปิยะ (บุตรสาว) 089-700-0003",
		SchemeType:      "สิทธิ์ข้าราชการ",
		Allergies:       "ปฏิเสธการแพ้ยา",
		ChronicDiseases: "ความดันโลหิตสูง ไขมันในเลือดสูง",

		ChiefComplaint:     "แน่นหน้าอก เหนื่อยหอบ ร้าวไปแขนซ้าย เริ่มมา 2 ชั่วโมง",
		MedicalHistory:     "ความดันโลหิตสูง กินยา Amlodipine สูบบุหรี่วันละครึ่งซอง",
		NurseNotes:         "ให้ออกซิเจน 3 LPM แล้ว ทำ EKG รอแพทย์อ่านผลด่วน",
		TriageLevel:        "ฉุกเฉินเร่งด่วน (Level 2)",
		PainScore:          8,
		BloodSugar:         165.0,
		FoodAllergies:      "อาหารทะเล (กุ้ง, ปู)",
		CurrentMedications: "Amlodipine 5mg 1x1, Simvastatin 20mg 1xhs",
		SmokingHistory:     "สูบบุหรี่ 10 มวน/วัน (5 ปี)",
		AlcoholHistory:     "ดื่มแอลกอฮอล์ 2-3 ครั้ง/สัปดาห์",

		Weight: 82, Height: 170, Temperature: 36.9,
		SystolicBP: 158, DiastolicBP: 96,
		HeartRate: 112, RespiratoryRate: 26, SpO2: 94,
	},
	{
		FullName:        "ด.ช.ธนกร กาญจนา",
		Gender:          "ชาย",
		BirthDate:       "2018-05-14",
		Phone:           "081-700-0004",
		Address:         "23/1 ซอยสุรนารี 5 ตำบลในเมือง อำเภอเมือง นครราชสีมา",
		Emergency:       "นางกาญจนา (มารดา) 089-700-0004",
		SchemeType:      "บัตรทอง (สปสช.)",
		Allergies:       "ปฏิเสธการแพ้ยา",
		ChronicDiseases: "ไม่มีโรคประจำตัว",

		ChiefComplaint:     "มีไข้สูง 38.9°C ไอ มีน้ำมูก ซึม ทานอาหารได้น้อย มา 1 วัน",
		MedicalHistory:     "คลอดครบกำหนด วัคซีนครบตามเกณฑ์",
		NurseNotes:         "เช็ดตัวลดไข้ทันที ส่งพบกุมารแพทย์ห้องตรวจ 3 ด่วน",
		TriageLevel:        "เร่งด่วน (Urgent)",
		PainScore:          3,
		BloodSugar:         90.0,
		FoodAllergies:      "ปฏิเสธการแพ้อาหาร",
		CurrentMedications: "Tempra syrup",
		SmokingHistory:     "ไม่สูบ (เด็ก)",
		AlcoholHistory:     "ไม่ดื่ม (เด็ก)",

		Weight: 22.5, Height: 120, Temperature: 38.9,
		SystolicBP: 100, DiastolicBP: 65,
		HeartRate: 118, RespiratoryRate: 24, SpO2: 97,
	},
	{
		FullName:        "นางประภาศรี มีสุข",
		Gender:          "หญิง",
		BirthDate:       "1978-09-12",
		Phone:           "081-700-0005",
		Address:         "99/12 หมู่ 7 ตำบลหัวทะเล อำเภอเมือง นครราชสีมา",
		Emergency:       "นายสมพร (สามี) 089-700-0005",
		SchemeType:      "ประกันสุขภาพเอกชน",
		Allergies:       "แพ้ยา Sulfa",
		ChronicDiseases: "โรคกระเพาะอาหาร",

		ChiefComplaint:     "ปวดท้องบิดเกร็งบริเวณลิ้นปี่ คลื่นไส้อาเจียน 2 ครั้ง",
		MedicalHistory:     "โรคกระเพาะอาหาร ทานอาหารไม่ตรงเวลา",
		NurseNotes:         "กดเจ็บบริเวณ Epigastrium ไม่มี Rebound tenderness",
		TriageLevel:        "กึ่งฉุกเฉิน (Semi-Urgent)",
		PainScore:          5,
		BloodSugar:         105.0,
		FoodAllergies:      "ปฏิเสธการแพ้อาหาร",
		CurrentMedications: "Omeprazole 20mg",
		SmokingHistory:     "ไม่สูบ",
		AlcoholHistory:     "ไม่ดื่ม",

		Weight: 58.0, Height: 162, Temperature: 37.0,
		SystolicBP: 128, DiastolicBP: 80,
		HeartRate: 88, RespiratoryRate: 20, SpO2: 98,
	},
	{
		FullName:        "นายอนุสรณ์ อุดมศักดิ์",
		Gender:          "ชาย",
		BirthDate:       "1985-02-20",
		Phone:           "081-700-0006",
		Address:         "14/8 ถนนราชดำเนิน ตำบลในเมือง อำเภอเมือง นครราชสีมา",
		Emergency:       "นางสาวกัญจนา (ภรรยา) 089-700-0006",
		SchemeType:      "ชำระเงินเอง",
		Allergies:       "ปฏิเสธการแพ้ยา",
		ChronicDiseases: "ไม่มีโรคประจำตัว",

		ChiefComplaint:     "มีดบาดแขนขวา แผลฉีกขาดยาวประมาณ 3 ซม. เลือดซึม",
		MedicalHistory:     "ฉีดวัคซีนบาดทะยักครบเมื่อ 2 ปีก่อน",
		NurseNotes:         "กดห้ามเลือดแล้ว ส่งเข้าห้องหัตถการเพื่อทำแผลและเย็บแผล",
		TriageLevel:        "ไม่เร่งด่วน (Non-Urgent)",
		PainScore:          4,
		BloodSugar:         96.0,
		FoodAllergies:      "ปฏิเสธการแพ้อาหาร",
		CurrentMedications: "ไม่มี",
		SmokingHistory:     "สูบบุหรี่ 5 มวน/วัน",
		AlcoholHistory:     "ดื่มเข้าสังคม",

		Weight: 74.0, Height: 175, Temperature: 36.6,
		SystolicBP: 122, DiastolicBP: 76,
		HeartRate: 82, RespiratoryRate: 18, SpO2: 99,
	},
}

type QueueTargetSpec struct {
	Status     string
	Department string
	Note       string
}

var queueSpecs = []QueueTargetSpec{
	{Status: "รอคัดกรอง", Department: "จุดคัดกรอง", Note: "รอซักประวัติและวัดสัญญาณชีพ"},
	{Status: "รอพบแพทย์", Department: "ห้องตรวจ 1 (พญ.สุดา)", Note: "คัดกรองแล้ว: ปกติ (Normal) (BP: 120/80)"},
	{Status: "รอพบแพทย์", Department: "ห้องตรวจ 2 (นพ.วิชัย)", Note: "คัดกรองแล้ว: เร่งด่วน (Urgent) (BP: 135/85)"},
	{Status: "รอพบแพทย์", Department: "ห้องตรวจ 3 (พญ.เกศรา)", Note: "คัดกรองแล้ว: กุมารเวชกรรม (T: 38.5°C)"},
	{Status: "กำลังตรวจ", Department: "ห้องตรวจ 1 (พญ.สุดา)", Note: "แพทย์กำลังซักประวัติและตรวจร่างกาย"},
	{Status: "กำลังตรวจ", Department: "ห้องตรวจ 2 (นพ.วิชัย)", Note: "แพทย์กำลังตรวจรักษาและประเมินอาการ"},
	{Status: "กำลังตรวจ", Department: "ห้องตรวจ 3 (พญ.เกศรา)", Note: "กุมารแพทย์กำลังตรวจรักษา"},
	{Status: "รอทำหัตถการ", Department: "ห้องหัตถการ (ทำแผล/ฉีดยา)", Note: "ส่งทำแผล ล้างแผล และฉีดยาตามคำสั่งแพทย์"},
	{Status: "รอชำระเงิน", Department: "ห้องการเงิน (แคชเชียร์)", Note: "ตรวจเสร็จสิ้น รอชำระค่าบริการทางการแพทย์"},
	{Status: "รอรับยา", Department: "ห้องจ่ายยาและเภสัชกรรม", Note: "ชำระเงินแล้ว รอจัดยาและรับคำแนะนำการใช้ยา"},
	{Status: "เสร็จสิ้น", Department: "ห้องจ่ายยาและเภสัชกรรม", Note: "รับยาและเสร็จสิ้นขั้นตอนการรักษา"},
}

var client = &http.Client{Timeout: 30 * time.Second}

type doctorInfo struct {
	ID       uint   `json:"id"`
	Username string `json:"username"`
	FullName string `json:"fullname"`
}

func main() {
	defaultURL := "http://127.0.0.1:" + envOr("PORT", "8080")

	baseURL := flag.String("url", defaultURL, "ที่อยู่ของ backend (ค่าเริ่มต้น http://127.0.0.1:8080)")
	mode := flag.String("mode", "balanced", "โหมดการทำงาน: 'balanced' (กระจายคิวทุกสถานะให้สมดุล), 'continuous' (ยิงต่อเนื่อง), 'queue' (ยิงตรงเข้า Master Queue), 'registration' (ยิงเข้าลงทะเบียนอย่างเดียว)")
	count := flag.Int("n", 6, "จำนวนรายการที่ต้องการสร้าง")
	regInterval := flag.Duration("reg-interval", 5*time.Minute, "ระยะเวลาหน่วงการลงทะเบียนคนไข้ใหม่ในโหมด continuous (เช่น 5m, 10m)")
	queueInterval := flag.Duration("queue-interval", 15*time.Second, "ระยะเวลาหน่วงการยิง Master Queue ในโหมด continuous (เช่น 15s, 30s)")
	password := flag.String("password", "password", "รหัสผ่านของ user ที่ใช้เดิน flow")
	flag.Parse()

	url := strings.TrimRight(*baseURL, "/")
	log.Printf("เชื่อมต่อระบบ Backend ที่: %s", url)

	// --- เตรียม token ของแต่ละ role ---
	registrarToken, err := login(url, "registrar1", *password)
	if err != nil {
		log.Fatalf("login registrar1 ไม่สำเร็จ: %v", err)
	}
	nurseToken, err := login(url, "nurse1", *password)
	if err != nil {
		log.Fatalf("login nurse1 ไม่สำเร็จ: %v", err)
	}

	allDoctors, err := getAllDoctors(url, nurseToken)
	if err != nil || len(allDoctors) == 0 {
		log.Fatalf("ดึงรายชื่อแพทย์ไม่สำเร็จ: %v", err)
	}

	rng := rand.New(rand.NewSource(time.Now().UnixNano()))

	switch *mode {
	case "balanced":
		runBalancedSeed(url, registrarToken, nurseToken, allDoctors, *count)
	case "queue":
		runDirectQueueSeed(url, registrarToken, nurseToken, allDoctors, *count, rng)
	case "registration":
		runRegistrationOnlySeed(url, registrarToken, *count)
	case "continuous":
		runContinuousLoop(url, registrarToken, nurseToken, allDoctors, *regInterval, *queueInterval, rng)
	default:
		runBalancedSeed(url, registrarToken, nurseToken, allDoctors, *count)
	}
}

// ---------------------------------------------------------------------------
// 1. โหมด Balanced: กระจายคิวทุกสถานะให้เห็นภาพการทำงานครบทุกจุดบริการ
// ---------------------------------------------------------------------------
func runBalancedSeed(url, registrarToken, nurseToken string, allDoctors []doctorInfo, count int) {
	log.Println(strings.Repeat("=", 80))
	log.Println("กำลังจำลองข้อมูลแบบสมดุล (Balanced Mode): กระจายทุกสถานะและห้องตรวจ...")
	log.Println(strings.Repeat("-", 80))

	selectedSpecs := []QueueTargetSpec{
		{Status: "รอคัดกรอง", Department: "จุดคัดกรอง", Note: "รอซักประวัติและวัดสัญญาณชีพ"},
		{Status: "รอพบแพทย์", Department: "ห้องตรวจ 1 (พญ.สุดา)", Note: "คัดกรองแล้ว: ปกติ (Normal)"},
		{Status: "รอพบแพทย์", Department: "ห้องตรวจ 2 (นพ.วิชัย)", Note: "คัดกรองแล้ว: เร่งด่วน (Urgent)"},
		{Status: "กำลังตรวจ", Department: "ห้องตรวจ 3 (พญ.เกศรา)", Note: "กุมารแพทย์กำลังตรวจรักษา"},
		{Status: "รอทำหัตถการ", Department: "ห้องหัตถการ (ทำแผล/ฉีดยา)", Note: "ส่งทำแผลและฉีดยาตามคำสั่งแพทย์"},
		{Status: "รอชำระเงิน", Department: "ห้องการเงิน (แคชเชียร์)", Note: "ตรวจเสร็จสิ้น รอชำระค่าบริการ"},
		{Status: "รอรับยา", Department: "ห้องจ่ายยาและเภสัชกรรม", Note: "ชำระเงินแล้ว รอจัดยา"},
	}

	if count > len(selectedSpecs) {
		count = len(selectedSpecs)
	}

	for i := 0; i < count; i++ {
		c := cases[i%len(cases)]
		spec := selectedSpecs[i]
		nationalID := fmt.Sprintf("1%012d", (time.Now().UnixNano()/1000)%1000000000000+int64(i))

		// 1. ลงทะเบียนผู้ป่วย
		patientID, hn, err := registerPatient(url, registrarToken, c, nationalID)
		if err != nil {
			log.Printf("[%d] ลงทะเบียน %s ไม่สำเร็จ: %v", i+1, c.FullName, err)
			continue
		}

		// 2. ออกบัตรคิว
		queueID, queueNo, err := createQueue(url, registrarToken, patientID, spec.Department, spec.Note)
		if err != nil {
			log.Printf("[%d] ออกคิวให้ %s ไม่สำเร็จ: %v", i+1, c.FullName, err)
			continue
		}

		// 3. ถ้าเป็นสถานะที่ผ่านการคัดกรองแล้ว ให้บันทึก Vitals ด้วย
		if spec.Status != "รอคัดกรอง" {
			targetDoc := allDoctors[i%len(allDoctors)]
			_ = recordVitals(url, nurseToken, c, patientID, queueNo, targetDoc.ID)
			_ = updateQueueStatus(url, registrarToken, queueID, spec.Status, spec.Department, spec.Note)
		}

		log.Printf("[%d] คิว: %-6s | HN: %-7s | ผู้ป่วย: %-22s | แผนก: %-26s | สถานะ: %s",
			i+1, queueNo, hn, c.FullName, spec.Department, spec.Status)
	}

	// สร้างคนไข้ที่ "ยังไม่ได้เข้าคิว" 1 ราย สำหรับหน้าจอลงทะเบียน (/registration)
	unqCase := cases[count%len(cases)]
	unqNationalID := fmt.Sprintf("1%012d", (time.Now().UnixNano()/1000)%1000000000000+999)
	_, unqHN, err := registerPatient(url, registrarToken, unqCase, unqNationalID)
	if err == nil {
		log.Println(strings.Repeat("-", 80))
		log.Printf("[+] ลงทะเบียนผู้ป่วยใหม่ (ยังไม่เข้าคิว): %s (HN: %s) -> แสดงในหน้า /registration", unqCase.FullName, unqHN)
	}

	log.Println(strings.Repeat("=", 80))
	log.Printf("สำเร็จ! ระบบมีข้อมูลคิวครบทุกสถานะใน /queue และผู้ป่วยรอส่งคิวใน /registration พร้อมทดสอบ")
}

// ---------------------------------------------------------------------------
// 2. โหมด Continuous Loop: ยิงคนไข้ลงทะเบียนตามช่วงเวลา และยิงคิวต่อเนื่อง
// ---------------------------------------------------------------------------
func runContinuousLoop(url, registrarToken, nurseToken string, allDoctors []doctorInfo, regInterval, queueInterval time.Duration, rng *rand.Rand) {
	log.Println(strings.Repeat("=", 80))
	log.Printf("เริ่มต้นโหมด Continuous Simulator:")
	log.Printf("   - ยิงผู้ป่วยใหม่เข้าหน้าระบบลงทะเบียน (/registration) ทุกๆ: %v", regInterval)
	log.Printf("   - ยิงคิวจำลองตรงเข้า Master Queue (/queue) ทุกๆ: %v", queueInterval)
	log.Println(strings.Repeat("=", 80))

	regTicker := time.NewTicker(regInterval)
	queueTicker := time.NewTicker(queueInterval)
	defer regTicker.Stop()
	defer queueTicker.Stop()

	// ยิงตั้งต้น 1 รายการทันที
	fireOneQueue(url, registrarToken, nurseToken, allDoctors, rng)

	seq := 1
	for {
		select {
		case <-regTicker.C:
			// สุ่มยิงคนไข้เข้าหน้าระบบลงทะเบียน (ยังไม่เข้าคิว)
			c := cases[rng.Intn(len(cases))]
			nationalID := fmt.Sprintf("1%012d", (time.Now().UnixNano()/1000)%1000000000000+int64(seq))
			_, hn, err := registerPatient(url, registrarToken, c, nationalID)
			if err == nil {
				log.Printf("[REG] ผู้ป่วยใหม่ลงทะเบียนเข้าสู่ระบบ: %s (HN: %s) | เวลารอ: %v", c.FullName, hn, regInterval)
			}
			seq++

		case <-queueTicker.C:
			// ยิงคิวตรงเข้าสู่ Master Queue พร้อมสุ่มสถานะและห้องตรวจ
			fireOneQueue(url, registrarToken, nurseToken, allDoctors, rng)
		}
	}
}

func fireOneQueue(url, registrarToken, nurseToken string, allDoctors []doctorInfo, rng *rand.Rand) {
	c := cases[rng.Intn(len(cases))]
	spec := queueSpecs[rng.Intn(len(queueSpecs))]
	nationalID := fmt.Sprintf("1%012d", (time.Now().UnixNano()/1000)%1000000000000+int64(rng.Intn(9000)+1000))

	patientID, hn, err := registerPatient(url, registrarToken, c, nationalID)
	if err != nil {
		return
	}

	queueID, queueNo, err := createQueue(url, registrarToken, patientID, spec.Department, spec.Note)
	if err != nil {
		return
	}

	if spec.Status != "รอคัดกรอง" {
		targetDoc := allDoctors[rng.Intn(len(allDoctors))]
		_ = recordVitals(url, nurseToken, c, patientID, queueNo, targetDoc.ID)
		_ = updateQueueStatus(url, registrarToken, queueID, spec.Status, spec.Department, spec.Note)
	}

	log.Printf("[QUEUE] คิว: %-6s | HN: %-7s | ผู้ป่วย: %-22s | แผนก: %-26s | สถานะ: %s",
		queueNo, hn, c.FullName, spec.Department, spec.Status)
}

// ---------------------------------------------------------------------------
// 3. โหมด Direct Queue Seed: ยิงคิวตรงเข้า Master Queue แบบสุ่ม
// ---------------------------------------------------------------------------
func runDirectQueueSeed(url, registrarToken, nurseToken string, allDoctors []doctorInfo, count int, rng *rand.Rand) {
	log.Printf("กำลังยิงคิวจำลองตรงเข้า Master Queue จำนวน %d คิว...", count)
	for i := 0; i < count; i++ {
		fireOneQueue(url, registrarToken, nurseToken, allDoctors, rng)
		time.Sleep(1 * time.Second)
	}
}

// ---------------------------------------------------------------------------
// 4. โหมด Registration Only: ยิงผู้ป่วยเข้าหน้าระบบลงทะเบียน (ยังไม่เข้าคิว)
// ---------------------------------------------------------------------------
func runRegistrationOnlySeed(url, registrarToken string, count int) {
	log.Printf("กำลังลงทะเบียนผู้ป่วยใหม่ (ยังไม่เข้าคิว) จำนวน %d ราย...", count)
	for i := 0; i < count; i++ {
		c := cases[i%len(cases)]
		nationalID := fmt.Sprintf("1%012d", (time.Now().UnixNano()/1000)%1000000000000+int64(i))
		_, hn, err := registerPatient(url, registrarToken, c, nationalID)
		if err == nil {
			log.Printf("[%d] ลงทะเบียนผู้ป่วย: %s (HN: %s) -> แสดงในตาราง /registration", i+1, c.FullName, hn)
		}
		time.Sleep(500 * time.Millisecond)
	}
}

// ---------------------------------------------------------------------------
// ตัวช่วยเรียก API แต่ละ endpoint
// ---------------------------------------------------------------------------

func login(baseURL, username, password string) (string, error) {
	body := map[string]string{"username": username, "password": password}

	var res struct {
		Token string `json:"token"`
	}
	if err := call(baseURL, "POST", "/login", "", body, &res); err != nil {
		return "", err
	}
	if res.Token == "" {
		return "", fmt.Errorf("ไม่ได้รับ token กลับมา")
	}
	return res.Token, nil
}

func getAllDoctors(baseURL, token string) ([]doctorInfo, error) {
	var doctors []doctorInfo
	if err := call(baseURL, "GET", "/api/doctors", token, nil, &doctors); err != nil {
		return nil, err
	}
	return doctors, nil
}

func registerPatient(baseURL, token string, c visitCase, nationalID string) (uint, string, error) {
	body := map[string]any{
		"national_id":       nationalID,
		"fullname":          c.FullName,
		"gender":            c.Gender,
		"birthdate":         c.BirthDate,
		"address":           c.Address,
		"phone_number":      c.Phone,
		"emergency_contact": c.Emergency,
		"scheme_type":       c.SchemeType,
		"allergies":         c.Allergies,
		"chronic_diseases":  c.ChronicDiseases,
	}

	var res struct {
		Patient struct {
			ID uint   `json:"id"`
			HN string `json:"hn"`
		} `json:"patient"`
	}
	if err := call(baseURL, "POST", "/api/registrar/patients", token, body, &res); err != nil {
		return 0, "", err
	}
	if res.Patient.ID == 0 {
		return 0, "", fmt.Errorf("ไม่ได้รับรหัสผู้ป่วยกลับมา")
	}
	return res.Patient.ID, res.Patient.HN, nil
}

func createQueue(baseURL, token string, patientID uint, department, note string) (uint, string, error) {
	if department == "" {
		department = "จุดคัดกรอง"
	}
	if note == "" {
		note = "ข้อมูลทดสอบระบบ"
	}

	body := map[string]any{
		"patient_id": patientID,
		"department": department,
		"note":       note,
	}

	var res struct {
		Queue struct {
			ID          uint   `json:"id"`
			QueueNumber string `json:"queue_number"`
		} `json:"queue"`
	}
	if err := call(baseURL, "POST", "/api/queue/create", token, body, &res); err != nil {
		return 0, "", err
	}
	return res.Queue.ID, res.Queue.QueueNumber, nil
}

func updateQueueStatus(baseURL, token string, queueID uint, status, department, note string) error {
	body := map[string]any{
		"status":     status,
		"department": department,
		"note":       note,
	}
	return call(baseURL, "PUT", fmt.Sprintf("/api/queue/%d/status", queueID), token, body, nil)
}

func recordVitals(baseURL, token string, c visitCase, patientID uint, queueNo string, doctorID uint) error {
	body := map[string]any{
		"patient_id":          patientID,
		"queue_number":        queueNo,
		"chief_complaint":     c.ChiefComplaint,
		"weight":              c.Weight,
		"height":              c.Height,
		"temperature":         c.Temperature,
		"systolic_bp":         c.SystolicBP,
		"diastolic_bp":        c.DiastolicBP,
		"heart_rate":          c.HeartRate,
		"respiratory_rate":    c.RespiratoryRate,
		"spo2":                c.SpO2,
		"allergies":           c.Allergies,
		"food_allergies":      c.FoodAllergies,
		"medical_history":     c.MedicalHistory,
		"current_medications": c.CurrentMedications,
		"smoking_history":     c.SmokingHistory,
		"alcohol_history":     c.AlcoholHistory,
		"pain_score":          c.PainScore,
		"blood_sugar":         c.BloodSugar,
		"nurse_notes":         c.NurseNotes,
		"assigned_doctor_id":  doctorID,
		"triage_level":        c.TriageLevel,
	}

	return call(baseURL, "POST", "/api/nurse/vitals", token, body, nil)
}

func call(baseURL, method, path, token string, body any, out any) error {
	var reader io.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			return err
		}
		reader = bytes.NewReader(raw)
	}

	req, err := http.NewRequest(method, baseURL+path, reader)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		var errRes struct {
			Error   string `json:"error"`
			Message string `json:"message"`
		}
		_ = json.Unmarshal(raw, &errRes)

		msg := errRes.Error
		if msg == "" {
			msg = errRes.Message
		}
		if msg == "" {
			msg = strings.TrimSpace(string(raw))
		}
		return fmt.Errorf("HTTP %d: %s", resp.StatusCode, msg)
	}

	if out == nil {
		return nil
	}
	return json.Unmarshal(raw, out)
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
