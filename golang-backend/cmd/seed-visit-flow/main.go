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

	ChiefComplaint string
	MedicalHistory string
	NurseNotes     string
	TriageLevel    string // เว้นว่างได้ backend จะประเมินจากสัญญาณชีพให้เอง

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
		FullName:        "นายทดสอบ ระบบหนึ่ง",
		Gender:          "ชาย",
		BirthDate:       "1992-03-18",
		Phone:           "081-700-0001",
		Address:         "119/2 ถนนสุรนารายณ์ ตำบลในเมือง อำเภอเมือง นครราชสีมา",
		Emergency:       "นางสมพร (มารดา) 089-700-0001",
		SchemeType:      "บัตรทอง (สปสช.)",
		Allergies:       "ปฏิเสธการแพ้ยา",
		ChronicDiseases: "ไม่มีโรคประจำตัว",

		ChiefComplaint: "ไข้ต่ำๆ ไอมีเสมหะ เจ็บคอ มา 3 วัน",
		MedicalHistory: "ไม่มีโรคประจำตัว ไม่เคยผ่าตัด",
		NurseNotes:     "รู้สึกตัวดี เดินได้เอง ไม่มีภาวะขาดน้ำ",
		TriageLevel:    "ปกติ (Normal)",

		Weight: 68.5, Height: 172, Temperature: 37.8,
		SystolicBP: 124, DiastolicBP: 78,
		HeartRate: 88, RespiratoryRate: 20, SpO2: 98,
	},
	{
		FullName:        "นางสาวทดสอบ ระบบสอง",
		Gender:          "หญิง",
		BirthDate:       "1988-11-02",
		Phone:           "081-700-0002",
		Address:         "45/7 ซอยมิตรภาพ 12 ตำบลในเมือง อำเภอเมือง นครราชสีมา",
		Emergency:       "นายวิรัตน์ (สามี) 089-700-0002",
		SchemeType:      "ประกันสังคม (ม.33)",
		Allergies:       "แพ้ยา Penicillin (ผื่นลมพิษ)",
		ChronicDiseases: "ไมเกรน",

		ChiefComplaint: "ปวดท้องบิดเป็นพักๆ บริเวณท้องน้อยขวา มา 1 วัน",
		MedicalHistory: "เคยผ่าตัดไส้ติ่งเมื่อ 10 ปีก่อน",
		NurseNotes:     "สีหน้าเจ็บปวด กดเจ็บท้องน้อยขวา ยังไม่มีไข้",
		TriageLevel:    "เร่งด่วน (Urgent)",

		Weight: 54.2, Height: 158, Temperature: 37.1,
		SystolicBP: 132, DiastolicBP: 84,
		HeartRate: 96, RespiratoryRate: 22, SpO2: 99,
	},
	{
		FullName:        "นายทดสอบ ระบบสาม",
		Gender:          "ชาย",
		BirthDate:       "1971-07-25",
		Phone:           "081-700-0003",
		Address:         "88 หมู่ 4 ตำบลหนองจะบก อำเภอเมือง นครราชสีมา",
		Emergency:       "นางสาวปิยะ (บุตรสาว) 089-700-0003",
		SchemeType:      "สิทธิ์ข้าราชการ",
		Allergies:       "ปฏิเสธการแพ้ยา",
		ChronicDiseases: "ความดันโลหิตสูง ไขมันในเลือดสูง",

		ChiefComplaint: "แน่นหน้าอก เหนื่อยหอบ ร้าวไปแขนซ้าย เริ่มมา 2 ชั่วโมง",
		MedicalHistory: "ความดันโลหิตสูง กินยา Amlodipine สูบบุหรี่วันละครึ่งซอง",
		NurseNotes:     "ให้ออกซิเจน 3 LPM แล้ว ทำ EKG รอแพทย์อ่านผลด่วน",
		TriageLevel:    "ฉุกเฉิน (Emergency)",

		Weight: 82, Height: 170, Temperature: 36.9,
		SystolicBP: 158, DiastolicBP: 96,
		HeartRate: 112, RespiratoryRate: 26, SpO2: 94,
	},
}

var client = &http.Client{Timeout: 30 * time.Second}

func main() {
	defaultURL := "http://127.0.0.1:" + envOr("PORT", "8081")

	baseURL := flag.String("url", defaultURL, "ที่อยู่ของ backend")
	doctorUser := flag.String("doctor", "doctor1", "username ของแพทย์ที่จะรับคิว")
	password := flag.String("password", "password", "รหัสผ่านของ user ที่ใช้เดิน flow")
	count := flag.Int("n", len(cases), "จำนวนผู้ป่วยที่ต้องการสร้าง")
	flag.Parse()

	url := strings.TrimRight(*baseURL, "/")

	n := *count
	if n < 1 {
		n = 1
	}
	if n > len(cases) {
		n = len(cases)
	}

	log.Printf("เชื่อมต่อ %s", url)

	// --- เตรียม token ของแต่ละ role ---
	registrarToken, err := login(url, "registrar1", *password)
	if err != nil {
		log.Fatalf("login registrar1 ไม่สำเร็จ: %v", err)
	}
	nurseToken, err := login(url, "nurse1", *password)
	if err != nil {
		log.Fatalf("login nurse1 ไม่สำเร็จ: %v", err)
	}

	doctorID, doctorName, err := findDoctor(url, nurseToken, *doctorUser)
	if err != nil {
		log.Fatalf("หาแพทย์ไม่เจอ: %v", err)
	}
	log.Printf("ส่งต่อให้แพทย์: %s (user_id %d)", doctorName, doctorID)
	log.Println(strings.Repeat("-", 62))

	created := 0
	for i := 0; i < n; i++ {
		c := cases[i]

		// เลขบัตรอิงเวลาปัจจุบัน กันชนกับที่เคยลงทะเบียนไว้
		nationalID := fmt.Sprintf("1%012d", (time.Now().UnixNano()/1000)%1000000000000+int64(i))

		// ---------- ขั้นที่ 1: เจ้าหน้าที่เวชระเบียนลงทะเบียนผู้ป่วย ----------
		patientID, hn, err := registerPatient(url, registrarToken, c, nationalID)
		if err != nil {
			log.Printf("[%d] ลงทะเบียน %s ไม่สำเร็จ: %v", i+1, c.FullName, err)
			continue
		}

		// ---------- ขั้นที่ 2: ออกบัตรคิว ----------
		queueNo, err := createQueue(url, registrarToken, patientID)
		if err != nil {
			log.Printf("[%d] ออกคิวให้ %s ไม่สำเร็จ: %v", i+1, c.FullName, err)
			continue
		}

		// ---------- ขั้นที่ 3: พยาบาลคัดกรองและส่งต่อแพทย์ ----------
		triage, err := recordVitals(url, nurseToken, c, patientID, queueNo, doctorID)
		if err != nil {
			log.Printf("[%d] คัดกรอง %s ไม่สำเร็จ: %v", i+1, c.FullName, err)
			continue
		}

		created++
		log.Printf("[%d] %s  %-24s  %-8s  %s", i+1, queueNo, c.FullName, hn, triage)
	}

	log.Println(strings.Repeat("-", 62))
	log.Printf("เสร็จ %d ราย — คิวอยู่ที่สถานะ \"รอพบแพทย์\" แล้ว", created)
	log.Printf("เปิดหน้าเว็บ login เป็น %s แล้วกดรีเฟรชหน้าคิวผู้ป่วยได้เลย", *doctorUser)
}

// ---------------------------------------------------------------------------
// ขั้นตอนแต่ละขั้น
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

// findDoctor - หา user_id ของแพทย์จาก username ผ่าน GET /api/doctors
func findDoctor(baseURL, token, username string) (uint, string, error) {
	var doctors []struct {
		ID       uint   `json:"id"`
		Username string `json:"username"`
		FullName string `json:"fullname"`
	}
	if err := call(baseURL, "GET", "/api/doctors", token, nil, &doctors); err != nil {
		return 0, "", err
	}

	for _, d := range doctors {
		if strings.EqualFold(d.Username, username) {
			return d.ID, d.FullName, nil
		}
	}
	return 0, "", fmt.Errorf("ไม่พบแพทย์ username '%s' (มีทั้งหมด %d คน)", username, len(doctors))
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

func createQueue(baseURL, token string, patientID uint) (string, error) {
	body := map[string]any{
		"patient_id": patientID,
		"department": "แผนกคัดกรอง",
		"note":       "ข้อมูลทดสอบระบบ (seed-visit-flow)",
	}

	var res struct {
		Queue struct {
			QueueNumber string `json:"queue_number"`
		} `json:"queue"`
	}
	if err := call(baseURL, "POST", "/api/queue/create", token, body, &res); err != nil {
		return "", err
	}
	return res.Queue.QueueNumber, nil
}

func recordVitals(baseURL, token string, c visitCase, patientID uint, queueNo string, doctorID uint) (string, error) {
	body := map[string]any{
		"patient_id":         patientID,
		"queue_number":       queueNo,
		"chief_complaint":    c.ChiefComplaint,
		"weight":             c.Weight,
		"height":             c.Height,
		"temperature":        c.Temperature,
		"systolic_bp":        c.SystolicBP,
		"diastolic_bp":       c.DiastolicBP,
		"heart_rate":         c.HeartRate,
		"respiratory_rate":   c.RespiratoryRate,
		"spo2":               c.SpO2,
		"allergies":          c.Allergies,
		"medical_history":    c.MedicalHistory,
		"nurse_notes":        c.NurseNotes,
		"assigned_doctor_id": doctorID,
		"triage_level":       c.TriageLevel,
	}

	var res struct {
		TriageLevel string `json:"triage_level"`
	}
	if err := call(baseURL, "POST", "/api/nurse/vitals", token, body, &res); err != nil {
		return "", err
	}
	return res.TriageLevel, nil
}

// ---------------------------------------------------------------------------
// ตัวช่วยเรียก API
// ---------------------------------------------------------------------------

// call - ยิง request หนึ่งครั้ง แล้วแกะ JSON ใส่ out
//
// ถ้า backend ตอบไม่ใช่ 2xx จะดึงข้อความในฟิลด์ error ออกมาเป็นข้อความผิดพลาด
// (controller ของโปรเจกต์นี้ตอบ {"error": "..."} เป็นภาษาไทยอยู่แล้ว)
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
