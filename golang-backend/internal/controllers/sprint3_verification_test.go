package controllers_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"clinic-backend/internal/config"
	"clinic-backend/internal/models"
	"clinic-backend/internal/routes"

	"github.com/gin-gonic/gin"
)

// =========================================================================
// SPRINT 3 - Verification Suite: Structured Patient Address
// =========================================================================

// TestSprint3_TaskA_Migration006_Audit verifies that migration 006 runs cleanly
// and that all 9 new address columns exist in the database.
func TestSprint3_TaskA_Migration006_Audit(t *testing.T) {
	db := config.DB
	if db == nil {
		t.Fatal("Database connection not initialized")
	}

	t.Log("================================================================================")
	t.Log("  [SPRINT 3 - TASK A] MIGRATION 006 & STRUCTURED ADDRESS SCHEMA AUDIT")
	t.Log("================================================================================")

	// 1. Run Migration 006 SQL script
	migrationSQL, err := os.ReadFile("../../migrations/006_patient_address_split.sql")
	if err != nil {
		migrationSQL, err = os.ReadFile("migrations/006_patient_address_split.sql")
	}
	if err == nil && len(migrationSQL) > 0 {
		t.Log("  Executing Migration 006 SQL block...")
		if execErr := db.Exec(string(migrationSQL)).Error; execErr != nil {
			t.Logf("  Migration 006 exec note: %v", execErr)
		} else {
			t.Log("  Migration 006 executed successfully.")
		}
	} else {
		t.Logf("  Warning: could not read migration file directly: %v", err)
	}

	// 2. Query information_schema to verify all 9 new columns + legacy address column
	type ColCheck struct {
		ColumnName string `gorm:"column:column_name"`
		DataType   string `gorm:"column:data_type"`
		IsNullable string `gorm:"column:is_nullable"`
	}
	var cols []ColCheck
	err = db.Raw(`
		SELECT column_name, data_type, is_nullable
		FROM information_schema.columns
		WHERE table_name = 'patients'
		ORDER BY ordinal_position;
	`).Scan(&cols).Error

	if err != nil {
		t.Fatalf("Failed to query information_schema: %v", err)
	}

	expectedCols := map[string]bool{
		"house_no":     false,
		"village_no":   false,
		"village_name": false,
		"alley":        false,
		"road":         false,
		"sub_district": false,
		"district":     false,
		"province":     false,
		"postal_code":  false,
		"address":      false,
	}

	for _, c := range cols {
		if _, ok := expectedCols[c.ColumnName]; ok {
			expectedCols[c.ColumnName] = true
			t.Logf("  [FOUND] Column: %-15s | DataType: %-15s | Nullable: %s", c.ColumnName, c.DataType, c.IsNullable)
		}
	}

	for colName, found := range expectedCols {
		if !found {
			t.Errorf("Expected column '%s' in table 'patients', but not found in information_schema", colName)
		}
	}

	t.Log("================================================================================\n")
}

// TestSprint3_TaskB_AddressValidation tests negative validation cases for address
func TestSprint3_TaskB_AddressValidation(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	routes.SetUpRoutes(r)

	token := generateTestToken(2, "registrar")

	t.Log("================================================================================")
	t.Log("  [SPRINT 3 - TASK B] ADDRESS VALIDATION (NEGATIVE TEST CASES)")
	t.Log("================================================================================")

	// Case 1: Missing Province -> 400
	t.Run("Missing Province -> 400", func(t *testing.T) {
		payload := map[string]interface{}{
			"national_id":  "1234567890123",
			"fullname":     "ทดสอบ ขาดจังหวัด",
			"gender":       "ชาย",
			"birthdate":    "1990-01-01",
			"phone_number": "0812345678",
			"district":     "เมือง",
			// province is missing or empty
		}
		body, _ := json.Marshal(payload)
		req := httptest.NewRequest(http.MethodPost, "/api/registrar/patients", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusBadRequest {
			t.Errorf("Expected status 400 for missing province, got %d. Body: %s", w.Code, w.Body.String())
		} else {
			t.Logf("  [PASS] Missing province returned 400 Bad Request: %s", w.Body.String())
		}
	})

	// Case 2: Missing District -> 400
	t.Run("Missing District -> 400", func(t *testing.T) {
		payload := map[string]interface{}{
			"national_id":  "1234567890124",
			"fullname":     "ทดสอบ ขาดอำเภอ",
			"gender":       "หญิง",
			"birthdate":    "1992-05-15",
			"phone_number": "0812345679",
			"province":     "นครราชสีมา",
			// district is missing or empty
		}
		body, _ := json.Marshal(payload)
		req := httptest.NewRequest(http.MethodPost, "/api/registrar/patients", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusBadRequest {
			t.Errorf("Expected status 400 for missing district, got %d. Body: %s", w.Code, w.Body.String())
		} else {
			t.Logf("  [PASS] Missing district returned 400 Bad Request: %s", w.Body.String())
		}
	})

	// Case 3: Invalid Postal Code (not 5 digits) -> 400
	t.Run("Invalid Postal Code -> 400", func(t *testing.T) {
		invalidCodes := []string{"1234", "123456", "abcde", "12a45"}
		for _, pc := range invalidCodes {
			payload := map[string]interface{}{
				"national_id":  "1234567890125",
				"fullname":     "ทดสอบ รหัสไปรษณีย์ผิด",
				"gender":       "ชาย",
				"birthdate":    "1988-12-10",
				"phone_number": "0812345680",
				"province":     "กรุงเทพมหานคร",
				"district":     "ปทุมวัน",
				"postal_code":  pc,
			}
			body, _ := json.Marshal(payload)
			req := httptest.NewRequest(http.MethodPost, "/api/registrar/patients", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", "Bearer "+token)
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)

			if w.Code != http.StatusBadRequest {
				t.Errorf("Expected status 400 for invalid postal_code '%s', got %d. Body: %s", pc, w.Code, w.Body.String())
			} else {
				t.Logf("  [PASS] Invalid postal_code '%s' returned 400 Bad Request", pc)
			}
		}
	})

	t.Log("================================================================================\n")
}

// TestSprint3_TaskB_PatientRegistrationAndAddressComposition tests full patient registration
// with structured address fields and verifies DB persistence and address composition.
func TestSprint3_TaskB_PatientRegistrationAndAddressComposition(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	routes.SetUpRoutes(r)

	token := generateTestToken(2, "registrar")

	t.Log("================================================================================")
	t.Log("  [SPRINT 3 - TASK B] PATIENT REGISTRATION & AUTO-COMPOSE ADDRESS TEST")
	t.Log("================================================================================")

	// Clean up any test records
	testNID1 := "9876543210111"
	testNID2 := "9876543210222"
	cleanup := func() {
		var pIDs []uint
		config.DB.Model(&models.Patient{}).Where("national_id IN ?", []string{testNID1, testNID2}).Pluck("id", &pIDs)
		if len(pIDs) > 0 {
			config.DB.Where("patient_id IN ?", pIDs).Delete(&models.Queue{})
			config.DB.Where("patient_id IN ?", pIDs).Delete(&models.MedicalEligibility{})
			config.DB.Where("id IN ?", pIDs).Delete(&models.Patient{})
		}
	}
	cleanup()
	defer cleanup()

	// Test 1: Full structured address registration
	t.Run("Full Structured Address -> 201 & Verify Auto-Compose", func(t *testing.T) {
		payload := map[string]interface{}{
			"national_id":       testNID1,
			"fullname":          "นาย สมคิด พัฒนาสุข",
			"gender":            "ชาย",
			"birthdate":         "1985-06-20",
			"phone_number":      "0851112233",
			"emergency_contact": "0859998877",
			"scheme_type":       "บัตรทอง (สปสช.)",
			"allergies":         "Penicillin",
			"chronic_diseases":  "ความดันโลหิตสูง",
			"house_no":          "123/45",
			"village_no":        "3",
			"village_name":      "หมู่บ้านร่มรื่น",
			"alley":             "สุขใจ 5",
			"road":              "มิตรภาพ",
			"sub_district":      "ในเมือง",
			"district":          "เมืองนครราชสีมา",
			"province":          "นครราชสีมา",
			"postal_code":       "30000",
		}
		body, _ := json.Marshal(payload)
		req := httptest.NewRequest(http.MethodPost, "/api/registrar/patients", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusCreated {
			t.Fatalf("Expected status 201, got %d. Body: %s", w.Code, w.Body.String())
		}

		var createdResp struct {
			Message string         `json:"message"`
			Patient models.Patient `json:"patient"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &createdResp); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		// Verify patient fields from DB
		var dbPatient models.Patient
		if err := config.DB.Where("national_id = ?", testNID1).First(&dbPatient).Error; err != nil {
			t.Fatalf("Failed to find patient in DB: %v", err)
		}

		t.Logf("  Registered Patient ID: %d, HN: %s", dbPatient.ID, dbPatient.HN)
		t.Logf("  HouseNo: %s | VillageNo: %s | VillageName: %s", dbPatient.HouseNo, dbPatient.VillageNo, dbPatient.VillageName)
		t.Logf("  Alley: %s | Road: %s | SubDistrict: %s", dbPatient.Alley, dbPatient.Road, dbPatient.SubDistrict)
		t.Logf("  District: %s | Province: %s | PostalCode: %s", dbPatient.District, dbPatient.Province, dbPatient.PostalCode)
		t.Logf("  Composed Address: %s", dbPatient.Address)

		// Expected composed address:
		// "123/45 หมู่ 3 หมู่บ้านร่มรื่น ซ.สุขใจ 5 ถ.มิตรภาพ ต.ในเมือง อ.เมืองนครราชสีมา จ.นครราชสีมา 30000"
		expectedComposed := "123/45 หมู่ 3 หมู่บ้านร่มรื่น ซ.สุขใจ 5 ถ.มิตรภาพ ต.ในเมือง อ.เมืองนครราชสีมา จ.นครราชสีมา 30000"
		if dbPatient.Address != expectedComposed {
			t.Errorf("Address compose mismatch:\n  Expected: %s\n  Actual:   %s", expectedComposed, dbPatient.Address)
		} else {
			t.Log("  [PASS] Address composition matches standard contract perfectly.")
		}
	})

	// Test 2: Minimal Address (Province + District only)
	t.Run("Minimal Address (Province + District only) -> 201 & Auto-Compose", func(t *testing.T) {
		payload := map[string]interface{}{
			"national_id":  testNID2,
			"fullname":     "นางสาว รัตนา วงศ์สว่าง",
			"gender":       "หญิง",
			"birthdate":    "1995-10-12",
			"phone_number": "0898887766",
			"district":     "ปทุมวัน",
			"province":     "กรุงเทพมหานคร",
		}
		body, _ := json.Marshal(payload)
		req := httptest.NewRequest(http.MethodPost, "/api/registrar/patients", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusCreated {
			t.Fatalf("Expected status 201, got %d. Body: %s", w.Code, w.Body.String())
		}

		var dbPatient models.Patient
		if err := config.DB.Where("national_id = ?", testNID2).First(&dbPatient).Error; err != nil {
			t.Fatalf("Failed to find patient in DB: %v", err)
		}

		t.Logf("  Minimal Registered Patient Address: '%s'", dbPatient.Address)
		expectedMinimal := "อ.ปทุมวัน กรุงเทพมหานคร"
		if dbPatient.Address != expectedMinimal {
			t.Errorf("Address compose mismatch:\n  Expected: %s\n  Actual:   %s", expectedMinimal, dbPatient.Address)
		} else {
			t.Log("  [PASS] Minimal address composed cleanly without dangling prefixes or extra spaces.")
		}
	})

	t.Log("================================================================================\n")
}
