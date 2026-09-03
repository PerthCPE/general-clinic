package controllers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"clinic-backend/internal/config"
	"clinic-backend/internal/dto"
	"clinic-backend/internal/models"
	"clinic-backend/internal/ws"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ==============================================================================
// ระบบจัดการข้อมูลการรักษา - บันทึกผลการตรวจและวินิจฉัยโรค
// ==============================================================================
// endpoint ในไฟล์นี้อยู่ใต้ /api/doctor และผ่าน RoleRequired("doctor")
// ลำดับการทำงานตรงกับ Sequence Diagram ของ Use Case "บันทึกผลการตรวจและวินิจฉัยโรค"
//
// การบันทึกทั้งหมดอยู่ในทรานแซกชันเดียว เพื่อไม่ให้เกิดกรณีที่มีผลการตรวจ
// ค้างอยู่โดยไม่มีการวินิจฉัยกำกับ ซึ่งเป็นข้อมูลเวชระเบียนที่ใช้ไม่ได้

const dateLayout = "2006-01-02"

// parseDateOnly - แปลงสตริง YYYY-MM-DD เป็นเวลา คืน nil ถ้าว่างหรือรูปแบบผิด
func parseDateOnly(s string) *time.Time {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	if len(s) > 10 {
		s = s[:10]
	}
	t, err := time.ParseInLocation(dateLayout, s, time.Local)
	if err != nil {
		return nil
	}
	return &t
}

func formatDateOnly(t *time.Time) string {
	if t == nil || t.IsZero() {
		return ""
	}
	return t.Local().Format(dateLayout)
}

// splitLines - แตกข้อความหลายบรรทัด/คั่นด้วยจุลภาค เป็น array
func splitLines(s string) []string {
	if strings.TrimSpace(s) == "" {
		return []string{}
	}
	parts := strings.FieldsFunc(s, func(r rune) bool {
		return r == '\n' || r == ',' || r == ';'
	})
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if v := strings.TrimSpace(p); v != "" {
			out = append(out, v)
		}
	}
	return out
}

func joinLines(items []string) string {
	clean := make([]string, 0, len(items))
	for _, i := range items {
		if v := strings.TrimSpace(i); v != "" {
			clean = append(clean, v)
		}
	}
	return strings.Join(clean, "\n")
}

// toPatientHistoryDTO - แปลง model ประวัติผู้ป่วยเป็นรูปแบบที่หน้าจอใช้
func toPatientHistoryDTO(h models.PatientHistory) dto.PatientHistoryDTO {
	isSmoker := h.SmokingStatus != "" &&
		!strings.Contains(h.SmokingStatus, "ไม่สูบ") &&
		!strings.EqualFold(h.SmokingStatus, "Non-smoker")
	isDrinker := h.AlcoholStatus != "" &&
		!strings.Contains(h.AlcoholStatus, "ไม่ดื่ม") &&
		!strings.EqualFold(h.AlcoholStatus, "Non-drinker")

	return dto.PatientHistoryDTO{
		PastMedicalHistory: h.PastMedicalHistory,
		PastSurgery:        h.PastSurgery,
		AdmissionHistory:   h.AdmissionHistory,
		FamilyHistory:      h.FamilyHistory,
		SocialHistory:      h.SocialHistory,
		SmokingHistory: &dto.SmokingHistoryDTO{
			IsUser:    isSmoker,
			Status:    h.SmokingStatus,
			Frequency: h.SmokingFrequency,
			Duration:  h.SmokingDuration,
		},
		AlcoholHistory: &dto.AlcoholHistoryDTO{
			IsUser:    isDrinker,
			Status:    h.AlcoholStatus,
			Frequency: h.AlcoholFrequency,
			Duration:  h.AlcoholDuration,
		},
		CurrentMedications: splitLines(h.CurrentMedications),
	}
}

// GetExamination - GET /api/doctor/visits/:id/examination
//
// โหลดข้อมูลทั้งหมดที่หน้าบันทึกการตรวจต้องใช้ในการเปิดเคสหนึ่งครั้ง
// ถ้ายังไม่เคยบันทึก จะคืนโครงเปล่าพร้อมข้อมูลผู้ป่วยและผลคัดกรองให้กรอกต่อ
func GetExamination(c *gin.Context) {
	visitID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รหัสการเข้ารับบริการไม่ถูกต้อง"})
		return
	}

	var visit models.VisitRecord
	if err := config.DB.Preload("Patient").Preload("Doctor").
		First(&visit, uint(visitID)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบข้อมูลการเข้ารับบริการนี้"})
		return
	}

	detail := dto.ExaminationDetail{
		VisitID:            visit.ID,
		VN:                 visit.VN,
		DoctorID:           visit.DoctorID,
		DoctorName:         visit.Doctor.FullName,
		Patient:            toPatientBrief(visit.Patient),
		SecondaryDiagnoses: []dto.DiagnosisItemDTO{},
		Editable:           true,
	}

	// บันทึกการตรวจของ visit นี้ (ถ้าเคยบันทึกไว้แล้ว)
	var exam models.Examination
	if err := config.DB.Where("visit_id = ?", visit.ID).First(&exam).Error; err == nil {
		detail.Status = exam.Status
		detail.SignedAt = formatDateOnly(exam.SignedAt)
		detail.Editable = exam.Status != models.ExaminationStatusSigned
		detail.PresentIllness = exam.PresentIllness
		detail.ChiefComplaintDuration = exam.ComplaintDuration
		detail.PhysicalExam = dto.PhysicalExamDTO{
			GeneralAppearance: exam.PEGeneral,
			Heent:             exam.PEHeent,
			Cardiovascular:    exam.PECardiovascular,
			Respiratory:       exam.PERespiratory,
			Abdomen:           exam.PEAbdomen,
			Musculoskeletal:   exam.PEMusculoskeletal,
			Neurological:      exam.PENeurological,
			Skin:              exam.PESkin,
		}
		detail.AssessmentNotes = exam.AssessmentNotes
		detail.ClinicalNotes = exam.ClinicalNotes
		detail.TreatmentPlan = exam.TreatmentPlan
		detail.ProceduresPerformed = exam.ProceduresPerformed
		detail.Counseling = dto.CounselingDTO{
			MedicationAdvice: exam.AdviceMedication,
			DietAdvice:       exam.AdviceDiet,
			ExerciseAdvice:   exam.AdviceExercise,
			LifestyleAdvice:  exam.AdviceLifestyle,
			DiseaseEducation: exam.AdviceDiseaseEdu,
		}
		detail.FollowUp = dto.FollowUpDTO{
			FollowUpDate: formatDateOnly(exam.FollowUpDate),
			Reason:       exam.FollowUpReason,
			Instructions: exam.FollowUpInstructions,
		}
	}

	// การวินิจฉัยของ visit นี้
	var diagnoses []models.Diagnosis
	config.DB.Where("visit_id = ?", visit.ID).
		Order("is_primary desc, sort_order asc, id asc").
		Find(&diagnoses)

	for _, d := range diagnoses {
		item := dto.DiagnosisItemDTO{Code: d.ICDCode, Name: d.NameEN, LocalName: d.NameTH}
		if d.IsPrimary && detail.PrimaryDiagnosis == nil {
			primary := item
			detail.PrimaryDiagnosis = &primary
			continue
		}
		detail.SecondaryDiagnoses = append(detail.SecondaryDiagnoses, item)
	}

	// ผลคัดกรองจากพยาบาล
	var screening models.Screening
	if err := config.DB.Preload("ScreenedBy").
		Where("visit_id = ?", visit.ID).Order("id desc").First(&screening).Error; err == nil {
		brief := toScreeningBrief(screening)
		detail.Screening = &brief
	}

	// ประวัติติดตัวผู้ป่วย
	var history models.PatientHistory
	if err := config.DB.Where("patient_id = ?", visit.PatientID).
		First(&history).Error; err == nil {
		h := toPatientHistoryDTO(history)
		detail.PatientHistory = &h
	}

	c.JSON(http.StatusOK, detail)
}

// SaveExamination - PUT /api/doctor/visits/:id/examination
//
// action = "draft" บันทึกร่าง แก้ไขต่อได้
// action = "sign"  เซ็นปิดการตรวจ ต้องมีการวินิจฉัยหลัก และปิดเคสส่งต่อห้องยา
func SaveExamination(c *gin.Context) {
	doctorID := doctorAuthUserID(c)
	if doctorID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "ไม่พบข้อมูลผู้ใช้งานใน token"})
		return
	}

	visitID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รหัสการเข้ารับบริการไม่ถูกต้อง"})
		return
	}

	var req dto.SaveExaminationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รูปแบบข้อมูลการตรวจไม่ถูกต้อง"})
		return
	}

	signing := strings.EqualFold(strings.TrimSpace(req.Action), "sign")

	var visit models.VisitRecord
	if err := config.DB.First(&visit, uint(visitID)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบข้อมูลการเข้ารับบริการนี้"})
		return
	}

	// เคสนี้ต้องเป็นของแพทย์คนที่ล็อกอินอยู่ (เคสที่ยังไม่ระบุแพทย์เปิดให้รับได้)
	if visit.DoctorID != 0 && visit.DoctorID != doctorID {
		c.JSON(http.StatusForbidden, gin.H{"error": "เคสนี้อยู่ในความดูแลของแพทย์ท่านอื่น"})
		return
	}

	// เคสที่เซ็นปิดไปแล้ว ห้ามแก้ไขย้อนหลัง
	var existing models.Examination
	hasExisting := config.DB.Where("visit_id = ?", visit.ID).First(&existing).Error == nil
	if hasExisting && existing.Status == models.ExaminationStatusSigned {
		c.JSON(http.StatusConflict, gin.H{
			"error": "การตรวจครั้งนี้ถูกเซ็นปิดไปแล้ว ไม่สามารถแก้ไขย้อนหลังได้",
		})
		return
	}

	// ตอนเซ็นปิด ต้องมีการวินิจฉัยหลักเสมอ
	if signing && (req.PrimaryDiagnosis == nil ||
		strings.TrimSpace(req.PrimaryDiagnosis.Code) == "") {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "กรุณาระบุการวินิจฉัยหลัก (Primary Diagnosis) ก่อนปิดการตรวจ",
		})
		return
	}

	now := time.Now()
	status := models.ExaminationStatusDraft
	if signing {
		status = models.ExaminationStatusSigned
	}

	exam := existing
	exam.VisitID = visit.ID
	exam.DoctorID = doctorID
	exam.PresentIllness = req.PresentIllness
	exam.ComplaintDuration = req.ChiefComplaintDuration
	exam.PEGeneral = req.PhysicalExam.GeneralAppearance
	exam.PEHeent = req.PhysicalExam.Heent
	exam.PECardiovascular = req.PhysicalExam.Cardiovascular
	exam.PERespiratory = req.PhysicalExam.Respiratory
	exam.PEAbdomen = req.PhysicalExam.Abdomen
	exam.PEMusculoskeletal = req.PhysicalExam.Musculoskeletal
	exam.PENeurological = req.PhysicalExam.Neurological
	exam.PESkin = req.PhysicalExam.Skin
	exam.AssessmentNotes = req.AssessmentNotes
	exam.ClinicalNotes = req.ClinicalNotes
	exam.TreatmentPlan = req.TreatmentPlan
	exam.ProceduresPerformed = req.ProceduresPerformed
	exam.AdviceMedication = req.Counseling.MedicationAdvice
	exam.AdviceDiet = req.Counseling.DietAdvice
	exam.AdviceExercise = req.Counseling.ExerciseAdvice
	exam.AdviceLifestyle = req.Counseling.LifestyleAdvice
	exam.AdviceDiseaseEdu = req.Counseling.DiseaseEducation
	exam.FollowUpDate = parseDateOnly(req.FollowUp.FollowUpDate)
	exam.FollowUpReason = req.FollowUp.Reason
	exam.FollowUpInstructions = req.FollowUp.Instructions
	exam.Status = status
	if signing {
		exam.SignedAt = &now
	}

	diagCount := 0
	visitStatus := visit.Status
	var updatedQueue models.Queue
	hasQueue := false

	txErr := config.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(&exam).Error; err != nil {
			return err
		}

		// เขียนทับชุดการวินิจฉัยทั้งก้อน ง่ายและตรงกว่าการไล่เทียบทีละรายการ
		if err := tx.Where("visit_id = ?", visit.ID).Delete(&models.Diagnosis{}).Error; err != nil {
			return err
		}

		rows := make([]models.Diagnosis, 0, len(req.SecondaryDiagnoses)+1)
		if req.PrimaryDiagnosis != nil && strings.TrimSpace(req.PrimaryDiagnosis.Code) != "" {
			rows = append(rows, models.Diagnosis{
				VisitID:   visit.ID,
				ICDCode:   strings.TrimSpace(req.PrimaryDiagnosis.Code),
				NameEN:    req.PrimaryDiagnosis.Name,
				NameTH:    req.PrimaryDiagnosis.LocalName,
				IsPrimary: true,
				SortOrder: 0,
			})
		}
		for i, d := range req.SecondaryDiagnoses {
			if strings.TrimSpace(d.Code) == "" {
				continue
			}
			rows = append(rows, models.Diagnosis{
				VisitID:   visit.ID,
				ICDCode:   strings.TrimSpace(d.Code),
				NameEN:    d.Name,
				NameTH:    d.LocalName,
				IsPrimary: false,
				SortOrder: i + 1,
			})
		}
		if len(rows) > 0 {
			if err := tx.Create(&rows).Error; err != nil {
				return err
			}
		}
		diagCount = len(rows)

		// ประวัติติดตัวผู้ป่วย (ส่งมาเมื่อแพทย์แก้ไขในหน้าเดียวกัน)
		if req.PatientHistory != nil {
			var history models.PatientHistory
			tx.Where("patient_id = ?", visit.PatientID).First(&history)

			h := req.PatientHistory
			history.PatientID = visit.PatientID
			history.PastMedicalHistory = h.PastMedicalHistory
			history.PastSurgery = h.PastSurgery
			history.AdmissionHistory = h.AdmissionHistory
			history.FamilyHistory = h.FamilyHistory
			history.SocialHistory = h.SocialHistory
			if h.SmokingHistory != nil {
				history.SmokingStatus = h.SmokingHistory.Status
				history.SmokingFrequency = h.SmokingHistory.Frequency
				history.SmokingDuration = h.SmokingHistory.Duration
			}
			if h.AlcoholHistory != nil {
				history.AlcoholStatus = h.AlcoholHistory.Status
				history.AlcoholFrequency = h.AlcoholHistory.Frequency
				history.AlcoholDuration = h.AlcoholHistory.Duration
			}
			history.CurrentMedications = joinLines(h.CurrentMedications)
			history.UpdatedByUserID = doctorID

			if err := tx.Save(&history).Error; err != nil {
				return err
			}
		}

		// เซ็นปิดการตรวจ = ปิดเคสและส่งคิวต่อไปห้องยา
		if signing {
			q, ok, err := applyVisitStatusTx(tx, &visit, models.VisitStatusCompleted,
				doctorID, "", now)
			if err != nil {
				return err
			}
			updatedQueue, hasQueue = q, ok
			visitStatus = visit.Status
		} else if visit.Status == models.VisitStatusWaiting || visit.Status == models.VisitStatusScreened {
			// บันทึกฉบับร่างครั้งแรก = แพทย์เริ่มตรวจแล้ว จึงเลื่อนสถานะเป็น "กำลังตรวจ"
			// (ออกเลข VN กับขยับคิวให้ด้วย เหมือนตอนกดปุ่มเรียกตรวจ)
			//
			// ถ้าไม่ทำตรงนี้ พอกลับไปหน้าคิว สถานะจะยังเป็น "รอตรวจ" ทั้งที่มีร่าง
			// บันทึกไว้แล้ว ปุ่มก็จะไม่ขึ้นว่า "ตรวจต่อ"
			q, ok, err := applyVisitStatusTx(tx, &visit, models.VisitStatusExamining,
				doctorID, "", now)
			if err != nil {
				return err
			}
			updatedQueue, hasQueue = q, ok
			visitStatus = visit.Status
		}

		return nil
	})

	if txErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถบันทึกผลการตรวจได้"})
		return
	}

	// แจ้งทุกเครื่องแบบ real-time
	ws.BroadcastEvent("EXAMINATION_SAVED", gin.H{
		"visit_id": visit.ID,
		"status":   exam.Status,
	})
	if signing {
		var pat models.Patient
		config.DB.First(&pat, visit.PatientID)
		age := 35
		if pat.BirthDate.Year() > 1900 {
			age = time.Now().Year() - pat.BirthDate.Year()
		}

		// อัปเดตประวัติการแพ้ยาและโรคประจำตัวลงตาราง patients หากแพทย์ระบุ
		if strings.TrimSpace(req.Allergies) != "" && req.Allergies != "ไม่มีประวัติแพ้ยา" {
			pat.Allergies = req.Allergies
			config.DB.Model(&models.Patient{}).Where("id = ?", pat.ID).Update("allergies", req.Allergies)
		}
		if strings.TrimSpace(req.ChronicDiseases) != "" && req.ChronicDiseases != "ไม่มี" {
			pat.ChronicDiseases = req.ChronicDiseases
			config.DB.Model(&models.Patient{}).Where("id = ?", pat.ID).Update("chronic_diseases", req.ChronicDiseases)
		}

		// บันทึกรายการสั่งยาที่แพทย์สั่งลงตาราง dispensings
		config.DB.Where("visit_id = ?", visit.ID).Delete(&models.Dispensing{})
		var medList []gin.H

		for _, p := range req.Prescriptions {
			// ค้นหายาและราคาต่อหน่วยจริงจากตาราง medicines
			med := FindMedicineByNameOrCode(p.MedicineCode, p.MedicineName)
			if med.ID == 0 && p.MedicineID > 0 {
				config.DB.First(&med, p.MedicineID)
			}

			medID := med.ID
			if medID == 0 {
				medID = 1
			}
			unitPrice := med.UnitPrice
			if unitPrice <= 0 && p.UnitPrice > 0 {
				unitPrice = p.UnitPrice
			}
			if unitPrice <= 0 {
				unitPrice = 10.0
			}
			qty := p.Quantity
			if qty <= 0 {
				qty = 10
			}

			disp := models.Dispensing{
				VisitID:      visit.ID,
				MedicineID:   medID,
				DoctorID:     doctorID,
				Quantity:     qty,
				Dosage:       p.Dosage,
				Instructions: p.Instructions,
			}
			config.DB.Create(&disp)

			medName := p.MedicineName
			if medName == "" && med.Name != "" {
				medName = med.Name
			}
			genName := p.GenericName
			if genName == "" && med.GenericName != "" {
				genName = med.GenericName
			}
			cat := p.Category
			if cat == "" && med.Category != "" {
				cat = med.Category
			}
			if cat == "" {
				cat = "ยาสามัญ"
			}
			props := med.Properties
			if props == "" {
				props = "บรรเทาอาการตามแพทย์สั่ง"
			}

			medList = append(medList, gin.H{
				"medId":        p.MedicineCode,
				"name":         medName,
				"genericName":  genName,
				"category":     cat,
				"properties":   props,
				"dosage":       p.Dosage,
				"instructions": p.Instructions,
				"price":        unitPrice,
				"quantity":     qty,
				"stock":        med.StockQuantity,
				"stockStatus":  "พร้อมจ่าย",
			})
		}

		medsJSON, _ := json.Marshal(medList)

		// สรุปคำแนะนำและคำวินิจฉัยของแพทย์
		adviceParts := []string{}
		if req.PrimaryDiagnosis != nil && req.PrimaryDiagnosis.Name != "" {
			adviceParts = append(adviceParts, fmt.Sprintf("คำวินิจฉัยหลัก: %s (%s)", req.PrimaryDiagnosis.Name, req.PrimaryDiagnosis.Code))
		}
		if req.Counseling.MedicationAdvice != "" {
			adviceParts = append(adviceParts, fmt.Sprintf("คำแนะนำการใช้ยา: %s", req.Counseling.MedicationAdvice))
		}
		if req.TreatmentPlan != "" {
			adviceParts = append(adviceParts, fmt.Sprintf("แผนการรักษา: %s", req.TreatmentPlan))
		}
		if len(adviceParts) == 0 {
			adviceParts = append(adviceParts, "พักผ่อนให้เพียงพอ และทานยาตามแพทย์สั่งอย่างเคร่งครัด")
		}
		fullAdvice := strings.Join(adviceParts, " | ")

		var existingMQ models.MedicineQueue
		mQueueNo := ""
		if hasQueue && updatedQueue.QueueNumber != "" {
			mQueueNo = updatedQueue.QueueNumber
		} else {
			var mqCount int64
			config.DB.Model(&models.MedicineQueue{}).Count(&mqCount)
			mQueueNo = fmt.Sprintf("M-%03d", mqCount+1)
		}

		if err := config.DB.Where("visit_id = ?", visit.ID).First(&existingMQ).Error; err != nil {
			medQ := models.MedicineQueue{
				QueueNumber:  mQueueNo,
				HN:           pat.HN,
				PatientName:  pat.FullName,
				NationalID:   pat.NationalID,
				Gender:       pat.Gender,
				Age:          age,
				SchemeType:   pat.SchemeType,
				VisitID:      visit.ID,
				DoctorAdvice: fullAdvice,
				Status:       "pending",
				Medications:  string(medsJSON),
			}
			config.DB.Create(&medQ)
		} else {
			existingMQ.Medications = string(medsJSON)
			existingMQ.DoctorAdvice = fullAdvice
			existingMQ.Status = "pending"
			config.DB.Save(&existingMQ)
		}

		// ซิงค์ตาราง patient_medicines สำหรับห้องยา
		var patMed models.PatientMedicine
		if err := config.DB.Where("hn = ?", pat.HN).First(&patMed).Error; err != nil {
			patMed = models.PatientMedicine{
				HN:              pat.HN,
				NationalID:      pat.NationalID,
				FullName:        pat.FullName,
				Gender:          pat.Gender,
				Age:             age,
				SchemeType:      pat.SchemeType,
				Allergies:       pat.Allergies,
				ChronicDiseases: pat.ChronicDiseases,
				PhoneNumber:     pat.PhoneNumber,
			}
			config.DB.Create(&patMed)
		} else {
			patMed.Allergies = pat.Allergies
			patMed.ChronicDiseases = pat.ChronicDiseases
			config.DB.Save(&patMed)
		}

		ws.BroadcastEvent("VISIT_UPDATED", visit)
		ws.BroadcastEvent("MEDICINE_QUEUE_CREATED", gin.H{
			"visit_id":      visit.ID,
			"hn":            pat.HN,
			"patient_name":  pat.FullName,
			"queue_number":  mQueueNo,
			"doctor_advice": fullAdvice,
			"medications":   medList,
		})

		// คำนวณราคายารวม
		totalMedsAmount := 0.0
		for _, m := range medList {
			if p, ok := m["price"].(float64); ok {
				if q, ok := m["quantity"].(int); ok {
					totalMedsAmount += p * float64(q)
				}
			}
		}

		// สร้าง/อัปเดต BillingQueue ในสถานะ pending รอชำระเงินทันที
		var bq models.BillingQueue
		if err := config.DB.Where("visit_id = ?", visit.ID).First(&bq).Error; err != nil {
			var bCount int64
			config.DB.Model(&models.BillingQueue{}).Count(&bCount)
			bQueueNo := fmt.Sprintf("B-%03d", bCount+1)
			bq = models.BillingQueue{
				QueueNumber:  bQueueNo,
				HN:           pat.HN,
				PatientName:  pat.FullName,
				NationalID:   pat.NationalID,
				Gender:       pat.Gender,
				Age:          age,
				SchemeType:   pat.SchemeType,
				VisitID:      visit.ID,
				TotalAmount:  totalMedsAmount,
				Status:       "pending",
				DoctorAdvice: fullAdvice,
				Medications:  string(medsJSON),
			}
			config.DB.Create(&bq)
		} else {
			bq.Medications = string(medsJSON)
			bq.DoctorAdvice = fullAdvice
			bq.TotalAmount = totalMedsAmount
			bq.Status = "pending"
			config.DB.Save(&bq)
		}

		ws.BroadcastEvent("BILLING_CREATED", gin.H{
			"id":            bq.ID,
			"queue_id":      bq.ID,
			"queue_number":  bq.QueueNumber,
			"visit_id":      bq.VisitID,
			"patient_name":  bq.PatientName,
			"hn":            bq.HN,
			"national_id":   bq.NationalID,
			"gender":        bq.Gender,
			"age":           bq.Age,
			"scheme_type":   bq.SchemeType,
			"total_amount":  bq.TotalAmount,
			"net_amount":    bq.TotalAmount,
			"status":        "pending",
			"doctor_advice": bq.DoctorAdvice,
			"medications":   medList,
			"created_at":    bq.CreatedAt,
		})

		if hasQueue {
			config.DB.Preload("Patient").First(&updatedQueue, updatedQueue.ID)
			ws.BroadcastEvent("QUEUE_UPDATED", updatedQueue)
		}
	}

	message := "บันทึกร่างผลการตรวจเรียบร้อยแล้ว"
	if signing {
		message = "บันทึกผลการตรวจและปิดเคสเรียบร้อยแล้ว"
	}

	c.JSON(http.StatusOK, dto.SaveExaminationResponse{
		Message:        message,
		ExaminationID:  exam.ID,
		Status:         exam.Status,
		VisitStatus:    visitStatus,
		DiagnosisCount: diagCount,
	})
}

// GetPatientVisitHistory - GET /api/doctor/patients/:id/visits
//
// ประวัติการมาตรวจย้อนหลังของผู้ป่วย ใช้ในหน้าประวัติเวชระเบียน
func GetPatientVisitHistory(c *gin.Context) {
	patientID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รหัสผู้ป่วยไม่ถูกต้อง"})
		return
	}

	var visits []models.VisitRecord
	if err := config.DB.Preload("Doctor").
		Where("patient_id = ?", uint(patientID)).
		Order("visit_date desc").
		Limit(50).
		Find(&visits).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถดึงประวัติการมาตรวจได้"})
		return
	}

	items := make([]gin.H, 0, len(visits))
	for _, v := range visits {
		visitDate, visitTime := splitVisitDateTime(v.VisitDate)

		// การวินิจฉัยหลักของครั้งนั้น
		diagnosis, icdCode := "", ""
		var d models.Diagnosis
		if err := config.DB.Where("visit_id = ? AND is_primary = ?", v.ID, true).
			First(&d).Error; err == nil {
			diagnosis = d.NameTH
			if diagnosis == "" {
				diagnosis = d.NameEN
			}
			icdCode = d.ICDCode
		}

		// สัญญาณชีพจากการคัดกรองครั้งนั้น
		var vitals gin.H
		var s models.Screening
		if err := config.DB.Where("visit_id = ?", v.ID).Order("id desc").
			First(&s).Error; err == nil {
			vitals = gin.H{
				"bp":     formatBP(s.SystolicBP, s.DiastolicBP),
				"pulse":  s.HeartRate,
				"temp":   s.Temperature,
				"weight": s.Weight,
				"spo2":   s.SpO2,
			}
		}

		var followUp string
		var e models.Examination
		if err := config.DB.Where("visit_id = ?", v.ID).First(&e).Error; err == nil {
			followUp = formatDateOnly(e.FollowUpDate)
		}

		items = append(items, gin.H{
			"id":           v.ID,
			"vn":           v.VN,
			"visitDate":    visitDate,
			"visitTime":    visitTime,
			"doctorName":   v.Doctor.FullName,
			"department":   v.Department,
			"diagnosis":    diagnosis,
			"icdCode":      icdCode,
			"vitals":       vitals,
			"followUpDate": followUp,
			"status":       normalizeVisitStatus(v.Status),
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"patient_id": uint(patientID),
		"history":    items,
	})
}
