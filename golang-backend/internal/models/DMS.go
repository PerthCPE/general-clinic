package models

import "time"

type Document struct {
	DocID          uint      `gorm:"primaryKey" json:"doc_id"`
	ExternalDocRef string    `json:"external_doc_ref"`
	SenderName     string    `json:"sender_name"`
	Subject        string    `gorm:"not null" json:"subject"`
	FileURL        string    `json:"file_url"`
	CreatedBy      uint      `json:"created_by"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`

	Creator User `gorm:"foreignKey:CreatedBy" json:"creator"`
}

type DocumentForward struct {
	DocForwardID   uint       `gorm:"primaryKey" json:"doc_forward_id"`
	DocID          uint       `gorm:"not null" json:"doc_id"`
	ForwardedTo    uint       `gorm:"not null" json:"forwarded_to"`
	Status         string     `json:"status"` // Pending, Acknowledged
	AcknowledgedAt *time.Time `json:"acknowledged_at"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`

	Document  Document `gorm:"foreignKey:DocID" json:"document"`
	Recipient User     `gorm:"foreignKey:ForwardedTo" json:"recipient"`
}

type DoctorSchedule struct {
	ScheduleID     uint      `gorm:"primaryKey" json:"schedule_id"`
	DoctorID  uint      `gorm:"not null" json:"doctor_id"`
	WorkDate  time.Time `json:"work_date"`
	ShiftType string    `json:"shift_type"` // Morning, Afternoon
	Status    string    `json:"status"`     // Draft, Published
	CreatedBy uint      `json:"created_by"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	Doctor  Doctor `gorm:"foreignKey:DoctorID" json:"doctor"`
	Creator User   `gorm:"foreignKey:CreatedBy" json:"creator"`
}

type LeaveRequest struct {
	LeaveRequestID uint      `gorm:"primaryKey" json:"leave_request_id"`
	DoctorID   uint      `gorm:"not null" json:"doctor_id"`
	LeaveDate  time.Time `json:"leave_date"`
	Reason     string    `json:"reason"`
	Status     string    `json:"status"` // Pending, Approved, Rejected
	ApprovedBy *uint     `json:"approved_by"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`

	Doctor   Doctor `gorm:"foreignKey:DoctorID" json:"doctor"`
	Approver *User  `gorm:"foreignKey:ApprovedBy" json:"approver"`
}

type ShiftSwapRequest struct {
	ShiftSwapID    uint      `gorm:"primaryKey" json:"shift_swap_id"`
	RequesterID    uint      `gorm:"not null" json:"requester_id"`
	ReceiverID     uint      `gorm:"not null" json:"receiver_id"`
	OriginalShift  uint      `gorm:"not null" json:"original_shift"`
	TargetShift    uint      `gorm:"not null" json:"target_shift"`
	ReceiverStatus string    `json:"receiver_status"` // Pending, Accepted, Rejected
	AdminStatus    string    `json:"admin_status"`    // Pending, Approved, Rejected
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`

	Requester         User           `gorm:"foreignKey:RequesterID" json:"requester"`
	Receiver          User           `gorm:"foreignKey:ReceiverID" json:"receiver"`
	OriginalShiftData DoctorSchedule `gorm:"foreignKey:OriginalShift" json:"original_shift_data"`
	TargetShiftData   DoctorSchedule `gorm:"foreignKey:TargetShift" json:"target_shift_data"`
}
