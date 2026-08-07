import { useState, useEffect } from 'react';
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
  const [isToastFading, setIsToastFading] = useState(false);

  const triggerToast = (message: string, type: 'success' | 'error' | 'doctor') => {
    setIsToastFading(false);
    setToast({ message, type });
    setTimeout(() => {
      setIsToastFading(true);
      setTimeout(() => {
        setToast(null);
        setIsToastFading(false);
      }, 400);
    }, 3500);
  };

  // ค้างไว้ 3.5 วินาที แล้วค่อยๆ จางหายไปเมื่อโหลดหน้าเว็บครั้งแรก
  useEffect(() => {
    const timer1 = setTimeout(() => {
      setIsToastFading(true);
      const timer2 = setTimeout(() => {
        setToast(null);
        setIsToastFading(false);
      }, 400);
      return () => clearTimeout(timer2);
    }, 3500);
    return () => clearTimeout(timer1);
  }, []);



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
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {activePatient && (
              <span style={{ 
                background: '#DBEAFE', color: '#1E40AF', fontWeight: 'bold', 
                padding: '4px 12px', borderRadius: '16px', fontSize: '13px', border: '1px solid #93C5FD' 
              }}>
                🔔 ถึงคิวที่ {activePatient.queueNumber} ({activePatient.name})
              </span>
            )}
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
              <table style={{ width: '100%', minWidth: '1050px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                <thead>
                  <tr style={{ color: '#64748B', borderBottom: '1px solid #E2E8F0', height: '40px', whiteSpace: 'nowrap' }}>
                    <th style={{ padding: '10px 12px', fontWeight: '600' }}>ลำดับคิว</th>
                    <th style={{ padding: '10px 12px', fontWeight: '600' }}>HN</th>
                    <th style={{ padding: '10px 12px', fontWeight: '600' }}>ชื่อ-นามสกุล คนไข้</th>
                    <th style={{ padding: '10px 12px', fontWeight: '600' }}>เลขบัตรประชาชน</th>
                    <th style={{ padding: '10px 12px', fontWeight: '600' }}>เบอร์โทรศัพท์</th>
                    <th style={{ padding: '10px 12px', fontWeight: '600' }}>สิทธิการรักษา</th>
                    <th style={{ padding: '10px 12px', fontWeight: '600' }}>เวลาลงทะเบียน</th>
                    <th style={{ padding: '10px 12px', fontWeight: '600', textAlign: 'center' }}>การดำเนินการ</th>
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
                      className={localPatientId === p.id ? 'active-row' : ''}
                      style={{ borderBottom: '1px solid #F1F5F9', whiteSpace: 'nowrap' }}
                    >
                      <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>
                        <span style={{ 
                          background: localPatientId === p.id ? '#10B981' : '#F1F5F9', 
                          color: localPatientId === p.id ? '#FFFFFF' : '#0F172A', 
                          border: `1px solid ${localPatientId === p.id ? '#10B981' : '#CBD5E1'}`,
                          padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', fontSize: '13px',
                          whiteSpace: 'nowrap', display: 'inline-block', minWidth: '85px', textAlign: 'center'
                        }}>
                          {localPatientId === p.id ? '► ' : ''}คิว {p.queueNumber || index + 1}
                        </span>
                      </td>
                      <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>
                        <span className="patient-hn-badge" style={{ 
                          background: '#EFF6FF', color: '#2563EB', padding: '4px 8px', 
                          borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', border: '1px solid #BFDBFE',
                          whiteSpace: 'nowrap'
                        }}>
                          {p.hn}
                        </span>
                      </td>
                      <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>
                        <div className="patient-table-name" style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>{p.name}</div>
                      </td>
                      <td className="patient-table-sub" style={{ padding: '12px', fontFamily: 'monospace', fontSize: '13px', whiteSpace: 'nowrap' }}>{p.nationalId}</td>
                      <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>{p.phone}</td>
                      <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>
                        <span style={{ 
                          background: p.treatmentRights.includes('30') ? '#FEF3C7' : p.treatmentRights.includes('ประกันสังคม') ? '#E0F2FE' : '#F3E8FF',
                          color: p.treatmentRights.includes('30') ? '#92400E' : p.treatmentRights.includes('ประกันสังคม') ? '#075985' : '#6B21A8',
                          padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '500',
                          whiteSpace: 'nowrap'
                        }}>
                          {p.treatmentRights.split(' ')[0]} {p.treatmentRights.includes('บัตรทอง') ? '(สปสช.)' : ''}
                        </span>
                      </td>
                      <td className="patient-table-sub" style={{ padding: '12px', fontSize: '13px', whiteSpace: 'nowrap' }}>
                        {p.visitDate} {p.visitTime}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button 
                          onClick={() => {
                            setLocalPatientId(p.id);
                            if (onSelectPatientId) onSelectPatientId(p.id);
                          }}
                          style={{ 
                            padding: '8px 16px', 
                            background: localPatientId === p.id ? '#10B981' : '#2563EB', 
                            color: 'white', border: 'none', borderRadius: '8px', 
                            cursor: 'pointer', fontWeight: 'bold', fontSize: '13.5px',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                            whiteSpace: 'nowrap', minWidth: '95px'
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
              <div className="patient-details" style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'center', fontSize: '1.05rem' }}>
                <span>เพศ {activePatient.gender}</span>
                <span>อายุ {activePatient.age} ปี</span>
                <span>วันเกิด: {activePatient.dob}</span>
                <span>เบอร์โทร: {activePatient.phone}</span>
                <span>อาชีพ: {activePatient.occupation}</span>
              </div>
            </div>
          </div>

          <div className="patient-card-footer">

              <div className="info-box">
                <span className="info-label">สิทธิการรักษา (TREATMENT RIGHTS)</span>
                <span className="info-val" style={{ color: '#60A5FA', fontWeight: 'bold' }}>
                  {currentRights}
                </span>
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

              {/* Medication + Stock Combined List Table */}
              <div className="card" style={{ padding: '20px' }}>
                <h4 className="column-title" style={{ marginBottom: '16px' }}>
                  รายการยาที่สั่งจ่าย ({activePatient.medications.length} รายการ)
                </h4>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                    <thead>
                      <tr style={{ color: '#64748B', borderBottom: '1px solid #E2E8F0', height: '40px' }}>
                        <th style={{ padding: '10px 12px', fontWeight: '600' }}>รหัสยา</th>
                        <th style={{ padding: '10px 12px', fontWeight: '600' }}>ชื่อรายการยา & สรรพคุณ</th>
                        <th style={{ padding: '10px 12px', fontWeight: '600' }}>ขนาด / วิธีรับประทาน</th>
                        <th style={{ padding: '10px 12px', fontWeight: '600', textAlign: 'right' }}>ราคา</th>
                        <th style={{ padding: '10px 12px', fontWeight: '600', textAlign: 'center' }}>สถานะคลังยา</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activePatient.medications.map((med, index) => (
                        <tr key={index} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '12px' }}>
                            <span className="patient-hn-badge" style={{ background: '#F1F5F9', color: '#475569', border: '1px solid #CBD5E1' }}>
                              {med.medId}
                            </span>
                          </td>
                          <td style={{ padding: '12px' }}>
                            <div 
                              className="patient-table-name" 
                              style={{ color: '#2563EB', fontWeight: 'bold', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                              onClick={() => setSelectedMedInfo({ name: med.name, medId: med.medId, properties: med.properties })}
                              title="คลิกเพื่อดูรายละเอียดสรรพคุณ"
                            >
                              💊 {med.name}
                            </div>
                            <div>
                              <span 
                                style={{ 
                                  fontSize: '13px', color: '#0284C7', fontWeight: '600', 
                                  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '3px' 
                                }}
                                onClick={() => setSelectedMedInfo({ name: med.name, medId: med.medId, properties: med.properties })}
                              >
                                🔍 คลิกเพื่อดูรายละเอียดสรรพคุณ
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: '12px' }}>
                            <div style={{ fontWeight: '600', color: '#1E293B' }}>{med.dosage}</div>
                            <div style={{ fontSize: '12.5px', color: '#64748B', marginTop: '2px' }}>คำแนะนำ: {med.instructions}</div>
                          </td>
                          <td style={{ padding: '12px', textAlign: 'right', fontWeight: '700', fontSize: '14.5px', color: '#0F172A' }}>
                            ฿ {med.price.toLocaleString()}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <span 
                              style={{ 
                                background: med.stockStatus === 'out-stock' ? '#FEE2E2' : '#DCFCE7', 
                                color: med.stockStatus === 'out-stock' ? '#991B1B' : '#166534', 
                                border: `1px solid ${med.stockStatus === 'out-stock' ? '#FCA5A5' : '#86EFAC'}`,
                                padding: '4px 12px', borderRadius: '12px', fontSize: '12.5px', fontWeight: 'bold',
                                display: 'inline-flex', alignItems: 'center', gap: '4px'
                              }}
                            >
                              {med.stockStatus === 'out-stock' ? '✕ สต็อกหมด (0)' : `✓ มีในคลัง (${med.stock})`}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action Button: Confirm & Send to Billing */}
              <div className="send-billing-action-bar">
                <button className="confirm-send-billing-btn" onClick={handleSendToBilling}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: '1.3' }}>
                    <span style={{ fontSize: '1rem', fontWeight: '800' }}>ยืนยันการจ่ายยา & ส่งข้อมูลไปการเงิน</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: '500', opacity: 0.95 }}>
                      (Confirm & Send to Billing)
                    </span>
                  </div>
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
        <div className={`bottom-left-toast toast-${toast.type} ${isToastFading ? 'toast-fading' : ''}`}>
          <div className="toast-icon">
            {toast.type === 'success' && '✓'}
            {toast.type === 'doctor' && '🩺'}
            {toast.type === 'error' && '✕'}
          </div>
          <div className="toast-message">{toast.message}</div>
        </div>
      )}

      {/* Medication Details Modal Popup */}
      {selectedMedInfo && (
        <div 
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
          onClick={() => setSelectedMedInfo(null)}
        >
          <div 
            style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              maxWidth: '520px',
              width: '100%',
              padding: '28px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)',
              border: '1px solid #E2E8F0'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '28px' }}>💊</span>
                <div>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748B' }}>{selectedMedInfo.medId}</span>
                  <h3 style={{ margin: 0, fontSize: '18px', color: '#0F172A', fontWeight: 'bold' }}>{selectedMedInfo.name}</h3>
                </div>
              </div>
              <button 
                onClick={() => setSelectedMedInfo(null)}
                style={{
                  background: '#F1F5F9', border: 'none', borderRadius: '50%',
                  width: '32px', height: '32px', cursor: 'pointer',
                  fontWeight: 'bold', color: '#64748B', fontSize: '16px'
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ background: '#F0F9FF', padding: '18px 20px', borderRadius: '12px', border: '1.5px solid #BAE6FD', marginBottom: '22px' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '15px', color: '#0284C7', fontWeight: '800' }}>
                📋 สรรพคุณและข้อมูลยา (Medication Properties & Indications):
              </h4>
              <p style={{ margin: 0, fontSize: '15px', color: '#0F172A', lineHeight: '1.65', fontWeight: '500' }}>
                {selectedMedInfo.properties || 'ยารักษาโรคทั่วไปตามคำสั่งแพทย์ ควรรับประทานยาตามวิธีใช้ที่ระบุบนฉลากยาอย่างเคร่งครัด'}
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setSelectedMedInfo(null)}
                style={{
                  padding: '10px 24px',
                  background: '#2563EB',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
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
