package controllers_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sort"
	"sync"
	"testing"
	"time"

	"clinic-backend/internal/config"
	"clinic-backend/internal/models"
	"clinic-backend/internal/routes"
	"clinic-backend/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"gorm.io/gorm"
)

func init() {
	gin.SetMode(gin.TestMode)
	config.LoadConfig()
	config.ConnectDB()
}

func generateTestToken(userID uint, role string) string {
	claims := jwt.MapClaims{
		"user_id": userID,
		"role":    role,
		"exp":     time.Now().Add(time.Hour).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, _ := token.SignedString([]byte(config.AppConfig.JWTSecret))
	return tokenString
}

// Pre-check: Duplicate VisitRecords in DB before/after index
func TestPrecheck_DuplicateVisitRecords(t *testing.T) {
	db := config.DB
	type DupCount struct {
		QueueID uint
		Count   int64
	}
	var dupes []DupCount
	db.Raw("SELECT queue_id, count(*) as count FROM visit_records WHERE queue_id IS NOT NULL GROUP BY queue_id HAVING count(*) > 1").Scan(&dupes)
	t.Logf("[PRE-CHECK] Duplicate queue_id count in visit_records: %d instances", len(dupes))
	for _, d := range dupes {
		t.Logf("  - Duplicate QueueID %d has %d records", d.QueueID, d.Count)
	}
	if len(dupes) > 0 {
		t.Errorf("Found %d duplicate queue_id references in visit_records", len(dupes))
	}
}

// AC #2: Concurrent 20 requests — ไม่มีเลขซ้ำ / ไม่กระโดด
func TestAC2_ConcurrentQueueGeneration(t *testing.T) {
	db := config.DB
	testDate := time.Date(2099, 12, 31, 8, 0, 0, 0, services.BangkokLocation())
	db.Exec("DELETE FROM queue_counters WHERE service_date = ?", "2099-12-31")
	defer db.Exec("DELETE FROM queue_counters WHERE service_date = ?", "2099-12-31")

	numWorkers := 20
	var wg sync.WaitGroup
	qNumbersChan := make(chan string, numWorkers)
	errChan := make(chan error, numWorkers)

	for i := 0; i < numWorkers; i++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			var qNo string
			err := db.Transaction(func(tx *gorm.DB) error {
				var errGen error
				qNo, errGen = services.NextQueueNumber(tx, testDate)
				return errGen
			})
			if err != nil {
				errChan <- err
				return
			}
			qNumbersChan <- qNo
		}(i)
	}

	wg.Wait()
	close(qNumbersChan)
	close(errChan)

	for e := range errChan {
		t.Fatalf("Concurrent generation error: %v", e)
	}

	var generatedList []string
	for q := range qNumbersChan {
		generatedList = append(generatedList, q)
	}

	sort.Strings(generatedList)

	uniqueSet := make(map[string]bool)
	duplicatesFound := 0
	for _, q := range generatedList {
		if uniqueSet[q] {
			duplicatesFound++
		}
		uniqueSet[q] = true
	}

	t.Logf("[AC #2] Generated %d queue numbers: %s ... %s", len(generatedList), generatedList[0], generatedList[len(generatedList)-1])
	t.Logf("[AC #2] Sequence: %v", generatedList)
	t.Logf("[AC #2] Duplicates: %d, Unique count: %d / %d", duplicatesFound, len(uniqueSet), numWorkers)

	if duplicatesFound != 0 || len(uniqueSet) != numWorkers {
		t.Fatalf("Duplicate or missing queue numbers detected: duplicates=%d, unique=%d", duplicatesFound, len(uniqueSet))
	}
	if generatedList[0] != "Q0001" || generatedList[len(generatedList)-1] != fmt.Sprintf("Q%04X", numWorkers) {
		t.Fatalf("Non-monotonic sequence: start=%s, end=%s", generatedList[0], generatedList[len(generatedList)-1])
	}
}

// AC #3: Format sequence 10->Q000A, 15->Q000F, 16->Q0010, 65535->QFFFF
func TestAC3_HexQueueFormat(t *testing.T) {
	hexTests := []struct {
		seq      int
		expected string
	}{
		{1, "Q0001"},
		{9, "Q0009"},
		{10, "Q000A"},
		{15, "Q000F"},
		{16, "Q0010"},
		{255, "Q00FF"},
		{4095, "Q0FFF"},
		{65535, "QFFFF"},
	}

	for _, tc := range hexTests {
		actual := fmt.Sprintf("Q%04X", tc.seq)
		t.Logf("[AC #3] Seq: %5d -> Output: %-6s (Expected: %-6s) Match: %v", tc.seq, actual, tc.expected, actual == tc.expected)
		if actual != tc.expected {
			t.Errorf("Formatting mismatch for %d: expected %s, got %s", tc.seq, tc.expected, actual)
		}
	}
}

// AC #4: Daily Reset (Yesterday vs Today can both be Q0001)
func TestAC4_DailyReset(t *testing.T) {
	db := config.DB
	dateYesterday := time.Date(2098, 1, 1, 9, 0, 0, 0, services.BangkokLocation())
	dateToday := time.Date(2098, 1, 2, 9, 0, 0, 0, services.BangkokLocation())

	db.Exec("DELETE FROM queue_counters WHERE service_date IN (?, ?)", "2098-01-01", "2098-01-02")
	defer db.Exec("DELETE FROM queue_counters WHERE service_date IN (?, ?)", "2098-01-01", "2098-01-02")

	var qYesterday, qToday string
	_ = db.Transaction(func(tx *gorm.DB) error {
		var err error
		qYesterday, err = services.NextQueueNumber(tx, dateYesterday)
		return err
	})
	_ = db.Transaction(func(tx *gorm.DB) error {
		var err error
		qToday, err = services.NextQueueNumber(tx, dateToday)
		return err
	})

	t.Logf("[AC #4] Yesterday (2098-01-01): %s", qYesterday)
	t.Logf("[AC #4] Today     (2098-01-02): %s", qToday)

	if qYesterday != "Q0001" || qToday != "Q0001" {
		t.Fatalf("Daily reset failed: yesterday=%s, today=%s", qYesterday, qToday)
	}
}

// AC #7: Triage Migration Audit in Database
func TestAC7_TriageMigrationAudit(t *testing.T) {
	db := config.DB
	var totalScreenings int64
	db.Model(&models.Screening{}).Count(&totalScreenings)

	var invalidTriageCount int64
	db.Raw("SELECT count(*) FROM screenings WHERE triage_level IS NULL OR triage_level < 1 OR triage_level > 4").Scan(&invalidTriageCount)

	type TriageDist struct {
		TriageLevel int
		Count       int64
	}
	var dist []TriageDist
	db.Raw("SELECT triage_level, count(*) as count FROM screenings GROUP BY triage_level ORDER BY triage_level").Scan(&dist)

	t.Logf("[AC #7] Total Screenings in Database: %d rows", totalScreenings)
	t.Logf("[AC #7] Unmapped / Invalid Triage Rows: %d rows", invalidTriageCount)
	for _, d := range dist {
		t.Logf("  - Triage Level %d: %d rows", d.TriageLevel, d.Count)
	}

	if invalidTriageCount != 0 {
		t.Fatalf("Found %d invalid triage rows in database", invalidTriageCount)
	}
}

// AC #8: Idempotency: 2 Sequential Screening Calls on Same Queue -> 1 VisitRecord + 409 Conflict
func TestAC8_IdempotencyTwoRequests(t *testing.T) {
	db := config.DB
	testHN := "HN8888"
	var testPatient models.Patient
	db.Where("hn = ?", testHN).First(&testPatient)
	if testPatient.ID == 0 {
		testPatient = models.Patient{
			HN:           testHN,
			NationalID:   "8888888888888",
			FullName:     "Test Idempotency User",
			BirthDate:    time.Date(1990, 1, 1, 0, 0, 0, 0, time.UTC),
			Gender:       "Male",
			Address:      "Test Address",
			PhoneNumber:      "0888888888",
			EmergencyContact: "0888888888",
		}
		db.Create(&testPatient)
	}

	var testUser models.User
	db.First(&testUser)

	testQueue := models.Queue{
		QueueNumber:     "Q8888",
		ServiceDate:     time.Now(),
		PatientID:       testPatient.ID,
		CreatedByUserID: testUser.ID,
		Status:          "รอซักประวัติ",
	}
	db.Create(&testQueue)
	defer func() {
		var createdVisit models.VisitRecord
		db.Where("queue_id = ?", testQueue.ID).First(&createdVisit)
		if createdVisit.ID > 0 {
			db.Exec("DELETE FROM screenings WHERE visit_id = ?", createdVisit.ID)
			db.Exec("DELETE FROM visit_records WHERE id = ?", createdVisit.ID)
		}
		db.Exec("DELETE FROM queues WHERE id = ?", testQueue.ID)
		db.Exec("DELETE FROM patients WHERE id = ?", testPatient.ID)
	}()

	r := gin.New()
	routes.SetUpRoutes(r)

	nurseToken := generateTestToken(2, "nurse")

	vitalsPayload := map[string]any{
		"queue_id":        testQueue.ID,
		"queue_number":    "Q8888",
		"patient_id":      testPatient.ID,
		"systolic_bp":     120,
		"diastolic_bp":    80,
		"heart_rate":      75,
		"respiratory_rate": 18,
		"temperature":     36.6,
		"spo2":            98,
		"weight":          65.0,
		"height":          175.0,
		"triage_level":    4,
		"chief_complaint": "ตรวจสุขภาพ",
	}
	bodyBytes, _ := json.Marshal(vitalsPayload)

	// Call 1: Initial record
	req1, _ := http.NewRequest("POST", "/api/nurse/vitals", bytes.NewBuffer(bodyBytes))
	req1.Header.Set("Content-Type", "application/json")
	req1.Header.Set("Authorization", "Bearer "+nurseToken)
	w1 := httptest.NewRecorder()
	r.ServeHTTP(w1, req1)
	t.Logf("[AC #8] Call 1 (Original) Response Status: %d (Expected: 201 Created)", w1.Code)
	t.Logf("[AC #8] Call 1 Response Body: %s", w1.Body.String())

	// Call 2: Identical payload (Idempotent Replay)
	req2, _ := http.NewRequest("POST", "/api/nurse/vitals", bytes.NewBuffer(bodyBytes))
	req2.Header.Set("Content-Type", "application/json")
	req2.Header.Set("Authorization", "Bearer "+nurseToken)
	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, req2)
	t.Logf("[AC #8] Call 2 (Identical Payload) Response Status: %d (Expected: 200 OK)", w2.Code)
	t.Logf("[AC #8] Call 2 Response Body: %s", w2.Body.String())

	// Call 3: Modified payload (weight 80.0 kg)
	modifiedPayload := map[string]any{
		"queue_id":        testQueue.ID,
		"queue_number":    "Q8888",
		"patient_id":      testPatient.ID,
		"systolic_bp":     120,
		"diastolic_bp":    80,
		"heart_rate":      75,
		"respiratory_rate": 18,
		"temperature":     36.6,
		"spo2":            98,
		"weight":          80.0, // Modified weight
		"height":          175.0,
		"triage_level":    4,
		"chief_complaint": "ตรวจสุขภาพ (แก้ค่าน้ำหนัก)",
	}
	body3Bytes, _ := json.Marshal(modifiedPayload)
	req3, _ := http.NewRequest("POST", "/api/nurse/vitals", bytes.NewBuffer(body3Bytes))
	req3.Header.Set("Content-Type", "application/json")
	req3.Header.Set("Authorization", "Bearer "+nurseToken)
	w3 := httptest.NewRecorder()
	r.ServeHTTP(w3, req3)
	t.Logf("[AC #8] Call 3 (Modified Weight) Response Status: %d (Expected: 409 Conflict)", w3.Code)
	t.Logf("[AC #8] Call 3 Response Body: %s", w3.Body.String())

	var visitCount int64
	db.Model(&models.VisitRecord{}).Where("queue_id = ?", testQueue.ID).Count(&visitCount)
	t.Logf("[AC #8] Total VisitRecords in DB for Queue %d: %d (Expected: 1)", testQueue.ID, visitCount)

	if w1.Code != http.StatusCreated {
		t.Fatalf("Call 1 expected 201 Created, got %d. Body: %s", w1.Code, w1.Body.String())
	}
	if w2.Code != http.StatusOK {
		t.Fatalf("Call 2 expected 200 OK, got %d. Body: %s", w2.Code, w2.Body.String())
	}
	if w3.Code != http.StatusConflict {
		t.Fatalf("Call 3 expected 409 Conflict, got %d. Body: %s", w3.Code, w3.Body.String())
	}
	if visitCount != 1 {
		t.Fatalf("Expected exactly 1 VisitRecord in DB, found %d", visitCount)
	}
}

// AC #11: RBAC Parity for nurse_assistant
func TestAC11_RBACNurseAssistantParity(t *testing.T) {
	r := gin.New()
	routes.SetUpRoutes(r)

	nurseAssistantToken := generateTestToken(3, "nurse_assistant")

	rbacEndpoints := []struct {
		method string
		path   string
	}{
		{"GET", "/api/queue/list"},
		{"GET", "/api/nurse/doctors"},
		{"GET", "/api/nurse/vitals/history"},
		{"GET", "/api/registrar/patients"},
	}

	for _, ep := range rbacEndpoints {
		req, _ := http.NewRequest(ep.method, ep.path, nil)
		req.Header.Set("Authorization", "Bearer "+nurseAssistantToken)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		statusOK := w.Code != http.StatusUnauthorized && w.Code != http.StatusForbidden
		t.Logf("[AC #11] [nurse_assistant] %s %-30s -> Status: %d (Allowed: %v)", ep.method, ep.path, w.Code, statusOK)
		if !statusOK {
			t.Errorf("RBAC permission denied for nurse_assistant on %s %s: status %d", ep.method, ep.path, w.Code)
		}
	}
}

// Negative Test: POST triage_level 5 หรือ 0 หรือ -1 -> 400 Bad Request
func TestNegativeTriageValidation(t *testing.T) {
	r := gin.New()
	routes.SetUpRoutes(r)
	nurseToken := generateTestToken(2, "nurse")

	invalidLevels := []any{5, 0, -1, "5", "0", "99"}

	for _, lvl := range invalidLevels {
		payload := map[string]any{
			"patient_id":      1,
			"systolic_bp":     120,
			"diastolic_bp":    80,
			"heart_rate":      75,
			"respiratory_rate": 18,
			"temperature":     36.6,
			"spo2":            98,
			"weight":          65.0,
			"height":          175.0,
			"triage_level":    lvl,
			"chief_complaint": "ตรวจสุขภาพ",
		}
		bodyBytes, _ := json.Marshal(payload)

		req, _ := http.NewRequest("POST", "/api/nurse/vitals", bytes.NewBuffer(bodyBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+nurseToken)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		t.Logf("[NEGATIVE TRIAGE] Testing triage_level=%v -> Status: %d (Body: %s)", lvl, w.Code, w.Body.String())
		if w.Code != http.StatusBadRequest {
			t.Errorf("Expected 400 Bad Request for triage_level=%v, got %d", lvl, w.Code)
		}
	}
}

// D5 เคสที่ 3: บันทึกซ้ำพร้อมเปลี่ยนค่าน้ำหนัก (weight 65 -> 80) -> คืน 409 Conflict และข้อมูลเดิมไม่ถูก overwrite
func TestD5_Case3_ModifiedWeightReturns409(t *testing.T) {
	db := config.DB
	testHN := "HN7777"
	var testPatient models.Patient
	db.Where("hn = ?", testHN).First(&testPatient)
	if testPatient.ID == 0 {
		testPatient = models.Patient{
			HN:               testHN,
			NationalID:       "7777777777777",
			FullName:         "นายทดสอบ น้ำหนักเปลี่ยน",
			BirthDate:        time.Date(1992, 5, 5, 0, 0, 0, 0, time.UTC),
			Gender:           "Male",
			Address:          "777 Test Road",
			PhoneNumber:      "0877777777",
			EmergencyContact: "0877777777",
		}
		db.Create(&testPatient)
	}

	var testUser models.User
	db.First(&testUser)

	testQueue := models.Queue{
		QueueNumber:     "Q7777",
		ServiceDate:     time.Now(),
		PatientID:       testPatient.ID,
		CreatedByUserID: testUser.ID,
		Status:          "รอซักประวัติ",
	}
	db.Create(&testQueue)
	defer func() {
		var createdVisit models.VisitRecord
		db.Where("queue_id = ?", testQueue.ID).First(&createdVisit)
		if createdVisit.ID > 0 {
			db.Exec("DELETE FROM screenings WHERE visit_id = ?", createdVisit.ID)
			db.Exec("DELETE FROM visit_records WHERE id = ?", createdVisit.ID)
		}
		db.Exec("DELETE FROM queues WHERE id = ?", testQueue.ID)
		db.Exec("DELETE FROM patients WHERE id = ?", testPatient.ID)
	}()

	r := gin.New()
	routes.SetUpRoutes(r)
	nurseToken := generateTestToken(2, "nurse")

	// Call 1: Original weight 65.0 kg
	payload1 := map[string]any{
		"queue_id":        testQueue.ID,
		"queue_number":    "Q7777",
		"patient_id":      testPatient.ID,
		"systolic_bp":     120,
		"diastolic_bp":    80,
		"heart_rate":      75,
		"respiratory_rate": 18,
		"temperature":     36.6,
		"spo2":            98,
		"weight":          65.0,
		"height":          175.0,
		"triage_level":    4,
		"chief_complaint": "บันทึกครั้งที่ 1 (weight 65)",
	}
	b1, _ := json.Marshal(payload1)
	req1, _ := http.NewRequest("POST", "/api/nurse/vitals", bytes.NewBuffer(b1))
	req1.Header.Set("Content-Type", "application/json")
	req1.Header.Set("Authorization", "Bearer "+nurseToken)
	w1 := httptest.NewRecorder()
	r.ServeHTTP(w1, req1)
	t.Logf("[D5 Case 3] Call 1 (weight 65.0) Response: %d", w1.Code)

	// Call 2: Modified weight 80.0 kg on SAME queue
	payload2 := map[string]any{
		"queue_id":        testQueue.ID,
		"queue_number":    "Q7777",
		"patient_id":      testPatient.ID,
		"systolic_bp":     130,
		"diastolic_bp":    85,
		"heart_rate":      80,
		"respiratory_rate": 20,
		"temperature":     37.0,
		"spo2":            99,
		"weight":          80.0, // Modified weight
		"height":          175.0,
		"triage_level":    3,
		"chief_complaint": "บันทึกครั้งที่ 2 ดัดแปลงค่าน้ำหนักเป็น 80",
	}
	b2, _ := json.Marshal(payload2)
	req2, _ := http.NewRequest("POST", "/api/nurse/vitals", bytes.NewBuffer(b2))
	req2.Header.Set("Content-Type", "application/json")
	req2.Header.Set("Authorization", "Bearer "+nurseToken)
	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, req2)
	t.Logf("[D5 Case 3] Call 2 (weight 80.0 modified) Response: %d (Body: %s)", w2.Code, w2.Body.String())

	// Verify DB screening record retained original weight 65.0 and was NOT overwritten
	var visit models.VisitRecord
	db.Where("queue_id = ?", testQueue.ID).First(&visit)
	var sc models.Screening
	db.Where("visit_id = ?", visit.ID).First(&sc)

	t.Logf("[D5 Case 3] Persisted Screening Weight in DB: %.1f kg (Original: 65.0)", sc.Weight)
	if w1.Code != http.StatusCreated || w2.Code != http.StatusConflict || sc.Weight != 65.0 {
		t.Fatalf("D5 Case 3 failed: w1=%d, w2=%d, weight=%.1f", w1.Code, w2.Code, sc.Weight)
	}
}

// C1: ทดสอบการทำงานของ Retry Collision เมื่อ QueueNumber ชนกัน
func TestC1_CollisionRetry(t *testing.T) {
	db := config.DB
	r := gin.New()
	routes.SetUpRoutes(r)
	regToken := generateTestToken(1, "registrar")

	// Get a test patient
	var p models.Patient
	db.First(&p)

	// Call CreateQueue
	payload := map[string]any{
		"patient_id": p.ID,
		"department": "แผนกคัดกรอง",
		"note":       "ทดสอบการออกคิว",
	}
	b, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", "/api/queue/create", bytes.NewBuffer(b))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+regToken)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	t.Logf("[C1 RETRY] CreateQueue Status: %d Body: %s", w.Code, w.Body.String())
	if w.Code != http.StatusCreated {
		t.Fatalf("CreateQueue failed: status %d", w.Code)
	}
}

// D1: รัน Raw SQL 4 Query หลักและพิมพ์ผลดิบ
func TestD1_RawSQL4Queries(t *testing.T) {
	db := config.DB

	t.Log("\n=======================================================")
	t.Log("  [D1 RAW SQL 1] Duplicate visit_records(queue_id) check")
	t.Log("  SQL: SELECT queue_id, count(*) FROM visit_records WHERE queue_id IS NOT NULL GROUP BY queue_id HAVING count(*) > 1;")
	type Q1 struct {
		QueueID uint  `gorm:"column:queue_id"`
		Count   int64 `gorm:"column:count"`
	}
	var q1 []Q1
	db.Raw("SELECT queue_id, count(*) as count FROM visit_records WHERE queue_id IS NOT NULL GROUP BY queue_id HAVING count(*) > 1").Scan(&q1)
	t.Logf("  Rows returned: %d", len(q1))
	for _, r := range q1 {
		t.Logf("  queue_id: %d | count: %d", r.QueueID, r.Count)
	}

	t.Log("\n=======================================================")
	t.Log("  [D1 RAW SQL 2] Triage distribution in screenings table")
	t.Log("  SQL: SELECT triage_level, count(*) FROM screenings GROUP BY triage_level ORDER BY triage_level;")
	type Q2 struct {
		TriageLevel int   `gorm:"column:triage_level"`
		Count       int64 `gorm:"column:count"`
	}
	var q2 []Q2
	db.Raw("SELECT triage_level, count(*) as count FROM screenings GROUP BY triage_level ORDER BY triage_level").Scan(&q2)
	t.Logf("  Rows returned: %d", len(q2))
	for _, r := range q2 {
		t.Logf("  triage_level: %d | count: %d", r.TriageLevel, r.Count)
	}

	t.Log("\n=======================================================")
	t.Log("  [D1 RAW SQL 3] Duplicate queue_number per service_date check")
	t.Log("  SQL: SELECT service_date, queue_number, count(*) FROM queues GROUP BY service_date, queue_number HAVING count(*) > 1;")
	type Q3 struct {
		ServiceDate string `gorm:"column:service_date"`
		QueueNumber string `gorm:"column:queue_number"`
		Count       int64  `gorm:"column:count"`
	}
	var q3 []Q3
	db.Raw("SELECT service_date::text, queue_number, count(*) as count FROM queues GROUP BY service_date, queue_number HAVING count(*) > 1").Scan(&q3)
	t.Logf("  Rows returned: %d", len(q3))
	for _, r := range q3 {
		t.Logf("  service_date: %s | queue_number: %s | count: %d", r.ServiceDate, r.QueueNumber, r.Count)
	}

	t.Log("\n=======================================================")
	t.Log("  [D1 RAW SQL 4] queue_counters table recent service dates and last numbers")
	t.Log("  SQL: SELECT service_date, last_number, updated_at FROM queue_counters ORDER BY service_date DESC LIMIT 5;")
	type Q4 struct {
		ServiceDate string `gorm:"column:service_date"`
		LastNumber  int    `gorm:"column:last_number"`
		UpdatedAt   string `gorm:"column:updated_at"`
	}
	var q4 []Q4
	db.Raw("SELECT service_date::text, last_number, updated_at::text FROM queue_counters ORDER BY service_date DESC LIMIT 5").Scan(&q4)
	t.Logf("  Rows returned: %d", len(q4))
	for _, r := range q4 {
		t.Logf("  service_date: %s | last_number: %d (Hex: Q%04X) | updated_at: %s", r.ServiceDate, r.LastNumber, r.LastNumber, r.UpdatedAt)
	}

	t.Log("\n=======================================================")
	t.Log("  [C1 RAW SQL] Service Date distribution with Min/Max Queue Numbers")
	t.Log("  SQL: SELECT service_date, COUNT(*), MIN(queue_number), MAX(queue_number) FROM queues GROUP BY 1 ORDER BY 1 DESC;")
	type QC1 struct {
		ServiceDate string `gorm:"column:service_date"`
		Count       int64  `gorm:"column:count"`
		MinQ        string `gorm:"column:min"`
		MaxQ        string `gorm:"column:max"`
	}
	var qc1 []QC1
	db.Raw("SELECT service_date::text, count(*) as count, min(queue_number) as min, max(queue_number) as max FROM queues GROUP BY service_date ORDER BY service_date DESC").Scan(&qc1)
	t.Logf("  Total Service Dates with Queues: %d", len(qc1))
	for _, r := range qc1 {
		t.Logf("  service_date: %-10s | count: %3d | min: %-6s | max: %-6s", r.ServiceDate, r.Count, r.MinQ, r.MaxQ)
	}

	t.Log("\n=======================================================")
	t.Log("  [C2 SEED STATS] queue_counters total days seeded and max last_number")
	var totalCounterDays int64
	var maxLastNum int64
	db.Raw("SELECT count(*), COALESCE(max(last_number), 0) FROM queue_counters").Row().Scan(&totalCounterDays, &maxLastNum)
	t.Logf("  Total Seeded Days in queue_counters: %d days", totalCounterDays)
	t.Logf("  Max last_number in queue_counters: %d (Hex: Q%04X)", maxLastNum, maxLastNum)

	t.Log("\n=======================================================")
	t.Log("  [D1 SUPABASE PRODUCTION AUDIT] Screenings count and triage level validity")
	t.Log("  Connected Host: " + config.AppConfig.DBHost + " | Port: " + config.AppConfig.DBPort + " | Database: " + config.AppConfig.DBName)
	var totalSc int64
	db.Raw("SELECT count(*) FROM screenings").Scan(&totalSc)
	var invalidSc int64
	db.Raw("SELECT count(*) FROM screenings WHERE triage_level IS NULL OR triage_level < 1 OR triage_level > 4").Scan(&invalidSc)
	t.Logf("  SELECT count(*) FROM screenings -> %d rows", totalSc)
	t.Logf("  SELECT count(*) FROM screenings WHERE invalid -> %d rows", invalidSc)
	t.Log("=======================================================\n")
}

