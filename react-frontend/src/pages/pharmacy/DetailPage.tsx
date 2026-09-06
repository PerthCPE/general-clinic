import { useState, useEffect, useCallback } from 'react';
import './DetailPage.css';
import { CLINIC_CONFIG, type PatientConfig } from '../../config/clinicConfig';
import { useWebSocket } from '../../context/WebSocketContext';
import CopyableText from '../../components/Common/CopyableText';
import { Check, Plus, Minus, Loader2, Search, RefreshCw } from 'lucide-react';
import { PharmacyDetailSkeleton } from '../../components/Common/ClinicSkeleton';
import { ClinicModalPortal, ClinicActionLoadingModal } from '../../components/Common/ClinicModalPortal';
import { CLINIC_ANIMATION_CONFIG } from '../../config/animationConfig';
import { API_BASE_URL } from '../../services/api';
import { playNotificationDingDong } from '../../utils/audioQueue';

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

const cleanDosage = (d?: string, medName?: string): string => {
  if (!d || d.includes('?') || d.includes('เม็ดเม็ด')) {
    const n = (medName || '').toLowerCase();
    if (n.includes('amoxicillin')) return 'ครั้งละ 1 แคปซูล วันละ 3 ครั้ง หลังอาหาร';
    if (n.includes('paracetamol')) return 'ครั้งละ 1-2 เม็ด ทุก 4-6 ชม.';
    return 'ครั้งละ 1 เม็ด วันละ 3 ครั้ง หลังอาหาร';
  }
  return d;
};

const cleanInstructions = (inst?: string, medName?: string): string => {
  if (!inst || inst.includes('?') || inst.includes('เม็ดเม็ด')) {
    const n = (medName || '').toLowerCase();
    if (n.includes('amoxicillin')) return 'ควรรับประทานติดต่อกันจนยาหมดตามแพทย์สั่งอย่างเคร่งครัด';
    if (n.includes('paracetamol')) return 'รับประทานเมื่อมีอาการปวดหรือมีไข้ ไม่ควรเกินวันละ 8 เม็ด';
    return 'รับประทานหลังอาหาร เช้า กลางวัน เย็น ดื่มน้ำตามมากๆ';
  }
  return inst;
};

const cleanDoctorAdvice = (adv?: string): string => {
  if (!adv || adv.includes('?') || adv.includes('เม็ดเม็ด')) {
    return 'พักผ่อนให้เพียงพอ ดื่มน้ำมากๆ รับประทานยาตามที่แพทย์สั่งอย่างเคร่งครัด หากอาการไม่ดีขึ้นให้กลับมาพบแพทย์';
  }
  return adv;
};

const cleanAllergies = (all?: string[] | string): string[] => {
  if (!all) return ['ไม่มีประวัติแพ้ยา'];
  const arr = Array.isArray(all) ? all : [all];
  const cleaned = arr.map(a => (!a || a.includes('?')) ? 'ไม่มีประวัติแพ้ยา' : a);
  return cleaned.length > 0 ? cleaned : ['ไม่มีประวัติแพ้ยา'];
};

const cleanChronicDiseases = (cd?: string): string => {
  if (!cd || cd.includes('?')) return 'ไม่มี';
  return cd;
};

const defaultNameMap: Record<string, string> = {
  '1': 'นายสมชาย ใจดี',
  '2': 'นางสมศรี มีสุข',
  '3': 'นายสมศักดิ์ รักสงบ',
  '4': 'นางสาวมานี มีแชร์',
  '5': 'นายชูใจ ใฝ่ดี',
  '6': 'นางปิติ สุขสมบัติ',
  '7': 'นายวีระ กล้าหาญ',
  '8': 'นางสาวดวงใจ มีทรัพย์',
  '9': 'นายประสิทธิ์ พูนผล',
  '10': 'นางสมพร รัตนากร',
  '11': 'นายกิตติคุณ ดำรงเกียรติ',
  '12': 'นางสาวนภาพร เพ็ญประภา',
  '13': 'นายธีรภัทร เจริญสุข',
  '14': 'นางวรรณภา สิริวัฒน์',
  '15': 'นายณัฐพงษ์ ยอดมนุษย์',
  '16': 'นางสาวศศิธร ศรีสุข',
  '17': 'นายธนกฤต มั่งคั่ง',
  '18': 'นางศิริพร บุญรักษา',
  '19': 'นายวรวุฒิ สิทธิชัย',
  '20': 'นางสาวรัตนาวลัย พิมานรัตน์'
};

const cleanPatientName = (name?: string, hn?: string): string => {
  let pName = (name || '').trim();
  const cleanDigits = (hn || '').replace(/\D/g, '').replace(/^0+/, '');
  if (!pName || pName.includes('?') || pName === 'ผู้ป่วย' || pName === '????') {
    if (cleanDigits && defaultNameMap[cleanDigits]) {
      return defaultNameMap[cleanDigits];
    }
    return 'ผู้ป่วยทั่วไป';
  }
  return pName || 'ผู้ป่วย';
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

  // สถานะการโหลดข้อมูลเริ่มต้นจากฐานข้อมูล (แสดงอนิเมะชันโหลดข้อมูล)
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // สถานะกำลังส่งข้อมูลไปยังห้องการเงิน (แสดงอนิเมะชันบันทึกลงฐานข้อมูล)
  const [isSubmitting, setIsSubmitting] = useState(false);
  
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

  const [isRefreshing, setIsRefreshing] = useState(false);

  // ฟังก์ชันดึงข้อมูลคิวห้องยาจากเซิร์ฟเวอร์แบบ Real-time รองรับการส่งพารามิเตอร์ค้นหา (q)
  const fetchQueues = useCallback(async (isInitial = false, query = '') => {
    const loadStartTime = Date.now();
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('clinic_auth_token');
      const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};
      const qParam = query ? `?q=${encodeURIComponent(query)}` : '';

      // ดึงทั้งคิวห้องยา และประวัติการเงิน (Billing History) แบบ Parallel เพื่อประสิทธิภาพสูงสุด
      const [pRes, bRes] = await Promise.all([
        fetch(`${API_BASE_URL}/pharmacy/queues${qParam}`, { headers })
          .then(r => r.ok ? r : fetch(`/api/pharmacy/queues${qParam}`, { headers }))
          .then(r => r.ok ? r : fetch(`/api/system/pharmacy/queues${qParam}`))
          .catch(() => null),
        fetch(`${API_BASE_URL}/billing/history`, { headers })
          .then(r => r.ok ? r : fetch('/api/billing/history', { headers }))
          .then(r => r.ok ? r : fetch('/api/system/billing/history'))
          .catch(() => null)
      ]);

      let completedHistories: any[] = [];
      if (bRes && bRes.ok) {
        try {
          const bData = await bRes.json();
          if (bData.status === 'success' && Array.isArray(bData.histories)) {
            completedHistories = bData.histories;
          }
        } catch {}
      }

      if (pRes && pRes.ok) {
        const pData = await pRes.json();
        if (pData.status === 'success' && Array.isArray(pData.queues)) {
          const mappedQueues: PatientConfig[] = pData.queues.map((pq: any) => {
            const cleanHN = (pq.hn || pq.patient?.hn || '').replace(/[-]/g, '');
            let rawMeds = pq.medications || [];
            if (typeof rawMeds === 'string') {
              try { rawMeds = JSON.parse(rawMeds); } catch { rawMeds = []; }
            }

            // ตรวจสอบว่าผู้ป่วยชำระเงินเสร็จสิ้นแล้วหรือไม่ (จาก billing history หรือ status ตรงๆ)
            const isPaid = completedHistories.some((bh: any) => {
              const bhHN = (bh.hn || '').replace(/[-]/g, '');
              return (bhHN && bhHN === cleanHN) || (bh.visit_id && pq.visit_id && bh.visit_id === pq.visit_id);
            });
            const isCompleted = pq.status === 'completed' || pq.status === 'เสร็จสิ้น' || isPaid;
            const isDispensed = isCompleted || pq.status === 'dispensed';

            return {
              id: String(pq.id),
              visitId: pq.visit_id || 1,
              hn: cleanHN || `HN0001`,
              vn: pq.vn || '-',
              nationalId: pq.national_id || '',
              queueNumber: pq.queue_number || 'Q0001',
              ticket: pq.queue_number || 'A-01',
              name: cleanPatientName(pq.patient_name, cleanHN),
              shortName: cleanPatientName(pq.patient_name, cleanHN),
              gender: pq.gender || 'ชาย',
              age: pq.age || 35,
              treatmentRights: pq.scheme_type || 'สิทธิ 30 บาท (สปสช.)',
              patientType: 'ผู้ป่วยนอก (OPD)' as const,
              allergies: cleanAllergies(pq.allergies ? [pq.allergies] : ['ไม่มีประวัติแพ้ยา']),
              chronicDiseases: cleanChronicDiseases(pq.chronic_diseases || 'ไม่มี'),
              vitals: 'ความดัน 120/80 mmHg, อุณหภูมิ 36.6 °C',
              visitStatus: isCompleted ? 'เสร็จสิ้นกระบวนการ / รับยาเรียบร้อย' : (isDispensed ? 'จ่ายยาแล้ว / ส่งการเงินแล้ว' : 'รอรับยา / ชำระเงิน'),
              status: (isCompleted ? 'completed' : (isDispensed ? 'dispensed' : 'pending')) as 'pending' | 'dispensed' | 'completed',
              visitDate: new Date(pq.created_at || Date.now()).toLocaleDateString('th-TH'),
              visitTime: new Date(pq.created_at || Date.now()).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.',
              createdAt: pq.created_at,
              doctorAdvice: cleanDoctorAdvice(pq.doctor_advice),
              medications: rawMeds.map((m: any) => ({
                medId: m.medId || m.medicine_code || 'MED-001',
                name: m.name || m.medicine_name || 'ยาตามแพทย์สั่ง',
                dosage: cleanDosage(m.dosage, m.name),
                instructions: cleanInstructions(m.instructions, m.name),
                stock: m.stock || m.stock_quantity || 100,
                stockStatus: (m.stock || m.stock_quantity || 100) > 10 ? ('in-stock' as const) : ('low-stock' as const),
                quantity: m.quantity && m.quantity > 0 ? m.quantity : 10,
                price: m.price && m.price > 0 ? m.price : (m.unit_price || 15),
                unit_price: m.unit_price && m.unit_price > 0 ? m.unit_price : (m.price || 15),
                properties: m.properties || 'บรรเทาอาการตามแพทย์สั่ง'
              }))
            };
          });

          // นำประวัติคนไข้ที่ชำระเงินเสร็จสิ้นแล้วจาก Billing History มาเติม (Merge) เพื่อให้ตัวเลขเสร็จสิ้นถูกต้องเสมอ
          if (!query) {
            completedHistories.forEach((bh: any) => {
              const bhHN = (bh.hn || '').replace(/[-]/g, '');
              const already = mappedQueues.some(q => q.hn.replace(/[-]/g, '') === bhHN || (bh.visit_id && q.visitId === bh.visit_id));
              if (!already) {
                let parsedMeds: any[] = [];
                if (bh.medications) {
                  try { parsedMeds = typeof bh.medications === 'string' ? JSON.parse(bh.medications) : bh.medications; } catch {}
                }
                mappedQueues.push({
                  id: `BH-${bh.id || bh.receipt_number}`,
                  visitId: bh.visit_id || 1,
                  hn: bhHN || 'HN0001',
                  nationalId: bh.national_id || '',
                  queueNumber: bh.receipt_number || 'Q0000',
                  ticket: 'A-00',
                  name: cleanPatientName(bh.patient_name, bhHN),
                  shortName: cleanPatientName(bh.patient_name, bhHN),
                  gender: 'ชาย',
                  age: 35,
                  treatmentRights: 'ชำระเงินแล้ว',
                  patientType: 'ผู้ป่วยนอก (OPD)',
                  allergies: cleanAllergies(bh.allergies ? [bh.allergies] : ['ไม่มีประวัติแพ้ยา']),
                  chronicDiseases: cleanChronicDiseases(bh.chronic_diseases || 'ไม่มี'),
                  vitals: 'ความดันปกติ',
                  visitStatus: 'เสร็จสิ้นกระบวนการ / รับยาเรียบร้อย',
                  status: 'completed' as any,
                  visitDate: new Date(bh.created_at || Date.now()).toLocaleDateString('th-TH'),
                  visitTime: new Date(bh.created_at || Date.now()).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.',
                  doctorAdvice: cleanDoctorAdvice(bh.doctor_advice),
                  medications: parsedMeds.map((m: any) => ({
                    medId: m.medId || m.medicine_code || 'MED-001',
                    name: m.name || m.medicine_name || 'ยาตามแพทย์สั่ง',
                    dosage: cleanDosage(m.dosage, m.name || m.medicine_name),
                    instructions: cleanInstructions(m.instructions, m.name || m.medicine_name),
                    stock: 100,
                    stockStatus: 'in-stock',
                    quantity: m.quantity || 1,
                    price: m.price || m.unit_price || 0,
                    unit_price: m.unit_price || m.price || 0,
                    properties: m.properties || 'บรรเทาอาการตามแพทย์สั่ง'
                  }))
                });
              }
            });
          }

          // นำประวัติคนไข้ที่ส่งการเงินแล้วจาก localStorage มาผสาน (Merge) เฉพาะเมื่อมีรายการบนเซิร์ฟเวอร์
          if (mappedQueues.length > 0) {
            const storedDispensed = getStoredDispensedPatients();
            storedDispensed.forEach(storedP => {
              const cleanStoredHN = (storedP.hn || '').replace(/[-]/g, '');
              const existingIdx = mappedQueues.findIndex(q => q.id === storedP.id || (q.hn.replace(/[-]/g, '') === cleanStoredHN && q.queueNumber === storedP.queueNumber));
              if (existingIdx >= 0) {
                // สำคัญ: หากสถานะบนเซิร์ฟเวอร์ยังเป็น pending (เช่น มีคำสั่งยาใหม่จากแพทย์) จะไม่ถูกเขียนทับด้วย dispensed
                if (mappedQueues[existingIdx].status === 'pending') return;
                if (storedP.status === 'dispensed' && mappedQueues[existingIdx].status !== 'completed') {
                  mappedQueues[existingIdx] = {
                    ...mappedQueues[existingIdx],
                    status: 'dispensed',
                    visitStatus: 'จ่ายยาแล้ว / ส่งการเงินแล้ว',
                    dispensedAt: storedP.dispensedAt || mappedQueues[existingIdx].dispensedAt
                  };
                }
              }
            });
          } else if (!query) {
            // เมื่อฐานข้อมูลว่างเปล่า (เช่น หลังกดรีเซ็ตระบบ) ให้ล้างแคช LocalStorage ทันที
            try { localStorage.removeItem(DISPENSED_LOGS_STORAGE_KEY); } catch {}
          }

          // จัดเรียง: ผู้ป่วยที่รอจัดยาอยู่บนสุด (pending) -> จ่ายยาแล้ว (dispensed) -> เสร็จสิ้นกระบวนการ (completed)
          mappedQueues.sort((a, b) => {
            const score = (p: PatientConfig) => (p.status === 'pending' ? 0 : (p.status === 'dispensed' ? 1 : 2));
            return score(a) - score(b);
          });

          setQueueList(mappedQueues);
          setLocalPatientId(prev => {
            if (mappedQueues.length > 0) {
              if (prev && mappedQueues.find(q => q.id === prev)) {
                return prev;
              }
              const firstPending = mappedQueues.find(q => q.status === 'pending');
              return firstPending ? firstPending.id : mappedQueues[0].id;
            }
            return '';
          });
        }
      }
    } catch (err) {
      console.error('Failed to fetch queues:', err);
    } finally {
      if (isInitial) {
        const elapsed = Date.now() - loadStartTime;
        const remaining = Math.max(0, CLINIC_ANIMATION_CONFIG.minSkeletonLoadingMs - elapsed);
        setTimeout(() => {
          setIsInitialLoading(false);
        }, remaining);
      }
      setIsRefreshing(false);
    }
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchQueues(false, patientIdInput.trim());
    triggerToast('อัปเดตข้อมูลคิวห้องยาล่าสุดเรียบร้อย', 'success');
  };

  const handleSearch = async () => {
    setIsRefreshing(true);
    await fetchQueues(false, patientIdInput.trim());
  };

  // Real-time Queue Listener จากระบบแพทย์
  useEffect(() => {
    let isMounted = true;

    fetchQueues(true);

    // Smart Background Polling ทุกๆ 12 วินาที เพื่อดึงคิวล่าสุดอย่างต่อเนื่อง (Fallback คู่กับ WebSocket เรียลไทม์)
    const pollInterval = setInterval(() => {
      if (!document.hidden && isMounted) {
        fetchQueues(false);
      }
    }, 12000);

    const unsubQueue = subscribe('QUEUE_UPDATED', (data: any) => {
      if (data && data.action === 'db_reset') {
        try { localStorage.removeItem(DISPENSED_LOGS_STORAGE_KEY); } catch {}
        setQueueList([]);
      } else {
        fetchQueues();
      }
    });

    const unsubReset = subscribe('SYSTEM_RESET', () => {
      try { localStorage.removeItem(DISPENSED_LOGS_STORAGE_KEY); } catch {}
      setQueueList([]);
    });

    const unsubPay = subscribe('PAYMENT_CONFIRMED', () => {
      fetchQueues();
      triggerToast('ชำระเงินเรียบร้อยแล้ว', 'success');
    });

    const unsubBillHist = subscribe('BILLING_HISTORY_CREATED', () => {
      fetchQueues();
    });

    const unsubExam = subscribe('EXAMINATION_SAVED', (data: any) => {
      fetchQueues();
      triggerToast('แพทย์ส่งใบสั่งยาเรียบร้อยแล้ว', 'doctor');
      playNotificationDingDong('มีผู้ป่วยใหม่ ส่งมาที่ห้องยาค่ะ');
    });

    const unsubVisit = subscribe('VISIT_UPDATED', () => {
      fetchQueues();
    });

    const unsubCreated = subscribe('QUEUE_CREATED', (data: any) => {
      if (data) {
        const rawName = data.patient?.full_name || data.patient_name;
        const pName = cleanPatientName(rawName, data.hn || data.patient?.hn) || `ผู้ป่วยคิว ${data.queue_number || ''}`;
        fetchQueues();
        triggerToast(`ได้รับใบสั่งยา: ${pName}`, 'doctor');
        playNotificationDingDong('มีผู้ป่วยใหม่ ส่งมาที่ห้องยาค่ะ');
      }
    });

    const unsubMedQ = subscribe('MEDICINE_QUEUE_CREATED', () => {
      fetchQueues();
      triggerToast('ได้รับใบสั่งยาเรียบร้อยแล้ว', 'doctor');
      playNotificationDingDong('มีผู้ป่วยใหม่ ส่งมาที่ห้องยาค่ะ');
    });

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
      unsubQueue();
      unsubReset();
      unsubPay();
      unsubBillHist();
      unsubExam();
      unsubVisit();
      unsubCreated();
      unsubMedQ();
    };
  }, [subscribe, fetchQueues]);

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
                  const medName = m.name || item.name || 'ยาบรรเทาอาการ';
                  return {
                    medId: m.medicine_code || m.code || `MED-${item.medicine_id || 1}`,
                    name: medName,
                    genericName: m.generic_name || '',
                    category: m.category || 'ยาสามัญ',
                    properties: m.properties || 'ยาบรรเทาอาการตามแพทย์สั่ง',
                    dosage: cleanDosage(item.dosage, medName),
                    instructions: cleanInstructions(item.instructions, medName),
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
                  const medName = m.name || item.name || 'ยาบรรเทาอาการ';
                  return {
                    medId: m.medicine_code || m.code || `MED-${item.medicine_id || 1}`,
                    name: medName,
                    genericName: m.generic_name || '',
                    category: m.category || 'ยาสามัญ',
                    properties: m.properties || 'ยาบรรเทาอาการตามแพทย์สั่ง',
                    dosage: cleanDosage(item.dosage, medName),
                    instructions: cleanInstructions(item.instructions, medName),
                    price: m.unit_price || m.price || 10,
                    unit_price: m.unit_price || m.price || 10,
                    quantity: item.quantity || 10,
                    stock: m.stock_quantity || 100,
                    stockStatus: (m.stock_quantity || 100) > 10 ? 'พร้อมจ่าย' : 'ใกล้หมด'
                  };
                });
                setQueueList(prev => prev.map(q => q.id === activePatient.id ? { ...q, medications: fetchedMeds, doctorAdvice: cleanDoctorAdvice(hnData.doctor_advice || q.doctorAdvice) } : q));
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





  // [บุญให้เพิ่มเทคนิคนี้] ⚡ (Supabase + Optimistic UI + WebSocket) - กดยืนยันจ่ายยาแล้วอัปเดตหน้าจอทันทีใน 0 ms และส่งขึ้น Supabase เบื้องหลัง
  const handleSendToBilling = async () => {
    if (!activePatient) return;
    setIsSubmitting(true);
    const submitStart = Date.now();
    const pName = activePatient.name;
    const vId = activePatient.visitId || 0; // ส่ง 0 เพื่อให้ backend สร้าง VisitRecord ใหม่หากยังไม่มี

    // 1. ⚡ Optimistic UI: อัปเดตสถานะในหน้าจอทันทีใน 0 ms โดยไม่ต้องรอ Network Round-trip จาก Supabase
    const dispensedPatient: PatientConfig = {
      ...activePatient,
      status: 'dispensed' as const,
      visitStatus: 'จ่ายยาแล้ว / ส่งการเงินแล้ว',
      dispensedAt: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.'
    };

    persistDispensedPatient(dispensedPatient);

    setQueueList(prev => {
      const updated = prev.map(p => p.id === activePatient.id ? dispensedPatient : p);
      return [...updated].sort((a, b) => Number(a.status === 'dispensed') - Number(b.status === 'dispensed'));
    });

    triggerToast(`จัดเก็บเอกสารเข้าแฟ้มเรียบร้อยแล้ว`, 'success');

    // เลื่อนหน้าจอกลับขึ้นไปบนสุดอัตโนมัติ
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      document.querySelector('.detail-page-container')?.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);

    // สลับไปยังผู้ป่วยคนถัดไปที่ยังรอจัดยา (ถ้ามี)
    const nextPending = queueList.find(p => p.id !== activePatient.id && p.status !== 'dispensed');
    if (nextPending) {
      setLocalPatientId(nextPending.id);
      if (onSelectPatientId) onSelectPatientId(nextPending.id);
    } else {
      setLocalPatientId(activePatient.id);
    }

    // 2. 🌐 ส่งข้อมูลขึ้น Supabase Cloud เบื้องหลัง (Background Sync)
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
    } finally {
      // ให้แอนิเมชันบันทึกข้อมูลแสดงอย่างนุ่มนวลตามค่าคอนฟิก
      const elapsed = Date.now() - submitStart;
      const remaining = Math.max(0, CLINIC_ANIMATION_CONFIG.submitModalDurationMs - elapsed);
      setTimeout(() => {
        setIsSubmitting(false);
      }, remaining);
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

  if (isInitialLoading) {
    return <PharmacyDetailSkeleton />;
  }

  return (
    <div className="detail-page-container">

      {/* 1. Modal Popup แสดงอนิเมะชันตอนกด submit ส่งข้อมูลไปการเงิน (ฉากหลังเบลอสวยงาม ข้อความและอนิเมะชันตรงกลาง) */}
      <ClinicActionLoadingModal
        isOpen={isSubmitting}
        title="กำลังบันทึกลงฐานข้อมูล"
        subtitle="กรุณารอสักครู่ ระบบกำลังยืนยันการจ่ายยาและส่งข้อมูลไปยังห้องการเงิน..."
      />

      {/* Action Bar (Top) */}
      <div className="page-header" style={{ marginBottom: '24px' }}>
            <div className="header-titles">
              <h1 className="page-title">รายละเอียดการจ่ายยา</h1>
              <p className="page-subtitle">บันทึกและตรวจสอบคำสั่งจ่ายยา คัดกรองรายการยา และตัดสต็อกยา</p>
            </div>
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
          <div style={{ fontSize: '32px', fontWeight: '800', color: 'var(--text-primary)', lineHeight: '38px' }}>{queueList.length}</div>
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
            {queueList.filter(p => p.status === 'pending').length}
          </div>
          <div style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>
            รอจัดยา {queueList.filter(p => p.status === 'pending').length} คิว
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
            padding: '18px 24px', background: 'var(--bg-card, #F8FAFC)', borderBottom: isSearchExpanded ? '1px solid #E2E8F0' : 'none',
            cursor: 'pointer', userSelect: 'none' 
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <h3 style={{ margin: '0 0 2px 0', fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', lineHeight: '1.3' }}>
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
                onChange={(e) => {
                  setPatientIdInput(e.target.value);
                  if (e.target.value === '') {
                    fetchQueues(false, '');
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch();
                  }
                }}
                style={{ flex: 1, padding: '10px 16px', border: '1.5px solid #CBD5E1', borderRadius: '10px', fontSize: '14px', height: '42px', boxSizing: 'border-box' }}
              />
              <button 
                onClick={handleSearch}
                disabled={isRefreshing}
                style={{ padding: '0 20px', background: '#2563EB', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: '700', fontSize: '14px', height: '42px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)' }}
              >
                <Search size={16} />
                <span>ค้นหา / คิวรี</span>
              </button>
              <button 
                onClick={handleRefresh}
                disabled={isRefreshing}
                title="รีเฟรชข้อมูลคิวล่าสุดจากระบบแพทย์"
                style={{ padding: '0 16px', background: '#F1F5F9', color: '#334155', border: '1.5px solid #CBD5E1', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '14px', height: '42px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'all 0.2s ease' }}
              >
                <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} style={{ color: '#2563EB' }} />
                <span>รีเฟรชข้อมูล</span>
              </button>
            </div>

            {/* Patients Table with Scrollable Container showing ~5 rows and sticky header */}
            <div 
              className="recent-patients-scroll-container"
              style={{ 
                overflowX: 'hidden', 
                overflowY: 'auto', 
                overscrollBehavior: 'auto',
                maxHeight: '340px', 
                border: '1px solid #E2E8F0', 
                borderRadius: '10px' 
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px', tableLayout: 'fixed' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-card, #F8FAFC)' }}>
                  <tr style={{ color: 'var(--text-primary)', background: 'var(--bg-card, #F8FAFC)', borderBottom: '2px solid #E2E8F0', height: '48px', whiteSpace: 'nowrap' }}>
                    <th style={{ padding: '12px 14px', fontWeight: '700', fontSize: '14.5px', width: '8%', textAlign: 'center' }}>ลำดับคิว</th>
                    <th style={{ padding: '12px 14px', fontWeight: '700', fontSize: '14.5px', width: '10%', textAlign: 'center' }}>HN</th>
                    <th style={{ padding: '12px 14px', fontWeight: '700', fontSize: '14.5px', width: '10%', textAlign: 'center' }}>VN</th>
                    <th style={{ padding: '12px 14px', fontWeight: '700', fontSize: '14.5px', width: '14%', textAlign: 'center' }}>เลขบัตรประชาชน</th>
                    <th style={{ padding: '12px 16px 12px 30px', fontWeight: '700', fontSize: '14.5px', width: '22%', textAlign: 'left' }}>ชื่อ-นามสกุล</th>
                    <th style={{ padding: '12px 14px', fontWeight: '700', fontSize: '14.5px', width: '12%', textAlign: 'center' }}>สถานะ</th>
                    <th style={{ padding: '12px 14px', fontWeight: '700', fontSize: '14.5px', width: '10%', textAlign: 'center' }}>เวลารอ</th>
                    <th style={{ padding: '12px 16px', fontWeight: '700', fontSize: '14.5px', width: '14%', textAlign: 'center' }}>การดำเนินการ</th>
                  </tr>
                </thead>
                <tbody>
                  {queueList
                    .filter(p => {
                      if (statFilter === 'pending') return p.status === 'pending';
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
                      const isCompleted = p.status === 'completed';
                      const isDispensed = p.status === 'dispensed' || isCompleted;
                      return (
                        <tr 
                          key={p.id + '_' + index}
                          className={localPatientId === p.id ? 'active-row' : ''}
                          style={{ 
                            borderBottom: '1px solid #F1F5F9', 
                            whiteSpace: 'nowrap', 
                            height: '56px',
                            
                          }}
                        >
                          <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', verticalAlign: 'middle', textAlign: 'center' }}>
                            <span style={{ 
                              color: isCompleted ? '#16A34A' : (isDispensed ? '#64748B' : '#2563EB'), 
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
                            <span style={{ color: isCompleted ? '#64748B' : 'var(--text-primary)', fontWeight: '600', fontFamily: 'monospace', fontSize: '13.5px' }}>
                              <CopyableText value={p.vn || '-'} />
                            </span>
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
                          <td style={{ padding: '12px 16px 12px 30px', whiteSpace: 'nowrap', verticalAlign: 'middle', textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                              <span style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                              {p.doctorAdvice && (
                                <span style={{ fontSize: '12px', color: '#64748B', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {cleanDoctorAdvice(p.doctorAdvice)}
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', textAlign: 'center', verticalAlign: 'middle' }}>
                            <span style={{ 
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '100%',
                              maxWidth: '105px',
                              padding: '4px 10px',
                              boxSizing: 'border-box',
                              borderRadius: '9999px',
                              fontSize: '12px',
                              fontWeight: '700',
                              background: isCompleted ? '#DCFCE7' : (isDispensed ? '#F0FDF4' : '#DBEAFE'),
                              color: isCompleted ? '#166534' : (isDispensed ? '#15803D' : '#1E40AF'),
                              border: `1.5px solid ${isCompleted ? '#34D399' : (isDispensed ? '#86EFAC' : '#93C5FD')}`,
                              whiteSpace: 'nowrap'
                            }}>
                              {isCompleted ? '✓ เสร็จสิ้น/รับยา' : (isDispensed ? '✓ จ่ายยาแล้ว' : 'รอจัดยา')}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', verticalAlign: 'middle', textAlign: 'center' }}>
                            <span style={{ color: isCompleted ? '#94A3B8' : '#EF4444', fontWeight: '600', fontSize: '13px' }}>
                              {(() => {
                                if (isCompleted) return '-';
                                // Simple fallback for wait time calculation
                                if (!p.createdAt) return '-';
                                const minutes = Math.floor((Date.now() - new Date(p.createdAt).getTime()) / 60000);
                                return minutes >= 0 ? `${minutes} นาที` : '0 นาที';
                              })()}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                            {isDispensed ? (
                              <button 
                                onClick={() => {
                                  setLocalPatientId(p.id);
                                  if (onSelectPatientId) onSelectPatientId(p.id);
                                }}
                                style={{ 
                                  width: '100%',
                                  maxWidth: '125px',
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
                                  width: '100%',
                                  maxWidth: '125px',
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
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)', fontWeight: '600' }}>
                  <span style={{ color: '#64748B', fontWeight: '500' }}>เพศ:</span> {activePatient.gender}
                </span>
                <span style={{ color: '#CBD5E1' }}>•</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)', fontWeight: '600' }}>
                  <span style={{ color: '#64748B', fontWeight: '500' }}>อายุ:</span> {activePatient.age} ปี
                </span>
                <span style={{ color: '#CBD5E1' }}>•</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)', fontWeight: '600' }}>
                  <span style={{ color: '#64748B', fontWeight: '500' }}>เบอร์โทร:</span> {activePatient.phone || '-'}
                </span>
                {activePatient.nationalId && (
                  <>
                    <span style={{ color: '#CBD5E1' }}>•</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)', fontWeight: '600' }}>
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
                <span className="info-val" style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '14.5px' }}>
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
                <span className="info-val" style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '14.5px' }}>
                  {activePatient.chronicDiseases || 'ไม่มี'}
                </span>
              </div>
              <div className="info-box">
                <span className="info-label" style={{ fontSize: '11.5px', fontWeight: '700', color: '#475569' }}>
                  สัญญาณชีพ (CURRENT VITALS)
                </span>
                <span className="info-val" style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '14.5px' }}>
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
                padding: '18px 24px', background: 'var(--bg-card, #F8FAFC)', borderBottom: isPrescriptionExpanded ? '1px solid #E2E8F0' : 'none',
                cursor: 'pointer', userSelect: 'none' 
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>
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
                      <p className="doctor-advice-text" style={{ margin: 0, fontSize: '14.5px', color: 'var(--text-primary)', lineHeight: '1.6' }}>
                        {cleanDoctorAdvice(activePatient.doctorAdvice)}
                      </p>
                    </div>
                  </div>
                )}

                {/* Medication + Stock Combined List Table */}
                <div className="med-table-container" style={{ border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #E2E8F0', paddingBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                    <h4 className="column-title" style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>
                      รายการยาที่สั่งจ่าย ({activePatient.medications.length} รายการ)
                    </h4>
                    <span style={{ fontSize: '13px', color: '#64748B' }}>
                      * สามารถปรับแก้จำนวนยาที่จ่ายได้ในตารางนี้ ระบบจะคำนวณและส่งต่อให้การเงินโดยอัตโนมัติ
                    </span>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                      <thead>
                        <tr style={{ color: 'var(--text-primary)', background: '#F1F5F9', borderBottom: '2px solid #CBD5E1', height: '44px' }}>
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
                                <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{cleanDosage(med.dosage, med.name)}</div>
                                <div style={{ fontSize: '12.5px', color: '#64748B', marginTop: '2px' }}>คำแนะนำ: {cleanInstructions(med.instructions, med.name)}</div>
                              </td>
                              <td style={{ padding: '12px', textAlign: 'center' }}>
                                <div style={{ 
                                  display: 'inline-flex', 
                                  alignItems: 'center', 
                                  background: 'var(--bg-card, #F8FAFC)', 
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
                                      color: 'var(--text-primary)',
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
                              <td style={{ padding: '12px', textAlign: 'center', fontWeight: '700', fontSize: '14.5px', color: 'var(--text-primary)' }}>
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
          <div className="toast-message" style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{toast.message}</div>
        </div>
      )}

      {/* Medication Details Modal Popup */}
      {selectedMedInfo && (
        <ClinicModalPortal isOpen={true} onClose={() => setSelectedMedInfo(null)} className="detail-page-container">
          <div 
            style={{
              background: '#FFFFFF',
              borderRadius: '18px',
              maxWidth: '540px',
              width: '92%',
              maxHeight: '88vh',
              display: 'flex',
              flexDirection: 'column',
              padding: '24px 26px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid #E2E8F0',
              animation: 'clinicScaleInGPU 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards',
              boxSizing: 'border-box'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748B' }}>{selectedMedInfo.medId}</span>
                  <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--text-primary)', fontWeight: '700', fontFamily: 'var(--font-heading, \'Kanit\', \'Plus Jakarta Sans\', sans-serif)' }}>{selectedMedInfo.name}</h3>
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

            <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
              <div style={{ background: '#F0F9FF', padding: '18px 20px', borderRadius: '12px', border: '1.5px solid #BAE6FD', marginBottom: '16px' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '15px', color: '#0284C7', fontWeight: '800' }}>
                  สรรพคุณและข้อมูลยา (Medication Properties & Indications):
                </h4>
                <p style={{ margin: 0, fontSize: '15px', color: 'var(--text-primary)', lineHeight: '1.65', fontWeight: '500' }}>
                  {selectedMedInfo.properties || 'ยารักษาโรคทั่วไปตามคำสั่งแพทย์ ควรรับประทานยาตามวิธีใช้ที่ระบุบนฉลากยาอย่างเคร่งครัด'}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', flexShrink: 0, marginTop: '12px' }}>
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
        </ClinicModalPortal>
      )}
    </div>
  );
}
