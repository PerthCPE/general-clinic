package controllers_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"clinic-backend/internal/config"
	"clinic-backend/internal/models"
	"clinic-backend/internal/routes"

	"github.com/gin-gonic/gin"
)

// =========================================================================
// SPRINT 2 - Task D1: Migration 005 & ExpireDate DATE Audit
// =========================================================================

func TestSprint2_TaskD1_Migration005_Audit(t *testing.T) {
	db := config.DB
	if db == nil {
		t.Fatal("Database connection not initialized")
	}

	t.Log("================================================================================")
	t.Log("  [SPRINT 2 - TASK D1] MIGRATION 005 & EXPIRE_DATE COLUMN AUDIT")
	t.Log("================================================================================")

	// 1. Run Migration 005 SQL script if not yet executed
	migrationSQL, err := os.ReadFile("../../migrations/005_eligibility_expire_date.sql")
	if err != nil {
		// Fallback path
		migrationSQL, err = os.ReadFile("migrations/005_eligibility_expire_date.sql")
	}
	if err == nil && len(migrationSQL) > 0 {
		t.Log("  Executing Migration 005 SQL block...")
		if execErr := db.Exec(string(migrationSQL)).Error; execErr != nil {
			t.Logf("  Migration 005 exec note: %v", execErr)
		} else {
			t.Log("  Migration 005 executed successfully.")
		}
	}

	// 2. Check column data type in PostgreSQL information_schema
	type ColInfo struct {
		ColumnName string `gorm:"column:column_name"`
		DataType   string `gorm:"column:data_type"`
	}
	var col ColInfo
	db.Raw(`
		SELECT column_name, data_type 
		FROM information_schema.columns 
		WHERE table_name = 'medical_eligibilities' AND column_name = 'expire_date';
	`).Scan(&col)
	t.Logf("  medical_eligibilities.expire_date data_type: %s", col.DataType)

	// 3. Query unconvertible rows (NULL expire_date or valid DATE)
	var totalRows int64
	var nullRows int64
	var validRows int64
	db.Raw(`SELECT COUNT(*) FROM medical_eligibilities;`).Scan(&totalRows)
	db.Raw(`SELECT COUNT(*) FROM medical_eligibilities WHERE expire_date IS NULL;`).Scan(&nullRows)
	db.Raw(`SELECT COUNT(*) FROM medical_eligibilities WHERE expire_date IS NOT NULL;`).Scan(&validRows)

	t.Logf("  Total medical_eligibilities rows: %d", totalRows)
	t.Logf("  Rows with valid DATE expire_date: %d", validRows)
	t.Logf("  Rows with NULL expire_date (unconvertible/unspecified): %d", nullRows)

	// 4. Sample rows check
	var samples []models.MedicalEligibility
	db.Preload("Patient").Limit(5).Find(&samples)
	t.Logf("  Sample Eligibility Records (%d found):", len(samples))
	for _, s := range samples {
		expStr := "NULL"
		if s.ExpireDate != nil {
			expStr = s.ExpireDate.Format("2006-01-02")
		}
		t.Logf("    ID=%d | PatientID=%v | Scheme=%s | ExpireDate=%s | Status=%s",
			s.ID, s.PatientID, s.SchemeType, expStr, s.Status)
	}

	t.Log("================================================================================\n")
}

// =========================================================================
// SPRINT 2 - Task D1.2: Eligibility Controller Save & Date Parsing Test
// =========================================================================

func TestSprint2_EligibilityDateParsing(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	routes.SetUpRoutes(r)

	token := generateTestToken(2, "registrar")

	// Create test patient
	p := models.Patient{
		HN:          "HNTEST",
		NationalID:  "1999988887776",
		FullName:    "ทดสอบ ระบบสิทธิ์",
		Gender:      "ชาย",
		BirthDate:   time.Date(1990, 1, 1, 0, 0, 0, 0, time.UTC),
		PhoneNumber: "0899999999",
		SchemeType:  "บัตรทอง (สปสช.)",
	}
	config.DB.Where("national_id = ?", p.NationalID).Delete(&models.Patient{})
	if err := config.DB.Create(&p).Error; err != nil {
		t.Fatalf("Failed to create test patient: %v", err)
	}
	defer config.DB.Where("national_id = ?", p.NationalID).Delete(&models.Patient{})
	defer config.DB.Where("patient_id = ?", p.ID).Delete(&models.MedicalEligibility{})

	t.Log("================================================================================")
	t.Log("  [SPRINT 2] ELIGIBILITY SAVE & RETRIEVE DATE TEST")
	t.Log("================================================================================")

	// Test saving with Buddhist Era date: 31/12/2569
	payload := map[string]interface{}{
		"patient_id":       p.ID,
		"scheme_type":      "สิทธิ์ข้าราชการ",
		"coverage_details": "จ่ายตรงกรมบัญชีกลาง",
		"hospital_name":    "โรงพยาบาลศูนย์",
		"status":           "ใช้งานได้",
		"expire_date":      "31/12/2569",
	}
	body, _ := json.Marshal(payload)

	req := httptest.NewRequest(http.MethodPost, "/api/registrar/eligibility/save", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK on save eligibility, got %d, body: %s", w.Code, w.Body.String())
	}
	t.Logf("  POST /api/registrar/eligibility/save with BE date (31/12/2569) -> %d OK", w.Code)

	// Check saved record in DB
	var saved models.MedicalEligibility
	if err := config.DB.Where("patient_id = ?", p.ID).First(&saved).Error; err != nil {
		t.Fatalf("Failed to fetch saved eligibility: %v", err)
	}

	if saved.ExpireDate == nil {
		t.Fatal("Expected ExpireDate to be non-nil")
	}
	expectedYear := 2026
	if saved.ExpireDate.Year() != expectedYear {
		t.Fatalf("Expected converted CE year %d, got %d", expectedYear, saved.ExpireDate.Year())
	}
	t.Logf("  Verified DB ExpireDate: %s (Year=%d, Month=%s, Day=%d)",
		saved.ExpireDate.Format("2006-01-02"), saved.ExpireDate.Year(), saved.ExpireDate.Month(), saved.ExpireDate.Day())

	// Test GET /api/registrar/eligibility/check/:national_id
	checkReq := httptest.NewRequest(http.MethodGet, "/api/registrar/eligibility/check/"+p.NationalID, nil)
	checkReq.Header.Set("Authorization", "Bearer "+token)
	checkW := httptest.NewRecorder()
	r.ServeHTTP(checkW, checkReq)

	if checkW.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK on check eligibility, got %d", checkW.Code)
	}
	t.Logf("  GET /api/registrar/eligibility/check/%s -> %d OK, Response: %s", p.NationalID, checkW.Code, checkW.Body.String())

	t.Log("================================================================================\n")
}
