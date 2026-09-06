export type QueueStatus = 
  | 'Waiting' 
  | 'Screened'
  | 'Examining' 
  | 'Pending Pharmacy' 
  | 'Completed' 
  | 'Cancelled';

export interface PrescriptionItem {
  id: string;

  // รหัสยาจริงจากตาราง medicines ของห้องยา
  // เก็บไว้ตั้งแต่ตอนที่แพทย์เลือกยาจากรายการ จะได้ไม่ต้องให้ backend เดาจากชื่ออีก
  // (ชื่อยาสองฝั่งสะกดไม่เหมือนกันได้ เช่น "Paracetamol 500mg tab" กับ "Paracetamol 500mg"
  //  ถ้าเดาจากชื่อแล้วพลาด ผู้ป่วยอาจได้ยาผิดตัวโดยไม่มีใครรู้)
  // เป็น optional เพราะรายการยาเก่าที่บันทึกไว้ก่อนหน้านี้ยังไม่มีรหัส
  medicineId?: number;
  medicineCode?: string;
  unitPrice?: number;

  medicineName: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: number;
  route: string;
  timing: string;
  specialInstructions?: string;
}

export interface LabOrderItem {
  id: string;
  testName: string;
  category: string;
  indication?: string;
  isUrgent: boolean;
}

export interface ImagingOrderItem {
  id: string;
  type: 'X-Ray' | 'Ultrasound' | 'CT Scan' | 'MRI' | 'ECG' | 'Other';
  bodyPart: string;
  clinicalIndication?: string;
  isUrgent: boolean;
}

export interface DiagnosisItem {
  code: string;
  name: string;
  localName?: string;
}

export interface DrugAllergyDetail {
  noAllergy: boolean;
  drugName?: string;
  symptoms?: string;
}

export interface FoodAllergyDetail {
  noAllergy: boolean;
  foodName?: string;
  symptoms?: string;
}

export interface PastVisitRecord {
  id: string;
  vn: string;
  visitDate: string;
  visitTime?: string;
  doctorName?: string;
  department?: string;
  chiefComplaint: string;
  diagnosis: string;
  icdCode?: string;
  vitals?: {
    bp?: string;
    pulse?: number;
    temp?: number;
    weight?: number;
    spo2?: number;
  };
  prescription?: string;
  prescriptionsList?: PrescriptionItem[];
  doctorNotes?: string;
  followUpDate?: string;
  status?: string;

  // ---- ข้อมูลเพิ่มเติมของการมาตรวจครั้งนั้น ----
  // ใช้ตอนผู้ป่วยกลับมาตรวจซ้ำ แพทย์จะได้รู้ว่าครั้งก่อนรักษาอย่างไร
  /** การวินิจฉัยรอง นอกเหนือจากโรคหลัก */
  secondaryDiagnoses?: { code: string; name: string }[];
  /** แผนการรักษาที่แพทย์วางไว้ครั้งนั้น */
  treatmentPlan?: string;
  /** หัตถการที่ทำในครั้งนั้น */
  proceduresPerformed?: string;
  /** เหตุผลทางการแพทย์และการประเมิน */
  assessmentNotes?: string;
  /** บันทึกทางคลินิกเพิ่มเติม */
  clinicalNotes?: string;
  /** คำแนะนำที่ให้ผู้ป่วย แยกเป็น 5 ด้านตามฟอร์มหน้าบันทึกการตรวจ */
  counseling?: {
    medicationAdvice?: string;
    dietAdvice?: string;
    exerciseAdvice?: string;
    lifestyleAdvice?: string;
    diseaseEducation?: string;
  };
  /** เหตุผลที่นัดติดตามอาการ */
  followUpReason?: string;
  /** คำแนะนำเพิ่มเติมสำหรับการนัดครั้งถัดไป */
  followUpInstructions?: string;
  /** เหตุผลการยกเลิก มีเฉพาะครั้งที่ถูกยกเลิกการรับบริการ */
  cancelReason?: string;

  /** ประวัติการเจ็บป่วยปัจจุบันที่แพทย์ซักในวันนั้น */
  presentIllness?: string;
  /** เป็นมานานเท่าไรก่อนมาพบแพทย์ */
  complaintDuration?: string;
  /** ผลตรวจร่างกาย 8 ระบบ ช่องที่แพทย์ไม่ได้กรอกจะเป็นค่าว่าง */
  physicalExam?: {
    generalAppearance?: string;
    heent?: string;
    cardiovascular?: string;
    respiratory?: string;
    abdomen?: string;
    musculoskeletal?: string;
    neurological?: string;
    skin?: string;
  };
}

export interface AttachmentItem {
  id: string;
  name: string;
  type: 'Referral Document' | 'Clinical Photo' | 'Medical Certificate' | 'Other';
  fileUrl?: string;
  uploadedAt?: string;
  fileSize?: string;
}

export interface Patient {
  id: string;

  // รหัสจากฐานข้อมูลจริง ใช้ตอนเรียก API ของแพทย์
  // (id ด้านบนเป็นสตริงสำหรับ React key เท่านั้น เช่น "q-2")
  visitId?: number;
  queueId?: number;
  patientId?: number;

  // จำนวนครั้งที่เคยมาตรวจ 0 = ผู้ป่วยใหม่ที่ยังไม่เคยเข้าตรวจ
  visitCount?: number;

  queueNo: string;
  hn: string;
  vn: string;
  name: string;
  gender: 'Male' | 'Female' | 'Other';
  age: number;
  dob?: string;
  nationalId?: string;
  phone?: string;
  address?: string;
  bloodGroup?: string;
  emergencyContact?: {
    name?: string;
    phone?: string;
    relationship?: string;
    address?: string;
  };
  occupation?: string;
  insuranceType?: string;
  visitDate?: string;
  visitTime?: string;
  status: QueueStatus;
  waitingTimeMinutes: number;

  // Screening & Triage Info
  screeningCompleted?: boolean;
  screenedAt?: string;
  screenedBy?: string;
  
  // Triage Assessment
  triage?: {
    level: 'Level 1: Resuscitation' | 'Level 2: Emergency' | 'Level 3: Urgent' | 'Level 4: Less Urgent' | 'Level 5: Non-Urgent';
    priority: 'High' | 'Medium' | 'Low';
    assessmentNotes?: string;
    notes?: string;
  };

  // Medical History & Complaints
  chiefComplaint?: string;
  chiefComplaintDuration?: string;
  presentIllness?: string;
  pastMedicalHistory?: string;
  chronicDiseases?: string[];
  pastSurgery?: string;
  hospitalAdmissionHistory?: string;
  drugAllergies?: string[];
  drugAllergySymptoms?: string;
  drugAllergyDetails?: DrugAllergyDetail[];
  noDrugAllergy?: boolean;
  foodAllergies?: string[];
  foodAllergyDetails?: FoodAllergyDetail[];
  noFoodAllergy?: boolean;
  hasUnderlyingDisease?: boolean;
  familyHistory?: string;
  socialHistory?: string;
  smokingHistory?: {
    isUser: boolean;
    status: string; // 'Smoker' | 'Non-smoker' | 'Ex-smoker' | 'สูบบุหรี่' | 'ไม่สูบ' | 'เลิกแล้ว'
    frequency?: string; // e.g., '10 มวน/วัน' (10 cigarettes/day)
    duration?: string; // e.g., '5 ปี' (5 years)
  };
  alcoholHistory?: {
    isUser: boolean;
    status: string; // 'Drinker' | 'Non-drinker' | 'Social Drinker' | 'ดื่มแอลกอฮอล์' | 'ไม่ดื่ม'
    frequency?: string; // e.g., '2-3 ครั้ง/สัปดาห์' (2-3 times/week)
    duration?: string; // e.g., '10 ปี' (10 years)
  };
  currentMedications?: string[];
  currentMedicationDetails?: {
    name: string;
    dosage: string;
    frequency: string;
  }[];

  // Nursing Assessment
  nursingAssessment?: {
    generalAppearance?: string;
    consciousness?: string;
    mobility?: string;
    respiratoryCondition?: string;
    bleeding?: string;
    otherFindings?: string;
  };

  // Additional Nurse Notes
  nurseNotes?: string;
  importantInfoForDoctor?: string;

  // Attachments
  attachments?: AttachmentItem[];

  // Vitals
  vitals?: {
    bp: string;
    pulse: number;
    respiratoryRate?: number;
    temp: number;
    spo2?: number;
    weight: number;
    height?: number;
    bmi?: number;
    painScore?: number;
    bloodSugar?: number;
  };

  // Physical Examination (Doctor)
  physicalExam?: {
    generalAppearance?: string;
    heent?: string;
    cardiovascular?: string;
    respiratory?: string;
    abdomen?: string;
    musculoskeletal?: string;
    neurological?: string;
    skin?: string;
  };

  // Diagnosis & Assessment (Doctor)
  primaryDiagnosis?: DiagnosisItem;
  secondaryDiagnoses?: DiagnosisItem[];
  assessmentNotes?: string;
  clinicalNotes?: string;

  // Treatment Plan
  treatmentPlan?: string;
  proceduresPerformed?: string;
  clinicalRecommendations?: string;

  // Orders & Prescriptions
  prescriptions?: PrescriptionItem[];
  labOrders?: LabOrderItem[];
  imagingOrders?: ImagingOrderItem[];

  // Referral
  referral?: {
    department?: string;
    doctor?: string;
    reason?: string;
    notes?: string;
  };

  // Counseling
  counseling?: {
    medicationAdvice?: string;
    dietAdvice?: string;
    exerciseAdvice?: string;
    lifestyleAdvice?: string;
    diseaseEducation?: string;
  };

  // Follow-Up
  followUp?: {
    followUpDate?: string;
    reason?: string;
    instructions?: string;
  };

  // Audit / Metadata
  activityLog?: {
    createdAt?: string;
    createdBy?: string;
    updatedAt?: string;
    updatedBy?: string;
  };

  // Legacy simple fields fallback
  diagnosis?: string;
  prescription?: string;
  symptoms?: string[];

  // Historical Visits Record
  pastVisits?: PastVisitRecord[];
}

export interface StatItem {
  id: string;
  title: string;
  value: number;
  icon: 'users' | 'clock' | 'check';
  change?: string;
  color: string;
}

export type ActiveTab = 
  | 'dashboard' 
  | 'queue' 
  | 'examination' 
  | 'schedule' 
  | 'records' 
  | 'reports';


