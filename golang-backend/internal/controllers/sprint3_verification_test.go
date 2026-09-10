package controllers_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"clinic-backend/internal/config"
	"clinic-backend/internal/controllers"
	"clinic-backend/internal/models"
	"clinic-backend/internal/routes"
	"clinic-backend/internal/testutils"

	"github.com/gin-gonic/gin"
)

// =========================================================================
// SPRINT 3 - Verification Suite: Structured Patient Address
// =========================================================================

// TestSprint3_TaskA_Migration006_Audit verifies that migration 006 runs cleanly
// and that all 9 new address columns exist in the database.
func TestSprint3_TaskA_Migration006_Audit(t *testing.T) {
	testutils.GuardAgainstProductionDB(t)
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
			"birthdate":    "01/01/2533",
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
			"birthdate":    "15/05/2535",
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
				"birthdate":    "10/12/1988",
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
			"birthdate":         "20/06/2528",
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
			"birthdate":    "12/10/1995",
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
		expectedMinimal := "เขตปทุมวัน กรุงเทพมหานคร"
		if dbPatient.Address != expectedMinimal {
			t.Errorf("Address compose mismatch:\n  Expected: %s\n  Actual:   %s", expectedMinimal, dbPatient.Address)
		} else {
			t.Log("  [PASS] Minimal address composed cleanly without dangling prefixes or extra spaces.")
		}
	})

	t.Log("================================================================================\n")
}

// TestSprint31_ComposeAddress_4Cases tests the 4 distinct address composition cases
func TestSprint31_ComposeAddress_4Cases(t *testing.T) {
	t.Log("================================================================================")
	t.Log("  [SPRINT 3.1 - TASK C] COMPOSE ADDRESS 4 CASES VERIFICATION")
	t.Log("================================================================================")

	// Case 1: Bangkok Full
	case1 := controllers.ComposeAddress("99/1", "", "", "ร่วมฤดี", "วิทยุ", "ลุมพินี", "ปทุมวัน", "กรุงเทพมหานคร", "10330", "")
	expected1 := "99/1 ซ.ร่วมฤดี ถ.วิทยุ แขวงลุมพินี เขตปทุมวัน กรุงเทพมหานคร 10330"
	t.Logf("Case 1 (Bangkok Full):    '%s'", case1)
	if case1 != expected1 {
		t.Errorf("Case 1 mismatch:\n  Expected: %s\n  Actual:   %s", expected1, case1)
	} else {
		t.Log("  [PASS] Case 1 correctly used 'แขวง' and 'เขต' prefixes with postal code.")
	}

	// Case 2: Bangkok Minimal
	case2 := controllers.ComposeAddress("", "", "", "", "", "", "ปทุมวัน", "กรุงเทพมหานคร", "", "")
	expected2 := "เขตปทุมวัน กรุงเทพมหานคร"
	t.Logf("Case 2 (Bangkok Minimal): '%s'", case2)
	if case2 != expected2 {
		t.Errorf("Case 2 mismatch:\n  Expected: %s\n  Actual:   %s", expected2, case2)
	} else {
		t.Log("  [PASS] Case 2 correctly used 'เขต' prefix for district in Bangkok without 'จ.'.")
	}

	// Case 3: Upcountry Full
	case3 := controllers.ComposeAddress("123/45", "3", "หมู่บ้านร่มรื่น", "สุขใจ 5", "มิตรภาพ", "ในเมือง", "เมืองนครราชสีมา", "นครราชสีมา", "30000", "")
	expected3 := "123/45 หมู่ 3 หมู่บ้านร่มรื่น ซ.สุขใจ 5 ถ.มิตรภาพ ต.ในเมือง อ.เมืองนครราชสีมา จ.นครราชสีมา 30000"
	t.Logf("Case 3 (Upcountry Full):  '%s'", case3)
	if case3 != expected3 {
		t.Errorf("Case 3 mismatch:\n  Expected: %s\n  Actual:   %s", expected3, case3)
	} else {
		t.Log("  [PASS] Case 3 correctly used 'ต.', 'อ.', 'จ.' prefixes.")
	}

	// Case 4: Upcountry Minimal
	case4 := controllers.ComposeAddress("", "", "", "", "", "", "เมืองนครราชสีมา", "นครราชสีมา", "", "")
	expected4 := "อ.เมืองนครราชสีมา จ.นครราชสีมา"
	t.Logf("Case 4 (Upcountry Minimal): '%s'", case4)
	if case4 != expected4 {
		t.Errorf("Case 4 mismatch:\n  Expected: %s\n  Actual:   %s", expected4, case4)
	} else {
		t.Log("  [PASS] Case 4 correctly used 'อ.' and 'จ.' prefixes without dangling tokens.")
	}

	t.Log("================================================================================\n")
}

// TestSprint31_UpdatePatient_AddressOverwrite tests updating an old patient with legacy address
func TestSprint31_UpdatePatient_AddressOverwrite(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	routes.SetUpRoutes(r)

	token := generateTestToken(2, "registrar")

	t.Log("================================================================================")
	t.Log("  [SPRINT 3.1 - TASK A2] PATIENT UPDATE & ADDRESS OVERWRITE TEST")
	t.Log("================================================================================")

	testNID := "9876543210999"
	// Cleanup test patient
	defer func() {
		var p models.Patient
		if err := config.DB.Where("national_id = ?", testNID).First(&p).Error; err == nil {
			config.DB.Where("patient_id = ?", p.ID).Delete(&models.Queue{})
			config.DB.Where("patient_id = ?", p.ID).Delete(&models.MedicalEligibility{})
			config.DB.Delete(&p)
		}
	}()

	// 1. Seed an old patient with ONLY legacy Address
	oldPatient := models.Patient{
		HN:               "HN9999",
		NationalID:       testNID,
		FullName:         "นายเก่า ทดสอบที่อยู่เดิม",
		Gender:           "ชาย",
		BirthDate:        time.Date(1980, 1, 1, 0, 0, 0, 0, time.UTC),
		PhoneNumber:      "0811112222",
		EmergencyContact: "0899990000",
		SchemeType:       "บัตรทอง (สปสช.)",
		Address:          "ข้อความที่อยู่เดิมแบบฟรีฟอร์ม 99/99 ถ.โบราณ",
	}
	if err := config.DB.Create(&oldPatient).Error; err != nil {
		t.Fatalf("Failed to seed old patient: %v", err)
	}

	t.Logf("  [BEFORE UPDATE] Patient ID: %d, HN: %s", oldPatient.ID, oldPatient.HN)
	t.Logf("  [BEFORE UPDATE] Address: '%s'", oldPatient.Address)
	t.Logf("  [BEFORE UPDATE] HouseNo: '%s', District: '%s', Province: '%s'", oldPatient.HouseNo, oldPatient.District, oldPatient.Province)

	// 2. Call PUT /api/registrar/patients/:id with structured address fields
	updatePayload := map[string]interface{}{
		"house_no":     "88/1",
		"alley":        "สุขุมวิท 21",
		"road":         "สุขุมวิท",
		"sub_district": "คลองเตยเหนือ",
		"district":     "วัฒนา",
		"province":     "กรุงเทพมหานคร",
		"postal_code":  "10110",
	}
	body, _ := json.Marshal(updatePayload)
	req := httptest.NewRequest(http.MethodPut, fmt.Sprintf("/api/registrar/patients/%d", oldPatient.ID), bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected status 200, got %d. Body: %s", w.Code, w.Body.String())
	}

	// 3. Query DB to verify address was overwritten with newly composed address
	var updatedPatient models.Patient
	if err := config.DB.First(&updatedPatient, oldPatient.ID).Error; err != nil {
		t.Fatalf("Failed to fetch updated patient: %v", err)
	}

	t.Logf("  [AFTER UPDATE] Patient ID: %d, HN: %s", updatedPatient.ID, updatedPatient.HN)
	t.Logf("  [AFTER UPDATE] Address: '%s'", updatedPatient.Address)
	t.Logf("  [AFTER UPDATE] HouseNo: '%s', Subdistrict: '%s', District: '%s', Province: '%s'", updatedPatient.HouseNo, updatedPatient.SubDistrict, updatedPatient.District, updatedPatient.Province)

	expectedNewAddress := "88/1 ซ.สุขุมวิท 21 ถ.สุขุมวิท แขวงคลองเตยเหนือ เขตวัฒนา กรุงเทพมหานคร 10110"
	if updatedPatient.Address != expectedNewAddress {
		t.Errorf("Address overwrite mismatch:\n  Expected: %s\n  Actual:   %s", expectedNewAddress, updatedPatient.Address)
	} else {
		t.Log("  [PASS] Address was successfully overwritten with newly composed string upon patient update!")
	}

	t.Log("================================================================================\n")
}

// =========================================================================
// SPRINT 3.2 - Auto-Queue Flag Verification Suite (B6706265)
// =========================================================================

// TestSprint32_TaskC_AutoQueueVerification tests the issue_queue flag, response format, duplicate handling, and regression
func TestSprint32_TaskC_AutoQueueVerification(t *testing.T) {
	testutils.GuardAgainstProductionDB(t)
	gin.SetMode(gin.TestMode)
	r := gin.New()
	routes.SetUpRoutes(r)

	token := generateTestToken(2, "registrar")

	t.Log("================================================================================")
	t.Log("  [SPRINT 3.2 - TASK C] AUTO-QUEUE FLAG & RESPONSE FORMAT VERIFICATION")
	t.Log("================================================================================")

	nidC1_1 := "1234567890001"
	nidC1_2 := "1234567890002"
	nidC1_3 := "1234567890003"

	// Cleanup test patients
	defer func() {
		var pIDs []uint
		config.DB.Model(&models.Patient{}).Where("national_id IN ?", []string{nidC1_1, nidC1_2, nidC1_3}).Pluck("id", &pIDs)
		if len(pIDs) > 0 {
			config.DB.Where("patient_id IN ?", pIDs).Delete(&models.Queue{})
			config.DB.Where("patient_id IN ?", pIDs).Delete(&models.MedicalEligibility{})
			config.DB.Where("id IN ?", pIDs).Delete(&models.Patient{})
		}
	}()

	// -------------------------------------------------------------------------
	// C1.1: POST patients โดยไม่ส่ง issue_queue เลย
	// -------------------------------------------------------------------------
	var p1ID uint
	t.Run("C1.1_Without_issue_queue_param", func(t *testing.T) {
		payload := map[string]interface{}{
			"national_id":  nidC1_1,
			"fullname":     "นายทดสอบ ไม่ส่งคิวแฟลก",
			"gender":       "ชาย",
			"birthdate":    "10/05/2535",
			"phone_number": "0812340001",
			"district":     "บางรัก",
			"province":     "กรุงเทพมหานคร",
		}
		body, _ := json.Marshal(payload)
		req := httptest.NewRequest(http.MethodPost, "/api/registrar/patients", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusCreated {
			t.Fatalf("Expected 201, got %d: %s", w.Code, w.Body.String())
		}

		rawJSON := w.Body.String()
		t.Logf("  [RAW RESPONSE C1.1 (No issue_queue)]:\n  %s", rawJSON)

		var res struct {
			Message     string `json:"message"`
			HN          string `json:"hn"`
			PatientID   uint   `json:"patient_id"`
			QueueIssued bool   `json:"queue_issued"`
			QueueNumber string `json:"queue_number"`
		}
		_ = json.Unmarshal(w.Body.Bytes(), &res)
		p1ID = res.PatientID

		if res.QueueIssued != false {
			t.Errorf("Expected queue_issued: false, got: %v", res.QueueIssued)
		}
		if res.QueueNumber != "" {
			t.Errorf("Expected empty queue_number, got: %s", res.QueueNumber)
		}

		var qCount int64
		config.DB.Model(&models.Queue{}).Where("patient_id = ?", res.PatientID).Count(&qCount)
		if qCount != 0 {
			t.Errorf("Expected 0 queues in DB for patient %d, found: %d", res.PatientID, qCount)
		} else {
			t.Logf("  [PASS C1.1] Patient %s created without queue. DB queue count: 0", res.HN)
		}
	})

	// -------------------------------------------------------------------------
	// C1.2: POST patients ด้วย issue_queue: false
	// -------------------------------------------------------------------------
	t.Run("C1.2_With_issue_queue_false", func(t *testing.T) {
		payload := map[string]interface{}{
			"national_id":  nidC1_2,
			"fullname":     "นางทดสอบ ปิดคิวแฟลก",
			"gender":       "หญิง",
			"birthdate":    "20/11/1988",
			"phone_number": "0812340002",
			"district":     "สาทร",
			"province":     "กรุงเทพมหานคร",
			"issue_queue":  false,
		}
		body, _ := json.Marshal(payload)
		req := httptest.NewRequest(http.MethodPost, "/api/registrar/patients", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusCreated {
			t.Fatalf("Expected 201, got %d: %s", w.Code, w.Body.String())
		}

		rawJSON := w.Body.String()
		t.Logf("  [RAW RESPONSE C1.2 (issue_queue: false)]:\n  %s", rawJSON)

		var res struct {
			Message     string `json:"message"`
			HN          string `json:"hn"`
			PatientID   uint   `json:"patient_id"`
			QueueIssued bool   `json:"queue_issued"`
			QueueNumber string `json:"queue_number"`
		}
		_ = json.Unmarshal(w.Body.Bytes(), &res)

		if res.QueueIssued != false {
			t.Errorf("Expected queue_issued: false, got: %v", res.QueueIssued)
		}
		if res.QueueNumber != "" {
			t.Errorf("Expected empty queue_number, got: %s", res.QueueNumber)
		}

		var qCount int64
		config.DB.Model(&models.Queue{}).Where("patient_id = ?", res.PatientID).Count(&qCount)
		if qCount != 0 {
			t.Errorf("Expected 0 queues in DB for patient %d, found: %d", res.PatientID, qCount)
		} else {
			t.Logf("  [PASS C1.2] Patient %s created with issue_queue: false. DB queue count: 0", res.HN)
		}
	})

	// -------------------------------------------------------------------------
	// C1.3: POST patients ด้วย issue_queue: true
	// -------------------------------------------------------------------------
	var p3ID uint
	var p3QueueNumber string
	t.Run("C1.3_With_issue_queue_true", func(t *testing.T) {
		payload := map[string]interface{}{
			"national_id":  nidC1_3,
			"fullname":     "นายทดสอบ เปิดคิวแฟลก",
			"gender":       "ชาย",
			"birthdate":    "15/03/2538",
			"phone_number": "0812340003",
			"district":     "ปทุมวัน",
			"province":     "กรุงเทพมหานคร",
			"issue_queue":  true,
		}
		body, _ := json.Marshal(payload)
		req := httptest.NewRequest(http.MethodPost, "/api/registrar/patients", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusCreated {
			t.Fatalf("Expected 201, got %d: %s", w.Code, w.Body.String())
		}

		rawJSON := w.Body.String()
		t.Logf("  [RAW RESPONSE C1.3 (issue_queue: true)]:\n  %s", rawJSON)

		var res struct {
			Message     string `json:"message"`
			HN          string `json:"hn"`
			PatientID   uint   `json:"patient_id"`
			QueueIssued bool   `json:"queue_issued"`
			QueueNumber string `json:"queue_number"`
			QueueID     uint   `json:"queue_id"`
		}
		_ = json.Unmarshal(w.Body.Bytes(), &res)
		p3ID = res.PatientID
		p3QueueNumber = res.QueueNumber

		if res.QueueIssued != true {
			t.Errorf("Expected queue_issued: true, got: %v", res.QueueIssued)
		}
		if res.QueueNumber == "" {
			t.Errorf("Expected non-empty queue_number, got empty")
		}

		// Verify queue in DB
		var dbQueue models.Queue
		if err := config.DB.First(&dbQueue, res.QueueID).Error; err != nil {
			t.Fatalf("Queue record ID %d not found in DB: %v", res.QueueID, err)
		}

		if dbQueue.QueueNumber != res.QueueNumber {
			t.Errorf("DB queue_number (%s) != Response queue_number (%s)", dbQueue.QueueNumber, res.QueueNumber)
		}
		if dbQueue.Status != "รอคัดกรอง" {
			t.Errorf("Expected queue status 'รอคัดกรอง', got: %s", dbQueue.Status)
		}

		t.Logf("  [PASS C1.3] Patient %s created with queue %s (ID: %d, Status: %s)", res.HN, res.QueueNumber, res.QueueID, dbQueue.Status)
	})

	// -------------------------------------------------------------------------
	// C2: Duplicate Queue Handling
	// ลงทะเบียนด้วย issue_queue: true แล้วกดปุ่ม "ส่งเข้าคิว" ซ้ำทันที
	// -------------------------------------------------------------------------
	t.Run("C2_Duplicate_Queue_Behavior", func(t *testing.T) {
		t.Logf("  Calling POST /api/queue/create for Patient ID %d (who already has queue %s)...", p3ID, p3QueueNumber)
		qPayload := map[string]interface{}{
			"patient_id": p3ID,
			"department": "แผนกคัดกรอง",
			"note":       "ส่งเข้าคิวซ้ำโดยเจตนา",
		}
		body, _ := json.Marshal(qPayload)
		req := httptest.NewRequest(http.MethodPost, "/api/queue/create", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		rawJSON := w.Body.String()
		t.Logf("  [RAW RESPONSE C2 (Create 2nd Queue)]:\n  Status: %d | Body: %s", w.Code, rawJSON)

		var qList []models.Queue
		config.DB.Where("patient_id = ?", p3ID).Order("id asc").Find(&qList)
		t.Logf("  Total active queues for Patient ID %d in DB: %d", p3ID, len(qList))
		for idx, q := range qList {
			t.Logf("    Queue #%d: ID=%d, Number=%s, Status=%s, CreatedAt=%s", idx+1, q.ID, q.QueueNumber, q.Status, q.CreatedAt.Format(time.RFC3339))
		}
	})

	// -------------------------------------------------------------------------
	// C3: Regression: ปุ่ม "ส่งเข้าคิว" สำหรับคนไข้เดิม (ค้นหาแล้วส่งเข้าคิว)
	// -------------------------------------------------------------------------
	t.Run("C3_Regression_Assign_Queue_For_Existing_Patient", func(t *testing.T) {
		t.Logf("  Assigning queue to existing unqueued patient ID %d (%s)...", p1ID, nidC1_1)
		qPayload := map[string]interface{}{
			"patient_id": p1ID,
			"department": "แผนกคัดกรอง",
			"note":       "ส่งเข้าคิวจากการค้นหาคนไข้เดิม",
		}
		body, _ := json.Marshal(qPayload)
		req := httptest.NewRequest(http.MethodPost, "/api/queue/create", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusCreated {
			t.Fatalf("Expected 201 Created, got %d: %s", w.Code, w.Body.String())
		}

		rawJSON := w.Body.String()
		t.Logf("  [RAW RESPONSE C3 (Assign Queue Existing Patient)]:\n  %s", rawJSON)

		var res struct {
			Queue models.Queue `json:"queue"`
		}
		_ = json.Unmarshal(w.Body.Bytes(), &res)

		if res.Queue.QueueNumber == "" {
			t.Errorf("Expected valid queue number, got empty")
		} else {
			t.Logf("  [PASS C3] Existing patient successfully assigned queue: %s (ID: %d)", res.Queue.QueueNumber, res.Queue.ID)
		}
	})

	// -------------------------------------------------------------------------
	// C4: Hexadecimal 4-digit Format Verification (Q0001-QFFFF)
	// -------------------------------------------------------------------------
	t.Run("C4_Queue_Number_Hex_Format", func(t *testing.T) {
		var allTodayQueues []models.Queue
		config.DB.Order("id desc").Limit(10).Find(&allTodayQueues)
		for _, q := range allTodayQueues {
			if len(q.QueueNumber) < 5 || q.QueueNumber[0] != 'Q' {
				t.Errorf("Queue number %s does not start with 'Q' or is too short", q.QueueNumber)
			}
			hexPart := q.QueueNumber[1:]
			var val int64
			if _, err := fmt.Sscanf(hexPart, "%X", &val); err != nil {
				t.Errorf("Queue number %s has invalid hex digits: %v", q.QueueNumber, err)
			} else {
				t.Logf("  [PASS C4] Queue %s is valid 4-digit Hex (decimal value: %d)", q.QueueNumber, val)
			}
		}
	})

	t.Log("================================================================================\n")
}

// =========================================================================
// TASK D: Centralized Birth Date & Flexible Date Parser Verification
// =========================================================================
func TestSprint32_TaskD_BirthDateParserAndValidation(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	routes.SetUpRoutes(r)

	token := generateTestToken(1, "registrar")

	t.Log("================================================================================")
	t.Log("  [SPRINT 3.2 - TASK D] BIRTH DATE PARSER & VALIDATION TEST SUITE")
	t.Log("================================================================================")

	nidD1 := "9000000000001"
	nidD2 := "9000000000002"
	nidD3 := "9000000000003"
	nidD4 := "9000000000004"
	nidD5 := "9000000000005"

	// Cleanup before & after
	cleanup := func() {
		var pIDs []uint
		config.DB.Model(&models.Patient{}).Where("national_id IN ?", []string{nidD1, nidD2, nidD3, nidD4, nidD5}).Pluck("id", &pIDs)
		if len(pIDs) > 0 {
			config.DB.Where("patient_id IN ?", pIDs).Delete(&models.Queue{})
			config.DB.Where("patient_id IN ?", pIDs).Delete(&models.MedicalEligibility{})
			config.DB.Where("id IN ?", pIDs).Delete(&models.Patient{})
		}
	}
	cleanup()
	defer cleanup()

	// D1: Register with Buddhist Era (พ.ศ.) "12/05/2549" -> 201 -> DB has 2006-05-12
	t.Run("D1_BE_Slash_12_05_2549", func(t *testing.T) {
		payload := map[string]interface{}{
			"national_id":  nidD1,
			"fullname":     "นายทดสอบ พ.ศ. สแลช",
			"gender":       "ชาย",
			"birthdate":    "12/05/2549",
			"phone_number": "0810001111",
			"district":     "เมือง",
			"province":     "นครราชสีมา",
		}
		body, _ := json.Marshal(payload)
		req := httptest.NewRequest(http.MethodPost, "/api/registrar/patients", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusCreated {
			t.Fatalf("Expected 201 Created, got %d: %s", w.Code, w.Body.String())
		}

		var p models.Patient
		if err := config.DB.Where("national_id = ?", nidD1).First(&p).Error; err != nil {
			t.Fatalf("Patient not found in DB: %v", err)
		}

		if p.BirthDate.Year() != 2006 || p.BirthDate.Month() != time.May || p.BirthDate.Day() != 12 {
			t.Errorf("DB BirthDate mismatch for 12/05/2549: expected 2006-05-12, got %s", p.BirthDate.Format("2006-01-02"))
		} else {
			t.Logf("  [PASS D1] 12/05/2549 (พ.ศ.) -> DB BirthDate: %s (Year: %d, Month: %d, Day: %d)",
				p.BirthDate.Format("2006-01-02"), p.BirthDate.Year(), p.BirthDate.Month(), p.BirthDate.Day())
		}
	})

	// D2: Register with Common Era (ค.ศ.) "12/05/2006" -> 201 -> DB has 2006-05-12
	t.Run("D2_CE_Slash_12_05_2006", func(t *testing.T) {
		payload := map[string]interface{}{
			"national_id":  nidD2,
			"fullname":     "นายทดสอบ ค.ศ. สแลช",
			"gender":       "ชาย",
			"birthdate":    "12/05/2006",
			"phone_number": "0810002222",
			"district":     "เมือง",
			"province":     "นครราชสีมา",
		}
		body, _ := json.Marshal(payload)
		req := httptest.NewRequest(http.MethodPost, "/api/registrar/patients", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusCreated {
			t.Fatalf("Expected 201 Created, got %d: %s", w.Code, w.Body.String())
		}

		var p models.Patient
		if err := config.DB.Where("national_id = ?", nidD2).First(&p).Error; err != nil {
			t.Fatalf("Patient not found in DB: %v", err)
		}

		if p.BirthDate.Year() != 2006 || p.BirthDate.Month() != time.May || p.BirthDate.Day() != 12 {
			t.Errorf("DB BirthDate mismatch for 12/05/2006: expected 2006-05-12, got %s", p.BirthDate.Format("2006-01-02"))
		} else {
			t.Logf("  [PASS D2] 12/05/2006 (ค.ศ.) -> DB BirthDate: %s", p.BirthDate.Format("2006-01-02"))
		}
	})

	// D3: Register with Dash Buddhist Era "12-05-2549" -> 201 -> DB has 2006-05-12
	t.Run("D3_BE_Dash_12_05_2549", func(t *testing.T) {
		payload := map[string]interface{}{
			"national_id":  nidD3,
			"fullname":     "นายทดสอบ พ.ศ. แดช",
			"gender":       "ชาย",
			"birthdate":    "12-05-2549",
			"phone_number": "0810003333",
			"district":     "เมือง",
			"province":     "นครราชสีมา",
		}
		body, _ := json.Marshal(payload)
		req := httptest.NewRequest(http.MethodPost, "/api/registrar/patients", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusCreated {
			t.Fatalf("Expected 201 Created, got %d: %s", w.Code, w.Body.String())
		}

		var p models.Patient
		if err := config.DB.Where("national_id = ?", nidD3).First(&p).Error; err != nil {
			t.Fatalf("Patient not found in DB: %v", err)
		}

		if p.BirthDate.Year() != 2006 || p.BirthDate.Month() != time.May || p.BirthDate.Day() != 12 {
			t.Errorf("DB BirthDate mismatch for 12-05-2549: expected 2006-05-12, got %s", p.BirthDate.Format("2006-01-02"))
		} else {
			t.Logf("  [PASS D3] 12-05-2549 (พ.ศ. Dash) -> DB BirthDate: %s", p.BirthDate.Format("2006-01-02"))
		}
	})

	// D4: Negative Test - Invalid date string -> 400 Bad Request
	t.Run("D4_Negative_Invalid_String -> 400", func(t *testing.T) {
		payload := map[string]interface{}{
			"national_id":  nidD4,
			"fullname":     "นายทดสอบ วันที่ผิด",
			"gender":       "ชาย",
			"birthdate":    "invalid-date-format",
			"phone_number": "0810004444",
			"district":     "เมือง",
			"province":     "นครราชสีมา",
		}
		body, _ := json.Marshal(payload)
		req := httptest.NewRequest(http.MethodPost, "/api/registrar/patients", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusBadRequest {
			t.Errorf("Expected status 400 for invalid date, got %d: %s", w.Code, w.Body.String())
		} else {
			t.Logf("  [PASS D4] Invalid date string returned 400 Bad Request: %s", w.Body.String())
		}
	})

	// D5: Negative Test - Impossible date 31/02/2549 -> 400 Bad Request
	t.Run("D5_Negative_Impossible_Date_31_02_2549 -> 400", func(t *testing.T) {
		payload := map[string]interface{}{
			"national_id":  nidD5,
			"fullname":     "นายทดสอบ กุมภา 31",
			"gender":       "ชาย",
			"birthdate":    "31/02/2549",
			"phone_number": "0810005555",
			"district":     "เมือง",
			"province":     "นครราชสีมา",
		}
		body, _ := json.Marshal(payload)
		req := httptest.NewRequest(http.MethodPost, "/api/registrar/patients", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusBadRequest {
			t.Errorf("Expected status 400 for 31/02/2549, got %d: %s", w.Code, w.Body.String())
		} else {
			t.Logf("  [PASS D5] 31/02/2549 returned 400 Bad Request: %s", w.Body.String())
		}
	})

	// D6: UpdatePatient with birthdate in BE (15/08/2540 -> 1997-08-15)
	t.Run("D6_UpdatePatient_BirthDate_BE", func(t *testing.T) {
		var p models.Patient
		config.DB.Where("national_id = ?", nidD1).First(&p)

		updatePayload := map[string]interface{}{
			"birthdate": "15/08/2540",
		}
		body, _ := json.Marshal(updatePayload)
		req := httptest.NewRequest(http.MethodPut, fmt.Sprintf("/api/registrar/patients/%d", p.ID), bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("Expected 200 OK for UpdatePatient, got %d: %s", w.Code, w.Body.String())
		}

		var updated models.Patient
		config.DB.First(&updated, p.ID)
		if updated.BirthDate.Year() != 1997 || updated.BirthDate.Month() != time.August || updated.BirthDate.Day() != 15 {
			t.Errorf("DB BirthDate not updated properly: expected 1997-08-15, got %s", updated.BirthDate.Format("2006-01-02"))
		} else {
			t.Logf("  [PASS D6] UpdatePatient birthdate 15/08/2540 updated DB to: %s", updated.BirthDate.Format("2006-01-02"))
		}
	})

	// D7: UpdatePatient with invalid date -> 400 Bad Request
	t.Run("D7_UpdatePatient_Invalid_BirthDate -> 400", func(t *testing.T) {
		var p models.Patient
		config.DB.Where("national_id = ?", nidD1).First(&p)

		updatePayload := map[string]interface{}{
			"birthdate": "invalid-update-date",
		}
		body, _ := json.Marshal(updatePayload)
		req := httptest.NewRequest(http.MethodPut, fmt.Sprintf("/api/registrar/patients/%d", p.ID), bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusBadRequest {
			t.Errorf("Expected 400 Bad Request for invalid birthdate on update, got %d: %s", w.Code, w.Body.String())
		} else {
			t.Logf("  [PASS D7] UpdatePatient with invalid birthdate returned 400: %s", w.Body.String())
		}
	})

	// D8: SavePatientEligibility with ExpireDate in BE (31/12/2570 -> 2027-12-31)
	t.Run("D8_SavePatientEligibility_BE_ExpireDate", func(t *testing.T) {
		var p models.Patient
		config.DB.Where("national_id = ?", nidD1).First(&p)

		eligPayload := map[string]interface{}{
			"patient_id":       p.ID,
			"scheme_type":      "สิทธิ์ข้าราชการ",
			"coverage_details": "เบิกจ่ายตรงกรมบัญชีกลาง",
			"hospital_name":    "โรงพยาบาลมหาราชนครราชสีมา",
			"status":           "ใช้งานได้",
			"expire_date":      "31/12/2570",
		}
		body, _ := json.Marshal(eligPayload)
		req := httptest.NewRequest(http.MethodPost, "/api/registrar/eligibility/save", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("Expected 200 OK for SavePatientEligibility, got %d: %s", w.Code, w.Body.String())
		}

		var elig models.MedicalEligibility
		if err := config.DB.Where("patient_id = ?", p.ID).First(&elig).Error; err != nil {
			t.Fatalf("Eligibility record not found: %v", err)
		}

		if elig.ExpireDate == nil || elig.ExpireDate.Year() != 2027 || elig.ExpireDate.Month() != time.December || elig.ExpireDate.Day() != 31 {
			t.Errorf("Eligibility ExpireDate mismatch: expected 2027-12-31, got %v", elig.ExpireDate)
		} else {
			t.Logf("  [PASS D8] SavePatientEligibility expire_date '31/12/2570' saved as: %s", elig.ExpireDate.Format("2006-01-02"))
		}
	})

	// D9: Negative Test - SavePatientEligibility with invalid date -> 400 Bad Request
	t.Run("D9_SavePatientEligibility_Invalid_ExpireDate -> 400", func(t *testing.T) {
		var p models.Patient
		config.DB.Where("national_id = ?", nidD1).First(&p)

		eligPayload := map[string]interface{}{
			"patient_id":  p.ID,
			"scheme_type": "บัตรทอง",
			"expire_date": "not-a-valid-date",
		}
		body, _ := json.Marshal(eligPayload)
		req := httptest.NewRequest(http.MethodPost, "/api/registrar/eligibility/save", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusBadRequest {
			t.Errorf("Expected 400 Bad Request for invalid eligibility expire date, got %d: %s", w.Code, w.Body.String())
		} else {
			t.Logf("  [PASS D9] Invalid expire_date returned 400 Bad Request: %s", w.Body.String())
		}
	})

	t.Log("================================================================================\n")
}


