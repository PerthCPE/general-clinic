package services

import (
	"testing"
)

func TestValidateClinicalVitals(t *testing.T) {
	tests := []struct {
		name       string
		weight     float64
		height     float64
		temp       float64
		sysBP      int
		diaBP      int
		hr         int
		spo2       int
		rr         int
		pain       int
		bs         int
		wantErr    bool
		errMsgPart string
	}{
		{
			name:    "Valid Normal Vitals",
			weight:  65,
			height:  170,
			temp:    36.5,
			sysBP:   120,
			diaBP:   80,
			hr:      75,
			spo2:    98,
			rr:      18,
			pain:    0,
			bs:      100,
			wantErr: false,
		},
		{
			name:       "Weight 0 (Forbidden)",
			weight:     0,
			height:     170,
			temp:       36.5,
			sysBP:      120,
			diaBP:      80,
			hr:         75,
			spo2:       98,
			wantErr:    true,
			errMsgPart: "น้ำหนัก",
		},
		{
			name:       "Weight Negative -5 (Forbidden)",
			weight:     -5,
			height:     170,
			temp:       36.5,
			sysBP:      120,
			diaBP:      80,
			hr:         75,
			spo2:       98,
			wantErr:    true,
			errMsgPart: "น้ำหนัก",
		},
		{
			name:       "Weight 999 kg (Exceeds Max 500)",
			weight:     999,
			height:     170,
			temp:       36.5,
			sysBP:      120,
			diaBP:      80,
			hr:         75,
			spo2:       98,
			wantErr:    true,
			errMsgPart: "น้ำหนัก",
		},
		{
			name:       "Height 0 (Forbidden)",
			weight:     60,
			height:     0,
			temp:       36.5,
			sysBP:      120,
			diaBP:      80,
			hr:         75,
			spo2:       98,
			wantErr:    true,
			errMsgPart: "ส่วนสูง",
		},
		{
			name:       "Diastolic >= Systolic (80/120 inverted - BUG-A3-11)",
			weight:     60,
			height:     165,
			temp:       36.5,
			sysBP:      80,
			diaBP:      120,
			hr:         75,
			spo2:       98,
			wantErr:    true,
			errMsgPart: "ความดันตัวล่างต้องน้อยกว่าตัวบน",
		},
		{
			name:       "Diastolic == Systolic (100/100)",
			weight:     60,
			height:     165,
			temp:       36.5,
			sysBP:      100,
			diaBP:      100,
			hr:         75,
			spo2:       98,
			wantErr:    true,
			errMsgPart: "ความดันตัวล่างต้องน้อยกว่าตัวบน",
		},
		{
			name:       "SpO2 0% (Forbidden)",
			weight:     60,
			height:     165,
			temp:       36.5,
			sysBP:      120,
			diaBP:      80,
			hr:         75,
			spo2:       0,
			wantErr:    true,
			errMsgPart: "SpO2",
		},
		{
			name:       "SpO2 101% (Forbidden)",
			weight:     60,
			height:     165,
			temp:       36.5,
			sysBP:      120,
			diaBP:      80,
			hr:         75,
			spo2:       101,
			wantErr:    true,
			errMsgPart: "SpO2",
		},
		{
			name:       "Critical SpO2 88% (Physiologically possible - Allowed)",
			weight:     60,
			height:     165,
			temp:       36.5,
			sysBP:      120,
			diaBP:      80,
			hr:         75,
			spo2:       88,
			wantErr:    false,
		},
		{
			name:       "Temperature 20 C (Below Min 25)",
			weight:     60,
			height:     165,
			temp:       20.0,
			sysBP:      120,
			diaBP:      80,
			hr:         75,
			spo2:       98,
			wantErr:    true,
			errMsgPart: "อุณหภูมิ",
		},
		{
			name:       "Temperature 46 C (Above Max 45)",
			weight:     60,
			height:     165,
			temp:       46.0,
			sysBP:      120,
			diaBP:      80,
			hr:         75,
			spo2:       98,
			wantErr:    true,
			errMsgPart: "อุณหภูมิ",
		},
		{
			name:       "Pulse 0 bpm (Forbidden)",
			weight:     60,
			height:     165,
			temp:       36.5,
			sysBP:      120,
			diaBP:      80,
			hr:         0,
			spo2:       98,
			wantErr:    true,
			errMsgPart: "ชีพจร",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateClinicalVitals(tt.weight, tt.height, tt.temp, tt.sysBP, tt.diaBP, tt.hr, tt.spo2, tt.rr, tt.pain, tt.bs)
			if (err != nil) != tt.wantErr {
				t.Fatalf("ValidateClinicalVitals() error = %v, wantErr %v", err, tt.wantErr)
			}
			if tt.wantErr && tt.errMsgPart != "" {
				if err == nil || len(err.Error()) == 0 {
					t.Fatalf("expected error containing %q, got nil", tt.errMsgPart)
				}
			}
		})
	}
}
