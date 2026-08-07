import { useState, useRef } from 'react';
import PatientSearchCard from './components/PatientSearchCard';
import PatientFormCard from './components/PatientFormCard';
import type { Patient, SchemeType } from './types';
import './RegistrationPage.css';

/**
 * แปลงลำดับตัวเลขเป็นรหัส HN รูปแบบ 4 หลัก (เช่น HN-0001 ถึง HN-9999)
 * และหากเกิน 9999 (ลำดับ 10000 ขึ้นไป) จะแปลงเป็นเลขฐาน 16 (เช่น HN-A001, HN-A002...)
 */
export const formatHN = (seq: number): string => {
  if (seq <= 9999) {
    return `HN-${seq.toString().padStart(4, '0')}`;
  }
  // เมื่อถึง 10000 ขึ้นไป จะเปลี่ยนเป็นตัวอักษรฐาน 16 (A001, A002, ...)
  const offset = seq - 10000;
  const hexValue = (0xA001 + offset).toString(16).toUpperCase();
  return `HN-${hexValue}`;
};

const INITIAL_PATIENTS: Patient[] = [
  {
    hn: 'HN-0089',
    fullName: 'นายสมชาย ใจดี',
    nationalId: '0-1234-56789-01-2',
    dob: '15/05/1990',
    age: 36,
    gender: 'ชาย',
    phone: '081-234-5678',
    emergencyContact: 'นางสมศรี (ภรรยา) 089-999-1111',
    address: '123/45 ถนนพหลโยธิน แขวงลาดยาว เขตจตุจักร กรุงเทพฯ',
    schemeType: 'บัตรทอง (สปสช.)',
    chronicDiseases: '',
    allergies: '',
    registeredAt: '06/08/2026 08:30 น.',
  },
  {
    hn: 'HN-0090',
    fullName: 'นางสาววิภาดา มณีรัตน์',
    nationalId: '3-1005-98765-43-2',
    dob: '22/11/1995',
    age: 31,
    gender: 'หญิง',
    phone: '089-876-5432',
    emergencyContact: 'นายประสิทธิ์ (บิดา) 081-444-2222',
    address: '88/12 ซอยสุขุมวิท 55 แขวงคลองตันเหนือ เขตวัฒนา กรุงเทพฯ',
    schemeType: 'ประกันสังคม (ม.33)',
    chronicDiseases: '',
    allergies: '',
    registeredAt: '06/08/2026 09:15 น.',
  },
  {
    hn: 'HN-0091',
    fullName: 'นายอาทิตย์ มีสุข',
    nationalId: '1-1014-55443-21-9',
    dob: '10/03/1982',
    age: 44,
    gender: 'ชาย',
    phone: '086-555-4321',
    emergencyContact: 'นางวรรณา (มารดา) 082-333-8888',
    address: '45/6 ถนนงามวงศ์วาน ตำบลบางเขน อำเภอเมือง นนทบุรี',
    schemeType: 'สิทธิ์ข้าราชการ',
    chronicDiseases: '',
    allergies: '',
    registeredAt: '06/08/2026 10:00 น.',
  },
  {
    hn: 'HN-0092',
    fullName: 'นางสมศรี รักษาดี',
    nationalId: '5-1020-11223-34-5',
    dob: '05/08/1975',
    age: 51,
    gender: 'หญิง',
    phone: '084-111-2233',
    emergencyContact: 'นายธนา (บุตรชาย) 087-654-3210',
    address: '99/8 ซอยลาดพร้าว 71 แขวงสะพานสอง เขตวังทองหลาง กรุงเทพฯ',
    schemeType: 'บัตรทอง (สปสช.)',
    chronicDiseases: '',
    allergies: '',
    registeredAt: '06/08/2026 11:20 น.',
  },
];

function RegistrationPage() {
  const [patients, setPatients] = useState<Patient[]>(INITIAL_PATIENTS);
  const [nextHnSeq, setNextHnSeq] = useState<number>(93);
  const [searchResult, setSearchResult] = useState<Patient | null>(null);
  const [notFoundQuery, setNotFoundQuery] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedPatientModal, setSelectedPatientModal] = useState<Patient | null>(null);
  const [isRecentOpen, setIsRecentOpen] = useState(true);

  const formSectionRef = useRef<HTMLDivElement>(null);

  // ค้นหาคนไข้
  const handleSearch = (query: string) => {
    const cleanQuery = query.trim().replace(/[-\s]/g, '').toLowerCase();
    const found = patients.find(
      (p) =>
        p.nationalId.replace(/[-\s]/g, '').includes(cleanQuery) ||
        p.fullName.toLowerCase().includes(query.toLowerCase()) ||
        p.hn.toLowerCase().includes(query.toLowerCase())
    );

    if (found) {
      setSearchResult(found);
      setNotFoundQuery(null);
    } else {
      setSearchResult(null);
      setNotFoundQuery(query);
    }
  };

  const handleClearSearch = () => {
    setSearchResult(null);
    setNotFoundQuery(null);
  };

  // ส่งต่อเข้าคิวตรวจ -> ลบออกจากรายชื่อล่าสุด + ปิดข้อมูลค้นหา
  const handleAssignQueue = (patient: Patient) => {
    // 1. นำออกจาก list ผู้ป่วยที่ยังไม่ได้เข้าคิว
    setPatients((prev) => prev.filter((p) => p.hn !== patient.hn));

    // 2. ปิดข้อมูลผู้ป่วยที่เปิดอยู่ใน search
    setSearchResult(null);
    setNotFoundQuery(null);

    // 3. ปิด modal หากเปิดอยู่
    setSelectedPatientModal(null);

    // 4. แสดง Toast แจ้งเตือน
    showToast(`⚡ เพิ่มผู้ป่วย "${patient.fullName}" (HN: ${patient.hn}) เข้าคิวตรวจเรียบร้อยแล้ว`);
  };

  // ลงทะเบียนผู้ป่วยใหม่
  const handleFormSubmit = (formData: Partial<Patient>) => {
    const generatedHn = formatHN(nextHnSeq);
    setNextHnSeq((prev) => prev + 1);

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} น.`;
    const dateStr = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear() + 543}`;

    const newPatient: Patient = {
      hn: generatedHn,
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
    showToast(`✨ บันทึกและลงทะเบียนผู้ป่วย "${newPatient.fullName}" (HN: ${newPatient.hn}) เรียบร้อยแล้ว`);
  };

  const scrollToForm = () => {
    formSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
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
                  <th className="col-reg-id">เลขบัตรประชาชน</th>
                  <th className="col-reg-phone">เบอร์โทรศัพท์</th>
                  <th className="col-reg-scheme">สิทธิการรักษา</th>
                  <th className="col-reg-time">เวลาลงทะเบียน</th>
                  <th className="col-reg-action">การดำเนินการ</th>
                </tr>
              </thead>
              <tbody>
                {patients.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="reg-empty-table-cell">
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
                            เพศ {p.gender}, อายุ {p.age} ปี
                          </span>
                        </div>
                      </td>
                      <td className="col-reg-id">
                        <span className="font-mono">{p.nationalId}</span>
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
                        <span className="text-muted-time">{p.registeredAt}</span>
                      </td>
                      <td className="col-reg-action">
                        <button
                          type="button"
                          className="btn-quick-assign-queue"
                          title="ส่งเข้าคิวตรวจทันที"
                          onClick={() => handleAssignQueue(p)}
                        >
                          <svg viewBox="0 0 20 20" fill="currentColor" className="btn-icon-svg">
                            <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
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
              <button className="reg-modal-close" onClick={() => setSelectedPatientModal(null)}>
                ✕
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
