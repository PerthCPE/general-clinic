package services

import (
	"fmt"
)

// ClinicalBounds represents the min and max limits for medical measurements
type ClinicalBounds struct {
	Min   float64
	Max   float64
	Unit  string
	Label string
}

// Hard Rejection Bounds (Single Source of Truth matching Frontend)
var (
	WeightBounds          = ClinicalBounds{Min: 0.01, Max: 500, Unit: "กก.", Label: "น้ำหนัก"}
	HeightBounds          = ClinicalBounds{Min: 0.01, Max: 250, Unit: "ซม.", Label: "ส่วนสูง"}
	TemperatureBounds     = ClinicalBounds{Min: 25.0, Max: 45.0, Unit: "°C", Label: "อุณหภูมิ"}
	SystolicBPBounds      = ClinicalBounds{Min: 40, Max: 300, Unit: "mmHg", Label: "ความดันตัวบน (Systolic)"}
	DiastolicBPBounds     = ClinicalBounds{Min: 20, Max: 200, Unit: "mmHg", Label: "ความดันตัวล่าง (Diastolic)"}
	HeartRateBounds       = ClinicalBounds{Min: 20, Max: 250, Unit: "ครั้ง/นาที", Label: "ชีพจร"}
	SpO2Bounds            = ClinicalBounds{Min: 50, Max: 100, Unit: "%", Label: "ระดับออกซิเจนในเลือด (SpO2)"}
	RespiratoryRateBounds = ClinicalBounds{Min: 5, Max: 60, Unit: "ครั้ง/นาที", Label: "อัตราการหายใจ"}
	PainScoreBounds       = ClinicalBounds{Min: 0, Max: 10, Unit: "คะแนน", Label: "ระดับความเจ็บปวด"}
	BloodSugarBounds      = ClinicalBounds{Min: 20, Max: 600, Unit: "mg/dL", Label: "ระดับน้ำตาลในเลือด"}
)

// ValidateClinicalVitals validates required measurements and physiological bounds
func ValidateClinicalVitals(
	weight float64,
	height float64,
	temp float64,
	sysBP int,
	diaBP int,
	hr int,
	spo2 int,
	rr int,
	painScore int,
	bloodSugar int,
) error {
	// 1. Required Fields presence check (> 0)
	if weight <= 0 {
		return fmt.Errorf("กรุณาระบุน้ำหนักที่ถูกต้อง (ต้องมากกว่า 0 กก.)")
	}
	if height <= 0 {
		return fmt.Errorf("กรุณาระบุส่วนสูงที่ถูกต้อง (ต้องมากกว่า 0 ซม.)")
	}
	if temp <= 0 {
		return fmt.Errorf("กรุณาระบุอุณหภูมิร่างกาย")
	}
	if sysBP <= 0 {
		return fmt.Errorf("กรุณาระบุความดันตัวบน (Systolic)")
	}
	if diaBP <= 0 {
		return fmt.Errorf("กรุณาระบุความดันตัวล่าง (Diastolic)")
	}
	if hr <= 0 {
		return fmt.Errorf("กรุณาระบุชีพจร")
	}
	if spo2 <= 0 {
		return fmt.Errorf("กรุณาระบุระดับออกซิเจนในเลือด (SpO2)")
	}

	// 2. Hard Bounds Check
	if weight < WeightBounds.Min || weight > WeightBounds.Max {
		return fmt.Errorf("ค่าน้ำหนักต้องอยู่ระหว่าง %.2f - %.0f %s", WeightBounds.Min, WeightBounds.Max, WeightBounds.Unit)
	}
	if height < HeightBounds.Min || height > HeightBounds.Max {
		return fmt.Errorf("ค่าส่วนสูงต้องอยู่ระหว่าง %.2f - %.0f %s", HeightBounds.Min, HeightBounds.Max, HeightBounds.Unit)
	}
	if temp < TemperatureBounds.Min || temp > TemperatureBounds.Max {
		return fmt.Errorf("ค่าอุณหภูมิต้องอยู่ระหว่าง %.1f - %.1f %s", TemperatureBounds.Min, TemperatureBounds.Max, TemperatureBounds.Unit)
	}
	if float64(sysBP) < SystolicBPBounds.Min || float64(sysBP) > SystolicBPBounds.Max {
		return fmt.Errorf("ค่าความดันตัวบนต้องอยู่ระหว่าง %.0f - %.0f %s", SystolicBPBounds.Min, SystolicBPBounds.Max, SystolicBPBounds.Unit)
	}
	if float64(diaBP) < DiastolicBPBounds.Min || float64(diaBP) > DiastolicBPBounds.Max {
		return fmt.Errorf("ค่าความดันตัวล่างต้องอยู่ระหว่าง %.0f - %.0f %s", DiastolicBPBounds.Min, DiastolicBPBounds.Max, DiastolicBPBounds.Unit)
	}

	// 3. Relational Rule: Diastolic < Systolic (BUG-A3-11)
	if diaBP >= sysBP {
		return fmt.Errorf("ความดันตัวล่างต้องน้อยกว่าตัวบน")
	}

	if float64(hr) < HeartRateBounds.Min || float64(hr) > HeartRateBounds.Max {
		return fmt.Errorf("ค่าชีพจรต้องอยู่ระหว่าง %.0f - %.0f %s", HeartRateBounds.Min, HeartRateBounds.Max, HeartRateBounds.Unit)
	}
	if float64(spo2) < SpO2Bounds.Min || float64(spo2) > SpO2Bounds.Max {
		return fmt.Errorf("ค่า SpO2 ต้องอยู่ระหว่าง %.0f - %.0f %s", SpO2Bounds.Min, SpO2Bounds.Max, SpO2Bounds.Unit)
	}

	// 4. Optional Fields
	if rr > 0 && (float64(rr) < RespiratoryRateBounds.Min || float64(rr) > RespiratoryRateBounds.Max) {
		return fmt.Errorf("อัตราการหายใจต้องอยู่ระหว่าง %.0f - %.0f %s", RespiratoryRateBounds.Min, RespiratoryRateBounds.Max, RespiratoryRateBounds.Unit)
	}
	if painScore > 0 && (float64(painScore) < PainScoreBounds.Min || float64(painScore) > PainScoreBounds.Max) {
		return fmt.Errorf("คะแนนความเจ็บปวดต้องอยู่ระหว่าง %.0f - %.0f", PainScoreBounds.Min, PainScoreBounds.Max)
	}
	if bloodSugar > 0 && (float64(bloodSugar) < BloodSugarBounds.Min || float64(bloodSugar) > BloodSugarBounds.Max) {
		return fmt.Errorf("ระดับน้ำตาลในเลือดต้องอยู่ระหว่าง %.0f - %.0f %s", BloodSugarBounds.Min, BloodSugarBounds.Max, BloodSugarBounds.Unit)
	}

	return nil
}
