package models

import "time"

type Screening struct {
	ID                 uint    `gorm:"primaryKey" json:"id"`
	VisitID            uint    `gorm:"not null" json:"visit_id"`
	ScreenedByUserID   uint    `json:"screened_by_user_id"` // พยาบาลผู้ทำการคัดกรอง
	AssignedDoctorID   uint    `json:"assigned_doctor_id"`  // แพทย์ประจำห้องตรวจที่ส่งต่อ
	TriageLevel        string  `json:"triage_level"`        // ปกติ (Normal), เร่งด่วน (Urgent), ฉุกเฉิน (Emergency), วิกฤต (Resuscitation)
	ChiefComplaint     string  `json:"chief_complaint"`
	Allergies          string  `json:"allergies"`
	MedicalHistory     string  `json:"medical_history"`
	NurseNotes         string  `json:"nurse_notes"`
	Weight             float64 `json:"weight"`
	Height             float64 `json:"height"`
	BMI                float64 `json:"bmi"`
	Temperature        float64 `json:"temperature"`
	SystolicBP         int     `json:"systolic_bp"`
	DiastolicBP        int     `json:"diastolic_bp"`
	HeartRate          int     `json:"heart_rate"`
	RespiratoryRate    int     `json:"respiratory_rate"`
	SpO2               int     `json:"spo2"`
	PainScore          int     `json:"pain_score"`
	BloodSugar         int     `json:"blood_sugar"`
	FoodAllergies      string  `json:"food_allergies"`
	CurrentMedications string  `json:"current_medications"`
	SmokingHistory     string  `json:"smoking_history"`
	AlcoholHistory     string  `json:"alcohol_history"`

	// คัดกรองอาการติดเชื้อทางเดินหายใจส่วนบน (URI = Upper Respiratory tract Infection)
	// จมูก ไซนัส คอหอย กล่องเสียง เช่น หวัด เจ็บคอ ไอ น้ำมูก ไข้ต่ำๆ
	//
	// ใช้ *bool เพราะต้องแยกให้ได้ 3 สถานะ ไม่ใช่ 2
	//   nil   = พยาบาลยังไม่ได้ประเมิน
	//   false = ประเมินแล้ว ไม่มีอาการ
	//   true  = ประเมินแล้ว มีอาการ
	// ถ้าใช้ bool ธรรมดา "ยังไม่ได้ประเมิน" กับ "ประเมินแล้วไม่มี" จะเป็น false เหมือนกัน
	// ซึ่งทำให้แพทย์เข้าใจผิดว่าคัดกรองแล้วปลอดภัย ทั้งที่ยังไม่มีใครถาม
	HasURI *bool `json:"has_uri"`

	// คัดกรองวัณโรค (TB = Tuberculosis)
	// ใช้ตัดสินว่าต้องแยกผู้ป่วยออกจากคิวรวมและให้ใส่หน้ากากหรือไม่
	// เป็นโรคติดต่อทางอากาศ ถ้าปล่อยรวมกับผู้ป่วยอื่นในห้องรอจะแพร่เชื้อได้
	// ใช้ *bool 3 สถานะเหมือน HasURI (nil = ยังไม่ได้ประเมิน)
	HasTB *bool `json:"has_tb"`

	// ผู้ป่วยใช้ยาละลายลิ่มเลือดอยู่หรือไม่ (anticoagulant / antiplatelet)
	// เช่น warfarin, aspirin, clopidogrel, NOAC
	// สำคัญมากก่อนทำหัตถการหรือสั่งยาบางกลุ่ม เพราะเสี่ยงเลือดออกไม่หยุด
	// และตีกับยาหลายตัว แพทย์ต้องรู้ก่อนสั่งยาเสมอ
	OnAnticoagulant *bool `json:"on_anticoagulant"`

	// ============================================================
	// คัดกรองเฉพาะผู้ป่วยหญิงวัยเจริญพันธุ์
	// ============================================================
	// ยาหลายกลุ่มห้ามใช้ในหญิงตั้งครรภ์เพราะทำให้ทารกพิการ
	// (เช่น warfarin, isotretinoin, ACE inhibitor, tetracycline)
	// และยาบางตัวผ่านน้ำนมไปถึงทารกได้ ซึ่งเป็นคนละชุดกัน
	// จึงต้องแยกเป็นสองคำถาม ไม่ใช่รวมเป็นข้อเดียว
	//
	// ใช้ *bool 3 สถานะเหมือน HasURI (nil = พยาบาลยังไม่ได้ถาม)
	// สำคัญมากตรงนี้ ถ้าใช้ bool ธรรมดา "ยังไม่ได้ถาม" จะกลายเป็น "ไม่ตั้งครรภ์"
	// แล้วแพทย์สั่งยาอันตรายไปโดยเข้าใจว่าคัดกรองแล้ว
	IsPregnant      *bool `json:"is_pregnant"`
	IsBreastfeeding *bool `json:"is_breastfeeding"`

	// ประจำเดือนครั้งสุดท้าย (LMP = Last Menstrual Period)
	// เก็บเป็นข้อความ ไม่ใช่ date เพราะผู้ป่วยมักจำได้แค่คร่าวๆ
	// ("ประมาณต้นเดือน", "จำไม่ได้", "หมดประจำเดือนแล้ว")
	// การบังคับเป็นวันที่จะทำให้พยาบาลต้องเดาวันแทนที่จะบันทึกตามที่ผู้ป่วยบอก
	//
	// ใช้ประเมินว่าอาจตั้งครรภ์โดยยังไม่รู้ตัว ถ้าขาดไปเกิน 4 สัปดาห์
	// ควรตรวจการตั้งครรภ์ก่อนสั่งยาหรือส่ง X-ray
	LastMenstrualPeriod string `gorm:"type:text" json:"last_menstrual_period"`

	// ============================================================
	// ข้อควรระวังในการดูแลผู้ป่วย (Isolation Precaution)
	// ============================================================
	// ค่าที่ใช้ (ตรงกับ PRECAUTION_OPTIONS ใน ExaminationView.tsx)
	//   ""         = จุดคัดกรองยังไม่ได้ระบุ
	//   "Standard" = ข้อปฏิบัติมาตรฐาน ใช้กับผู้ป่วยทุกคน
	//   "Contact"  = แพร่ทางการสัมผัส ต้องใส่ถุงมือ + เสื้อกาวน์
	//   "Droplet"  = แพร่ทางละอองฝอย ต้องใส่หน้ากากอนามัย
	//   "Airborne" = แพร่ทางอากาศ ต้องใส่ N95 และแยกผู้ป่วยออกจากคิวรวม
	//
	// เก็บเป็นข้อความไม่ใช่ enum เพราะ Postgres enum แก้ทีหลังยาก
	// และถ้าโรงพยาบาลเพิ่มประเภทใหม่ จะได้ไม่ต้อง migrate ตาราง
	PrecautionType string `gorm:"type:text;default:''" json:"precaution_type"`

	// สมุนไพรและอาหารเสริมที่ผู้ป่วยใช้อยู่
	// แยกจาก CurrentMedications เพราะผู้ป่วยส่วนใหญ่ไม่คิดว่าสองอย่างนี้คือ "ยา"
	// ถามรวมในช่องยาจะได้คำตอบว่า "ไม่ได้กินยาอะไร" ทั้งที่กินขมิ้นชันกับน้ำมันปลาอยู่
	//
	// สำคัญทางคลินิกจริง ไม่ใช่ถามเผื่อ
	//   - แปะก๊วย น้ำมันปลา ขิง กระเทียมสกัด เสริมฤทธิ์ยาละลายลิ่มเลือด เสี่ยงเลือดออก
	//   - St. John's Wort เร่งการทำลายยาหลายตัวจนยาเดิมไม่ได้ผล
	//   - วิตามินเคต้านฤทธิ์ warfarin โดยตรง
	// เก็บเป็นข้อความอิสระ เพราะชื่อผลิตภัณฑ์มีนับพันรายการ ทำเป็นตัวเลือกไม่ไหว
	HerbalMedicines    string `gorm:"type:text;default:''" json:"herbal_medicines"`
	DietarySupplements string `gorm:"type:text;default:''" json:"dietary_supplements"`

	// ============================================================
	// แบบคัดกรองภาวะซึมเศร้า 2 คำถาม (2Q)
	// ============================================================
	// แบบคัดกรองมาตรฐานของกรมสุขภาพจิต ถามถึงช่วง 2 สัปดาห์ที่ผ่านมารวมวันนี้
	//   Q1 รู้สึกหดหู่ เศร้า หรือท้อแท้สิ้นหวัง
	//   Q2 รู้สึกเบื่อ ทำอะไรก็ไม่เพลิดเพลิน
	//
	// ตอบว่า "ใช่" แม้เพียงข้อเดียว = ผลบวก ต้องประเมินต่อด้วย 9Q
	// ไม่ได้แปลว่าเป็นโรคซึมเศร้า แต่แปลว่าต้องซักต่อ ห้ามจบแค่นี้
	//
	// ใช้ *bool 3 สถานะ nil = ยังไม่ได้ถาม
	// ตรงนี้สำคัญกว่าข้ออื่นด้วยซ้ำ เพราะ "ไม่ได้ถาม" กับ "ถามแล้วตอบไม่มี"
	// ต่างกันที่ว่าผู้ป่วยเคยมีโอกาสบอกหรือยัง
	Q2Depressed *bool `json:"q2_depressed"`
	Q2Anhedonia *bool `json:"q2_anhedonia"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	VisitRecord    VisitRecord `gorm:"foreignKey:VisitID" json:"visit_record"`
	ScreenedBy     User        `gorm:"foreignKey:ScreenedByUserID" json:"screened_by"` // ดึงข้อมูลพยาบาลผู้คัดกรอง
	AssignedDoctor User        `gorm:"foreignKey:AssignedDoctorID" json:"assigned_doctor"`
}
