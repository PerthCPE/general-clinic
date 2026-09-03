import { useState, useEffect } from 'react';
import { useWebSocket } from '../../context/WebSocketContext';
import './PatientHistoryPage.css';
import CopyableText from '../../components/Common/CopyableText';

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
  visitCount?: number;
  allergies?: string;
  phone?: string;
  queueNumber?: string;
  visitTime?: string;
  doctorAdvice?: string;
  createdAt?: string;
  updatedAt?: string;
  vitals?: {
    bp?: string;
    pulse?: number;
    temp?: number;
    weight?: number;
    height?: number;
  };
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
    treatmentRights: 'ประกันสังคม',
    visitCount: 5,
    allergies: 'ปฏิเสธการแพ้ยา'
  },
  {
    id: 'PT-88214',
    hn: 'HN0112',
    name: 'นาง มะลิวัน จันทร์เพ็ญ',
    age: 62,
    bloodType: 'A-',
    diseases: ['ไม่มี'],
    weightHeight: '58 kg / 160 cm',
    treatmentRights: 'สิทธิ 30 บาท (สปสช.)',
    visitCount: 8,
    allergies: 'ปฏิเสธการแพ้ยา'
  },
  {
    id: 'PT-88215',
    hn: 'HN0018',
    name: 'นาย พงศกร รัตนสัจจะ',
    age: 28,
    bloodType: 'B+',
    diseases: ['หอบหืด'],
    weightHeight: '68 kg / 170 cm',
    treatmentRights: 'ประกันสุขภาพเอกชน',
    visitCount: 11,
    allergies: 'หอบหืด'
  },
  {
    id: 'PT-88216',
    hn: 'HN0884',
    name: 'นางสาว ศิริพร แก้วมณี',
    age: 34,
    bloodType: 'AB+',
    diseases: ['ไม่มี'],
    weightHeight: '52 kg / 163 cm',
    treatmentRights: 'สิทธิ 30 บาท (สปสช.)',
    visitCount: 2,
    allergies: 'ปฏิเสธการแพ้ยา'
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
  }
];

export default function PatientHistoryPage() {
  const { subscribe } = useWebSocket();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatientModal, setSelectedPatientModal] = useState<Patient | null>(null);
  const [patientMedHistory, setPatientMedHistory] = useState<MedicationHistory[]>([]);
  const [isPatientListExpanded, setIsPatientListExpanded] = useState(true);

  // Filter States matching Image 3
  const [timeRange, setTimeRange] = useState<'all' | 'today' | 'month'>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<'all' | 'emergency' | 'urgent' | 'normal'>('all');
  const [riskFilter, setRiskFilter] = useState<'all' | 'hypertension' | 'fever' | 'allergies'>('all');
  const [currentPage, setCurrentPage] = useState(1);

  const [copiedHn, setCopiedHn] = useState<string | null>(null);

  // Edit Patient Modal State
  const [editPatientModal, setEditPatientModal] = useState<Patient | null>(null);
  const [editPatientForm, setEditPatientForm] = useState({
    name: '',
    age: 35,
    bloodType: 'O+',
    treatmentRights: 'สิทธิ 30 บาท (สปสช.)',
    diseases: '',
    allergies: 'ปฏิเสธการแพ้ยา',
    phone: '',
    visitCount: 1
  });
  const [isSavingPatient, setIsSavingPatient] = useState(false);

  // Delete Patient Modal State
  const [deleteConfirmPatient, setDeleteConfirmPatient] = useState<Patient | null>(null);
  const [isDeletingPatient, setIsDeletingPatient] = useState(false);

  const handleOpenEditPatient = (patient: Patient, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditPatientModal(patient);
    setEditPatientForm({
      name: patient.name,
      age: patient.age || 35,
      bloodType: patient.bloodType || 'O+',
      treatmentRights: patient.treatmentRights || 'สิทธิ 30 บาท (สปสช.)',
      diseases: Array.isArray(patient.diseases) ? patient.diseases.join(', ') : (patient.diseases || ''),
      allergies: patient.allergies || 'ปฏิเสธการแพ้ยา',
      phone: patient.phone || '',
      visitCount: patient.visitCount || 1
    });
  };

  const handleSavePatientEdit = async () => {
    if (!editPatientModal) return;
    setIsSavingPatient(true);
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('clinic_auth_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const payload = {
        fullname: editPatientForm.name.trim(),
        age: editPatientForm.age,
        blood_type: editPatientForm.bloodType,
        scheme_type: editPatientForm.treatmentRights,
        chronic_diseases: editPatientForm.diseases.trim(),
        allergies: editPatientForm.allergies.trim(),
        phone_number: editPatientForm.phone.trim(),
        visit_count: editPatientForm.visitCount
      };

      let res = await fetch(`/api/pharmacy/patient-medicines/${editPatientModal.hn}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        res = await fetch(`/api/system/patient-medicines/${editPatientModal.hn}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      setPatients(prev => prev.map(p => {
        if (p.hn === editPatientModal.hn || p.id === editPatientModal.id) {
          const rawD = editPatientForm.diseases.split(',').map(d => d.trim()).filter(Boolean);
          return {
            ...p,
            name: editPatientForm.name.trim(),
            age: editPatientForm.age,
            bloodType: editPatientForm.bloodType,
            treatmentRights: editPatientForm.treatmentRights,
            diseases: rawD.length > 0 ? rawD : ['ไม่มี'],
            allergies: editPatientForm.allergies.trim(),
            phone: editPatientForm.phone.trim(),
            visitCount: editPatientForm.visitCount
          };
        }
        return p;
      }));

      setEditPatientModal(null);
    } catch (err) {
      console.error('Failed to update patient:', err);
    } finally {
      setIsSavingPatient(false);
    }
  };

  const handleDeletePatient = async () => {
    if (!deleteConfirmPatient) return;
    setIsDeletingPatient(true);
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('clinic_auth_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      let res = await fetch(`/api/pharmacy/patient-medicines/${deleteConfirmPatient.hn}`, {
        method: 'DELETE',
        headers
      });
      if (!res.ok) {
        res = await fetch(`/api/system/patient-medicines/${deleteConfirmPatient.hn}`, {
          method: 'DELETE'
        });
      }

      setPatients(prev => prev.filter(p => p.hn !== deleteConfirmPatient.hn && p.id !== deleteConfirmPatient.id));
      if (selectedPatientModal?.hn === deleteConfirmPatient.hn) {
        setSelectedPatientModal(null);
      }
      setDeleteConfirmPatient(null);
    } catch (err) {
      console.error('Failed to delete patient:', err);
    } finally {
      setIsDeletingPatient(false);
    }
  };

  const handleCopyHn = (hn: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!hn) return;
    const clean = hn.replace(/[-]/g, '');
    try {
      navigator.clipboard.writeText(clean);
      setCopiedHn(clean);
      setTimeout(() => setCopiedHn(null), 1500);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = clean;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedHn(clean);
      setTimeout(() => setCopiedHn(null), 1500);
    }
  };

  const fetchPatientMedicines = async () => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('clinic_auth_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      let res = await fetch('/api/pharmacy/patient-medicines', { headers });
      if (!res.ok) {
        res = await fetch('/api/system/patient-medicines');
      }
      if (res.ok) {
        const data = await res.json();
        if (data.patient_medicines && Array.isArray(data.patient_medicines) && data.patient_medicines.length > 0) {
          const mapped: Patient[] = data.patient_medicines.map((pm: any) => {
            const rawDiseases = pm.chronic_diseases ? pm.chronic_diseases.split(',').map((d: string) => d.trim()).filter(Boolean) : [];
            const cleanHN = (pm.hn || '').replace(/[-]/g, '');
            return {
              id: `PT-${pm.id || pm.hn}`,
              hn: cleanHN,
              name: pm.fullname || pm.full_name || 'ผู้ป่วย',
              age: pm.age || 35,
              bloodType: pm.blood_type || 'O+',
              diseases: rawDiseases.length > 0 ? rawDiseases : ['ไม่มี'],
              weightHeight: '65 kg / 170 cm',
              treatmentRights: pm.scheme_type || 'สิทธิ 30 บาท (สปสช.)',
              visitCount: pm.visit_count || 1,
              allergies: pm.allergies || 'ปฏิเสธการแพ้ยา',
              phone: pm.phone_number,
              createdAt: pm.created_at || pm.CreatedAt,
              updatedAt: pm.updated_at || pm.UpdatedAt
            };
          });

          // คนล่าสุดอยู่บนตารางเสมอ (Sort latest on top)
          mapped.sort((a, b) => {
            const aDate = new Date(a.updatedAt || a.createdAt || 0).getTime();
            const bDate = new Date(b.updatedAt || b.createdAt || 0).getTime();
            if (bDate !== aDate) return bDate - aDate;
            const aId = parseInt(a.id.replace(/\D/g, '')) || 0;
            const bId = parseInt(b.id.replace(/\D/g, '')) || 0;
            return bId - aId;
          });

          setPatients(mapped);
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      console.error('Failed to fetch patient medicines:', err);
    }
    setPatients([]);
    setLoading(false);
  };

  useEffect(() => {
    fetchPatientMedicines();

    const unsub1 = subscribe('PATIENT_MEDICINE_UPDATED', fetchPatientMedicines);
    const unsub2 = subscribe('DISPENSE_RECORDED', fetchPatientMedicines);
    const unsub3 = subscribe('QUEUE_CREATED', fetchPatientMedicines);
    const unsub4 = subscribe('QUEUE_UPDATED', fetchPatientMedicines);

    return () => {
      unsub1();
      unsub2();
      unsub3();
      unsub4();
    };
  }, [subscribe]);

  const handleSelectPatient = async (patient: Patient) => {
    setSelectedPatientModal(patient);
    setPatientMedHistory([]);
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('clinic_auth_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      let res = await fetch(`/api/pharmacy/patient-medicines/${patient.hn}`, { headers });
      if (!res.ok) {
        res = await fetch(`/api/system/patient-medicines/${patient.hn}`);
      }
      if (res.ok) {
        const data = await res.json();
        
        // อัปเดตข้อมูลผู้ป่วยและค่าสัญญาณชีพ/คิวล่าสุด
        setSelectedPatientModal(prev => {
          if (!prev) return prev;
          const pm = data.patient_medicine || {};
          return {
            ...prev,
            name: pm.fullname || pm.full_name || prev.name,
            treatmentRights: pm.scheme_type || prev.treatmentRights,
            allergies: pm.allergies || prev.allergies || 'ปฏิเสธการแพ้ยา',
            visitCount: data.visit_count || pm.visit_count || prev.visitCount || 1,
            queueNumber: data.queue_number || prev.queueNumber || 'Q0001',
            visitTime: data.visit_time || prev.visitTime || '08:45 น.',
            doctorAdvice: data.doctor_advice || prev.doctorAdvice || 'ผู้ป่วยรับยารักษาอาการตามสั่ง ตรวจเช็คประวัติแพ้ยาเรียบร้อยแล้ว ไม่พบข้อห้ามใช้ยา ให้คำแนะนำการรับประทานหลังอาหารทันที',
            vitals: data.vitals || prev.vitals || {
              bp: '120/80',
              pulse: 80,
              temp: 36.5,
              weight: 65,
              height: 170,
            }
          };
        });

        if (data.dispensings && Array.isArray(data.dispensings) && data.dispensings.length > 0) {
          const mappedHist: MedicationHistory[] = data.dispensings.map((item: any) => ({
            date: new Date(item.created_at || Date.now()).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' }),
            time: new Date(item.created_at || Date.now()).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.',
            medName: item.medicine?.name || item.Medicine?.name || item.medicine?.medicine_code || item.Medicine?.medicine_code || 'ยาตามแพทย์สั่ง',
            indication: item.medicine?.properties || item.Medicine?.properties || 'การรักษาตามอาการ',
            dosage: item.dosage || '1 เม็ด วันละ 3 ครั้ง',
            dosageTag: item.instructions || 'หลังอาหาร',
            quantity: `${item.quantity || 1} เม็ด`
          }));
          setPatientMedHistory(mappedHist);
          return;
        }
      }
    } catch (err) {
      console.error('Error fetching patient medicine detail:', err);
    }
  };

  const filteredPatients = patients.filter(patient => {
    const q = (searchQuery || '').trim().toLowerCase();
    
    const cleanedHn = (patient?.hn || '').toLowerCase().replace(/^hn-?/, '');
    const cleanedQ = q.replace(/^hn-?/, '');
    
    // Check ID match
    const queryDigits = q.replace(/\D/g, '');
    const hnDigits = (patient?.hn || '').replace(/\D/g, '');
    const matchHn = cleanedHn.includes(cleanedQ) || 
      (patient?.hn || '').toLowerCase().includes(q) ||
      (queryDigits !== '' && hnDigits.includes(queryDigits));

    // Multi-word name search
    const searchTerms = q.split(/\s+/).filter(Boolean);
    const nameStr = (patient?.name || '').toLowerCase();
    const matchName = searchTerms.length > 0 && searchTerms.every(term => nameStr.includes(term));

    const matchSearch = q === '' || matchHn || matchName;

    let matchRisk = true;
    if (riskFilter === 'hypertension') {
      matchRisk = (patient.diseases || []).some(d => d.includes('ความดัน'));
    } else if (riskFilter === 'allergies') {
      const hasAllergyDisease = (patient?.diseases || []).some(d => d?.includes('แพ้ยา') || d?.includes('ภูมิแพ้'));
      const hasAllergiesText = Boolean(patient?.allergies && typeof patient.allergies === 'string' && !patient.allergies.includes('ปฏิเสธ'));
      matchRisk = hasAllergyDisease || hasAllergiesText;
    }

    return matchSearch && matchRisk;
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
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '13.5px', color: '#475569' }}>ค้นหาผู้ป่วย (รหัส HN หรือ ชื่อผู้ป่วย)</label>
              <div className="input-with-icon">
                <input
                  type="text"
                  placeholder="เช่น HN0001, Somchai หรือ 0001"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: '100%', padding: '9px 14px', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '14px' }}
                />
              </div>
            </div>
          </div>

          {/* Filter Pills matching Image 3 (Urgency Filter Removed) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '12px', borderTop: '1px solid #F1F5F9' }}>
            {/* Row 1: ช่วงเวลา */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span className="filter-row-label" style={{ fontSize: '13.5px', fontWeight: '700', minWidth: '80px' }}>ช่วงเวลา:</span>
              {(['all', 'today', 'month'] as const).map((key) => {
                const labels = { all: 'ทั้งหมด', today: 'วันนี้', month: 'เดือนนี้' };
                const active = timeRange === key;
                return (
                  <button
                    key={key}
                    onClick={() => setTimeRange(key)}
                    className={`filter-pill-btn ${active ? 'active' : ''}`}
                    style={{
                      padding: '6px 16px', borderRadius: '8px',
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
              <span className="filter-row-label" style={{ fontSize: '13.5px', fontWeight: '700', minWidth: '120px' }}>ความเสี่ยงทางคลินิก:</span>
              {(['all', 'hypertension', 'fever', 'allergies'] as const).map((key) => {
                const labels = { all: 'ทั้งหมด', hypertension: 'ความดันสูง', fever: 'มีไข้ (> 37.5°C)', allergies: 'มีประวัติแพ้ยา' };
                const active = riskFilter === key;
                return (
                  <button
                    key={key}
                    onClick={() => setRiskFilter(key)}
                    className={`filter-pill-btn ${active ? 'active' : ''}`}
                    style={{
                      padding: '6px 16px', borderRadius: '8px',
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
            className="collapsible-card-header"
            onClick={() => setIsPatientListExpanded(!isPatientListExpanded)}
            style={{ 
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
              padding: '18px 24px', borderBottom: isPatientListExpanded ? '1px solid #E2E8F0' : 'none',
              cursor: 'pointer', userSelect: 'none' 
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h3 className="card-header-title" style={{ margin: 0, fontSize: '16.5px', fontWeight: '700' }}>
                รายชื่อผู้ป่วยที่เข้ารับการรักษา
              </h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ background: '#DBEAFE', color: '#1E40AF', fontWeight: 'bold', padding: '4px 12px', borderRadius: '16px', fontSize: '13px' }}>
                แสดง {filteredPatients?.length || 0} รายการ
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
                      <th style={{ textAlign: 'center', width: '100px' }}>ID (HN)</th>
                      <th style={{ textAlign: 'center' }}>ชื่อผู้ป่วย (คลิกเพื่อดูประวัติ)</th>
                      <th style={{ textAlign: 'center', width: '80px' }}>อายุ</th>
                      <th style={{ textAlign: 'center', width: '90px' }}>กรุ๊ปเลือด</th>
                      <th style={{ textAlign: 'center', width: '190px' }}>สิทธิการรักษา</th>
                      <th style={{ textAlign: 'center', width: '130px' }}>จำนวนเข้ารักษา</th>
                      <th style={{ textAlign: 'center' }}>โรคประจำตัว</th>
                      <th style={{ textAlign: 'center', width: '160px' }}>การจัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPatients.map((patient) => {
                      const rights = patient.treatmentRights || 'สิทธิ 30 บาท (สปสช.)';
                      return (
                        <tr key={patient.id}>
                          <td className="hn-cell" style={{ textAlign: 'center' }}>
                            <CopyableText value={patient.hn.replace(/[-]/g, '')} color="#2563EB" />
                          </td>
                          <td 
                            className="patient-name-cell clickable-patient-history"
                            onClick={() => handleSelectPatient(patient)}
                            style={{ textAlign: 'center', padding: '12px 14px' }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                              <span className="history-name-link" style={{ fontWeight: '700', color: '#0F172A', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                                  <circle cx="12" cy="7" r="4"/>
                                </svg>
                                {patient.name}
                              </span>
                              <span className="history-hint-tag" style={{ fontSize: '11.5px', color: '#2563EB', background: '#EFF6FF', padding: '2px 8px', borderRadius: '4px', border: '1px solid #DBEAFE', cursor: 'pointer' }}>
                                คลิกดูประวัติการรักษา & แพ้ยา 
                              </span>
                            </div>
                          </td>
                          <td style={{ textAlign: 'center' }}>{patient.age} ปี</td>
                          <td style={{ textAlign: 'center' }}><span className="blood-badge">{patient.bloodType}</span></td>
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
                            <span className="visit-count-badge">
                              เข้ารักษา {patient.visitCount || 1} ครั้ง
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div className="disease-badges" style={{ justifyContent: 'center' }}>
                              {(patient.diseases || []).map((d, i) => (
                                <span key={i} className="disease-tag">{d}</span>
                              ))}
                            </div>
                          </td>
                          <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'inline-flex', gap: '6px', justifyContent: 'center', alignItems: 'center' }}>
                              <button
                                type="button"
                                onClick={(e) => handleOpenEditPatient(patient, e)}
                                style={{
                                  padding: '6px 11px', borderRadius: '8px',
                                  background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE',
                                  fontSize: '12.5px', fontWeight: '700', cursor: 'pointer',
                                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                                  transition: 'all 0.15s ease'
                                }}
                                title="แก้ไขข้อมูลประวัติผู้ป่วยนี้"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                                แก้ไข
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirmPatient(patient);
                                }}
                                style={{
                                  padding: '6px 10px', borderRadius: '8px',
                                  background: '#FEF2F2', color: '#DC2626', border: '1px solid #FCA5A5',
                                  fontSize: '12.5px', fontWeight: '600', cursor: 'pointer',
                                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                                  transition: 'all 0.2s ease'
                                }}
                                title="ลบข้อมูลประวัตินี้ออกจากระบบ"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6"></polyline>
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                                ลบ
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Bar matching Image 4 */}
              <div className="table-pagination-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', borderTop: '1px solid #E2E8F0', flexWrap: 'wrap', gap: '12px' }}>
                <span className="pagination-info" style={{ fontSize: '13.5px', fontWeight: '500' }}>
                  แสดง 1 ถึง {filteredPatients.length} จาก {patients.length} รายการ
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button 
                    disabled={currentPage === 1}
                    className="pagination-btn"
                    style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13.5px', cursor: 'not-allowed' }}
                  >
                    ย้อนกลับ
                  </button>
                  <button 
                    className="pagination-btn active"
                    style={{ padding: '6px 14px', borderRadius: '8px', border: 'none', background: '#2563EB', color: '#FFFFFF', fontWeight: '700', fontSize: '13.5px', cursor: 'pointer' }}
                  >
                    1
                  </button>
                  <button 
                    disabled
                    className="pagination-btn"
                    style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13.5px', cursor: 'not-allowed' }}
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
                <p style={{ margin: 0, fontSize: '13.5px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  หมายเลขคิว <span style={{ color: '#2563EB', fontWeight: '700' }}>{selectedPatientModal.queueNumber || 'Q0001'}</span> • {selectedPatientModal.name}
                  <span style={{ background: '#DCFCE7', color: '#15803D', border: '1px solid #86EFAC', padding: '2px 8px', borderRadius: '10px', fontSize: '11.5px', fontWeight: '700' }}>
                    ประวัติคิวตรวจ & รับยา
                  </span>
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
              {/* Summary Information Card */}
              <div style={{ background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B', fontSize: '13.5px' }}>หมายเลขคิว:</span>
                  <span style={{ color: '#2563EB', fontWeight: '700', fontSize: '14.5px' }}>{selectedPatientModal.queueNumber || 'Q0001'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B', fontSize: '13.5px' }}>ชื่อคนไข้:</span>
                  <span style={{ color: '#0F172A', fontWeight: '700', fontSize: '13.5px' }}>{selectedPatientModal.name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#64748B', fontSize: '13.5px' }}>เลขบัตรประชาชน / HN:</span>
                  <span
                    onClick={(e) => handleCopyHn(selectedPatientModal.hn, e)}
                    title={copiedHn === selectedPatientModal.hn.replace(/[-]/g, '') ? 'คัดลอกแล้ว!' : 'คลิกเพื่อคัดลอก HN'}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      cursor: 'pointer',
                      position: 'relative',
                      userSelect: 'none'
                    }}
                  >
                    <span style={{ color: '#0F172A', fontWeight: '700', fontSize: '14.5px', fontFamily: 'monospace' }}>
                      {selectedPatientModal.hn.replace(/[-]/g, '')}
                    </span>
                    {copiedHn === selectedPatientModal.hn.replace(/[-]/g, '') ? (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                    )}
                    {copiedHn === selectedPatientModal.hn.replace(/[-]/g, '') && (
                      <span style={{
                        position: 'absolute',
                        top: '-24px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        backgroundColor: '#0F172A',
                        color: '#FFFFFF',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        whiteSpace: 'nowrap',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                        zIndex: 50
                      }}>
                        คัดลอกแล้ว!
                      </span>
                    )}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B', fontSize: '13.5px' }}>เวลารับคิว:</span>
                  <span style={{ color: '#0F172A', fontWeight: '700', fontSize: '13.5px' }}>{selectedPatientModal.visitTime || '08:45 น.'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gridColumn: 'span 2', paddingTop: '6px', borderTop: '1px dashed #E2E8F0' }}>
                  <span style={{ color: '#64748B', fontSize: '13.5px' }}>จำนวนเข้ารักษาทั้งหมด:</span>
                  <span style={{ background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', padding: '2px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '700' }}>
                    {selectedPatientModal.visitCount || 1} ครั้ง (Visit #{selectedPatientModal.visitCount || 1})
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gridColumn: 'span 2', paddingTop: '4px' }}>
                  <span style={{ color: '#64748B', fontSize: '13.5px' }}>สิทธิการรักษา:</span>
                  <span style={{ background: '#F3E8FF', color: '#6B21A8', border: '1px solid #DDD6FE', padding: '2px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '700' }}>
                    {selectedPatientModal.treatmentRights || 'สิทธิ 30 บาท (สปสช.)'}
                  </span>
                </div>
              </div>

              {/* Vital Signs Grid */}
              <div>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '700', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#3B82F6' }}><path d="M12 20V10"></path><path d="M18 20V4"></path><path d="M6 20v-4"></path></svg>
                  ค่าสัญญาณชีพและสรีรวิทยา (Vital Signs Measurements)
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11.5px', color: '#64748B', fontWeight: '600', marginBottom: '4px' }}>ความดันโลหิต (BP)</div>
                    <div style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A' }}>{selectedPatientModal.vitals?.bp || '120/80'} <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '500' }}>mmHg</span></div>
                    <span style={{ background: '#DCFCE7', color: '#15803D', fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '10px', display: 'inline-block', marginTop: '4px' }}>ปกติ</span>
                  </div>
                  <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11.5px', color: '#64748B', fontWeight: '600', marginBottom: '4px' }}>ชีพจร (Heart Rate)</div>
                    <div style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A' }}>{selectedPatientModal.vitals?.pulse || 80} <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '500' }}>bpm</span></div>
                    <span style={{ background: '#DCFCE7', color: '#15803D', fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '10px', display: 'inline-block', marginTop: '4px' }}>ปกติ</span>
                  </div>
                  <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11.5px', color: '#64748B', fontWeight: '600', marginBottom: '4px' }}>อุณหภูมิ (Temp)</div>
                    <div style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A' }}>{selectedPatientModal.vitals?.temp || 36.5} <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '500' }}>°C</span></div>
                    <span style={{ background: '#DCFCE7', color: '#15803D', fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '10px', display: 'inline-block', marginTop: '4px' }}>ปกติ</span>
                  </div>
                </div>
              </div>

              {/* Department / Room Block */}
              <div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '700', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#0369A1' }}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                  จุดบริการ / ห้องตรวจ:
                </h4>
                <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: '10px', padding: '12px 16px', color: '#0369A1', fontWeight: '700', fontSize: '14.5px' }}>
                  ห้องจ่ายยาและเภสัชกรรม (อาคารผู้ป่วยนอก ชั้น 1)
                </div>
              </div>

              {/* Prescription & Doctor Advice Block */}
              <div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '700', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#475569' }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                  คำสั่งการรักษา & รายการยาที่ได้รับ (ฉบับเต็ม):
                </h4>
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '13.5px', color: '#334155', lineHeight: '1.5' }}>
                    <strong>คำสั่งแพทย์:</strong> {selectedPatientModal.doctorAdvice || 'ผู้ป่วยรับยารักษาอาการตามสั่ง ตรวจเช็คประวัติแพ้ยาเรียบร้อยแล้ว ไม่พบข้อห้ามใช้ยา ให้คำแนะนำการรับประทานหลังอาหารทันที'}
                  </div>
                  <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '8px' }}>
                    <strong style={{ fontSize: '13px', color: '#0F172A' }}>รายการยาที่จัดส่ง:</strong>
                    {patientMedHistory && patientMedHistory.length > 0 ? (
                      <ul style={{ margin: '6px 0 0 18px', padding: 0, fontSize: '13px', color: '#475569' }}>
                        {patientMedHistory.map((item, idx) => (
                          <li key={idx} style={{ marginBottom: '4px' }}>
                            <strong style={{ color: '#0F172A' }}>{item?.medName}</strong> ({item?.quantity}) - {item?.dosage} <span style={{ color: '#2563EB', fontWeight: '600' }}>({item?.dosageTag})</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div style={{ padding: '6px 0 0 0', color: '#64748B', fontSize: '13px', fontStyle: 'italic' }}>
                        ไม่มีรายการสั่งยาในรอบตรวจนี้
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Allergies Block */}
              <div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '700', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#DC2626' }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                  ประวัติแพ้ยา (Known Allergies):
                </h4>
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ background: '#FEE2E2', color: '#991B1B', fontWeight: '700', padding: '4px 12px', borderRadius: '8px', fontSize: '12.5px' }}>
                    {selectedPatientModal.allergies || 'ปฏิเสธการแพ้ยา'}
                  </span>
                  <span style={{ fontSize: '12.5px', color: '#991B1B' }}>ข้อมูลประวัติแพ้ยาที่ลงบันทึกในระบบ</span>
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

      {/* Edit Patient History Modal */}
      {editPatientModal && (
        <div className="modal-overlay" onClick={() => setEditPatientModal(null)}>
          <div className="card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', width: '100%', borderRadius: '16px', overflow: 'hidden', border: 'none', background: '#FFFFFF' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                  แก้ไขข้อมูลประวัติผู้ป่วย (HN: {editPatientModal.hn.replace(/[-]/g, '')})
                </h3>
              </div>
              <button 
                onClick={() => setEditPatientModal(null)} 
                style={{ background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '72vh', overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: '700', color: '#1E293B', marginBottom: '4px', display: 'block' }}>ชื่อ - นามสกุล *</label>
                  <input
                    type="text"
                    value={editPatientForm.name}
                    onChange={(e) => setEditPatientForm(prev => ({ ...prev, name: e.target.value }))}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #CBD5E1', fontSize: '13.5px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: '700', color: '#1E293B', marginBottom: '4px', display: 'block' }}>อายุ (ปี)</label>
                  <input
                    type="number"
                    min="1"
                    max="130"
                    value={editPatientForm.age}
                    onChange={(e) => setEditPatientForm(prev => ({ ...prev, age: Number(e.target.value) || 0 }))}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #CBD5E1', fontSize: '13.5px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: '700', color: '#1E293B', marginBottom: '4px', display: 'block' }}>กรุ๊ปเลือด</label>
                  <select
                    value={editPatientForm.bloodType}
                    onChange={(e) => setEditPatientForm(prev => ({ ...prev, bloodType: e.target.value }))}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #CBD5E1', fontSize: '13.5px', background: '#FFFFFF', boxSizing: 'border-box' }}
                  >
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: '700', color: '#1E293B', marginBottom: '4px', display: 'block' }}>สิทธิการรักษา</label>
                  <select
                    value={editPatientForm.treatmentRights}
                    onChange={(e) => setEditPatientForm(prev => ({ ...prev, treatmentRights: e.target.value }))}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #CBD5E1', fontSize: '13.5px', background: '#FFFFFF', boxSizing: 'border-box' }}
                  >
                    <option value="สิทธิ 30 บาท (สปสช.)">สิทธิ 30 บาท (สปสช.)</option>
                    <option value="บัตรทอง (สปสช.)">บัตรทอง (สปสช.)</option>
                    <option value="ประกันสังคม">ประกันสังคม</option>
                    <option value="สิทธิ์ข้าราชการ">สิทธิ์ข้าราชการ</option>
                    <option value="ประกันสุขภาพเอกชน">ประกันสุขภาพเอกชน</option>
                    <option value="ชำระเงินเอง">ชำระเงินเอง</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#1E293B', marginBottom: '4px', display: 'block' }}>โรคประจำตัว (คั่นด้วยจุลภาค เช่น ความดันโลหิตสูง, เบาหวาน)</label>
                <input
                  type="text"
                  value={editPatientForm.diseases}
                  onChange={(e) => setEditPatientForm(prev => ({ ...prev, diseases: e.target.value }))}
                  placeholder="เช่น ความดันโลหิตสูง, เบาหวาน (หากไม่มีพิมพ์ 'ไม่มี')"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #CBD5E1', fontSize: '13.5px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#DC2626', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                    <line x1="12" y1="9" x2="12" y2="13"></line>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                  </svg>
                  ประวัติแพ้ยา
                </label>
                <input
                  type="text"
                  value={editPatientForm.allergies}
                  onChange={(e) => setEditPatientForm(prev => ({ ...prev, allergies: e.target.value }))}
                  placeholder="เช่น ปฏิเสธการแพ้ยา หรือ แพ้ยาเพนิซิลลิน"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #FCA5A5', background: '#FEF2F2', fontSize: '13.5px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: '700', color: '#1E293B', marginBottom: '4px', display: 'block' }}>เบอร์โทรศัพท์</label>
                  <input
                    type="text"
                    value={editPatientForm.phone}
                    onChange={(e) => setEditPatientForm(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="เช่น 081-234-5678"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #CBD5E1', fontSize: '13.5px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: '700', color: '#1E293B', marginBottom: '4px', display: 'block' }}>จำนวนครั้งที่เข้ารักษา</label>
                  <input
                    type="number"
                    min="1"
                    value={editPatientForm.visitCount}
                    onChange={(e) => setEditPatientForm(prev => ({ ...prev, visitCount: Number(e.target.value) || 1 }))}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #CBD5E1', fontSize: '13.5px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid #F1F5F9', background: '#F8FAFC', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setEditPatientModal(null)}
                style={{ padding: '8px 18px', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#475569', fontWeight: '600', fontSize: '13.5px', cursor: 'pointer' }}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleSavePatientEdit}
                disabled={isSavingPatient || !editPatientForm.name.trim()}
                style={{
                  padding: '8px 22px', borderRadius: '8px', border: 'none',
                  background: isSavingPatient ? '#94A3B8' : '#16A34A', color: '#FFFFFF',
                  fontWeight: '700', fontSize: '13.5px', cursor: isSavingPatient ? 'not-allowed' : 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  boxShadow: '0 2px 6px rgba(22, 163, 74, 0.3)'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                  <polyline points="17 21 17 13 7 13 7 21"></polyline>
                  <polyline points="7 3 7 8 15 8"></polyline>
                </svg>
                {isSavingPatient ? 'กำลังบันทึก...' : 'บันทึกการแก้ไขทันที'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Patient Confirmation Modal */}
      {deleteConfirmPatient && (
        <div className="modal-overlay" onClick={() => setDeleteConfirmPatient(null)}>
          <div className="card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px', width: '100%', borderRadius: '16px', overflow: 'hidden', border: 'none', background: '#FFFFFF', textAlign: 'center', padding: '24px' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#FEE2E2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '700', color: '#0F172A' }}>
              ยืนยันการลบประวัติผู้ป่วย?
            </h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#64748B', lineHeight: '1.5' }}>
              คุณต้องการลบประวัติของ <strong style={{ color: '#0F172A' }}>{deleteConfirmPatient.name}</strong> (HN: {deleteConfirmPatient.hn.replace(/[-]/g, '')}) ใช่หรือไม่? ข้อมูลนี้จะถูกนำออกจากระบบ
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => setDeleteConfirmPatient(null)}
                style={{ flex: 1, padding: '10px 16px', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#475569', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleDeletePatient}
                disabled={isDeletingPatient}
                style={{
                  flex: 1, padding: '10px 16px', borderRadius: '8px', border: 'none',
                  background: isDeletingPatient ? '#94A3B8' : '#DC2626', color: '#FFFFFF',
                  fontWeight: '700', fontSize: '14px', cursor: isDeletingPatient ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 6px rgba(220, 38, 38, 0.3)'
                }}
              >
                {isDeletingPatient ? 'กำลังลบ...' : 'ยืนยันลบประวัติ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
