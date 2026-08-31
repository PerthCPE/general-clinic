import { useState } from 'react';
import './PatientHistoryPage.css';

interface Patient {
  id: string;
  hn: string;
  name: string;
  age: number;
  bloodType: string;
  diseases: string[];
  avatarUrl?: string;
  weightHeight?: string;
  treatmentRights?: string;
}

interface MedicationHistory {
  date: string;
  time: string;
  medName: string;
  indication: string;
  dosage: string;
  dosageTag: string;
  quantity: string;
}

interface AllergyInfo {
  allergen: string;
  symptom: string;
  severity: 'high' | 'low';
}

const mockPatients: Patient[] = [
  {
    id: 'PT-88213',
    hn: 'HN0045',
    name: 'นาย สมชาย ใจดี',
    age: 45,
    bloodType: 'O+',
    diseases: ['ความดันโลหิตสูง', 'เบาหวาน'],
    weightHeight: '72 kg / 175 cm',
    treatmentRights: 'ประกันสังคม'
  },
  {
    id: 'PT-88214',
    hn: 'HN0112',
    name: 'นาง มะลิวัน จันทร์เพ็ญ',
    age: 62,
    bloodType: 'A-',
    diseases: ['ไม่มี'],
    weightHeight: '58 kg / 160 cm',
    treatmentRights: 'สิทธิ 30 บาท'
  },
  {
    id: 'PT-88215',
    hn: 'HN0018',
    name: 'นาย พงศกร รัตนสัจจะ',
    age: 28,
    bloodType: 'B+',
    diseases: ['หอบหืด'],
    weightHeight: '68 kg / 170 cm',
    treatmentRights: 'ประกันสุขภาพเอกชน'
  },
  {
    id: 'PT-88216',
    hn: 'HN0884',
    name: 'นางสาว ศิริพร แก้วมณี',
    age: 34,
    bloodType: 'AB+',
    diseases: ['ไม่มี'],
    weightHeight: '52 kg / 163 cm',
    treatmentRights: 'สิทธิ 30 บาท'
  }
];

const mockMedHistory: MedicationHistory[] = [
  {
    date: '24 ก.ย. 66',
    time: '14:30 น.',
    medName: 'Amlodipine 5mg tab',
    indication: 'ความดันโลหิตสูง',
    dosage: '1 เม็ด วันละ 1 ครั้ง',
    dosageTag: 'หลังอาหารเช้า',
    quantity: '30 Tabs'
  },
  {
    date: '24 ก.ย. 66',
    time: '14:30 น.',
    medName: 'Metformin 500mg tab',
    indication: 'เบาหวาน',
    dosage: '1 เม็ด วันละ 2 ครั้ง',
    dosageTag: 'หลังอาหาร เช้า-เย็น',
    quantity: '60 Tabs'
  },
  {
    date: '10 ส.ค. 66',
    time: '09:15 น.',
    medName: 'Paracetamol 500mg',
    indication: 'แก้ไข้ ปวดศีรษะ',
    dosage: '1 เม็ด ทุกๆ 6 ชั่วโมง',
    dosageTag: 'เมื่อมีอาการ',
    quantity: '20 Tabs'
  },
  {
    date: '02 ก.ค. 66',
    time: '11:00 น.',
    medName: 'Simvastatin 20mg',
    indication: 'ไขมันในเลือดสูง',
    dosage: '1 เม็ด วันละ 1 ครั้ง',
    dosageTag: 'หลังอาหารเย็น',
    quantity: '30 Tabs'
  }
];

const mockAllergies: AllergyInfo[] = [
  {
    allergen: 'Penicillin',
    symptom: 'ผื่นแดง หายใจขัดขัด (รุนแรง)',
    severity: 'high'
  },
  {
    allergen: 'อาหารทะเล',
    symptom: 'ผื่นคันเล็กน้อย',
    severity: 'low'
  }
];

export default function PatientHistoryPage() {
  const [searchHn, setSearchHn] = useState('');
  const [searchName, setSearchName] = useState('');
  const [selectedPatientModal, setSelectedPatientModal] = useState<Patient | null>(null);
  const [isPatientListExpanded, setIsPatientListExpanded] = useState(true);

  // Filter States matching Image 3
  const [timeRange, setTimeRange] = useState<'all' | 'today' | 'month'>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<'all' | 'emergency' | 'urgent' | 'normal'>('all');
  const [riskFilter, setRiskFilter] = useState<'all' | 'hypertension' | 'fever' | 'allergies'>('all');
  const [currentPage, setCurrentPage] = useState(1);

  const filteredPatients = mockPatients.filter(patient => {
    const matchHn = patient.hn.toLowerCase().includes(searchHn.toLowerCase());
    const matchName = patient.name.toLowerCase().includes(searchName.toLowerCase());

    let matchRisk = true;
    if (riskFilter === 'hypertension') {
      matchRisk = patient.diseases.some(d => d.includes('ความดัน'));
    } else if (riskFilter === 'allergies') {
      matchRisk = patient.diseases.some(d => d.includes('แพ้ยา') || d.includes('ภูมิแพ้')) || true;
    }

    return matchHn && matchName && matchRisk;
  });

  return (
    <div className="patient-history-container">
      <div className="list-view-container">
        <div className="page-header" style={{ marginBottom: '24px' }}>
          <div className="header-titles">
            <h1 className="page-title">ประวัติผู้ป่วย</h1>
            <p className="page-subtitle">
              ค้นหาและคลิกที่ชื่อผู้ป่วยเพื่อดูประวัติการรักษา ยาที่ได้รับ และประวัติแพ้ยา
            </p>
          </div>
        </div>

        <div className="search-card card" style={{ padding: '20px 24px', marginBottom: '24px', borderRadius: '12px', background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div className="search-inputs" style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
            <div className="input-group" style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '13.5px', color: '#475569' }}>รหัสผู้ป่วย (HN)</label>
              <div className="input-with-icon">
                <input
                  type="text"
                  placeholder="เช่น HN0001"
                  value={searchHn}
                  onChange={(e) => setSearchHn(e.target.value)}
                  style={{ width: '100%', padding: '9px 14px', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '14px' }}
                />
              </div>
            </div>

            <div className="input-group" style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '13.5px', color: '#475569' }}>ชื่อผู้ป่วย</label>
              <div className="input-with-icon">
                <input
                  type="text"
                  placeholder="เช่น Somchai Jai-dee"
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  style={{ width: '100%', padding: '9px 14px', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '14px' }}
                />
              </div>
            </div>
          </div>

          {/* Filter Pills matching Image 3 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '12px', borderTop: '1px solid #F1F5F9' }}>
            {/* Row 1: ช่วงเวลา & ระดับความเร่งด่วน */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '13.5px', fontWeight: '700', color: '#0F172A', minWidth: '70px' }}>ช่วงเวลา:</span>
                {(['all', 'today', 'month'] as const).map((key) => {
                  const labels = { all: 'ทั้งหมด', today: 'วันนี้', month: 'เดือนนี้' };
                  const active = timeRange === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setTimeRange(key)}
                      style={{
                        padding: '6px 16px', borderRadius: '8px', border: active ? 'none' : '1px solid #E2E8F0',
                        background: active ? '#0F172A' : '#F8FAFC', color: active ? '#FFFFFF' : '#334155',
                        fontWeight: active ? '700' : '500', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s'
                      }}
                    >
                      {labels[key]}
                    </button>
                  );
                })}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '13.5px', fontWeight: '700', color: '#0F172A' }}>ระดับความเร่งด่วน:</span>
                {(['all', 'emergency', 'urgent', 'normal'] as const).map((key) => {
                  const labels = { all: 'ทั้งหมด', emergency: 'ฉุกเฉิน / วิกฤต', urgent: 'กึ่งฉุกเฉิน', normal: 'ปกติ (Normal)' };
                  const active = urgencyFilter === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setUrgencyFilter(key)}
                      style={{
                        padding: '6px 16px', borderRadius: '8px', border: active ? 'none' : '1px solid #E2E8F0',
                        background: active ? '#0F172A' : '#F8FAFC', color: active ? '#FFFFFF' : '#334155',
                        fontWeight: active ? '700' : '500', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s'
                      }}
                    >
                      {labels[key]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Row 2: ความเสี่ยงทางคลินิก */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13.5px', fontWeight: '700', color: '#0F172A', minWidth: '120px' }}>ความเสี่ยงทางคลินิก:</span>
              {(['all', 'hypertension', 'fever', 'allergies'] as const).map((key) => {
                const labels = { all: 'ทั้งหมด', hypertension: 'ความดันสูง', fever: 'มีไข้ (> 37.5°C)', allergies: 'มีประวัติแพ้ยา' };
                const active = riskFilter === key;
                return (
                  <button
                    key={key}
                    onClick={() => setRiskFilter(key)}
                    style={{
                      padding: '6px 16px', borderRadius: '8px', border: active ? 'none' : '1px solid #E2E8F0',
                      background: active ? '#0F172A' : '#F8FAFC', color: active ? '#FFFFFF' : '#334155',
                      fontWeight: active ? '700' : '500', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s'
                    }}
                  >
                    {labels[key]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="patient-table-card card" style={{ display: 'flex', flexDirection: 'column', width: '100%', padding: '0', marginBottom: '24px', transition: 'all 0.3s ease', overflow: 'hidden' }}>
          <div 
            onClick={() => setIsPatientListExpanded(!isPatientListExpanded)}
            style={{ 
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
              padding: '18px 24px', background: '#F8FAFC', borderBottom: isPatientListExpanded ? '1px solid #E2E8F0' : 'none',
              cursor: 'pointer', userSelect: 'none' 
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '16.5px', fontWeight: '700', color: '#0F172A' }}>
                รายชื่อผู้ป่วยที่เข้ารับการรักษา
              </h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ background: '#DBEAFE', color: '#1E40AF', fontWeight: 'bold', padding: '4px 12px', borderRadius: '16px', fontSize: '13px' }}>
                แสดง {filteredPatients.length} รายการ
              </span>
              <svg 
                width="18" height="18" viewBox="0 0 24 24" fill="none" 
                style={{ color: '#64748B', transform: isPatientListExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.25s ease', flexShrink: 0 }}
              >
                <path d="M19.5 8.25l-7.5 7.5-7.5-7.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          {isPatientListExpanded && (
            <>
              <div className="table-wrapper">
                <table className="patient-table">
                  <thead>
                    <tr>
                      <th>ID (HN)</th>
                      <th>ชื่อผู้ป่วย (คลิกเพื่อดูประวัติ)</th>
                      <th>อายุ</th>
                      <th>กรุ๊ปเลือด</th>
                      <th>โรคประจำตัว</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPatients.map((patient) => (
                      <tr key={patient.id}>
                        <td className="hn-cell">{patient.hn}</td>
                        <td 
                          className="patient-name-cell clickable-patient-history"
                          onClick={() => setSelectedPatientModal(patient)}
                        >
                          <span className="history-name-link">👤 {patient.name}</span>
                          <span className="history-hint-tag">คลิกดูประวัติการรักษา & แพ้ยา </span>
                        </td>
                        <td>{patient.age} ปี</td>
                        <td><span className="blood-badge">{patient.bloodType}</span></td>
                        <td>
                          <div className="disease-badges">
                            {patient.diseases.map((d, i) => (
                              <span key={i} className="disease-tag">{d}</span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Bar matching Image 4 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', background: '#FFFFFF', borderTop: '1px solid #E2E8F0', flexWrap: 'wrap', gap: '12px' }}>
                <span style={{ fontSize: '13.5px', color: '#64748B', fontWeight: '500' }}>
                  แสดง 1 ถึง {filteredPatients.length} จาก {mockPatients.length} รายการ
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button 
                    disabled={currentPage === 1}
                    style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#64748B', fontSize: '13.5px', cursor: 'not-allowed' }}
                  >
                    ย้อนกลับ
                  </button>
                  <button 
                    style={{ padding: '6px 14px', borderRadius: '8px', border: 'none', background: '#2563EB', color: '#FFFFFF', fontWeight: '700', fontSize: '13.5px', cursor: 'pointer' }}
                  >
                    1
                  </button>
                  <button 
                    disabled
                    style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#64748B', fontSize: '13.5px', cursor: 'not-allowed' }}
                  >
                    ถัดไป
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Patient Full History Pop-up Modal */}
      {selectedPatientModal && (
        <div className="modal-overlay" onClick={() => setSelectedPatientModal(null)}>
          <div className="patient-history-modal-card card" onClick={(e) => e.stopPropagation()}>
            <div className="history-modal-header">
              <div>
                <span className="history-modal-badge">👤 รายละเอียดประวัติสุขภาพผู้ป่วย</span>
                <h2 className="history-modal-name">{selectedPatientModal.name}</h2>
                <span className="history-modal-hn">รหัสผู้ป่วย: {selectedPatientModal.id} • {selectedPatientModal.hn}</span>
              </div>
              <button className="history-modal-close" onClick={() => setSelectedPatientModal(null)}>✕</button>
            </div>

            <div className="history-modal-body">
              {/* Stats Bar */}
              <div className="history-stats-bar">
                <div className="h-stat-box">
                  <span className="h-stat-label">อายุ</span>
                  <span className="h-stat-val">{selectedPatientModal.age} ปี</span>
                </div>
                <div className="h-stat-box">
                  <span className="h-stat-label">กรุ๊ปเลือด</span>
                  <span className="h-stat-val">{selectedPatientModal.bloodType}</span>
                </div>
                <div className="h-stat-box">
                  <span className="h-stat-label">น้ำหนัก / ส่วนสูง</span>
                  <span className="h-stat-val">{selectedPatientModal.weightHeight || '70 kg / 172 cm'}</span>
                </div>
                <div className="h-stat-box">
                  <span className="h-stat-label">สิทธิการรักษา</span>
                  <span className="h-stat-val">{selectedPatientModal.treatmentRights || 'ประกันสังคม'}</span>
                </div>
              </div>

              {/* Allergies Section */}
              <div className="history-section-block">
                <h3 className="section-title text-red">⚠️ ข้อมูลการแพ้ยา (Allergies)</h3>
                <div className="allergy-list-grid">
                  {mockAllergies.map((allergy, i) => (
                    <div key={i} className={`allergy-pill-item ${allergy.severity === 'high' ? 'sev-high' : 'sev-low'}`}>
                      <div className="allergy-pill-name">{allergy.allergen}</div>
                      <div className="allergy-pill-symptom">อาการ: {allergy.symptom}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Medication History Table */}
              <div className="history-section-block">
                <h3 className="section-title">ประวัติการรับยาล่าสุดในระบบ</h3>
                <div className="table-wrapper">
                  <table className="med-history-table">
                    <thead>
                      <tr>
                        <th>วันที่รับยา</th>
                        <th>รายการยา (MEDICINE NAME)</th>
                        <th>วิธีใช้ (DOSAGE)</th>
                        <th style={{ textAlign: 'right' }}>จำนวน</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mockMedHistory.map((item, idx) => (
                        <tr key={idx}>
                          <td className="date-cell">{item.date} ({item.time})</td>
                          <td className="med-title">{item.medName}</td>
                          <td>{item.dosage} ({item.dosageTag})</td>
                          <td className="qty-cell">{item.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="history-modal-footer">
              <button className="primary-close-btn" onClick={() => setSelectedPatientModal(null)}>
                ปิดหน้าต่างประวัติผู้ป่วย
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
