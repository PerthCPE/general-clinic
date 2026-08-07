import React, { useState } from 'react';
import { Autocomplete, TextField, Snackbar, Alert } from '@mui/material';
import { useAuth } from '../../context/AuthContext';
import './AppointmentForm.css';

interface PatientOption {
  label: string;
  id: string;
  name: string;
}

const mockPatients: PatientOption[] = [
  { label: 'HN-10001 : อนันต์ สุขสวัสดิ์', id: 'HN-10001', name: 'อนันต์ สุขสวัสดิ์' },
  { label: 'HN-10002 : วิมล มั่นคง', id: 'HN-10002', name: 'วิมล มั่นคง' },
  { label: 'HN-10003 : เกียรติศักดิ์ ศรีสุข', id: 'HN-10003', name: 'เกียรติศักดิ์ ศรีสุข' },
  { label: 'HN-10004 : พงษ์ศักดิ์ แสนดี', id: 'HN-10004', name: 'พงษ์ศักดิ์ แสนดี' },
  { label: 'HN-10005 : สมชาย ใจดี', id: 'HN-10005', name: 'สมชาย ใจดี' },
  { label: 'HN-10006 : นภา งามตา', id: 'HN-10006', name: 'นภา งามตา' },
  { label: 'HN-10007 : ประเสริฐ เลิศพงษ์', id: 'HN-10007', name: 'ประเสริฐ เลิศพงษ์' },
  { label: 'HN-10008 : วรรณา รักไทย', id: 'HN-10008', name: 'วรรณา รักไทย' },
  { label: 'HN-10009 : กนกวรรณ มีสุข', id: 'HN-10009', name: 'กนกวรรณ มีสุข' },
  { label: 'HN-10010 : ชูใจ มั่นคอย', id: 'HN-10010', name: 'ชูใจ มั่นคอย' },
];

const timeSlots: string[] = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', 
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30'
];

export default function AppointmentForm() {
  const { addAppointment } = useAuth();

  const [selectedPatient, setSelectedPatient] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [time, setTime] = useState<string>('');
  const [department, setDepartment] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  
  // ใช้สำหรับบังคับ Reset ค่าใน Autocomplete ของ MUI
  const [autocompleteKey, setAutocompleteKey] = useState<number>(0);
  const [openAlert, setOpenAlert] = useState<boolean>(false);

  const handleSave = () => {
    if (!selectedPatient || !date || !time || !department) {
      alert('กรุณากรอกข้อมูลที่มีเครื่องหมาย * ให้ครบถ้วน');
      return;
    }

    let deptName = 'โรคทั่วไป';
    let deptColor = 'primary';
    if (department === 'medicine') { deptName = 'อายุรกรรม'; deptColor = 'warning'; }
    else if (department === 'psychology') { deptName = 'จิตวิทยา'; deptColor = 'secondary'; }
    else if (department === 'physical') { deptName = 'กายภาพบำบัด'; deptColor = 'success'; }

    const initialText = selectedPatient.length >= 2 ? selectedPatient.substring(0, 2) : 'คน';
    const randomPhone = `08${Math.floor(Math.random() * 9)} - ${Math.floor(100 + Math.random() * 900)} - ${Math.floor(1000 + Math.random() * 9000)}`;

    const newAppointment = {
      id: Date.now(),
      name: selectedPatient,
      initial: initialText,
      dept: deptName,
      date: date,
      time: time,
      phone: randomPhone,
      status: '-', 
      statusColor: 'default',
      deptColor: deptColor,
      notes: notes,
    };

    // ส่งข้อมูลเข้าสู่ระบบกลาง
    addAppointment(newAppointment);
    setOpenAlert(true);

    // ทำการ Clear ค่าในฟอร์มทั้งหมดทันทีหลังบันทึกสำเร็จ
    setSelectedPatient('');
    setDate('');
    setTime('');
    setDepartment('');
    setNotes('');
    setAutocompleteKey(prev => prev + 1); // สั่งรีเซ็ตช่อง Autocomplete ค้นหาผู้ป่วยให้ว่างเปล่า
  };

  const handleCloseAlert = (_event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') return;
    setOpenAlert(false);
  };

  return (
    <div className="appointment-form-container">
      
      <div className="form-title-row">
        <h1 className="form-title">การนัดหมาย (Appointment)</h1>
      </div>

      <div className="card">
        
        <div className="card-header">
          <h2 className="section-title">แบบฟอร์มข้อมูลการนัดหมาย</h2>
          <span className="badge-staff">MEDICAL STAFF ONLY</span>
        </div>

        <div className="form-grid">
          
          <div className="input-group">
            <label>ค้นหาผู้ป่วย <span className="required">*</span></label>
            <Autocomplete<PatientOption>
              key={autocompleteKey} // ใช้ key นี้บังคับล้างค่าช่องค้นหา
              disablePortal
              options={mockPatients}
              getOptionLabel={(option) => option.label}
              onChange={(_event, newValue: PatientOption | null) => {
                setSelectedPatient(newValue ? newValue.name : '');
              }}
              renderInput={(params) => (
                <TextField 
                  {...params} 
                  size="small" 
                  placeholder="พิมพ์รหัส HN หรือ ชื่อผู้ป่วย..." 
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: 'var(--input-bg)',
                      borderRadius: '8px',
                      '& fieldset': { borderColor: 'var(--input-border)' },
                      '&:hover fieldset': { borderColor: '#94A3B8' },
                      '&.Mui-focused fieldset': { borderColor: '#2563EB', borderWidth: '1px' },
                    },
                    '& .MuiInputBase-input': {
                      color: 'var(--input-text)'
                    }
                  }}
                />
              )}
            />
          </div>

          <div className="input-group">
            <label>ชื่อผู้ป่วย (อัตโนมัติ)</label>
            <input 
              type="text" 
              readOnly 
              value={selectedPatient} 
              placeholder="แสดงชื่อเมื่อเลือกผู้ป่วย" 
              className="read-only-input"
            />
          </div>

          <div className="input-group">
            <label>วันที่นัดหมาย <span className="required">*</span></label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="input-group">
            <label>เวลานัดหมาย <span className="required">*</span></label>
            <select value={time} onChange={(e) => setTime(e.target.value)}>
              <option value="" disabled>เลือกเวลา...</option>
              {timeSlots.map((slot) => (
                <option key={slot} value={slot}>{slot} น.</option>
              ))}
            </select>
          </div>

          <div className="input-group full-width">
            <label>หมวดการรักษา <span className="required">*</span></label>
            <select value={department} onChange={(e) => setDepartment(e.target.value)}>
              <option value="" disabled>เลือกหมวดการรักษา...</option>
              <option value="general">ตรวจโรคทั่วไป (General Practice)</option>
              <option value="medicine">อายุรกรรม (Internal Medicine)</option>
              <option value="psychology">จิตวิทยา (Psychology)</option>
              <option value="physical">กายภาพบำบัด (Physical Therapy)</option>
            </select>
          </div>

          <div className="input-group full-width">
            <label>รายละเอียดเพิ่มเติม / คำสั่งแพทย์ (Clinical Notes)</label>
            <textarea 
              rows={3} 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="กรอกอาการเบื้องต้น หรือคำแนะนำพิเศษจากแพทย์..."
            ></textarea>
          </div>

        </div>

        <div className="form-actions">
          <button className="btn-secondary" onClick={() => window.history.back()}>ยกเลิก</button>
          <button className="btn-primary" onClick={handleSave}>บันทึกนัดหมาย</button>
        </div>

      </div>

      <Snackbar open={openAlert} autoHideDuration={3000} onClose={handleCloseAlert} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert onClose={handleCloseAlert} severity="success" sx={{ width: '100%', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          บันทึกข้อมูลการนัดหมายสำเร็จ! ข้อมูลถูกเคลียร์และส่งไปยังแดชบอร์ดแล้ว
        </Alert>
      </Snackbar>

    </div>
  );
}