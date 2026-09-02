import { useState, useEffect } from 'react';
import './BillingDispensePage.css';
import { CLINIC_CONFIG, type PatientConfig } from '../../config/clinicConfig';
import { useWebSocket } from '../../context/WebSocketContext';

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
  const { subscribe } = useWebSocket();
  const [searchPatient, setSearchPatient] = useState('');
  const [searchQueueInput, setSearchQueueInput] = useState('');
  const [localPatientId, setLocalPatientId] = useState<string>(() => {
    return selectedPatientId || localStorage.getItem('billing_active_patient') || '';
  });

  useEffect(() => {
    if (localPatientId) {
      localStorage.setItem('billing_active_patient', localPatientId);
    } else {
      localStorage.removeItem('billing_active_patient');
    }
  }, [localPatientId]);
  const [isSearchExpanded, setIsSearchExpanded] = useState(true);
  
  // คิวเริ่มต้น - เริ่มจากตารางว่างเปล่าแบบ Clean State
  const [queueList, setQueueList] = useState<PatientConfig[]>([]);

  // Current active patient object
  const activePatient: PatientConfig | undefined = queueList.find(p => p.id === localPatientId) || queueList[0] || CLINIC_CONFIG.patients.find(p => p.id === localPatientId) || CLINIC_CONFIG.patients[0];
  const currentRights = activePatient ? (patientRightsMap?.[activePatient.id] || activePatient.treatmentRights) : '';

  const filteredQueue = queueList.filter(p => {
    if (!searchQueueInput.trim()) return true;
    const q = searchQueueInput.trim().toLowerCase();
    const cleanNationalId = p.nationalId ? p.nationalId.replace(/-/g, '') : '';
    const cleanQ = q.replace(/-/g, '');
    return (
      (p.id || '').toLowerCase().includes(q) ||
      (p.hn || '').toLowerCase().includes(q) ||
      cleanNationalId.includes(cleanQ) ||
      (p.name || '').toLowerCase().includes(q) ||
      (p.shortName || '').toLowerCase().includes(q)
    );
  });

  const [toast, setToast] = useState<ToastState | null>(null);
  const [isToastFading, setIsToastFading] = useState(false);

  // Real-time Queue & Billing Listener (คิวการเงินเฉพาะ ไม่ปนกับคิวหมอ)
  useEffect(() => {
    const fetchInitialQueue = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};
        
        let bRes = await fetch('/api/billing/queues', { headers });
        if (!bRes.ok) {
          bRes = await fetch('/api/system/billing/queues');
        }
        if (bRes.ok) {
          const bData = await bRes.json();
          if (bData.status === 'success' && Array.isArray(bData.queues) && bData.queues.length > 0) {
            const mapped = bData.queues.map((bq: any) => {
              let parsedMeds = [];
              if (bq.medications) {
                try {
                  parsedMeds = typeof bq.medications === 'string' ? JSON.parse(bq.medications) : bq.medications;
                } catch {}
              }
              return {
                id: String(bq.id),
                visitId: bq.visit_id || 1,
                hn: bq.hn || `HN${bq.id}`,
                nationalId: bq.national_id || '-',
                queueNumber: bq.queue_number || 'B-001',
                ticket: bq.queue_number || 'B-001',
                name: bq.patient_name || 'ผู้ป่วย',
                shortName: bq.patient_name || 'ผู้ป่วย',
                gender: bq.gender || 'หญิง',
                age: bq.age || 35,
                treatmentRights: bq.scheme_type || 'บัตรทอง (สปสช.)',
                patientType: 'ผู้ป่วยนอก (OPD)' as const,
                allergies: ['ไม่มีประวัติแพ้ยา'],
                chronicDiseases: 'ไม่มี',
                vitals: 'ความดัน 120/80 mmHg, อุณหภูมิ 36.6 °C',
                visitStatus: 'รอรับยา / ชำระเงิน',
                visitDate: new Date(bq.created_at || Date.now()).toLocaleDateString('th-TH'),
                visitTime: new Date(bq.created_at || Date.now()).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.',
                doctorAdvice: bq.doctor_advice || 'มีไข้ ไอ เจ็บคอ แพทย์สั่งจ่ายยา',
                medications: parsedMeds
              };
            });
            setQueueList(mapped);
            setLocalPatientId(prev => {
              if (mapped.length > 0) {
                if (!prev || !mapped.find((q: any) => q.id === prev)) {
                  return mapped[0].id;
                }
              }
              return prev;
            });
          } else {
            setQueueList(CLINIC_CONFIG.patients);
            setLocalPatientId(prev => prev || CLINIC_CONFIG.patients[0]?.id);
          }
        }
      } catch (err) {
        console.error('Failed to fetch initial billing queue:', err);
      }
    };
    
    fetchInitialQueue();

    const unsubBill = subscribe('BILLING_CREATED', (data: any) => {
      if (data) {
        const pName = data.patient_name || 'ผู้ป่วย';
        const newPatient: PatientConfig = {
          id: String(data.queue_id || data.id || data.visit_id || Date.now()),
          visitId: data.visit_id || 1,
          hn: data.hn || `HN0094`,
          nationalId: data.national_id || '-',
          queueNumber: data.queue_number || 'B-001',
          ticket: data.queue_number || 'B-001',
          name: pName,
          shortName: pName,
          gender: data.gender || 'หญิง',
          age: data.age || 35,
          dob: '01/01/2534',
          phone: '081-999-8888',
          occupation: 'รับจ้างทั่วไป',
          treatmentRights: data.scheme_type || 'บัตรทอง (สปสช.)',
          patientType: 'ผู้ป่วยนอก (OPD)',
          allergies: ['ไม่มีประวัติแพ้ยา'],
          chronicDiseases: 'ไม่มี',
          vitals: 'ความดัน 120/80 mmHg, อุณหภูมิ 36.6 °C',
          visitStatus: 'รอรับยา / ชำระเงิน',
          visitDate: new Date().toLocaleDateString('th-TH'),
          visitTime: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.',
          doctorAdvice: data.doctor_advice || 'มีไข้ ไอ เจ็บคอ แพทย์สั่งจ่ายยา',
          medications: data.medications || [],
        };
        setQueueList(prev => [newPatient, ...prev.filter(q => q.id !== newPatient.id)]);
        setLocalPatientId(newPatient.id);
        if (onSelectPatientId) onSelectPatientId(newPatient.id);
        triggerToast(`ได้รับคิวใหม่จากการจัดการยา: ${pName} (${data.queue_number || ''})`, 'doctor');
      }
    });

    const unsubQueue = subscribe('QUEUE_UPDATED', (data: any) => {
      if (data && data.action === 'db_reset') {
        setQueueList([]);
      } else {
        fetchInitialQueue();
      }
    });

    const unsubPay = subscribe('PAYMENT_CONFIRMED', () => {
      fetchInitialQueue();
    });

    return () => {
      unsubBill();
      unsubQueue();
      unsubPay();
    };
  }, [subscribe]);

  // Real-time Query Medications from DB for Active Billing Patient
  useEffect(() => {
    if (activePatient && activePatient.visitId) {
      const fetchMeds = async () => {
        try {
          let res = await fetch(`/api/pharmacy/dispensing/${activePatient.visitId}`);
          if (!res.ok) {
            res = await fetch(`/api/system/dispensing/${activePatient.visitId}`);
          }
          if (res.ok) {
            const data = await res.json();
            if (data.status === 'success' && Array.isArray(data.dispensing) && data.dispensing.length > 0) {
              const fetchedMeds = data.dispensing.map((item: any) => ({
                medId: item.Medicine?.code || `MED-${item.medicine_id}`,
                name: item.Medicine?.name || 'ยาบรรเทาอาการ',
                genericName: item.Medicine?.generic_name || '',
                category: item.Medicine?.category || 'ยาสามัญ',
                properties: item.Medicine?.properties || 'ยาบรรเทาอาการตามแพทย์สั่ง',
                dosage: item.dosage || '1 เม็ด วันละ 3 ครั้ง หลังอาหาร',
                instructions: item.instructions || 'รับประทานหลังอาหาร เช้า กลางวัน เย็น',
                price: item.Medicine?.unit_price || 50,
                quantity: item.quantity || 1,
                stock: item.Medicine?.stock_quantity || 100,
                stockStatus: (item.Medicine?.stock_quantity || 100) > 10 ? 'พร้อมจ่าย' : 'ใกล้หมด'
              }));
              
              setQueueList(prev => prev.map(q => {
                if (q.id === activePatient.id) {
                  return { ...q, medications: fetchedMeds };
                }
                return q;
              }));
            }
          }
        } catch (err) {
          console.error('Failed to fetch medications for billing visit:', err);
        }
      };
      fetchMeds();
    }
  }, [activePatient?.id, activePatient?.visitId]);

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

  const handleProceedToInvoice = () => {
    if (!activePatient) return;
    if (onSelectPatientId) {
      onSelectPatientId(activePatient.id);
    }
    if (onNavigateToBilling) {
      onNavigateToBilling();
    }
  };

  const medTotal = activePatient && Array.isArray(activePatient.medications) 
    ? activePatient.medications.reduce((sum, m) => sum + (Number(m?.price) || 0), 0) 
    : 0;

  return (
    <div className="billing-dispense-container">
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '32px' }}>
        <div className="header-titles">
          <h1 className="page-title" style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--text-primary)', margin: '0 0 8px 0', letterSpacing: '-0.5px' }}>
            คิดเงินและออกบิลชำระเงิน
          </h1>
          <p className="page-subtitle" style={{ color: 'var(--text-secondary)', margin: '0', fontSize: '1.1rem' }}>
            สรุปรายการค่ายา ค่าบริการทางการแพทย์ คำนวณส่วนลดสิทธิ์ และรับชำระเงิน
          </p>
        </div>
      </div>

      {/* Metric Cards Section */}
      <div className="metrics-grid">
        <div className="metric-card card">
          <div className="metric-icon-bg orange-bg">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <div className="metric-info">
            <span className="metric-label">รอชำระเงิน</span>
            <div className="metric-val-row">
              <span className="metric-value">{queueList.length}</span>
              <span style={{ fontSize: '0.95rem', color: '#64748B' }}>คน</span>
            </div>
          </div>
        </div>

        <div className="metric-card card">
          <div className="metric-icon-bg green-bg">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          <div className="metric-info">
            <span className="metric-label">ชำระเงินสำเร็จแล้ววันนี้</span>
            <div className="metric-val-row">
              <span className="metric-value">{CLINIC_CONFIG.patients.length - queueList.length + 45}</span>
              <span style={{ fontSize: '0.95rem', color: '#64748B' }}>คน</span>
            </div>
          </div>
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
              <table style={{ width: '100%', minWidth: '900px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                <thead>
                  <tr style={{ color: '#0F172A', background: '#F8FAFC', borderBottom: '2px solid #E2E8F0', height: '48px', whiteSpace: 'nowrap' }}>
                    <th style={{ padding: '12px 16px', fontWeight: '700', fontSize: '15px', textAlign: 'center' }}>ลำดับคิว</th>
                    <th style={{ padding: '12px 16px', fontWeight: '700', fontSize: '15px', textAlign: 'center' }}>HN</th>
                    <th style={{ padding: '12px 16px', fontWeight: '700', fontSize: '15px', textAlign: 'left' }}>ชื่อ-นามสกุล คนไข้</th>
                    <th style={{ padding: '12px 16px', fontWeight: '700', fontSize: '15px', textAlign: 'center' }}>เลขบัตรประชาชน</th>
                    <th style={{ padding: '12px 16px', fontWeight: '700', fontSize: '15px', textAlign: 'center' }}>สิทธิการรักษา</th>
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
                        <td style={{ padding: '12px', whiteSpace: 'nowrap', textAlign: 'center' }}>
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
                        <td style={{ padding: '12px', whiteSpace: 'nowrap', textAlign: 'center' }}>
                          <span style={{ fontSize: '14.5px', fontWeight: '700', color: '#0F172A', whiteSpace: 'nowrap' }}>
                            {p.hn.replace(/[-]/g, '')}
                          </span>
                        </td>
                        <td style={{ padding: '12px', whiteSpace: 'nowrap', textAlign: 'left' }}>
                          <div className="patient-table-name" style={{ fontWeight: '700', color: '#0F172A', whiteSpace: 'nowrap' }}>{p.name}</div>
                        </td>
                        <td className="patient-table-sub" style={{ padding: '12px', fontFamily: 'monospace', fontSize: '13px', whiteSpace: 'nowrap', textAlign: 'center', color: '#64748B' }}>
                          {p.nationalId || '-'}
                        </td>
                        <td style={{ padding: '12px', whiteSpace: 'nowrap', textAlign: 'center' }}>
                          <span style={{ 
                            background: '#F3E8FF',
                            color: '#7E22CE',
                            border: '1px solid #E9D5FF',
                            padding: '6px 14px', borderRadius: '9999px', fontSize: '13px', fontWeight: '700',
                            whiteSpace: 'nowrap', display: 'inline-flex', justifyContent: 'center', alignItems: 'center'
                          }}>
                            {p.treatmentRights.includes('30') ? 'บัตรทอง (สปสช.)' : p.treatmentRights}
                          </span>
                        </td>

                        <td style={{ padding: '12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <button 
                            onClick={() => handleSelectPatient(p.id)}
                            style={{ 
                              padding: '8px 22px', 
                              background: localPatientId === p.id ? '#10B981' : '#2563EB', 
                              color: 'white', border: 'none', borderRadius: '10px', 
                              cursor: 'pointer', fontWeight: '700', fontSize: '14px',
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                              whiteSpace: 'nowrap', minWidth: '95px',
                              boxShadow: localPatientId === p.id ? '0 2px 6px rgba(16, 185, 129, 0.25)' : '0 2px 6px rgba(37, 99, 235, 0.25)'
                            }}
                          >
                            {localPatientId === p.id ? 'เลือกอยู่' : 'เลือกคนไข้'}
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#EF4444', background: '#FEF2F2' }}>
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
                {(activePatient?.medications || []).map((med, idx) => (
                  <tr key={idx}>
                    <td className="item-name font-bold">{med.name}</td>
                    <td>{med.dosage}</td>
                    <td style={{ textAlign: 'right' }}>{(med as any).quantity || 1}</td>
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
              {(activePatient?.medications || []).map((med, idx) => (
                <div key={idx} className="summary-item">
                  <div className="item-details">
                    <div className="item-title">{med.name}</div>
                    <div className="item-sub">{med.dosage}</div>
                  </div>
                  <div className="item-price">฿ {(Number(med.price) || 0).toLocaleString()}</div>
                </div>
              ))}
            </div>

            <div className="summary-divider"></div>

            <div className="summary-total-row main-total">
              <span>ค่ายารวมสุทธิ:</span>
              <span className="total-price">฿ {medTotal.toLocaleString()}</span>
            </div>

            <button className="submit-billing-btn" onClick={handleProceedToInvoice}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                <rect x="2" y="5" width="20" height="14" rx="2"/>
                <line x1="2" y1="10" x2="22" y2="10"/>
              </svg>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: '1.3' }}>
                <span style={{ fontSize: '1rem', fontWeight: '800' }}>ออกใบแจ้งหนี้ & สร้าง QR Code ชำระเงิน</span>
                <span style={{ fontSize: '0.85rem', fontWeight: '500', opacity: 0.95 }}>
                  (Generate Invoice & QR Code Payment)
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
