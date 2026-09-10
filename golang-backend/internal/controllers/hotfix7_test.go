package controllers_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"clinic-backend/internal/config"
	"clinic-backend/internal/controllers"
	"clinic-backend/internal/models"
	"clinic-backend/internal/testutils"

	"github.com/gin-gonic/gin"
)

func setupHotfix7Router() *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(gin.Recovery())
	r.PUT("/api/doctor/visits/:id/examination", func(c *gin.Context) {
		var u models.User
		config.DB.Where("role = ?", "doctor").Order("id asc").First(&u)
		c.Set("userID", float64(u.ID))
		controllers.SaveExamination(c)
	})
	return r
}

type testPatientVisitQueue struct {
	patient models.Patient
	visit   models.VisitRecord
	queue   models.Queue
}

func createTestContext(t *testing.T, tag string) testPatientVisitQueue {
	t.Helper()
	db := config.DB

	var docUser models.User
	if err := db.Where("role = ?", "doctor").Order("id asc").First(&docUser).Error; err != nil {
		t.Fatalf("need doctor user: %v", err)
	}
	docID := docUser.ID

	hn := fmt.Sprintf("HN%04X", (time.Now().UnixNano()%0xEE00)+0x100)
	natID := fmt.Sprintf("H7%X", time.Now().UnixNano()%0xFFFFFFFF)
	patient := models.Patient{
		HN:         hn,
		FullName:   "ทดสอบ HOTFIX7 " + tag,
		Gender:     "male",
		BirthDate:  time.Now().AddDate(-35, 0, 0),
		NationalID: natID,
	}
	if err := db.Create(&patient).Error; err != nil {
		t.Fatalf("create patient: %v", err)
	}

	visit := models.VisitRecord{
		PatientID: patient.ID,
		DoctorID:  docID,
		Status:    "examining",
		VisitDate: time.Now(),
	}
	if err := db.Create(&visit).Error; err != nil {
		t.Fatalf("create visit: %v", err)
	}

	qNum := fmt.Sprintf("Q%04X", (time.Now().UnixNano()%0xEE00)+0x100)
	var queue models.Queue
	insertSQL := "INSERT INTO queues (patient_id,created_by_user_id,assigned_doctor_id,queue_number,service_date,status,department,visit_id) VALUES (?,?,?,?,?,?,?,?)"
	if err := db.Exec(insertSQL, patient.ID, docUser.ID, docID, qNum, time.Now(), "กำลังตรวจ", "ห้องตรวจ 1 (พญ.สุดา)", &visit.ID).Error; err != nil {
		t.Fatalf("insert queue: %v", err)
	}
	if err := db.Where("queue_number = ?", qNum).First(&queue).Error; err != nil {
		t.Fatalf("fetch queue: %v", err)
	}

	return testPatientVisitQueue{patient: patient, visit: visit, queue: queue}
}

func cleanupTestContext(ctx testPatientVisitQueue) {
	db := config.DB
	db.Unscoped().Where("queue_number = ?", ctx.queue.QueueNumber).Delete(&models.Queue{})
	db.Unscoped().Where("visit_id = ?", ctx.visit.ID).Delete(&models.Diagnosis{})
	db.Unscoped().Where("visit_id = ?", ctx.visit.ID).Delete(&models.Billing{})
	db.Unscoped().Where("visit_id = ?", ctx.visit.ID).Delete(&models.BillingQueue{})
	db.Unscoped().Where("visit_id = ?", ctx.visit.ID).Delete(&models.MedicineQueue{})
	db.Unscoped().Where("visit_id = ?", ctx.visit.ID).Delete(&models.Dispensing{})
	db.Unscoped().Where("visit_id = ?", ctx.visit.ID).Delete(&models.BillingHistory{})
	db.Unscoped().Where("visit_id = ?", ctx.visit.ID).Delete(&models.Examination{})
	db.Unscoped().Where("id = ?", ctx.visit.ID).Delete(&models.VisitRecord{})
	db.Unscoped().Delete(&ctx.patient)
}

// TestHOTFIX7_CaseB1_NoPrescriptions — เคสไม่สั่งยาเลย
// queue.status -> "รอชำระเงิน", department -> "ห้องการเงิน (แคชเชียร์)", ไม่มี MedicineQueue
func TestHOTFIX7_CaseB1_NoPrescriptions(t *testing.T) {
	testutils.GuardAgainstSupabaseProduction(t)
	config.ConnectDB()
	db := config.DB

	ctx := createTestContext(t, "B1 No Rx")
	defer cleanupTestContext(ctx)

	r := setupHotfix7Router()

	body, _ := json.Marshal(map[string]interface{}{
		"action": "sign",
		"primaryDiagnosis": map[string]interface{}{
			"code":      "Z00.0",
			"name":      "General Medical Examination",
			"localName": "การตรวจสุขภาพทั่วไป",
		},
		"assessmentNotes": "ร่างกายแข็งแรงดี ไม่จำเป็นต้องรับประทานยา",
		"prescriptions":   []interface{}{}, // No prescriptions!
	})

	req, _ := http.NewRequest("PUT", fmt.Sprintf("/api/doctor/visits/%d/examination", ctx.visit.ID), bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("HTTP %d: %s", w.Code, w.Body.String())
	}

	var q models.Queue
	db.First(&q, ctx.queue.ID)
	t.Logf("[B1 Result] Queue => status=%q department=%q", q.Status, q.Department)

	if q.Status != "รอชำระเงิน" {
		t.Errorf("B1 status: got %q, want 'รอชำระเงิน'", q.Status)
	}
	if !strings.HasPrefix(q.Department, "ห้องการเงิน") {
		t.Errorf("B1 department: got %q, want prefix 'ห้องการเงิน'", q.Department)
	}

	var mqCount int64
	db.Model(&models.MedicineQueue{}).Where("visit_id = ?", ctx.visit.ID).Count(&mqCount)
	t.Logf("[B1 Result] MedicineQueue count in DB = %d (Expected: 0)", mqCount)
	if mqCount != 0 {
		t.Errorf("B1 MedicineQueue: got %d rows, want 0", mqCount)
	}
}

// TestHOTFIX7_CaseB2_NormalPrescriptions — เคสสั่งยาปกติที่ match คลังยาได้
// queue.status -> "รอรับยา", department -> "ห้องจ่ายยาและเภสัชกรรม", มี MedicineQueue
func TestHOTFIX7_CaseB2_NormalPrescriptions(t *testing.T) {
	testutils.GuardAgainstSupabaseProduction(t)
	config.ConnectDB()
	db := config.DB

	// Ensure at least 1 medicine in DB
	var med models.Medicine
	if err := db.First(&med).Error; err != nil {
		med = models.Medicine{
			MedicineCode:  "MED-TEST-01",
			Name:          "Paracetamol 500mg",
			GenericName:   "Paracetamol",
			StockQuantity: 100,
			UnitPrice:     15.0,
		}
		db.Create(&med)
	}

	ctx := createTestContext(t, "B2 Normal Rx")
	defer cleanupTestContext(ctx)

	r := setupHotfix7Router()

	body, _ := json.Marshal(map[string]interface{}{
		"action": "sign",
		"primaryDiagnosis": map[string]interface{}{
			"code":      "J00",
			"name":      "Acute nasopharyngitis [common cold]",
			"localName": "ไข้หวัด",
		},
		"assessmentNotes": "ไข้หวัดธรรมดา จ่ายยาลดไข้",
		"prescriptions": []map[string]interface{}{
			{
				"medicine_id":   med.ID,
				"medicine_code": med.MedicineCode,
				"name":          med.Name,
				"dosage":        "1 เม็ด ทุก 4-6 ชม.",
				"instructions":  "รับประทานหลังอาหาร",
				"quantity":      10,
				"unit_price":    med.UnitPrice,
			},
		},
	})

	req, _ := http.NewRequest("PUT", fmt.Sprintf("/api/doctor/visits/%d/examination", ctx.visit.ID), bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("HTTP %d: %s", w.Code, w.Body.String())
	}

	var q models.Queue
	db.First(&q, ctx.queue.ID)
	t.Logf("[B2 Result] Queue => status=%q department=%q", q.Status, q.Department)

	if q.Status != "รอรับยา" {
		t.Errorf("B2 status: got %q, want 'รอรับยา'", q.Status)
	}
	if !strings.HasPrefix(q.Department, "ห้องจ่ายยา") {
		t.Errorf("B2 department: got %q, want prefix 'ห้องจ่ายยา'", q.Department)
	}

	var mq models.MedicineQueue
	err := db.Where("visit_id = ?", ctx.visit.ID).First(&mq).Error
	if err != nil {
		t.Fatalf("B2 MedicineQueue not created in DB: %v", err)
	}
	t.Logf("[B2 Result] MedicineQueue => id=%d status=%q medications=%s", mq.ID, mq.Status, mq.Medications)
	if mq.Status != "pending" {
		t.Errorf("B2 MedicineQueue status: got %q, want 'pending'", mq.Status)
	}
}

// TestHOTFIX7_CaseB3_UnmatchedPrescriptions — เคสสั่งยาแต่จับคู่คลังไม่เจอ
// queue.status ต้องยังเป็น "รอรับยา" (ห้ามข้ามห้องยา!), MedicineQueue ต้องถูกสร้าง
func TestHOTFIX7_CaseB3_UnmatchedPrescriptions(t *testing.T) {
	testutils.GuardAgainstSupabaseProduction(t)
	config.ConnectDB()
	db := config.DB

	ctx := createTestContext(t, "B3 Unmatched Rx")
	defer cleanupTestContext(ctx)

	r := setupHotfix7Router()

	body, _ := json.Marshal(map[string]interface{}{
		"action": "sign",
		"primaryDiagnosis": map[string]interface{}{
			"code":      "R50.9",
			"name":      "Fever, unspecified",
			"localName": "ไข้ ไม่ระบุสาเหตุ",
		},
		"assessmentNotes": "สั่งยานอกบัญชีพิเศษ",
		"prescriptions": []map[string]interface{}{
			{
				"medicine_id":   0,
				"medicine_code": "NON-EXISTENT-CODE-9999",
				"name":          "SpecialCustomMedicationDoesNotExist 999mg",
				"dosage":        "1 cap daily",
				"instructions":  "ทานก่อนนอน",
				"quantity":      5,
				"unit_price":    100.0,
			},
		},
	})

	req, _ := http.NewRequest("PUT", fmt.Sprintf("/api/doctor/visits/%d/examination", ctx.visit.ID), bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("HTTP %d: %s", w.Code, w.Body.String())
	}

	var q models.Queue
	db.First(&q, ctx.queue.ID)
	t.Logf("[B3 Result] Queue => status=%q department=%q", q.Status, q.Department)

	// B3 MUST NOT skip pharmacy
	if q.Status != "รอรับยา" {
		t.Errorf("B3 status: got %q, want 'รอรับยา' (MUST NOT skip pharmacy on unmatched rx)", q.Status)
	}
	if !strings.HasPrefix(q.Department, "ห้องจ่ายยา") {
		t.Errorf("B3 department: got %q, want prefix 'ห้องจ่ายยา'", q.Department)
	}

	var mq models.MedicineQueue
	err := db.Where("visit_id = ?", ctx.visit.ID).First(&mq).Error
	if err != nil {
		t.Fatalf("B3 MedicineQueue not created in DB for pharmacist: %v", err)
	}
	t.Logf("[B3 Result] MedicineQueue => id=%d status=%q medications=%s", mq.ID, mq.Status, mq.Medications)
	if mq.Status != "pending" {
		t.Errorf("B3 MedicineQueue status: got %q, want 'pending'", mq.Status)
	}
}

// TestHOTFIX7_CaseC_ChangeMindRegression — เคสร่างมียา -> ลบยาออกหมดก่อนเซ็นปิดเคส
// MedicineQueue เดิมต้องถูก DELETE ออก และ status ไป "รอชำระเงิน"
func TestHOTFIX7_CaseC_ChangeMindRegression(t *testing.T) {
	testutils.GuardAgainstSupabaseProduction(t)
	config.ConnectDB()
	db := config.DB

	var med models.Medicine
	db.First(&med)

	ctx := createTestContext(t, "C Change Mind")
	defer cleanupTestContext(ctx)

	r := setupHotfix7Router()

	// 1. แพทย์บันทึกร่างฉบับแรก (มียา)
	draftBody, _ := json.Marshal(map[string]interface{}{
		"action": "save",
		"primaryDiagnosis": map[string]interface{}{
			"code":      "R50.9",
			"name":      "Fever",
			"localName": "มีไข้",
		},
		"prescriptions": []map[string]interface{}{
			{
				"medicine_id":   med.ID,
				"medicine_code": med.MedicineCode,
				"name":          med.Name,
				"dosage":        "1 tab",
				"quantity":      10,
			},
		},
	})
	req1, _ := http.NewRequest("PUT", fmt.Sprintf("/api/doctor/visits/%d/examination", ctx.visit.ID), bytes.NewBuffer(draftBody))
	req1.Header.Set("Content-Type", "application/json")
	w1 := httptest.NewRecorder()
	r.ServeHTTP(w1, req1)
	if w1.Code != http.StatusOK {
		t.Fatalf("Draft save HTTP %d: %s", w1.Code, w1.Body.String())
	}

	// จำลองว่ามี MedicineQueue ค้างอยู่จากระบบเดิมหรือร่าง
	dummyMQ := models.MedicineQueue{
		QueueNumber: ctx.queue.QueueNumber,
		HN:          ctx.patient.HN,
		PatientName: ctx.patient.FullName,
		VisitID:     ctx.visit.ID,
		Status:      "pending",
		Medications: `[{"name":"Draft Med"}]`,
	}
	db.Create(&dummyMQ)

	var beforeCount int64
	db.Model(&models.MedicineQueue{}).Where("visit_id = ?", ctx.visit.ID).Count(&beforeCount)
	t.Logf("[C Step 1] Before sign: MedicineQueue count = %d", beforeCount)

	// 2. แพทย์เปลี่ยนใจ ลบยาออกทั้งหมดแล้วกด Sign ปิดเคส
	signNoRxBody, _ := json.Marshal(map[string]interface{}{
		"action": "sign",
		"primaryDiagnosis": map[string]interface{}{
			"code":      "Z00.0",
			"name":      "General Medical Examination",
			"localName": "ตรวจร่างกายปกติ",
		},
		"assessmentNotes": "เปลี่ยนใจ ไม่จ่ายยา",
		"prescriptions":   []interface{}{}, // Empty rx!
	})
	req2, _ := http.NewRequest("PUT", fmt.Sprintf("/api/doctor/visits/%d/examination", ctx.visit.ID), bytes.NewBuffer(signNoRxBody))
	req2.Header.Set("Content-Type", "application/json")
	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, req2)
	if w2.Code != http.StatusOK {
		t.Fatalf("Sign no rx HTTP %d: %s", w2.Code, w2.Body.String())
	}

	// 3. ตรวจสอบว่าคิวเปลี่ยนเป็น "รอชำระเงิน"
	var q models.Queue
	db.First(&q, ctx.queue.ID)
	t.Logf("[C Result] Queue => status=%q department=%q", q.Status, q.Department)
	if q.Status != "รอชำระเงิน" {
		t.Errorf("C status: got %q, want 'รอชำระเงิน'", q.Status)
	}
	if !strings.HasPrefix(q.Department, "ห้องการเงิน") {
		t.Errorf("C department: got %q, want prefix 'ห้องการเงิน'", q.Department)
	}

	// 4. ตรวจสอบว่า MedicineQueue เดิมถูกลบออกเรียบร้อย
	var afterCount int64
	db.Model(&models.MedicineQueue{}).Where("visit_id = ?", ctx.visit.ID).Count(&afterCount)
	t.Logf("[C Result] After sign: MedicineQueue count in DB = %d (Expected: 0)", afterCount)
	if afterCount != 0 {
		t.Errorf("C MedicineQueue: lingering rows found (%d), want 0", afterCount)
	}
}
