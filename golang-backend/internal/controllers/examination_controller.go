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

// joinNonEmpty - ต่อข้อความหลายก้อนด้วยตัวคั่น โดยข้ามก้อนที่ว่าง
func joinNonEmpty(parts []string, sep string) string {
	clean := make([]string, 0, len(parts))
	for _, p := range parts {
		if v := strings.TrimSpace(p); v != "" {
			clean = append(clean, v)
		}
	}
	return strings.Join(clean, sep)
}

// labelIfNotEmpty - ใส่หัวข้อนำหน้าข้อความ คืนค่าว่างถ้าไม่มีเนื้อหา
func labelIfNotEmpty(label, value string) string {
	if strings.TrimSpace(value) == "" {
		return ""
	}
	return label + ": " + strings.TrimSpace(value)
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
		Prescriptions:      []dto.PrescriptionItemDTO{},
		Editable:           true,
	}

	// ใบสั่งยาที่บันทึกไว้ อ่านกลับจากตาราง dispensings
	// เพื่อให้แพทย์เปิดเคสเดิมกลับมาแล้วยังเห็นยาที่สั่งไว้ ไม่ต้องพิมพ์ใหม่
	var saved []models.Dispensing
	if err := config.DB.Preload("Medicine").
		Where("visit_id = ?", visit.ID).
		Order("id asc").
		Find(&saved).Error; err == nil {
		for _, d := range saved {
			detail.Prescriptions = append(detail.Prescriptions, dto.PrescriptionItemDTO{
				MedicineID:   d.MedicineID,
				MedicineCode: d.Medicine.MedicineCode,
				MedicineName: d.Medicine.Name,
				Dosage:       d.Dosage,
				Quantity:     d.Quantity,
				UnitPrice:    d.Medicine.UnitPrice,
				Instructions: d.Instructions,
			})
		}
	}

	// บันทึกการตรวจของ visit นี้ (ถ้าเคยบันทึกไว้แล้ว)
	var exam models.Examination
	if err := config.DB.Where("visit_id = ?", visit.ID).First(&exam).Error; err == nil {
		detail.Status = exam.Status
		detail.SignedAt = formatDateOnly(exam.SignedAt)
		detail.Editable = exam.Status != models.ExaminationStatusSigned
		detail.PresentIllness = exam.PresentIllness
		detail.ChiefComplaintDuration = exam.ComplaintDuration
		detail.Disposition = exam.Disposition

		// ถ้ามีใบสั่งยาฉบับเต็มเก็บไว้ ให้ใช้ตัวนี้แทนที่อ่านจาก dispensings ด้านบน
		// เพราะ dispensings ไม่มีช่องความถี่ / ระยะเวลา / ทางให้ยา / เวลารับประทาน
		// ถ้าไม่ทับ แพทย์เปิดเคสเดิมกลับมาแล้วช่องพวกนี้จะว่างเปล่าทุกครั้ง
		// แล้วพอกดบันทึกซ้ำ ข้อมูลเดิมที่เคยกรอกไว้จะหายไปจริงๆ
		if strings.TrimSpace(exam.PrescriptionDetail) != "" {
			var savedRx []dto.PrescriptionItemDTO
			if err := json.Unmarshal([]byte(exam.PrescriptionDetail), &savedRx); err == nil && len(savedRx) > 0 {
				detail.Prescriptions = savedRx
			}
		}

		// เอกสารที่แพทย์สั่งออกไว้ในการตรวจครั้งนี้
		// ถ้า JSON เสียหาย (เช่นถูกแก้ในฐานข้อมูลด้วยมือ) ให้ปล่อยเป็น nil
		// ดีกว่าทำให้ทั้ง endpoint ล้มเพราะเอกสารซึ่งไม่ใช่ข้อมูลหลักของการตรวจ
		if strings.TrimSpace(exam.IssuedDocuments) != "" {
			var savedDocs []dto.IssuedDocumentDTO
			if err := json.Unmarshal([]byte(exam.IssuedDocuments), &savedDocs); err == nil {
				detail.IssuedDocuments = savedDocs
			}
		}

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

	// ผลของการส่งใบสั่งยาต่อห้องยา เติมค่าในทรานแซกชันด้านล่าง
	prescriptionCount := 0
	unmatchedMedicines := []string{}

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

	// สถานะผู้ป่วยหลังตรวจเสร็จ รับเฉพาะค่าที่รู้จัก
	// ค่าแปลกปลอมให้เป็นค่าว่าง (ยังไม่ระบุ) ดีกว่าเก็บค่าที่หน้าจอแปลไม่ออก
	// แล้วแสดงเป็นช่องว่างโดยไม่มีใครรู้ว่าข้อมูลเพี้ยน
	switch strings.TrimSpace(req.Disposition) {
	case "home", "refer":
		exam.Disposition = strings.TrimSpace(req.Disposition)
	default:
		exam.Disposition = ""
	}
	exam.AdviceMedication = req.Counseling.MedicationAdvice
	exam.AdviceDiet = req.Counseling.DietAdvice
	exam.AdviceExercise = req.Counseling.ExerciseAdvice
	exam.AdviceLifestyle = req.Counseling.LifestyleAdvice
	exam.AdviceDiseaseEdu = req.Counseling.DiseaseEducation
	exam.FollowUpDate = parseDateOnly(req.FollowUp.FollowUpDate)
	exam.FollowUpReason = req.FollowUp.Reason
	exam.FollowUpInstructions = req.FollowUp.Instructions
	exam.Status = status

	// ============================================================================
	// จับคู่ยาที่แพทย์สั่งกับคลังยาจริง แล้วเก็บใบสั่งยาฉบับเต็มลงบันทึกการตรวจ
	// ============================================================================
	// ต้องทำ "ก่อน" ทรานแซกชัน และทำ "ทุกครั้งที่บันทึก" ไม่ใช่เฉพาะตอนเซ็นปิดเคส
	//
	// เคยพลาดตรงนี้: โค้ดเดิมเก็บใบสั่งยาไว้ในบล็อก if signing ก้อนเดียวกับ
	// การส่งใบยาต่อห้องยา ผลคือแพทย์กด "บันทึกผลการตรวจ" (ยังไม่ปิดเคส)
	// การวินิจฉัยขึ้นในประวัติปกติ แต่ช่องยาว่างเปล่าทุกครั้ง
	// เพราะทั้งบล็อกไม่ถูกรันเลย ดูเหมือนบันทึกยาไม่สำเร็จทั้งที่กดบันทึกแล้ว
	//
	// แยกให้ชัด:
	//   prescription_detail (ตารางของแพทย์)  เขียนทุกครั้ง เป็นบันทึกว่าแพทย์สั่งอะไร
	//   dispensings + คิวห้องยา              เขียนเฉพาะตอนเซ็นปิดเคส
	//                                        เพราะเป็นการส่งของจริงให้ห้องยาจ่ายยา
	//                                        ใบร่างที่ยังแก้ได้ต้องไม่หลุดไปถึงห้องยา
	type resolvedPrescription struct {
		item dto.PrescriptionItemDTO
		med  models.Medicine
	}
	resolvedRx := make([]resolvedPrescription, 0, len(req.Prescriptions))

	for _, p := range req.Prescriptions {
		// ลำดับการค้นสำคัญมาก
		// ถ้าหน้าจอแพทย์ส่ง medicine_id มาด้วย แปลว่าแพทย์ "เลือกจากรายการยาจริงในคลัง"
		// ไม่ได้พิมพ์ชื่อขึ้นมาเอง จึงต้องเชื่อ id ก่อนเสมอ
		// เพราะการค้นด้วยชื่อมีขั้นที่จับแบบขึ้นต้นเหมือนกัน ซึ่งอาจไปตรงกับยาคนละตัว
		// (เช่น "Amoxicillin 500mg" กับ "Amoxicillin 500mg cap")
		// โค้ดเดิมค้นด้วยชื่อก่อนแล้วค่อยใช้ id เป็นตัวสำรอง จึงมีโอกาสจ่ายยาผิดตัว
		var med models.Medicine
		if p.MedicineID > 0 {
			config.DB.First(&med, p.MedicineID)
		}
		if med.ID == 0 {
			med = FindMedicineByNameOrCode(p.MedicineCode, p.MedicineName)
		}

		// ยาที่หาไม่เจอในคลัง ต้องข้าม ห้ามเดา
		//
		// โค้ดเดิมตรงนี้ใส่ medID = 1 เมื่อหาไม่เจอ ซึ่งแปลว่าผู้ป่วยจะได้รับ
		// "ยาแถวแรกของตาราง medicines" แทนยาที่แพทย์สั่งจริง โดยไม่มีใครรู้
		// เป็นความผิดพลาดที่ถึงตัวผู้ป่วยโดยตรง จึงเปลี่ยนเป็นข้ามรายการนั้น
		// แล้วส่งชื่อกลับไปเตือนแพทย์ผ่าน unmatched_medicines
		if med.ID == 0 {
			unmatchedMedicines = append(unmatchedMedicines, p.MedicineName)
			continue
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

		// เขียนทับด้วยค่าที่ตรวจสอบกับคลังยาแล้ว ไม่ใช้ค่าที่หน้าจอส่งมาดิบๆ
		rx := p
		rx.MedicineID = med.ID
		if med.MedicineCode != "" {
			rx.MedicineCode = med.MedicineCode
		}
		if rx.MedicineName == "" {
			rx.MedicineName = med.Name
		}
		if rx.GenericName == "" {
			rx.GenericName = med.GenericName
		}
		if rx.Category == "" {
			rx.Category = med.Category
		}
		rx.Quantity = qty
		rx.UnitPrice = unitPrice

		resolvedRx = append(resolvedRx, resolvedPrescription{item: rx, med: med})
	}

	rxItems := make([]dto.PrescriptionItemDTO, 0, len(resolvedRx))
	for _, r := range resolvedRx {
		rxItems = append(rxItems, r.item)
	}
	if rxJSON, err := json.Marshal(rxItems); err == nil {
		exam.PrescriptionDetail = string(rxJSON)
	}

	// เอกสารที่แพทย์สั่งออก (ใบรับรองแพทย์ / ใบรับรองยานอกบัญชี)
	//
	// เช็ค nil ไม่ใช่ len == 0 เพราะสองกรณีนี้ต่างกัน
	//   nil        = หน้าจอเวอร์ชันเก่าไม่ได้ส่งฟิลด์นี้มา ต้องคงค่าเดิมไว้
	//   array ว่าง = แพทย์เอาติ๊กออกหมดจริงๆ ต้องล้างค่าเดิม
	// ถ้าเช็ค len == 0 อย่างเดียว การเอาติ๊กออกจะไม่มีผล เพราะเข้าเงื่อนไขเดียวกับ nil
	if req.IssuedDocuments != nil {
		cleanDocs := make([]dto.IssuedDocumentDTO, 0, len(req.IssuedDocuments))
		for _, doc := range req.IssuedDocuments {
			docType := strings.TrimSpace(doc.Type)
			if docType == "" {
				continue
			}
			// หนีบจำนวนให้อยู่ในช่วงที่สมเหตุสมผล กันค่าจาก client ที่ถูกแก้มา
			if doc.Quantity < 1 {
				doc.Quantity = 1
			}
			if doc.Quantity > 20 {
				doc.Quantity = 20
			}
			doc.Type = docType
			doc.Name = strings.TrimSpace(doc.Name)

			// เอกสารชนิด "other" ต้องมีชื่อ ไม่งั้นบันทึกไปก็ไม่รู้ว่าเอกสารอะไร
			// ข้ามไปเลยดีกว่าเก็บแถวที่อ่านไม่รู้เรื่อง
			if doc.Type == "other" && doc.Name == "" {
				continue
			}

			cleanDocs = append(cleanDocs, doc)
		}

		if docJSON, err := json.Marshal(cleanDocs); err == nil {
			exam.IssuedDocuments = string(docJSON)
		}
	}

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

		// ส่งใบสั่งยาต่อห้องยา ทำเฉพาะตอนเซ็นปิดเคสเท่านั้น
		//
		// รายการยาถูกจับคู่กับคลังยาไปแล้วตั้งแต่ก่อนเข้าทรานแซกชัน (ตัวแปร resolvedRx)
		// ตรงนี้จึงไม่ต้องค้นยาซ้ำอีก แค่เขียนลงตาราง dispensings กับสร้างคิวห้องยา
		//
		// เหตุผลที่แยกจากการเก็บ prescription_detail:
		// dispensings คือ "ของจริงที่ห้องยาจะจ่าย" ใบร่างที่แพทย์ยังแก้ได้ต้องไม่หลุดมาถึงนี่
		// ส่วนประวัติของแพทย์อ่านจาก prescription_detail ซึ่งเขียนทุกครั้งที่กดบันทึก
		config.DB.Where("visit_id = ?", visit.ID).Delete(&models.Dispensing{})
		var medList []gin.H

		for _, r := range resolvedRx {
			p := r.item
			med := r.med

			disp := models.Dispensing{
				VisitID:      visit.ID,
				MedicineID:   p.MedicineID,
				DoctorID:     doctorID,
				Quantity:     p.Quantity,
				Dosage:       p.Dosage,
				Instructions: p.Instructions,
			}
			config.DB.Create(&disp)
			prescriptionCount++

			cat := p.Category
			if cat == "" {
				cat = "ยาสามัญ"
			}
			props := med.Properties
			if props == "" {
				props = "บรรเทาอาการตามแพทย์สั่ง"
			}

			medList = append(medList, gin.H{
				"medId":        p.MedicineCode,
				"name":         p.MedicineName,
				"genericName":  p.GenericName,
				"category":     cat,
				"properties":   props,
				"dosage":       p.Dosage,
				"instructions": p.Instructions,
				"price":        p.UnitPrice,
				"quantity":     p.Quantity,
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

		PrescriptionCount:  prescriptionCount,
		UnmatchedMedicines: unmatchedMedicines,
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

	// ==========================================================================
	// ดึงข้อมูลประกอบของทุกการมาตรวจเป็นก้อนเดียว ก่อนเข้าลูป
	// ==========================================================================
	// เดิมในลูปยิง query แยกต่อการมาตรวจ 1 ครั้งถึง 6 ชุด
	//   การวินิจฉัยหลัก / การวินิจฉัยรอง / ผลคัดกรอง / บันทึกการตรวจ / ยาที่จ่าย / คิว
	// ผู้ป่วยที่มาตรวจครบ 50 ครั้ง (เพดานของ endpoint นี้) จึงยิงถึง 300 query
	// ต่อการกดดูประวัติผู้ป่วยหนึ่งคน ซึ่งบน Supabase คือรอราว 12 วินาที
	//
	// เปลี่ยนเป็นดึงทีเดียวด้วย WHERE visit_id IN (?) แล้วจับคู่ในหน่วยความจำ
	// เหลือ 6 query คงที่ ไม่ว่าผู้ป่วยจะเคยมาตรวจกี่ครั้ง
	visitIDs := make([]uint, 0, len(visits))
	for _, v := range visits {
		visitIDs = append(visitIDs, v.ID)
	}

	// เวลาอ้างอิงตัวเดียวกันทั้งหน้า ใช้ตัดสินว่าการมาตรวจครั้งไหน "ข้ามวันมาแล้ว"
	// ถ้าเรียก time.Now() ใหม่ทุกแถว แถวที่ประมวลผลคาบเที่ยงคืนพอดีจะได้คนละคำตอบ
	now := time.Now()

	primaryDiagByVisit := make(map[uint]models.Diagnosis, len(visitIDs))
	secondaryDiagByVisit := make(map[uint][]models.Diagnosis, len(visitIDs))
	screeningByVisit := make(map[uint]models.Screening, len(visitIDs))
	examByVisit := make(map[uint]models.Examination, len(visitIDs))
	dispensingByVisit := make(map[uint][]models.Dispensing, len(visitIDs))
	queueByVisit := make(map[uint]models.Queue, len(visitIDs))
	medQueueByVisit := make(map[uint]models.MedicineQueue, len(visitIDs))
	billQueueByVisit := make(map[uint]models.BillingQueue, len(visitIDs))
	billingByVisit := make(map[uint]models.Billing, len(visitIDs))

	if len(visitIDs) > 0 {
		// การวินิจฉัยทั้งหลักและรอง ดึงมาก้อนเดียวแล้วค่อยแยกทีหลัง
		var allDiagnoses []models.Diagnosis
		config.DB.Where("visit_id IN ?", visitIDs).
			Order("is_primary desc, sort_order asc, id asc").
			Find(&allDiagnoses)
		for _, d := range allDiagnoses {
			if d.IsPrimary {
				if _, exists := primaryDiagByVisit[d.VisitID]; !exists {
					primaryDiagByVisit[d.VisitID] = d
				}
				continue
			}
			secondaryDiagByVisit[d.VisitID] = append(secondaryDiagByVisit[d.VisitID], d)
		}

		// ผลคัดกรองล่าสุดของแต่ละครั้ง (DISTINCT ON เป็นไวยากรณ์ของ PostgreSQL)
		var screenings []models.Screening
		config.DB.Raw(`
			SELECT DISTINCT ON (visit_id) *
			FROM screenings
			WHERE visit_id IN ?
			ORDER BY visit_id, id DESC
		`, visitIDs).Scan(&screenings)
		for _, sc := range screenings {
			screeningByVisit[sc.VisitID] = sc
		}

		// บันทึกการตรวจ มีได้ใบเดียวต่อการมาตรวจหนึ่งครั้ง
		var exams []models.Examination
		config.DB.Where("visit_id IN ?", visitIDs).Find(&exams)
		for _, e := range exams {
			examByVisit[e.VisitID] = e
		}

		// ยาที่จ่ายจริง Preload ชื่อยาไปด้วยในคราวเดียว
		var dispensings []models.Dispensing
		config.DB.Preload("Medicine").
			Where("visit_id IN ?", visitIDs).
			Order("id asc").
			Find(&dispensings)
		for _, d := range dispensings {
			dispensingByVisit[d.VisitID] = append(dispensingByVisit[d.VisitID], d)
		}

		// คิวล่าสุด ใช้อ่านเหตุผลการยกเลิกจากช่อง note
		var queues []models.Queue
		config.DB.Raw(`
			SELECT DISTINCT ON (visit_id) *
			FROM queues
			WHERE visit_id IN ?
			ORDER BY visit_id, id DESC
		`, visitIDs).Scan(&queues)
		// Queue.VisitID เป็น *uint (คิวที่ยังไม่ผูกกับการมาตรวจจะเป็น nil)
		// ต้องเช็คก่อน deref ไม่งั้น panic ตอนเจอคิวที่ยังไม่มี visit
		for _, q := range queues {
			if q.VisitID != nil {
				queueByVisit[*q.VisitID] = q
			}
		}

		// ---- สถานะปลายทางของแต่ละครั้ง: ห้องยาและการเงิน ----
		//
		// 3 ตารางนี้เป็นของ role ห้องยาและการเงิน ฝั่งแพทย์ "อ่านอย่างเดียว"
		// ไม่มีการเขียนหรือแก้ไขใดๆ เพื่อบอกว่าการมาตรวจครั้งนั้นจบกระบวนการหรือยัง
		var medQueues []models.MedicineQueue
		config.DB.Where("visit_id IN ?", visitIDs).Find(&medQueues)
		for _, m := range medQueues {
			medQueueByVisit[m.VisitID] = m
		}

		var billQueues []models.BillingQueue
		config.DB.Where("visit_id IN ?", visitIDs).Find(&billQueues)
		for _, b := range billQueues {
			billQueueByVisit[b.VisitID] = b
		}

		var billings []models.Billing
		config.DB.Where("visit_id IN ?", visitIDs).Find(&billings)
		for _, b := range billings {
			billingByVisit[b.VisitID] = b
		}
	}

	items := make([]gin.H, 0, len(visits))
	for _, v := range visits {
		visitDate, visitTime := splitVisitDateTime(v.VisitDate)

		// การวินิจฉัยหลักของครั้งนั้น
		diagnosis, icdCode := "", ""
		if d, ok := primaryDiagByVisit[v.ID]; ok {
			diagnosis = d.NameTH
			if diagnosis == "" {
				diagnosis = d.NameEN
			}
			icdCode = d.ICDCode
		}

		// การวินิจฉัยรอง (ถ้ามี)
		var secondary []gin.H
		for _, o := range secondaryDiagByVisit[v.ID] {
			name := o.NameTH
			if name == "" {
				name = o.NameEN
			}
			secondary = append(secondary, gin.H{"code": o.ICDCode, "name": name})
		}

		// สัญญาณชีพและอาการสำคัญจากการคัดกรองครั้งนั้น
		var vitals gin.H
		chiefComplaint := ""
		if s, ok := screeningByVisit[v.ID]; ok {
			chiefComplaint = s.ChiefComplaint
			vitals = gin.H{
				"bp":     formatBP(s.SystolicBP, s.DiastolicBP),
				"pulse":  s.HeartRate,
				"temp":   s.Temperature,
				"weight": s.Weight,
				"spo2":   s.SpO2,
			}
		}

		// บันทึกของแพทย์ครั้งนั้น
		//
		// เดิมดึงมาแค่วันนัดติดตามอาการ ทำให้ประวัติย้อนหลังบอกได้แค่
		// "วันนั้นวินิจฉัยว่าเป็นอะไร" แต่ไม่รู้ว่ารักษาอย่างไรและสั่งยาอะไรไป
		// ซึ่งเป็นข้อมูลที่แพทย์ต้องใช้ตอนผู้ป่วยกลับมาตรวจซ้ำ
		var followUp, followUpReason, followUpInstructions string
		var treatmentPlan, proceduresPerformed string
		var assessmentNotes, clinicalNotes string
		var presentIllness, complaintDuration string
		var physicalExam, counseling gin.H
		e := examByVisit[v.ID]
		if e.ID > 0 {
			followUp = formatDateOnly(e.FollowUpDate)
			followUpReason = e.FollowUpReason
			followUpInstructions = e.FollowUpInstructions
			treatmentPlan = e.TreatmentPlan
			proceduresPerformed = e.ProceduresPerformed
			assessmentNotes = e.AssessmentNotes
			clinicalNotes = e.ClinicalNotes
			presentIllness = e.PresentIllness
			complaintDuration = e.ComplaintDuration

			// ผลตรวจร่างกาย 8 ระบบ ส่งไปทั้งชุด ฝั่งหน้าจอค่อยซ่อนช่องที่ว่างเอง
			// ต้องมีในประวัติ เพราะเป็นสิ่งที่แพทย์ตรวจพบด้วยตัวเองในวันนั้น
			// ซึ่งใช้เทียบว่าอาการดีขึ้นหรือแย่ลงตอนผู้ป่วยกลับมาครั้งถัดไป
			physicalExam = gin.H{
				"generalAppearance": e.PEGeneral,
				"heent":             e.PEHeent,
				"cardiovascular":    e.PECardiovascular,
				"respiratory":       e.PERespiratory,
				"abdomen":           e.PEAbdomen,
				"musculoskeletal":   e.PEMusculoskeletal,
				"neurological":      e.PENeurological,
				"skin":              e.PESkin,
			}

			// คำแนะนำ 5 ด้าน ส่งแยกทีละช่อง ไม่รวมเป็นข้อความเดียว
			// เพื่อให้หน้าประวัติวางเป็นช่องหัวข้อได้เหมือนหน้าบันทึกการตรวจ
			counseling = gin.H{
				"medicationAdvice": e.AdviceMedication,
				"dietAdvice":       e.AdviceDiet,
				"exerciseAdvice":   e.AdviceExercise,
				"lifestyleAdvice":  e.AdviceLifestyle,
				"diseaseEducation": e.AdviceDiseaseEdu,
			}
		}

		// ยาที่สั่งจ่ายในครั้งนั้น
		//
		// อ่าน 2 ที่ เรียงตามความครบถ้วนของข้อมูล
		//   1. examinations.prescription_detail  ใบสั่งยาฉบับเต็มของแพทย์ (JSON)
		//      มีครบทุกช่องที่แพทย์กรอก ความถี่ ระยะเวลา ทางให้ยา เวลารับประทาน คำแนะนำพิเศษ
		//   2. ตาราง dispensings ของห้องยา  ใช้เป็นตัวสำรอง
		//      สำหรับเวชระเบียนเก่าที่บันทึกไว้ก่อนจะมีช่อง prescription_detail
		//      ข้อมูลจะไม่ครบ เหลือแค่ ยา + ขนาด + จำนวน + วิธีใช้รวมเป็นข้อความเดียว
		//
		// ห้ามสลับลำดับนี้ ถ้าเอา dispensings ขึ้นก่อน ข้อมูลใหม่จะถูกทับด้วยข้อมูลที่ครบน้อยกว่า
		prescriptions := make([]gin.H, 0)

		if strings.TrimSpace(e.PrescriptionDetail) != "" {
			var saved []dto.PrescriptionItemDTO
			if err := json.Unmarshal([]byte(e.PrescriptionDetail), &saved); err == nil {
				for i, p := range saved {
					id := p.ID
					if id == "" {
						id = fmt.Sprintf("rx-%d", i+1)
					}
					prescriptions = append(prescriptions, gin.H{
						"id":                  id,
						"medicineId":          p.MedicineID,
						"medicineCode":        p.MedicineCode,
						"medicineName":        p.MedicineName,
						"genericName":         p.GenericName,
						"category":            p.Category,
						"dosage":              p.Dosage,
						"frequency":           p.Frequency,
						"duration":            p.Duration,
						"quantity":            p.Quantity,
						"unitPrice":           p.UnitPrice,
						"route":               p.Route,
						"timing":              p.Timing,
						"specialInstructions": p.SpecialInstructions,
						"instructions":        p.Instructions,
					})
				}
			}
		}

		if len(prescriptions) == 0 {
			{
				for _, d := range dispensingByVisit[v.ID] {
					prescriptions = append(prescriptions, gin.H{
						"id":           fmt.Sprintf("rx-%d", d.ID),
						"medicineId":   d.MedicineID,
						"medicineCode": d.Medicine.MedicineCode,
						"medicineName": d.Medicine.Name,
						"dosage":       d.Dosage,
						"quantity":     d.Quantity,
						"unitPrice":    d.Medicine.UnitPrice,
						"instructions": d.Instructions,
					})
				}
			}
		}

		// เหตุผลการยกเลิก เก็บอยู่ในช่อง note ของคิว ไม่ได้อยู่ในตาราง visit
		cancelReason := ""
		if normalizeVisitStatus(v.Status) == models.VisitStatusCancelled {
			if q, ok := queueByVisit[v.ID]; ok {
				cancelReason = q.Note
			}
		}

		mq, hasMQ := medQueueByVisit[v.ID]
		bq, hasBQ := billQueueByVisit[v.ID]
		bill, hasBill := billingByVisit[v.ID]

		var mqPtr *models.MedicineQueue
		if hasMQ {
			mqPtr = &mq
		}
		var bqPtr *models.BillingQueue
		if hasBQ {
			bqPtr = &bq
		}
		var billPtr *models.Billing
		if hasBill {
			billPtr = &bill
		}

		progress, progressReason := computeVisitProgress(v, mqPtr, bqPtr, billPtr, now)

		items = append(items, gin.H{
			"id":                   v.ID,
			"vn":                   v.VN,
			"visitDate":            visitDate,
			"visitTime":            visitTime,
			"doctorName":           v.Doctor.FullName,
			"department":           v.Department,
			"chiefComplaint":       chiefComplaint,
			"presentIllness":       presentIllness,
			"complaintDuration":    complaintDuration,
			"physicalExam":         physicalExam,
			"diagnosis":            diagnosis,
			"icdCode":              icdCode,
			"secondaryDiagnoses":   secondary,
			"treatmentPlan":        treatmentPlan,
			"proceduresPerformed":  proceduresPerformed,
			"assessmentNotes":      assessmentNotes,
			"clinicalNotes":        clinicalNotes,
			"counseling":           counseling,
			"prescriptions":        prescriptions,
			"vitals":               vitals,
			"followUpDate":         followUp,
			"followUpReason":       followUpReason,
			"followUpInstructions": followUpInstructions,
			"cancelReason":         cancelReason,
			"status":               normalizeVisitStatus(v.Status),
			"progress":             progress,
			"progressReason":       progressReason,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"patient_id": uint(patientID),
		"history":    items,
	})
}

// ==============================================================================
// computeVisitProgress - สรุปว่าการมาตรวจครั้งนั้น "จบกระบวนการ" หรือยัง
// ==============================================================================
// ต่างจากช่อง status ของ visit ตรงที่ status บอกแค่สถานะ "ฝั่งแพทย์"
// (รอตรวจ / กำลังตรวจ / ตรวจเสร็จ) ซึ่งจบแค่ตอนแพทย์ปิดเคส
// แต่ในมุมของผู้ป่วย ยังต้องรับยาที่ห้องยาและชำระเงินที่การเงินก่อนถึงจะจบจริง
//
// คืนค่า 2 ตัว
//
//	progress       completed | in_progress | cancelled
//	progressReason เหตุผลของการยกเลิก ใช้เลือกข้อความบนหน้าจอ
//	               doctor_cancelled แพทย์กดยกเลิกการรับบริการเอง
//	               expired          ค้างที่รอคัดกรอง/รอตรวจ จนข้ามวัน
//	               no_medicine      แพทย์ตรวจจบแล้ว แต่ไม่ได้มารับยา จนข้ามวัน
//	               unpaid           รับยาแล้ว แต่ไม่ได้ชำระเงิน จนข้ามวัน
//
// เกณฑ์ "หมดเวลา" ใช้การข้ามไปวันใหม่ ไม่ได้ผูกกับเวลาปิดทำการของคลินิก
// เพราะเวลาปิดยังไม่ได้ตั้งไว้ในระบบ ถ้าวันหลังมีค่านั้นแล้วให้แก้เงื่อนไข
// isSameDay ตรงนี้จุดเดียว ที่เหลือไม่ต้องแตะ
func computeVisitProgress(
	v models.VisitRecord,
	mq *models.MedicineQueue,
	bq *models.BillingQueue,
	bill *models.Billing,
	now time.Time,
) (string, string) {
	status := normalizeVisitStatus(v.Status)

	// แพทย์กดยกเลิกเอง ถือเป็นที่สิ้นสุด ไม่ต้องดูขั้นตอนอื่นต่อ
	if status == models.VisitStatusCancelled {
		return "cancelled", "doctor_cancelled"
	}

	// ชำระเงินแล้ว = จบครบทุกกระบวนการ
	// ดู 2 ที่เพราะการเงินมีทั้งคิว (billing_queues) และใบเสร็จ (billings)
	// บางเคสจบที่ตารางเดียว ถ้าดูที่เดียวจะพลาดเคสที่จบจริงไปเป็น "กำลังดำเนินการ"
	paid := false
	if bq != nil && strings.EqualFold(strings.TrimSpace(bq.Status), "paid") {
		paid = true
	}
	if bill != nil && strings.EqualFold(strings.TrimSpace(bill.PaymentStatus), "paid") {
		paid = true
	}
	if paid {
		return "completed", ""
	}

	// ยังอยู่ในวันเดียวกัน = กระบวนการยังเดินอยู่ตามปกติ ยังไม่ถือว่าตกหล่น
	visitDay := v.VisitDate
	if visitDay.IsZero() {
		visitDay = v.CreatedAt
	}
	if isSameDay(visitDay, now) {
		return "in_progress", ""
	}

	// ข้ามวันมาแล้วแต่ยังไม่จบ = ตกหล่นระหว่างทาง ดูว่าค้างอยู่ขั้นไหน
	if status != models.VisitStatusCompleted {
		// ยังไม่ถึงมือแพทย์ หรือแพทย์ยังตรวจไม่จบ
		return "cancelled", "expired"
	}

	// แพทย์ตรวจจบแล้ว เหลือดูว่าได้รับยาหรือยัง
	// การมีคิวการเงินอยู่แล้ว แปลว่าห้องยาส่งต่อมาให้แล้ว = ได้รับยาแน่นอน
	dispensed := bq != nil
	if mq != nil {
		st := strings.ToLower(strings.TrimSpace(mq.Status))
		if st == "dispensed" || st == "completed" || st == "done" {
			dispensed = true
		}
	}
	if !dispensed {
		return "cancelled", "no_medicine"
	}

	return "cancelled", "unpaid"
}

// isSameDay - อยู่วันเดียวกันตามเวลาท้องถิ่นหรือไม่
func isSameDay(a, b time.Time) bool {
	ay, am, ad := a.Local().Date()
	by, bm, bd := b.Local().Date()
	return ay == by && am == bm && ad == bd
}
