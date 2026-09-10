export type TriageLevelNum = 1 | 2 | 3 | 4;

export type TriageLevelKey = 'ฉุกเฉินวิกฤต (Resuscitation)' | 'ฉุกเฉินเร่งด่วน (Urgent)' | 'กึ่งฉุกเฉิน (Semi-Urgent)' | 'ปกติ (Normal)';

export interface TriageLevelInfo {
  key: TriageLevelKey;
  levelNum: TriageLevelNum;
  labelTh: string;
  labelEn: string;
  badgeClass: string;
  color: string;
  bgLight: string;
  bgDark: string;
  description: string;
}

export type BMICategoryKey = 'ผอมเกินไป (Underweight)' | 'ปกติ (Normal)' | 'ท้วม / น้ำหนักเกิน (Overweight)' | 'อ้วนระดับ 1 (Obese I)' | 'อ้วนระดับ 2 (Obese II)';

export interface BMICategoryInfo {
  key: BMICategoryKey;
  labelTh: string;
  labelEn: string;
  color: string;
  badgeClass: string;
  rangeText: string;
}

export interface DoctorOption {
  doctorId: number;
  fullName: string;
  specialty: string;
  roomName: string;
}

export interface QueuePatientItem {
  id: string;
  queueId?: number;
  patientId?: number;
  queueNo: string;
  hn: string;
  fullName: string;
  nationalId: string;
  gender: 'ชาย' | 'หญิง' | 'อื่นๆ';
  age: number;
  phone: string;
  schemeType: string;
  allergies?: string;
  chronicDiseases?: string;
  registeredTime: string;
  queueStatus: 'รอคัดกรอง' | 'รอพบแพทย์' | 'กำลังตรวจ' | 'เสร็จสิ้น';
}

export interface ScreeningRecord {
  id: string;
  visitId: number;
  queueNo: string;
  hn: string;
  patientName: string;
  nationalId: string;
  age: number;
  gender: string;
  screenedByUserName: string;
  screenedByRole: string;
  triageLevel: TriageLevelKey;
  chiefComplaint: string;
  allergies: string;
  medicalHistory: string;
  weight: number; // kg
  height: number; // cm
  bmi: number;
  temperature: number; // °C
  systolicBP: number; // mmHg
  diastolicBP: number; // mmHg
  heartRate: number; // bpm
  respiratoryRate?: number; // ครั้ง/นาที
  spo2?: number; // %
  painScore?: number; // ระดับความเจ็บปวด 0-10
  bloodSugar?: number; // mg/dL
  foodAllergies?: string;
  currentMedications?: string;
  smokingHistory?: string;
  alcoholHistory?: string;
  nurseNotes?: string;
  herbalMedicines?: string;
  dietarySupplements?: string;
  hasURI?: boolean | null;
  hasTB?: boolean | null;
  onAnticoagulant?: boolean | null;
  precautionType?: string;
  isPregnant?: boolean | null;
  isBreastfeeding?: boolean | null;
  lastMenstrualPeriod?: string;
  q2Depressed?: boolean | null;
  q2Anhedonia?: boolean | null;
  screeningPositive?: boolean | null;
  assignedDoctorId: number;
  assignedDoctorName: string;
  assignedRoom: string;
  screenedAt: string;
}
