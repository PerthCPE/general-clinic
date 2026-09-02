// Types for Screening History Dashboard
// Aligns with Go backend models (Screening, VisitRecord, Patient, User)

export type TriageLevelKey =
  | 'ฉุกเฉินวิกฤต (Resuscitation)'
  | 'ฉุกเฉินเร่งด่วน (Urgent)'
  | 'กึ่งฉุกเฉิน (Semi-Urgent)'
  | 'ปกติ (Normal)';

export type ClinicalRiskFilter = 'all' | 'high-bp' | 'fever' | 'tachycardia' | 'has-allergy';
export type DateRangePreset = 'all' | 'today' | '7days' | 'this-month' | '3months';

export interface ScreeningHistoryItem {
  id: string;
  visitId: number;
  visitDate: string;        // เช่น "24/07/2026 09:30 น."
  dateOnly: string;         // เช่น "24/07/2026"
  timeOnly: string;         // เช่น "09:30 น."
  queueNo: string;          // เช่น "Q001"
  patientId: number;
  hn?: string;              // เช่น "HN0001"
  nationalId: string;       // เช่น "0-1234-56789-01-2"
  patientName: string;      // เช่น "นายสมชาย ใจดี"
  gender: 'ชาย' | 'หญิง';
  age: number;
  phoneNumber: string;
  schemeType: string;       // เช่น "บัตรทอง (สปสช.)"

  // Vitals measurements
  weight: number;           // kg
  height: number;           // cm
  bmi: number;              // kg/m²
  bmiCategory: string;      // เช่น "ปกติ", "ท้วม", "อ้วน ระดับ 1"
  temperature: number;      // °C
  systolicBP: number;       // mmHg
  diastolicBP: number;      // mmHg
  heartRate: number;        // bpm
  respiratoryRate?: number; // breaths/min
  spo2?: number;            // %
  painScore?: number;       // 0-10
  bloodSugar?: number;      // mg/dL

  // Clinical records
  triageLevel: TriageLevelKey;
  chiefComplaint: string;
  allergies: string;
  foodAllergies?: string;
  medicalHistory: string;
  currentMedications?: string;
  smokingHistory?: string;
  alcoholHistory?: string;
  nurseNotes?: string;

  // Staff info
  screenedByUserName: string;
  screenedByRole: string;
  assignedDoctorId: number;
  assignedDoctorName: string;
  assignedRoom: string;
}

export interface PatientProfileSummary {
  patientId: number;
  nationalId: string;
  fullName: string;
  age: number;
  gender: 'ชาย' | 'หญิง';
  phoneNumber: string;
  schemeType: string;
  allergies: string;
  chronicDiseases: string;
  totalVisits: number;
  lastVisitDate: string;
  averageBP: string;        // เช่น "122/78 mmHg"
  averageBMI: number;       // เช่น 22.8
  weightTrend: 'up' | 'down' | 'stable';
}

export interface ScreeningStats {
  totalRecords: number;
  thisMonthRecords: number;
  highBPRatePercent: number;
  urgentTriageCount: number;
  allergyPatientsCount: number;
}
