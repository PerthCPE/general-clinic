import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import type {
  QueuePatientItem,
  TriageLevelKey,
  BMICategoryKey,
  BMICategoryInfo,
  DoctorOption,
  ScreeningRecord,
} from './types';
import { BMIWidget } from './components/BMIWidget';
import { TriageWidget } from './components/TriageWidget';
import { VitalsFormCard } from './components/VitalsFormCard';
import { queueApi, vitalsApi, type BackendQueue } from '../../services/api';
import { useWebSocket } from '../../context/WebSocketContext';
import { formatHN, formatQueueNo, formatNationalId, formatPhone } from '../../utils/formatters';
import './VitalsPage.css';

export { formatHN, formatQueueNo };

const VITALS_DRAFT_KEY = 'clinic_vitals_draft_v1';

interface VitalsDraftPayload {
  selectedPatientId: string;
  patientQueueNo?: string;
  searchQuery: string;
  weight: string;
  height: string;
  temperature: string;
  systolicBP: string;
  diastolicBP: string;
  heartRate: string;
  respiratoryRate: string;
  spo2: string;
  painScore: string;
  bloodSugar: string;
  chiefComplaint: string;
  allergies: string;
  foodAllergies: string;
  medicalHistory: string;
  currentMedications: string;
  smokingHistory: string;
  alcoholHistory: string;
  selectedTriage: TriageLevelKey;
  assignedDoctorId: number;
  savedAt: string;
}

const getInitialDraft = (): VitalsDraftPayload | null => {
  try {
    const saved = localStorage.getItem(VITALS_DRAFT_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {
    // ignore
  }
  return null;
};

// Initial Fallback Doctors
const DEFAULT_DOCTORS: DoctorOption[] = [
  { doctorId: 4, fullName: 'พญ.สุดา สุขสมบูรณ์', specialty: 'เวชปฏิบัติทั่วไป', roomName: 'ห้องตรวจ 1 (พญ.สุดา)' },
  { doctorId: 5, fullName: 'นพ.วิชัย ชาญการแพทย์', specialty: 'อายุรกรรมทั่วไป', roomName: 'ห้องตรวจ 2 (นพ.วิชัย)' },
  { doctorId: 6, fullName: 'พญ.เกศรา รักษาดี', specialty: 'กุมารเวชศาสตร์', roomName: 'ห้องตรวจ 3 (พญ.เกศรา)' },
];

const mapBackendQueueToPatientItem = (q: BackendQueue): QueuePatientItem => {
  let timeStr = '08:30 น.';
  if (q.created_at) {
    try {
      const d = new Date(q.created_at);
      if (!isNaN(d.getTime())) {
        timeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')} น.`;
      }
    } catch {
      timeStr = q.created_at;
    }
  }

  const birthYear = q.patient?.birthdate ? new Date(q.patient.birthdate).getFullYear() : 1990;
  const age = new Date().getFullYear() - birthYear;
  const queueFormatted = formatQueueNo(q.queue_number || q.id);
  const hnFormatted = q.patient?.hn ? formatHN(q.patient.hn) : formatHN(q.patient_id || q.id || 1);

  return {
    id: String(q.id),
    queueId: q.id,
    patientId: q.patient_id,
    queueNo: queueFormatted,
    hn: hnFormatted,
    fullName: q.patient?.fullname || `ผู้ป่วยคิว ${queueFormatted}`,
    nationalId: formatNationalId(q.patient?.national_id),
    gender: (q.patient?.gender as 'ชาย' | 'หญิง' | 'อื่นๆ') || 'ชาย',
    age: age > 0 ? age : 35,
    phone: formatPhone(q.patient?.phone_number),
    schemeType: q.patient?.scheme_type || 'บัตรทอง (สปสช.)',
    allergies: q.patient?.allergies || 'ปฏิเสธการแพ้ยา',
    chronicDiseases: q.patient?.chronic_diseases || 'ไม่มี',
    registeredTime: timeStr,
    queueStatus: (q.status as 'รอคัดกรอง' | 'รอพบแพทย์' | 'กำลังตรวจ' | 'เสร็จสิ้น') || 'รอคัดกรอง',
  };
};

export const VitalsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const initialDraft = useMemo(() => getInitialDraft(), []);

  // Queue & Patient State (Auto-restored from draft if available)
  const [queueList, setQueueList] = useState<QueuePatientItem[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>(() => initialDraft?.selectedPatientId || '');
  const [doctorList, setDoctorList] = useState<DoctorOption[]>(DEFAULT_DOCTORS);

  // ดึงรายการคิวจาก Backend DB
  const fetchQueues = useCallback(async () => {
    try {
      const data = await queueApi.getList();
      if (Array.isArray(data)) {
        const mapped = data.map(mapBackendQueueToPatientItem);
        setQueueList(mapped);
        return mapped;
      }
    } catch (err) {
      console.warn('Could not load queues in vitals:', err);
    }
    return [];
  }, []);

  // ดึงรายชื่อแพทย์ประจำห้องตรวจจาก Backend DB
  const fetchDoctors = useCallback(async () => {
    try {
      const data = await vitalsApi.getDoctors();
      if (Array.isArray(data) && data.length > 0) {
        const mapped: DoctorOption[] = data.map((d, index) => {
          const shortName = d.fullname.includes('สุดา')
            ? 'พญ.สุดา'
            : d.fullname.includes('วิชัย')
            ? 'นพ.วิชัย'
            : d.fullname.includes('เกศรา')
            ? 'พญ.เกศรา'
            : d.fullname.split(' ')[0] || '';
          const roomLabel = `ห้องตรวจ ${index + 1}${shortName ? ` (${shortName})` : ''}`;
          return {
            doctorId: d.id,
            fullName: d.fullname,
            specialty: index === 0 ? 'เวชปฏิบัติทั่วไป' : index === 1 ? 'อายุรกรรมทั่วไป' : 'กุมารเวชศาสตร์',
            roomName: roomLabel,
          };
        });
        setDoctorList(mapped);
      }
    } catch (err) {
      console.warn('Could not load doctors in vitals:', err);
    }
  }, []);

  const { subscribe } = useWebSocket();

  useEffect(() => {
    fetchQueues();
    fetchDoctors();

    // ดักฟัง Real-time WebSocket เมื่อมีคิวใหม่หรือเปลี่ยนสถานะคิว
    const unsubCreated = subscribe('QUEUE_CREATED', () => {
      fetchQueues();
    });
    const unsubUpdated = subscribe('QUEUE_UPDATED', () => {
      fetchQueues();
    });

    // Fallback polling ทุก 30 วินาที
    const interval = setInterval(fetchQueues, 30000);
    return () => {
      unsubCreated();
      unsubUpdated();
      clearInterval(interval);
    };
  }, [fetchQueues, fetchDoctors, subscribe]);

  // Form State (Auto-restored from in-progress draft)
  const [weight, setWeight] = useState<string>(() => initialDraft?.weight || '');
  const [height, setHeight] = useState<string>(() => initialDraft?.height || '');
  const [temperature, setTemperature] = useState<string>(() => initialDraft?.temperature || '');
  const [systolicBP, setSystolicBP] = useState<string>(() => initialDraft?.systolicBP || '');
  const [diastolicBP, setDiastolicBP] = useState<string>(() => initialDraft?.diastolicBP || '');
  const [heartRate, setHeartRate] = useState<string>(() => initialDraft?.heartRate || '');
  const [respiratoryRate, setRespiratoryRate] = useState<string>(() => initialDraft?.respiratoryRate || '');
  const [spo2, setSpo2] = useState<string>(() => initialDraft?.spo2 || '');
  const [painScore, setPainScore] = useState<string>(() => initialDraft?.painScore || '');
  const [bloodSugar, setBloodSugar] = useState<string>(() => initialDraft?.bloodSugar || '');
  const [chiefComplaint, setChiefComplaint] = useState<string>(() => initialDraft?.chiefComplaint || '');
  const [allergies, setAllergies] = useState<string>(() => initialDraft?.allergies || '');
  const [foodAllergies, setFoodAllergies] = useState<string>(() => initialDraft?.foodAllergies || '');
  const [medicalHistory, setMedicalHistory] = useState<string>(() => initialDraft?.medicalHistory || '');
  const [currentMedications, setCurrentMedications] = useState<string>(() => initialDraft?.currentMedications || '');
  const [smokingHistory, setSmokingHistory] = useState<string>(() => initialDraft?.smokingHistory || '');
  const [alcoholHistory, setAlcoholHistory] = useState<string>(() => initialDraft?.alcoholHistory || '');
  const [selectedTriage, setSelectedTriage] = useState<TriageLevelKey>(() => initialDraft?.selectedTriage || 'ปกติ (Normal)');
  const [assignedDoctorId, setAssignedDoctorId] = useState<number>(() => initialDraft?.assignedDoctorId || 4);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(() => initialDraft?.savedAt || null);

  // Accordion and UI States
  const [isFormOpen, setIsFormOpen] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Searchable Queue Dropdown State
  const [searchQuery, setSearchQuery] = useState<string>(() => initialDraft?.searchQuery || '');
  const [isQueueDropdownOpen, setIsQueueDropdownOpen] = useState<boolean>(false);
  const queueDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (queueDropdownRef.current && !queueDropdownRef.current.contains(event.target as Node)) {
        setIsQueueDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Find currently selected patient
  const selectedPatient = useMemo(() => {
    return queueList.find((p) => p.id === selectedPatientId) || null;
  }, [queueList, selectedPatientId]);

  // Sync patient info when selected patient changes
  const handleSelectPatient = (patient: QueuePatientItem) => {
    setSelectedPatientId(patient.id);
    setSearchQuery(`${patient.queueNo} - ${patient.fullName} (HN: ${patient.hn} | มาถึง ${patient.registeredTime})`);
    setIsQueueDropdownOpen(false);
    if (patient.allergies && !allergies) setAllergies(patient.allergies);
    if (patient.chronicDiseases && !medicalHistory) setMedicalHistory(patient.chronicDiseases);
  };

  // Auto-sync / reconnect draft patient once queueList is loaded from DB
  useEffect(() => {
    if (queueList.length > 0) {
      const targetId = selectedPatientId || initialDraft?.selectedPatientId;
      const targetQNo = initialDraft?.patientQueueNo;
      if (targetId || targetQNo) {
        const found = queueList.find(
          (p) =>
            (targetId && (p.id === targetId || String(p.queueId) === targetId)) ||
            (targetQNo && p.queueNo.toLowerCase() === targetQNo.toLowerCase())
        );
        if (found) {
          if (found.id !== selectedPatientId) {
            setSelectedPatientId(found.id);
          }
          const formattedStr = `${found.queueNo} - ${found.fullName} (HN: ${found.hn} | มาถึง ${found.registeredTime})`;
          if (!searchQuery || searchQuery.trim() === '') {
            setSearchQuery(formattedStr);
          }
        }
      }
    }
  }, [queueList, selectedPatientId, initialDraft?.selectedPatientId, initialDraft?.patientQueueNo, searchQuery]);

  // Auto-save draft on change with debounce
  useEffect(() => {
    const hasData =
      Boolean(selectedPatientId) ||
      Boolean(weight) ||
      Boolean(height) ||
      Boolean(temperature) ||
      Boolean(systolicBP) ||
      Boolean(diastolicBP) ||
      Boolean(heartRate) ||
      Boolean(respiratoryRate) ||
      Boolean(spo2) ||
      Boolean(painScore) ||
      Boolean(bloodSugar) ||
      Boolean(chiefComplaint) ||
      Boolean(allergies) ||
      Boolean(foodAllergies) ||
      Boolean(medicalHistory) ||
      Boolean(currentMedications) ||
      Boolean(smokingHistory) ||
      Boolean(alcoholHistory);

    if (hasData) {
      const timer = setTimeout(() => {
        try {
          const nowStr = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
          const payload: VitalsDraftPayload = {
            selectedPatientId,
            patientQueueNo: selectedPatient?.queueNo,
            searchQuery,
            weight,
            height,
            temperature,
            systolicBP,
            diastolicBP,
            heartRate,
            respiratoryRate,
            spo2,
            painScore,
            bloodSugar,
            chiefComplaint,
            allergies,
            foodAllergies,
            medicalHistory,
            currentMedications,
            smokingHistory,
            alcoholHistory,
            selectedTriage,
            assignedDoctorId,
            savedAt: nowStr,
          };
          localStorage.setItem(VITALS_DRAFT_KEY, JSON.stringify(payload));
          setDraftSavedAt(nowStr);
        } catch {
          // ignore
        }
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [
    selectedPatientId,
    selectedPatient,
    searchQuery,
    weight,
    height,
    temperature,
    systolicBP,
    diastolicBP,
    heartRate,
    respiratoryRate,
    spo2,
    painScore,
    bloodSugar,
    chiefComplaint,
    allergies,
    foodAllergies,
    medicalHistory,
    currentMedications,
    smokingHistory,
    alcoholHistory,
    selectedTriage,
    assignedDoctorId,
  ]);

  // Filtered waiting queue options for the searchable dropdown
  const filteredWaitingQueues = useMemo(() => {
    const waiting = queueList.filter((p) => p.queueStatus === 'รอคัดกรอง');
    if (!searchQuery.trim()) return waiting;
    const q = searchQuery.toLowerCase().trim();
    // If the searchQuery is exactly the formatted selected string, show all waiting queues on click
    if (selectedPatient && searchQuery === `${selectedPatient.queueNo} - ${selectedPatient.fullName} (HN: ${selectedPatient.hn} | มาถึง ${selectedPatient.registeredTime})`) {
      return waiting;
    }
    return waiting.filter((p) =>
      p.queueNo.toLowerCase().includes(q) ||
      p.fullName.toLowerCase().includes(q) ||
      p.hn.toLowerCase().includes(q) ||
      p.nationalId.includes(q)
    );
  }, [queueList, searchQuery, selectedPatient]);

  // BMI Calculation (Asian WHO standard)
  const { bmiValue, bmiCategory } = useMemo(() => {
    const w = parseFloat(weight);
    const h = parseFloat(height);
    if (isNaN(w) || isNaN(h) || w <= 0 || h <= 0) {
      return { bmiValue: null, bmiCategory: null };
    }
    const hMeters = h / 100;
    const bmi = w / (hMeters * hMeters);

    let key: BMICategoryKey = 'ปกติ (Normal)';
    let labelTh = 'สมส่วน / ปกติ';
    let labelEn = 'Normal weight';
    let color = '#10B981';
    let badgeClass = 'bmi-badge-normal';
    let rangeText = '18.5 - 22.9 kg/m²';

    if (bmi < 18.5) {
      key = 'ผอมเกินไป (Underweight)';
      labelTh = 'น้ำหนักน้อย / ผอม';
      labelEn = 'Underweight';
      color = '#0284C7';
      badgeClass = 'bmi-badge-underweight';
      rangeText = '< 18.5 kg/m²';
    } else if (bmi >= 18.5 && bmi <= 22.9) {
      key = 'ปกติ (Normal)';
      labelTh = 'สมส่วน / ปกติ';
      labelEn = 'Normal';
      color = '#10B981';
      badgeClass = 'bmi-badge-normal';
      rangeText = '18.5 - 22.9 kg/m²';
    } else if (bmi >= 23.0 && bmi <= 24.9) {
      key = 'ท้วม / น้ำหนักเกิน (Overweight)';
      labelTh = 'ท้วม / เริ่มอ้วน';
      labelEn = 'Overweight';
      color = '#F59E0B';
      badgeClass = 'bmi-badge-overweight';
      rangeText = '23.0 - 24.9 kg/m²';
    } else if (bmi >= 25.0 && bmi <= 29.9) {
      key = 'อ้วนระดับ 1 (Obese I)';
      labelTh = 'อ้วนระดับ 1';
      labelEn = 'Obese Class 1';
      color = '#F97316';
      badgeClass = 'bmi-badge-obese1';
      rangeText = '25.0 - 29.9 kg/m²';
    } else {
      key = 'อ้วนระดับ 2 (Obese II)';
      labelTh = 'อ้วนระดับ 2 (อันตราย)';
      labelEn = 'Obese Class 2';
      color = '#EF4444';
      badgeClass = 'bmi-badge-obese2';
      rangeText = '≥ 30.0 kg/m²';
    }

    const info: BMICategoryInfo = {
      key,
      labelTh,
      labelEn,
      color,
      badgeClass,
      rangeText,
    };

    return { bmiValue: bmi, bmiCategory: info };
  }, [weight, height]);

  // Smart Triage Auto-Suggestion based on vitals
  const suggestedTriageLevel = useMemo<TriageLevelKey>(() => {
    const tempNum = parseFloat(temperature);
    const sysNum = parseInt(systolicBP, 10);
    const diaNum = parseInt(diastolicBP, 10);
    const hrNum = parseInt(heartRate, 10);
    const o2Num = parseInt(spo2, 10);

    if (sysNum >= 200 || diaNum >= 120 || (o2Num > 0 && o2Num < 90)) {
      return 'ฉุกเฉินวิกฤต (Resuscitation)';
    }
    if (sysNum >= 160 || diaNum >= 100 || tempNum >= 39.0 || hrNum > 120) {
      return 'ฉุกเฉินเร่งด่วน (Urgent)';
    }
    if (tempNum >= 38.0 || sysNum >= 140 || diaNum >= 90 || hrNum > 100) {
      return 'กึ่งฉุกเฉิน (Semi-Urgent)';
    }
    return 'ปกติ (Normal)';
  }, [temperature, systolicBP, diastolicBP, heartRate, spo2]);

  // Handle Form Change
  const handleChangeField = (field: string, val: string | number) => {
    switch (field) {
      case 'weight':
        setWeight(String(val));
        break;
      case 'height':
        setHeight(String(val));
        break;
      case 'temperature':
        setTemperature(String(val));
        break;
      case 'systolicBP':
        setSystolicBP(String(val));
        break;
      case 'diastolicBP':
        setDiastolicBP(String(val));
        break;
      case 'heartRate':
        setHeartRate(String(val));
        break;
      case 'respiratoryRate':
        setRespiratoryRate(String(val));
        break;
      case 'spo2':
        setSpo2(String(val));
        break;
      case 'painScore':
        setPainScore(String(val));
        break;
      case 'bloodSugar':
        setBloodSugar(String(val));
        break;
      case 'chiefComplaint':
        setChiefComplaint(String(val));
        break;
      case 'allergies':
        setAllergies(String(val));
        break;
      case 'foodAllergies':
        setFoodAllergies(String(val));
        break;
      case 'medicalHistory':
        setMedicalHistory(String(val));
        break;
      case 'currentMedications':
        setCurrentMedications(String(val));
        break;
      case 'smokingHistory':
        setSmokingHistory(String(val));
        break;
      case 'alcoholHistory':
        setAlcoholHistory(String(val));
        break;
      case 'assignedDoctorId':
        setAssignedDoctorId(Number(val));
        break;
      default:
        break;
    }
  };

  // Form Randomizer
  const handleRandomVitals = () => {
    // 1. Random realistic measurements
    const randWeight = (50 + Math.random() * 28).toFixed(1);
    const randHeight = Math.floor(155 + Math.random() * 25).toString();
    const randTemp = (36.4 + Math.random() * 0.9).toFixed(1);
    const randSys = Math.floor(115 + Math.random() * 16).toString();
    const randDia = Math.floor(72 + Math.random() * 14).toString();
    const randHR = Math.floor(70 + Math.random() * 18).toString();
    const randRR = Math.floor(16 + Math.random() * 4).toString();
    const randSpo2 = Math.floor(97 + Math.random() * 3).toString();
    const randPain = Math.floor(Math.random() * 3).toString();
    const randDTX = Math.floor(95 + Math.random() * 25).toString();

    const sampleComplaints = [
      'มีไข้ ไอ เจ็บคอ มีน้ำมูกใส 2 วัน',
      'ปวดศีรษะ ปวดเมื่อยตามตัว มีไข้ต่ำๆ 1 วัน',
      'เวียนศีรษะ บ้านหมุน คลื่นไส้เล็กน้อยช่วงเช้า',
      'ปวดท้อง แน่นจุกเสียด ท้องอืดหลังรับประทานอาหาร',
      'ไอแห้ง ระคายคอ ไม่มีไข้ หายใจสะดวก 3 วัน',
      'ปวดหลัง ปวดบั้นเอวจากการยกของหนัก 2 วัน',
    ];
    const randComplaint = sampleComplaints[Math.floor(Math.random() * sampleComplaints.length)];

    setWeight(randWeight);
    setHeight(randHeight);
    setTemperature(randTemp);
    setSystolicBP(randSys);
    setDiastolicBP(randDia);
    setHeartRate(randHR);
    setRespiratoryRate(randRR);
    setSpo2(randSpo2);
    setPainScore(randPain);
    setBloodSugar(randDTX);
    if (!chiefComplaint || chiefComplaint.trim() === '') {
      setChiefComplaint(randComplaint);
    }
    if (!allergies) setAllergies('ปฏิเสธการแพ้ยา');
    if (!foodAllergies) setFoodAllergies('ปฏิเสธการแพ้อาหาร');
    if (!medicalHistory) setMedicalHistory('ปฏิเสธโรคประจำตัว');
    if (!currentMedications) setCurrentMedications('ไม่มี');
  };

  // Form Reset
  const handleResetForm = () => {
    try {
      localStorage.removeItem(VITALS_DRAFT_KEY);
    } catch {
      // ignore
    }
    setSelectedPatientId('');
    setSearchQuery('');
    setWeight('');
    setHeight('');
    setTemperature('');
    setSystolicBP('');
    setDiastolicBP('');
    setHeartRate('');
    setRespiratoryRate('');
    setSpo2('');
    setPainScore('');
    setBloodSugar('');
    setChiefComplaint('');
    setAllergies('');
    setFoodAllergies('');
    setMedicalHistory('');
    setCurrentMedications('');
    setSmokingHistory('');
    setAlcoholHistory('');
    setSelectedTriage('ปกติ (Normal)');
    setDraftSavedAt(null);
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) {
      alert('กรุณาเลือกคิวคนไข้ก่อนบันทึก');
      return;
    }

    setIsSaving(true);

    const docObj = doctorList.find((d) => d.doctorId === assignedDoctorId) || doctorList[0] || DEFAULT_DOCTORS[0];

    const numWeight = parseFloat(weight) || 0;
    const numHeight = parseFloat(height) || 0;
    const numTemp = parseFloat(temperature) || 36.5;
    const numSys = parseInt(systolicBP, 10) || 120;
    const numDia = parseInt(diastolicBP, 10) || 80;
    const numHR = parseInt(heartRate, 10) || 75;
    const numRR = parseInt(respiratoryRate, 10) || 18;
    const numSpO2 = parseInt(spo2, 10) || 98;
    const numPain = parseInt(painScore, 10) || 0;
    const numBS = parseInt(bloodSugar, 10) || 0;

    const targetPatientId = selectedPatient.patientId || parseInt(selectedPatient.id, 10) || 1;
    const targetQueueId = selectedPatient.queueId || (typeof selectedPatient.id === 'number' ? selectedPatient.id : parseInt(selectedPatient.id, 10));

    try {
      const res = await vitalsApi.record({
        queue_id: targetQueueId,
        patient_id: targetPatientId,
        queue_number: selectedPatient.queueNo,
        chief_complaint: chiefComplaint.trim() || 'ตรวจสุขภาพและคัดกรองทั่วไป',
        weight: numWeight,
        height: numHeight,
        temperature: numTemp,
        systolic_bp: numSys,
        diastolic_bp: numDia,
        heart_rate: numHR,
        respiratory_rate: numRR,
        spo2: numSpO2,
        pain_score: numPain,
        blood_sugar: numBS,
        allergies: allergies.trim() || selectedPatient.allergies,
        food_allergies: foodAllergies.trim(),
        medical_history: medicalHistory.trim() || selectedPatient.chronicDiseases,
        current_medications: currentMedications.trim(),
        smoking_history: smokingHistory.trim(),
        alcohol_history: alcoholHistory.trim(),
        assigned_doctor_id: docObj.doctorId,
        triage_level: selectedTriage,
      });

      // 1. ดึงรายการคิวล่าสุดจากฐานข้อมูลทันที
      const freshQueues = await fetchQueues();

      // 2. เคลียร์ฟอร์ม
      handleResetForm();

      // 3. หาคิวที่ยังรอคัดกรองอยู่จริง
      if (freshQueues && freshQueues.length > 0) {
        const remainingWaiting = freshQueues.filter((q) => q.queueStatus === 'รอคัดกรอง');
        if (remainingWaiting.length > 0) {
          handleSelectPatient(remainingWaiting[0]);
        } else {
          setSelectedPatientId('');
          setSearchQuery('');
        }
      } else {
        setSelectedPatientId('');
        setSearchQuery('');
      }
    } catch (err: any) {
      console.warn('Record vitals API error:', err);

      // Local fallback กรณีเครือข่ายมีปัญหา (อัปเดตเฉพาะคิวที่เลือกเท่านั้น ไม่อ้างอิงตาม patientId)
      const updatedQueueList = queueList.map((q) =>
        q.id === selectedPatient.id || (selectedPatient.queueId && q.queueId === selectedPatient.queueId) || q.queueNo === selectedPatient.queueNo
          ? { ...q, queueStatus: 'รอพบแพทย์' as const }
          : q
      );
      setQueueList(updatedQueueList);
      handleResetForm();

      const remainingQueues = updatedQueueList.filter((q) => q.queueStatus === 'รอคัดกรอง');
      if (remainingQueues.length > 0) {
        handleSelectPatient(remainingQueues[0]);
      } else {
        setSelectedPatientId('');
        setSearchQuery('');
      }
    }

    setIsSaving(false);
  };

  return (
    <div className="vitals-page-container">

      {/* 1. Header Banner */}
      <div className="vitals-page-header">
        <div className="vitals-title-group">
          <div className="vitals-title-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M4.5 3v5a4.5 4.5 0 009 0V3M9 12.5v3a4.5 4.5 0 009 0v-2"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="18" cy="13.5" r="2.5" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.15" />
              <path
                d="M3.5 3h2M12.5 3h2"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div>
            <h1 className="vitals-main-title">Screening & Vitals (บันทึกสัญญาณชีพ & คัดกรอง)</h1>
            <p className="vitals-main-subtitle">
              แบบฟอร์มคัดกรองสัญญาณชีพ ประเมินระดับความเร่งด่วน Triage และส่งต่อห้องตรวจแพทย์
            </p>
          </div>
        </div>

        <div className="vitals-header-meta">
          <div className="vitals-role-pill">
            <span className="nurse-dot"></span>
            <span>{currentUser?.roleTitleEn || 'Nurse'}</span>
          </div>
          <div className="vitals-user-pill">
            <span className="user-icon-symbol">
              <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
            </span>
            <span>{currentUser?.fullName || 'พว. กานดา คัดกรอง'}</span>
          </div>
        </div>
      </div>

      {/* 2. Main Two-Column Layout (Unified Screening Console) */}
      <div className="vitals-main-grid">
        {/* Left Column: Vital Signs Recording Form with Integrated Queue Selector */}
        <div className="vitals-grid-left">
          <VitalsFormCard
            selectedPatient={selectedPatient}
            queueList={queueList}
            filteredWaitingQueues={filteredWaitingQueues}
            searchQuery={searchQuery}
            isQueueDropdownOpen={isQueueDropdownOpen}
            onSearchQueryChange={setSearchQuery}
            onToggleQueueDropdown={(open) => setIsQueueDropdownOpen(open !== undefined ? open : !isQueueDropdownOpen)}
            onSelectPatient={handleSelectPatient}
            onResetSelection={handleResetForm}
            queueDropdownRef={queueDropdownRef}
            weight={weight}
            height={height}
            temperature={temperature}
            systolicBP={systolicBP}
            diastolicBP={diastolicBP}
            heartRate={heartRate}
            respiratoryRate={respiratoryRate}
            spo2={spo2}
            painScore={painScore}
            bloodSugar={bloodSugar}
            chiefComplaint={chiefComplaint}
            allergies={allergies}
            foodAllergies={foodAllergies}
            medicalHistory={medicalHistory}
            currentMedications={currentMedications}
            smokingHistory={smokingHistory}
            alcoholHistory={alcoholHistory}
            assignedDoctorId={assignedDoctorId}
            doctorOptions={doctorList}
            isAccordionOpen={isFormOpen}
            onToggleAccordion={() => setIsFormOpen(!isFormOpen)}
            onChangeField={handleChangeField}
            onRandomVitals={handleRandomVitals}
            onSubmit={handleSubmit}
            onReset={handleResetForm}
            isSaving={isSaving}
            savedDraftTime={draftSavedAt}
          />
        </div>

        {/* Right Column: Live Clinical Widgets */}
        <div className="vitals-grid-right">
          {/* BMI Live Calculator Widget */}
          <BMIWidget
            weight={weight}
            height={height}
            bmi={bmiValue}
            bmiInfo={bmiCategory}
          />

          {/* Triage Acuity Level Selection Widget */}
          <TriageWidget
            selectedTriage={selectedTriage}
            onSelectTriage={setSelectedTriage}
            suggestedLevel={suggestedTriageLevel}
          />
        </div>
      </div>
    </div>
  );
};
