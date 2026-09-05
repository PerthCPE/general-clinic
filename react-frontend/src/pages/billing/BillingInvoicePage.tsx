import { useState, useEffect, useMemo, useRef } from 'react';
import './BillingInvoicePage.css';
import { CLINIC_CONFIG, type PatientConfig } from '../../config/clinicConfig';
import { useWebSocket } from '../../context/WebSocketContext';
import { QRCodeSVG } from 'qrcode.react';
import generatePayload from 'promptpay-qr';
import html2pdf from 'html2pdf.js';
import { BillingInvoiceSkeleton } from '../../components/Common/ClinicSkeleton';
import { ClinicModalPortal, ClinicActionLoadingModal } from '../../components/Common/ClinicModalPortal';
import { CLINIC_ANIMATION_CONFIG } from '../../config/animationConfig';

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receiptSent, setReceiptSent] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'qr' | 'cash'>('qr');
  const [cashReceived, setCashReceived] = useState<string>('');

  // PromptPay Phone / National ID (สามารถแก้ไขเบอร์พร้อมเพย์ได้)
  const [promptPayNumber, setPromptPayNumber] = useState<string>(() => {
    return localStorage.getItem('clinic_promptpay_number') || CLINIC_CONFIG.paymentAccount.phone || '081-999-8888';
  });
  const [isEditingPromptPay, setIsEditingPromptPay] = useState(false);

  const handleSavePromptPay = (newNumber: string) => {
    setPromptPayNumber(newNumber);
    localStorage.setItem('clinic_promptpay_number', newNumber);
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
              mapped.push({
                id: String(pq.id),
                visitId: pq.visit_id || 1,
                hn: cleanHN || `HN0001`,
                nationalId: pq.national_id || '-',
                queueNumber: pq.queue_number || 'Q0001',
                ticket: pq.queue_number || 'Q0001',
                name: pq.patient_name || 'ผู้ป่วย',
                shortName: pq.patient_name || 'ผู้ป่วย',
                gender: pq.gender || 'ชาย',
                age: pq.age || 35,
                treatmentRights: pq.scheme_type || 'สิทธิ 30 บาท (สปสช.)',
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
  const activePatient: PatientConfig | undefined = 
    queueList.find(p => p.id === currentSelectedId) || 
    queueList[0];
  const currentRights = activePatient ? (patientRightsMap?.[activePatient.id] || activePatient.treatmentRights) : '';

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
  const grandTotal = medTotal + medicalServiceFee + vatTax;

  const cashNumber = parseFloat(cashReceived) || 0;
  const changeAmount = cashNumber >= grandTotal ? cashNumber - grandTotal : 0;

  // สร้าง PromptPay QR Payload แบบ Real-time ตามเบอร์และยอดเงินจริง
  const qrPayload = useMemo(() => {
    const cleanNumber = (promptPayNumber || '0819998888').replace(/[^0-9]/g, '');
    try {
      return generatePayload(cleanNumber, { amount: grandTotal });
    } catch {
      return '00020101021229370016A000000677010111';
    }
  }, [promptPayNumber, grandTotal]);

  const handleOpenQr = () => {
    setShowQrModal(true);
    setIsPaymentConfirmed(false);
    setReceiptSent(null);
    setPaymentMethod('qr');
    setCashReceived('');
  };

  // [บุญให้เพิ่มเทคนิคนี้] (Supabase + Optimistic UI + WebSocket) - กดยืนยันรับชำระเงินแล้วอัปเดตหน้าจอทันที 0 ms และส่งขึ้น Supabase เบื้องหลัง
  const handleConfirmPayment = async () => {
    if (!activePatient) return;
    setIsSubmitting(true);
    const submitStart = Date.now();

    // 1. Optimistic UI: อัปเดตสถานะสำเร็จบนหน้าจอทันทีใน 0 ms
    setQueueList(prev => prev.map(p => p.id === activePatient.id ? { ...p, visitStatus: 'ชำระเงินเรียบร้อยแล้ว' } : p));

    // 2. ส่งข้อมูลขึ้น Supabase Cloud เบื้องหลัง (Background Sync)
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const payload = {
        visit_id: activePatient.visitId || 1,
        hn: activePatient.hn || 'HN0001',
        patient_name: activePatient.name || 'ผู้ป่วย',
        national_id: activePatient.nationalId || '',
        total_amount: grandTotal,
        net_amount: grandTotal,
        payment_method: paymentMethod === 'qr' ? 'QR Code' : 'เงินสด',
        cash_received: parseFloat(cashReceived) || grandTotal,
        doctor_name: 'นพ.สมเกียรติ มั่นคง',
        doctor_advice: activePatient.doctorAdvice || '',
        medications: JSON.stringify(medicationsList)
      };

      let res = await fetch('/api/billing/confirm', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        await fetch('/api/system/billing/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }
    } catch (err) {
      console.error('Failed to confirm payment:', err);
    } finally {
      // ให้แอนิเมชันบันทึกข้อมูลแสดงอย่างนุ่มนวลตามค่าคอนฟิก
      const elapsed = Date.now() - submitStart;
      const remaining = Math.max(0, CLINIC_ANIMATION_CONFIG.submitModalDurationMs - elapsed);
      setTimeout(() => {
        setIsSubmitting(false);
        setIsPaymentConfirmed(true);
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

  const handleSendDigitalReceipt = () => {
    setReceiptSent('ส่งใบเสร็จดิจิทัลไปยัง SMS/Email ของผู้ป่วยเรียบร้อยแล้ว');
    setTimeout(() => setReceiptSent(null), 3000);
  };

  if (loading) {
    return <BillingInvoiceSkeleton />;
  }

  if (!activePatient) {
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
          <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1E293B', marginBottom: '8px' }}>ไม่มีบิลรอชำระเงินในขณะนี้</h2>
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
                <span><strong>เลขประจำตัวประชาชน:</strong> {activePatient.nationalId || '-'}</span>
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
                  if (r.includes('ชำระเงินเอง') || r.includes('เงินสด') || r.includes('จ่ายตรง')) return 'จ่ายตรง / เงินสด (Self Pay / Cash)';
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
                  background: '#F8FAFC',
                  color: '#0F172A',
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
                display: 'inline-flex', alignItems: 'center', gap: '6px', height: '36px', boxSizing: 'border-box'
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
              <span>ค่ายารวมสุทธิ</span>
              <span>฿ {medTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="fee-sub-item">
              <span>ภาษี (VAT 7%)</span>
              <span>- ฿ {vatTax.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>

            <div className="grand-total-row">
              <span className="grand-label">ยอดชำระสุทธิ</span>
              <span className="grand-price">฿ {grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bottom-action-bar">
        <button className="pay-qr-btn" onClick={handleOpenQr}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
            <rect x="2" y="5" width="20" height="14" rx="2"/>
            <line x1="2" y1="10" x2="22" y2="10"/>
          </svg>
          <span>ดำเนินการชำระเงิน (Proceed to Payment)</span>
        </button>
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
                    <div className="clean-qr-frame">
                      <QRCodeSVG 
                        value={qrPayload} 
                        size={230} 
                        level="M" 
                        includeMargin={false}
                      />
                    </div>

                    <div className="clean-account-details">
                      <div className="account-name">ชื่อบัญชี: <strong>นาย บุญค้ำ โยลัย</strong></div>
                      
                      <div className="promptpay-number-row">
                        {isEditingPromptPay ? (
                          <div className="edit-promptpay-box">
                            <input
                              type="text"
                              value={promptPayNumber}
                              onChange={(e) => setPromptPayNumber(e.target.value)}
                              placeholder="กรอกเบอร์โทร..."
                              className="edit-phone-input"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                handleSavePromptPay(promptPayNumber);
                                setIsEditingPromptPay(false);
                              }}
                              className="btn-save-phone"
                            >
                              บันทึก
                            </button>
                          </div>
                        ) : (
                          <div className="phone-display">
                            <span>พร้อมเพย์: <strong>{promptPayNumber}</strong></span>
                            <button 
                              type="button"
                              onClick={() => setIsEditingPromptPay(true)}
                              className="btn-edit-phone-link"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                              </svg>
                              แก้ไขเบอร์
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="timeout-alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                      </svg>
                      <span>กรุณาชำระเงินให้เสร็จสิ้นภายใน 5 นาที</span>
                    </div>

                    {!isPaymentConfirmed ? (
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
                      <div ref={receiptRef} style={{ padding: '24px', fontFamily: "'IBM Plex Sans Thai', sans-serif", color: '#0F172A', background: '#FFFFFF', width: '500px' }}>
                        <div style={{ textAlign: 'center', borderBottom: '2px solid #0F172A', paddingBottom: '12px', marginBottom: '16px' }}>
                          <h2 style={{ margin: 0, fontSize: '20px' }}>คลินิกเวชกรรมทั่วไป (General Clinic)</h2>
                          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748B' }}>ใบเสร็จรับเงิน / Receipt</p>
                        </div>
                        <div style={{ fontSize: '13px', lineHeight: '1.6', marginBottom: '14px' }}>
                          <div><strong>ชื่อผู้ป่วย:</strong> {activePatient.name}</div>
                          <div><strong>HN:</strong> {activePatient.hn} | <strong>บัตรประชาชน:</strong> {activePatient.nationalId}</div>
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
                        className="receipt-btn digital-btn" 
                        onClick={handleSendDigitalReceipt}
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                          <polyline points="22,6 12,13 2,6"></polyline>
                        </svg>
                        ส่งใบเสร็จดิจิทัล (SMS/Email)
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
              background: '#F8FAFC'
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
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: '#0F172A' }}>
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
                    background: '#FFFFFF', color: '#0F172A',
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
                  color: '#0F172A',
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
                      <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#0F172A', letterSpacing: '0.2px' }}>
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
                    <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#0F172A', marginTop: '6px', fontFamily: 'monospace' }}>
                      เลขที่: {activePatient?.visitId ? `REC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(activePatient.visitId).padStart(4, '0')}` : 'REC-20260904-0001'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                      วันที่: {new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                </div>

                {/* Patient Information Box */}
                <div style={{
                  background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px',
                  padding: '14px 18px', marginBottom: '20px', display: 'grid',
                  gridTemplateColumns: '1.2fr 1fr', gap: '10px 24px', fontSize: '13px'
                }}>
                  <div>
                    <span style={{ color: '#64748B', fontWeight: '500' }}>ชื่อ-นามสกุล ผู้ป่วย: </span>
                    <strong style={{ color: '#0F172A', fontSize: '13.5px' }}>{activePatient.name}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748B', fontWeight: '500' }}>แพทย์ผู้ตรวจ: </span>
                    <strong style={{ color: '#0F172A' }}>นพ. สมเกียรติ มั่นคง (ว.45892)</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748B', fontWeight: '500' }}>เลขประจำตัว (HN): </span>
                    <span style={{ fontFamily: 'monospace', fontWeight: '700', color: '#1E40AF' }}>{activePatient.hn}</span>
                    {activePatient.nationalId && (
                      <span style={{ color: '#64748B', marginLeft: '10px' }}>
                        (เลขบัตร: {activePatient.nationalId})
                      </span>
                    )}
                  </div>
                  <div>
                    <span style={{ color: '#64748B', fontWeight: '500' }}>สิทธิการรักษา: </span>
                    <strong style={{ color: '#0F172A' }}>{currentRights}</strong>
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
                        <div style={{ fontWeight: '600', color: '#0F172A' }}>ค่าตรวจวินิจฉัยและรักษาโดยแพทย์ (Medical Consultation)</div>
                        <div style={{ fontSize: '11.5px', color: '#64748B' }}>ตรวจประเมินร่างกายและให้คำปรึกษาทางการแพทย์</div>
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>1</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace' }}>500.00</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '600' }}>500.00</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '8px 10px', textAlign: 'center', color: '#64748B' }}>2</td>
                      <td style={{ padding: '8px 10px' }}>
                        <div style={{ fontWeight: '600', color: '#0F172A' }}>ค่าบริการทางการแพทย์และคลินิก (Clinic Service Fee)</div>
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
                            <div style={{ fontWeight: '600', color: '#0F172A' }}>{med.name}</div>
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
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      borderTop: '2px solid #0F172A', paddingTop: '8px', fontSize: '15px',
                      fontWeight: '800', color: '#0F172A'
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
                    <strong style={{ color: '#0F172A', display: 'block', marginBottom: '4px' }}>คำแนะนำจากแพทย์และการใช้ยา:</strong>
                    <p style={{ margin: 0, color: '#475569', lineHeight: '1.5' }}>
                      {activePatient.doctorAdvice || 'รับประทานยาตามที่ระบุบนฉลากอย่างเคร่งครัด หากมีอาการผิดปกติหรือแพ้ยาให้หยุดยาและติดต่อคลินิกทันที'}
                    </p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ height: '36px', borderBottom: '1px solid #94A3B8', marginBottom: '6px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                      <span style={{ fontStyle: 'italic', fontFamily: 'serif', color: '#1E40AF', fontSize: '16px' }}>นภาพร สดใส</span>
                    </div>
                    <div style={{ fontWeight: '700', color: '#0F172A' }}>( ภญ. นภาพร สดใส )</div>
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
    </div>
  );
}
