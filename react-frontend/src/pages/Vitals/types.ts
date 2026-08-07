// Types matching Go Backend Models: Screening, VisitRecord, Patient, Doctor, Queue

export type TriageLevelKey = 'ปกติ (Normal)' | 'กึ่งฉุกเฉิน (Semi-Urgent)' | 'ฉุกเฉินเร่งด่วน (Urgent)' | 'ฉุกเฉินวิกฤต (Resuscitation)';

export interface TriageLevelInfo {
  key: TriageLevelKey;
  levelNum: number;
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
  assignedDoctorId: number;
  assignedDoctorName: string;
  assignedRoom: string;
  screenedAt: string;
}
