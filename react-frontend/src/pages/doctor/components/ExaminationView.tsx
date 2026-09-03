import React, { useState, useEffect } from 'react';
import type { Patient, QueueStatus, PrescriptionItem, LabOrderItem, ImagingOrderItem, DiagnosisItem } from '../types';
import { CopyableText } from './CopyableText';
import { useLanguage } from '../context/LanguageContext';
import { translateClinicalText } from '../utils/clinicalTranslation';
import { displayVN } from '../utils/vnGenerator';
import {
  Stethoscope,
  HeartPulse,
  Thermometer,
  Pill,
  Activity,
  Weight,
  Ruler,
  Clock,
  AlertTriangle,
  Search,
  Plus,
  Trash2,
  Save,
  CheckCircle,
  Printer,
  FileText,
  Send,
  XCircle,
  Calendar,
  User,
  ShieldAlert,
  FileSpreadsheet,
  ArrowLeft,
  ChevronRight,
  ChevronDown,
  Info,
  Check,
  Building,
  History,
  FolderOpen,
  Sparkles,
  ClipboardCheck,
  ArrowUp,
  ArrowDown,
  Star,
  X,
  AlertCircle,
  Edit3,
  Phone,
  Shield,
  Heart
} from 'lucide-react';

/**
 * ==============================================================================
 * Patient Examination & Medical Record View (ExaminationView.tsx)
 * ==============================================================================
 * หน้าจอบันทึกการตรวจผู้ป่วย (หน้าห้องตรวจแพทย์):
 * ประกอบด้วย 4 แท็บหลัก:
 * 1. TAB 1: อาการสำคัญ & สัญญาณชีพ (Chief Complaint & Vital Signs / Physical Exam)
 * 2. TAB 2: การวินิจฉัยโรค (Diagnosis - ICD-10 Search & Selection)
 * 3. TAB 3: การสั่งยาและสั่งตรวจทางห้องปฏิบัติการ (Prescription & Orders: Meds, Lab, X-Ray)
 * 4. TAB 4: สรุปบันทึกการตรวจและสั่งการรักษา (Treatment Summary & Certificate Print)
 *
 * 📍 จุดที่ใช้แก้ไข/ปรับแต่ง (Customization Guide):
 * - ICD10_DATABASE: รายชื่อรหัสโรค ICD-10 สำหรับค้นหา
 * - COMMON_MEDICATIONS: รายการยาในคลังสำหรับจ่ายยา
 * - COMMON_LABS / COMMON_IMAGING: รายการส่งตรวจ Lab / X-Ray
 * - handleSaveAndComplete: ฟังก์ชันบันทึกข้อมูลการตรวจและเปลี่ยนสถานะคิวเป็น Completed
 */
/**
 * id ของกล่องข้อมูลที่ต้องกรอกก่อนปิดการตรวจ
 * ใช้คู่กับ focusIssue() เพื่อเลื่อนจอไปหาช่องที่ยังขาด
 */
/**
 * สีของระดับการคัดแยกผู้ป่วย (Triage)
 * ----------------------------------------------------------------------------
 * ใช้ค่าสีชุดเดียวกับ TRIAGE_LEVELS ใน
 * react-frontend/src/pages/Vitals/components/TriageWidget.tsx
 * เพื่อให้ระดับเดียวกันเป็นสีเดียวกันทั้งจอพยาบาลและจอแพทย์
 * แดง = วิกฤต, ส้ม = เร่งด่วน, เหลือง = กึ่งฉุกเฉิน, เขียว = ปกติ
 *
 * key คือค่าที่ backend ส่งมาใน screening.triage_code (ดู triageInfo ใน
 * doctor_controller.go) ถ้าเพิ่มระดับใหม่ ต้องเพิ่มทั้งสองที่ให้ตรงกัน
 */
type TriageTone = { dot: string; bg: string; border: string; text: string };

const TRIAGE_TONES: Record<string, TriageTone> = {
  'Level 1: Resuscitation': { dot: '#EF4444', bg: '#FEE2E2', border: '#FCA5A5', text: '#7F1D1D' },
  'Level 2: Emergency':     { dot: '#F97316', bg: '#FFEDD5', border: '#FDBA74', text: '#7C2D12' },
  'Level 3: Urgent':        { dot: '#EAB308', bg: '#FEF9C3', border: '#FDE047', text: '#713F12' },
  'Level 4: Less Urgent':   { dot: '#10B981', bg: '#D1FAE5', border: '#6EE7B7', text: '#064E3B' },
  'Level 5: Non-Urgent':    { dot: '#10B981', bg: '#D1FAE5', border: '#6EE7B7', text: '#064E3B' },
};

/** สีเทา สำหรับเคสที่ยังไม่ได้คัดกรอง หรือได้ค่าที่ไม่รู้จัก */
const TRIAGE_TONE_UNKNOWN: TriageTone = {
  dot: '#94A3B8', bg: '#F1F5F9', border: '#CBD5E1', text: '#0F172A',
};

function triageTone(level: string | undefined): TriageTone {
  if (!level) return TRIAGE_TONE_UNKNOWN;
  return TRIAGE_TONES[level] || TRIAGE_TONE_UNKNOWN;
}

const EXAM_ANCHOR = {
  chiefComplaint: 'exam-anchor-chief-complaint',
  vitals: 'exam-anchor-vitals',
  diagnosis: 'exam-anchor-diagnosis',
  prescription: 'exam-anchor-prescription',
} as const;

interface ExaminationViewProps {
  patient: Patient;
  onBackToQueue: () => void;
  onSavePatient: (updatedPatient: Patient) => void;
}

// ICD-10 Diagnoses Database with Thai & English names
interface ExpandedDiagnosisItem {
  code: string;
  name: string;
  localName: string;
}

const ICD10_DATABASE: ExpandedDiagnosisItem[] = [
  { code: 'J02.9', name: 'Acute pharyngitis, unspecified', localName: 'คออักเสบเฉียบพลัน' },
  { code: 'J06.9', name: 'Acute upper respiratory infection, unspecified', localName: 'ติดเชื้อทางเดินหายใจส่วนบนเฉียบพลัน (ไข้หวัด)' },
  { code: 'J00', name: 'Acute nasopharyngitis (common cold)', localName: 'ไข้หวัดธรรมดา' },
  { code: 'I10', name: 'Essential (primary) hypertension', localName: 'โรคความดันโลหิตสูง' },
  { code: 'E11.9', name: 'Type 2 diabetes mellitus without complications', localName: 'โรคเบาหวานชนิดที่ 2' },
  { code: 'G43.9', name: 'Migraine, unspecified', localName: 'โรคไมเกรน' },
  { code: 'M54.5', name: 'Low back pain', localName: 'อาการปวดหลังส่วนล่าง' },
  { code: 'L23.9', name: 'Allergic contact dermatitis, unspecified', localName: 'ผื่นผิวหนังอักเสบจากการแพ้' },
  { code: 'R50.9', name: 'Fever, unspecified', localName: 'ไข้ ไม่ระบุสาเหตุ' },
  { code: 'K21.9', name: 'Gastro-esophageal reflux disease without esophagitis', localName: 'โรคกรดไหลย้อน (GERD)' },
  { code: 'E78.5', name: 'Hyperlipidemia, unspecified', localName: 'ภาวะไขมันในเลือดสูง' },
  { code: 'J20.9', name: 'Acute bronchitis, unspecified', localName: 'หลอดลมอักเสบเฉียบพลัน' },
  { code: 'A09.9', name: 'Gastroenteritis and colitis of unspecified origin', localName: 'ลำไส้อักเสบ / ท้องเสียเฉียบพลัน' },
  { code: 'M79.1', name: 'Myalgia', localName: 'อาการปวดกล้ามเนื้อ' },
  { code: 'H10.9', name: 'Conjunctivitis, unspecified', localName: 'เยื่อตาอักเสบ (ตาแดง)' },
  { code: 'N39.0', name: 'Urinary tract infection, site not specified', localName: 'การติดเชื้อทางเดินปัสสาวะ (UTI)' },
  { code: 'K29.7', name: 'Gastritis, unspecified', localName: 'กระเพาะอาหารอักเสบ' },
  { code: 'R05', name: 'Cough', localName: 'อาการไอ' },
  { code: 'R51', name: 'Headache', localName: 'อาการปวดศีรษะ' },
  { code: 'J30.4', name: 'Allergic rhinitis, unspecified', localName: 'โรคภูมิแพ้อากาศ / จมูกอักเสบภูมิแพ้' }
];

const DEFAULT_RECENT_DIAGNOSES: DiagnosisItem[] = [
  { code: 'J02.9', name: 'คออักเสบเฉียบพลัน' },
  { code: 'J06.9', name: 'ติดเชื้อทางเดินหายใจส่วนบนเฉียบพลัน (ไข้หวัด)' },
  { code: 'I10', name: 'โรคความดันโลหิตสูง' },
  { code: 'E11.9', name: 'โรคเบาหวานชนิดที่ 2' },
  { code: 'R50.9', name: 'ไข้ ไม่ระบุสาเหตุ' }
];

// Common Medicines Database with Thai Hospital Standard Defaults
const MEDICINE_DATABASE = [
  {
    name: 'Paracetamol 500mg tab',
    category: 'Analgesic/Antipyretic (ยาแก้ปวดลดไข้)',
    defaultDosage: { th: '1 เม็ด', en: '1 tablet' },
    defaultFreq: { th: 'ทุก 6 ชั่วโมง', en: 'Every 6 hours' },
    defaultDuration: { th: '3 วัน', en: '3 days' },
    defaultQty: 10,
    defaultRoute: { th: 'รับประทาน', en: 'Oral' },
    defaultTiming: { th: 'เมื่อมีอาการ', en: 'As Needed' },
    defaultInstructions: {
      th: 'รับประทานเมื่อมีอาการปวดหรือมีไข้ ห้ามเกิน 8 เม็ด/วัน',
      en: 'Take for pain or fever. Do not exceed 8 tablets/day.'
    }
  },
  {
    name: 'Amoxicillin 500mg cap',
    category: 'Antibiotic (ยาฆ่าเชื้อแก้อักเสบ)',
    defaultDosage: { th: '1 แคปซูล', en: '1 capsule' },
    defaultFreq: { th: 'วันละ 3 ครั้ง', en: '3 times daily' },
    defaultDuration: { th: '7 วัน', en: '7 days' },
    defaultQty: 21,
    defaultRoute: { th: 'รับประทาน', en: 'Oral' },
    defaultTiming: { th: 'หลังอาหาร', en: 'After Meal' },
    defaultInstructions: {
      th: 'รับประทานหลังอาหาร วันละ 3 ครั้ง ติดต่อกันจนหมด',
      en: 'Take after meals 3 times daily until finished.'
    }
  },
  {
    name: 'Ibuprofen 400mg tab',
    category: 'NSAID / Anti-inflammatory (ยาแก้ปวดอักเสบ)',
    defaultDosage: { th: '1 เม็ด', en: '1 tablet' },
    defaultFreq: { th: 'วันละ 3 ครั้ง', en: '3 times daily' },
    defaultDuration: { th: '5 วัน', en: '5 days' },
    defaultQty: 15,
    defaultRoute: { th: 'รับประทาน', en: 'Oral' },
    defaultTiming: { th: 'หลังอาหาร', en: 'After Meal' },
    defaultInstructions: {
      th: 'รับประทานหลังอาหารทันที ดื่มน้ำตามมากๆ',
      en: 'Take immediately after meals with plenty of water.'
    }
  },
  {
    name: 'Amlodipine 5mg tab',
    category: 'Antihypertensive (ยาลดความดัน)',
    defaultDosage: { th: '1 เม็ด', en: '1 tablet' },
    defaultFreq: { th: 'วันละ 1 ครั้ง', en: 'Once daily' },
    defaultDuration: { th: '30 วัน', en: '30 days' },
    defaultQty: 30,
    defaultRoute: { th: 'รับประทาน', en: 'Oral' },
    defaultTiming: { th: 'หลังอาหาร', en: 'After Meal' },
    defaultInstructions: {
      th: 'รับประทานวันละ 1 ครั้ง หลังอาหารเช้า',
      en: 'Take once daily after breakfast.'
    }
  },
  {
    name: 'Omeprazole 20mg cap',
    category: 'Proton Pump Inhibitor (ยาลดกรดกระเพาะอาหาร)',
    defaultDosage: { th: '1 แคปซูล', en: '1 capsule' },
    defaultFreq: { th: 'วันละ 1 ครั้ง', en: 'Once daily' },
    defaultDuration: { th: '14 วัน', en: '14 days' },
    defaultQty: 14,
    defaultRoute: { th: 'รับประทาน', en: 'Oral' },
    defaultTiming: { th: 'ก่อนอาหาร', en: 'Before Meal' },
    defaultInstructions: {
      th: 'รับประทานก่อนอาหารเช้า 30 นาที',
      en: 'Take 30 minutes before breakfast.'
    }
  },
  {
    name: 'Cetirizine 10mg tab',
    category: 'Antihistamine (ยาแก้แพ้ ลดน้ำมูก)',
    defaultDosage: { th: '1 เม็ด', en: '1 tablet' },
    defaultFreq: { th: 'วันละ 1 ครั้ง', en: 'Once daily' },
    defaultDuration: { th: '7 วัน', en: '7 days' },
    defaultQty: 10,
    defaultRoute: { th: 'รับประทาน', en: 'Oral' },
    defaultTiming: { th: 'ก่อนนอน', en: 'Before Bed' },
    defaultInstructions: {
      th: 'รับประทานวันละ 1 ครั้ง ก่อนนอน (อาจทำให้ง่วง)',
      en: 'Take once daily at bedtime (may cause drowsiness).'
    }
  },
  {
    name: 'Metformin 500mg tab',
    category: 'Antidiabetic (ยาเบาหวาน)',
    defaultDosage: { th: '1 เม็ด', en: '1 tablet' },
    defaultFreq: { th: 'วันละ 2 ครั้ง', en: 'Twice daily' },
    defaultDuration: { th: '30 วัน', en: '30 days' },
    defaultQty: 60,
    defaultRoute: { th: 'รับประทาน', en: 'Oral' },
    defaultTiming: { th: 'พร้อมอาหาร', en: 'With Meal' },
    defaultInstructions: {
      th: 'รับประทานพร้อมหรือหลังอาหารทันที',
      en: 'Take with or immediately after meals.'
    }
  },
  {
    name: 'Atorvastatin 20mg tab',
    category: 'Statin (ยาลดไขมันในเลือด)',
    defaultDosage: { th: '1 เม็ด', en: '1 tablet' },
    defaultFreq: { th: 'วันละ 1 ครั้ง', en: 'Once daily' },
    defaultDuration: { th: '30 วัน', en: '30 days' },
    defaultQty: 30,
    defaultRoute: { th: 'รับประทาน', en: 'Oral' },
    defaultTiming: { th: 'ก่อนนอน', en: 'Before Bed' },
    defaultInstructions: {
      th: 'รับประทานวันละ 1 ครั้ง ก่อนนอน',
      en: 'Take once daily at bedtime.'
    }
  },
  {
    name: 'Dextromethorphan 15mg tab',
    category: 'Antitussive (ยาแก้ไอ)',
    defaultDosage: { th: '1 เม็ด', en: '1 tablet' },
    defaultFreq: { th: 'วันละ 3 ครั้ง', en: '3 times daily' },
    defaultDuration: { th: '5 วัน', en: '5 days' },
    defaultQty: 15,
    defaultRoute: { th: 'รับประทาน', en: 'Oral' },
    defaultTiming: { th: 'หลังอาหาร', en: 'After Meal' },
    defaultInstructions: {
      th: 'รับประทานเมื่อมีอาการไอ',
      en: 'Take when coughing.'
    }
  },
  {
    name: 'Salbutamol Inhaler (100mcg)',
    category: 'Bronchodilator (ยาพ่นขยายหลอดลม)',
    defaultDosage: { th: '2 พ่นสูด', en: '2 puffs' },
    defaultFreq: { th: 'ทุก 6 ชั่วโมง', en: 'Every 6 hours' },
    defaultDuration: { th: '30 วัน', en: '30 days' },
    defaultQty: 1,
    defaultRoute: { th: 'พ่นสูด', en: 'Inhalation' },
    defaultTiming: { th: 'เมื่อมีอาการ', en: 'As Needed' },
    defaultInstructions: {
      th: 'พ่นสูดเมื่อมีอาการหอบหืดหรือหายใจขัด',
      en: 'Inhale when experiencing wheezing or shortness of breath.'
    }
  },
  {
    name: 'ORS Electrolyte Powder',
    category: 'Rehydration (เกลือแร่ผงชงดื่ม)',
    defaultDosage: { th: '1 ซอง', en: '1 sachet' },
    defaultFreq: { th: 'เมื่อมีอาการ', en: 'As Needed' },
    defaultDuration: { th: '3 วัน', en: '3 days' },
    defaultQty: 5,
    defaultRoute: { th: 'รับประทาน', en: 'Oral' },
    defaultTiming: { th: 'เมื่อมีอาการ', en: 'As Needed' },
    defaultInstructions: {
      th: 'ละลายน้ำสุก 250 มล. จิบเมื่อถ่ายเหลว',
      en: 'Dissolve in 250ml water, sip when having watery stool.'
    }
  }
];

// Common Lab Tests
const LAB_TEST_DATABASE = [
  { name: 'Complete Blood Count (CBC)', category: 'Hematology' },
  { name: 'Fasting Blood Sugar (FBS)', category: 'Biochemistry' },
  { name: 'HbA1c (Glycated Hemoglobin)', category: 'Biochemistry' },
  { name: 'Lipid Profile (Chol, Trig, HDL, LDL)', category: 'Biochemistry' },
  { name: 'Liver Function Test (LFT)', category: 'Biochemistry' },
  { name: 'Renal Function Test (BUN/Cr)', category: 'Biochemistry' },
  { name: 'Urinalysis (UA)', category: 'Microbiology' },
  { name: 'Electrolytes (Na, K, Cl, CO2)', category: 'Biochemistry' }
];

export const ExaminationView: React.FC<ExaminationViewProps> = ({
  patient,
  onBackToQueue,
  onSavePatient
}) => {
  const { language, t } = useLanguage();
  // Active Examination Tab (Clinical Notes, Diagnosis, Prescription, Referral & Counseling, Follow-up)
  const [activeTab, setActiveTab] = useState<'notes' | 'diagnosis' | 'prescription' | 'referral' | 'followup'>('notes');

  // Status State
  const [status, setStatus] = useState<QueueStatus>(patient.status === 'Waiting' ? 'Examining' : patient.status);

  // History & Complaints State
  const [chiefComplaint, setChiefComplaint] = useState(patient.chiefComplaint || '');
  const [chiefComplaintDuration, setChiefComplaintDuration] = useState(patient.chiefComplaintDuration || '2 days');
  const [presentIllness, setPresentIllness] = useState(patient.presentIllness || '');
  const [pastMedicalHistory, setPastMedicalHistory] = useState(patient.pastMedicalHistory || '');
  const [chronicDiseasesText, setChronicDiseasesText] = useState((patient.chronicDiseases || []).join(', '));
  const [noChronicDisease, setNoChronicDisease] = useState(!patient.chronicDiseases || patient.chronicDiseases.length === 0);
  const [currentMedicationsText, setCurrentMedicationsText] = useState((patient.currentMedications || []).join(', '));
  const [hospitalAdmissionHistory, setHospitalAdmissionHistory] = useState(patient.hospitalAdmissionHistory || '');
  const [pastSurgery, setPastSurgery] = useState(patient.pastSurgery || '');
  const [drugAllergiesText, setDrugAllergiesText] = useState((patient.drugAllergies || []).join(', '));
  const [noDrugAllergy, setNoDrugAllergy] = useState(!patient.drugAllergies || patient.drugAllergies.length === 0);
  const [drugAllergySymptoms, setDrugAllergiesSymptoms] = useState(patient.drugAllergySymptoms || 'ผื่นคัน, ลมพิษ (Rashes, Hives)');
  const [foodAllergiesText, setFoodAllergiesText] = useState((patient.foodAllergies || []).join(', '));
  const [noFoodAllergy, setNoFoodAllergy] = useState(!patient.foodAllergies || patient.foodAllergies.length === 0);
  const [foodAllergySymptoms, setFoodAllergySymptoms] = useState('');
  const [familyHistory, setFamilyHistory] = useState(patient.familyHistory || '');
  const [socialHistory, setSocialHistory] = useState(patient.socialHistory || '');
  const [nationalId, setNationalId] = useState(patient.nationalId || '1-1002-34567-89-0');
  
  // Triage State
  const [triageLevel, setTriageLevel] = useState(patient.triage?.level || 'Level 4: Less Urgent');
  const [priorityLevel, setPriorityLevel] = useState(patient.triage?.priority || 'Medium');
  const [triageNotes, setTriageNotes] = useState(patient.triage?.notes || 'Screened at Triage Desk. Patient is conscious and stable.');

  // สีของกล่องคัดกรอง ยึดตามระดับที่พยาบาลเลือก ไม่ใช่สีคงที่
  const tone = triageTone(triageLevel || patient.triage?.level);

  // Additional Notes
  const [nurseNotes, setNurseNotes] = useState(patient.nurseNotes || '');
  const [importantInfoForDoctor, setImportantInfoForDoctor] = useState(patient.importantInfoForDoctor || '');
  const [attachments, setAttachments] = useState<any[]>(patient.attachments || [
    { id: 'att-1', fileName: 'Referral_Document_2026.pdf', fileType: 'pdf', category: 'Referral Document', uploadDate: '2026-07-23 08:50', fileSize: '1.2 MB' },
    { id: 'att-2', fileName: 'Clinical_Photo_2026.jpg', fileType: 'image', category: 'Clinical Photo', uploadDate: '2026-07-23 08:52', fileSize: '2.8 MB' }
  ]);

  // Nursing Physical Assessment State
  const [nurseGenAppearance, setNurseGenAppearance] = useState(patient.nursingAssessment?.generalAppearance || 'Good consciousness, non-toxic appearance');
  // ระดับความรู้สึกตัวยังไม่มีคอลัมน์ในตาราง screenings จุดคัดกรองจึงยังส่งมาไม่ได้
  // เว้นว่างไว้แทนการเดาว่า "Alert" เพราะเป็นค่าที่ใช้แยกเคสฉุกเฉิน เดาผิดแล้วอันตราย
  const [nurseConsciousness, setNurseConsciousness] = useState(patient.nursingAssessment?.consciousness || '');
  const [nurseMobility, setNurseMobility] = useState(patient.nursingAssessment?.mobility || 'Ambulatory');
  const [nurseRespiratory, setNurseRespiratory] = useState(patient.nursingAssessment?.respiratoryCondition || 'Normal breathing, room air');
  const [nurseBleeding, setNurseBleeding] = useState(patient.nursingAssessment?.bleeding || 'No active bleeding');
  const [nurseOtherFindings, setNurseOtherFindings] = useState(patient.nursingAssessment?.otherFindings || 'Mild throat pain upon swallowing');

  // Vital Signs State
  const [bp, setBp] = useState(patient.vitals?.bp || '120/80');
  const [pulse, setPulse] = useState(patient.vitals?.pulse || 78);
  const [respiratoryRate, setRespiratoryRate] = useState(patient.vitals?.respiratoryRate || 18);
  const [temp, setTemp] = useState(patient.vitals?.temp || 36.8);
  const [spo2, setSpo2] = useState(patient.vitals?.spo2 || 98);
  const [weight, setWeight] = useState(patient.vitals?.weight || 68);
  const [height, setHeight] = useState(patient.vitals?.height || 170);
  // ปล่อยเป็น undefined เมื่อจุดคัดกรองไม่ได้กรอก จะได้แสดงว่า "ไม่มีข้อมูล"
  // แทนการเดาค่าให้ ค่าสัญญาณชีพที่ระบบแต่งขึ้นเองอันตรายกว่าช่องว่าง
  const [painScore, setPainScore] = useState<number | undefined>(patient.vitals?.painScore);
  const [bloodSugar, setBloodSugar] = useState<number | undefined>(patient.vitals?.bloodSugar);

  // Auto calculated BMI
  const bmi = React.useMemo(() => {
    if (weight > 0 && height > 0) {
      const hMeter = height / 100;
      return Number((weight / (hMeter * hMeter)).toFixed(1));
    }
    return 0;
  }, [weight, height]);

  // Physical Exam - Initial empty string so placeholder example text shows up clean
  const [generalAppearance, setGeneralAppearance] = useState('');
  const [heent, setHeent] = useState('');
  const [cardiovascular, setCardiovascular] = useState('');
  const [respiratory, setRespiratory] = useState('');
  const [abdomen, setAbdomen] = useState('');
  const [musculoskeletal, setMusculoskeletal] = useState('');
  const [neurological, setNeurological] = useState('');
  const [skin, setSkin] = useState('');

  // Assessment & Diagnosis State
  const [primaryDiag, setPrimaryDiag] = useState<DiagnosisItem | null>(
    patient.primaryDiagnosis || { code: 'J02.9', name: 'Acute pharyngitis, unspecified (คออักเสบเฉียบพลัน)' }
  );
  const [secondaryDiags, setSecondaryDiags] = useState<DiagnosisItem[]>(patient.secondaryDiagnoses || []);
  const [diagSearch, setDiagSearch] = useState('');
  const [showDiagDropdown, setShowDiagDropdown] = useState(false);
  const [diagWarning, setDiagWarning] = useState('');
  const [editingDiagTarget, setEditingDiagTarget] = useState<'primary' | number | null>(null);
  const [editDiagText, setEditDiagText] = useState('');

  // Recent Diagnoses stored in localStorage for currently logged-in doctor
  const [recentDiagnoses, setRecentDiagnoses] = useState<DiagnosisItem[]>(() => {
    try {
      const saved = localStorage.getItem('recent_icd10_diagnoses');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_RECENT_DIAGNOSES;
  });

  // Save diagnoses to doctor's Recent Diagnosis history
  const saveToRecentDiagnoses = (itemsToSave: DiagnosisItem[]) => {
    if (!itemsToSave || itemsToSave.length === 0) return;
    setRecentDiagnoses(prev => {
      const validItems = itemsToSave.filter(item => item && item.code);
      const combined = [...validItems, ...prev];
      const uniqueMap = new Map<string, DiagnosisItem>();
      combined.forEach(item => {
        if (item.code && !uniqueMap.has(item.code)) {
          uniqueMap.set(item.code, item);
        }
      });
      const updatedList = Array.from(uniqueMap.values()).slice(0, 10);
      try {
        localStorage.setItem('recent_icd10_diagnoses', JSON.stringify(updatedList));
      } catch (e) {
        console.error(e);
      }
      return updatedList;
    });
  };

  // Check if code is already selected
  const isCodeSelected = (code: string) => {
    if (primaryDiag?.code === code) return true;
    return secondaryDiags.some(d => d.code === code);
  };

  // Add diagnosis from search or recent
  const handleSelectDiagnosis = (item: { code: string; name: string; localName?: string }, forceSecondary = false) => {
    setDiagWarning('');
    if (isCodeSelected(item.code)) {
      setDiagWarning(`รหัส ICD-10 (${item.code}) ถูกเลือกไว้ในรายการแล้ว (Prevent Duplicate ICD-10 Code)`);
      return;
    }

    const displayName = item.localName || item.name;
    const diagObj: DiagnosisItem = { code: item.code, name: displayName };

    if (!primaryDiag && !forceSecondary) {
      setPrimaryDiag(diagObj);
    } else {
      setSecondaryDiags(prev => [...prev, diagObj]);
    }

    setDiagSearch('');
    setShowDiagDropdown(false);
  };

  // Promote secondary diagnosis to Primary
  const handlePromoteToPrimary = (index: number) => {
    const target = secondaryDiags[index];
    if (!target) return;

    const newSecondaryList = [...secondaryDiags];
    newSecondaryList.splice(index, 1);

    if (primaryDiag) {
      newSecondaryList.unshift(primaryDiag);
    }

    setPrimaryDiag(target);
    setSecondaryDiags(newSecondaryList);
    setDiagWarning('');
  };

  // Demote primary diagnosis to Secondary
  const handleDemotePrimary = () => {
    if (!primaryDiag) return;
    setSecondaryDiags(prev => [primaryDiag, ...prev]);
    setPrimaryDiag(null);
  };

  // Remove primary diagnosis
  const handleRemovePrimary = () => {
    if (secondaryDiags.length > 0) {
      const [first, ...rest] = secondaryDiags;
      setPrimaryDiag(first);
      setSecondaryDiags(rest);
    } else {
      setPrimaryDiag(null);
    }
    setDiagWarning('');
  };

  // Remove secondary diagnosis
  const handleRemoveSecondary = (index: number) => {
    setSecondaryDiags(prev => prev.filter((_, i) => i !== index));
    setDiagWarning('');
  };

  // Reorder secondary diagnoses
  const handleMoveSecondaryUp = (index: number) => {
    if (index <= 0) return;
    setSecondaryDiags(prev => {
      const updated = [...prev];
      const temp = updated[index - 1];
      updated[index - 1] = updated[index];
      updated[index] = temp;
      return updated;
    });
  };

  const handleMoveSecondaryDown = (index: number) => {
    if (index >= secondaryDiags.length - 1) return;
    setSecondaryDiags(prev => {
      const updated = [...prev];
      const temp = updated[index + 1];
      updated[index + 1] = updated[index];
      updated[index] = temp;
      return updated;
    });
  };

  // Edit diagnosis text
  const startEditDiagnosis = (target: 'primary' | number, currentName: string) => {
    setEditingDiagTarget(target);
    setEditDiagText(currentName);
  };

  const saveEditDiagnosis = () => {
    if (editingDiagTarget === 'primary' && primaryDiag) {
      setPrimaryDiag({ ...primaryDiag, name: editDiagText });
    } else if (typeof editingDiagTarget === 'number' && secondaryDiags[editingDiagTarget]) {
      setSecondaryDiags(prev => {
        const updated = [...prev];
        updated[editingDiagTarget] = { ...updated[editingDiagTarget], name: editDiagText };
        return updated;
      });
    }
    setEditingDiagTarget(null);
    setEditDiagText('');
  };

  // Filter ICD-10 database for search dropdown
  const filteredICD10 = ICD10_DATABASE.filter(item => {
    const q = diagSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      item.code.toLowerCase().includes(q) ||
      item.name.toLowerCase().includes(q) ||
      (item.localName && item.localName.toLowerCase().includes(q))
    );
  });

  const [assessmentNotes, setAssessmentNotes] = useState(patient.assessmentNotes || '');
  const [clinicalNotes, setClinicalNotes] = useState(patient.clinicalNotes || '');
  const [treatmentPlan, setTreatmentPlan] = useState(patient.treatmentPlan || '');
  const [proceduresPerformed, setProceduresPerformed] = useState(patient.proceduresPerformed || '');

  // Prescriptions State
  const [prescriptions, setPrescriptions] = useState<PrescriptionItem[]>(
    patient.prescriptions && patient.prescriptions.length > 0
      ? patient.prescriptions
      : []
  );

  // New Prescription Form state
  const [medSearch, setMedSearch] = useState('');
  const [isMedDropdownOpen, setIsMedDropdownOpen] = useState(false);
  const medDropdownRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (medDropdownRef.current && !medDropdownRef.current.contains(event.target as Node)) {
        setIsMedDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const [medicinesList, setMedicinesList] = useState<any[]>(MEDICINE_DATABASE);

  useEffect(() => {
    // Fetch live medicines database from backend
    const fetchMeds = async () => {
      try {
        const token = localStorage.getItem('token') || localStorage.getItem('clinic_auth_token');
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        let res = await fetch('/api/pharmacy/medicines', { headers });
        if (!res.ok) {
          res = await fetch('/api/system/medicines');
        }
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'success' && Array.isArray(data.medicines) && data.medicines.length > 0) {
            const mapped = data.medicines.map((m: any) => {
              const isLiquid = (m.name || '').toLowerCase().includes('syrup') || (m.name || '').toLowerCase().includes('liquid') || (m.name || '').toLowerCase().includes('sol');
              const isCap = (m.name || '').toLowerCase().includes('cap');
              const defaultDosageStr = isLiquid ? '10 มล.' : (isCap ? '1 แคปซูล' : '1 เม็ด');
              const defaultFreqStr = (m.properties || '').includes('ความดัน') || (m.properties || '').includes('เบาหวาน') || (m.name || '').includes('Amlodipine') || (m.name || '').includes('Omeprazole') ? 'วันละ 1 ครั้ง' : 'วันละ 3 ครั้ง';
              const defaultTimingStr = (m.name || '').includes('Omeprazole') ? 'ก่อนอาหาร' : ((m.properties || '').includes('ลดไข้') || (m.name || '').includes('Paracetamol') ? 'เมื่อมีอาการ' : 'หลังอาหาร');
              const defaultDurationStr = (m.properties || '').includes('ความดัน') || (m.properties || '').includes('เบาหวาน') ? '30 วัน' : '5 วัน';
              const defaultQtyNum = (m.properties || '').includes('ความดัน') || (m.properties || '').includes('เบาหวาน') ? 30 : 10;

              return {
                id: m.id,
                code: m.medicine_code,
                name: m.name,
                genericName: m.generic_name,
                category: m.category,
                properties: m.properties,
                price: m.unit_price || m.price,
                stock: m.stock_quantity || m.stock,
                defaultDosage: { th: defaultDosageStr, en: defaultDosageStr },
                defaultFreq: { th: defaultFreqStr, en: defaultFreqStr },
                defaultDuration: { th: defaultDurationStr, en: defaultDurationStr },
                defaultQty: defaultQtyNum,
                defaultRoute: { th: 'รับประทาน', en: 'Oral' },
                defaultTiming: { th: defaultTimingStr, en: defaultTimingStr },
                defaultInstructions: {
                  th: m.properties || 'รับประทานยาตามแพทย์สั่งอย่างเคร่งครัด',
                  en: m.generic_name ? `Generic: ${m.generic_name}` : 'Take as directed by physician.'
                }
              };
            });
            setMedicinesList(mapped);
          }
        }
      } catch (err) {
        console.error('Failed to fetch medicines for doctor prescription:', err);
      }
    };
    fetchMeds();
  }, []);

  const filteredMedicines = React.useMemo(() => {
    if (!medSearch.trim()) {
      return medicinesList;
    }
    const q = medSearch.trim().toLowerCase();
    return medicinesList.filter(m =>
      (m.name || '').toLowerCase().includes(q) ||
      (m.code || '').toLowerCase().includes(q) ||
      (m.genericName || '').toLowerCase().includes(q) ||
      (m.category || '').toLowerCase().includes(q)
    );
  }, [medSearch, medicinesList]);

  const [newMedName, setNewMedName] = useState('');
  const [newMedDosage, setNewMedDosage] = useState('');
  const [newMedFreq, setNewMedFreq] = useState('');
  const [newMedDuration, setNewMedDuration] = useState('');
  const [newMedQty, setNewMedQty] = useState<number | ''>('');
  const [newMedRoute, setNewMedRoute] = useState('');
  const [newMedTiming, setNewMedTiming] = useState('');
  const [newMedInstructions, setNewMedInstructions] = useState('');

  // Lab Orders State
  const [labOrders, setLabOrders] = useState<LabOrderItem[]>(patient.labOrders || []);
  const [selectedLabTest, setSelectedLabTest] = useState(LAB_TEST_DATABASE[0].name);
  const [labIndication, setLabIndication] = useState('');
  const [labIsUrgent, setLabIsUrgent] = useState(false);

  // Imaging Orders State
  const [imagingOrders, setImagingOrders] = useState<ImagingOrderItem[]>(patient.imagingOrders || []);
  const [imgType, setImgType] = useState<'X-Ray' | 'Ultrasound' | 'CT Scan' | 'MRI' | 'ECG' | 'Other'>('X-Ray');
  const [imgBodyPart, setImgBodyPart] = useState('Chest PA Upright');
  const [imgIndication, setImgIndication] = useState('');
  const [imgIsUrgent, setImgIsUrgent] = useState(false);

  // Referral State
  const [refDept, setRefDept] = useState(patient.referral?.department || '');
  const [refDoctor, setRefDoctor] = useState(patient.referral?.doctor || '');
  const [refReason, setRefReason] = useState(patient.referral?.reason || '');
  const [refNotes, setRefNotes] = useState(patient.referral?.notes || '');

  // Counseling State
  const [counselMed, setCounselMed] = useState(patient.counseling?.medicationAdvice || 'Take prescribed antibiotic full duration.');
  const [counselDiet, setCounselDiet] = useState(patient.counseling?.dietAdvice || 'Warm fluid intake, avoid cold drinks.');
  const [counselExercise, setCounselExercise] = useState(patient.counseling?.exerciseAdvice || 'Rest adequately.');
  const [counselLifestyle, setCounselLifestyle] = useState(patient.counseling?.lifestyleAdvice || 'Gargle warm salt water twice daily.');
  const [counselEducation, setCounselEducation] = useState(patient.counseling?.diseaseEducation || 'Viral pharyngitis self-care guidance.');

  // Follow Up State
  const [hasFollowUp, setHasFollowUp] = useState<boolean>(Boolean(patient.followUp && patient.followUp.followUpDate));
  const [followUpDate, setFollowUpDate] = useState(patient.followUp?.followUpDate || '');
  const [followUpReason, setFollowUpReason] = useState(patient.followUp?.reason || '');
  const [followUpInstructions, setFollowUpInstructions] = useState(patient.followUp?.instructions || '');

  // Validation Warnings
  /**
   * รายการที่ยังกรอกไม่ครบก่อนปิดการตรวจ
   *
   * เก็บ tab กับ anchor ไว้ด้วย เพื่อให้เลื่อนจอไปยังจุดที่ขาดได้
   * (anchor คือ id ของกล่องข้อมูลในหน้าจอ ดูที่ ExamAnchor ด้านล่าง)
   */
  type ValidationIssue = {
    message: string;
    tab: 'notes' | 'diagnosis' | 'prescription' | 'referral' | 'followup';
    anchor: string;
  };
  const [validationWarnings, setValidationWarnings] = useState<ValidationIssue[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState<string | null>(null);

  // Success Feedback Modal State
  const [successNotice, setSuccessNotice] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm?: () => void;
  } | null>(null);

  // Shared Confirmation Modal State
  // ใช้ร่วมกันทั้ง 3 ปุ่ม (ยกเลิกการตรวจ / บันทึกฉบับร่าง / บันทึกและเสร็จสิ้น)
  // เพื่อให้หน้าตาและลำดับการทำงานเหมือนกันทุกปุ่ม: กด -> ยืนยัน -> ทำงาน -> แจ้งผลสำเร็จ
  const [confirmDialog, setConfirmDialog] = useState<{
    tone: 'danger' | 'primary';
    title: string;
    message: string;
    hint?: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);

  /**
   * เลื่อนจอไปยังช่องที่ยังกรอกไม่ครบ พร้อมสลับแท็บให้ถ้าอยู่คนละแท็บ
   *
   * ต้องหน่วงด้วย requestAnimationFrame เพราะการสลับแท็บทำให้ React วาดใหม่
   * ถ้าเรียก scrollIntoView ทันทีจะยังหา element ไม่เจอ
   */
  const focusIssue = (issue: ValidationIssue) => {
    if (activeTab !== issue.tab) {
      setActiveTab(issue.tab);
    }

    requestAnimationFrame(() => {
      window.setTimeout(() => {
        const el = document.getElementById(issue.anchor);
        if (!el) return;

        el.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // ไฮไลต์กรอบสีเหลืองชั่วคราว ให้เห็นชัดว่าคือช่องไหน
        el.classList.add('ring-2', 'ring-amber-400', 'ring-offset-2', 'rounded-xl');
        window.setTimeout(() => {
          el.classList.remove('ring-2', 'ring-amber-400', 'ring-offset-2', 'rounded-xl');
        }, 2400);

        // ถ้าในกล่องนั้นมีช่องกรอกได้ ให้เคอร์เซอร์ไปรออยู่ที่ช่องแรกเลย
        const input = el.querySelector<HTMLElement>('input, textarea, select');
        if (input) {
          input.focus({ preventScroll: true });
        }
      }, 60);
    });
  };

  /**
   * ข้อมูลจากจุดคัดกรองที่ยังไม่ครบ
   *
   * อาการสำคัญกับสัญญาณชีพเป็นช่องอ่านอย่างเดียว พยาบาลเป็นคนบันทึกตอนคัดกรอง
   * แพทย์แก้เองไม่ได้ จึงไม่ควรเอามาเป็นเงื่อนไขห้ามปิดการตรวจ
   * แค่แจ้งให้ทราบว่าข้อมูลไม่ครบ เพื่อจะได้ประสานกับพยาบาล
   */
  const triageGaps = React.useMemo(() => {
    const gaps: string[] = [];
    if (!chiefComplaint.trim()) {
      gaps.push(language === 'th' ? 'อาการสำคัญ (Chief Complaint)' : 'Chief Complaint (CC)');
    }
    if (!bp.trim() || pulse <= 0 || temp <= 0) {
      gaps.push(language === 'th' ? 'สัญญาณชีพ (ความดัน / ชีพจร / อุณหภูมิ)' : 'Vital Signs (BP / Pulse / Temp)');
    }
    return gaps;
  }, [chiefComplaint, bp, pulse, temp, language]);

  // Allergy warning check on medicine selection
  const allergyAlert = React.useMemo(() => {
    const allergies = drugAllergiesText.toLowerCase().split(',').map(s => s.trim());
    for (const rx of prescriptions) {
      for (const alg of allergies) {
        if (alg && rx.medicineName.toLowerCase().includes(alg)) {
          return `CRITICAL WARNING: Patient is ALLERGIC to ${alg.toUpperCase()}! Prescribed medicine '${rx.medicineName}' contains allergen.`;
        }
      }
    }
    return null;
  }, [drugAllergiesText, prescriptions]);

  // Construct updated patient object
  const buildUpdatedPatient = (newStatus?: QueueStatus): Patient => {
    return {
      ...patient,
      status: newStatus || status,
      nationalId,
      chiefComplaint,
      chiefComplaintDuration,
      presentIllness,
      pastMedicalHistory,
      chronicDiseases: chronicDiseasesText.split(',').map(s => s.trim()).filter(Boolean),
      currentMedications: currentMedicationsText.split(',').map(s => s.trim()).filter(Boolean),
      pastSurgery,
      hospitalAdmissionHistory,
      drugAllergies: drugAllergiesText.split(',').map(s => s.trim()).filter(Boolean),
      foodAllergies: foodAllergiesText.split(',').map(s => s.trim()).filter(Boolean),
      familyHistory,
      socialHistory,
      nurseNotes,
      importantInfoForDoctor,
      attachments,
      triage: {
        level: triageLevel,
        priority: priorityLevel,
        notes: triageNotes
      },
      nursingAssessment: {
        generalAppearance: nurseGenAppearance,
        consciousness: nurseConsciousness,
        mobility: nurseMobility,
        respiratoryCondition: nurseRespiratory,
        bleeding: nurseBleeding,
        otherFindings: nurseOtherFindings
      },
      vitals: {
        bp,
        pulse: Number(pulse),
        respiratoryRate: Number(respiratoryRate),
        temp: Number(temp),
        spo2: Number(spo2),
        weight: Number(weight),
        height: Number(height),
        bmi,
        painScore: painScore !== undefined ? Number(painScore) : undefined,
        bloodSugar: bloodSugar !== undefined ? Number(bloodSugar) : undefined
      },
      physicalExam: {
        generalAppearance,
        heent,
        cardiovascular,
        respiratory,
        abdomen,
        musculoskeletal,
        neurological,
        skin
      },
      primaryDiagnosis: primaryDiag ?? undefined,
      secondaryDiagnoses: secondaryDiags,
      assessmentNotes,
      clinicalNotes,
      treatmentPlan,
      proceduresPerformed,
      prescriptions,
      labOrders,
      imagingOrders,
      referral: {
        department: refDept,
        doctor: refDoctor,
        reason: refReason,
        notes: refNotes
      },
      counseling: {
        medicationAdvice: counselMed,
        dietAdvice: counselDiet,
        exerciseAdvice: counselExercise,
        lifestyleAdvice: counselLifestyle,
        diseaseEducation: counselEducation
      },
      followUp: hasFollowUp && followUpDate ? {
        followUpDate,
        reason: followUpReason,
        instructions: followUpInstructions
      } : undefined,
      diagnosis: primaryDiag ? `${primaryDiag.code} - ${primaryDiag.name}` : '',
      prescription: prescriptions.map(p => `${p.medicineName} (${p.dosage}, ${p.frequency})`).join('; '),
      activityLog: {
        createdAt: patient.activityLog?.createdAt || new Date().toISOString(),
        createdBy: 'Dr. Anong S.',
        updatedAt: new Date().toISOString(),
        updatedBy: 'Dr. Anong S.'
      }
    };
  };

  // Save Draft — งานจริง (เรียกหลังผู้ใช้กดยืนยันในโมดัล)
  const runSaveDraft = () => {
    const activeDiags = [...(primaryDiag ? [primaryDiag] : []), ...secondaryDiags];
    saveToRecentDiagnoses(activeDiags);
    const updated = buildUpdatedPatient('Examining');
    onSavePatient(updated);
    setSuccessNotice({
      isOpen: true,
      title: language === 'th' ? 'บันทึกฉบับร่างแล้ว' : 'Draft Saved',
      message: language === 'th'
        ? `เก็บข้อมูลการตรวจของ ${patient.name} (HN: ${patient.hn}) ไว้เรียบร้อย สถานะยังเป็น "กำลังตรวจ" กดปุ่ม "ตรวจต่อ" ในหน้าคิวผู้ป่วยเพื่อกลับมาทำต่อได้ทุกเมื่อ`
        : `Examination data for ${patient.name} (HN: ${patient.hn}) has been saved. The visit remains "Examining" — use the "Continue Exam" button in the patient queue to resume.`,
      // กลับไปหน้าคิวผู้ป่วยเหมือนตอนกดบันทึกผลการตรวจ
      // เพื่อให้แพทย์เรียกคิวถัดไปได้ทันที แล้วค่อยกด "ตรวจต่อ" กลับมาทีหลัง
      onConfirm: () => {
        onBackToQueue();
      }
    });
  };

  // Save Draft — เปิดโมดัลยืนยัน
  const handleSaveDraft = () => {
    setConfirmDialog({
      tone: 'primary',
      title: language === 'th' ? 'บันทึกฉบับร่าง?' : 'Save Draft?',
      message: language === 'th'
        ? 'ระบบจะเก็บข้อมูลที่กรอกไว้ทั้งหมด แต่ยังไม่ปิดการตรวจ ผู้ป่วยจะยังอยู่ในสถานะ "กำลังตรวจ"'
        : 'All entered data will be saved without closing the visit. The patient stays in "Examining" status.',
      hint: language === 'th'
        ? 'ยังไม่ส่งรายการสั่งยาไปห้องยา จนกว่าจะกด "บันทึกและเสร็จสิ้นการตรวจ"'
        : 'Prescriptions are not sent to the pharmacy until you use "Save & Complete Visit".',
      confirmLabel: language === 'th' ? 'บันทึกฉบับร่าง' : 'Save Draft',
      onConfirm: runSaveDraft
    });
  };

  // Cancel Visit — เปิดโมดัลยืนยัน
  const handleCancelVisit = () => {
    setConfirmDialog({
      tone: 'danger',
      title: language === 'th' ? 'ยกเลิกการตรวจรับบริการ?' : 'Cancel Visit Session?',
      message: language === 'th'
        ? 'ระบบจะกลับไปหน้าคิวผู้ป่วย ข้อมูลการตรวจที่กรอกไว้แต่ยังไม่ได้บันทึกจะหายทั้งหมด'
        : 'You will return to the patient queue. Any examination data not yet saved will be lost.',
      hint: language === 'th'
        ? 'หากยังต้องการเก็บข้อมูลไว้ ให้กด "บันทึกฉบับร่าง" แทน'
        : 'To keep your work, use "Save Draft" instead.',
      confirmLabel: language === 'th' ? 'ยืนยันยกเลิก' : 'Confirm Cancel',
      onConfirm: onBackToQueue
    });
  };

  // Complete Visit Validation & Execution
  const handleCompleteVisit = () => {
    const warnings: ValidationIssue[] = [];

    // เช็คเฉพาะสิ่งที่ "แพทย์กรอกเองได้" เท่านั้น
    // ข้อมูลจากจุดคัดกรอง (อาการสำคัญ, สัญญาณชีพ) แสดงเป็นหมายเหตุแทน
    // เพราะเป็นช่องอ่านอย่างเดียว แพทย์แก้ไม่ได้ ดู triageGaps ด้านบน
    if (!primaryDiag || !primaryDiag.code) {
      warnings.push({
        message: language === 'th' ? 'กรุณาระบุการวินิจฉัยโรคหลัก (ICD-10) อย่างน้อย 1 รายการ' : 'Required Field Missing: Require at least one Primary Diagnosis (ICD-10) before completing the visit.',
        tab: 'diagnosis',
        anchor: EXAM_ANCHOR.diagnosis,
      });
    }
    if (allergyAlert) {
      warnings.push({
        message: allergyAlert,
        tab: 'prescription',
        anchor: EXAM_ANCHOR.prescription,
      });
    }

    if (warnings.length > 0) {
      setValidationWarnings(warnings);
      // พาไปที่ช่องแรกที่ยังขาดทันที ไม่ต้องให้ผู้ใช้ไล่หาเอง
      focusIssue(warnings[0]);
      return;
    }

    setValidationWarnings([]);
    setConfirmDialog({
      tone: 'primary',
      title: language === 'th' ? 'บันทึกและเสร็จสิ้นการตรวจ?' : 'Save & Complete Visit?',
      message: language === 'th'
        ? `ปิดการตรวจของ ${patient.name} (HN: ${patient.hn}) และเปลี่ยนสถานะเป็น "ตรวจเสร็จสิ้น"`
        : `This will close the visit for ${patient.name} (HN: ${patient.hn}) and set the status to "Completed".`,
      hint: [
        prescriptions.length > 0
          ? (language === 'th'
              ? `ระบบจะส่งรายการสั่งยา ${prescriptions.length} รายการไปยังห้องยาโดยอัตโนมัติ`
              : `${prescriptions.length} prescription item(s) will be sent to the pharmacy queue automatically.`)
          : (language === 'th'
              ? 'การตรวจนี้ไม่มีรายการสั่งยา'
              : 'No prescription items in this visit.'),
        // เตือนอีกรอบตอนจะปิดเคส ถ้าข้อมูลจากจุดคัดกรองยังไม่ครบ
        triageGaps.length > 0
          ? (language === 'th'
              ? `หมายเหตุ: ยังไม่ได้รับ ${triageGaps.join(' และ ')} จากจุดคัดกรอง`
              : `Note: ${triageGaps.join(' and ')} not received from triage.`)
          : '',
      ].filter(Boolean).join('\n'),
      confirmLabel: language === 'th' ? 'ยืนยันบันทึก' : 'Confirm & Complete',
      onConfirm: runCompleteVisit
    });
  };

  // Complete Visit — งานจริง (เรียกหลังผู้ใช้กดยืนยันในโมดัล)
  const runCompleteVisit = () => {
    const activeDiags = [...(primaryDiag ? [primaryDiag] : []), ...secondaryDiags];
    saveToRecentDiagnoses(activeDiags);
    const updated = buildUpdatedPatient('Completed');
    onSavePatient(updated);
    const rxNotice = prescriptions.length > 0 
      ? (language === 'th' ? `\n(ระบบส่งรายการสั่งยา ${prescriptions.length} รายการไปยังห้องยาโดยอัตโนมัติ)` : `\n(${prescriptions.length} prescription item(s) automatically synced to pharmacy queue)`)
      : '';
    setSuccessNotice({
      isOpen: true,
      title: language === 'th' ? 'บันทึกสำเร็จ!' : 'Success!',
      message: language === 'th'
        ? `บันทึกและเสร็จสิ้นการตรวจเรียบร้อยแล้วสำหรับผู้ป่วย ${patient.name} (HN: ${patient.hn}, VN: ${displayVN(patient.vn)})${rxNotice}`
        : `Examination completed successfully for patient ${patient.name} (HN: ${patient.hn}, VN: ${displayVN(patient.vn)})${rxNotice}`,
      onConfirm: () => {
        onBackToQueue();
      }
    });
  };

  // Select medicine and auto-fill Thai hospital default fields
  const handleSelectMedicine = (nameVal: string) => {
    setNewMedName(nameVal);
    setMedSearch(nameVal);
    if (!nameVal.trim()) {
      setNewMedDosage('');
      setNewMedFreq('');
      setNewMedDuration('');
      setNewMedQty('');
      setNewMedRoute('');
      setNewMedTiming('');
      setNewMedInstructions('');
      return;
    }
    const found = medicinesList.find(
      m => (m.name || '').toLowerCase() === nameVal.trim().toLowerCase() ||
           (m.code && m.code.toLowerCase() === nameVal.trim().toLowerCase())
    );
    if (found) {
      const isTh = language === 'th';
      if (found.defaultDosage) {
        setNewMedDosage(typeof found.defaultDosage === 'object' ? (isTh ? found.defaultDosage.th : found.defaultDosage.en) : found.defaultDosage);
      } else {
        setNewMedDosage('1 เม็ด');
      }
      if (found.defaultFreq) {
        setNewMedFreq(typeof found.defaultFreq === 'object' ? (isTh ? found.defaultFreq.th : found.defaultFreq.en) : found.defaultFreq);
      } else {
        setNewMedFreq('วันละ 3 ครั้ง');
      }
      if (found.defaultDuration) {
        setNewMedDuration(typeof found.defaultDuration === 'object' ? (isTh ? found.defaultDuration.th : found.defaultDuration.en) : found.defaultDuration);
      } else {
        setNewMedDuration('5 วัน');
      }
      if (found.defaultQty !== undefined) {
        setNewMedQty(found.defaultQty);
      } else {
        setNewMedQty(10);
      }
      if (found.defaultRoute) {
        setNewMedRoute(typeof found.defaultRoute === 'object' ? (isTh ? found.defaultRoute.th : found.defaultRoute.en) : found.defaultRoute);
      } else {
        setNewMedRoute(isTh ? 'รับประทาน' : 'Oral');
      }
      if (found.defaultTiming) {
        setNewMedTiming(typeof found.defaultTiming === 'object' ? (isTh ? found.defaultTiming.th : found.defaultTiming.en) : found.defaultTiming);
      } else {
        setNewMedTiming(isTh ? 'หลังอาหาร' : 'After Meal');
      }
      if (found.defaultInstructions) {
        setNewMedInstructions(typeof found.defaultInstructions === 'object' ? (isTh ? found.defaultInstructions.th : found.defaultInstructions.en) : found.defaultInstructions);
      } else if (found.properties) {
        setNewMedInstructions(found.properties);
      } else {
        setNewMedInstructions('');
      }
    }
  };

  // Add Prescription
  const handleAddPrescription = () => {
    if (!newMedName.trim()) return;
    const parsedQty = typeof newMedQty === 'number' ? newMedQty : parseInt(String(newMedQty), 10);
    const newItem: PrescriptionItem = {
      id: `rx-${Date.now()}`,
      medicineName: newMedName,
      dosage: newMedDosage || '1 tablet',
      frequency: newMedFreq || '3 times a day',
      duration: newMedDuration || '5 days',
      quantity: !isNaN(parsedQty) && parsedQty > 0 ? parsedQty : 10,
      route: newMedRoute || 'Oral',
      timing: newMedTiming || 'After Meal',
      specialInstructions: newMedInstructions
    };
    setPrescriptions([...prescriptions, newItem]);
    setNewMedName('');
    setMedSearch('');
    setNewMedDosage('');
    setNewMedFreq('');
    setNewMedDuration('');
    setNewMedQty('');
    setNewMedRoute('');
    setNewMedTiming('');
    setNewMedInstructions('');
  };

  // Add Lab Order
  const handleAddLabOrder = () => {
    const labItem: LabOrderItem = {
      id: `lab-${Date.now()}`,
      testName: selectedLabTest,
      category: LAB_TEST_DATABASE.find(l => l.name === selectedLabTest)?.category || 'General',
      indication: labIndication,
      isUrgent: labIsUrgent
    };
    setLabOrders([...labOrders, labItem]);
    setLabIndication('');
  };

  // Add Imaging Order
  const handleAddImagingOrder = () => {
    const imgItem: ImagingOrderItem = {
      id: `img-${Date.now()}`,
      type: imgType,
      bodyPart: imgBodyPart,
      clinicalIndication: imgIndication,
      isUrgent: imgIsUrgent
    };
    setImagingOrders([...imagingOrders, imgItem]);
    setImgIndication('');
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Top Navigation & Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToQueue}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors flex items-center gap-1 text-xs font-semibold cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t('backToQueue')}</span>
          </button>
          <div className="h-5 w-px bg-slate-200" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold">
              <Stethoscope className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">{t('opdExamTitle')}</h1>
              <span className="text-[11px] text-slate-500 font-mono">
                {language === 'th' ? 'การบันทึกเวชระเบียนผู้ป่วยนอก' : 'OPD Medical Record Entry'}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons Header */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleSaveDraft}
            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{language === 'th' ? 'บันทึกฉบับร่าง' : 'Save Draft'}</span>
          </button>

          <button
            onClick={handleCompleteVisit}
            className="px-4 py-1.5 bg-[#2563eb] hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            <span>{t('saveExam')}</span>
          </button>
        </div>
      </div>

      {/* Auto-save notification */}
      {/* Drug Allergy Critical Alert Banner */}
      {allergyAlert && (
        <div className="bg-red-50 text-red-900 border-2 border-red-300 p-4 rounded-2xl flex items-start gap-3 shadow-xs animate-bounce">
          <ShieldAlert className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <h4 className="font-bold text-sm text-red-900">Drug Allergy Safety Warning!</h4>
            <p className="text-xs text-red-800 font-medium">{allergyAlert}</p>
          </div>
        </div>
      )}

      {/* แจ้งว่าข้อมูลจากจุดคัดกรองยังไม่ครบ — ไม่ได้ห้ามปิดเคส แค่ให้รู้ */}
      {triageGaps.length > 0 && (
        <div className="bg-sky-50 border border-sky-200 p-4 rounded-2xl text-sky-900 text-xs space-y-1.5">
          <div className="font-bold flex items-center gap-1.5">
            <ClipboardCheck className="w-4 h-4 text-sky-600" />
            <span>
              {language === 'th'
                ? 'ยังไม่ได้รับข้อมูลบางส่วนจากจุดคัดกรอง'
                : 'Some triage data has not been received'}
            </span>
          </div>
          <p className="font-medium text-sky-800">
            {language === 'th'
              ? `ขาด: ${triageGaps.join(' , ')}`
              : `Missing: ${triageGaps.join(' , ')}`}
          </p>
          <p className="text-[11px] text-sky-700">
            {language === 'th'
              ? 'ช่องเหล่านี้พยาบาลเป็นผู้บันทึกตอนคัดกรอง แพทย์แก้ไขเองไม่ได้ — ยังบันทึกผลการตรวจต่อได้ตามปกติ'
              : 'These fields are recorded by the nurse during triage and cannot be edited here. You can still complete the visit.'}
          </p>
        </div>
      )}

      {/* Validation Warnings Panel */}
      {validationWarnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-amber-900 text-xs space-y-2">
          <div className="font-bold flex items-center gap-1.5 text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>{language === 'th' ? 'รายการตรวจสอบความถูกต้องก่อนบันทึกการตรวจ' : 'Pre-Completion Validation Checks'}</span>
          </div>
          {/* กดที่แต่ละบรรทัดเพื่อกระโดดไปยังช่องที่ยังกรอกไม่ครบ */}
          <ul className="list-disc list-inside space-y-1 text-amber-800 font-medium">
            {validationWarnings.map((w, idx) => (
              <li key={idx}>
                <button
                  type="button"
                  onClick={() => focusIssue(w)}
                  className="text-left underline decoration-amber-400 underline-offset-2 hover:text-amber-950 cursor-pointer"
                >
                  {w.message}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* PATIENT INFORMATION BANNER - Modern High-Legibility Light Layout */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="p-6 sm:p-7 space-y-6">
          {/* Main Patient Header Row */}
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#2563eb] text-white flex items-center justify-center font-bold text-xl shrink-0 shadow-xs">
                {patient.name.charAt(0)}
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-xl font-bold text-slate-900 tracking-tight">{patient.name}</h2>
                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {language === 'th' ? `คิว #${patient.queueNo}` : `Queue #${patient.queueNo}`}
                  </span>
                  <CopyableText label="HN" value={patient.hn} className="bg-blue-50 text-blue-700 border border-blue-200 text-xs font-mono font-bold px-2.5 py-0.5 rounded-full" />
                  <CopyableText label="VN" value={displayVN(patient.vn)} className="bg-purple-50 text-purple-700 border border-purple-200 text-xs font-mono font-bold px-2.5 py-0.5 rounded-full" />
                  <CopyableText label={language === 'th' ? 'เลขบัตร' : 'ID'} value={nationalId} className="bg-amber-50 text-amber-800 border border-amber-200 text-xs font-mono font-bold px-2.5 py-0.5 rounded-full" />
                  <span className="bg-sky-50 text-sky-800 border border-sky-200 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                    {language === 'th'
                      ? status === 'Waiting' ? 'รอตรวจ'
                        : status === 'Examining' ? 'กำลังตรวจ'
                        : (status as string) === 'Lab' || (status as string) === 'Pending Laboratory' ? 'รอผลแล็บ'
                        : status === 'Pending Pharmacy' ? 'รอรับยา'
                        : status === 'Completed' ? 'ตรวจเสร็จแล้ว'
                        : status
                      : status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  {language === 'th'
                    ? 'ประวัติข้อมูลส่วนตัวผู้ป่วย • ระบบเวชระเบียนผู้ป่วยนอก (OPD EMR)'
                    : "Patient's Profile • OPD Electronic Medical Record"}
                </p>
              </div>
            </div>


          </div>

          {/* Single Unified Profile Card: Demographics + Insurance + Visit */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3 shadow-xs">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2.5 text-sm font-bold text-slate-900">
              <div className="p-1.5 rounded-lg bg-blue-100/80 text-blue-700">
                <User className="w-4 h-4" />
              </div>
              <span>{language === 'th' ? 'ข้อมูลพื้นฐาน' : 'Demographics'}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
              {/* Box 1: Full Name */}
              <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/80">
                <span className="text-slate-500 font-bold block text-[11px] mb-0.5">{language === 'th' ? 'ชื่อ - นามสกุล :' : 'Full Name :'}</span>
                <span className="font-bold text-slate-900 text-xs">{patient.name}</span>
              </div>

              {/* Box 2: Age & Gender */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/80">
                  <span className="text-slate-500 font-bold block text-[11px] mb-0.5">{language === 'th' ? 'อายุ :' : 'Age :'}</span>
                  <span className="font-bold text-slate-900 text-xs">{patient.age} {language === 'th' ? 'ปี' : 'yrs'}</span>
                </div>
                <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/80">
                  <span className="text-slate-500 font-bold block text-[11px] mb-0.5">{language === 'th' ? 'เพศ :' : 'Gender :'}</span>
                  <span className="font-bold text-slate-900 text-xs">
                    {patient.gender === 'Male'
                      ? (language === 'th' ? 'ชาย' : 'Male')
                      : patient.gender === 'Female'
                      ? (language === 'th' ? 'หญิง' : 'Female')
                      : patient.gender}
                  </span>
                </div>
              </div>

              {/* Box 3: Blood Group & DOB */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/80">
                  <span className="text-slate-500 font-bold block text-[11px] mb-0.5">{language === 'th' ? 'หมู่โลหิต :' : 'Blood Group :'}</span>
                  <span className="font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100 inline-block text-[11px]">
                    {patient.bloodGroup
                      ? patient.bloodGroup
                      : (language === 'th' ? 'หมู่ O (O Positive)' : 'O Positive (O+)')}
                  </span>
                </div>
                <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/80">
                  <span className="text-slate-500 font-bold block text-[11px] mb-0.5">{language === 'th' ? 'วันเกิด :' : 'Date of Birth :'}</span>
                  <span className="font-semibold text-slate-800 text-xs">{patient.dob || '1984-03-15'}</span>
                </div>
              </div>

              {/* Box 4: National ID */}
              <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/80">
                <span className="text-slate-500 font-bold block text-[11px] mb-0.5">{language === 'th' ? 'เลขบัตรประชาชน :' : 'National ID :'}</span>
                <CopyableText value={nationalId} />
              </div>

              {/* Box 5: Insurance Scheme */}
              <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/80">
                <span className="text-slate-500 font-bold block text-[11px] mb-0.5">{language === 'th' ? 'สิทธิการรักษา :' : 'Insurance Scheme :'}</span>
                <span className="font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/60 inline-block text-xs">
                  {patient.insuranceType
                    ? patient.insuranceType
                    : (language === 'th' ? 'บัตรทอง (หลักประกันสุขภาพถั่วหน้า UC)' : 'Universal Health Coverage (UC)')}
                </span>
              </div>

              {/* Box 6: Visit Date & Visit Time */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/80">
                  <span className="text-slate-500 font-bold block text-[11px] mb-0.5">{language === 'th' ? 'วันที่รับบริการ :' : 'Visit Date :'}</span>
                  <span className="font-bold text-slate-900 text-xs">{patient.visitDate || '2026-07-23'}</span>
                </div>
                <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/80">
                  <span className="text-slate-500 font-bold block text-[11px] mb-0.5">{language === 'th' ? 'เวลา :' : 'Visit Time :'}</span>
                  <span className="font-bold text-slate-900 text-xs">{patient.visitTime || (language === 'th' ? '08:45 น.' : '08:45 AM')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN TABS NAVBAR */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-200 overflow-x-auto scrollbar-none px-2 pt-1.5 w-full">
          {[
            { id: 'notes', label: language === 'th' ? 'ข้อมูลคัดกรอง & ประวัติ' : 'Triage & History', icon: FileText },
            { id: 'diagnosis', label: language === 'th' ? 'การวินิจฉัยโรค' : 'Diagnosis & Assessment', icon: Stethoscope },
            { id: 'prescription', label: language === 'th' ? 'การสั่งยา' : 'Prescription', badge: prescriptions.length, icon: Pill },
            { id: 'referral', label: language === 'th' ? 'การส่งต่อ & คำแนะนำ' : 'Referral & Counseling', icon: Send },
            { id: 'followup', label: language === 'th' ? 'นัดหมายติดตามอาการ' : 'Follow-up & Actions', icon: Calendar },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 min-w-[140px] py-3.5 px-3 text-sm font-semibold transition-all border-b-2 whitespace-nowrap flex items-center justify-center gap-2 cursor-pointer ${
                  isActive
                    ? 'border-[#2563eb] text-[#2563eb] font-bold bg-blue-50/40'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#2563eb]' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${isActive ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* TAB 1: CLINICAL NOTES & VITAL SIGNS & MEDICAL HISTORY */}
        {activeTab === 'notes' && (
          <div className="p-6 space-y-6">
            {/* Chief Complaint (CC) - Sent from Triage (Read-only for doctor) */}
            <div id={EXAM_ANCHOR.chiefComplaint} className="space-y-1.5 scroll-mt-28">
              <label className="text-[13px] font-bold text-slate-800 uppercase tracking-wider block">
                {language === 'th' ? 'อาการสำคัญ' : 'Chief Complaint (CC)'}
              </label>
              <div className="w-full min-h-[44px] px-3.5 py-2.5 bg-[#f8fafc] border border-slate-200 rounded-xl text-sm text-slate-800 font-normal flex items-center">
                {translateClinicalText(chiefComplaint, language) || <span className="text-slate-400 font-normal">- ไม่พบข้อมูลอาการสำคัญจากจุดคัดกรอง -</span>}
              </div>
            </div>

            {/* Present Illness (PI) - Sent from Triage (Read-only for doctor) */}
            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-slate-800 uppercase tracking-wider block">
                {language === 'th' ? 'ประวัติการเจ็บป่วยปัจจุบัน' : 'Present Illness (PI)'}
              </label>
              <div className="w-full min-h-[72px] p-3.5 bg-[#f8fafc] border border-slate-200 rounded-xl text-sm text-slate-800 leading-relaxed font-normal">
                {presentIllness ? (
                  <p className="whitespace-pre-wrap">{translateClinicalText(presentIllness, language)}</p>
                ) : (
                  <span className="text-slate-400 font-normal">- ไม่พบข้อมูลประวัติการเจ็บป่วยปัจจุบันจากจุดคัดกรอง -</span>
                )}
              </div>
            </div>

            {/* TRIAGE ASSESSMENT (Data Display Container) */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-purple-600" />
                <span>{language === 'th' ? 'การประเมินคัดกรองผู้ป่วย' : 'Triage Assessment'}</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-slate-800 block">
                    {language === 'th' ? 'ระดับความรุนแรง' : 'Triage Level'}
                  </label>
                  <div
                    className="w-full h-10 px-3 border rounded-xl text-sm font-bold flex items-center gap-1.5"
                    style={{ backgroundColor: tone.bg, borderColor: tone.border, color: tone.text }}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: tone.dot }}></span>
                    <span>{triageLevel || patient.triage?.level || (language === 'th' ? 'ระดับ 4: ไม่ฉุกเฉิน' : 'Level 4: Less Urgent')}</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-slate-800 block">
                    {language === 'th' ? 'ระดับความสำคัญ' : 'Priority Level'}
                  </label>
                  <div
                    className="w-full h-10 px-3 border rounded-xl text-sm font-bold flex items-center gap-1.5"
                    style={{ backgroundColor: tone.bg, borderColor: tone.border, color: tone.text }}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: tone.dot }}></span>
                    <span>{priorityLevel || patient.triage?.priority || (language === 'th' ? 'ความสำคัญปานกลาง' : 'Medium Priority')}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* VITAL SIGNS (Data Display Container) */}
            <div id={EXAM_ANCHOR.vitals} className="space-y-3 pt-2 border-t border-slate-100 scroll-mt-28">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-600" />
                <span>{language === 'th' ? 'สัญญาณชีพ' : 'Vital Signs'}</span>
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3.5">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-slate-800 block">
                    {language === 'th' ? 'ความดันโลหิต' : 'BP (mmHg)'}
                  </label>
                  <div className="w-full h-10 px-3 bg-[#f8fafc] border border-slate-200 rounded-xl text-sm font-bold text-slate-800 font-mono flex items-center">
                    {bp || '120/80'}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-slate-800 block">
                    {language === 'th' ? 'ชีพจร' : 'HR / Pulse (bpm)'}
                  </label>
                  <div className="w-full h-10 px-3 bg-[#f8fafc] border border-slate-200 rounded-xl text-sm font-bold text-slate-800 font-mono flex items-center">
                    {pulse || 78} {language === 'th' ? 'ครั้ง/นาที' : 'bpm'}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-slate-800 block">
                    {language === 'th' ? 'อุณหภูมิ' : 'Temp (°C)'}
                  </label>
                  <div className="w-full h-10 px-3 bg-[#f8fafc] border border-slate-200 rounded-xl text-sm font-bold text-slate-800 font-mono flex items-center">
                    {temp ? `${temp}°C` : '38.2°C'}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-slate-800 block">
                    {language === 'th' ? 'น้ำหนัก' : 'Weight (kg)'}
                  </label>
                  <div className="w-full h-10 px-3 bg-[#f8fafc] border border-slate-200 rounded-xl text-sm font-bold text-slate-800 font-mono flex items-center">
                    {weight || 70} {language === 'th' ? 'กก.' : 'kg'}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-slate-800 block">
                    {language === 'th' ? 'ส่วนสูง' : 'Height (cm)'}
                  </label>
                  <div className="w-full h-10 px-3 bg-[#f8fafc] border border-slate-200 rounded-xl text-sm font-bold text-slate-800 font-mono flex items-center">
                    {height || 175} {language === 'th' ? 'ซม.' : 'cm'}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-slate-800 block">
                    BMI
                  </label>
                  <div className="w-full h-10 px-3 bg-[#f8fafc] border border-slate-200 rounded-xl text-sm font-bold text-slate-800 font-mono flex items-center">
                    {bmi > 0 ? `${bmi} kg/m²` : '22.9 kg/m²'}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-slate-800 block">
                    {language === 'th' ? 'ระดับออกซิเจนในเลือด' : 'SpO₂ (%)'}
                  </label>
                  <div className="w-full h-10 px-3 bg-[#f8fafc] border border-slate-200 rounded-xl text-sm font-bold text-slate-800 font-mono flex items-center">
                    {spo2 || 98}%
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-slate-800 block">
                    {language === 'th' ? 'อัตราการหายใจ' : 'Resp Rate (/min)'}
                  </label>
                  <div className="w-full h-10 px-3 bg-[#f8fafc] border border-slate-200 rounded-xl text-sm font-bold text-slate-800 font-mono flex items-center">
                    {respiratoryRate || 18} {language === 'th' ? 'ครั้ง/นาที' : '/min'}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-slate-800 block">
                    {language === 'th' ? 'ระดับความเจ็บปวด' : 'Pain Score (0-10)'}
                  </label>
                  <div className="w-full h-10 px-3 bg-[#f8fafc] border border-slate-200 rounded-xl text-sm font-bold text-slate-800 font-mono flex items-center">
                    {painScore !== undefined
                      ? `${painScore}/10`
                      : <span className="text-slate-400 font-normal">- ไม่ได้ประเมิน -</span>}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-slate-800 block">
                    {language === 'th' ? 'ระดับน้ำตาลในเลือด' : 'Blood Sugar (mg/dL)'}
                  </label>
                  <div className="w-full h-10 px-3 bg-[#f8fafc] border border-slate-200 rounded-xl text-sm font-bold text-slate-800 font-mono flex items-center">
                    {bloodSugar !== undefined
                      ? `${bloodSugar} mg/dL`
                      : <span className="text-slate-400 font-normal">- ไม่ได้ตรวจ -</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* MEDICAL HISTORY, ALLERGIES & SOCIAL HABITS */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-slate-700" />
                <span>{language === 'th' ? 'ประวัติทางการแพทย์ แพ้ยา และพฤติกรรมสุขภาพ' : 'Medical History, Allergies & Social Habits'}</span>
              </h3>

              <div className="flex flex-col gap-3.5">
                {/* Drug Allergy */}
                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-slate-800 block">
                    {language === 'th' ? 'ประวัติแพ้ยา' : 'Drug Allergies'}
                  </label>
                  <div className={`w-full min-h-[44px] p-3 rounded-xl border grid grid-cols-1 sm:grid-cols-2 gap-3 items-center ${!noDrugAllergy && drugAllergiesText ? 'bg-rose-50/70 border-rose-200/80' : 'bg-[#f8fafc] border-slate-200'}`}>
                    <div className="border-b sm:border-b-0 sm:border-r border-slate-200/80 pb-2 sm:pb-0 sm:pr-3">
                      {!noDrugAllergy && drugAllergiesText ? (
                        <span className="text-sm font-bold text-rose-900 block">{drugAllergiesText}</span>
                      ) : (
                        <span className="text-sm font-medium text-slate-400 block">--</span>
                      )}
                    </div>
                    <div className="pt-1 sm:pt-0 sm:pl-1">
                      {!noDrugAllergy && drugAllergiesText ? (
                        <span className="text-sm font-medium text-rose-800 block">
                          {language === 'th' 
                            ? (drugAllergySymptoms === 'Rashes, Hives' ? 'ผื่นคัน, ลมพิษ' : drugAllergySymptoms)
                            : (drugAllergySymptoms === 'ผื่นคัน, ลมพิษ (Rashes, Hives)' ? 'Rashes, Hives' : drugAllergySymptoms)}
                        </span>
                      ) : (
                        <span className="text-sm font-medium text-slate-400 block">--</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Food Allergy */}
                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-slate-800 block">
                    {language === 'th' ? 'ประวัติแพ้อาหาร' : 'Food Allergies'}
                  </label>
                  <div className="w-full min-h-[44px] p-3 bg-[#f8fafc] border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                    <div className="border-b sm:border-b-0 sm:border-r border-slate-200/80 pb-2 sm:pb-0 sm:pr-3">
                      {!noFoodAllergy && foodAllergiesText ? (
                        <span className="text-sm font-bold text-slate-900 block">{foodAllergiesText}</span>
                      ) : (
                        <span className="text-sm font-medium text-slate-400 block">--</span>
                      )}
                    </div>
                    <div className="pt-1 sm:pt-0 sm:pl-1">
                      {!noFoodAllergy && foodAllergiesText && foodAllergySymptoms ? (
                        <span className="text-sm font-medium text-slate-800 block">{foodAllergySymptoms}</span>
                      ) : (
                        <span className="text-sm font-medium text-slate-400 block">--</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Chronic / Underlying Diseases */}
                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-slate-800 block">
                    {language === 'th' ? 'โรคประจำตัว' : 'Underlying Diseases'}
                  </label>
                  <div className="w-full min-h-[44px] p-3 bg-[#f8fafc] border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                    <div className="border-b sm:border-b-0 sm:border-r border-slate-200/80 pb-2 sm:pb-0 sm:pr-3">
                      {!noChronicDisease && chronicDiseasesText ? (
                        <span className="text-sm font-bold text-slate-900 block">{chronicDiseasesText}</span>
                      ) : (
                        <span className="text-sm font-medium text-slate-400 block">--</span>
                      )}
                    </div>
                    <div className="pt-1 sm:pt-0 sm:pl-1">
                      {!noChronicDisease && chronicDiseasesText ? (
                        <span className="text-sm font-medium text-slate-700 block">{language === 'th' ? 'ติดตามอาการต่อเนื่อง' : 'Regular Follow-up'}</span>
                      ) : (
                        <span className="text-sm font-medium text-slate-400 block">--</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Current Medications */}
                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-slate-800 block">
                    {language === 'th' ? 'ยาที่รับประทานประจำ' : 'Current Medications'}
                  </label>
                  <div className="w-full min-h-[44px] p-3 bg-[#f8fafc] border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                    <div className="border-b sm:border-b-0 sm:border-r border-slate-200/80 pb-2 sm:pb-0 sm:pr-3">
                      {currentMedicationsText ? (
                        <span className="text-sm font-bold text-slate-900 block">{currentMedicationsText}</span>
                      ) : (
                        <span className="text-sm font-medium text-slate-400 block">--</span>
                      )}
                    </div>
                    <div className="pt-1 sm:pt-0 sm:pl-1">
                      {currentMedicationsText ? (
                        <span className="text-sm font-medium text-slate-700 block">{language === 'th' ? 'ทานตามแพทย์สั่ง' : 'Take as prescribed'}</span>
                      ) : (
                        <span className="text-sm font-medium text-slate-400 block">--</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Smoking History */}
                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-slate-800 block">
                    {language === 'th' ? 'ประวัติการสูบบุหรี่' : 'Smoking History'}
                  </label>
                  <div className="w-full min-h-[44px] p-3 bg-[#f8fafc] border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                    <div className="border-b sm:border-b-0 sm:border-r border-slate-200/80 pb-2 sm:pb-0 sm:pr-3">
                      {patient.smokingHistory?.status && (patient.smokingHistory.status.includes('Smoker') || patient.smokingHistory.status.includes('สูบ')) && !patient.smokingHistory.status.includes('ไม่') && !patient.smokingHistory.status.includes('Non') && !patient.smokingHistory.status.includes('ปฏิเสธ') ? (
                        <span className="text-sm font-bold text-slate-900 block">{language === 'th' ? 'สูบบุหรี่' : 'Smoker'}</span>
                      ) : (
                        <span className="text-sm font-medium text-slate-400 block">--</span>
                      )}
                    </div>
                    <div className="pt-1 sm:pt-0 sm:pl-1">
                      {patient.smokingHistory?.status && (patient.smokingHistory.status.includes('Smoker') || patient.smokingHistory.status.includes('สูบ')) && !patient.smokingHistory.status.includes('ไม่') && !patient.smokingHistory.status.includes('Non') && !patient.smokingHistory.status.includes('ปฏิเสธ') ? (
                        <span className="text-sm text-slate-700 font-medium block">
                          {patient.smokingHistory?.frequency && patient.smokingHistory?.duration 
                            ? `${patient.smokingHistory.frequency}, ${patient.smokingHistory.duration}`
                            : patient.smokingHistory?.frequency || patient.smokingHistory?.duration || (language === 'th' ? '10 มวน/วัน, ประมาณ 5 ปี' : '10 cigarettes/day, ~5 years')}
                        </span>
                      ) : (
                        <span className="text-sm font-medium text-slate-400 block">--</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Alcohol Drinking History */}
                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-slate-800 block">
                    {language === 'th' ? 'ประวัติการดื่มแอลกอฮอล์' : 'Alcohol Drinking'}
                  </label>
                  <div className="w-full min-h-[44px] p-3 bg-[#f8fafc] border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                    <div className="border-b sm:border-b-0 sm:border-r border-slate-200/80 pb-2 sm:pb-0 sm:pr-3">
                      {patient.alcoholHistory?.status && (patient.alcoholHistory.status.includes('Drinker') || patient.alcoholHistory.status.includes('ดื่ม')) && !patient.alcoholHistory.status.includes('ไม่') && !patient.alcoholHistory.status.includes('Non') && !patient.alcoholHistory.status.includes('ปฏิเสธ') ? (
                        <span className="text-sm font-bold text-slate-900 block">{language === 'th' ? 'ดื่มแอลกอฮอล์' : 'Drinker'}</span>
                      ) : (
                        <span className="text-sm font-medium text-slate-400 block">--</span>
                      )}
                    </div>
                    <div className="pt-1 sm:pt-0 sm:pl-1">
                      {patient.alcoholHistory?.status && (patient.alcoholHistory.status.includes('Drinker') || patient.alcoholHistory.status.includes('ดื่ม')) && !patient.alcoholHistory.status.includes('ไม่') && !patient.alcoholHistory.status.includes('Non') && !patient.alcoholHistory.status.includes('ปฏิเสธ') ? (
                        <span className="text-sm text-slate-700 font-medium block">
                          {patient.alcoholHistory?.frequency && patient.alcoholHistory?.duration 
                            ? `${patient.alcoholHistory.frequency}, ${patient.alcoholHistory.duration}`
                            : patient.alcoholHistory?.frequency || patient.alcoholHistory?.duration || (language === 'th' ? '2-3 ครั้ง/สัปดาห์, ประมาณ 8 ปี' : '2-3 times/week, ~8 years')}
                        </span>
                      ) : (
                        <span className="text-sm font-medium text-slate-400 block">--</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* ADDITIONAL NOTES & DOCTOR HANDOVER */}
              <div className="pt-4 border-t border-slate-100">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {/* Nurse Notes Display */}
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-bold text-slate-800 flex items-center gap-1.5 block">
                      <FileText className="w-3.5 h-3.5 text-blue-600" />
                      <span>{language === 'th' ? 'บันทึกการคัดกรองเบื้องต้น' : 'Initial Triage Notes'}</span>
                    </label>
                    <div className="w-full min-h-[48px] p-3 bg-[#f8fafc] border border-slate-200 rounded-xl text-sm text-slate-800 leading-relaxed font-normal flex items-center">
                      {(nurseNotes || triageNotes || patient.triage?.notes) ? (
                        <p className="whitespace-pre-wrap">
                          {nurseNotes || translateClinicalText(triageNotes || patient.triage?.notes, language)}
                        </p>
                      ) : (
                        <span className="text-slate-400 font-normal">
                          {language === 'th' ? '- ไม่มีบันทึกเพิ่มเติมจากพยาบาล -' : '- No additional nurse notes -'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Important Alerts for Doctor Display */}
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-bold text-amber-900 flex items-center gap-1.5 block">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      <span>{language === 'th' ? 'ข้อมูลสำคัญแจ้งแพทย์' : 'Important Alerts for Doctor'}</span>
                    </label>
                    <div className="w-full min-h-[48px] p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-sm text-amber-950 font-medium leading-relaxed flex items-center">
                      {importantInfoForDoctor ? (
                        <p className="whitespace-pre-wrap">{importantInfoForDoctor}</p>
                      ) : (
                        <span className="text-amber-700/60 font-normal">
                          {language === 'th' ? '- ไม่มีข้อความสำคัญหรือข้อควรระวังแจ้งแพทย์ -' : '- No critical alerts for doctor -'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DIAGNOSIS & ASSESSMENT */}
        {activeTab === 'diagnosis' && (
          <div className="p-6 space-y-6">
            
            {/* PHYSICAL EXAMINATION SYSTEM FINDINGS */}
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900">
                {language === 'th' ? 'ผลการตรวจร่างกายตามระบบ' : 'Physical Examination System Findings'}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-[13px] font-bold text-slate-800 block mb-1">
                    {language === 'th' ? 'สภาพทั่วไป' : 'General Appearance'}
                  </label>
                  <textarea
                    rows={2}
                    value={generalAppearance}
                    onChange={(e) => setGeneralAppearance(e.target.value)}
                    placeholder={
                      language === 'th'
                        ? 'รู้สึกตัวดี มีอาการไม่สบายตัวเล็กน้อยจากเจ็บคอ...'
                        : 'Good consciousness, non-toxic appearance...'
                    }
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 outline-hidden transition-all resize-none leading-relaxed"
                  />
                </div>

                <div>
                  <label className="text-[13px] font-bold text-slate-800 block mb-1">
                    {language === 'th' ? 'ศีรษะ ตา หู จมูก คอ' : 'HEENT'}
                  </label>
                  <textarea
                    rows={2}
                    value={heent}
                    onChange={(e) => setHeent(e.target.value)}
                    placeholder={
                      language === 'th'
                        ? 'ผนังคอหอยแดงมากและมีคราบหนองบริเวณต่อมทอนซิล คลำพบต่อมน้ำเหลืองบริเวณลำคอโต...'
                        : 'Pharynx erythematous with tonsillar exudates, cervical lymph nodes palpable...'
                    }
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 outline-hidden transition-all resize-none leading-relaxed"
                  />
                </div>

                <div>
                  <label className="text-[13px] font-bold text-slate-800 block mb-1">
                    {language === 'th' ? 'ระบบหัวใจและหลอดเลือด' : 'Cardiovascular'}
                  </label>
                  <textarea
                    rows={2}
                    value={cardiovascular}
                    onChange={(e) => setCardiovascular(e.target.value)}
                    placeholder={
                      language === 'th'
                        ? 'เสียงหัวใจ S1, S2 ปกติ ไม่พบเสียงฟู่ (Murmur)...'
                        : 'Normal S1, S2, no murmur...'
                    }
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 outline-hidden transition-all resize-none leading-relaxed"
                  />
                </div>

                <div>
                  <label className="text-[13px] font-bold text-slate-800 block mb-1">
                    {language === 'th' ? 'ระบบทางเดินหายใจและปอด' : 'Respiratory'}
                  </label>
                  <textarea
                    rows={2}
                    value={respiratory}
                    onChange={(e) => setRespiratory(e.target.value)}
                    placeholder={
                      language === 'th'
                        ? 'ปอดฟังชัดเจนทั้งสองข้าง ไม่พบเสียงวี้ดหรือเสียงครืดคราด...'
                        : 'Clear bilaterally, no adventitious sounds, no wheezing...'
                    }
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 outline-hidden transition-all resize-none leading-relaxed"
                  />
                </div>

                <div>
                  <label className="text-[13px] font-bold text-slate-800 block mb-1">
                    {language === 'th' ? 'ระบบช่องท้อง' : 'Abdomen'}
                  </label>
                  <textarea
                    rows={2}
                    value={abdomen}
                    onChange={(e) => setAbdomen(e.target.value)}
                    placeholder={
                      language === 'th'
                        ? 'หน้าท้องนุ่ม ไม่กดเจ็บ ไม่พบตับหรือม้ามโต...'
                        : 'Soft, non-tender, active bowel sounds, no organomegaly...'
                    }
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 outline-hidden transition-all resize-none leading-relaxed"
                  />
                </div>

                <div>
                  <label className="text-[13px] font-bold text-slate-800 block mb-1">
                    {language === 'th' ? 'ระบบกล้ามเนื้อและกระดูก' : 'Musculoskeletal'}
                  </label>
                  <textarea
                    rows={2}
                    value={musculoskeletal}
                    onChange={(e) => setMusculoskeletal(e.target.value)}
                    placeholder={
                      language === 'th'
                        ? 'การเคลื่อนไหวของข้อและกล้ามเนื้อปกติ...'
                        : 'Normal range of motion, muscle power 5/5...'
                    }
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 outline-hidden transition-all resize-none leading-relaxed"
                  />
                </div>
              </div>
            </div>
            
            {/* 1. ICD-10 SEARCH & AUTOCOMPLETE */}
            <div id={EXAM_ANCHOR.diagnosis} className="space-y-4 bg-white p-5 rounded-2xl border border-slate-200 relative scroll-mt-28">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-slate-200/80">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Search className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>{language === 'th' ? '1. ค้นหารหัสโรค ICD-10' : '1. Search ICD-10 Diagnosis'}</span>
                </h3>
                <span className="text-xs font-medium text-slate-500">
                  {language === 'th' ? 'ค้นหาจากรหัสโรค ชื่อภาษาไทย หรือภาษาอังกฤษ' : 'Search by Code, English or Thai name'}
                </span>
              </div>

              {/* Duplicate or Validation Warning Alert */}
              {diagWarning && (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs font-semibold flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>{diagWarning}</span>
                  </div>
                  <button type="button" onClick={() => setDiagWarning('')} className="text-amber-600 hover:text-amber-800 cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Search Bar Input */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={diagSearch}
                  onChange={(e) => {
                    setDiagSearch(e.target.value);
                    setShowDiagDropdown(true);
                  }}
                  onFocus={() => setShowDiagDropdown(true)}
                  placeholder={language === 'th' ? 'พิมพ์รหัส ICD-10 หรือชื่อโรค เช่น J02.9, Pharyngitis, คออักเสบ...' : 'Search ICD-10 code or disease name (e.g. J02.9, Pharyngitis)...'}
                  className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 focus:outline-none"
                />
                {diagSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setDiagSearch('');
                      setShowDiagDropdown(false);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}

                {/* Autocomplete Dropdown List */}
                {showDiagDropdown && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowDiagDropdown(false)}
                    />
                    <div className="absolute z-20 left-0 right-0 mt-1.5 max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl divide-y divide-slate-100">
                      {filteredICD10.length > 0 ? (
                        filteredICD10.map((item) => {
                          const selected = isCodeSelected(item.code);
                          return (
                            <div
                              key={item.code}
                              className={`p-3 transition-all flex items-center justify-between hover:bg-blue-50/70 ${selected ? 'bg-slate-50' : 'cursor-pointer'}`}
                            >
                              <div
                                className="flex-1 cursor-pointer"
                                onClick={() => handleSelectDiagnosis(item)}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                                    {item.code}
                                  </span>
                                  <span className="text-sm font-bold text-slate-900">{item.localName || item.name}</span>
                                </div>
                                {item.localName && (
                                  <span className="text-xs font-medium text-slate-400 block ml-0.5 mt-0.5">
                                    {item.name}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 ml-2">
                                {selected ? (
                                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 flex items-center gap-1">
                                    <Check className="w-3 h-3" /> {language === 'th' ? 'เลือกแล้ว' : 'Selected'}
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleSelectDiagnosis(item)}
                                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                                  >
                                    {!primaryDiag
                                      ? (language === 'th' ? '+ เลือกเป็นโรคหลัก' : '+ Set Primary')
                                      : (language === 'th' ? '+ เพิ่มโรควินิจฉัย' : '+ Add Diagnosis')}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="p-4 text-center text-xs text-slate-500 font-medium">
                          {language === 'th' ? `ไม่พบข้อมูล ICD-10 ที่ตรงกับ "${diagSearch}"` : `No ICD-10 diagnosis matching "${diagSearch}"`}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* 2. RECENT DIAGNOSIS SECTION */}
            <div className="space-y-4 bg-white p-5 rounded-2xl border border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-slate-200/80">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>{language === 'th' ? '2. โรคที่วินิจฉัยบ่อย' : '2. Recent Diagnoses'}</span>
                </h3>
                <span className="text-xs font-medium text-slate-500">
                  {language === 'th' ? 'คลิกเพื่อเพิ่มลงในรายการวินิจฉัยปัจจุบัน' : 'Click to add directly to current diagnosis list'}
                </span>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {recentDiagnoses.map((item) => {
                  const selected = isCodeSelected(item.code);
                  return (
                    <button
                      key={item.code}
                      type="button"
                      onClick={() => handleSelectDiagnosis(item)}
                      disabled={selected}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all flex items-center gap-1.5 ${
                        selected
                          ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-75'
                          : 'bg-white hover:bg-blue-50 text-slate-800 border-slate-200 hover:border-blue-300 hover:text-blue-900 cursor-pointer shadow-2xs'
                      }`}
                    >
                      <span className="font-mono text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                        {item.code}
                      </span>
                      <span>{item.name}</span>
                      {selected ? (
                        <Check className="w-3 h-3 text-emerald-600 ml-1" />
                      ) : (
                        <Plus className="w-3 h-3 text-slate-400 ml-0.5" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. SELECTED DIAGNOSIS LIST */}
            <div className="space-y-4 bg-white p-5 rounded-2xl border border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-slate-200/80">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>{language === 'th' ? '3. รายการโรคที่วินิจฉัยแล้ว' : '3. Selected Diagnoses List'}</span>
                </h3>
                <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                  {language === 'th'
                    ? `รวมทั้งหมด: ${(primaryDiag ? 1 : 0) + secondaryDiags.length} รายการ`
                    : `Total: ${(primaryDiag ? 1 : 0) + secondaryDiags.length} items`}
                </span>
              </div>

              {/* No Diagnosis Selected Validation Card */}
              {!primaryDiag && secondaryDiags.length === 0 && (
                <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl text-amber-900 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>{language === 'th' ? 'ยังไม่ได้ระบุการวินิจฉัยโรค' : 'No Diagnosis Selected'}</span>
                  </div>
                  <p className="text-xs text-amber-800">
                    {language === 'th'
                      ? '* จำเป็นต้องระบุการวินิจฉัยหลักอย่างน้อย 1 รายการก่อนเสร็จสิ้นการตรวจ'
                      : "* Required: At least one Primary Diagnosis is required before completing the patient's visit."}
                  </p>
                </div>
              )}

              <div className="space-y-3">
                {/* PRIMARY DIAGNOSIS ITEM */}
                {primaryDiag ? (
                  <div className="p-4 bg-blue-50/70 border-2 border-blue-300 rounded-2xl space-y-2 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="bg-blue-600 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg uppercase flex items-center gap-1">
                          <Star className="w-3 h-3 fill-current" /> {language === 'th' ? 'การวินิจฉัยหลัก' : 'Primary Diagnosis'}
                        </span>
                        <span className="text-xs font-mono font-bold text-blue-900 bg-white px-2 py-0.5 rounded border border-blue-200">
                          {primaryDiag.code}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => startEditDiagnosis('primary', primaryDiag.name)}
                          className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" /> {language === 'th' ? 'แก้ไข' : 'Edit'}
                        </button>
                        {secondaryDiags.length > 0 && (
                          <button
                            type="button"
                            onClick={handleDemotePrimary}
                            className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
                          >
                            {language === 'th' ? 'เปลี่ยนเป็นโรครอง' : 'Set as Secondary'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleRemovePrimary}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                          title={language === 'th' ? 'ลบรายการวินิจฉัยหลัก' : 'Remove Primary Diagnosis'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {editingDiagTarget === 'primary' ? (
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="text"
                          value={editDiagText}
                          onChange={(e) => setEditDiagText(e.target.value)}
                          className="flex-1 p-2 bg-white border border-blue-300 rounded-xl text-xs font-medium focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 focus:outline-hidden transition-all"
                        />
                        <button
                          type="button"
                          onClick={saveEditDiagnosis}
                          className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-xl cursor-pointer"
                        >
                          {language === 'th' ? 'บันทึก' : 'Save'}
                        </button>
                      </div>
                    ) : (
                      <div className="text-sm font-bold text-slate-900 pl-1">
                        {primaryDiag.name} {primaryDiag.localName ? `(${primaryDiag.localName})` : ''}
                      </div>
                    )}
                  </div>
                ) : (
                  secondaryDiags.length > 0 && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-800 flex items-center justify-between">
                      <span>{language === 'th' ? '⚠️ ยังไม่มีการวินิจฉัยหลัก! โปรดเลือกโรคใต้อันนี้ให้เป็นโรคหลัก' : '⚠️ Missing Primary Diagnosis! Please set one of the diagnoses below as Primary.'}</span>
                    </div>
                  )
                )}

                {/* SECONDARY DIAGNOSES ITEMS */}
                {secondaryDiags.map((diag, index) => (
                  <div
                    key={diag.code + '-' + index}
                    className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 hover:border-slate-300 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="bg-slate-200 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase">
                          {language === 'th' ? `การวินิจฉัยร่วม #${index + 1}` : `Secondary #${index + 1}`}
                        </span>
                        <span className="text-xs font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                          {diag.code}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/* Reorder Buttons */}
                        <div className="flex items-center border border-slate-200 rounded-lg bg-white overflow-hidden mr-1">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => handleMoveSecondaryUp(index)}
                            className="p-1 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent text-slate-600 cursor-pointer"
                            title={language === 'th' ? 'เลื่อนขึ้น' : 'Move Up'}
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={index === secondaryDiags.length - 1}
                            onClick={() => handleMoveSecondaryDown(index)}
                            className="p-1 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent text-slate-600 cursor-pointer border-l border-slate-150"
                            title={language === 'th' ? 'เลื่อนลง' : 'Move Down'}
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => handlePromoteToPrimary(index)}
                          className="px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 hover:border-blue-300 rounded-lg text-xs font-bold cursor-pointer"
                        >
                          {language === 'th' ? 'ตั้งเป็นโรคหลัก' : 'Set as Primary'}
                        </button>

                        <button
                          type="button"
                          onClick={() => startEditDiagnosis(index, diag.name)}
                          className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" /> {language === 'th' ? 'แก้ไข' : 'Edit'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRemoveSecondary(index)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                          title={language === 'th' ? 'ลบรายการ' : 'Remove Diagnosis'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {editingDiagTarget === index ? (
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="text"
                          value={editDiagText}
                          onChange={(e) => setEditDiagText(e.target.value)}
                          className="flex-1 p-2 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 focus:outline-hidden transition-all"
                        />
                        <button
                          type="button"
                          onClick={saveEditDiagnosis}
                          className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-xl cursor-pointer"
                        >
                          {language === 'th' ? 'บันทึก' : 'Save'}
                        </button>
                      </div>
                    ) : (
                      <div className="text-sm font-semibold text-slate-800 pl-1">
                        {diag.name} {diag.localName ? `(${diag.localName})` : ''}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Assessment Notes & Treatment Plan Textareas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
              <div>
                <label className="text-[13px] font-bold text-slate-800 block mb-1">
                  {language === 'th' ? 'เหตุผลทางการแพทย์และการประเมิน' : 'Assessment Notes'}
                </label>
                <textarea
                  rows={4}
                  value={assessmentNotes}
                  onChange={(e) => setAssessmentNotes(e.target.value)}
                  placeholder={language === 'th' ? 'ระบุเหตุผลทางการแพทย์ ข้อควรพิจารณา การประเมินความรุนแรง...' : 'Enter clinical reasoning, severity assessment, and considerations...'}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 focus:outline-hidden transition-all"
                />
              </div>

              <div>
                <label className="text-[13px] font-bold text-slate-800 block mb-1">
                  {language === 'th' ? 'แผนการรักษาและหัตถการ' : 'Treatment Plan & Procedures'}
                </label>
                <textarea
                  rows={4}
                  value={treatmentPlan}
                  onChange={(e) => setTreatmentPlan(e.target.value)}
                  placeholder={language === 'th' ? 'ระบุแผนการดูแล คำแนะนำที่ไม่ใช้ยา หัตถการที่ทำ...' : 'Enter care plan, non-pharmacological advice, procedures performed...'}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 focus:outline-hidden transition-all"
                />
              </div>
            </div>

          </div>
        )}

        {/* TAB 3: PRESCRIPTION (PHARMACY ORDERS) */}
        {activeTab === 'prescription' && (
          <div className="p-6 space-y-6">
            {/* Add New Medicine Form */}
            <div id={EXAM_ANCHOR.prescription} className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4 scroll-mt-28">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#2563eb]" />
                <span>{language === 'th' ? 'ค้นหาและสั่งจ่ายยา' : 'Search & Prescribe Medicine'}</span>
              </h3>

              {/* Medicine Selector & Search */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2 relative" ref={medDropdownRef}>
                  <label className="text-[13px] font-bold text-slate-700 block mb-1">
                    {language === 'th' ? 'เลือก / ค้นหารายการยา * (พิมพ์ค้นหา หรือ เลือกจากรายการ)' : 'Select / Search Medicine *'}
                  </label>
                  
                  <div className="group relative flex items-center">
                    <Search className="w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors absolute left-3 pointer-events-none" />
                    <input
                      type="text"
                      value={medSearch}
                      onFocus={() => setIsMedDropdownOpen(true)}
                      onChange={(e) => {
                        const val = e.target.value;
                        setMedSearch(val);
                        setIsMedDropdownOpen(true);
                        handleSelectMedicine(val);
                      }}
                      placeholder={language === 'th' ? 'พิมพ์ค้นหาชื่อยา เช่น Paracetamol, Amoxicillin หรือคลิกเลือก...' : 'Search medicine e.g., Paracetamol, Amoxicillin or click to select...'}
                      className="w-full pl-9 pr-16 py-2.5 bg-slate-50/80 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 focus:outline-hidden shadow-inner transition-all"
                    />

                    <div className="absolute right-2 flex items-center gap-1">
                      {medSearch && (
                        <button
                          type="button"
                          onClick={() => {
                            handleSelectMedicine('');
                            setIsMedDropdownOpen(true);
                          }}
                          className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                          title={language === 'th' ? 'ล้างคำค้นหา' : 'Clear search'}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsMedDropdownOpen(!isMedDropdownOpen)}
                        className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                        title={language === 'th' ? 'แสดงรายการยาบ่อย' : 'Show frequent medicines'}
                      >
                        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isMedDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {/* Auto-suggest Popover Dropdown */}
                  {isMedDropdownOpen && (
                    <div className="absolute z-50 left-0 right-0 mt-1.5 max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl divide-y divide-slate-100 animate-in fade-in duration-150">
                      <div className="px-3 py-1.5 bg-slate-50 text-[11px] font-bold text-slate-500 tracking-wider uppercase flex justify-between items-center">
                        <span>
                          {!medSearch.trim()
                            ? (language === 'th' ? 'รายการยาโรงพยาบาล / ยาที่สั่งจ่ายบ่อย' : 'Hospital Formulary / Frequently Prescribed')
                            : (language === 'th' ? `ผลการค้นหา (${filteredMedicines.length} รายการ)` : `Search Results (${filteredMedicines.length})`)}
                        </span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          {language === 'th' ? 'คลิกเพื่อเลือก' : 'Click to select'}
                        </span>
                      </div>

                      {filteredMedicines.length > 0 ? (
                        filteredMedicines.map((med, idx) => {
                          const isSelected = newMedName.toLowerCase() === (med.name || '').toLowerCase();
                          return (
                            <button
                              key={med.code || med.id || idx}
                              type="button"
                              onClick={() => {
                                handleSelectMedicine(med.name);
                                setIsMedDropdownOpen(false);
                              }}
                              className={`w-full text-left px-3.5 py-2.5 hover:bg-blue-50/80 transition-colors flex items-center justify-between group ${
                                isSelected ? 'bg-blue-50 text-blue-900 font-semibold' : 'text-slate-700'
                              }`}
                            >
                              <div>
                                <div className="text-xs sm:text-sm font-semibold group-hover:text-blue-700 flex items-center gap-1.5 flex-wrap">
                                  {med.code && (
                                    <span className="font-mono text-[10.5px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md border border-slate-200">
                                      {med.code}
                                    </span>
                                  )}
                                  <span>{med.name}</span>
                                  {isSelected && <Check className="w-3.5 h-3.5 text-blue-600" />}
                                </div>
                                <div className="text-[11px] text-slate-500 group-hover:text-blue-600 flex items-center gap-2 mt-0.5">
                                  {med.genericName && <span>{med.genericName}</span>}
                                  {med.category && <span className="text-slate-400">• {med.category}</span>}
                                </div>
                              </div>
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-700 transition-colors shrink-0 ml-2">
                                {language === 'th' ? 'เลือกยา' : 'Select'}
                              </span>
                            </button>
                          );
                        })
                      ) : (
                        <div className="p-4 text-center text-xs text-slate-500">
                          {language === 'th'
                            ? `ไม่พบยาที่ตรงกับ "${medSearch}" ในระบบคลังยา`
                            : `No medicine matching "${medSearch}" found`}
                          <div className="mt-2">
                            <button
                              type="button"
                              onClick={() => {
                                setIsMedDropdownOpen(false);
                              }}
                              className="text-xs text-blue-600 hover:underline font-semibold"
                            >
                              {language === 'th' ? `ใช้ชื่อยา "${medSearch}" ตามที่พิมพ์` : `Use "${medSearch}" as custom drug name`}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[13px] font-bold text-slate-700 block mb-1">
                    {language === 'th' ? 'ขนาดการใช้ยา' : 'Dosage'}
                  </label>
                  <select
                    value={newMedDosage}
                    onChange={(e) => setNewMedDosage(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 focus:outline-hidden text-slate-700 cursor-pointer"
                  >
                    <option value="">-- {language === 'th' ? 'เลือกขนาดการใช้' : 'Select Dosage'} --</option>
                    <option value={language === 'th' ? '1 เม็ด' : '1 tablet'}>{language === 'th' ? '1 เม็ด' : '1 tablet'}</option>
                    <option value={language === 'th' ? '2 เม็ด' : '2 tablets'}>{language === 'th' ? '2 เม็ด' : '2 tablets'}</option>
                    <option value={language === 'th' ? '1/2 เม็ด' : '1/2 tablet'}>{language === 'th' ? '1/2 เม็ด' : '1/2 tablet'}</option>
                    <option value={language === 'th' ? '1 แคปซูล' : '1 capsule'}>{language === 'th' ? '1 แคปซูล' : '1 capsule'}</option>
                    <option value={language === 'th' ? '2 แคปซูล' : '2 capsules'}>{language === 'th' ? '2 แคปซูล' : '2 capsules'}</option>
                    <option value={language === 'th' ? '10 มล.' : '10 ml'}>{language === 'th' ? '10 มล.' : '10 ml'}</option>
                    <option value={language === 'th' ? '1 ซอง' : '1 sachet'}>{language === 'th' ? '1 ซอง' : '1 sachet'}</option>
                    <option value={language === 'th' ? '2 พ่นสูด' : '2 puffs'}>{language === 'th' ? '2 พ่นสูด' : '2 puffs'}</option>
                    {newMedDosage && ![
                      '1 เม็ด', '1 tablet', '2 เม็ด', '2 tablets', '1/2 เม็ด', '1/2 tablet',
                      '1 แคปซูล', '1 capsule', '2 แคปซูล', '2 capsules', '10 มล.', '10 ml',
                      '1 ซอง', '1 sachet', '2 พ่นสูด', '2 puffs'
                    ].includes(newMedDosage) && (
                      <option value={newMedDosage}>{newMedDosage}</option>
                    )}
                  </select>
                </div>
              </div>

              {/* Dosage Details Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    {language === 'th' ? 'ความถี่' : 'Frequency'}
                  </label>
                  <select
                    value={newMedFreq}
                    onChange={(e) => setNewMedFreq(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-medium cursor-pointer focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 focus:outline-hidden transition-all"
                  >
                    <option value="">-- {language === 'th' ? 'เลือกความถี่' : 'Select Frequency'} --</option>
                    <option value={language === 'th' ? 'วันละ 3 ครั้ง' : '3 times daily'}>{language === 'th' ? 'วันละ 3 ครั้ง' : '3 times daily'}</option>
                    <option value={language === 'th' ? 'ทุก 6 ชั่วโมง' : 'Every 6 hours'}>{language === 'th' ? 'ทุก 6 ชั่วโมง' : 'Every 6 hours'}</option>
                    <option value={language === 'th' ? 'วันละ 1 ครั้ง' : 'Once daily'}>{language === 'th' ? 'วันละ 1 ครั้ง' : 'Once daily'}</option>
                    <option value={language === 'th' ? 'วันละ 2 ครั้ง' : 'Twice daily'}>{language === 'th' ? 'วันละ 2 ครั้ง' : 'Twice daily'}</option>
                    <option value={language === 'th' ? 'วันละ 4 ครั้ง' : '4 times daily'}>{language === 'th' ? 'วันละ 4 ครั้ง' : '4 times daily'}</option>
                    <option value={language === 'th' ? 'ก่อนนอน' : 'At bedtime'}>{language === 'th' ? 'ก่อนนอน' : 'At bedtime'}</option>
                    <option value={language === 'th' ? 'เมื่อมีอาการ' : 'As Needed'}>{language === 'th' ? 'เมื่อมีอาการ' : 'As Needed'}</option>
                    {newMedFreq && ![
                      'วันละ 3 ครั้ง', '3 times daily', 'ทุก 6 ชั่วโมง', 'Every 6 hours',
                      'วันละ 1 ครั้ง', 'Once daily', 'วันละ 2 ครั้ง', 'Twice daily',
                      'วันละ 4 ครั้ง', '4 times daily', 'ก่อนนอน', 'At bedtime', 'เมื่อมีอาการ', 'As Needed'
                    ].includes(newMedFreq) && (
                      <option value={newMedFreq}>{newMedFreq}</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    {language === 'th' ? 'ระยะเวลา' : 'Duration'}
                  </label>
                  <select
                    value={newMedDuration}
                    onChange={(e) => setNewMedDuration(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-medium cursor-pointer focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 focus:outline-hidden transition-all"
                  >
                    <option value="">-- {language === 'th' ? 'เลือกระยะเวลา' : 'Select Duration'} --</option>
                    <option value={language === 'th' ? '3 วัน' : '3 days'}>{language === 'th' ? '3 วัน' : '3 days'}</option>
                    <option value={language === 'th' ? '5 วัน' : '5 days'}>{language === 'th' ? '5 วัน' : '5 days'}</option>
                    <option value={language === 'th' ? '7 วัน' : '7 days'}>{language === 'th' ? '7 วัน' : '7 days'}</option>
                    <option value={language === 'th' ? '10 วัน' : '10 days'}>{language === 'th' ? '10 days' : '10 days'}</option>
                    <option value={language === 'th' ? '14 วัน' : '14 days'}>{language === 'th' ? '14 วัน' : '14 days'}</option>
                    <option value={language === 'th' ? '21 วัน' : '21 days'}>{language === 'th' ? '21 วัน' : '21 days'}</option>
                    <option value={language === 'th' ? '30 วัน' : '30 days'}>{language === 'th' ? '30 วัน' : '30 days'}</option>
                    <option value={language === 'th' ? '60 วัน' : '60 days'}>{language === 'th' ? '60 วัน' : '60 days'}</option>
                    <option value={language === 'th' ? '90 วัน' : '90 days'}>{language === 'th' ? '90 วัน' : '90 days'}</option>
                    {newMedDuration && ![
                      '3 วัน', '3 days', '5 วัน', '5 days', '7 วัน', '7 days',
                      '10 วัน', '10 days', '14 วัน', '14 days', '21 วัน', '21 days',
                      '30 วัน', '30 days', '60 วัน', '60 days', '90 วัน', '90 days'
                    ].includes(newMedDuration) && (
                      <option value={newMedDuration}>{newMedDuration}</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    {language === 'th' ? 'จำนวน' : 'Quantity'}
                  </label>
                  <select
                    value={String(newMedQty)}
                    onChange={(e) => setNewMedQty(e.target.value === '' ? '' : (isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value)) as any)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-medium cursor-pointer font-mono focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 focus:outline-hidden transition-all"
                  >
                    <option value="">-- {language === 'th' ? 'เลือกจำนวน' : 'Select Qty'} --</option>
                    <option value="1">1</option>
                    <option value="5">5</option>
                    <option value="10">10</option>
                    <option value="12">12</option>
                    <option value="14">14</option>
                    <option value="15">15</option>
                    <option value="20">20</option>
                    <option value="21">21</option>
                    <option value="28">28</option>
                    <option value="30">30</option>
                    <option value="60">60</option>
                    <option value="90">90</option>
                    <option value="100">100</option>
                    {newMedQty !== '' && ![
                      '1', '5', '10', '12', '14', '15', '20', '21', '28', '30', '60', '90', '100'
                    ].includes(String(newMedQty)) && (
                      <option value={String(newMedQty)}>{newMedQty}</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    {language === 'th' ? 'ทางให้ยา' : 'Route'}
                  </label>
                  <select
                    value={newMedRoute}
                    onChange={(e) => setNewMedRoute(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-medium cursor-pointer focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 focus:outline-hidden transition-all"
                  >
                    <option value="">-- {language === 'th' ? 'เลือกทางให้ยา' : 'Select Route'} --</option>
                    <option value={language === 'th' ? 'รับประทาน' : 'Oral'}>{language === 'th' ? 'รับประทาน' : 'Oral'}</option>
                    <option value={language === 'th' ? 'ทาภายนอก' : 'Topical'}>{language === 'th' ? 'ทาภายนอก' : 'Topical'}</option>
                    <option value={language === 'th' ? 'พ่นสูด' : 'Inhalation'}>{language === 'th' ? 'พ่นสูด' : 'Inhalation'}</option>
                    <option value={language === 'th' ? 'อมใต้ลิ้น' : 'Sublingual'}>{language === 'th' ? 'อมใต้ลิ้น' : 'Sublingual'}</option>
                    <option value={language === 'th' ? 'หยอดตา' : 'Eye drop'}>{language === 'th' ? 'หยอดตา' : 'Eye drop'}</option>
                    <option value={language === 'th' ? 'หยอดหู' : 'Ear drop'}>{language === 'th' ? 'หยอดหู' : 'Ear drop'}</option>
                    <option value={language === 'th' ? 'ฉีด' : 'Injection'}>{language === 'th' ? 'ฉีด' : 'Injection'}</option>
                    {newMedRoute && ![
                      'รับประทาน', 'Oral', 'ทาภายนอก', 'Topical', 'พ่นสูด', 'Inhalation',
                      'อมใต้ลิ้น', 'Sublingual', 'หยอดตา', 'Eye drop', 'หยอดหู', 'Ear drop', 'ฉีด', 'Injection'
                    ].includes(newMedRoute) && (
                      <option value={newMedRoute}>{newMedRoute}</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    {language === 'th' ? 'เวลารับประทาน' : 'Meal Timing'}
                  </label>
                  <select
                    value={newMedTiming}
                    onChange={(e) => setNewMedTiming(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-medium cursor-pointer focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 focus:outline-hidden transition-all"
                  >
                    <option value="">-- {language === 'th' ? 'เลือกเวลารับประทาน' : 'Select Meal Timing'} --</option>
                    <option value={language === 'th' ? 'หลังอาหาร' : 'After Meal'}>{language === 'th' ? 'หลังอาหาร' : 'After Meal'}</option>
                    <option value={language === 'th' ? 'ก่อนอาหาร' : 'Before Meal'}>{language === 'th' ? 'ก่อนอาหาร' : 'Before Meal'}</option>
                    <option value={language === 'th' ? 'พร้อมอาหาร' : 'With Meal'}>{language === 'th' ? 'พร้อมอาหาร' : 'With Meal'}</option>
                    <option value={language === 'th' ? 'ก่อนนอน' : 'Before Bed'}>{language === 'th' ? 'ก่อนนอน' : 'Before Bed'}</option>
                    <option value={language === 'th' ? 'เมื่อมีอาการ' : 'As Needed'}>{language === 'th' ? 'เมื่อมีอาการ' : 'As Needed'}</option>
                    {newMedTiming && ![
                      'หลังอาหาร', 'After Meal', 'ก่อนอาหาร', 'Before Meal',
                      'พร้อมอาหาร', 'With Meal', 'ก่อนนอน', 'Before Bed', 'เมื่อมีอาการ', 'As Needed'
                    ].includes(newMedTiming) && (
                      <option value={newMedTiming}>{newMedTiming}</option>
                    )}
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={handleAddPrescription}
                    className="w-full py-2 bg-[#2563eb] hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                  >
                    <Plus className="w-4 h-4 shrink-0" />
                    <span>{language === 'th' ? 'เพิ่มรายการสั่งยา' : 'Add to Order'}</span>
                  </button>
                </div>
              </div>

              {/* Special Instructions */}
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  {language === 'th' ? 'คำแนะนำพิเศษ / ฉลากยา (อัตโนมัติตามมาตรฐาน รพ.)' : 'Special Instructions / Label Note'}
                </label>
                <input
                  type="text"
                  value={newMedInstructions}
                  onChange={(e) => setNewMedInstructions(e.target.value)}
                  placeholder={language === 'th' ? 'คำแนะนำพิเศษเพิ่มเติม...' : 'Special instructions for pharmacy label...'}
                  className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 focus:outline-hidden transition-all"
                />
              </div>
            </div>

            {/* Prescribed Medicines List Table */}
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900">
                {language === 'th' ? 'รายการสั่งยาปัจจุบัน' : 'Active Prescriptions List'}
              </h3>

              {prescriptions.length === 0 ? (
                <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs">
                  {language === 'th' ? 'ยังไม่มีรายการสั่งยา เลือกรายการยาด้านบนเพื่อเพิ่ม' : 'No active prescriptions order. Select medicine above to add.'}
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 font-bold text-slate-600 uppercase">
                        <th className="p-3">{language === 'th' ? 'ชื่อยา' : 'Medicine'}</th>
                        <th className="p-3">{language === 'th' ? 'ขนาดและวิธีใช้' : 'Dosage & Frequency'}</th>
                        <th className="p-3">{language === 'th' ? 'ระยะเวลา' : 'Duration'}</th>
                        <th className="p-3">{language === 'th' ? 'จำนวน' : 'Quantity'}</th>
                        <th className="p-3">{language === 'th' ? 'เวลารับประทาน' : 'Timing'}</th>
                        <th className="p-3 text-right">{language === 'th' ? 'การจัดการ' : 'Actions'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {prescriptions.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="p-3 font-bold text-slate-900">{p.medicineName}</td>
                          <td className="p-3 text-slate-700">{p.dosage} • {p.frequency}</td>
                          <td className="p-3 text-slate-600">{p.duration}</td>
                          <td className="p-3 font-mono font-bold text-slate-800">{p.quantity}</td>
                          <td className="p-3">
                            <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium">
                              {p.timing}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => setPrescriptions(prescriptions.filter(x => x.id !== p.id))}
                              className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50 cursor-pointer"
                              title={language === 'th' ? 'ลบรายการยา' : 'Delete prescription'}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: REFERRAL & COUNSELING */}
        {activeTab === 'referral' && (
          <div className="p-6 space-y-6">
            {/* Referral Form */}
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900">
                {language === 'th' ? 'การส่งต่อผู้ป่วยระหว่างแผนกและผู้เชี่ยวชาญ' : 'Inter-Departmental Specialty Referral'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-white p-4 rounded-2xl border border-slate-200">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    {language === 'th' ? 'แผนกที่ส่งต่อ' : 'Referral Department'}
                  </label>
                  <select
                    value={refDept}
                    onChange={(e) => setRefDept(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 focus:outline-hidden transition-all"
                  >
                    <option value="">{language === 'th' ? '-- เลือกแผนกผู้เชี่ยวชาญ --' : '-- Select Specialty --'}</option>
                    <option value="Cardiology">{language === 'th' ? 'แผนกโรคหัวใจ' : 'Cardiology'}</option>
                    <option value="Orthopedics">{language === 'th' ? 'แผนกศัลยกรรมกระดูก' : 'Orthopedics'}</option>
                    <option value="Neurology">{language === 'th' ? 'แผนกประสาทวิทยา' : 'Neurology'}</option>
                    <option value="Otolaryngology (ENT)">{language === 'th' ? 'แผนกหู คอ จมูก' : 'Otolaryngology (ENT)'}</option>
                    <option value="Dermatology">{language === 'th' ? 'แผนกโรคผิวหนัง' : 'Dermatology'}</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    {language === 'th' ? 'เหตุผลในการส่งต่อ' : 'Reason for Referral'}
                  </label>
                  <input
                    type="text"
                    value={refReason}
                    onChange={(e) => setRefReason(e.target.value)}
                    placeholder={language === 'th' ? 'เช่น ประเมินระบบหัวใจอย่างละเอียด' : 'e.g. Further cardiac evaluation'}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 focus:outline-hidden transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Patient Counseling Section */}
            <div className="space-y-3 pt-2">
              <h3 className="text-lg font-bold text-slate-900">
                {language === 'th' ? 'การให้คำปรึกษาและคำแนะนำผู้ป่วย' : 'Patient Counseling & Medical Advice'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    {language === 'th' ? 'คำแนะนำเรื่องการใช้ยาและอาหาร' : 'Medication & Diet Advice'}
                  </label>
                  <textarea
                    rows={2}
                    value={counselMed}
                    onChange={(e) => setCounselMed(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 focus:outline-hidden transition-all"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    {language === 'th' ? 'คำแนะนำการดำเนินชีวิตและการออกกำลังกาย' : 'Lifestyle & Exercise Guidance'}
                  </label>
                  <textarea
                    rows={2}
                    value={counselLifestyle}
                    onChange={(e) => setCounselLifestyle(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 focus:outline-hidden transition-all"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: FOLLOW-UP & VISIT ACTIONS */}
        {activeTab === 'followup' && (
          <div className="p-6 space-y-6">
            {/* Follow-up Scheduler */}
            <div className="space-y-4 bg-white p-5 rounded-2xl border border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <span>{language === 'th' ? 'การนัดหมายติดตามอาการครั้งถัดไป' : 'Schedule Next Follow-Up Visit'}</span>
                </h3>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer bg-white px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 self-start sm:self-auto shadow-2xs">
                  <input
                    type="checkbox"
                    checked={hasFollowUp}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setHasFollowUp(checked);
                      if (checked && !followUpDate) {
                        const nextWeek = new Date();
                        nextWeek.setDate(nextWeek.getDate() + 7);
                        setFollowUpDate(nextWeek.toISOString().split('T')[0]);
                      }
                    }}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span>{language === 'th' ? 'ต้องการนัดหมายติดตามอาการ' : 'Schedule a follow-up appointment'}</span>
                </label>
              </div>

              {!hasFollowUp ? (
                <div className="p-4 bg-white/70 rounded-xl border border-dashed border-slate-200 text-slate-500 text-xs text-center font-medium">
                  {language === 'th' ? 'ไม่มีการนัดหมายติดตามอาการสำหรับเคสนี้ (หากต้องการนัดหมาย ให้ทำเครื่องหมายเลือก "ต้องการนัดหมายติดตามอาการ")' : 'No follow-up appointment scheduled for this visit. Check "Schedule a follow-up appointment" if required.'}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">
                      {language === 'th' ? 'วันนัดติดตามอาการ' : 'Follow-Up Date'}
                    </label>
                    <input
                      type="date"
                      value={followUpDate}
                      onChange={(e) => setFollowUpDate(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 focus:outline-hidden transition-all"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">
                      {language === 'th' ? 'เหตุผลในการนัดหมาย' : 'Reason for Follow-Up'}
                    </label>
                    <input
                      type="text"
                      value={followUpReason}
                      onChange={(e) => setFollowUpReason(e.target.value)}
                      placeholder={language === 'th' ? 'ระบุเหตุผลในการนัดหมาย' : 'Enter reason for follow-up'}
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 focus:outline-hidden transition-all"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">
                      {language === 'th' ? 'คำแนะนำเพิ่มเติมสำหรับผู้ป่วย' : 'Patient Instructions'}
                    </label>
                    <input
                      type="text"
                      value={followUpInstructions}
                      onChange={(e) => setFollowUpInstructions(e.target.value)}
                      placeholder={language === 'th' ? 'คำแนะนำการเตรียมตัว' : 'Patient preparation instructions'}
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 focus:outline-hidden transition-all"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Visit Action Center Buttons */}
            <div className="space-y-3 pt-2">
              <div className="border-b border-slate-100 pb-2">
                <h3 className="text-lg font-bold text-slate-900">
                  {language === 'th' ? 'สรุปการตรวจและเอกสารออกบริการ' : 'Visit Summary & Output Documents'}
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
                <button
                  type="button"
                  onClick={handleCancelVisit}
                  className="p-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
                >
                  <XCircle className="w-4 h-4 text-white" />
                  <span>{language === 'th' ? 'ยกเลิกการตรวจรับบริการ' : 'Cancel Visit Session'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="p-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200/70 text-slate-800 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
                >
                  <Save className="w-4 h-4 text-slate-700" />
                  <span>{language === 'th' ? 'บันทึกฉบับร่าง' : 'Save Draft'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCompleteVisit}
                  className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm hover:shadow transition-all cursor-pointer"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>{language === 'th' ? 'บันทึกและเสร็จสิ้นการตรวจ' : 'Save & Complete Visit'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => alert(language === 'th' ? `ออกใบรับรองแพทย์สำหรับ ${patient.name} (HN: ${patient.hn}) เรียบร้อยแล้ว` : `Medical Certificate generated for ${patient.name} (HN: ${patient.hn})`)}
                  className="p-2.5 bg-white border border-slate-200 hover:border-blue-300 rounded-xl text-xs font-bold text-slate-800 flex items-center justify-center gap-2 shadow-2xs hover:shadow-xs transition-all cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>{language === 'th' ? 'ใบรับรองแพทย์' : 'Medical Certificate'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => alert(language === 'th' ? `กำลังพิมพ์เอกสารสรุปการตรวจ OPD สำหรับ ${patient.name}...` : `Printing Official OPD Visit Summary for ${patient.name}...`)}
                  className="p-2.5 bg-white border border-slate-200 hover:border-blue-300 rounded-xl text-xs font-bold text-slate-800 flex items-center justify-center gap-2 shadow-2xs hover:shadow-xs transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-slate-700" />
                  <span>{language === 'th' ? 'พิมพ์สรุปการตรวจ' : 'Print Visit Summary'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* History Preview Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-[1200] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-base text-slate-900">
                {showHistoryModal === 'visits'
                  ? (language === 'th' ? 'ประวัติการรับบริการย้อนหลัง' : 'Previous Visit Records')
                  : (language === 'th' ? 'รายงานผลการตรวจทางห้องปฏิบัติการ' : 'Uploaded Diagnostic Reports')}
              </h3>
              <button onClick={() => setShowHistoryModal(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <div className="space-y-2 text-xs text-slate-600">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="font-bold block text-slate-800">
                  {language === 'th' ? 'การรับบริการเมื่อ 10 มิ.ย. 2026 (พญ. อนงค์ ส.)' : 'Visit on 2026-06-10 (Dr. Anong S.)'}
                </span>
                <span>{language === 'th' ? 'การวินิจฉัย: โรคติดเชื้อทางเดินหายใจส่วนบนฉับพลัน' : 'Diagnosis: Acute Upper Respiratory Infection'}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="font-bold block text-slate-800">
                  {language === 'th' ? 'การรับบริการเมื่อ 22 มี.ค. 2026 (พญ. อนงค์ ส.)' : 'Visit on 2026-03-22 (Dr. Anong S.)'}
                </span>
                <span>{language === 'th' ? 'การวินิจฉัย: โรคความดันโลหิตสูงตามนัดประจำ' : 'Diagnosis: Essential Hypertension Routine Follow-Up'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Shared Confirmation Modal — ใช้ร่วมกันทั้งปุ่มยกเลิก / บันทึกฉบับร่าง / บันทึกและเสร็จสิ้น */}
      {confirmDialog && (
        <div
          className="fixed inset-0 z-[1200] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setConfirmDialog(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl border border-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ring-8 shadow-inner ${
                confirmDialog.tone === 'danger'
                  ? 'bg-red-100 text-red-600 ring-red-50'
                  : 'bg-blue-100 text-blue-600 ring-blue-50'
              }`}
            >
              {confirmDialog.tone === 'danger' ? (
                <AlertTriangle className="w-9 h-9 stroke-[2.5]" />
              ) : (
                <Save className="w-9 h-9 stroke-[2.5]" />
              )}
            </div>

            <div className="space-y-1.5">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                {confirmDialog.title}
              </h3>
              <p className="text-sm font-medium text-slate-600 leading-relaxed px-2">
                {confirmDialog.message}
              </p>
            </div>

            {confirmDialog.hint && (
              <div
                className={`rounded-xl px-3 py-2 flex items-start gap-2 text-left border ${
                  confirmDialog.tone === 'danger'
                    ? 'bg-red-50/70 border-red-100'
                    : 'bg-blue-50/70 border-blue-100'
                }`}
              >
                <Info
                  className={`w-4 h-4 shrink-0 mt-0.5 ${
                    confirmDialog.tone === 'danger' ? 'text-red-500' : 'text-blue-500'
                  }`}
                />
                <span
                  className={`text-[12px] leading-relaxed whitespace-pre-line ${
                    confirmDialog.tone === 'danger' ? 'text-red-800' : 'text-blue-800'
                  }`}
                >
                  {confirmDialog.hint}
                </span>
              </div>
            )}

            <div className="pt-1 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="w-full py-3 px-4 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-sm font-bold transition-all cursor-pointer"
              >
                {language === 'th' ? 'กลับไปทำต่อ' : 'Keep Working'}
              </button>
              <button
                type="button"
                onClick={() => {
                  const run = confirmDialog.onConfirm;
                  setConfirmDialog(null);
                  run();
                }}
                className={`w-full py-3 px-4 text-white rounded-xl text-sm font-bold shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap ${
                  confirmDialog.tone === 'danger'
                    ? 'bg-red-600 hover:bg-red-700 shadow-red-600/20'
                    : 'bg-[#2563eb] hover:bg-blue-700 shadow-blue-600/20'
                }`}
              >
                {confirmDialog.tone === 'danger' ? (
                  <XCircle className="w-4 h-4 shrink-0 stroke-[2.5]" />
                ) : (
                  <Check className="w-4 h-4 shrink-0 stroke-[3]" />
                )}
                <span>{confirmDialog.confirmLabel}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Feedback Modal */}
      {successNotice && successNotice.isOpen && (
        <div className="fixed inset-0 z-[1200] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl border border-slate-100 transform transition-all scale-100">
            {/* Green Checkmark Icon Container */}
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto ring-8 ring-emerald-50 shadow-inner">
              <CheckCircle className="w-10 h-10 stroke-[2.5]" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                {successNotice.title}
              </h3>
              <p className="text-sm font-medium text-slate-600 leading-relaxed px-2">
                {successNotice.message}
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  const callback = successNotice.onConfirm;
                  setSuccessNotice(null);
                  if (callback) callback();
                }}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>{language === 'th' ? 'ตกลง' : 'OK'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
