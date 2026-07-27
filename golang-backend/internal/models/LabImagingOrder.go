package models

import (
	"gorm.io/gorm"
)

type LabImagingOrder struct {
	gorm.Model
	VisitID uint `gorm:"not null;index" json:"visit_id"`
	// Relation เชื่อมไปตารางหลักของเพื่อน
	VisitRecord VisitRecord `gorm:"foreignKey:VisitID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"visit_record,omitempty"`

	OrderType          string `json:"order_type"` // "LAB" หรือ "IMAGING"
	TestName           string `json:"test_name"`
	AnatomicalBodyPart string `json:"anatomical_body_part"`
	ClinicalIndication string `json:"clinical_indication"`
	IsSTAT             bool   `json:"is_stat"`
}
