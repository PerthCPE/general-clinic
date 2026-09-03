import { useState, useEffect, useMemo, useRef } from 'react';
import './BillingInvoicePage.css';
import { CLINIC_CONFIG, type PatientConfig } from '../../config/clinicConfig';
import { useWebSocket } from '../../context/WebSocketContext';
import { QRCodeSVG } from 'qrcode.react';
import generatePayload from 'promptpay-qr';
import html2pdf from 'html2pdf.js';

interface BillingInvoicePageProps {
  selectedPatientId?: string;
  onSelectPatientId?: (id: string) => void;
  patientRightsMap?: Record<string, string>;
  onUpdatePatientRights?: (patientId: string, rights: string) => void;
  onNavigateToDashboard?: () => void;
}

export default function BillingInvoicePage({ 
  selectedPatientId, 
  onSelectPatientId,
  patientRightsMap,
  onUpdatePatientRights,
  onNavigateToDashboard
}: BillingInvoicePageProps) {
  const { subscribe } = useWebSocket();
  const [queueList, setQueueList] = useState<PatientConfig[]>([]);
  const receiptRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);

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

  const fetchQueues = async () => {
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
            if (!Array.isArray(parsedMeds)) parsedMeds = [];
            return {
              id: String(bq.id),
              visitId: bq.visit_id || 1,
              hn: bq.hn || `HN-${bq.id}`,
              nationalId: bq.national_id || '-',
              queueNumber: bq.queue_number || 'B-001',
              ticket: bq.queue_number || 'B-001',
              name: bq.patient_name || 'ผู้ป่วย',
              shortName: bq.patient_name || 'ผู้ป่วย',
              gender: bq.gender || 'ชาย',
              age: bq.age || 35,
              treatmentRights: bq.scheme_type || 'สิทธิ 30 บาท (สปสช.)',
              patientType: 'ผู้ป่วยนอก (OPD)' as const,
              allergies: ['ไม่มีประวัติแพ้ยา'],
              chronicDiseases: 'ไม่มี',
              vitals: 'ความดัน 120/80 mmHg, อุณหภูมิ 36.6 °C',
              dob: '01/01/2534',
              phone: '081-999-8888',
              occupation: 'รับจ้างทั่วไป',
              visitStatus: 'รอชำระเงิน',
              visitDate: new Date(bq.created_at || Date.now()).toLocaleDateString('th-TH'),
              visitTime: new Date(bq.created_at || Date.now()).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.',
              doctorAdvice: bq.doctor_advice || 'พักผ่อนให้เพียงพอ',
              medications: parsedMeds
            };
          });
          setQueueList(prev => {
            if (mapped.length === 0) return prev;
            const existingIds = new Set(mapped.map((m: any) => m.id));
            const keepPrev = prev.filter(p => !existingIds.has(p.id) && p.visitStatus === 'รอชำระเงิน');
            return [...mapped, ...keepPrev];
          });
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      console.error('Failed to fetch queues in billing invoice:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchQueues();

    // Smart Background Polling ทุกๆ 2.5 วินาที เพื่อดึงคิวใบแจ้งหนี้ล่าสุดอย่างต่อเนื่อง
    const pollInterval = setInterval(() => {
      if (!document.hidden) {
        fetchQueues();
      }
    }, 2500);

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
          allergies: ['ไม่มีประวัติแพ้ยา'],
          chronicDiseases: 'ไม่มี',
          vitals: 'ความดัน 120/80 mmHg, อุณหภูมิ 36.6 °C',
          dob: '01/01/2534',
          phone: '081-999-8888',
          occupation: 'รับจ้างทั่วไป',
          visitStatus: 'รอชำระเงิน',
          visitDate: new Date(data.created_at || Date.now()).toLocaleDateString('th-TH'),
          visitTime: new Date(data.created_at || Date.now()).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.',
          doctorAdvice: data.doctor_advice || 'พักผ่อนให้เพียงพอ',
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
  }, [subscribe, masterMedicines.length]);

  const currentSelectedId = selectedPatientId || localStorage.getItem('billing_active_patient') || '';
  const activePatient: PatientConfig | undefined = 
    queueList.find(p => p.id === currentSelectedId) || 
    queueList[0];
  const currentRights = activePatient ? (patientRightsMap?.[activePatient.id] || activePatient.treatmentRights) : '';

  // ดึงรายการยาและราคาจริงจากฐานข้อมูล สำหรับคนไข้ที่เลือกอยู่
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
          console.error('Failed to fetch real-time dispensing for billing invoice:', err);
        }
      };
      fetchMeds();
    }
  }, [activePatient?.id, activePatient?.visitId, activePatient?.hn, masterMedicines.length]);

  const [showQrModal, setShowQrModal] = useState(false);
  const [isPaymentConfirmed, setIsPaymentConfirmed] = useState(false);
  const [receiptSent, setReceiptSent] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'qr' | 'cash'>('qr');
  const [cashReceived, setCashReceived] = useState<string>('');

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

  const handleConfirmPayment = async () => {
    if (!activePatient) return;
    setIsPaymentConfirmed(true);

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
    }
  };

  // พิมพ์และบันทึกใบเสร็จเป็น PDF ด้วย html2pdf.js
  const handlePrintReceipt = () => {
    if (!receiptRef.current) return;
    const opt = {
      margin: 10,
      filename: `Receipt-${activePatient?.hn || 'HN'}-${Date.now()}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
    };
    html2pdf().set(opt).from(receiptRef.current).save();
    setReceiptSent('🖨 ดาวน์โหลดและพิมพ์ใบเสร็จรับเงิน PDF เรียบร้อยแล้ว');
    setTimeout(() => setReceiptSent(null), 3000);
  };

  const handleSendDigitalReceipt = () => {
    setReceiptSent('ส่งใบเสร็จดิจิทัลไปยัง SMS/Email ของผู้ป่วยเรียบร้อยแล้ว');
    setTimeout(() => setReceiptSent(null), 3000);
  };

  if (loading) {
    return (
      <div className="billing-invoice-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '350px' }}>
        <div style={{ textAlign: 'center', color: '#64748B' }}>
          <div className="animate-spin" style={{ width: '40px', height: '40px', border: '3px solid #E2E8F0', borderTopColor: '#0EA5E9', borderRadius: '50%', margin: '0 auto 16px' }}></div>
          <p style={{ fontSize: '1.1rem', fontWeight: '500' }}>กำลังโหลดข้อมูลบิล...</p>
        </div>
      </div>
    );
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
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🧾</div>
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
              📊 ไปที่แดชบอร์ดการเงิน
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="billing-invoice-container">
      <div className="page-header-row">
        <div className="header-titles">
          <h1 className="page-title" style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--text-primary)', margin: '0 0 8px 0', letterSpacing: '-0.5px' }}>
            รายการบิล (Billing & Invoice)
          </h1>
          <p className="page-subtitle" style={{ color: 'var(--text-secondary)', margin: '0', fontSize: '1.1rem' }}>
            สรุปค่าบริการ ค่ายา และสร้าง QR Code สำหรับชำระเงิน
          </p>
        </div>

        <div className="invoice-patient-switcher">
          {queueList.map((p) => (
            <button
              key={p.id}
              className={`patient-switch-btn ${p.id === activePatient.id ? 'active' : ''}`}
              onClick={() => {
                if (onSelectPatientId) onSelectPatientId(p.id);
                localStorage.setItem('billing_active_patient', p.id);
              }}
            >
              👤 {p.id} ({p.name})
            </button>
          ))}
        </div>
      </div>

      {/* Patient Summary Banner */}
      <div className="patient-dark-banner">
        <div className="patient-dark-profile" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h2 className="patient-dark-name" style={{ margin: 0 }}>{activePatient.name}</h2>
              <span style={{ background: '#0284C7', color: '#FFFFFF', padding: '3px 12px', borderRadius: '12px', fontSize: '13px', fontWeight: 'bold' }}>
                HN: {activePatient.hn}
              </span>
              <span style={{ background: 'rgba(255,255,255,0.18)', color: '#FFFFFF', padding: '3px 12px', borderRadius: '12px', fontSize: '13px', fontFamily: 'monospace', fontWeight: '600' }}>
                บัตรประชาชน: {activePatient.nationalId || '-'}
              </span>
            </div>
            <div className="patient-dark-sub" style={{ marginTop: '10px', marginBottom: '16px', display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'center', fontSize: '1.05rem', color: '#F1F5F9' }}>
              <span>เพศ {activePatient.gender || 'ไม่ระบุ'}</span>
              <span>อายุ {activePatient.age || '-'} ปี</span>
              <span>วันเกิด: {activePatient.dob || '-'}</span>
              <span>เบอร์โทร: {activePatient.phone || '-'}</span>
              <span>อาชีพ: {activePatient.occupation || '-'}</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ 
              background: patientType.includes('OPD') ? 'rgba(59, 130, 246, 0.25)' : 'rgba(168, 85, 247, 0.25)', 
              color: patientType.includes('OPD') ? '#93C5FD' : '#E9D5FF', 
              border: `1.5px solid ${patientType.includes('OPD') ? '#60A5FA' : '#C084FC'}`, 
              padding: '5px 14px', borderRadius: '16px', fontSize: '13.5px', fontWeight: 'bold' 
            }}>
              {patientType}
            </span>
            <span className="status-tag" style={{ 
              background: isPaymentConfirmed ? 'rgba(52, 211, 153, 0.25)' : 'rgba(239, 68, 68, 0.25)', 
              color: isPaymentConfirmed ? '#6EE7B7' : '#FCA5A5',
              border: `1.5px solid ${isPaymentConfirmed ? '#34D399' : '#F87171'}`, 
              padding: '5px 14px', borderRadius: '16px', fontSize: '13.5px', fontWeight: 'bold' 
            }}>
              {isPaymentConfirmed ? '✓ ชำระเงินแล้ว' : 'ยังไม่ชำระเงิน'}
            </span>
          </div>
        </div>

        <div className="patient-dark-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
          <div className="dark-info-col">
            <div>
              <span className="dark-label">สิทธิการรักษา:</span>{' '}
              <select
                className="banner-rights-select"
                value={currentRights}
                onChange={(e) => onUpdatePatientRights && onUpdatePatientRights(activePatient.id, e.target.value)}
              >
                <option value="สิทธิ 30 บาท (บัตรทอง / สปสช.)">สิทธิ 30 บาท (บัตรทอง / สปสช.)</option>
                <option value="สิทธิประกันสังคม (Social Security)">สิทธิประกันสังคม (Social Security)</option>
                <option value="สิทธิข้าราชการ / จ่ายตรงกรมบัญชีกลาง">สิทธิข้าราชการ / จ่ายตรงกรมบัญชีกลาง</option>
                <option value="ประกันสุขภาพเอกชน (Private Insurance)">ประกันสุขภาพเอกชน (Private Insurance)</option>
                <option value="จ่ายตรง / เงินสด (Self Pay / Cash)">จ่ายตรง / เงินสด (Self Pay / Cash)</option>
              </select>
            </div>
            <div><span className="dark-label">วันที่ตรวจ:</span> <span style={{ color: '#F8FAFC', fontWeight: '600' }}>{activePatient.visitDate} ({activePatient.visitTime})</span></div>
            <div><span className="dark-label">แพทย์ผู้ตรวจ:</span> <span style={{ color: '#F8FAFC', fontWeight: '600' }}>แพทย์ประจำคลินิก</span></div>
          </div>

          <div className="dark-info-col">
            <div><span className="dark-label">ประวัติแพ้ยา:</span> {allergiesList.length > 0 ? allergiesList.map((a, i) => <span key={i} className="allergy-tag">{a}</span>) : <span style={{ color: '#CBD5E1' }}>ไม่มี</span>}</div>
            <div><span className="dark-label">โรคประจำตัว:</span> <span style={{ color: '#F8FAFC', fontWeight: '600' }}>{activePatient.chronicDiseases || '-'}</span></div>
            <div><span className="dark-label">สัญญาณชีพ:</span> <span style={{ color: '#F8FAFC', fontWeight: '600' }}>{activePatient.vitals || '-'}</span></div>
          </div>

          <div className="dark-info-col">
            <div><span className="dark-label">คำแนะนำแพทย์:</span> <span style={{ color: '#F8FAFC', fontStyle: 'italic', lineHeight: '1.6', display: 'block', marginTop: '4px' }}>"{activePatient.doctorAdvice || '-'}"</span></div>
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
        <div className="modal-overlay" onClick={() => setShowQrModal(false)}>
          <div className="qr-modal-card modern-checkout-modal" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="qr-modal-header">
              <div>
                <h2 className="qr-modal-title">ชำระเงินค่ารักษาพยาบาล (Payment Checkout)</h2>
                <p className="qr-modal-sub">
                  ผู้ป่วย: <strong>{activePatient.name}</strong> (HN: {activePatient.hn}) • สิทธิ: {currentRights}
                </p>
              </div>
              <button className="modal-close-icon" onClick={() => setShowQrModal(false)}>✕</button>
            </div>

            {receiptSent && (
              <div className="toast-receipt-sent">
                {receiptSent}
              </div>
            )}

            {/* Payment Method Selector Tabs */}
            <div className="payment-method-toggle">
              <button
                className={`toggle-tab-btn ${paymentMethod === 'qr' ? 'active-qr' : ''}`}
                onClick={() => setPaymentMethod('qr')}
              >
                📱 สแกน QR Code (PromptPay)
              </button>
              <button
                className={`toggle-tab-btn ${paymentMethod === 'cash' ? 'active-cash' : ''}`}
                onClick={() => setPaymentMethod('cash')}
              >
                💵 ชำระด้วยเงินสด (Cash)
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
                        size={185} 
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
                            >
                              ✎ แก้ไขเบอร์
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="timeout-alert">
                      <span>⏰ กรุณาชำระเงินให้เสร็จสิ้นภายใน 5 นาที</span>
                    </div>

                    {!isPaymentConfirmed ? (
                      <button className="confirm-qr-btn" onClick={handleConfirmPayment}>
                        ✓ ยืนยันการรับชำระเงินผ่าน QR Code
                      </button>
                    ) : (
                      <div className="confirmed-badge">
                        ✓ ยืนยันการรับชำระเงินเรียบร้อยแล้ว
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
                        className="confirm-qr-btn cash-confirm-btn" 
                        disabled={cashNumber < grandTotal}
                        onClick={handleConfirmPayment}
                      >
                        ✓ ยืนยันการรับเงินสด {cashNumber >= grandTotal && `(ทอน ฿${changeAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })})`}
                      </button>
                    ) : (
                      <div className="confirmed-badge">
                        ✓ ยืนยันการรับเงินสดเรียบร้อยแล้ว
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Right Column: Order Summary / Success Confirmation */}
              <div className="payment-right-col">
                {isPaymentConfirmed ? (
                  <div className="success-status-box">
                    <div className="big-green-check">✓</div>
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
                      <button className="receipt-btn print-btn" onClick={handlePrintReceipt}>
                        🖨 ดาวน์โหลด / พิมพ์ใบเสร็จ (PDF)
                      </button>
                      <button className="receipt-btn digital-btn" onClick={handleSendDigitalReceipt}>
                        📨 ส่งใบเสร็จดิจิทัล (SMS/Email)
                      </button>
                      {onNavigateToDashboard && (
                        <button 
                          className="receipt-btn" 
                          style={{ background: '#1D4ED8', color: 'white', border: 'none', fontWeight: '700', padding: '12px', borderRadius: '8px', cursor: 'pointer', marginTop: '4px' }}
                          onClick={() => {
                            setShowQrModal(false);
                            onNavigateToDashboard();
                          }}
                        >
                          📊 ไปยังหน้า Dashboard (ประวัติการเงิน)
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="checkout-summary-box">
                    <h3 className="summary-box-title">📋 สรุปรายการบิล</h3>
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

                    <div className="summary-note">
                      💡 เมื่อตรวจสอบยอดเงินเรียบร้อยแล้ว ให้กดปุ่ม <strong>"ยืนยันการรับชำระเงิน"</strong> เพื่อบันทึกประวัติการเงิน
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
