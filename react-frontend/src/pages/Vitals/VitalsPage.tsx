import React, { useState, useMemo, useRef, useEffect } from 'react';
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
import './VitalsPage.css';

// Initial Mock Doctors
const DOCTOR_OPTIONS: DoctorOption[] = [
  { doctorId: 1, fullName: 'พญ.สุดา สุขสมบูรณ์', specialty: 'เวชปฏิบัติทั่วไป', roomName: 'ห้องตรวจ 1' },
  { doctorId: 2, fullName: 'นพ.วิชัย ชาญการแพทย์', specialty: 'อายุรกรรมทั่วไป', roomName: 'ห้องตรวจ 2' },
  { doctorId: 3, fullName: 'พญ.เกศรา พัฒนพงศ์', specialty: 'กุมารเวชศาสตร์', roomName: 'ห้องตรวจ 3' },
];

// Initial Mock Waiting Patients in Queue (matching QueuePage)
const INITIAL_QUEUE_PATIENTS: QueuePatientItem[] = [
  {
    id: 'q-1',
    queueNo: 'Q001',
    hn: 'HN-0001',
    fullName: 'นายสมชาย ใจดี',
    nationalId: '1-1002-34567-89-0',
    gender: 'ชาย',
    age: 45,
    phone: '081-234-5678',
    schemeType: 'บัตรทอง (สปสช.)',
    allergies: 'ปฏิเสธการแพ้ยา',
    chronicDiseases: 'ความดันโลหิตสูง',
    registeredTime: '08:30 น.',
    queueStatus: 'รอคัดกรอง',
  },
  {
    id: 'q-3',
    queueNo: 'Q003',
    hn: 'HN-0003',
    fullName: 'นายอาทิตย์ มีสุข',
    nationalId: '1-1014-55443-21-9',
    gender: 'ชาย',
    age: 52,
    phone: '089-876-5432',
    schemeType: 'ประกันสังคม (ม.33)',
    allergies: 'Penicillin',
    chronicDiseases: 'เบาหวานชนิดที่ 2',
    registeredTime: '08:50 น.',
    queueStatus: 'รอคัดกรอง',
  },
  {
    id: 'q-5',
    queueNo: 'Q005',
    hn: 'HN-0005',
    fullName: 'นายธนกฤต กิตติพงษ์',
    nationalId: '1-1033-77889-90-1',
    gender: 'ชาย',
    age: 28,
    phone: '082-111-2233',
    schemeType: 'ชำระเงินเอง',
    allergies: 'Sulfa',
    chronicDiseases: 'ไม่มี',
    registeredTime: '09:15 น.',
    queueStatus: 'รอคัดกรอง',
  },
  {
    id: 'q-7',
    queueNo: 'Q007',
    hn: 'HN-0007',
    fullName: 'นายณัฐวุฒิ สิทธิชัย',
    nationalId: '1-1055-44332-21-0',
    gender: 'ชาย',
    age: 36,
    phone: '086-444-5566',
    schemeType: 'สิทธิ์ข้าราชการ',
    allergies: 'ปฏิเสธการแพ้ยา',
    chronicDiseases: 'ภูมิแพ้อากาศ',
    registeredTime: '09:30 น.',
    queueStatus: 'รอคัดกรอง',
  },
];

export const VitalsPage: React.FC = () => {
  const { currentUser } = useAuth();

  // Queue & Patient State
  const [queueList, setQueueList] = useState<QueuePatientItem[]>(INITIAL_QUEUE_PATIENTS);
  const [selectedPatientId, setSelectedPatientId] = useState<string>(''); // No patient selected initially

  // Form State (empty initially, waiting for input)
  const [weight, setWeight] = useState<string>('');
  const [height, setHeight] = useState<string>('');
  const [temperature, setTemperature] = useState<string>('');
  const [systolicBP, setSystolicBP] = useState<string>('');
  const [diastolicBP, setDiastolicBP] = useState<string>('');
  const [heartRate, setHeartRate] = useState<string>('');
  const [respiratoryRate, setRespiratoryRate] = useState<string>('');
  const [spo2, setSpo2] = useState<string>('');
  const [chiefComplaint, setChiefComplaint] = useState<string>('');
  const [allergies, setAllergies] = useState<string>('');
  const [medicalHistory, setMedicalHistory] = useState<string>('');
  const [selectedTriage, setSelectedTriage] = useState<TriageLevelKey>('ปกติ (Normal)');
  const [assignedDoctorId, setAssignedDoctorId] = useState<number>(1);

  // Accordion and UI States
  const [isFormOpen, setIsFormOpen] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Searchable Queue Dropdown State (empty search initially)
  const [searchQuery, setSearchQuery] = useState<string>('');
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
    if (patient.allergies) setAllergies(patient.allergies);
    if (patient.chronicDiseases) setMedicalHistory(patient.chronicDiseases);
  };

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
      case 'chiefComplaint':
        setChiefComplaint(String(val));
        break;
      case 'allergies':
        setAllergies(String(val));
        break;
      case 'medicalHistory':
        setMedicalHistory(String(val));
        break;
      case 'assignedDoctorId':
        setAssignedDoctorId(Number(val));
        break;
      default:
        break;
    }
  };

  // Form Reset
  const handleResetForm = () => {
    setWeight('');
    setHeight('');
    setTemperature('');
    setSystolicBP('');
    setDiastolicBP('');
    setHeartRate('');
    setRespiratoryRate('');
    setSpo2('');
    setChiefComplaint('');
    setAllergies('');
    setMedicalHistory('');
    setSelectedTriage('ปกติ (Normal)');
  };

  // Submit Handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) {
      alert('กรุณาเลือกคิวคนไข้ก่อนบันทึก');
      return;
    }

    setIsSaving(true);

    const docObj = DOCTOR_OPTIONS.find((d) => d.doctorId === assignedDoctorId) || DOCTOR_OPTIONS[0];

    const newRecord: ScreeningRecord = {
      id: `scr-${Date.now()}`,
      visitId: Math.floor(100 + Math.random() * 900),
      queueNo: selectedPatient.queueNo,
      hn: selectedPatient.hn,
      patientName: selectedPatient.fullName,
      nationalId: selectedPatient.nationalId,
      age: selectedPatient.age,
      gender: selectedPatient.gender,
      screenedByUserName: currentUser?.fullName || 'พว. กานดา คัดกรอง',
      screenedByRole: currentUser?.roleTitleTh || 'พยาบาลคัดกรอง',
      triageLevel: selectedTriage,
      chiefComplaint: chiefComplaint.trim(),
      allergies: allergies.trim() || 'ปฏิเสธการแพ้ยา',
      medicalHistory: medicalHistory.trim() || 'ไม่มี',
      weight: parseFloat(weight) || 0,
      height: parseFloat(height) || 0,
      bmi: bmiValue ? parseFloat(bmiValue.toFixed(2)) : 0,
      temperature: parseFloat(temperature) || 36.5,
      systolicBP: parseInt(systolicBP, 10) || 120,
      diastolicBP: parseInt(diastolicBP, 10) || 80,
      heartRate: parseInt(heartRate, 10) || 75,
      respiratoryRate: parseInt(respiratoryRate, 10) || 18,
      spo2: parseInt(spo2, 10) || 98,
      assignedDoctorId: docObj.doctorId,
      assignedDoctorName: docObj.fullName,
      assignedRoom: docObj.roomName,
      screenedAt: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.',
    };

    setTimeout(() => {
      console.info('Screening record saved to backend:', newRecord);

      // Update queue status from 'รอคัดกรอง' to 'รอพบแพทย์'
      setQueueList((prev) =>
        prev.map((q) =>
          q.id === selectedPatient.id ? { ...q, queueStatus: 'รอพบแพทย์' } : q
        )
      );

      setIsSaving(false);
      setToastMessage(
        `บันทึกข้อมูลการคัดกรองของ ${selectedPatient.fullName} (${selectedPatient.queueNo}) สำเร็จ! ส่งต่อไปยัง ${docObj.roomName} (${docObj.fullName}) เรียบร้อยแล้ว`
      );

      // Auto clear selection and form
      handleResetForm();

      // Pick next available queue if any
      const remainingQueues = queueList.filter(
        (q) => q.id !== selectedPatient.id && q.queueStatus === 'รอคัดกรอง'
      );
      if (remainingQueues.length > 0) {
        handleSelectPatient(remainingQueues[0]);
      } else {
        setSelectedPatientId('');
      }

      // Auto dismiss toast after 5s
      setTimeout(() => setToastMessage(null), 5000);
    }, 400);
  };

  return (
    <div className="vitals-page-container">
      {/* Toast Alert Notification */}
      {toastMessage && (
        <div className="vitals-toast-alert">
          <div className="toast-icon">✓</div>
          <div className="toast-text">{toastMessage}</div>
          <button className="toast-close" onClick={() => setToastMessage(null)}>
            ×
          </button>
        </div>
      )}

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
            <span>{currentUser?.roleTitleEn ? `${currentUser.roleTitleEn} Station` : 'Triage Station'}</span>
          </div>
          <div className="vitals-user-pill">
            <span className="user-icon-symbol">{currentUser?.role === 'nurse_assistant' ? '🩺' : '👩‍⚕️'}</span>
            <span>{currentUser?.fullName || 'พว. กานดา คัดกรอง'}</span>
          </div>
        </div>
      </div>

      {/* 2. Top Queue Selector Section */}
      <div className="vitals-queue-selector-card">
        <div className="queue-selector-header">
          <label className="queue-selector-label" htmlFor="queue-select-input">
            เลือกคิวเพื่อคัดกรอง (Select Patient Queue) <span className="text-required">*</span>
          </label>
          <span className="queue-waiting-count">
            รอคัดกรอง: {queueList.filter((p) => p.queueStatus === 'รอคัดกรอง').length} คน
          </span>
        </div>

        <div className="queue-selector-row">
          <div className="queue-searchable-combobox" ref={queueDropdownRef}>
            <div className="combobox-input-wrap">
              <span className="combobox-search-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <input
                type="text"
                className="combobox-input"
                placeholder="พิมพ์ค้นหาด้วยเลขคิว (เช่น Q001), ชื่อผู้ป่วย, HN, หรือเลขบัตรประชาชน..."
                value={searchQuery}
                onFocus={() => setIsQueueDropdownOpen(true)}
                onClick={() => setIsQueueDropdownOpen(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsQueueDropdownOpen(true);
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="combobox-clear-btn"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedPatientId('');
                    setIsQueueDropdownOpen(true);
                  }}
                  title="ล้างการค้นหา"
                >
                  ×
                </button>
              )}
              <button
                type="button"
                className={`combobox-toggle-btn ${isQueueDropdownOpen ? 'open' : ''}`}
                onClick={() => setIsQueueDropdownOpen(!isQueueDropdownOpen)}
                title="เปิด/ปิด รายการคิว"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>

            {/* Dropdown Options Menu */}
            {isQueueDropdownOpen && (
              <div className="combobox-dropdown-menu">
                <div className="combobox-menu-header">
                  <span>ผู้ป่วยที่รอคัดกรอง ({filteredWaitingQueues.length} คิว)</span>
                  {searchQuery && <span className="search-hint">คลิกเพื่อเลือกผู้ป่วย</span>}
                </div>
                <div className="combobox-options-list">
                  {filteredWaitingQueues.length > 0 ? (
                    filteredWaitingQueues.map((patient) => {
                      const isSelected = selectedPatientId === patient.id;
                      return (
                        <div
                          key={patient.id}
                          className={`combobox-option-item ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleSelectPatient(patient)}
                        >
                          <div className="option-item-left">
                            <span className="option-queue-badge">{patient.queueNo}</span>
                            <div className="option-patient-info">
                              <span className="option-patient-name">{patient.fullName}</span>
                              <span className="option-patient-meta">
                                HN: {patient.hn} • {patient.gender}, {patient.age} ปี • {patient.schemeType}
                              </span>
                            </div>
                          </div>
                          <div className="option-item-right">
                            <span className="option-arrival-time">🕒 {patient.registeredTime}</span>
                            {isSelected ? (
                              <span className="option-selected-tag">✓ กำลังเลือก</span>
                            ) : (
                              <span className="option-select-action">เลือกคิวนี้</span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="combobox-empty-item">
                      <span>🔍 ไม่พบคิวผู้ป่วยที่ตรงกับคำค้นหา "{searchQuery}"</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Patient Identity Strip Banner */}
        {selectedPatient ? (
          <div className="patient-identity-strip">
            <div className="patient-strip-item">
              <span className="strip-label">รหัสประจำตัว (HN):</span>
              <span className="strip-val hn-val">{selectedPatient.hn}</span>
            </div>
            <div className="patient-strip-divider">|</div>
            <div className="patient-strip-item">
              <span className="strip-label">ชื่อ-นามสกุล:</span>
              <span className="strip-val name-val">{selectedPatient.fullName}</span>
            </div>
            <div className="patient-strip-divider">|</div>
            <div className="patient-strip-item">
              <span className="strip-label">อายุ / เพศ:</span>
              <span className="strip-val">
                {selectedPatient.age} ปี ({selectedPatient.gender})
              </span>
            </div>
            <div className="patient-strip-divider">|</div>
            <div className="patient-strip-item">
              <span className="strip-label">เลขบัตรประชาชน:</span>
              <span className="strip-val id-val">{selectedPatient.nationalId}</span>
            </div>
            <div className="patient-strip-divider">|</div>
            <div className="patient-strip-item">
              <span className="strip-label">สิทธิการรักษา:</span>
              <span className="strip-val scheme-val">{selectedPatient.schemeType}</span>
            </div>
          </div>
        ) : (
          <div className="patient-strip-empty">
            <span>ℹ️ ยังไม่ได้เลือกคิวผู้ป่วย — โปรดเลือกคิวจากเมนูด้านบนเพื่อเริ่มต้นคัดกรอง</span>
          </div>
        )}
      </div>

      {/* 3. Main Two-Column Layout */}
      <div className="vitals-main-grid">
        {/* Left Column: Vital Signs Recording Form */}
        <div className="vitals-grid-left">
          <VitalsFormCard
            selectedPatient={selectedPatient}
            weight={weight}
            height={height}
            temperature={temperature}
            systolicBP={systolicBP}
            diastolicBP={diastolicBP}
            heartRate={heartRate}
            respiratoryRate={respiratoryRate}
            spo2={spo2}
            chiefComplaint={chiefComplaint}
            allergies={allergies}
            medicalHistory={medicalHistory}
            assignedDoctorId={assignedDoctorId}
            doctorOptions={DOCTOR_OPTIONS}
            isAccordionOpen={isFormOpen}
            onToggleAccordion={() => setIsFormOpen(!isFormOpen)}
            onChangeField={handleChangeField}
            onSubmit={handleSubmit}
            onReset={handleResetForm}
            isSaving={isSaving}
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
