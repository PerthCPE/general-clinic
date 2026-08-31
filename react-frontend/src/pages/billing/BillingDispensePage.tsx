import { useState, useEffect } from 'react';
import './BillingDispensePage.css';
import { CLINIC_CONFIG, type PatientConfig } from '../../config/clinicConfig';

interface ToastState {
  message: string;
  type: 'success' | 'error' | 'doctor';
}

interface BillingDispensePageProps {
  onNavigateToBilling?: () => void;
  selectedPatientId?: string;
  onSelectPatientId?: (id: string) => void;
  patientRightsMap?: Record<string, string>;
  onUpdatePatientRights?: (patientId: string, rights: string) => void;
}

export default function BillingDispensePage({ 
  onNavigateToBilling, 
  selectedPatientId, 
  onSelectPatientId,
  patientRightsMap,
  onUpdatePatientRights
}: BillingDispensePageProps) {
  const [searchPatient, setSearchPatient] = useState('');
  const [searchQueueInput, setSearchQueueInput] = useState('');
  const [localPatientId, setLocalPatientId] = useState<string>(selectedPatientId || CLINIC_CONFIG.patients[0]?.id || '');
  const [isSearchExpanded, setIsSearchExpanded] = useState(true);
  const [queueList, setQueueList] = useState<PatientConfig[]>(CLINIC_CONFIG.patients.slice());

  const filteredQueue = queueList.filter(p => {
    if (!searchQueueInput.trim()) return true;
    const q = searchQueueInput.trim().toLowerCase();
    const cleanNationalId = p.nationalId.replace(/-/g, '');
    const cleanQ = q.replace(/-/g, '');
    return (
      p.id.toLowerCase().includes(q) ||
      p.hn.toLowerCase().includes(q) ||
      cleanNationalId.includes(cleanQ) ||
      p.name.toLowerCase().includes(q) ||
      p.shortName.toLowerCase().includes(q)
    );
  });

  const [toast, setToast] = useState<ToastState | null>({
    message: 'ได้รับข้อมูลใบสั่งยาจากคลังยาเรียบร้อยแล้ว พร้อมชำระเงิน',
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

  const activePatient: PatientConfig | undefined = queueList.find(p => p.id === localPatientId) || queueList[0];
  const currentRights = activePatient ? (patientRightsMap?.[activePatient.id] || activePatient.treatmentRights) : '';

  const handleSelectPatient = (id: string) => {
    setLocalPatientId(id);
    if (onSelectPatientId) {
      onSelectPatientId(id);
    }
  };

  const handleSearch = () => {
    const query = searchPatient.trim().toLowerCase();
    const found = queueList.find(
      p => p.id.toLowerCase() === query || p.name.toLowerCase().includes(query) || p.shortName.toLowerCase().includes(query)
    );
    if (found) {
      handleSelectPatient(found.id);
    }
  };

  const handleConfirmPayment = () => {
    if (!activePatient) return;
    triggerToast(`ชำระเงินเรียบร้อยแล้วสำหรับ ${activePatient.name} (ออกใบเสร็จชำระเงินสำเร็จ)`, 'success');
    
    if (onSelectPatientId) {
      onSelectPatientId(activePatient.id);
    }

    setQueueList(prev => prev.filter(p => p.id !== activePatient.id));
    if (queueList.length > 1) {
      const nextP = queueList.find(p => p.id !== activePatient.id);
      if (nextP) setLocalPatientId(nextP.id);
    }
    
    if (onNavigateToBilling) {
      setTimeout(() => {
        onNavigateToBilling();
      }, 900);
    }
  };

  const medTotal = activePatient ? activePatient.medications.reduce((sum, m) => sum + m.price, 0) : 0;

  return (
    <div className="billing-dispense-container">
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div className="header-titles">
          <h1 className="page-title">คิดเงินและออกบิลชำระเงิน</h1>
          <p className="page-subtitle">สรุปรายการค่ายา ค่าบริการทางการแพทย์ คำนวณส่วนลดสิทธิ์ และรับชำระเงิน</p>
        </div>
      </div>

      {/* Patient Search & Collapsible Recent Pharmacy Patients Queue Card */}
      <div className="search-card card" style={{ display: 'flex', flexDirection: 'column', width: '100%', padding: '0', marginBottom: '24px', transition: 'all 0.3s ease', overflow: 'hidden' }}>
        {/* Header Toggle */}
        <div 
          onClick={() => setIsSearchExpanded(!isSearchExpanded)}
          style={{ 
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
            padding: '18px 24px', background: '#F8FAFC', borderBottom: isSearchExpanded ? '1px solid #E2E8F0' : 'none',
            cursor: 'pointer', userSelect: 'none' 
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <h3 style={{ margin: '0 0 2px 0', fontSize: '16px', fontWeight: '700', color: '#0F172A', lineHeight: '1.3' }}>
                รายชื่อผู้ป่วยที่รอชำระเงิน (Pending Payments)
              </h3>
              <p style={{ margin: 0, fontSize: '13.5px', color: '#64748B', lineHeight: '1.4' }}>
                รายการผู้ป่วยที่บันทึกข้อมูลส่งมาจากห้องตรวจแพทย์ / ห้องยา เพื่อรับชำระเงิน
              </p>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {activePatient && (
              <span style={{ 
                background: '#DBEAFE', color: '#1E40AF', fontWeight: 'bold', 
                padding: '4px 12px', borderRadius: '16px', fontSize: '13px', border: '1px solid #93C5FD' 
              }}>
                ถึงคิวที่ {activePatient.queueNumber && activePatient.queueNumber.startsWith('Q') ? activePatient.queueNumber : `Q${String(activePatient.queueNumber).padStart(4, '0')}`} ({activePatient.name})
              </span>
            )}
            <span style={{ 
              background: '#DCFCE7', color: '#166534', fontWeight: 'bold', 
              padding: '4px 12px', borderRadius: '16px', fontSize: '13px' 
            }}>
              {queueList.length} คิว
            </span>
            <svg 
              width="18" height="18" viewBox="0 0 24 24" fill="none" 
              style={{ color: '#64748B', transform: isSearchExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.25s ease', flexShrink: 0 }}
            >
              <path d="M19.5 8.25l-7.5 7.5-7.5-7.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        {/* Expandable Content */}
        {isSearchExpanded && (
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px', background: '#FFFFFF' }}>
            {/* Search Input Box for Queue */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  type="text"
                  placeholder="ค้นหา HN หรือ ชื่อผู้ป่วย..."
                  value={searchQueueInput}
                  onChange={(e) => setSearchQueueInput(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px 10px 38px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13.5px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '15px', color: '#64748B' }}>
                  
                </span>
              </div>
              {searchQueueInput && (
                <button
                  onClick={() => setSearchQueueInput('')}
                  style={{
                    padding: '9px 14px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    background: '#F1F5F9',
                    color: '#475569',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  ✕ ล้าง
                </button>
              )}
            </div>

            {/* Patients Table */}
            <div style={{ overflowX: 'auto', marginTop: '16px' }}>
              <table style={{ width: '100%', minWidth: '950px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                <thead>
                  <tr style={{ color: '#0F172A', background: '#F8FAFC', borderBottom: '2px solid #E2E8F0', height: '48px', whiteSpace: 'nowrap' }}>
                    <th style={{ padding: '12px 16px', fontWeight: '700', fontSize: '15px' }}>ลำดับคิว</th>
                    <th style={{ padding: '12px 16px', fontWeight: '700', fontSize: '15px' }}>HN</th>
                    <th style={{ padding: '12px 16px', fontWeight: '700', fontSize: '15px' }}>ประเภท</th>
                    <th style={{ padding: '12px 16px', fontWeight: '700', fontSize: '15px' }}>ชื่อ-นามสกุล คนไข้</th>
                    <th style={{ padding: '12px 16px', fontWeight: '700', fontSize: '15px' }}>เลขบัตรประชาชน</th>
                    <th style={{ padding: '12px 16px', fontWeight: '700', fontSize: '15px' }}>สิทธิการรักษา</th>
                    <th style={{ padding: '12px 16px', fontWeight: '700', fontSize: '15px' }}>สถานะการชำระ</th>
                    <th style={{ padding: '12px 16px', fontWeight: '700', fontSize: '15px', textAlign: 'center' }}>การดำเนินการ</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQueue.length > 0 ? (
                    filteredQueue.map((p, index) => (
                      <tr 
                        key={p.id + '_' + index}
                        className={localPatientId === p.id ? 'active-row' : ''}
                        style={{ borderBottom: '1px solid #F1F5F9', whiteSpace: 'nowrap' }}
                      >
                        <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>
                          <span style={{ 
                            color: '#2563EB', 
                            fontWeight: '700', 
                            fontSize: '15px',
                            whiteSpace: 'nowrap', 
                            display: 'inline-block'
                          }}>
                            {p.queueNumber && p.queueNumber.startsWith('Q') ? p.queueNumber : `Q${String(index + 1).padStart(4, '0')}`}
                          </span>
                        </td>
                        <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: '14.5px', fontWeight: '700', color: '#0F172A', whiteSpace: 'nowrap' }}>
                            {p.hn.replace(/[-]/g, '')}
                          </span>
                        </td>
                        <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>
                          <span style={{ 
                            background: p.patientType.includes('OPD') ? '#EFF6FF' : '#F3E8FF', 
                            color: p.patientType.includes('OPD') ? '#1D4ED8' : '#6D28D9', 
                            border: `1px solid ${p.patientType.includes('OPD') ? '#BFDBFE' : '#DDD6FE'}`,
                            padding: '6px 14px', borderRadius: '9999px', fontSize: '13px', fontWeight: '700',
                            whiteSpace: 'nowrap', display: 'inline-block'
                          }}>
                            {p.patientType.includes('OPD') ? 'OPD (ผู้ป่วยนอก)' : 'IPD (ผู้ป่วยใน)'}
                          </span>
                        </td>
                        <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>
                          <div className="patient-table-name" style={{ whiteSpace: 'nowrap' }}>{p.name}</div>
                        </td>
                        <td className="patient-table-sub" style={{ padding: '12px', fontFamily: 'monospace', fontSize: '13px', whiteSpace: 'nowrap' }}>
                          {p.nationalId}
                        </td>
                        <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>
                          <span style={{ 
                            background: p.treatmentRights.includes('30') ? '#FEF9C3' : p.treatmentRights.includes('ประกันสังคม') ? '#E0F2FE' : '#F3E8FF',
                            color: p.treatmentRights.includes('30') ? '#92400E' : p.treatmentRights.includes('ประกันสังคม') ? '#075985' : '#6D28D9',
                            border: `1px solid ${p.treatmentRights.includes('30') ? '#FDE68A' : p.treatmentRights.includes('ประกันสังคม') ? '#BAE6FD' : '#DDD6FE'}`,
                            padding: '6px 14px', borderRadius: '9999px', fontSize: '13px', fontWeight: '700',
                            whiteSpace: 'nowrap', display: 'inline-block', minWidth: '150px', textAlign: 'center', boxSizing: 'border-box'
                          }}>
                            {p.treatmentRights.includes('30') ? 'สิทธิ 30 บาท (สปสช.)' : p.treatmentRights}
                          </span>
                        </td>
                        <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>
                          <span style={{ 
                            background: '#FEF2F2', color: '#DC2626', border: '1px solid #FCA5A5',
                            padding: '6px 14px', borderRadius: '9999px', fontSize: '13px', fontWeight: '700',
                            whiteSpace: 'nowrap', display: 'inline-block'
                          }}>
                            ยังไม่ชำระเงิน
                          </span>
                        </td>
                        <td className="patient-table-sub" style={{ padding: '12px', fontSize: '13px', whiteSpace: 'nowrap' }}>
                          <div style={{ fontWeight: '600' }}>{p.visitDate}</div>
                          <div style={{ fontSize: '12px', marginTop: '2px' }}>{p.visitTime}</div>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <button 
                            onClick={() => handleSelectPatient(p.id)}
                            style={{ 
                              padding: '8px 20px', 
                              background: localPatientId === p.id ? '#10B981' : '#2563EB', 
                              color: 'white', border: 'none', borderRadius: '10px', 
                              cursor: 'pointer', fontWeight: '700', fontSize: '14px',
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                              whiteSpace: 'nowrap', minWidth: '100px',
                              boxShadow: localPatientId === p.id ? '0 2px 6px rgba(16, 185, 129, 0.25)' : '0 2px 6px rgba(37, 99, 235, 0.25)'
                            }}
                          >
                            {localPatientId === p.id ? 'เลือกอยู่' : 'ชำระเงิน'}
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} style={{ padding: '24px', textAlign: 'center', color: '#EF4444', background: '#FEF2F2' }}>
                        ไม่พบข้อมูลผู้ป่วยที่ตรงกับคำค้นหา "{searchQueueInput}"
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {activePatient ? (
        <div className="dispense-grid">
          {/* Prescription List */}
          <div className="prescription-card card">
            <div className="card-top-row">
              <h2 className="card-heading">รายการยา - {activePatient.name}</h2>
              <select className="doctor-select">
                <option>ใบสั่งยาของแพทย์ประจำวัน</option>
              </select>
            </div>

            <div className="patient-search-box">
              <input
                type="text"
                placeholder="ค้นหาชื่อผู้ป่วย หรือ รหัสผู้ป่วย..."
                value={searchPatient}
                onChange={(e) => setSearchPatient(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>



            <table className="dispense-table">
              <thead>
                <tr>
                  <th>ชื่อรายการยา</th>
                  <th>ขนาด/วิธีใช้</th>
                  <th style={{ textAlign: 'right' }}>จำนวน</th>
                </tr>
              </thead>
              <tbody>
                {activePatient.medications.map((med, idx) => (
                  <tr key={idx}>
                    <td className="item-name font-bold">{med.name}</td>
                    <td>{med.dosage}</td>
                    <td style={{ textAlign: 'right' }}>1</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Dispensing & Price Summary */}
          <div className="summary-card card">
            <h2 className="card-heading">สรุปการจ่ายยาและคำนวณเงิน</h2>

            {/* Treatment Rights Selector Dropdown */}
            <div className="summary-rights-box">
              <label className="summary-rights-label">สิทธิการรักษา:</label>
              <select 
                className="summary-rights-select"
                value={currentRights}
                onChange={(e) => onUpdatePatientRights && activePatient && onUpdatePatientRights(activePatient.id, e.target.value)}
              >
                <option value="สิทธิ 30 บาท (บัตรทอง / สปสช.)">สิทธิ 30 บาท (บัตรทอง / สปสช.)</option>
                <option value="สิทธิประกันสังคม (Social Security)">สิทธิประกันสังคม (Social Security)</option>
                <option value="สิทธิข้าราชการ / จ่ายตรงกรมบัญชีกลาง">สิทธิข้าราชการ / จ่ายตรงกรมบัญชีกลาง</option>
                <option value="ประกันสุขภาพเอกชน (Private Insurance)">ประกันสุขภาพเอกชน (Private Insurance)</option>
                <option value="จ่ายตรง / เงินสด (Self Pay / Cash)">จ่ายตรง / เงินสด (Self Pay / Cash)</option>
              </select>
            </div>

            <div className="summary-items">
              {activePatient.medications.map((med, idx) => (
                <div key={idx} className="summary-item">
                  <div className="item-details">
                    <div className="item-title">{med.name}</div>
                    <div className="item-sub">{med.dosage}</div>
                  </div>
                  <div className="item-price">฿ {med.price.toLocaleString()}</div>
                </div>
              ))}
            </div>

            <div className="summary-divider"></div>

            <div className="summary-total-row main-total">
              <span>ค่ายารวมสุทธิ:</span>
              <span className="total-price">฿ {medTotal.toLocaleString()}</span>
            </div>

            <button className="submit-billing-btn" onClick={handleConfirmPayment}>
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
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>
          <div style={{ fontSize: '40px', marginBottom: '10px' }}></div>
          <h3>ยังไม่ได้เลือกผู้ป่วยในคิว</h3>
          <p>กรุณาเลือกลำดับคิวจาก Dropdown หรือกดปุ่มคิวผู้ป่วยด้านบนเพื่อดำเนินการต่อ</p>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`bottom-left-toast toast-${toast.type} ${isToastFading ? 'toast-fading' : ''}`}>
          <div className="toast-icon">
            {toast.type === 'success' && '✓'}
            {toast.type === 'doctor' && ''}
            {toast.type === 'error' && '✕'}
          </div>
          <div className="toast-message">{toast.message}</div>
        </div>
      )}
    </div>
  );
}
