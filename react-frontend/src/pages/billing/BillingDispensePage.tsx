import { useState, useEffect, useMemo } from 'react';
import './BillingDispensePage.css';
import { CLINIC_CONFIG, type PatientConfig } from '../../config/clinicConfig';
import { useWebSocket } from '../../context/WebSocketContext';
import CopyableText from '../../components/Common/CopyableText';

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
  const activePatient: PatientConfig | undefined = queueList.find(p => p.id === localPatientId) || queueList[0];
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

  // Pagination for queue table
  const [currentQueuePage, setCurrentQueuePage] = useState(1);
  const queuePageSize = 10;
  const totalQueuePages = Math.ceil(filteredQueue.length / queuePageSize) || 1;
  const paginatedQueue = useMemo(() => {
    const start = (currentQueuePage - 1) * queuePageSize;
    return filteredQueue.slice(start, start + queuePageSize);
  }, [filteredQueue, currentQueuePage, queuePageSize]);



  const [toast, setToast] = useState<ToastState | null>(null);
  const [isToastFading, setIsToastFading] = useState(false);
  const [copiedHn, setCopiedHn] = useState<string | null>(null);

  const handleCopyHn = (hn: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!hn) return;
    const clean = hn.replace(/[-]/g, '');
    try {
      navigator.clipboard.writeText(clean);
      setCopiedHn(clean);
      setTimeout(() => setCopiedHn(null), 1500);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = clean;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedHn(clean);
      setTimeout(() => setCopiedHn(null), 1500);
    }
  };

  const [masterMedicines, setMasterMedicines] = useState<any[]>([]);

  useEffect(() => {
    const fetchMasterMeds = async () => {
      try {
        let res = await fetch('/api/pharmacy/medicines');
        if (!res.ok) res = await fetch('/api/system/medicines');
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'success' && Array.isArray(data.medicines)) {
            setMasterMedicines(data.medicines);
          }
        }
      } catch {}
    };
    fetchMasterMeds();
  }, []);

  const parseDispensedMed = (item: any, dbMeds: any[] = masterMedicines) => {
    const m = item.medicine || item.Medicine || item;
    let name = m.name || item.name || item.med_name || '';
    let code = m.medicine_code || m.code || m.medId || (item.medicine_id ? `MED-${item.medicine_id}` : '');
    let genericName = m.generic_name || m.genericName || '';
    let category = m.category || 'ยาสามัญ';
    let properties = m.properties || 'ยาตามแพทย์สั่งจ่าย';
    let unitPrice = Number(m.unit_price ?? m.price ?? item.unit_price ?? item.price ?? 0);
    const qty = Number(item.quantity ?? item.qty ?? m.quantity ?? 10) || 10;
    const dosage = item.dosage || m.dosage || '1 เม็ด วันละ 3 ครั้ง หลังอาหาร';
    const instructions = item.instructions || m.instructions || 'รับประทานหลังอาหาร เช้า กลางวัน เย็น';

    if (dbMeds.length > 0) {
      const cLower = (code || '').toLowerCase().trim();
      const nLower = (name || '').toLowerCase().trim();
      for (const dbM of dbMeds) {
        const dbCode = (dbM.medicine_code || '').toLowerCase().trim();
        const dbName = (dbM.name || '').toLowerCase().trim();
        const dbGen = (dbM.generic_name || '').toLowerCase().trim();

        let isMatch = false;
        if (dbCode && cLower && (dbCode === cLower || cLower.includes(dbCode))) isMatch = true;
        if (!isMatch && dbName && nLower && (nLower.includes(dbName) || dbName.includes(nLower))) isMatch = true;
        if (!isMatch && dbGen && nLower && nLower.includes(dbGen)) isMatch = true;

        if (!isMatch && dbName && nLower) {
          const firstWord = dbName.split(' ')[0];
          if (firstWord && firstWord.length >= 3 && nLower.includes(firstWord)) {
            isMatch = true;
          }
        }

        if (isMatch) {
          if (!name || name === 'ยาบรรเทาอาการ' || name === 'ยาตามแพทย์สั่ง') name = dbM.name;
          if (!code) code = dbM.medicine_code;
          if (!genericName) genericName = dbM.generic_name;
          if (!category || category === 'ยาสามัญ') category = dbM.category;
          if (!properties || properties === 'ยาตามแพทย์สั่งจ่าย') properties = dbM.properties;
          if (dbM.unit_price > 0) {
            unitPrice = Number(dbM.unit_price);
          }
          break;
        }
      }
    }

    if (!name || name === 'ยาบรรเทาอาการ') name = 'ยาตามแพทย์สั่งจ่าย';
    if (unitPrice <= 0) unitPrice = 10;

    return {
      medId: code,
      name,
      genericName,
      category,
      properties,
      dosage,
      instructions,
      price: unitPrice,
      unit_price: unitPrice,
      quantity: qty,
      stock: m.stock_quantity || 100,
      stockStatus: (m.stock_quantity || 100) > 10 ? ('in-stock' as const) : ('low-stock' as const)
    };
  };

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
          if (bData.status === 'success' && Array.isArray(bData.queues)) {
            const mapped = bData.queues.map((bq: any) => {
              let parsedMeds: any[] = [];
              if (bq.medications) {
                try {
                  const rawMeds = typeof bq.medications === 'string' ? JSON.parse(bq.medications) : bq.medications;
                  if (Array.isArray(rawMeds)) {
                    parsedMeds = rawMeds.map((m: any) => parseDispensedMed(m, masterMedicines));
                  }
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
            if (mapped.length === 0) {
              // Fallback: ดึงจากคิวกลางของคลินิก /api/queue/list หากยังไม่มีใน billing_queues
              try {
                let qRes = await fetch('/api/queue/list', { headers });
                if (!qRes.ok) qRes = await fetch('/api/system/queues');
                if (qRes.ok) {
                  const qData = await qRes.json();
                  const list = Array.isArray(qData) ? qData : (qData.queues || []);
                  const waitingPayment = list.filter((q: any) => 
                    ['รอชำระเงิน', 'รอรับยา'].includes(q.status) || ['รอชำระเงิน', 'รอรับยา'].includes(q.queueStatus)
                  );
                  if (waitingPayment.length > 0) {
                    const mappedFallback = waitingPayment.map((q: any) => {
                      const p = q.patient || {};
                      const hn = p.hn || q.hn || `HN${q.id || 1}`;
                      const pName = p.fullname || q.patientName || q.name || 'ผู้ป่วย';
                      return {
                        id: String(q.id),
                        visitId: q.visit_id || q.visitId || 1,
                        hn: hn.replace(/[-]/g, ''),
                        nationalId: p.national_id || q.idCard || '-',
                        queueNumber: q.queue_number || q.queueNo || 'B-001',
                        ticket: q.queue_number || q.queueNo || 'B-001',
                        name: pName,
                        shortName: pName,
                        gender: p.gender || 'หญิง',
                        age: p.age || 35,
                        treatmentRights: p.scheme_type || 'บัตรทอง (สปสช.)',
                        patientType: 'ผู้ป่วยนอก (OPD)' as const,
                        allergies: ['ไม่มีประวัติแพ้ยา'],
                        chronicDiseases: 'ไม่มี',
                        vitals: 'ความดัน 120/80 mmHg, อุณหภูมิ 36.6 °C',
                        visitStatus: 'รอรับยา / ชำระเงิน',
                        visitDate: new Date().toLocaleDateString('th-TH'),
                        visitTime: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.',
                        doctorAdvice: q.note || 'ตรวจเรียบร้อย รอชำระเงินและรับยา',
                        medications: []
                      };
                    });
                    setQueueList(mappedFallback);
                    setLocalPatientId(mappedFallback[0].id);
                    return;
                  }
                }
              } catch {}
            }

            setQueueList(prev => {
              if (mapped.length === 0) return prev;
              const existingIds = new Set(mapped.map((m: any) => m.id));
              const keepPrev = prev.filter(p => !existingIds.has(p.id) && p.visitStatus === 'รอรับยา / ชำระเงิน');
              return [...mapped, ...keepPrev];
            });
            setLocalPatientId(prev => {
              if (mapped.length > 0) {
                if (!prev || !mapped.find((q: any) => q.id === prev)) {
                  return mapped[0].id;
                }
                return prev;
              }
              return prev;
            });
            return;
          }
        }
      } catch (err) {
        console.error('Failed to fetch initial billing queue:', err);
      }
    };
    
    fetchInitialQueue();

    // Smart Background Polling ทุกๆ 2.5 วินาที เพื่อดึงคิวการเงินล่าสุดอย่างต่อเนื่อง
    const pollInterval = setInterval(() => {
      if (!document.hidden) {
        fetchInitialQueue();
      }
    }, 2500);

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
          medications: Array.isArray(data.medications) ? data.medications.map((m: any) => parseDispensedMed(m, masterMedicines)) : [],
        };
        setQueueList(prev => [newPatient, ...prev.filter(q => q.id !== newPatient.id)]);
        setLocalPatientId(newPatient.id);
        if (onSelectPatientId) onSelectPatientId(newPatient.id);
        triggerToast(`ได้รับคิวใหม่สำหรับการเงิน: ${pName} (${data.queue_number || ''})`, 'doctor');
      }
      fetchInitialQueue();
    });

    const unsubExam = subscribe('EXAMINATION_SAVED', () => {
      fetchInitialQueue();
    });

    const unsubMedQ = subscribe('MEDICINE_QUEUE_CREATED', () => {
      fetchInitialQueue();
    });

    const unsubDispense = subscribe('DISPENSE_RECORDED', () => {
      fetchInitialQueue();
    });

    const unsubQueue = subscribe('QUEUE_UPDATED', (data: any) => {
      if (data && data.action === 'db_reset') {
        setQueueList([]);
        setLocalPatientId('');
      } else {
        fetchInitialQueue();
      }
    });

    const unsubPay = subscribe('PAYMENT_CONFIRMED', () => {
      fetchInitialQueue();
    });

    return () => {
      clearInterval(pollInterval);
      unsubBill();
      unsubExam();
      unsubMedQ();
      unsubDispense();
      unsubQueue();
      unsubPay();
    };
  }, [subscribe, masterMedicines.length]);

  // Real-time Query Medications from DB for Active Billing Patient
  useEffect(() => {
    if (activePatient) {
      const fetchMeds = async () => {
        try {
          if (activePatient.visitId) {
            let res = await fetch(`/api/pharmacy/dispensing/${activePatient.visitId}`);
            if (!res.ok) {
              res = await fetch(`/api/system/dispensing/${activePatient.visitId}`);
            }
            if (res.ok) {
              const data = await res.json();
              if (data.status === 'success' && Array.isArray(data.dispensing) && data.dispensing.length > 0) {
                const fetchedMeds = data.dispensing.map((item: any) => parseDispensedMed(item, masterMedicines));
                
                setQueueList(prev => prev.map(q => {
                  if (q.id === activePatient.id) {
                    return { ...q, medications: fetchedMeds };
                  }
                  return q;
                }));
                return;
              }
            }
          }

          // Fallback 1: ดึงจาก patient-medicines ตาม HN
          if (activePatient.hn) {
            let hnRes = await fetch(`/api/pharmacy/patient-medicines/${encodeURIComponent(activePatient.hn)}`);
            if (!hnRes.ok) {
              hnRes = await fetch(`/api/system/patient-medicines/${encodeURIComponent(activePatient.hn)}`);
            }
            if (hnRes.ok) {
              const hnData = await hnRes.json();
              if (hnData.status === 'success' && Array.isArray(hnData.dispensings) && hnData.dispensings.length > 0) {
                const fetchedMeds = hnData.dispensings.map((item: any) => parseDispensedMed(item, masterMedicines));

                setQueueList(prev => prev.map(q => {
                  if (q.id === activePatient.id) {
                    return { 
                      ...q, 
                      medications: fetchedMeds,
                      doctorAdvice: hnData.doctor_advice || q.doctorAdvice
                    };
                  }
                  return q;
                }));
                return;
              }
            }
          }

          // Fallback 2: ดึงจาก /api/billing/queues
          let bRes = await fetch('/api/billing/queues');
          if (!bRes.ok) bRes = await fetch('/api/system/billing/queues');
          if (bRes.ok) {
            const bData = await bRes.json();
            if (bData.status === 'success' && Array.isArray(bData.queues)) {
              const match = bData.queues.find((q: any) => String(q.id) === activePatient.id || q.hn === activePatient.hn || q.patient_name === activePatient.name);
              if (match && match.medications) {
                try {
                  const rawMeds = typeof match.medications === 'string' ? JSON.parse(match.medications) : match.medications;
                  if (Array.isArray(rawMeds) && rawMeds.length > 0) {
                    const fetchedMeds = rawMeds.map((item: any) => parseDispensedMed(item, masterMedicines));
                    setQueueList(prev => prev.map(q => {
                      if (q.id === activePatient.id) {
                        return { ...q, medications: fetchedMeds };
                      }
                      return q;
                    }));
                  }
                } catch {}
              }
            }
          }
        } catch (err) {
          console.error('Failed to fetch medications for billing visit:', err);
        }
      };
      fetchMeds();
    }
  }, [activePatient?.id, activePatient?.visitId, activePatient?.hn, masterMedicines.length]);

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
  }, [toast]);

  const handleSelectPatient = (id: string) => {
    setLocalPatientId(id);
    localStorage.setItem('billing_active_patient', id);
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
    localStorage.setItem('billing_active_patient', activePatient.id);
    localStorage.setItem('billing_active_patient_data', JSON.stringify(activePatient));
    if (onNavigateToBilling) {
      onNavigateToBilling();
    }
  };

  const medTotal = activePatient && Array.isArray(activePatient.medications) 
    ? activePatient.medications.reduce((sum, m: any) => sum + ((Number(m?.price || m?.unit_price) || 0) * (Number(m?.quantity) || 1)), 0) 
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
            <div style={{ overflowX: 'hidden', width: '100%', marginTop: '16px' }}>
              <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
                <thead>
                  <tr style={{ color: '#0F172A', background: '#F8FAFC', borderBottom: '2px solid #E2E8F0', height: '44px', whiteSpace: 'nowrap' }}>
                    <th style={{ padding: '12px 6px', fontWeight: '700', fontSize: '13.5px', textAlign: 'center', width: '12%' }}>ลำดับคิว</th>
                    <th style={{ padding: '12px 6px', fontWeight: '700', fontSize: '13.5px', textAlign: 'center', width: '14%' }}>HN</th>
                    <th style={{ padding: '12px 14px', fontWeight: '700', fontSize: '13.5px', textAlign: 'left', width: '24%' }}>ชื่อ-นามสกุล คนไข้</th>
                    <th style={{ padding: '12px 6px', fontWeight: '700', fontSize: '13.5px', textAlign: 'center', width: '16%' }}>เลขบัตรประชาชน</th>
                    <th style={{ padding: '12px 6px', fontWeight: '700', fontSize: '13.5px', textAlign: 'center', width: '18%' }}>สิทธิการรักษา</th>
                    <th style={{ padding: '12px 16px 12px 6px', fontWeight: '700', fontSize: '13.5px', textAlign: 'center', width: '16%' }}>การดำเนินการ</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQueue.length > 0 ? (
                    paginatedQueue.map((p, index) => (
                      <tr 
                        key={p.id + '_' + index}
                        className={localPatientId === p.id ? 'active-row' : ''}
                        style={{ borderBottom: '1px solid #F1F5F9', whiteSpace: 'nowrap' }}
                      >
                        <td style={{ padding: '10px 6px', whiteSpace: 'nowrap', textAlign: 'center' }}>
                          <span style={{ 
                            color: '#2563EB', 
                            fontWeight: '700', 
                            fontSize: '14px',
                            whiteSpace: 'nowrap', 
                            display: 'inline-block'
                          }}>
                            {p.queueNumber && p.queueNumber.startsWith('Q') ? p.queueNumber : `Q${String((currentQueuePage - 1) * queuePageSize + index + 1).padStart(4, '0')}`}
                          </span>
                        </td>
                        <td style={{ padding: '10px 6px', whiteSpace: 'nowrap', textAlign: 'center' }}>
                          <CopyableText value={p.hn.replace(/[-]/g, '')} color="#2563EB" />
                        </td>
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', textAlign: 'left' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: '700', color: '#0F172A', whiteSpace: 'nowrap' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                              <circle cx="12" cy="7" r="4"/>
                            </svg>
                            {p.name}
                          </div>
                        </td>
                        <td className="patient-table-sub" style={{ padding: '10px 6px', fontFamily: 'monospace', fontSize: '13px', whiteSpace: 'nowrap', textAlign: 'center', color: '#64748B' }}>
                          {p.nationalId || '-'}
                        </td>
                        <td style={{ padding: '10px 6px', whiteSpace: 'nowrap', textAlign: 'center' }}>
                          <span style={{ 
                            background: '#F3E8FF',
                            color: '#7E22CE',
                            border: '1px solid #E9D5FF',
                            padding: '4px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: '700',
                            whiteSpace: 'nowrap', display: 'inline-flex', justifyContent: 'center', alignItems: 'center'
                          }}>
                            {(p.treatmentRights || '').includes('30') ? 'บัตรทอง (สปสช.)' : (p.treatmentRights || 'บัตรทอง (สปสช.)')}
                          </span>
                        </td>

                        <td style={{ padding: '10px 16px 10px 6px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <button 
                            type="button"
                            onClick={() => handleSelectPatient(p.id)}
                            style={{ 
                              padding: '6px 16px', 
                              background: localPatientId === p.id ? '#10B981' : '#2563EB', 
                              color: 'white', border: 'none', borderRadius: '7px', 
                              cursor: 'pointer', fontWeight: '700', fontSize: '12.5px',
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                              whiteSpace: 'nowrap',
                              boxShadow: localPatientId === p.id ? '0 2px 4px rgba(16, 185, 129, 0.25)' : '0 2px 4px rgba(37, 99, 235, 0.25)'
                            }}
                            title="เลือกคนไข้นี้เพื่อคิดเงินและออกบิล"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
                            </svg>
                            {localPatientId === p.id ? 'เลือกอยู่' : 'เลือกคิว'}
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

            {/* Queue Pagination Bar */}
            <div className="pagination-bar" style={{ borderRadius: '0 0 12px 12px', marginTop: '4px' }}>
              <span className="pagination-info">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <line x1="3" y1="9" x2="21" y2="9"/>
                  <line x1="9" y1="21" x2="9" y2="9"/>
                </svg>
                {filteredQueue.length > 0 
                  ? `แสดง ${(currentQueuePage - 1) * queuePageSize + 1} ถึง ${Math.min(currentQueuePage * queuePageSize, filteredQueue.length)} จาก ${filteredQueue.length} รายการ`
                  : 'ไม่มีข้อมูลแสดงผล'
                }
              </span>
              {totalQueuePages > 1 && (
                <div className="pagination-buttons">
                  <button 
                    type="button"
                    className="page-arrow" 
                    disabled={currentQueuePage === 1}
                    onClick={() => setCurrentQueuePage(p => Math.max(1, p - 1))}
                  >
                    ‹ ย้อนกลับ
                  </button>
                  {Array.from({ length: totalQueuePages }, (_, i) => i + 1).map((pageNum) => (
                    <button
                      key={pageNum}
                      type="button"
                      className={`page-num ${currentQueuePage === pageNum ? 'active' : ''}`}
                      onClick={() => setCurrentQueuePage(pageNum)}
                    >
                      {pageNum}
                    </button>
                  ))}
                  <button 
                    type="button"
                    className="page-arrow" 
                    disabled={currentQueuePage === totalQueuePages}
                    onClick={() => setCurrentQueuePage(p => Math.min(totalQueuePages, p + 1))}
                  >
                    ถัดไป ›
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {activePatient ? (
        <div className="dispense-grid">
          {/* Prescription List */}
          <div className="prescription-card card">
            <div className="card-top-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h2 className="card-heading" style={{ margin: 0 }}>
                  รายการยา - {activePatient.name}
                </h2>
                <span
                  onClick={(e) => handleCopyHn(activePatient.hn, e)}
                  title={copiedHn === activePatient.hn.replace(/[-]/g, '') ? 'คัดลอกแล้ว!' : 'คลิกเพื่อคัดลอก HN'}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    cursor: 'pointer',
                    position: 'relative',
                    userSelect: 'none',
                    background: '#F8FAFC',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    border: '1px solid #E2E8F0'
                  }}
                >
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#1E293B', fontFamily: 'monospace' }}>
                    {activePatient.hn.replace(/[-]/g, '')}
                  </span>
                  {copiedHn === activePatient.hn.replace(/[-]/g, '') ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  )}
                  {copiedHn === activePatient.hn.replace(/[-]/g, '') && (
                    <span style={{
                      position: 'absolute',
                      top: '-24px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: '#0F172A',
                      color: '#FFFFFF',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      whiteSpace: 'nowrap',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                      zIndex: 50
                    }}>
                      คัดลอกแล้ว!
                    </span>
                  )}
                </span>
              </div>
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
                  <th style={{ textAlign: 'right' }}>ราคา/หน่วย</th>
                  <th style={{ textAlign: 'right' }}>จำนวน</th>
                  <th style={{ textAlign: 'right' }}>รวมเงิน</th>
                </tr>
              </thead>
              <tbody>
                {(activePatient?.medications && activePatient.medications.length > 0) ? (
                  activePatient.medications.map((med, idx) => {
                    const uPrice = Number((med as any).price || (med as any).unit_price) || 0;
                    const qty = Number((med as any).quantity) || 10;
                    const lineTotal = uPrice * qty;
                    return (
                      <tr key={idx}>
                        <td className="item-name font-bold">{med.name}</td>
                        <td>{med.dosage}</td>
                        <td style={{ textAlign: 'right', color: '#64748B' }}>฿ {uPrice.toLocaleString()}</td>
                        <td style={{ textAlign: 'right', fontWeight: '600' }}>{qty}</td>
                        <td style={{ textAlign: 'right', fontWeight: '700', color: '#0F172A' }}>฿ {lineTotal.toLocaleString()}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: '#64748B', fontStyle: 'italic' }}>
                      กำลังดึงรายการยาและราคาจากแพทย์...
                    </td>
                  </tr>
                )}
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
              {(activePatient?.medications || []).map((med: any, idx) => {
                const uPrice = Number(med.price || med.unit_price) || 0;
                const qty = Number(med.quantity) || 1;
                const itemTotal = uPrice * qty;
                return (
                  <div key={idx} className="summary-item">
                    <div className="item-details">
                      <div className="item-title">{med.name} (x{qty})</div>
                      <div className="item-sub">{med.dosage}</div>
                    </div>
                    <div className="item-price">
                      ฿ {itemTotal.toLocaleString()}
                    </div>
                  </div>
                );
              })}
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
