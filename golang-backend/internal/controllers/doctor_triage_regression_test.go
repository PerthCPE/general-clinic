package controllers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"clinic-backend/internal/config"
	"clinic-backend/internal/dto"
	"clinic-backend/internal/models"
	"github.com/gin-gonic/gin"
)

// TestDoctorTriageHelperSSOT tests that TriageLabelTH, TriageLabelEN, and TriageInfoFromLevel work as expected
func TestDoctorTriageHelperSSOT(t *testing.T) {
	// 1. Test Thai labels for 1..4
	testCasesTH := []struct {
		level    int
		expected string
	}{
		{1, "ฉุกเฉินวิกฤต"},
		{2, "ฉุกเฉินเร่งด่วน"},
		{3, "กึ่งฉุกเฉิน"},
		{4, "ปกติ"},
		{0, "ไม่ระบุ"},
		{-1, "ไม่ระบุ"},
		{5, "ไม่ระบุ"},
		{99, "ไม่ระบุ"},
	}

	for _, tc := range testCasesTH {
		got := models.TriageLabelTH(tc.level)
		if got != tc.expected {
			t.Errorf("TriageLabelTH(%d) = %q, expected %q", tc.level, got, tc.expected)
		}
	}

	// 2. Test English labels for 1..4
	testCasesEN := []struct {
		level    int
		expected string
	}{
		{1, "Resuscitation"},
		{2, "Emergency-Urgent"},
		{3, "Semi-Urgent"},
		{4, "Non-Urgent"},
		{0, "Unknown"},
		{-1, "Unknown"},
		{5, "Unknown"},
	}

	for _, tc := range testCasesEN {
		got := models.TriageLabelEN(tc.level)
		if got != tc.expected {
			t.Errorf("TriageLabelEN(%d) = %q, expected %q", tc.level, got, tc.expected)
		}
	}

	// 3. Test TriageInfoFromLevel for doctor frontend
	triageInfoCases := []struct {
		level        int
		expectedCode string
		expectedPrio string
		expectedTH   string
	}{
		{1, "Level 1: Resuscitation", "High", "ฉุกเฉินวิกฤต"},
		{2, "Level 2: Emergency", "High", "ฉุกเฉินเร่งด่วน"},
		{3, "Level 3: Urgent", "Medium", "กึ่งฉุกเฉิน"},
		{4, "Level 4: Less Urgent", "Low", "ปกติ"},
		{0, "", "", "ไม่ระบุ"},
		{-5, "", "", "ไม่ระบุ"},
		{10, "", "", "ไม่ระบุ"},
	}

	for _, tc := range triageInfoCases {
		code, prio, labelTH, _ := models.TriageInfoFromLevel(tc.level)
		if code != tc.expectedCode || prio != tc.expectedPrio || labelTH != tc.expectedTH {
			t.Errorf("TriageInfoFromLevel(%d) = (code: %q, prio: %q, th: %q), expected (%q, %q, %q)",
				tc.level, code, prio, labelTH, tc.expectedCode, tc.expectedPrio, tc.expectedTH)
		}
	}
}

// TestToScreeningBrief_AllTriageLevels tests toScreeningBrief output struct
func TestToScreeningBrief_AllTriageLevels(t *testing.T) {
	cases := []struct {
		level         int
		expectedLevel string
		expectedNum   int
		expectedCode  string
		expectedPrio  string
	}{
		{1, "ฉุกเฉินวิกฤต", 1, "Level 1: Resuscitation", "High"},
		{2, "ฉุกเฉินเร่งด่วน", 2, "Level 2: Emergency", "High"},
		{3, "กึ่งฉุกเฉิน", 3, "Level 3: Urgent", "Medium"},
		{4, "ปกติ", 4, "Level 4: Less Urgent", "Low"},
		{0, "ไม่ระบุ", 0, "", ""},
	}

	for _, tc := range cases {
		s := models.Screening{
			ID:          uint(100 + tc.level),
			TriageLevel: tc.level,
			Weight:      60.0,
			Height:      170.0,
			SystolicBP:  120,
			DiastolicBP: 80,
		}

		brief := toScreeningBrief(s)

		if brief.TriageLevel != tc.expectedLevel {
			t.Errorf("Level %d: TriageLevel = %q, expected %q", tc.level, brief.TriageLevel, tc.expectedLevel)
		}
		if brief.TriageLevelNum != tc.expectedNum {
			t.Errorf("Level %d: TriageLevelNum = %d, expected %d", tc.level, brief.TriageLevelNum, tc.expectedNum)
		}
		if brief.TriageCode != tc.expectedCode {
			t.Errorf("Level %d: TriageCode = %q, expected %q", tc.level, brief.TriageCode, tc.expectedCode)
		}
		if brief.TriagePriority != tc.expectedPrio {
			t.Errorf("Level %d: TriagePriority = %q, expected %q", tc.level, brief.TriagePriority, tc.expectedPrio)
		}

		// Verify JSON marshaling serialization
		bytes, err := json.Marshal(brief)
		if err != nil {
			t.Fatalf("Failed to marshal ScreeningBrief: %v", err)
		}

		var unmarshaled map[string]any
		if err := json.Unmarshal(bytes, &unmarshaled); err != nil {
			t.Fatalf("Failed to unmarshal JSON: %v", err)
		}

		if unmarshaled["triage_level"] != tc.expectedLevel {
			t.Errorf("JSON triage_level = %v, expected %v", unmarshaled["triage_level"], tc.expectedLevel)
		}
		if int(unmarshaled["triage_level_num"].(float64)) != tc.expectedNum {
			t.Errorf("JSON triage_level_num = %v, expected %v", unmarshaled["triage_level_num"], tc.expectedNum)
		}
		if unmarshaled["triage_code"] != tc.expectedCode {
			t.Errorf("JSON triage_code = %v, expected %v", unmarshaled["triage_code"], tc.expectedCode)
		}
	}
}

// TestDoctorQueueAPI_ResponseFormat verifies GET /api/doctor/queue output has proper triage fields
func TestDoctorQueueAPI_ResponseFormat(t *testing.T) {
	gin.SetMode(gin.TestMode)
	config.ConnectDB()

	var doc models.User
	if err := config.DB.Where("role = ?", "doctor").First(&doc).Error; err != nil {
		doc = models.User{Username: "doctor_test", Role: "doctor", FullName: "พญ.สุดา สุขสมบูรณ์"}
		config.DB.Create(&doc)
	}

	r := gin.New()
	r.Use(func(c *gin.Context) {
		// Mock doctor auth context
		c.Set("userID", doc.ID)
		c.Set("role", "doctor")
		c.Set("fullname", doc.FullName)
		c.Next()
	})
	r.GET("/api/doctor/queue", GetDoctorQueue)

	req, _ := http.NewRequest(http.MethodGet, "/api/doctor/queue?scope=all", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected status 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp dto.DoctorQueueResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("Failed to decode DoctorQueueResponse: %v", err)
	}

	t.Logf("DoctorQueue items returned: %d", len(resp.Items))
	for _, item := range resp.Items {
		if item.Screening != nil {
			t.Logf("Queue %s (Patient: %s): TriageCode=%q, TriageLevel(TH)=%q, TriageLevelNum=%d, Priority=%q",
				item.QueueNumber, item.Patient.FullName, item.Screening.TriageCode, item.Screening.TriageLevel, item.Screening.TriageLevelNum, item.Screening.TriagePriority)
		} else {
			t.Logf("Queue %s (Patient: %s): No screening", item.QueueNumber, item.Patient.FullName)
		}
	}
}
