import React, { useState } from 'react';
import './ScheduleManagementPage.css';

interface ShiftSchedule {
  id: string;
  name: string;
  department: string;
  avatarText: string;
  specialty: string;
  phone: string;
  email: string;
  shifts: {
    mon: 'morning' | 'afternoon' | 'off';
    tue: 'morning' | 'afternoon' | 'off';
    wed: 'morning' | 'afternoon' | 'off';
    thu: 'morning' | 'afternoon' | 'off';
    fri: 'morning' | 'afternoon' | 'off';
    sat: 'morning' | 'afternoon' | 'off';
    sun: 'morning' | 'afternoon' | 'off';
  };
}

const generateMockSchedules = (): ShiftSchedule[] => {
  const departments = ['อายุรกรรม', 'กุมารเวชกรรม', 'ศัลยกรรม', 'สูตินรีเวช', 'จักษุ', 'ทันตกรรม', 'พยาบาลวิชาชีพ', 'เภสัชกรรม'];
  const firstNames = ['สมชาย', 'วิภาดา', 'มานะ', 'ปิติ', 'ชูใจ', 'สมร', 'กิตติ', 'สิริ', 'ธนพล', 'พิมผกา', 'ณัฐวุฒิ', 'วรินทร', 'จิราพร', 'นพดล', 'สุดา', 'นิธิ', 'พรพรรณ', 'วีระ'];
  const lastNames = ['รักดี', 'ใจเย็น', 'ตั้งมั่น', 'มีชัย', 'พูนสุข', 'ใจดี', 'วิเศษ', 'งามขำ', 'เจริญ', 'ดีงาม'];
  
  const schedules: ShiftSchedule[] = [];
  const shiftTypes: ('morning' | 'afternoon' | 'off')[] = ['morning', 'afternoon', 'off'];
  
  for (let i = 0; i < 2; i++) {
    const fn = firstNames[i % firstNames.length];
    const ln = lastNames[Math.floor(Math.random() * lastNames.length)];
    
    const getRandomShift = () => shiftTypes[Math.floor(Math.random() * shiftTypes.length)];
    
    schedules.push({
      id: `EMP-${100 + i}`,
      name: `${(i % 2 === 0 ? 'นพ.' : 'พญ.')} ${fn} ${ln}`,
      department: departments[i % departments.length],
      avatarText: fn.substring(0, 2),
      specialty: departments[i % departments.length],
      phone: `08${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`,
      email: `doctor${100+i}@clinic.com`,
      shifts: {
        mon: getRandomShift(),
        tue: getRandomShift(),
        wed: getRandomShift(),
        thu: getRandomShift(),
        fri: getRandomShift(),
        sat: i % 3 === 0 ? 'off' : getRandomShift(),
        sun: i % 4 === 0 ? 'off' : getRandomShift(),
      }
    });
  }
  return schedules;
};

export const ScheduleManagementPage: React.FC = () => {
  const now = new Date();
  const [activeTab, setActiveTab] = useState<'weekly' | 'employees' | 'calendar'>('calendar');
  const [schedules, setSchedules] = useState<ShiftSchedule[]>(generateMockSchedules());
  
  const [viewMode, setViewMode] = useState<'monthly' | 'weekly' | 'daily'>('monthly');
  const [selectedDate, setSelectedDate] = useState(new Date());

  const [editingSchedule, setEditingSchedule] = useState<ShiftSchedule | null>(null);
  const [calendarOverrides, setCalendarOverrides] = useState<Record<string, Record<string, 'morning' | 'afternoon' | 'off'>>>({});
  const [editingCalendarDate, setEditingCalendarDate] = useState<string | null>(null);
  const [tempDayShifts, setTempDayShifts] = useState<Record<string, 'morning' | 'afternoon' | 'off'>>({});
  
  const [filterState, setFilterState] = useState({ doctorId: 'all', startDate: '', endDate: '' });
  const [tempFilterState, setTempFilterState] = useState(filterState);

  // Modals
  const [activeModal, setActiveModal] = useState<'swapRequests' | 'attendance' | 'filter' | 'addSchedule' | null>(null);

  const translateShift = (shift: 'morning' | 'afternoon' | 'off') => {
    switch (shift) {
      case 'morning': return <span className="shift-badge morning">เช้า</span>;
      case 'afternoon': return <span className="shift-badge afternoon">บ่าย</span>;
      case 'off': return <span className="shift-circle-off">○</span>;
      default: return null;
    }
  };

  const handleEditClick = (schedule: ShiftSchedule) => {
    setEditingSchedule(JSON.parse(JSON.stringify(schedule)));
  };

  const handleSaveEdit = () => {
    if (editingSchedule) {
      setSchedules(prev => prev.map(s => (s.id === editingSchedule.id ? editingSchedule : s)));
      setEditingSchedule(null);
    }
  };

  const handleShiftChange = (day: keyof ShiftSchedule['shifts'], value: 'morning' | 'afternoon' | 'off') => {
    if (editingSchedule) {
      setEditingSchedule({ ...editingSchedule, shifts: { ...editingSchedule.shifts, [day]: value } });
    }
  };

  const renderModalContent = () => {
    if (activeModal === 'swapRequests') {
      return (
        <div className="modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="dms-card modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>คำขอแลกเวรรออนุมัติ (4)</h3>
              <button className="close-modal-btn" onClick={() => setActiveModal(null)}>×</button>
            </div>
            <div className="modal-body">
              {[1,2,3,4].map(req => (
                <div key={req} style={{ padding: '12px', border: '1px solid var(--border-color)', borderRadius: '8px', marginBottom: '12px' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>คำขอที่ #{req}0{req}</div>
                  <div style={{ fontSize: '13px', marginBottom: '8px' }}>คุณสมชาย ขอแลกเวร วันจันทร์ 23 ต.ค. (เช้า) กับ คุณวิภาดา</div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="save-btn" style={{ padding: '4px 12px', fontSize: '12px' }} onClick={() => { alert('อนุมัติแล้ว'); setActiveModal(null); }}>อนุมัติ</button>
                    <button className="cancel-btn" style={{ padding: '4px 12px', fontSize: '12px' }} onClick={() => { alert('ปฏิเสธแล้ว'); setActiveModal(null); }}>ปฏิเสธ</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }
    
    if (activeModal === 'attendance') {
      return (
        <div className="modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="dms-card modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>อัตราการเข้าเวร</h3>
              <button className="close-modal-btn" onClick={() => setActiveModal(null)}>×</button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: '48px', fontWeight: 'bold', color: '#10B981', marginBottom: '12px' }}>95%</div>
              <p>แพทย์เข้าเวรตรงเวลาและครบถ้วนในสัปดาห์นี้</p>
              <div style={{ width: '100%', height: '8px', background: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden', marginTop: '16px' }}>
                <div style={{ width: '95%', height: '100%', background: '#10B981' }}></div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (activeModal === 'filter') {
      return (
        <div className="modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="dms-card modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>กรองข้อมูลตารางงาน</h3>
              <button className="close-modal-btn" onClick={() => setActiveModal(null)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '13px' }}>แพทย์</label>
                <select 
                  className="form-input-text" 
                  style={{ width: '100%' }}
                  value={tempFilterState.doctorId}
                  onChange={e => setTempFilterState({ ...tempFilterState, doctorId: e.target.value })}
                >
                  <option value="all">ทั้งหมด</option>
                  {schedules.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '13px' }}>ตั้งแต่ช่วงวันที่</label>
                  <input 
                    type="date" 
                    className="form-input-text" 
                    style={{ width: '100%' }} 
                    value={tempFilterState.startDate}
                    onChange={e => setTempFilterState({ ...tempFilterState, startDate: e.target.value })}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '13px' }}>ถึงวันที่</label>
                  <input 
                    type="date" 
                    className="form-input-text" 
                    style={{ width: '100%' }} 
                    value={tempFilterState.endDate}
                    onChange={e => setTempFilterState({ ...tempFilterState, endDate: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="cancel-btn" onClick={() => {
                setTempFilterState({ doctorId: 'all', startDate: '', endDate: '' });
                setFilterState({ doctorId: 'all', startDate: '', endDate: '' });
                setActiveModal(null);
              }}>ล้างตัวกรอง</button>
              <button className="save-btn" onClick={() => { 
                setFilterState(tempFilterState); 
                setActiveModal(null); 
              }}>นำไปใช้</button>
            </div>
          </div>
        </div>
      );
    }

    if (activeModal === 'addSchedule') {
      return (
        <div className="modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="dms-card modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>สร้างตารางงานใหม่</h3>
              <button className="close-modal-btn" onClick={() => setActiveModal(null)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '13px' }}>เลือกแพทย์</label>
                <select className="form-input-text" style={{ width: '100%' }}>
                  {schedules.map(s => <option key={s.id}>{s.name} ({s.department})</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '13px' }}>เลือกช่วงวันที่</label>
                <input type="date" className="form-input-text" style={{ width: '100%' }} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="cancel-btn" onClick={() => setActiveModal(null)}>ยกเลิก</button>
              <button className="save-btn" onClick={() => { alert('สร้างตารางงานสำเร็จ'); setActiveModal(null); }}>บันทึก</button>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  const renderCalendarView = () => {
    const daysOfWeek = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
    
    const currentYear = selectedDate.getFullYear();
    const currentMonth = selectedDate.getMonth();
    const monthNames = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    const buddhistYear = currentYear + 543;
    
    let headerText = `${monthNames[currentMonth]} ${buddhistYear}`;
    
    const handlePrev = () => {
      const newDate = new Date(selectedDate);
      if (viewMode === 'monthly') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else if (viewMode === 'weekly') {
        newDate.setDate(newDate.getDate() - 7);
      } else {
        newDate.setDate(newDate.getDate() - 1);
      }
      setSelectedDate(newDate);
    };

    const handleNext = () => {
      const newDate = new Date(selectedDate);
      if (viewMode === 'monthly') {
        newDate.setMonth(newDate.getMonth() + 1);
      } else if (viewMode === 'weekly') {
        newDate.setDate(newDate.getDate() + 7);
      } else {
        newDate.setDate(newDate.getDate() + 1);
      }
      setSelectedDate(newDate);
    };

    const daysToRender: { date: Date, d: number, m: number, y: number, isCurrentMonth: boolean }[] = [];
    
    if (viewMode === 'monthly') {
      const startDayOffset = new Date(currentYear, currentMonth, 1).getDay();
      const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
      for (let i = 0; i < startDayOffset; i++) {
        daysToRender.push({ date: new Date(currentYear, currentMonth, i - startDayOffset + 1), d: 0, m: 0, y: 0, isCurrentMonth: false });
      }
      for (let d = 1; d <= totalDays; d++) {
        daysToRender.push({ date: new Date(currentYear, currentMonth, d), d, m: currentMonth, y: currentYear, isCurrentMonth: true });
      }
      const remainingCells = (7 - (daysToRender.length % 7)) % 7;
      for (let i = 0; i < remainingCells; i++) {
        daysToRender.push({ date: new Date(currentYear, currentMonth + 1, i + 1), d: 0, m: 0, y: 0, isCurrentMonth: false });
      }
    } else if (viewMode === 'weekly') {
      const currentDay = selectedDate.getDay();
      const startDate = new Date(selectedDate);
      startDate.setDate(selectedDate.getDate() - currentDay);
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      
      if (startDate.getMonth() === endDate.getMonth()) {
        headerText = `${startDate.getDate()} - ${endDate.getDate()} ${monthNames[startDate.getMonth()]} ${startDate.getFullYear() + 543}`;
      } else if (startDate.getFullYear() === endDate.getFullYear()) {
        headerText = `${startDate.getDate()} ${monthNames[startDate.getMonth()]} - ${endDate.getDate()} ${monthNames[endDate.getMonth()]} ${startDate.getFullYear() + 543}`;
      } else {
        headerText = `${startDate.getDate()} ${monthNames[startDate.getMonth()]} ${startDate.getFullYear() + 543} - ${endDate.getDate()} ${monthNames[endDate.getMonth()]} ${endDate.getFullYear() + 543}`;
      }

      for (let i = 0; i < 7; i++) {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + i);
        daysToRender.push({ date: d, d: d.getDate(), m: d.getMonth(), y: d.getFullYear(), isCurrentMonth: true });
      }
    } else if (viewMode === 'daily') {
      headerText = `${selectedDate.getDate()} ${monthNames[currentMonth]} ${buddhistYear}`;
      daysToRender.push({ 
        date: new Date(selectedDate), 
        d: selectedDate.getDate(), 
        m: selectedDate.getMonth(), 
        y: selectedDate.getFullYear(), 
        isCurrentMonth: true 
      });
    }

    const calendarCells = daysToRender.map((cellData, index) => {
      if (!cellData.isCurrentMonth) {
        return <div key={`empty-${index}`} className="calendar-day empty"></div>;
      }
      
      const d = cellData.d;
      const cy = cellData.y;
      const cm = cellData.m;
      const currentDayOfWeek = cellData.date.getDay(); 
      const dayKeys: (keyof ShiftSchedule['shifts'])[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
      const dayKey = dayKeys[currentDayOfWeek];

      const paddedMonth = String(cm + 1).padStart(2, '0');
      const paddedDay = String(d).padStart(2, '0');
      const currentDayStr = `${cy}-${paddedMonth}-${paddedDay}`;
      
      let isDayVisible = true;
      if (filterState.startDate && currentDayStr < filterState.startDate) isDayVisible = false;
      if (filterState.endDate && currentDayStr > filterState.endDate) isDayVisible = false;

      const isToday = now.getFullYear() === cy && now.getMonth() === cm && now.getDate() === d;

      const currentDayShifts = schedules.map(s => {
        const override = calendarOverrides[currentDayStr]?.[s.id];
        const finalShift = override !== undefined ? override : s.shifts[dayKey];
        return { ...s, currentShift: finalShift };
      });
      
      const activeShifts = currentDayShifts.filter(s => {
        if (!isDayVisible) return false;
        if (s.currentShift === 'off') return false;
        if (filterState.doctorId !== 'all' && s.id !== filterState.doctorId) return false;
        return true;
      });

      const handleEditDayClick = () => {
        const initialShifts: Record<string, 'morning' | 'afternoon' | 'off'> = {};
        currentDayShifts.forEach(s => {
          initialShifts[s.id] = s.currentShift;
        });
        setTempDayShifts(initialShifts);
        setEditingCalendarDate(currentDayStr);
      };

      return (
        <div key={`day-${currentDayStr}`} className="calendar-day" style={{ position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span className={`calendar-date ${isToday ? 'today' : ''}`} style={{ margin: 0 }}>{d}</span>
            <button onClick={handleEditDayClick} className="edit-action-btn" style={{ padding: '2px 6px', fontSize: '11px' }}>
              แก้ไข
            </button>
          </div>
          <div className="calendar-shifts">
            {activeShifts.map(s => (
              <div key={`${currentDayStr}-${s.id}`} className={`calendar-shift-item ${s.currentShift}`}>
                • {s.name.replace(/คุณ |นพ\.|พญ\./, '').trim()}: {s.currentShift === 'morning' ? 'เวรเช้า (OPD)' : 'เวรบ่าย (ER/OR)'}
              </div>
            ))}
          </div>
        </div>
      );
    });

    return (
      <div className="calendar-view">
        <div className="calendar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <button onClick={handlePrev} className="cancel-btn" style={{ padding: '4px 12px', fontSize: '12px' }}>&lt; ก่อนหน้า</button>
          <h3>{headerText}</h3>
          <button onClick={handleNext} className="cancel-btn" style={{ padding: '4px 12px', fontSize: '12px' }}>ถัดไป &gt;</button>
        </div>
        <div className="calendar-grid" style={{ gridTemplateColumns: viewMode === 'daily' ? '1fr' : 'repeat(7, 1fr)' }}>
          {viewMode === 'daily' ? (
            <div className="calendar-day-header">{daysOfWeek[selectedDate.getDay()]}</div>
          ) : (
            daysOfWeek.map(d => (
              <div key={d} className="calendar-day-header">{d}</div>
            ))
          )}
          {calendarCells}
        </div>
      </div>
    );
  };

  return (
    <div className="schedule-container">
      {/* Title & Subtitle */}
      <div className="schedule-header">
        <h1 className="schedule-title">จัดการตารางงานแพทย์</h1>
        <p className="schedule-subtitle">จัดการและติดตามตารางการเข้าเวรของแพทย์ในคลินิก</p>
      </div>



      {/* Roster Controls */}
      <div className="dms-card roster-card">
        <div className="roster-header">
          <div className="tab-buttons">
            <button
              className={`tab-btn ${activeTab === 'calendar' ? 'active' : ''}`}
              onClick={() => setActiveTab('calendar')}
            >
              ปฏิทินรายเดือน
            </button>
            <button
              className={`tab-btn ${activeTab === 'weekly' ? 'active' : ''}`}
              onClick={() => setActiveTab('weekly')}
            >
              แพทย์
            </button>
          </div>

          <div className="roster-actions">
            <select 
              className="form-input-text" 
              style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '13px', backgroundColor: 'var(--card-bg)', color: 'var(--text-color)' }}
              value={viewMode}
              onChange={e => setViewMode(e.target.value as any)}
            >
              <option value="monthly">รายเดือน</option>
              <option value="weekly">รายสัปดาห์</option>
              <option value="daily">รายวัน</option>
            </select>
            <button className="filter-btn" onClick={() => { setTempFilterState(filterState); setActiveModal('filter'); }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/>
              </svg>
              กรองข้อมูล
            </button>
          </div>
        </div>

        {activeTab === 'calendar' && renderCalendarView()}
        {activeTab === 'weekly' && (
          <div className="table-responsive">
            <table className="schedule-table">
              <thead>
                <tr>
                  <th>ชื่อแพทย์</th>
                  <th>ความเชี่ยวชาญ</th>
                  <th>เบอร์โทร</th>
                  <th>อีเมล</th>
                </tr>
              </thead>
              <tbody>
                {schedules.filter(item => filterState.doctorId === 'all' || item.id === filterState.doctorId).map(item => (
                  <tr key={item.id}>
                    <td>
                      <div className="employee-cell">
                        <div className="employee-avatar">{item.avatarText}</div>
                        <span className="employee-name">{item.name}</span>
                      </div>
                    </td>
                    <td>{item.specialty || item.department}</td>
                    <td>{item.phone}</td>
                    <td>{item.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Shift Modal */}
      {editingSchedule && (
        <div className="modal-backdrop" onClick={() => setEditingSchedule(null)}>
          <div className="dms-card modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>แก้ไขตารางเวร - {editingSchedule.name}</h3>
              <button className="close-modal-btn" onClick={() => setEditingSchedule(null)}>×</button>
            </div>
            <div className="modal-body">
              {Object.keys(editingSchedule.shifts).map(day => {
                const typedDay = day as keyof ShiftSchedule['shifts'];
                const dayLabels: Record<string, string> = {
                  mon: 'จันทร์ 23 ต.ค.', tue: 'อังคาร 24 ต.ค.', wed: 'พุธ 25 ต.ค.',
                  thu: 'พฤหัสบดี 26 ต.ค.', fri: 'ศุกร์ 27 ต.ค.', sat: 'เสาร์ 28 ต.ค.', sun: 'อาทิตย์ 29 ต.ค.'
                };
                return (
                  <div key={day} className="shift-edit-row">
                    <span className="day-label">{dayLabels[day]}</span>
                    <div className="shift-options">
                      <label className="radio-label">
                        <input type="radio" name={`shift-${day}`} value="morning" checked={editingSchedule.shifts[typedDay] === 'morning'} onChange={() => handleShiftChange(typedDay, 'morning')} />
                        <span>เช้า</span>
                      </label>
                      <label className="radio-label">
                        <input type="radio" name={`shift-${day}`} value="afternoon" checked={editingSchedule.shifts[typedDay] === 'afternoon'} onChange={() => handleShiftChange(typedDay, 'afternoon')} />
                        <span>บ่าย</span>
                      </label>
                      <label className="radio-label">
                        <input type="radio" name={`shift-${day}`} value="off" checked={editingSchedule.shifts[typedDay] === 'off'} onChange={() => handleShiftChange(typedDay, 'off')} />
                        <span>หยุด</span>
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="modal-footer">
              <button className="cancel-btn" onClick={() => setEditingSchedule(null)}>ยกเลิก</button>
              <button className="save-btn" onClick={handleSaveEdit}>บันทึกตารางเวร</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Calendar Day Modal */}
      {editingCalendarDate !== null && (
        <div className="modal-backdrop" onClick={() => setEditingCalendarDate(null)}>
          <div className="dms-card modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              {(() => {
                const [year, month, day] = editingCalendarDate.split('-');
                const monthNames = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
                const monthName = monthNames[parseInt(month, 10) - 1];
                const buddhistYear = parseInt(year, 10) + 543;
                return <h3>แก้ไขตารางเวร - วันที่ {parseInt(day, 10)} {monthName} {buddhistYear}</h3>;
              })()}
              <button className="close-modal-btn" onClick={() => setEditingCalendarDate(null)}>×</button>
            </div>
            <div className="modal-body">
              {schedules.map(doc => (
                <div key={doc.id} className="shift-edit-row">
                  <span className="day-label" style={{ fontSize: '13px' }}>{doc.name} ({doc.department})</span>
                  <div className="shift-options">
                    <label className="radio-label">
                      <input 
                        type="radio" 
                        name={`shift-${doc.id}`} 
                        value="morning" 
                        checked={tempDayShifts[doc.id] === 'morning'} 
                        onChange={() => setTempDayShifts({ ...tempDayShifts, [doc.id]: 'morning' })} 
                      />
                      <span>เช้า</span>
                    </label>
                    <label className="radio-label">
                      <input 
                        type="radio" 
                        name={`shift-${doc.id}`} 
                        value="afternoon" 
                        checked={tempDayShifts[doc.id] === 'afternoon'} 
                        onChange={() => setTempDayShifts({ ...tempDayShifts, [doc.id]: 'afternoon' })} 
                      />
                      <span>บ่าย</span>
                    </label>
                    <label className="radio-label">
                      <input 
                        type="radio" 
                        name={`shift-${doc.id}`} 
                        value="off" 
                        checked={tempDayShifts[doc.id] === 'off'} 
                        onChange={() => setTempDayShifts({ ...tempDayShifts, [doc.id]: 'off' })} 
                      />
                      <span>หยุด</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="cancel-btn" onClick={() => setEditingCalendarDate(null)}>ยกเลิก</button>
              <button className="save-btn" onClick={() => {
                setCalendarOverrides({ ...calendarOverrides, [editingCalendarDate]: tempDayShifts });
                setEditingCalendarDate(null);
              }}>บันทึกตารางเวร</button>
            </div>
          </div>
        </div>
      )}

      {renderModalContent()}
    </div>
  );
};
