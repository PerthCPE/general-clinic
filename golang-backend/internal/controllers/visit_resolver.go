package controllers

import (
	"strings"

	"clinic-backend/internal/config"
	"clinic-backend/internal/models"

	"gorm.io/gorm"
)

// ResolveOrCreateVisit returns the VisitRecord and Patient based on the provided inputs.
func ResolveOrCreateVisit(hn string, patientName string, nationalID string, visitID uint) (models.VisitRecord, models.Patient) {
	var visit models.VisitRecord
	var patient models.Patient

	cleanHN := strings.ReplaceAll(hn, "-", "")

	if cleanHN != "" && cleanHN != "HN0001" {
		config.DB.Where("REPLACE(hn, '-', '') = ?", cleanHN).First(&patient)
	}

	if patient.ID == 0 && patientName != "" {
		config.DB.Where("full_name LIKE ?", "%"+patientName+"%").First(&patient)
	}
	
	if patient.ID == 0 && nationalID != "" && nationalID != "-" {
		config.DB.Where("national_id = ?", nationalID).First(&patient)
	}

	if patient.ID == 0 {
		patient = models.Patient{
			HN:         hn,
			FullName:  patientName,
			NationalID: nationalID,
		}
		if patient.HN == "" {
			patient.HN = "HN-0001"
		}
		if patient.FullName == "" {
			patient.FullName = "ผู้ป่วย"
		}
		config.DB.Create(&patient)
	}

	if visitID > 0 {
		config.DB.First(&visit, visitID)
	}
	
	if visit.ID == 0 && patient.ID > 0 {
		config.DB.Where("patient_id = ?", patient.ID).Order("created_at desc").First(&visit)
	}

	if visit.ID == 0 {
		visit = models.VisitRecord{
			PatientID: patient.ID,
			Status:    "in_progress",
		}
		config.DB.Create(&visit)
	}

	return visit, patient
}

// MarkVisitPaid updates the queue statuses to completed/เสร็จสิ้น
func MarkVisitPaid(tx *gorm.DB, visitID uint, hn string, patientID uint) error {
	queueUpdates := map[string]interface{}{
		"status":     "เสร็จสิ้น",
		"department": ResolveDepartmentForStatus(models.Queue{}, "เสร็จสิ้น"),
	}
	if visitID > 0 {
		if err := tx.Model(&models.BillingQueue{}).Where("visit_id = ?", visitID).Update("status", "completed").Error; err != nil {
			return err
		}
		if err := tx.Model(&models.Queue{}).Where("visit_id = ?", visitID).Updates(queueUpdates).Error; err != nil {
			return err
		}
		if err := tx.Model(&models.MedicineQueue{}).Where("visit_id = ?", visitID).Update("status", "completed").Error; err != nil {
			return err
		}
	}
	if hn != "" {
		if err := tx.Model(&models.BillingQueue{}).Where("hn = ?", hn).Update("status", "completed").Error; err != nil {
			return err
		}
		if err := tx.Model(&models.MedicineQueue{}).Where("hn = ?", hn).Update("status", "completed").Error; err != nil {
			return err
		}
	}
	if patientID > 0 {
		if err := tx.Model(&models.Queue{}).Where("patient_id = ?", patientID).Updates(queueUpdates).Error; err != nil {
			return err
		}
	}
	return nil
}
