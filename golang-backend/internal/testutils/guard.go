package testutils

import (
	"os"
	"strings"
	"testing"

	"clinic-backend/internal/config"
)

// SupabaseGuardErrorMsg is the exact error message required when Supabase host is detected during test execution
const SupabaseGuardErrorMsg = "ห้ามรัน test กับ Supabase production (egress quota) ใช้ Docker แทน: docker compose up -d"

// ProductionDBGuardErrorMsg is the error message when destructive test runs against live database
const ProductionDBGuardErrorMsg = "ความปลอดภัย: ห้ามรัน Stress/Capacity Test บน Live DB 'clinic' เด็ดขาด (กำหนด TEST_DB_NAME=clinic_test หรือใช้ ALLOW_DESTRUCTIVE_TEST=true)"

// CheckSupabaseHost returns true if host points to Supabase production/pooler
func CheckSupabaseHost(host string) bool {
	lower := strings.ToLower(host)
	return strings.Contains(lower, "supabase") || strings.Contains(lower, "pooler.supabase.com")
}

// GuardAgainstSupabaseProduction verifies that test suites run strictly against local Docker Postgres,
// aborting immediately with t.Fatal if DB_HOST contains 'supabase' to protect against bandwidth egress exhaustion.
func GuardAgainstSupabaseProduction(t *testing.T) {
	if t != nil {
		t.Helper()
	}
	if config.AppConfig == nil {
		config.LoadConfig()
	}

	if CheckSupabaseHost(config.AppConfig.DBHost) {
		if t != nil {
			t.Fatal(SupabaseGuardErrorMsg)
		}
	}
}

// GuardAgainstProductionDB verifies that destructive or capacity stress tests do not run against the live development database.
func GuardAgainstProductionDB(t *testing.T) {
	if t != nil {
		t.Helper()
	}
	if config.AppConfig == nil {
		config.LoadConfig()
	}

	if os.Getenv("ALLOW_DESTRUCTIVE_TEST") != "true" {
		if config.AppConfig.DBName == "clinic" || config.AppConfig.DBName == "" {
			if t != nil {
				t.Fatal(ProductionDBGuardErrorMsg)
			}
		}
	}
}
