/**
 * Clinical Decision Support (CDS) & Early Warning Scoring (EWS) for Vitals
 * Standards based on Thai Hypertension Society, WHO, and NIEMS guidelines.
 */

export type ClinicalAlertLevel = 'normal' | 'warning' | 'danger';

export interface VitalsWarning {
  level: ClinicalAlertLevel;
  badgeText: string;
  detail: string;
}

/**
 * Evaluate Blood Pressure (Systolic / Diastolic)
 */
export function evaluateBloodPressure(sys?: number | string, dia?: number | string): VitalsWarning | null {
  const s = typeof sys === 'string' ? parseFloat(sys) : sys;
  const d = typeof dia === 'string' ? parseFloat(dia) : dia;

  if (!s || isNaN(s) || !d || isNaN(d)) return null;

  if (s >= 180 || d >= 120) {
    return {
      level: 'danger',
      badgeText: 'ความดันวิกฤต (Crisis BP)',
      detail: `SBP ${s} / DBP ${d} mmHg เสี่ยงภาวะแทรกซ้อนเฉียบพลัน`,
    };
  }
  if (s >= 160 || d >= 100) {
    return {
      level: 'danger',
      badgeText: 'ความดันสูงระดับ 2',
      detail: `SBP ${s} / DBP ${d} mmHg อยู่ในเกณฑ์สูงมาก`,
    };
  }
  if (s >= 140 || d >= 90) {
    return {
      level: 'warning',
      badgeText: 'ความดันสูงระดับ 1',
      detail: `SBP ${s} / DBP ${d} mmHg สูงกว่าเกณฑ์ปกติ`,
    };
  }
  if (s >= 120 || d >= 80) {
    return {
      level: 'warning',
      badgeText: 'ความดันเริ่มสูง (Pre-HT)',
      detail: `SBP ${s} / DBP ${d} mmHg เริ่มเฝ้าระวัง`,
    };
  }
  if (s < 90 || d < 60) {
    return {
      level: 'danger',
      badgeText: 'ความดันโลหิตต่ำ (Hypotension)',
      detail: `SBP ${s} / DBP ${d} mmHg ต่ำกว่าเกณฑ์ปกติ`,
    };
  }

  return {
    level: 'normal',
    badgeText: 'ความดันปกติ',
    detail: 'อยู่ในเกณฑ์มาตรฐาน (<120/80 mmHg)',
  };
}

/**
 * Evaluate Body Temperature
 */
export function evaluateTemperature(temp?: number | string): VitalsWarning | null {
  const t = typeof temp === 'string' ? parseFloat(temp) : temp;
  if (!t || isNaN(t)) return null;

  if (t >= 38.5) {
    return {
      level: 'danger',
      badgeText: 'ไข้สูง (High Fever)',
      detail: `${t.toFixed(1)} °C ควรได้รับยาลดไข้/เช็ดตัวลดไข้`,
    };
  }
  if (t >= 37.5) {
    return {
      level: 'warning',
      badgeText: 'มีไข้ต่ำ (Low Fever)',
      detail: `${t.toFixed(1)} °C อุณหภูมิร่างกายเริ่มสูง`,
    };
  }
  if (t < 35.0) {
    return {
      level: 'danger',
      badgeText: 'อุณหภูมิต่ำ (Hypothermia)',
      detail: `${t.toFixed(1)} °C ต่ำกว่าเกณฑ์ปกติ`,
    };
  }

  return {
    level: 'normal',
    badgeText: 'อุณหภูมิปกติ',
    detail: `${t.toFixed(1)} °C (35.5 - 37.4 °C)`,
  };
}

/**
 * Evaluate Oxygen Saturation (SpO2)
 */
export function evaluateSpO2(spo2?: number | string): VitalsWarning | null {
  const o2 = typeof spo2 === 'string' ? parseFloat(spo2) : spo2;
  if (!o2 || isNaN(o2)) return null;

  if (o2 < 90) {
    return {
      level: 'danger',
      badgeText: 'ออกซิเจนต่ำวิกฤต (Severe Hypoxia)',
      detail: `SpO2 ${o2}% ต้องการออกซิเจนทันที`,
    };
  }
  if (o2 < 95) {
    return {
      level: 'warning',
      badgeText: 'ออกซิเจนต่ำ (Mild Hypoxia)',
      detail: `SpO2 ${o2}% ต่ำกว่าเกณฑ์ปกติ (ควร >= 95%)`,
    };
  }

  return {
    level: 'normal',
    badgeText: 'ออกซิเจนปกติ',
    detail: `SpO2 ${o2}%`,
  };
}

/**
 * Evaluate Heart Rate (Pulse)
 */
export function evaluateHeartRate(hr?: number | string): VitalsWarning | null {
  const rate = typeof hr === 'string' ? parseFloat(hr) : hr;
  if (!rate || isNaN(rate)) return null;

  if (rate > 120) {
    return {
      level: 'danger',
      badgeText: 'ชีพจรเร็วมาก (Severe Tachycardia)',
      detail: `${rate} bpm สูงกว่า 120 ครั้ง/นาที`,
    };
  }
  if (rate > 100) {
    return {
      level: 'warning',
      badgeText: 'ชีพจรเร็ว (Tachycardia)',
      detail: `${rate} bpm (ปกติ 60-100 ครั้ง/นาที)`,
    };
  }
  if (rate < 50) {
    return {
      level: 'danger',
      badgeText: 'ชีพจรช้ามาก (Severe Bradycardia)',
      detail: `${rate} bpm ต่ำกว่า 50 ครั้ง/นาที`,
    };
  }
  if (rate < 60) {
    return {
      level: 'warning',
      badgeText: 'ชีพจรช้า (Bradycardia)',
      detail: `${rate} bpm (ปกติ 60-100 ครั้ง/นาที)`,
    };
  }

  return {
    level: 'normal',
    badgeText: 'ชีพจรปกติ',
    detail: `${rate} bpm`,
  };
}

/**
 * Evaluate Respiratory Rate
 */
export function evaluateRespiratoryRate(rr?: number | string): VitalsWarning | null {
  const rate = typeof rr === 'string' ? parseFloat(rr) : rr;
  if (!rate || isNaN(rate)) return null;

  if (rate >= 28) {
    return {
      level: 'danger',
      badgeText: 'หายใจเร็ววิกฤต (Tachypnea)',
      detail: `${rate} ครั้ง/นาที เสี่ยงภาวะเหนื่อยหอบรุนแรง`,
    };
  }
  if (rate > 22) {
    return {
      level: 'warning',
      badgeText: 'หายใจเร็ว (Tachypnea)',
      detail: `${rate} ครั้ง/นาที (ปกติ 12-20 ครั้ง/นาที)`,
    };
  }
  if (rate < 10) {
    return {
      level: 'danger',
      badgeText: 'หายใจช้าผิดปกติ (Bradypnea)',
      detail: `${rate} ครั้ง/นาที เสี่ยงกดการหายใจ`,
    };
  }

  return {
    level: 'normal',
    badgeText: 'การหายใจปกติ',
    detail: `${rate} ครั้ง/นาที`,
  };
}
