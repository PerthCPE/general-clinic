import React, { useState } from 'react';
import toast from 'react-hot-toast';
import './ScheduleManagementPage.css';

interface ShiftSchedule {
  id: string;
  doctorCode: string;
  name: string;
  department: string;
  avatarText: string;
  specialty: string;
  phone: string;
  email: string;
  shifts: {
    mon: 'morning' | 'afternoon' | 'night' | 'off';
    tue: 'morning' | 'afternoon' | 'night' | 'off';
    wed: 'morning' | 'afternoon' | 'night' | 'off';
    thu: 'morning' | 'afternoon' | 'night' | 'off';
    fri: 'morning' | 'afternoon' | 'night' | 'off';
    sat: 'morning' | 'afternoon' | 'night' | 'off';
    sun: 'morning' | 'afternoon' | 'night' | 'off';
  };
}

interface ShiftSwapItem {
  id: string;
  requesterName: string;
  requesterShift: string;
  receiverName: string;
  receiverShift: string;
  date: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
}

const generateMockSchedules = (): ShiftSchedule[] => {
  const doctors = [
    { code: 'DOC-0001', name: 'นพ. อานนท์ ศรีตรวจ', dept: 'อายุรกรรมทั่วไป', specialty: 'โรคหัวใจและหลอดเลือด', phone: '081-445-9821', email: 'arnon.s@clinic.local', avatar: 'AS' },
    { code: 'DOC-0002', name: 'พญ. วิภาดา รักดี', dept: 'กุมารเวชกรรม', specialty: 'กุมารเวชศาสตร์โรคภูมิแพ้', phone: '089-223-1144', email: 'wiphada.r@clinic.local', avatar: 'WR' },
    { code: 'DOC-0003', name: 'นพ. สมชาย ใจเย็น', dept: 'ศัลยกรรมกระดูก', specialty: 'ศัลยกรรมกระดูกและข้อ', phone: '084-551-8790', email: 'somchai.j@clinic.local', avatar: 'SJ' },
    { code: 'DOC-0004', name: 'พญ. พิมผกา มีชัย', dept: 'สูตินรีเวช', specialty: 'เวชศาสตร์มารดาและทารก', phone: '086-778-9900', email: 'pimpaka.m@clinic.local', avatar: 'PM' },
    { code: 'DOC-0005', name: 'นพ. นิธิ เจริญยิ่ง', dept: 'จักษุวิทยา', specialty: 'กระจกตาและการแก้ไขสายตา', phone: '082-334-5566', email: 'nithi.c@clinic.local', avatar: 'NC' },
    { code: 'DOC-0006', name: 'ทพญ. สุดา ตั้งมั่น', dept: 'ทันตกรรม', specialty: 'ทันตกรรมประดิษฐ์', phone: '085-112-3344', email: 'suda.t@clinic.local', avatar: 'ST' },
  ];

  return doctors.map((doc, idx) => ({
    id: `EMP-${101 + idx}`,
    doctorCode: doc.code,
    name: doc.name,
    department: doc.dept,
    avatarText: doc.avatar,
    specialty: doc.specialty,
    phone: doc.phone,
    email: doc.email,
    shifts: {
      mon: idx % 2 === 0 ? 'morning' : 'afternoon',
      tue: idx % 3 === 0 ? 'morning' : 'afternoon',
      wed: 'morning',
      thu: idx % 2 === 1 ? 'afternoon' : 'morning',
      fri: 'morning',
      sat: idx % 2 === 0 ? 'morning' : 'off',
      sun: idx % 3 === 0 ? 'afternoon' : 'off',
    }
  }));
};

const initialSwapRequests: ShiftSwapItem[] = [
  { id: 'SWP-2569-01', requesterName: 'นพ. อานนท์ ศรีตรวจ', requesterShift: 'เวรเช้า (08:00 - 16:00)', receiverName: 'พญ. วิภาดา รักดี', receiverShift: 'เวรบ่าย (16:00 - 00:00)', date: '15 ก.ย. 2569', reason: 'ติดประชุมวิชาการแพทย์', status: 'pending' },
  { id: 'SWP-2569-02', requesterName: 'นพ. สมชาย ใจเย็น', requesterShift: 'เวรบ่าย (16:00 - 00:00)', receiverName: 'นพ. นิธิ เจริญยิ่ง', receiverShift: 'เวรเช้า (08:00 - 16:00)', date: '18 ก.ย. 2569', reason: 'ติดภารกิจครอบครัวต่างจังหวัด', status: 'pending' },
  { id: 'SWP-2569-03', requesterName: 'พญ. พิมผกา มีชัย', requesterShift: 'เวรเช้า (08:00 - 16:00)', receiverName: 'ทพญ. สุดา ตั้งมั่น', receiverShift: 'วันหยุด (Off)', date: '22 ก.ย. 2569', reason: 'ขอสลับวันหยุดประจำสัปดาห์', status: 'pending' },
];

export const ScheduleManagementPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'calendar' | 'weekly' | 'employees'>('calendar');
  const [schedules, setSchedules] = useState<ShiftSchedule[]>(generateMockSchedules());
  const [swapRequests, setSwapRequests] = useState<ShiftSwapItem[]>(initialSwapRequests);
  
  const [viewMode, setViewMode] = useState<'monthly' | 'weekly' | 'daily'>('monthly');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());

  // Edit / Details state
  const [editingSchedule, setEditingSchedule] = useState<ShiftSchedule | null>(null);
  const [calendarOverrides, setCalendarOverrides] = useState<Record<string, Record<string, 'morning' | 'afternoon' | 'night' | 'off'>>>({});
  const [editingCalendarDate, setEditingCalendarDate] = useState<string | null>(null);
  const [tempDayShifts, setTempDayShifts] = useState<Record<string, 'morning' | 'afternoon' | 'night' | 'off'>>({});
  
  // Filter state
  const [filterDoctorId, setFilterDoctorId] = useState<string>('all');
  
  // Modals
  const [activeModal, setActiveModal] = useState<'swapRequests' | 'attendance' | 'filter' | 'addBatchSchedule' | null>(null);

  // Batch Creation Form State (Use Case U2)
  const [batchForm, setBatchForm] = useState({
    doctorId: 'EMP-101',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
    weekdays: [1, 2, 3, 4, 5], // 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 0=Sun
    shiftType: 'morning' as 'morning' | 'afternoon' | 'night',
  });
  const [previewDates, setPreviewDates] = useState<string[]>([]);
  const [hasPreviewed, setHasPreviewed] = useState(false);

  // Fetch real doctors from backend if available
  React.useEffect(() => {
    fetch('http://localhost:8080/api/doctors')
      .then(res => res.ok ? res.json() : null)
      .then((data: Array<{ id: number; username: string; full_name?: string; FullName?: string; phone?: string; Phone?: string }> | null) => {
        if (data && Array.isArray(data) && data.length > 0) {
          const mapped: ShiftSchedule[] = data.map((doc, idx) => {
            const name = doc.full_name || doc.FullName || doc.username;
            const initials = name.replace(/^(นพ\.|พญ\.|ทพญ\.|ทพ\.|ดร\.)\s*/, '').slice(0, 2).toUpperCase();
            return {
              id: `DOC-${doc.id}`,
              doctorCode: `DOC-${String(doc.id).padStart(4, '0')}`,
              name: name,
              department: idx % 3 === 0 ? 'อายุรกรรมทั่วไป' : idx % 3 === 1 ? 'สูตินรีเวช' : 'กุมารเวชกรรม',
              avatarText: initials || 'DR',
              specialty: idx % 3 === 0 ? 'โรคหัวใจและหลอดเลือด' : idx % 3 === 1 ? 'เวชศาสตร์มารดาและทารก' : 'กุมารเวชศาสตร์โรคภูมิแพ้',
              phone: doc.phone || doc.Phone || '081-222-0000',
              email: `${doc.username}@clinic.local`,
              shifts: {
                mon: idx % 2 === 0 ? 'morning' : 'afternoon',
                tue: idx % 3 === 0 ? 'morning' : 'afternoon',
                wed: 'morning',
                thu: idx % 2 === 1 ? 'afternoon' : 'morning',
                fri: 'morning',
                sat: idx % 2 === 0 ? 'morning' : 'off',
                sun: idx % 3 === 0 ? 'afternoon' : 'off',
              }
            };
          });
          setSchedules(mapped);
          if (mapped.length > 0) {
            setBatchForm(prev => ({ ...prev, doctorId: mapped[0].id }));
          }
        }
      })
      .catch(() => {
        // Fallback to mock data if backend not connected yet
      });
  }, []);

  const thaiMonths = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const buddhistYear = currentDate.getFullYear() + 543;

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const renderShiftBadge = (shift: 'morning' | 'afternoon' | 'night' | 'off') => {
    switch (shift) {
      case 'morning':
        return <span className="shift-badge morning">เวรเช้า (08:00 - 16:00)</span>;
      case 'afternoon':
        return <span className="shift-badge afternoon">เวรบ่าย (16:00 - 00:00)</span>;
      case 'night':
        return <span className="shift-badge night">เวรดึก (00:00 - 08:00)</span>;
      case 'off':
        return <span className="shift-badge off">วันหยุด</span>;
      default:
        return null;
    }
  };

  // Batch Form Handlers (Use Case U2)
  const toggleWeekday = (dayNum: number) => {
    setBatchForm(prev => {
      const exists = prev.weekdays.includes(dayNum);
      const newDays = exists ? prev.weekdays.filter(d => d !== dayNum) : [...prev.weekdays, dayNum];
      return { ...prev, weekdays: newDays };
    });
    setHasPreviewed(false);
  };

  const handleSelectAllWeekdays = () => {
    setBatchForm(prev => ({ ...prev, weekdays: [1, 2, 3, 4, 5, 6, 0] }));
    setHasPreviewed(false);
  };

  const handleSelectBusinessDays = () => {
    setBatchForm(prev => ({ ...prev, weekdays: [1, 2, 3, 4, 5] }));
    setHasPreviewed(false);
  };

  const handlePreviewBatch = () => {
    if (!batchForm.startDate || !batchForm.endDate) {
      toast.error('กรุณาระบุวันที่เริ่มต้นและวันที่สิ้นสุด');
      return;
    }

    const start = new Date(batchForm.startDate);
    const end = new Date(batchForm.endDate);

    if (start > end) {
      toast.error('วันที่เริ่มต้นต้องไม่มากกว่าวันที่สิ้นสุด');
      return;
    }

    if (batchForm.weekdays.length === 0) {
      toast.error('กรุณาเลือกวันทำงานในสัปดาห์อย่างน้อย 1 วัน');
      return;
    }

    const matchedDates: string[] = [];
    const current = new Date(start);

    while (current <= end) {
      if (batchForm.weekdays.includes(current.getDay())) {
        matchedDates.push(current.toISOString().split('T')[0]);
      }
      current.setDate(current.getDate() + 1);
    }

    if (matchedDates.length === 0) {
      toast.error('ไม่พบวันที่ตรงกับเงื่อนไขในสัปดาห์ที่เลือก');
      return;
    }

    setPreviewDates(matchedDates);
    setHasPreviewed(true);
    toast.success(`ตรวจสอบสำเร็จ พบ ${matchedDates.length} วันที่พร้อมสร้างตาราง`);
  };

  const handleConfirmBatch = () => {
    if (!hasPreviewed || previewDates.length === 0) {
      toast.error('กรุณากดตรวจสอบและดูตัวอย่างก่อนบันทึก');
      return;
    }

    // Apply to calendar overrides
    setCalendarOverrides(prev => {
      const updated = { ...prev };
      previewDates.forEach(dateStr => {
        if (!updated[dateStr]) updated[dateStr] = {};
        updated[dateStr][batchForm.doctorId] = batchForm.shiftType;
      });
      return updated;
    });

    toast.success(`สร้างตารางงานสำเร็จจำนวน ${previewDates.length} วัน`);
    setActiveModal(null);
    setHasPreviewed(false);
    setPreviewDates([]);
  };

  const handleApproveSwap = (id: string) => {
    setSwapRequests(prev => prev.map(req => req.id === id ? { ...req, status: 'approved' } : req));
    toast.success('อนุมัติคำขอแลกเวรเรียบร้อยแล้ว');
  };

  const handleRejectSwap = (id: string) => {
    setSwapRequests(prev => prev.map(req => req.id === id ? { ...req, status: 'rejected' } : req));
    toast.error('ปฏิเสธคำขอแลกเวรแล้ว');
  };

  const handleOpenDayEdit = (dateStr: string) => {
    setEditingCalendarDate(dateStr);
    const existing = calendarOverrides[dateStr] || {};
    const initial: Record<string, 'morning' | 'afternoon' | 'night' | 'off'> = {};
    schedules.forEach(s => {
      initial[s.id] = existing[s.id] || 'morning';
    });
    setTempDayShifts(initial);
  };

  const handleSaveDayEdit = () => {
    if (editingCalendarDate) {
      setCalendarOverrides(prev => ({
        ...prev,
        [editingCalendarDate]: tempDayShifts
      }));
      toast.success('บันทึกการปรับเปลี่ยนเวรประจำวันเรียบร้อยแล้ว');
      setEditingCalendarDate(null);
    }
  };

  // Calendar Day Generation
  const generateCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    const totalDaysInPrevMonth = new Date(year, month, 0).getDate();

    const days = [];

    // Prev month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      days.push({
        dayNumber: totalDaysInPrevMonth - i,
        isCurrentMonth: false,
        dateStr: `${year}-${String(month).padStart(2, '0')}-${String(totalDaysInPrevMonth - i).padStart(2, '0')}`
      });
    }

    // Current month days
    for (let i = 1; i <= totalDaysInMonth; i++) {
      days.push({
        dayNumber: i,
        isCurrentMonth: true,
        dateStr: `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
      });
    }

    // Next month padding to fill 35 or 42 grid cells
    const remainingCells = 35 - days.length >= 0 ? 35 - days.length : 42 - days.length;
    for (let i = 1; i <= remainingCells; i++) {
      days.push({
        dayNumber: i,
        isCurrentMonth: false,
        dateStr: `${year}-${String(month + 2).padStart(2, '0')}-${String(i).padStart(2, '0')}`
      });
    }

    return days;
  };

  const filteredDoctors = filterDoctorId === 'all' 
    ? schedules 
    : schedules.filter(s => s.id === filterDoctorId);

  return (
    <div className="schedule-container">
      {/* 1. Page Header */}
      <div className="page-header-container">
        <div className="page-title-group">
          <div className="page-icon-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" width="24" height="24">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <div>
            <h1 className="page-main-title">จัดการตารางงานแพทย์ (Doctor Schedule Management)</h1>
            <p className="page-sub-title">จัดสรรตารางเวร ประจำวัน/สัปดาห์ และพิจารณาคำขอแลกเวรของแพทย์</p>
          </div>
        </div>

        <div className="page-header-actions">
          <button className="dms-btn-secondary" onClick={() => setActiveModal('swapRequests')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
              <polyline points="17 1 21 5 17 9"/>
              <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
              <polyline points="7 23 3 19 7 15"/>
              <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
            </svg>
            <span>คำขอแลกเวร ({swapRequests.filter(r => r.status === 'pending').length})</span>
          </button>
          <button className="dms-btn-primary" onClick={() => { setActiveModal('addBatchSchedule'); setHasPreviewed(false); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            <span>สร้างตารางงานใหม่ (Batch)</span>
          </button>
        </div>
      </div>

      {/* 2. Top Summary KPI Cards */}
      <div className="dms-metrics-grid">
        <div className="dms-card metric-card">
          <div className="metric-icon-wrapper blue-bg">
            <svg viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" width="24" height="24">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div className="metric-info">
            <span className="metric-label">จำนวนแพทย์ในระบบ</span>
            <span className="metric-value">{schedules.length} ท่าน</span>
            <span className="metric-subtext blue-text">ครอบคลุมทุกแผนก</span>
          </div>
        </div>

        <div className="dms-card metric-card interactive" onClick={() => setActiveModal('swapRequests')}>
          <div className="metric-icon-wrapper red-bg">
            <svg viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" width="24" height="24">
              <polyline points="17 1 21 5 17 9"/>
              <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
              <polyline points="7 23 3 19 7 15"/>
              <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
            </svg>
          </div>
          <div className="metric-info">
            <span className="metric-label">คำขอแลกเวรรออนุมัติ</span>
            <span className="metric-value">{swapRequests.filter(r => r.status === 'pending').length} รายการ</span>
            <span className="metric-subtext red-text">คลิกเพื่อพิจารณา</span>
          </div>
        </div>

        <div className="dms-card metric-card interactive" onClick={() => setActiveModal('attendance')}>
          <div className="metric-icon-wrapper green-bg">
            <svg viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" width="24" height="24">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 14 14"/>
            </svg>
          </div>
          <div className="metric-info">
            <span className="metric-label">อัตราการเข้าเวรตรงเวลา</span>
            <span className="metric-value">98.5%</span>
            <span className="metric-subtext green-text">มาตรฐานดีเยี่ยม</span>
          </div>
        </div>
      </div>

      {/* 3. Main Schedule Card */}
      <div className="dms-card schedule-main-card">
        {/* Navigation & Controls Bar */}
        <div className="schedule-toolbar">
          <div className="schedule-tab-group">
            <button
              type="button"
              className={`schedule-tab-btn ${activeTab === 'calendar' ? 'active' : ''}`}
              onClick={() => setActiveTab('calendar')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <span>ปฏิทินรวม (Calendar)</span>
            </button>
            <button
              type="button"
              className={`schedule-tab-btn ${activeTab === 'weekly' ? 'active' : ''}`}
              onClick={() => setActiveTab('weekly')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <line x1="8" y1="6" x2="21" y2="6"/>
                <line x1="8" y1="12" x2="21" y2="12"/>
                <line x1="8" y1="18" x2="21" y2="18"/>
                <line x1="3" y1="6" x2="3.01" y2="6"/>
                <line x1="3" y1="12" x2="3.01" y2="12"/>
                <line x1="3" y1="18" x2="3.01" y2="18"/>
              </svg>
              <span>ตารางรายสัปดาห์ (Weekly)</span>
            </button>
            <button
              type="button"
              className={`schedule-tab-btn ${activeTab === 'employees' ? 'active' : ''}`}
              onClick={() => setActiveTab('employees')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              <span>รายชื่อแพทย์ ({schedules.length})</span>
            </button>
          </div>

          <div className="schedule-filter-controls">
            <div className="doctor-select-wrapper">
              <label className="filter-label-inline">กรองแพทย์:</label>
              <select
                className="schedule-select-input"
                value={filterDoctorId}
                onChange={e => setFilterDoctorId(e.target.value)}
              >
                <option value="all">แพทย์ทุกคน (ทั้งหมด)</option>
                {schedules.map(doc => (
                  <option key={doc.id} value={doc.id}>{doc.name} ({doc.department})</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 4. Tab 1: Calendar View */}
        {activeTab === 'calendar' && (
          <div className="calendar-view-container">
            {/* Calendar Header with Month Navigation */}
            <div className="calendar-month-header">
              <div className="month-display-group">
                <h2 className="current-month-text">
                  {thaiMonths[currentDate.getMonth()]} พ.ศ. {buddhistYear}
                </h2>
                <span className="current-month-en">
                  {currentDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
                </span>
              </div>

              <div className="calendar-nav-buttons">
                <button type="button" className="cal-btn today-btn" onClick={handleToday}>
                  วันนี้
                </button>
                <button type="button" className="cal-btn icon-btn" onClick={handlePrevMonth} aria-label="Previous Month">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                    <polyline points="15 18 9 12 15 6"/>
                  </svg>
                </button>
                <button type="button" className="cal-btn icon-btn" onClick={handleNextMonth} aria-label="Next Month">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="calendar-grid">
              {/* Day Name Headers */}
              {['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'].map((dayName, idx) => (
                <div key={dayName} className={`calendar-day-header ${idx === 0 || idx === 6 ? 'weekend' : ''}`}>
                  {dayName}
                </div>
              ))}

              {/* Day Cells */}
              {generateCalendarDays().map((cell, idx) => {
                const dayOverrides = calendarOverrides[cell.dateStr] || {};
                const isToday = cell.isCurrentMonth && 
                  cell.dayNumber === new Date().getDate() && 
                  currentDate.getMonth() === new Date().getMonth() &&
                  currentDate.getFullYear() === new Date().getFullYear();

                return (
                  <div
                    key={idx}
                    className={`calendar-day-cell ${!cell.isCurrentMonth ? 'other-month' : ''} ${isToday ? 'is-today' : ''}`}
                    onClick={() => cell.isCurrentMonth && handleOpenDayEdit(cell.dateStr)}
                  >
                    <div className="cell-top-bar">
                      <span className={`cell-day-num ${isToday ? 'today-badge' : ''}`}>{cell.dayNumber}</span>
                      {cell.isCurrentMonth && (
                        <button className="cell-edit-btn" title="แก้ไขเวรวันนี้" onClick={(e) => { e.stopPropagation(); handleOpenDayEdit(cell.dateStr); }}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
                            <path d="M12 20h9"/>
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                          </svg>
                        </button>
                      )}
                    </div>

                    {cell.isCurrentMonth && (
                      <div className="cell-shifts-list">
                        {filteredDoctors.slice(0, 3).map(doc => {
                          const shift = dayOverrides[doc.id] || (idx % 3 === 0 ? 'morning' : (idx % 2 === 0 ? 'afternoon' : 'off'));
                          if (shift === 'off') return null;
                          return (
                            <div key={doc.id} className={`cell-doctor-pill ${shift}`}>
                              <span className="pill-dot"></span>
                              <span className="pill-doc-name">{doc.name.replace('นพ. ', '').replace('พญ. ', '').replace('ทพญ. ', '')}</span>
                              <span className="pill-shift-tag">{shift === 'morning' ? 'เช้า' : (shift === 'afternoon' ? 'บ่าย' : 'ดึก')}</span>
                            </div>
                          );
                        })}
                        {filteredDoctors.length > 3 && (
                          <div className="cell-more-badge">+{filteredDoctors.length - 3} ท่าน</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 5. Tab 2: Weekly View */}
        {activeTab === 'weekly' && (
          <div className="weekly-view-container">
            <div className="table-responsive">
              <table className="dms-master-table weekly-table">
                <thead>
                  <tr>
                    <th>แพทย์ผู้ตรวจ</th>
                    <th>แผนก</th>
                    <th style={{ textAlign: 'center' }}>จันทร์</th>
                    <th style={{ textAlign: 'center' }}>อังคาร</th>
                    <th style={{ textAlign: 'center' }}>พุธ</th>
                    <th style={{ textAlign: 'center' }}>พฤหัสฯ</th>
                    <th style={{ textAlign: 'center' }}>ศุกร์</th>
                    <th style={{ textAlign: 'center' }}>เสาร์</th>
                    <th style={{ textAlign: 'center' }}>อาทิตย์</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDoctors.map(doc => (
                    <tr key={doc.id}>
                      <td>
                        <div className="doc-avatar-cell">
                          <div className="doc-avatar-circle">{doc.avatarText}</div>
                          <div>
                            <span className="doc-name-text">{doc.name}</span>
                            <span className="doc-specialty-sub">{doc.doctorCode}</span>
                          </div>
                        </div>
                      </td>
                      <td><span className="doc-type-tag">{doc.department}</span></td>
                      <td style={{ textAlign: 'center' }}>{renderShiftBadge(doc.shifts.mon)}</td>
                      <td style={{ textAlign: 'center' }}>{renderShiftBadge(doc.shifts.tue)}</td>
                      <td style={{ textAlign: 'center' }}>{renderShiftBadge(doc.shifts.wed)}</td>
                      <td style={{ textAlign: 'center' }}>{renderShiftBadge(doc.shifts.thu)}</td>
                      <td style={{ textAlign: 'center' }}>{renderShiftBadge(doc.shifts.fri)}</td>
                      <td style={{ textAlign: 'center' }}>{renderShiftBadge(doc.shifts.sat)}</td>
                      <td style={{ textAlign: 'center' }}>{renderShiftBadge(doc.shifts.sun)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 6. Tab 3: Employees / Doctor List */}
        {activeTab === 'employees' && (
          <div className="employees-view-container">
            <div className="table-responsive">
              <table className="dms-master-table">
                <thead>
                  <tr>
                    <th>รหัสแพทย์</th>
                    <th>ชื่อ-นามสกุล</th>
                    <th>แผนก / ความเชี่ยวชาญ</th>
                    <th>เบอร์โทรศัพท์</th>
                    <th>อีเมล</th>
                    <th>สถานะการปฏิบัติงาน</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDoctors.map(doc => (
                    <tr key={doc.id}>
                      <td className="doc-code-text">{doc.doctorCode}</td>
                      <td>
                        <div className="doc-avatar-cell">
                          <div className="doc-avatar-circle">{doc.avatarText}</div>
                          <span className="doc-name-text">{doc.name}</span>
                        </div>
                      </td>
                      <td>
                        <div className="doc-dept-wrapper">
                          <span className="font-bold text-primary">{doc.department}</span>
                          <span className="text-secondary text-sm">{doc.specialty}</span>
                        </div>
                      </td>
                      <td>{doc.phone}</td>
                      <td>{doc.email}</td>
                      <td>
                        <span className="status-pill approved">
                          <span className="status-dot"></span>
                          พร้อมปฏิบัติงาน
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 7. Batch Schedule Creation Modal (Use Case U2 Compliance) */}
      {activeModal === 'addBatchSchedule' && (
        <div className="dms-modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="dms-modal-card dms-modal-wide" onClick={e => e.stopPropagation()}>
            <div className="dms-modal-header">
              <div className="dms-modal-title-group">
                <div className="dms-modal-icon-badge">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                </div>
                <div>
                  <h3 className="dms-modal-title">สร้างตารางงานแพทย์เป็นชุด (Batch Schedule Creation)</h3>
                  <p className="dms-modal-subtitle">กำหนดช่วงเวลา วันทำงาน และกะเวรสำหรับแพทย์</p>
                </div>
              </div>
              <button className="dms-close-btn" onClick={() => setActiveModal(null)} aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <div className="dms-modal-body">
              {/* Step 1: Select Doctor */}
              <div className="batch-step-section">
                <div className="form-section-header">
                  <span className="section-step-num">1</span>
                  <span className="section-step-title">เลือกแพทย์ผู้ตรวจ (Select Doctor)</span>
                  <span className="text-required">*</span>
                </div>
                <select
                  className="dms-form-input"
                  value={batchForm.doctorId}
                  onChange={e => { setBatchForm({ ...batchForm, doctorId: e.target.value }); setHasPreviewed(false); }}
                >
                  {schedules.map(doc => (
                    <option key={doc.id} value={doc.id}>
                      {doc.name} — {doc.department} ({doc.doctorCode})
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 2: Date Range */}
              <div className="batch-step-section">
                <div className="form-section-header">
                  <span className="section-step-num">2</span>
                  <span className="section-step-title">กำหนดช่วงวันที่ (Date Range)</span>
                  <span className="text-required">*</span>
                </div>
                <div className="date-range-grid">
                  <div className="dms-form-group">
                    <label className="dms-form-label">วันที่เริ่มต้น (Start Date)</label>
                    <input
                      type="date"
                      className="dms-form-input"
                      value={batchForm.startDate}
                      onChange={e => { setBatchForm({ ...batchForm, startDate: e.target.value }); setHasPreviewed(false); }}
                    />
                  </div>
                  <div className="dms-form-group">
                    <label className="dms-form-label">วันที่สิ้นสุด (End Date)</label>
                    <input
                      type="date"
                      className="dms-form-input"
                      value={batchForm.endDate}
                      onChange={e => { setBatchForm({ ...batchForm, endDate: e.target.value }); setHasPreviewed(false); }}
                    />
                  </div>
                </div>
              </div>

              {/* Step 3: Weekday Selection */}
              <div className="batch-step-section">
                <div className="form-section-header">
                  <span className="section-step-num">3</span>
                  <span className="section-step-title">เลือกวันทำงานในสัปดาห์ (Working Weekdays)</span>
                  <span className="text-required">*</span>
                </div>
                <div className="weekday-quick-actions">
                  <button type="button" className="quick-select-btn" onClick={handleSelectAllWeekdays}>เลือกทุกวัน (จันทร์-อาทิตย์)</button>
                  <button type="button" className="quick-select-btn" onClick={handleSelectBusinessDays}>เฉพาะวันธรรมดา (จันทร์-ศุกร์)</button>
                </div>
                <div className="weekday-checkboxes-grid">
                  {[
                    { id: 1, name: 'วันจันทร์' },
                    { id: 2, name: 'วันอังคาร' },
                    { id: 3, name: 'วันพุธ' },
                    { id: 4, name: 'วันพฤหัสบดี' },
                    { id: 5, name: 'วันศุกร์' },
                    { id: 6, name: 'วันเสาร์' },
                    { id: 0, name: 'วันอาทิตย์' },
                  ].map(day => (
                    <label key={day.id} className={`weekday-checkbox-card ${batchForm.weekdays.includes(day.id) ? 'checked' : ''}`}>
                      <input
                        type="checkbox"
                        checked={batchForm.weekdays.includes(day.id)}
                        onChange={() => toggleWeekday(day.id)}
                      />
                      <span className="weekday-name-text">{day.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Step 4: Shift Selection */}
              <div className="batch-step-section">
                <div className="form-section-header">
                  <span className="section-step-num">4</span>
                  <span className="section-step-title">เลือกกะเวรการทำงาน (Shift Type)</span>
                  <span className="text-required">*</span>
                </div>
                <div className="shift-options-grid">
                  <label className={`shift-option-card ${batchForm.shiftType === 'morning' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="shiftType"
                      value="morning"
                      checked={batchForm.shiftType === 'morning'}
                      onChange={() => { setBatchForm({ ...batchForm, shiftType: 'morning' }); setHasPreviewed(false); }}
                    />
                    <div className="shift-option-info">
                      <span className="shift-title morning-text">เวรเช้า (Morning Shift)</span>
                      <span className="shift-time">08:00 - 16:00 น.</span>
                    </div>
                  </label>

                  <label className={`shift-option-card ${batchForm.shiftType === 'afternoon' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="shiftType"
                      value="afternoon"
                      checked={batchForm.shiftType === 'afternoon'}
                      onChange={() => { setBatchForm({ ...batchForm, shiftType: 'afternoon' }); setHasPreviewed(false); }}
                    />
                    <div className="shift-option-info">
                      <span className="shift-title afternoon-text">เวรบ่าย (Afternoon Shift)</span>
                      <span className="shift-time">16:00 - 00:00 น.</span>
                    </div>
                  </label>

                  <label className={`shift-option-card ${batchForm.shiftType === 'night' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="shiftType"
                      value="night"
                      checked={batchForm.shiftType === 'night'}
                      onChange={() => { setBatchForm({ ...batchForm, shiftType: 'night' }); setHasPreviewed(false); }}
                    />
                    <div className="shift-option-info">
                      <span className="shift-title night-text">เวรดึก (Night Shift)</span>
                      <span className="shift-time">00:00 - 08:00 น.</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Step 5: Preview Box */}
              {hasPreviewed && (
                <div className="batch-preview-result-box">
                  <div className="preview-header">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" width="20" height="20">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                      <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                    <span className="preview-title">ตัวอย่างรายการเวรที่จะถูกสร้าง ({previewDates.length} วัน)</span>
                  </div>
                  <div className="preview-dates-tags">
                    {previewDates.map(dateStr => (
                      <span key={dateStr} className="preview-date-tag">
                        {dateStr} ({batchForm.shiftType === 'morning' ? 'เช้า' : (batchForm.shiftType === 'afternoon' ? 'บ่าย' : 'ดึก')})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="dms-modal-footer">
              <button type="button" className="dms-btn-secondary" onClick={() => setActiveModal(null)}>
                ยกเลิก
              </button>
              <button type="button" className="dms-btn-secondary preview-action-btn" onClick={handlePreviewBatch}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                ตรวจสอบและดูตัวอย่าง
              </button>
              <button
                type="button"
                className="dms-btn-primary"
                onClick={handleConfirmBatch}
                disabled={!hasPreviewed || previewDates.length === 0}
                style={(!hasPreviewed || previewDates.length === 0) ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
              >
                ยืนยันการบันทึกตารางงาน
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Shift Swap Requests Modal */}
      {activeModal === 'swapRequests' && (
        <div className="dms-modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="dms-modal-card dms-modal-wide" onClick={e => e.stopPropagation()}>
            <div className="dms-modal-header">
              <div className="dms-modal-title-group">
                <div className="dms-modal-icon-badge">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2">
                    <polyline points="17 1 21 5 17 9"/>
                    <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                    <polyline points="7 23 3 19 7 15"/>
                    <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                  </svg>
                </div>
                <div>
                  <h3 className="dms-modal-title">คำขอสลับเวรแพทย์ (Shift Swap Requests)</h3>
                  <p className="dms-modal-subtitle">รายการคำขอแลกเวรรอการพิจารณาอนุมัติ</p>
                </div>
              </div>
              <button className="dms-close-btn" onClick={() => setActiveModal(null)} aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div className="dms-modal-body dms-modal-scrollable">
              <div className="swap-requests-list">
                {swapRequests.map(req => (
                  <div key={req.id} className="swap-request-card">
                    <div className="swap-card-header">
                      <span className="swap-req-code">{req.id}</span>
                      <span className="swap-req-date">{req.date}</span>
                    </div>
                    <div className="swap-parties-grid">
                      <div className="swap-party requester">
                        <span className="party-role">ผู้ขอแลก:</span>
                        <span className="party-name">{req.requesterName}</span>
                        <span className="party-shift">{req.requesterShift}</span>
                      </div>
                      <div className="swap-arrow-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" width="22" height="22">
                          <polyline points="17 1 21 5 17 9"/>
                          <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                          <polyline points="7 23 3 19 7 15"/>
                          <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                        </svg>
                      </div>
                      <div className="swap-party receiver">
                        <span className="party-role">ผู้รับแลก:</span>
                        <span className="party-name">{req.receiverName}</span>
                        <span className="party-shift">{req.receiverShift}</span>
                      </div>
                    </div>
                    <div className="swap-reason-box">
                      <span className="reason-label">เหตุผล:</span>
                      <span className="reason-text">{req.reason}</span>
                    </div>
                    <div className="swap-card-actions">
                      {req.status === 'pending' ? (
                        <>
                          <button className="dms-btn-primary swap-approve-btn" onClick={() => handleApproveSwap(req.id)}>
                            อนุมัติคำขอ
                          </button>
                          <button className="dms-btn-secondary swap-reject-btn" onClick={() => handleRejectSwap(req.id)}>
                            ปฏิเสธ
                          </button>
                        </>
                      ) : (
                        <span className={`status-pill ${req.status === 'approved' ? 'approved' : 'draft'}`}>
                          <span className="status-dot"></span>
                          {req.status === 'approved' ? 'อนุมัติแล้ว' : 'ปฏิเสธแล้ว'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="dms-modal-footer">
              <button className="dms-btn-primary" onClick={() => setActiveModal(null)}>
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. Attendance Rate Modal */}
      {activeModal === 'attendance' && (
        <div className="dms-modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="dms-modal-card" onClick={e => e.stopPropagation()}>
            <div className="dms-modal-header">
              <div className="dms-modal-title-group">
                <div className="dms-modal-icon-badge">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 14 14"/>
                  </svg>
                </div>
                <div>
                  <h3 className="dms-modal-title">สถิติการเข้าเวรแพทย์</h3>
                  <p className="dms-modal-subtitle">ข้อมูลย้อนหลัง 30 วัน</p>
                </div>
              </div>
              <button className="dms-close-btn" onClick={() => setActiveModal(null)} aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div className="dms-modal-body" style={{ textAlign: 'center', padding: '28px 24px' }}>
              <div style={{ fontSize: '48px', fontWeight: '800', color: '#10B981', marginBottom: '8px' }}>98.5%</div>
              <p style={{ fontSize: '15px', color: '#475569', marginBottom: '16px' }}>แพทย์เข้าเวรตรงเวลาและครบถ้วนตามเกณฑ์มาตรฐานคลินิก</p>
              <div className="storage-progress-bar">
                <div className="storage-progress-fill" style={{ width: '98.5%', background: '#10B981' }}></div>
              </div>
            </div>
            <div className="dms-modal-footer">
              <button className="dms-btn-primary" onClick={() => setActiveModal(null)}>
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 10. Edit Single Day Modal */}
      {editingCalendarDate && (
        <div className="dms-modal-backdrop" onClick={() => setEditingCalendarDate(null)}>
          <div className="dms-modal-card dms-modal-wide" onClick={e => e.stopPropagation()}>
            <div className="dms-modal-header">
              <div className="dms-modal-title-group">
                <div className="dms-modal-icon-badge">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                </div>
                <div>
                  <h3 className="dms-modal-title">ปรับเปลี่ยนเวรประจำวัน ({editingCalendarDate})</h3>
                  <p className="dms-modal-subtitle">กำหนดกะเวรรายบุคคลในวันที่เลือก</p>
                </div>
              </div>
              <button className="dms-close-btn" onClick={() => setEditingCalendarDate(null)} aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div className="dms-modal-body dms-modal-scrollable">
              <div className="table-responsive">
                <table className="dms-master-table">
                  <thead>
                    <tr>
                      <th>แพทย์ผู้ตรวจ</th>
                      <th>แผนก</th>
                      <th>กะเวรประจำวัน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedules.map(doc => (
                      <tr key={doc.id}>
                        <td>
                          <div className="doc-avatar-cell">
                            <div className="doc-avatar-circle">{doc.avatarText}</div>
                            <span className="doc-name-text">{doc.name}</span>
                          </div>
                        </td>
                        <td><span className="doc-type-tag">{doc.department}</span></td>
                        <td>
                          <select
                            className="dms-form-input"
                            style={{ height: '40px' }}
                            value={tempDayShifts[doc.id] || 'morning'}
                            onChange={e => setTempDayShifts({ ...tempDayShifts, [doc.id]: e.target.value as any })}
                          >
                            <option value="morning">เวรเช้า (08:00 - 16:00)</option>
                            <option value="afternoon">เวรบ่าย (16:00 - 00:00)</option>
                            <option value="night">เวรดึก (00:00 - 08:00)</option>
                            <option value="off">วันหยุด (Off)</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="dms-modal-footer">
              <button type="button" className="dms-btn-secondary" onClick={() => setEditingCalendarDate(null)}>
                ยกเลิก
              </button>
              <button type="button" className="dms-btn-primary" onClick={handleSaveDayEdit}>
                บันทึกการเปลี่ยนแปลง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
