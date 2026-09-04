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

	// ส่งมาด้วยได้ ถ้าแพทย์แก้ประวัติติดตัวผู้ป่วยในหน้าเดียวกัน
	PatientHistory  *PatientHistoryDTO    `json:"patientHistory"`
	Prescriptions   []PrescriptionItemDTO `json:"prescriptions"`
	Allergies       string                `json:"allergies"`
	ChronicDiseases string                `json:"chronicDiseases"`
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
