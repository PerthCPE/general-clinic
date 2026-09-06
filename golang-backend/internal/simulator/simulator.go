package simulator

import (
	"fmt"
	"log"
	"math/rand"
	"os"
	"strconv"
	"strings"
	"time"

	"clinic-backend/internal/config"
	"clinic-backend/internal/models"
	"clinic-backend/internal/ws"
)

// คลังชื่อภาษาไทยสำหรับการสุ่มสร้างชื่อผู้ป่วยใหม่ที่ไม่ซ้ำเดิม
var maleFirstNames = []string{
	"สมชาย", "สมศักดิ์", "อาทิตย์", "วรวิทย์", "ธีรภัทร", "ชัยวัฒน์", "เอกชัย", "ณัฐพงษ์",
	"ธนกฤต", "วีระชัย", "พงษ์ศธร", "ศักดิ์ชัย", "ปิยะพงษ์", "จิรวัฒน์", "อานนท์", "ธนภัทร",
	"ภาณุพงศ์", "นรินทร์", "กฤษณะ", "ทศพร", "สุรเดช", "ธนดล", "อรรถพล", "ปรัชญา",
	"วรัญญู", "พิชิต", "ชวลิต", "รณชัย", "ยุทธนา", "ธนทัต", "เกียรติศักดิ์", "อนุชา",
	"กิตติพงษ์", "ศุภชัย", "อดิศักดิ์", "ชัชวาลย์", "พงศ์พันธ์", "วัชรพล", "ปัญญวัฒน์", "ณรงค์เดช",
}

var femaleFirstNames = []string{
	"สมศรี", "วิภาดา", "นภาลัย", "วรรณวิภา", "กัญญารัตน์", "พัชราภรณ์", "ศศิธร", "ศิริพร",
	"รัตนาภรณ์", "สุพรรษา", "เบญจวรรณ", "ชลธิชา", "อมรรัตน์", "ณิชากานต์", "ทิพวรรณ", "กมลชนก",
	"ปิยะธิดา", "กุลธิดา", "ดารารัตน์", "กนกวรรณ", "จุฑามาศ", "นฤมล", "สุจิตรา", "รุ่งนภา",
	"ประภัสสร", "พิมพรรณ", "อรุณรัตน์", "สุภาภรณ์", "อังคณา", "เกศรา", "ปรียาภรณ์", "พรสวรรค์",
	"ชญาภา", "ชนกนันท์", "สิริกร", "ภัทรวดี", "นภัสสร", "พิมพ์พิชชา", "พัชรีวรรณ", "สุดารัตน์",
}

var surnames = []string{
	"ใจดี", "มณีรัตน์", "มีสุข", "รักษาดี", "กิตติพงษ์", "มีทรัพย์", "ยืนยง", "วงศ์สว่าง",
	"ภักดีชน", "สว่างแดน", "จันทร์สว่าง", "กาญจนา", "อุดมศักดิ์", "ทองดี", "รักษ์ถิ่น", "สุขสมบูรณ์",
	"ชาญการแพทย์", "ศิริวัฒน์", "อมรเลิศ", "วงศ์สุวรรณ", "พงษ์ไพศาล", "รัตนโชติ", "เกียรติขจร", "มหานิยม",
	"ศรีเจริญ", "วรวงศ์", "พัฒนพงษ์", "กิจเจริญ", "ธนสมบัติ", "พิทักษ์ไทย", "บุญประเสริฐ", "เลิศรัตนชัย",
	"เจริญสุข", "วัฒนกุล", "ไพโรจน์ศิริ", "มงคลสวัสดิ์", "ชื่นชมจิต", "ประเสริฐยิ่ง", "โชติช่วง", "ประสิทธิ์ชัย",
}

var schemes = []string{
	"บัตรทอง (สปสช.)",
	"ประกันสังคม (ม.33)",
	"สิทธิ์ข้าราชการ",
	"ประกันสุขภาพเอกชน",
	"ชำระเงินเอง",
}

var complaints = []struct {
	Complaint      string
	History        string
	NurseNote      string
	Triage         string
	PainScore      int
	NeedsProcedure bool
	Specialty      string // general, medicine, pediatrics
}{
	{
		Complaint: "ไข้ต่ำๆ ไอมีเสมหะ เจ็บคอ มา 3 วัน", History: "ไม่มีโรคประจำตัว ไม่เคยผ่าตัด",
		NurseNote: "รู้สึกตัวดี เดินได้เอง ไม่มีภาวะขาดน้ำ", Triage: "ปกติ (Normal)", PainScore: 1, NeedsProcedure: false, Specialty: "general",
	},
	{
		Complaint: "ปวดศีรษะข้างเดียว คลื่นไส้ ตาพร่ามัว มา 6 ชั่วโมง", History: "ไมเกรน มีประวัติแพ้ยา Penicillin",
		NurseNote: "นอนพักห้องสังเกตอาการ อาการปวดศีรษะปานกลาง", Triage: "กึ่งฉุกเฉิน (Semi-Urgent)", PainScore: 6, NeedsProcedure: false, Specialty: "medicine",
	},
	{
		Complaint: "แน่นหน้าอก เหนื่อยหอบ ร้าวไปแขนซ้าย เริ่มมา 2 ชั่วโมง", History: "ความดันโลหิตสูง สูบบุหรี่วันละครึ่งซอง",
		NurseNote: "ให้ออกซิเจน 3 LPM แล้ว EKG 12 Lead ส่งพบแพทย์ด่วน", Triage: "ฉุกเฉินเร่งด่วน (Level 2)", PainScore: 8, NeedsProcedure: false, Specialty: "medicine",
	},
	{
		Complaint: "มีไข้สูง 38.9°C ไอ มีน้ำมูก ซึม ทานอาหารได้น้อย มา 1 วัน", History: "คลอดครบกำหนด วัคซีนครบตามเกณฑ์",
		NurseNote: "เช็ดตัวลดไข้ทันที ส่งพบกุมารแพทย์ห้องตรวจ 3 ด่วน", Triage: "เร่งด่วน (Urgent)", PainScore: 3, NeedsProcedure: false, Specialty: "pediatrics",
	},
	{
		Complaint: "มีดบาดแขนขวา แผลฉีกขาดยาว 3 ซม. เลือดไหลซึม", History: "ฉีดวัคซีนบาดทะยักครบเมื่อ 2 ปีก่อน",
		NurseNote: "กดห้ามเลือดแล้ว ส่งเข้าห้องหัตถการเพื่อทำแผลและเย็บแผล", Triage: "ไม่เร่งด่วน (Non-Urgent)", PainScore: 5, NeedsProcedure: true, Specialty: "general",
	},
	{
		Complaint: "ปวดท้องบิดเกร็งบริเวณลิ้นปี่ คลื่นไส้อาเจียน 2 ครั้ง", History: "โรคกระเพาะอาหาร ทานอาหารไม่ตรงเวลา",
		NurseNote: "กดเจ็บบริเวณ Epigastrium ไม่มี Rebound tenderness", Triage: "กึ่งฉุกเฉิน (Semi-Urgent)", PainScore: 5, NeedsProcedure: false, Specialty: "medicine",
	},
	{
		Complaint: "ผื่นแดงคันตามตัว ตาบวม หลังรับประทานอาหารทะเล 1 ชม.", History: "ประวัติแพ้กุ้ง ทานอาหารนอกบ้าน",
		NurseNote: "ริมฝีปากบวมเล็กน้อย ไม่มี Stridor ให้นั่งสังเกตอาการ", Triage: "เร่งด่วน (Urgent)", PainScore: 3, NeedsProcedure: true, Specialty: "medicine",
	},
	{
		Complaint: "ตรวจติดตามอาการเบาหวานและความดันตามนัด และรับยาต่อเนื่อง", History: "เบาหวานชนิดที่ 2 (10 ปี), ความดันโลหิตสูง (8 ปี)",
		NurseNote: "ไม่มีอาการผิดปกติ ตรวจ DTX ก่อนพบแพทย์", Triage: "ปกติ (Normal)", PainScore: 0, NeedsProcedure: false, Specialty: "medicine",
	},
}

// generateUniquePatientData สุ่มสร้างข้อมูลผู้ป่วยไทยใหม่ที่ไม่ซ้ำใคร
func generateUniquePatientData(rng *rand.Rand) (models.Patient, models.MedicalEligibility, int, bool, string) {
	isMale := rng.Intn(2) == 0
	var prefix, firstName string
	gender := "ชาย"
	if isMale {
		prefix = "นาย"
		firstName = maleFirstNames[rng.Intn(len(maleFirstNames))]
	} else {
		prefix = "นางสาว"
		firstName = femaleFirstNames[rng.Intn(len(femaleFirstNames))]
		gender = "หญิง"
	}
	surname := surnames[rng.Intn(len(surnames))]
	fullName := fmt.Sprintf("%s%s %s", prefix, firstName, surname)

	scheme := schemes[rng.Intn(len(schemes))]
	complaintIdx := rng.Intn(len(complaints))
	c := complaints[complaintIdx]

	birthYear := 1950 + rng.Intn(55)
	birthMonth := 1 + rng.Intn(12)
	birthDay := 1 + rng.Intn(28)
	birthDate := time.Date(birthYear, time.Month(birthMonth), birthDay, 0, 0, 0, 0, time.Local)

	phone := fmt.Sprintf("08%d-%03d-%04d", rng.Intn(10), rng.Intn(1000), rng.Intn(10000))
	nationalID := fmt.Sprintf("1%012d", (time.Now().UnixNano()/1000)%1000000000000+int64(rng.Intn(90000)+1000))

	// คำนวณ HN ฐาน 16 (HN0001 - HNFFFF)
	var lastPatient models.Patient
	var hn string
	if err := config.DB.Order("id desc").First(&lastPatient).Error; err == nil {
		var lastNum int
		cleanHex := strings.TrimPrefix(strings.ToUpper(lastPatient.HN), "HN")
		fmt.Sscanf(cleanHex, "%X", &lastNum)
		if lastNum > 0 {
			hn = fmt.Sprintf("HN%04X", lastNum+1)
		} else {
			hn = fmt.Sprintf("HN%04X", lastPatient.ID+1)
		}
	} else {
		hn = "HN0001"
	}

	allergies := "ปฏิเสธการแพ้ยา"
	if rng.Intn(4) == 0 {
		allergies = "แพ้ยา Penicillin (ผื่นลมพิษ)"
	}

	p := models.Patient{
		HN:               hn,
		NationalID:       nationalID,
		FullName:         fullName,
		Gender:           gender,
		BirthDate:        birthDate,
		Address:          fmt.Sprintf("%d/%d หมู่ %d ถนนสุรนารายณ์ อำเภอเมือง นครราชสีมา", rng.Intn(200)+1, rng.Intn(50)+1, rng.Intn(15)+1),
		PhoneNumber:      phone,
		EmergencyContact: fmt.Sprintf("ผู้เกี่ยวข้อง %s", phone),
		SchemeType:       scheme,
		Allergies:        allergies,
		ChronicDiseases:  c.History,
	}

	var regUser models.User
	config.DB.Where("role = ?", "registrar").First(&regUser)
	regUserID := regUser.ID
	if regUserID == 0 {
		regUserID = 1
	}

	elig := models.MedicalEligibility{
		UserID:          &regUserID,
		SchemeType:      scheme,
		CoverageDetails: "สิทธิ์การรักษาตรวจสุขภาพและบริการทั่วไป",
		HospitalName:    "โรงพยาบาลคลินิกเวชกรรม",
		Status:          "ใช้งานได้",
		ExpireDate:      "31/12/2026",
		VerifiedAt:      time.Now(),
	}

	return p, elig, complaintIdx, c.NeedsProcedure, c.Specialty
}

// StartAutoEmitter เริ่มต้นระบบจำลองสถานะคิวอัตโนมัติตลอดเวลาที่เซิร์ฟเวอร์เปิดใช้งาน
func StartAutoEmitter() {
	enabledStr := os.Getenv("AUTO_SIMULATOR_ENABLED")
	if strings.EqualFold(enabledStr, "false") || enabledStr == "0" {
		log.Println("[AutoSimulator] ปิดการทำงาน (AUTO_SIMULATOR_ENABLED=false)")
		return
	}

	regMinMinutes := 5
	regMaxMinutes := 10
	if val := os.Getenv("AUTO_SIM_REG_MIN"); val != "" {
		if v, err := strconv.Atoi(val); err == nil && v > 0 {
			regMinMinutes = v
			regMaxMinutes = v + 3
		}
	}

	// ความถี่ในการเลื่อนขั้นสถานะคิว (ค่าเริ่มต้น ทุก 4 นาที)
	progressMinutes := 4
	if val := os.Getenv("AUTO_SIM_PROGRESS_MIN"); val != "" {
		if v, err := strconv.Atoi(val); err == nil && v > 0 {
			progressMinutes = v
		}
	} else if val := os.Getenv("AUTO_SIM_PROGRESS_SEC"); val != "" {
		if v, err := strconv.Atoi(val); err == nil && v > 0 {
			progressMinutes = v / 60
			if progressMinutes < 1 {
				progressMinutes = 1
			}
		}
	}

	// ความถี่ในการสร้างคิวใหม่เข้าจุดคัดกรอง (ค่าเริ่มต้น ทุก 5 นาที)
	newQueueMinutes := 5
	if val := os.Getenv("AUTO_SIM_QUEUE_MIN"); val != "" {
		if v, err := strconv.Atoi(val); err == nil && v > 0 {
			newQueueMinutes = v
		}
	} else if val := os.Getenv("AUTO_SIM_QUEUE_SEC"); val != "" {
		if v, err := strconv.Atoi(val); err == nil && v > 0 {
			newQueueMinutes = v / 60
			if newQueueMinutes < 1 {
				newQueueMinutes = 1
			}
		}
	}

	log.Printf("[AutoSimulator] เริ่มต้นระบบจำลองสถานะคิวเสมือนจริง (Clinical State Machine):")
	log.Printf("   1. การเลื่อนสถานะคิวตามลำดับจริง: ทุกๆ %d นาที", progressMinutes)
	log.Printf("      [รอคัดกรอง] -> [รอพบแพทย์] -> [กำลังตรวจ] -> [รอทำหัตถการ (ถ้ามี)] -> [รอชำระเงิน] -> [รอรับยา] -> [เสร็จสิ้น]")
	log.Printf("   2. การรับผู้ป่วยใหม่เข้าคิว (/queue): ทุกๆ %d นาที (ชื่อใหม่ไม่ซ้ำเดิม)", newQueueMinutes)
	log.Printf("   3. การลงทะเบียนคนไข้ใหม่ (/registration): ทุกๆ %d-%d นาที (ชื่อใหม่ไม่ซ้ำเดิม)", regMinMinutes, regMaxMinutes)

	rng := rand.New(rand.NewSource(time.Now().UnixNano()))

	// -----------------------------------------------------------------------
	// Goroutine 1: เลื่อนขั้นสถานะของคิวที่มีอยู่จริงตามลำดับสถานะคลินิก (ทุก 4 นาที)
	// -----------------------------------------------------------------------
	go func() {
		time.Sleep(15 * time.Second) // รอเริ่มหลังเซิร์ฟเวอร์เปิด 15 วินาที
		for {
			advanceActiveQueues(rng)
			time.Sleep(time.Duration(progressMinutes) * time.Minute)
		}
	}()

	// -----------------------------------------------------------------------
	// Goroutine 2: ยิงคิวผู้ป่วยใหม่เข้าจุดคัดกรอง (ชื่อใหม่ไม่ซ้ำ ทุก 5 นาที)
	// -----------------------------------------------------------------------
	go func() {
		time.Sleep(10 * time.Second) // ยิงคิวแรกหลังเปิดเซิร์ฟเวอร์ 10 วินาที
		for {
			emitNewQueue(rng)
			time.Sleep(time.Duration(newQueueMinutes) * time.Minute)
		}
	}()

	// -----------------------------------------------------------------------
	// Goroutine 3: สุ่มสร้างผู้ป่วยใหม่เข้าหน้าลงทะเบียน (/registration) ทุก 5-10 นาที
	// -----------------------------------------------------------------------
	go func() {
		for {
			waitMinutes := regMinMinutes + rng.Intn(regMaxMinutes-regMinMinutes+1)
			time.Sleep(time.Duration(waitMinutes) * time.Minute)

			emitNewPatientToRegistration(rng)
		}
	}()
}

// advanceActiveQueues ทำหน้าที่เลื่อนขั้นสถานะของคิวที่กำลังรอรับบริการอยู่ตามลำดับจริง
func advanceActiveQueues(rng *rand.Rand) {
	if config.DB == nil {
		return
	}

	// หาคิวที่ยังไม่เสร็จสิ้นและยังไม่ถูกยกเลิก เรียงตาม created_at asc
	var activeQueues []models.Queue
	err := config.DB.Preload("Patient").
		Where("status NOT IN ('เสร็จสิ้น', 'ยกเลิกคิว')").
		Order("created_at asc").
		Find(&activeQueues).Error

	if err != nil || len(activeQueues) == 0 {
		return
	}

	// เลือกคิวที่จะเลื่อนสถานะในรอบนี้ 1 ถึง 2 คิว
	countToAdvance := 1
	if len(activeQueues) > 3 {
		countToAdvance = 2
	}

	for i := 0; i < countToAdvance && i < len(activeQueues); i++ {
		q := activeQueues[i]
		oldStatus := q.Status
		var nextStatus, nextDept, nextNote string

		switch q.Status {
		case "รอคัดกรอง":
			// ขั้นที่ 1: ซักประวัติและวัด Vitals เสร็จแล้ว -> ส่งต่อห้องตรวจแพทย์
			nextStatus = "รอพบแพทย์"
			docNum := 1 + rng.Intn(3)
			docName := "พญ.สุดา"
			if docNum == 2 {
				docName = "นพ.วิชัย"
			} else if docNum == 3 {
				docName = "พญ.เกศรา"
			}
			nextDept = fmt.Sprintf("ห้องตรวจ %d (%s)", docNum, docName)
			nextNote = "คัดกรองแล้ว: สัญญาณชีพปกติ รอเรียกเข้าห้องตรวจ"

			// บันทึก Visit และ Screening ให้พร้อม
			createScreeningForQueue(&q, docNum, rng)

		case "รอพบแพทย์":
			// ขั้นที่ 2: แพทย์เรียกเข้าห้องตรวจ -> กำลังตรวจ
			nextStatus = "กำลังตรวจ"
			nextDept = q.Department
			nextNote = "แพทย์กำลังซักประวัติและตรวจรักษา"

		case "กำลังตรวจ":
			// ขั้นที่ 3: ตรวจเสร็จ -> สุ่ม ~30% ไปห้องหัตถการ หรือ 70% ไปห้องจ่ายยา
			if rng.Intn(10) < 3 {
				nextStatus = "รอทำหัตถการ"
				nextDept = "ห้องหัตถการ (ทำแผล/ฉีดยา)"
				nextNote = "ส่งทำแผล ล้างแผล หรือฉีดยาตามคำสั่งแพทย์"
			} else {
				nextStatus = "รอรับยา"
				nextDept = "ห้องจ่ายยาและเภสัชกรรม"
				nextNote = "ตรวจเสร็จสิ้น รอจัดยาและรับคำแนะนำการใช้ยา"
			}

		case "รอทำหัตถการ":
			// ขั้นที่ 4: ทำหัตถการเสร็จ -> ส่งห้องจ่ายยา
			nextStatus = "รอรับยา"
			nextDept = "ห้องจ่ายยาและเภสัชกรรม"
			nextNote = "ทำหัตถการเรียบร้อย รอจัดยาและรับคำแนะนำการใช้ยา"

		case "รอรับยา":
			// ขั้นที่ 5: จ่ายยาเสร็จ -> ส่งไปห้องการเงิน
			nextStatus = "รอชำระเงิน"
			nextDept = "ห้องการเงิน (แคชเชียร์)"
			nextNote = "จัดยาเรียบร้อย รอชำระค่ารักษาพยาบาล"

		case "รอชำระเงิน":
			// ขั้นที่ 6: ชำระเงินเสร็จสิ้น -> ปิดคิว
			nextStatus = "เสร็จสิ้น"
			nextDept = "ห้องการเงิน (แคชเชียร์)"
			nextNote = "ชำระเงินเรียบร้อย เสร็จสิ้นขั้นตอนการรักษา"

		default:
			continue
		}

		q.Status = nextStatus
		q.Department = nextDept
		q.Note = nextNote
		config.DB.Save(&q)

		config.DB.Preload("Patient").First(&q, q.ID)

		// Broadcast Real-time Event
		ws.BroadcastEvent("QUEUE_UPDATED", q)

		patientName := "ผู้ป่วย"
		if q.Patient.FullName != "" {
			patientName = q.Patient.FullName
		}
		log.Printf("[AutoSimulator] 🔄 คิว %s (%s) เลื่อนสถานะ: '%s' -> '%s' [%s]",
			q.QueueNumber, patientName, oldStatus, nextStatus, nextDept)
	}
}

// emitNewQueue สร้างคิวผู้ป่วยใหม่ที่เริ่มต้นจาก "รอคัดกรอง" ที่ "จุดคัดกรอง"
func emitNewQueue(rng *rand.Rand) {
	if config.DB == nil {
		return
	}

	// ตรวจสอบว่ามีผู้ป่วยในระบบที่ยังไม่ได้เข้าคิวหรือไม่
	var activeQueuedPatientIDs []uint
	config.DB.Model(&models.Queue{}).
		Where("status NOT IN ('เสร็จสิ้น', 'ยกเลิกคิว')").
		Pluck("patient_id", &activeQueuedPatientIDs)

	var patient models.Patient
	query := config.DB
	if len(activeQueuedPatientIDs) > 0 {
		query = query.Where("id NOT IN (?)", activeQueuedPatientIDs)
	}

	// ถ้ามีคนไข้ที่รออยู่ในระบบลงทะเบียน ให้ดึงคนไข้นั้นมาออกคิว
	if err := query.Order("created_at asc").First(&patient).Error; err != nil {
		// ถ้าไม่มี ให้สร้างผู้ป่วยใหม่ชื่อไม่ซ้ำขึ้นมา
		newP, elig, _, _, _ := generateUniquePatientData(rng)
		if err := config.DB.Create(&newP).Error; err != nil {
			return
		}
		elig.PatientID = &newP.ID
		config.DB.Create(&elig)
		patient = newP
	}

	// คำนวณเลขคิวฐาน 16 (Q0001 - QFFFF)
	var lastQueue models.Queue
	var queueNo string
	if err := config.DB.Order("id desc").First(&lastQueue).Error; err == nil {
		var lastNum int
		cleanHex := strings.TrimPrefix(strings.ToUpper(lastQueue.QueueNumber), "Q")
		fmt.Sscanf(cleanHex, "%X", &lastNum)
		if lastNum > 0 {
			queueNo = fmt.Sprintf("Q%04X", lastNum+1)
		} else {
			queueNo = fmt.Sprintf("Q%04X", lastQueue.ID+1)
		}
	} else {
		queueNo = "Q0001"
	}

	var regUser models.User
	config.DB.Where("role = ?", "registrar").First(&regUser)
	regUserID := regUser.ID
	if regUserID == 0 {
		regUserID = 1
	}

	queue := models.Queue{
		PatientID:       patient.ID,
		CreatedByUserID: regUserID,
		QueueNumber:     queueNo,
		Status:          "รอคัดกรอง",
		Department:      "จุดคัดกรอง",
		Note:            "รอซักประวัติและวัดสัญญาณชีพ",
	}

	if err := config.DB.Create(&queue).Error; err != nil {
		return
	}

	config.DB.Preload("Patient").First(&queue, queue.ID)

	ws.BroadcastEvent("QUEUE_CREATED", queue)
	log.Printf("[AutoSimulator] 🏥 ผู้ป่วยเข้าคิวใหม่: %s (%s, HN: %s) -> แผนก: จุดคัดกรอง (สถานะ: รอคัดกรอง)",
		queue.QueueNumber, patient.FullName, patient.HN)
}

// emitNewPatientToRegistration สร้างคนไข้ใหม่เข้าหน้าระบบลงทะเบียน (/registration)
func emitNewPatientToRegistration(rng *rand.Rand) {
	if config.DB == nil {
		return
	}

	newP, elig, _, _, _ := generateUniquePatientData(rng)
	if err := config.DB.Create(&newP).Error; err != nil {
		return
	}

	elig.PatientID = &newP.ID
	config.DB.Create(&elig)

	ws.BroadcastEvent("PATIENT_REGISTERED", newP)
	log.Printf("[AutoSimulator] 📋 ผู้ป่วยใหม่ลงทะเบียน: %s (HN: %s, สิทธิ์: %s) -> แสดงในหน้า /registration (รอบถัดไปในอีก 5-10 นาที)",
		newP.FullName, newP.HN, newP.SchemeType)
}

// createScreeningForQueue ช่วยสร้าง Visit และ Screening เมื่อคิวเลื่อนไปรอพบแพทย์
func createScreeningForQueue(q *models.Queue, docNum int, rng *rand.Rand) {
	var doc models.User
	username := fmt.Sprintf("doctor%d", docNum)
	config.DB.Where("username = ? OR role = ?", username, "doctor").First(&doc)
	if doc.ID == 0 {
		config.DB.Where("role = ?", "doctor").First(&doc)
	}

	var nurse models.User
	config.DB.Where("role = ?", "nurse").First(&nurse)
	nurseID := nurse.ID
	if nurseID == 0 {
		nurseID = 2
	}

	visit := models.VisitRecord{
		PatientID:  q.PatientID,
		DoctorID:   doc.ID,
		VisitDate:  time.Now(),
		Department: q.Department,
		Status:     "Waiting",
	}
	config.DB.Create(&visit)

	complaint := complaints[rng.Intn(len(complaints))]
	weight := 50.0 + rng.Float64()*35.0
	height := 155.0 + rng.Float64()*25.0
	heightM := height / 100.0
	bmi := weight / (heightM * heightM)

	screening := models.Screening{
		VisitID:            visit.ID,
		ScreenedByUserID:   nurseID,
		AssignedDoctorID:   doc.ID,
		TriageLevel:        complaint.Triage,
		ChiefComplaint:     complaint.Complaint,
		MedicalHistory:     complaint.History,
		NurseNotes:         complaint.NurseNote,
		PainScore:          complaint.PainScore,
		BloodSugar:         90 + rng.Intn(45),
		FoodAllergies:      "ปฏิเสธการแพ้อาหาร",
		CurrentMedications: "ไม่มี",
		SmokingHistory:     "ไม่สูบ",
		AlcoholHistory:     "ไม่ดื่ม",
		Weight:             weight,
		Height:             height,
		BMI:                bmi,
		Temperature:        36.5 + rng.Float64()*1.2,
		SystolicBP:         110 + rng.Intn(35),
		DiastolicBP:        70 + rng.Intn(20),
		HeartRate:          68 + rng.Intn(30),
		RespiratoryRate:    16 + rng.Intn(6),
		SpO2:               96 + rng.Intn(4),
		Allergies:          q.Patient.Allergies,
	}
	config.DB.Create(&screening)
}

