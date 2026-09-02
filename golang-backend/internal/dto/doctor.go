package dto

import "time"

// ==============================================================================
// DTO สำหรับ Role แพทย์
// ==============================================================================
// แยก DTO ออกจาก model เพราะหน้าจอแพทย์ต้องการข้อมูลจากหลายตารางรวมกัน
// (คิว + การมาตรวจ + ผู้ป่วย + ผลคัดกรอง) ถ้าส่ง model ดิบไปจะได้ข้อมูล
// ซ้อนกันหลายชั้นและมีฟิลด์ที่หน้าจอไม่ได้ใช้ติดไปด้วย
//
// json tag ใช้ snake_case ให้เหมือน endpoint เดิมของโปรเจกต์
// ยกเว้นฟิลด์ที่ frontend อ่านตรงๆ (id, status, bp, triage) ซึ่งจัดรูปแบบ
// ให้ตรงกับ types.ts ของหน้าจอแพทย์ เพื่อไม่ต้องแปลงซ้ำที่ฝั่ง React

// PatientBrief - ข้อมูลผู้ป่วยเท่าที่หน้าคิวแพทย์ต้องใช้
type PatientBrief struct {
	ID              uint      `json:"id"`
	HN              string    `json:"hn"`
	NationalID      string    `json:"national_id"`
	FullName        string    `json:"fullname"`
	Gender          string    `json:"gender"`
	BirthDate       time.Time `json:"birthdate"`
	Age             int       `json:"age"`
	PhoneNumber     string    `json:"phone_number"`
	SchemeType      string    `json:"scheme_type"`
	Allergies       string    `json:"allergies"`
	ChronicDiseases string    `json:"chronic_diseases"`
}

// ScreeningBrief - ผลคัดกรองจากพยาบาลที่แพทย์ต้องเห็นก่อนตรวจ
type ScreeningBrief struct {
	ID             uint   `json:"id"`
	ChiefComplaint string `json:"chief_complaint"`
	Allergies      string `json:"allergies"`
	MedicalHistory string `json:"medical_history"`
	NurseNotes     string `json:"nurse_notes"`

	// ระดับความเร่งด่วน ส่งไปสามรูปแบบ
	// triage_level = ข้อความไทยที่พยาบาลบันทึกไว้ (แสดงผลตรงๆ ได้)
	// triage_code  = รูปแบบที่ ExaminationView ใช้ เช่น "Level 2: Emergency"
	// triage_priority = High / Medium / Low ตรงกับ triage.priority ใน types.ts
	TriageLevel    string `json:"triage_level"`
	TriageCode     string `json:"triage_code"`
	TriagePriority string `json:"triage_priority"`

	// bp เป็นสตริงสำเร็จรูป "120/80" เพราะหน้าจออ่าน vitals.bp เป็นค่าเดียว
	// ส่วน systolic_bp / diastolic_bp ยังส่งไปด้วยเผื่อใช้คำนวณหรือทำกราฟ
	BP              string  `json:"bp"`
	SystolicBP      int     `json:"systolic_bp"`
	DiastolicBP     int     `json:"diastolic_bp"`
	Weight          float64 `json:"weight"`
	Height          float64 `json:"height"`
	BMI             float64 `json:"bmi"`
	Temperature     float64 `json:"temperature"`
	HeartRate       int     `json:"heart_rate"`
	RespiratoryRate int     `json:"respiratory_rate"`
	SpO2            int     `json:"spo2"`

	ScreenedByName string    `json:"screened_by_name"`
	ScreenedAt     time.Time `json:"screened_at"`
}

// DoctorQueueItem - หนึ่งแถวในหน้าคิวของแพทย์
type DoctorQueueItem struct {
	// id เป็นสตริงเพราะ Patient.id ใน types.ts เป็น string และถูกใช้เป็น key
	// ของ React รวมถึงใช้จับคู่ตอน handleUpdateStatus
	ID string `json:"id"`

	// status ใช้ชุดค่าเดียวกับ QueueStatus ใน types.ts:
	// Waiting | Screened | Examining | Pending Pharmacy | Completed | Cancelled
	Status string `json:"status"`

	QueueID     uint      `json:"queue_id"`
	QueueNumber string    `json:"queue_number"`
	QueueStatus string    `json:"queue_status"` // สถานะภาษาไทยชุดเดิมของระบบคิว (ไว้อ้างอิง)
	Department  string    `json:"department"`
	Note        string    `json:"note"`
	QueuedAt    time.Time `json:"queued_at"`

	// แยกวันกับเวลาให้พร้อมใช้ ตรงกับ visitDate / visitTime ใน types.ts
	VisitDate string `json:"visit_date"` // 2026-08-28
	VisitTime string `json:"visit_time"` // 08:45 AM

	// เวลารอ นับจากเวลาที่ออกคิว ถึงเวลาที่แพทย์เรียกเข้าตรวจ
	// (ถ้ายังไม่ถูกเรียก จะนับถึงเวลาปัจจุบัน)
	WaitingMinutes int `json:"waiting_minutes"`

	VisitID uint   `json:"visit_id"`
	VN      string `json:"vn"`

	AssignedDoctorID   uint   `json:"assigned_doctor_id"`
	AssignedDoctorName string `json:"assigned_doctor_name"`

	Patient   PatientBrief    `json:"patient"`
	Screening *ScreeningBrief `json:"screening"` // null ได้ ถ้าคิวนั้นยังไม่ผ่านการคัดกรอง

	// การวินิจฉัยหลักของการมาตรวจครั้งนั้น (ถ้าแพทย์บันทึกไว้แล้ว)
	// ใช้กับหน้าประวัติเวชระเบียน จึงเว้นว่างได้ในคิวที่ยังไม่ได้ตรวจ
	Diagnosis string `json:"diagnosis,omitempty"`
	ICDCode   string `json:"icd_code,omitempty"`

	// จำนวนครั้งที่ผู้ป่วยรายนี้เคยมาตรวจ
	// 0 = เพิ่งลงทะเบียน ยังไม่เคยเข้าตรวจเลย (หน้าประวัติใช้แยกป้ายสถานะ)
	VisitCount int `json:"visit_count"`
}

// DoctorPatientRecordsResponse - ผลลัพธ์ของ GET /api/doctor/patients/records
//
// ต่างจาก /queue ตรงที่ไม่จำกัดว่าต้องเป็นคิวที่ยังเดินอยู่หรือของวันนี้
// จึงค้นเจอผู้ป่วยที่ตรวจเสร็จไปแล้วเมื่อไรก็ได้
type DoctorPatientRecordsResponse struct {
	Query string            `json:"query"`
	Total int               `json:"total"`
	Items []DoctorQueueItem `json:"items"`
}

// DoctorQueueResponse - ผลลัพธ์ของ GET /api/doctor/queue
type DoctorQueueResponse struct {
	DoctorID   uint              `json:"doctor_id"`
	DoctorName string            `json:"doctor_name"`
	Summary    DoctorQueueStats  `json:"summary"`
	Items      []DoctorQueueItem `json:"items"`
}

// DoctorQueueStats - ตัวเลขสำหรับการ์ดสถิติบนแดชบอร์ดแพทย์
type DoctorQueueStats struct {
	TotalToday     int `json:"total_today"`      // ผู้ป่วยทั้งหมดวันนี้ (การ์ดใบแรก)
	Waiting        int `json:"waiting"`          // รอพบแพทย์
	Examining      int `json:"examining"`        // กำลังตรวจ
	CompletedToday int `json:"completed_today"`  // ตรวจเสร็จแล้ววันนี้
	AvgWaitMinutes int `json:"avg_wait_minutes"` // เวลารอเฉลี่ยของคิวที่ยังรออยู่
}

// EligibilityBrief - สิทธิ์การรักษาที่ใช้อยู่ของผู้ป่วย
type EligibilityBrief struct {
	SchemeType      string `json:"scheme_type"`
	CoverageDetails string `json:"coverage_details"`
	HospitalName    string `json:"hospital_name"`
	Status          string `json:"status"`
	ExpireDate      string `json:"expire_date"`
}

// DoctorVisitDetail - ข้อมูลทั้งหมดที่หน้าตรวจของแพทย์ต้องใช้ในการเปิดเคสหนึ่งครั้ง
type DoctorVisitDetail struct {
	ID      string `json:"id"`     // รูปแบบเดียวกับ DoctorQueueItem.ID
	Status  string `json:"status"` // ชุดค่าเดียวกับ QueueStatus ใน types.ts
	VisitID uint   `json:"visit_id"`
	VN      string `json:"vn"`

	VisitDate  string     `json:"visit_date"`
	VisitTime  string     `json:"visit_time"`
	VisitAt    time.Time  `json:"visit_at"` // ค่าเต็มเผื่อ frontend ต้องจัดรูปแบบเอง
	VisitType  string     `json:"visit_type"`
	Department string     `json:"department"`
	StartedAt  *time.Time `json:"started_at"`
	EndedAt    *time.Time `json:"ended_at"`

	DoctorID   uint   `json:"doctor_id"`
	DoctorName string `json:"doctor_name"`

	QueueID     uint   `json:"queue_id"`
	QueueNumber string `json:"queue_number"`
	QueueStatus string `json:"queue_status"`

	Patient     PatientBrief      `json:"patient"`
	Eligibility *EligibilityBrief `json:"eligibility"`
	Screening   *ScreeningBrief   `json:"screening"`
}

// UpdateVisitStatusRequest - body ของ PUT /api/doctor/visits/:id/status
//
// รับได้ทั้งชุดค่าของ frontend (Waiting, Examining, Pending Pharmacy, Completed,
// Cancelled) และตัวพิมพ์เล็กแบบเดิม เพื่อไม่ให้ของที่เรียกอยู่แล้วพัง
type UpdateVisitStatusRequest struct {
	Status string `json:"status" binding:"required"`
	Note   string `json:"note"`
}
