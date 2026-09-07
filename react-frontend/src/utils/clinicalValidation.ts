// ==============================================================================
// Clinical Validation Constants & Rules (Single Source of Truth)
// ==============================================================================

export interface ClinicalBounds {
  min: number;
  max: number;
  unit: string;
  label: string;
}

export interface ClinicalWarningThresholds {
  minWarning?: number;
  maxWarning?: number;
  warningLabel: string;
}

// 1. ช่วงที่ปฏิเสธทันที (Hard Rejection Bounds: 400 Bad Request / Block Submit)
export const CLINICAL_HARD_BOUNDS: Record<string, ClinicalBounds> = {
  weight: { min: 0.01, max: 500, unit: 'กก.', label: 'น้ำหนัก' },
  height: { min: 0.01, max: 250, unit: 'ซม.', label: 'ส่วนสูง' },
  temperature: { min: 25.0, max: 45.0, unit: '°C', label: 'อุณหภูมิ' },
  systolicBP: { min: 40, max: 300, unit: 'mmHg', label: 'ความดันตัวบน (Systolic)' },
  diastolicBP: { min: 20, max: 200, unit: 'mmHg', label: 'ความดันตัวล่าง (Diastolic)' },
  heartRate: { min: 20, max: 250, unit: 'ครั้ง/นาที', label: 'ชีพจร' },
  spo2: { min: 50, max: 100, unit: '%', label: 'ระดับออกซิเจนในเลือด (SpO2)' },
  respiratoryRate: { min: 5, max: 60, unit: 'ครั้ง/นาที', label: 'อัตราการหายใจ' },
  painScore: { min: 0, max: 10, unit: 'คะแนน', label: 'ระดับความเจ็บปวด (Pain Score)' },
  bloodSugar: { min: 20, max: 600, unit: 'mg/dL', label: 'ระดับน้ำตาลในเลือด (DTX)' },
};

// 2. ช่วงที่ผิดปกติแต่เกิดได้ทางคลินิก (Warning / Confirmation Thresholds)
export const CLINICAL_WARNING_THRESHOLDS: Record<string, ClinicalWarningThresholds> = {
  weight: { minWarning: 30, maxWarning: 150, warningLabel: 'น้ำหนักผิดปกติ (< 30 หรือ > 150 กก.)' },
  height: { minWarning: 120, maxWarning: 200, warningLabel: 'ส่วนสูงผิดปกติ (< 120 หรือ > 200 ซม.)' },
  temperature: { minWarning: 35.0, maxWarning: 39.0, warningLabel: 'อุณหภูมิผิดปกติ (< 35 หรือ > 39 °C)' },
  systolicBP: { minWarning: 90, maxWarning: 180, warningLabel: 'ความดันตัวบนผิดปกติ (< 90 หรือ > 180 mmHg)' },
  heartRate: { minWarning: 50, maxWarning: 120, warningLabel: 'ชีพจรผิดปกติ (< 50 หรือ > 120 ครั้ง/นาที)' },
  spo2: { minWarning: 95, warningLabel: 'ระดับ SpO2 ต่ำกว่าปกติ (< 95%)' },
};

export interface VitalsValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  warnings: Array<{ field: string; message: string }>;
}

export function validateVitalsInput(vitals: {
  weight: string;
  height: string;
  temperature: string;
  systolicBP: string;
  diastolicBP: string;
  heartRate: string;
  spo2: string;
  respiratoryRate?: string;
  painScore?: string;
  bloodSugar?: string;
}): VitalsValidationResult {
  const errors: Record<string, string> = {};
  const warnings: Array<{ field: string; message: string }> = [];

  // 1. ตรวจสอบ Required Fields ว่างเปล่า
  if (!vitals.weight || !vitals.weight.trim()) {
    errors.weight = 'กรุณาระบุน้ำหนัก';
  }
  if (!vitals.height || !vitals.height.trim()) {
    errors.height = 'กรุณาระบุส่วนสูง';
  }
  if (!vitals.temperature || !vitals.temperature.trim()) {
    errors.temperature = 'กรุณาระบุอุณหภูมิ';
  }
  if (!vitals.systolicBP || !vitals.systolicBP.trim()) {
    errors.systolicBP = 'กรุณาระบุความดันตัวบน (Systolic)';
  }
  if (!vitals.diastolicBP || !vitals.diastolicBP.trim()) {
    errors.diastolicBP = 'กรุณาระบุความดันตัวล่าง (Diastolic)';
  }
  if (!vitals.heartRate || !vitals.heartRate.trim()) {
    errors.heartRate = 'กรุณาระบุชีพจร';
  }
  if (!vitals.spo2 || !vitals.spo2.trim()) {
    errors.spo2 = 'กรุณาระบุ SpO2';
  }

  // 2. ตรวจสอบ Hard Bounds
  const numWeight = parseFloat(vitals.weight);
  if (vitals.weight && !isNaN(numWeight)) {
    if (numWeight <= 0 || numWeight > CLINICAL_HARD_BOUNDS.weight.max) {
      errors.weight = `ค่าน้ำหนักต้องมากกว่า 0 และไม่เกิน ${CLINICAL_HARD_BOUNDS.weight.max} กก.`;
    } else if (
      CLINICAL_WARNING_THRESHOLDS.weight.minWarning !== undefined &&
      CLINICAL_WARNING_THRESHOLDS.weight.maxWarning !== undefined &&
      (numWeight < CLINICAL_WARNING_THRESHOLDS.weight.minWarning || numWeight > CLINICAL_WARNING_THRESHOLDS.weight.maxWarning)
    ) {
      warnings.push({
        field: 'weight',
        message: `น้ำหนัก ${numWeight} กก. อยู่ในเกณฑ์ผิดปกติ (${CLINICAL_WARNING_THRESHOLDS.weight.warningLabel})`,
      });
    }
  }

  const numHeight = parseFloat(vitals.height);
  if (vitals.height && !isNaN(numHeight)) {
    if (numHeight <= 0 || numHeight > CLINICAL_HARD_BOUNDS.height.max) {
      errors.height = `ค่าส่วนสูงต้องมากกว่า 0 และไม่เกิน ${CLINICAL_HARD_BOUNDS.height.max} ซม.`;
    } else if (
      CLINICAL_WARNING_THRESHOLDS.height.minWarning !== undefined &&
      CLINICAL_WARNING_THRESHOLDS.height.maxWarning !== undefined &&
      (numHeight < CLINICAL_WARNING_THRESHOLDS.height.minWarning || numHeight > CLINICAL_WARNING_THRESHOLDS.height.maxWarning)
    ) {
      warnings.push({
        field: 'height',
        message: `ส่วนสูง ${numHeight} ซม. อยู่ในเกณฑ์ผิดปกติ (${CLINICAL_WARNING_THRESHOLDS.height.warningLabel})`,
      });
    }
  }

  const numTemp = parseFloat(vitals.temperature);
  if (vitals.temperature && !isNaN(numTemp)) {
    if (numTemp < CLINICAL_HARD_BOUNDS.temperature.min || numTemp > CLINICAL_HARD_BOUNDS.temperature.max) {
      errors.temperature = `ค่าอุณหภูมิต้องอยู่ระหว่าง ${CLINICAL_HARD_BOUNDS.temperature.min} - ${CLINICAL_HARD_BOUNDS.temperature.max} °C`;
    } else if (
      CLINICAL_WARNING_THRESHOLDS.temperature.minWarning !== undefined &&
      CLINICAL_WARNING_THRESHOLDS.temperature.maxWarning !== undefined &&
      (numTemp < CLINICAL_WARNING_THRESHOLDS.temperature.minWarning || numTemp > CLINICAL_WARNING_THRESHOLDS.temperature.maxWarning)
    ) {
      warnings.push({
        field: 'temperature',
        message: `อุณหภูมิ ${numTemp} °C อยู่ในเกณฑ์ผิดปกติ (${CLINICAL_WARNING_THRESHOLDS.temperature.warningLabel})`,
      });
    }
  }

  const numSys = parseInt(vitals.systolicBP, 10);
  if (vitals.systolicBP && !isNaN(numSys)) {
    if (numSys < CLINICAL_HARD_BOUNDS.systolicBP.min || numSys > CLINICAL_HARD_BOUNDS.systolicBP.max) {
      errors.systolicBP = `ค่าความดันตัวบนต้องอยู่ระหว่าง ${CLINICAL_HARD_BOUNDS.systolicBP.min} - ${CLINICAL_HARD_BOUNDS.systolicBP.max} mmHg`;
    } else if (
      CLINICAL_WARNING_THRESHOLDS.systolicBP.minWarning !== undefined &&
      CLINICAL_WARNING_THRESHOLDS.systolicBP.maxWarning !== undefined &&
      (numSys < CLINICAL_WARNING_THRESHOLDS.systolicBP.minWarning || numSys > CLINICAL_WARNING_THRESHOLDS.systolicBP.maxWarning)
    ) {
      warnings.push({
        field: 'systolicBP',
        message: `ความดันตัวบน ${numSys} mmHg อยู่ในเกณฑ์ผิดปกติ (${CLINICAL_WARNING_THRESHOLDS.systolicBP.warningLabel})`,
      });
    }
  }

  const numDia = parseInt(vitals.diastolicBP, 10);
  if (vitals.diastolicBP && !isNaN(numDia)) {
    if (numDia < CLINICAL_HARD_BOUNDS.diastolicBP.min || numDia > CLINICAL_HARD_BOUNDS.diastolicBP.max) {
      errors.diastolicBP = `ค่าความดันตัวล่างต้องอยู่ระหว่าง ${CLINICAL_HARD_BOUNDS.diastolicBP.min} - ${CLINICAL_HARD_BOUNDS.diastolicBP.max} mmHg`;
    }
  }

  // 3. กฎเชิงสัมพันธ์: Diastolic ต้องน้อยกว่า Systolic เสมอ (BUG-A3-11)
  if (!isNaN(numSys) && !isNaN(numDia) && numSys > 0 && numDia > 0) {
    if (numDia >= numSys) {
      errors.diastolicBP = 'ความดันตัวล่างต้องน้อยกว่าตัวบนเสมอ';
      errors.systolicBP = 'ความดันตัวบนต้องมากกว่าตัวล่างเสมอ';
    }
  }

  const numHR = parseInt(vitals.heartRate, 10);
  if (vitals.heartRate && !isNaN(numHR)) {
    if (numHR < CLINICAL_HARD_BOUNDS.heartRate.min || numHR > CLINICAL_HARD_BOUNDS.heartRate.max) {
      errors.heartRate = `ค่าชีพจรต้องอยู่ระหว่าง ${CLINICAL_HARD_BOUNDS.heartRate.min} - ${CLINICAL_HARD_BOUNDS.heartRate.max} ครั้ง/นาที`;
    } else if (
      CLINICAL_WARNING_THRESHOLDS.heartRate.minWarning !== undefined &&
      CLINICAL_WARNING_THRESHOLDS.heartRate.maxWarning !== undefined &&
      (numHR < CLINICAL_WARNING_THRESHOLDS.heartRate.minWarning || numHR > CLINICAL_WARNING_THRESHOLDS.heartRate.maxWarning)
    ) {
      warnings.push({
        field: 'heartRate',
        message: `ชีพจร ${numHR} ครั้ง/นาที อยู่ในเกณฑ์ผิดปกติ (${CLINICAL_WARNING_THRESHOLDS.heartRate.warningLabel})`,
      });
    }
  }

  const numSpO2 = parseInt(vitals.spo2, 10);
  if (vitals.spo2 && !isNaN(numSpO2)) {
    if (numSpO2 < CLINICAL_HARD_BOUNDS.spo2.min || numSpO2 > CLINICAL_HARD_BOUNDS.spo2.max) {
      errors.spo2 = `ค่า SpO2 ต้องอยู่ระหว่าง ${CLINICAL_HARD_BOUNDS.spo2.min} - ${CLINICAL_HARD_BOUNDS.spo2.max} %`;
    } else if (
      CLINICAL_WARNING_THRESHOLDS.spo2.minWarning !== undefined &&
      numSpO2 < CLINICAL_WARNING_THRESHOLDS.spo2.minWarning
    ) {
      warnings.push({
        field: 'spo2',
        message: `SpO2 ${numSpO2}% อยู่ในเกณฑ์ต่ำกว่าปกติ (${CLINICAL_WARNING_THRESHOLDS.spo2.warningLabel})`,
      });
    }
  }

  // 4. Optional Fields Bounds
  if (vitals.respiratoryRate && vitals.respiratoryRate.trim()) {
    const numRR = parseInt(vitals.respiratoryRate, 10);
    if (!isNaN(numRR)) {
      if (numRR < CLINICAL_HARD_BOUNDS.respiratoryRate.min || numRR > CLINICAL_HARD_BOUNDS.respiratoryRate.max) {
        errors.respiratoryRate = `อัตราการหายใจต้องอยู่ระหว่าง ${CLINICAL_HARD_BOUNDS.respiratoryRate.min} - ${CLINICAL_HARD_BOUNDS.respiratoryRate.max} ครั้ง/นาที`;
      }
    }
  }

  if (vitals.painScore && vitals.painScore.trim()) {
    const numPain = parseInt(vitals.painScore, 10);
    if (!isNaN(numPain)) {
      if (numPain < CLINICAL_HARD_BOUNDS.painScore.min || numPain > CLINICAL_HARD_BOUNDS.painScore.max) {
        errors.painScore = `คะแนนความเจ็บปวดต้องอยู่ระหว่าง ${CLINICAL_HARD_BOUNDS.painScore.min} - ${CLINICAL_HARD_BOUNDS.painScore.max}`;
      }
    }
  }

  if (vitals.bloodSugar && vitals.bloodSugar.trim()) {
    const numBS = parseInt(vitals.bloodSugar, 10);
    if (!isNaN(numBS)) {
      if (numBS < CLINICAL_HARD_BOUNDS.bloodSugar.min || numBS > CLINICAL_HARD_BOUNDS.bloodSugar.max) {
        errors.bloodSugar = `ระดับน้ำตาลในเลือดต้องอยู่ระหว่าง ${CLINICAL_HARD_BOUNDS.bloodSugar.min} - ${CLINICAL_HARD_BOUNDS.bloodSugar.max} mg/dL`;
      }
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    warnings,
  };
}
