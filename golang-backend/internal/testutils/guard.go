package testutils

import (
	"strings"
	"testing"

	"clinic-backend/internal/config"
)

// SupabaseGuardErrorMsg is the exact error message required when Supabase host is detected during test execution
const SupabaseGuardErrorMsg = "ห้ามรัน test กับ Supabase production (egress quota) ใช้ Docker แทน: docker compose up -d"

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

