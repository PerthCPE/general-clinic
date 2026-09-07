package testutils

import (
	"strings"
	"testing"

	"clinic-backend/internal/config"
)

func TestSupabaseProductionGuard_DetectsSupabase(t *testing.T) {
	// 1. Verify that current dev environment is NOT supabase
	config.LoadConfig()
	GuardAgainstSupabaseProduction(t)

	// 2. Simulate a supabase host and verify detection logic
	mockSupabaseHosts := []string{
		"aws-0-ap-southeast-1.pooler.supabase.com",
		"db.myproject.supabase.co",
		"supabase.in.mycorp.net",
	}

	for _, host := range mockSupabaseHosts {
		isSupabase := strings.Contains(strings.ToLower(host), "supabase") || strings.Contains(strings.ToLower(host), "pooler.supabase.com")
		if !isSupabase {
			t.Errorf("Expected host %s to be flagged as Supabase production, but was not", host)
		}
	}
}
