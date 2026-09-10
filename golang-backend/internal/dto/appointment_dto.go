package dto

// DTO สำหรับ Appointment
type CreateAppointmentRequest struct {
	DoctorID        uint   `json:"doctor_id" binding:"required"`
	PatientID       uint   `json:"patient_id" binding:"required"`
	RegisterID      uint   `json:"register_id"` // พนักงานรับนัด
	AppointmentDate string `json:"appointment_date" binding:"required"`
	AppointmentTime string `json:"appointment_time" binding:"required"`
	ClinicalNote    string `json:"clinical_note"`
}

type UpdateAppointmentStatusRequest struct {
	Status       string `json:"status" binding:"required"`
	ClinicalNote string `json:"clinical_note"`
}


type UpdateAppointmentScheduleRequest struct {
	AppointmentDate string `json:"appointment_date"` 
	AppointmentTime string `json:"appointment_time"` 
}
