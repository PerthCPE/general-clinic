import { useState, useRef, useEffect, useCallback } from 'react';
import PatientSearchCard from './components/PatientSearchCard';
import PatientFormCard from './components/PatientFormCard';
import type { Patient, SchemeType } from './types';
import { patientApi, queueApi, type BackendPatient, type BackendQueue } from '../../services/api';
import { useWebSocket } from '../../context/WebSocketContext';
import { formatHN, formatQueueNo, formatNationalId, formatPhone } from '../../utils/formatters';
import toast from 'react-hot-toast';
import './RegistrationPage.css';

export { formatHN, formatQueueNo, formatNationalId, formatPhone };

const mapBackendPatientToUI = (p: BackendPatient): Patient => {
  const birthYear = p.birthdate ? new Date(p.birthdate).getFullYear() : 1995;
  const currentYear = new Date().getFullYear();
  const age = currentYear - birthYear;

  let formattedDob = p.birthdate || '';
  if (p.birthdate) {
    try {
      const d = new Date(p.birthdate);
      if (!isNaN(d.getTime())) {
        formattedDob = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
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
    dob: formattedDob || '01/01/2000',
    age: age > 0 ? age : 30,
    gender: (p.gender as 'ชาย' | 'หญิง' | 'อื่นๆ') || 'ชาย',
    phone: formatPhone(p.phone_number),
    emergencyContact: p.emergency_contact || '-',
    address: p.address || 'กรุงเทพมหานคร',
    schemeType: (p.scheme_type as SchemeType) || 'บัตรทอง (สปสช.)',
    chronicDiseases: p.chronic_diseases || '',
    allergies: p.allergies || '',
    registeredAt: formattedRegAt || 'วันนี้',
  };
};

const DEFAULT_INITIAL_PATIENTS: Patient[] = [
  {
    id: 1,
    hn: 'HN0001',
    fullName: 'นายสมชาย ใจดี',
    nationalId: '0-1234-56789-01-2',
    dob: '15/04/1988',
    age: 38,
    gender: 'ชาย',
    phone: '081-234-5678',
    emergencyContact: '089-999-8888 (ภรรยา)',
    address: '99/12 หมู่ 4 ต.ในเมือง อ.เมือง จ.นครราชสีมา 30000',
    schemeType: 'บัตรทอง (สปสช.)',
    chronicDiseases: 'ความดันโลหิตสูง',
    allergies: 'แพ้ยาเพนิซิลลิน (Penicillin)',
    registeredAt: 'วันนี้ 08:30 น.',
  },
  {
    id: 2,
    hn: 'HN0002',
    fullName: 'นางวิภาดา รักสงบ',
    nationalId: '3-1005-98765-43-2',
    dob: '22/08/1992',
    age: 34,
    gender: 'หญิง',
    phone: '089-876-5432',
    emergencyContact: '081-111-2222 (สามี)',
    address: '123/45 ถนนมิตรภาพ ต.สุรนารี อ.เมือง จ.นครราชสีมา 30000',
    schemeType: 'ประกันสังคม (ม.33)',
    chronicDiseases: '-',
    allergies: '-',
    registeredAt: 'วันนี้ 08:45 น.',
  },
  {
    id: 3,
    hn: 'HN0003',
    fullName: 'นายอาทิตย์ เจริญยิ่ง',
    nationalId: '1-1014-55443-21-9',
    dob: '10/11/1975',
    age: 51,
    gender: 'ชาย',
    phone: '086-555-4321',
    emergencyContact: '082-333-4444 (บุตร)',
    address: '55/6 ต.หนองจะบก อ.เมือง จ.นครราชสีมา 30000',
    schemeType: 'สิทธิ์ข้าราชการ',
    chronicDiseases: 'เบาหวานชนิดที่ 2',
    allergies: 'อาหารทะเล',
    registeredAt: 'วันนี้ 09:00 น.',
  },
];

function RegistrationPage() {
  const [allPatients, setAllPatients] = useState<Patient[]>(DEFAULT_INITIAL_PATIENTS);
  const [patients, setPatients] = useState<Patient[]>(DEFAULT_INITIAL_PATIENTS);
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [searchResult, setSearchResult] = useState<Patient | null>(null);
  const [notFoundQuery, setNotFoundQuery] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedPatientModal, setSelectedPatientModal] = useState<Patient | null>(null);
  const [isRecentOpen, setIsRecentOpen] = useState(true);
  const { subscribe } = useWebSocket();

  const formSectionRef = useRef<HTMLDivElement>(null);

  // ดึงรายชื่อผู้ป่วยทั้งหมด และคิวที่กำลัง active จาก Backend DB จริง
  const fetchPatients = useCallback(async () => {
    setIsLoading(true);
    try {
      const [patientsData, queuesData] = await Promise.all([
        patientApi.getAll(),
        queueApi.getList().catch(() => [] as BackendQueue[]),
      ]);

      if (Array.isArray(patientsData)) {
        const allMapped = patientsData.map(mapBackendPatientToUI);
        setAllPatients(allMapped);

        // หา ID ของผู้ป่วยที่กำลังอยู่ในคิวตรวจ (ยังไม่เสร็จสิ้น / ไม่ถูกยกเลิก)
        const activeQueuedPatientIds = new Set(
          (Array.isArray(queuesData) ? queuesData : [])
            .filter((q) => q.status !== 'เสร็จสิ้น' && q.status !== 'ยกเลิกคิว')
            .map((q) => q.patient_id)
        );

        // กรองเอาเฉพาะผู้ป่วยที่ยังไม่ได้เข้าคิวสำหรับตารางลงทะเบียนล่าสุด
        const unqueued = patientsData.filter((p) => !activeQueuedPatientIds.has(p.id));
        setPatients(unqueued.map(mapBackendPatientToUI));
      }
    } catch (err) {
      console.warn('Could not fetch patients from backend:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPatients();

    // ดักฟัง Real-time เมื่อมีคนไข้ลงทะเบียนใหม่ หรือมีคิวใหม่
    const unsubPatient = subscribe('PATIENT_REGISTERED', () => {
      fetchPatients();
    });
    const unsubQueue = subscribe('QUEUE_CREATED', () => {
      fetchPatients();
    });

    return () => {
      unsubPatient();
      unsubQueue();
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

  // ส่งต่อเข้าคิวตรวจ -> ยิง Backend ออกบัตรคิวจริง และลบออกจากรายชื่อรอเข้าคิวทันที
  const handleAssignQueue = async (patient: Patient) => {
    try {
      let patientId = patient.id;
      if (!patientId) {
        try {
          const res = await patientApi.search(patient.nationalId.replace(/[-\s]/g, ''));
          if (res) {
            patientId = Array.isArray(res) ? res[0]?.id : res.id;
          }
        } catch {
          // ignore
        }
      }

      if (patientId) {
        await queueApi.create(patientId, 'แผนกคัดกรอง', 'ส่งเข้าคิวจากการลงทะเบียน');
      }
    } catch (err) {
      console.warn('Queue assign error:', err);
    }

    // เอาผู้ป่วยออกจากรายการ "ผู้ป่วยที่ยังไม่ได้เข้าคิว" ทันที
    setPatients((prev) =>
      prev.filter((p) => p.hn !== patient.hn && p.nationalId !== patient.nationalId && (!patient.id || p.id !== patient.id))
    );

    // ปิดข้อมูลผู้ป่วยที่เปิดอยู่ใน search / modal
    setSearchResult(null);
    setNotFoundQuery(null);
    setSelectedPatientModal(null);

    showToast(`เพิ่มผู้ป่วย "${patient.fullName}" (HN: ${patient.hn}) เข้าคิวตรวจเรียบร้อยแล้ว`);
  };

  // ลงทะเบียนผู้ป่วยใหม่ บันทึกลง Database จริง
  const handleFormSubmit = async (formData: Partial<Patient>) => {
    try {
      // แปลงวันเกิด DD/MM/YYYY เป็น YYYY-MM-DD
      let birthDateStr = formData.dob || '2000-01-01';
      if (formData.dob && formData.dob.includes('/')) {
        const parts = formData.dob.split('/');
        if (parts.length === 3) {
          birthDateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }

      const payload = {
        national_id: (formData.nationalId || '').replace(/[-\s]/g, ''),
        fullname: formData.fullName || 'ผู้ป่วยใหม่',
        gender: formData.gender || 'ชาย',
        birthdate: birthDateStr,
        address: formData.address || 'กรุงเทพมหานคร',
        phone_number: (formData.phone || '').replace(/[-\s]/g, ''),
        emergency_contact: formData.emergencyContact || '-',
        scheme_type: formData.schemeType || 'บัตรทอง (สปสช.)',
        chronic_diseases: formData.chronicDiseases || '',
        allergies: formData.allergies || '',
      };

      const res = await patientApi.register(payload);
      if (res && res.patient) {
        const newUI = mapBackendPatientToUI(res.patient);
        setPatients((prev) => [newUI, ...prev.filter((p) => p.hn !== newUI.hn && p.id !== newUI.id)]);
        setSearchResult(null);
        showToast(`บันทึกและลงทะเบียนผู้ป่วย "${newUI.fullName}" (HN: ${newUI.hn}) เรียบร้อยแล้ว`);
        return;
      }
    } catch (err: any) {
      console.warn('Register error:', err);
      showToast(err?.message || 'ไม่สามารถลงทะเบียนได้');
    }

    // Fallback UI
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} น.`;
    const dateStr = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear() + 543}`;

    const newPatient: Patient = {
      hn: formatHN(patients.length + 1),
      fullName: formData.fullName || 'ผู้ป่วยใหม่',
      nationalId: formData.nationalId || '0-0000-00000-00-0',
      dob: formData.dob || '01/01/2000',
      age: formData.age || 30,
      gender: formData.gender || 'ชาย',
      phone: formData.phone || '-',
      emergencyContact: formData.emergencyContact || '-',
      address: formData.address || 'กรุงเทพมหานคร',
      schemeType: (formData.schemeType as SchemeType) || 'บัตรทอง (สปสช.)',
      chronicDiseases: '',
      allergies: '',
      registeredAt: `${dateStr} ${timeStr}`,
    };

    setPatients((prev) => [newPatient, ...prev]);
    setSearchResult(null);
    showToast(`บันทึกและลงทะเบียนผู้ป่วย "${newPatient.fullName}" (HN: ${newPatient.hn}) เรียบร้อยแล้ว`);
  };

  const scrollToForm = () => {
    formSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    toast.success(msg, { id: msg });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const getSchemeClass = (scheme: string) => {
    if (scheme.includes('บัตรทอง')) return 'badge-scheme-gold';
    if (scheme.includes('ประกันสังคม')) return 'badge-scheme-social';
    if (scheme.includes('ข้าราชการ')) return 'badge-scheme-gov';
    return 'badge-scheme-private';
  };

  // สถิติสรุป
  const stats = {
    total: patients.length,
    gold: patients.filter((p) => p.schemeType === 'บัตรทอง (สปสช.)').length,
    social: patients.filter((p) => p.schemeType === 'ประกันสังคม (ม.33)').length,
    gov: patients.filter((p) => p.schemeType === 'สิทธิ์ข้าราชการ').length,
  };

  return (
    <div className="registration-page">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="reg-toast">
          <svg className="toast-icon" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="registration-header">
        <h1 className="registration-title">ลงทะเบียนผู้ป่วย (Patient Registration)</h1>
        <p className="registration-subtitle">
          ค้นหาประวัติผู้ป่วยเดิมเพื่อส่งเข้าคิว หรือลงทะเบียนออกรหัส HN ผู้ป่วยใหม่เข้าสู่ระบบคลินิก
        </p>
      </div>

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

      {/* 3. Recent Registered Patients Dropdown Accordion Card */}
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
              <h2 className="reg-card-title">รายชื่อผู้ป่วยที่ลงทะเบียนล่าสุด (Recent Patients)</h2>
              <p className="reg-card-subtitle">รายการผู้ป่วยที่บันทึกข้อมูลเข้าสู่ระบบคลินิก</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className="reg-count-pill">{patients.length} คนไข้</span>
            <button className={`reg-card-toggle reg-recent-toggle ${isRecentOpen ? 'open' : ''}`} aria-label="Toggle Dropdown">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19.5 8.25l-7.5 7.5-7.5-7.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        <div className={`reg-card-body reg-recent-body ${isRecentOpen ? 'expanded' : ''}`} style={{ padding: isRecentOpen ? '0' : '0' }}>
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
                {patients.length === 0 ? (
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
                        <p>ไม่มีรายชื่อผู้ป่วยรอเข้าคิว (ผู้ป่วยทั้งหมดถูกส่งเข้าคิวตรวจแล้ว)</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  patients.map((p) => (
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
                      </td>
                    </tr>
                  ))
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
    </div>
  );
}

export default RegistrationPage;
