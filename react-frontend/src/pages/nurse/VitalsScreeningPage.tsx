import { useState } from 'react';
import './VitalsScreeningPage.css';

interface ToastState {
  message: string;
  type: 'success' | 'error';
}

export default function VitalsScreeningPage() {
  const [weight, setWeight] = useState('68');
  const [height, setHeight] = useState('172');
  const [temp, setTemp] = useState('36.8');
  const [systolic, setSystolic] = useState('124');
  const [diastolic, setDiastolic] = useState('82');
  const [pulse, setPulse] = useState('78');
  const [spo2, setSpo2] = useState('98');
  const [respiratoryRate, setRespiratoryRate] = useState('18');

  const [chiefComplaint, setChiefComplaint] = useState('ปวดศีรษะข้างขวา และมีอาการอ่อนเพลีย');
  const [allergies, setAllergies] = useState('ปฏิเสธการแพ้ยา');
  const [medicalHistory, setMedicalHistory] = useState('ความดันโลหิตสูง');
  const [doctorRoom, setDoctorRoom] = useState('room1');

  const [toast, setToast] = useState<ToastState | null>(null);

  const handleReset = () => {
    setWeight('');
    setHeight('');
    setTemp('');
    setSystolic('');
    setDiastolic('');
    setPulse('');
    setSpo2('');
    setRespiratoryRate('');
    setChiefComplaint('');
    setAllergies('');
    setMedicalHistory('');
    setDoctorRoom('room1');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setToast({
      message: '✓ บันทึกข้อมูลการคัดกรองเรียบร้อย! ส่งต่อห้องตรวจแพทย์สำเร็จ',
      type: 'success'
    });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  return (
    <div className="vitals-page-container">
      <div className="vitals-header">
        <h1 className="vitals-title">บันทึกสัญญาณชีพ & คัดกรอง (Vitals & Triage)</h1>
        <p className="vitals-subtitle">ประเมินสัญญาณชีพเบื้องต้น และส่งต่อผู้ป่วยเข้าห้องตรวจแพทย์</p>
      </div>

      {toast && (
        <div className="vitals-toast-banner">
          {toast.message}
        </div>
      )}

      <form onSubmit={handleSave} className="vitals-form-card card">
        {/* Step 1: Physical & Vitals */}
        <div className="form-section">
          <div className="section-header">
            <span className="step-badge">1</span>
            <h2>สรีรวิทยาและสัญญาณชีพพื้นฐาน (Physical & Vitals)</h2>
          </div>

          <div className="form-grid grid-3">
            <div className="input-field-group">
              <label>น้ำหนัก (Weight) <span className="req">*</span></label>
              <div className="input-with-unit">
                <input 
                  type="text" 
                  value={weight} 
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="เช่น 68"
                  required
                />
                <span className="unit-label">kg</span>
              </div>
            </div>

            <div className="input-field-group">
              <label>ส่วนสูง (Height) <span className="req">*</span></label>
              <div className="input-with-unit">
                <input 
                  type="text" 
                  value={height} 
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder="เช่น 172"
                  required
                />
                <span className="unit-label">cm</span>
              </div>
            </div>

            <div className="input-field-group">
              <label>อุณหภูมิร่างกาย (Temp) <span className="req">*</span></label>
              <div className="input-with-unit">
                <input 
                  type="text" 
                  value={temp} 
                  onChange={(e) => setTemp(e.target.value)}
                  placeholder="เช่น 36.8"
                  required
                />
                <span className="unit-label">°C</span>
              </div>
            </div>
          </div>

          <div className="form-grid grid-3">
            <div className="input-field-group">
              <label>ความดันโลหิตตัวบน (Systolic) <span className="req">*</span></label>
              <div className="input-with-unit">
                <input 
                  type="text" 
                  value={systolic} 
                  onChange={(e) => setSystolic(e.target.value)}
                  placeholder="เช่น 124"
                  required
                />
                <span className="unit-label">mmHg</span>
              </div>
            </div>

            <div className="input-field-group">
              <label>ความดันโลหิตตัวล่าง (Diastolic) <span className="req">*</span></label>
              <div className="input-with-unit">
                <input 
                  type="text" 
                  value={diastolic} 
                  onChange={(e) => setDiastolic(e.target.value)}
                  placeholder="เช่น 82"
                  required
                />
                <span className="unit-label">mmHg</span>
              </div>
            </div>

            <div className="input-field-group">
              <label>ชีพจร (Heart Rate / Pulse) <span className="req">*</span></label>
              <div className="input-with-unit">
                <input 
                  type="text" 
                  value={pulse} 
                  onChange={(e) => setPulse(e.target.value)}
                  placeholder="เช่น 78"
                  required
                />
                <span className="unit-label">bpm</span>
              </div>
            </div>
          </div>

          <div className="form-grid grid-2">
            <div className="input-field-group">
              <label>ออกซิเจนในเลือด (SpO2)</label>
              <div className="input-with-unit">
                <input 
                  type="text" 
                  value={spo2} 
                  onChange={(e) => setSpo2(e.target.value)}
                  placeholder="เช่น 98"
                />
                <span className="unit-label">%</span>
              </div>
            </div>

            <div className="input-field-group">
              <label>อัตราการหายใจ (Respiratory Rate)</label>
              <div className="input-with-unit">
                <input 
                  type="text" 
                  value={respiratoryRate} 
                  onChange={(e) => setRespiratoryRate(e.target.value)}
                  placeholder="เช่น 18"
                />
                <span className="unit-label">ครั้ง/นาที</span>
              </div>
            </div>
          </div>
        </div>

        {/* Step 2: Clinical History */}
        <div className="form-section">
          <div className="section-header">
            <span className="step-badge">2</span>
            <h2>อาการสำคัญและประวัติทางการแพทย์ (Clinical History)</h2>
          </div>

          <div className="input-field-group full-width">
            <label>อาการสำคัญ ณ วันที่เข้ารับบริการ (Chief Complaint) <span className="req">*</span></label>
            <textarea 
              rows={3} 
              value={chiefComplaint} 
              onChange={(e) => setChiefComplaint(e.target.value)}
              placeholder="ระบุอาการสำคัญของผู้ป่วย..."
              required
            />
          </div>

          <div className="form-grid grid-2">
            <div className="input-field-group">
              <label>ประวัติการแพ้ยา (Allergies)</label>
              <input 
                type="text" 
                value={allergies} 
                onChange={(e) => setAllergies(e.target.value)}
                placeholder="ระบุประวัติแพ้ยา หรือ ปฏิเสธการแพ้ยา"
              />
            </div>

            <div className="input-field-group">
              <label>โรคประจำตัว (Medical History / Chronic Diseases)</label>
              <input 
                type="text" 
                value={medicalHistory} 
                onChange={(e) => setMedicalHistory(e.target.value)}
                placeholder="ระบุโรคประจำตัว..."
              />
            </div>
          </div>
        </div>

        {/* Step 3: Forward to Doctor Room */}
        <div className="form-section">
          <div className="section-header">
            <span className="step-badge">3</span>
            <h2>ส่งต่อห้องตรวจแพทย์ (Forward to Doctor Room)</h2>
          </div>

          <div className="input-field-group full-width">
            <label>เลือกห้องตรวจ / แพทย์ผู้ตรวจ <span className="req">*</span></label>
            <select 
              value={doctorRoom} 
              onChange={(e) => setDoctorRoom(e.target.value)}
              className="doctor-room-select"
              required
            >
              <option value="room1">ห้องตรวจ 1 — พญ.สุดา สุขสมบูรณ์ (เวชปฏิบัติทั่วไป)</option>
              <option value="room2">ห้องตรวจ 2 — นพ.วิชัย ใจดี (อายุรกรรมทั่วไป)</option>
              <option value="room3">ห้องตรวจ 3 — นพ.สมศักดิ์ มั่งคั่ง (กุมารเวชกรรม)</option>
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="vitals-action-bar">
          <button type="submit" className="save-forward-btn">
            ✓ บันทึกข้อมูลการคัดกรอง (Save & Forward)
          </button>
          <button type="button" className="reset-form-btn" onClick={handleReset}>
            ↺ ล้างฟอร์ม (Reset)
          </button>
        </div>
      </form>
    </div>
  );
}
