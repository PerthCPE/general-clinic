package controllers_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"clinic-backend/internal/config"
	"clinic-backend/internal/routes"

	"github.com/gin-gonic/gin"
)

// =========================================================================
// งาน D — ตรวจ Data Consistency (READ-ONLY) บน Supabase Production
// =========================================================================
func TestSprint1_3_TaskD_DataConsistency(t *testing.T) {
	db := config.DB
	if db == nil {
		t.Fatal("Database connection not initialized")
	}

	t.Log("================================================================================")
	t.Log("  [TASK D] SUPABASE DATA CONSISTENCY AUDIT (READ-ONLY SQL QUERIES)")
	t.Log("================================================================================")

	// 1. Visit records without screening
	var countNoScreening int64
	q1 := `
		SELECT COUNT(*) FROM visit_records v
		LEFT JOIN screenings s ON s.visit_id = v.id
		WHERE s.id IS NULL;
	`
	db.Raw(q1).Scan(&countNoScreening)
	t.Logf("  Query 1: Visit records without screening (s.id IS NULL): %d rows", countNoScreening)

	// 2. Visit records without queue_id (created from paths other than vitals)
	var countNoQueueID int64
	q2 := `
		SELECT COUNT(*) FROM visit_records WHERE queue_id IS NULL;
	`
	db.Raw(q2).Scan(&countNoQueueID)
	t.Logf("  Query 2: Visit records without queue_id (queue_id IS NULL): %d rows", countNoQueueID)

	// 3. Time range of visit records without screening
	type TimeRange struct {
		MinTime *time.Time `gorm:"column:min"`
		MaxTime *time.Time `gorm:"column:max"`
	}
	var tr TimeRange
	q3 := `
		SELECT MIN(v.created_at) as min, MAX(v.created_at) as max FROM visit_records v
		LEFT JOIN screenings s ON s.visit_id = v.id
		WHERE s.id IS NULL;
	`
	db.Raw(q3).Scan(&tr)
	minStr := "NULL"
	maxStr := "NULL"
	if tr.MinTime != nil {
		minStr = tr.MinTime.Format(time.RFC3339)
	}
	if tr.MaxTime != nil {
		maxStr = tr.MaxTime.Format(time.RFC3339)
	}
	t.Logf("  Query 3: Time range of visits without screening: MIN = %s, MAX = %s", minStr, maxStr)

	// 4. Queues with status past screening but without visit_records
	var countQueueNoVisit int64
	q4 := `
		SELECT COUNT(*) FROM queues q
		LEFT JOIN visit_records v ON v.queue_id = q.id
		WHERE q.status IN ('waiting_doctor','in_progress','completed','รอพบแพทย์','กำลังตรวจ','ตรวจเสร็จสิ้น')
		  AND v.id IS NULL;
	`
	db.Raw(q4).Scan(&countQueueNoVisit)
	t.Logf("  Query 4: Queues past screening status without visit: %d rows", countQueueNoVisit)
	t.Log("================================================================================\n")
}

// =========================================================================
// งาน A5 — ขยาย RBAC Matrix Test (Positive & Negative Test Cases)
// =========================================================================
func TestSprint1_3_TaskA5_RBACMatrix(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	routes.SetUpRoutes(r)

	t.Log("================================================================================")
	t.Log("  [TASK A5] EXPANDED RBAC MATRIX TEST (POSITIVE & NEGATIVE TEST CASES)")
	t.Log("================================================================================")

	type rbacTestCase struct {
		Name         string
		Role         string
		UserID       uint
		Method       string
		Path         string
		Payload      any
		ExpectedMin  int
		ExpectedMax  int
		Description  string
	}

	testCases := []rbacTestCase{
		// A1: ปิด /api/billing/*
		{
			Name:        "nurse_assistant -> GET /api/billing/queues",
			Role:        "nurse_assistant",
			UserID:      3,
			Method:      "GET",
			Path:        "/api/billing/queues",
			ExpectedMin: 403,
			ExpectedMax: 403,
			Description: "Billing restricted to cashier/admin only",
		},
		{
			Name:        "nurse -> GET /api/billing/queues",
			Role:        "nurse",
			UserID:      2,
			Method:      "GET",
			Path:        "/api/billing/queues",
			ExpectedMin: 403,
			ExpectedMax: 403,
			Description: "Billing restricted to cashier/admin only",
		},
		{
			Name:        "registrar -> GET /api/billing/queues",
			Role:        "registrar",
			UserID:      1,
			Method:      "GET",
			Path:        "/api/billing/queues",
			ExpectedMin: 403,
			ExpectedMax: 403,
			Description: "Billing restricted to cashier/admin only",
		},
		{
			Name:        "cashier -> GET /api/billing/queues",
			Role:        "cashier",
			UserID:      5,
			Method:      "GET",
			Path:        "/api/billing/queues",
			ExpectedMin: 200,
			ExpectedMax: 200,
			Description: "Cashier allowed to access billing queues",
		},

		// A2: แยก Read/Write บน /api/registrar/*
		{
			Name:        "nurse_assistant -> POST /api/registrar/patients",
			Role:        "nurse_assistant",
			UserID:      3,
			Method:      "POST",
			Path:        "/api/registrar/patients",
			Payload:     map[string]any{"national_id": "9999999999999", "fullname": "Test Reject"},
			ExpectedMin: 403,
			ExpectedMax: 403,
			Description: "Write registration restricted to registrar only",
		},
		{
			Name:        "nurse_assistant -> GET /api/registrar/patients",
			Role:        "nurse_assistant",
			UserID:      3,
			Method:      "GET",
			Path:        "/api/registrar/patients",
			ExpectedMin: 200,
			ExpectedMax: 200,
			Description: "Read patients allowed for nurse_assistant (API parity)",
		},
		{
			Name:        "nurse -> GET /api/registrar/patients",
			Role:        "nurse",
			UserID:      2,
			Method:      "GET",
			Path:        "/api/registrar/patients",
			ExpectedMin: 200,
			ExpectedMax: 200,
			Description: "Read patients allowed for nurse",
		},

		// A4: ตรวจ /api/nurse/* Write Endpoint
		{
			Name:        "registrar -> POST /api/nurse/vitals",
			Role:        "registrar",
			UserID:      1,
			Method:      "POST",
			Path:        "/api/nurse/vitals",
			Payload:     map[string]any{"queue_id": 1, "triage_level": 4},
			ExpectedMin: 403,
			ExpectedMax: 403,
			Description: "Write vitals restricted to nurse & nurse_assistant only",
		},
		{
			Name:        "nurse_assistant -> GET /api/nurse/vitals/history",
			Role:        "nurse_assistant",
			UserID:      3,
			Method:      "GET",
			Path:        "/api/nurse/vitals/history",
			ExpectedMin: 200,
			ExpectedMax: 200,
			Description: "Nurse assistant read vitals history allowed",
		},

		// Admin Module
		{
			Name:        "nurse_assistant -> GET /api/admin/users",
			Role:        "nurse_assistant",
			UserID:      3,
			Method:      "GET",
			Path:        "/api/admin/users",
			ExpectedMin: 403,
			ExpectedMax: 403,
			Description: "Admin routes restricted to admin only",
		},
		{
			Name:        "admin -> GET /api/admin/users",
			Role:        "admin",
			UserID:      7,
			Method:      "GET",
			Path:        "/api/admin/users",
			ExpectedMin: 200,
			ExpectedMax: 200,
			Description: "Admin allowed to access admin routes",
		},
	}

	for _, tc := range testCases {
		token := generateTestToken(tc.UserID, tc.Role)
		var bodyBuf *bytes.Buffer
		if tc.Payload != nil {
			b, _ := json.Marshal(tc.Payload)
			bodyBuf = bytes.NewBuffer(b)
		} else {
			bodyBuf = bytes.NewBuffer(nil)
		}

		req, _ := http.NewRequest(tc.Method, tc.Path, bodyBuf)
		req.Header.Set("Authorization", "Bearer "+token)
		if tc.Payload != nil {
			req.Header.Set("Content-Type", "application/json")
		}

		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		pass := w.Code >= tc.ExpectedMin && w.Code <= tc.ExpectedMax
		t.Logf("  %-45s -> Status: %d (Expected: %d) Pass: %v",
			tc.Name, w.Code, tc.ExpectedMin, pass)

		if !pass {
			t.Errorf("RBAC Violation for %s: Got status %d, expected %d", tc.Name, w.Code, tc.ExpectedMin)
		}
	}
	t.Log("================================================================================\n")
}
