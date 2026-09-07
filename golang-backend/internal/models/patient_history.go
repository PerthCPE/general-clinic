package models

import "time"

// PatientHistory - ประวัติติดตัวผู้ป่วย 1 แถวต่อผู้ป่วย 1 คน
//
// เป็นข้อมูลที่ติดตัวผู้ป่วยไปตลอด ไม่ใช่ของการมาตรวจครั้งใดครั้งหนึ่ง
// แพทย์แก้ไขได้เมื่อมีข้อมูลใหม่ แต่ไม่ต้องกรอกซ้ำทุกครั้งที่ผู้ป่วยมา
//
// หน้า ExaminationView เรียกใช้ smokingHistory กับ alcoholHistory มากที่สุดในหน้า
// จึงแตกเป็นช่อง status / frequency / duration ให้ตรงกับ object ใน types.ts
type PatientHistory struct {
	ID        uint `gorm:"primaryKey" json:"id"`
	PatientID uint `gorm:"uniqueIndex;not null" json:"patient_id"`

	PastMedicalHistory string `json:"past_medical_history"` // โรคประจำตัวและประวัติการรักษา
	PastSurgery        string `json:"past_surgery"`         // ประวัติการผ่าตัด
	AdmissionHistory   string `json:"admission_history"`    // ประวัตินอนโรงพยาบาล
	FamilyHistory      string `json:"family_history"`       // ประวัติครอบครัว
	SocialHistory      string `json:"social_history"`       // ประวัติทางสังคม

	SmokingStatus    string `json:"smoking_status"`    // สูบบุหรี่ / ไม่สูบ / เลิกแล้ว
	SmokingFrequency string `json:"smoking_frequency"` // เช่น 10 มวน/วัน
	SmokingDuration  string `json:"smoking_duration"`  // เช่น 5 ปี

	AlcoholStatus    string `json:"alcohol_status"`
	AlcoholFrequency string `json:"alcohol_frequency"`
	AlcoholDuration  string `json:"alcohol_duration"`

	CurrentMedications string `json:"current_medications"` // ยาที่ใช้อยู่ประจำ

	UpdatedByUserID uint `json:"updated_by_user_id"` // แพทย์คนล่าสุดที่แก้ไข

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	Patient   Patient `gorm:"foreignKey:PatientID" json:"-"`
	UpdatedBy User    `gorm:"foreignKey:UpdatedByUserID" json:"-"`
}
