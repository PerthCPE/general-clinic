import { useState, useEffect, useCallback } from 'react';
import './BillingDashboardPage.css';
import { CLINIC_CONFIG } from '../../config/clinicConfig';
import { useWebSocket } from '../../context/WebSocketContext';

interface PaymentRecord {
  id: string;
  patientName: string;
  date: string;
  time: string;
  amount: string;
  method: 'QR Code' | 'เงินสด' | 'บัตรเครดิต';
  status: 'pending' | 'completed';
}

interface DetailedPatientRecord {
  id: string;
  patientName: string;
  hn: string;
  date: string;
  time: string;
  amount: string;
  method: 'QR Code' | 'เงินสด' | 'บัตรเครดิต';
  status: 'pending' | 'completed';
  doctorName: string;
  vitals: string;
  doctorAdvice: string;
  medications: { name: string; dosage: string; price: number }[];
  doctorFee: number;
  clinicFee: number;
}

const mockPaymentRecords: PaymentRecord[] = [];

export default function BillingDashboardPage() {
  const { isConnected, subscribe } = useWebSocket();
  const [records, setRecords] = useState<PaymentRecord[]>(mockPaymentRecords);
  const [patientId, setPatientId] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [hasSearched, setHasSearched] = useState(false);
  const [liveNotify, setLiveNotify] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<DetailedPatientRecord | null>(null);

  const handleSearch = () => {
    setHasSearched(true);
  };

  const handleResetFilters = () => {
    setPatientId('');
    setStatusFilter('all');
    setMethodFilter('all');
    setHasSearched(false);
  };

  // Sync Real Billings from Supabase DB
  const fetchBillings = useCallback(() => {
    const token = localStorage.getItem('token');
    fetch('/api/billing/list', {
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    })
      .then(res => res.json())
      .then(data => {
        if (data?.billings && Array.isArray(data.billings)) {
          const formatted: PaymentRecord[] = data.billings.map((b: any) => ({
            id: `HN-${String(b.visit_id || b.id).padStart(4, '0')}`,
            patientName: b.patient_name || b.VisitRecord?.Patient?.FullName || `ผู้ป่วย Visit #${b.visit_id || b.id}`,
            date: b.created_at ? new Date(b.created_at).toLocaleDateString('th-TH') : new Date().toLocaleDateString('th-TH'),
            time: b.created_at ? new Date(b.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '10:00 น.',
            amount: `฿ ${(b.net_amount || b.total_amount || 0).toFixed(2)}`,
            method: b.payment_method === 'Cash' ? 'เงินสด' : 'QR Code',
            status: b.payment_status === 'paid' || b.payment_status === 'completed' ? 'completed' : 'pending',
          }));
          setRecords(formatted);
        }
      })
      .catch(() => {
        // Empty on error
      });
  }, []);

  // Real-time WebSocket Listeners for Billing & Cashier
  useEffect(() => {
    fetchBillings();

    const unsubPay = subscribe('PAYMENT_CONFIRMED', (data: any) => {
      fetchBillings();
      setLiveNotify(`✓ ชำระเงินสำเร็จ: บิล #${data?.id || ''}`);
      setTimeout(() => setLiveNotify(null), 4000);
    });

    const unsubBill = subscribe('BILLING_CREATED', (data: any) => {
      fetchBillings();
      setLiveNotify(`⚡ มีบิลชำระเงินใหม่เข้ามาในระบบ (Visit #${data?.visit_id || ''})`);
      setTimeout(() => setLiveNotify(null), 4000);
    });

    const unsubQueue = subscribe('QUEUE_UPDATED', (data: any) => {
      if (data && data.action === 'db_reset') {
        setRecords([]);
      } else {
        fetchBillings();
      }
    });

    return () => {
      unsubPay();
      unsubBill();
      unsubQueue();
    };
  }, [fetchBillings, subscribe]);

  const filteredRecords = records.filter(record => {
    const query = patientId.trim().toLowerCase();
    const matchSearch = !query || record.id.toLowerCase().includes(query) || record.patientName.toLowerCase().includes(query);
    const matchStatus = statusFilter === 'all' || record.status === statusFilter;
    const matchMethod = methodFilter === 'all' || 
                        (methodFilter === 'qr' && record.method === 'QR Code') ||
                        (methodFilter === 'cash' && record.method === 'เงินสด') ||
                        (methodFilter === 'credit' && record.method === 'บัตรเครดิต');
    return matchSearch && matchStatus && matchMethod;
  });

  const getPatientDetail = (recordId: string, recordName: string, defaultMethod: 'QR Code' | 'เงินสด' | 'บัตรเครดิต', defaultTime: string, defaultDate: string = '23/07/2026', defaultStatus: 'pending' | 'completed' = 'completed'): DetailedPatientRecord => {
    const found = CLINIC_CONFIG.patients.find(
      p => p.id === recordId || recordName.includes(p.shortName) || p.name.includes(recordName) || recordName.includes(p.name)
    );
    
    if (found) {
      const medSum = found.medications.reduce((s, m) => s + m.price, 0);
      return {
        id: found.id,
        patientName: found.name,
        hn: found.hn,
        date: found.visitDate || defaultDate,
        time: found.visitTime || defaultTime,
        amount: `฿ ${(medSum + 800 + Math.round(medSum * 0.07)).toLocaleString()}.00`,
        method: defaultMethod,
        status: defaultStatus,
        doctorName: 'นพ.สมเกียรติ มั่นคง (แพทย์ผู้ตรวจรักษาประจำคลินิก)',
        vitals: found.vitals,
        doctorAdvice: found.doctorAdvice || 'พักผ่อนให้เพียงพอ ดื่มน้ำมากๆ ทานยาติดต่อกันจนหมดตามแพทย์สั่งอย่างเคร่งครัด',
        medications: found.medications.map(m => ({ name: m.name, dosage: m.dosage, price: m.price })),
        doctorFee: 500,
        clinicFee: 300
      };
    }

    return {
      id: recordId,
      patientName: recordName,
      hn: 'HN0045',
      date: defaultDate,
      time: defaultTime,
      amount: '฿ 1,175.00',
      method: defaultMethod,
      status: defaultStatus,
      doctorName: 'นพ.สมเกียรติ มั่นคง (แพทย์ผู้ตรวจรักษาประจำคลินิก)',
      vitals: 'ความดัน 120/80 mmHg | ชีพจร 76 bpm',
      doctorAdvice: 'พักผ่อนให้เพียงพอ ดื่มน้ำมากๆ ทานยาลดไข้และยาปฏิชีวนะตามแพทย์สั่งอย่างเคร่งครัด',
      medications: [
        { name: 'Amoxicillin 250mg', dosage: '1 แคปซูล, 3 ครั้ง/วัน หลังอาหาร', price: 150 },
        { name: 'Paracetamol 500mg', dosage: '2 เม็ด, ทุกๆ 4-6 ชั่วโมง', price: 80 },
        { name: 'Ibuprofen 400mg', dosage: '1 เม็ด, 2 ครั้ง/วัน หลังอาหารทันที', price: 120 }
      ],
      doctorFee: 500,
      clinicFee: 300
    };
  };

  return (
    <div className="billing-dashboard-container">
      {/* Page Header */}
      <div className="dashboard-title-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div className="header-titles">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h1 className="dashboard-title" style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--text-primary)', margin: '0', letterSpacing: '-0.5px' }}>
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
          <p className="page-subtitle" style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0', fontSize: '1.1rem' }}>
            สรุปสถิติการรับชำระเงิน คิวรอชำระ และรายงานการเงินประจำวัน (อัปเดต Real-time)
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {liveNotify && (
            <span className="success-badge" style={{ background: '#DBEAFE', color: '#1E40AF', padding: '6px 14px', borderRadius: '20px', fontWeight: 'bold' }}>
              {liveNotify}
            </span>
          )}
          {hasSearched && (
            <span className="success-badge">
              <span className="check-icon">✓</span> ค้นหาผู้ป่วยสำเร็จ
            </span>
          )}
        </div>
      </div>

      {/* Metric Cards Section - Pharmacy-style framed cards */}
      <div className="metrics-grid">
        <div className="metric-card card">
          <div className="metric-icon-bg blue-bg">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
          </div>
          <div className="metric-info">
            <span className="metric-label">รายได้รวมวันนี้ (Total Revenue)</span>
            <div className="metric-val-row">
              <span className="metric-value">฿ 8,450.00</span>
              <span className="growth-badge">+12.5%</span>
            </div>
          </div>
        </div>

        <div className="metric-card card">
          <div className="metric-icon-bg orange-bg">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <div className="metric-info">
            <span className="metric-label">รอชำระเงิน (Pending Payment)</span>
            <span className="metric-value">3 คิว</span>
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
            <span className="metric-label">ชำระเงินสำเร็จแล้ว (Completed)</span>
            <span className="metric-value">45 รายการ</span>
          </div>
        </div>

        <div className="metric-card card" style={{ height: '100%' }}>
          <div className="metric-icon-bg purple-bg">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <rect x="7" y="7" width="3" height="3"></rect>
              <rect x="14" y="7" width="3" height="3"></rect>
              <rect x="7" y="14" width="3" height="3"></rect>
              <rect x="14" y="14" width="3" height="3"></rect>
            </svg>
          </div>
          <div className="metric-info">
            <span className="metric-label">ยอดชำระผ่าน QR Code / โอนเงิน</span>
            <div className="metric-val-row">
              <span className="metric-value">฿ 4,200.00</span>
              <span className="growth-badge purple-badge">50%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar - Moved Down Below Title & Metrics */}
      <div className="search-card card" style={{ marginBottom: '20px' }}>
        <div className="search-inputs" style={{ display: 'flex', gap: '16px', flex: 1, alignItems: 'flex-end' }}>
          <div className="input-group" style={{ flex: 2 }}>
            <label>ค้นหารหัสผู้ป่วย หรือ ชื่อผู้ป่วย (Patient ID / Name)</label>
            <input
              type="text"
              placeholder="ค้นหาด้วยรหัสคิว, HN, หรือชื่อผู้ป่วย..."
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
                <option value="pending">รอชำระเงิน</option>
                <option value="completed">ชำระแล้ว</option>
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
                <option value="qr">QR Code</option>
                <option value="cash">เงินสด</option>
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
      <div className="table-card card">
        <h2 className="table-title">ประวัติการชำระเงินรายวันของพนักงานการเงิน</h2>
        <div className="table-wrapper">
          <table className="payment-table">
            <thead>
              <tr>
                <th>หมายเลขคิว</th>
                <th>HN & ชื่อผู้ป่วย</th>
                <th>เวลาที่สั่งยา/ส่งตรวจ</th>
                <th>จำนวนเงิน (บาท)</th>
                <th>สถานะ (Status)</th>
                <th>วิธีการชำระ</th>
                <th style={{ textAlign: 'right' }}>จัดการ (Action)</th>
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
                      <span style={{ fontSize: '13.5px', opacity: 0.8 }}>ลองเปลี่ยนรหัสคิว, HN, ชื่อผู้ป่วย หรือตัวกรองสถานะ</span>
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
                filteredRecords.map((record) => (
                  <tr key={record.id}>
                    <td className="queue-cell">
                      <span className="queue-badge">
                        Q{record.id.replace('HN', '0')}
                      </span>
                    </td>
                    <td 
                      className="patient-name-cell clickable-patient"
                      onClick={() => setSelectedDetail(getPatientDetail(record.id, record.patientName, record.method, record.time, record.date, record.status))}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{record.id}</span>
                        <span className="patient-name-link" style={{ fontSize: '13px' }}>{record.patientName}</span>
                      </div>
                    </td>
                    <td className="time-cell" style={{ fontSize: '13.5px', color: '#64748B' }}>{record.time}</td>
                    <td className={`amount-cell ${record.status === 'completed' ? 'amount-completed' : 'amount-pending'}`}>
                      {record.amount}
                    </td>
                    <td>
                      <span className={`status-badge ${record.status === 'completed' ? 'status-completed' : 'status-pending'}`}>
                        {record.status === 'completed' ? 'ชำระสำเร็จ' : 'รอชำระเงิน'}
                      </span>
                    </td>
                    <td>
                      <span className={`method-badge ${record.method === 'QR Code' ? 'badge-qr' : 'badge-cash'}`}>
                        {record.method}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button 
                          className="action-btn btn-view"
                          onClick={() => setSelectedDetail(getPatientDetail(record.id, record.patientName, record.method, record.time, record.date, record.status))}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                          ดูรายละเอียด
                        </button>
                        <button className="action-btn btn-receive">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                          รับชำระเงิน
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Patient Detail System Modal */}
      {selectedDetail && (
        <div className="modal-overlay" onClick={() => setSelectedDetail(null)}>
          <div className="dash-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="dash-modal-header">
              <div>
                <h2 className="dash-modal-title">รายละเอียดประวัติการรักษา & การชำระเงินระบบ</h2>
                <p className="dash-modal-sub">ผู้ป่วย: <strong>{selectedDetail.patientName}</strong> (รหัส: {selectedDetail.id} • {selectedDetail.hn})</p>
              </div>
              <button className="dash-modal-close" onClick={() => setSelectedDetail(null)}>✕</button>
            </div>

            <div className="dash-modal-body">
              {/* Doctor & Diagnosis Section */}
              <div className="dash-block doctor-block">
                <div className="block-header">
                  <span className="block-icon"></span>
                  <div>
                    <h3 className="block-title">{selectedDetail.doctorName}</h3>
                    <span className="vitals-tag">สัญญาณชีพล่าสุด: {selectedDetail.vitals}</span>
                  </div>
                </div>
                <div className="doctor-note-box">
                  <strong>คำแนะนำจากแพทย์ประจำเคส:</strong>
                  <p>{selectedDetail.doctorAdvice}</p>
                </div>
              </div>

              {/* Meds List Section */}
              <div className="dash-block med-block">
                <h3 className="block-title">รายการยาที่สั่งจ่าย ({selectedDetail.medications.length} รายการ)</h3>
                <div className="dash-med-grid">
                  {selectedDetail.medications.map((m, idx) => (
                    <div key={idx} className="dash-med-item">
                      <div className="dash-med-info">
                        <span className="dash-med-name">{m.name}</span>
                        <span className="dash-med-dosage">{m.dosage}</span>
                      </div>
                      <span className="dash-med-price">฿ {m.price}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial & Payment Summary */}
              <div className="dash-block finance-block">
                <h3 className="block-title">สรุปรายละเอียดทางการเงินและบิลชำระ</h3>
                <div className="fee-row-item">
                  <span>ค่าตรวจรักษาแพทย์:</span>
                  <span>฿ {selectedDetail.doctorFee}</span>
                </div>
                <div className="fee-row-item">
                  <span>ค่าบริการคลินิก:</span>
                  <span>฿ {selectedDetail.clinicFee}</span>
                </div>
                <div className="fee-row-item">
                  <span>ค่ายารวมสุทธิ:</span>
                  <span>฿ {selectedDetail.medications.reduce((s, m) => s + m.price, 0)}</span>
                </div>
                <div className="fee-row-item">
                  <span>ภาษี (VAT 7%):</span>
                  <span>- ฿ {Math.round(selectedDetail.medications.reduce((s, m) => s + m.price, 0) * 0.07)}</span>
                </div>
                <div className="dash-modal-divider"></div>
                <div className="grand-total-box">
                  <div className="fee-row-item grand-total">
                    <span>ยอดชำระเงินสุทธิ:</span>
                    <span className="grand-price-val">{selectedDetail.amount}</span>
                  </div>
                </div>
                <div className="payment-status-badge-row">
                  <span className="status-pill-paid">
                    ✓ {selectedDetail.status === 'completed' ? 'ชำระเงินสำเร็จแล้ว' : 'รอชำระเงิน'} ({selectedDetail.method} - เวลา {selectedDetail.time})
                  </span>
                </div>
              </div>

              <div className="dash-modal-footer">
                <button className="btn-secondary" onClick={() => setSelectedDetail(null)}>ปิด (Close)</button>
                <div className="dash-modal-actions">
                  <button className="btn-primary-purple">
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    สร้าง QR Code รับเงิน
                  </button>
                  <button className="btn-primary-green">
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    รับเงินสด & พิมพ์ใบเสร็จ
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
