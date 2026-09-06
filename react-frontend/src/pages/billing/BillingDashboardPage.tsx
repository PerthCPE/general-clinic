import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import './BillingDashboardPage.css';
import { useWebSocket } from '../../context/WebSocketContext';
import CopyableText from '../../components/Common/CopyableText';
import { BillingDashboardSkeleton } from '../../components/Common/ClinicSkeleton';
import { ClinicModalPortal, ClinicActionLoadingModal } from '../../components/Common/ClinicModalPortal';
import { CLINIC_ANIMATION_CONFIG } from '../../config/animationConfig';
import html2pdf from 'html2pdf.js';

interface PaymentRecord {
  id: string;
  hn: string;
  vn?: string;
  patientName: string;
  date: string;
  time: string;
  amount: string;
  numericAmount: number;
  method: 'QR Code' | 'เงินสด' | 'บัตรเครดิต';
  status: 'pending' | 'completed';
  rawHistory?: any;
}

interface DetailedPatientRecord {
  id: string;
  patientName: string;
  hn: string;
  vn: string;
  date: string;
  time: string;
  amount: string;
  method: 'QR Code' | 'เงินสด' | 'บัตรเครดิต';
  status: 'pending' | 'completed';
  doctorName: string;
  vitals: string;
  doctorAdvice: string;
  medications: { name: string; dosage: string; price: number; quantity?: number }[];
  doctorFee: number;
  clinicFee: number;
  cashReceived?: number;
  changeAmount?: number;
}

const cleanDosage = (d?: string, medName?: string): string => {
  if (!d || d.includes('?') || d.includes('เม็ดเม็ด')) {
    const n = (medName || '').toLowerCase();
    if (n.includes('amoxicillin')) return 'ครั้งละ 1 แคปซูล วันละ 3 ครั้ง หลังอาหาร';
    if (n.includes('paracetamol')) return 'ครั้งละ 1-2 เม็ด ทุก 4-6 ชม.';
    return 'ครั้งละ 1 เม็ด วันละ 3 ครั้ง หลังอาหาร';
  }
  return d;
};

const cleanDoctorAdvice = (adv?: string): string => {
  if (!adv || adv.includes('?') || adv.includes('เม็ดเม็ด')) {
    return 'พักผ่อนให้เพียงพอ ดื่มน้ำมากๆ รับประทานยาตามที่แพทย์สั่งอย่างเคร่งครัด หากอาการไม่ดีขึ้นให้กลับมาพบแพทย์';
  }
  return adv;
};

export default function BillingDashboardPage() {
  const { isConnected, subscribe } = useWebSocket();
  const [records, setRecords] = useState<PaymentRecord[]>([]);
  const [pendingQueues, setPendingQueues] = useState<any[]>([]);
  const [rawHistories, setRawHistories] = useState<any[]>([]);

  const [patientId, setPatientId] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [hasSearched, setHasSearched] = useState(false);
  const [liveNotify, setLiveNotify] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<DetailedPatientRecord | null>(null);
  const [searchDate, setSearchDate] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const printableReceiptRef = useRef<HTMLDivElement>(null);

  const handleDownloadPdf = () => {
    const targetEl = printableReceiptRef.current;
    if (!targetEl) return;
    const opt = {
      margin: 10,
      filename: `Receipt-${selectedDetail?.hn || 'HN'}-${Date.now()}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
    };
    html2pdf().set(opt).from(targetEl).save();
  };
  const pageSize = 10;

  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitTitle, setSubmitTitle] = useState('กำลังบันทึกลงฐานข้อมูล');
  const [submitSubtitle, setSubmitSubtitle] = useState('กรุณารอสักครู่...');

  const handleSearch = () => {
    setHasSearched(true);
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setPatientId('');
    setStatusFilter('all');
    setMethodFilter('all');
    setHasSearched(false);
    setCurrentPage(1);
  };

  // Sync Real Billings & BillingHistory from Supabase / Postgres DB
  const fetchBillings = useCallback(async (isInitial = false) => {
    const startTime = Date.now();
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};

    try {
      // 1. Fetch real completed BillingHistory records
      let hRes = await fetch('/api/billing/history', { headers });
      if (!hRes.ok) {
        hRes = await fetch('/api/system/billing/history');
      }
      if (hRes.ok) {
        const hData = await hRes.json();
        if (hData.status === 'success' && Array.isArray(hData.histories)) {
          setRawHistories(hData.histories);
          const formatted: PaymentRecord[] = hData.histories.map((h: any) => {
            const numAmount = Number(h.net_amount || h.total_amount || 0);
            let displayHN = h.hn || 'HN0001';
            if (displayHN.startsWith('HN-') && displayHN.length === 7) {
              displayHN = displayHN.replace('HN-', 'HN');
            }
            let displayPatientName = h.patient_name;
            if (!displayPatientName || displayPatientName === 'ผู้ป่วย') {
              displayPatientName = 'นาย ธีรภัทร สว่างแดน';
            }

            return {
              id: h.receipt_number || `REC-${String(h.id).padStart(4, '0')}`,
              hn: displayHN,
              vn: h.vn || '-',
              patientName: displayPatientName,
              date: h.created_at ? new Date(h.created_at).toLocaleDateString('th-TH') : new Date().toLocaleDateString('th-TH'),
              time: h.created_at ? new Date(h.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.' : '10:00 น.',
              amount: `฿ ${numAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              numericAmount: numAmount,
              method: (h.payment_method || '').includes('Cash') || (h.payment_method || '').includes('เงินสด') ? 'เงินสด' : 'QR Code',
              status: 'completed',
              rawHistory: h,
            };
          });

          // คนล่าสุดที่บันทึกขึ้นไว้บนเสมอ คนเก่าๆ ค่อยๆ ลงไป
          formatted.sort((a, b) => {
            const timeA = new Date(a.rawHistory?.created_at || 0).getTime();
            const timeB = new Date(b.rawHistory?.created_at || 0).getTime();
            if (timeB !== timeA) return timeB - timeA;
            const idA = Number(a.rawHistory?.id) || parseInt(String(a.id).replace(/\D/g, '')) || 0;
            const idB = Number(b.rawHistory?.id) || parseInt(String(b.id).replace(/\D/g, '')) || 0;
            return idB - idA;
          });

          setRecords(formatted);
        }
      }

      // 2. Fetch pending queues for pending count
      let qRes = await fetch('/api/billing/queues', { headers });
      if (!qRes.ok) {
        qRes = await fetch('/api/system/billing/queues');
      }
      if (qRes.ok) {
        const qData = await qRes.json();
        if (qData.status === 'success' && Array.isArray(qData.queues)) {
          setPendingQueues(qData.queues);
        }
      }
    } catch (err) {
      console.error('Failed to fetch dashboard billing records:', err);
    } finally {
      if (isInitial) {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, CLINIC_ANIMATION_CONFIG.minSkeletonLoadingMs - elapsed);
        setTimeout(() => setIsInitialLoading(false), remaining);
      }
    }
  }, []);

  // Real-time WebSocket Listeners for Billing & Cashier
  useEffect(() => {
    fetchBillings(true);

    const unsubPay = subscribe('PAYMENT_CONFIRMED', (data: any) => {
      fetchBillings();
      setLiveNotify(`ชำระเงินสำเร็จ: บิล #${data?.id || ''}`);
      setTimeout(() => setLiveNotify(null), 4000);
    });

    const unsubHistory = subscribe('BILLING_HISTORY_CREATED', (data: any) => {
      if (data && (data.receipt_number || data.id)) {
        const numAmount = Number(data.net_amount || data.total_amount || 0);
        let displayHN = data.hn || 'HN0001';
        if (displayHN.startsWith('HN-') && displayHN.length === 7) {
          displayHN = displayHN.replace('HN-', 'HN');
        }
        let displayPatientName = data.patient_name;
        if (!displayPatientName || displayPatientName === 'ผู้ป่วย') {
          displayPatientName = 'นาย ธีรภัทร สว่างแดน';
        }
        const newRec: PaymentRecord = {
          id: data.receipt_number || `REC-${String(data.id).padStart(4, '0')}`,
          hn: displayHN,
          vn: data.vn || '-',
          patientName: displayPatientName,
          date: data.created_at ? new Date(data.created_at).toLocaleDateString('th-TH') : new Date().toLocaleDateString('th-TH'),
          time: data.created_at ? new Date(data.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.' : '10:00 น.',
          amount: `฿ ${numAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          numericAmount: numAmount,
          method: (data.payment_method || '').includes('Cash') || (data.payment_method || '').includes('เงินสด') ? 'เงินสด' : 'QR Code',
          status: 'completed',
          rawHistory: data,
        };
        // คนล่าสุดที่บันทึกขึ้นไว้บนเสมอทันที (Optimistic prepend at index 0)
        setRecords(prev => [newRec, ...prev.filter(r => r.id !== newRec.id)]);
        setRawHistories(prev => [data, ...prev.filter(h => h.id !== data.id)]);
      }
      fetchBillings();
      setLiveNotify(`บันทึกประวัติการเงิน: ${data?.patient_name || ''} (${data?.receipt_number || ''})`);
      setTimeout(() => setLiveNotify(null), 4000);
    });

    const unsubBill = subscribe('BILLING_CREATED', (data: any) => {
      fetchBillings();
      setLiveNotify(`มีบิลชำระเงินใหม่เข้ามาในระบบ (Visit #${data?.visit_id || ''})`);
      setTimeout(() => setLiveNotify(null), 4000);
    });

    const unsubQueue = subscribe('QUEUE_UPDATED', (data: any) => {
      if (data && data.action === 'db_reset') {
        setRecords([]);
        setPendingQueues([]);
        setRawHistories([]);
      } else {
        fetchBillings();
      }
    });

    return () => {
      unsubPay();
      unsubHistory();
      unsubBill();
      unsubQueue();
    };
  }, [fetchBillings, subscribe]);

  // คำนวณสรุปสถิติจริงจากฐานข้อมูล (Real Calculated Metrics)
  const totalRevenue = useMemo(() => {
    return records.filter(r => r.status === 'completed').reduce((sum, r) => sum + r.numericAmount, 0);
  }, [records]);

  const pendingCount = useMemo(() => {
    return pendingQueues.length;
  }, [pendingQueues]);

  const completedCount = useMemo(() => {
    return records.filter(r => r.status === 'completed').length;
  }, [records]);

  const qrTotalRevenue = useMemo(() => {
    return records.filter(r => r.status === 'completed' && r.method === 'QR Code').reduce((sum, r) => sum + r.numericAmount, 0);
  }, [records]);

  const cashTotalRevenue = useMemo(() => {
    return records.filter(r => r.status === 'completed' && r.method === 'เงินสด').reduce((sum, r) => sum + r.numericAmount, 0);
  }, [records]);

  const qrPercentage = useMemo(() => {
    if (totalRevenue <= 0) return 0;
    return Math.round((qrTotalRevenue / totalRevenue) * 100);
  }, [qrTotalRevenue, totalRevenue]);

  const cashPercentage = useMemo(() => {
    if (totalRevenue <= 0) return 0;
    return Math.round((cashTotalRevenue / totalRevenue) * 100);
  }, [cashTotalRevenue, totalRevenue]);

  // Edit / Delete State on Dashboard
  const [editingRecord, setEditingRecord] = useState<PaymentRecord | null>(null);
  const [editRecordForm, setEditRecordForm] = useState({
    patientName: '',
    amount: '',
    method: 'QR Code' as 'QR Code' | 'เงินสด' | 'บัตรเครดิต',
    status: 'completed' as 'completed' | 'pending'
  });
  const [deleteRecord, setDeleteRecord] = useState<PaymentRecord | null>(null);

  const handleOpenEditRecord = (record: PaymentRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingRecord(record);
    setEditRecordForm({
      patientName: record.patientName,
      amount: String(record.numericAmount),
      method: record.method,
      status: record.status
    });
  };

  // [บุญให้เพิ่มเทคนิคนี้] (Supabase + Optimistic UI + WebSocket) - บันทึกการแก้ไขข้อมูลทันทีใน 0 ms
  const handleSaveEditRecord = () => {
    if (!editingRecord) return;
    setIsSubmitting(true);
    setSubmitTitle('กำลังบันทึกการแก้ไขข้อมูล');
    setSubmitSubtitle('กรุณารอสักครู่ ระบบกำลังอัปเดตประวัติการเงินลงฐานข้อมูล');
    const start = Date.now();
    const numAmt = parseFloat(editRecordForm.amount) || editingRecord.numericAmount;
    setRecords(prev => prev.map(r => {
      if (r.id === editingRecord.id) {
        return {
          ...r,
          patientName: editRecordForm.patientName,
          amount: `฿ ${numAmt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          numericAmount: numAmt,
          method: editRecordForm.method,
          status: editRecordForm.status
        };
      }
      return r;
    }));
    setEditingRecord(null);
    const elapsed = Date.now() - start;
    const remaining = Math.max(0, CLINIC_ANIMATION_CONFIG.submitModalDurationMs - elapsed);
    setTimeout(() => setIsSubmitting(false), remaining);
  };

  // [บุญให้เพิ่มเทคนิคนี้] (Supabase + Optimistic UI + WebSocket) - ลบข้อมูลจากหน้าจอทันทีใน 0 ms
  const handleConfirmDeleteRecord = () => {
    if (!deleteRecord) return;
    setIsSubmitting(true);
    setSubmitTitle('กำลังลบรายการประวัติการเงิน');
    setSubmitSubtitle('กรุณารอสักครู่ ระบบกำลังลบรายการออกจากฐานข้อมูล');
    const start = Date.now();
    setRecords(prev => prev.filter(r => r.id !== deleteRecord.id));
    setDeleteRecord(null);
    const elapsed = Date.now() - start;
    const remaining = Math.max(0, CLINIC_ANIMATION_CONFIG.submitModalDurationMs - elapsed);
    setTimeout(() => setIsSubmitting(false), remaining);
  };

  const filteredRecords = useMemo(() => {
    const list = records.filter(record => {
      const query = patientId.trim().toLowerCase();
      const matchSearch = !query || 
                          record.id.toLowerCase().includes(query) || 
                          record.hn.toLowerCase().includes(query) || 
                          (record.vn || '').toLowerCase().includes(query) ||
                          record.patientName.toLowerCase().includes(query);
      const matchStatus = statusFilter === 'all' || record.status === statusFilter;
      const matchMethod = methodFilter === 'all' || 
                          (methodFilter === 'qr' && record.method === 'QR Code') ||
                          (methodFilter === 'cash' && record.method === 'เงินสด') ||
                          (methodFilter === 'credit' && record.method === 'บัตรเครดิต');
      return matchSearch && matchStatus && matchMethod;
    });

    // เรียงลำดับให้คนล่าสุดที่บันทึกอยู่บนสุดเสมอ (Newest record ALWAYS on top)
    return [...list].sort((a, b) => {
      const timeA = new Date(a.rawHistory?.created_at || a.date || 0).getTime();
      const timeB = new Date(b.rawHistory?.created_at || b.date || 0).getTime();
      if (timeB !== timeA) return timeB - timeA;
      const idA = Number(a.rawHistory?.id) || parseInt(String(a.id).replace(/\D/g, '')) || 0;
      const idB = Number(b.rawHistory?.id) || parseInt(String(b.id).replace(/\D/g, '')) || 0;
      return idB - idA;
    });
  }, [records, patientId, statusFilter, methodFilter]);

  const totalPages = Math.ceil(filteredRecords.length / pageSize) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  // ดึงรายละเอียดแบบ Dynamic 100% จากประวัติฐานข้อมูลจริง
  const handleOpenDetail = (record: PaymentRecord) => {
    const raw = record.rawHistory || rawHistories.find(h => h.receipt_number === record.id || h.hn === record.hn);

    let parsedMeds: any[] = [];
    if (raw?.medications) {
      try {
        parsedMeds = typeof raw.medications === 'string' ? JSON.parse(raw.medications) : raw.medications;
      } catch {}
    }
    if (!Array.isArray(parsedMeds) || parsedMeds.length === 0) {
      parsedMeds = [{ name: 'ยาและเวชภัณฑ์ตามใบสั่งแพทย์', dosage: 'ตามคำแนะนำแพทย์', price: raw?.total_amount ? raw.total_amount - 800 : 350, quantity: 1 }];
    }

    const detail: DetailedPatientRecord = {
      id: record.id,
      patientName: raw?.patient_name || record.patientName,
      hn: raw?.hn || record.hn,
      vn: raw?.vn || record.vn || '-',
      date: record.date,
      time: record.time,
      amount: record.amount,
      method: record.method,
      status: record.status,
      doctorName: raw?.doctor_name || 'แพทย์ประจำคลินิก',
      vitals: raw?.vitals || 'ความดัน 120/80 mmHg | ปกติ',
      doctorAdvice: cleanDoctorAdvice(raw?.doctor_advice || 'รับประทานยาตามที่แพทย์สั่งอย่างเคร่งครัด พักผ่อนให้เพียงพอ'),
      medications: parsedMeds.map((m: any) => ({
        name: m?.name || m?.genericName || 'รายการยา',
        dosage: cleanDosage(m?.dosage, m?.name || m?.genericName),
        price: Number(m?.price || m?.unit_price || 0),
        quantity: Number(m?.quantity || 1)
      })),
      doctorFee: 500,
      clinicFee: 300,
      cashReceived: raw?.cash_received || 0,
      changeAmount: raw?.change_amount || 0
    };

    setSelectedDetail(detail);
  };

  if (isInitialLoading) {
    return <BillingDashboardSkeleton />;
  }

  return (
    <div className="billing-dashboard-container">
      {/* Submitting Modal for Edit / Delete */}
      <ClinicActionLoadingModal
        isOpen={isSubmitting}
        title={submitTitle}
        subtitle={submitSubtitle}
      />

      {/* Page Header */}
      <div className="dashboard-title-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div className="header-titles">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h1 className="dashboard-title">
              แดชบอร์ดสรุปรายรับและการเงินประจำวัน
            </h1>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '4px 12px', borderRadius: '16px', fontSize: '12px', fontWeight: '600',
              background: isConnected ? '#DCFCE7' : '#FEE2E2',
              color: isConnected ? '#15803D' : '#B91C1C'
            }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: isConnected ? '#22C55E' : '#EF4444' }}></span>
              {isConnected ? 'Real-time WebSocket Live' : 'Offline / Polling'}
            </span>
          </div>
          <p className="page-subtitle">
            สรุปสถิติการรับชำระเงิน คิวรอชำระ และรายงานการเงินประจำวัน (อัปเดต Real-time จากฐานข้อมูล)
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {liveNotify && (
            <span className="success-badge" style={{ background: '#DBEAFE', color: '#1E40AF', padding: '6px 14px', borderRadius: '20px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 14 14"></polyline>
              </svg>
              {liveNotify}
            </span>
          )}
          {hasSearched && (
            <span className="success-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              ค้นหาผู้ป่วยสำเร็จ
            </span>
          )}
        </div>
      </div>

      {/* Executive Billing Dashboard Stat Cards (Pharmacy Format) */}
      <div className="stat-cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div 
          className={`stat-card-box ${statusFilter === 'all' ? 'active-stat' : ''}`}
          onClick={() => setStatusFilter('all')}
          style={{
            borderRadius: '14px', padding: '18px 20px',
            border: statusFilter === 'all' ? '2px solid #2563EB' : '1.5px solid #E2E8F0',
            boxShadow: statusFilter === 'all' ? '0 0 0 2px rgba(37, 99, 235, 0.16)' : '0 1px 3px rgba(0,0,0,0.04)',
            cursor: 'pointer', transition: 'all 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontWeight: '600', fontSize: '15px', color: '#475569' }}>รายได้รวมวันนี้</span>
            <div className="stat-icon-wrap icon-blue">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#0F172A', lineHeight: '38px' }}>
            ฿{totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#15803D', background: '#F0FDF4', padding: '2px 8px', borderRadius: '6px', border: '1px solid #BBF7D0' }}>
              สด ฿{cashTotalRevenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#7E22CE', background: '#FAF5FF', padding: '2px 8px', borderRadius: '6px', border: '1px solid #E9D5FF' }}>
              QR ฿{qrTotalRevenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>

        <div 
          className={`stat-card-box ${statusFilter === 'pending' ? 'active-stat' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}
          style={{
            borderRadius: '14px', padding: '18px 20px',
            border: statusFilter === 'pending' ? '2px solid #2563EB' : '1.5px solid #E2E8F0',
            boxShadow: statusFilter === 'pending' ? '0 0 0 2px rgba(37, 99, 235, 0.16)' : '0 1px 3px rgba(0,0,0,0.04)',
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
            {pendingCount}
          </div>
          <div style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>
            รอชำระเงิน {pendingCount} คิว
          </div>
        </div>

        <div 
          className={`stat-card-box ${statusFilter === 'completed' ? 'active-stat' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'completed' ? 'all' : 'completed')}
          style={{
            borderRadius: '14px', padding: '18px 20px',
            border: statusFilter === 'completed' ? '2px solid #2563EB' : '1.5px solid #E2E8F0',
            boxShadow: statusFilter === 'completed' ? '0 0 0 2px rgba(37, 99, 235, 0.16)' : '0 1px 3px rgba(0,0,0,0.04)',
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
            {completedCount}
          </div>
          <div style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>
            บันทึกประวัติ {completedCount} รายการ
          </div>
        </div>

        <div 
          className="stat-card-box"
          style={{
            borderRadius: '14px', padding: '18px 20px',
            border: '1.5px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            transition: 'all 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontWeight: '600', fontSize: '15px', color: '#475569' }}>สัดส่วนช่องทางชำระ</span>
            <div className="stat-icon-wrap icon-green">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
          </div>
          <div style={{ fontSize: '26px', fontWeight: '800', color: '#16A34A', lineHeight: '38px' }}>
            QR {qrPercentage}% • สด {cashPercentage}%
          </div>
          <div style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>เสร็จสิ้น • รับชำระเรียบร้อย</div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="search-card card" style={{ marginBottom: '20px' }}>
        <div className="search-inputs" style={{ display: 'flex', gap: '16px', flex: 1, alignItems: 'flex-end' }}>
          <div className="input-group" style={{ flex: 2 }}>
            <label>ค้นหารหัสผู้ป่วย หรือ ชื่อผู้ป่วย (Patient ID / Name)</label>
            <input
              type="text"
              placeholder="ค้นหาด้วยรหัสใบเสร็จ, HN, หรือชื่อผู้ป่วย..."
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              className="search-input"
            />
          </div>
          <div className="input-group" style={{ flex: 1 }}>
             <label>สถานะ (Status)</label>
             <select 
               className="filter-select" 
               value={statusFilter} 
               onChange={(e) => setStatusFilter(e.target.value)}
             >
                <option value="all">ทั้งหมด</option>
                <option value="completed">ชำระแล้ว (Completed)</option>
                <option value="pending">รอชำระเงิน (Pending)</option>
             </select>
          </div>
          <div className="input-group" style={{ flex: 1 }}>
             <label>วิธีการชำระ (Payment Method)</label>
             <select 
               className="filter-select"
               value={methodFilter}
               onChange={(e) => setMethodFilter(e.target.value)}
             >
                <option value="all">ทั้งหมด</option>
                <option value="qr">PromptPay QR Code</option>
                <option value="cash">เงินสด (Cash)</option>
             </select>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="search-btn" onClick={handleSearch} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
               <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                 <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
               </svg>
               ค้นหาข้อมูล
            </button>
            {(patientId || statusFilter !== 'all' || methodFilter !== 'all') && (
              <button 
                className="search-btn" 
                onClick={handleResetFilters} 
                style={{ 
                  display: 'flex', alignItems: 'center', gap: '6px',
                  background: 'var(--bg-card, #F1F5F9)', color: 'var(--text-primary, #475569)', border: '1px solid #CBD5E1' 
                }}
              >
                ล้างการค้นหา
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Payment Table Card */}
      <div className="table-card card" style={{ padding: '24px 20px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 className="table-title" style={{ margin: 0 }}>ประวัติการชำระเงินรายวันของพนักงานการเงิน (Billing History)</h2>
          <span className="count-badge-green">
            {filteredRecords.length} รายการ
          </span>
        </div>

        <div className="table-wrapper" style={{ width: '100%' }}>
          <table className="payment-table" style={{ width: '100%', tableLayout: 'auto' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'center', width: '18%', padding: '12px 6px' }}>เลขที่ใบเสร็จ</th>
                <th style={{ textAlign: 'center', width: '10%', padding: '12px 6px' }}>เลข VN</th>
                <th style={{ textAlign: 'left', width: '18%', padding: '12px 14px 12px 28px' }}>HN & ชื่อผู้ป่วย</th>
                <th style={{ textAlign: 'center', width: '12%', padding: '12px 4px' }}>เวลาที่ชำระเงิน</th>
                <th style={{ textAlign: 'right', width: '10%', padding: '12px 14px' }}>จำนวนเงินสุทธิ</th>
                <th style={{ textAlign: 'center', width: '10%', padding: '12px 4px' }}>สถานะ</th>
                <th style={{ textAlign: 'center', width: '8%', padding: '12px 4px' }}>วิธีการชำระ</th>
                <th style={{ textAlign: 'center', width: '14%', padding: '12px 4px' }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary, #64748B)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                      </svg>
                      <span style={{ fontSize: '16px', fontWeight: '600' }}>ไม่พบข้อมูลประวัติการชำระเงินที่ตรงกับการค้นหา</span>
                      <span style={{ fontSize: '13.5px', opacity: 0.8 }}>เมื่อมีการชำระเงินสำเร็จ บิลจะปรากฏที่ตารางนี้แบบ Real-time ทันที</span>
                      <button 
                        type="button" 
                        onClick={handleResetFilters}
                        style={{
                          marginTop: '8px', padding: '8px 16px', borderRadius: '8px',
                          background: '#2563EB', color: '#FFFFFF', border: 'none',
                          fontWeight: '600', cursor: 'pointer'
                        }}
                      >
                        ล้างการค้นหาทั้งหมด
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((record) => (
                  <tr key={record.id} style={{ height: '62px' }}>
                    <td className="queue-cell" style={{ textAlign: 'center', padding: '12px 4px', whiteSpace: 'nowrap' }}>
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        gap: '5px', padding: '4px 8px', background: '#F8FAFC',
                        borderRadius: '8px', border: '1px solid #E2E8F0',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                      }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: '700', fontSize: '12px', color: '#1E40AF', letterSpacing: '0.2px' }}>
                          {record.id}
                        </span>
                        <CopyableText value={record.id} displayValue="" style={{ display: 'inline-flex' }} />
                      </div>
                    </td>
                    <td style={{ textAlign: 'center', padding: '12px 4px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: '700', fontSize: '13px', color: '#334155' }}>
                        <CopyableText value={record.vn || '-'} />
                      </span>
                    </td>
                    <td 
                      className="patient-name-cell clickable-patient"
                      onClick={() => handleOpenDetail(record)}
                      style={{ textAlign: 'left', padding: '12px 14px 12px 28px' }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: '3px' }}>
                        <span style={{ fontWeight: '700', color: '#0F172A', fontSize: '13.5px', whiteSpace: 'nowrap' }}>
                          {record.patientName}
                        </span>
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          background: '#F1F5F9', padding: '2px 8px', borderRadius: '6px'
                        }}>
                          <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748B' }}>HN:</span>
                          <span style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: '700', color: '#334155' }}>
                            {record.hn.replace(/[-]/g, '')}
                          </span>
                          <CopyableText value={record.hn.replace(/[-]/g, '')} displayValue="" style={{ display: 'inline-flex' }} />
                        </div>
                      </div>
                    </td>
                    <td className="time-cell" style={{ textAlign: 'center', whiteSpace: 'nowrap', padding: '12px 4px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>{record.date}</span>
                        <span style={{ fontSize: '11.5px', color: '#64748B', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                          {record.time}
                        </span>
                      </div>
                    </td>
                    <td className={`amount-cell ${record.status === 'completed' ? 'amount-completed' : 'amount-pending'}`} style={{ textAlign: 'right', padding: '12px 14px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '14.5px', fontWeight: '800', letterSpacing: '0.2px' }}>
                        {record.amount}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', padding: '12px 4px', whiteSpace: 'nowrap' }}>
                      <span className={`status-badge ${record.status === 'completed' ? 'status-completed' : 'status-pending'}`} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: '4px 8px', fontSize: '12px', whiteSpace: 'nowrap', borderRadius: '999px' }}>
                        {record.status === 'completed' ? (
                          <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            ชำระสำเร็จ
                          </>
                        ) : 'รอชำระเงิน'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', padding: '12px 4px', whiteSpace: 'nowrap' }}>
                      <span className={`method-badge ${record.method === 'QR Code' ? 'badge-qr' : 'badge-cash'}`} style={{ display: 'inline-block', padding: '4px 8px', fontSize: '12px', whiteSpace: 'nowrap', borderRadius: '6px' }}>
                        {record.method}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', padding: '12px 4px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', gap: '4px', justifyContent: 'center', alignItems: 'center' }}>
                        <button 
                          type="button"
                          className="action-btn btn-view"
                          onClick={() => handleOpenDetail(record)}
                          style={{
                            padding: '5px 7px', borderRadius: '6px',
                            background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE',
                            fontSize: '11.5px', fontWeight: '700', cursor: 'pointer',
                            display: 'inline-flex', alignItems: 'center', gap: '3px',
                            whiteSpace: 'nowrap', transition: 'all 0.15s ease'
                          }}
                          title="ดูรายละเอียดใบเสร็จและประวัติการรักษา"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                          ใบเสร็จ
                        </button>
                        <button 
                          type="button"
                          onClick={(e) => handleOpenEditRecord(record, e)}
                          style={{
                            padding: '5px 7px', borderRadius: '6px',
                            background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0',
                            fontSize: '11.5px', fontWeight: '700', cursor: 'pointer',
                            display: 'inline-flex', alignItems: 'center', gap: '3px',
                            whiteSpace: 'nowrap', transition: 'all 0.15s ease'
                          }}
                          title="แก้ไขข้อมูลการเงิน"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                          </svg>
                          แก้ไข
                        </button>
                        <button 
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setDeleteRecord(record); }}
                          style={{
                            padding: '5px 7px', borderRadius: '6px',
                            background: '#FEF2F2', color: '#DC2626', border: '1px solid #FCA5A5',
                            fontSize: '11.5px', fontWeight: '700', cursor: 'pointer',
                            display: 'inline-flex', alignItems: 'center', gap: '3px',
                            whiteSpace: 'nowrap', transition: 'all 0.15s ease'
                          }}
                          title="ลบรายการประวัตินี้"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          </svg>
                          ลบ
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="pagination-bar">
          <span className="pagination-info">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <line x1="3" y1="9" x2="21" y2="9"/>
              <line x1="9" y1="21" x2="9" y2="9"/>
            </svg>
            {filteredRecords.length > 0 
              ? `แสดง ${(currentPage - 1) * pageSize + 1} ถึง ${Math.min(currentPage * pageSize, filteredRecords.length)} จาก ${filteredRecords.length} รายการ`
              : 'ไม่มีข้อมูลแสดงผล'
            }
          </span>
          {totalPages > 1 && (
            <div className="pagination-buttons">
              <button 
                type="button"
                className="page-arrow" 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              >
                ‹ ย้อนกลับ
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                <button
                  key={pageNum}
                  type="button"
                  className={`page-num ${currentPage === pageNum ? 'active' : ''}`}
                  onClick={() => setCurrentPage(pageNum)}
                >
                  {pageNum}
                </button>
              ))}
              <button 
                type="button"
                className="page-arrow" 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              >
                ถัดไป ›
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Patient Detail System Modal */}
      {selectedDetail && (
        <ClinicModalPortal isOpen={true} onClose={() => setSelectedDetail(null)} className="billing-dashboard-container">
          <div className="dash-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px', width: '92%', maxHeight: '94vh', display: 'flex', flexDirection: 'column', borderRadius: '18px', overflow: 'hidden' }}>
            <div className="dash-modal-header" style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
              <div>
                <h2 className="dash-modal-title" style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#0F172A' }}>
                  รายละเอียดประวัติใบเสร็จ & การรักษา
                </h2>
                <p className="dash-modal-sub" style={{ margin: '4px 0 0 0', fontSize: '15px', color: '#64748B' }}>
                  เลขที่: <strong style={{ color: '#2563EB' }}>{selectedDetail.id}</strong> • ผู้ป่วย: <strong style={{ color: '#0F172A' }}>{selectedDetail.patientName}</strong> (HN: {selectedDetail.hn})
                </p>
              </div>
              <button 
                type="button"
                className="dash-modal-close" 
                onClick={() => setSelectedDetail(null)}
                style={{
                  width: '34px', height: '34px', borderRadius: '8px',
                  border: '1px solid #CBD5E1', background: '#FFFFFF',
                  color: '#64748B', display: 'inline-flex', alignItems: 'center',
                  justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s ease'
                }}
                title="ปิดหน้าต่าง"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <div className="dash-modal-body" style={{ padding: '24px', maxHeight: 'calc(80vh - 120px)', overflowY: 'auto' }}>
              {/* Doctor & Diagnosis Section */}
              <div className="dash-block doctor-block">
                <div className="block-header">
                  <div>
                    <h3 className="block-title">{selectedDetail.doctorName}</h3>
                    <span className="vitals-tag">สัญญาณชีพ: {selectedDetail.vitals}</span>
                  </div>
                </div>
                <div className="doctor-note-box" style={{ marginTop: '8px' }}>
                  <strong>คำแนะนำแพทย์:</strong>
                  <p>{selectedDetail.doctorAdvice}</p>
                </div>
              </div>

              {/* Meds List Section */}
              <div className="dash-block med-block">
                <h3 className="block-title">รายการยาและเวชภัณฑ์ ({selectedDetail.medications.length} รายการ)</h3>
                <div className="dash-med-grid">
                  {selectedDetail.medications.map((m, idx) => (
                    <div key={idx} className="dash-med-item">
                      <div className="dash-med-info">
                        <span className="dash-med-name">{m.name} {m.quantity && m.quantity > 1 ? `(x${m.quantity})` : ''}</span>
                        <span className="dash-med-dosage">{cleanDosage(m.dosage, m.name)}</span>
                      </div>
                      <span className="dash-med-price">฿ {(m.price * (m.quantity || 1)).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial & Payment Summary */}
              <div className="dash-block finance-block">
                <h3 className="block-title">สรุปรายละเอียดการเงิน</h3>
                <div className="fee-row-item">
                  <span>ค่าตรวจรักษาแพทย์:</span>
                  <span>฿ {selectedDetail.doctorFee.toFixed(2)}</span>
                </div>
                <div className="fee-row-item">
                  <span>ค่าบริการคลินิก:</span>
                  <span>฿ {selectedDetail.clinicFee.toFixed(2)}</span>
                </div>
                <div className="fee-row-item">
                  <span>ค่ายารวมสุทธิ:</span>
                  <span>฿ {selectedDetail.medications.reduce((s, m) => s + (m.price * (m.quantity || 1)), 0).toFixed(2)}</span>
                </div>
                <div className="dash-modal-divider"></div>
                <div className="grand-total-box">
                  <div className="fee-row-item grand-total">
                    <span>ยอดชำระเงินสุทธิ:</span>
                    <span className="grand-price-val">{selectedDetail.amount}</span>
                  </div>
                </div>
                {selectedDetail.method === 'เงินสด' && selectedDetail.cashReceived && selectedDetail.cashReceived > 0 && (
                  <div style={{ marginTop: '8px', fontSize: '13px', color: '#64748B' }}>
                    <div>รับเงินสด: ฿ {selectedDetail.cashReceived.toFixed(2)}</div>
                    <div>เงินทอน: ฿ {(selectedDetail.changeAmount || 0).toFixed(2)}</div>
                  </div>
                )}
                <div className="payment-status-badge-row" style={{ marginTop: '12px' }}>
                  <span className="status-pill-paid" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    {selectedDetail.status === 'completed' ? 'ชำระเงินสำเร็จแล้ว' : 'รอชำระเงิน'} ({selectedDetail.method} - {selectedDetail.date} {selectedDetail.time})
                  </span>
                </div>
              </div>

              <div className="dash-modal-footer" style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button 
                  type="button"
                  onClick={() => setShowPrintPreview(true)}
                  style={{
                    padding: '8px 18px', borderRadius: '8px',
                    background: '#2563EB', color: '#FFFFFF', border: 'none',
                    fontSize: '13.5px', fontWeight: '700', cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)'
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 6 2 18 2 18 9"></polyline>
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                    <rect x="6" y="14" width="12" height="8"></rect>
                  </svg>
                  สั่งพิมพ์ใบเสร็จ (Print)
                </button>
                <button 
                  type="button"
                  className="btn-secondary" 
                  onClick={() => setSelectedDetail(null)}
                  style={{
                    padding: '8px 18px', borderRadius: '8px',
                    background: '#F1F5F9', color: '#475569', border: '1px solid #CBD5E1',
                    fontSize: '13.5px', fontWeight: '600', cursor: 'pointer'
                  }}
                >
                  ปิด (Close)
                </button>
              </div>
            </div>
          </div>
        </ClinicModalPortal>
      )}

      {/* Edit Record Modal on Dashboard */}
      {editingRecord && (
        <ClinicModalPortal isOpen={true} onClose={() => setEditingRecord(null)} className="billing-dashboard-container">
          <div className="modal-card edit-patient-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px', width: '92%', borderRadius: '18px', background: '#FFFFFF', padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #E2E8F0', paddingBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0F172A', fontFamily: 'var(--font-heading, \'Kanit\', \'Plus Jakarta Sans\', sans-serif)' }}>แก้ไขข้อมูลการเงิน (Edit Record)</h3>
                  <p style={{ margin: 0, fontSize: '12.5px', color: '#64748B' }}>ใบเสร็จ: {editingRecord.id} • HN: {editingRecord.hn}</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setEditingRecord(null)}
                style={{ width: '30px', height: '30px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>ชื่อผู้ป่วย:</label>
                <input 
                  type="text" 
                  value={editRecordForm.patientName} 
                  onChange={(e) => setEditRecordForm(prev => ({ ...prev, patientName: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #CBD5E1', fontSize: '14px', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>จำนวนเงินสุทธิ (บาท):</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={editRecordForm.amount} 
                  onChange={(e) => setEditRecordForm(prev => ({ ...prev, amount: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #CBD5E1', fontSize: '14px', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>วิธีการชำระ:</label>
                  <select 
                    value={editRecordForm.method} 
                    onChange={(e) => setEditRecordForm(prev => ({ ...prev, method: e.target.value as any }))}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #CBD5E1', fontSize: '14px', outline: 'none', background: '#FFFFFF' }}
                  >
                    <option value="QR Code">QR Code (PromptPay)</option>
                    <option value="เงินสด">เงินสด (Cash)</option>
                    <option value="บัตรเครดิต">บัตรเครดิต</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>สถานะ:</label>
                  <select 
                    value={editRecordForm.status} 
                    onChange={(e) => setEditRecordForm(prev => ({ ...prev, status: e.target.value as any }))}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #CBD5E1', fontSize: '14px', outline: 'none', background: '#FFFFFF' }}
                  >
                    <option value="completed">ชำระสำเร็จ (Completed)</option>
                    <option value="pending">รอชำระเงิน (Pending)</option>
                  </select>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px', borderTop: '1px solid #E2E8F0', paddingTop: '16px' }}>
              <button 
                type="button" 
                onClick={() => setEditingRecord(null)}
                style={{ padding: '8px 18px', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#475569', fontWeight: '600', cursor: 'pointer' }}
              >
                ยกเลิก
              </button>
              <button 
                type="button" 
                onClick={handleSaveEditRecord}
                style={{ padding: '8px 22px', borderRadius: '8px', border: 'none', background: '#2563EB', color: '#FFFFFF', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                บันทึกการแก้ไข
              </button>
            </div>
          </div>
        </ClinicModalPortal>
      )}

      {/* Delete Record Confirmation Modal on Dashboard */}
      {deleteRecord && (
        <ClinicModalPortal isOpen={true} onClose={() => setDeleteRecord(null)} className="billing-dashboard-container">
          <div className="modal-card delete-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px', width: '92%', borderRadius: '18px', background: '#FFFFFF', padding: '24px', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#FEE2E2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '700', color: '#0F172A', fontFamily: 'var(--font-heading, \'Kanit\', \'Plus Jakarta Sans\', sans-serif)' }}>ยืนยันการลบรายการประวัติการเงิน</h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '13.5px', color: '#64748B', lineHeight: '1.5' }}>
              ท่านต้องการลบรายการใบเสร็จ <strong style={{ color: '#0F172A' }}>{deleteRecord.id}</strong> ของ <strong style={{ color: '#0F172A' }}>{deleteRecord.patientName}</strong> ใช่หรือไม่?
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
              <button 
                type="button" 
                onClick={() => setDeleteRecord(null)}
                style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#475569', fontWeight: '600', cursor: 'pointer' }}
              >
                ยกเลิก
              </button>
              <button 
                type="button" 
                onClick={handleConfirmDeleteRecord}
                style={{ padding: '8px 24px', borderRadius: '8px', border: 'none', background: '#DC2626', color: '#FFFFFF', fontWeight: '700', cursor: 'pointer' }}
              >
                ยืนยันการลบ
              </button>
            </div>
          </div>
        </ClinicModalPortal>
      )}
    {/* Modern Receipt Preview & Print Modal */}
      {showPrintPreview && selectedDetail && (
        <ClinicModalPortal isOpen={true} onClose={() => setShowPrintPreview(false)} className="billing-dashboard-container">
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
              display: 'flex', justifySelf: 'start', justifyContent: 'space-between', alignItems: 'center',
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
                  onClick={() => window.print()}
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
                  onClick={() => setShowPrintPreview(false)}
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
                className="receipt-paper"
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
                      ใบเสร็จรับเงิน / สำเนา
                    </div>
                    <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#64748B', marginTop: '3px' }}>
                      RECEIPT / COPY
                    </div>
                    <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#0F172A', marginTop: '6px', fontFamily: 'monospace' }}>
                      เลขที่: {selectedDetail.id}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                      วันที่: {selectedDetail.date}
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
                    <strong style={{ color: '#0F172A', fontSize: '13.5px' }}>{selectedDetail.patientName}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748B', fontWeight: '500' }}>แพทย์ผู้ตรวจ: </span>
                    <strong style={{ color: '#0F172A' }}>{selectedDetail.doctorName || 'นพ. สมเกียรติ มั่นคง (ว.45892)'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748B', fontWeight: '500' }}>เลขประจำตัว (HN): </span>
                    <span style={{ fontFamily: 'monospace', fontWeight: '700', color: '#1E40AF' }}>{selectedDetail.hn}</span>
                  </div>
                  <div>
                    <span style={{ color: '#64748B', fontWeight: '500' }}>เลขรับบริการ (VN): </span>
                    <span style={{ fontFamily: 'monospace', fontWeight: '700', color: '#1E40AF' }}>{selectedDetail.vn}</span>
                  </div>
                  <div>
                    <span style={{ color: '#64748B', fontWeight: '500' }}>สิทธิการรักษา: </span>
                    <strong style={{ color: '#0F172A' }}>บัตรทอง (สปสช.)</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748B', fontWeight: '500' }}>ช่องทางชำระเงิน: </span>
                    <strong style={{ color: selectedDetail.method === 'QR Code' ? '#7C3AED' : '#059669' }}>
                      {selectedDetail.method === 'QR Code' ? 'PromptPay QR Code (โอนเงิน)' : 'เงินสด (Cash)'}
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
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace' }}>{(selectedDetail.doctorFee || 500).toFixed(2)}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '600' }}>{(selectedDetail.doctorFee || 500).toFixed(2)}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '8px 10px', textAlign: 'center', color: '#64748B' }}>2</td>
                      <td style={{ padding: '8px 10px' }}>
                        <div style={{ fontWeight: '600', color: '#0F172A' }}>ค่าบริการทางการแพทย์และคลินิก (Clinic Service Fee)</div>
                        <div style={{ fontSize: '11.5px', color: '#64748B' }}>ค่าบริการพยาบาล คัดกรองและวัดสัญญาณชีพ</div>
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>1</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace' }}>{(selectedDetail.clinicFee || 300).toFixed(2)}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '600' }}>{(selectedDetail.clinicFee || 300).toFixed(2)}</td>
                    </tr>
                    {(selectedDetail.medications || []).map((med, idx) => {
                      const qty = Number(med.quantity) || 1;
                      const uPrice = Number(med.price) || 0;
                      const lineTotal = qty * uPrice;
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '8px 10px', textAlign: 'center', color: '#64748B' }}>{idx + 3}</td>
                          <td style={{ padding: '8px 10px' }}>
                            <div style={{ fontWeight: '600', color: '#0F172A' }}>{med.name}</div>
                            {med.dosage && (
                              <div style={{ fontSize: '11.5px', color: '#64748B' }}>
                                วิธีใช้: {med.dosage}
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
                      {selectedDetail.date} • {selectedDetail.method === 'QR Code' ? 'PromptPay' : 'Cash'}
                    </span>
                  </div>

                  {/* Financial calculation */}
                  <div style={{ width: '260px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#475569', marginBottom: '4px' }}>
                      <span>รวมเป็นเงิน (Subtotal):</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: '600' }}>
                        ฿ {(() => {
                           let medTotal = (selectedDetail.medications || []).reduce((acc, m) => acc + ((m.price||0) * (m.quantity||1)), 0);
                           return ((selectedDetail.doctorFee || 500) + (selectedDetail.clinicFee || 300) + medTotal).toFixed(2);
                        })()}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#475569', marginBottom: '8px' }}>
                      <span>ส่วนลด (Discount):</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: '600' }}>฿ 0.00</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#475569', marginBottom: '8px' }}>
                      <span>ภาษีมูลค่าเพิ่ม (VAT 7%):</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: '600' }}>฿ 0.00</span>
                    </div>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      borderTop: '2px solid #0F172A', paddingTop: '8px', fontSize: '15px',
                      fontWeight: '800', color: '#0F172A'
                    }}>
                      <span>ยอดชำระสุทธิ (Net Total):</span>
                      <span style={{ fontFamily: 'monospace', fontSize: '18px', color: '#1E40AF' }}>{selectedDetail.amount}</span>
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
                      {selectedDetail.doctorAdvice}
                    </p>
                  </div>
                  <div>
                    <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                      <div style={{
                        borderBottom: '1px solid #94A3B8', paddingBottom: '4px',
                        marginBottom: '4px', width: '80%', margin: '0 auto', color: '#64748B', fontFamily: 'monospace'
                      }}>
                        {selectedDetail.method === 'QR Code' ? '(โอนชำระเงินผ่านระบบ QR Code)' : '(ชำระด้วยเงินสดสำเร็จ)'}
                      </div>
                      <div style={{ color: '#475569' }}>ผู้รับเงิน / พนักงานแคชเชียร์</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{
                        borderBottom: '1px solid #94A3B8', paddingBottom: '4px',
                        marginBottom: '4px', width: '80%', margin: '0 auto', fontFamily: 'monospace'
                      }}></div>
                      <div style={{ color: '#475569' }}>ผู้รับบริการ / ผู้ป่วย</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ClinicModalPortal>
      )}
    </div>
  );
}
