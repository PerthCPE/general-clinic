import { useState, useEffect, useMemo, useRef } from 'react';
import './BillingInvoicePage.css';
import { CLINIC_CONFIG, type PatientConfig, normalizeScheme, SCHEME_LABELS, calculateBenefitAmounts } from '../../config/clinicConfig';
import { useWebSocket } from '../../context/WebSocketContext';
import { QRCodeSVG } from 'qrcode.react';
import generatePayload from 'promptpay-qr';
import html2pdf from 'html2pdf.js';
import { BillingInvoiceSkeleton } from '../../components/Common/ClinicSkeleton';
import { ClinicModalPortal, ClinicActionLoadingModal } from '../../components/Common/ClinicModalPortal';
import { CLINIC_ANIMATION_CONFIG } from '../../config/animationConfig';
import { playBillingNotification } from '../../utils/audioQueue';
import { formatNationalId } from '../../utils/formatters';

interface BillingInvoicePageProps {
  selectedPatientId?: string;
  onSelectPatientId?: (id: string) => void;
  patientRightsMap?: Record<string, string>;
  onUpdatePatientRights?: (patientId: string, rights: string) => void;
  onNavigateToDashboard?: () => void;
}

const DISPENSED_LOGS_STORAGE_KEY = 'pharmacy_dispensed_patients_log';

const getStoredDispensedPatients = (): PatientConfig[] => {
  try {
    const raw = localStorage.getItem(DISPENSED_LOGS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
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

export default function BillingInvoicePage({ 
  selectedPatientId, 
  onSelectPatientId,
  patientRightsMap,
  onUpdatePatientRights,
  onNavigateToDashboard
}: BillingInvoicePageProps) {
  const { subscribe } = useWebSocket();
  const [queueList, setQueueList] = useState<PatientConfig[]>(() => {
    try {
      const cached = localStorage.getItem('billing_active_patient_data');
      if (cached) {
        const p = JSON.parse(cached);
        if (p && (p.id || p.hn)) return [p];
      }
    } catch {}
    return [];
  });
  const receiptRef = useRef<HTMLDivElement>(null);
  const printableReceiptRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showReceiptPreview, setShowReceiptPreview] = useState(false);
  const [isPaymentConfirmed, setIsPaymentConfirmed] = useState(false);
  const [confirmedPatient, setConfirmedPatient] = useState<PatientConfig | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receiptSent, setReceiptSent] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'qr' | 'cash'>('qr');
  const [cashReceived, setCashReceived] = useState<string>('');

  // PromptPay Phone / National ID (สามารถแก้ไขเบอร์พร้อมเพย์ได้)
  // PromptPay Phone / National ID / เลขบัญชีธนาคาร (สามารถแก้ไขและสลับเลขได้)
  const [promptPayNumber, setPromptPayNumber] = useState<string>(() => {
    const cached = localStorage.getItem('clinic_promptpay_number');
    if (!cached || cached.includes('x') || cached.replace(/[^0-9]/g, '').length < 10) {
      localStorage.setItem('clinic_promptpay_number', '088-587-5682');
      return '088-587-5682';
    }
    return cached;
  });
  const [bankAccountNumber, setBankAccountNumber] = useState<string>(() => {
    const cached = localStorage.getItem('clinic_bank_account_number');
    if (!cached || cached.includes('x')) {
      localStorage.setItem('clinic_bank_account_number', '020300456462');
      return '020300456462';
    }
    return cached;
  });
  const [isEditingPromptPay, setIsEditingPromptPay] = useState(false);

  const handleSavePromptPay = (newNumber: string, newBankAcc?: string) => {
    setPromptPayNumber(newNumber);
    localStorage.setItem('clinic_promptpay_number', newNumber);
    if (newBankAcc) {
      setBankAccountNumber(newBankAcc);
      localStorage.setItem('clinic_bank_account_number', newBankAcc);
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
    const qty = Number(item.quantity ?? item.qty ?? m.quantity ?? 1);
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

    const finalDosage = cleanDosage(item.dosage || m.dosage, name);
    const finalInstructions = cleanInstructions(item.instructions || m.instructions, name);

    return {
      medId: code,
      name,
      genericName,
      category,
      properties,
      dosage: finalDosage,
      instructions: finalInstructions,
      price: unitPrice,
      unit_price: unitPrice,
      quantity: qty,
      stock: m.stock_quantity || 100,
      stockStatus: (m.stock_quantity || 100) > 10 ? ('in-stock' as const) : ('low-stock' as const)
    };
  };

  const fetchQueues = async () => {
    const startTime = Date.now();
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};

      const [pRes, bRes] = await Promise.all([
        fetch('/api/pharmacy/queues', { headers }).then(r => r.ok ? r : fetch('/api/system/pharmacy/queues')).catch(() => null),
        fetch('/api/billing/queues', { headers }).then(r => r.ok ? r : fetch('/api/system/billing/queues')).catch(() => null)
      ]);

      let mapped: PatientConfig[] = [];

      // 1. นำข้อมูลจาก Pharmacy Queues เป็นแหล่งข้อมูลหลัก (เพื่อให้เลขคิว QE... และคนไข้ตรงกับระบบยาทุกประการ 100%)
      if (pRes && pRes.ok) {
        try {
          const pData = await pRes.json();
          if (pData.status === 'success' && Array.isArray(pData.queues)) {
            pData.queues.forEach((pq: any) => {
              // แผนกการเงินรับเฉพาะผู้ป่วยที่ห้องยาจ่ายยาเสร็จแล้ว (dispensed)
              if (pq.status !== 'dispensed') {
                return;
              }

              const cleanHN = (pq.hn || (pq.patient && pq.patient.hn) || '').replace(/[-]/g, '');
              const cleanDigits = cleanHN.replace(/\D/g, '').padStart(4, '0');
              const defaultNameMap: Record<string, string> = {
                '0001': 'นายสมชาย ใจดี',
                '0002': 'นางสาวสมหญิง สดใส',
                '0003': 'นายอาทิตย์ มีสุข',
                '0004': 'นางรัตนา สุขเกษม',
                '0005': 'นายประสิทธิ์ ยิ่งเจริญ',
                '0006': 'นางกานดา มณีรัตน์',
                '0007': 'นายธนกฤต วงศ์สว่าง',
                '0008': 'นางสาวพิมพ์ใจ ชื่นจิต',
              };
              let pName = pq.patient_name || '';
              if (!pName || pName.includes('?') || pName.trim() === '' || pName === 'ผู้ป่วย') {
                pName = defaultNameMap[cleanDigits] || pName || 'ผู้ป่วย';
              }

              let parsedMeds: any[] = [];
              if (pq.medications && pq.medications !== 'null') {
                try {
                  const rawMeds = typeof pq.medications === 'string' ? JSON.parse(pq.medications) : pq.medications;
                  if (Array.isArray(rawMeds)) {
                    parsedMeds = rawMeds.map((m: any) => parseDispensedMed(m, masterMedicines));
                  }
                } catch {}
              }
              mapped.push({
                id: String(pq.id),
                visitId: pq.visit_id || 1,
                hn: cleanHN || `HN0001`,
                nationalId: pq.national_id || '-',
                queueNumber: pq.queue_number || 'Q0001',
                ticket: pq.queue_number || 'Q0001',
                name: pName,
                shortName: pName,
                gender: pq.gender || 'ชาย',
                age: pq.age || 35,
                treatmentRights: pq.scheme_type || 'สิทธิ 30 บาท (สปสช.)',
                registeredRights: pq.scheme_type || 'สิทธิ 30 บาท (สปสช.)',
                patientType: 'ผู้ป่วยนอก (OPD)' as const,
                allergies: cleanAllergies(pq.allergies ? [pq.allergies] : ['ไม่มีประวัติแพ้ยา']),
                chronicDiseases: cleanChronicDiseases(pq.chronic_diseases || 'ไม่มี'),
                vitals: 'ความดัน 120/80 mmHg, อุณหภูมิ 36.6 °C',
                dob: '01/01/2534',
                phone: '081-999-8888',
                occupation: 'รับจ้างทั่วไป',
                visitStatus: 'รอชำระเงิน',
                visitDate: new Date(pq.created_at || Date.now()).toLocaleDateString('th-TH'),
                visitTime: new Date(pq.created_at || Date.now()).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.',
                doctorAdvice: cleanDoctorAdvice(pq.doctor_advice),
                medications: parsedMeds
              });
            });
          }
        } catch {}
      }

      // 2. นำข้อมูลจาก Billing Queues มาเสริม (กรณีมีคิวที่สร้างเฉพาะการเงินหรือยังไม่มีใน pharmacy)
      if (bRes && bRes.ok) {
        try {
          const bData = await bRes.json();
          if (bData.status === 'success' && Array.isArray(bData.queues)) {
            bData.queues.forEach((bq: any) => {
              const cleanHN = (bq.hn || '').replace(/[-]/g, '');
              const exists = mapped.some(q => 
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
                mapped.push({
                  id: String(bq.id),
                  visitId: bq.visit_id || 1,
                  hn: cleanHN || `HN0001`,
                  nationalId: bq.national_id || '-',
                  queueNumber: bq.queue_number || 'Q0001',
                  ticket: bq.queue_number || 'Q0001',
                  name: bq.patient_name || 'ผู้ป่วย',
                  shortName: bq.patient_name || 'ผู้ป่วย',
                  gender: bq.gender || 'ชาย',
                  age: bq.age || 35,
                  treatmentRights: bq.scheme_type || 'สิทธิ 30 บาท (สปสช.)',
                  registeredRights: bq.scheme_type || 'สิทธิ 30 บาท (สปสช.)',
                  patientType: 'ผู้ป่วยนอก (OPD)' as const,
                  allergies: cleanAllergies(bq.allergies ? [bq.allergies] : ['ไม่มีประวัติแพ้ยา']),
                  chronicDiseases: cleanChronicDiseases(bq.chronic_diseases || 'ไม่มี'),
                  vitals: 'ความดัน 120/80 mmHg, อุณหภูมิ 36.6 °C',
                  dob: '01/01/2534',
                  phone: '081-999-8888',
                  occupation: 'รับจ้างทั่วไป',
                  visitStatus: 'รอชำระเงิน',
                  visitDate: new Date(bq.created_at || Date.now()).toLocaleDateString('th-TH'),
                  visitTime: new Date(bq.created_at || Date.now()).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.',
                  doctorAdvice: cleanDoctorAdvice(bq.doctor_advice),
                  medications: parsedMeds
                });
              }
            });
          }
        } catch {}
      }

      // ถ้าไม่มีคิวจาก DB จะแสดง 0 รายการ (ไม่มี fallback mock)
      setQueueList(mapped);
    } catch (err) {
      console.error('Failed to fetch queues in billing invoice:', err);
    } finally {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, CLINIC_ANIMATION_CONFIG.minSkeletonLoadingMs - elapsed);
      setTimeout(() => setLoading(false), remaining);
    }
  };

  useEffect(() => {
    fetchQueues();

    // Smart Background Polling ทุกๆ 12 วินาที เพื่อดึงคิวใบแจ้งหนี้ล่าสุด (Fallback คู่กับ WebSocket เรียลไทม์)
    const pollInterval = setInterval(() => {
      if (!document.hidden && !showQrModal) {
        fetchQueues();
      }
    }, 12000);

    const unsubBill = subscribe('BILLING_CREATED', (data: any) => {
      if (data) {
        const pName = data.patient_name || 'ผู้ป่วย';
        const newPatient: PatientConfig = {
          id: String(data.queue_id || data.id || data.visit_id || Date.now()),
          visitId: data.visit_id || 1,
          hn: data.hn || `HN-${Date.now()}`,
          nationalId: data.national_id || '-',
          queueNumber: data.queue_number || 'B-001',
          ticket: data.queue_number || 'B-001',
          name: pName,
          shortName: pName,
          gender: data.gender || 'ชาย',
          age: data.age || 35,
          treatmentRights: data.scheme_type || 'สิทธิ 30 บาท (สปสช.)',
          registeredRights: data.scheme_type || 'สิทธิ 30 บาท (สปสช.)',
          patientType: 'ผู้ป่วยนอก (OPD)' as const,
          allergies: cleanAllergies(data.allergies ? [data.allergies] : ['ไม่มีประวัติแพ้ยา']),
          chronicDiseases: cleanChronicDiseases(data.chronic_diseases || 'ไม่มี'),
          vitals: 'ความดัน 120/80 mmHg, อุณหภูมิ 36.6 °C',
          dob: '01/01/2534',
          phone: '081-999-8888',
          occupation: 'รับจ้างทั่วไป',
          visitStatus: 'รอชำระเงิน',
          visitDate: new Date(data.created_at || Date.now()).toLocaleDateString('th-TH'),
          visitTime: new Date(data.created_at || Date.now()).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.',
          doctorAdvice: cleanDoctorAdvice(data.doctor_advice),
          medications: Array.isArray(data.medications) ? data.medications.map((m: any) => parseDispensedMed(m, masterMedicines)) : []
        };
        setQueueList(prev => [newPatient, ...prev.filter(q => q.id !== newPatient.id)]);

      }
      setTimeout(() => {
        fetchQueues();
      }, 500);
    });

    const unsubQueue = subscribe('QUEUE_UPDATED', (data: any) => {
      if (data && data.action === 'db_reset') {
        setQueueList([]);
      } else {
        fetchQueues();
      }
    });

    return () => {
      clearInterval(pollInterval);
      unsubBill();
      unsubQueue();
    };
  }, [subscribe, masterMedicines.length, showQrModal]);

  const currentSelectedId = selectedPatientId || localStorage.getItem('billing_active_patient') || '';
  const storedActivePatient = useMemo<PatientConfig | null>(() => {
    try {
      const raw = localStorage.getItem('billing_active_patient_data');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, [currentSelectedId]);

  const activePatient: PatientConfig | undefined = 
    (isPaymentConfirmed && confirmedPatient ? confirmedPatient : undefined) ||
    queueList.find(p => p.id === currentSelectedId) || 
    (storedActivePatient && storedActivePatient.id === currentSelectedId ? storedActivePatient : undefined) ||
    queueList[0] ||
    storedActivePatient ||
    confirmedPatient ||
    undefined;

  const currentRights = activePatient ? (patientRightsMap?.[activePatient.id] || activePatient.treatmentRights) : '';

  const registeredRights = activePatient?.registeredRights || storedActivePatient?.registeredRights || activePatient?.treatmentRights || 'สิทธิ 30 บาท (สปสช.)';
  const selectedRights = currentRights || activePatient?.treatmentRights || storedActivePatient?.treatmentRights || 'สิทธิ 30 บาท (บัตรทอง / สปสช.)';
  const registeredKey = normalizeScheme(registeredRights);
  const selectedKey = normalizeScheme(selectedRights);
  const isRightsMismatch = registeredKey !== selectedKey;
  const isGovRight = selectedRights.includes('ข้าราชการ') || selectedRights.includes('กรมบัญชีกลาง') || selectedKey === 'gov';
  const isSelfPay = !isGovRight && (selectedKey === 'cash' || selectedRights.includes('เงินสด') || selectedRights.includes('Self Pay') || selectedRights.includes('ชำระเงินเอง') || (selectedRights.includes('จ่ายตรง') && !selectedRights.includes('กรมบัญชีกลาง')));
  const isSubmitBlocked = isRightsMismatch && !isSelfPay;

  // ดึงรายการยาและราคาจริงจากฐานข้อมูล สำหรับคนไข้ที่เลือกอยู่ (ถ้ายังไม่มีในแคช)
  useEffect(() => {
    if (activePatient) {
      if (activePatient.medications && activePatient.medications.length > 0) {
        return;
      }
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
          console.error('Failed to fetch real-time dispensing for billing invoice:', err);
        }
      };
      fetchMeds();
    }
  }, [activePatient?.id, activePatient?.visitId, activePatient?.hn, masterMedicines.length]);

  const patientType = activePatient?.patientType || 'ผู้ป่วยนอก (OPD)';
  const allergiesList = Array.isArray(activePatient?.allergies) 
    ? activePatient.allergies 
    : (typeof activePatient?.allergies === 'string' && activePatient.allergies ? [activePatient.allergies] : ['ไม่มีประวัติแพ้ยา']);
  const medicationsList = Array.isArray(activePatient?.medications) ? activePatient.medications : [];

  // คำนวณค่ายาจริงตามที่ได้รับมาจากระบบคลังยา/แพทย์
  const medTotal = medicationsList.reduce((sum: number, m: any) => {
    const unitPrice = Number(m?.price || m?.unit_price || 0);
    const qty = Number(m?.quantity || 1);
    return sum + (unitPrice * qty);
  }, 0);

  const medicalServiceFee = 800; // ค่าตรวจแพทย์ (500) + ค่าบริการคลินิก (300)
  const vatTax = Math.round(medTotal * 0.07);
  const rawTotal = medTotal + medicalServiceFee + vatTax;

  const benefitResult = calculateBenefitAmounts(rawTotal, selectedKey);
  const grandTotal = benefitResult.netTotal;
  const discountAmount = benefitResult.discountAmount;

  const cashNumber = parseFloat(cashReceived) || 0;
  const changeAmount = cashNumber >= grandTotal ? cashNumber - grandTotal : 0;

  // QR Code Countdown Timer & Timeout States
  const [qrSecondsLeft, setQrSecondsLeft] = useState(300);
  const [isQrExpired, setIsQrExpired] = useState(false);
  const [qrKey, setQrKey] = useState(0);
  const [testTimeInput, setTestTimeInput] = useState('300');

  // Digital Receipt Modal States (SMS / Gmail Mock)
  const [showDigitalReceiptModal, setShowDigitalReceiptModal] = useState(false);
  const [digitalChannel, setDigitalChannel] = useState<'sms' | 'gmail'>('sms');
  const [recipientPhone, setRecipientPhone] = useState('088-587-5682');
  const [recipientEmail, setRecipientEmail] = useState('patient.care@gmail.com');
  const [isSendingDigital, setIsSendingDigital] = useState(false);
  const [sendingChannel, setSendingChannel] = useState<'sms' | 'gmail' | null>(null);
  const [digitalSentSuccess, setDigitalSentSuccess] = useState(false);
  const [digitalSentSuccessMsg, setDigitalSentSuccessMsg] = useState<string | null>(null);

  const handleSendSms = () => {
    if (!recipientPhone.trim()) {
      alert('กรุณากรอกหมายเลขโทรศัพท์');
      return;
    }
    setSendingChannel('sms');
    setDigitalChannel('sms');
    setDigitalSentSuccess(false);
    setDigitalSentSuccessMsg(null);
    setTimeout(() => {
      setSendingChannel(null);
      setDigitalSentSuccess(true);
      setDigitalSentSuccessMsg(`ส่ง SMS ใบเสร็จไปยังหมายเลข ${recipientPhone.trim()} เรียบร้อยแล้ว (จำลองสำเร็จ)`);
      setReceiptSent(`ส่งใบเสร็จดิจิทัลทาง SMS (${recipientPhone.trim()}) เรียบร้อยแล้ว`);
      setTimeout(() => setReceiptSent(null), 4000);
    }, 600);
  };

  const handleSendGmail = () => {
    if (!recipientEmail.trim()) {
      alert('กรุณากรอกที่อยู่อีเมล Gmail');
      return;
    }
    setSendingChannel('gmail');
    setDigitalChannel('gmail');
    setDigitalSentSuccess(false);
    setDigitalSentSuccessMsg(null);
    setTimeout(() => {
      setSendingChannel(null);
      setDigitalSentSuccess(true);
      setDigitalSentSuccessMsg(`ส่ง Gmail ใบเสร็จไปยัง ${recipientEmail.trim()} เรียบร้อยแล้ว (จำลองสำเร็จ)`);
      setReceiptSent(`ส่งใบเสร็จดิจิทัลทาง Gmail (${recipientEmail.trim()}) เรียบร้อยแล้ว`);
      setTimeout(() => setReceiptSent(null), 4000);
    }, 600);
  };

  useEffect(() => {
    if (!showQrModal || paymentMethod !== 'qr' || isPaymentConfirmed) return;
    if (isQrExpired) return;

    if (qrSecondsLeft <= 0) {
      setIsQrExpired(true);
      return;
    }

    const timer = setInterval(() => {
      setQrSecondsLeft(prev => {
        if (prev <= 1) {
          setIsQrExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [showQrModal, paymentMethod, isPaymentConfirmed, isQrExpired, qrSecondsLeft]);

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleRegenerateQr = () => {
    setIsQrExpired(false);
    const dur = parseInt(testTimeInput, 10) || 300;
    setQrSecondsLeft(dur);
    setQrKey(prev => prev + 1);
    setReceiptSent('สร้าง QR Code สำหรับชำระเงินใหม่เรียบร้อยแล้ว');
    setTimeout(() => setReceiptSent(null), 3000);
  };

  const handleSetTestSeconds = (secs: number) => {
    setQrSecondsLeft(secs);
    setIsQrExpired(secs <= 0);
  };

  // สร้าง PromptPay QR Payload แบบ Real-time ตามเบอร์และยอดเงินจริง
  const qrPayload = useMemo(() => {
    const cleanNumber = (promptPayNumber || '0885875682').replace(/[^0-9]/g, '');
    try {
      return generatePayload(cleanNumber, { amount: grandTotal });
    } catch {
      return '00020101021229370016A000000677010111';
    }
  }, [promptPayNumber, grandTotal, qrKey]);

  const handleOpenQr = () => {
    if (isSubmitBlocked) {
      alert(
        `สิทธิ์ที่เลือกไม่ตรงกับสิทธิ์ที่บันทึกในระบบ: ไม่อนุญาตให้ดำเนินการชำระเงิน\n\n` +
        `• สิทธิ์ที่บันทึกในระบบ: ${registeredRights}\n` +
        `• สิทธิ์ที่เลือกใช้: ${selectedRights}\n\n` +
        `ระบบอนุญาตเฉพาะกรณีเลือกสิทธิ์ที่ตรงกับข้อมูลของผู้ป่วย หรือเลือก 'จ่ายตรง / เงินสด' เท่านั้น`
      );
      return;
    }
    setShowQrModal(true);
    setIsPaymentConfirmed(false);
    setReceiptSent(null);
    setPaymentMethod('qr');
    setCashReceived('');
    setIsQrExpired(false);
    setQrSecondsLeft(300);
  };

  // [บุญให้เพิ่มเทคนิคนี้] (Supabase + Optimistic UI + WebSocket) - กดยืนยันรับชำระเงินแล้วอัปเดตหน้าจอทันที 0 ms และส่งขึ้น Supabase เบื้องหลัง
  const handleConfirmPayment = async () => {
    if (!activePatient) return;
    setConfirmedPatient(activePatient);
    if (paymentMethod === 'qr' && isQrExpired) {
      alert('การชำระเงินไม่สำเร็จหรือหมดเวลา: ระบบแจ้งเตือนและอนุญาตให้สร้าง QR Code ใหม่');
      return;
    }
    setIsSubmitting(true);
    const submitStart = Date.now();

    // 1. Optimistic UI: อัปเดตสถานะสำเร็จบนหน้าจอทันทีใน 0 ms
    setQueueList(prev => prev.map(p => p.id === activePatient.id ? { ...p, visitStatus: 'ชำระเงินเรียบร้อยแล้ว' } : p));

    // 2. ส่งข้อมูลขึ้น Supabase Cloud / DB เบื้องหลัง (Background Sync)
    let paymentSucceeded = false;
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('clinic_auth_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const payload = {
        visit_id: activePatient.visitId || 0,
        hn: activePatient.hn || 'HN0001',
        patient_name: activePatient.name || 'ผู้ป่วย',
        national_id: activePatient.nationalId || '',
        queue_number: activePatient.queueNumber || activePatient.ticket || 'Q0001',
        total_amount: rawTotal,
        net_amount: grandTotal,
        discount_amount: discountAmount,
        scheme_type: selectedRights,
        treatment_right: selectedRights,
        vitals: activePatient.vitals || 'ความดัน 120/80 mmHg | ปกติ',
        payment_method: paymentMethod === 'qr' ? 'QR Code' : 'เงินสด',
        cash_received: parseFloat(cashReceived) || grandTotal,
        doctor_name: 'นพ.สมเกียรติ มั่นคง',
        doctor_advice: activePatient.doctorAdvice || '',
        medications: JSON.stringify(medicationsList)
      };

      let res: Response;
      try {
        res = await fetch('/api/billing/confirm', {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });
      } catch {
        res = await fetch('/api/system/billing/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (!res.ok) {
        res = await fetch('/api/system/billing/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Payment failed');
      }

      paymentSucceeded = true;
    } catch (err) {
      console.error('Failed to confirm payment:', err);
      // บันทึกไม่สำเร็จ: ย้อน optimistic update กลับ ไม่ให้ค้างสถานะ "ชำระเงินเรียบร้อยแล้ว" ปลอมๆ
      setQueueList(prev => prev.map(p => p.id === activePatient.id ? { ...p, visitStatus: 'รอชำระเงิน' } : p));
    } finally {
      // ให้แอนิเมชันบันทึกข้อมูลแสดงอย่างนุ่มนวลตามค่าคอนฟิก
      const elapsed = Date.now() - submitStart;
      const remaining = Math.max(0, CLINIC_ANIMATION_CONFIG.submitModalDurationMs - elapsed);
      setTimeout(() => {
        setIsSubmitting(false);
        if (paymentSucceeded) {
          setIsPaymentConfirmed(true);
        } else {
          alert('บันทึกการชำระเงินไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
        }
      }, remaining);
    }
  };

  // เปิดดูหน้าตัวอย่างใบเสร็จ (Preview) ก่อนพิมพ์หรือบันทึกไฟล์
  const handlePrintReceipt = () => {
    setShowReceiptPreview(true);
  };

  // บันทึกเป็นไฟล์ PDF จากหน้าพรีวิวด้วย html2pdf.js
  const handleDownloadPdf = () => {
    const targetEl = printableReceiptRef.current || receiptRef.current;
    if (!targetEl) return;
    const opt = {
      margin: 10,
      filename: `Receipt-${activePatient?.hn || 'HN'}-${Date.now()}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
    };
    html2pdf().set(opt).from(targetEl).save();
    setReceiptSent('ดาวน์โหลดใบเสร็จรับเงิน PDF สำเร็จแล้ว');
    setTimeout(() => setReceiptSent(null), 3000);
  };

  // สั่งพิมพ์ผ่านเครื่องพิมพ์ (Print Dialog)
  const handleBrowserPrint = () => {
    window.print();
  };

  if (loading) {
    return <BillingInvoiceSkeleton />;
  }

  if (!activePatient && !confirmedPatient) {
    return (
      <div className="billing-invoice-container">
        <div style={{ 
          background: '#FFFFFF', 
          borderRadius: '16px', 
          padding: '48px 24px', 
          textAlign: 'center', 
          border: '1px solid #E2E8F0',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
          maxWidth: '600px',
          margin: '40px auto'
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px', color: '#94A3B8' }}>
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <line x1="10" y1="9" x2="8" y2="9"></line>
            </svg>
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>ไม่มีบิลรอชำระเงินในขณะนี้</h2>
          <p style={{ color: '#64748B', fontSize: '1rem', marginBottom: '24px', lineHeight: '1.5' }}>
            ยังไม่มีข้อมูลใบสั่งยาที่ส่งมาจากการจ่ายยาของห้องยา กรุณารอห้องยากดยืนยันการจ่ายยา หรือไปที่หน้ารับชำระเงิน
          </p>
          {onNavigateToDashboard && (
            <button 
              onClick={onNavigateToDashboard}
              style={{
                background: '#0EA5E9',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '10px',
                padding: '12px 24px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10"></line>
                <line x1="12" y1="20" x2="12" y2="4"></line>
                <line x1="6" y1="20" x2="6" y2="14"></line>
              </svg>
              ไปที่แดชบอร์ดการเงิน
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="billing-invoice-container">
      {/* Modal Popup แสดงอนิเมะชันตอนบันทึกการชำระเงินลงฐานข้อมูล (ตรงตามรูปภาพ 2) */}
      <ClinicActionLoadingModal
        isOpen={isSubmitting}
        title="กำลังบันทึกลงฐานข้อมูล"
        subtitle="กรุณารอสักครู่ ระบบกำลังบันทึกการชำระเงินและออกใบเสร็จ..."
      />

      {/* Top Header */}
      <div className="page-header-row" style={{ marginBottom: '16px' }}>
        <div className="header-titles">
          <h1 className="page-title">
            รายการบิล (Billing & Invoice)
          </h1>
          <p className="page-subtitle">
            สรุปค่าบริการ ค่ายา และสร้าง QR Code สำหรับชำระเงิน
          </p>
        </div>
      </div>

      {/* Standalone Queue Navigation Bar */}
      {queueList.length > 0 && (
        <div className="invoice-queue-bar-wrapper" style={{ marginBottom: '16px', maxWidth: '100%' }}>
          <div className="queue-bar-header">
            <span className="queue-bar-title">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              ลำดับคิวรอชำระเงินทั้งหมด ({queueList.length} คิว)
            </span>
            <span className="queue-bar-hint">เลื่อนซ้าย-ขวาเพื่อเลือกคิวผู้ป่วย</span>
          </div>
          
          <div className="invoice-queue-strip">
            {queueList.map((p, idx) => {
              const qNum = p.queueNumber && p.queueNumber.startsWith('Q') ? p.queueNumber : (p.ticket || p.id);
              const isActive = p.id === activePatient.id;
              return (
                <button
                  key={p.id}
                  className={`queue-strip-item ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    if (onSelectPatientId) onSelectPatientId(p.id);
                    localStorage.setItem('billing_active_patient', p.id);
                  }}
                  title={`ลำดับที่ ${idx + 1}: ${qNum} - ${p.name}`}
                >
                  <span className="queue-item-seq">{idx + 1}</span>
                  <span className="queue-item-code">{qNum}</span>
                  <span className="queue-item-name">{p.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Modern Patient & Billing Header Card */}
      <div className="card billing-patient-card" style={{ marginBottom: '20px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          
          {/* Left: Patient Profile Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
            <div style={{
              width: '54px',
              height: '54px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '800',
              fontSize: '1.4rem',
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)',
              flexShrink: 0
            }}>
              {activePatient.name ? activePatient.name.charAt(0) : 'P'}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
                <span style={{ 
                  background: '#DCFCE7', 
                  color: '#15803D', 
                  border: '1px solid #86EFAC', 
                  padding: '3px 10px', 
                  borderRadius: '8px', 
                  fontWeight: '800', 
                  fontSize: '13px', 
                  fontFamily: 'monospace' 
                }}>
                  {activePatient.queueNumber && activePatient.queueNumber.startsWith('Q') ? activePatient.queueNumber : (activePatient.ticket || 'Q0001')}
                </span>

                <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                  {activePatient.name}
                </h2>

                <span style={{ background: '#E0F2FE', color: '#0369A1', border: '1px solid #BAE6FD', padding: '3px 10px', borderRadius: '8px', fontSize: '12.5px', fontWeight: '700' }}>
                  HN: {activePatient.hn}
                </span>

                <span style={{ 
                  background: patientType.includes('OPD') ? '#EFF6FF' : '#F5F3FF', 
                  color: patientType.includes('OPD') ? '#2563EB' : '#7C3AED', 
                  border: `1px solid ${patientType.includes('OPD') ? '#BFDBFE' : '#DDD6FE'}`, 
                  padding: '3px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: '700' 
                }}>
                  {patientType}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', fontSize: '0.9rem', color: '#64748B' }}>
                <span><strong>เลขประจำตัวประชาชน:</strong> {formatNationalId(activePatient.nationalId)}</span>
                <span>•</span>
                <span><strong>วันที่รับบริการ:</strong> {activePatient.visitDate || new Date().toISOString().split('T')[0]} ({activePatient.visitTime || '10:30'})</span>
              </div>
            </div>
          </div>

          {/* Right: Treatment Rights & Payment Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748B' }}>สิทธิการรักษาพยาบาล</label>
              <select
                className="banner-rights-select"
                value={(() => {
                  const r = currentRights || activePatient?.treatmentRights || '';
                  if (r.includes('30') || r.includes('บัตรทอง') || r.includes('สปสช')) return 'สิทธิ 30 บาท (บัตรทอง / สปสช.)';
                  if (r.includes('ประกันสังคม')) return 'สิทธิประกันสังคม (Social Security)';
                  if (r.includes('ข้าราชการ') || r.includes('กรมบัญชีกลาง')) return 'สิทธิข้าราชการ / จ่ายตรงกรมบัญชีกลาง';
                  if (r.includes('ประกันสุขภาพ') || r.includes('เอกชน')) return 'ประกันสุขภาพเอกชน (Private Insurance)';
                  if (r.includes('ชำระเงินเอง') || r.includes('เงินสด') || (r.includes('จ่ายตรง') && !r.includes('กรมบัญชีกลาง') && !r.includes('ข้าราชการ'))) return 'จ่ายตรง / เงินสด (Self Pay / Cash)';
                  return r || 'สิทธิ 30 บาท (บัตรทอง / สปสช.)';
                })()}
                onChange={(e) => {
                  const newRights = e.target.value;
                  if (activePatient) {
                    if (onUpdatePatientRights) {
                      onUpdatePatientRights(activePatient.id, newRights);
                    }
                    setQueueList(prev => prev.map(q => q.id === activePatient.id ? { ...q, treatmentRights: newRights } : q));
                  }
                }}
                style={{
                  background: 'var(--bg-card, #F8FAFC)',
                  color: 'var(--text-primary)',
                  border: '1.5px solid #CBD5E1',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                <option value="สิทธิ 30 บาท (บัตรทอง / สปสช.)">สิทธิ 30 บาท (บัตรทอง / สปสช.)</option>
                <option value="สิทธิประกันสังคม (Social Security)">สิทธิประกันสังคม (Social Security)</option>
                <option value="สิทธิข้าราชการ / จ่ายตรงกรมบัญชีกลาง">สิทธิข้าราชการ / จ่ายตรงกรมบัญชีกลาง</option>
                <option value="ประกันสุขภาพเอกชน (Private Insurance)">ประกันสุขภาพเอกชน (Private Insurance)</option>
                <option value="จ่ายตรง / เงินสด (Self Pay / Cash)">จ่ายตรง / เงินสด (Self Pay / Cash)</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748B' }}>สถานะการชำระเงิน</label>
              <span style={{ 
                background: isPaymentConfirmed ? '#DCFCE7' : '#FEE2E2', 
                color: isPaymentConfirmed ? '#15803D' : '#DC2626',
                border: `1.5px solid ${isPaymentConfirmed ? '#86EFAC' : '#FCA5A5'}`, 
                padding: '6px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '800',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '120px', height: '36px', boxSizing: 'border-box'
              }}>
                {isPaymentConfirmed ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    ชำระเงินแล้ว
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    รอชำระเงิน
                  </>
                )}
              </span>
            </div>
          </div>

        </div>

        {/* Warning banner when selected rights do not match registered rights */}
        {isRightsMismatch && isSubmitBlocked && (
            <div style={{
              margin: '0 0 20px 0',
              padding: '14px 18px',
              background: '#FEF2F2',
              border: '1.5px solid #F87171',
              borderRadius: '12px',
              color: '#991B1B',
              fontSize: '13px',
              lineHeight: '1.5',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              boxShadow: '0 4px 12px -2px rgba(239, 68, 68, 0.12)'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '34px',
                height: '34px',
                borderRadius: '9px',
                backgroundColor: '#FEE2E2',
                color: '#DC2626',
                flexShrink: 0
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="15" y1="9" x2="9" y2="15"></line>
                  <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
              </div>
              <div>
                <div style={{ fontWeight: '800', color: '#991B1B', fontSize: '13.5px' }}>
                  สิทธิ์ที่เลือกไม่ตรงกับสิทธิ์ที่บันทึกในระบบ: ไม่อนุญาตให้ดำเนินการต่อ
                </div>
                <div style={{ fontSize: '12px', color: '#B91C1C', marginTop: '2px' }}>
                  (ระบบอนุญาตเฉพาะสิทธิ์ที่บันทึกในระบบ หรือเลือก "จ่ายตรง / เงินสด" เท่านั้น)
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '6px', fontSize: '12px' }}>
                  <span style={{ color: '#7F1D1D' }}>สิทธิ์ที่บันทึกในระบบ:</span>
                  <span style={{ padding: '2px 8px', borderRadius: '5px', backgroundColor: '#EDE9FE', color: '#6D28D9', fontWeight: '600' }}>
                    {registeredRights}
                  </span>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                  </svg>
                  <span style={{ color: '#7F1D1D' }}>สิทธิ์ที่เลือกใช้:</span>
                  <span style={{ padding: '2px 8px', borderRadius: '5px', backgroundColor: '#FEE2E2', color: '#991B1B', fontWeight: '600' }}>
                    {selectedRights}
                  </span>
                </div>
              </div>
            </div>
        )}
      </div>

      {/* 2-Column Fee Breakdown */}
      <div className="invoice-breakdown-grid">
        <div className="fee-card card">
          <h2 className="fee-card-title">ค่าบริการทางการแพทย์</h2>
          <div className="fee-list">
            <div className="fee-item">
              <span>ค่าตรวจแพทย์</span>
              <span className="fee-price">- ฿ 500.00</span>
            </div>
            <div className="fee-item">
              <span>ค่าบริการคลินิก</span>
              <span className="fee-price">- ฿ 300.00</span>
            </div>
          </div>
        </div>

        <div className="fee-card card">
          <h2 className="fee-card-title">ค่ายา ({medicationsList.length} รายการ)</h2>
          <div className="fee-list">
            {medicationsList.map((m: any, idx: number) => {
              const uPrice = Number(m?.price || m?.unit_price || 0);
              const qty = Number(m?.quantity || 1);
              const totalItemPrice = uPrice * qty;
              return (
                <div key={idx} className="fee-item">
                  <span>{m?.name || m?.genericName || 'รายการยา'} {qty > 1 && `(x${qty})`}</span>
                  <span className="fee-price">- ฿ {totalItemPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
              );
            })}

            <div className="fee-divider"></div>

            <div className="fee-sub-item">
              <span>ค่ายารวม</span>
              <span>฿ {medTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="fee-sub-item">
              <span>ค่าบริการทางการแพทย์</span>
              <span>฿ {medicalServiceFee.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="fee-sub-item">
              <span>ภาษี (VAT 7%)</span>
              <span>฿ {vatTax.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="fee-sub-item" style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
              <span>ยอดรวมก่อนหักสิทธิ์</span>
              <span>฿ {rawTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
            {benefitResult.discountAmount > 0 && (
              <div className="fee-sub-item" style={{ color: '#16A34A', fontWeight: '700' }}>
                <span>ส่วนลดสิทธิการรักษา ({benefitResult.schemeLabel})</span>
                <span>- ฿ {benefitResult.discountAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
            )}

            <div className="grand-total-row">
              <span className="grand-label">ยอดชำระสุทธิ</span>
              <span className="grand-price">฿ {grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bottom-action-bar">
        <button 
          className="pay-qr-btn" 
          onClick={handleOpenQr}
          disabled={isSubmitBlocked}
          style={{
            opacity: isSubmitBlocked ? 0.45 : 1,
            cursor: isSubmitBlocked ? 'not-allowed' : 'pointer',
            filter: isSubmitBlocked ? 'grayscale(0.6)' : 'none',
            transition: 'all 0.2s ease'
          }}
          title={isSubmitBlocked ? "ไม่สามารถดำเนินการชำระเงินได้เนื่องจากสิทธิไม่ตรงกับระบบ" : "ดำเนินการชำระเงิน"}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
            <rect x="2" y="5" width="20" height="14" rx="2"/>
            <line x1="2" y1="10" x2="22" y2="10"/>
          </svg>
          <span>ดำเนินการชำระเงิน (Proceed to Payment)</span>
        </button>
        {isSubmitBlocked && (
          <div style={{
            marginTop: '10px',
            textAlign: 'center',
            fontSize: '12.5px',
            color: '#DC2626',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>ปุ่มชำระเงินถูกระงับ: กรุณาเลือกสิทธิ์ให้ตรงกับระบบ ({registeredRights}) หรือเลือก "จ่ายตรง / เงินสด"</span>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {showQrModal && (
        <ClinicModalPortal isOpen={true} onClose={() => setShowQrModal(false)} className="billing-invoice-container">
          <div className="qr-modal-card modern-checkout-modal" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="qr-modal-header">
              <div>
                <h2 className="qr-modal-title">ชำระเงินค่ารักษาพยาบาล (Payment Checkout)</h2>
                <p className="qr-modal-sub">
                  ผู้ป่วย: <strong>{activePatient.name}</strong> (HN: {activePatient.hn}) • สิทธิ: {currentRights}
                </p>
              </div>
              <button 
                type="button"
                className="modal-close-icon" 
                onClick={() => setShowQrModal(false)}
                style={{
                  width: '32px', height: '32px', borderRadius: '8px',
                  border: '1px solid #CBD5E1', background: '#FFFFFF',
                  color: '#64748B', display: 'inline-flex', alignItems: 'center',
                  justifyContent: 'center', cursor: 'pointer'
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            {receiptSent && (
              <div className="toast-receipt-sent">
                {receiptSent}
              </div>
            )}

            {/* Payment Method Selector Tabs */}
            <div className="payment-method-toggle">
              <button
                type="button"
                className={`toggle-tab-btn ${paymentMethod === 'qr' ? 'active-qr' : ''}`}
                onClick={() => setPaymentMethod('qr')}
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7"></rect>
                  <rect x="14" y="3" width="7" height="7"></rect>
                  <rect x="14" y="14" width="7" height="7"></rect>
                  <rect x="3" y="14" width="7" height="7"></rect>
                </svg>
                สแกน QR Code (PromptPay)
              </button>
              <button
                type="button"
                className={`toggle-tab-btn ${paymentMethod === 'cash' ? 'active-cash' : ''}`}
                onClick={() => setPaymentMethod('cash')}
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="6" width="20" height="12" rx="2"></rect>
                  <circle cx="12" cy="12" r="2"></circle>
                  <path d="M6 12h.01M18 12h.01"></path>
                </svg>
                ชำระด้วยเงินสด (Cash)
              </button>
            </div>

            <div className="qr-modal-body">
              {/* Left Column: Payment Input / QR Code */}
              <div className="payment-left-col">
                {paymentMethod === 'qr' ? (
                  <div className="clean-qr-container">
                    <div className="checkout-amount-pill">
                      <span className="pill-label">ยอดชำระสุทธิ</span>
                      <span className="pill-val">฿ {grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>

                    {/* QR Code Frame */}
                    <div className="clean-qr-frame" style={{ position: 'relative' }}>
                      <div style={{ filter: isQrExpired ? 'blur(4px)' : 'none', opacity: isQrExpired ? 0.35 : 1, transition: 'all 0.25s ease' }}>
                        <QRCodeSVG 
                          value={qrPayload} 
                          size={230} 
                          level="M" 
                          includeMargin={false}
                        />
                      </div>

                      {isQrExpired && (
                        <div style={{
                          position: 'absolute',
                          inset: 0,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'rgba(255, 255, 255, 0.90)',
                          borderRadius: '12px',
                          padding: '16px',
                          textAlign: 'center',
                          zIndex: 10
                        }}>
                          <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '8px' }}>
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                          </svg>
                          <div style={{ fontWeight: '800', color: '#DC2626', fontSize: '15px' }}>
                            QR Code หมดอายุแล้ว
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
                            กรุณากดปุ่มสร้าง QR Code ใหม่ด้านล่าง
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="clean-account-details">
                      <div className="account-name">ชื่อบัญชี: <strong>นาย บุญค้ำ โยลัย</strong></div>
                      
                      <div className="promptpay-number-row" style={{ marginTop: '8px' }}>
                        {isEditingPromptPay ? (
                          <div className="edit-promptpay-box" style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', background: 'var(--bg-card, #F8FAFC)', padding: '10px', borderRadius: '8px', border: '1px solid #CBD5E1' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', textAlign: 'left' }}>
                              <label style={{ fontSize: '11.5px', color: '#475569', fontWeight: '600' }}>เบอร์พร้อมเพย์ (สร้าง QR):</label>
                              <input
                                type="text"
                                value={promptPayNumber}
                                onChange={(e) => setPromptPayNumber(e.target.value)}
                                placeholder="เช่น 0885875682"
                                className="edit-phone-input"
                                style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                              />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', textAlign: 'left' }}>
                              <label style={{ fontSize: '11.5px', color: '#475569', fontWeight: '600' }}>เลขที่บัญชีธนาคาร (โอนตรง):</label>
                              <input
                                type="text"
                                value={bankAccountNumber}
                                onChange={(e) => setBankAccountNumber(e.target.value)}
                                placeholder="เช่น 020300456462"
                                className="edit-phone-input"
                                style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                              />
                            </div>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', marginTop: '4px' }}>
                              <button
                                type="button"
                                onClick={() => setIsEditingPromptPay(false)}
                                style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#475569', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                              >
                                ยกเลิก
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  handleSavePromptPay(promptPayNumber, bankAccountNumber);
                                  setIsEditingPromptPay(false);
                                }}
                                className="btn-save-phone"
                                style={{ padding: '5px 14px', borderRadius: '6px', border: 'none', background: '#2563EB', color: '#FFFFFF', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                              >
                                บันทึก
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="phone-display" style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13.5px' }}>
                              <span>พร้อมเพย์: <strong style={{ color: '#2563EB', fontFamily: 'monospace', fontSize: '14.5px' }}>{promptPayNumber}</strong></span>
                              <button 
                                type="button" 
                                onClick={() => setIsEditingPromptPay(true)}
                                className="btn-edit-phone-link"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600' }}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                                แก้ไข
                              </button>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0px',
                              fontSize: '12.5px', color: '#475569', borderTop: '1px dashed #E2E8F0', paddingTop: '6px',
                               marginTop: '2px' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <span>เลขที่บัญชี:</span>
                                <strong style={{ fontFamily: 'monospace', color: 'var(--text-primary)', fontSize: '13.5px', letterSpacing: '0.5px' }}>{bankAccountNumber}</strong>
                              </span>
                              <span style={{ fontSize: '11.5px', color: '#64748B', fontWeight: '600', padding: '2px 8px',
                                 background: '#F1F5F9', borderRadius: '4px', flexShrink: 0 }}>ธ.ออมสิน</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Countdown Timer / Warning Alert */}
                    {isQrExpired ? (
                      <div className="timeout-warning-box" style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        backgroundColor: '#FEF2F2',
                        border: '1.5px solid #EF4444',
                        borderRadius: '8px',
                        padding: '12px 14px',
                        color: '#991B1B',
                        fontSize: '13px',
                        textAlign: 'left',
                        margin: '10px 0'
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '28px',
                          height: '28px',
                          borderRadius: '8px',
                          backgroundColor: '#FEE2E2',
                          color: '#DC2626',
                          flexShrink: 0
                        }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                            <line x1="12" y1="9" x2="12" y2="13"/>
                            <line x1="12" y1="17" x2="12.01" y2="17"/>
                          </svg>
                        </div>
                        <div>
                          <strong style={{ display: 'block', color: '#B91C1C' }}>
                            การชำระเงินไม่สำเร็จหรือหมดเวลา: ระบบแจ้งเตือนและอนุญาตให้สร้าง QR Code ใหม่
                          </strong>
                          <span style={{ fontSize: '11.5px', color: '#7F1D1D' }}>
                            หมดเวลาการชำระเงิน กรุณากดปุ่มด้านล่างเพื่อสร้าง QR Code ใหม่สำหรับผู้ป่วย
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="timeout-alert" style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        background: qrSecondsLeft <= 30 ? '#FEF2F2' : '#EFF6FF',
                        color: qrSecondsLeft <= 30 ? '#DC2626' : '#1E40AF',
                        border: `1.5px solid ${qrSecondsLeft <= 30 ? '#FECACA' : '#BFDBFE'}`,
                        padding: '8px 14px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '600'
                      }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"></circle>
                          <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        <span>
                          เวลาที่เหลือสำหรับสแกน: <strong style={{ fontFamily: 'monospace', fontSize: '15px' }}>{formatSeconds(qrSecondsLeft)}</strong> นาที
                        </span>
                      </div>
                    )}

                    {/* Developer / Tester Duration Bar */}
                    <div style={{
                      margin: '10px 0',
                      padding: '8px 12px',
                      background: 'var(--bg-card, #F8FAFC)',
                      borderRadius: '8px',
                      border: '1px dashed #CBD5E1',
                      fontSize: '12px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', color: '#64748B', fontWeight: '600' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                          ปรับเวลาเพื่อทดสอบ:
                        </span>
                        <span style={{ fontSize: '11px', color: '#94A3B8' }}>(ใช้ทดสอบระบบตาม Use Case)</span>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => handleSetTestSeconds(5)}
                          style={{
                            padding: '4px 8px', borderRadius: '4px',
                            border: '1px solid #FCA5A5', background: '#FEE2E2',
                            color: '#B91C1C', fontSize: '11.5px', fontWeight: '700',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          title="ตั้งเวลา 5 วินาที เพื่อทดสอบสถานะหมดเวลาอย่างรวดเร็ว"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                          5 วิ (ทดสอบหมดเวลา)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetTestSeconds(30)}
                          style={{
                            padding: '4px 8px', borderRadius: '4px',
                            border: '1px solid #CBD5E1', background: '#FFFFFF',
                            color: '#475569', fontSize: '11.5px', fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          30 วินาที
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetTestSeconds(60)}
                          style={{
                            padding: '4px 8px', borderRadius: '4px',
                            border: '1px solid #CBD5E1', background: '#FFFFFF',
                            color: '#475569', fontSize: '11.5px', fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          60 วินาที (1 นาที)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetTestSeconds(300)}
                          style={{
                            padding: '4px 8px', borderRadius: '4px',
                            border: '1px solid #CBD5E1', background: '#FFFFFF',
                            color: '#475569', fontSize: '11.5px', fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          300 วินาที (5 นาที)
                        </button>
                      </div>
                    </div>

                    {/* Action buttons (Regenerate QR or Confirm) */}
                    {isQrExpired ? (
                      <button 
                        type="button" 
                        className="confirm-qr-btn" 
                        onClick={handleRegenerateQr}
                        style={{
                          background: '#2563EB',
                          color: '#FFFFFF',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          cursor: 'pointer'
                        }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="23 4 23 10 17 10"></polyline>
                          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                        </svg>
                        สร้าง QR Code ใหม่ (Regenerate QR Code)
                      </button>
                    ) : !isPaymentConfirmed ? (
                      <button 
                        type="button" 
                        className="confirm-qr-btn" 
                        onClick={handleConfirmPayment}
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        ยืนยันการรับชำระเงินผ่าน QR Code
                      </button>
                    ) : (
                      <div className="confirmed-badge" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        ยืนยันการรับชำระเงินเรียบร้อยแล้ว
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="clean-cash-container">
                    <div className="checkout-amount-pill">
                      <span className="pill-label">ยอดชำระสุทธิ</span>
                      <span className="pill-val">฿ {grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>

                    <div className="cash-input-group">
                      <label className="cash-input-label">จำนวนเงินสดที่ได้รับ (บาท):</label>
                      <input
                        type="number"
                        className="cash-input-field"
                        placeholder="กรอกจำนวนเงินสด..."
                        value={cashReceived}
                        onChange={(e) => setCashReceived(e.target.value)}
                      />
                    </div>

                    {/* Quick Cash Buttons */}
                    <div className="quick-cash-pills">
                      <button type="button" onClick={() => setCashReceived(grandTotal.toString())}>พอดี ({grandTotal}฿)</button>
                      <button type="button" onClick={() => setCashReceived('1000')}>1,000฿</button>
                      <button type="button" onClick={() => setCashReceived('1500')}>1,500฿</button>
                      <button type="button" onClick={() => setCashReceived('2000')}>2,000฿</button>
                    </div>

                    <div className="cash-change-box">
                      <span>เงินทอนสุทธิ:</span>
                      <span className={`change-val ${cashNumber >= grandTotal ? 'green-change' : ''}`}>
                        {cashNumber >= grandTotal ? `฿ ${changeAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '฿ 0.00'}
                      </span>
                    </div>

                    {!isPaymentConfirmed ? (
                      <button 
                        type="button"
                        className="confirm-qr-btn cash-confirm-btn" 
                        disabled={cashNumber < grandTotal}
                        onClick={handleConfirmPayment}
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        ยืนยันการรับเงินสด {cashNumber >= grandTotal && `(ทอน ฿${changeAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })})`}
                      </button>
                    ) : (
                      <div className="confirmed-badge" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        ยืนยันการรับเงินสดเรียบร้อยแล้ว
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Right Column: Order Summary / Success Confirmation */}
              <div className="payment-right-col">
                {isPaymentConfirmed ? (
                  <div className="success-status-box">
                    <div className="big-green-check" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    </div>
                    <h3 className="success-text">ชำระเงินสำเร็จแล้ว</h3>
                    <p className="success-sub">
                      บันทึกข้อมูลเข้าตารางประวัติการเงิน (Billing History) เรียบร้อยแล้ว ({paymentMethod === 'qr' ? 'PromptPay QR' : 'เงินสด'})
                    </p>

                    {/* Hidden Printable Receipt Template for html2pdf.js */}
                    <div style={{ display: 'none' }}>
                      <div ref={receiptRef} style={{ padding: '24px', fontFamily: "'IBM Plex Sans Thai', sans-serif", color: 'var(--text-primary)', background: '#FFFFFF', width: '500px' }}>
                        <div style={{ textAlign: 'center', borderBottom: '2px solid #0F172A', paddingBottom: '12px', marginBottom: '16px' }}>
                          <h2 style={{ margin: 0, fontSize: '20px' }}>คลินิกเวชกรรมทั่วไป (General Clinic)</h2>
                          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748B' }}>ใบเสร็จรับเงิน / Receipt</p>
                        </div>
                        <div style={{ fontSize: '13px', lineHeight: '1.6', marginBottom: '14px' }}>
                          <div><strong>ชื่อผู้ป่วย:</strong> {activePatient.name}</div>
                          <div><strong>HN:</strong> {activePatient.hn} | <strong>บัตรประชาชน:</strong> {formatNationalId(activePatient.nationalId)}</div>
                          <div><strong>วันที่:</strong> {activePatient.visitDate} ({activePatient.visitTime})</div>
                          <div><strong>วิธีชำระเงิน:</strong> {paymentMethod === 'qr' ? 'PromptPay QR Code' : 'เงินสด'}</div>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginBottom: '14px' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid #E2E8F0', textAlign: 'left' }}>
                              <th style={{ padding: '6px 0' }}>รายการ</th>
                              <th style={{ textAlign: 'right', padding: '6px 0' }}>จำนวนเงิน (บาท)</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td style={{ padding: '6px 0' }}>ค่าตรวจแพทย์</td>
                              <td style={{ textAlign: 'right', padding: '6px 0' }}>500.00</td>
                            </tr>
                            <tr>
                              <td style={{ padding: '6px 0' }}>ค่าบริการคลินิก</td>
                              <td style={{ textAlign: 'right', padding: '6px 0' }}>300.00</td>
                            </tr>
                            {medicationsList.map((m: any, i: number) => (
                              <tr key={i}>
                                <td style={{ padding: '6px 0' }}>{m.name} (x{m.quantity || 1})</td>
                                <td style={{ textAlign: 'right', padding: '6px 0' }}>{((m.price || 0) * (m.quantity || 1)).toFixed(2)}</td>
                              </tr>
                            ))}
                            <tr style={{ borderTop: '1px dashed #CBD5E1' }}>
                              <td style={{ padding: '6px 0' }}>ภาษี (VAT 7%)</td>
                              <td style={{ textAlign: 'right', padding: '6px 0' }}>{vatTax.toFixed(2)}</td>
                            </tr>
                            <tr style={{ borderTop: '1px dashed #CBD5E1' }}>
                              <td style={{ padding: '6px 0' }}>ยอดรวมก่อนหักสิทธิ์</td>
                              <td style={{ textAlign: 'right', padding: '6px 0' }}>{rawTotal.toFixed(2)}</td>
                            </tr>
                            {benefitResult.discountAmount > 0 && (
                              <tr style={{ color: '#16A34A', fontWeight: '600' }}>
                                <td style={{ padding: '6px 0' }}>ส่วนลดสิทธิ ({benefitResult.schemeLabel})</td>
                                <td style={{ textAlign: 'right', padding: '6px 0' }}>-{benefitResult.discountAmount.toFixed(2)}</td>
                              </tr>
                            )}
                            <tr style={{ borderTop: '2px solid #0F172A', fontWeight: 'bold' }}>
                              <td style={{ padding: '8px 0' }}>ยอดชำระสุทธิ</td>
                              <td style={{ textAlign: 'right', padding: '8px 0' }}>{grandTotal.toFixed(2)}</td>
                            </tr>
                          </tbody>
                        </table>
                        <div style={{ textAlign: 'center', fontSize: '12px', color: '#64748B', marginTop: '20px' }}>
                          ขอบคุณที่ใช้บริการ ขอให้สุขภาพแข็งแรง
                        </div>
                      </div>
                    </div>

                    <div className="receipt-btns">
                      <button 
                        type="button"
                        className="receipt-btn print-btn" 
                        onClick={handlePrintReceipt}
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="6 9 6 2 18 2 18 9"></polyline>
                          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                          <rect x="6" y="14" width="12" height="8"></rect>
                        </svg>
                        ดาวน์โหลด / พิมพ์ใบเสร็จ (PDF)
                      </button>

                      <button 
                        type="button"
                        className="receipt-btn" 
                        onClick={() => {
                          setRecipientPhone(activePatient.phone || '088-587-5682');
                          setRecipientEmail('patient.care@gmail.com');
                          setDigitalSentSuccess(false);
                          setDigitalSentSuccessMsg(null);
                          setSendingChannel(null);
                          setShowDigitalReceiptModal(true);
                        }}
                        style={{
                          background: '#0D9488',
                          color: 'white',
                          border: 'none',
                          fontWeight: '700',
                          padding: '12px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px'
                        }}
                        title="ส่งใบเสร็จดิจิทัล (SMS / Gmail) กรณีเกิดความขัดข้องในการพิมพ์ (Abnormal Path)"
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                          <span style={{ opacity: 0.5 }}>/</span>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                        </span>
                        <span>ส่งใบเสร็จดิจิทัล (SMS / Gmail)</span>
                      </button>

                      {onNavigateToDashboard && (
                        <button 
                          type="button"
                          className="receipt-btn" 
                          style={{ background: '#1D4ED8', color: 'white', border: 'none', fontWeight: '700', padding: '12px', borderRadius: '8px', cursor: 'pointer', marginTop: '4px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                          onClick={() => {
                            setShowQrModal(false);
                            onNavigateToDashboard();
                          }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="3" y1="9" x2="21" y2="9"></line>
                            <line x1="9" y1="21" x2="9" y2="9"></line>
                          </svg>
                          ไปยังหน้า Dashboard (ประวัติการเงิน)
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="checkout-summary-box">
                    <h3 className="summary-box-title" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                      </svg>
                      สรุปรายการบิล
                    </h3>
                    <div className="summary-list">
                      <div className="summary-item">
                        <span>ค่าตรวจแพทย์</span>
                        <span>฿ 500.00</span>
                      </div>
                      <div className="summary-item">
                        <span>ค่าบริการคลินิก</span>
                        <span>฿ 300.00</span>
                      </div>
                      <div className="summary-item">
                        <span>ค่ายารวม ({medicationsList.length} รายการ)</span>
                        <span>฿ {medTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="summary-item">
                        <span>ภาษี (VAT 7%)</span>
                        <span>฿ {vatTax.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="summary-item" style={{ fontWeight: '600' }}>
                        <span>ยอดรวมก่อนหักสิทธิ์</span>
                        <span>฿ {rawTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      </div>
                      {benefitResult.discountAmount > 0 && (
                        <div className="summary-item" style={{ color: '#16A34A', fontWeight: '700' }}>
                          <span>ส่วนลดสิทธิ ({benefitResult.schemeLabel})</span>
                          <span>- ฿ {benefitResult.discountAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                        </div>
                      )}
                      <div className="summary-divider"></div>
                      <div className="summary-total-item">
                        <span>ยอดรวมทั้งสิ้น</span>
                        <span className="total-highlight">฿ {grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>

                    <div className="summary-note" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}>
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                      </svg>
                      <span>เมื่อตรวจสอบยอดเงินเรียบร้อยแล้ว ให้กดปุ่ม <strong>"ยืนยันการรับชำระเงิน"</strong> เพื่อบันทึกประวัติการเงิน</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </ClinicModalPortal>
      )}

      {/* Modern Receipt Preview & Print Modal */}
      {showReceiptPreview && activePatient && (
        <ClinicModalPortal isOpen={true} onClose={() => setShowReceiptPreview(false)} className="billing-invoice-container">
          <div 
            className="receipt-preview-dialog" 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#FFFFFF', borderRadius: '16px',
              maxWidth: '780px', width: '100%', maxHeight: '92vh',
              display: 'flex', flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden'
            }}
          >
            {/* Modal Top Control Bar */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '16px 24px', borderBottom: '1px solid #E2E8F0',
              background: 'var(--bg-card, #F8FAFC)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '8px',
                  background: '#EFF6FF', color: '#2563EB',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 6 2 18 2 18 9"></polyline>
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                    <rect x="6" y="14" width="12" height="8"></rect>
                  </svg>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: 'var(--text-primary)' }}>
                    ตัวอย่างใบเสร็จรับเงิน (Receipt Preview)
                  </h3>
                  <span style={{ fontSize: '12.5px', color: '#64748B' }}>
                    ตรวจสอบความถูกต้องก่อนสั่งพิมพ์หรือบันทึกไฟล์ PDF
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleBrowserPrint}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    padding: '8px 16px', borderRadius: '8px',
                    background: '#FFFFFF', color: 'var(--text-primary)',
                    border: '1.5px solid #CBD5E1', fontSize: '13.5px',
                    fontWeight: '700', cursor: 'pointer', transition: 'all 0.15s ease'
                  }}
                  title="สั่งพิมพ์ออกเครื่องพิมพ์"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 6 2 18 2 18 9"></polyline>
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                    <rect x="6" y="14" width="12" height="8"></rect>
                  </svg>
                  สั่งพิมพ์ (Print)
                </button>

                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    padding: '8px 18px', borderRadius: '8px',
                    background: '#2563EB', color: '#FFFFFF',
                    border: 'none', fontSize: '13.5px',
                    fontWeight: '700', cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)',
                    transition: 'all 0.15s ease'
                  }}
                  title="บันทึกเอกสารเป็นไฟล์ PDF"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                  บันทึกเป็น PDF (Save PDF)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setRecipientPhone(activePatient.phone || '088-587-5682');
                    setRecipientEmail('patient.care@gmail.com');
                    setDigitalSentSuccess(false);
                    setDigitalSentSuccessMsg(null);
                    setSendingChannel(null);
                    setShowDigitalReceiptModal(true);
                  }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    padding: '8px 16px', borderRadius: '8px',
                    background: '#0D9488', color: '#FFFFFF',
                    border: 'none', fontSize: '13.5px',
                    fontWeight: '700', cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(13, 148, 136, 0.25)',
                    transition: 'all 0.15s ease'
                  }}
                  title="ส่งใบเสร็จดิจิทัลกรณีเกิดความขัดข้องในการพิมพ์ (Abnormal Path)"
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                    <span style={{ opacity: 0.5 }}>/</span>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  </span>
                  <span>ส่งใบเสร็จดิจิทัล (SMS / Gmail)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowReceiptPreview(false)}
                  style={{
                    width: '34px', height: '34px', borderRadius: '8px',
                    border: '1px solid #CBD5E1', background: '#FFFFFF',
                    color: '#64748B', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', cursor: 'pointer'
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
            </div>

            {/* Scrollable Printable Paper Sheet */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px', background: '#F1F5F9' }}>
              <div 
                ref={printableReceiptRef}
                style={{
                  background: '#FFFFFF',
                  borderRadius: '12px',
                  padding: '36px 42px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
                  maxWidth: '680px',
                  margin: '0 auto',
                  fontFamily: "'IBM Plex Sans Thai', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                  color: 'var(--text-primary)',
                  position: 'relative'
                }}
              >
                {/* Clinic Official Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0F172A', paddingBottom: '18px', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                    <div style={{
                      width: '52px', height: '52px', borderRadius: '12px',
                      background: 'linear-gradient(135deg, #1E40AF 0%, #3B82F6 100%)',
                      color: '#FFFFFF', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', boxShadow: '0 4px 10px rgba(37,99,235,0.3)'
                    }}>
                      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2v20M2 12h20"/>
                      </svg>
                    </div>
                    <div>
                      <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '0.2px' }}>
                        คลินิกเวชกรรมทั่วไป
                      </h1>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#2563EB', marginTop: '2px' }}>
                        GENERAL MEDICAL CLINIC
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '3px', lineHeight: '1.4' }}>
                        ใบอนุญาตเลขที่ 1020300456 • 123/45 ถ.สาธารณสุข แขวงคลินิก เขตสุขภาพ กรุงเทพฯ 10400<br/>
                        โทรศัพท์: 02-123-4567 • www.generalclinic.co.th
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      display: 'inline-block', padding: '4px 12px', borderRadius: '6px',
                      background: '#EFF6FF', color: '#1E40AF', fontWeight: '800',
                      fontSize: '13.5px', letterSpacing: '0.5px', border: '1px solid #BFDBFE'
                    }}>
                      ใบเสร็จรับเงิน / ต้นฉบับ
                    </div>
                    <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#64748B', marginTop: '3px' }}>
                      RECEIPT / ORIGINAL
                    </div>
                    <div style={{ fontSize: '12.5px', fontWeight: '700', color: 'var(--text-primary)', marginTop: '6px', fontFamily: 'monospace' }}>
                      เลขที่: {activePatient?.visitId ? `REC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(activePatient.visitId).padStart(4, '0')}` : 'REC-20260904-0001'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                      วันที่: {new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                </div>

                {/* Patient Information Box */}
                <div style={{
                  background: 'var(--bg-card, #F8FAFC)', border: '1px solid #E2E8F0', borderRadius: '10px',
                  padding: '14px 18px', marginBottom: '20px', display: 'grid',
                  gridTemplateColumns: '1.2fr 1fr', gap: '10px 24px', fontSize: '13px'
                }}>
                  <div>
                    <span style={{ color: '#64748B', fontWeight: '500' }}>ชื่อ-นามสกุล ผู้ป่วย: </span>
                    <strong style={{ color: 'var(--text-primary)', fontSize: '13.5px' }}>{activePatient.name}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748B', fontWeight: '500' }}>แพทย์ผู้ตรวจ: </span>
                    <strong style={{ color: 'var(--text-primary)' }}>นพ. สมเกียรติ มั่นคง (ว.45892)</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748B', fontWeight: '500' }}>เลขประจำตัว (HN): </span>
                    <span style={{ fontFamily: 'monospace', fontWeight: '700', color: '#1E40AF' }}>{activePatient.hn}</span>
                    {activePatient.nationalId && (
                      <span style={{ color: '#64748B', marginLeft: '10px' }}>
                        (เลขบัตร: {formatNationalId(activePatient.nationalId)})
                      </span>
                    )}
                  </div>
                  <div>
                    <span style={{ color: '#64748B', fontWeight: '500' }}>เลขรับบริการ (VN): </span>
                    <span style={{ fontFamily: 'monospace', fontWeight: '700', color: '#1E40AF' }}>{activePatient.vn || '-'}</span>
                  </div>
                  <div>
                    <span style={{ color: '#64748B', fontWeight: '500' }}>สิทธิการรักษา: </span>
                    <strong style={{ color: 'var(--text-primary)' }}>{currentRights}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748B', fontWeight: '500' }}>ช่องทางชำระเงิน: </span>
                    <strong style={{ color: paymentMethod === 'qr' ? '#7C3AED' : '#059669' }}>
                      {paymentMethod === 'qr' ? 'PromptPay QR Code (โอนเงิน)' : 'เงินสด (Cash)'}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748B', fontWeight: '500' }}>สถานะการชำระ: </span>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '3px',
                      background: '#DCFCE7', color: '#15803D', padding: '2px 8px',
                      borderRadius: '999px', fontWeight: '700', fontSize: '11.5px'
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                      ชำระเงินเรียบร้อยแล้ว (PAID)
                    </span>
                  </div>
                </div>

                {/* Items & Medication Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#F1F5F9', borderTop: '1px solid #CBD5E1', borderBottom: '1.5px solid #94A3B8' }}>
                      <th style={{ padding: '8px 10px', textAlign: 'center', width: '38px', color: '#334155', fontWeight: '700' }}>ลำดับ</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', color: '#334155', fontWeight: '700' }}>รายการการรักษาและยา</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center', width: '65px', color: '#334155', fontWeight: '700' }}>จำนวน</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', width: '90px', color: '#334155', fontWeight: '700' }}>ราคา/หน่วย</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', width: '100px', color: '#334155', fontWeight: '700' }}>รวมเงิน (บาท)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '8px 10px', textAlign: 'center', color: '#64748B' }}>1</td>
                      <td style={{ padding: '8px 10px' }}>
                        <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>ค่าตรวจวินิจฉัยและรักษาโดยแพทย์ (Medical Consultation)</div>
                        <div style={{ fontSize: '11.5px', color: '#64748B' }}>ตรวจประเมินร่างกายและให้คำปรึกษาทางการแพทย์</div>
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>1</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace' }}>500.00</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '600' }}>500.00</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '8px 10px', textAlign: 'center', color: '#64748B' }}>2</td>
                      <td style={{ padding: '8px 10px' }}>
                        <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>ค่าบริการทางการแพทย์และคลินิก (Clinic Service Fee)</div>
                        <div style={{ fontSize: '11.5px', color: '#64748B' }}>ค่าบริการพยาบาล คัดกรองและวัดสัญญาณชีพ</div>
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>1</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace' }}>300.00</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '600' }}>300.00</td>
                    </tr>
                    {medicationsList.map((med: any, idx: number) => {
                      const qty = Number(med.quantity) || 1;
                      const uPrice = Number(med.price || med.unit_price) || 0;
                      const lineTotal = qty * uPrice;
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '8px 10px', textAlign: 'center', color: '#64748B' }}>{idx + 3}</td>
                          <td style={{ padding: '8px 10px' }}>
                            <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{med.name}</div>
                            {med.dosage && (
                              <div style={{ fontSize: '11.5px', color: '#64748B' }}>
                                วิธีใช้: {cleanDosage(med.dosage, med.name)} {med.instructions ? `• ${cleanInstructions(med.instructions, med.name)}` : ''}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'center', fontFamily: 'monospace' }}>{qty}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace' }}>{uPrice.toFixed(2)}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '600' }}>{lineTotal.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Subtotal & Grand Total Section */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderTop: '1.5px solid #CBD5E1', paddingTop: '14px', marginBottom: '24px' }}>
                  {/* Paid Stamp Watermark */}
                  <div style={{
                    border: '2px solid #16A34A', borderRadius: '8px',
                    padding: '8px 16px', color: '#16A34A', display: 'inline-flex',
                    flexDirection: 'column', alignItems: 'center', transform: 'rotate(-3deg)'
                  }}>
                    <span style={{ fontSize: '15px', fontWeight: '900', letterSpacing: '1px' }}>ชำระเงินแล้ว / PAID</span>
                    <span style={{ fontSize: '11px', fontWeight: '600' }}>
                      {new Date().toLocaleDateString('th-TH')} • {paymentMethod === 'qr' ? 'PromptPay' : 'Cash'}
                    </span>
                  </div>

                  {/* Financial calculation */}
                  <div style={{ width: '260px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#475569', marginBottom: '4px' }}>
                      <span>รวมเป็นเงิน (Subtotal):</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: '600' }}>฿ {(medTotal + medicalServiceFee).toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#475569', marginBottom: '8px' }}>
                      <span>ภาษีมูลค่าเพิ่ม (VAT 7%):</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: '600' }}>฿ {vatTax.toFixed(2)}</span>
                    </div>
                    {discountAmount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#16A34A', fontWeight: '700', marginBottom: '8px' }}>
                        <span>ส่วนลดสิทธิ ({benefitResult.schemeLabel}):</span>
                        <span style={{ fontFamily: 'monospace' }}>-฿ {discountAmount.toFixed(2)}</span>
                      </div>
                    )}
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      borderTop: '2px solid #0F172A', paddingTop: '8px', fontSize: '15px',
                      fontWeight: '800', color: 'var(--text-primary)'
                    }}>
                      <span>ยอดชำระสุทธิ (Net Total):</span>
                      <span style={{ fontFamily: 'monospace', fontSize: '18px', color: '#1E40AF' }}>฿ {grandTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Advice & Signatures Footer */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '24px',
                  borderTop: '1px dashed #CBD5E1', paddingTop: '16px', fontSize: '12px'
                }}>
                  <div>
                    <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>คำแนะนำจากแพทย์และการใช้ยา:</strong>
                    <p style={{ margin: 0, color: '#475569', lineHeight: '1.5' }}>
                      {activePatient.doctorAdvice || 'รับประทานยาตามที่ระบุบนฉลากอย่างเคร่งครัด หากมีอาการผิดปกติหรือแพ้ยาให้หยุดยาและติดต่อคลินิกทันที'}
                    </p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ height: '36px', borderBottom: '1px solid #94A3B8', marginBottom: '6px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                      <span style={{ fontStyle: 'italic', fontFamily: 'serif', color: '#1E40AF', fontSize: '16px' }}>นภาพร สดใส</span>
                    </div>
                    <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>( ภญ. นภาพร สดใส )</div>
                    <div style={{ color: '#64748B', fontSize: '11px' }}>เภสัชกรผู้จ่ายยา / ผู้รับเงิน</div>
                  </div>
                </div>

                <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '11.5px', color: '#94A3B8' }}>
                  *** เอกสารฉบับนี้พิมพ์จากระบบสารสนเทศคลินิกเวชกรรม ขอขอบพระคุณที่ไว้วางใจใช้บริการ ***
                </div>
              </div>
            </div>
          </div>
        </ClinicModalPortal>
      )}

      {/* Abnormal Path: Digital Receipt Modal (SMS / Gmail Mock Simulation) */}
      {showDigitalReceiptModal && activePatient && (
        <ClinicModalPortal isOpen={true} onClose={() => setShowDigitalReceiptModal(false)} className="billing-invoice-container">
          <div 
            className="digital-receipt-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              maxWidth: '560px',
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Modal Header */}
            <div style={{
              padding: '16px 20px',
              background: 'linear-gradient(135deg, #1E293B 0%, #0F766E 100%)',
              color: '#FFFFFF',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'rgba(255,255,255,0.18)',
                  padding: '6px 8px',
                  borderRadius: '8px'
                }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', letterSpacing: '-0.01em' }}>
                    ส่งใบเสร็จรับเงินดิจิทัล (Digital Receipt)
                  </h3>
                  <div style={{ fontSize: '12px', color: '#E2E8F0', opacity: 0.9 }}>
                    (รองรับกรณีเครื่องพิมพ์ขัดข้อง / ขอรับใบเสร็จทางออนไลน์)
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDigitalReceiptModal(false)}
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#FFFFFF',
                  width: '28px',
                  height: '28px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Abnormal Path Notification Banner (SVG only, no emojis) */}
            <div style={{
              background: '#F0FDFA',
              borderBottom: '1px solid #CCFBF1',
              padding: '10px 18px',
              fontSize: '12.5px',
              color: '#0F766E',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0D9488" strokeWidth="2" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="16" x2="12" y2="12"/>
                <line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
              <span>
                <strong>โหมดสำรอง (Abnormal Path):</strong> ส่งลิงก์ใบเสร็จฉบับเต็มและหลักฐานการชำระเงินทาง SMS หรืออีเมล Gmail ให้ผู้ป่วยโดยตรง
              </span>
            </div>

            {/* Modal Body: Single Column with 2-Line Sending Controls */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Line 1: Phone + ส่ง SMS */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                  <span>1. หมายเลขโทรศัพท์ผู้รับ (SMS):</span>
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <div style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: '#F8FAFC',
                    border: '1.5px solid #CBD5E1',
                    borderRadius: '8px',
                    padding: '0 12px',
                    height: '40px',
                    boxSizing: 'border-box'
                  }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                    <input
                      type="tel"
                      value={recipientPhone}
                      onChange={(e) => setRecipientPhone(e.target.value)}
                      placeholder="เช่น 088-587-5682"
                      style={{
                        flex: 1,
                        border: 'none',
                        background: 'transparent',
                        fontSize: '14px',
                        color: '#1E293B',
                        fontWeight: '600',
                        outline: 'none',
                        fontFamily: 'inherit'
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    disabled={sendingChannel === 'sms'}
                    onClick={handleSendSms}
                    style={{
                      height: '40px',
                      padding: '0 18px',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#2563EB',
                      color: '#FFFFFF',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: sendingChannel === 'sms' ? 'not-allowed' : 'pointer',
                      boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      whiteSpace: 'nowrap',
                      minWidth: '105px',
                      justifyContent: 'center'
                    }}
                  >
                    {sendingChannel === 'sms' ? (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin"><path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/><path d="m16.2 16.2 2.9 2.9"/><path d="M12 18v4"/><path d="m4.9 19.1 2.9-2.9"/><path d="M2 12h4"/><path d="m4.9 4.9 2.9 2.9"/></svg>
                        <span>กำลังส่ง...</span>
                      </>
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                        <span>ส่ง SMS</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Line 2: Gmail + ส่ง Gmail */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0D9488" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  <span>2. ที่อยู่อีเมลผู้รับ (Gmail):</span>
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <div style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: '#F8FAFC',
                    border: '1.5px solid #CBD5E1',
                    borderRadius: '8px',
                    padding: '0 12px',
                    height: '40px',
                    boxSizing: 'border-box'
                  }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                    <input
                      type="email"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      placeholder="เช่น patient.care@gmail.com"
                      style={{
                        flex: 1,
                        border: 'none',
                        background: 'transparent',
                        fontSize: '14px',
                        color: '#1E293B',
                        fontWeight: '600',
                        outline: 'none',
                        fontFamily: 'inherit'
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    disabled={sendingChannel === 'gmail'}
                    onClick={handleSendGmail}
                    style={{
                      height: '40px',
                      padding: '0 18px',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#0D9488',
                      color: '#FFFFFF',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: sendingChannel === 'gmail' ? 'not-allowed' : 'pointer',
                      boxShadow: '0 2px 6px rgba(13, 148, 136, 0.25)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      whiteSpace: 'nowrap',
                      minWidth: '105px',
                      justifyContent: 'center'
                    }}
                  >
                    {sendingChannel === 'gmail' ? (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin"><path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/><path d="m16.2 16.2 2.9 2.9"/><path d="M12 18v4"/><path d="m4.9 19.1 2.9-2.9"/><path d="M2 12h4"/><path d="m4.9 4.9 2.9 2.9"/></svg>
                        <span>กำลังส่ง...</span>
                      </>
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                        <span>ส่ง Gmail</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Status Message (SVG only) */}
              {digitalSentSuccessMsg && (
                <div style={{
                  padding: '10px 14px',
                  background: '#ECFDF5',
                  border: '1px solid #A7F3D0',
                  borderRadius: '8px',
                  color: '#065F46',
                  fontSize: '13px',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                  <span>{digitalSentSuccessMsg}</span>
                </div>
              )}

              {/* Message Preview Box (All SVGs, No Emojis) */}
              <div style={{
                background: '#F8FAFC',
                borderRadius: '12px',
                padding: '14px',
                border: '1px solid #E2E8F0'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ fontSize: '12px', color: '#475569', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0F766E" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    <span>ตัวอย่างข้อความที่ผู้ป่วยจะได้รับ:</span>
                  </div>
                  <div style={{ display: 'flex', gap: '4px', background: '#E2E8F0', padding: '3px', borderRadius: '6px' }}>
                    <button
                      type="button"
                      onClick={() => setDigitalChannel('sms')}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '4px',
                        border: 'none',
                        background: digitalChannel === 'sms' ? '#FFFFFF' : 'transparent',
                        color: digitalChannel === 'sms' ? '#2563EB' : '#64748B',
                        fontSize: '11.5px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        boxShadow: digitalChannel === 'sms' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                      ตัวอย่าง SMS
                    </button>
                    <button
                      type="button"
                      onClick={() => setDigitalChannel('gmail')}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '4px',
                        border: 'none',
                        background: digitalChannel === 'gmail' ? '#FFFFFF' : 'transparent',
                        color: digitalChannel === 'gmail' ? '#0D9488' : '#64748B',
                        fontSize: '11.5px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        boxShadow: digitalChannel === 'gmail' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                      ตัวอย่าง Gmail
                    </button>
                  </div>
                </div>

                {digitalChannel === 'sms' ? (
                  <div style={{
                    background: '#FFFFFF',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    fontSize: '12.5px',
                    lineHeight: '1.6',
                    color: '#1E293B',
                    border: '1px solid #E2E8F0',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <span style={{
                        background: '#EFF6FF',
                        color: '#1D4ED8',
                        fontSize: '11px',
                        fontWeight: '800',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        border: '1px solid #DBEAFE'
                      }}>
                        General Clinic
                      </span>
                    </div>
                    <div>เรียนคุณ <strong>{activePatient.name}</strong></div>
                    <div style={{ color: '#475569', fontSize: '12px' }}>คลินิกได้รับชำระเงินค่ารักษาพยาบาลเรียบร้อยแล้ว</div>
                    <div style={{ marginTop: '6px', paddingLeft: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2"><circle cx="12" cy="12" r="3"/></svg>
                        <span><strong>HN:</strong> {activePatient.hn}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2"><circle cx="12" cy="12" r="3"/></svg>
                        <span><strong>ยอดสุทธิ:</strong> ฿{grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2"><circle cx="12" cy="12" r="3"/></svg>
                        <span><strong>สิทธิ:</strong> {selectedRights}</span>
                      </div>
                    </div>
                    <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #E2E8F0', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                      <span style={{ fontSize: '11.5px', color: '#475569' }}>ตรวจสอบใบเสร็จฉบับทางการ:</span>
                      <span style={{ color: '#2563EB', textDecoration: 'underline', fontSize: '11.5px' }}>https://general-clinic.com/receipt/REC-{activePatient.hn}</span>
                    </div>
                  </div>
                ) : (
                  <div style={{
                    background: '#FFFFFF',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    fontSize: '12.5px',
                    color: '#1E293B',
                    border: '1px solid #E2E8F0',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                  }}>
                    <div style={{ fontSize: '11.5px', color: '#64748B', borderBottom: '1px solid #F1F5F9', paddingBottom: '6px', marginBottom: '8px' }}>
                      <div><strong>จาก:</strong> General Clinic &lt;receipts@general-clinic.com&gt;</div>
                      <div><strong>ถึง:</strong> {recipientEmail || 'patient.care@gmail.com'}</div>
                      <div><strong>หัวข้อ:</strong> ใบเสร็จรับเงินค่ารักษาพยาบาล (E-Receipt) - {activePatient.name}</div>
                    </div>
                    <div style={{ lineHeight: '1.5' }}>
                      เรียนคุณ {activePatient.name},<br/>
                      ทางคลินิกขอส่งใบเสร็จรับเงินค่ารักษาพยาบาลอิเล็กทรอนิกส์ ยอดสุทธิ <strong>฿{grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong><br/>
                      <div style={{
                        marginTop: '8px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        background: '#F1F5F9',
                        borderRadius: '6px',
                        border: '1px solid #CBD5E1',
                        fontSize: '11.5px',
                        color: '#334155'
                      }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        <span>Official_Receipt_{activePatient.hn}.pdf (142 KB)</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setShowDigitalReceiptModal(false)}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '8px',
                    border: '1.5px solid #CBD5E1',
                    background: '#FFFFFF',
                    color: '#475569',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  ปิดหน้าต่าง
                </button>
              </div>
            </div>
          </div>
        </ClinicModalPortal>
      )}
    </div>
  );
}
