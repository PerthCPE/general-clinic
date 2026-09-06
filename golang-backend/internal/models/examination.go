package models

import (
	"time"

	"gorm.io/gorm"
)

// สถานะของบันทึกการตรวจ
//
// Draft  = แพทย์กำลังบันทึกอยู่ ยังแก้ไขได้
// Signed = แพทย์เซ็นปิดการตรวจแล้ว ห้ามแก้ไขย้อนหลัง
const (
	ExaminationStatusDraft  = "Draft"
	ExaminationStatusSigned = "Signed"
)

// Examination - บันทึกการตรวจของแพทย์ 1 แถวต่อการมาตรวจ 1 ครั้ง
//
// ทุกฟิลด์เป็นความสัมพันธ์แบบ 1:1 กับการตรวจครั้งนั้น จึงเก็บรวมในแถวเดียว
// ส่วนข้อมูลที่มีได้หลายรายการ (การวินิจฉัย, ใบสั่งยา) แยกไปตารางของตัวเอง
//
// ใช้ soft delete เพราะเป็นข้อมูลเวชระเบียน ไม่ควรลบออกจากฐานข้อมูลจริง
type Examination struct {
	ID       uint `gorm:"primaryKey" json:"id"`
	VisitID  uint `gorm:"uniqueIndex;not null" json:"visit_id"` // 1 visit มีบันทึกการตรวจได้ใบเดียว
	DoctorID uint `gorm:"index" json:"doctor_id"`

	// --- การซักประวัติ ---
	PresentIllness    string `json:"present_illness"`    // ประวัติการเจ็บป่วยปัจจุบัน
	ComplaintDuration string `json:"complaint_duration"` // เป็นมานานเท่าไร

	// --- ตรวจร่างกาย 8 ระบบ (ตรงกับ physicalExam ใน types.ts) ---
	PEGeneral         string `json:"pe_general"`
	PEHeent           string `json:"pe_heent"`
	PECardiovascular  string `json:"pe_cardiovascular"`
	PERespiratory     string `json:"pe_respiratory"`
	PEAbdomen         string `json:"pe_abdomen"`
	PEMusculoskeletal string `json:"pe_musculoskeletal"`
	PENeurological    string `json:"pe_neurological"`
	PESkin            string `json:"pe_skin"`

	// --- การประเมินและแผนการรักษา ---
	AssessmentNotes     string `json:"assessment_notes"`
	ClinicalNotes       string `json:"clinical_notes"`
	TreatmentPlan       string `json:"treatment_plan"`
	ProceduresPerformed string `json:"procedures_performed"`

	// --- คำแนะนำ 5 ด้าน (ตรงกับ counseling ใน types.ts) ---
	AdviceMedication string `json:"advice_medication"`
	AdviceDiet       string `json:"advice_diet"`
	AdviceExercise   string `json:"advice_exercise"`
	AdviceLifestyle  string `json:"advice_lifestyle"`
	AdviceDiseaseEdu string `json:"advice_disease_edu"`

	// --- รายละเอียดใบสั่งยาฉบับของแพทย์ (เก็บเป็น JSON ข้อความเดียว) ---
	//
	// ทำไมต้องมีช่องนี้:
	// ตาราง dispensings เป็นของห้องยา มีแค่ 3 ช่องคือ quantity, dosage, instructions
	// แต่ฟอร์มสั่งยาของแพทย์กรอกได้ 7 อย่าง คือ
	//   ขนาดการใช้ยา / ความถี่ / ระยะเวลา / จำนวน / ทางให้ยา / เวลารับประทาน / คำแนะนำพิเศษ
	// ของเดิมเลยยัด ทางให้ยา+เวลา+คำแนะนำ รวมเป็นข้อความเดียวใส่ instructions
	// ส่วน "ความถี่" กับ "ระยะเวลา" หายไปเลย ไม่มีที่เก็บ อ่านกลับมาไม่ได้
	// พอเปิดประวัติย้อนหลังจึงไม่รู้ว่าครั้งก่อนสั่งกินวันละกี่ครั้ง กี่วัน
	//
	// แก้โดยเก็บใบสั่งยาฉบับเต็มของแพทย์ไว้ที่นี่ (แถวเดียวกับบันทึกการตรวจ)
	// ไม่ไปแตะตาราง dispensings ของห้องยา ห้องยายังเห็นข้อมูลเหมือนเดิมทุกอย่าง
	//
	// รูปแบบ: JSON array ของ dto.PrescriptionItemDTO
	// ค่าว่าง "" หมายถึงเป็นเวชระเบียนเก่าที่บันทึกไว้ก่อนมีช่องนี้
	// เวลาอ่านต้อง fallback ไปอ่านจาก dispensings แทน
	PrescriptionDetail string `gorm:"type:text" json:"prescription_detail"`

	// --- นัดติดตามอาการ ---
	FollowUpDate         *time.Time `json:"follow_up_date"`
	FollowUpReason       string     `json:"follow_up_reason"`
	FollowUpInstructions string     `json:"follow_up_instructions"`

	Status   string     `gorm:"index;default:'Draft'" json:"status"`
	SignedAt *time.Time `json:"signed_at"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	VisitRecord VisitRecord `gorm:"foreignKey:VisitID" json:"-"`
	Doctor      User        `gorm:"foreignKey:DoctorID" json:"-"`
}
