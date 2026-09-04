package models

import "time"

type Screening struct {
	ID               uint      `gorm:"primaryKey" json:"id"`
	VisitID          uint      `gorm:"not null" json:"visit_id"`
	ScreenedByUserID uint      `json:"screened_by_user_id"` // พยาบาลผู้ทำการคัดกรอง
	AssignedDoctorID uint      `json:"assigned_doctor_id"`  // แพทย์ประจำห้องตรวจที่ส่งต่อ
	TriageLevel      string    `json:"triage_level"`        // ปกติ (Normal), เร่งด่วน (Urgent), ฉุกเฉิน (Emergency), วิกฤต (Resuscitation)
	ChiefComplaint   string    `json:"chief_complaint"`
	Allergies        string    `json:"allergies"`
	MedicalHistory   string    `json:"medical_history"`
	NurseNotes       string    `json:"nurse_notes"`
	Weight           float64   `json:"weight"`
	Height           float64   `json:"height"`
	BMI              float64   `json:"bmi"`
	Temperature      float64   `json:"temperature"`
	SystolicBP       int       `json:"systolic_bp"`
	DiastolicBP      int       `json:"diastolic_bp"`
	HeartRate        int       `json:"heart_rate"`
	RespiratoryRate  int       `json:"respiratory_rate"`
	SpO2             int       `json:"spo2"`
	PainScore        int       `json:"pain_score"`
	BloodSugar       int       `json:"blood_sugar"`
	FoodAllergies    string    `json:"food_allergies"`
	CurrentMedications string  `json:"current_medications"`
	SmokingHistory   string    `json:"smoking_history"`
	AlcoholHistory   string    `json:"alcohol_history"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`

	VisitRecord  VisitRecord `gorm:"foreignKey:VisitID" json:"visit_record"`
	ScreenedBy   User        `gorm:"foreignKey:ScreenedByUserID" json:"screened_by"` // ดึงข้อมูลพยาบาลผู้คัดกรอง
	AssignedDoctor User      `gorm:"foreignKey:AssignedDoctorID" json:"assigned_doctor"`
}
