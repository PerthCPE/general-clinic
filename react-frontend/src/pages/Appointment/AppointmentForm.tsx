import React, { useState, useEffect } from 'react';
import { Autocomplete, TextField, Snackbar, Alert, CircularProgress } from '@mui/material';
import { AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { patientApi, appointmentApi, doctorApi, type BackendPatient } from '../../services/api';
import './AppointmentForm.css';

interface PatientOption {
  label: string;
  id: number;
  hn: string;
  name: string;
}

const timeSlots: string[] = [
  '07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30','12:00',
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30','18:00'
];

// ประเภทนัด — optional ไม่บังคับเลือก
const APPOINTMENT_TYPES = ['ติดตามอาการ', 'ฟังผลตรวจ', 'ทำหัตถการ', 'อื่นๆ'];

// คำแนะนำก่อนมาตามนัดที่พบบ่อย — ติ๊กได้หลายอัน ผสมกับช่องกรอกเพิ่มเติมได้ ไม่บังคับ
const PREP_INSTRUCTION_PRESETS = ['งดน้ำงดอาหารก่อนพบแพทย์', 'เจาะเลือดก่อนพบแพทย์', 'นำยาเดิมมาด้วย'];

export default function AppointmentForm() {
  const { currentUser } = useAuth();

  const [patientOptions, setPatientOptions] = useState<PatientOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedPatient, setSelectedPatient] = useState<PatientOption | null>(null);
  const [date, setDate] = useState<string>('');
  const [time, setTime] = useState<string>('');
  // แผนก — ล็อกตาม doctors.specialty ของแพทย์ผู้ล็อกอินเสมอ ดึงจาก /api/doctor/me
  // ครั้งเดียวตอนโหลดฟอร์ม ไม่ใช่ dropdown ให้เลือกเองอีกต่อไป
  const [department, setDepartment] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [appointmentType, setAppointmentType] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [prepChecks, setPrepChecks] = useState<string[]>([]);
  const [prepExtra, setPrepExtra] = useState<string>('');

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

        // แผนก — ดึงจากโปรไฟล์แพทย์ผู้ล็อกอินจริง ไม่ใช่ให้เลือกเอง
        // ถ้าแพทย์ยังไม่มี specialty ในระบบ (โปรไฟล์ยังไม่ครบ) ปล่อยเป็น '' ไม่บล็อกการสร้างนัดหมาย
        // (เหมือนนัดหมายเก่าที่ไม่มีค่า department จะขึ้น "ไม่ระบุแผนก" ในแดชบอร์ด)
        try {
          const profile = await doctorApi.getProfile();
          setDepartment(profile.specialty || '');
        } catch (profileErr) {
          console.error('Failed to load doctor specialty', profileErr);
        }

      } catch (err) {
        console.error('Failed to load appointment form data', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [currentUser]);

  const togglePrepCheck = (preset: string) => {
    setPrepChecks(prev =>
      prev.includes(preset) ? prev.filter(p => p !== preset) : [...prev, preset]
    );
  };

  const buildPrepInstructions = (): string => {
    const parts = [...prepChecks];
    if (prepExtra.trim()) parts.push(prepExtra.trim());
    return parts.join(', ');
  };

  const handleSave = async () => {
    // แผนกล็อกอัตโนมัติจากโปรไฟล์แพทย์ ไม่ใช่ข้อมูลที่ผู้ใช้กรอกเอง จึงไม่รวมอยู่ในเงื่อนไขบังคับกรอกนี้
    if (!selectedPatient || !date || !time) {
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
        appointment_type: appointmentType,
        reason,
        prep_instructions: buildPrepInstructions(),
      });

      setOpenAlert(true);

      // Clear form — department ไม่รีเซ็ต เพราะล็อกตามแพทย์ผู้ล็อกอิน ไม่ใช่ค่าที่ผู้ใช้กรอกต่อครั้ง
      setSelectedPatient(null);
      setDate('');
      setTime('');
      setNotes('');
      setAppointmentType('');
      setReason('');
      setPrepChecks([]);
      setPrepExtra('');
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

            {/* หมวดการรักษา — ล็อกตามแผนก (specialty) ของแพทย์ผู้ล็อกอิน แก้ไขไม่ได้ */}
            <div className="input-group">
              <label>หมวดการรักษา (อัตโนมัติตามแพทย์)</label>
              <input
                type="text"
                readOnly
                value={department || 'ไม่พบข้อมูลแผนกของแพทย์'}
                className="read-only-input"
              />
            </div>

            {/* ประเภทนัด */}
            <div className="input-group">
              <label>ประเภทนัด</label>
              <select value={appointmentType} onChange={(e) => setAppointmentType(e.target.value)}>
                <option value="">ไม่ระบุ</option>
                {APPOINTMENT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* เหตุผลการนัด */}
            <div className="input-group full-width">
              <label>เหตุผลการนัด</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="เช่น นัดติดตามผลการรักษาความดันโลหิตสูง"
              />
            </div>

            {/* คำแนะนำก่อนมาตามนัด */}
            <div className="input-group full-width">
              <label>คำแนะนำก่อนมาตามนัด</label>
              <div className="prep-checklist" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '8px' }}>
                {PREP_INSTRUCTION_PRESETS.map((preset) => (
                  <label key={preset} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 400, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={prepChecks.includes(preset)}
                      onChange={() => togglePrepCheck(preset)}
                    />
                    {preset}
                  </label>
                ))}
              </div>
              <input
                type="text"
                value={prepExtra}
                onChange={(e) => setPrepExtra(e.target.value)}
                placeholder="คำแนะนำเพิ่มเติม (ถ้ามี)"
              />
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