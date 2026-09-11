package dto

// DTO สำหรับ Appointment
type CreateAppointmentRequest struct {
	DoctorID        uint   `json:"doctor_id" binding:"required"`
	PatientID       uint   `json:"patient_id" binding:"required"`
	RegisterID      uint   `json:"register_id"` // พนักงานรับนัด
	AppointmentDate string `json:"appointment_date" binding:"required"`
	AppointmentTime string `json:"appointment_time" binding:"required"`
	Department      string `json:"department"`
	ClinicalNote    string `json:"clinical_note"`
	// ฟิลด์เสริม optional — ไม่มี binding:"required" ตั้งใจ ให้ฟอร์มเก่า/ไคลเอนต์อื่นที่ไม่ส่งมา ยังสร้างนัดหมายได้ปกติ
	AppointmentType  string `json:"appointment_type"`
	Reason           string `json:"reason"`
	PrepInstructions string `json:"prep_instructions"`
}

type UpdateAppointmentStatusRequest struct {
	Status       string `json:"status" binding:"required"`
	ClinicalNote string `json:"clinical_note"`
}


type UpdateAppointmentScheduleRequest struct {
	AppointmentDate string `json:"appointment_date"`
	AppointmentTime string `json:"appointment_time"`
}

// UpdateAppointmentDetailsRequest — แก้ไขข้อมูลนัดหมายที่ไม่ใช่สถานะ (วันเวลา/ประเภทนัด/เหตุผล/
// คำแนะนำ/หมายเหตุ) ทั้งหมด optional ไม่มีฟิลด์ไหนบังคับ — ไม่มี Department ในนี้โดยตั้งใจ
// เพราะแผนกแก้ไม่ได้หลังสร้างนัดหมายแล้ว
type UpdateAppointmentDetailsRequest struct {
	AppointmentDate  string `json:"appointment_date"`
	AppointmentTime  string `json:"appointment_time"`
	AppointmentType  string `json:"appointment_type"`
	Reason           string `json:"reason"`
	PrepInstructions string `json:"prep_instructions"`
	ClinicalNote     string `json:"clinical_note"`
}

// CancelAppointmentRequest — เหตุผลบังคับกรอกเสมอ (ดู CancelAppointment)
type CancelAppointmentRequest struct {
	Reason string `json:"reason" binding:"required"`
}
