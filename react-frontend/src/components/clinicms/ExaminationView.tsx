import React, { useState, useEffect } from 'react';
import { Patient, QueueStatus, PrescriptionItem, LabOrderItem, ImagingOrderItem, DiagnosisItem } from '../../types';
import { CopyableText } from './CopyableText';
import { useLanguage } from '../../context/LanguageContext';
import { translateClinicalText } from '../../utils/clinicalTranslation';
import { generateVN } from '../../utils/vnGenerator';
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
  UserCheck,
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
  { code: 'L23.9', name: 'Allergic contact dermatitis, unspecified', localName: 'ผื่นผิวหนังอักเสบจากการสัมผัสสารก่อภูมิแพ้' },
  { code: 'R50.9', name: 'Fever, unspecified', localName: 'ไข้ ไม่ระบุสาเหตุ' },
  { code: 'K21.9', name: 'Gastro-esophageal reflux disease without esophagitis', localName: 'โรคกรดไหลย้อน (GERD)' },
  { code: 'E78.5', name: 'Hyperlipidemia, unspecified', localName: 'ภาวะไขมันในเลือดสูง' },
  { code: 'J20.9', name: 'Acute bronchitis, unspecified', localName: 'หลอดลมอักเสบเฉียบพลัน' },
  { code: 'A09.9', name: 'Gastroenteritis and colitis of unspecified origin', localName: 'ลำไส้อักเสบ / ท้องเสียเฉียบพลัน' },
  { code: 'M79.1', name: 'Myalgia', localName: 'อาการปวดกล้ามเนื้อ' },
  { code: 'H10.9', name: 'Conjunctivitis, unspecified', localName: 'เยื่อบุตาอักเสบ (ตาแดง)' },
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

  // Additional Notes
  const [nurseNotes, setNurseNotes] = useState(patient.nurseNotes || '');
  const [importantInfoForDoctor, setImportantInfoForDoctor] = useState(patient.importantInfoForDoctor || '');
  const [attachments, setAttachments] = useState<any[]>(patient.attachments || [
    { id: 'att-1', fileName: 'Referral_Document_2026.pdf', fileType: 'pdf', category: 'Referral Document', uploadDate: '2026-07-23 08:50', fileSize: '1.2 MB' },
    { id: 'att-2', fileName: 'Clinical_Photo_2026.jpg', fileType: 'image', category: 'Clinical Photo', uploadDate: '2026-07-23 08:52', fileSize: '2.8 MB' }
  ]);

  // Nursing Physical Assessment State
  const [nurseGenAppearance, setNurseGenAppearance] = useState(patient.nursingAssessment?.generalAppearance || 'Good consciousness, non-toxic appearance');
  const [nurseConsciousness, setNurseConsciousness] = useState(patient.nursingAssessment?.consciousness || 'Alert (E4V5M6)');
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
  const [painScore, setPainScore] = useState(patient.vitals?.painScore || 0);
  const [bloodSugar, setBloodSugar] = useState(patient.vitals?.bloodSugar || 100);

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

  const filteredMedicines = React.useMemo(() => {
    if (!medSearch.trim()) {
      return MEDICINE_DATABASE;
    }
    const q = medSearch.trim().toLowerCase();
    return MEDICINE_DATABASE.filter(m =>
      m.name.toLowerCase().includes(q) || m.category.toLowerCase().includes(q)
    );
  }, [medSearch]);

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
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [showAutoSaveToast, setShowAutoSaveToast] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState<string | null>(null);

  // Success Feedback Modal State
  const [successNotice, setSuccessNotice] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm?: () => void;
  } | null>(null);

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
        painScore: Number(painScore),
        bloodSugar: Number(bloodSugar)
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
      primaryDiagnosis: primaryDiag,
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

  // Save Draft
  const handleSaveDraft = () => {
    const activeDiags = [...(primaryDiag ? [primaryDiag] : []), ...secondaryDiags];
    saveToRecentDiagnoses(activeDiags);
    const updated = buildUpdatedPatient('Examining');
    onSavePatient(updated);
    setShowAutoSaveToast(true);
    setTimeout(() => setShowAutoSaveToast(false), 3000);
  };

  // Complete Visit Validation & Execution
  const handleCompleteVisit = () => {
    const warnings: string[] = [];

    // Required Screening Validation Checks
    if (!chiefComplaint.trim()) {
      warnings.push(language === 'th' ? 'กรุณาระบุอาการสำคัญ (Chief Complaint)' : 'Required Field Missing: Chief Complaint (CC) is required.');
    }
    if (!bp.trim() || pulse <= 0 || temp <= 0) {
      warnings.push(language === 'th' ? 'กรุณาบันทึกสัญญาณชีพให้ครบถ้วน (ความดัน, ชีพจร, อุณหภูมิ)' : 'Required Field Missing: Complete Vital Signs (BP, Pulse, Body Temp) are required.');
    }

    if (!primaryDiag || !primaryDiag.code) {
      warnings.push(language === 'th' ? 'กรุณาระบุการวินิจฉัยโรคหลัก (ICD-10) อย่างน้อย 1 รายการ' : 'Required Field Missing: Require at least one Primary Diagnosis (ICD-10) before completing the visit.');
    }
    if (allergyAlert) {
      warnings.push(allergyAlert);
    }

    if (warnings.length > 0) {
      setValidationWarnings(warnings);
    } else {
      setValidationWarnings([]);
      const activeDiags = [...(primaryDiag ? [primaryDiag] : []), ...secondaryDiags];
      saveToRecentDiagnoses(activeDiags);
      const updated = buildUpdatedPatient('Completed');
      onSavePatient(updated);
      const rxNotice = prescriptions.length > 0 
        ? (language === 'th' ? `
(ระบบส่งรายการสั่งยา ${prescriptions.length} รายการไปยังห้องยาโดยอัตโนมัติ)` : `\n(${prescriptions.length} prescription item(s) automatically synced to pharmacy queue)`)
        : '';
      setSuccessNotice({
        isOpen: true,
        title: language === 'th' ? 'บันทึกสำเร็จ!' : 'Success!',
        message: language === 'th'
          ? `บันทึกและเสร็จสิ้นการตรวจเรียบร้อยแล้วสำหรับผู้ป่วย ${patient.name} (HN: ${patient.hn}, VN: ${patient.vn || generateVN(patient.visitDate, patient.visitTime, 1)})${rxNotice}`
          : `Examination completed successfully for patient ${patient.name} (HN: ${patient.hn}, VN: ${patient.vn || generateVN(patient.visitDate, patient.visitTime, 1)})${rxNotice}`,
        onConfirm: () => {
          onBackToQueue();
        }
      });
    }
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
    const found = MEDICINE_DATABASE.find(
      m => m.name.toLowerCase() === nameVal.trim().toLowerCase()
    );
    if (found) {
      const isTh = language === 'th';
      if (found.defaultDosage) {
        setNewMedDosage(typeof found.defaultDosage === 'object' ? (isTh ? found.defaultDosage.th : found.defaultDosage.en) : found.defaultDosage);
      } else {
        setNewMedDosage('');
      }
      if (found.defaultFreq) {
        setNewMedFreq(typeof found.defaultFreq === 'object' ? (isTh ? found.defaultFreq.th : found.defaultFreq.en) : found.defaultFreq);
      } else {
        setNewMedFreq('');
      }
      if (found.defaultDuration) {
        setNewMedDuration(typeof found.defaultDuration === 'object' ? (isTh ? found.defaultDuration.th : found.defaultDuration.en) : found.defaultDuration);
      } else {
        setNewMedDuration('');
      }
      if (found.defaultQty !== undefined) {
        setNewMedQty(found.defaultQty);
      } else {
        setNewMedQty('');
      }
      if (found.defaultRoute) {
        setNewMedRoute(typeof found.defaultRoute === 'object' ? (isTh ? found.defaultRoute.th : found.defaultRoute.en) : found.defaultRoute);
      } else {
        setNewMedRoute('');
      }
      if (found.defaultTiming) {
        setNewMedTiming(typeof found.defaultTiming === 'object' ? (isTh ? found.defaultTiming.th : found.defaultTiming.en) : found.defaultTiming);
      } else {
        setNewMedTiming('');
      }
      if (found.defaultInstructions) {
        setNewMedInstructions(typeof found.defaultInstructions === 'object' ? (isTh ? found.defaultInstructions.th : found.defaultInstructions.en) : found.defaultInstructions);
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
    <div className="doctor-exam-layout pb-16">
      {/* TOP ACTIONS HEADER BAR */}
      <div className="doctor-exam-header-bar">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToQueue}
            className="doctor-btn-secondary"
          >
            <ArrowLeft className="w-4.5 h-4.5" />
            <span>{language === 'th' ? 'กลับสู่หน้าคิวผู้ป่วย' : 'Back to Queue'}</span>
          </button>

          <div className="h-6 w-px bg-slate-200 mx-1" />

          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shrink-0 shadow-2xs">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">
                {language === 'th' ? 'บันทึกการตรวจผู้ป่วย OPD' : 'OPD Medical Examination'}
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                {language === 'th' ? 'การบันทึกเวชระเบียนผู้ป่วยนอก' : 'Outpatient Electronic Medical Record'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveDraft}
            className="doctor-btn-secondary"
          >
            <Save className="w-4.5 h-4.5 text-slate-600" />
            <span>{language === 'th' ? 'บันทึกฉบับร่าง' : 'Save Draft'}</span>
          </button>

          <button
            onClick={handleCompleteVisit}
            className="doctor-btn-primary"
          >
            <CheckCircle className="w-4.5 h-4.5" />
            <span>{t('saveExam')}</span>
          </button>
        </div>
      </div>

      {/* Auto-save notification */}
      {showAutoSaveToast && (
        <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 p-3 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>Draft examination record auto-saved successfully!</span>
        </div>
      )}

      {/* Drug Allergy Critical Alert Banner */}
      {allergyAlert && (
        <div className="bg-red-50 text-red-900 border border-red-300 p-4 rounded-xl flex items-start gap-3 shadow-xs animate-bounce">
          <ShieldAlert className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <h4 className="font-bold text-sm text-red-900">Drug Allergy Safety Warning!</h4>
            <p className="text-xs text-red-800 font-medium">{allergyAlert}</p>
          </div>
        </div>
      )}

      {/* PATIENT INFORMATION CARD */}
      <div className="doctor-exam-card">
        <div className="doctor-patient-header">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xl shrink-0 shadow-xs">
              {patient.name.charAt(0)}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">{patient.name}</h2>
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold px-3.5 py-1.5 rounded-full flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  {language === 'th' ? `คิว #${patient.queueNo}` : `Queue #${patient.queueNo}`}
                </span>
                <CopyableText label="HN" value={patient.hn} className="bg-blue-50 text-blue-700 border border-blue-200 text-xs font-mono font-bold px-3.5 py-1.5 rounded-full" />
                <CopyableText label="VN" value={patient.vn || generateVN(patient.visitDate, patient.visitTime, 1)} className="bg-purple-50 text-purple-700 border border-purple-200 text-xs font-mono font-bold px-3.5 py-1.5 rounded-full" />
                <CopyableText label={language === 'th' ? 'เลขบัตร' : 'ID'} value={nationalId} className="bg-amber-50 text-amber-800 border border-amber-200 text-xs font-mono font-bold px-3.5 py-1.5 rounded-full" />
                <span className="bg-sky-50 text-sky-800 border border-sky-200 text-xs font-bold px-3.5 py-1.5 rounded-full">
                  {language === 'th'
                    ? status === 'Waiting' ? 'รอตรวจ'
                      : status === 'Examining' ? 'กำลังตรวจ'
                      : status === 'Completed' ? 'ตรวจเสร็จแล้ว'
                      : status
                    : status}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-semibold">
                {language === 'th'
                  ? 'ประวัติข้อมูลส่วนตัวผู้ป่วย • ระบบเวชระเบียนผู้ป่วยนอก (OPD EMR)'
                  : "Patient's Profile • OPD Electronic Medical Record"}
              </p>
            </div>
          </div>
        </div>

        <div className="doctor-demographics-card">
          <div className="flex items-center gap-2.5 pb-2 text-base font-extrabold text-slate-900">
            <div className="p-2 rounded-xl bg-blue-100 text-blue-700">
              <User className="w-5 h-5" />
            </div>
            <span>{language === 'th' ? 'ข้อมูลพื้นฐาน' : 'Demographics'}</span>
          </div>

          <div className="doctor-demographics-grid">
            <div className="doctor-info-box">
              <span className="doctor-info-label">{language === 'th' ? 'ชื่อ - นามสกุล :' : 'Full Name :'}</span>
              <span className="doctor-info-val">{patient.name}</span>
            </div>

            <div className="doctor-info-box">
              <span className="doctor-info-label">{language === 'th' ? 'อายุ :' : 'Age :'}</span>
              <span className="doctor-info-val">{patient.age} {language === 'th' ? 'ปี' : 'yrs'}</span>
            </div>

            <div className="doctor-info-box">
              <span className="doctor-info-label">{language === 'th' ? 'เพศ :' : 'Gender :'}</span>
              <span className="doctor-info-val">
                {patient.gender === 'Male' ? (language === 'th' ? 'ชาย' : 'Male') : (language === 'th' ? 'หญิง' : 'Female')}
              </span>
            </div>

            <div className="doctor-info-box">
              <span className="doctor-info-label">{language === 'th' ? 'หมู่โลหิต :' : 'Blood Group :'}</span>
              <div>
                <span className="inline-block bg-rose-50 text-rose-600 border border-rose-200/80 px-2.5 py-1 rounded-lg font-bold text-xs mt-0.5">
                  {patient.bloodGroup || (language === 'th' ? 'หมู่ O (O Positive)' : 'O Positive (O+)')}
                </span>
              </div>
            </div>

            <div className="doctor-info-box">
              <span className="doctor-info-label">{language === 'th' ? 'วันเกิด :' : 'Date of Birth :'}</span>
              <span className="doctor-info-val">{patient.dob || '1984-03-15'}</span>
            </div>

            <div className="doctor-info-box">
              <span className="doctor-info-label">{language === 'th' ? 'เลขบัตรประชาชน :' : 'National ID :'}</span>
              <CopyableText value={nationalId} />
            </div>

            <div className="doctor-info-box lg:col-span-2">
              <span className="doctor-info-label">{language === 'th' ? 'สิทธิการรักษา :' : 'Insurance Scheme :'}</span>
              <div>
                <span className="inline-block bg-amber-50 text-amber-900 border border-amber-200/80 px-3 py-1 rounded-lg font-bold text-xs mt-0.5">
                  {patient.insuranceType || (language === 'th' ? 'Universal Health Coverage (UC)' : 'Universal Health Coverage (UC)')}
                </span>
              </div>
            </div>

            <div className="doctor-info-box">
              <span className="doctor-info-label">{language === 'th' ? 'วันที่รับบริการ :' : 'Visit Date :'}</span>
              <span className="doctor-info-val">{patient.visitDate || '2026-07-23'}</span>
            </div>

            <div className="doctor-info-box">
              <span className="doctor-info-label">{language === 'th' ? 'เวลา :' : 'Visit Time :'}</span>
              <span className="doctor-info-val">{patient.visitTime || (language === 'th' ? '08:45 AM' : '08:45 AM')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN UNIFIED TABS CARD */}
      <div className="doctor-main-tabs-card">
        <div className="doctor-tabs-container">
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
              className={`doctor-tab-item ${isActive ? 'active' : ''}`}
            >
              <Icon className={`w-4.5 h-4.5 shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* MAIN TABS CONTENT */}
      {activeTab === 'notes' && (
        <div className="doctor-tab-panel">
          {/* Chief Complaint */}
          <div className="doctor-field-group">
            <label className="doctor-field-label">
              {language === 'th' ? 'อาการสำคัญ' : 'Chief Complaint (CC)'}
            </label>
            <div className="doctor-field-box">
              {translateClinicalText(chiefComplaint, language) || <span className="text-slate-400 font-normal">- ไม่พบข้อมูลอาการสำคัญจากจุดคัดกรอง -</span>}
            </div>
          </div>

          {/* Present Illness */}
          <div className="doctor-field-group">
            <label className="doctor-field-label">
              {language === 'th' ? 'ประวัติการเจ็บป่วยปัจจุบัน' : 'Present Illness (PI)'}
            </label>
            <div className="doctor-field-box">
              {presentIllness ? (
                <p className="whitespace-pre-wrap">{translateClinicalText(presentIllness, language)}</p>
              ) : (
                <span className="text-slate-400 font-normal">- ไม่พบข้อมูลประวัติการเจ็บป่วยปัจจุบันจากจุดคัดกรอง -</span>
              )}
            </div>
          </div>

          {/* Triage Assessment */}
          <div className="doctor-field-group">
            <label className="doctor-field-label flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-purple-600" />
              <span>{language === 'th' ? 'การประเมินคัดกรองผู้ป่วย' : 'Triage Assessment'}</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="doctor-vital-label block mb-1">{language === 'th' ? 'ระดับความรุนแรง' : 'Triage Level'}</span>
                <div className="w-full h-11 px-4 bg-purple-50 border border-purple-200 rounded-xl font-bold text-purple-900 text-sm flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-600 shrink-0"></span>
                  <span>{triageLevel || patient.triage?.level || (language === 'th' ? 'Level 4: Less Urgent' : 'Level 4: Less Urgent')}</span>
                </div>
              </div>

              <div>
                <span className="doctor-vital-label block mb-1">{language === 'th' ? 'ระดับความสำคัญ' : 'Priority Level'}</span>
                <div className="w-full h-11 px-4 bg-amber-50 border border-amber-200 rounded-xl font-bold text-amber-900 text-sm flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-600 shrink-0"></span>
                  <span>{priorityLevel || patient.triage?.priority || (language === 'th' ? 'Medium' : 'Medium Priority')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Vital Signs Grid */}
          <div className="doctor-field-group">
            <label className="doctor-field-label flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              <span>{language === 'th' ? 'สัญญาณชีพ' : 'Vital Signs'}</span>
            </label>

            <div className="doctor-vitals-grid">
              <div className="doctor-vital-item">
                <span className="doctor-vital-label">{language === 'th' ? 'ความดันโลหิต' : 'BP'}</span>
                <span className="doctor-vital-value">{bp || '120/80'}</span>
              </div>

              <div className="doctor-vital-item">
                <span className="doctor-vital-label">{language === 'th' ? 'ชีพจร' : 'HR / Pulse'}</span>
                <span className="doctor-vital-value">{pulse || 78} {language === 'th' ? 'ครั้ง/นาที' : 'bpm'}</span>
              </div>

              <div className="doctor-vital-item">
                <span className="doctor-vital-label">{language === 'th' ? 'อุณหภูมิ' : 'Temp'}</span>
                <span className="doctor-vital-value">{temp ? `${temp}Â°C` : '38.2Â°C'}</span>
              </div>

              <div className="doctor-vital-item">
                <span className="doctor-vital-label">{language === 'th' ? 'น้ำหนัก' : 'Weight'}</span>
                <span className="doctor-vital-value">{weight || 70} {language === 'th' ? 'กก.' : 'kg'}</span>
              </div>

              <div className="doctor-vital-item">
                <span className="doctor-vital-label">{language === 'th' ? 'ส่วนสูง' : 'Height'}</span>
                <span className="doctor-vital-value">{height || 175} {language === 'th' ? 'ซม.' : 'cm'}</span>
              </div>

              <div className="doctor-vital-item">
                <span className="doctor-vital-label">BMI</span>
                <span className="doctor-vital-value">{bmi > 0 ? `${bmi} kg/mÂ²` : '22.9 kg/mÂ²'}</span>
              </div>

              <div className="doctor-vital-item">
                <span className="doctor-vital-label">{language === 'th' ? 'ระดับออกซิเจนในเลือด' : 'SpO₂'}</span>
                <span className="doctor-vital-value">{spo2 || 98}%</span>
              </div>

              <div className="doctor-vital-item">
                <span className="doctor-vital-label">{language === 'th' ? 'อัตราการหายใจ' : 'RR'}</span>
                <span className="doctor-vital-value">{respiratoryRate || 18} {language === 'th' ? 'ครั้ง/นาที' : 'bpm'}</span>
              </div>

              <div className="doctor-vital-item">
                <span className="doctor-vital-label">{language === 'th' ? 'ระดับความเจ็บปวด' : 'Pain Score'}</span>
                <span className="doctor-vital-value">{painScore || 4}/10</span>
              </div>

              <div className="doctor-vital-item">
                <span className="doctor-vital-label">{language === 'th' ? 'ระดับน้ำตาลในเลือด' : 'Blood Sugar'}</span>
                <span className="doctor-vital-value">{bloodSugar || 105} mg/dL</span>
              </div>
            </div>
          </div>

          {/* MEDICAL HISTORY, ALLERGIES & SOCIAL HABITS */}
          <div className="doctor-field-group">
            <label className="doctor-field-label flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-slate-700" />
              <span>{language === 'th' ? 'ประวัติทางการแพทย์ แพ้ยา และพฤติกรรมสุขภาพ' : 'Medical History, Allergies & Social Habits'}</span>
            </label>

            <div className="doctor-history-list">
              {/* Drug Allergy */}
              <div className={`doctor-history-row ${!noDrugAllergy && drugAllergiesText ? 'alert-red' : ''}`}>
                <div>
                  <span className="doctor-vital-label block mb-0.5">{language === 'th' ? 'ประวัติแพ้ยา' : 'Drug Allergies'}</span>
                  {!noDrugAllergy && drugAllergiesText ? (
                    <span className="doctor-history-title">{drugAllergiesText}</span>
                  ) : (
                    <span className="doctor-history-desc text-slate-400">--</span>
                  )}
                </div>
                <div>
                  {!noDrugAllergy && drugAllergiesText ? (
                    <span className="doctor-history-desc text-rose-800">
                      {language === 'th' 
                        ? (drugAllergySymptoms === 'Rashes, Hives' ? 'ผื่นคัน, ลมพิษ (Rashes, Hives)' : drugAllergySymptoms)
                        : (drugAllergySymptoms === 'ผื่นคัน, ลมพิษ (Rashes, Hives)' ? 'Rashes, Hives' : drugAllergySymptoms)}
                    </span>
                  ) : (
                    <span className="doctor-history-desc text-slate-400">--</span>
                  )}
                </div>
              </div>

              {/* Food Allergy */}
              <div className="doctor-history-row">
                <div>
                  <span className="doctor-vital-label block mb-0.5">{language === 'th' ? 'ประวัติแพ้อาหาร' : 'Food Allergies'}</span>
                  {!noFoodAllergy && foodAllergiesText ? (
                    <span className="doctor-history-title">{foodAllergiesText}</span>
                  ) : (
                    <span className="doctor-history-desc text-slate-400">--</span>
                  )}
                </div>
                <div>
                  {!noFoodAllergy && foodAllergiesText && foodAllergySymptoms ? (
                    <span className="doctor-history-desc">{foodAllergySymptoms}</span>
                  ) : (
                    <span className="doctor-history-desc text-slate-400">--</span>
                  )}
                </div>
              </div>

              {/* Chronic / Underlying Diseases */}
              <div className="doctor-history-row">
                <div>
                  <span className="doctor-vital-label block mb-0.5">{language === 'th' ? 'โรคประจำตัว' : 'Underlying Diseases'}</span>
                  {!noChronicDisease && chronicDiseasesText ? (
                    <span className="doctor-history-title">{chronicDiseasesText}</span>
                  ) : (
                    <span className="doctor-history-desc text-slate-400">--</span>
                  )}
                </div>
                <div>
                  {!noChronicDisease && chronicDiseasesText ? (
                    <span className="doctor-history-desc">{language === 'th' ? 'ติดตามอาการต่อเนื่อง' : 'Regular Follow-up'}</span>
                  ) : (
                    <span className="doctor-history-desc text-slate-400">--</span>
                  )}
                </div>
              </div>

              {/* Current Medications */}
              <div className="doctor-history-row">
                <div>
                  <span className="doctor-vital-label block mb-0.5">{language === 'th' ? 'ยาที่รับประทานประจำ' : 'Current Medications'}</span>
                  {currentMedicationsText ? (
                    <span className="doctor-history-title">{currentMedicationsText}</span>
                  ) : (
                    <span className="doctor-history-desc text-slate-400">--</span>
                  )}
                </div>
                <div>
                  {currentMedicationsText ? (
                    <span className="doctor-history-desc">{language === 'th' ? 'ทานตามแพทย์สั่ง' : 'Take as prescribed'}</span>
                  ) : (
                    <span className="doctor-history-desc text-slate-400">--</span>
                  )}
                </div>
              </div>

              {/* Smoking History */}
              <div className="doctor-history-row">
                <div>
                  <span className="doctor-vital-label block mb-0.5">{language === 'th' ? 'ประวัติการสูบบุหรี่' : 'Smoking History'}</span>
                  {patient.smokingHistory?.status && (patient.smokingHistory.status.includes('Smoker') || patient.smokingHistory.status.includes('สูบ')) && !patient.smokingHistory.status.includes('ไม่') && !patient.smokingHistory.status.includes('Non') && !patient.smokingHistory.status.includes('ปฏิเสธ') ? (
                    <span className="doctor-history-title">{language === 'th' ? 'สูบบุหรี่' : 'Smoker'}</span>
                  ) : (
                    <span className="doctor-history-desc text-slate-400">--</span>
                  )}
                </div>
                <div>
                  {patient.smokingHistory?.status && (patient.smokingHistory.status.includes('Smoker') || patient.smokingHistory.status.includes('สูบ')) && !patient.smokingHistory.status.includes('ไม่') && !patient.smokingHistory.status.includes('Non') && !patient.smokingHistory.status.includes('ปฏิเสธ') ? (
                    <span className="doctor-history-desc">
                      {patient.smokingHistory?.frequency && patient.smokingHistory?.duration 
                        ? `${patient.smokingHistory.frequency}, ${patient.smokingHistory.duration}`
                        : patient.smokingHistory?.frequency || patient.smokingHistory?.duration || (language === 'th' ? '10 มวน/วัน (10 cigarettes/day), 5 ปี (5 years)' : '10 cigarettes/day, 5 years')}
                    </span>
                  ) : (
                    <span className="doctor-history-desc text-slate-400">--</span>
                  )}
                </div>
              </div>

              {/* Alcohol Drinking History */}
              <div className="doctor-history-row">
                <div>
                  <span className="doctor-vital-label block mb-0.5">{language === 'th' ? 'ประวัติการดื่มแอลกอฮอล์' : 'Alcohol Drinking'}</span>
                  {patient.alcoholHistory?.status && (patient.alcoholHistory.status.includes('Drinker') || patient.alcoholHistory.status.includes('ดื่ม')) && !patient.alcoholHistory.status.includes('ไม่') && !patient.alcoholHistory.status.includes('Non') && !patient.alcoholHistory.status.includes('ปฏิเสธ') ? (
                    <span className="doctor-history-title">{language === 'th' ? 'ดื่มแอลกอฮอล์' : 'Drinker'}</span>
                  ) : (
                    <span className="doctor-history-desc text-slate-400">--</span>
                  )}
                </div>
                <div>
                  {patient.alcoholHistory?.status && (patient.alcoholHistory.status.includes('Drinker') || patient.alcoholHistory.status.includes('ดื่ม')) && !patient.alcoholHistory.status.includes('ไม่') && !patient.alcoholHistory.status.includes('Non') && !patient.alcoholHistory.status.includes('ปฏิเสธ') ? (
                    <span className="doctor-history-desc">
                      {patient.alcoholHistory?.frequency && patient.alcoholHistory?.duration 
                        ? `${patient.alcoholHistory.frequency}, ${patient.alcoholHistory.duration}`
                        : patient.alcoholHistory?.frequency || patient.alcoholHistory?.duration || (language === 'th' ? '2-3 ครั้ง/สัปดาห์ (2-3 times/week), 8 ปี (8 years)' : '2-3 times/week, 8 years')}
                    </span>
                  ) : (
                    <span className="doctor-history-desc text-slate-400">--</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* TRIAGE NOTES & IMPORTANT ALERTS FOR DOCTOR */}
          <div className="doctor-field-group">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Initial Assessment Triage Notes */}
              <div className="doctor-field-group">
                <label className="doctor-vital-label flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  <span>{language === 'th' ? 'บันทึกการคัดกรองเบื้องต้น' : 'Initial Assessment Notes'}</span>
                </label>
                <div className="doctor-field-box">
                  {triageNotes || patient.triage?.notes || (language === 'th' ? 'คัดกรอง ณ จุดคัดกรอง ผู้ป่วยรู้สึกตัวดี สัญญาณชีพคงที่' : 'Screened at Triage Desk. Patient is conscious and stable.')}
                </div>
              </div>

              {/* Important Alerts for Doctor Display */}
              <div className="doctor-field-group">
                <label className="doctor-vital-label flex items-center gap-1.5 text-amber-900">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span>{language === 'th' ? 'ข้อมูลสำคัญแจ้งแพทย์' : 'Important Alerts for Doctor'}</span>
                </label>
                <div className="doctor-field-box" style={{ background: '#FFFBEB', borderColor: '#FDE68A' }}>
                  {importantInfoForDoctor ? (
                    <p className="whitespace-pre-wrap text-amber-900">{importantInfoForDoctor}</p>
                  ) : (
                    <span className="text-amber-800/80">
                      {language === 'th' ? '- ไม่มีข้อความสำคัญหรือข้อควรระวังแจ้งแพทย์ -' : '- No critical alerts for doctor -'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          </div>
        )}

        {/* TAB 2: DIAGNOSIS & ASSESSMENT */}
        {activeTab === 'diagnosis' && (
          <div className="doctor-tab-panel">
            
            {/* PHYSICAL EXAMINATION SYSTEM FINDINGS */}
            <div className="doctor-field-group">
              <h3 className="text-xl font-extrabold text-slate-900 block mb-4">
                {language === 'th' ? 'ผลการตรวจร่างกายตามระบบ' : 'Physical Examination System Findings'}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="text-base font-bold text-slate-900 block mb-2.5">
                    {language === 'th' ? 'สภาพทั่วไป' : 'General Appearance'}
                  </label>
                  <textarea
                    rows={3}
                    value={generalAppearance}
                    onChange={(e) => setGeneralAppearance(e.target.value)}
                    placeholder={
                      language === 'th'
                        ? 'รู้สึกตัวดี มีอาการไม่สบายตัวเล็กน้อยจากเจ็บคอ...'
                        : 'Good consciousness, non-toxic appearance...'
                    }
                    className="w-full pl-8 pr-5 py-5 bg-slate-50 border border-slate-200 rounded-xl text-base font-medium text-slate-800 placeholder:text-slate-500 placeholder:font-normal focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden transition-all resize-y leading-relaxed min-h-[120px]"
                  />
                </div>

                <div>
                  <label className="text-base font-bold text-slate-900 block mb-2.5">
                    {language === 'th' ? 'ตาหูคอจมูก (HEENT)' : 'HEENT'}
                  </label>
                  <textarea
                    rows={3}
                    value={heent}
                    onChange={(e) => setHeent(e.target.value)}
                    placeholder={
                      language === 'th'
                        ? 'ผนังคอหอยแดงมากและมีคราบหนองบริเวณต่อมทอนซิล คลำพบต่อมน้ำเหลืองบริเวณลำคอโต...'
                        : 'Pharynx erythematous with tonsillar exudates, cervical lymph nodes palpable...'
                    }
                    className="w-full pl-8 pr-5 py-5 bg-slate-50 border border-slate-200 rounded-xl text-base font-medium text-slate-800 placeholder:text-slate-500 placeholder:font-normal focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden transition-all resize-y leading-relaxed min-h-[120px]"
                  />
                </div>

                <div>
                  <label className="text-base font-bold text-slate-900 block mb-2.5">
                    {language === 'th' ? 'ระบบหัวใจและหลอดเลือด' : 'Cardiovascular'}
                  </label>
                  <textarea
                    rows={3}
                    value={cardiovascular}
                    onChange={(e) => setCardiovascular(e.target.value)}
                    placeholder={
                      language === 'th'
                        ? 'เสียงหัวใจ S1, S2 ปกติ ไม่พบเสียงฟู่ (Murmur)...'
                        : 'Normal S1, S2, no murmur...'
                    }
                    className="w-full pl-8 pr-5 py-5 bg-slate-50 border border-slate-200 rounded-xl text-base font-medium text-slate-800 placeholder:text-slate-500 placeholder:font-normal focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden transition-all resize-y leading-relaxed min-h-[120px]"
                  />
                </div>

                <div>
                  <label className="text-base font-bold text-slate-900 block mb-2.5">
                    {language === 'th' ? 'ระบบทางเดินหายใจและปอด' : 'Respiratory'}
                  </label>
                  <textarea
                    rows={3}
                    value={respiratory}
                    onChange={(e) => setRespiratory(e.target.value)}
                    placeholder={
                      language === 'th'
                        ? 'ปอดฟังชัดเจนทั้งสองข้าง ไม่พบเสียงวี้ดหรือเสียงครืดคราด...'
                        : 'Clear bilaterally, no adventitious sounds, no wheezing...'
                    }
                    className="w-full pl-8 pr-5 py-5 bg-slate-50 border border-slate-200 rounded-xl text-base font-medium text-slate-800 placeholder:text-slate-500 placeholder:font-normal focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden transition-all resize-y leading-relaxed min-h-[120px]"
                  />
                </div>

                <div>
                  <label className="text-base font-bold text-slate-900 block mb-2.5">
                    {language === 'th' ? 'ระบบช่องท้อง' : 'Abdomen'}
                  </label>
                  <textarea
                    rows={3}
                    value={abdomen}
                    onChange={(e) => setAbdomen(e.target.value)}
                    placeholder={
                      language === 'th'
                        ? 'หน้าท้องนุ่ม ไม่กดเจ็บ ไม่พบตับหรือม้ามโต...'
                        : 'Soft, non-tender, active bowel sounds, no organomegaly...'
                    }
                    className="w-full pl-8 pr-5 py-5 bg-slate-50 border border-slate-200 rounded-xl text-base font-medium text-slate-800 placeholder:text-slate-500 placeholder:font-normal focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden transition-all resize-y leading-relaxed min-h-[120px]"
                  />
                </div>

                <div>
                  <label className="text-base font-bold text-slate-900 block mb-2.5">
                    {language === 'th' ? 'กระดูกและกล้ามเนื้อ' : 'Musculoskeletal'}
                  </label>
                  <textarea
                    rows={3}
                    value={musculoskeletal}
                    onChange={(e) => setMusculoskeletal(e.target.value)}
                    placeholder={
                      language === 'th'
                        ? 'การเคลื่อนไหวของข้อและกล้ามเนื้อปกติ...'
                        : 'Normal range of motion, muscle power 5/5...'
                    }
                    className="w-full pl-8 pr-5 py-5 bg-slate-50 border border-slate-200 rounded-xl text-base font-medium text-slate-800 placeholder:text-slate-500 placeholder:font-normal focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden transition-all resize-y leading-relaxed min-h-[120px]"
                  />
                </div>
              </div>
            </div>
            
            {/* 1. ICD-10 SEARCH & AUTOCOMPLETE */}
            <div className="space-y-5 bg-white p-6 rounded-2xl border border-slate-200 relative shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2.5">
                  <Search className="w-5.5 h-5.5 text-blue-600 shrink-0" />
                  <span>{language === 'th' ? '1. ค้นหารหัสโรค ICD-10' : '1. Search ICD-10 Diagnosis'}</span>
                </h3>
                <span className="text-sm font-medium text-slate-500">
                  {language === 'th' ? 'ค้นหาด้วยรหัสโรค หรือ ชื่อภาษาอังกฤษ/ไทย' : 'Search by Code, English or Thai name'}
                </span>
              </div>

              {/* Duplicate or Validation Warning Alert */}
              {diagWarning && (
                <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-sm font-bold flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                    <span>{diagWarning}</span>
                  </div>
                  <button type="button" onClick={() => setDiagWarning('')} className="text-amber-600 hover:text-amber-800 cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}

              {/* Search Bar Input */}
              <div className="relative flex items-center">
                <Search className="w-5.5 h-5.5 text-slate-400 absolute left-4 pointer-events-none z-10" />
                <input
                  type="text"
                  value={diagSearch}
                  onChange={(e) => {
                    setDiagSearch(e.target.value);
                    setShowDiagDropdown(true);
                  }}
                  onFocus={() => setShowDiagDropdown(true)}
                  placeholder={language === 'th' ? 'พิมพ์รหัส ICD-10 หรือชื่อโรคเพื่อค้นหา (เช่น J02.9, Pharyngitis)...' : 'Search ICD-10 code or disease name (e.g. J02.9, Pharyngitis)...'}
                  className="w-full pl-14 pr-12 h-14 bg-white border border-slate-200 rounded-xl text-base font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-2xs"
                />
                {diagSearch && (
                  <button
                    type="button"
                    onClick={() => setDiagSearch('')}
                    className="absolute right-4 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}

                {/* Dropdown Menu */}
                {showDiagDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {filteredICD10.length > 0 ? (
                      filteredICD10.map((item) => {
                        const selected = isCodeSelected(item.code);
                        return (
                          <div
                            key={item.code}
                            className={`p-4 flex items-center justify-between hover:bg-slate-50 transition-colors ${
                              selected ? 'bg-slate-50/80 opacity-60' : ''
                            }`}
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded text-sm">
                                  {item.code}
                                </span>
                                <span className="font-bold text-slate-900 text-sm">
                                  {item.name}
                                </span>
                              </div>
                              <div className="text-xs text-slate-500 mt-1">
                                {item.localName}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {!selected && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleSelectDiagnosis(item, false)}
                                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                                  >
                                    {language === 'th' ? '+ กำหนดเป็นโรคหลัก' : '+ Set Primary'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSelectDiagnosis(item, true)}
                                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                                  >
                                    {language === 'th' ? '+ วินิจฉัยร่วม' : '+ Secondary'}
                                  </button>
                                </>
                              )}
                              {selected && (
                                <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                                  <Check className="w-3.5 h-3.5" />
                                  {language === 'th' ? 'เลือกแล้ว' : 'Selected'}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-6 text-center text-slate-500 text-sm font-medium">
                        {language === 'th' ? 'ไม่พบรหัสโรค ICD-10 ที่ตรงกัน' : 'No matching ICD-10 diagnosis found'}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 2. RECENT / FREQUENTLY USED DIAGNOSES */}
              {recentDiagnoses.length > 0 && (
                <div className="pt-2">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <History className="w-4 h-4 text-slate-400" />
                    <span>{language === 'th' ? '2. รหัสโรค ICD-10 ที่พบบ่อย (คลิกเพื่อเลือก)' : '2. Frequently Used ICD-10'}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recentDiagnoses.map((item) => {
                      const selected = isCodeSelected(item.code);
                      return (
                        <button
                          key={item.code}
                          type="button"
                          disabled={selected}
                          onClick={() => handleSelectDiagnosis(item)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                            selected
                              ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                              : 'bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-600 border-slate-200 hover:border-blue-200 shadow-2xs'
                          }`}
                        >
                          <span className="font-mono text-blue-600 font-extrabold">{item.code}</span>
                          <span>{item.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* 3. SELECTED DIAGNOSIS LIST */}
            <div className="space-y-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2.5">
                  <ClipboardCheck className="w-5.5 h-5.5 text-blue-600 shrink-0" />
                  <span>{language === 'th' ? '3. รายการวินิจฉัยโรคที่เลือกแล้ว' : '3. Selected Diagnoses List'}</span>
                </h3>
                <span className="text-sm font-bold text-slate-700 bg-slate-100 px-3.5 py-1.5 rounded-lg border border-slate-200">
                  {language === 'th'
                    ? `รวมทั้งหมด: ${(primaryDiag ? 1 : 0) + secondaryDiags.length} รายการ`
                    : `Total: ${(primaryDiag ? 1 : 0) + secondaryDiags.length} items`}
                </span>
              </div>

              {/* No Diagnosis Selected Validation Card */}
              {!primaryDiag && secondaryDiags.length === 0 && (
                <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl text-amber-900 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <AlertTriangle className="w-4.5 h-4.5 text-amber-600" />
                    <span>{language === 'th' ? 'ยังไม่ได้เลือกการวินิจฉัยโรค' : 'No Diagnosis Selected'}</span>
                  </div>
                  <p className="text-sm text-amber-800">
                    {language === 'th'
                      ? '* จำเป็นต้องระบุการวินิจฉัยหลักอย่างน้อย 1 รายการก่อนเสร็จสิ้นการตรวจ'
                      : "* Required: At least one Primary Diagnosis is required before completing the patient's visit."}
                  </p>
                </div>
              )}

              <div className="space-y-4">
                {/* PRIMARY DIAGNOSIS ITEM */}
                {primaryDiag ? (
                  <div className="p-4 bg-blue-50/60 border-2 border-blue-500/30 rounded-2xl space-y-2.5 shadow-2xs">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="bg-blue-600 text-white text-xs font-extrabold px-3 py-1 rounded-lg flex items-center gap-1.5 uppercase shadow-2xs">
                          <Star className="w-3.5 h-3.5 fill-white" />
                          {language === 'th' ? 'โรคหลัก (Primary Diagnosis)' : 'Primary Diagnosis'}
                        </span>
                        <span className="font-mono font-extrabold text-blue-700 bg-white border border-blue-200 text-sm px-2.5 py-0.5 rounded-lg shadow-2xs">
                          {primaryDiag.code}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => startEditDiagnosis('primary', primaryDiag.name)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-100/50 rounded-lg cursor-pointer transition-colors"
                          title={language === 'th' ? 'แก้ไขการวินิจฉัย' : 'Edit Diagnosis'}
                        >
                          <Edit3 className="w-4.5 h-4.5" />
                        </button>
                        {secondaryDiags.length > 0 && (
                          <button
                            type="button"
                            onClick={handleDemotePrimary}
                            className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg cursor-pointer transition-colors"
                            title={language === 'th' ? 'เปลี่ยนเป็นวินิจฉัยร่วม' : 'Set as Secondary'}
                          >
                            <ArrowDown className="w-4.5 h-4.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleRemovePrimary}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                          title={language === 'th' ? 'ลบการวินิจฉัยนี้' : 'Remove Diagnosis'}
                        >
                          <Trash2 className="w-4.5 h-4.5" />
                        </button>
                      </div>
                    </div>

                    {editingDiagTarget === 'primary' ? (
                      <div className="flex items-center gap-2.5 pt-1">
                        <input
                          type="text"
                          value={editDiagText}
                          onChange={(e) => setEditDiagText(e.target.value)}
                          className="flex-1 p-3 bg-white border border-slate-200 rounded-xl text-sm font-medium"
                        />
                        <button
                          type="button"
                          onClick={saveEditDiagnosis}
                          className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl cursor-pointer"
                        >
                          {language === 'th' ? 'บันทึก' : 'Save'}
                        </button>
                      </div>
                    ) : (
                      <div className="text-base font-extrabold text-slate-900 pl-0.5">
                        {primaryDiag.name} {primaryDiag.localName ? `(${primaryDiag.localName})` : ''}
                      </div>
                    )}
                  </div>
                ) : (
                  secondaryDiags.length > 0 && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs font-bold flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        {language === 'th'
                          ? '⚠️ ขาดการวินิจฉัยหลัก! โปรดเลือกโรคใต้รายการนี้ให้เป็นโรคหลัก'
                          : '⚠️ Missing Primary Diagnosis! Please set one of the diagnoses below as Primary.'}
                      </span>
                    </div>
                  )
                )}

                {/* SECONDARY DIAGNOSES ITEMS */}
                {secondaryDiags.map((diag, index) => (
                  <div
                    key={diag.code + '-' + index}
                    className="p-4 bg-slate-50/70 border border-slate-200 rounded-2xl space-y-2.5 hover:border-slate-300 transition-all"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="bg-slate-200 text-slate-700 text-xs font-bold px-2.5 py-1 rounded-md uppercase">
                          {language === 'th' ? `การวินิจฉัยร่วม #${index + 1}` : `Secondary #${index + 1}`}
                        </span>
                        <span className="font-mono font-bold text-slate-800 bg-white border border-slate-200 text-sm px-2.5 py-0.5 rounded-lg shadow-2xs">
                          {diag.code}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handlePromoteToPrimary(index)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors"
                          title={language === 'th' ? 'กำหนดเป็นโรคหลัก' : 'Promote to Primary'}
                        >
                          <ArrowUp className="w-4.5 h-4.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveSecondaryUp(index)}
                          disabled={index === 0}
                          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-lg cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title={language === 'th' ? 'เลื่อนขึ้น' : 'Move Up'}
                        >
                          <ChevronRight className="w-4.5 h-4.5 -rotate-90" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveSecondaryDown(index)}
                          disabled={index === secondaryDiags.length - 1}
                          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-lg cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title={language === 'th' ? 'เลื่อนลง' : 'Move Down'}
                        >
                          <ChevronRight className="w-4.5 h-4.5 rotate-90" />
                        </button>
                        <button
                          type="button"
                          onClick={() => startEditDiagnosis(index, diag.name)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors"
                          title={language === 'th' ? 'แก้ไขการวินิจฉัย' : 'Edit Diagnosis'}
                        >
                          <Edit3 className="w-4.5 h-4.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveSecondary(index)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                          title={language === 'th' ? 'ลบการวินิจฉัยนี้' : 'Remove Diagnosis'}
                        >
                          <Trash2 className="w-4.5 h-4.5" />
                        </button>
                      </div>
                    </div>

                    {editingDiagTarget === index ? (
                      <div className="flex items-center gap-2.5 pt-1">
                        <input
                          type="text"
                          value={editDiagText}
                          onChange={(e) => setEditDiagText(e.target.value)}
                          className="flex-1 p-3 bg-white border border-slate-200 rounded-xl text-sm font-medium"
                        />
                        <button
                          type="button"
                          onClick={saveEditDiagnosis}
                          className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl cursor-pointer"
                        >
                          {language === 'th' ? 'บันทึก' : 'Save'}
                        </button>
                      </div>
                    ) : (
                      <div className="text-base font-bold text-slate-800 pl-0.5">
                        {diag.name} {diag.localName ? `(${diag.localName})` : ''}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Assessment Notes & Treatment Plan Textareas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
              <div>
                <label className="text-base font-bold text-slate-900 block mb-2.5">
                  {language === 'th' ? 'บันทึกผลการประเมิน (Assessment)' : 'Assessment Notes'}
                </label>
                <textarea
                  rows={4}
                  value={assessmentNotes}
                  onChange={(e) => setAssessmentNotes(e.target.value)}
                  placeholder={
                    language === 'th'
                      ? 'ระบุเหตุผลทางการแพทย์ ข้อควรพิจารณา การประเมินความรุนแรง...'
                      : 'Enter clinical reasoning, severity assessment, and considerations...'
                  }
                  className="w-full pl-8 pr-5 py-5 bg-slate-50 border border-slate-200 rounded-xl text-base font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all leading-relaxed min-h-[150px]"
                />
              </div>

              <div>
                <label className="text-base font-bold text-slate-900 block mb-2.5">
                  {language === 'th' ? 'แผนการรักษาและหัตถการ (Treatment Plan/Procedures)' : 'Treatment Plan & Procedures'}
                </label>
                <textarea
                  rows={4}
                  value={treatmentPlan}
                  onChange={(e) => setTreatmentPlan(e.target.value)}
                  placeholder={
                    language === 'th'
                      ? 'ระบุแผนการดูแล คำแนะนำที่ไม่ใช้ยา หัตถการที่ทำ...'
                      : 'Enter care plan, non-pharmacological advice, procedures performed...'
                  }
                  className="w-full pl-8 pr-5 py-5 bg-slate-50 border border-slate-200 rounded-xl text-base font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all leading-relaxed min-h-[150px]"
                />
              </div>
            </div>

          </div>
        )}
        {/* TAB 3: PRESCRIPTION (PHARMACY ORDERS) */}
        {activeTab === 'prescription' && (
          <div className="doctor-tab-panel">
            {/* Add New Medicine Form */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4">
              <h3 className="doctor-field-label flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-600" />
                <span>{language === 'th' ? 'ค้นหาและสั่งยา' : 'Search & Prescribe Medicine'}</span>
              </h3>

              {/* Medicine Selector & Search */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2 relative" ref={medDropdownRef}>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {language === 'th' ? 'ค้นหาและเลือกยา *' : 'Select / Search Medicine *'}
                  </label>
                  
                  <div className="relative flex items-center">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
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
                      placeholder={language === 'th' ? 'พิมพ์ชื่อยาเพื่อค้นหา เช่น Paracetamol, Amoxicillin หรือคลิกเพื่อเลือก...' : 'Search medicine e.g., Paracetamol, Amoxicillin or click to select...'}
                      className="w-full pl-9 pr-16 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-800 shadow-sm transition-all"
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
                          title={language === 'th' ? 'ล้างการค้นหา' : 'Clear search'}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsMedDropdownOpen(!isMedDropdownOpen)}
                        className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                        title={language === 'th' ? 'แสดงยาที่ใช้บ่อย' : 'Show frequent medicines'}
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
                            ? (language === 'th' ? 'รายการยาในโรงพยาบาล / ยาที่สั่งบ่อย' : 'Hospital Formulary / Frequently Prescribed')
                            : (language === 'th' ? `ผลการค้นหา (${filteredMedicines.length} รายการ)` : `Search Results (${filteredMedicines.length})`)}
                        </span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          {language === 'th' ? 'คลิกเพื่อเลือกยา' : 'Click to select'}
                        </span>
                      </div>

                      {filteredMedicines.length > 0 ? (
                        filteredMedicines.map((med, idx) => {
                          const isSelected = newMedName.toLowerCase() === med.name.toLowerCase();
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                handleSelectMedicine(med.name);
                                setIsMedDropdownOpen(false);
                              }}
                              className={`w-full text-left px-3.5 py-2.5 hover:bg-emerald-50/80 transition-colors flex items-center justify-between group ${
                                isSelected ? 'bg-emerald-50 text-emerald-900 font-semibold' : 'text-slate-700'
                              }`}
                            >
                              <div>
                                <div className="text-xs sm:text-sm font-semibold group-hover:text-emerald-700 flex items-center gap-1.5">
                                  <span>{med.name}</span>
                                  {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                                </div>
                                <div className="text-[11px] text-slate-500 group-hover:text-emerald-600">
                                  {med.category}
                                </div>
                              </div>
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 group-hover:bg-emerald-100 group-hover:text-emerald-700 transition-colors">
                                {language === 'th' ? 'เลือก' : 'Select'}
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
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {language === 'th' ? 'ขนาด/ปริมาณ' : 'Dosage'}
                  </label>
                  <select
                    value={newMedDosage}
                    onChange={(e) => setNewMedDosage(e.target.value)}
                    className="doctor-select"
                  >
                    <option value="">-- {language === 'th' ? 'เลือกปริมาณ' : 'Select Dosage'} --</option>
                    <option value={language === 'th' ? '1 เม็ด' : '1 tablet'}>{language === 'th' ? '1 เม็ด' : '1 tablet'}</option>
                    <option value={language === 'th' ? '2 เม็ด' : '2 tablets'}>{language === 'th' ? '2 เม็ด' : '2 tablets'}</option>
                    <option value={language === 'th' ? 'ครึ่งเม็ด (1/2)' : '1/2 tablet'}>{language === 'th' ? 'ครึ่งเม็ด (1/2)' : '1/2 tablet'}</option>
                    <option value={language === 'th' ? '1 แคปซูล' : '1 capsule'}>{language === 'th' ? '1 แคปซูล' : '1 capsule'}</option>
                    <option value={language === 'th' ? '2 แคปซูล' : '2 capsules'}>{language === 'th' ? '2 แคปซูล' : '2 capsules'}</option>
                    <option value={language === 'th' ? '10 มล.' : '10 ml'}>{language === 'th' ? '10 มล.' : '10 ml'}</option>
                    <option value={language === 'th' ? '1 ซอง' : '1 sachet'}>{language === 'th' ? '1 ซอง' : '1 sachet'}</option>
                    <option value={language === 'th' ? '2 พ่นสูด' : '2 puffs'}>{language === 'th' ? '2 พ่นสูด' : '2 puffs'}</option>
                    {newMedDosage && ![
                      '1 เม็ด', '1 tablet', '2 เม็ด', '2 tablets', 'ครึ่งเม็ด (1/2)', '1/2 tablet',
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
                    className="doctor-select"
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
                    className="doctor-select"
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
                    {language === 'th' ? 'จำนวนรับยา' : 'Quantity'}
                  </label>
                  <select
                    value={String(newMedQty)}
                    onChange={(e) => setNewMedQty(e.target.value === '' ? '' : (isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value)) as any)}
                    className="doctor-select font-mono"
                  >
                    <option value="">-- {language === 'th' ? 'ระบุจำนวน' : 'Select Qty'} --</option>
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
                    {language === 'th' ? 'วิธีใช้ (Route)' : 'Route'}
                  </label>
                  <select
                    value={newMedRoute}
                    onChange={(e) => setNewMedRoute(e.target.value)}
                    className="doctor-select"
                  >
                    <option value="">-- {language === 'th' ? 'เลือกวิธีใช้' : 'Select Route'} --</option>
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
                    {language === 'th' ? 'สัมพันธ์กับมื้ออาหาร' : 'Meal Timing'}
                  </label>
                  <select
                    value={newMedTiming}
                    onChange={(e) => setNewMedTiming(e.target.value)}
                    className="doctor-select"
                  >
                    <option value="">-- {language === 'th' ? 'เลือกเวลาอาหาร' : 'Select Meal Timing'} --</option>
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
                    className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4 shrink-0" />
                    <span>{language === 'th' ? '+ เพิ่มรายการสั่งยา' : 'Add to Order'}</span>
                  </button>
                </div>
              </div>

              {/* Special Instructions */}
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  {language === 'th' ? 'คำแนะนำพิเศษ / ระบุหน้าซองยา' : 'Special Instructions / Label Note'}
                </label>
                <input
                  type="text"
                  value={newMedInstructions}
                  onChange={(e) => setNewMedInstructions(e.target.value)}
                  placeholder={language === 'th' ? 'พิมพ์คำแนะนำพิเศษที่จะพิมพ์ลงบนฉลากยา...' : 'Special instructions for pharmacy label...'}
                  className="doctor-input"
                />
              </div>
            </div>

            {/* Prescribed Medicines List Table */}
            <div className="doctor-field-group">
              <h3 className="doctor-field-label">
                {language === 'th' ? 'รายการยาที่สั่ง (Active Prescriptions)' : 'Active Prescriptions List'}
              </h3>

              {prescriptions.length === 0 ? (
                <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs">
                  {language === 'th' ? 'ยังไม่มีรายการยาที่สั่ง กรุณาเลือกและเพิ่มยาจากด้านบน' : 'No active prescriptions order. Select medicine above to add.'}
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 font-bold text-slate-600 uppercase">
                        <th className="p-3">{language === 'th' ? 'ชื่อยา' : 'Medicine'}</th>
                        <th className="p-3">{language === 'th' ? 'ขนาดและความถี่' : 'Dosage & Frequency'}</th>
                        <th className="p-3">{language === 'th' ? 'ระยะเวลา' : 'Duration'}</th>
                        <th className="p-3">{language === 'th' ? 'จำนวนรับยา' : 'Quantity'}</th>
                        <th className="p-3">{language === 'th' ? 'มื้ออาหาร/เวลา' : 'Timing'}</th>
                        <th className="p-3 text-right">{language === 'th' ? 'จัดการ' : 'Actions'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {prescriptions.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="p-3 font-bold text-slate-900">{p.medicineName}</td>
                          <td className="p-3 text-slate-700">{p.dosage} â€¢ {p.frequency}</td>
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
          <div className="doctor-tab-panel">
            {/* Referral Form */}
            <div className="doctor-field-group">
              <h3 className="doctor-field-label">
                {language === 'th' ? 'การส่งต่อแพทย์เฉพาะทาง (Referral)' : 'Inter-Departmental Specialty Referral'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-white p-6 rounded-2xl border border-slate-200">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    {language === 'th' ? 'แผนกที่ต้องการส่งต่อ' : 'Referral Department'}
                  </label>
                  <select
                    value={refDept}
                    onChange={(e) => setRefDept(e.target.value)}
                    className="doctor-select"
                  >
                    <option value="">{language === 'th' ? '-- เลือกแผนกเฉพาะทาง --' : '-- Select Specialty --'}</option>
                    <option value="Cardiology">{language === 'th' ? 'อายุรกรรมโรคหัวใจ (Cardiology)' : 'Cardiology'}</option>
                    <option value="Orthopedics">{language === 'th' ? 'ศัลยกรรมกระดูกและข้อ (Orthopedics)' : 'Orthopedics'}</option>
                    <option value="Neurology">{language === 'th' ? 'อายุรกรรมประสาทวิทยา (Neurology)' : 'Neurology'}</option>
                    <option value="Otolaryngology (ENT)">{language === 'th' ? 'โสต ศอ นาสิกวิทยา (ENT)' : 'Otolaryngology (ENT)'}</option>
                    <option value="Dermatology">{language === 'th' ? 'ตจวิทยา / ผิวหนัง (Dermatology)' : 'Dermatology'}</option>
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
                    placeholder={language === 'th' ? 'เช่น ต้องการประเมินการทำงานของหัวใจเพิ่มเติม...' : 'e.g. Further cardiac evaluation'}
                    className="doctor-input"
                  />
                </div>
              </div>
            </div>

            {/* Patient Counseling Section */}
            <div className="doctor-field-group pt-2">
              <h3 className="doctor-field-label">
                {language === 'th' ? 'คำแนะนำแพทย์และการให้คำปรึกษา' : 'Patient Counseling & Medical Advice'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    {language === 'th' ? 'คำแนะนำการใช้ยาและอาหาร' : 'Medication & Diet Advice'}
                  </label>
                  <textarea
                    rows={2}
                    value={counselMed}
                    onChange={(e) => setCounselMed(e.target.value)}
                    className="doctor-textarea text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    {language === 'th' ? 'คำแนะนำการปฏิบัติตัวและการออกกำลังกาย' : 'Lifestyle & Exercise Guidance'}
                  </label>
                  <textarea
                    rows={2}
                    value={counselLifestyle}
                    onChange={(e) => setCounselLifestyle(e.target.value)}
                    className="doctor-textarea text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: FOLLOW-UP & VISIT ACTIONS */}
        {activeTab === 'followup' && (
          <div className="doctor-tab-panel">
            {/* Follow-up Scheduler */}
            <div className="space-y-4 bg-white p-6 rounded-2xl border border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="doctor-field-label flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <span>{language === 'th' ? 'นัดหมายติดตามอาการ (Follow-Up)' : 'Schedule Next Follow-Up Visit'}</span>
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
                  <span>{language === 'th' ? 'ต้องการนัดหมายติดตามอาการในครั้งต่อไป' : 'Schedule a follow-up appointment'}</span>
                </label>
              </div>

              {!hasFollowUp ? (
                <div className="p-4 bg-white/70 rounded-xl border border-dashed border-slate-200 text-slate-500 text-xs text-center font-medium">
                  {language === 'th' ? 'ไม่มีการนัดหมายติดตามอาการในการตรวจครั้งนี้ (ทำเครื่องหมายถูก หากต้องการลงนัดหมาย)' : 'No follow-up appointment scheduled for this visit. Check \"Schedule a follow-up appointment\" if required.'}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">
                      {language === 'th' ? 'วันที่นัดหมาย' : 'Follow-Up Date'}
                    </label>
                    <input
                      type="date"
                      value={followUpDate}
                      onChange={(e) => setFollowUpDate(e.target.value)}
                      className="doctor-input font-semibold"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">
                      {language === 'th' ? 'เหตุผลการนัดหมาย' : 'Reason for Follow-Up'}
                    </label>
                    <input
                      type="text"
                      value={followUpReason}
                      onChange={(e) => setFollowUpReason(e.target.value)}
                      placeholder={language === 'th' ? 'ระบุเหตุผลในการนัดหมาย' : 'Enter reason for follow-up'}
                      className="doctor-input"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">
                      {language === 'th' ? 'คำแนะนำสำหรับผู้ป่วย' : 'Patient Instructions'}
                    </label>
                    <input
                      type="text"
                      value={followUpInstructions}
                      onChange={(e) => setFollowUpInstructions(e.target.value)}
                      placeholder={language === 'th' ? 'คำแนะนำหรือการเตรียมตัวก่อนมาตรวจครั้งหน้า' : 'Patient preparation instructions'}
                      className="doctor-input"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Visit Action Center Buttons */}
            <div className="doctor-field-group pt-2">
              <div className="border-b border-slate-100 pb-2">
                <h3 className="doctor-field-label">
                  {language === 'th' ? 'สรุปผลการตรวจและเอกสารออก' : 'Visit Summary & Output Documents'}
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(language === 'th' ? 'คุณแน่ใจหรือไม่ว่าต้องการยกเลิกการตรวจผู้ป่วยรายนี้? ข้อมูลที่บันทึกไว้จะสูญหาย' : 'Are you sure you want to cancel this visit session?')) {
                      onBackToQueue();
                    }
                  }}
                  className="h-10 px-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
                >
                  <XCircle className="w-4 h-4 text-white" />
                  <span>{language === 'th' ? 'ยกเลิกการตรวจ' : 'Cancel Visit Session'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="h-10 px-3 bg-slate-100 hover:bg-slate-200 border border-slate-200/70 text-slate-800 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
                >
                  <Save className="w-4 h-4 text-slate-700" />
                  <span>{language === 'th' ? 'บันทึกฉบับร่าง' : 'Save Draft'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCompleteVisit}
                  className="h-10 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm hover:shadow transition-all cursor-pointer"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>{language === 'th' ? 'บันทึกผลการตรวจ' : 'Save & Complete Visit'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => alert(language === 'th' ? `ออกใบรับรองแพทย์สำหรับ ${patient.name} (HN: ${patient.hn}) เรียบร้อยแล้ว` : `Medical Certificate generated for ${patient.name} (HN: ${patient.hn})`)}
                  className="h-10 px-3 bg-white border border-slate-200 hover:border-blue-300 rounded-xl text-xs font-bold text-slate-800 flex items-center justify-center gap-2 shadow-2xs hover:shadow-xs transition-all cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>{language === 'th' ? 'ออกใบรับรองแพทย์' : 'Medical Certificate'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => alert(language === 'th' ? `กำลังพิมพ์ใบสรุปผลการตรวจ OPD สำหรับ ${patient.name}...` : `Printing Official OPD Visit Summary for ${patient.name}...`)}
                  className="h-10 px-3 bg-white border border-slate-200 hover:border-blue-300 rounded-xl text-xs font-bold text-slate-800 flex items-center justify-center gap-2 shadow-2xs hover:shadow-xs transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-slate-700" />
                  <span>{language === 'th' ? 'พิมพ์ใบสรุปผลการตรวจ' : 'Print Visit Summary'}</span>
                </button>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* History Preview Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-base text-slate-900">
                {showHistoryModal === 'visits'
                  ? (language === 'th' ? 'ประวัติการรักษาย้อนหลัง' : 'Previous Visit Records')
                  : (language === 'th' ? 'ผลการตรวจวินิจฉัย/แล็บ' : 'Uploaded Diagnostic Reports')}
              </h3>
              <button onClick={() => setShowHistoryModal(null)} className="text-slate-400 hover:text-slate-600">âœ•</button>
            </div>
            <div className="space-y-2 text-xs text-slate-600">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="font-bold block text-slate-800">
                  {language === 'th' ? 'รับบริการวันที่ 2026-06-10 (นพ.อนงค์ ส.)' : 'Visit on 2026-06-10 (Dr. Anong S.)'}
                </span>
                <span>{language === 'th' ? 'วินิจฉัย: ไข้หวัด ติดเชื้อทางเดินหายใจส่วนบน' : 'Diagnosis: Acute Upper Respiratory Infection'}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="font-bold block text-slate-800">
                  {language === 'th' ? 'รับบริการวันที่ 2026-03-22 (นพ.อนงค์ ส.)' : 'Visit on 2026-03-22 (Dr. Anong S.)'}
                </span>
                <span>{language === 'th' ? 'วินิจฉัย: ตรวจติดตามความดันโลหิตสูง' : 'Diagnosis: Essential Hypertension Routine Follow-Up'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Feedback Modal */}
      {successNotice && successNotice.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl border border-slate-100 transform transition-all scale-100">
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
