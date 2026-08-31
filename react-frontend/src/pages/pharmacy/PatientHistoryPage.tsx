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

          {/* Filter Pills matching Image 3 (Urgency Filter Removed) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '12px', borderTop: '1px solid #F1F5F9' }}>
            {/* Row 1: ช่วงเวลา */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13.5px', fontWeight: '700', color: '#0F172A', minWidth: '80px' }}>ช่วงเวลา:</span>
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
                      <th style={{ textAlign: 'center' }}>สิทธิการรักษา</th>
                      <th style={{ textAlign: 'center' }}>จำนวนเข้ารักษา</th>
                      <th>โรคประจำตัว</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPatients.map((patient, idx) => {
                      const rights = idx % 3 === 0 ? 'สิทธิ 30 บาท (สปสช.)' : idx % 3 === 1 ? 'ประกันสังคม' : 'ประกันสุขภาพเอกชน';
                      return (
                        <tr key={patient.id}>
                          <td className="hn-cell" style={{ color: '#0F172A', fontWeight: '700', fontSize: '14.5px' }}>{patient.hn.replace(/[-]/g, '')}</td>
                          <td 
                            className="patient-name-cell clickable-patient-history"
                            onClick={() => setSelectedPatientModal(patient)}
                          >
                            <span className="history-name-link">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px', marginTop: '-2px' }}>
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                                <circle cx="12" cy="7" r="4"/>
                              </svg>
                              {patient.name}
                            </span>
                            <span className="history-hint-tag">คลิกดูประวัติการรักษา & แพ้ยา </span>
                          </td>
                          <td>{patient.age} ปี</td>
                          <td><span className="blood-badge">{patient.bloodType}</span></td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ 
                              background: rights.includes('30') ? '#FEF9C3' : rights.includes('ประกันสังคม') ? '#E0F2FE' : '#F3E8FF',
                              color: rights.includes('30') ? '#92400E' : rights.includes('ประกันสังคม') ? '#075985' : '#6D28D9',
                              border: `1px solid ${rights.includes('30') ? '#FDE68A' : rights.includes('ประกันสังคม') ? '#BAE6FD' : '#DDD6FE'}`,
                              padding: '6px 14px', borderRadius: '9999px', fontSize: '13px', fontWeight: '700',
                              whiteSpace: 'nowrap', display: 'inline-flex', justifyContent: 'center', alignItems: 'center',
                              width: '175px', textAlign: 'center', boxSizing: 'border-box'
                            }}>
                              {rights}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', padding: '6px 14px', borderRadius: '9999px', fontWeight: '700', fontSize: '13px', display: 'inline-block' }}>
                              เข้ารักษา {((idx * 3 + 4) % 12) + 1} ครั้ง
                            </span>
                          </td>
                          <td>
                            <div className="disease-badges">
                              {patient.diseases.map((d, i) => (
                                <span key={i} className="disease-tag">{d}</span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
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

      {/* Patient Full History Pop-up Modal (Images 1 & 2 Pattern) */}
      {selectedPatientModal && (
        <div className="modal-overlay" onClick={() => setSelectedPatientModal(null)}>
          <div className="patient-history-modal-card card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '680px', width: '100%', borderRadius: '16px', overflow: 'hidden', border: 'none' }}>
            {/* Modal Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '700', color: '#0F172A' }}>
                  รายละเอียดประวัติสุขภาพ & ข้อมูลการรับยา
                </h2>
                <p style={{ margin: 0, fontSize: '13.5px', color: '#64748B' }}>
                  หมายเลขคิว <span style={{ color: '#2563EB', fontWeight: '700' }}>Q0001</span> • {selectedPatientModal.name}
                </p>
              </div>
              <button 
                onClick={() => setSelectedPatientModal(null)}
                style={{ background: 'transparent', border: 'none', fontSize: '18px', color: '#94A3B8', cursor: 'pointer', padding: '4px' }}
              >
                ✕
              </button>
            </div>

            <div className="history-modal-body" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '75vh', overflowY: 'auto' }}>
              {/* Summary Information Card (Image 1 Format) */}
              <div style={{ background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B', fontSize: '13.5px' }}>หมายเลขคิว:</span>
                  <span style={{ color: '#2563EB', fontWeight: '700', fontSize: '14.5px' }}>Q0001</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B', fontSize: '13.5px' }}>ชื่อคนไข้:</span>
                  <span style={{ color: '#0F172A', fontWeight: '700', fontSize: '13.5px' }}>{selectedPatientModal.name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B', fontSize: '13.5px' }}>เลขบัตรประชาชน / HN:</span>
                  <span style={{ color: '#0F172A', fontWeight: '700', fontSize: '13.5px' }}>{selectedPatientModal.hn}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B', fontSize: '13.5px' }}>เวลารับคิว:</span>
                  <span style={{ color: '#0F172A', fontWeight: '700', fontSize: '13.5px' }}>08:45 น.</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gridColumn: 'span 2', paddingTop: '6px', borderTop: '1px dashed #E2E8F0' }}>
                  <span style={{ color: '#64748B', fontSize: '13.5px' }}>จำนวนเข้ารักษาทั้งหมด:</span>
                  <span style={{ background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', padding: '2px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '700' }}>
                    12 ครั้ง (Visit #12)
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gridColumn: 'span 2', paddingTop: '4px' }}>
                  <span style={{ color: '#64748B', fontSize: '13.5px' }}>สิทธิการรักษา:</span>
                  <span style={{ background: '#F3E8FF', color: '#6B21A8', border: '1px solid #DDD6FE', padding: '2px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '700' }}>
                    {selectedPatientModal.treatmentRights || 'สิทธิ 30 บาท (สปสช.)'}
                  </span>
                </div>
              </div>

              {/* Vital Signs Grid (Image 2 Format) */}
              <div>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '700', color: '#0F172A' }}>
                  📊 ค่าสัญญาณชีพและสรีรวิทยา (Vital Signs Measurements)
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11.5px', color: '#64748B', fontWeight: '600', marginBottom: '4px' }}>ความดันโลหิต (BP)</div>
                    <div style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A' }}>120/80 <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '500' }}>mmHg</span></div>
                    <span style={{ background: '#DCFCE7', color: '#15803D', fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '10px', display: 'inline-block', marginTop: '4px' }}>ปกติ</span>
                  </div>
                  <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11.5px', color: '#64748B', fontWeight: '600', marginBottom: '4px' }}>ชีพจร (Heart Rate)</div>
                    <div style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A' }}>80 <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '500' }}>bpm</span></div>
                    <span style={{ background: '#DCFCE7', color: '#15803D', fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '10px', display: 'inline-block', marginTop: '4px' }}>ปกติ</span>
                  </div>
                  <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11.5px', color: '#64748B', fontWeight: '600', marginBottom: '4px' }}>อุณหภูมิ (Temp)</div>
                    <div style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A' }}>36.5 <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '500' }}>°C</span></div>
                    <span style={{ background: '#DCFCE7', color: '#15803D', fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '10px', display: 'inline-block', marginTop: '4px' }}>ปกติ</span>
                  </div>
                </div>
              </div>

              {/* Department / Room Block (Image 1 Format) */}
              <div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '700', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>🏠</span> จุดบริการ / ห้องตรวจ:
                </h4>
                <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: '10px', padding: '12px 16px', color: '#0369A1', fontWeight: '700', fontSize: '14.5px' }}>
                  ห้องจ่ายยาและเภสัชกรรม (อาคารผู้ป่วยนอก ชั้น 1)
                </div>
              </div>

              {/* Prescription & Doctor Advice Block (Image 1 Format) */}
              <div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '700', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>📄</span> คำสั่งการรักษา & รายการยาที่ได้รับ (ฉบับเต็ม):
                </h4>
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '13.5px', color: '#334155', lineHeight: '1.5' }}>
                    <strong>คำสั่งแพทย์:</strong> ผู้ป่วยรับยารักษาอาการตามสั่ง ตรวจเช็คประวัติแพ้ยาเรียบร้อยแล้ว ไม่พบข้อห้ามใช้ยา ให้คำแนะนำการรับประทานหลังอาหารทันที
                  </div>
                  <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '8px' }}>
                    <strong style={{ fontSize: '13px', color: '#0F172A' }}>รายการยา:</strong>
                    <ul style={{ margin: '4px 0 0 18px', padding: 0, fontSize: '13px', color: '#475569' }}>
                      <li>Paracetamol 500mg (10 เม็ด) - รับประทาน 1 เม็ด หลังอาหาร 3 เวลา</li>
                      <li>Amoxicillin 500mg (20 เม็ด) - รับประทาน 1 เม็ด หลังอาหาร เช้า-เย็น (ทานติดต่อกันจนหมด)</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Allergies Block (Image 1 & 2 Format) */}
              <div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '700', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>⚠️</span> ประวัติแพ้ยา (Known Allergies):
                </h4>
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ background: '#FEE2E2', color: '#991B1B', fontWeight: '700', padding: '4px 12px', borderRadius: '8px', fontSize: '12.5px' }}>
                    เพนิซิลลิน (Penicillin)
                  </span>
                  <span style={{ fontSize: '12.5px', color: '#991B1B' }}>อาการ: เกิดผื่นคัน ปากบวม (ระวังกลุ่ม Beta-lactams)</span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid #F1F5F9', display: 'flex', justifyContent: 'flex-end', background: '#F8FAFC' }}>
              <button 
                onClick={() => setSelectedPatientModal(null)}
                style={{ padding: '8px 24px', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#334155', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
