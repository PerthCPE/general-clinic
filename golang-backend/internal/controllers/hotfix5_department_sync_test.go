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

func setupHotfix5Router() *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(gin.Recovery())
	r.PUT("/api/queue/:id/status", controllers.UpdateQueueStatus)
	r.GET("/api/queue/list", controllers.GetQueueList)
	return r
}

// TestHOTFIX5_DepartmentAutoSyncLifecycle verifies C1 & C3:
// Full lifecycle status transitions without explicit department automatically sync the database department column
func TestHOTFIX5_DepartmentAutoSyncLifecycle(t *testing.T) {
	testutils.GuardAgainstSupabaseProduction(t)
	config.ConnectDB()
	db := config.DB

	var user models.User
	if err := db.First(&user).Error; err != nil {
		t.Fatalf("Failed to find valid user: %v", err)
	}

	// 1. Create a dummy patient and queue for testing
	patient := models.Patient{
		HN:         fmt.Sprintf("HN%04X", (time.Now().UnixNano()%0xFF00)+0x10),
		FullName:   "ทดสอบ อัปเดตแผนกอัตโนมัติ",
		Gender:     "male",
		BirthDate:  time.Now().AddDate(-30, 0, 0),
		NationalID: fmt.Sprintf("HF5A%X", time.Now().UnixNano()%0xFFFFFFFF),
	}
	if err := db.Create(&patient).Error; err != nil {
		t.Fatalf("Failed to create test patient: %v", err)
	}
	defer db.Unscoped().Delete(&patient)

	qNum := fmt.Sprintf("Q%04X", (time.Now().UnixNano()%0xFF00)+0x10)
	queue := models.Queue{
		PatientID:       patient.ID,
		CreatedByUserID: user.ID,
		QueueNumber:     qNum,
		ServiceDate:     time.Now(),
		Status:          "รอคัดกรอง",
		Department:      "จุดคัดกรอง",
		Note:            "ทดสอบ HOTFIX-5",
	}
	if err := db.Create(&queue).Error; err != nil {
		t.Fatalf("Failed to create test queue: %v", err)
	}
	defer db.Unscoped().Delete(&queue)

	r := setupHotfix5Router()

	transitions := []struct {
		targetStatus string
		expectedDept string
		explicitDept string
		description  string
	}{
		{
			targetStatus: "รอพบแพทย์",
			expectedDept: "ห้องตรวจ 1 (พญ.สุดา)",
			description:  "1. รอคัดกรอง -> รอพบแพทย์ (Auto map to doctor room)",
		},
		{
			targetStatus: "กำลังตรวจ",
			expectedDept: "ห้องตรวจ 1 (พญ.สุดา)",
			description:  "2. รอพบแพทย์ -> กำลังตรวจ (Maintain doctor room)",
		},
		{
			targetStatus: "รอทำหัตถการ",
			expectedDept: "ห้องหัตถการ (ทำแผล/ฉีดยา)",
			description:  "3. กำลังตรวจ -> รอทำหัตถการ (Auto map to procedure room)",
		},
		{
			targetStatus: "รอชำระเงิน",
			expectedDept: "ห้องการเงิน (แคชเชียร์)",
			description:  "4. รอทำหัตถการ -> รอชำระเงิน (Auto map to billing/cashier)",
		},
		{
			targetStatus: "รอรับยา",
			expectedDept: "ห้องจ่ายยาและเภสัชกรรม",
			description:  "5. รอชำระเงิน -> รอรับยา (Auto map to pharmacy)",
		},
		{
			targetStatus: "เสร็จสิ้น",
			expectedDept: "เสร็จสิ้นขั้นตอนการรักษา",
			description:  "6. รอรับยา -> เสร็จสิ้น (Auto map to pharmacy/completed)",
		},
	}

	for _, tc := range transitions {
		t.Run(tc.description, func(t *testing.T) {
			payload := map[string]string{
				"status": tc.targetStatus,
			}
			if tc.explicitDept != "" {
				payload["department"] = tc.explicitDept
			}
			bodyBytes, _ := json.Marshal(payload)

			req, _ := http.NewRequest("PUT", fmt.Sprintf("/api/queue/%d/status", queue.ID), bytes.NewReader(bodyBytes))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)

			if w.Code != http.StatusOK {
				t.Fatalf("Failed to update status to %s: HTTP %d %s", tc.targetStatus, w.Code, w.Body.String())
			}

			// Verify in API response
			var resp struct {
				Message string       `json:"message"`
				Queue   models.Queue `json:"queue"`
			}
			if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
				t.Fatalf("Failed to decode response: %v", err)
			}
			if resp.Queue.Status != tc.targetStatus {
				t.Errorf("API response status mismatch: got %q, want %q", resp.Queue.Status, tc.targetStatus)
			}
			if resp.Queue.Department != tc.expectedDept {
				t.Errorf("API response department mismatch: got %q, want %q", resp.Queue.Department, tc.expectedDept)
			}

			// C3: Direct Database Verification
			var dbQueue models.Queue
			if err := db.First(&dbQueue, queue.ID).Error; err != nil {
				t.Fatalf("Failed to query DB directly for queue %d: %v", queue.ID, err)
			}
			if dbQueue.Status != tc.targetStatus {
				t.Errorf("DB direct status mismatch: got %q, want %q", dbQueue.Status, tc.targetStatus)
			}
			if dbQueue.Department != tc.expectedDept {
				t.Errorf("DB direct department mismatch: got %q, want %q", dbQueue.Department, tc.expectedDept)
			}
		})
	}
}

// TestHOTFIX5_1_AllThreeDoctorsRoomMapping verifies Task B for all 3 doctors:
// doctor1 -> ห้องตรวจ 1 (พญ.สุดา), doctor2 -> ห้องตรวจ 2 (นพ.วิชัย), doctor3 -> ห้องตรวจ 3 (พญ.เกศรา)
func TestHOTFIX5_1_AllThreeDoctorsRoomMapping(t *testing.T) {
	testutils.GuardAgainstSupabaseProduction(t)
	config.ConnectDB()
	db := config.DB

	// Find doctor users
	var docUsers []models.User
	if err := db.Where("role = ?", "doctor").Order("id asc").Find(&docUsers).Error; err != nil || len(docUsers) < 3 {
		t.Fatalf("Need at least 3 doctors seeded: %v (found %d)", err, len(docUsers))
	}

	r := setupHotfix5Router()

	for i, docUser := range docUsers {
		expectedRoomNum := i + 1
		expectedDeptPrefix := fmt.Sprintf("ห้องตรวจ %d", expectedRoomNum)

		t.Run(fmt.Sprintf("Doctor%d_%s", i+1, docUser.FullName), func(t *testing.T) {
			patient := models.Patient{
				HN:         fmt.Sprintf("HN%04X", (time.Now().UnixNano()%0xFF00)+int64(i*10+1)),
				FullName:   fmt.Sprintf("ผู้ป่วยทดสอบ หมอ%d", i+1),
				Gender:     "male",
				BirthDate:  time.Now().AddDate(-35, 0, 0),
				NationalID: fmt.Sprintf("HF5B%X%d", time.Now().UnixNano()%0xFFFFFF, i),
			}
			db.Create(&patient)
			defer db.Unscoped().Delete(&patient)

			docID := docUser.ID
			qNum := fmt.Sprintf("Q%04X", (time.Now().UnixNano()%0xFF00)+int64(i*10+1))
			queue := models.Queue{
				PatientID:        patient.ID,
				CreatedByUserID:  docUser.ID,
				AssignedDoctorID: &docID,
				QueueNumber:      qNum,
				ServiceDate:      time.Now(),
				Status:           "รอคัดกรอง",
				Department:       "จุดคัดกรอง",
			}
			db.Create(&queue)
			defer db.Unscoped().Delete(&queue)

			// 1. Unit resolver test directly
			resolved := controllers.ResolveDepartmentForStatus(queue, "รอพบแพทย์")
			if !strings.HasPrefix(resolved, expectedDeptPrefix) {
				t.Errorf("ResolveDepartmentForStatus failed for doctor %s (ID %d): got %q, want prefix %q",
					docUser.FullName, docUser.ID, resolved, expectedDeptPrefix)
			}
			t.Logf("Doctor %s (ID %d) resolved to: %s", docUser.FullName, docUser.ID, resolved)

			// 2. Integration PUT /api/queue/:id/status test without explicit department
			payload := map[string]string{"status": "รอพบแพทย์"}
			bodyBytes, _ := json.Marshal(payload)
			req, _ := http.NewRequest("PUT", fmt.Sprintf("/api/queue/%d/status", queue.ID), bytes.NewReader(bodyBytes))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)

			if w.Code != http.StatusOK {
				t.Fatalf("HTTP %d: %s", w.Code, w.Body.String())
			}

			var dbQueue models.Queue
			db.First(&dbQueue, queue.ID)
			if !strings.HasPrefix(dbQueue.Department, expectedDeptPrefix) {
				t.Errorf("DB Queue Department mismatch for doctor %s: got %q, want prefix %q",
					docUser.FullName, dbQueue.Department, expectedDeptPrefix)
			}
			t.Logf("Queue %s for Doctor %s successfully saved with department: %s",
				dbQueue.QueueNumber, docUser.FullName, dbQueue.Department)
		})
	}
}

// TestHOTFIX5_ExplicitDepartmentOverride verifies that if a department is explicitly provided, it is respected.
func TestHOTFIX5_ExplicitDepartmentOverride(t *testing.T) {
	testutils.GuardAgainstSupabaseProduction(t)
	config.ConnectDB()
	db := config.DB

	var user models.User
	if err := db.First(&user).Error; err != nil {
		t.Fatalf("Failed to find valid user: %v", err)
	}

	patient := models.Patient{
		HN:         fmt.Sprintf("HN%04X", (time.Now().UnixNano()%0xFF00)+0x20),
		FullName:   "ทดสอบ กำหนดแผนกแบบชัดเจน",
		Gender:     "female",
		BirthDate:  time.Now().AddDate(-25, 0, 0),
		NationalID: fmt.Sprintf("HF5C%X", time.Now().UnixNano()%0xFFFFFFFF),
	}
	if err := db.Create(&patient).Error; err != nil {
		t.Fatalf("Failed to create test patient: %v", err)
	}
	defer db.Unscoped().Delete(&patient)

	qNum := fmt.Sprintf("Q%04X", (time.Now().UnixNano()%0xFF00)+0x20)
	queue := models.Queue{
		PatientID:       patient.ID,
		CreatedByUserID: user.ID,
		QueueNumber:     qNum,
		ServiceDate:     time.Now(),
		Status:          "รอคัดกรอง",
		Department:      "จุดคัดกรอง",
	}
	if err := db.Create(&queue).Error; err != nil {
		t.Fatalf("Failed to create test queue: %v", err)
	}
	defer db.Unscoped().Delete(&queue)

	r := setupHotfix5Router()

	// Update with explicit department
	customDept := "ห้องตรวจ 3 (พญ.เกศรา)"
	payload := map[string]string{
		"status":     "รอพบแพทย์",
		"department": customDept,
	}
	bodyBytes, _ := json.Marshal(payload)
	req, _ := http.NewRequest("PUT", fmt.Sprintf("/api/queue/%d/status", queue.ID), bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK, got %d: %s", w.Code, w.Body.String())
	}

	var dbQueue models.Queue
	if err := db.First(&dbQueue, queue.ID).Error; err != nil {
		t.Fatalf("Failed to query DB for queue %d: %v", queue.ID, err)
	}
	if dbQueue.Department != customDept {
		t.Errorf("Expected explicit department %q, got %q", customDept, dbQueue.Department)
	}
}

// TestHOTFIX5_UnitResolveDepartmentForStatus tests the resolver unit logic directly
func TestHOTFIX5_UnitResolveDepartmentForStatus(t *testing.T) {
	tests := []struct {
		name         string
		queue        models.Queue
		targetStatus string
		expected     string
	}{
		{
			name:         "Screening status",
			queue:        models.Queue{},
			targetStatus: "รอคัดกรอง",
			expected:     "จุดคัดกรอง",
		},
		{
			name:         "Screening with existing dept",
			queue:        models.Queue{Department: "แผนกคัดกรอง"},
			targetStatus: "รอคัดกรอง",
			expected:     "แผนกคัดกรอง",
		},
		{
			name:         "Procedure status",
			queue:        models.Queue{},
			targetStatus: "รอทำหัตถการ",
			expected:     "ห้องหัตถการ (ทำแผล/ฉีดยา)",
		},
		{
			name:         "Billing status",
			queue:        models.Queue{},
			targetStatus: "รอชำระเงิน",
			expected:     "ห้องการเงิน (แคชเชียร์)",
		},
		{
			name:         "Pharmacy status",
			queue:        models.Queue{},
			targetStatus: "รอรับยา",
			expected:     "ห้องจ่ายยาและเภสัชกรรม",
		},
		{
			name:         "Completed status",
			queue:        models.Queue{},
			targetStatus: "เสร็จสิ้น",
			expected:     "เสร็จสิ้นขั้นตอนการรักษา",
		},
		{
			name:         "Doctor room retains existing doctor room",
			queue:        models.Queue{Department: "ห้องตรวจ 2 (นพ.วิชัย)"},
			targetStatus: "กำลังตรวจ",
			expected:     "ห้องตรวจ 2 (นพ.วิชัย)",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := controllers.ResolveDepartmentForStatus(tt.queue, tt.targetStatus)
			if got != tt.expected {
				t.Errorf("ResolveDepartmentForStatus(%+v, %q) = %q, want %q", tt.queue, tt.targetStatus, got, tt.expected)
			}
		})
	}
}
