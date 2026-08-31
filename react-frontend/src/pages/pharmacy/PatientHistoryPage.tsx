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

  const filteredPatients = mockPatients.filter(patient => {
    const matchHn = patient.hn.toLowerCase().includes(searchHn.toLowerCase());
    const matchName = patient.name.toLowerCase().includes(searchName.toLowerCase());
    return matchHn && matchName;
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

        <div className="search-card">
          <div className="search-inputs">
            <div className="input-group">
              <label>รหัสผู้ป่วย (HN)</label>
              <div className="input-with-icon">
                <input
                  type="text"
                  placeholder="เช่น HN0001"
                  value={searchHn}
                  onChange={(e) => setSearchHn(e.target.value)}
                />
              </div>
            </div>

            <div className="input-group">
              <label>ชื่อผู้ป่วย</label>
              <div className="input-with-icon">
                <input
                  type="text"
                  placeholder="เช่น Somchai Jai-dee"
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                />
              </div>
            </div>
          </div>

          <button className="search-btn">ค้นหา</button>
        </div>

        <div className="patient-table-card">
          <div className="table-header-row">
            <h2 className="table-title">รายชื่อผู้ป่วยที่เข้ารับการรักษา</h2>
            <span className="count-badge">แสดง {filteredPatients.length} รายการ</span>
          </div>

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
