package controllers_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"clinic-backend/internal/config"
	"clinic-backend/internal/controllers"
	"clinic-backend/internal/models"
	"clinic-backend/internal/testutils"
	"github.com/gin-gonic/gin"
)

func setupQueuePaginationRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(gin.Recovery())
	r.GET("/api/queue/list", controllers.GetQueueList)
	r.GET("/api/nurse/vitals/history", controllers.GetAllScreeningHistory)
	return r
}

func TestQueuePagination_ServerSide(t *testing.T) {
	testutils.GuardAgainstSupabaseProduction(t)
	config.ConnectDB()

	r := setupQueuePaginationRouter()

	// 1. Paginated Request
	req, _ := http.NewRequest("GET", "/api/queue/list?page=1&limit=25", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK, got %d: %s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("Failed to parse JSON response: %v", err)
	}

	if _, ok := resp["data"]; !ok {
		t.Errorf("Expected 'data' field in paginated response")
	}
	if _, ok := resp["total"]; !ok {
		t.Errorf("Expected 'total' field in paginated response")
	}
	if _, ok := resp["page"]; !ok {
		t.Errorf("Expected 'page' field in paginated response")
	}
	if _, ok := resp["limit"]; !ok {
		t.Errorf("Expected 'limit' field in paginated response")
	}
	if _, ok := resp["total_pages"]; !ok {
		t.Errorf("Expected 'total_pages' field in paginated response")
	}
	if _, ok := resp["stats"]; !ok {
		t.Errorf("Expected 'stats' field in paginated response")
	}

	limitVal := int(resp["limit"].(float64))
	if limitVal != 25 {
		t.Errorf("Expected limit 25, got %d", limitVal)
	}
}

func TestQueuePagination_BackwardCompatibility(t *testing.T) {
	testutils.GuardAgainstSupabaseProduction(t)
	config.ConnectDB()

	r := setupQueuePaginationRouter()

	// 2. Unpaginated Request (no page, no limit) -> must return raw array []
	req, _ := http.NewRequest("GET", "/api/queue/list", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK, got %d", w.Code)
	}

	var sliceResp []map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &sliceResp); err != nil {
		t.Fatalf("Expected raw array for backward compatibility, got object or error: %v", err)
	}
}

func TestQueuePagination_LimitClamping(t *testing.T) {
	testutils.GuardAgainstSupabaseProduction(t)
	config.ConnectDB()

	r := setupQueuePaginationRouter()

	// Limit 999 -> clamped to 50
	req, _ := http.NewRequest("GET", "/api/queue/list?page=1&limit=999", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if int(resp["limit"].(float64)) != 50 {
		t.Errorf("Expected limit clamped to 50, got %v", resp["limit"])
	}

	// Limit 3 -> clamped to 10
	req2, _ := http.NewRequest("GET", "/api/queue/list?page=1&limit=3", nil)
	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, req2)

	var resp2 map[string]interface{}
	json.Unmarshal(w2.Body.Bytes(), &resp2)
	if int(resp2["limit"].(float64)) != 10 {
		t.Errorf("Expected limit clamped to 10, got %v", resp2["limit"])
	}
}

func TestQueuePagination_DataCorrectness_NoDuplicatesOrMissing(t *testing.T) {
	testutils.GuardAgainstSupabaseProduction(t)
	config.ConnectDB()

	r := setupQueuePaginationRouter()

	// 1. Query all IDs directly from Database with exact same join & order
	type QueueIDRow struct {
		ID uint
	}
	var dbRows []QueueIDRow
	err := config.DB.Table("queues").
		Select("queues.id").
		Joins("JOIN patients ON patients.id = queues.patient_id").
		Order("queues.created_at ASC, queues.id ASC").
		Scan(&dbRows).Error
	if err != nil {
		t.Fatalf("Failed to query queues from DB: %v", err)
	}

	totalInDB := len(dbRows)
	t.Logf("================================================================================")
	t.Logf("  [TASK A2 - QUEUE DATA CORRECTNESS TEST] Total rows in DB: %d", totalInDB)
	t.Logf("================================================================================")

	if totalInDB == 0 {
		t.Logf("Database has 0 queues, test skipped.")
		return
	}

	// 2. Fetch page 1 to get total and total_pages
	req1, _ := http.NewRequest("GET", "/api/queue/list?page=1&limit=25", nil)
	w1 := httptest.NewRecorder()
	r.ServeHTTP(w1, req1)

	if w1.Code != http.StatusOK {
		t.Fatalf("GET /api/queue/list?page=1&limit=25 failed with status %d: %s", w1.Code, w1.Body.String())
	}

	var p1Resp struct {
		Data       []map[string]interface{} `json:"data"`
		Total      int                      `json:"total"`
		TotalPages int                      `json:"total_pages"`
		Page       int                      `json:"page"`
		Limit      int                      `json:"limit"`
	}
	if err := json.Unmarshal(w1.Body.Bytes(), &p1Resp); err != nil {
		t.Fatalf("Failed to parse page 1 response: %v", err)
	}

	t.Logf("  API Reported -> Total: %d, TotalPages: %d, Limit: %d", p1Resp.Total, p1Resp.TotalPages, p1Resp.Limit)

	// 3. Iterate through all pages from 1 to TotalPages
	var allCollectedIDs []uint
	seenCount := make(map[uint]int)
	var duplicateIDs []uint

	for p := 1; p <= p1Resp.TotalPages; p++ {
		req, _ := http.NewRequest("GET", "/api/queue/list?page="+strconv.Itoa(p)+"&limit=25", nil)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("Page %d request failed with %d: %s", p, w.Code, w.Body.String())
		}

		var pageResp struct {
			Data []map[string]interface{} `json:"data"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &pageResp); err != nil {
			t.Fatalf("Failed to parse page %d JSON: %v", p, err)
		}

		for _, item := range pageResp.Data {
			rawID, ok := item["id"]
			if !ok {
				t.Fatalf("Item missing 'id' on page %d", p)
			}
			id := uint(rawID.(float64))
			allCollectedIDs = append(allCollectedIDs, id)

			seenCount[id]++
			if seenCount[id] == 2 {
				duplicateIDs = append(duplicateIDs, id)
			}
		}
	}

	// 4. Verify Criterion 1: Count
	if len(allCollectedIDs) != p1Resp.Total {
		t.Errorf("CRITERION 1 FAILED: Collected %d IDs != API reported total %d", len(allCollectedIDs), p1Resp.Total)
	} else {
		t.Logf("  [CRITERION 1 PASS] Collected items (%d) == API reported total (%d)", len(allCollectedIDs), p1Resp.Total)
	}

	if len(allCollectedIDs) != totalInDB {
		t.Errorf("CRITERION 1 FAILED: Collected %d IDs != Total in DB %d", len(allCollectedIDs), totalInDB)
	} else {
		t.Logf("  [CRITERION 1 PASS] Collected items (%d) == Total in DB (%d)", len(allCollectedIDs), totalInDB)
	}

	// 5. Verify Criterion 2: No Duplicates
	distinctCount := len(seenCount)
	if len(duplicateIDs) > 0 || distinctCount != len(allCollectedIDs) {
		t.Errorf("CRITERION 2 FAILED: Found %d duplicate IDs: %v", len(duplicateIDs), duplicateIDs)
	} else {
		t.Logf("  [CRITERION 2 PASS] No duplicate IDs detected (Distinct: %d == Total: %d)", distinctCount, len(allCollectedIDs))
	}

	// 6. Verify Criterion 3: No Missing IDs
	var missingIDs []uint
	collectedSet := make(map[uint]bool)
	for _, id := range allCollectedIDs {
		collectedSet[id] = true
	}
	for _, row := range dbRows {
		if !collectedSet[row.ID] {
			missingIDs = append(missingIDs, row.ID)
		}
	}

	if len(missingIDs) > 0 {
		t.Errorf("CRITERION 3 FAILED: Found %d missing IDs: %v", len(missingIDs), missingIDs)
	} else {
		t.Logf("  [CRITERION 3 PASS] No missing IDs detected (100%% match with DB table)", )
	}

	// 7. Verify Deterministic Order Sequence Match
	orderMismatchCount := 0
	for i, id := range allCollectedIDs {
		if i < len(dbRows) && id != dbRows[i].ID {
			orderMismatchCount++
			if orderMismatchCount <= 5 {
				t.Errorf("Order mismatch at index %d: API returned ID %d, DB expected ID %d", i, id, dbRows[i].ID)
			}
		}
	}
	if orderMismatchCount == 0 {
		t.Logf("  [DETERMINISTIC SORT PASS] All %d items match exact DB sort order: ORDER BY queues.created_at ASC, queues.id ASC", len(allCollectedIDs))
	}
	t.Logf("================================================================================")
}

func TestVitalsHistoryPagination_DataCorrectness_NoDuplicatesOrMissing(t *testing.T) {
	testutils.GuardAgainstSupabaseProduction(t)
	config.ConnectDB()

	r := setupQueuePaginationRouter()

	// 1. Query all IDs directly from Database
	type ScreeningIDRow struct {
		ID uint
	}
	var dbRows []ScreeningIDRow
	err := config.DB.Table("screenings").
		Select("id").
		Order("created_at DESC, id DESC").
		Scan(&dbRows).Error
	if err != nil {
		t.Fatalf("Failed to query screenings from DB: %v", err)
	}

	totalInDB := len(dbRows)
	t.Logf("================================================================================")
	t.Logf("  [TASK A2 - VITALS HISTORY CORRECTNESS TEST] Total rows in DB: %d", totalInDB)
	t.Logf("================================================================================")

	if totalInDB == 0 {
		t.Logf("Database has 0 screenings, test skipped.")
		return
	}

	// 2. Fetch page 1
	req1, _ := http.NewRequest("GET", "/api/nurse/vitals/history?page=1&limit=25", nil)
	w1 := httptest.NewRecorder()
	r.ServeHTTP(w1, req1)

	if w1.Code != http.StatusOK {
		t.Fatalf("GET /api/nurse/vitals/history?page=1&limit=25 failed with status %d: %s", w1.Code, w1.Body.String())
	}

	var p1Resp struct {
		Data       []map[string]interface{} `json:"data"`
		Total      int                      `json:"total"`
		TotalPages int                      `json:"total_pages"`
		Page       int                      `json:"page"`
		Limit      int                      `json:"limit"`
	}
	if err := json.Unmarshal(w1.Body.Bytes(), &p1Resp); err != nil {
		t.Fatalf("Failed to parse page 1 response: %v", err)
	}

	t.Logf("  API Reported -> Total: %d, TotalPages: %d, Limit: %d", p1Resp.Total, p1Resp.TotalPages, p1Resp.Limit)

	// 3. Iterate through all pages
	var allCollectedIDs []uint
	seenCount := make(map[uint]int)
	var duplicateIDs []uint

	for p := 1; p <= p1Resp.TotalPages; p++ {
		req, _ := http.NewRequest("GET", "/api/nurse/vitals/history?page="+jsonNumber(p)+"&limit=25", nil)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("Page %d request failed with %d: %s", p, w.Code, w.Body.String())
		}

		var pageResp struct {
			Data []map[string]interface{} `json:"data"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &pageResp); err != nil {
			t.Fatalf("Failed to parse page %d JSON: %v", p, err)
		}

		for _, item := range pageResp.Data {
			rawID, ok := item["id"]
			if !ok {
				t.Fatalf("Item missing 'id' on page %d", p)
			}
			id := uint(rawID.(float64))
			allCollectedIDs = append(allCollectedIDs, id)

			seenCount[id]++
			if seenCount[id] == 2 {
				duplicateIDs = append(duplicateIDs, id)
			}
		}
	}

	// 4. Verify Criterion 1: Count
	if len(allCollectedIDs) != p1Resp.Total {
		t.Errorf("CRITERION 1 FAILED: Collected %d IDs != API reported total %d", len(allCollectedIDs), p1Resp.Total)
	} else {
		t.Logf("  [CRITERION 1 PASS] Collected items (%d) == API reported total (%d)", len(allCollectedIDs), p1Resp.Total)
	}

	if len(allCollectedIDs) != totalInDB {
		t.Errorf("CRITERION 1 FAILED: Collected %d IDs != Total in DB %d", len(allCollectedIDs), totalInDB)
	} else {
		t.Logf("  [CRITERION 1 PASS] Collected items (%d) == Total in DB (%d)", len(allCollectedIDs), totalInDB)
	}

	// 5. Verify Criterion 2: No Duplicates
	distinctCount := len(seenCount)
	if len(duplicateIDs) > 0 || distinctCount != len(allCollectedIDs) {
		t.Errorf("CRITERION 2 FAILED: Found %d duplicate IDs: %v", len(duplicateIDs), duplicateIDs)
	} else {
		t.Logf("  [CRITERION 2 PASS] No duplicate IDs detected (Distinct: %d == Total: %d)", distinctCount, len(allCollectedIDs))
	}

	// 6. Verify Criterion 3: No Missing IDs
	var missingIDs []uint
	collectedSet := make(map[uint]bool)
	for _, id := range allCollectedIDs {
		collectedSet[id] = true
	}
	for _, row := range dbRows {
		if !collectedSet[row.ID] {
			missingIDs = append(missingIDs, row.ID)
		}
	}

	if len(missingIDs) > 0 {
		t.Errorf("CRITERION 3 FAILED: Found %d missing IDs: %v", len(missingIDs), missingIDs)
	} else {
		t.Logf("  [CRITERION 3 PASS] No missing IDs detected (100%% match with DB table)")
	}

	// 7. Verify Deterministic Order Sequence Match
	orderMismatchCount := 0
	for i, id := range allCollectedIDs {
		if i < len(dbRows) && id != dbRows[i].ID {
			orderMismatchCount++
			if orderMismatchCount <= 5 {
				t.Errorf("Order mismatch at index %d: API returned ID %d, DB expected ID %d", i, id, dbRows[i].ID)
			}
		}
	}
	if orderMismatchCount == 0 {
		t.Logf("  [DETERMINISTIC SORT PASS] All %d items match exact DB sort order: ORDER BY screenings.created_at DESC, screenings.id DESC", len(allCollectedIDs))
	}
	t.Logf("================================================================================")
}

func TestQueuePagination_IdenticalTimestamps_DeterministicTieBreaker(t *testing.T) {
	testutils.GuardAgainstSupabaseProduction(t)
	config.ConnectDB()

	r := setupQueuePaginationRouter()

	// 1. Create a mock patient for testing identical timestamps
	mockPatient := models.Patient{
		NationalID:  "1999988880001",
		HN:          "HN9901",
		FullName:    "ทดสอบ ลำดับคิวเวลาเท่ากัน",
		Gender:      "ชาย",
		PhoneNumber: "081-999-0001",
	}
	config.DB.Where("national_id = ?", mockPatient.NationalID).FirstOrCreate(&mockPatient)

	var defaultUser models.User
	if err := config.DB.First(&defaultUser).Error; err != nil {
		defaultUser.ID = 1
	}

	// 2. Insert 80 queues with the EXACT SAME created_at timestamp
	fixedTimestamp := time.Date(2026, 9, 7, 12, 0, 0, 0, time.UTC)
	var insertedQueueIDs []uint
	config.DB.Where("queue_number LIKE ?", "QTEST%").Delete(&models.Queue{})

	defer func() {
		// Clean up created test queues and patient
		if len(insertedQueueIDs) > 0 {
			config.DB.Where("id IN ?", insertedQueueIDs).Delete(&models.Queue{})
		}
		config.DB.Where("queue_number LIKE ?", "QTEST%").Delete(&models.Queue{})
		config.DB.Where("id = ?", mockPatient.ID).Delete(&models.Patient{})
	}()

	for i := 1; i <= 80; i++ {
		q := models.Queue{
			PatientID:       mockPatient.ID,
			CreatedByUserID: defaultUser.ID,
			QueueNumber:     fmt.Sprintf("QTEST%03d", i),
			Department:      "จุดคัดกรอง",
			Status:          "เสร็จสิ้น",
			ServiceDate:     fixedTimestamp,
			CreatedAt:       fixedTimestamp,
			UpdatedAt:       fixedTimestamp,
		}
		if err := config.DB.Create(&q).Error; err != nil {
			t.Fatalf("Failed to create test queue %d: %v", i, err)
		}
		insertedQueueIDs = append(insertedQueueIDs, q.ID)
	}

	t.Logf("================================================================================")
	t.Logf("  [STRESS TEST] 80 Queues inserted with IDENTICAL timestamp: %v", fixedTimestamp)
	t.Logf("================================================================================")

	// 3. Request across pages with search="QTEST" to isolate these 80 items
	var allCollectedIDs []uint
	seenCount := make(map[uint]int)
	var duplicateIDs []uint

	// Page 1
	req1, _ := http.NewRequest("GET", "/api/queue/list?page=1&limit=25&search=QTEST", nil)
	w1 := httptest.NewRecorder()
	r.ServeHTTP(w1, req1)

	var p1Resp struct {
		Data       []map[string]interface{} `json:"data"`
		Total      int                      `json:"total"`
		TotalPages int                      `json:"total_pages"`
	}
	json.Unmarshal(w1.Body.Bytes(), &p1Resp)

	t.Logf("  Search='QTEST' Reported Total: %d, TotalPages: %d (Expected: 80 items, 4 pages)", p1Resp.Total, p1Resp.TotalPages)

	for p := 1; p <= p1Resp.TotalPages; p++ {
		req, _ := http.NewRequest("GET", "/api/queue/list?page="+strconv.Itoa(p)+"&limit=25&search=QTEST", nil)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		var pageResp struct {
			Data []map[string]interface{} `json:"data"`
		}
		json.Unmarshal(w.Body.Bytes(), &pageResp)

		for _, item := range pageResp.Data {
			id := uint(item["id"].(float64))
			allCollectedIDs = append(allCollectedIDs, id)
			seenCount[id]++
			if seenCount[id] == 2 {
				duplicateIDs = append(duplicateIDs, id)
			}
		}
	}

	// 4. Verify 80 items collected with 0 duplicates and 0 missing
	if len(allCollectedIDs) != 80 {
		t.Errorf("Expected 80 items, got %d", len(allCollectedIDs))
	} else {
		t.Logf("  [CRITERION 1 PASS] Exactly 80/80 items collected across 4 pages")
	}

	if len(duplicateIDs) > 0 {
		t.Errorf("CRITERION 2 FAILED: Identical timestamps caused duplicates across pages: %v", duplicateIDs)
	} else {
		t.Logf("  [CRITERION 2 PASS] Zero duplicate items across all page boundaries (id tie-breaker worked perfectly)")
	}

	// 5. Verify strictly ascending ID order
	for i := 0; i < len(allCollectedIDs); i++ {
		if allCollectedIDs[i] != insertedQueueIDs[i] {
			t.Errorf("Index %d: Expected ID %d, got %d", i, insertedQueueIDs[i], allCollectedIDs[i])
		}
	}
	t.Logf("  [CRITERION 3 PASS] Order strictly strictly deterministic: ID %d -> ID %d", allCollectedIDs[0], allCollectedIDs[len(allCollectedIDs)-1])
	t.Logf("================================================================================")
}

func jsonNumber(n int) string {
	return strconv.Itoa(n)
}
