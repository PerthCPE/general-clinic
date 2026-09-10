package services

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"
)

var (
	ErrInvalidDateFormat = errors.New("รูปแบบวันที่ไม่ถูกต้อง กรุณาใช้ DD/MM/YYYY หรือ YYYY-MM-DD")
)

// DaysInMonth returns the number of days in a given year and month
func DaysInMonth(year int, month int) int {
	switch time.Month(month) {
	case time.January, time.March, time.May, time.July, time.August, time.October, time.December:
		return 31
	case time.April, time.June, time.September, time.November:
		return 30
	case time.February:
		if (year%4 == 0 && year%100 != 0) || (year%400 == 0) {
			return 29
		}
		return 28
	default:
		return 0
	}
}

// ParseFlexibleDate parses dates across various formats (DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY, RFC3339)
// and automatically converts Buddhist Era (พ.ศ. >= 2400) to Common Era (ค.ศ. = พ.ศ. - 543).
// Returns standard UTC time.Date at 00:00:00 UTC or error if format is invalid.
func ParseFlexibleDate(raw string) (time.Time, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return time.Time{}, ErrInvalidDateFormat
	}

	// 1. Try ISO / RFC3339 timestamps (e.g. 2006-05-12T00:00:00Z, 2006-05-12T07:00:00+07:00)
	for _, layout := range []string{
		time.RFC3339Nano,
		time.RFC3339,
		"2006-01-02T15:04:05",
		"2006-01-02 15:04:05",
	} {
		if t, err := time.Parse(layout, trimmed); err == nil {
			year := t.Year()
			if year >= 2400 {
				year -= 543
			}
			if year < 1800 || year > 2200 {
				return time.Time{}, fmt.Errorf("%w: ปีอยู่นอกช่วงที่รองรับ", ErrInvalidDateFormat)
			}
			return time.Date(year, t.Month(), t.Day(), 0, 0, 0, 0, time.UTC), nil
		}
	}

	// 2. Try delimited date strings: "-" or "/"
	delimiter := ""
	if strings.Contains(trimmed, "/") {
		delimiter = "/"
	} else if strings.Contains(trimmed, "-") {
		delimiter = "-"
	}

	if delimiter != "" {
		parts := strings.Split(trimmed, delimiter)
		if len(parts) == 3 {
			p0, err0 := strconv.Atoi(strings.TrimSpace(parts[0]))
			p1, err1 := strconv.Atoi(strings.TrimSpace(parts[1]))
			p2, err2 := strconv.Atoi(strings.TrimSpace(parts[2]))

			if err0 == nil && err1 == nil && err2 == nil {
				var year, month, day int

				if len(parts[0]) == 4 || p0 > 31 {
					// YYYY-MM-DD or YYYY/MM/DD
					year = p0
					month = p1
					day = p2
				} else if len(parts[2]) == 4 || p2 > 31 {
					// DD-MM-YYYY or DD/MM/YYYY
					day = p0
					month = p1
					year = p2
				} else {
					return time.Time{}, ErrInvalidDateFormat
				}

				// Buddhist Era conversion (พ.ศ. >= 2400 -> ค.ศ. = พ.ศ. - 543)
				if year >= 2400 {
					year -= 543
				}

				// Strict range and calendar boundary validations
				if year < 1800 || year > 2200 {
					return time.Time{}, fmt.Errorf("%w: ปีอยู่นอกช่วงที่รองรับ", ErrInvalidDateFormat)
				}
				if month < 1 || month > 12 {
					return time.Time{}, fmt.Errorf("%w: เดือนไม่ถูกต้อง", ErrInvalidDateFormat)
				}
				maxDays := DaysInMonth(year, month)
				if day < 1 || day > maxDays {
					return time.Time{}, fmt.Errorf("%w: วันที่ไม่ถูกต้องสำหรับเดือนนี้", ErrInvalidDateFormat)
				}

				return time.Date(year, time.Month(month), day, 0, 0, 0, 0, time.UTC), nil
			}
		}
	}

	return time.Time{}, ErrInvalidDateFormat
}

// ParseFlexibleDatePtr parses raw string into a pointer to time.Time.
// If the string is empty or whitespace, it returns nil, nil (no error).
// If non-empty but invalid, it returns nil, error.
func ParseFlexibleDatePtr(raw string) (*time.Time, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil, nil
	}
	t, err := ParseFlexibleDate(trimmed)
	if err != nil {
		return nil, err
	}
	return &t, nil
}
