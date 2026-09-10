package services

import (
	"fmt"
	"testing"
	"time"
)

func TestQueueNumberFormatting(t *testing.T) {
	testCases := []struct {
		num      int
		expected string
	}{
		{1, "Q0001"},
		{9, "Q0009"},
		{10, "Q000A"},
		{15, "Q000F"},
		{16, "Q0010"},
		{255, "Q00FF"},
		{4095, "Q0FFF"},
		{65535, "QFFFF"},
	}

	for _, tc := range testCases {
		t.Run(tc.expected, func(t *testing.T) {
			actual := fmt.Sprintf("Q%04X", tc.num)
			if actual != tc.expected {
				t.Errorf("expected %s, got %s", tc.expected, actual)
			}
		})
	}
}

func TestBangkokLocation(t *testing.T) {
	loc := BangkokLocation()
	if loc == nil {
		t.Fatal("BangkokLocation returned nil")
	}

	utcTime := time.Date(2026, 9, 7, 10, 0, 0, 0, time.UTC)
	bkkTime := utcTime.In(loc)

	if bkkTime.Hour() != 17 {
		t.Errorf("expected hour 17 in Bangkok, got %d", bkkTime.Hour())
	}
}

