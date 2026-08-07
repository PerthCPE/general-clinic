import { useState } from 'react';
import './BillingDashboardPage.css';
import { CLINIC_CONFIG } from '../../config/clinicConfig';

interface PaymentRecord {
  id: string;
  patientName: string;
  time: string;
  amount: string;
  method: 'QR Code' | 'เงินสด';
}

interface DetailedPatientRecord {
  id: string;
  patientName: string;
  hn: string;
  time: string;
  amount: string;
  method: 'QR Code' | 'เงินสด';
  doctorName: string;
  vitals: string;
  doctorAdvice: string;
  medications: { name: string; dosage: string; price: number }[];
  doctorFee: number;
  clinicFee: number;
}

const mockPaymentRecords: PaymentRecord[] = [
  { id: '1', patientName: 'นายบุญค้ำ โยลัย', time: '10:15 น.', amount: '฿ 1,175.00', method: 'QR Code' },
  { id: '2', patientName: 'นางสาวกานดา มณีรัตน์', time: '11:00 น.', amount: '฿ 1,175.00', method: 'เงินสด' },
  { id: '3', patientName: 'นายสมชาย ใจดี', time: '11:45 น.', amount: '฿ 1,500.00', method: 'QR Code' },
  { id: '4', patientName: 'นางสาวสวย งามตา', time: '13:20 น.', amount: '฿ 600.00', method: 'เงินสด' },
  { id: '5', patientName: 'นางสาวแมว อานนท์', time: '14:00 น.', amount: '฿ 800.00', method: 'QR Code' },
  { id: '6', patientName: 'นางสาววุฒิศรี ร้อยสาย', time: '14:05 น.', amount: '฿ 400.00', method: 'เงินสด' },
  { id: '7', patientName: 'นางสาวจินตนา มานิน', time: '15:10 น.', amount: '฿ 700.00', method: 'QR Code' },
  { id: '8', patientName: 'นางสาวสุภาสิทธิ์ ดวงใจ', time: '15:30 น.', amount: '฿ 850.00', method: 'เงินสด' },
  { id: '9', patientName: 'นางสาวกุหลาบ สุขี', time: '16:20 น.', amount: '฿ 100.00', method: 'เงินสด' },
];

export default function BillingDashboardPage() {
  const [patientId, setPatientId] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<DetailedPatientRecord | null>(null);

  const handleSearch = () => {
    setHasSearched(true);
  };

  const getPatientDetail = (recordName: string, defaultMethod: 'QR Code' | 'เงินสด', defaultTime: string): DetailedPatientRecord => {
    const found = CLINIC_CONFIG.patients.find(
      p => recordName.includes(p.shortName) || p.name.includes(recordName) || recordName.includes(p.name)
    );
    
    if (found) {
      const medSum = found.medications.reduce((s, m) => s + m.price, 0);
      return {
        id: found.id,
        patientName: found.name,
        hn: found.hn,
        time: found.visitTime || defaultTime,
        amount: `฿ ${(medSum + 800 + Math.round(medSum * 0.07)).toLocaleString()}.00`,
        method: defaultMethod,
        doctorName: 'นพ.สมเกียรติ มั่นคง (แพทย์ผู้ตรวจรักษาประจำคลินิก)',
        vitals: found.vitals,
        doctorAdvice: found.doctorAdvice || 'พักผ่อนให้เพียงพอ ดื่มน้ำมากๆ ทานยาติดต่อกันจนหมดตามแพทย์สั่งอย่างเคร่งครัด',
        medications: found.medications.map(m => ({ name: m.name, dosage: m.dosage, price: m.price })),
        doctorFee: 500,
        clinicFee: 300
      };
    }

    return {
      id: 'PT-88219',
      patientName: recordName,
      hn: 'HN-49201',
      time: defaultTime,
      amount: '฿ 1,175.00',
      method: defaultMethod,
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
      {/* Search Bar */}
      <div className="search-card card">
        <div className="search-inputs">
          <div className="input-group">
            <label>รหัสผู้ป่วย</label>
            <input
              type="text"
              placeholder="เช่น B6741990 หรือ B6741991"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
            />
          </div>
        </div>
        <button className="search-btn" onClick={handleSearch}>ค้นหา</button>
      </div>

      <div className="dashboard-title-row">
        <h1 className="dashboard-title">แดชบอร์ดสรุปรายรับและการเงินประจำวัน</h1>
        {hasSearched && (
          <span className="success-badge">
            <span className="check-icon">✓</span> ค้นหาผู้ป่วยสำเร็จ
          </span>
        )}
      </div>

      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon-bg blue-bg">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
          </div>
          <div className="metric-info">
            <span className="metric-label">ยอดชำระวันนี้</span>
            <div className="metric-val-row">
              <span className="metric-value">฿ 54,450</span>
              <span className="growth-badge">▲ 100%</span>
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-bg orange-bg">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div className="metric-info">
            <span className="metric-label">รอดำเนินการ</span>
            <span className="metric-value">8 รายการ</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-bg green-bg">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <div className="metric-info">
            <span className="metric-label">ชำระสำเร็จแล้ว</span>
            <span className="metric-value">45 รายการ</span>
          </div>
        </div>
      </div>

      <div className="table-card card">
        <h2 className="table-title">ประวัติการชำระเงินรายวันของพนักงานการเงิน</h2>
        <div className="table-wrapper">
          <table className="payment-table">
            <thead>
              <tr>
                <th>ชื่อผู้ป่วย (คลิกเพื่อดูรายละเอียดระบบ)</th>
                <th>เวลาชำระ</th>
                <th>จำนวนเงิน (บาท)</th>
                <th style={{ textAlign: 'right' }}>ช่องทางชำระเงิน</th>
              </tr>
            </thead>
            <tbody>
              {mockPaymentRecords.map((record) => (
                <tr key={record.id}>
                  <td 
                    className="patient-name-cell clickable-patient"
                    onClick={() => setSelectedDetail(getPatientDetail(record.patientName, record.method, record.time))}
                  >
                    <span className="patient-name-link">👤 {record.patientName}</span>
                    <span className="view-detail-hint">คลิกดูประวัติยาและหมอ 🔍</span>
                  </td>
                  <td className="time-cell">{record.time}</td>
                  <td className="amount-cell">{record.amount}</td>
                  <td style={{ textAlign: 'right' }}>
                    <span className={`method-badge ${record.method === 'QR Code' ? 'badge-qr' : 'badge-cash'}`}>
                      {record.method === 'QR Code' && '📱 '}{record.method}
                    </span>
                  </td>
                </tr>
              ))}
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
                  <span className="block-icon">🩺</span>
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
                <h3 className="block-title">💊 รายการยาที่สั่งจ่าย ({selectedDetail.medications.length} รายการ)</h3>
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
                <h3 className="block-title">💳 สรุปรายละเอียดทางการเงินและบิลชำระ</h3>
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
                <div className="fee-row-item grand-total">
                  <span>ยอดชำระเงินสุทธิ:</span>
                  <span className="grand-price-val">{selectedDetail.amount}</span>
                </div>
                <div className="payment-status-badge-row">
                  <span className="status-pill-paid">
                    ✓ ชำระเงินสำเร็จแล้ว ({selectedDetail.method} - เวลา {selectedDetail.time})
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
