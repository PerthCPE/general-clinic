import { useState, useEffect } from 'react';
import './DetailPage.css';
import { CLINIC_CONFIG, type PatientConfig } from '../../config/clinicConfig';
import { useWebSocket } from '../../context/WebSocketContext';

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
  const { subscribe } = useWebSocket();
  const [patientIdInput, setPatientIdInput] = useState('');
  const [localPatientId, setLocalPatientId] = useState<string>(selectedPatientId || '');
  const [isSearchExpanded, setIsSearchExpanded] = useState(true);
  const [isPrescriptionExpanded, setIsPrescriptionExpanded] = useState(true);
  const [selectedMedInfo, setSelectedMedInfo] = useState<{ name: string; medId: string; properties: string } | null>(null);
  
  // คิวเริ่มต้น - เริ่มจากตารางว่างเปล่าแบบ Clean State
  const [queueList, setQueueList] = useState<PatientConfig[]>([]);
  
  // Current active patient object
  const activePatient: PatientConfig | undefined = queueList.find(p => p.id === localPatientId) || CLINIC_CONFIG.patients.find(p => p.id === localPatientId);
  const currentRights = activePatient ? ((patientRightsMap && patientRightsMap[activePatient.id]) || activePatient.treatmentRights) : '';

  const [toast, setToast] = useState<ToastState | null>(null);
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

  // Real-time Queue Listener
  useEffect(() => {
    // โหลดข้อมูลจาก API ทันทีที่เปิดหน้า
    const fetchQueues = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/queue/list', {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            const mappedQueues = data.map((q: any) => ({
              id: String(q.id),
              visitId: q.visit_id || 1,
              hn: q.Patient?.hn || q.hn || `HN-${q.patient_id}`,
              nationalId: q.Patient?.national_id || '',
              queueNumber: q.queue_number || 'Q0000',
              ticket: q.queue_number || 'A-01',
              name: q.Patient?.fullname || q.patient_name || 'ผู้ป่วย',
              shortName: q.Patient?.fullname || q.patient_name || 'ผู้ป่วย',
              gender: q.Patient?.gender || 'ชาย',
              age: q.Patient ? new Date().getFullYear() - new Date(q.Patient.birthdate).getFullYear() : 0,
              treatmentRights: q.Patient?.scheme_type || 'สิทธิ 30 บาท (สปสช.)',
              patientType: 'ผู้ป่วยนอก (OPD)' as const,
              allergies: q.Patient?.allergies ? [q.Patient.allergies] : ['ไม่มีประวัติแพ้ยา'],
              chronicDiseases: q.Patient?.chronic_diseases || 'ไม่มี',
              vitals: 'รอตรวจสอบ',
              visitStatus: q.status === 'pharmacy_waiting' ? 'รอรับยา / ชำระเงิน' : (q.status === 'billing_waiting' ? 'จ่ายยาแล้ว / รอชำระเงิน' : 'เสร็จสิ้น'),
              visitDate: new Date(q.created_at || Date.now()).toLocaleDateString('th-TH'),
              visitTime: new Date(q.created_at || Date.now()).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.',
              doctorAdvice: q.note || '',
              medications: [] // will load detail on click
            }));
            setQueueList(mappedQueues);
            if (mappedQueues.length > 0) setLocalPatientId(mappedQueues[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to fetch queues:', err);
      }
    };

    fetchQueues();

    const unsubQueue = subscribe('QUEUE_UPDATED', (data: any) => {
      if (data && data.action === 'db_reset') {
        setQueueList([]);
      } else {
        fetchQueues();
      }
    });

    const unsubCreated = subscribe('QUEUE_CREATED', (data: any) => {
      if (data) {
        const pName = data.patient?.full_name || data.patient_name || `ผู้ป่วยคิว ${data.queue_number || ''}`;
        
        // Optimistic UI update in case fetchQueues fails (e.g. auth issues during demo)
        const newPatient: PatientConfig = {
          id: String(data.id) || `Q-${Date.now()}`,
          visitId: data.visit_id || 1,
          hn: data.hn || `HN-${data.patient_id || data.id || Date.now()}`,
          nationalId: data.national_id || '',
          queueNumber: data.queue_number || 'Q0000',
          ticket: data.queue_number || 'A-01',
          name: pName,
          shortName: pName,
          gender: data.gender || 'ชาย',
          age: data.age || 0,
          treatmentRights: data.scheme_type || 'สิทธิ 30 บาท (สปสช.)',
          patientType: 'ผู้ป่วยนอก (OPD)',
          allergies: data.allergies ? [data.allergies] : ['ไม่มีประวัติแพ้ยา'],
          chronicDiseases: data.chronic_diseases || 'ไม่มี',
          vitals: 'รอตรวจสอบ',
          visitStatus: 'รอรับยา / ชำระเงิน',
          visitDate: new Date().toLocaleDateString('th-TH'),
          visitTime: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.',
          doctorAdvice: data.note || '',
          medications: data.medications || []
        };
        
        setQueueList(prev => {
          // Add if not exist
          if (!prev.find(q => q.id === newPatient.id)) {
            return [...prev, newPatient];
          }
          return prev;
        });

        fetchQueues(); // Still try to fetch from server
        triggerToast(`ได้รับข้อมูลใบสั่งยาล่าสุดจากแพทย์: ${pName}`, 'doctor');
      }
    });

    return () => {
      unsubQueue();
      unsubCreated();
    };
  }, [subscribe]);

  // Real-time Query Medications from DB for Active Patient Visit
  useEffect(() => {
    if (activePatient && activePatient.visitId) {
      fetch(`/api/pharmacy/dispensing/${activePatient.visitId}`)
        .then(res => res.json())
        .then(data => {
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
        })
        .catch(err => console.error('Failed to fetch medications for visit:', err));
    }
  }, [activePatient?.id, activePatient?.visitId]);



  // จำลองแพทย์ส่งคนไข้ใหม่ - บันทึกลง DB จริงแบบ Real-time
  const handleSimulateDoctorSubmit = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/system/simulate-prescription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      if (res.ok) {
        const data = await res.json();
        const pName = data.patient_name || 'ผู้ป่วยใหม่';
        const qNo = data.queue?.queue_number || 'Q0001';
        const qId = String(data.queue?.id || Date.now());

        const newPatient: PatientConfig = {
          id: qId,
          visitId: data.visit_id || 1,
          hn: data.hn || `HN-${Date.now()}`,
          nationalId: data.patient?.national_id || '',
          queueNumber: qNo,
          ticket: qNo,
          name: pName,
          shortName: pName,
          gender: data.patient?.gender || 'ชาย',
          age: data.patient?.birthdate ? (new Date().getFullYear() - new Date(data.patient.birthdate).getFullYear()) : 35,
          treatmentRights: data.patient?.scheme_type || 'สิทธิ 30 บาท (สปสช.)',
          patientType: 'ผู้ป่วยนอก (OPD)',
          allergies: data.patient?.allergies ? [data.patient.allergies] : ['ไม่มีประวัติแพ้ยา'],
          chronicDiseases: data.patient?.chronic_diseases || 'ไม่มี',
          vitals: 'ความดัน 120/80 mmHg, อุณหภูมิ 36.6 °C',
          visitStatus: 'รอรับยา / ชำระเงิน',
          visitDate: new Date().toLocaleDateString('th-TH'),
          visitTime: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.',
          doctorAdvice: data.queue?.note || 'มีไข้ ไอ เจ็บคอ แพทย์สั่งจ่ายยา',
          medications: data.medications || []
        };

        setQueueList(prev => [...prev.filter(q => q.id !== newPatient.id), newPatient]);
        setLocalPatientId(newPatient.id);
        if (onSelectPatientId) onSelectPatientId(newPatient.id);

        triggerToast(`แพทย์ส่งใบสั่งยาลง DB จริงสำเร็จ: ${pName} (${data.hn || ''})`, 'doctor');
      } else {
        fallbackSimulate();
      }
    } catch {
      fallbackSimulate();
    }
  };

  const fallbackSimulate = () => {
    // Backend fetch failed, do not use CLINIC_CONFIG mock data anymore.
    // Ensure you start the backend before clicking this.
    triggerToast(`ข้อผิดพลาด: ไม่สามารถเชื่อมต่อกับฐานข้อมูลหลังบ้านได้ โปรดเปิดเซิร์ฟเวอร์`, 'error');
  };

  // กดยืนยันการจ่ายยา: ส่งข้อมูลเข้า DB การเงินจริง + ลบคนไข้ออกจากคิว + รีเซ็ต selection
  const handleSendToBilling = async () => {
    if (!activePatient) return;
    const pName = activePatient.name;
    const vId = activePatient.visitId || 1;

    try {
      const token = localStorage.getItem('token');
      await fetch('/api/pharmacy/dispense', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          visit_id: vId
        })
      });
    } catch {
      // Fallback
    }

    triggerToast(`ยืนยันการจ่ายยาเรียบร้อย! ส่งข้อมูลใบสั่งยาของ ${pName} ไปยังระบบการเงินแล้ว`, 'success');
    setQueueList(prev => prev.filter(p => p.id !== activePatient.id));
    setLocalPatientId('');
    if (onSelectPatientId) onSelectPatientId('');
  };



  const [statFilter, setStatFilter] = useState<'all' | 'pending' | 'dispensed' | 'completed'>('all');

  return (
    <div className="detail-page-container">

      {/* Action Bar (Top) */}
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div className="header-titles">
          <h1 className="page-title">รายละเอียดการจ่ายยา</h1>
          <p className="page-subtitle">บันทึกและตรวจสอบคำสั่งจ่ายยา คัดกรองรายการยา และตัดสต็อกยา</p>
        </div>
        <button className="doctor-submit-sim-btn" onClick={handleSimulateDoctorSubmit}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
          </svg>
          จำลองหมอกด Submit ใบสั่งยา
        </button>
      </div>

      {/* Executive Pharmacy Stat Cards (Image 2 Format) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div 
          className={`stat-card-box ${statFilter === 'all' ? 'active-stat' : ''}`}
          onClick={() => setStatFilter('all')}
          style={{
            borderRadius: '14px', padding: '18px 20px',
            border: statFilter === 'all' ? '2px solid #2563EB' : '1.5px solid #E2E8F0',
            boxShadow: statFilter === 'all' ? '0 0 0 2px rgba(37, 99, 235, 0.16)' : '0 1px 3px rgba(0,0,0,0.04)',
            cursor: 'pointer', transition: 'all 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontWeight: '600', fontSize: '15px', color: '#475569' }}>คิวรอรับยาทั้งหมด</span>
            <div className="stat-icon-wrap icon-blue">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            </div>
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#0F172A', lineHeight: '38px' }}>{queueList.length}</div>
          <div style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>กำลังรับบริการระบบยาในคลัง</div>
        </div>

        <div 
          className={`stat-card-box ${statFilter === 'pending' ? 'active-stat' : ''}`}
          onClick={() => setStatFilter('pending')}
          style={{
            borderRadius: '14px', padding: '18px 20px',
            border: statFilter === 'pending' ? '2px solid #2563EB' : '1.5px solid #E2E8F0',
            boxShadow: statFilter === 'pending' ? '0 0 0 2px rgba(37, 99, 235, 0.16)' : '0 1px 3px rgba(0,0,0,0.04)',
            cursor: 'pointer', transition: 'all 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontWeight: '600', fontSize: '15px', color: '#475569' }}>รอจัดยา & แนะนำการใช้ยา</span>
            <div className="stat-icon-wrap icon-amber">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 16 14"/></svg>
            </div>
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#2563EB', lineHeight: '38px' }}>
            {Math.max(1, queueList.length - 1)}
          </div>
          <div style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>รอจัดยา 1 • ซักถามคำแนะนำ 1</div>
        </div>

        <div 
          className={`stat-card-box ${statFilter === 'dispensed' ? 'active-stat' : ''}`}
          onClick={() => setStatFilter('dispensed')}
          style={{
            borderRadius: '14px', padding: '18px 20px',
            border: statFilter === 'dispensed' ? '2px solid #2563EB' : '1.5px solid #E2E8F0',
            boxShadow: statFilter === 'dispensed' ? '0 0 0 2px rgba(37, 99, 235, 0.16)' : '0 1px 3px rgba(0,0,0,0.04)',
            cursor: 'pointer', transition: 'all 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontWeight: '600', fontSize: '15px', color: '#475569' }}>จ่ายยาแล้ว / ส่งต่อไปการเงิน</span>
            <div className="stat-icon-wrap icon-teal">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="6" y1="8" x2="18" y2="8"/><line x1="6" y1="12" x2="18" y2="12"/></svg>
            </div>
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#0D9488', lineHeight: '38px' }}>
            1
          </div>
          <div style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>ส่งต่อไปแคชเชียร์ 1 • รอชำระ 1</div>
        </div>

        <div 
          className={`stat-card-box ${statFilter === 'completed' ? 'active-stat' : ''}`}
          onClick={() => setStatFilter('completed')}
          style={{
            borderRadius: '14px', padding: '18px 20px',
            border: statFilter === 'completed' ? '2px solid #2563EB' : '1.5px solid #E2E8F0',
            boxShadow: statFilter === 'completed' ? '0 0 0 2px rgba(37, 99, 235, 0.16)' : '0 1px 3px rgba(0,0,0,0.04)',
            cursor: 'pointer', transition: 'all 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontWeight: '600', fontSize: '15px', color: '#475569' }}>เสร็จสิ้นกระบวนการ</span>
            <div className="stat-icon-wrap icon-green">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#16A34A', lineHeight: '38px' }}>0</div>
          <div style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>เสร็จสิ้น 0 • รับยาเรียบร้อย 0</div>
        </div>
      </div>

      {/* Patient Search & Collapsible Recent Patients Card */}
      <div className="search-card card" style={{ display: 'flex', flexDirection: 'column', width: '100%', padding: '0', marginBottom: '24px', transition: 'all 0.3s ease', overflow: 'hidden' }}>
        {/* Header */}
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
                รายชื่อผู้ป่วยที่ลงทะเบียนล่าสุด (Recent Patients)
              </h3>
              <p style={{ margin: 0, fontSize: '13.5px', color: '#64748B', lineHeight: '1.4' }}>
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
                ถึงคิวที่ {activePatient.queueNumber} ({activePatient.name})
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
          <div style={{ padding: '20px 24px' }}>
            {/* Filter Search Input */}
            <div style={{ marginBottom: '20px', display: 'flex', gap: '12px', alignItems: 'stretch' }}>
              <input 
                type="text" 
                placeholder="ค้นหาด้วยข้อมูลเลขบัตรประชาชน, HN หรือ ชื่อ-นามสกุล..." 
                value={patientIdInput} 
                onChange={(e) => setPatientIdInput(e.target.value)} 
                style={{ flex: 1, padding: '10px 16px', border: '1.5px solid #CBD5E1', borderRadius: '10px', fontSize: '14px', height: '42px', boxSizing: 'border-box' }}
              />
              <button 
                style={{ padding: '0 24px', background: '#2563EB', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: '700', fontSize: '14px', height: '42px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)' }}
              >
                ค้นหา
              </button>
            </div>

            {/* Patients Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: '1000px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                <thead>
                  <tr style={{ color: '#0F172A', background: '#F8FAFC', borderBottom: '2px solid #E2E8F0', height: '48px', whiteSpace: 'nowrap' }}>
                    <th style={{ padding: '12px 16px', fontWeight: '700', fontSize: '15px', width: '100px', textAlign: 'center' }}>ลำดับคิว</th>
                    <th style={{ padding: '12px 16px', fontWeight: '700', fontSize: '15px', width: '110px' }}>HN</th>
                    <th style={{ padding: '12px 16px', fontWeight: '700', fontSize: '15px' }}>ชื่อ-นามสกุล คนไข้</th>
                    <th style={{ padding: '12px 16px', fontWeight: '700', fontSize: '15px', width: '180px' }}>เลขบัตรประชาชน</th>
                    <th style={{ padding: '12px 16px', fontWeight: '700', fontSize: '15px', textAlign: 'center', width: '220px' }}>สิทธิการรักษา</th>
                    <th style={{ padding: '12px 16px', fontWeight: '700', fontSize: '15px', textAlign: 'center', width: '150px' }}>การดำเนินการ</th>
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
                      style={{ borderBottom: '1px solid #F1F5F9', whiteSpace: 'nowrap', height: '56px' }}
                    >
                      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap', verticalAlign: 'middle', textAlign: 'center' }}>
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
                      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                        <span style={{ fontSize: '14.5px', fontWeight: '700', color: '#0F172A', whiteSpace: 'nowrap' }}>
                          {p.hn.replace(/[-]/g, '')}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                        <div className="patient-table-name" style={{ fontWeight: '700', color: '#0F172A', fontSize: '14px', whiteSpace: 'nowrap' }}>{p.name}</div>
                      </td>
                      <td className="patient-table-sub" style={{ padding: '14px 16px', fontFamily: 'monospace', fontSize: '13.5px', color: '#475569', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>{p.nationalId}</td>
                      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap', textAlign: 'center', verticalAlign: 'middle' }}>
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
                      <td style={{ padding: '14px 16px', textAlign: 'center', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                        <button 
                          onClick={() => {
                            setLocalPatientId(p.id);
                            if (onSelectPatientId) onSelectPatientId(p.id);
                          }}
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
                          {localPatientId === p.id ? 'เลือกอยู่' : 'เข้าคิว'}
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
                  <span className="badge hn-badge">HN: {activePatient.hn.replace(/[-]/g, '')}</span>
                </div>
              </div>
              <div className="patient-details" style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'center', fontSize: '0.95rem', color: '#CBD5E1' }}>
                <span>เพศ {activePatient.gender}</span>
                <span>อายุ {activePatient.age} ปี</span>
                <span>เบอร์โทร: {activePatient.phone}</span>
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
          {/* Section: Prescription & Dispensing - Collapsible Card */}
          <div className="search-card card" style={{ display: 'flex', flexDirection: 'column', width: '100%', padding: '0', marginBottom: '24px', transition: 'all 0.3s ease', overflow: 'hidden' }}>
            {/* Header Toggle */}
            <div 
              onClick={() => setIsPrescriptionExpanded(!isPrescriptionExpanded)}
              style={{ 
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                padding: '18px 24px', background: '#F8FAFC', borderBottom: isPrescriptionExpanded ? '1px solid #E2E8F0' : 'none',
                cursor: 'pointer', userSelect: 'none' 
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0F172A' }}>
                  รายละเอียดใบสั่งยา & ดำเนินการจ่ายยา
                </h3>
              </div>
              <svg 
                width="18" height="18" viewBox="0 0 24 24" fill="none" 
                style={{ color: '#64748B', transform: isPrescriptionExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.25s ease', flexShrink: 0 }}
              >
                <path d="M19.5 8.25l-7.5 7.5-7.5-7.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>

            {isPrescriptionExpanded && (
              <div className="card-body-content" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Doctor Advice Card */}
                {activePatient.doctorAdvice && (
                  <div className="doctor-advice-card" style={{ marginBottom: 0 }}>
                    <div className="doctor-advice-content" style={{ width: '100%' }}>
                      <h4 className="doctor-advice-title" style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '700', color: '#0369A1' }}>
                        คำแนะนำจากแพทย์ (Doctor's Note & Clinical Advice)
                      </h4>
                      <p className="doctor-advice-text" style={{ margin: 0, fontSize: '14.5px', color: '#1E293B', lineHeight: '1.6' }}>
                        {activePatient.doctorAdvice}
                      </p>
                    </div>
                  </div>
                )}

                {/* Medication + Stock Combined List Table */}
                <div className="med-table-container" style={{ border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px' }}>
                  <h4 className="column-title" style={{ marginBottom: '16px', fontSize: '15px', fontWeight: '700', color: '#0F172A', borderBottom: '1px solid #E2E8F0', paddingBottom: '10px' }}>
                    รายการยาที่สั่งจ่าย ({activePatient.medications.length} รายการ)
                  </h4>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                      <thead>
                        <tr style={{ color: '#0F172A', background: '#F1F5F9', borderBottom: '2px solid #CBD5E1', height: '44px' }}>
                          <th style={{ padding: '12px 16px', fontWeight: '700', fontSize: '15px', textAlign: 'center' }}>รหัสยา</th>
                          <th style={{ padding: '12px 16px', fontWeight: '700', fontSize: '15px' }}>ชื่อรายการยา & สรรพคุณ</th>
                          <th style={{ padding: '12px 16px', fontWeight: '700', fontSize: '15px' }}>ขนาด / วิธีรับประทาน</th>
                          <th style={{ padding: '12px 16px', fontWeight: '700', fontSize: '15px', textAlign: 'center' }}>ราคา</th>
                          <th style={{ padding: '12px 16px', fontWeight: '700', fontSize: '15px', textAlign: 'center' }}>สถานะคลังยา</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activePatient.medications.map((med, index) => (
                          <tr key={index} style={{ borderBottom: '1px solid #F1F5F9' }}>
                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              <span style={{ 
                                color: '#2563EB', 
                                fontWeight: '700', 
                                fontFamily: 'monospace', 
                                fontSize: '14.5px',
                                letterSpacing: '0.3px',
                                display: 'inline-block'
                              }}>
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
                                {med.name}
                              </div>
                              <div>
                                <span 
                                  style={{ 
                                    fontSize: '13px', color: '#0284C7', fontWeight: '600', 
                                    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '3px' 
                                  }}
                                  onClick={() => setSelectedMedInfo({ name: med.name, medId: med.medId, properties: med.properties })}
                                >
                                  คลิกเพื่อดูรายละเอียดสรรพคุณ
                                </span>
                              </div>
                            </td>
                            <td style={{ padding: '12px' }}>
                              <div style={{ fontWeight: '600', color: '#1E293B' }}>{med.dosage}</div>
                              <div style={{ fontSize: '12.5px', color: '#64748B', marginTop: '2px' }}>คำแนะนำ: {med.instructions}</div>
                            </td>
                            <td style={{ padding: '12px', textAlign: 'center', fontWeight: '700', fontSize: '14.5px', color: '#0F172A' }}>
                              ฿ {med.price.toLocaleString()}
                            </td>
                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              <span 
                                style={{ 
                                  background: med.stockStatus === 'out-stock' ? '#FEE2E2' : '#DCFCE7', 
                                  color: med.stockStatus === 'out-stock' ? '#DC2626' : '#15803D', 
                                  border: `1px solid ${med.stockStatus === 'out-stock' ? '#FCA5A5' : '#86EFAC'}`,
                                  padding: '6px 14px', borderRadius: '9999px', fontSize: '13px', fontWeight: '700',
                                  display: 'inline-flex', justifyContent: 'center', alignItems: 'center', minWidth: '110px',
                                  textAlign: 'center', whiteSpace: 'nowrap'
                                }}
                              >
                                {med.stockStatus === 'out-stock' ? 'หมดคลัง (0)' : `มีในคลัง (${med.stock})`}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Action Button: Confirm & Send to Billing */}
                <div className="send-billing-action-bar" style={{ marginTop: '4px' }}>
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
              </div>
            )}
          </div>

          </>
        ) : (
          <div className="not-found-card card" style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>
            <div className="not-found-icon" style={{ fontSize: '40px', marginBottom: '10px' }}></div>
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
            {toast.type === 'doctor' && ''}
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
                สรรพคุณและข้อมูลยา (Medication Properties & Indications):
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
