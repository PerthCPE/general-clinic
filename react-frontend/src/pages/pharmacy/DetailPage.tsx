import { useState } from 'react';
import './DetailPage.css';
import { CLINIC_CONFIG, type PatientConfig } from '../../config/clinicConfig';

interface ToastState {
  message: string;
  type: 'success' | 'error' | 'doctor';
}

interface DetailPageProps {
  selectedPatientId?: string;
  onSelectPatientId?: (id: string) => void;
  patientRightsMap?: Record<string, string>;
  onUpdatePatientRights?: (patientId: string, rights: string) => void;
}

const TREATMENT_RIGHTS_OPTIONS = [
  'สิทธิ 30 บาท (บัตรทอง / สปสช.)',
  'สิทธิประกันสังคม (Social Security)',
  'สิทธิข้าราชการ / จ่ายตรงกรมบัญชีกลาง',
  'ประกันสุขภาพเอกชน (Private Insurance)',
  'จ่ายตรง / เงินสด (Self Pay / Cash)'
];

export default function DetailPage({ 
  selectedPatientId, 
  onSelectPatientId,
  patientRightsMap,
  onUpdatePatientRights
}: DetailPageProps) {
  const [patientIdInput, setPatientIdInput] = useState('');
  const [localPatientId, setLocalPatientId] = useState<string>(selectedPatientId || '');
  const [isSearchExpanded, setIsSearchExpanded] = useState(true);
  const [isPrescriptionExpanded, setIsPrescriptionExpanded] = useState(true);
  const [selectedMedInfo, setSelectedMedInfo] = useState<{ name: string; medId: string; properties: string } | null>(null);
  // คิวเริ่มต้น - ใช้รหัสจาก config เป็นตัวอย่าง
  const [queueList, setQueueList] = useState<PatientConfig[]>(CLINIC_CONFIG.patients.slice());
  
  // Current active patient object
  const activePatient: PatientConfig | undefined = CLINIC_CONFIG.patients.find(p => p.id === localPatientId);
  const currentRights = activePatient ? ((patientRightsMap && patientRightsMap[activePatient.id]) || activePatient.treatmentRights) : '';

  const [toast, setToast] = useState<ToastState | null>({
    message: 'ได้รับข้อมูลใบสั่งยาล่าสุดจากแพทย์เรียบร้อยแล้ว',
    type: 'doctor'
  });

  const triggerToast = (message: string, type: 'success' | 'error' | 'doctor') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };



  // จำลองแพทย์ส่งคนไข้ใหม่ - เพิ่มเข้าคิวล่างสุด อย่า auto-select
  const handleSimulateDoctorSubmit = () => {
    // หาคนไข้ที่ยังไม่อยู่ในคิว เพิ่มใหม่
    const allPatients = CLINIC_CONFIG.patients;
    const nextPatient = allPatients.find(p => !queueList.some(q => q.id === p.id));
    if (nextPatient) {
      setQueueList(prev => [...prev, nextPatient]);
      triggerToast(`🩺 แพทย์ส่งใบสั่งยาเข้ามาใหม่: ${nextPatient.name} (เพิ่มเข้าคิว)`, 'doctor');
    } else {
      // ถ้าคนไข้อยู่ในคิวหมดแล้ว เพิ่มซ้ำจากต้น
      const cyclePatient = allPatients[queueList.length % allPatients.length];
      setQueueList(prev => [...prev, { ...cyclePatient, id: cyclePatient.id + '_' + Date.now(), hn: 'HN-' + Math.floor(Math.random() * 1000).toString().padStart(4,'0') }]);
      triggerToast(`🩺 แพทย์ส่งคนไข้เข้าคิวใหม่`, 'doctor');
    }
  };

  // กดยืนยันการจ่ายยา: ลบคนไข้ออกจากคิว + รีเซ็ต selection
  const handleSendToBilling = () => {
    if (!activePatient) return;
    triggerToast(`ยืนยันการจ่ายยาเรียบร้อย! ส่งข้อมูลใบสั่งยาของ ${activePatient.name} ไปยังระบบการเงินแล้ว`, 'success');
    // ลบคนไข้ออกจากคิว
    setQueueList(prev => prev.filter(p => p.id !== activePatient.id));
    // รีเซ็ต selection
    setLocalPatientId('');
    if (onSelectPatientId) onSelectPatientId('');
  };



  return (
    <div className="detail-page-container">

      {/* Action Bar (Top) */}
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <div className="header-titles">
          <div className="title-row">
            <h1>รายละเอียดการจ่ายยา</h1>
          </div>
        </div>
        <button className="doctor-submit-sim-btn" onClick={handleSimulateDoctorSubmit}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
          </svg>
          จำลองหมอกด Submit ใบสั่งยา
        </button>
      </div>

      {/* Patient Search & Collapsible Recent Patients Card */}
      <div className="search-card card" style={{ display: 'flex', flexDirection: 'column', width: '100%', padding: '0', marginBottom: '20px', transition: 'all 0.3s ease', overflow: 'hidden' }}>
        {/* Header */}
        <div 
          onClick={() => setIsSearchExpanded(!isSearchExpanded)}
          style={{ 
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
            padding: '16px 20px', background: '#F8FAFC', borderBottom: isSearchExpanded ? '1px solid #E2E8F0' : 'none',
            cursor: 'pointer', userSelect: 'none' 
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: '#F1F5F9', padding: '8px 10px', borderRadius: '8px', fontSize: '18px' }}>📋</div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#0F172A' }}>
                รายชื่อผู้ป่วยที่ลงทะเบียนล่าสุด (Recent Patients)
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748B' }}>
                รายการผู้ป่วยที่บันทึกข้อมูลส่งมาจากห้องตรวจแพทย์
              </p>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ 
              background: '#F3E8FF', color: '#9333EA', fontWeight: 'bold', 
              padding: '4px 12px', borderRadius: '16px', fontSize: '13px' 
            }}>
              {queueList.length} คนไข้
            </span>
            <svg 
              width="18" height="18" viewBox="0 0 24 24" fill="none" 
              style={{ color: '#64748B', transform: isSearchExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.25s ease', flexShrink: 0 }}
            >
              <path d="M19.5 8.25l-7.5 7.5-7.5-7.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
        
        {isSearchExpanded && (
          <div style={{ padding: '16px 20px' }}>
            {/* Filter Search Input */}
            <div style={{ marginBottom: '15px', display: 'flex', gap: '10px' }}>
              <input 
                type="text" 
                placeholder="ค้นหาด้วยข้อมูลเลขบัตรประชาชน, HN หรือ ชื่อ-นามสกุล..." 
                value={patientIdInput} 
                onChange={(e) => setPatientIdInput(e.target.value)} 
                style={{ flex: 1, padding: '9px 14px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '14px' }}
              />
              <button 
                style={{ padding: '0 20px', background: '#2563EB', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
              >
                ค้นหา
              </button>
            </div>

            {/* Patients Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                <thead>
                  <tr style={{ color: '#64748B', borderBottom: '1px solid #E2E8F0', height: '40px' }}>
                    <th style={{ padding: '8px 12px', fontWeight: '600' }}>HN</th>
                    <th style={{ padding: '8px 12px', fontWeight: '600' }}>ชื่อ-นามสกุล คนไข้</th>
                    <th style={{ padding: '8px 12px', fontWeight: '600' }}>เลขบัตรประชาชน</th>
                    <th style={{ padding: '8px 12px', fontWeight: '600' }}>เบอร์โทรศัพท์</th>
                    <th style={{ padding: '8px 12px', fontWeight: '600' }}>สิทธิการรักษา</th>
                    <th style={{ padding: '8px 12px', fontWeight: '600' }}>เวลาลงทะเบียน</th>
                    <th style={{ padding: '8px 12px', fontWeight: '600', textAlign: 'center' }}>การดำเนินการ</th>
                  </tr>
                </thead>
                <tbody>
                  {queueList
                    .filter(p => 
                      patientIdInput === '' ||
                      p.id.toLowerCase().includes(patientIdInput.toLowerCase()) || 
                      p.hn.toLowerCase().includes(patientIdInput.toLowerCase()) ||
                      p.nationalId.includes(patientIdInput) ||
                      p.name.toLowerCase().includes(patientIdInput.toLowerCase())
                    )
                    .map((p, index) => (
                    <tr 
                      key={p.id + '_' + index}
                      style={{ 
                        borderBottom: '1px solid #F1F5F9',
                        background: localPatientId === p.id ? '#EFF6FF' : 'transparent'
                      }}
                    >
                      <td style={{ padding: '12px' }}>
                        <span style={{ 
                          background: '#EFF6FF', color: '#2563EB', padding: '4px 8px', 
                          borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', border: '1px solid #BFDBFE' 
                        }}>
                          {p.hn}
                        </span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ fontWeight: 'bold', color: '#0F172A' }}>{p.name}</div>
                        <div style={{ fontSize: '12px', color: '#64748B' }}>เพศ {p.gender}, อายุ {p.age} ปี</div>
                      </td>
                      <td style={{ padding: '12px', color: '#334155' }}>{p.nationalId}</td>
                      <td style={{ padding: '12px', color: '#334155' }}>{p.phone}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{ 
                          background: p.treatmentRights.includes('30') ? '#FEF3C7' : p.treatmentRights.includes('ประกันสังคม') ? '#E0F2FE' : '#F3E8FF',
                          color: p.treatmentRights.includes('30') ? '#92400E' : p.treatmentRights.includes('ประกันสังคม') ? '#075985' : '#6B21A8',
                          padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '500'
                        }}>
                          {p.treatmentRights.split(' ')[0]} {p.treatmentRights.includes('บัตรทอง') ? '(สปสช.)' : ''}
                        </span>
                      </td>
                      <td style={{ padding: '12px', color: '#64748B', fontSize: '13px' }}>
                        {p.visitDate} {p.visitTime} น.
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <button 
                          onClick={() => {
                            setLocalPatientId(p.id);
                            if (onSelectPatientId) onSelectPatientId(p.id);
                          }}
                          style={{ 
                            padding: '6px 14px', 
                            background: localPatientId === p.id ? '#10B981' : '#2563EB', 
                            color: 'white', border: 'none', borderRadius: '6px', 
                            cursor: 'pointer', fontWeight: 'bold', fontSize: '13px',
                            display: 'inline-flex', alignItems: 'center', gap: '4px'
                          }}
                        >
                          ⚡ {localPatientId === p.id ? 'เลือกอยู่' : 'เข้าคิว'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="searched-details-wrapper">
        {activePatient ? (
          <>
        <section className="patient-card">
          <div className="patient-card-main">
            <div className="patient-avatar">{activePatient.shortName.charAt(0)}</div>
            <div className="patient-info-container">
              <div className="patient-title-row">
                <h3 className="patient-name">{activePatient.name}</h3>
                <div className="patient-badges">
                  <span className="badge ticket-badge">{activePatient.ticket}</span>
                  <span className="badge hn-badge">HN: {activePatient.hn}</span>
                </div>
              </div>
              <div className="patient-details">
                เพศ{activePatient.gender}, อายุ {activePatient.age} ปี • วันเกิด: {activePatient.dob} • โทร: {activePatient.phone} • อาชีพ: {activePatient.occupation}
              </div>
            </div>
          </div>

          <div className="patient-card-footer">

              <div className="info-box rights-selector-box">
                <span className="info-label">🛡️ สิทธิการรักษา (CLICK TO CHANGE)</span>
                <select
                  className="rights-select-dropdown"
                  value={currentRights}
                  onChange={(e) => {
                    const newRights = e.target.value;
                    if (onUpdatePatientRights) onUpdatePatientRights(activePatient.id, newRights);
                    triggerToast(`อัปเดตสิทธิการรักษาของ ${activePatient.name} เป็น "${newRights}" สำเร็จ`, 'success');
                  }}
                >
                  {TREATMENT_RIGHTS_OPTIONS.map((right, idx) => (
                    <option key={idx} value={right}>{right}</option>
                  ))}
                </select>
              </div>
              <div className="info-box">
                <span className="info-label">เวลาเข้ารักษา (VISIT TIME)</span>
                <span className="info-val">{activePatient.visitDate} ({activePatient.visitTime})</span>
              </div>
              <div className="info-box">
                <span className="info-label">ประวัติแพ้ยา (KNOWN ALLERGIES)</span>
                <div className="badge-wrapper">
                  {activePatient.allergies.map((a, i) => (
                    <span key={i} className="badge allergy-badge">{a}</span>
                  ))}
                </div>
              </div>
              <div className="info-box">
                <span className="info-label">โรคประจำตัว (CHRONIC DISEASES)</span>
                <span className="info-val">{activePatient.chronicDiseases}</span>
              </div>
              <div className="info-box">
                <span className="info-label">สัญญาณชีพ (CURRENT VITALS)</span>
                <span className="info-val">{activePatient.vitals}</span>
              </div>
              <div className="info-box">
                <span className="info-label">สถานะ (VISIT STATUS)</span>
                <div className="badge-wrapper">
                  <span className="badge status-badge-examining">{activePatient.visitStatus}</span>
                </div>
              </div>
            </div>
          </section>
          {/* Section: Prescription & Dispensing - Collapsible */}
          <div 
            className="dispense-section-header"
            onClick={() => setIsPrescriptionExpanded(!isPrescriptionExpanded)}
            style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <h3 className="section-title" style={{ margin: 0 }}>รายละเอียดใบสั่งยา & ดำเนินการจ่ายยา</h3>
            <svg 
              width="18" height="18" viewBox="0 0 24 24" fill="none" 
              style={{ color: '#64748B', transform: isPrescriptionExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.25s ease', flexShrink: 0 }}
            >
              <path d="M19.5 8.25l-7.5 7.5-7.5-7.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          {isPrescriptionExpanded && (
            <>
              {/* Doctor Advice Card */}
              {activePatient.doctorAdvice && (
                <div className="doctor-advice-card">
                  <div className="doctor-advice-icon">🩺</div>
                  <div className="doctor-advice-content">
                    <h4 className="doctor-advice-title">คำแนะนำจากแพทย์ (Doctor's Note & Clinical Advice)</h4>
                    <p className="doctor-advice-text">{activePatient.doctorAdvice}</p>
                  </div>
                </div>
              )}

              {/* Medication + Stock Combined List */}
              <div className="card" style={{ padding: '20px' }}>
                <h4 className="column-title" style={{ marginBottom: '16px' }}>
                  รายการยาที่สั่งจ่าย ({activePatient.medications.length} รายการ)
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {activePatient.medications.map((med, index) => (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '14px 16px',
                        borderRadius: '10px',
                        border: '1px solid #E2E8F0',
                        background: '#F8FAFC',
                      }}
                    >
                      {/* MED ID Badge */}
                      <div style={{ 
                        flexShrink: 0, width: '80px',
                        fontSize: '12px', color: '#64748B', fontWeight: '600' 
                      }}>
                        {med.medId}
                      </div>

                      {/* Icon */}
                      <div className="med-item-icon-box" style={{ flexShrink: 0 }}>
                        <span className="med-icon-pill">💊</span>
                      </div>

                      {/* Med details - clickable name */}
                      <div className="med-item-details" style={{ flex: 1, minWidth: 0 }}>
                        <h4 
                          className="med-item-name" 
                          style={{ marginBottom: '2px', cursor: 'pointer', color: '#2563EB', textDecoration: 'underline dotted' }}
                          onClick={() => setSelectedMedInfo({ name: med.name, medId: med.medId, properties: med.properties })}
                          title="คลิกเพื่อดูสรรพคุณยา"
                        >
                          {med.name}
                        </h4>
                        <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>
                          🔍 คลิกเพื่อดูรายละเอียดสรรพคุณ
                        </div>
                        <div className="med-item-dosage">{med.dosage}</div>
                        <div className="med-item-instructions">คำแนะนำ: {med.instructions}</div>
                      </div>

                      {/* Stock Status */}
                      <div
                        className={`stock-status-card ${med.stockStatus === 'out-stock' ? 'status-card-out' : 'status-card-in'}`}
                        style={{ flexShrink: 0, minWidth: '160px', margin: 0 }}
                      >
                        <div className="status-card-info">
                          <div className="status-main-text">
                            {med.stockStatus === 'out-stock' ? 'Out of Stock' : 'In Stock (มีในคลัง)'}
                          </div>
                          <div className="status-sub-count">จำนวน: {med.stock}</div>
                        </div>
                        <div className="status-card-badge">
                          {med.stockStatus === 'out-stock' ? (
                            <div className="alert-badge-red">
                              <span className="x-circle">✕</span>
                            </div>
                          ) : (
                            <div className="check-circle-green">✓</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Button: Confirm & Send to Billing */}
              <div className="send-billing-action-bar">
                <button className="confirm-send-billing-btn" onClick={handleSendToBilling}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                  ยืนยันการจ่ายยา & ส่งข้อมูลไปการเงิน (Confirm & Send to Billing)
                </button>
              </div>
            </>
          )}

          </>
        ) : (
          <div className="not-found-card card" style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>
            <div className="not-found-icon" style={{ fontSize: '40px', marginBottom: '10px' }}>🏥</div>
            <h3>ยังไม่ได้เลือกผู้ป่วย</h3>
            <p>กรุณาเลือกลำดับคิวจาก Dropdown หรือพิมพ์ค้นหาเพื่อดำเนินการต่อ</p>
          </div>
        )}
        </div>

      {/* Toast Notification */}
      {toast && (
        <div className={`bottom-left-toast toast-${toast.type}`}>
          <div className="toast-icon">
            {toast.type === 'success' && '✓'}
            {toast.type === 'doctor' && '🩺'}
            {toast.type === 'error' && '✕'}
          </div>
          <div className="toast-message">{toast.message}</div>
        </div>
      )}
    </div>
  );
}
