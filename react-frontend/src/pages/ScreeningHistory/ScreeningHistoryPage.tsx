import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import type {
  ScreeningHistoryItem,
  PatientProfileSummary,
  ScreeningStats,
  ClinicalRiskFilter,
  DateRangePreset,
  TriageLevelKey,
} from './types';
import { ScreeningStatsBanner } from './components/ScreeningStatsBanner';
import { PatientVitalsTrendCard } from './components/PatientVitalsTrendCard';
import { ScreeningDetailModal } from './components/ScreeningDetailModal';
import { vitalsApi, type BackendScreening } from '../../services/api';
import { useWebSocket } from '../../context/WebSocketContext';
import { formatQueueNo, formatNationalId, formatPhone, formatHN } from '../../utils/formatters';
import './ScreeningHistoryPage.css';

export { formatQueueNo };

const mapBackendScreeningToUI = (s: BackendScreening): ScreeningHistoryItem => {
  let dateOnly = 'วันนี้';
  let timeOnly = '09:00 น.';
  if (s.created_at) {
    try {
      const d = new Date(s.created_at);
      if (!isNaN(d.getTime())) {
        dateOnly = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear() + 543}`;
        timeOnly = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')} น.`;
      }
    } catch {
      dateOnly = s.created_at;
    }
  }

  const patient = s.visit_record?.patient;
  const birthYear = patient?.birthdate ? new Date(patient.birthdate).getFullYear() : 1990;
  const age = new Date().getFullYear() - birthYear;

  let bmiCat: 'ผอม' | 'ปกติ' | 'ท้วม (น้ำหนักเกิน)' | 'อ้วนระดับ 1' | 'อ้วนระดับ 2' = 'ปกติ';
  if (s.bmi < 18.5) bmiCat = 'ผอม';
  else if (s.bmi <= 22.9) bmiCat = 'ปกติ';
  else if (s.bmi <= 24.9) bmiCat = 'ท้วม (น้ำหนักเกิน)';
  else if (s.bmi <= 29.9) bmiCat = 'อ้วนระดับ 1';
  else bmiCat = 'อ้วนระดับ 2';

  const rawDocId = s.assigned_doctor_id || s.assigned_doctor?.id || 1;
  let roomNum = 1;
  let defaultDocName = 'พญ.สุดา สุขสมบูรณ์';
  if (rawDocId === 1 || rawDocId === 4) {
    roomNum = 1;
    defaultDocName = 'พญ.สุดา สุขสมบูรณ์';
  } else if (rawDocId === 2 || rawDocId === 5) {
    roomNum = 2;
    defaultDocName = 'นพ.วิชัย ชาญการแพทย์';
  } else if (rawDocId === 3 || rawDocId === 6) {
    roomNum = 3;
    defaultDocName = 'พญ.เกศรา รักษาดี';
  } else {
    roomNum = ((rawDocId - 1) % 3) + 1;
    defaultDocName = roomNum === 1 ? 'พญ.สุดา สุขสมบูรณ์' : roomNum === 2 ? 'นพ.วิชัย ชาญการแพทย์' : 'พญ.เกศรา รักษาดี';
  }

  const docName = s.assigned_doctor?.fullname || defaultDocName;
  const roomName = `ห้องตรวจ ${roomNum}`;
  const queueFormatted = formatQueueNo(s.visit_id || s.id || 1);
  const hnFormatted = patient?.hn ? formatHN(patient.hn) : formatHN(s.visit_record?.patient_id || s.id || 1);

  return {
    id: String(s.id),
    visitId: s.visit_id,
    visitDate: `${dateOnly} ${timeOnly}`,
    dateOnly,
    timeOnly,
    queueNo: queueFormatted,
    patientId: patient?.id || 1,
    hn: hnFormatted,
    nationalId: formatNationalId(patient?.national_id),
    patientName: patient?.fullname || 'ผู้ป่วย',
    gender: (patient?.gender as 'ชาย' | 'หญิง') || 'ชาย',
    age: age > 0 ? age : 40,
    phoneNumber: formatPhone(patient?.phone_number),
    schemeType: patient?.scheme_type || 'บัตรทอง (สปสช.)',
    weight: s.weight,
    height: s.height,
    bmi: s.bmi,
    bmiCategory: bmiCat,
    temperature: s.temperature,
    systolicBP: s.systolic_bp,
    diastolicBP: s.diastolic_bp,
    heartRate: s.heart_rate,
    respiratoryRate: s.respiratory_rate || 18,
    spo2: s.spo2 || 98,
    painScore: s.pain_score !== undefined ? s.pain_score : 0,
    bloodSugar: s.blood_sugar !== undefined ? s.blood_sugar : 0,
    triageLevel: (s.triage_level as TriageLevelKey) || 'ปกติ (Normal)',
    chiefComplaint: s.chief_complaint || 'ตรวจสุขภาพทั่วไป',
    allergies: s.allergies || 'ปฏิเสธการแพ้ยา',
    foodAllergies: s.food_allergies || 'ปฏิเสธการแพ้อาหาร',
    medicalHistory: s.medical_history || 'ไม่มี',
    currentMedications: s.current_medications || 'ไม่มี',
    smokingHistory: s.smoking_history || 'ไม่สูบ',
    alcoholHistory: s.alcohol_history || 'ไม่ดื่ม',
    nurseNotes: s.nurse_notes || 'สัญญาณชีพและประวัติได้รับการบันทึกเรียบร้อย',
    screenedByUserName: s.screened_by?.fullname || 'พว. กานดา คัดกรอง',
    screenedByRole: s.screened_by?.role === 'nurse' ? 'พยาบาลคัดกรอง' : 'ผู้ช่วยพยาบาล',
    assignedDoctorId: s.assigned_doctor_id || 1,
    assignedDoctorName: docName,
    assignedRoom: roomName,
  };
};

export const ScreeningHistoryPage: React.FC = () => {
  const { currentUser } = useAuth();

  // Records State from Live Backend
  const [records, setRecords] = useState<ScreeningHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // ดึงประวัติการคัดกรองจาก Backend DB จริง
  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await vitalsApi.getAllHistory();
      if (Array.isArray(data)) {
        setRecords(data.map(mapBackendScreeningToUI));
      }
    } catch (err) {
      console.warn('Could not fetch screening history from backend:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const { subscribe } = useWebSocket();

  useEffect(() => {
    fetchHistory();

    // ดักฟัง Real-time เมื่อมีการบันทึกคัดกรองหรือสัญญาณชีพใหม่
    const unsubVitals = subscribe('VITALS_RECORDED', () => {
      fetchHistory();
    });

    return () => {
      unsubVitals();
    };
  }, [fetchHistory, subscribe]);

  // Search & Filter State
  const [searchInput, setSearchInput] = useState<string>('');
  const [appliedSearch, setAppliedSearch] = useState<string>('');
  const [selectedTriage, setSelectedTriage] = useState<string>('all');
  const [selectedRisk, setSelectedRisk] = useState<ClinicalRiskFilter>('all');
  const [selectedDatePreset, setSelectedDatePreset] = useState<DateRangePreset>('all');

  // Modal State
  const [selectedRecordForDetail, setSelectedRecordForDetail] = useState<ScreeningHistoryItem | null>(null);

  // Accordion Dropdown State
  const [isTableOpen, setIsTableOpen] = useState<boolean>(true);

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);

  // Handle Search Form Submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedSearch(searchInput.trim());
    setCurrentPage(1);
  };

  // Clear Search
  const handleClearSearch = () => {
    setSearchInput('');
    setAppliedSearch('');
    setCurrentPage(1);
  };

  // Filter Records
  const filteredRecords = useMemo(() => {
    const now = new Date();
    const day = now.getDate().toString().padStart(2, '0');
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const yearBE = (now.getFullYear() + 543).toString();
    const yearCE = now.getFullYear().toString();
    const todayPatternBE = `${day}/${month}/${yearBE}`;
    const todayPatternCE = `${day}/${month}/${yearCE}`;
    const monthPatternBE = `/${month}/${yearBE}`;
    const monthPatternCE = `/${month}/${yearCE}`;

    return records.filter((item) => {
      // 1. Text Search (National ID, HN, Name, Phone)
      if (appliedSearch) {
        const query = appliedSearch.toLowerCase().replace(/[- ]/g, '');
        const normNationalId = item.nationalId.toLowerCase().replace(/[- ]/g, '');
        const normName = item.patientName.toLowerCase();
        const normPhone = item.phoneNumber.replace(/[- ]/g, '');
        const normQueue = item.queueNo.toLowerCase();

        const match =
          normNationalId.includes(query) ||
          normName.includes(query) ||
          normPhone.includes(query) ||
          normQueue.includes(query);

        if (!match) return false;
      }

      // 2. Date Range Preset Filter (Dynamic Real Date Comparison)
      if (selectedDatePreset === 'today') {
        if (item.dateOnly !== todayPatternBE && item.dateOnly !== todayPatternCE && item.dateOnly !== 'วันนี้') {
          return false;
        }
      } else if (selectedDatePreset === 'this-month') {
        if (!item.dateOnly.includes(monthPatternBE) && !item.dateOnly.includes(monthPatternCE) && item.dateOnly !== 'วันนี้') {
          return false;
        }
      }

      // 3. Triage Filter
      if (selectedTriage !== 'all') {
        if (!item.triageLevel.includes(selectedTriage)) return false;
      }

      // 4. Clinical Risk Filter
      if (selectedRisk === 'high-bp') {
        if (item.systolicBP < 140 && item.diastolicBP < 90) return false;
      } else if (selectedRisk === 'fever') {
        if (item.temperature < 37.5) return false;
      } else if (selectedRisk === 'tachycardia') {
        if (item.heartRate <= 100) return false;
      } else if (selectedRisk === 'has-allergy') {
        if (!item.allergies || item.allergies === 'ปฏิเสธการแพ้ยา' || item.allergies === 'ไม่มี') return false;
      }

      return true;
    });
  }, [records, appliedSearch, selectedDatePreset, selectedTriage, selectedRisk]);

  // Total Statistics (Dynamically calculated to match actual records in database)
  const stats: ScreeningStats = useMemo(() => {
    const total = records.length;
    const thisMonth = records.filter((r) => r.dateOnly.includes('/2026') || r.dateOnly.includes('วันนี้')).length;
    const highBPCount = records.filter((r) => r.systolicBP >= 140 || r.diastolicBP >= 90).length;
    const urgentCount = records.filter(
      (r) => r.triageLevel.includes('ฉุกเฉิน') || r.triageLevel.includes('วิกฤต') || r.triageLevel.includes('เร่งด่วน')
    ).length;
    const allergyCount = records.filter(
      (r) => r.allergies && r.allergies !== 'ปฏิเสธการแพ้ยา' && r.allergies !== 'ไม่มี'
    ).length;

    return {
      totalRecords: total,
      thisMonthRecords: thisMonth,
      highBPRatePercent: total > 0 ? Math.round((highBPCount / total) * 100) : 0,
      urgentTriageCount: urgentCount,
      allergyPatientsCount: allergyCount,
    };
  }, [records]);

  // Check if search matches a specific single patient
  const matchedPatientProfile: PatientProfileSummary | null = useMemo(() => {
    if (!appliedSearch) return null;
    const patientRecords = filteredRecords;
    if (patientRecords.length === 0) return null;

    // Check if all filtered records belong to the same patient
    const firstNationalId = patientRecords[0].nationalId;
    const isSinglePatient = patientRecords.every((r) => r.nationalId === firstNationalId);

    if (!isSinglePatient) return null;

    const p = patientRecords[0];
    const avgSys = Math.round(patientRecords.reduce((acc, cur) => acc + cur.systolicBP, 0) / patientRecords.length);
    const avgDia = Math.round(patientRecords.reduce((acc, cur) => acc + cur.diastolicBP, 0) / patientRecords.length);
    const avgBMI = parseFloat((patientRecords.reduce((acc, cur) => acc + cur.bmi, 0) / patientRecords.length).toFixed(2));

    return {
      patientId: p.patientId,
      nationalId: p.nationalId,
      fullName: p.patientName,
      age: p.age,
      gender: p.gender,
      phoneNumber: p.phoneNumber,
      schemeType: p.schemeType,
      allergies: p.allergies,
      chronicDiseases: p.medicalHistory,
      totalVisits: patientRecords.length,
      lastVisitDate: patientRecords[0].dateOnly,
      averageBP: `${avgSys}/${avgDia} mmHg`,
      averageBMI: avgBMI,
      weightTrend: 'stable',
    };
  }, [appliedSearch, filteredRecords]);

  // Pagination Calculation
  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRecords.slice(start, start + itemsPerPage);
  }, [filteredRecords, currentPage, itemsPerPage]);

  return (
    <div className="scr-history-container">
      {/* 1. Page Header */}
      <div className="scr-header-wrap">
        <div className="scr-header-title-block">
          <div className="scr-badge-role">
            <span className="role-dot"></span>
            <span>{currentUser?.roleTitleEn ? `${currentUser.roleTitleEn} Station • แดชบอร์ดคัดกรอง` : 'Nurse Station • แดชบอร์ดคัดกรอง'}</span>
          </div>
          <h1 className="scr-page-title">Screening History Dashboard</h1>
          <p className="scr-page-subtitle">
            สืบค้นและตรวจสอบประวัติการตรวจวัดสัญญาณชีพและการคัดกรองย้อนหลังของผู้ป่วย
          </p>
        </div>
      </div>

      {/* 2. Top Statistics Summary Banner */}
      <ScreeningStatsBanner stats={stats} />

      {/* 3. Search & Filters Card */}
      <div className="scr-search-card">
        <form onSubmit={handleSearchSubmit} className="scr-search-form">
          <div className="scr-search-input-group">
            <span className="search-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M21 21l-4.35-4.35M19 11a8 8 0 11-16 0 8 8 0 0116 0z"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <input
              type="text"
              className="scr-search-input"
              placeholder="Search by National ID (เลขบัตรประชาชน เช่น 0-1234-56789-01-2), ชื่อ-นามสกุล, หรือเบอร์โทร..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            {searchInput && (
              <button
                type="button"
                className="btn-clear-search"
                onClick={handleClearSearch}
                title="ล้างคำค้นหา"
                aria-label="ล้างคำค้นหา"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            )}
            <button type="submit" className="btn-search-submit">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M21 21l-4.35-4.35M19 11a8 8 0 11-16 0 8 8 0 0116 0z"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              </svg>
              <span>ค้นหา (Search)</span>
            </button>
          </div>
        </form>

        {/* Quick Filter Bar */}
        <div className="scr-filter-toolbar">
          {/* Date Filter Group */}
          <div className="filter-group">
            <span className="filter-label">ช่วงเวลา:</span>
            <div className="filter-chips">
              <button
                type="button"
                className={`filter-chip ${selectedDatePreset === 'all' ? 'active' : ''}`}
                onClick={() => setSelectedDatePreset('all')}
              >
                ทั้งหมด
              </button>
              <button
                type="button"
                className={`filter-chip ${selectedDatePreset === 'today' ? 'active' : ''}`}
                onClick={() => setSelectedDatePreset('today')}
              >
                วันนี้
              </button>
              <button
                type="button"
                className={`filter-chip ${selectedDatePreset === 'this-month' ? 'active' : ''}`}
                onClick={() => setSelectedDatePreset('this-month')}
              >
                เดือนนี้
              </button>
            </div>
          </div>

          {/* Triage Level Filter */}
          <div className="filter-group">
            <span className="filter-label">ระดับความเร่งด่วน:</span>
            <div className="filter-chips">
              <button
                type="button"
                className={`filter-chip ${selectedTriage === 'all' ? 'active' : ''}`}
                onClick={() => setSelectedTriage('all')}
              >
                ทั้งหมด
              </button>
              <button
                type="button"
                className={`filter-chip chip-red ${selectedTriage === 'ฉุกเฉิน' ? 'active' : ''}`}
                onClick={() => setSelectedTriage('ฉุกเฉิน')}
              >
                ฉุกเฉิน / วิกฤต
              </button>
              <button
                type="button"
                className={`filter-chip chip-yellow ${selectedTriage === 'กึ่ง' ? 'active' : ''}`}
                onClick={() => setSelectedTriage('กึ่ง')}
              >
                กึ่งฉุกเฉิน
              </button>
              <button
                type="button"
                className={`filter-chip chip-green ${selectedTriage === 'ปกติ' ? 'active' : ''}`}
                onClick={() => setSelectedTriage('ปกติ')}
              >
                ปกติ (Normal)
              </button>
            </div>
          </div>

          {/* Clinical Risk Filter */}
          <div className="filter-group">
            <span className="filter-label">ความเสี่ยงทางคลินิก:</span>
            <div className="filter-chips">
              <button
                type="button"
                className={`filter-chip ${selectedRisk === 'all' ? 'active' : ''}`}
                onClick={() => setSelectedRisk('all')}
              >
                ทั้งหมด
              </button>
              <button
                type="button"
                className={`filter-chip ${selectedRisk === 'high-bp' ? 'active' : ''}`}
                onClick={() => setSelectedRisk('high-bp')}
              >
                ความดันสูง
              </button>
              <button
                type="button"
                className={`filter-chip ${selectedRisk === 'fever' ? 'active' : ''}`}
                onClick={() => setSelectedRisk('fever')}
              >
                มีไข้ (&gt; 37.5°C)
              </button>
              <button
                type="button"
                className={`filter-chip ${selectedRisk === 'has-allergy' ? 'active' : ''}`}
                onClick={() => setSelectedRisk('has-allergy')}
              >
                มีประวัติแพ้ยา
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4. If Search matched a specific single patient -> Show Patient Profile & Vitals Trend Banner */}
      {matchedPatientProfile && (
        <PatientVitalsTrendCard
          profile={matchedPatientProfile}
          records={filteredRecords}
          onClearPatientFilter={handleClearSearch}
        />
      )}

      {/* 5. Main Screening History Table Card (Dropdown Accordion) */}
      <div className="scr-table-card">
        <div
          className="scr-table-header-row"
          onClick={() => setIsTableOpen(!isTableOpen)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setIsTableOpen(!isTableOpen);
            }
          }}
          aria-expanded={isTableOpen}
        >
          <div className="scr-table-title-wrap">
            <div className="scr-header-icon-box emerald-box">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <div className="scr-title-badge-flex">
                <h3 className="scr-table-title">
                  รายการประวัติการคัดกรองสัญญาณชีพ
                </h3>
                <span className="scr-table-count-badge">
                  พบ {filteredRecords.length} รายการ
                </span>
              </div>
              <p className="scr-table-subtitle">
                ตารางบันทึกประวัติสัญญาณชีพ ผลการคัดแยกความเร่งด่วน Triage และการส่งตรวจห้องแพทย์
              </p>
            </div>
          </div>

          <div className="scr-table-controls" onClick={(e) => e.stopPropagation()}>
            <div className="items-per-page-wrap">
              <span className="ctrl-label">แสดง:</span>
              <select
                className="items-select"
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
              >
                <option value={5}>5 แถว</option>
                <option value={10}>10 แถว</option>
                <option value={20}>20 แถว</option>
                <option value={50}>50 แถว</option>
              </select>
            </div>

            <button
              type="button"
              className={`scr-card-toggle ${isTableOpen ? 'open' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                setIsTableOpen(!isTableOpen);
              }}
              aria-label="Toggle Table Accordion"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19.5 8.25l-7.5 7.5-7.5-7.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Dropdown Body Content */}
        {isTableOpen && (
          <div className="scr-table-body-expanded">
            <div className="scr-table-responsive-container">
              <table className="scr-history-table">
                <thead>
              <tr>
                <th style={{ width: '130px' }}>วันที่-เวลา</th>
                <th style={{ width: '190px' }}>ชื่อ-นามสกุล</th>
                <th style={{ width: '160px', textAlign: 'center' }}>น้ำหนัก / ส่วนสูง</th>
                <th style={{ width: '135px', textAlign: 'center' }}>Systolic BP</th>
                <th style={{ width: '135px', textAlign: 'center' }}>Diastolic BP</th>
                <th style={{ width: '140px', textAlign: 'center' }}>ระดับความเร่งด่วน</th>
                <th>อาการสำคัญ (CC)</th>
                <th style={{ width: '130px', textAlign: 'center', paddingRight: '22px' }}>รายละเอียด</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRecords.length > 0 ? (
                paginatedRecords.map((item) => {
                  const isHighSys = item.systolicBP >= 140;
                  const isHighDia = item.diastolicBP >= 90;
                  const isCrisis = item.systolicBP >= 180 || item.diastolicBP >= 110;

                  const isUrgent = item.triageLevel.includes('เร่งด่วน') || item.triageLevel.includes('วิกฤต');
                  const isSemi = item.triageLevel.includes('กึ่ง');
                  const triageClass = isUrgent
                    ? 'triage-badge-orange'
                    : isSemi
                    ? 'triage-badge-yellow'
                    : 'triage-badge-green';

                  return (
                    <tr key={item.id} className="scr-table-row">
                      {/* Date */}
                      <td>
                        <div className="scr-date-cell">
                          <span className="date-main">{item.dateOnly}</span>
                          <span className="date-time">{item.timeOnly}</span>
                        </div>
                      </td>

                      {/* Patient Name & National ID */}
                      <td>
                        <div className="scr-patient-cell">
                          <span className="patient-name">{item.patientName}</span>
                          <span className="patient-id-code">{item.nationalId}</span>
                        </div>
                      </td>

                      {/* Weight / Height & BMI (Centered) */}
                      <td style={{ textAlign: 'center' }}>
                        <div className="scr-measure-cell centered">
                          <span className="wt-ht-val">
                            {item.weight.toFixed(1)} kg / {item.height.toFixed(0)} cm
                          </span>
                          {/* <span className="bmi-sub-tag">
                            BMI {item.bmi} ({item.bmiCategory.split(' ')[0]})
                          </span> */}
                        </div>
                      </td>

                      {/* Systolic BP (Centered Mono Text) */}
                      <td style={{ textAlign: 'center' }}>
                        <div className="scr-bp-cell centered">
                          <span className="bp-mono-val">
                            {item.systolicBP} <span className="bp-mono-unit">mmHg</span>
                          </span>
                        </div>
                      </td>

                      {/* Diastolic BP (Centered Mono Text) */}
                      <td style={{ textAlign: 'center' }}>
                        <div className="scr-bp-cell centered">
                          <span className="bp-mono-val">
                            {item.diastolicBP} <span className="bp-mono-unit">mmHg</span>
                          </span>
                        </div>
                      </td>

                      {/* Triage Acuity (Centered) */}
                      <td style={{ textAlign: 'center' }}>
                        <div className="scr-triage-cell-wrap">
                          <span className={`table-triage-badge ${triageClass}`}>
                            {item.triageLevel.split(' ')[0]}
                          </span>
                        </div>
                      </td>

                      {/* Chief Complaint */}
                      <td>
                        <span className="scr-cc-cell" title={item.chiefComplaint}>
                          {item.chiefComplaint}
                        </span>
                      </td>

                      {/* More Info Action Button (Thai text & adjusted spacing) */}
                      <td className="scr-action-cell">
                        <button
                          type="button"
                          className="btn-more-info"
                          onClick={() => setSelectedRecordForDetail(item)}
                          title="ดูรายละเอียดผลการคัดกรองฉบับเต็ม"
                        >
                          ดูรายละเอียด
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="scr-table-empty">
                    <div className="empty-wrap">
                      <span className="empty-icon">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="11" cy="11" r="8" />
                          <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                      </span>
                      <p className="empty-main">ไม่พบประวัติการคัดกรองที่ตรงกับเงื่อนไขการค้นหา</p>
                      <p className="empty-sub">ลองตรวจสอบคำค้นหา หรือรีเซ็ตตัวกรองเพื่อดูข้อมูลทั้งหมด</p>
                      {appliedSearch && (
                        <button
                          type="button"
                          className="btn-reset-filters"
                          onClick={handleClearSearch}
                        >
                          ล้างคำค้นหาและแสดงทั้งหมด
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {filteredRecords.length > 0 && (
          <div className="scr-pagination-bar">
            <div className="pagination-info">
              แสดงหน้า <strong>{currentPage}</strong> จากทั้งหมด <strong>{totalPages}</strong> หน้า (
              {filteredRecords.length} รายการ)
            </div>

            <div className="pagination-buttons">
              <button
                type="button"
                className="page-btn nav-btn"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              >
                Previous
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                <button
                  key={pageNum}
                  type="button"
                  className={`page-btn num-btn ${currentPage === pageNum ? 'active' : ''}`}
                  onClick={() => setCurrentPage(pageNum)}
                >
                  {pageNum}
                </button>
              ))}

              <button
                type="button"
                className="page-btn nav-btn"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              >
                Next
              </button>
            </div>
          </div>
        )}
          </div>
        )}
      </div>

      {/* 6. Screening Detail Modal Drawer */}
      <ScreeningDetailModal
        record={selectedRecordForDetail}
        onClose={() => setSelectedRecordForDetail(null)}
      />
    </div>
  );
};
