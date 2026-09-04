import { useState, useEffect, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import './BillingDispensePage.css';
import { CLINIC_CONFIG, type PatientConfig } from '../../config/clinicConfig';
import { useWebSocket } from '../../context/WebSocketContext';
import CopyableText from '../../components/Common/CopyableText';
import { BillingDispenseSkeleton } from '../../components/Common/ClinicSkeleton';
import { CLINIC_ANIMATION_CONFIG } from '../../config/animationConfig';

interface ToastState {
  message: string;
  type: 'success' | 'error' | 'doctor';
}

// Persistent Storage Key สำหรับจัดเก็บคิวที่ชำระเงินเสร็จสิ้นแล้ว ให้ค้างแสดงในตารางเสมอ
const COMPLETED_BILLING_STORAGE_KEY = 'billing_completed_patients_log';
const DISPENSED_LOGS_STORAGE_KEY = 'pharmacy_dispensed_patients_log';

const getStoredDispensedPatients = (): PatientConfig[] => {
  try {
    const raw = localStorage.getItem(DISPENSED_LOGS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const getStoredCompletedBillings = (): PatientConfig[] => {
  try {
    const raw = localStorage.getItem(COMPLETED_BILLING_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const persistCompletedBilling = (patient: PatientConfig) => {
  try {
    const existing = getStoredCompletedBillings();
    const cleanHN = (patient.hn || '').replace(/[-]/g, '');
    const filtered = existing.filter(p => p.id !== patient.id && (p.hn || '').replace(/[-]/g, '') !== cleanHN);
    const updated = [
      {
        ...patient,
        status: 'completed' as const,
        visitStatus: 'ชำระเงินแล้ว / เสร็จสิ้น',
        dispensedAt: patient.dispensedAt || (new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.')
      },
      ...filtered
    ].slice(0, 50);
    localStorage.setItem(COMPLETED_BILLING_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to persist completed billing:', err);
  }
};

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
  const [statFilter, setStatFilter] = useState<'all' | 'pending' | 'completed'>('all');
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
  
  // คิวเริ่มต้น - เริ่มเป็น [] จนกว่าจะดึงข้อมูลจาก DB ได้
  const [queueList, setQueueList] = useState<PatientConfig[]>([]);

  // สถานะการโหลดข้อมูลเริ่มต้นจากฐานข้อมูล (แสดงอนิเมะชันโหลดข้อมูล)
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // สถานะกำลังประมวลผลส่งต่อไปยังหน้าการเงิน
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Current active patient object
  const activePatient: PatientConfig | undefined = queueList.find(p => p.id === localPatientId) || queueList[0];
  const currentRights = activePatient ? (patientRightsMap?.[activePatient.id] || activePatient.treatmentRights) : '';

  const filteredQueue = queueList.filter(p => {
    // 1. Filter by Status
    const isCompleted = p.status === 'completed' || p.visitStatus?.includes('เสร็จสิ้น') || p.visitStatus?.includes('ชำระเงินแล้ว');
    if (statFilter === 'pending' && isCompleted) return false;
    if (statFilter === 'completed' && !isCompleted) return false;

    // 2. Filter by Search Query
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

  // Real-time Queue & Billing Listener (ดึงทั้งคิวรอชำระเงิน และประวัติที่ชำระเงินเสร็จสิ้นแล้ว ซิงค์ตรงกับระบบจัดการยา 100%)
  useEffect(() => {
    let isMounted = true;
    const loadStartTime = Date.now();
    const fetchInitialQueue = async (isInitial = false) => {
      try {
        const token = localStorage.getItem('token');
        const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};
        
        // 1. ดึงทั้งคิวห้องยา, คิวการเงิน, และประวัติการเงิน (Billing History) แบบ Parallel เพื่อความเร็วสูงสุดและ Sync ตรงกัน 100%
        const [pRes, bRes, histRes] = await Promise.all([
          fetch('/api/pharmacy/queues', { headers }).then(r => r.ok ? r : fetch('/api/system/pharmacy/queues')).catch(() => null),
          fetch('/api/billing/queues', { headers }).then(r => r.ok ? r : fetch('/api/system/billing/queues')).catch(() => null),
          fetch('/api/billing/history', { headers }).then(r => r.ok ? r : fetch('/api/system/billing/history')).catch(() => null)
        ]);

        let pData: any = null;
        let bData: any = null;
        let histData: any = null;

        if (pRes && pRes.ok) {
          try { pData = await pRes.json(); } catch {}
        }
        if (bRes && bRes.ok) {
          try { bData = await bRes.json(); } catch {}
        }
        if (histRes && histRes.ok) {
          try { histData = await histRes.json(); } catch {}
        }

        const completedHistories: any[] = (histData && (histData.histories || histData.history)) || [];

        let mappedQueues: PatientConfig[] = [];

        // 1. นำข้อมูลจาก Pharmacy Queues เป็นแหล่งข้อมูลหลัก (เพื่อให้เลขคิว QE... และคนไข้ตรงกับระบบยาทุกประการ 100%)
        if (pData && pData.status === 'success' && Array.isArray(pData.queues)) {
          pData.queues.forEach((pq: any) => {
            const cleanHN = (pq.hn || (pq.patient && pq.patient.hn) || '').replace(/[-]/g, '');
            let parsedMeds: any[] = [];
            if (pq.medications && pq.medications !== 'null') {
              try {
                const rawMeds = typeof pq.medications === 'string' ? JSON.parse(pq.medications) : pq.medications;
                if (Array.isArray(rawMeds)) {
                  parsedMeds = rawMeds.map((m: any) => parseDispensedMed(m, masterMedicines));
                }
              } catch {}
            }

            // ตรวจสอบว่าชำระเงินเสร็จสิ้นแล้วหรือไม่ (จากประวัติการเงิน completedHistories)
            const isPaid = completedHistories.some((bh: any) => {
              const bhHN = (bh.hn || '').replace(/[-]/g, '');
              const bhQ = bh.queue_number || bh.queueNumber;
              return (bh.visit_id && pq.visit_id && bh.visit_id === pq.visit_id) ||
                     (bhQ && (bhQ === pq.queue_number || bhQ === pq.ticket)) ||
                     (bhHN && cleanHN && bhHN === cleanHN && bhHN !== 'HN0001');
            });

            const isCompleted = pq.status === 'completed' || pq.status === 'เสร็จสิ้น' || isPaid;

            mappedQueues.push({
              id: String(pq.id),
              visitId: pq.visit_id || 1,
              hn: cleanHN || `HN0001`,
              nationalId: pq.national_id || '-',
              queueNumber: pq.queue_number || 'Q0001',
              ticket: pq.queue_number || 'Q0001',
              name: pq.patient_name || 'ผู้ป่วย',
              shortName: pq.patient_name || 'ผู้ป่วย',
              gender: pq.gender || 'หญิง',
              age: pq.age || 35,
              treatmentRights: pq.scheme_type || 'บัตรทอง (สปสช.)',
              patientType: 'ผู้ป่วยนอก (OPD)' as const,
              allergies: pq.allergies ? [pq.allergies] : ['ไม่มีประวัติแพ้ยา'],
              chronicDiseases: pq.chronic_diseases || 'ไม่มี',
              vitals: 'ความดัน 120/80 mmHg, อุณหภูมิ 36.6 °C',
              visitStatus: isCompleted ? 'ชำระเงินแล้ว / เสร็จสิ้น' : (pq.status === 'dispensed' ? 'รอชำระเงิน' : 'รอชำระเงิน'),
              status: isCompleted ? ('completed' as const) : ('pending' as const),
              visitDate: new Date(pq.created_at || Date.now()).toLocaleDateString('th-TH'),
              visitTime: new Date(pq.created_at || Date.now()).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.',
              doctorAdvice: pq.doctor_advice || 'มีไข้ ไอ เจ็บคอ แพทย์สั่งจ่ายยา',
              medications: parsedMeds
            });
          });
        }

        // 2. ดึงคิวจาก /api/billing/queues มาเสริม (กรณีมีคิวที่สร้างเฉพาะการเงินหรือยังไม่มีใน pharmacy)
        if (bData && bData.status === 'success' && Array.isArray(bData.queues)) {
          bData.queues.forEach((bq: any) => {
            const cleanHN = (bq.hn || '').replace(/[-]/g, '');
            const exists = mappedQueues.some(q => 
              q.id === String(bq.id) ||
              (cleanHN && (q.hn || '').replace(/[-]/g, '') === cleanHN && cleanHN !== 'HN0001') || 
              (bq.visit_id && q.visitId === bq.visit_id) ||
              (bq.queue_number && (q.queueNumber === bq.queue_number || q.ticket === bq.queue_number))
            );
            if (!exists) {
              let parsedMeds: any[] = [];
              if (bq.medications && bq.medications !== 'null') {
                try {
                  const rawMeds = typeof bq.medications === 'string' ? JSON.parse(bq.medications) : bq.medications;
                  if (Array.isArray(rawMeds)) {
                    parsedMeds = rawMeds.map((m: any) => parseDispensedMed(m, masterMedicines));
                  }
                } catch {}
              }
              mappedQueues.push({
                id: String(bq.id),
                visitId: bq.visit_id || 1,
                hn: cleanHN || `HN0001`,
                nationalId: bq.national_id || '-',
                queueNumber: bq.queue_number || 'Q0001',
                ticket: bq.queue_number || 'Q0001',
                name: bq.patient_name || 'ผู้ป่วย',
                shortName: bq.patient_name || 'ผู้ป่วย',
                gender: bq.gender || 'หญิง',
                age: bq.age || 35,
                treatmentRights: bq.scheme_type || 'บัตรทอง (สปสช.)',
                patientType: 'ผู้ป่วยนอก (OPD)' as const,
                allergies: ['ไม่มีประวัติแพ้ยา'],
                chronicDiseases: 'ไม่มี',
                vitals: 'ความดัน 120/80 mmHg, อุณหภูมิ 36.6 °C',
                visitStatus: 'รอชำระเงิน',
                status: 'pending' as const,
                visitDate: new Date(bq.created_at || Date.now()).toLocaleDateString('th-TH'),
                visitTime: new Date(bq.created_at || Date.now()).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.',
                doctorAdvice: bq.doctor_advice || 'มีไข้ ไอ เจ็บคอ แพทย์สั่งจ่ายยา',
                medications: parsedMeds
              });
            }
          });
        }

        // 3. ดึงประวัติที่ชำระเงินเสร็จสิ้นแล้วจาก Database (Completed History)
        if (Array.isArray(completedHistories) && completedHistories.length > 0) {
          completedHistories.forEach((bh: any) => {
            const bhHN = (bh.hn || '').replace(/[-]/g, '');
            const queueNo = bh.queue_number || (bh.queueNumber && bh.queueNumber.startsWith('Q') ? bh.queueNumber : '') || `Q${String(bh.id || '').padStart(4, '0')}`;
            const receiptNum = bh.receipt_number || `REC-${String(bh.id || '').padStart(4, '0')}`;

            // ตรวจสอบว่าคิวนี้มีอยู่ใน mappedQueues หรือไม่
            const existingIdx = mappedQueues.findIndex(q => {
              const qHN = (q.hn || '').replace(/[-]/g, '');
              return q.id === `BH-${bh.id}` || 
                     (bh.visit_id && q.visitId === bh.visit_id) ||
                     (bh.queue_number && (q.queueNumber === bh.queue_number || q.ticket === bh.queue_number)) ||
                     (bhHN && qHN && qHN === bhHN && bhHN !== 'HN0001');
            });

            if (existingIdx >= 0) {
              // อัปเดตให้เป็นชำระเงินแล้วแน่นอน
              mappedQueues[existingIdx] = {
                ...mappedQueues[existingIdx],
                status: 'completed',
                visitStatus: 'ชำระเงินแล้ว / เสร็จสิ้น',
                receiptNumber: receiptNum
              };
            } else {
              let parsedMeds: any[] = [];
              if (bh.medications && bh.medications !== 'null') {
                try {
                  const rawMeds = typeof bh.medications === 'string' ? JSON.parse(bh.medications) : bh.medications;
                  if (Array.isArray(rawMeds)) {
                    parsedMeds = rawMeds.map((m: any) => parseDispensedMed(m, masterMedicines));
                  }
                } catch {}
              }
              mappedQueues.push({
                id: `BH-${bh.id || bh.receipt_number || Math.random()}`,
                visitId: bh.visit_id || 1,
                hn: bhHN || 'HN0001',
                nationalId: bh.national_id || '-',
                queueNumber: queueNo,
                ticket: queueNo,
                receiptNumber: receiptNum,
                name: bh.patient_name || 'ผู้ป่วย',
                shortName: bh.patient_name || 'ผู้ป่วย',
                gender: 'ชาย',
                age: 35,
                treatmentRights: 'ชำระเงินแล้ว',
                patientType: 'ผู้ป่วยนอก (OPD)' as const,
                allergies: ['ไม่มีประวัติแพ้ยา'],
                chronicDiseases: 'ไม่มี',
                vitals: 'ความดัน 120/80 mmHg, อุณหภูมิ 36.6 °C',
                visitStatus: 'ชำระเงินแล้ว / เสร็จสิ้น',
                status: 'completed' as const,
                visitDate: new Date(bh.created_at || Date.now()).toLocaleDateString('th-TH'),
                visitTime: new Date(bh.created_at || Date.now()).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.',
                doctorAdvice: bh.doctor_advice || 'รับประทานยาตามคำแนะนำของแพทย์',
                medications: parsedMeds
              });
            }
          });
        }

        // 4. ผสานข้อมูลจาก localStorage (dispensed patients)
        const storedDispensed = getStoredDispensedPatients();
        storedDispensed.forEach(storedP => {
          const cleanStoredHN = (storedP.hn || '').replace(/[-]/g, '');
          const existingIdx = mappedQueues.findIndex(q => 
            q.id === storedP.id || 
            (q.hn.replace(/[-]/g, '') === cleanStoredHN && (q.queueNumber === storedP.queueNumber || q.ticket === storedP.ticket))
          );
          if (existingIdx >= 0) {
            if (mappedQueues[existingIdx].status !== 'completed') {
              mappedQueues[existingIdx] = {
                ...mappedQueues[existingIdx],
                visitStatus: 'รอชำระเงิน',
                dispensedAt: storedP.dispensedAt || mappedQueues[existingIdx].dispensedAt
              };
            }
          }
        });

        // 5. จัดเรียง: ผู้ป่วยที่รอชำระเงินอยู่บนสุด (pending) -> ชำระเงินแล้วอยู่ถัดมา (completed)
        mappedQueues.sort((a, b) => {
          const aComp = a.status === 'completed' || a.visitStatus?.includes('เสร็จสิ้น') || a.visitStatus?.includes('ชำระเงินแล้ว');
          const bComp = b.status === 'completed' || b.visitStatus?.includes('เสร็จสิ้น') || b.visitStatus?.includes('ชำระเงินแล้ว');
          if (aComp !== bComp) return Number(aComp) - Number(bComp);
          return (b.visitId || 0) - (a.visitId || 0);
        });

        // ถ้าไม่มีคิวจาก DB จะแสดง 0 รายการ (ไม่มี fallback mock)
        setQueueList(mappedQueues);

        setLocalPatientId(prev => {
          if (mappedQueues.length > 0) {
            if (prev && mappedQueues.find(q => q.id === prev)) {
              return prev;
            }
            const firstPending = mappedQueues.find(q => q.status !== 'completed' && !q.visitStatus?.includes('เสร็จสิ้น') && !q.visitStatus?.includes('ชำระเงินแล้ว'));
            return firstPending ? firstPending.id : mappedQueues[0].id;
          }
          return '';
        });
      } catch (err) {
        console.error('Failed to fetch initial billing queue:', err);
      } finally {
        if (isInitial && isMounted) {
          const elapsed = Date.now() - loadStartTime;
          const remaining = Math.max(0, CLINIC_ANIMATION_CONFIG.minSkeletonLoadingMs - elapsed);
          setTimeout(() => {
            if (isMounted) setIsInitialLoading(false);
          }, remaining);
        }
      }
    };
    
    fetchInitialQueue(true);

    // Smart Background Polling ทุกๆ 12 วินาที เพื่อดึงคิวการเงินล่าสุดอย่างต่อเนื่อง (Fallback คู่กับ WebSocket เรียลไทม์)
    const pollInterval = setInterval(() => {
      if (!document.hidden) {
        fetchInitialQueue(false);
      }
    }, 12000);

    const unsubBill = subscribe('BILLING_CREATED', (data: any) => {
      fetchInitialQueue();
      if (data) {
        const pName = data.patient_name || 'ผู้ป่วย';
        triggerToast(`ได้รับคิวใหม่สำหรับการเงิน: ${pName} (${data.queue_number || ''})`, 'doctor');
      }
    });

    const unsubExam = subscribe('EXAMINATION_SAVED', () => {
      fetchInitialQueue();
      triggerToast('แพทย์บันทึกการตรวจและส่งใบสั่งยาเรียบร้อยแล้ว', 'doctor');
    });

    const unsubMedQ = subscribe('MEDICINE_QUEUE_CREATED', () => {
      fetchInitialQueue();
    });

    const unsubDispense = subscribe('DISPENSE_RECORDED', () => {
      fetchInitialQueue();
    });

    const unsubDispenseConf = subscribe('DISPENSE_CONFIRMED', () => {
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

    const unsubCreated = subscribe('QUEUE_CREATED', () => {
      fetchInitialQueue();
    });

    const unsubVisit = subscribe('VISIT_UPDATED', () => {
      fetchInitialQueue();
    });

    const unsubBillHist = subscribe('BILLING_HISTORY_CREATED', () => {
      fetchInitialQueue();
    });

    const unsubPay = subscribe('PAYMENT_CONFIRMED', () => {
      fetchInitialQueue();
      triggerToast('ชำระเงินและออกใบเสร็จเรียบร้อยแล้ว', 'success');
    });

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
      unsubBill();
      unsubExam();
      unsubMedQ();
      unsubDispense();
      unsubDispenseConf();
      unsubQueue();
      unsubCreated();
      unsubVisit();
      unsubBillHist();
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
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      if (onSelectPatientId) {
        onSelectPatientId(activePatient.id);
      }
      localStorage.setItem('billing_active_patient', activePatient.id);
      localStorage.setItem('billing_active_patient_data', JSON.stringify(activePatient));
      if (onNavigateToBilling) {
        onNavigateToBilling();
      }
    }, CLINIC_ANIMATION_CONFIG.submitModalDurationMs);
  };

  const medTotal = activePatient && Array.isArray(activePatient.medications) 
    ? activePatient.medications.reduce((sum, m: any) => sum + ((Number(m?.price || m?.unit_price) || 0) * (Number(m?.quantity) || 1)), 0) 
    : 0;

  if (isInitialLoading) {
    return <BillingDispenseSkeleton />;
  }

  return (
    <div className="billing-dispense-container">

      {/* 1. Modal Popup แสดงอนิเมะชันตอนส่งต่อไปหน้าการเงิน (ตรงตามรูปภาพ 2) */}
      {isSubmitting && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '24px',
              padding: '36px 32px',
              textAlign: 'center',
              maxWidth: '380px',
              width: '90%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
              animation: 'clinicScaleInGPU 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            <div
              style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                backgroundColor: '#EFF6FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <span
                style={{
                  display: 'block',
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  border: '4px solid #BFDBFE',
                  borderTopColor: '#2563EB',
                  animation: 'clinicSpinGPU 0.85s linear infinite'
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0F172A', margin: 0 }}>
                กำลังบันทึกลงฐานข้อมูล
              </h3>
              <p style={{ fontSize: '14px', color: '#64748B', margin: 0, lineHeight: 1.5 }}>
                กรุณารอสักครู่ ระบบกำลังจัดเตรียมข้อมูลและส่งต่อไปยังห้องการเงิน
              </p>
            </div>
          </div>
        </div>
      )}

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

          {/* Executive Billing Stat Cards (Pharmacy Format) */}
          <div className="stat-cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
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
            <span style={{ fontWeight: '600', fontSize: '15px', color: '#475569' }}>คิวการเงินทั้งหมด</span>
            <div className="stat-icon-wrap icon-blue">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            </div>
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#0F172A', lineHeight: '38px' }}>{queueList.length}</div>
          <div style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>กำลังรับบริการระบบการเงิน</div>
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
            <span style={{ fontWeight: '600', fontSize: '15px', color: '#475569' }}>รอชำระเงิน & ออกบิล</span>
            <div className="stat-icon-wrap icon-amber">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 16 14"/></svg>
            </div>
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#2563EB', lineHeight: '38px' }}>
            {queueList.filter(p => p.status !== 'completed' && !p.visitStatus?.includes('เสร็จสิ้น') && !p.visitStatus?.includes('ชำระเงินแล้ว')).length}
          </div>
          <div style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>
            รอชำระเงิน {queueList.filter(p => p.status !== 'completed' && !p.visitStatus?.includes('เสร็จสิ้น') && !p.visitStatus?.includes('ชำระเงินแล้ว')).length} คิว
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
            <span style={{ fontWeight: '600', fontSize: '15px', color: '#475569' }}>ชำระเงินสำเร็จแล้ว</span>
            <div className="stat-icon-wrap icon-teal">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="6" y1="8" x2="18" y2="8"/><line x1="6" y1="12" x2="18" y2="12"/></svg>
            </div>
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#0D9488', lineHeight: '38px' }}>
            {queueList.filter(p => p.status === 'completed' || p.visitStatus?.includes('เสร็จสิ้น') || p.visitStatus?.includes('ชำระเงินแล้ว')).length}
          </div>
          <div style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>
            ส่งต่อ/ชำระเงินแล้ว {queueList.filter(p => p.status === 'completed' || p.visitStatus?.includes('เสร็จสิ้น') || p.visitStatus?.includes('ชำระเงินแล้ว')).length} คน
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
            {queueList.filter(p => p.status === 'completed' || p.visitStatus?.includes('เสร็จสิ้น') || p.visitStatus?.includes('ชำระเงินแล้ว')).length}
          </div>
          <div style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>เสร็จสิ้น • ออกใบเสร็จเรียบร้อย</div>
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
                รายชื่อผู้ป่วยที่รอชำระเงินและประวัติที่ชำระแล้ว (Billing Queue & History)
              </h3>
              <p style={{ margin: 0, fontSize: '13.5px', color: '#64748B', lineHeight: '1.4' }}>
                รายการผู้ป่วยที่บันทึกข้อมูลส่งมาจากห้องตรวจแพทย์ / ห้องยา รวมถึงประวัติที่ชำระเงินเสร็จสิ้นแล้ว
              </p>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {activePatient && (
              <span style={{ 
                background: '#DBEAFE', color: '#1E40AF', fontWeight: 'bold', 
                padding: '4px 12px', borderRadius: '16px', fontSize: '13px', border: '1px solid #93C5FD' 
              }}>
                ถึงคิวที่ {activePatient.queueNumber && activePatient.queueNumber.startsWith('Q') ? activePatient.queueNumber : (activePatient.queueNumber || 'Q0001')} ({activePatient.name})
              </span>
            )}
            <span style={{ 
              background: '#DCFCE7', color: '#166534', fontWeight: 'bold', 
              padding: '4px 12px', borderRadius: '16px', fontSize: '13px' 
            }}>
              {queueList.length} รายการ
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
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', color: '#64748B', pointerEvents: 'none' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
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
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                  ล้าง
                </button>
              )}
            </div>

            {/* Status Filter Tabs (เหมือนหน้าจัดการยา) */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setStatFilter('all')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '13px',
                  fontWeight: '700',
                  border: statFilter === 'all' ? '1.5px solid #2563EB' : '1px solid #E2E8F0',
                  background: statFilter === 'all' ? '#EFF6FF' : '#FFFFFF',
                  color: statFilter === 'all' ? '#1D4ED8' : '#64748B',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                ทั้งหมด ({queueList.length})
              </button>
              <button
                type="button"
                onClick={() => setStatFilter('pending')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '13px',
                  fontWeight: '700',
                  border: statFilter === 'pending' ? '1.5px solid #2563EB' : '1px solid #E2E8F0',
                  background: statFilter === 'pending' ? '#DBEAFE' : '#FFFFFF',
                  color: statFilter === 'pending' ? '#1E40AF' : '#64748B',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                รอชำระเงิน ({queueList.filter(p => p.status !== 'completed' && !p.visitStatus?.includes('เสร็จสิ้น') && !p.visitStatus?.includes('ชำระเงินแล้ว')).length})
              </button>
              <button
                type="button"
                onClick={() => setStatFilter('completed')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '13px',
                  fontWeight: '700',
                  border: statFilter === 'completed' ? '1.5px solid #16A34A' : '1px solid #E2E8F0',
                  background: statFilter === 'completed' ? '#DCFCE7' : '#FFFFFF',
                  color: statFilter === 'completed' ? '#166534' : '#64748B',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                ชำระเงินแล้ว ({queueList.filter(p => p.status === 'completed' || p.visitStatus?.includes('เสร็จสิ้น') || p.visitStatus?.includes('ชำระเงินแล้ว')).length})
              </button>
            </div>

            {/* Patients Table with Scrollable Container (แสดง 5 แถวแรกพอดี และเลื่อนลงมาดูที่เหลือได้) */}
            <div 
              className="billing-queue-scroll-container"
              style={{ 
                overflowX: 'auto', 
                overflowY: 'auto', 
                maxHeight: '340px', 
                border: '1px solid #E2E8F0', 
                borderRadius: '10px',
                marginTop: '4px'
              }}
            >
              <table style={{ width: '100%', minWidth: '960px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#F8FAFC' }}>
                  <tr style={{ color: '#0F172A', background: '#F8FAFC', borderBottom: '2px solid #E2E8F0', height: '46px', whiteSpace: 'nowrap' }}>
                    <th style={{ padding: '12px 10px', fontWeight: '700', fontSize: '13.5px', textAlign: 'center', width: '90px' }}>ลำดับคิว</th>
                    <th style={{ padding: '12px 10px', fontWeight: '700', fontSize: '13.5px', textAlign: 'center', width: '110px' }}>HN</th>
                    <th style={{ padding: '12px 14px', fontWeight: '700', fontSize: '13.5px', textAlign: 'left', minWidth: '190px' }}>ชื่อ-นามสกุล คนไข้</th>
                    <th style={{ padding: '12px 10px', fontWeight: '700', fontSize: '13.5px', textAlign: 'center', width: '150px' }}>เลขบัตรประชาชน</th>
                    <th style={{ padding: '12px 10px', fontWeight: '700', fontSize: '13.5px', textAlign: 'center', width: '125px' }}>สถานะคิว</th>
                    <th style={{ padding: '12px 10px', fontWeight: '700', fontSize: '13.5px', textAlign: 'center', width: '160px' }}>สิทธิการรักษา</th>
                    <th style={{ padding: '12px 12px', fontWeight: '700', fontSize: '13.5px', textAlign: 'center', width: '140px' }}>การดำเนินการ</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQueue.length > 0 ? (
                    filteredQueue.map((p, index) => {
                      const isCompleted = p.status === 'completed' || p.visitStatus?.includes('เสร็จสิ้น') || p.visitStatus?.includes('ชำระเงินแล้ว');
                      const isSelected = localPatientId === p.id;
                      return (
                        <tr 
                          key={p.id + '_' + index}
                          className={isSelected ? 'active-row' : ''}
                          style={{ 
                            borderBottom: '1px solid #F1F5F9', 
                            whiteSpace: 'nowrap',
                            background: isSelected ? '#EFF6FF' : (isCompleted ? '#F8FAFC' : undefined),
                            transition: 'background 0.15s ease'
                          }}
                        >
                          <td style={{ padding: '10px 10px', whiteSpace: 'nowrap', textAlign: 'center' }}>
                            <span style={{ 
                              color: isCompleted ? '#64748B' : '#2563EB', 
                              fontWeight: '700', 
                              fontSize: '14px',
                              fontFamily: 'monospace',
                              whiteSpace: 'nowrap', 
                              display: 'inline-block'
                            }}>
                              {p.queueNumber && p.queueNumber.startsWith('Q') ? p.queueNumber : (p.queueNumber || `Q${String(index + 1).padStart(4, '0')}`)}
                            </span>
                          </td>
                          <td style={{ padding: '10px 10px', whiteSpace: 'nowrap', textAlign: 'center' }}>
                            <CopyableText value={(p.hn || '').replace(/[-]/g, '')} color={isCompleted ? '#64748B' : '#2563EB'} />
                          </td>
                          <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', textAlign: 'left' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: '700', color: '#0F172A', whiteSpace: 'nowrap' }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isCompleted ? '#64748B' : '#2563EB'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                                <circle cx="12" cy="7" r="4"/>
                              </svg>
                              {p.name}
                            </div>
                          </td>
                          <td className="patient-table-sub" style={{ padding: '10px 10px', fontFamily: 'monospace', fontSize: '13px', whiteSpace: 'nowrap', textAlign: 'center', color: isCompleted ? '#94A3B8' : '#64748B' }}>
                            {p.nationalId || '-'}
                          </td>
                          <td style={{ padding: '10px 10px', whiteSpace: 'nowrap', textAlign: 'center' }}>
                            <span style={{ 
                              background: isCompleted ? '#F0FDF4' : '#DBEAFE',
                              color: isCompleted ? '#15803D' : '#1E40AF',
                              border: `1.5px solid ${isCompleted ? '#86EFAC' : '#93C5FD'}`,
                              padding: '4px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: '700',
                              whiteSpace: 'nowrap', display: 'inline-flex', justifyContent: 'center', alignItems: 'center'
                            }}>
                              {isCompleted ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                  </svg>
                                  ชำระเงินแล้ว
                                </span>
                              ) : (
                                'รอชำระเงิน'
                              )}
                            </span>
                          </td>
                          <td style={{ padding: '10px 10px', whiteSpace: 'nowrap', textAlign: 'center' }}>
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
                                    background: bg,
                                    color: color,
                                    border: `1.5px solid ${border}`,
                                    padding: '4px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: '700',
                                    whiteSpace: 'nowrap', display: 'inline-flex', justifyContent: 'center', alignItems: 'center',
                                    minWidth: '100px'
                                  }}
                                >
                                  {label}
                                </span>
                              );
                            })()}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            {isCompleted ? (
                              <button 
                                type="button"
                                onClick={() => {
                                  handleSelectPatient(p.id);
                                  localStorage.setItem('billing_active_patient_data', JSON.stringify(p));
                                  if (onNavigateToBilling) {
                                    onNavigateToBilling();
                                  }
                                }}
                                style={{ 
                                  padding: '6px 14px', 
                                  background: isSelected ? '#0D9488' : '#F0FDFA', 
                                  color: isSelected ? '#FFFFFF' : '#0F766E', 
                                  border: '1.5px solid #99F6E4', 
                                  borderRadius: '8px', 
                                  cursor: 'pointer', 
                                  fontWeight: '700', 
                                  fontSize: '12.5px',
                                  display: 'inline-flex', 
                                  alignItems: 'center', 
                                  justifyContent: 'center', 
                                  gap: '5px',
                                  whiteSpace: 'nowrap',
                                  boxShadow: isSelected ? '0 2px 4px rgba(13, 148, 136, 0.25)' : 'none',
                                  transition: 'all 0.15s ease'
                                }}
                                title="ดูรายละเอียดใบเสร็จและรายการที่ชำระแล้ว"
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                                ดูใบเสร็จ
                              </button>
                            ) : (
                              <button 
                                type="button"
                                onClick={() => {
                                  handleSelectPatient(p.id);
                                  localStorage.setItem('billing_active_patient_data', JSON.stringify(p));
                                }}
                                style={{ 
                                  padding: '6px 14px', 
                                  background: isSelected ? '#10B981' : '#2563EB', 
                                  color: 'white', 
                                  border: 'none', 
                                  borderRadius: '8px', 
                                  cursor: 'pointer', 
                                  fontWeight: '700', 
                                  fontSize: '12.5px',
                                  display: 'inline-flex', 
                                  alignItems: 'center', 
                                  justifyContent: 'center', 
                                  gap: '5px',
                                  whiteSpace: 'nowrap',
                                  boxShadow: isSelected ? '0 2px 6px rgba(16, 185, 129, 0.25)' : '0 2px 6px rgba(37, 99, 235, 0.25)',
                                  transition: 'all 0.15s ease'
                                }}
                                title="เลือกคนไข้นี้เพื่อคิดเงินและออกบิล"
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
                                </svg>
                                {isSelected ? 'เลือกอยู่' : 'เลือกคิว'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#64748B', background: '#F8FAFC' }}>
                        ไม่พบข้อมูลผู้ป่วยที่ตรงกับเงื่อนไขการค้นหา
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', fontSize: '13px', color: '#64748B' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <line x1="3" y1="9" x2="21" y2="9"/>
                  <line x1="9" y1="21" x2="9" y2="9"/>
                </svg>
                {filteredQueue.length > 0 
                  ? `แสดง ${filteredQueue.length} รายการ (เลื่อนขึ้น-ลงเพื่อดูคิวทั้งหมด)`
                  : 'ไม่มีข้อมูลแสดงผล'
                }
              </span>
            </div>
          </div>
        )}
      </div>

      {activePatient ? (
        <div className="searched-details-wrapper" style={{ marginBottom: '20px' }}>
          <section className="patient-card">
            <div className="patient-card-main">
              <div className="patient-avatar">{activePatient.shortName ? activePatient.shortName.charAt(0) : activePatient.name.charAt(0)}</div>
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
                      {activePatient.queueNumber && activePatient.queueNumber.startsWith('Q') ? activePatient.queueNumber : (activePatient.ticket || 'Q0001')}
                    </span>
                    <span style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      background: '#DBEAFE', 
                      border: '1.5px solid #93C5FD', 
                      padding: '3px 8px', 
                      borderRadius: '8px' 
                    }}>
                      <CopyableText label="HN" value={(activePatient.hn || '').replace(/[-]/g, '')} color="#1E40AF" />
                    </span>
                    {(activePatient.status === 'completed' || activePatient.visitStatus?.includes('เสร็จสิ้น') || activePatient.visitStatus?.includes('ชำระเงินแล้ว')) && (
                      <span style={{ background: '#DCFCE7', color: '#15803D', border: '1.5px solid #86EFAC', padding: '4px 10px', borderRadius: '8px', fontSize: '12.5px', fontWeight: '700' }}>
                        ✓ ชำระเงินแล้ว
                      </span>
                    )}
                  </div>
                </div>
                <div className="patient-details" style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center', fontSize: '0.95rem' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#1E293B', fontWeight: '600' }}>
                    <span style={{ color: '#64748B', fontWeight: '500' }}>เพศ:</span> {activePatient.gender || 'ชาย'}
                  </span>
                  <span style={{ color: '#CBD5E1' }}>•</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#1E293B', fontWeight: '600' }}>
                    <span style={{ color: '#64748B', fontWeight: '500' }}>อายุ:</span> {activePatient.age || 35} ปี
                  </span>
                  <span style={{ color: '#CBD5E1' }}>•</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#1E293B', fontWeight: '600' }}>
                    <span style={{ color: '#64748B', fontWeight: '500' }}>เบอร์โทร:</span> {activePatient.phone || '081-999-8888'}
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
                  {activePatient.visitDate || 'วันนี้'} ({activePatient.visitTime || '08:45 น.'})
                </span>
              </div>
              <div className="info-box">
                <span className="info-label" style={{ fontSize: '11.5px', fontWeight: '700', color: '#475569' }}>
                  ประวัติแพ้ยา (KNOWN ALLERGIES)
                </span>
                <div className="badge-wrapper">
                  {(activePatient.allergies || ['ไม่มีประวัติแพ้ยา']).map((a, i) => {
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
                  สถานะการเงิน (BILLING STATUS)
                </span>
                <div className="badge-wrapper">
                  <span style={{
                    background: (activePatient.status === 'completed' || activePatient.visitStatus?.includes('เสร็จสิ้น') || activePatient.visitStatus?.includes('ชำระเงินแล้ว')) ? '#DCFCE7' : '#DBEAFE',
                    color: (activePatient.status === 'completed' || activePatient.visitStatus?.includes('เสร็จสิ้น') || activePatient.visitStatus?.includes('ชำระเงินแล้ว')) ? '#15803D' : '#1E40AF',
                    border: `1.5px solid ${(activePatient.status === 'completed' || activePatient.visitStatus?.includes('เสร็จสิ้น') || activePatient.visitStatus?.includes('ชำระเงินแล้ว')) ? '#86EFAC' : '#93C5FD'}`,
                    fontWeight: '700',
                    padding: '4px 12px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    display: 'inline-flex',
                    alignItems: 'center'
                  }}>
                    {activePatient.visitStatus || 'รอรับยา / ชำระเงิน'}
                  </span>
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : null}

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
                  title={copiedHn === (activePatient.hn || '').replace(/[-]/g, '') ? 'คัดลอกแล้ว!' : 'คลิกเพื่อคัดลอก HN'}
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
                    {(activePatient.hn || '').replace(/[-]/g, '')}
                  </span>
                  {copiedHn === (activePatient.hn || '').replace(/[-]/g, '') ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  )}
                  {copiedHn === (activePatient.hn || '').replace(/[-]/g, '') && (
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
                value={(() => {
                  const r = currentRights || activePatient?.treatmentRights || '';
                  if (r.includes('30') || r.includes('บัตรทอง') || r.includes('สปสช')) return 'สิทธิ 30 บาท (บัตรทอง / สปสช.)';
                  if (r.includes('ประกันสังคม')) return 'สิทธิประกันสังคม (Social Security)';
                  if (r.includes('ข้าราชการ') || r.includes('กรมบัญชีกลาง')) return 'สิทธิข้าราชการ / จ่ายตรงกรมบัญชีกลาง';
                  if (r.includes('ประกันสุขภาพ') || r.includes('เอกชน')) return 'ประกันสุขภาพเอกชน (Private Insurance)';
                  if (r.includes('ชำระเงินเอง') || r.includes('เงินสด') || r.includes('จ่ายตรง')) return 'จ่ายตรง / เงินสด (Self Pay / Cash)';
                  return r || 'สิทธิ 30 บาท (บัตรทอง / สปสช.)';
                })()}
                onChange={(e) => {
                  const newRights = e.target.value;
                  if (activePatient) {
                    if (onUpdatePatientRights) {
                      onUpdatePatientRights(activePatient.id, newRights);
                    }
                    // อัปเดตข้อมูลใน queueList ท้องถิ่นทันที
                    setQueueList(prev => prev.map(q => q.id === activePatient.id ? { ...q, treatmentRights: newRights } : q));
                  }
                }}
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

            {activePatient && (activePatient.status === 'completed' || activePatient.visitStatus?.includes('เสร็จสิ้น') || activePatient.visitStatus?.includes('ชำระเงินแล้ว')) ? (
              <button 
                className="submit-billing-btn" 
                onClick={handleProceedToInvoice}
                style={{ background: '#10B981', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)' }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                </svg>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: '1.3' }}>
                  <span style={{ fontSize: '1rem', fontWeight: '800' }}>ดูใบเสร็จรับเงิน & พิมพ์เอกสาร</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: '500', opacity: 0.95 }}>
                    (View & Print Official Receipt)
                  </span>
                </div>
              </button>
            ) : (
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
            )}
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
            {toast.type === 'success' && (
              <span className="toast-icon-circle">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </span>
            )}
            {toast.type === 'doctor' && (
              <span className="toast-icon-circle">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                </svg>
              </span>
            )}
            {toast.type === 'error' && (
              <span className="toast-icon-circle">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </span>
            )}
          </div>
          <div className="toast-message" style={{ fontWeight: '600', color: '#0F172A' }}>{toast.message}</div>
        </div>
      )}
    </div>
  );
}
