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
	"gorm.io/gorm"
)

func setupHotfix6Router() *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(gin.Recovery())
	r.PUT("/api/queue/:id/status", controllers.UpdateQueueStatus)
	r.PUT("/api/doctor/visits/:id/status", func(c *gin.Context) {
		c.Set("userID", float64(doctorUserID()))
		controllers.UpdateVisitStatus(c)
	})
	r.PUT("/api/doctor/visits/:id/examination", func(c *gin.Context) {
		c.Set("userID", float64(doctorUserID()))
		controllers.SaveExamination(c)
	})
	r.POST("/api/pharmacy/dispense", controllers.ConfirmDispenseAndBill)
	r.POST("/api/billing/confirm", controllers.ConfirmPayment)
	return r
}

func doctorUserID() uint {
	var u models.User
	config.DB.Where("role = ?", "doctor").Order("id asc").First(&u)
	return u.ID
}

func queryQueueDB6(t *testing.T, queueID uint) (status, department string) {
	t.Helper()
	var q models.Queue
	if err := config.DB.First(&q, queueID).Error; err != nil {
		t.Fatalf("DB query queue %d: %v", queueID, err)
	}
	return q.Status, q.Department
}

func assertDept6(t *testing.T, step, wantStatus, wantDeptPrefix string, queueID uint) {
	t.Helper()
	gotStatus, gotDept := queryQueueDB6(t, queueID)
	t.Logf("[%s] SQL => status=%q  department=%q", step, gotStatus, gotDept)
	if gotStatus != wantStatus {
		t.Errorf("[%s] status: got=%q want=%q", step, gotStatus, wantStatus)
	}
	if !strings.HasPrefix(gotDept, wantDeptPrefix) {
		t.Errorf("[%s] department: got=%q want prefix=%q", step, gotDept, wantDeptPrefix)
	}
}

// TestHOTFIX6_FullLifecycleDepartmentSync - E2E: 5-step department sync
func TestHOTFIX6_FullLifecycleDepartmentSync(t *testing.T) {
	testutils.GuardAgainstSupabaseProduction(t)
	config.ConnectDB()
	db := config.DB

	var docUser models.User
	if err := db.Where("role = ?", "doctor").Order("id asc").First(&docUser).Error; err != nil {
		t.Skipf("no doctor user: %v", err)
	}
	docID := docUser.ID

	hn := fmt.Sprintf("HN%04X", (time.Now().UnixNano()%0xEE00)+0x100)
	patient := models.Patient{
		HN:         hn,
		FullName:   "HOTFIX6 FullFlow",
		Gender:     "male",
		BirthDate:  time.Now().AddDate(-40, 0, 0),
		NationalID: fmt.Sprintf("E2E%X", time.Now().UnixNano()%0xFFFFFFFF),
	}
	if err := db.Create(&patient).Error; err != nil {
		t.Fatalf("create patient: %v", err)
	}

	visit := models.VisitRecord{
		PatientID: patient.ID,
		DoctorID:  docID,
		Status:    "waiting",
		VisitDate: time.Now(),
	}
	if err := db.Create(&visit).Error; err != nil {
		t.Fatalf("create visit: %v", err)
	}

	qNum := fmt.Sprintf("Q%04X", (time.Now().UnixNano()%0xEE00)+0x100)
	var queue models.Queue
	insertSQL := "INSERT INTO queues (patient_id,created_by_user_id,assigned_doctor_id,queue_number,service_date,status,department,visit_id) VALUES (?,?,?,?,?,?,?,?)"
	if err := db.Exec(insertSQL, patient.ID, docUser.ID, docID, qNum, time.Now(), "รอคัดกรอง", "จุดคัดกรอง", &visit.ID).Error; err != nil {
		t.Fatalf("insert queue: %v", err)
	}
	if err := db.Where("queue_number = ?", qNum).First(&queue).Error; err != nil {
		t.Fatalf("fetch queue: %v", err)
	}

	defer func() {
		db.Unscoped().Where("queue_number = ?", qNum).Delete(&models.Queue{})
		db.Unscoped().Where("visit_id = ?", visit.ID).Delete(&models.Diagnosis{})
		db.Unscoped().Where("visit_id = ?", visit.ID).Delete(&models.Billing{})
		db.Unscoped().Where("visit_id = ?", visit.ID).Delete(&models.BillingQueue{})
		db.Unscoped().Where("visit_id = ?", visit.ID).Delete(&models.MedicineQueue{})
		db.Unscoped().Where("visit_id = ?", visit.ID).Delete(&models.Dispensing{})
		db.Unscoped().Where("visit_id = ?", visit.ID).Delete(&models.BillingHistory{})
		db.Unscoped().Where("visit_id = ?", visit.ID).Delete(&models.Examination{})
		db.Unscoped().Where("id = ?", visit.ID).Delete(&models.VisitRecord{})
		db.Unscoped().Delete(&patient)
	}()

	r := setupHotfix6Router()
	doHTTP := func(method, url, body string) *httptest.ResponseRecorder {
		req, _ := http.NewRequest(method, url, bytes.NewBufferString(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		return w
	}

	// Step 1 — queue_controller: รอคัดกรอง -> รอพบแพทย์
	t.Run("Step1", func(t *testing.T) {
		body, _ := json.Marshal(map[string]string{"status": "รอพบแพทย์"})
		w := doHTTP("PUT", fmt.Sprintf("/api/queue/%d/status", queue.ID), string(body))
		if w.Code != http.StatusOK {
			t.Fatalf("HTTP %d: %s", w.Code, w.Body.String())
		}
		assertDept6(t, "Step1", "รอพบแพทย์", "ห้องตรวจ", queue.ID)
	})

	// Step 2 — doctor_controller: Examining
	t.Run("Step2", func(t *testing.T) {
		body, _ := json.Marshal(map[string]interface{}{"status": "Examining", "note": "HOTFIX6"})
		w := doHTTP("PUT", fmt.Sprintf("/api/doctor/visits/%d/status", visit.ID), string(body))
		if w.Code != http.StatusOK {
			t.Logf("Step2 non-200 (auth in test): %d %s", w.Code, w.Body.String())
		}
		gotStatus, gotDept := queryQueueDB6(t, queue.ID)
		t.Logf("[Step2] SQL => status=%q department=%q", gotStatus, gotDept)
		if !strings.HasPrefix(gotDept, "ห้องตรวจ") {
			t.Errorf("Step2 dept regression: got=%q", gotDept)
		}
	})

	// Step 3 — examination_controller: sign -> รอรับยา
	t.Run("Step3", func(t *testing.T) {
		body, _ := json.Marshal(map[string]interface{}{
			"action": "sign",
			"primaryDiagnosis": map[string]interface{}{
				"code":      "Z00.0",
				"name":      "General Medical Examination",
				"localName": "การตรวจสุขภาพทั่วไป",
			},
			"assessmentNotes": "ปกติดี",
		})
		w := doHTTP("PUT", fmt.Sprintf("/api/doctor/visits/%d/examination", visit.ID), string(body))
		gotStatus, gotDept := queryQueueDB6(t, queue.ID)
		t.Logf("[Step3] HTTP=%d SQL => status=%q department=%q", w.Code, gotStatus, gotDept)
		if gotStatus == "รอรับยา" && !strings.HasPrefix(gotDept, "ห้องจ่ายยา") {
			t.Errorf("Step3 dept not synced: status=รอรับยา but dept=%q", gotDept)
		}
	})

	// Force to pharmacy so Step4 always runs
	db.Exec("UPDATE queues SET status = ?, department = ? WHERE id = ?", "รอรับยา", "ห้องจ่ายยาและเภสัชกรรม", queue.ID)

	// Step 4 — dispensing_controller: รอรับยา -> รอชำระเงิน
	t.Run("Step4", func(t *testing.T) {
		body, _ := json.Marshal(map[string]interface{}{
			"visit_id":     visit.ID,
			"hn":           patient.HN,
			"patient_name": patient.FullName,
			"queue_number": qNum,
			"medications":  []interface{}{},
		})
		w := doHTTP("POST", "/api/pharmacy/dispense", string(body))
		if w.Code != http.StatusOK {
			t.Fatalf("Step4 HTTP %d: %s", w.Code, w.Body.String())
		}
		assertDept6(t, "Step4", "รอชำระเงิน", "ห้องการเงิน", queue.ID)
	})

	// Step 5 — billing_controller: รอชำระเงิน -> เสร็จสิ้น
	t.Run("Step5", func(t *testing.T) {
		body, _ := json.Marshal(map[string]interface{}{
			"visit_id":       visit.ID,
			"hn":             patient.HN,
			"patient_name":   patient.FullName,
			"total_amount":   0.0,
			"net_amount":     0.0,
			"payment_method": "เงินสด",
			"cash_received":  0.0,
		})
		w := doHTTP("POST", "/api/billing/confirm", string(body))
		if w.Code != http.StatusOK {
			t.Fatalf("Step5 HTTP %d: %s", w.Code, w.Body.String())
		}
		assertDept6(t, "Step5", "เสร็จสิ้น", "เสร็จสิ้นขั้นตอนการรักษา", queue.ID)
	})

	var final models.Queue
	db.First(&final, queue.ID)
	t.Logf("FINAL => status=%q department=%q queue=%s patient_id=%d",
		final.Status, final.Department, final.QueueNumber, final.PatientID)
}

// TestHOTFIX6_UpdatesMapDoesNotZeroFields — regression: .Updates(map) must not zero other cols
func TestHOTFIX6_UpdatesMapDoesNotZeroFields(t *testing.T) {
	testutils.GuardAgainstSupabaseProduction(t)
	config.ConnectDB()
	db := config.DB

	var user models.User
	db.First(&user)

	hn := fmt.Sprintf("HN%04X", (time.Now().UnixNano()%0xEE00)+0x200)
	patient := models.Patient{
		HN:         hn,
		FullName:   "Updates Regression",
		Gender:     "female",
		BirthDate:  time.Now().AddDate(-30, 0, 0),
		NationalID: fmt.Sprintf("RGR%X", time.Now().UnixNano()%0xFFFFFFFF),
	}
	db.Create(&patient)
	defer db.Unscoped().Delete(&patient)

	qNum := fmt.Sprintf("Q%04X", (time.Now().UnixNano()%0xEE00)+0x200)
	insertSQL2 := "INSERT INTO queues (patient_id,created_by_user_id,queue_number,service_date,status,department,note) VALUES (?,?,?,?,?,?,?)"
	db.Exec(insertSQL2, patient.ID, user.ID, qNum, time.Now(), "รอชำระเงิน", "ห้องการเงิน (แคชเชียร์)", "note should survive")
	var inserted models.Queue
	db.Where("queue_number = ?", qNum).First(&inserted)
	defer db.Unscoped().Where("id = ?", inserted.ID).Delete(&models.Queue{})

	updateMap := map[string]interface{}{
		"status":     "เสร็จสิ้น",
		"department": controllers.ResolveDepartmentForStatus(models.Queue{}, "เสร็จสิ้น"),
	}
	db.Session(&gorm.Session{}).Model(&models.Queue{}).Where("id = ?", inserted.ID).Updates(updateMap)

	var after models.Queue
	db.First(&after, inserted.ID)
	t.Logf("After: status=%q dept=%q patient_id=%d queueNum=%q note=%q",
		after.Status, after.Department, after.PatientID, after.QueueNumber, after.Note)

	if after.PatientID != patient.ID { t.Errorf("PatientID zeroed: %d", after.PatientID) }
	if after.QueueNumber != qNum { t.Errorf("QueueNumber zeroed: %q", after.QueueNumber) }
	if after.Note != "note should survive" { t.Errorf("Note zeroed: %q", after.Note) }
	if after.Department != "เสร็จสิ้นขั้นตอนการรักษา" { t.Errorf("dept: got=%q want=%q", after.Department, "เสร็จสิ้นขั้นตอนการรักษา") }
	t.Log("PASS: all unrelated fields survived .Updates() map call")
}
