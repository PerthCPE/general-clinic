package dto

// ==============================================================================
// DTO ของระบบจัดการข้อมูลการรักษา (บันทึกผลการตรวจและวินิจฉัยโรค)
// ==============================================================================
// object ย่อย (physicalExam, counseling, followUp, diagnosis) ใช้ชื่อฟิลด์
// ตรงกับ types.ts ของหน้าจอแพทย์ เพื่อให้ ExaminationView เอาไปใช้ได้เลย
// ส่วนฟิลด์ระดับบนสุดใช้ snake_case ให้เหมือน endpoint อื่นของโปรเจกต์

// PhysicalExamDTO - ผลตรวจร่างกาย 8 ระบบ
type PhysicalExamDTO struct {
	GeneralAppearance string `json:"generalAppearance"`
	Heent             string `json:"heent"`
	Cardiovascular    string `json:"cardiovascular"`
	Respiratory       string `json:"respiratory"`
	Abdomen           string `json:"abdomen"`
	Musculoskeletal   string `json:"musculoskeletal"`
	Neurological      string `json:"neurological"`
	Skin              string `json:"skin"`
}

// CounselingDTO - คำแนะนำที่แพทย์ให้ผู้ป่วย
type CounselingDTO struct {
	MedicationAdvice string `json:"medicationAdvice"`
	DietAdvice       string `json:"dietAdvice"`
	ExerciseAdvice   string `json:"exerciseAdvice"`
	LifestyleAdvice  string `json:"lifestyleAdvice"`
	DiseaseEducation string `json:"diseaseEducation"`
}

// FollowUpDTO - การนัดติดตามอาการ (วันที่เป็น YYYY-MM-DD)
type FollowUpDTO struct {
	FollowUpDate string `json:"followUpDate"`
	Reason       string `json:"reason"`
	Instructions string `json:"instructions"`
}

// DiagnosisItemDTO - หนึ่งรายการวินิจฉัย ตรงกับ DiagnosisItem ใน types.ts
type DiagnosisItemDTO struct {
	Code      string `json:"code"`
	Name      string `json:"name"`
	LocalName string `json:"localName"`
}

// SmokingHistoryDTO / AlcoholHistoryDTO - ตรงกับ object ใน types.ts
type SmokingHistoryDTO struct {
	IsUser    bool   `json:"isUser"`
	Status    string `json:"status"`
	Frequency string `json:"frequency"`
	Duration  string `json:"duration"`
}

type AlcoholHistoryDTO struct {
	IsUser    bool   `json:"isUser"`
	Status    string `json:"status"`
	Frequency string `json:"frequency"`
	Duration  string `json:"duration"`
}

// PatientHistoryDTO - ประวัติติดตัวผู้ป่วย
type PatientHistoryDTO struct {
	PastMedicalHistory string             `json:"pastMedicalHistory"`
	PastSurgery        string             `json:"pastSurgery"`
	AdmissionHistory   string             `json:"hospitalAdmissionHistory"`
	FamilyHistory      string             `json:"familyHistory"`
	SocialHistory      string             `json:"socialHistory"`
	SmokingHistory     *SmokingHistoryDTO `json:"smokingHistory"`
	AlcoholHistory     *AlcoholHistoryDTO `json:"alcoholHistory"`
	CurrentMedications []string           `json:"currentMedications"`
}

// ExaminationDetail - ผลลัพธ์ของ GET /api/doctor/visits/:id/examination
type ExaminationDetail struct {
	VisitID uint   `json:"visit_id"`
	VN      string `json:"vn"`

	// Draft = ยังแก้ไขได้, Signed = เซ็นปิดการตรวจแล้ว, "" = ยังไม่เคยบันทึก
	Status   string `json:"status"`
	SignedAt string `json:"signed_at"`
	Editable bool   `json:"editable"`

	DoctorID   uint   `json:"doctor_id"`
	DoctorName string `json:"doctor_name"`

	// ข้อมูลของการตรวจครั้งนี้
	PresentIllness         string          `json:"presentIllness"`
	ChiefComplaintDuration string          `json:"chiefComplaintDuration"`
	PhysicalExam           PhysicalExamDTO `json:"physicalExam"`
	AssessmentNotes        string          `json:"assessmentNotes"`
	ClinicalNotes          string          `json:"clinicalNotes"`
	TreatmentPlan          string          `json:"treatmentPlan"`
	ProceduresPerformed    string          `json:"proceduresPerformed"`
	Counseling             CounselingDTO   `json:"counseling"`
	FollowUp               FollowUpDTO     `json:"followUp"`

	PrimaryDiagnosis   *DiagnosisItemDTO  `json:"primaryDiagnosis"`
	SecondaryDiagnoses []DiagnosisItemDTO `json:"secondaryDiagnoses"`

	// ใบสั่งยาที่บันทึกไว้ อ่านกลับจากตาราง dispensings
	Prescriptions []PrescriptionItemDTO `json:"prescriptions"`

	// เอกสารที่ออกให้ผู้ป่วยในการตรวจครั้งนี้ (อ่านจาก examinations.issued_documents)
	IssuedDocuments []IssuedDocumentDTO `json:"issuedDocuments"`

	// สถานะผู้ป่วยหลังตรวจเสร็จ: "" | "home" | "refer"
	Disposition string `json:"disposition"`

	// ข้อมูลประกอบที่ดึงมาแสดงคู่กัน
	Patient        PatientBrief       `json:"patient"`
	Screening      *ScreeningBrief    `json:"screening"`
	PatientHistory *PatientHistoryDTO `json:"patientHistory"`
}

// PrescriptionItemDTO - รายการสั่งยาที่แพทย์สั่ง
type PrescriptionItemDTO struct {
	ID           string  `json:"id"`
	MedicineID   uint    `json:"medicineId"`
	MedicineCode string  `json:"medicineCode"`
	MedicineName string  `json:"medicineName"`
	GenericName  string  `json:"genericName"`
	Category     string  `json:"category"`
	Dosage       string  `json:"dosage"`
	Frequency    string  `json:"frequency"`
	Duration     string  `json:"duration"`
	Quantity     int     `json:"quantity"`
	UnitPrice    float64 `json:"unitPrice"`
	TotalPrice   float64 `json:"totalPrice"`
	Instructions string  `json:"instructions"`
	Notes        string  `json:"notes"`
	Status       string  `json:"status"`

	// 3 ช่องล่างนี้เป็นช่องที่แพทย์กรอกแยกกันบนหน้าจอ
	//   ทางให้ยา (route) / เวลารับประทาน (timing) / คำแนะนำพิเศษ-ฉลากยา (specialInstructions)
	//
	// ตอนส่งให้ห้องยา สามช่องนี้ถูกรวมเป็นข้อความเดียวใส่ Instructions ด้านบน
	// เพราะตาราง dispensings มีช่องเดียว (ยังทำเหมือนเดิม ห้องยาไม่กระทบ)
	// แต่ต้องรับค่าแยกมาด้วย เพื่อเก็บใบสั่งยาฉบับเต็มลง examinations.prescription_detail
	// ไม่งั้นเปิดประวัติย้อนหลังแล้วแยกไม่ออกว่าอันไหนคือทางให้ยา อันไหนคือคำแนะนำ
	Route               string `json:"route"`
	Timing              string `json:"timing"`
	SpecialInstructions string `json:"specialInstructions"`
}

// IssuedDocumentDTO - เอกสารหนึ่งชนิดที่แพทย์ออกให้ผู้ป่วยในการตรวจครั้งนี้
//
// type ใช้ค่าคงที่ตรงกับฝั่งหน้าจอ (DocumentRequestCard ใน ExaminationView.tsx)
//
//	"medical-certificate" = ใบรับรองแพทย์ (มีจำนวน + พิมพ์ได้)
//	"non-formulary"       = ใบรับรองยานอกบัญชียาหลักแห่งชาติ (มีจำนวน + พิมพ์ได้)
//	"insurance-claim"     = ใบเคลมประกัน (ติ๊กอย่างเดียว)
//	"referral-opinion"    = ใบรับรองความเห็นแพทย์เพื่อการส่งต่อ (ติ๊กอย่างเดียว)
//	"dental"              = ใบรักษาโรคฟันและโรคเหงือก (ติ๊กอย่างเดียว)
//	"other"               = เอกสารอื่นที่แพทย์ระบุชื่อเอง (ดูฟิลด์ name)
//
// printedAt เก็บเวลาที่กดพิมพ์ครั้งล่าสุด เว้นว่างได้ถ้าติ๊กไว้แต่ยังไม่ได้พิมพ์
// (แยกสองสถานะนี้สำคัญ เพราะ "สั่งออกเอกสาร" กับ "พิมพ์ออกมาแล้ว" ไม่เหมือนกัน
//
//	เคสที่ติ๊กแล้วเครื่องพิมพ์เสีย ต้องรู้ว่ายังไม่ได้ให้ผู้ป่วยไป)
type IssuedDocumentDTO struct {
	Type     string `json:"type"`
	Quantity int    `json:"quantity"`

	// ชื่อเอกสารที่แพทย์พิมพ์เอง ใช้เฉพาะ type = "other"
	// เอกสารชนิดอื่นเว้นว่าง เพราะชื่อคงที่อยู่แล้วในหน้าจอ
	Name string `json:"name"`

	PrintedAt string `json:"printedAt"`
}

// SaveExaminationRequest - body ของ PUT /api/doctor/visits/:id/examination
//
// action = "draft" บันทึกร่างไว้ก่อน (แก้ไขต่อได้)
// action = "sign"  เซ็นปิดการตรวจ (ต้องมีการวินิจฉัยหลัก และแก้ไขไม่ได้อีก)
type SaveExaminationRequest struct {
	Action string `json:"action"`

	PresentIllness         string          `json:"presentIllness"`
	ChiefComplaintDuration string          `json:"chiefComplaintDuration"`
	PhysicalExam           PhysicalExamDTO `json:"physicalExam"`
	AssessmentNotes        string          `json:"assessmentNotes"`
	ClinicalNotes          string          `json:"clinicalNotes"`
	TreatmentPlan          string          `json:"treatmentPlan"`
	ProceduresPerformed    string          `json:"proceduresPerformed"`
	Counseling             CounselingDTO   `json:"counseling"`
	FollowUp               FollowUpDTO     `json:"followUp"`

	PrimaryDiagnosis   *DiagnosisItemDTO  `json:"primaryDiagnosis"`
	SecondaryDiagnoses []DiagnosisItemDTO `json:"secondaryDiagnoses"`

	// สถานะผู้ป่วยหลังตรวจเสร็จ: "" | "home" | "refer"
	Disposition string `json:"disposition"`

	// ส่งมาด้วยได้ ถ้าแพทย์แก้ประวัติติดตัวผู้ป่วยในหน้าเดียวกัน
	PatientHistory  *PatientHistoryDTO    `json:"patientHistory"`
	Prescriptions   []PrescriptionItemDTO `json:"prescriptions"`
	Allergies       string                `json:"allergies"`
	ChronicDiseases string                `json:"chronicDiseases"`

	// เอกสารที่แพทย์ติ๊กว่าต้องการออกให้ผู้ป่วย ส่งมาทั้งชุดทุกครั้ง
	// ไม่ส่งมาเลย (nil) = หน้าจอเวอร์ชันเก่า ให้คงค่าเดิมในฐานข้อมูลไว้
	// ส่งมาเป็น array ว่าง = แพทย์เอาติ๊กออกหมดจริงๆ ให้ล้างค่า
	IssuedDocuments []IssuedDocumentDTO `json:"issuedDocuments"`
}

// SaveExaminationResponse - ผลลัพธ์หลังบันทึก
type SaveExaminationResponse struct {
	Message        string `json:"message"`
	ExaminationID  uint   `json:"examination_id"`
	Status         string `json:"status"`
	VisitStatus    string `json:"visit_status"`
	DiagnosisCount int    `json:"diagnosis_count"`

	// จำนวนยาที่ส่งต่อห้องยาได้จริง
	PrescriptionCount int `json:"prescription_count"`

	// ชื่อยาที่หาไม่เจอในตาราง medicines จึงส่งต่อห้องยาไม่ได้
	// หน้าจอต้องเตือนแพทย์ ไม่งั้นจะเข้าใจว่าสั่งยาสำเร็จทั้งที่ห้องยาไม่เห็น
	UnmatchedMedicines []string `json:"unmatched_medicines,omitempty"`
}
