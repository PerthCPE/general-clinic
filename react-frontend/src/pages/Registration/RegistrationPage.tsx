import { useState, useRef, useEffect, useCallback } from 'react';
import PatientSearchCard from './components/PatientSearchCard';
import PatientFormCard from './components/PatientFormCard';
import type { Patient, SchemeType } from './types';
import { patientApi, queueApi, type BackendPatient, type BackendQueue } from '../../services/api';
import { useWebSocket } from '../../context/WebSocketContext';
import { formatHN, formatQueueNo, formatNationalId, formatPhone } from '../../utils/formatters';
import './RegistrationPage.css';

export { formatHN, formatQueueNo, formatNationalId, formatPhone };

const mapBackendPatientToUI = (p: BackendPatient): Patient => {
  let age = 0;
  let formattedDob = '-';

  if (p.birthdate) {
    try {
      const d = new Date(p.birthdate);
      if (!isNaN(d.getTime())) {
        const birthYear = d.getFullYear() >= 2400 ? d.getFullYear() - 543 : d.getFullYear();
        const currentYear = new Date().getFullYear();
        const calcAge = currentYear - birthYear;
        age = calcAge >= 0 ? calcAge : 0;
        formattedDob = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${birthYear + 543}`;
      }
    } catch {
      formattedDob = p.birthdate;
    }
  }

  let formattedRegAt = p.created_at || '';
  if (p.created_at) {
    try {
      const d = new Date(p.created_at);
      if (!isNaN(d.getTime())) {
        formattedRegAt = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear() + 543} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')} น.`;
      }
    } catch {
      formattedRegAt = p.created_at;
    }
  }

  const patientSeq = typeof p.id === 'number' ? p.id : 1;

  return {
    id: p.id,
    hn: formatHN(p.hn || patientSeq),
    fullName: p.fullname,
    nationalId: formatNationalId(p.national_id),
    dob: formattedDob,
    age: age,
    gender: (p.gender as 'ชาย' | 'หญิง' | 'อื่นๆ') || 'ชาย',
    phone: formatPhone(p.phone_number),
    emergencyContact: p.emergency_contact || '-',
    houseNo: p.house_no || '',
    villageNo: p.village_no || '',
    villageName: p.village_name || '',
    alley: p.alley || '',
    road: p.road || '',
    subDistrict: p.sub_district || '',
    district: p.district || '',
    province: p.province || '',
    postalCode: p.postal_code || '',
    address: p.address || 'กรุงเทพมหานคร',
    schemeType: (p.scheme_type as SchemeType) || 'บัตรทอง (สปสช.)',
    chronicDiseases: p.chronic_diseases || '',
    allergies: p.allergies || '',
    registeredAt: formattedRegAt || 'วันนี้',
  };
};

interface RegSuccessResult {
  patient: Patient;
  queueIssued: boolean;
  queueNumber?: string;
}

function RegistrationPage() {
  const [allPatients, setAllPatients] = useState<Patient[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [tableFilter, setTableFilter] = useState<'unqueued' | 'all'>('unqueued');
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [searchResult, setSearchResult] = useState<Patient | null>(null);
  const [notFoundQuery, setNotFoundQuery] = useState<string | null>(null);
  const [selectedPatientModal, setSelectedPatientModal] = useState<Patient | null>(null);
  const [regSuccessModal, setRegSuccessModal] = useState<RegSuccessResult | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [isRecentOpen, setIsRecentOpen] = useState(true);
  const { subscribe } = useWebSocket();

  const formSectionRef = useRef<HTMLDivElement>(null);

  // ดึงรายชื่อผู้ป่วยทั้งหมด และคิวที่กำลัง active จาก Backend DB จริง (Zero Mock)
  const fetchPatients = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const [patientsData, queuesData] = await Promise.all([
        patientApi.getAll(),
        queueApi.getList().catch(() => [] as BackendQueue[]),
      ]);

      if (Array.isArray(patientsData)) {
        const allMapped = patientsData.map(mapBackendPatientToUI);
        setAllPatients(allMapped);

        // หา ID ของผู้ป่วยทั้งหมดที่มีคิวแล้วในระบบ
        const queueList = Array.isArray(queuesData)
          ? queuesData
          : queuesData && typeof queuesData === 'object' && Array.isArray((queuesData as any).data)
          ? (queuesData as any).data
          : [];

        const queuedPatientIds = new Set(
          queueList.map((q: any) => q.patient_id)
        );

        // กรองเอาเฉพาะผู้ป่วยที่ยังไม่ได้ออกบัตรคิวเข้าตรวจ
        const unqueued = patientsData.filter((p) => !queuedPatientIds.has(p.id));
        setPatients(unqueued.map(mapBackendPatientToUI));
      } else {
        setAllPatients([]);
        setPatients([]);
      }
    } catch (err) {
      console.error('Could not fetch patients from backend:', err);
      setFetchError('ไม่สามารถโหลดรายชื่อผู้ป่วยจากระบบได้ กรุณากดลองใหม่อีกครั้ง');
      setAllPatients([]);
      setPatients([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPatients();

    // ดักฟัง Real-time เมื่อมีคนไข้ลงทะเบียนใหม่ หรือมีการสร้าง/อัปเดตคิว
    const unsubPatient = subscribe('PATIENT_REGISTERED', () => {
      fetchPatients();
    });
    const unsubQueue = subscribe('QUEUE_CREATED', () => {
      fetchPatients();
    });
    const unsubQueueUpdate = subscribe('QUEUE_UPDATED', () => {
      fetchPatients();
    });

    return () => {
      unsubPatient();
      unsubQueue();
      unsubQueueUpdate();
    };
  }, [fetchPatients, subscribe]);

  // ค้นหาคนไข้จาก Backend DB จริง (รองรับทั้งเลขบัตร 13 หลัก, ชื่อ, นามสกุล, หรือ HN)
  const handleSearch = async (query: string) => {
    const cleanQuery = query.trim();
    if (!cleanQuery) return;

    try {
      const res = await patientApi.search(cleanQuery);
      if (res) {
        if (Array.isArray(res) && res.length > 0) {
          const mapped = res.map(mapBackendPatientToUI);
          setSearchResults(mapped);
          setSearchResult(mapped[0]);
          setNotFoundQuery(null);
          return;
        } else if (!Array.isArray(res) && (res as BackendPatient).id) {
          const mapped = mapBackendPatientToUI(res as BackendPatient);
          setSearchResults([mapped]);
          setSearchResult(mapped);
          setNotFoundQuery(null);
          return;
        }
      }
    } catch {
      // Local fallback
    }

    const searchPool = allPatients.length > 0 ? allPatients : patients;
    const clean = cleanQuery.replace(/[-\s]/g, '').toLowerCase();
    const queryLower = cleanQuery.toLowerCase();
    const words = queryLower.split(/\s+/).filter(Boolean);

    const matched = searchPool.filter((p) => {
      const pCleanId = p.nationalId.replace(/[-\s]/g, '').toLowerCase();
      const pFull = p.fullName.toLowerCase();
      const pHN = p.hn.toLowerCase();
      const pPhone = p.phone.replace(/[-\s]/g, '').toLowerCase();

      // ค้นหาเลขบัตร, HN, เบอร์โทร
      if (clean && (pCleanId.includes(clean) || pHN.includes(clean) || pPhone.includes(clean))) return true;

      // ค้นหาชื่อ-นามสกุลแบบตรงๆ
      if (pFull.includes(queryLower)) return true;

      // ค้นหาแบบแยกคำ เช่น ชื่อ หรือ นามสกุล
      if (words.length > 0 && words.every((w) => pFull.includes(w))) return true;
      if (words.some((w) => w.length >= 2 && pFull.includes(w))) return true;

      return false;
    });

    if (matched.length > 0) {
      setSearchResults(matched);
      setSearchResult(matched[0]);
      setNotFoundQuery(null);
    } else {
      setSearchResults([]);
      setSearchResult(null);
      setNotFoundQuery(query);
    }
  };

  const handleClearSearch = () => {
    setSearchResults([]);
    setSearchResult(null);
    setNotFoundQuery(null);
  };

  // ส่งต่อเข้าคิวตรวจ -> ยิง Backend ออกบัตรคิวจริง และลบออกจากรายชื่อรอเข้าคิวทันทีเฉพาะเมื่อสำเร็จ
  const handleAssignQueue = async (patient: Patient) => {
    try {
      let patientId = patient.id;
      if (!patientId) {
        const res = await patientApi.search(patient.nationalId.replace(/[-\s]/g, ''));
        if (res) {
          patientId = Array.isArray(res) ? res[0]?.id : res.id;
        }
      }

      if (!patientId) {
        throw new Error('ไม่พบข้อมูลรหัสผู้ป่วยในระบบ');
      }

      await queueApi.create(patientId, 'แผนกคัดกรอง', 'ส่งเข้าคิวจากการลงทะเบียน');

      // เอาผู้ป่วยออกจากรายการ "ผู้ป่วยที่ยังไม่ได้เข้าคิว" เมื่อสำเร็จเท่านั้น
      setPatients((prev) =>
        prev.filter((p) => p.hn !== patient.hn && p.nationalId !== patient.nationalId && (!patient.id || p.id !== patient.id))
      );

      // ปิดข้อมูลผู้ป่วยที่เปิดอยู่ใน search / modal
      setSearchResult(null);
      setNotFoundQuery(null);
      setSelectedPatientModal(null);
      fetchPatients();
    } catch (err: any) {
      console.error('Queue assign error:', err);
      const errMsg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        'เกิดข้อผิดพลาดในการส่งผู้ป่วยเข้าคิว';
      setErrorToast(errMsg);
      // ห้ามลบคนไข้ออกจาก setPatients เพื่อคงสถานะเดิมไว้
    }
  };

  // ส่งต่อเข้าคิวจาก Success Modal (กรณีเลือกส่งเข้าคิวทันทีหลังลงทะเบียนแบบไม่ออกคิว)
  const handleAssignQueueFromSuccessModal = async (patient: Patient) => {
    await handleAssignQueue(patient);
    setRegSuccessModal(null);
  };

  // ลงทะเบียนผู้ป่วยใหม่ บันทึกลง Database จริง (Sprint 3.2: รองรับ issueQueue flag)
  const handleFormSubmit = async (formData: Partial<Patient> & { issueQueue?: boolean }) => {
    setErrorToast(null);

    if (!formData.dob || !formData.dob.trim()) {
      setErrorToast('กรุณาระบุวันเกิดของผู้ป่วย');
      return;
    }

    try {
      // แปลงวันเกิด DD/MM/YYYY (พ.ศ. หรือ ค.ศ.) เป็น YYYY-MM-DD
      let birthDateStr = formData.dob;
      if (formData.dob.includes('/')) {
        const parts = formData.dob.split('/');
        if (parts.length === 3) {
          let yr = parseInt(parts[2], 10);
          if (yr >= 2400) yr = yr - 543;
          birthDateStr = `${yr}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      } else if (formData.dob.includes('-')) {
        const parts = formData.dob.split('-');
        if (parts.length === 3 && parts[0].length === 4) {
          let yr = parseInt(parts[0], 10);
          if (yr >= 2400) yr = yr - 543;
          birthDateStr = `${yr}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        }
      }

      const shouldIssueQueue = formData.issueQueue ?? false;

      const payload = {
        national_id: (formData.nationalId || '').replace(/[-\s]/g, ''),
        fullname: formData.fullName || '',
        gender: formData.gender || 'ชาย',
        birthdate: birthDateStr,
        house_no: formData.houseNo || '',
        village_no: formData.villageNo || '',
        village_name: formData.villageName || '',
        alley: formData.alley || '',
        road: formData.road || '',
        sub_district: formData.subDistrict || '',
        district: formData.district || '',
        province: formData.province || '',
        postal_code: formData.postalCode || '',
        address: formData.address || '',
        phone_number: (formData.phone || '').replace(/[-\s]/g, ''),
        emergency_contact: formData.emergencyContact || '-',
        scheme_type: formData.schemeType || 'บัตรทอง (สปสช.)',
        issue_queue: shouldIssueQueue,
        chronic_diseases: formData.chronicDiseases || '',
        allergies: formData.allergies || '',
      };

      const res = await patientApi.register(payload);
      if (res && res.patient) {
        const newUI = mapBackendPatientToUI(res.patient);
        if (!res.queue_issued) {
          // ถ้ายังไม่ได้ออกคิว ให้เพิ่มเข้าไปในรายการ "ผู้ป่วยรอเข้าคิว"
          setPatients((prev) => [newUI, ...prev.filter((p) => p.hn !== newUI.hn && p.id !== newUI.id)]);
        }
        setAllPatients((prev) => [newUI, ...prev.filter((p) => p.hn !== newUI.hn && p.id !== newUI.id)]);
        setSearchResult(null);
        setRegSuccessModal({
          patient: newUI,
          queueIssued: res.queue_issued,
          queueNumber: res.queue_number,
        });
        return;
      }
    } catch (err: any) {
      console.error('Register error:', err);
      const errMsg =
        err?.response?.data?.error ||
        err?.message ||
        'เกิดข้อผิดพลาดในการลงทะเบียนผู้ป่วย กรุณาตรวจสอบข้อมูลหรือการเชื่อมต่อระบบ';
      setErrorToast(errMsg);
    }
  };

  const scrollToForm = () => {
    formSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const getSchemeClass = (scheme: string) => {
    if (scheme.includes('บัตรทอง')) return 'badge-scheme-gold';
    if (scheme.includes('ประกันสังคม')) return 'badge-scheme-social';
    if (scheme.includes('ข้าราชการ')) return 'badge-scheme-gov';
    return 'badge-scheme-private';
  };

  // สถิติสรุป (คำนวณจากผู้ป่วยทั้งหมดในคลินิก เพื่อให้ยอดสิทธิ์ตรงกับหน้าสิทธิ์การรักษา U2)
  const pool = allPatients.length > 0 ? allPatients : patients;
  const stats = {
    total: patients.length,
    gold: pool.filter((p) => p.schemeType === 'บัตรทอง (สปสช.)').length,
    social: pool.filter((p) => p.schemeType === 'ประกันสังคม (ม.33)').length,
    gov: pool.filter((p) => p.schemeType === 'สิทธิ์ข้าราชการ').length,
  };

  return (
    <div className="registration-page">

      {/* Page Header */}
      <div className="registration-header">
        <h1 className="registration-title">ลงทะเบียนผู้ป่วย (Patient Registration)</h1>
        <p className="registration-subtitle">
          ค้นหาประวัติผู้ป่วยเดิมเพื่อส่งเข้าคิว หรือลงทะเบียนออกรหัส HN ผู้ป่วยใหม่เข้าสู่ระบบคลินิก
        </p>
      </div>

      {/* Error Alert Banner (Strict Error Feedback) */}
      {errorToast && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            marginBottom: '16px',
            borderRadius: '8px',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            color: '#DC2626',
            fontSize: '14px',
            fontWeight: 500,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{errorToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorToast(null)}
            style={{
              background: 'none',
              border: 'none',
              color: '#DC2626',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
            aria-label="ปิดแจ้งเตือน"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* Stats Summary Grid */}
      <div className="reg-stats-grid">
        <div className="reg-stat-card">
          <div className="reg-stat-val">{stats.total}</div>
          <div className="reg-stat-lbl">ผู้ป่วยรอเข้าคิว</div>
        </div>
        <div className="reg-stat-card stat-gold">
          <div className="reg-stat-val">{stats.gold}</div>
          <div className="reg-stat-lbl">สิทธิ์บัตรทอง</div>
        </div>
        <div className="reg-stat-card stat-social">
          <div className="reg-stat-val">{stats.social}</div>
          <div className="reg-stat-lbl">สิทธิ์ประกันสังคม</div>
        </div>
        <div className="reg-stat-card stat-gov">
          <div className="reg-stat-val">{stats.gov}</div>
          <div className="reg-stat-lbl">สิทธิ์ข้าราชการ</div>
        </div>
      </div>

      {/* 1. Patient Search Section */}
      <PatientSearchCard
        onSearch={handleSearch}
        searchResult={searchResult}
        searchResults={searchResults}
        onSelectResult={(p) => setSearchResult(p)}
        notFoundQuery={notFoundQuery}
        onAssignQueue={handleAssignQueue}
        onViewMoreInfo={(p) => setSelectedPatientModal(p)}
        onClearSearch={handleClearSearch}
        onScrollToForm={scrollToForm}
      />

      {/* 2. New Patient Registration Form Section */}
      <PatientFormCard onSubmit={handleFormSubmit} formRef={formSectionRef} />

      {/* 3. Patient List & Unqueued Table Accordion Card */}
      <div className="reg-card">
        <div className="reg-card-header" onClick={() => setIsRecentOpen(!isRecentOpen)}>
          <div className="reg-header-title-wrap">
            <div className="reg-header-icon-box purple-box">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <h2 className="reg-card-title">รายชื่อผู้ป่วยรอออกบัตรคิว (Unqueued Patients)</h2>
              <p className="reg-card-subtitle">รายการผู้ป่วยที่บันทึกข้อมูลเข้าสู่ระบบแล้ว แต่ยังไม่ได้ออกบัตรคิวเข้าห้องตรวจ</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className="reg-count-pill">
              {tableFilter === 'unqueued' ? `${patients.length} รอคิว` : `${allPatients.length} ทั้งหมด`}
            </span>
            <button className={`reg-card-toggle reg-recent-toggle ${isRecentOpen ? 'open' : ''}`} aria-label="Toggle Dropdown">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19.5 8.25l-7.5 7.5-7.5-7.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        <div className={`reg-card-body reg-recent-body ${isRecentOpen ? 'expanded' : ''}`} style={{ padding: isRecentOpen ? '0' : '0' }}>
          {/* Table View Filter Tabs */}
          <div className="reg-table-filter-bar">
            <button
              type="button"
              className={`reg-table-tab-btn ${tableFilter === 'unqueued' ? 'active' : ''}`}
              onClick={() => setTableFilter('unqueued')}
            >
              <span>ผู้ป่วยรอออกบัตรคิว</span>
              <span className="reg-table-tab-count">{patients.length}</span>
            </button>
            <button
              type="button"
              className={`reg-table-tab-btn ${tableFilter === 'all' ? 'active' : ''}`}
              onClick={() => setTableFilter('all')}
            >
              <span>ผู้ป่วยทั้งหมดในระบบ</span>
              <span className="reg-table-tab-count">{allPatients.length}</span>
            </button>
          </div>

          {/* Error Banner with Retry */}
          {fetchError && (
            <div style={{ padding: '12px 24px 0 24px' }}>
              <div className="reg-fetch-error-banner">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{fetchError}</span>
                </div>
                <button
                  type="button"
                  className="reg-retry-btn"
                  onClick={fetchPatients}
                >
                  ลองใหม่อีกครั้ง
                </button>
              </div>
            </div>
          )}

          <div className="table-responsive">
            <table className="reg-recent-table">
              <thead>
                <tr>
                  <th className="col-reg-hn">HN</th>
                  <th className="col-reg-patient">ชื่อ-นามสกุล คนไข้</th>
                  <th className="col-reg-phone">เบอร์โทรศัพท์</th>
                  <th className="col-reg-scheme">สิทธิการรักษา</th>
                  <th className="col-reg-time">เวลาลงทะเบียน</th>
                  <th className="col-reg-action">การดำเนินการ</th>
                </tr>
              </thead>
              <tbody>
                {(tableFilter === 'unqueued' ? patients : allPatients).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="reg-empty-table-cell">
                      <div className="reg-empty-wrap">
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <p>
                          {isLoading
                            ? 'กำลังโหลดรายชื่อผู้ป่วยจากระบบ...'
                            : tableFilter === 'unqueued'
                            ? 'ไม่มีรายชื่อผู้ป่วยรอออกบัตรคิว (ผู้ป่วยทั้งหมดถูกส่งเข้าห้องตรวจเรียบร้อยแล้ว)'
                            : 'ยังไม่มีข้อมูลผู้ป่วยในระบบ กรุณาลงทะเบียนผู้ป่วยใหม่'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  (tableFilter === 'unqueued' ? patients : allPatients).map((p) => {
                    const isQueued = !patients.some((u) => u.hn === p.hn);
                    return (
                      <tr key={p.hn} className="reg-table-row">
                        <td className="col-reg-hn">
                          <span className="reg-hn-tag">{p.hn}</span>
                        </td>
                        <td className="col-reg-patient">
                          <div className="reg-patient-cell">
                            <span className="patient-name-link" onClick={() => setSelectedPatientModal(p)}>
                              {p.fullName}
                            </span>
                            <span className="patient-sub-meta">
                              <span className="font-mono">{p.nationalId}</span> • เพศ {p.gender}, {p.age} ปี
                            </span>
                          </div>
                        </td>
                        <td className="col-reg-phone">
                          <span className="font-phone">{p.phone}</span>
                        </td>
                        <td className="col-reg-scheme">
                          <span className={`scheme-pill ${getSchemeClass(p.schemeType)}`}>
                            {p.schemeType}
                          </span>
                        </td>
                        <td className="col-reg-time">
                          <div className="reg-time-cell">
                            <span className="time-main-text">
                              {p.registeredAt.includes(' ') ? p.registeredAt.split(' ')[1] : p.registeredAt}
                            </span>
                            {p.registeredAt.includes(' ') && (
                              <span className="time-sub-date">{p.registeredAt.split(' ')[0]}</span>
                            )}
                          </div>
                        </td>
                        <td className="col-reg-action">
                          {isQueued && tableFilter === 'all' ? (
                            <span className="reg-status-queued-badge">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                              <span>อยู่ในคิวแล้ว</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="btn-quick-assign-queue"
                              title="ส่งเข้าคิวตรวจทันที"
                              onClick={() => handleAssignQueue(p)}
                            >
                              <svg viewBox="0 0 20 20" fill="currentColor" className="btn-icon-svg">
                                <path
                                  fillRule="evenodd"
                                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              <span>เข้าคิว</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Patient Profile Modal (ตัดโรคประจำตัว, ประวัติแพ้ยา และปุ่มเข้าคิวออกตามที่ระบุ) */}
      {selectedPatientModal && (
        <div className="reg-modal-backdrop" onClick={() => setSelectedPatientModal(null)}>
          <div className="reg-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="reg-modal-header">
              <div className="modal-title-wrap">
                <h3 className="reg-modal-title">ข้อมูลประวัติผู้ป่วย (Patient Profile)</h3>
                <span className="reg-modal-hn">{selectedPatientModal.hn}</span>
              </div>
              <button className="reg-modal-close" onClick={() => setSelectedPatientModal(null)} aria-label="ปิดหน้าต่าง">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <div className="reg-modal-body">
              <div className="reg-modal-card">
                <div className="reg-modal-row">
                  <span className="modal-lbl">ชื่อ-นามสกุล:</span>
                  <span className="modal-val font-bold">{selectedPatientModal.fullName}</span>
                </div>
                <div className="reg-modal-row">
                  <span className="modal-lbl">เลขประจำตัวประชาชน:</span>
                  <span className="modal-val font-mono">{selectedPatientModal.nationalId}</span>
                </div>
                <div className="reg-modal-row">
                  <span className="modal-lbl">เพศ / อายุ:</span>
                  <span className="modal-val">
                    {selectedPatientModal.gender} / {selectedPatientModal.age} ปี (เกิด {selectedPatientModal.dob})
                  </span>
                </div>
                <div className="reg-modal-row">
                  <span className="modal-lbl">เบอร์โทรศัพท์:</span>
                  <span className="modal-val font-phone">{selectedPatientModal.phone}</span>
                </div>
                <div className="reg-modal-row">
                  <span className="modal-lbl">เบอร์ติดต่อฉุกเฉิน:</span>
                  <span className="modal-val">{selectedPatientModal.emergencyContact || '-'}</span>
                </div>
                <div className="reg-modal-row">
                  <span className="modal-lbl">ที่อยู่:</span>
                  <span className="modal-val">{selectedPatientModal.address}</span>
                </div>
                <div className="reg-modal-row">
                  <span className="modal-lbl">สิทธิการรักษา:</span>
                  <span className={`scheme-pill ${getSchemeClass(selectedPatientModal.schemeType)}`}>
                    {selectedPatientModal.schemeType}
                  </span>
                </div>
                <div className="reg-modal-row">
                  <span className="modal-lbl">ลงทะเบียนเมื่อ:</span>
                  <span className="modal-val">{selectedPatientModal.registeredAt}</span>
                </div>
              </div>
            </div>

            <div className="reg-modal-footer">
              <button
                type="button"
                className="reg-modal-btn-close"
                onClick={() => setSelectedPatientModal(null)}
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Registration Success Result Modal (Sprint 3.2 Task B2) */}
      {regSuccessModal && (
        <div className="reg-modal-backdrop" onClick={() => setRegSuccessModal(null)}>
          <div className="reg-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="reg-modal-header">
              <div className="modal-title-wrap">
                <div className={`reg-header-icon-box ${regSuccessModal.queueIssued ? 'green-box' : 'blue-box'}`}>
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="reg-modal-title">
                    {regSuccessModal.queueIssued
                      ? 'ลงทะเบียนและออกบัตรคิวเรียบร้อย'
                      : 'ลงทะเบียนเรียบร้อย (ยังไม่ออกบัตรคิว)'}
                  </h3>
                  <p className="reg-card-subtitle" style={{ margin: 0, fontSize: '13px' }}>
                    {regSuccessModal.queueIssued
                      ? 'ผู้ป่วยถูกบันทึกข้อมูลและส่งเข้าคิวรอคัดกรองแล้ว'
                      : 'บันทึกข้อมูลประวัติผู้ป่วยและออกรหัส HN สำเร็จ'}
                  </p>
                </div>
              </div>
              <button
                className="reg-modal-close"
                onClick={() => setRegSuccessModal(null)}
                aria-label="ปิดหน้าต่าง"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <div className="reg-modal-body">
              <div className="reg-modal-card">
                <div className="reg-modal-row">
                  <span className="modal-lbl">รหัส HN:</span>
                  <span className="reg-modal-hn font-bold">{regSuccessModal.patient.hn}</span>
                </div>
                <div className="reg-modal-row">
                  <span className="modal-lbl">ชื่อ-นามสกุล:</span>
                  <span className="modal-val font-bold">{regSuccessModal.patient.fullName}</span>
                </div>
                <div className="reg-modal-row">
                  <span className="modal-lbl">เลขประจำตัวประชาชน:</span>
                  <span className="modal-val font-mono">{regSuccessModal.patient.nationalId}</span>
                </div>
                <div className="reg-modal-row">
                  <span className="modal-lbl">สิทธิการรักษา:</span>
                  <span className={`scheme-pill ${getSchemeClass(regSuccessModal.patient.schemeType)}`}>
                    {regSuccessModal.patient.schemeType}
                  </span>
                </div>
              </div>

              {regSuccessModal.queueIssued && regSuccessModal.queueNumber && (
                <div className="reg-success-queue-box">
                  <span className="reg-success-queue-lbl">หมายเลขคิวตรวจ (Queue Number)</span>
                  <span className="reg-success-queue-val">{regSuccessModal.queueNumber}</span>
                  <span className="reg-success-queue-dept">แผนก: จุดคัดกรอง • สถานะ: รอคัดกรอง</span>
                </div>
              )}
            </div>

            <div className="reg-modal-footer">
              {!regSuccessModal.queueIssued ? (
                <>
                  <button
                    type="button"
                    className="reg-modal-btn-queue"
                    onClick={() => handleAssignQueueFromSuccessModal(regSuccessModal.patient)}
                  >
                    ส่งเข้าคิวเลย
                  </button>
                  <button
                    type="button"
                    className="reg-modal-btn-close"
                    onClick={() => setRegSuccessModal(null)}
                  >
                    ปิด
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="reg-modal-btn-queue"
                  onClick={() => setRegSuccessModal(null)}
                >
                  ตกลง
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RegistrationPage;
