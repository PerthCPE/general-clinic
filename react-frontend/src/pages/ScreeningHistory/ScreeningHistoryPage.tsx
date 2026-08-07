import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import type {
  ScreeningHistoryItem,
  PatientProfileSummary,
  ScreeningStats,
  ClinicalRiskFilter,
  DateRangePreset,
} from './types';
import { ScreeningStatsBanner } from './components/ScreeningStatsBanner';
import { PatientVitalsTrendCard } from './components/PatientVitalsTrendCard';
import { ScreeningDetailModal } from './components/ScreeningDetailModal';
import './ScreeningHistoryPage.css';

// Rich Mock Screening History Records
const MOCK_SCREENING_RECORDS: ScreeningHistoryItem[] = [
  {
    id: 'scr-101',
    visitId: 501,
    visitDate: '24/07/2026 09:30 น.',
    dateOnly: '24/07/2026',
    timeOnly: '09:30 น.',
    queueNo: 'Q001',
    patientId: 1,
    nationalId: '0-1234-56789-01-2',
    patientName: 'นายสมชาย ใจดี',
    gender: 'ชาย',
    age: 45,
    phoneNumber: '081-234-5678',
    schemeType: 'บัตรทอง (สปสช.)',
    weight: 70.0,
    height: 175.0,
    bmi: 22.86,
    bmiCategory: 'ปกติ',
    temperature: 36.6,
    systolicBP: 128,
    diastolicBP: 84,
    heartRate: 74,
    respiratoryRate: 18,
    spo2: 99,
    triageLevel: 'ปกติ (Normal)',
    chiefComplaint: 'มาตรวจสุขภาพประจำปี รู้สึกอ่อนเพลียเล็กน้อย',
    allergies: 'ปฏิเสธการแพ้ยา',
    medicalHistory: 'ความดันโลหิตสูง (คุมได้ดี)',
    nurseNotes: 'สัญญาณชีพปกติ แนะนำออกกำลังกายสม่ำเสมอ',
    screenedByUserName: 'พว. กานดา คัดกรอง',
    screenedByRole: 'พยาบาลคัดกรอง',
    assignedDoctorId: 1,
    assignedDoctorName: 'พญ.สุดา สุขสมบูรณ์',
    assignedRoom: 'ห้องตรวจ 1',
  },
  {
    id: 'scr-102',
    visitId: 460,
    visitDate: '10/06/2026 10:15 น.',
    dateOnly: '10/06/2026',
    timeOnly: '10:15 น.',
    queueNo: 'Q012',
    patientId: 1,
    nationalId: '0-1234-56789-01-2',
    patientName: 'นายสมชาย ใจดี',
    gender: 'ชาย',
    age: 45,
    phoneNumber: '081-234-5678',
    schemeType: 'บัตรทอง (สปสช.)',
    weight: 72.5,
    height: 175.0,
    bmi: 23.67,
    bmiCategory: 'ท้วม (น้ำหนักเกิน)',
    temperature: 36.8,
    systolicBP: 138,
    diastolicBP: 88,
    heartRate: 78,
    respiratoryRate: 18,
    spo2: 98,
    triageLevel: 'กึ่งฉุกเฉิน (Semi-Urgent)',
    chiefComplaint: 'ปวดศีรษะท้ายทอยช่วงบ่าย ทานยาแก้ปวดแล้วไม่ดีขึ้น',
    allergies: 'ปฏิเสธการแพ้ยา',
    medicalHistory: 'ความดันโลหิตสูง',
    nurseNotes: 'ความดันค่อนข้างสูง ให้นั่งพัก 15 นาทีแล้ววัดซ้ำได้ 134/86',
    screenedByUserName: 'พว. กานดา คัดกรอง',
    screenedByRole: 'พยาบาลคัดกรอง',
    assignedDoctorId: 2,
    assignedDoctorName: 'นพ.วิชัย ชาญการแพทย์',
    assignedRoom: 'ห้องตรวจ 2',
  },
  {
    id: 'scr-103',
    visitId: 390,
    visitDate: '15/04/2026 08:45 น.',
    dateOnly: '15/04/2026',
    timeOnly: '08:45 น.',
    queueNo: 'Q004',
    patientId: 1,
    nationalId: '0-1234-56789-01-2',
    patientName: 'นายสมชาย ใจดี',
    gender: 'ชาย',
    age: 45,
    phoneNumber: '081-234-5678',
    schemeType: 'บัตรทอง (สปสช.)',
    weight: 74.0,
    height: 175.0,
    bmi: 24.16,
    bmiCategory: 'ท้วม (น้ำหนักเกิน)',
    temperature: 36.5,
    systolicBP: 142,
    diastolicBP: 92,
    heartRate: 82,
    respiratoryRate: 19,
    spo2: 98,
    triageLevel: 'กึ่งฉุกเฉิน (Semi-Urgent)',
    chiefComplaint: 'ติดตามผลการรักษาความดันโลหิตสูงตามนัด',
    allergies: 'ปฏิเสธการแพ้ยา',
    medicalHistory: 'ความดันโลหิตสูง',
    nurseNotes: 'ยังคงมีภาวะความดันโลหิตสูง แนะนำจำกัดอาหารเค็ม',
    screenedByUserName: 'พว. สมรักษ์ บริบาล',
    screenedByRole: 'พยาบาลวิชาชีพ',
    assignedDoctorId: 2,
    assignedDoctorName: 'นพ.วิชัย ชาญการแพทย์',
    assignedRoom: 'ห้องตรวจ 2',
  },
  {
    id: 'scr-104',
    visitId: 508,
    visitDate: '06/08/2026 08:50 น.',
    dateOnly: '06/08/2026',
    timeOnly: '08:50 น.',
    queueNo: 'Q003',
    patientId: 2,
    nationalId: '1-1014-55443-21-9',
    patientName: 'นายอาทิตย์ มีสุข',
    gender: 'ชาย',
    age: 52,
    phoneNumber: '089-876-5432',
    schemeType: 'ประกันสังคม (ม.33)',
    weight: 68.0,
    height: 172.0,
    bmi: 22.99,
    bmiCategory: 'ปกติ',
    temperature: 36.8,
    systolicBP: 124,
    diastolicBP: 82,
    heartRate: 78,
    respiratoryRate: 18,
    spo2: 98,
    triageLevel: 'ปกติ (Normal)',
    chiefComplaint: 'ปวดศีรษะข้างขวา และมีอาการอ่อนเพลีย',
    allergies: 'Penicillin',
    medicalHistory: 'เบาหวานชนิดที่ 2',
    nurseNotes: 'แจ้งแพทย์ระวังประวัติแพ้ยา Penicillin',
    screenedByUserName: 'พว. กานดา คัดกรอง',
    screenedByRole: 'พยาบาลคัดกรอง',
    assignedDoctorId: 1,
    assignedDoctorName: 'พญ.สุดา สุขสมบูรณ์',
    assignedRoom: 'ห้องตรวจ 1',
  },
  {
    id: 'scr-105',
    visitId: 440,
    visitDate: '20/05/2026 09:10 น.',
    dateOnly: '20/05/2026',
    timeOnly: '09:10 น.',
    queueNo: 'Q006',
    patientId: 2,
    nationalId: '1-1014-55443-21-9',
    patientName: 'นายอาทิตย์ มีสุข',
    gender: 'ชาย',
    age: 52,
    phoneNumber: '089-876-5432',
    schemeType: 'ประกันสังคม (ม.33)',
    weight: 69.5,
    height: 172.0,
    bmi: 23.49,
    bmiCategory: 'ท้วม (น้ำหนักเกิน)',
    temperature: 37.0,
    systolicBP: 130,
    diastolicBP: 85,
    heartRate: 80,
    respiratoryRate: 18,
    spo2: 99,
    triageLevel: 'ปกติ (Normal)',
    chiefComplaint: 'เจาะเลือดตรวจค่าน้ำตาลสะสม (HbA1c) ตามนัด',
    allergies: 'Penicillin',
    medicalHistory: 'เบาหวานชนิดที่ 2',
    nurseNotes: 'งดน้ำและอาหารมาตั้งแต่ 22:00 น.',
    screenedByUserName: 'พว. กานดา คัดกรอง',
    screenedByRole: 'พยาบาลคัดกรอง',
    assignedDoctorId: 1,
    assignedDoctorName: 'พญ.สุดา สุขสมบูรณ์',
    assignedRoom: 'ห้องตรวจ 1',
  },
  {
    id: 'scr-106',
    visitId: 512,
    visitDate: '06/08/2026 09:15 น.',
    dateOnly: '06/08/2026',
    timeOnly: '09:15 น.',
    queueNo: 'Q005',
    patientId: 3,
    nationalId: '1-1033-77889-90-1',
    patientName: 'นายธนกฤต กิตติพงษ์',
    gender: 'ชาย',
    age: 28,
    phoneNumber: '082-111-2233',
    schemeType: 'ชำระเงินเอง',
    weight: 64.0,
    height: 178.0,
    bmi: 20.20,
    bmiCategory: 'ปกติ',
    temperature: 38.6,
    systolicBP: 118,
    diastolicBP: 76,
    heartRate: 104,
    respiratoryRate: 22,
    spo2: 97,
    triageLevel: 'ฉุกเฉินเร่งด่วน (Urgent)',
    chiefComplaint: 'มีไข้สูง หนาวสั่น เจ็บคอมาก ไอแห้ง 2 วัน',
    allergies: 'Sulfa',
    medicalHistory: 'ไม่มี',
    nurseNotes: 'ไข้สูง 38.6 °C ชีพจรเร็ว 104 bpm ส่งตรวจด่วน',
    screenedByUserName: 'พว. กานดา คัดกรอง',
    screenedByRole: 'พยาบาลคัดกรอง',
    assignedDoctorId: 3,
    assignedDoctorName: 'พญ.เกศรา พัฒนพงศ์',
    assignedRoom: 'ห้องตรวจ 3',
  },
  {
    id: 'scr-107',
    visitId: 510,
    visitDate: '06/08/2026 09:05 น.',
    dateOnly: '06/08/2026',
    timeOnly: '09:05 น.',
    queueNo: 'Q004',
    patientId: 4,
    nationalId: '5-1020-11223-34-5',
    patientName: 'นางสมศรี รักษาดี',
    gender: 'หญิง',
    age: 61,
    phoneNumber: '084-555-6677',
    schemeType: 'บัตรทอง (สปสช.)',
    weight: 68.5,
    height: 155.0,
    bmi: 28.51,
    bmiCategory: 'อ้วน ระดับ 1',
    temperature: 37.1,
    systolicBP: 162,
    diastolicBP: 98,
    heartRate: 88,
    respiratoryRate: 20,
    spo2: 97,
    triageLevel: 'กึ่งฉุกเฉิน (Semi-Urgent)',
    chiefComplaint: 'เวียนศีรษะ บ้านหมุน ความดันโลหิตสูงต่อเนื่อง',
    allergies: 'Aspirin',
    medicalHistory: 'ความดันโลหิตสูง, ไขมันในเลือดสูง',
    nurseNotes: 'ความดันสูง 162/98 นั่งพักแล้วยังสูงอยู่',
    screenedByUserName: 'พว. กานดา คัดกรอง',
    screenedByRole: 'พยาบาลคัดกรอง',
    assignedDoctorId: 2,
    assignedDoctorName: 'นพ.วิชัย ชาญการแพทย์',
    assignedRoom: 'ห้องตรวจ 2',
  },
  {
    id: 'scr-108',
    visitId: 490,
    visitDate: '28/07/2026 10:30 น.',
    dateOnly: '28/07/2026',
    timeOnly: '10:30 น.',
    queueNo: 'Q015',
    patientId: 5,
    nationalId: '3-1005-98765-43-2',
    patientName: 'นางสาววิภาดา มณีรัตน์',
    gender: 'หญิง',
    age: 34,
    phoneNumber: '083-999-8877',
    schemeType: 'ประกันสังคม (ม.33)',
    weight: 54.0,
    height: 162.0,
    bmi: 20.58,
    bmiCategory: 'ปกติ',
    temperature: 36.6,
    systolicBP: 116,
    diastolicBP: 74,
    heartRate: 72,
    respiratoryRate: 18,
    spo2: 99,
    triageLevel: 'ปกติ (Normal)',
    chiefComplaint: 'ปวดศีรษะตื้อๆ ท้ายทอย เป็นมา 1 วัน ไม่มีไข้',
    allergies: 'ปฏิเสธการแพ้ยา',
    medicalHistory: 'ไม่มี',
    nurseNotes: 'อาการปวดกล้ามเนื้อคอบ่า (Office Syndrome)',
    screenedByUserName: 'พว. กานดา คัดกรอง',
    screenedByRole: 'พยาบาลคัดกรอง',
    assignedDoctorId: 1,
    assignedDoctorName: 'พญ.สุดา สุขสมบูรณ์',
    assignedRoom: 'ห้องตรวจ 1',
  },
  {
    id: 'scr-109',
    visitId: 520,
    visitDate: '06/08/2026 09:30 น.',
    dateOnly: '06/08/2026',
    timeOnly: '09:30 น.',
    queueNo: 'Q007',
    patientId: 6,
    nationalId: '1-1055-44332-21-0',
    patientName: 'นายณัฐวุฒิ สิทธิชัย',
    gender: 'ชาย',
    age: 36,
    phoneNumber: '086-444-5566',
    schemeType: 'สิทธิ์ข้าราชการ',
    weight: 76.0,
    height: 170.0,
    bmi: 26.30,
    bmiCategory: 'อ้วน ระดับ 1',
    temperature: 36.7,
    systolicBP: 122,
    diastolicBP: 80,
    heartRate: 76,
    respiratoryRate: 18,
    spo2: 99,
    triageLevel: 'ปกติ (Normal)',
    chiefComplaint: 'คัดจมูก น้ำมูกใส จามบ่อย ขอใบรับรองแพทย์',
    allergies: 'ปฏิเสธการแพ้ยา',
    medicalHistory: 'ภูมิแพ้อากาศ',
    nurseNotes: 'สัญญาณชีพปกติ ตรวจระบบทางเดินหายใจเบื้องต้น',
    screenedByUserName: 'พว. กานดา คัดกรอง',
    screenedByRole: 'พยาบาลคัดกรอง',
    assignedDoctorId: 1,
    assignedDoctorName: 'พญ.สุดา สุขสมบูรณ์',
    assignedRoom: 'ห้องตรวจ 1',
  },
];

export const ScreeningHistoryPage: React.FC = () => {
  const { currentUser } = useAuth();

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
    return MOCK_SCREENING_RECORDS.filter((item) => {
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

      // 2. Date Range Preset Filter
      if (selectedDatePreset === 'today') {
        if (item.dateOnly !== '06/08/2026') return false;
      } else if (selectedDatePreset === 'this-month') {
        if (!item.dateOnly.includes('/08/2026')) return false;
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
  }, [appliedSearch, selectedDatePreset, selectedTriage, selectedRisk]);

  // Total Statistics (Dynamically calculated to match actual 9 records in table)
  const stats: ScreeningStats = useMemo(() => {
    const total = MOCK_SCREENING_RECORDS.length;
    const thisMonth = MOCK_SCREENING_RECORDS.filter((r) => r.dateOnly.includes('/08/2026')).length;
    const highBPCount = MOCK_SCREENING_RECORDS.filter((r) => r.systolicBP >= 140 || r.diastolicBP >= 90).length;
    const urgentCount = MOCK_SCREENING_RECORDS.filter(
      (r) => r.triageLevel.includes('ฉุกเฉิน') || r.triageLevel.includes('วิกฤต') || r.triageLevel.includes('เร่งด่วน')
    ).length;
    const allergyCount = MOCK_SCREENING_RECORDS.filter(
      (r) => r.allergies && r.allergies !== 'ปฏิเสธการแพ้ยา' && r.allergies !== 'ไม่มี'
    ).length;

    return {
      totalRecords: total, // 9 รายการ
      thisMonthRecords: thisMonth, // 5 รายการในเดือน ส.ค. 2026
      highBPRatePercent: total > 0 ? Math.round((highBPCount / total) * 100) : 0, // 22% (2/9 รายการ)
      urgentTriageCount: urgentCount, // 4 รายการ
      allergyPatientsCount: allergyCount, // 4 รายการ
    };
  }, []);

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
              >
                ✕
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
                วันนี้ (06/08)
              </button>
              <button
                type="button"
                className={`filter-chip ${selectedDatePreset === 'this-month' ? 'active' : ''}`}
                onClick={() => setSelectedDatePreset('this-month')}
              >
                เดือนนี้ (สิงหาคม)
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
                🔴 ฉุกเฉิน / วิกฤต
              </button>
              <button
                type="button"
                className={`filter-chip chip-yellow ${selectedTriage === 'กึ่ง' ? 'active' : ''}`}
                onClick={() => setSelectedTriage('กึ่ง')}
              >
                🟡 กึ่งฉุกเฉิน
              </button>
              <button
                type="button"
                className={`filter-chip chip-green ${selectedTriage === 'ปกติ' ? 'active' : ''}`}
                onClick={() => setSelectedTriage('ปกติ')}
              >
                🟢 ปกติ (Normal)
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
                🫀 ความดันสูง
              </button>
              <button
                type="button"
                className={`filter-chip ${selectedRisk === 'fever' ? 'active' : ''}`}
                onClick={() => setSelectedRisk('fever')}
              >
                🌡️ มีไข้ (&gt; 37.5°C)
              </button>
              <button
                type="button"
                className={`filter-chip ${selectedRisk === 'has-allergy' ? 'active' : ''}`}
                onClick={() => setSelectedRisk('has-allergy')}
              >
                ⚠️ มีประวัติแพ้ยา
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
                <th style={{ width: '190px' }}>ชื่อ-นามสกุล / เลขบัตร</th>
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
                          <span className="bmi-sub-tag">
                            BMI {item.bmi} ({item.bmiCategory.split(' ')[0]})
                          </span>
                        </div>
                      </td>

                      {/* Systolic BP (Centered) */}
                      <td style={{ textAlign: 'center' }}>
                        <div className="scr-bp-cell centered">
                          <span
                            className={`bp-val-chip ${
                              isCrisis ? 'bp-crisis-chip' : isHighSys ? 'bp-high-chip' : 'bp-normal-chip'
                            }`}
                          >
                            {item.systolicBP} mmHg
                          </span>
                        </div>
                      </td>

                      {/* Diastolic BP (Centered) */}
                      <td style={{ textAlign: 'center' }}>
                        <div className="scr-bp-cell centered">
                          <span
                            className={`bp-val-chip ${
                              isCrisis ? 'bp-crisis-chip' : isHighDia ? 'bp-high-chip' : 'bp-normal-chip'
                            }`}
                          >
                            {item.diastolicBP} mmHg
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
                      <span className="empty-icon">🔍</span>
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
