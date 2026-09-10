import React, { useState, useEffect } from 'react';
import { Stethoscope, Users, Baby, CheckCircle2, ChevronRight, BarChart2, Pin } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { appointmentApi, type BackendAppointment } from '../../services/api';
import { TREATMENT_DEPARTMENTS } from '../../config/roles';
import './AppointmentDashboard.css';

// ไอคอน + สีต่อแผนก ใช้คู่กับ TREATMENT_DEPARTMENTS (single source of truth ใน config/roles.ts)
// ถ้ามีการเพิ่ม/ลดแผนกใน TREATMENT_DEPARTMENTS ให้เพิ่ม/ลดรายการนี้ตามด้วย
const DEPARTMENT_META: Record<string, { icon: typeof Stethoscope; color: string }> = {
  'อายุรกรรมทั่วไป': { icon: Stethoscope, color: '#2563EB' },
  'เวชศาสตร์ครอบครัว': { icon: Users, color: '#9333EA' },
  'กุมารเวชกรรม': { icon: Baby, color: '#16A34A' },
};
const UNASSIGNED_DEPT_LABEL = 'ไม่ระบุแผนก';

const timeSlots = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', 
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30'
];

const getTodayDateString = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export default function AppointmentDashboard() {
  const { currentUser } = useAuth();
  
  const [appointments, setAppointments] = useState<BackendAppointment[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 8;

  const isDoctor = currentUser?.role === 'doctor';
  // สิทธิ์แก้ไข (วันที่/เวลา/สถานะ): nurse_assistant ได้เต็ม (แทนที่ registrar เดิมที่ถูกตัดออก
  // ทั้งหมดตามนโยบายใหม่) + admin คงไว้เหมือนเดิม — nurse ไม่อยู่ในนี้โดยตั้งใจ เพราะได้สิทธิ์
  // แบบดูอย่างเดียวเท่านั้น (ตกไปใช้ branch แสดงข้อความ/badge ธรรมดาแทน input/select ที่แก้ได้)
  const canEdit = currentUser?.role === 'nurse_assistant' || currentUser?.role === 'admin';

  const fetchAppointments = async () => {
    try {
      const data = await appointmentApi.getList();
      if (data) {
        setAppointments(data);
        setErrorMsg(null);
      }
    } catch (err) {
      console.error("Failed to fetch appointments", err);
      setErrorMsg('ไม่สามารถโหลดข้อมูลการนัดหมายได้ กรุณาลองรีเฟรชหน้านี้ใหม่อีกครั้ง');
    } finally {
      // ใช้เกต isLoading เฉพาะตอนโหลดครั้งแรก การรีเฟรชพื้นหลัง (WS / หลังแก้ไข)
      // ไม่ต้องเด้งกลับไปเป็นหน้า loading เต็มจออีก
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();

    const wsUrl = `ws://localhost:8080/ws`;
    const ws = new WebSocket(wsUrl);
    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'APPOINTMENT_CREATED' || payload.type === 'APPOINTMENT_UPDATED') {
          fetchAppointments();
        }
      } catch (err) {
        console.error(err);
      }
    };
    return () => { ws.close(); };
  }, []);

  const mapBackendToRow = (a: BackendAppointment) => {
    const pName = a.patient?.fullname || 'Unknown';
    const initialText = pName.length >= 2 ? pName.substring(0, 2) : 'คน';
    const timeStr = a.appointment_time ? a.appointment_time.substring(0, 5) : '-';
    // ใช้คอลัมน์ department ตรงๆ (เทียบค่ากับ TREATMENT_DEPARTMENTS ได้จริง) แทนการแกะจาก
    // clinical_note แบบเดิม — นัดหมายเก่าก่อนมีคอลัมน์นี้จะไม่มีค่า จึงจัดเป็น "ไม่ระบุแผนก"
    let deptName = a.department || UNASSIGNED_DEPT_LABEL;
    let deptColor = 'primary';
    
    let statusColor = 'default';
    if (a.status === 'เข้ารับการรักษาแล้ว') statusColor = 'success';
    else if (a.status === 'ยืนยันที่จะมาวันนี้') statusColor = 'info';
    else if (a.status === 'ยกเลิกนัด') statusColor = 'error';
    else if (a.status === 'ติดต่อไม่ได้') statusColor = 'warning';
    else if (a.status === 'รอยืนยัน') statusColor = 'info';

    return {
      id: a.id,
      name: pName,
      initial: initialText,
      dept: deptName,
      date: a.appointment_date ? a.appointment_date.substring(0, 10) : '-',
      time: timeStr,
      phone: a.patient?.phone_number || '-',
      status: a.status || '-',
      statusColor,
      deptColor
    };
  };

  const patientQueue = appointments.map(mapBackendToRow);

  const filteredQueue = patientQueue
    .filter(p => p.date === selectedDate)
    .sort((a, b) => a.time.localeCompare(b.time));

  const totalRaw = filteredQueue.length;
  const canceledCount = filteredQueue.filter(p => p.status === 'ยกเลิกนัด').length;
  const netActiveAppointments = totalRaw - canceledCount; 
  
  const arrivedCount = filteredQueue.filter(p => p.status === 'เข้ารับการรักษาแล้ว').length;
  const confirmedCount = filteredQueue.filter(p => p.status === 'ยืนยันที่จะมาวันนี้').length;
  const unreachableCount = filteredQueue.filter(p => p.status === 'ติดต่อไม่ได้').length;

  // นับจำนวนผู้ป่วยต่อแผนกจริงจาก TREATMENT_DEPARTMENTS (single source of truth)
  // แทนการเทียบ string 4 ชื่อที่ฝังไว้ตรงๆ ซึ่งไม่เคยตรงกับค่าที่ฟอร์มนัดหมายส่งมาเลย
  const departmentCounts = TREATMENT_DEPARTMENTS.map((dept) => ({
    dept,
    count: filteredQueue.filter(p => p.dept === dept).length,
  }));

  const progressPercent = netActiveAppointments > 0 ? ((arrivedCount / netActiveAppointments) * 100).toFixed(1) : '0';

  const totalPages = Math.ceil(filteredQueue.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentTableData = filteredQueue.slice(startIndex, startIndex + itemsPerPage);

  const handleStatusChange = async (id: number, newStatus: string) => {
    try {
      await appointmentApi.updateStatus(id, { status: newStatus });
      fetchAppointments();
    } catch (err) {
      console.error(err);
      alert('ไม่สามารถอัปเดตสถานะได้');
    }
  };

  const handleTimeChange = async (id: number, newTime: string) => {
    try {
      await appointmentApi.updateSchedule(id, { appointment_time: newTime });
      fetchAppointments();
    } catch (err) {
      console.error(err);
      alert('ไม่สามารถอัปเดตเวลาได้');
    }
  };

  const handleDateSelected = async (id: number, newDate: string) => {
    try {
      await appointmentApi.updateSchedule(id, { appointment_date: newDate });
      fetchAppointments();
    } catch (err) {
      console.error(err);
      alert('ไม่สามารถอัปเดตวันที่ได้');
    }
  };

  return (
    <div className="appt-overview-container">
      
      <div className="appt-title-row">
        <h1 className="appt-title">แดชบอร์ดสรุปภาพรวมนัดหมาย</h1>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => { setSelectedDate(e.target.value); setCurrentPage(1); }}
          className="appt-date-select"
        />
      </div>

      {errorMsg && (
        <div className="appt-error-banner">
          <span>{errorMsg}</span>
        </div>
      )}

      {isLoading ? (
        <div className="appt-card appt-loading-state">
          <span className="appt-spinner" />
          <span>กำลังโหลดข้อมูลนัดหมาย...</span>
        </div>
      ) : (
      <>
      {/* 1. ส่วนการ์ดใหญ่หลัก (ยอดรวม & ความคืบหน้า) */}
      <div className="appt-metrics-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', marginBottom: '16px' }}>
        
        <div className="appt-card metric-card primary-bg" style={{ padding: '24px' }}>
          <span className="metric-label-light" style={{ fontSize: '0.95rem' }}>ยอดที่จะเข้ามาใช้บริการวันนี้ (สุทธิ / ทั้งหมด)</span>
          <div className="metric-value-large" style={{ fontSize: '2.8rem' }}>
            {netActiveAppointments} <span style={{ fontSize: '1.6rem', opacity: 0.8 }}>/ {totalRaw}</span>
          </div>
          <span className="metric-note" style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.8rem', marginTop: '6px' }}>
            (ยอดสุทธิหักผู้ป่วยที่ยกเลิกนัดออกแล้ว)
          </span>
        </div>

        <div className="appt-card metric-card" style={{ padding: '24px' }}>
          <span className="metric-label" style={{ fontSize: '0.95rem' }}>ความคืบหน้าการดูแลผู้ป่วย (สำเร็จ)</span>
          <div className="metric-value-large text-success" style={{ fontSize: '2.8rem' }}>{progressPercent}%</div>
          <span className="metric-trend positive" style={{ fontSize: '0.8rem', marginTop: '6px' }}>
            ✓ นับเฉพาะผู้ป่วยที่เข้ารับการรักษาแล้ว ({arrivedCount} / {netActiveAppointments} คน)
          </span>
        </div>
      </div>

      {/* 2. สถิติจำนวนผู้ป่วยแยกตามแผนก */}
      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary, #94A3B8)', marginBottom: '8px', paddingLeft: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <BarChart2 size={18} strokeWidth={2.5} /> สถิติผู้ป่วยแยกตามแผนกการรักษา
      </div>
      <div className="appt-metrics-grid" style={{ gridTemplateColumns: `repeat(${departmentCounts.length}, 1fr)`, marginBottom: '16px' }}>
        {departmentCounts.map(({ dept, count }) => {
          const meta = DEPARTMENT_META[dept];
          const Icon = meta?.icon ?? Stethoscope;
          const color = meta?.color ?? '#64748B';
          return (
            <div key={dept} className="appt-card metric-card" style={{ padding: '16px', borderLeft: `4px solid ${color}` }}>
              <span className="metric-label" style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Icon size={16} strokeWidth={2.5} /> {dept}
              </span>
              <div className="metric-value-large" style={{ fontSize: '1.6rem', color, marginTop: '4px' }}>{count} คน</div>
            </div>
          );
        })}
      </div>

      {/* 3. สถิติตามสถานะการนัดหมาย */}
      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary, #94A3B8)', marginBottom: '8px', paddingLeft: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Pin size={18} strokeWidth={2.5} /> สถานะการมาใช้บริการ
      </div>
      <div className="appt-metrics-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '28px' }}>
        <div className="appt-card metric-card" style={{ padding: '14px 18px' }}>
          <span className="metric-label" style={{ fontSize: '0.8rem' }}>เข้ารับการรักษาแล้ว</span>
          <div className="metric-value-large text-success" style={{ fontSize: '1.4rem', marginTop: '2px' }}>{arrivedCount} คน</div>
        </div>

        <div className="appt-card metric-card" style={{ padding: '14px 18px' }}>
          <span className="metric-label" style={{ fontSize: '0.8rem' }}>ยืนยันว่าจะมา</span>
          <div className="metric-value-large text-primary" style={{ fontSize: '1.4rem', marginTop: '2px' }}>{confirmedCount} คน</div>
        </div>

        <div className="appt-card metric-card" style={{ padding: '14px 18px' }}>
          <span className="metric-label" style={{ fontSize: '0.8rem' }}>ติดต่อไม่ได้</span>
          <div className="metric-value-large" style={{ color: '#F59E0B', fontSize: '1.4rem', marginTop: '2px' }}>{unreachableCount} คน</div>
        </div>

        <div className="appt-card metric-card" style={{ padding: '14px 18px' }}>
          <span className="metric-label" style={{ fontSize: '0.8rem' }}>ยอดยกเลิกนัด</span>
          <div className="metric-value-large" style={{ color: '#EF4444', fontSize: '1.4rem', marginTop: '2px' }}>{canceledCount} คน</div>
        </div>
      </div>

      {/* ส่วนตารางรายชื่อผู้ป่วย */}
      <div className="appt-card table-card">
        <div className="table-header-row">
          <div>
            <h2 className="table-title">👥 รายชื่อคิวผู้ป่วยและสถานะ (วันที่ {selectedDate})</h2>
            <p className="table-subtitle">เรียงลำดับตามเวลานัดหมาย (เช้าไปเย็น)</p>
          </div>
          {isDoctor && (
            <button className="btn-primary-add" onClick={() => window.location.hash = 'appointment-form'}>
              + เพิ่มนัดหมายใหม่
            </button>
          )}
        </div>

        <div className="table-responsive">
          <table className="appt-table">
            <thead>
              <tr>
                <th>ชื่อ-นามสกุล</th>
                <th>แผนกการรักษา</th>
                <th>วันที่นัดหมาย</th>
                <th>เวลานัดหมาย</th>
                <th>เบอร์โทรศัพท์</th>
                <th>สถานะการนัดหมาย</th>
              </tr>
            </thead>
            <tbody>
              {currentTableData.length > 0 ? (
                currentTableData.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="patient-name-col">
                        <div className="avatar-circle">{row.initial}</div>
                        <span className="patient-name">{row.name}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`dept-badge badge-${row.deptColor}`}>{row.dept}</span>
                    </td>
                    <td>
                      {canEdit ? (
                        <input 
                          type="date"
                          value={row.date}
                          onChange={(e) => handleDateSelected(row.id, e.target.value)}
                          className="appt-date-select"
                          style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                        />
                      ) : (
                        <span>{row.date}</span>
                      )}
                    </td>
                    <td>
                      {canEdit ? (
                        <select
                          value={row.time}
                          onChange={(e) => handleTimeChange(row.id, e.target.value)}
                          className="status-dropdown"
                          style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                        >
                          <option value="-" disabled>- เลือกเวลา -</option>
                          {timeSlots.map((slot) => (
                            <option key={slot} value={slot}>{slot} น.</option>
                          ))}
                        </select>
                      ) : (
                        <span className="time-text">{row.time} น.</span>
                      )}
                    </td>
                    <td><span className="phone-text">{row.phone}</span></td>
                    <td>
                      {canEdit ? (
                        <select 
                          value={row.status}
                          onChange={(e) => handleStatusChange(row.id, e.target.value)}
                          className={`status-dropdown status-${row.statusColor}`}
                        >
                          <option value="-" disabled>- (ยังไม่ได้อัปเดต)</option>
                          <option value="รอยืนยัน">รอยืนยัน</option>
                          <option value="ยืนยันที่จะมาวันนี้">ยืนยันที่จะมาวันนี้</option>
                          <option value="เข้ารับการรักษาแล้ว">เข้ารับการรักษาแล้ว</option>
                          <option value="ยกเลิกนัด">ยกเลิกนัด</option>
                          <option value="ติดต่อไม่ได้">ติดต่อไม่ได้</option>
                        </select>
                      ) : (
                        <span className={`status-badge status-${row.statusColor}`}>
                          {row.status}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: '#64748B' }}>
                    ไม่พบข้อมูลการนัดหมายในวันที่เลือก (คุณสามารถเลือกดูวันอื่นได้จากปฏิทินด้านบน)
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderTop: '1px solid #E2E8F0' }}>
            <span style={{ fontSize: '0.85rem', color: '#64748B' }}>
              แสดงหน้า {currentPage} จาก {totalPages} (ทั้งหมด {filteredQueue.length} รายการ)
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                className="btn-action btn-secondary" 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                style={{ opacity: currentPage === 1 ? 0.5 : 1, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
              >
                ◀ หน้าก่อนหน้า
              </button>
              <button 
                className="btn-action btn-primary" 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                style={{ opacity: currentPage === totalPages ? 0.5 : 1, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
              >
                หน้าถัดไป ▶
              </button>
            </div>
          </div>
        )}
      </div>
      </>
      )}
    </div>
  );
}