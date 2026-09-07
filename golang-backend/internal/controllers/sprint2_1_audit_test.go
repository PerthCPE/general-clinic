package controllers_test

import (
	"testing"
	"time"

	"clinic-backend/internal/config"
)

func TestSprint2_1_TaskA2_ExpireDateAudit(t *testing.T) {
	db := config.DB
	if db == nil {
		t.Fatal("Database connection not initialized")
	}

	t.Log("================================================================================")
	t.Log("  [TASK A2] SELECT expire_date, COUNT(*) FROM medical_eligibilities GROUP BY 1 ORDER BY 2 DESC")
	t.Log("================================================================================")

	type ExpireGroup struct {
		ExpireDate *time.Time `gorm:"column:expire_date"`
		Count      int64      `gorm:"column:count"`
	}
	var results []ExpireGroup

	err := db.Raw(`
		SELECT expire_date, COUNT(*) as count 
		FROM medical_eligibilities 
		GROUP BY 1 
		ORDER BY 2 DESC;
	`).Scan(&results).Error

	if err != nil {
		t.Fatalf("Query failed: %v", err)
	}

	for _, r := range results {
		dStr := "NULL"
		if r.ExpireDate != nil {
			dStr = r.ExpireDate.Format("2006-01-02")
		}
		t.Logf("  expire_date: %-12s | count: %d", dStr, r.Count)
	}
	t.Log("================================================================================\n")
}

func TestSprint2_1_TaskC2_TimezoneMonthTest(t *testing.T) {
	t.Log("================================================================================")
	t.Log("  [TASK C2] TIMEZONE SENSITIVITY TEST (Asia/Bangkok vs UTC)")
	t.Log("================================================================================")

	// Simulated record created on 1st of September 2026 at 02:00:00 Thai Time (ICT / UTC+7)
	// In UTC, this is 2026-08-31 19:00:00 UTC
	bkkLoc, err := time.LoadLocation("Asia/Bangkok")
	if err != nil {
		bkkLoc = time.FixedZone("Asia/Bangkok", 7*3600)
	}

	// 1 Sept 2026 02:00:00 ICT
	recordTimeICT := time.Date(2026, 9, 1, 2, 0, 0, 0, bkkLoc)
	recordTimeUTC := recordTimeICT.UTC()

	t.Logf("  Record Timestamp in Thai Time (ICT) : %s", recordTimeICT.Format(time.RFC3339))
	t.Logf("  Record Timestamp in UTC             : %s", recordTimeUTC.Format(time.RFC3339))

	// In Go backend / database:
	// When formatted in Thai local context (ICT / Buddhist Era):
	thaiMonthICT := int(recordTimeICT.Month())
	thaiYearICT := recordTimeICT.Year()

	utcMonth := int(recordTimeUTC.Month())
	utcYear := recordTimeUTC.Year()

	t.Logf("  ICT Context -> Month = %d (September), Year = %d (BE %d)", thaiMonthICT, thaiYearICT, thaiYearICT+543)
	t.Logf("  UTC Context -> Month = %d (August),    Year = %d (BE %d)", utcMonth, utcYear, utcYear+543)

	if thaiMonthICT != 9 {
		t.Errorf("Expected Thai month to be 9 (September), got %d", thaiMonthICT)
	}
	t.Log("================================================================================\n")
}
