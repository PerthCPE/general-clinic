package models

import "time"

type Document struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	ExternalDocRef string    `json:"external_doc_ref"`
	Subject        string    `gorm:"not null" json:"subject"`
	FileURL        string    `json:"file_url"`
	Status         string    `gorm:"default:'reviewing'" json:"status"` // reviewing, approved, draft
	DocType        string    `json:"doc_type"`
	CreatedBy      uint      `json:"created_by"`
	ApprovedBy     *uint     `json:"approved_by"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`

	Creator  User  `gorm:"foreignKey:CreatedBy;references:ID" json:"creator"`
	Approver *User `gorm:"foreignKey:ApprovedBy;references:ID" json:"approver"`
}

type DocumentForward struct {
	ID             uint       `gorm:"primaryKey" json:"id"`
	DocID          uint       `gorm:"not null" json:"doc_id"`
	ForwardedTo    uint       `gorm:"not null" json:"forwarded_to"`
	Status         string     `json:"status"` // Pending, Acknowledged
	AcknowledgedAt *time.Time `json:"acknowledged_at"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`

	Document  Document `gorm:"foreignKey:DocID;references:ID" json:"document"`
	Recipient User     `gorm:"foreignKey:ForwardedTo;references:ID" json:"recipient"`
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

	Doctor  Doctor `gorm:"foreignKey:DoctorID;references:ID" json:"doctor"`
	Creator User   `gorm:"foreignKey:CreatedBy;references:ID" json:"creator"`
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

	Doctor   Doctor `gorm:"foreignKey:DoctorID;references:ID" json:"doctor"`
	Approver *User  `gorm:"foreignKey:ApprovedBy;references:ID" json:"approver"`
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

	Requester         User           `gorm:"foreignKey:RequesterID;references:ID" json:"requester"`
	Receiver          User           `gorm:"foreignKey:ReceiverID;references:ID" json:"receiver"`
	OriginalShiftData DoctorSchedule `gorm:"foreignKey:OriginalShift;references:ID" json:"original_shift_data"`
	TargetShiftData   DoctorSchedule `gorm:"foreignKey:TargetShift;references:ID" json:"target_shift_data"`
}
