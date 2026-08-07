import { useState } from 'react';
import './BillingInvoicePage.css';
import { CLINIC_CONFIG, type PatientConfig } from '../../config/clinicConfig';

interface BillingInvoicePageProps {
  selectedPatientId?: string;
  onSelectPatientId?: (id: string) => void;
  patientRightsMap?: Record<string, string>;
  onUpdatePatientRights?: (patientId: string, rights: string) => void;
}

export default function BillingInvoicePage({ 
  selectedPatientId, 
  onSelectPatientId,
  patientRightsMap,
  onUpdatePatientRights
}: BillingInvoicePageProps) {
  const activePatient: PatientConfig = CLINIC_CONFIG.patients.find(p => p.id === selectedPatientId) || CLINIC_CONFIG.patients[0];
  const currentRights = patientRightsMap?.[activePatient.id] || activePatient.treatmentRights;
  
  const [showQrModal, setShowQrModal] = useState(false);
  const [isPaymentConfirmed, setIsPaymentConfirmed] = useState(false);
  const [receiptSent, setReceiptSent] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'qr' | 'cash'>('qr');
  const [cashReceived, setCashReceived] = useState<string>('');

  const handleOpenQr = () => {
    setShowQrModal(true);
    setIsPaymentConfirmed(false);
    setReceiptSent(null);
    setPaymentMethod('qr');
    setCashReceived('');
  };

  const handleConfirmPayment = () => {
    setIsPaymentConfirmed(true);
  };

  const handlePrintReceipt = () => {
    setReceiptSent('🖨 พิมพ์ใบเสร็จรับเงินเรียบร้อยแล้ว');
    setTimeout(() => setReceiptSent(null), 3000);
  };

  const handleSendDigitalReceipt = () => {
    setReceiptSent('📱 ส่งใบเสร็จดิจิทัลไปยัง SMS/Email ของผู้ป่วยเรียบร้อยแล้ว');
    setTimeout(() => setReceiptSent(null), 3000);
  };

  // คำนวณยอดรวม
  const medTotal = activePatient.medications.reduce((sum, m) => sum + m.price, 0);
  const medicalServiceFee = 800; // 500 (Doctor) + 300 (Clinic)
  const vatTax = Math.round(medTotal * 0.07);
  const grandTotal = medTotal + medicalServiceFee + vatTax;

  const cashNumber = parseFloat(cashReceived) || 0;
  const changeAmount = cashNumber >= grandTotal ? cashNumber - grandTotal : 0;

  return (
    <div className="billing-invoice-container">
      <div className="page-header-row">
        <div>
          <h1 className="page-title">รายการบิล (Billing & Invoice)</h1>
          <p className="page-subtitle">สรุปค่าบริการ ค่ายา และสร้าง QR Code สำหรับชำระเงิน</p>
        </div>

        <div className="invoice-patient-switcher">
          {CLINIC_CONFIG.patients.map((p) => (
            <button
              key={p.id}
              className={`patient-switch-btn ${p.id === activePatient.id ? 'active' : ''}`}
              onClick={() => onSelectPatientId && onSelectPatientId(p.id)}
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
                บัตรประชาชน: {activePatient.nationalId}
              </span>
            </div>
            <div className="patient-dark-sub" style={{ marginTop: '10px', marginBottom: '16px', display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'center', fontSize: '1.05rem', color: '#F1F5F9' }}>
              <span>เพศ {activePatient.gender}</span>
              <span>อายุ {activePatient.age} ปี</span>
              <span>วันเกิด: {activePatient.dob}</span>
              <span>เบอร์โทร: {activePatient.phone}</span>
              <span>อาชีพ: {activePatient.occupation}</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ 
              background: activePatient.patientType.includes('OPD') ? 'rgba(59, 130, 246, 0.25)' : 'rgba(168, 85, 247, 0.25)', 
              color: activePatient.patientType.includes('OPD') ? '#93C5FD' : '#E9D5FF', 
              border: `1.5px solid ${activePatient.patientType.includes('OPD') ? '#60A5FA' : '#C084FC'}`, 
              padding: '5px 14px', borderRadius: '16px', fontSize: '13.5px', fontWeight: 'bold' 
            }}>
              {activePatient.patientType}
            </span>
            <span className="status-tag" style={{ 
              background: isPaymentConfirmed ? 'rgba(52, 211, 153, 0.25)' : 'rgba(239, 68, 68, 0.25)', 
              color: isPaymentConfirmed ? '#6EE7B7' : '#FCA5A5',
              border: `1.5px solid ${isPaymentConfirmed ? '#34D399' : '#F87171'}`, 
              padding: '5px 14px', borderRadius: '16px', fontSize: '13.5px', fontWeight: 'bold' 
            }}>
              {isPaymentConfirmed ? '✓ ชำระเงินแล้ว' : '🔴 ยังไม่ชำระเงิน'}
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
            <div><span className="dark-label">แพทย์ผู้ตรวจ:</span> <span style={{ color: '#F8FAFC', fontWeight: '600' }}>นพ.สมชาย สุขใจ</span></div>
          </div>

          <div className="dark-info-col">
            <div><span className="dark-label">ประวัติแพ้ยา:</span> {activePatient.allergies.length > 0 ? activePatient.allergies.map((a, i) => <span key={i} className="allergy-tag">{a}</span>) : <span style={{ color: '#CBD5E1' }}>ไม่มี</span>}</div>
            <div><span className="dark-label">โรคประจำตัว:</span> <span style={{ color: '#F8FAFC', fontWeight: '600' }}>{activePatient.chronicDiseases}</span></div>
            <div><span className="dark-label">สัญญาณชีพ:</span> <span style={{ color: '#F8FAFC', fontWeight: '600' }}>{activePatient.vitals}</span></div>
          </div>

          <div className="dark-info-col">
            <div><span className="dark-label">คำแนะนำแพทย์:</span> <span style={{ color: '#F8FAFC', fontStyle: 'italic', lineHeight: '1.6', display: 'block', marginTop: '4px' }}>"{activePatient.doctorAdvice}"</span></div>
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
              <span className="fee-price">- ฿ 500</span>
            </div>
            <div className="fee-item">
              <span>ค่าบริการคลินิก</span>
              <span className="fee-price">- ฿ 300</span>
            </div>
          </div>
        </div>

        <div className="fee-card card">
          <h2 className="fee-card-title">ค่ายา ({activePatient.medications.length} รายการ)</h2>
          <div className="fee-list">
            {activePatient.medications.map((m, idx) => (
              <div key={idx} className="fee-item">
                <span>{m.name}</span>
                <span className="fee-price">- ฿ {m.price}</span>
              </div>
            ))}

            <div className="fee-divider"></div>

            <div className="fee-sub-item">
              <span>ค่ายารวมสุทธิ</span>
              <span>฿ {medTotal}</span>
            </div>
            <div className="fee-sub-item">
              <span>ภาษี (VAT 7%)</span>
              <span>- ฿ {vatTax}</span>
            </div>

            <div className="grand-total-row">
              <span className="grand-label">ยอดชำระสุทธิ</span>
              <span className="grand-price">฿ {grandTotal.toLocaleString()}</span>
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
        <div className="modal-overlay">
          <div className="qr-modal-card compact-modal">
            <div className="qr-modal-header">
              <div>
                <h2 className="qr-modal-title">ชำระเงิน</h2>
              </div>
              <button className="modal-close-icon" onClick={() => setShowQrModal(false)}>✕</button>
            </div>

            {receiptSent && (
              <div className="toast-receipt-sent">
                {receiptSent}
              </div>
            )}

            {/* Payment Method Selector Toggle */}
            <div className="payment-method-toggle">
              <button
                className={`toggle-tab-btn ${paymentMethod === 'qr' ? 'active-qr' : ''}`}
                onClick={() => setPaymentMethod('qr')}
              >
                📱 สแกน QR
              </button>
              <button
                className={`toggle-tab-btn ${paymentMethod === 'cash' ? 'active-cash' : ''}`}
                onClick={() => setPaymentMethod('cash')}
              >
                💵 เงินสด
              </button>
            </div>

            <div className="qr-modal-body">
              {paymentMethod === 'qr' ? (
                /* PromptPay QR Code Payment UI */
                <div className="qr-code-box">

                  <div className="qr-patient-row">
                    <span className="qr-label">ผู้ป่วย:</span>
                    <span className="qr-val">{activePatient.name}</span>
                  </div>
                  <div className="qr-amount-row">
                    <span className="qr-label">ยอดชำระสุทธิ:</span>
                    <span className="qr-amount">{grandTotal.toLocaleString()}.00 บาท</span>
                  </div>

                  <div className="thai-qr-card-container">
                    <img
                      src={CLINIC_CONFIG.paymentAccount.qrImagePath}
                      alt="Thai QR Payment PromptPay - นาย บุญค้ำ โยลัย"
                      className="thai-qr-card-img"
                    />
                  </div>

                  <div className="timeout-alert">
                    <span>⏰ กรุณาชำระเงินให้เสร็จสิ้นภายใน 5 นาที</span>
                    <a href="#" onClick={(e) => e.preventDefault()} className="regen-link">สร้าง QR ใหม่</a>
                  </div>

                  {!isPaymentConfirmed ? (
                    <button className="confirm-qr-btn" onClick={handleConfirmPayment}>
                      ✓ ยืนยันรับชำระ
                    </button>
                  ) : (
                    <div className="confirmed-badge">
                      ✓ ยืนยันการรับชำระเงินแล้ว
                    </div>
                  )}
                </div>
              ) : (
                /* Cash Payment UI */
                <div className="cash-payment-box">

                  <div className="qr-patient-row">
                    <span className="qr-label">ผู้ป่วย:</span>
                    <span className="qr-val">{activePatient.name}</span>
                  </div>
                  <div className="qr-amount-row">
                    <span className="qr-label">ยอดชำระสุทธิ:</span>
                    <span className="qr-amount price-highlight">{grandTotal.toLocaleString()}.00 บาท</span>
                  </div>

                  <div className="cash-input-group">
                    <label className="cash-input-label">รับเงินสด (บาท):</label>
                    <input
                      type="number"
                      className="cash-input-field"
                      placeholder="กรอกจำนวนเงิน..."
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                    />
                  </div>

                  {/* Quick Cash Buttons */}
                  <div className="quick-cash-pills">
                    <button onClick={() => setCashReceived(grandTotal.toString())}>พอดี ({grandTotal}฿)</button>
                    <button onClick={() => setCashReceived('1000')}>1,000฿</button>
                    <button onClick={() => setCashReceived('1500')}>1,500฿</button>
                    <button onClick={() => setCashReceived('2000')}>2,000฿</button>
                  </div>

                  <div className="cash-change-box">
                    <span>เงินทอนสุทธิ:</span>
                    <span className={`change-val ${cashNumber >= grandTotal ? 'green-change' : ''}`}>
                      {cashNumber >= grandTotal ? `฿ ${changeAmount.toLocaleString()}.00` : '฿ 0.00'}
                    </span>
                  </div>

                  {!isPaymentConfirmed ? (
                    <button 
                      className="confirm-qr-btn cash-confirm-btn" 
                      disabled={cashNumber < grandTotal}
                      onClick={handleConfirmPayment}
                    >
                      ✓ ยืนยันการรับเงินสด {cashNumber >= grandTotal && `(ทอน ฿${changeAmount.toLocaleString()})`}
                    </button>
                  ) : (
                    <div className="confirmed-badge">
                      ✓ ยืนยันการรับเงินสดเรียบร้อยแล้ว
                    </div>
                  )}
                </div>
              )}

              <div className="receipt-actions-side">
                {isPaymentConfirmed ? (
                  <div className="success-status-box">
                    <div className="big-green-check">✓</div>
                    <h3 className="success-text">ชำระเงินสำเร็จ</h3>
                    <p className="success-sub">บันทึกข้อมูลการชำระเงินเข้าสู่ระบบเรียบร้อยแล้ว ({paymentMethod === 'qr' ? 'พร้อมเพย์ QR Code' : 'เงินสด'})</p>

                    <div className="receipt-btns">
                      <button className="receipt-btn print-btn" onClick={handlePrintReceipt}>
                        🖨 พิมพ์ใบเสร็จรับเงิน
                      </button>
                      <button className="receipt-btn digital-btn" onClick={handleSendDigitalReceipt}>
                        📱 ส่งใบเสร็จดิจิทัล (SMS/Email)
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="pending-status-box">
                    <div className="pending-pulse-circle">⌛</div>
                    <h3>รอการชำระเงิน ({paymentMethod === 'qr' ? 'พร้อมเพย์' : 'เงินสด'})</h3>
                    <p>
                      {paymentMethod === 'qr' 
                        ? 'สแกน QR Code ด้านซ้ายเพื่อรับชำระเงิน เมื่อลูกค้าชำระเสร็จให้กดปุ่ม "ยืนยันการรับชำระเงิน"' 
                        : 'รับเงินสดจากผู้ป่วย ตรวจสอบจำนวนเงินสดและกดปุ่ม "ยืนยันการรับเงินสด"'}
                    </p>
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
