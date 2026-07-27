package models

import "time"

type Document struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	ExternalDocRef string    `json:"external_doc_ref"`
	SenderName     string    `json:"sender_name"`
	Subject        string    `gorm:"not null" json:"subject"`
	ReceivedDate   time.Time `json:"received_date"`
	FileURL        string    `json:"file_url"`
	CreatedBy      uint      `json:"created_by"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`

	Creator User `gorm:"foreignKey:CreatedBy" json:"creator"`
}

type DocumentForward struct {
	ID             uint       `gorm:"primaryKey" json:"id"`
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
	ID        uint      `gorm:"primaryKey" json:"id"`
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
	ID         uint      `gorm:"primaryKey" json:"id"`
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
	ID             uint      `gorm:"primaryKey" json:"id"`
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