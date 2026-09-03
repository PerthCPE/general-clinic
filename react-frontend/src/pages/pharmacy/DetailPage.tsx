import { useState, useEffect } from 'react';
import './DetailPage.css';
import { CLINIC_CONFIG, type PatientConfig } from '../../config/clinicConfig';
import { useWebSocket } from '../../context/WebSocketContext';
import CopyableText from '../../components/Common/CopyableText';
import { Check, Plus, Minus } from 'lucide-react';

interface ToastState {
  message: string;
  type: 'success' | 'error' | 'doctor';
}

// Persistent Storage Key สำหรับจัดเก็บคิวที่ส่งไปการเงินแล้ว ให้ค้างแสดงในตารางเสมอ
const DISPENSED_LOGS_STORAGE_KEY = 'pharmacy_dispensed_patients_log';

const getStoredDispensedPatients = (): PatientConfig[] => {
  try {
    const raw = localStorage.getItem(DISPENSED_LOGS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const persistDispensedPatient = (patient: PatientConfig) => {
  try {
    const existing = getStoredDispensedPatients();
    const cleanHN = (patient.hn || '').replace(/[-]/g, '');
    const filtered = existing.filter(p => p.id !== patient.id && (p.hn || '').replace(/[-]/g, '') !== cleanHN);
    const updated = [
      {
        ...patient,
        status: 'dispensed' as const,
        visitStatus: 'จ่ายยาแล้ว / ส่งการเงินแล้ว',
        dispensedAt: patient.dispensedAt || (new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.')
      },
      ...filtered
    ].slice(0, 50);
    localStorage.setItem(DISPENSED_LOGS_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to persist dispensed patient:', err);
  }
};

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
  const [localPatientId, setLocalPatientId] = useState<string>(() => {
    return selectedPatientId || localStorage.getItem('pharmacy_active_patient') || '';
  });

  // Save active patient to localStorage whenever it changes
  useEffect(() => {
    if (localPatientId) {
      localStorage.setItem('pharmacy_active_patient', localPatientId);
    } else {
      localStorage.removeItem('pharmacy_active_patient');
    }
  }, [localPatientId]);

  const [isSearchExpanded, setIsSearchExpanded] = useState(true);
  const [isPrescriptionExpanded, setIsPrescriptionExpanded] = useState(true);
  const [selectedMedInfo, setSelectedMedInfo] = useState<{ name: string; medId: string; properties: string } | null>(null);
  
  // คิวเริ่มต้น - เริ่มจากตารางว่างเปล่าแบบ Clean State
  const [queueList, setQueueList] = useState<PatientConfig[]>([]);
  
  // Current active patient object
  const activePatient: PatientConfig | undefined = queueList.find(p => p.id === localPatientId) || queueList[0];
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

  // Real-time Queue Listener จากระบบแพทย์
  useEffect(() => {
    // โหลดข้อมูลจาก API ทันทีที่เปิดหน้า
    const fetchQueues = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};

        // 1. ดึงจาก /api/pharmacy/queues โดยตรง (คิวผู้ป่วยที่แพทย์ตรวจเสร็จแล้ว)
        let pRes = await fetch('/api/pharmacy/queues', { headers });
        if (!pRes.ok) {
          pRes = await fetch('/api/system/pharmacy/queues');
        }
        if (pRes.ok) {
          const pData = await pRes.json();
          if (pData.status === 'success' && Array.isArray(pData.queues)) {
            const mappedQueues: PatientConfig[] = pData.queues.map((pq: any) => {
              const cleanHN = (pq.hn || pq.patient?.hn || '').replace(/[-]/g, '');
              let rawMeds = pq.medications || [];
              if (typeof rawMeds === 'string') {
                try { rawMeds = JSON.parse(rawMeds); } catch { rawMeds = []; }
              }
              const isDispensed = pq.status === 'dispensed';
              return {
                id: String(pq.id),
                visitId: pq.visit_id || 1,
                hn: cleanHN || `HN0001`,
                nationalId: pq.national_id || '',
                queueNumber: pq.queue_number || 'Q0001',
                ticket: pq.queue_number || 'A-01',
                name: pq.patient_name || 'ผู้ป่วย',
                shortName: pq.patient_name || 'ผู้ป่วย',
                gender: pq.gender || 'ชาย',
                age: pq.age || 35,
                treatmentRights: pq.scheme_type || 'สิทธิ 30 บาท (สปสช.)',
                patientType: 'ผู้ป่วยนอก (OPD)' as const,
                allergies: pq.allergies ? [pq.allergies] : ['ไม่มีประวัติแพ้ยา'],
                chronicDiseases: pq.chronic_diseases || 'ไม่มี',
                vitals: 'ความดัน 120/80 mmHg, อุณหภูมิ 36.6 °C',
                visitStatus: isDispensed ? 'จ่ายยาแล้ว / ส่งการเงินแล้ว' : 'รอรับยา / ชำระเงิน',
                status: (isDispensed ? 'dispensed' : 'pending') as 'pending' | 'dispensed',
                visitDate: new Date(pq.created_at || Date.now()).toLocaleDateString('th-TH'),
                visitTime: new Date(pq.created_at || Date.now()).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.',
                doctorAdvice: pq.doctor_advice || 'พักผ่อนให้เพียงพอ ทานยาตามแพทย์สั่ง',
                medications: rawMeds.map((m: any) => ({
                  medId: m.medId || m.medicine_code || 'MED-001',
                  name: m.name || m.medicine_name || 'ยาตามแพทย์สั่ง',
                  dosage: m.dosage || '1 เม็ด วันละ 3 ครั้ง หลังอาหาร',
                  instructions: m.instructions || 'รับประทานหลังอาหาร เช้า กลางวัน เย็น',
                  stock: m.stock || m.stock_quantity || 100,
                  stockStatus: (m.stock || m.stock_quantity || 100) > 10 ? ('in-stock' as const) : ('low-stock' as const),
                  quantity: m.quantity && m.quantity > 0 ? m.quantity : 10,
                  price: m.price && m.price > 0 ? m.price : (m.unit_price || 15),
                  unit_price: m.unit_price && m.unit_price > 0 ? m.unit_price : (m.price || 15),
                  properties: m.properties || 'บรรเทาอาการตามแพทย์สั่ง'
                }))
              };
            });

            // นำประวัติคนไข้ที่ส่งการเงินแล้วจาก localStorage มาผสาน (Merge) เพื่อให้คิวยังคงค้างแสดงอยู่เสมอ
            const storedDispensed = getStoredDispensedPatients();
            storedDispensed.forEach(storedP => {
              const cleanStoredHN = (storedP.hn || '').replace(/[-]/g, '');
              const existingIdx = mappedQueues.findIndex(q => q.id === storedP.id || (q.hn.replace(/[-]/g, '') === cleanStoredHN && q.queueNumber === storedP.queueNumber));
              if (existingIdx >= 0) {
                if (storedP.status === 'dispensed') {
                  mappedQueues[existingIdx] = {
                    ...mappedQueues[existingIdx],
                    status: 'dispensed',
                    visitStatus: 'จ่ายยาแล้ว / ส่งการเงินแล้ว',
                    dispensedAt: storedP.dispensedAt || mappedQueues[existingIdx].dispensedAt
                  };
                }
              } else {
                mappedQueues.push(storedP);
              }
            });

            // จัดเรียง: ผู้ป่วยที่รอจัดยาอยู่บนสุด (pending) และ Log ผู้ป่วยที่ส่งไปการเงินแล้ว (dispensed) อยู่ถัดลงมา
            mappedQueues.sort((a, b) => Number(a.status === 'dispensed') - Number(b.status === 'dispensed'));

            setQueueList(mappedQueues);
            setLocalPatientId(prev => {
              if (mappedQueues.length > 0) {
                if (prev && mappedQueues.find(q => q.id === prev)) {
                  return prev;
                }
                const firstPending = mappedQueues.find(q => q.status !== 'dispensed');
                return firstPending ? firstPending.id : mappedQueues[0].id;
              }
              return '';
            });
            return;
          }
        }

        setQueueList([]);
        setLocalPatientId('');
      } catch (err) {
        console.error('Failed to fetch queues:', err);
      }
    };

    fetchQueues();

    // Smart Background Polling ทุกๆ 2.5 วินาที เพื่อดึงคิวล่าสุดอย่างต่อเนื่อง (Fallback คู่กับ WebSocket)
    const pollInterval = setInterval(() => {
      if (!document.hidden) {
        fetchQueues();
      }
    }, 2500);

    const unsubQueue = subscribe('QUEUE_UPDATED', (data: any) => {
      if (data && data.action === 'db_reset') {
        setQueueList([]);
      } else {
        fetchQueues();
      }
    });

    const unsubExam = subscribe('EXAMINATION_SAVED', (data: any) => {
      fetchQueues();
      triggerToast('แพทย์บันทึกการตรวจและส่งข้อมูลมายังห้องยาแล้ว', 'doctor');
    });

    const unsubVisit = subscribe('VISIT_UPDATED', (data: any) => {
      fetchQueues();
    });

    const unsubCreated = subscribe('QUEUE_CREATED', (data: any) => {
      if (data) {
        const pName = data.patient?.full_name || data.patient_name || `ผู้ป่วยคิว ${data.queue_number || ''}`;
        fetchQueues();
        triggerToast(`ได้รับข้อมูลใบสั่งยาล่าสุดจากแพทย์: ${pName}`, 'doctor');
      }
    });

    const unsubMedQ = subscribe('MEDICINE_QUEUE_CREATED', (data: any) => {
      fetchQueues();
      triggerToast('ได้รับข้อมูลใบสั่งยาล่าสุดจากแพทย์', 'doctor');
    });

    return () => {
      clearInterval(pollInterval);
      unsubQueue();
      unsubExam();
      unsubVisit();
      unsubCreated();
      unsubMedQ();
    };
  }, [subscribe]);

  // Real-time Query Medications from DB for Active Patient Visit
  useEffect(() => {
    if (activePatient && (activePatient.visitId || activePatient.hn)) {
      const fetchPatientMeds = async () => {
        try {
          let medsFound = false;
          if (activePatient.visitId) {
            let res = await fetch(`/api/pharmacy/dispensing/${activePatient.visitId}`);
            if (!res.ok) res = await fetch(`/api/system/dispensing/${activePatient.visitId}`);
            if (res.ok) {
              const data = await res.json();
              if (data.status === 'success' && Array.isArray(data.dispensing) && data.dispensing.length > 0) {
                const fetchedMeds = data.dispensing.map((item: any) => {
                  const m = item.medicine || item.Medicine || item;
                  return {
                    medId: m.medicine_code || m.code || `MED-${item.medicine_id || 1}`,
                    name: m.name || item.name || 'ยาบรรเทาอาการ',
                    genericName: m.generic_name || '',
                    category: m.category || 'ยาสามัญ',
                    properties: m.properties || 'ยาบรรเทาอาการตามแพทย์สั่ง',
                    dosage: item.dosage || '1 เม็ด วันละ 3 ครั้ง หลังอาหาร',
                    instructions: item.instructions || 'รับประทานหลังอาหาร เช้า กลางวัน เย็น',
                    price: m.unit_price || m.price || 10,
                    unit_price: m.unit_price || m.price || 10,
                    quantity: item.quantity || 10,
                    stock: m.stock_quantity || 100,
                    stockStatus: (m.stock_quantity || 100) > 10 ? 'พร้อมจ่าย' : 'ใกล้หมด'
                  };
                });
                setQueueList(prev => prev.map(q => q.id === activePatient.id ? { ...q, medications: fetchedMeds } : q));
                medsFound = true;
              }
            }
          }

          if (!medsFound && activePatient.hn) {
            let hnRes = await fetch(`/api/pharmacy/patient-medicines/${encodeURIComponent(activePatient.hn)}`);
            if (!hnRes.ok) hnRes = await fetch(`/api/system/patient-medicines/${encodeURIComponent(activePatient.hn)}`);
            if (hnRes.ok) {
              const hnData = await hnRes.json();
              if (hnData.status === 'success' && Array.isArray(hnData.dispensings) && hnData.dispensings.length > 0) {
                const fetchedMeds = hnData.dispensings.map((item: any) => {
                  const m = item.medicine || item.Medicine || item;
                  return {
                    medId: m.medicine_code || m.code || `MED-${item.medicine_id || 1}`,
                    name: m.name || item.name || 'ยาบรรเทาอาการ',
                    genericName: m.generic_name || '',
                    category: m.category || 'ยาสามัญ',
                    properties: m.properties || 'ยาบรรเทาอาการตามแพทย์สั่ง',
                    dosage: item.dosage || '1 เม็ด วันละ 3 ครั้ง หลังอาหาร',
                    instructions: item.instructions || 'รับประทานหลังอาหาร เช้า กลางวัน เย็น',
                    price: m.unit_price || m.price || 10,
                    unit_price: m.unit_price || m.price || 10,
                    quantity: item.quantity || 10,
                    stock: m.stock_quantity || 100,
                    stockStatus: (m.stock_quantity || 100) > 10 ? 'พร้อมจ่าย' : 'ใกล้หมด'
                  };
                });
                setQueueList(prev => prev.map(q => q.id === activePatient.id ? { ...q, medications: fetchedMeds, doctorAdvice: hnData.doctor_advice || q.doctorAdvice } : q));
              }
            }
          }
        } catch (err) {
          console.error('Failed to fetch medications for visit:', err);
        }
      };
      fetchPatientMeds();
    }
  }, [activePatient?.id, activePatient?.visitId, activePatient?.hn]);



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

        setQueueList(prev => [newPatient, ...prev.filter(q => q.id !== newPatient.id)]);
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

  // กดยืนยันการจ่ายยา: ส่งข้อมูลเข้า DB การเงินจริง + อัปเดต PatientMedicine DB + ลบคนไข้ออกจากคิว
  const handleSendToBilling = async () => {
    if (!activePatient) return;
    const pName = activePatient.name;
    const vId = activePatient.visitId || 1;

    const payload = {
      queue_id: Number(activePatient.id) || 0,
      queue_number: activePatient.queueNumber || activePatient.ticket,
      visit_id: vId,
      hn: activePatient.hn,
      patient_name: activePatient.name,
      national_id: activePatient.nationalId,
      gender: activePatient.gender,
      age: activePatient.age,
      scheme_type: currentRights || activePatient.treatmentRights,
      allergies: (activePatient.allergies || []).join(', '),
      chronic_diseases: activePatient.chronicDiseases || '',
      phone_number: activePatient.phone || '',
      doctor_advice: activePatient.doctorAdvice,
      medications: activePatient.medications || []
    };

    try {
      const token = localStorage.getItem('token') || localStorage.getItem('clinic_auth_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      let res = await fetch('/api/pharmacy/dispense', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        await fetch('/api/system/dispense', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }
    } catch {
      await fetch('/api/system/dispense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(() => {});
    }

    triggerToast(`ยืนยันการจ่ายยาเรียบร้อย! ส่งข้อมูลใบสั่งยาของ ${pName} ไปยังระบบการเงินแล้ว`, 'success');
    
    const dispensedPatient: PatientConfig = {
      ...activePatient,
      status: 'dispensed' as const,
      visitStatus: 'จ่ายยาแล้ว / ส่งการเงินแล้ว',
      dispensedAt: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.'
    };

    // บันทึกลง Storage ทันทีเพื่อคงค้างอยู่ในตารางเสมอ
    persistDispensedPatient(dispensedPatient);

    // อัปเดตสถานะในคิวทันที ไม่ลบคนไข้ออก
    setQueueList(prev => {
      const updated = prev.map(p => p.id === activePatient.id ? dispensedPatient : p);
      return [...updated].sort((a, b) => Number(a.status === 'dispensed') - Number(b.status === 'dispensed'));
    });

    // สลับไปยังผู้ป่วยคนถัดไปที่ยังรอจัดยา (ถ้ามี)
    const nextPending = queueList.find(p => p.id !== activePatient.id && p.status !== 'dispensed');
    if (nextPending) {
      setLocalPatientId(nextPending.id);
      if (onSelectPatientId) onSelectPatientId(nextPending.id);
    } else {
      // ถ้าไม่มีคิวรออื่นแล้ว ให้ค้างอยู่ที่คนไข้คนนี้เพื่อให้เห็นชัดเจนว่าส่งต่อไปการเงินแล้ว
      setLocalPatientId(activePatient.id);
    }
  };

  // ฟังก์ชันแก้ไขจำนวนยาที่สั่งจ่ายในหน้ารายละเอียดการจ่ายยา
  const handleUpdateMedQty = (index: number, newQty: number) => {
    if (!activePatient) return;
    const safeQty = Math.max(1, Math.min(999, newQty));
    
    setQueueList(prev => prev.map(p => {
      if (p.id === activePatient.id) {
        const updatedMeds = [...(p.medications || [])];
        if (updatedMeds[index]) {
          updatedMeds[index] = {
            ...updatedMeds[index],
            quantity: safeQty
          };
        }
        return {
          ...p,
          medications: updatedMeds
        };
      }
      return p;
    }));
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
            {queueList.filter(p => p.status !== 'dispensed').length}
          </div>
          <div style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>
            รอจัดยา {queueList.filter(p => p.status !== 'dispensed').length} คิว
          </div>
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
            {queueList.filter(p => p.status === 'dispensed').length}
          </div>
          <div style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>
            ส่งต่อไปแคชเชียร์ {queueList.filter(p => p.status === 'dispensed').length} คน
          </div>
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
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#16A34A', lineHeight: '38px' }}>
            {queueList.filter(p => p.status === 'completed').length}
          </div>
          <div style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>เสร็จสิ้น • รับยาเรียบร้อย</div>
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
            {(() => {
              const firstPending = queueList.find(p => p.status !== 'dispensed');
              if (firstPending) {
                return (
                  <span style={{ 
                    background: '#DBEAFE', color: '#1E40AF', fontWeight: 'bold', 
                    padding: '4px 12px', borderRadius: '16px', fontSize: '13px', border: '1px solid #93C5FD' 
                  }}>
                    ถึงคิวที่ {firstPending.queueNumber} ({firstPending.name})
                  </span>
                );
              }
              if (queueList.length > 0) {
                return (
                  <span style={{ 
                    background: '#DCFCE7', color: '#15803D', fontWeight: 'bold', 
                    padding: '4px 12px', borderRadius: '16px', fontSize: '13px', border: '1px solid #86EFAC' 
                  }}>
                    ✓ ส่งข้อมูลไปการเงินครบแล้ว ({queueList.length} รายการ)
                  </span>
                );
              }
              return null;
            })()}
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

            {/* Patients Table with Scrollable Container showing ~5 rows and sticky header */}
            <div 
              className="recent-patients-scroll-container"
              style={{ 
                overflowX: 'auto', 
                overflowY: 'auto', 
                maxHeight: '340px', 
                border: '1px solid #E2E8F0', 
                borderRadius: '10px' 
              }}
            >
              <table style={{ width: '100%', minWidth: '1020px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#F8FAFC' }}>
                  <tr style={{ color: '#0F172A', background: '#F8FAFC', borderBottom: '2px solid #E2E8F0', height: '48px', whiteSpace: 'nowrap' }}>
                    <th style={{ padding: '12px 14px', fontWeight: '700', fontSize: '14.5px', width: '90px', textAlign: 'center' }}>ลำดับคิว</th>
                    <th style={{ padding: '12px 14px', fontWeight: '700', fontSize: '14.5px', width: '110px', textAlign: 'center' }}>HN</th>
                    <th style={{ padding: '12px 14px', fontWeight: '700', fontSize: '14.5px', width: '150px', textAlign: 'center' }}>เลขบัตรประชาชน</th>
                    <th style={{ padding: '12px 16px', fontWeight: '700', fontSize: '14.5px', minWidth: '220px', textAlign: 'left' }}>ชื่อ-นามสกุล คนไข้</th>
                    <th style={{ padding: '12px 14px', fontWeight: '700', fontSize: '14.5px', width: '130px', textAlign: 'center' }}>สถานะคิว</th>
                    <th style={{ padding: '12px 14px', fontWeight: '700', fontSize: '14.5px', width: '160px', textAlign: 'center' }}>สิทธิการรักษา</th>
                    <th style={{ padding: '12px 16px', fontWeight: '700', fontSize: '14.5px', width: '150px', textAlign: 'center' }}>การดำเนินการ</th>
                  </tr>
                </thead>
                <tbody>
                  {queueList
                    .filter(p => {
                      if (statFilter === 'pending') return p.status !== 'dispensed';
                      if (statFilter === 'dispensed') return p.status === 'dispensed';
                      if (statFilter === 'completed') return p.status === 'completed';
                      return true;
                    })
                    .filter(p => 
                      patientIdInput === '' ||
                      p.id.toLowerCase().includes(patientIdInput.toLowerCase()) || 
                      p.hn.toLowerCase().includes(patientIdInput.toLowerCase()) ||
                      p.nationalId.includes(patientIdInput) ||
                      p.name.toLowerCase().includes(patientIdInput.toLowerCase())
                    )
                    .map((p, index) => {
                      const isDispensed = p.status === 'dispensed';
                      return (
                        <tr 
                          key={p.id + '_' + index}
                          className={localPatientId === p.id ? 'active-row' : ''}
                          style={{ 
                            borderBottom: '1px solid #F1F5F9', 
                            whiteSpace: 'nowrap', 
                            height: '56px',
                            background: isDispensed ? '#F8FAFC' : undefined
                          }}
                        >
                          <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', verticalAlign: 'middle', textAlign: 'center' }}>
                            <span style={{ 
                              color: isDispensed ? '#64748B' : '#2563EB', 
                              fontWeight: '700', 
                              fontSize: '15px',
                              fontFamily: 'monospace'
                            }}>
                              {p.queueNumber && p.queueNumber.startsWith('Q') ? p.queueNumber : `Q${String(index + 1).padStart(4, '0')}`}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', verticalAlign: 'middle', textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', justifyContent: 'center' }}>
                              <CopyableText value={p.hn.replace(/[-]/g, '')} />
                            </div>
                          </td>
                          <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', verticalAlign: 'middle', textAlign: 'center' }}>
                            {p.nationalId && p.nationalId !== '-' ? (
                              <div style={{ display: 'inline-flex', justifyContent: 'center' }}>
                                <CopyableText value={p.nationalId} color="#475569" />
                              </div>
                            ) : (
                              <span style={{ color: '#94A3B8' }}>-</span>
                            )}
                          </td>
                          <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', verticalAlign: 'middle', textAlign: 'left' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontWeight: '700', color: '#0F172A', fontSize: '14px' }}>{p.name}</span>
                              {p.doctorAdvice && (
                                <span style={{ fontSize: '12px', color: '#64748B', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {p.doctorAdvice}
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', textAlign: 'center', verticalAlign: 'middle' }}>
                            <span style={{ 
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '105px',
                              height: '28px',
                              boxSizing: 'border-box',
                              borderRadius: '9999px',
                              fontSize: '12.5px',
                              fontWeight: '700',
                              background: isDispensed ? '#DCFCE7' : '#DBEAFE',
                              color: isDispensed ? '#15803D' : '#1E40AF',
                              border: `1.5px solid ${isDispensed ? '#86EFAC' : '#93C5FD'}`,
                              whiteSpace: 'nowrap'
                            }}>
                              {isDispensed ? '✓ จ่ายยาแล้ว' : 'รอจัดยา'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', textAlign: 'center', verticalAlign: 'middle' }}>
                            {(() => {
                              const rights = p.treatmentRights || 'สิทธิ 30 บาท (สปสช.)';
                              const is30 = rights.includes('30') || rights.includes('สปสช') || rights.includes('บัตรทอง');
                              const isSSO = rights.includes('ประกันสังคม');
                              const isGov = rights.includes('ข้าราชการ') || rights.includes('รัฐวิสาหกิจ');
                              const isPriv = rights.includes('ประกันสุขภาพ') || rights.includes('เอกชน');
                              const isSelf = rights.includes('ชำระเงินเอง') || rights.includes('เงินสด');

                              let bg = '#F1F5F9';
                              let color = '#475569';
                              let border = '#CBD5E1';
                              let label = rights;

                              if (is30) {
                                bg = '#FEF9C3';
                                color = '#92400E';
                                border = '#FDE68A';
                                label = 'สิทธิ 30 บาท';
                              } else if (isSSO) {
                                bg = '#E0F2FE';
                                color = '#075985';
                                border = '#BAE6FD';
                                label = 'ประกันสังคม';
                              } else if (isGov) {
                                bg = '#F3E8FF';
                                color = '#6D28D9';
                                border = '#DDD6FE';
                                label = 'สิทธิ์ข้าราชการ';
                              } else if (isPriv) {
                                bg = '#F3E8FF';
                                color = '#7C3AED';
                                border = '#DDD6FE';
                                label = 'ประกันสุขภาพเอกชน';
                              } else if (isSelf) {
                                bg = '#F1F5F9';
                                color = '#334155';
                                border = '#CBD5E1';
                                label = 'ชำระเงินเอง';
                              }

                              return (
                                <span 
                                  title={rights}
                                  style={{ 
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '135px',
                                    height: '28px',
                                    boxSizing: 'border-box',
                                    borderRadius: '9999px',
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    background: bg,
                                    color: color,
                                    border: `1.5px solid ${border}`,
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    padding: '0 8px'
                                  }}
                                >
                                  {label}
                                </span>
                              );
                            })()}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                            {isDispensed ? (
                              <button 
                                onClick={() => {
                                  setLocalPatientId(p.id);
                                  if (onSelectPatientId) onSelectPatientId(p.id);
                                }}
                                style={{ 
                                  width: '125px',
                                  height: '34px',
                                  background: localPatientId === p.id ? '#0D9488' : '#F0FDFA', 
                                  color: localPatientId === p.id ? '#FFFFFF' : '#0F766E', 
                                  border: '1.5px solid #99F6E4', borderRadius: '8px', 
                                  cursor: 'pointer', fontWeight: '700', fontSize: '13px',
                                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                  whiteSpace: 'nowrap',
                                  boxShadow: localPatientId === p.id ? '0 2px 4px rgba(13, 148, 136, 0.25)' : 'none',
                                  transition: 'all 0.15s ease'
                                }}
                                title="คลิกเพื่อดูประวัติใบสั่งยาที่ส่งไปการเงินแล้ว"
                              >
                                <Check size={14} strokeWidth={2.8} />
                                ส่งการเงินแล้ว
                              </button>
                            ) : (
                              <button 
                                onClick={() => {
                                  setLocalPatientId(p.id);
                                  if (onSelectPatientId) onSelectPatientId(p.id);
                                }}
                                style={{ 
                                  width: '125px',
                                  height: '34px',
                                  background: localPatientId === p.id ? '#10B981' : '#2563EB', 
                                  color: 'white', border: 'none', borderRadius: '8px', 
                                  cursor: 'pointer', fontWeight: '700', fontSize: '13.5px',
                                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                  whiteSpace: 'nowrap',
                                  boxShadow: localPatientId === p.id ? '0 2px 6px rgba(16, 185, 129, 0.25)' : '0 2px 6px rgba(37, 99, 235, 0.25)',
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                {localPatientId === p.id ? '✓ เลือกอยู่' : 'จัดยา'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
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
                <div className="patient-badges" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ 
                    background: '#DCFCE7', 
                    color: '#15803D', 
                    border: '1.5px solid #86EFAC', 
                    padding: '4px 10px', 
                    borderRadius: '8px', 
                    fontWeight: '800', 
                    fontSize: '13px', 
                    fontFamily: 'monospace' 
                  }}>
                    {activePatient.ticket}
                  </span>
                  <span style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    background: '#DBEAFE', 
                    border: '1.5px solid #93C5FD', 
                    padding: '3px 8px', 
                    borderRadius: '8px' 
                  }}>
                    <CopyableText label="HN" value={activePatient.hn.replace(/[-]/g, '')} color="#1E40AF" />
                  </span>
                  {activePatient.status === 'dispensed' && (
                    <span style={{ background: '#DCFCE7', color: '#15803D', border: '1.5px solid #86EFAC', padding: '4px 10px', borderRadius: '8px', fontSize: '12.5px', fontWeight: '700' }}>
                      ✓ จ่ายยาแล้ว
                    </span>
                  )}
                </div>
              </div>
              <div className="patient-details" style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center', fontSize: '0.95rem' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#1E293B', fontWeight: '600' }}>
                  <span style={{ color: '#64748B', fontWeight: '500' }}>เพศ:</span> {activePatient.gender}
                </span>
                <span style={{ color: '#CBD5E1' }}>•</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#1E293B', fontWeight: '600' }}>
                  <span style={{ color: '#64748B', fontWeight: '500' }}>อายุ:</span> {activePatient.age} ปี
                </span>
                <span style={{ color: '#CBD5E1' }}>•</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#1E293B', fontWeight: '600' }}>
                  <span style={{ color: '#64748B', fontWeight: '500' }}>เบอร์โทร:</span> {activePatient.phone || '-'}
                </span>
                {activePatient.nationalId && (
                  <>
                    <span style={{ color: '#CBD5E1' }}>•</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#1E293B', fontWeight: '600' }}>
                      <CopyableText label="เลขบัตร ปชช." value={activePatient.nationalId} color="#0F172A" />
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="patient-card-footer">
              <div className="info-box">
                <span className="info-label" style={{ fontSize: '11.5px', fontWeight: '700', color: '#475569' }}>
                  สิทธิการรักษา (TREATMENT RIGHTS)
                </span>
                <span className="info-val" style={{ color: '#1D4ED8', fontWeight: '800', fontSize: '15px' }}>
                  {currentRights}
                </span>
              </div>
              <div className="info-box">
                <span className="info-label" style={{ fontSize: '11.5px', fontWeight: '700', color: '#475569' }}>
                  เวลาเข้ารักษา (VISIT TIME)
                </span>
                <span className="info-val" style={{ color: '#0F172A', fontWeight: '700', fontSize: '14.5px' }}>
                  {activePatient.visitDate} ({activePatient.visitTime})
                </span>
              </div>
              <div className="info-box">
                <span className="info-label" style={{ fontSize: '11.5px', fontWeight: '700', color: '#475569' }}>
                  ประวัติแพ้ยา (KNOWN ALLERGIES)
                </span>
                <div className="badge-wrapper">
                  {activePatient.allergies.map((a, i) => {
                    const hasAllergy = !a.includes('ไม่มี') && !a.includes('ปฏิเสธ');
                    return (
                      <span
                        key={i}
                        style={{
                          background: hasAllergy ? '#FEE2E2' : '#DCFCE7',
                          color: hasAllergy ? '#DC2626' : '#15803D',
                          border: `1.5px solid ${hasAllergy ? '#FCA5A5' : '#86EFAC'}`,
                          fontWeight: '700',
                          padding: '3px 10px',
                          borderRadius: '6px',
                          fontSize: '12.5px',
                          display: 'inline-flex',
                          alignItems: 'center'
                        }}
                      >
                        {a}
                      </span>
                    );
                  })}
                </div>
              </div>
              <div className="info-box">
                <span className="info-label" style={{ fontSize: '11.5px', fontWeight: '700', color: '#475569' }}>
                  โรคประจำตัว (CHRONIC DISEASES)
                </span>
                <span className="info-val" style={{ color: '#0F172A', fontWeight: '700', fontSize: '14.5px' }}>
                  {activePatient.chronicDiseases || 'ไม่มี'}
                </span>
              </div>
              <div className="info-box">
                <span className="info-label" style={{ fontSize: '11.5px', fontWeight: '700', color: '#475569' }}>
                  สัญญาณชีพ (CURRENT VITALS)
                </span>
                <span className="info-val" style={{ color: '#0F172A', fontWeight: '700', fontSize: '14.5px' }}>
                  {activePatient.vitals || 'ความดัน 120/80 mmHg, อุณหภูมิ 36.6 °C'}
                </span>
              </div>
              <div className="info-box">
                <span className="info-label" style={{ fontSize: '11.5px', fontWeight: '700', color: '#475569' }}>
                  สถานะ (VISIT STATUS)
                </span>
                <div className="badge-wrapper">
                  <span style={{
                    background: activePatient.status === 'dispensed' ? '#DCFCE7' : '#DBEAFE',
                    color: activePatient.status === 'dispensed' ? '#15803D' : '#1E40AF',
                    border: `1.5px solid ${activePatient.status === 'dispensed' ? '#86EFAC' : '#93C5FD'}`,
                    fontWeight: '700',
                    padding: '4px 12px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    display: 'inline-flex',
                    alignItems: 'center'
                  }}>
                    {activePatient.visitStatus}
                  </span>
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #E2E8F0', paddingBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                    <h4 className="column-title" style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#0F172A' }}>
                      รายการยาที่สั่งจ่าย ({activePatient.medications.length} รายการ)
                    </h4>
                    <span style={{ fontSize: '13px', color: '#64748B' }}>
                      * สามารถปรับแก้จำนวนยาที่จ่ายได้ในตารางนี้ ระบบจะคำนวณและส่งต่อให้การเงินโดยอัตโนมัติ
                    </span>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                      <thead>
                        <tr style={{ color: '#0F172A', background: '#F1F5F9', borderBottom: '2px solid #CBD5E1', height: '44px' }}>
                          <th style={{ padding: '12px 16px', fontWeight: '700', fontSize: '15px', textAlign: 'center', width: '120px' }}>รหัสยา</th>
                          <th style={{ padding: '12px 16px', fontWeight: '700', fontSize: '15px' }}>ชื่อรายการยา & สรรพคุณ</th>
                          <th style={{ padding: '12px 16px', fontWeight: '700', fontSize: '15px' }}>ขนาด / วิธีรับประทาน</th>
                          <th style={{ padding: '12px 16px', fontWeight: '700', fontSize: '15px', textAlign: 'center', width: '170px' }}>จำนวน</th>
                          <th style={{ padding: '12px 16px', fontWeight: '700', fontSize: '15px', textAlign: 'center', width: '110px' }}>ราคา</th>
                          <th style={{ padding: '12px 16px', fontWeight: '700', fontSize: '15px', textAlign: 'center', width: '130px' }}>สถานะคลังยา</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activePatient.medications.map((med, index) => {
                          const unitPrice = (med as any).unit_price || med.price || 15;
                          const qty = med.quantity || 10;
                          return (
                            <tr key={index} style={{ borderBottom: '1px solid #F1F5F9' }}>
                              <td style={{ padding: '12px', textAlign: 'center' }}>
                                <CopyableText value={med.medId} color="#2563EB" />
                              </td>
                              <td style={{ padding: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                  <CopyableText value={med.name} mono={false} color="#2563EB" />
                                  <span 
                                    style={{ 
                                      fontSize: '12.5px', color: '#0284C7', fontWeight: '600', 
                                      cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' 
                                    }}
                                    onClick={() => setSelectedMedInfo({ name: med.name, medId: med.medId, properties: med.properties })}
                                  >
                                    (คลิกดูสรรพคุณ)
                                  </span>
                                </div>
                              </td>
                              <td style={{ padding: '12px' }}>
                                <div style={{ fontWeight: '600', color: '#1E293B' }}>{med.dosage}</div>
                                <div style={{ fontSize: '12.5px', color: '#64748B', marginTop: '2px' }}>คำแนะนำ: {med.instructions}</div>
                              </td>
                              <td style={{ padding: '12px', textAlign: 'center' }}>
                                <div style={{ 
                                  display: 'inline-flex', 
                                  alignItems: 'center', 
                                  background: '#F8FAFC', 
                                  border: '1.5px solid #E2E8F0', 
                                  borderRadius: '9999px', 
                                  padding: '4px 6px', 
                                  gap: '6px',
                                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                                  transition: 'all 0.2s ease'
                                }}>
                                  <button 
                                    type="button" 
                                    onClick={() => handleUpdateMedQty(index, Math.max(1, qty - 1))}
                                    disabled={qty <= 1}
                                    style={{
                                      width: '28px',
                                      height: '28px',
                                      borderRadius: '50%',
                                      border: '1px solid #E2E8F0',
                                      background: qty <= 1 ? '#F1F5F9' : '#FFFFFF',
                                      color: qty <= 1 ? '#CBD5E1' : '#334155',
                                      cursor: qty <= 1 ? 'not-allowed' : 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      boxShadow: qty <= 1 ? 'none' : '0 1px 2px rgba(0, 0, 0, 0.06)',
                                      transition: 'all 0.15s ease'
                                    }}
                                    onMouseEnter={(e) => {
                                      if (qty > 1) {
                                        e.currentTarget.style.background = '#EF4444';
                                        e.currentTarget.style.borderColor = '#EF4444';
                                        e.currentTarget.style.color = '#FFFFFF';
                                        e.currentTarget.style.transform = 'scale(1.08)';
                                      }
                                    }}
                                    onMouseLeave={(e) => {
                                      if (qty > 1) {
                                        e.currentTarget.style.background = '#FFFFFF';
                                        e.currentTarget.style.borderColor = '#E2E8F0';
                                        e.currentTarget.style.color = '#334155';
                                        e.currentTarget.style.transform = 'scale(1)';
                                      }
                                    }}
                                    title="ลดจำนวน"
                                  >
                                    <Minus size={13} strokeWidth={2.8} />
                                  </button>
                                  <input 
                                    type="number" 
                                    min="1"
                                    max={med.stock || 999}
                                    value={qty}
                                    onChange={(e) => handleUpdateMedQty(index, Math.max(1, parseInt(e.target.value) || 1))}
                                    style={{
                                      width: '42px',
                                      height: '28px',
                                      textAlign: 'center',
                                      fontWeight: '800',
                                      fontSize: '15px',
                                      fontFamily: 'ui-monospace, monospace',
                                      border: 'none',
                                      background: 'transparent',
                                      color: '#0F172A',
                                      outline: 'none',
                                      padding: '0'
                                    }}
                                  />
                                  <button 
                                    type="button" 
                                    onClick={() => handleUpdateMedQty(index, qty + 1)}
                                    style={{
                                      width: '28px',
                                      height: '28px',
                                      borderRadius: '50%',
                                      border: 'none',
                                      background: '#2563EB',
                                      color: '#FFFFFF',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      boxShadow: '0 2px 4px rgba(37, 99, 235, 0.3)',
                                      transition: 'all 0.15s ease'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background = '#1D4ED8';
                                      e.currentTarget.style.transform = 'scale(1.08)';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = '#2563EB';
                                      e.currentTarget.style.transform = 'scale(1)';
                                    }}
                                    title="เพิ่มจำนวน"
                                  >
                                    <Plus size={13} strokeWidth={2.8} />
                                  </button>
                                  <span style={{
                                    fontSize: '12px',
                                    fontWeight: '700',
                                    color: '#475569',
                                    background: '#E2E8F0',
                                    padding: '2px 8px',
                                    borderRadius: '9999px',
                                    marginLeft: '2px'
                                  }}>
                                    เม็ด
                                  </span>
                                </div>
                              </td>
                              <td style={{ padding: '12px', textAlign: 'center', fontWeight: '700', fontSize: '14.5px', color: '#0F172A' }}>
                                ฿ {(unitPrice * qty).toLocaleString()}
                                <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 'normal' }}>
                                  (@ ฿{unitPrice})
                                </div>
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
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Action Button: Confirm & Send to Billing */}
                <div className="send-billing-action-bar" style={{ marginTop: '4px' }}>
                  {activePatient.status === 'dispensed' ? (
                    <div style={{
                      padding: '16px 24px', background: '#DCFCE7', border: '1.5px solid #86EFAC',
                      borderRadius: '12px', color: '#15803D', fontWeight: '700', fontSize: '15px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                    }}>
                      <Check size={20} strokeWidth={2.5} />
                      ใบสั่งยานี้ส่งต่อไปยังห้องการเงินเรียบร้อยแล้ว (รอผู้ป่วยชำระเงินที่ห้องการเงิน)
                    </div>
                  ) : (
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
                  )}
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
