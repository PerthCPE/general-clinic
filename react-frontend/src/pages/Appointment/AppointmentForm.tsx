import React, { useState, useEffect } from 'react';
import { Autocomplete, TextField, Snackbar, Alert, CircularProgress } from '@mui/material';
import { useAuth } from '../../context/AuthContext';
import { patientApi, vitalsApi, appointmentApi, type BackendPatient, type BackendDoctor } from '../../services/api';
import './AppointmentForm.css';

interface PatientOption {
  label: string;
  id: number;
  hn: string;
  name: string;
}

interface DoctorOption {
  label: string;
  id: number;
  name: string;
}

const timeSlots: string[] = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', 
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30'
];

export default function AppointmentForm() {
  const { currentUser } = useAuth();

  const [patientOptions, setPatientOptions] = useState<PatientOption[]>([]);
  const [doctorOptions, setDoctorOptions] = useState<DoctorOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedPatient, setSelectedPatient] = useState<PatientOption | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorOption | null>(null);
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

        // Load doctors from DB — /api/doctors ไม่จำกัด role จึงใช้ได้ทั้ง doctor/nurse/registrar ฯลฯ
        // (ต่างจาก /api/admin/users ที่จำกัดเฉพาะ admin และหน้านี้แพทย์เข้าถึงไม่ได้)
        const dData: BackendDoctor[] = await vitalsApi.getDoctors();
        const docOpts: DoctorOption[] = dData.map(d => ({
          label: d.fullname || d.username,
          id: d.id,
          name: d.fullname || d.username,
        }));
        setDoctorOptions(docOpts);

        // Auto-select current user if they are a doctor
        if (currentUser?.role === 'doctor') {
          const self = docOpts.find(d => String(d.id) === String(currentUser.id));
          if (self) setSelectedDoctor(self);
        }
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

    const doctorId = selectedDoctor?.id;
    if (!doctorId) {
      alert('กรุณาเลือกแพทย์');
      return;
    }

    let deptName = 'ตรวจโรคทั่วไป (General Practice)';
    if (department === 'medicine') deptName = 'อายุรกรรม (Internal Medicine)';
    else if (department === 'psychology') deptName = 'จิตวิทยา (Psychology)';
    else if (department === 'physical') deptName = 'กายภาพบำบัด (Physical Therapy)';

    const clinicalNote = `หมวด: ${deptName}${notes ? '\nหมายเหตุ: ' + notes : ''}`;

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await appointmentApi.create({
        patient_id: selectedPatient.id,
        doctor_id: doctorId,
        register_id: 0,
        appointment_date: date,
        appointment_time: time + ':00',
        clinical_note: clinicalNote,
      });

      setOpenAlert(true);

      // Clear form
      setSelectedPatient(null);
      setSelectedDoctor(currentUser?.role === 'doctor' ? selectedDoctor : null);
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
            <CircularProgress />
            <span style={{ marginLeft: 12, alignSelf: 'center', color: '#64748B' }}>กำลังโหลดข้อมูล...</span>
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

            {/* เลือกแพทย์ */}
            <div className="input-group">
              <label>แพทย์ผู้นัด <span className="required">*</span></label>
              <Autocomplete<DoctorOption>
                disablePortal
                options={doctorOptions}
                getOptionLabel={(option: DoctorOption) => option.label}
                value={selectedDoctor}
                disabled={currentUser?.role === 'doctor'}
                onChange={(_event: unknown, newValue: DoctorOption | null) => {
                  setSelectedDoctor(newValue);
                }}
                renderInput={(params) => (
                  <TextField 
                    {...params} 
                    size="small" 
                    placeholder="เลือกแพทย์..."
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: 'var(--input-bg)',
                        borderRadius: '8px',
                        '& fieldset': { borderColor: 'var(--input-border)' },
                        '&:hover fieldset': { borderColor: '#94A3B8' },
                        '&.Mui-focused fieldset': { borderColor: '#2563EB', borderWidth: '1px' },
                      },
                      '& .MuiInputBase-input': { color: 'var(--input-text)' }
                    }}
                  />
                )}
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
                <option value="general">ตรวจโรคทั่วไป (General Practice)</option>
                <option value="medicine">อายุรกรรม (Internal Medicine)</option>
                <option value="psychology">จิตวิทยา (Psychology)</option>
                <option value="physical">กายภาพบำบัด (Physical Therapy)</option>
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
              <div className="input-group full-width" style={{ color: '#EF4444', fontSize: '0.9rem' }}>
                ⚠ {errorMsg}
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