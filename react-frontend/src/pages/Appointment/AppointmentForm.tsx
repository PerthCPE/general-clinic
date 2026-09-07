import React, { useState, useEffect } from 'react';
import { Autocomplete, TextField, Snackbar, Alert } from '@mui/material';
import { useAuth } from '../../context/AuthContext';
import { patientApi, appointmentApi, vitalsApi, type BackendPatient, type BackendDoctor } from '../../services/api';
import './AppointmentForm.css';

interface PatientOption {
  label: string;
  id: number; // Patient ID
  name: string;
}

interface DoctorOption {
  label: string;
  id: number;
}

const timeSlots: string[] = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', 
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30'
];

export default function AppointmentForm() {
  const { currentUser } = useAuth(); // Need register_id from currentUser.id

  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | null>(null);
  const [selectedPatientName, setSelectedPatientName] = useState<string>('');
  
  const [date, setDate] = useState<string>('');
  const [time, setTime] = useState<string>('');
  const [department, setDepartment] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  
  const [autocompleteKey, setAutocompleteKey] = useState<number>(0);
  const [openAlert, setOpenAlert] = useState<boolean>(false);

  useEffect(() => {
    // Load patients and doctors
    const loadData = async () => {
      try {
        const [patientsData, doctorsData] = await Promise.all([
          patientApi.getAll(),
          vitalsApi.getDoctors()
        ]);
        if (patientsData && Array.isArray(patientsData)) {
          const sorted = [...patientsData].sort((a, b) => (a.hn || '').localeCompare(b.hn || ''));
          setPatients(sorted.map((p, index) => ({
            label: `${index + 1}. ${p.hn || p.national_id} : ${p.fullname}`,
            id: p.id,
            name: p.fullname
          })));
        }
        if (doctorsData && Array.isArray(doctorsData)) {
          const sortedDoc = [...doctorsData].sort((a, b) => (a.fullname || '').localeCompare(b.fullname || ''));
          setDoctors(sortedDoc.map((d, index) => ({
            label: `${index + 1}. ${d.fullname}`,
            id: d.id
          })));
        }
      } catch (err) {
        console.error("Failed to load initial data", err);
      }
    };
    loadData();
  }, []);

  const handleSave = async () => {
    if (!selectedPatientId || !date || !time || !department || !selectedDoctorId) {
      alert('กรุณากรอกข้อมูลที่มีเครื่องหมาย * ให้ครบถ้วน');
      return;
    }

    try {
      await appointmentApi.create({
        doctor_id: selectedDoctorId,
        patient_id: selectedPatientId,
        register_id: currentUser ? parseInt(currentUser.id, 10) : 1, // fallback to 1 if missing
        appointment_date: date,
        appointment_time: time + ":00", // e.g. "09:30:00"
        clinical_note: notes || department // if notes empty, use dept as note for now
      });

      setOpenAlert(true);

      // Clear values
      setSelectedPatientId(null);
      setSelectedPatientName('');
      setSelectedDoctorId(null);
      setDate('');
      setTime('');
      setDepartment('');
      setNotes('');
      setAutocompleteKey(prev => prev + 1);
    } catch (err: any) {
      alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล: " + err.message);
    }
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
              key={`patient-${autocompleteKey}`}
              disablePortal
              options={patients}
              getOptionLabel={(option) => option.label}
              onChange={(_event, newValue: PatientOption | null) => {
                setSelectedPatientId(newValue ? newValue.id : null);
                setSelectedPatientName(newValue ? newValue.name : '');
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
              value={selectedPatientName} 
              placeholder="แสดงชื่อเมื่อเลือกผู้ป่วย" 
              className="read-only-input"
            />
          </div>

          <div className="input-group">
            <label>เลือกแพทย์ที่ต้องการนัด <span className="required">*</span></label>
            <Autocomplete<DoctorOption>
              key={`doctor-${autocompleteKey}`}
              disablePortal
              options={doctors}
              getOptionLabel={(option) => option.label}
              onChange={(_event, newValue: DoctorOption | null) => {
                setSelectedDoctorId(newValue ? newValue.id : null);
              }}
              renderInput={(params) => (
                <TextField 
                  {...params} 
                  size="small" 
                  placeholder="พิมพ์ชื่อแพทย์..." 
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
              <option value="general">โรคทั่วไป (OPD)</option>
              <option value="er">ฉุกเฉิน (ER)</option>
              <option value="surgery">ศัลยกรรม (Surgery)</option>
              <option value="pediatrics">กุมารเวช (Pediatrics)</option>
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