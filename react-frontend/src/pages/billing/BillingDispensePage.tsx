import { useState } from 'react';
import './BillingDispensePage.css';
import { CLINIC_CONFIG, type PatientConfig } from '../../config/clinicConfig';

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
  const [searchPatient, setSearchPatient] = useState('');

  const activePatient: PatientConfig = CLINIC_CONFIG.patients.find(p => p.id === selectedPatientId) || CLINIC_CONFIG.patients[0];
  const currentRights = patientRightsMap?.[activePatient.id] || activePatient.treatmentRights;

  const handleSearch = () => {
    const query = searchPatient.trim().toLowerCase();
    const found = CLINIC_CONFIG.patients.find(
      p => p.id.toLowerCase() === query || p.name.toLowerCase().includes(query) || p.shortName.toLowerCase().includes(query)
    );
    if (found && onSelectPatientId) {
      onSelectPatientId(found.id);
    }
  };

  const medTotal = activePatient.medications.reduce((sum, m) => sum + m.price, 0);

  return (
    <div className="billing-dispense-container">


      <h1 className="page-title">รายการจ่ายเงิน & ใบสั่งยาผู้ป่วย</h1>

      <div className="dispense-grid">
        {/* Prescription List */}
        <div className="prescription-card card">
          <div className="card-top-row">
            <h2 className="card-heading">รายการยาที่แพทย์สั่งจ่าย - {activePatient.name} ({activePatient.medications.length} รายการ)</h2>
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

          <div className="stock-alert-box">
            <span className="alert-icon">⚠</span>
            <span>แจ้งเตือนสต็อกต่ำ: Ibuprofen 400mg - เหลือในคลัง 0 ชิ้น</span>
          </div>

          <table className="dispense-table">
            <thead>
              <tr>
                <th>ชื่อรายการยา</th>
                <th>ขนาด/วิธีใช้</th>
                <th style={{ textAlign: 'right' }}>จำนวน</th>
              </tr>
            </thead>
            <tbody>
              {activePatient.medications.map((med, idx) => (
                <tr key={idx}>
                  <td className="item-name font-bold">{med.name}</td>
                  <td>{med.dosage}</td>
                  <td style={{ textAlign: 'right' }}>1</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Dispensing & Price Summary */}
        <div className="summary-card card">
          <h2 className="card-heading">สรุปการจ่ายยาและคำนวณเงิน</h2>

          {/* Treatment Rights Selector Dropdown */}
          <div className="summary-rights-box">
            <label className="summary-rights-label">🛡️ สิทธิการรักษา:</label>
            <select 
              className="summary-rights-select"
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

          <div className="summary-items">
            {activePatient.medications.map((med, idx) => (
              <div key={idx} className="summary-item">
                <div className="item-details">
                  <div className="item-title">{med.name}</div>
                  <div className="item-sub">{med.dosage}</div>
                </div>
                <div className="item-price">฿ {med.price.toLocaleString()}</div>
              </div>
            ))}
          </div>

          <div className="summary-divider"></div>

          <div className="total-row main-total">
            <span>ค่ายารวมสุทธิ:</span>
            <span className="total-price">฿ {medTotal.toLocaleString()}</span>
          </div>

          <button className="submit-billing-btn" onClick={onNavigateToBilling}>
            ยืนยัน & ออกบิลชำระเงิน (Go to Billing)
          </button>
        </div>
      </div>
    </div>
  );
}
