import React, { useState, useEffect } from 'react';
import { Autocomplete, TextField, Snackbar, Alert, CircularProgress } from '@mui/material';
import { AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { patientApi, appointmentApi, type BackendPatient } from '../../services/api';
import { TREATMENT_DEPARTMENTS } from '../../config/roles';
import './AppointmentForm.css';

interface PatientOption {
  label: string;
  id: number;
  hn: string;
  name: string;
}

const timeSlots: string[] = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', 
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30'
];

export default function AppointmentForm() {
  const { currentUser } = useAuth();

  const [patientOptions, setPatientOptions] = useState<PatientOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedPatient, setSelectedPatient] = useState<PatientOption | null>(null);
  const [date, setDate] = useState<string>('');
  const [time, setTime] = useState<string>('');
  const [department, setDepartment] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const [autocompletePatientKey, setAutocompletePatientKey] = useState<number>(0);
  const [openAlert, setOpenAlert] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Load patients from DB
        const pData: BackendPatient[] = await patientApi.getAll();
        const opts: PatientOption[] = pData.map(p => ({
          label: `${p.hn} : ${p.fullname}`,
          id: p.id,
          hn: p.hn,
          name: p.fullname,
        }));
        setPatientOptions(opts);

      } catch (err) {
        console.error('Failed to load appointment form data', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [currentUser]);

  const handleSave = async () => {
    if (!selectedPatient || !date || !time || !department) {
      alert('กรุณากรอกข้อมูลที่มีเครื่องหมาย * ให้ครบถ้วน');
      return;
    }

    // หน้านี้เข้าได้เฉพาะ role doctor อยู่แล้ว (PAGE_PERMISSIONS['appointment-form'])
    // จึงล็อกแพทย์ผู้นัดเป็นผู้ที่ล็อกอินอยู่เสมอ ไม่ต้องเลือกเอง
    const doctorId = currentUser?.id ? Number(currentUser.id) : NaN;
    if (!currentUser || Number.isNaN(doctorId)) {
      alert('ไม่พบข้อมูลแพทย์ผู้ล็อกอิน กรุณาล็อกอินใหม่อีกครั้ง');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await appointmentApi.create({
        patient_id: selectedPatient.id,
        doctor_id: doctorId,
        register_id: 0,
        appointment_date: date,
        appointment_time: time + ':00',
        department,
        clinical_note: notes,
      });

      setOpenAlert(true);

      // Clear form
      setSelectedPatient(null);
      setDate('');
      setTime('');
      setDepartment('');
      setNotes('');
      setAutocompletePatientKey(prev => prev + 1);

      // Navigate to dashboard after success
      setTimeout(() => {
        window.localStorage.setItem('activePage', 'appointment-dashboard');
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err?.message || 'เกิดข้อผิดพลาดในการบันทึกนัดหมาย');
    } finally {
      setIsSubmitting(false);
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

        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
            <CircularProgress size={28} />
            <span style={{ marginLeft: 12, alignSelf: 'center', color: 'var(--text-muted)' }}>กำลังโหลดข้อมูลผู้ป่วยและแพทย์...</span>
          </div>
        ) : (
          <div className="form-grid">
            
            {/* ค้นหาผู้ป่วย */}
            <div className="input-group">
              <label>ค้นหาผู้ป่วย <span className="required">*</span></label>
              <Autocomplete<PatientOption>
                key={autocompletePatientKey}
                disablePortal
                options={patientOptions}
                getOptionLabel={(option: PatientOption) => option.label}
                value={selectedPatient}
                onChange={(_event: unknown, newValue: PatientOption | null) => {
                  setSelectedPatient(newValue);
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

            {/* ชื่อผู้ป่วย (อัตโนมัติ) */}
            <div className="input-group">
              <label>ชื่อผู้ป่วย (อัตโนมัติ)</label>
              <input 
                type="text" 
                readOnly 
                value={selectedPatient?.name || ''} 
                placeholder="แสดงชื่อเมื่อเลือกผู้ป่วย" 
                className="read-only-input"
              />
            </div>

            {/* แพทย์ผู้นัด — ล็อกเป็นผู้ที่ล็อกอินอยู่เสมอ (หน้านี้เข้าได้เฉพาะ role doctor) */}
            <div className="input-group">
              <label>แพทย์ผู้นัด</label>
              <input
                type="text"
                readOnly
                value={currentUser?.fullName || ''}
                className="read-only-input"
              />
            </div>

            {/* วันที่นัดหมาย */}
            <div className="input-group">
              <label>วันที่นัดหมาย <span className="required">*</span></label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>

            {/* เวลานัดหมาย */}
            <div className="input-group">
              <label>เวลานัดหมาย <span className="required">*</span></label>
              <select value={time} onChange={(e) => setTime(e.target.value)}>
                <option value="" disabled>เลือกเวลา...</option>
                {timeSlots.map((slot) => (
                  <option key={slot} value={slot}>{slot} น.</option>
                ))}
              </select>
            </div>

            {/* หมวดการรักษา */}
            <div className="input-group full-width">
              <label>หมวดการรักษา <span className="required">*</span></label>
              <select value={department} onChange={(e) => setDepartment(e.target.value)}>
                <option value="" disabled>เลือกหมวดการรักษา...</option>
                {TREATMENT_DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            {/* หมายเหตุ */}
            <div className="input-group full-width">
              <label>รายละเอียดเพิ่มเติม / คำสั่งแพทย์ (Clinical Notes)</label>
              <textarea 
                rows={3} 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="กรอกอาการเบื้องต้น หรือคำแนะนำพิเศษจากแพทย์..."
              ></textarea>
            </div>

            {errorMsg && (
              <div className="input-group full-width form-error-banner">
                <AlertCircle size={18} strokeWidth={2} />
                <span>{errorMsg}</span>
              </div>
            )}

          </div>
        )}

        <div className="form-actions">
          <button className="btn-secondary" onClick={() => window.history.back()}>ยกเลิก</button>
          <button 
            className="btn-primary" 
            onClick={handleSave} 
            disabled={isLoading || isSubmitting}
          >
            {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกนัดหมาย'}
          </button>
        </div>

      </div>

      <Snackbar open={openAlert} autoHideDuration={3000} onClose={handleCloseAlert} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert onClose={handleCloseAlert} severity="success" sx={{ width: '100%', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          บันทึกข้อมูลการนัดหมายสำเร็จ! กำลังไปยังแดชบอร์ด...
        </Alert>
      </Snackbar>

    </div>
  );
}