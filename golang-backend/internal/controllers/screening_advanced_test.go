package controllers_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"clinic-backend/internal/config"
	"clinic-backend/internal/controllers"
	"clinic-backend/internal/models"
	"clinic-backend/internal/routes"

	"github.com/gin-gonic/gin"
)

// Helper to create router for tests
func setupTestRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.Default()
	routes.SetUpRoutes(r)
	return r
}

// Helper to create test patient and queue
func createTestPatientAndQueue(t *testing.T, gender string) (models.Patient, models.Queue) {
	db := config.DB
	if db == nil {
		t.Fatal("DB not initialized")
	}

	uniqueSuffix := fmt.Sprintf("%d", time.Now().UnixNano()%1000000000000)
	natID := fmt.Sprintf("9%012s", uniqueSuffix)
	if len(natID) > 13 {
		natID = natID[:13]
	}

	p := models.Patient{
		HN:          fmt.Sprintf("HN%04X", time.Now().UnixNano()%65535),
		FullName:    "ทดสอบ ระบบคัดกรอง " + uniqueSuffix,
		NationalID:  natID,
		Gender:      gender,
		BirthDate:   time.Date(1995, 5, 15, 0, 0, 0, 0, time.UTC),
		PhoneNumber: "0812345678",
		SchemeType:  "บัตรทอง (สปสช.)",
	}
	if err := db.Create(&p).Error; err != nil {
		t.Fatalf("Failed to create test patient: %v", err)
	}

	var testUser models.User
	db.First(&testUser)

	q := models.Queue{
		QueueNumber:     fmt.Sprintf("Q%04X", time.Now().UnixNano()%65535),
		PatientID:       p.ID,
		CreatedByUserID: testUser.ID,
		Status:          "รอคัดกรอง",
		CreatedAt:       time.Now(),
	}
	if err := db.Create(&q).Error; err != nil {
		t.Fatalf("Failed to create test queue: %v", err)
	}

	return p, q
}

// TestScreening_AdvancedFields_Success tests recording all advanced fields for a female patient
func TestScreening_AdvancedFields_Success(t *testing.T) {
	r := setupTestRouter()
	token := generateTestToken(2, "nurse")

	patient, queue := createTestPatientAndQueue(t, "หญิง")

	hasURI := true
	hasTB := false
	onAnticoagulant := true
	isPregnant := true
	isBreastfeeding := false
	q2Depressed := true
	q2Anhedonia := false

	reqBody := controllers.RecordVitalsReq{
		QueueID:             queue.ID,
		PatientID:           patient.ID,
		QueueNumber:         queue.QueueNumber,
		Weight:              55.5,
		Height:              160,
		Temperature:         37.2,
		SystolicBP:          120,
		DiastolicBP:         80,
		HeartRate:           75,
		RespiratoryRate:     18,
		SpO2:                98,
		PainScore:           2,
		BloodSugar:          95,
		ChiefComplaint:      "มีไข้ต่ำๆ และเจ็บคอ 2 วัน",
		NurseNotes:          "ผู้ป่วยแจ้งว่าทานยาพาราเซตามอลมา 1 เม็ดก่อนมาโรงพยาบาล",
		HerbalMedicines:     "ฟ้าทะลายโจร",
		DietarySupplements:  "วิตามินซี 1000mg",
		HasURI:              &hasURI,
		HasTB:               &hasTB,
		OnAnticoagulant:     &onAnticoagulant,
		PrecautionType:      "Droplet",
		IsPregnant:          &isPregnant,
		IsBreastfeeding:     &isBreastfeeding,
		LastMenstrualPeriod: "2026-02-15",
		Q2Depressed:         &q2Depressed,
		Q2Anhedonia:         &q2Anhedonia,
		TriageLevel:         4,
		AssignedDoctorID:    4,
	}

	bodyBytes, _ := json.Marshal(reqBody)
	req, _ := http.NewRequest(http.MethodPost, "/api/nurse/vitals", bytes.NewBuffer(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("Expected HTTP 201 Created, got %d: %s", w.Code, w.Body.String())
	}

	var res struct {
		Message           string            `json:"message"`
		ScreeningPositive *bool             `json:"screening_positive"`
		Screening         *models.Screening `json:"screening"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &res); err != nil {
		t.Fatalf("Failed to parse response JSON: %v", err)
	}

	if res.ScreeningPositive == nil || *res.ScreeningPositive != true {
		t.Errorf("Expected ScreeningPositive to be true, got %v", res.ScreeningPositive)
	}

	// Verify database record
	var visit models.VisitRecord
	if err := config.DB.Where("queue_id = ?", queue.ID).First(&visit).Error; err != nil {
		t.Fatalf("Failed to find visit in DB: %v", err)
	}

	var screening models.Screening
	if err := config.DB.Where("visit_id = ?", visit.ID).First(&screening).Error; err != nil {
		t.Fatalf("Failed to find screening in DB: %v", err)
	}

	if screening.NurseNotes != reqBody.NurseNotes {
		t.Errorf("Expected NurseNotes %q, got %q", reqBody.NurseNotes, screening.NurseNotes)
	}
	if screening.HerbalMedicines != reqBody.HerbalMedicines {
		t.Errorf("Expected HerbalMedicines %q, got %q", reqBody.HerbalMedicines, screening.HerbalMedicines)
	}
	if screening.DietarySupplements != reqBody.DietarySupplements {
		t.Errorf("Expected DietarySupplements %q, got %q", reqBody.DietarySupplements, screening.DietarySupplements)
	}
	if screening.PrecautionType != "Droplet" {
		t.Errorf("Expected PrecautionType Droplet, got %q", screening.PrecautionType)
	}
	if screening.HasURI == nil || *screening.HasURI != true {
		t.Errorf("Expected HasURI true, got %v", screening.HasURI)
	}
	if screening.HasTB == nil || *screening.HasTB != false {
		t.Errorf("Expected HasTB false, got %v", screening.HasTB)
	}
	if screening.OnAnticoagulant == nil || *screening.OnAnticoagulant != true {
		t.Errorf("Expected OnAnticoagulant true, got %v", screening.OnAnticoagulant)
	}
	if screening.IsPregnant == nil || *screening.IsPregnant != true {
		t.Errorf("Expected IsPregnant true, got %v", screening.IsPregnant)
	}
	if screening.IsBreastfeeding == nil || *screening.IsBreastfeeding != false {
		t.Errorf("Expected IsBreastfeeding false, got %v", screening.IsBreastfeeding)
	}
	if screening.LastMenstrualPeriod != "2026-02-15" {
		t.Errorf("Expected LastMenstrualPeriod 2026-02-15, got %q", screening.LastMenstrualPeriod)
	}
	if screening.Q2Depressed == nil || *screening.Q2Depressed != true {
		t.Errorf("Expected Q2Depressed true, got %v", screening.Q2Depressed)
	}
	if screening.Q2Anhedonia == nil || *screening.Q2Anhedonia != false {
		t.Errorf("Expected Q2Anhedonia false, got %v", screening.Q2Anhedonia)
	}
	if screening.ScreeningPositive == nil || *screening.ScreeningPositive != true {
		t.Errorf("Expected ScreeningPositive true in DB, got %v", screening.ScreeningPositive)
	}
}

// TestScreening_2Q_ScoringLogic tests 2Q depression assessment permutations
func TestScreening_2Q_ScoringLogic(t *testing.T) {
	r := setupTestRouter()
	token := generateTestToken(2, "nurse")

	bTrue := true
	bFalse := false

	testCases := []struct {
		name             string
		q1               *bool
		q2               *bool
		expectedPositive *bool
	}{
		{"Q1 true, Q2 false -> Positive", &bTrue, &bFalse, &bTrue},
		{"Q1 false, Q2 true -> Positive", &bFalse, &bTrue, &bTrue},
		{"Q1 true, Q2 true -> Positive", &bTrue, &bTrue, &bTrue},
		{"Q1 false, Q2 false -> Negative", &bFalse, &bFalse, &bFalse},
		{"Q1 nil, Q2 nil -> Unassessed", nil, nil, nil},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			patient, queue := createTestPatientAndQueue(t, "หญิง")

			reqBody := controllers.RecordVitalsReq{
				QueueID:          queue.ID,
				PatientID:        patient.ID,
				QueueNumber:      queue.QueueNumber,
				Weight:           60,
				Height:           165,
				Temperature:      36.6,
				SystolicBP:       118,
				DiastolicBP:      76,
				HeartRate:        72,
				RespiratoryRate:  16,
				SpO2:             99,
				ChiefComplaint:   "ตรวจสุขภาพประจำปี",
				Q2Depressed:      tc.q1,
				Q2Anhedonia:      tc.q2,
				TriageLevel:      4,
				AssignedDoctorID: 4,
			}

			bodyBytes, _ := json.Marshal(reqBody)
			req, _ := http.NewRequest(http.MethodPost, "/api/nurse/vitals", bytes.NewBuffer(bodyBytes))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", "Bearer "+token)

			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)

			if w.Code != http.StatusCreated {
				t.Fatalf("Expected HTTP 201 Created, got %d: %s", w.Code, w.Body.String())
			}

			var visit models.VisitRecord
			if err := config.DB.Where("queue_id = ?", queue.ID).First(&visit).Error; err != nil {
				t.Fatalf("Failed to find visit in DB: %v", err)
			}

			var screening models.Screening
			if err := config.DB.Where("visit_id = ?", visit.ID).First(&screening).Error; err != nil {
				t.Fatalf("Failed to query screening from DB: %v", err)
			}

			if tc.expectedPositive == nil {
				if screening.ScreeningPositive != nil {
					t.Errorf("Expected nil screening_positive, got %v", *screening.ScreeningPositive)
				}
			} else {
				if screening.ScreeningPositive == nil || *screening.ScreeningPositive != *tc.expectedPositive {
					t.Errorf("Expected screening_positive %v, got %v", *tc.expectedPositive, screening.ScreeningPositive)
				}
			}
		})
	}
}

// TestScreening_InvalidPrecautionType tests validation of precaution_type
func TestScreening_InvalidPrecautionType(t *testing.T) {
	r := setupTestRouter()
	token := generateTestToken(2, "nurse")

	patient, queue := createTestPatientAndQueue(t, "ชาย")

	reqBody := controllers.RecordVitalsReq{
		QueueID:          queue.ID,
		PatientID:        patient.ID,
		QueueNumber:      queue.QueueNumber,
		Weight:           70,
		Height:           175,
		Temperature:      36.8,
		SystolicBP:       120,
		DiastolicBP:      80,
		HeartRate:        80,
		PrecautionType:   "HazardousBioRisk", // Invalid
		ChiefComplaint:   "ตรวจร่างกาย",
		TriageLevel:      4,
		AssignedDoctorID: 4,
	}

	bodyBytes, _ := json.Marshal(reqBody)
	req, _ := http.NewRequest(http.MethodPost, "/api/nurse/vitals", bytes.NewBuffer(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("Expected HTTP 400 Bad Request, got %d: %s", w.Code, w.Body.String())
	}
}

// TestScreening_MaleGender_RejectsPregnancy tests that female screening data is rejected for male patients
func TestScreening_MaleGender_RejectsPregnancy(t *testing.T) {
	r := setupTestRouter()
	token := generateTestToken(2, "nurse")

	bTrue := true

	// Subcase 1: Male with is_pregnant = true
	t.Run("Male with is_pregnant", func(t *testing.T) {
		patient, queue := createTestPatientAndQueue(t, "ชาย")

		reqBody := controllers.RecordVitalsReq{
			QueueID:          queue.ID,
			PatientID:        patient.ID,
			QueueNumber:      queue.QueueNumber,
			Weight:           70,
			Height:           175,
			Temperature:      36.8,
			SystolicBP:       120,
			DiastolicBP:      80,
			HeartRate:        80,
			IsPregnant:       &bTrue,
			ChiefComplaint:   "ตรวจร่างกาย",
			TriageLevel:      4,
			AssignedDoctorID: 4,
		}

		bodyBytes, _ := json.Marshal(reqBody)
		req, _ := http.NewRequest(http.MethodPost, "/api/nurse/vitals", bytes.NewBuffer(bodyBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)

		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("Expected HTTP 400 Bad Request for male with is_pregnant, got %d: %s", w.Code, w.Body.String())
		}
	})

	// Subcase 2: Male with is_breastfeeding = true
	t.Run("Male with is_breastfeeding", func(t *testing.T) {
		patient, queue := createTestPatientAndQueue(t, "ชาย")

		reqBody := controllers.RecordVitalsReq{
			QueueID:          queue.ID,
			PatientID:        patient.ID,
			QueueNumber:      queue.QueueNumber,
			Weight:           70,
			Height:           175,
			Temperature:      36.8,
			SystolicBP:       120,
			DiastolicBP:      80,
			HeartRate:        80,
			IsBreastfeeding:  &bTrue,
			ChiefComplaint:   "ตรวจร่างกาย",
			TriageLevel:      4,
			AssignedDoctorID: 4,
		}

		bodyBytes, _ := json.Marshal(reqBody)
		req, _ := http.NewRequest(http.MethodPost, "/api/nurse/vitals", bytes.NewBuffer(bodyBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)

		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("Expected HTTP 400 Bad Request for male with is_breastfeeding, got %d: %s", w.Code, w.Body.String())
		}
	})

	// Subcase 3: Male with last_menstrual_period
	t.Run("Male with last_menstrual_period", func(t *testing.T) {
		patient, queue := createTestPatientAndQueue(t, "ชาย")

		reqBody := controllers.RecordVitalsReq{
			QueueID:             queue.ID,
			PatientID:           patient.ID,
			QueueNumber:         queue.QueueNumber,
			Weight:              70,
			Height:              175,
			Temperature:         36.8,
			SystolicBP:          120,
			DiastolicBP:         80,
			HeartRate:           80,
			LastMenstrualPeriod: "2026-01-01",
			ChiefComplaint:      "ตรวจร่างกาย",
			TriageLevel:         4,
			AssignedDoctorID:    4,
		}

		bodyBytes, _ := json.Marshal(reqBody)
		req, _ := http.NewRequest(http.MethodPost, "/api/nurse/vitals", bytes.NewBuffer(bodyBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)

		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("Expected HTTP 400 Bad Request for male with last_menstrual_period, got %d: %s", w.Code, w.Body.String())
		}
	})
}

// TestScreening_FutureLMP_Rejects tests that future LMP date is rejected
func TestScreening_FutureLMP_Rejects(t *testing.T) {
	r := setupTestRouter()
	token := generateTestToken(2, "nurse")

	patient, queue := createTestPatientAndQueue(t, "หญิง")

	reqBody := controllers.RecordVitalsReq{
		QueueID:             queue.ID,
		PatientID:           patient.ID,
		QueueNumber:         queue.QueueNumber,
		Weight:              52,
		Height:              158,
		Temperature:         36.7,
		SystolicBP:          115,
		DiastolicBP:         75,
		HeartRate:           78,
		LastMenstrualPeriod: "2099-12-31", // Future date
		ChiefComplaint:      "ปวดท้อง",
		TriageLevel:         4,
		AssignedDoctorID:    4,
	}

	bodyBytes, _ := json.Marshal(reqBody)
	req, _ := http.NewRequest(http.MethodPost, "/api/nurse/vitals", bytes.NewBuffer(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("Expected HTTP 400 Bad Request for future LMP, got %d: %s", w.Code, w.Body.String())
	}
}

// TestScreening_BackwardCompatibility_OmittedFields tests that requests without new fields work normally
func TestScreening_BackwardCompatibility_OmittedFields(t *testing.T) {
	r := setupTestRouter()
	token := generateTestToken(2, "nurse")

	patient, queue := createTestPatientAndQueue(t, "ชาย")

	reqBody := controllers.RecordVitalsReq{
		QueueID:          queue.ID,
		PatientID:        patient.ID,
		QueueNumber:      queue.QueueNumber,
		Weight:           68,
		Height:           172,
		Temperature:      36.5,
		SystolicBP:       120,
		DiastolicBP:      80,
		HeartRate:        75,
		RespiratoryRate:  18,
		SpO2:             98,
		PainScore:        0,
		BloodSugar:       90,
		ChiefComplaint:   "ตรวจสุขภาพทั่วไป",
		TriageLevel:      4,
		AssignedDoctorID: 4,
	}

	bodyBytes, _ := json.Marshal(reqBody)
	req, _ := http.NewRequest(http.MethodPost, "/api/nurse/vitals", bytes.NewBuffer(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("Expected HTTP 201 Created, got %d: %s", w.Code, w.Body.String())
	}
}
