import React, { useState, useMemo, useEffect } from 'react';
import { StatusFilterTabs } from './StatusFilterTabs';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import {
  SYSTEM_DOCTORS,
  type DoctorProfile,
  type DoctorShift,
  getStoredDoctorShifts,
  saveStoredDoctorShifts,
  findDoctorProfile,
} from '../../../services/scheduleStorage';
import {
  Calendar as CalendarIcon,
  Clock,
  User,
  Plus,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Search,
  Building,
  Stethoscope,
  CalendarDays,
  CalendarRange,
  ListFilter,
  Check,
  X,
  Users,
  ShieldAlert,
  Sparkles,
  Lock,
  UserCheck,
  Eye,
  ShieldCheck
} from 'lucide-react';

export type { DoctorShift };

const SHIFT_TYPES = [
  'General Consultation',
  'Minor Procedure',
  'Health Check-up',
  'After-hours',
  'Academic / Meeting',
  'Leave / Off'
] as const;

export const ScheduleView: React.FC = () => {
  const { language, t } = useLanguage();
  const { currentUser } = useAuth();

  // 1. Identify currently authenticated doctor from AuthContext
  const loggedInDoctor = useMemo<DoctorProfile>(() => {
    if (currentUser) {
      if (currentUser.username === 'doctor2' || currentUser.fullName?.includes('วิชัย')) {
        return SYSTEM_DOCTORS[1]; // นพ.วิชัย
      } else if (currentUser.username === 'doctor3' || currentUser.fullName?.includes('เกศรา')) {
        return SYSTEM_DOCTORS[2]; // พญ.เกศรา
      } else if (currentUser.username === 'doctor1' || currentUser.fullName?.includes('สุดา')) {
        return SYSTEM_DOCTORS[0]; // พญ.สุดา
      }
      return findDoctorProfile(currentUser.fullName || currentUser.username);
    }
    return SYSTEM_DOCTORS[0];
  }, [currentUser]);

  const allDoctorNames = useMemo(() => SYSTEM_DOCTORS.map(d => d.name), []);

  // 2. Load and synchronize shifts from scheduleStorage
  const [shifts, setShifts] = useState<DoctorShift[]>(() => getStoredDoctorShifts());

  useEffect(() => {
    const handleSync = () => {
      setShifts(getStoredDoctorShifts());
    };
    window.addEventListener('clinic_schedule_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('clinic_schedule_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  // Filters
  const [selectedDoctorFilter, setSelectedDoctorFilter] = useState<string>('All');
  const [filterShiftType, setFilterShiftType] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'list'>('month');
  const [searchQuery, setSearchQuery] = useState('');

  // Month & Date Navigation State (Current dynamic date)
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<DoctorShift | null>(null);
  const [readOnlyShiftModal, setReadOnlyShiftModal] = useState<DoctorShift | null>(null);

  // Form Fields State (Doctor is locked to loggedInDoctor.name)
  const [formDepartment, setFormDepartment] = useState(loggedInDoctor.department);
  const [formDate, setFormDate] = useState(todayStr);
  const [formStartTime, setFormStartTime] = useState('08:00');
  const [formEndTime, setFormEndTime] = useState('16:00');
  const [formShiftType, setFormShiftType] = useState<DoctorShift['shiftType']>('General Consultation');
  const [formRoomLocation, setFormRoomLocation] = useState(loggedInDoctor.roomLocation);
  const [formMaxPatients, setFormMaxPatients] = useState(20);
  const [formStatus, setFormStatus] = useState<DoctorShift['status']>('Scheduled');
  const [formNote, setFormNote] = useState('');

  // Update form defaults when loggedInDoctor changes
  useEffect(() => {
    setFormDepartment(loggedInDoctor.department);
    setFormRoomLocation(loggedInDoctor.roomLocation);
  }, [loggedInDoctor]);

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Helper check: Is this shift owned by logged-in doctor?
  const isShiftOwner = (shift: DoctorShift) => {
    return (
      shift.doctorName === loggedInDoctor.name ||
      shift.doctorUsername === loggedInDoctor.username ||
      shift.doctorId === loggedInDoctor.id
    );
  };

  // Filtered shifts according to selection
  const filteredShifts = useMemo(() => {
    return shifts.filter((s) => {
      const matchDoctor = selectedDoctorFilter === 'All' || s.doctorName === selectedDoctorFilter;
      const matchType = filterShiftType === 'All' || s.shiftType === filterShiftType;
      const matchSearch =
        searchQuery.trim() === '' ||
        s.doctorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.roomLocation.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.note && s.note.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchDoctor && matchType && matchSearch;
    });
  }, [shifts, selectedDoctorFilter, filterShiftType, searchQuery]);

  // Dynamic Days of selected week
  const weekDays = useMemo(() => {
    const curr = new Date(currentDate);
    const day = curr.getDay(); // 0 = Sun, 1 = Mon ...
    const diff = curr.getDate() - day + (day === 0 ? -6 : 1); // get Monday
    const monday = new Date(curr.setDate(diff));

    const dayNames = language === 'th' ? ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const monthNames = language === 'th' ? ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'] : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      days.push({
        name: dayNames[i],
        monthName: monthNames[d.getMonth()],
        fullDate: dateStr,
        dayNum: String(d.getDate()),
        isToday: dateStr === todayStr
      });
    }
    return days;
  }, [currentDate, language, todayStr]);

  // MONTHLY CALENDAR GRID DATA GENERATION
  const monthCalendarGrid = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const startDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sun
    const totalDays = lastDayOfMonth.getDate();

    const days = [];

    // Previous month padding days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const pDay = prevMonthLastDay - i;
      const pDateObj = new Date(year, month - 1, pDay);
      const formattedDate = pDateObj.toISOString().split('T')[0];
      days.push({
        dayNum: pDay,
        fullDate: formattedDate,
        isCurrentMonth: false,
        isToday: formattedDate === todayStr
      });
    }

    // Current month days
    for (let d = 1; d <= totalDays; d++) {
      const formattedDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dayNum: d,
        fullDate: formattedDate,
        isCurrentMonth: true,
        isToday: formattedDate === todayStr
      });
    }

    // Next month padding days to complete grid (42 cells: 6 rows x 7 cols)
    const remainingCells = 42 - days.length;
    for (let n = 1; n <= remainingCells; n++) {
      const nDateObj = new Date(year, month + 1, n);
      const formattedDate = nDateObj.toISOString().split('T')[0];
      days.push({
        dayNum: n,
        fullDate: formattedDate,
        isCurrentMonth: false,
        isToday: formattedDate === todayStr
      });
    }

    return days;
  }, [currentDate, todayStr]);

  // Navigate Months / Weeks
  const handlePrevMonth = () => {
    if (viewMode === 'week') {
      setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() - 7));
    } else {
      setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    }
  };

  const handleNextMonth = () => {
    if (viewMode === 'week') {
      setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 7));
    } else {
      setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    }
  };

  const handleTodayMonth = () => {
    setCurrentDate(new Date());
  };

  // Open modal for NEW shift
  const handleOpenAddModal = (defaultDate?: string) => {
    setEditingShift(null);
    setFormDepartment(loggedInDoctor.department);
    setFormDate(defaultDate || todayStr);
    setFormStartTime('08:00');
    setFormEndTime('16:00');
    setFormShiftType('General Consultation');
    setFormRoomLocation(loggedInDoctor.roomLocation);
    setFormMaxPatients(20);
    setFormStatus('Scheduled');
    setFormNote('');
    setIsModalOpen(true);
  };

  // Open modal for EDIT or VIEW shift
  const handleShiftClick = (shift: DoctorShift) => {
    if (!isShiftOwner(shift)) {
      // Non-owned shift -> Read-only popup under RBAC
      setReadOnlyShiftModal(shift);
    } else {
      // Owned shift -> Editable form
      setEditingShift(shift);
      setFormDepartment(shift.department);
      setFormDate(shift.date);
      setFormStartTime(shift.startTime);
      setFormEndTime(shift.endTime);
      setFormShiftType(shift.shiftType);
      setFormRoomLocation(shift.roomLocation);
      setFormMaxPatients(shift.maxPatients);
      setFormStatus(shift.status);
      setFormNote(shift.note || '');
      setIsModalOpen(true);
    }
  };

  // Save Shift (Always bound to loggedInDoctor)
  const handleSaveShift = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formDate || !formStartTime || !formEndTime) {
      alert(language === 'th' ? 'กรุณาระบุวันที่และเวลาปฏิบัติงาน' : 'Please fill in required shift date and time.');
      return;
    }

    if (editingShift) {
      const updated = shifts.map((s) =>
        s.id === editingShift.id
          ? {
              ...s,
              doctorName: loggedInDoctor.name,
              doctorId: loggedInDoctor.id,
              doctorUsername: loggedInDoctor.username,
              department: formDepartment,
              date: formDate,
              startTime: formStartTime,
              endTime: formEndTime,
              shiftType: formShiftType,
              roomLocation: formRoomLocation,
              maxPatients: formMaxPatients,
              status: formStatus,
              note: formNote
            }
          : s
      );
      setShifts(updated);
      saveStoredDoctorShifts(updated);
      showToast(language === 'th' ? `อัปเดตตารางเวรของ ${loggedInDoctor.name} วันที่ ${formDate} เรียบร้อยแล้ว` : `Updated schedule for ${loggedInDoctor.name} on ${formDate}`);
    } else {
      const newShift: DoctorShift = {
        id: `shift-doc-${loggedInDoctor.id.toLowerCase()}-${formDate}-${Date.now() % 100000}`,
        doctorName: loggedInDoctor.name,
        doctorId: loggedInDoctor.id,
        doctorUsername: loggedInDoctor.username,
        department: formDepartment,
        date: formDate,
        startTime: formStartTime,
        endTime: formEndTime,
        shiftType: formShiftType,
        roomLocation: formRoomLocation,
        maxPatients: formMaxPatients,
        bookedPatients: 0,
        status: formStatus,
        note: formNote
      };
      const updated = [...shifts, newShift];
      setShifts(updated);
      saveStoredDoctorShifts(updated);
      showToast(language === 'th' ? `เพิ่มกะการออกตรวจของ ${loggedInDoctor.name} วันที่ ${formDate} เรียบร้อยแล้ว` : `Added new shift for ${loggedInDoctor.name} on ${formDate}`);
    }

    setIsModalOpen(false);
  };

  // Delete Shift (RBAC protected)
  const handleDeleteShift = (shift: DoctorShift) => {
    if (!isShiftOwner(shift)) {
      showToast(language === 'th' ? `ข้อจำกัดสิทธิ์: ท่านไม่สามารถลบตารางเวรของแพทย์ท่านอื่น (${shift.doctorName}) ได้` : `RBAC Restriction: You cannot delete ${shift.doctorName}'s schedule.`);
      return;
    }

    const confirmMsg = language === 'th'
      ? `คุณแน่ใจหรือไม่ว่าต้องการลบเวรออกตรวจวันที่ ${shift.date} (${shift.shiftType})?`
      : `Are you sure you want to remove your shift on ${shift.date} (${shift.shiftType})?`;

    if (confirm(confirmMsg)) {
      const updated = shifts.filter((s) => s.id !== shift.id);
      setShifts(updated);
      saveStoredDoctorShifts(updated);
      showToast(language === 'th' ? 'ลบเวรออกตรวจเรียบร้อยแล้ว' : 'Shift removed successfully.');
    }
  };

  // Shift type badge color helper
  const getShiftBadgeStyle = (type: DoctorShift['shiftType']) => {
    switch (type) {
      case 'General Consultation':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Minor Procedure':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Health Check-up':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'After-hours':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'Academic / Meeting':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'Leave / Off':
        return 'bg-slate-100 text-slate-600 border-slate-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  // Stats
  const totalShiftsCount = filteredShifts.length;
  const myShiftsCount = shifts.filter((s) => s.doctorName === loggedInDoctor.name || s.doctorUsername === loggedInDoctor.username).length;
  const totalOPDShifts = filteredShifts.filter((s) => s.shiftType === 'General Consultation').length;
  const onCallCount = filteredShifts.filter((s) => s.shiftType === 'After-hours').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#162a4a] text-white px-4 py-3 rounded-xl shadow-lg text-xs font-medium flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-bottom-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Title & Main Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {language === 'th' ? `ตารางงาน ${loggedInDoctor.name}` : `Work Schedule: ${loggedInDoctor.name}`}
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {loggedInDoctor.department} • {loggedInDoctor.roomLocation}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* ปุ่มสลับมุมมอง */}
          <StatusFilterTabs
            value={viewMode}
            onChange={(next) => setViewMode(next as 'month' | 'week' | 'list')}
            options={[
              { value: 'month', label: t('monthlyView'), icon: <CalendarRange className="w-3.5 h-3.5" /> },
              { value: 'week', label: t('weeklyView'), icon: <CalendarDays className="w-3.5 h-3.5" /> },
              { value: 'list', label: t('dutyList'), icon: <ListFilter className="w-3.5 h-3.5" /> },
            ]}
          />

          {/* Add Shift Button */}
          <button
            onClick={() => handleOpenAddModal()}
            className="px-4 py-2 bg-[#2563eb] hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-2xs flex items-center gap-2 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t('addShiftBtn')}</span>
          </button>
        </div>
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wide block">{t('totalScheduledShifts')}</span>
            <span className="text-lg font-extrabold text-slate-900">{totalShiftsCount} {language === 'th' ? 'กะ' : 'Shifts'}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <User className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wide block">{t('myManagedShifts')}</span>
            <span className="text-lg font-extrabold text-slate-900">{myShiftsCount} {language === 'th' ? 'กะ' : 'Duties'}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <Stethoscope className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wide block">{t('opdSessions')}</span>
            <span className="text-lg font-extrabold text-slate-900">{totalOPDShifts} {language === 'th' ? 'กะ' : 'Sessions'}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wide block">{t('emergencyOnCall')}</span>
            <span className="text-lg font-extrabold text-slate-900">{onCallCount} {language === 'th' ? 'กะ' : 'Duties'}</span>
          </div>
        </div>
      </div>

      {/* Control Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Doctor Filter Selector */}
        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
          <span className="text-xs font-bold text-slate-600 whitespace-nowrap">{t('filterDoctor')}:</span>
          <select
            value={selectedDoctorFilter}
            onChange={(e) => setSelectedDoctorFilter(e.target.value)}
            className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 cursor-pointer"
          >
            <option value="All">{t('allDoctors')}</option>
            {SYSTEM_DOCTORS.map((doc) => (
              <option key={doc.id} value={doc.name}>
                {doc.name} — {doc.department} {doc.name === loggedInDoctor.name ? (language === 'th' ? '⭐ (บัญชีของคุณ)' : '⭐ (Your Account)') : ''}
              </option>
            ))}
          </select>

          {/* Shift Type Filter */}
          <select
            value={filterShiftType}
            onChange={(e) => setFilterShiftType(e.target.value)}
            className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white cursor-pointer focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 focus:outline-hidden transition-all"
          >
            <option value="All">{t('allShiftTypes')}</option>
            {SHIFT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        {/* Search input */}
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder={language === 'th' ? 'ค้นหาตารางเวร, ห้องตรวจ, หมายเหตุ...' : 'Search duty, room, note...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 transition-all"
          />
        </div>
      </div>

      {/* ============================================================ */}
      {/* VIEWMODE 1: MONTHLY CALENDAR VIEW */}
      {/* ============================================================ */}
      {viewMode === 'month' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          {/* Monthly Calendar Header Controls */}
          <div className="p-4 bg-[#162a4a] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <CalendarRange className="w-5 h-5 text-blue-300" />
              <div>
                <h2 className="text-base font-bold tracking-tight">
                  {currentDate.toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US', { month: 'long', year: 'numeric' })}
                </h2>
                <span className="text-[11px] text-blue-200 block">
                  {language === 'th' ? 'ตารางการปฏิบัติงานและกะออกตรวจประจำเดือน' : 'Monthly Duty Roster and Work Schedule'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleTodayMonth}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold border border-white/20 transition-all cursor-pointer"
              >
                {t('todayMonthBtn')}
              </button>
              <div className="flex items-center gap-1 bg-white/10 p-1 rounded-lg border border-white/20">
                <button
                  onClick={handlePrevMonth}
                  className="p-1 text-slate-200 hover:text-white hover:bg-white/10 rounded transition-colors cursor-pointer"
                  title="Previous Month"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={handleNextMonth}
                  className="p-1 text-slate-200 hover:text-white hover:bg-white/10 rounded transition-colors cursor-pointer"
                  title="Next Month"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Days of Week Row Header */}
          <div className="grid grid-cols-7 bg-slate-100 border-b border-slate-200 font-bold text-[11px] text-slate-600 text-center uppercase tracking-wider py-2.5">
            <div>{language === 'th' ? 'อาทิตย์' : 'Sun'}</div>
            <div>{language === 'th' ? 'จันทร์' : 'Mon'}</div>
            <div>{language === 'th' ? 'อังคาร' : 'Tue'}</div>
            <div>{language === 'th' ? 'พุธ' : 'Wed'}</div>
            <div>{language === 'th' ? 'พฤหัสบดี' : 'Thu'}</div>
            <div>{language === 'th' ? 'ศุกร์' : 'Fri'}</div>
            <div>{language === 'th' ? 'เสาร์' : 'Sat'}</div>
          </div>

          {/* 42 Day Grid Cells */}
          <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-200 bg-slate-100 min-h-[580px]">
            {monthCalendarGrid.map((day) => {
              const dayShifts = filteredShifts.filter((s) => s.date === day.fullDate);

              return (
                <div
                  key={day.fullDate}
                  className={`min-h-[105px] p-2 flex flex-col justify-between transition-colors ${
                    !day.isCurrentMonth
                      ? 'bg-slate-50/60 text-slate-400'
                      : day.isToday
                      ? 'bg-blue-50/50 text-slate-900 font-medium'
                      : 'bg-white text-slate-800'
                  }`}
                >
                  {/* Top Day Header inside Cell */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-extrabold px-1.5 py-0.5 rounded ${
                        day.isToday
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : day.isCurrentMonth
                          ? 'text-slate-800'
                          : 'text-slate-400'
                      }`}
                    >
                      {day.dayNum}
                    </span>

                    {/* Quick Add Shift button for logged-in doctor */}
                    {day.isCurrentMonth && (
                      <button
                        onClick={() => handleOpenAddModal(day.fullDate)}
                        className="opacity-0 hover:opacity-100 focus:opacity-100 p-0.5 text-slate-400 hover:text-blue-600 rounded transition-all cursor-pointer"
                        title={`Add shift for ${loggedInDoctor.name} on ${day.fullDate}`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* List of Shifts for this Day */}
                  <div className="space-y-1 my-1 flex-1 overflow-y-auto max-h-[110px] scrollbar-thin">
                    {dayShifts.map((shift) => {
                      const owner = isShiftOwner(shift);

                      return (
                        <div
                          key={shift.id}
                          onClick={() => handleShiftClick(shift)}
                          className={`p-1.5 rounded-md text-[10px] font-medium border transition-all cursor-pointer truncate flex items-center justify-between gap-1 group ${
                            owner
                              ? 'bg-blue-50 border-blue-300 text-blue-900 hover:bg-blue-100 font-bold shadow-2xs'
                              : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                          }`}
                          title={`${shift.doctorName} - ${shift.shiftType} (${shift.startTime}-${shift.endTime})`}
                        >
                          <div className="truncate flex items-center gap-1">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${owner ? 'bg-blue-600' : 'bg-slate-400'}`} />
                            <span className="truncate font-bold">
                              {shift.doctorName.split(' ')[1] || shift.doctorName}:
                            </span>
                            <span className="truncate text-slate-600">{shift.shiftType}</span>
                          </div>

                          {!owner ? (
                            <span title="Read only (Other doctor's schedule)">
                              <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                            </span>
                          ) : (
                            <Edit2 className="w-3 h-3 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Bottom Day Cell Summary */}
                  {dayShifts.length > 0 && (
                    <div className="text-[9px] font-bold text-slate-400 text-right">
                      {dayShifts.length} {dayShifts.length === 1 ? 'shift' : 'shifts'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* VIEWMODE 2: WEEKLY CALENDAR GRID */}
      {/* ============================================================ */}
      {viewMode === 'week' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          {/* Calendar Week Header */}
          <div className="p-4 bg-[#162a4a] text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CalendarIcon className="w-5 h-5 text-blue-300" />
              <h2 className="text-sm font-bold tracking-tight">
                {language === 'th'
                  ? `สัปดาห์: ${weekDays[0]?.dayNum} ${weekDays[0]?.monthName} - ${weekDays[6]?.dayNum} ${weekDays[6]?.monthName} (${currentDate.getFullYear() + 543})`
                  : `Schedule Week: ${weekDays[0]?.monthName} ${weekDays[0]?.dayNum} - ${weekDays[6]?.monthName} ${weekDays[6]?.dayNum}, ${currentDate.getFullYear()}`}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleTodayMonth}
                className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold border border-white/20 transition-all cursor-pointer"
              >
                สัปดาห์นี้
              </button>
              <div className="flex items-center gap-1 bg-white/10 p-1 rounded-lg border border-white/20">
                <button
                  onClick={handlePrevMonth}
                  className="p-1 text-slate-200 hover:text-white hover:bg-white/10 rounded transition-colors cursor-pointer"
                  title="Previous Week"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={handleNextMonth}
                  className="p-1 text-slate-200 hover:text-white hover:bg-white/10 rounded transition-colors cursor-pointer"
                  title="Next Week"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* 7-Day Grid Columns */}
          <div className="grid grid-cols-1 md:grid-cols-7 divide-y md:divide-y-0 md:divide-x divide-slate-200 min-h-[480px]">
            {weekDays.map((day) => {
              const dayShifts = filteredShifts.filter((s) => s.date === day.fullDate);

              return (
                <div
                  key={day.fullDate}
                  className={`p-3 space-y-3 flex flex-col ${
                    day.isToday ? 'bg-blue-50/40' : 'bg-white'
                  }`}
                >
                  {/* Day Title Header */}
                  <div>
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div>
                        <span className="text-[11px] font-bold text-slate-400 uppercase block">{day.name}</span>
                        <span className={`text-base font-black ${day.isToday ? 'text-blue-600' : 'text-slate-800'}`}>
                          {day.dayNum} {day.monthName}
                        </span>
                      </div>
                      {day.isToday && (
                        <span className="bg-blue-600 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase">
                          Today
                        </span>
                      )}
                    </div>

                    {/* Add shift button */}
                    <button
                      onClick={() => handleOpenAddModal(day.fullDate)}
                      className="w-full py-1.5 bg-slate-50 hover:bg-blue-50 text-slate-500 hover:text-blue-700 rounded-xl text-[11px] font-bold border border-dashed border-slate-200 hover:border-blue-300 transition-all flex items-center justify-center gap-1 mt-3 cursor-pointer"
                    >
                      <Plus className="w-3 h-3 shrink-0" />
                      <span>{language === 'th' ? 'เพิ่มเวร' : 'Add Duty'}</span>
                    </button>

                    {/* Shifts inside this day */}
                    <div className="space-y-2.5 mt-3">
                      {dayShifts.length === 0 ? (
                        <div className="text-[11px] text-slate-400 py-6 text-center italic border border-dashed border-slate-200 rounded-xl">
                          {language === 'th' ? 'ไม่มีตารางเวร' : 'No shifts scheduled'}
                        </div>
                      ) : (
                        dayShifts.map((shift) => {
                          const owner = isShiftOwner(shift);

                          return (
                            <div
                              key={shift.id}
                              className={`bg-white p-3 rounded-xl border shadow-2xs hover:shadow-md transition-all group relative space-y-2 ${
                                owner ? 'border-blue-300 ring-1 ring-blue-100' : 'border-slate-200'
                              }`}
                            >
                              {/* Doctor & Type Badge */}
                              <div className="flex items-start justify-between gap-1">
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getShiftBadgeStyle(
                                    shift.shiftType
                                  )}`}
                                >
                                  {shift.shiftType}
                                </span>

                                {/* Permission-Aware Action Buttons */}
                                <div className="flex items-center gap-1">
                                  {owner ? (
                                    <>
                                      <button
                                        onClick={() => handleShiftClick(shift)}
                                        className="p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                                        title="Edit Your Shift"
                                      >
                                        <Edit2 className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteShift(shift)}
                                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                                        title="Delete Shift"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      onClick={() => setReadOnlyShiftModal(shift)}
                                      className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                                      title="View Details (Read-Only)"
                                    >
                                      <Eye className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Doctor Name & Room */}
                              <div>
                                <div className="font-bold text-xs text-slate-900 flex items-center gap-1">
                                  <User className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span className="truncate">{shift.doctorName}</span>
                                </div>
                                <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1 mt-0.5">
                                  <Building className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span className="truncate">{shift.roomLocation}</span>
                                </div>
                              </div>

                              {/* Time Slot */}
                              <div className="text-[11px] font-mono font-bold text-slate-700 bg-slate-50 p-1.5 rounded-lg flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-400" />
                                <span>{shift.startTime} - {shift.endTime}</span>
                              </div>

                              {/* Patient progress limit bar */}
                              {shift.shiftType === 'General Consultation' && (
                                <div className="space-y-0.5 pt-1">
                                  <div className="flex justify-between text-[10px] font-medium text-slate-500">
                                    <span>Patients</span>
                                    <span className="font-mono font-bold text-slate-800">
                                      {shift.bookedPatients}/{shift.maxPatients}
                                    </span>
                                  </div>
                                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-blue-600 rounded-full"
                                      style={{
                                        width: `${Math.min(
                                          100,
                                          (shift.bookedPatients / (shift.maxPatients || 1)) * 100
                                        )}%`
                                      }}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* VIEWMODE 3: DUTY LIST TABLE VIEW */}
      {/* ============================================================ */}
      {viewMode === 'list' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-600 flex justify-between items-center">
            <span>Detailed Duty Shift Schedule</span>
            <span className="text-slate-400 font-normal">Total {filteredShifts.length} items found</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 font-bold text-slate-600 uppercase text-[10px] tracking-wider">
                  <th className="p-3.5">Doctor & Dept</th>
                  <th className="p-3.5">Shift Type</th>
                  <th className="p-3.5">Date & Time</th>
                  <th className="p-3.5">Location / Room</th>
                  <th className="p-3.5">Capacity</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions / Access</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {filteredShifts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      No duty shifts found for selected criteria.
                    </td>
                  </tr>
                ) : (
                  filteredShifts.map((shift) => {
                    const owner = isShiftOwner(shift);

                    return (
                      <tr key={shift.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3.5">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{shift.doctorName}</span>
                            {owner && (
                              <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-1.5 py-0.2 rounded">
                                You
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500">{shift.department}</div>
                        </td>

                        <td className="p-3.5">
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${getShiftBadgeStyle(shift.shiftType)}`}>
                            {shift.shiftType}
                          </span>
                        </td>

                        <td className="p-3.5">
                          <div className="font-bold text-slate-800">{shift.date}</div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {shift.startTime} - {shift.endTime}
                          </div>
                        </td>

                        <td className="p-3.5 font-medium text-slate-700">
                          {shift.roomLocation}
                        </td>

                        <td className="p-3.5">
                          <div className="font-mono text-slate-800 font-bold">
                            {shift.bookedPatients} / {shift.maxPatients}
                          </div>
                          <div className="text-[10px] text-slate-400">patients</div>
                        </td>

                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                              shift.status === 'In Progress'
                                ? 'bg-amber-100 text-amber-800'
                                : shift.status === 'Completed'
                                ? 'bg-slate-100 text-slate-600'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {shift.status}
                          </span>
                        </td>

                        <td className="p-3.5 text-right">
                          {owner ? (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleShiftClick(shift)}
                                className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                              >
                                <Edit2 className="w-3 h-3" />
                                <span>Edit</span>
                              </button>
                              <button
                                onClick={() => handleDeleteShift(shift)}
                                className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setReadOnlyShiftModal(shift)}
                              className="px-2.5 py-1 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg text-xs font-medium transition-all cursor-pointer inline-flex items-center gap-1"
                            >
                              <Lock className="w-3 h-3" />
                              <span>Details</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 1: ADD / EDIT SHIFT MODAL */}
      {/* ============================================================ */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[1200] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* ===== Header ===== */}
            <div className="px-6 py-4 bg-[#162a4a] text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-300">
                  {editingShift ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="font-bold text-sm leading-tight">
                    {editingShift ? 'แก้ไขกะการออกตรวจ' : 'เพิ่มกะการออกตรวจใหม่'}
                  </h3>
                  <p className="text-[11px] text-blue-200/80 mt-0.5">
                    {editingShift ? 'ปรับปรุงรายละเอียดเวลาหรือสถานที่ปฏิบัติงาน' : 'กำหนดช่วงเวลาและห้องตรวจของแพทย์'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* ===== Form ===== */}
            <form onSubmit={handleSaveShift} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5">

                {/* แพทย์เจ้าของตาราง */}
                <div className="p-3.5 bg-blue-50/70 border border-blue-100 rounded-2xl flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-700 flex items-center justify-center shrink-0">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[11px] font-bold text-blue-700 block leading-tight">บัญชีแพทย์ประจำตาราง</span>
                    <span className="text-sm font-extrabold text-slate-900">{loggedInDoctor.name}</span>
                    <span className="text-xs text-slate-500 ml-1.5">({loggedInDoctor.department})</span>
                  </div>
                </div>

                {/* กลุ่ม 1 — ประเภทกะและสถานที่ */}
                <section className="rounded-2xl border border-slate-200 overflow-hidden">
                  <header className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                    <Stethoscope className="w-4 h-4 text-slate-500 shrink-0" />
                    <h4 className="text-xs font-bold text-slate-700">ประเภทกะและสถานที่</h4>
                  </header>
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1.5">
                        ประเภทกะการออกตรวจ <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={formShiftType}
                        onChange={(e) => setFormShiftType(e.target.value as any)}
                        className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 cursor-pointer"
                      >
                        {SHIFT_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1.5">
                        ห้อง / สถานที่ปฏิบัติงาน <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formRoomLocation}
                        onChange={(e) => setFormRoomLocation(e.target.value)}
                        placeholder="เช่น ห้องตรวจ 1, ห้องหัตถการ 2"
                        className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 placeholder:font-normal placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                </section>

                {/* กลุ่ม 2 — วันและเวลา */}
                <section className="rounded-2xl border border-slate-200 overflow-hidden">
                  <header className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-500 shrink-0" />
                    <h4 className="text-xs font-bold text-slate-700">วันและเวลาปฏิบัติงาน</h4>
                  </header>
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1.5">
                        วันที่ออกตรวจ <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={formDate}
                        onChange={(e) => setFormDate(e.target.value)}
                        className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1.5">
                        เวลาเริ่มต้น <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="time"
                        value={formStartTime}
                        onChange={(e) => setFormStartTime(e.target.value)}
                        className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1.5">
                        เวลาสิ้นสุด <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="time"
                        value={formEndTime}
                        onChange={(e) => setFormEndTime(e.target.value)}
                        className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15"
                      />
                    </div>
                  </div>
                </section>

                {/* กลุ่ม 3 — จำนวนผู้ป่วยและสถานะ */}
                <section className="rounded-2xl border border-slate-200 overflow-hidden">
                  <header className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                    <Users className="w-4 h-4 text-slate-500 shrink-0" />
                    <h4 className="text-xs font-bold text-slate-700">ขีดความสามารถและสถานะ</h4>
                  </header>
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1.5">
                        จำนวนผู้ป่วยสูงสุด (คน)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={formMaxPatients}
                        onChange={(e) => setFormMaxPatients(Number(e.target.value))}
                        className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1.5">
                        สถานะกะ
                      </label>
                      <select
                        value={formStatus}
                        onChange={(e) => setFormStatus(e.target.value as any)}
                        className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 cursor-pointer"
                      >
                        <option value="Scheduled">Scheduled (รอดำเนินการ)</option>
                        <option value="In Progress">In Progress (กำลังดำเนินการ)</option>
                        <option value="Completed">Completed (เสร็จสิ้น)</option>
                        <option value="Cancelled">Cancelled (ยกเลิก)</option>
                      </select>
                    </div>
                  </div>
                </section>

                {/* กลุ่ม 4 — หมายเหตุเพิ่มเติม */}
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1.5">
                    หมายเหตุเพิ่มเติม (ถ้ามี)
                  </label>
                  <textarea
                    rows={2}
                    value={formNote}
                    onChange={(e) => setFormNote(e.target.value)}
                    placeholder="เช่น เตรียมเครื่องมืออัลตราซาวด์, ตรวจเคสส่งต่อ ฯลฯ"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 placeholder:text-slate-400 resize-none"
                  />
                </div>
              </div>

              {/* ===== Footer ===== */}
              <div className="shrink-0 px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#2563eb] hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-md active:scale-95 transition-all cursor-pointer inline-flex items-center gap-2 whitespace-nowrap"
                >
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{editingShift ? 'บันทึกการแก้ไข' : 'สร้างกะการออกตรวจ'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: READ-ONLY SHIFT DETAILS (When clicking another doctor's schedule) */}
      {readOnlyShiftModal && (
        <div className="fixed inset-0 z-[1200] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 bg-slate-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-base">
                  {language === 'th' ? 'รายละเอียดตารางเวร (ดูอย่างเดียว)' : 'Duty Schedule Details (Read-Only)'}
                </h3>
              </div>
              <button
                onClick={() => setReadOnlyShiftModal(null)}
                className="p-1 rounded-lg text-slate-300 hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl space-y-2 border border-slate-200 text-xs">
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500 font-medium">{language === 'th' ? 'แพทย์ผู้ตรวจ:' : 'Doctor:'}</span>
                  <span className="font-bold text-slate-900">{readOnlyShiftModal.doctorName}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500 font-medium">{language === 'th' ? 'แผนก:' : 'Department:'}</span>
                  <span className="font-semibold text-slate-800">{readOnlyShiftModal.department}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500 font-medium">{language === 'th' ? 'ประเภทกะ:' : 'Shift Type:'}</span>
                  <span className={`px-2 py-0.5 rounded font-bold border ${getShiftBadgeStyle(readOnlyShiftModal.shiftType)}`}>
                    {readOnlyShiftModal.shiftType}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500 font-medium">{language === 'th' ? 'วันและเวลา:' : 'Date & Time:'}</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {readOnlyShiftModal.date} ({readOnlyShiftModal.startTime} - {readOnlyShiftModal.endTime})
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500 font-medium">{language === 'th' ? 'สถานที่/ห้องตรวจ:' : 'Location:'}</span>
                  <span className="font-medium text-slate-800">{readOnlyShiftModal.roomLocation}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">{language === 'th' ? 'จำนวนผู้ป่วย:' : 'Patients Booked:'}</span>
                  <span className="font-mono font-bold text-slate-900">
                    {readOnlyShiftModal.bookedPatients} / {readOnlyShiftModal.maxPatients} max
                  </span>
                </div>
                {readOnlyShiftModal.note && (
                  <div className="pt-2 border-t border-slate-200 text-slate-600 italic">
                    Note: "{readOnlyShiftModal.note}"
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setReadOnlyShiftModal(null)}
                  className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  {language === 'th' ? 'ปิดหน้าต่าง' : 'Close View'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
