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

  const filteredQueue = queueList.filter(p => {
    if (!searchQueueInput.trim()) return true;
    const q = searchQueueInput.trim().toLowerCase();
    const cleanNationalId = p.nationalId ? p.nationalId.replace(/-/g, '') : '';
    const cleanQ = q.replace(/-/g, '');
    return (
      p.id.toLowerCase().includes(q) ||
      p.hn.toLowerCase().includes(q) ||
      cleanNationalId.includes(cleanQ) ||
      p.name.toLowerCase().includes(q) ||
      p.shortName.toLowerCase().includes(q)
    );
  });

  const [toast, setToast] = useState<ToastState | null>(null);
  const [isToastFading, setIsToastFading] = useState(false);

  // Real-time Queue & Billing Listener
  useEffect(() => {
    const fetchInitialQueue = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        
        let res = await fetch('/api/queue/list', { headers });
        if (!res.ok) {
          res = await fetch('/api/system/queue/list');
        }
        
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            const billingQueues = data.filter((q: any) => q.status === 'billing_waiting' || q.status === 'pharmacy_dispensed');
            const mappedQueues = billingQueues.map((q: any) => ({
              id: String(q.id),
              visitId: q.visit_id || q.id || 1,
              hn: q.Patient?.hn || q.hn || `HN-${q.patient_id}`,
              nationalId: q.Patient?.national_id || '',
              queueNumber: q.queue_number || 'Q0000',
              ticket: q.queue_number || 'A-01',
              name: q.Patient?.fullname || q.patient_name || 'ผู้ป่วย',
              shortName: q.Patient?.fullname || q.patient_name || 'ผู้ป่วย',
              gender: q.Patient?.gender || 'ชาย',
              age: q.Patient ? (new Date().getFullYear() - new Date(q.Patient.birthdate).getFullYear()) : 35,
              treatmentRights: q.Patient?.scheme_type || 'สิทธิ 30 บาท (สปสช.)',
              patientType: 'ผู้ป่วยนอก (OPD)' as const,
              allergies: q.Patient?.allergies ? [q.Patient.allergies] : ['ไม่มีประวัติแพ้ยา'],
              chronicDiseases: q.Patient?.chronic_diseases || 'ไม่มี',
              vitals: 'ความดัน 120/80 mmHg, อุณหภูมิ 36.6 °C',
              visitStatus: 'จ่ายยาแล้ว / รอชำระเงิน',
              visitDate: new Date(q.created_at || Date.now()).toLocaleDateString('th-TH'),
              visitTime: new Date(q.created_at || Date.now()).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.',
              doctorAdvice: q.note || 'พักผ่อนให้เพียงพอ',
              medications: []
            }));
            
            setQueueList(mappedQueues);
            setLocalPatientId(prev => {
              if (mappedQueues.length > 0) {
                if (!prev || !mappedQueues.find((q: any) => q.id === prev)) {
                  return mappedQueues[0].id;
                }
              }
              return prev;
            });
          }
        }
      } catch (err) {
        console.error('Failed to fetch initial queue:', err);
      }
    };
    
    fetchInitialQueue();

    const unsubQueue = subscribe('QUEUE_UPDATED', (data: any) => {
      if (data && data.action === 'db_reset') {
        setQueueList([]);
      } else {
        fetchInitialQueue();
      }
    });

    const unsubBill = subscribe('BILLING_CREATED', (data: any) => {
      if (data) {
        const pName = data.patient_name || data.patient?.full_name || `ผู้ป่วย คิว #${data.visit_id || ''}`;
        const newPatient: PatientConfig = {
          id: String(data.queue_id || data.id || data.visit_id || Date.now()),
          visitId: data.visit_id || 1,
          hn: data.hn || `HN-${data.patient_id || data.visit_id || Date.now()}`,
          nationalId: data.national_id || '1101800234567',
          queueNumber: data.queue_number || 'Q0001',
          ticket: data.queue_number || 'A-01',
          name: pName,
          shortName: pName,
          gender: 'ชาย',
          age: 35,
          dob: '01/01/2534',
          phone: '081-999-8888',
          occupation: 'รับจ้างทั่วไป',
          treatmentRights: data.scheme_type || 'สิทธิ 30 บาท (สปสช.)',
          patientType: 'ผู้ป่วยนอก (OPD)',
          allergies: ['ไม่มีประวัติแพ้ยา'],
          chronicDiseases: 'ไม่มี',
          vitals: 'ความดัน 120/80 mmHg, อุณหภูมิ 36.6 °C',
          visitStatus: 'จ่ายยาแล้ว / รอชำระเงิน',
          visitDate: new Date().toLocaleDateString('th-TH'),
          visitTime: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.',
          doctorAdvice: 'พักผ่อนให้เพียงพอ',
          medications: data.medications || [],
        };
        setQueueList(prev => [...prev.filter(q => q.id !== newPatient.id), newPatient]);
        triggerToast(`ได้รับคิวใหม่จากการจัดการยา: ${pName}`, 'doctor');
      }
    });

    return () => {
      unsubQueue();
      unsubBill();
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
              <table style={{ width: '100%', minWidth: '950px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                <thead>
                  <tr style={{ color: '#0F172A', background: '#F8FAFC', borderBottom: '2px solid #E2E8F0', height: '48px', whiteSpace: 'nowrap' }}>
                    <th style={{ padding: '12px 16px', fontWeight: '700', fontSize: '15px', textAlign: 'center' }}>ลำดับคิว</th>
                    <th style={{ padding: '12px 16px', fontWeight: '700', fontSize: '15px', textAlign: 'center' }}>HN</th>
                    <th style={{ padding: '12px 16px', fontWeight: '700', fontSize: '15px', textAlign: 'center' }}>ประเภท</th>
                    <th style={{ padding: '12px 16px', fontWeight: '700', fontSize: '15px', textAlign: 'left' }}>ชื่อ-นามสกุล คนไข้</th>
                    <th style={{ padding: '12px 16px', fontWeight: '700', fontSize: '15px', textAlign: 'center' }}>เลขบัตรประชาชน</th>
                    <th style={{ padding: '12px 16px', fontWeight: '700', fontSize: '15px', textAlign: 'center' }}>สิทธิการรักษา</th>
                    <th style={{ padding: '12px 16px', fontWeight: '700', fontSize: '15px', textAlign: 'center' }}>ดำเนินการ</th>
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
                        <td style={{ padding: '12px', whiteSpace: 'nowrap', textAlign: 'center' }}>
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
                        <td style={{ padding: '12px', whiteSpace: 'nowrap', textAlign: 'left' }}>
                          <div className="patient-table-name" style={{ whiteSpace: 'nowrap' }}>{p.name}</div>
                        </td>
                        <td className="patient-table-sub" style={{ padding: '12px', fontFamily: 'monospace', fontSize: '13px', whiteSpace: 'nowrap', textAlign: 'center' }}>
                          {p.nationalId}
                        </td>
                        <td style={{ padding: '12px', whiteSpace: 'nowrap', textAlign: 'center' }}>
                          <span style={{ 
                            background: p.treatmentRights.includes('30') ? '#FEF9C3' : p.treatmentRights.includes('ประกันสังคม') ? '#E0F2FE' : '#F3E8FF',
                            color: p.treatmentRights.includes('30') ? '#92400E' : p.treatmentRights.includes('ประกันสังคม') ? '#075985' : '#6D28D9',
                            border: `1px solid ${p.treatmentRights.includes('30') ? '#FDE68A' : p.treatmentRights.includes('ประกันสังคม') ? '#BAE6FD' : '#DDD6FE'}`,
                            padding: '6px 14px', borderRadius: '9999px', fontSize: '13px', fontWeight: '700',
                            whiteSpace: 'nowrap', display: 'inline-flex', justifyContent: 'center', alignItems: 'center',
                            width: '175px', textAlign: 'center', boxSizing: 'border-box'
                          }}>
                            {p.treatmentRights.includes('30') ? 'สิทธิ 30 บาท (สปสช.)' : p.treatmentRights}
                          </span>
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
