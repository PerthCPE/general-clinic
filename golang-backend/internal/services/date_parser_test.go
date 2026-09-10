package services_test

import (
	"testing"
	"time"

	"clinic-backend/internal/services"
)

func TestParseFlexibleDate(t *testing.T) {
	tests := []struct {
		name        string
		input       string
		wantYear    int
		wantMonth   time.Month
		wantDay     int
		expectError bool
	}{
		// Buddhist Era (พ.ศ.) formats
		{"BE Slash (12/05/2549)", "12/05/2549", 2006, time.May, 12, false},
		{"BE Dash (12-05-2549)", "12-05-2549", 2006, time.May, 12, false},
		{"BE Reverse Slash (2549/05/12)", "2549/05/12", 2006, time.May, 12, false},
		{"BE Reverse Dash (2549-05-12)", "2549-05-12", 2006, time.May, 12, false},
		{"BE Single Digit (1/5/2549)", "1/5/2549", 2006, time.May, 1, false},
		{"BE Old Year (01/01/2400)", "01/01/2400", 1857, time.January, 1, false},

		// Common Era (ค.ศ.) formats
		{"CE Slash (12/05/2006)", "12/05/2006", 2006, time.May, 12, false},
		{"CE Dash (12-05-2006)", "12-05-2006", 2006, time.May, 12, false},
		{"CE ISO (2006-05-12)", "2006-05-12", 2006, time.May, 12, false},
		{"CE Slash YMD (2006/05/12)", "2006/05/12", 2006, time.May, 12, false},
		{"CE RFC3339 UTC", "2006-05-12T00:00:00Z", 2006, time.May, 12, false},
		{"CE RFC3339 BKK", "2006-05-12T07:00:00+07:00", 2006, time.May, 12, false},

		// Leap Year Tests
		{"Leap Year Feb 29 CE (29/02/2024)", "29/02/2024", 2024, time.February, 29, false},
		{"Leap Year Feb 29 BE (29/02/2567)", "29/02/2567", 2024, time.February, 29, false},
		{"Non-Leap Year Feb 29 (29/02/2023)", "29/02/2023", 0, 0, 0, true},
		{"Non-Leap Year Feb 29 BE (29/02/2566)", "29/02/2566", 0, 0, 0, true},

		// Invalid Inputs
		{"Empty string", "", 0, 0, 0, true},
		{"Whitespace only", "   ", 0, 0, 0, true},
		{"Invalid word", "invalid-date", 0, 0, 0, true},
		{"Month 13", "12/13/2006", 0, 0, 0, true},
		{"Day 32", "32/01/2006", 0, 0, 0, true},
		{"April 31", "31/04/2006", 0, 0, 0, true},
		{"Year out of range", "01/01/1700", 0, 0, 0, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := services.ParseFlexibleDate(tt.input)
			if tt.expectError {
				if err == nil {
					t.Errorf("ParseFlexibleDate(%q) expected error, got %v", tt.input, got)
				}
				return
			}
			if err != nil {
				t.Fatalf("ParseFlexibleDate(%q) unexpected error: %v", tt.input, err)
			}
			if got.Year() != tt.wantYear || got.Month() != tt.wantMonth || got.Day() != tt.wantDay {
				t.Errorf("ParseFlexibleDate(%q) = %d-%02d-%02d, want %d-%02d-%02d",
					tt.input, got.Year(), got.Month(), got.Day(), tt.wantYear, tt.wantMonth, tt.wantDay)
			}
		})
	}
}

func TestParseFlexibleDatePtr(t *testing.T) {
	// Empty string should return nil, nil
	ptr, err := services.ParseFlexibleDatePtr("")
	if err != nil || ptr != nil {
		t.Errorf("Expected nil, nil for empty string, got %v, %v", ptr, err)
	}

	// Valid string should return pointer to time
	ptr, err = services.ParseFlexibleDatePtr("15/08/2540")
	if err != nil || ptr == nil {
		t.Fatalf("Expected valid time ptr, got %v, %v", ptr, err)
	}
	if ptr.Year() != 1997 || ptr.Month() != time.August || ptr.Day() != 15 {
		t.Errorf("Expected 1997-08-15, got %v", ptr)
	}

	// Invalid string should return error
	ptr, err = services.ParseFlexibleDatePtr("bad-date")
	if err == nil {
		t.Errorf("Expected error for bad-date, got nil")
	}
}
