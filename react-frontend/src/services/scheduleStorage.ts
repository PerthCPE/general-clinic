// Service for Doctor Schedules and Officer Synchronization
// Supports mock data generation for login doctor accounts (doctor1, doctor2, doctor3)
// and bidirectional synchronization between Officer schedule updates and Doctor schedule views.

export interface DoctorProfile {
  id: string;
  code: string;
  username: string;
  name: string;
  department: string;
  specialty: string;
  licenseNo: string;
  roomLocation: string;
  phone: string;
  email: string;
  avatar: string;
  avatarText: string;
  role: string;
}

export const SYSTEM_DOCTORS: DoctorProfile[] = [
  {
    id: 'DOC-1',
    code: 'DOC-0001',
    username: 'doctor1',
    name: 'พญ.สุดา สุขสมบูรณ์',
    department: 'แผนกสูตินรีเวช',
    specialty: 'เวชศาสตร์มารดาและทารก / สูตินรีเวชกรรม',
    licenseNo: 'MD-84920',
    roomLocation: 'ห้องตรวจ 1 (สูตินรีเวช)',
    phone: '081-222-0001',
    email: 'doctor1@clinic.local',
    avatar: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150&auto=format&fit=crop&q=80',
    avatarText: 'SS',
    role: 'แพทย์ผู้เชี่ยวชาญสูตินรีเวช',
  },
  {
    id: 'DOC-2',
    code: 'DOC-0002',
    username: 'doctor2',
    name: 'นพ.วิชัย ชาญการแพทย์',
    department: 'แผนกอายุรกรรมทั่วไป',
    specialty: 'อายุรศาสตร์โรคหัวใจและหลอดเลือด',
    licenseNo: 'MD-77312',
    roomLocation: 'ห้องตรวจ 2 (อายุรกรรม)',
    phone: '081-222-0002',
    email: 'doctor2@clinic.local',
    avatar: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=150&auto=format&fit=crop&q=80',
    avatarText: 'WC',
    role: 'แพทย์ผู้เชี่ยวชาญอายุรกรรม',
  },
  {
    id: 'DOC-3',
    code: 'DOC-0003',
    username: 'doctor3',
    name: 'พญ.เกศรา รักษาดี',
    department: 'แผนกกุมารเวชกรรม',
    specialty: 'กุมารเวชศาสตร์โรคภูมิแพ้และภูมิคุ้มกัน',
    licenseNo: 'MD-91054',
    roomLocation: 'ห้องตรวจ 3 (กุมารเวชกรรม)',
    phone: '081-222-0003',
    email: 'doctor3@clinic.local',
    avatar: 'https://images.unsplash.com/photo-1594824813590-759082260ffc?w=150&auto=format&fit=crop&q=80',
    avatarText: 'KR',
    role: 'แพทย์ผู้เชี่ยวชาญกุมารเวชกรรม',
  },
];

export interface DoctorShift {
  id: string;
  doctorName: string;
  doctorId: string; // 'DOC-1', 'DOC-2', 'DOC-3'
  doctorUsername: string; // 'doctor1', 'doctor2', 'doctor3'
  department: string;
  date: string; // YYYY-MM-DD
  startTime: string; // e.g. '08:00'
  endTime: string; // e.g. '16:00'
  shiftType: 'General Consultation' | 'Minor Procedure' | 'Health Check-up' | 'After-hours' | 'Academic / Meeting' | 'Leave / Off';
  roomLocation: string; // e.g. 'ห้องตรวจ 1 (สูตินรีเวช)'
  maxPatients: number;
  bookedPatients: number;
  status: 'Scheduled' | 'In Progress' | 'Completed' | 'Cancelled';
  note?: string;
}

export interface OfficerShiftSchedule {
  id: string;
  doctorCode: string;
  username?: string;
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

const STORAGE_KEY_SHIFTS = 'clinic_doctor_shifts_v2';
const STORAGE_KEY_OVERRIDES = 'clinic_calendar_overrides_v2';
const STORAGE_KEY_OFFICER_SCHEDULES = 'clinic_officer_schedules_v2';

export function findDoctorProfile(identifier?: string): DoctorProfile {
  if (!identifier) return SYSTEM_DOCTORS[0];
  const clean = identifier.toLowerCase().trim();
  const matched = SYSTEM_DOCTORS.find(
    doc =>
      doc.id.toLowerCase() === clean ||
      doc.code.toLowerCase() === clean ||
      doc.username.toLowerCase() === clean ||
      doc.name.toLowerCase() === clean ||
      doc.name.includes(identifier) ||
      clean.includes(doc.username.toLowerCase())
  );
  return matched || SYSTEM_DOCTORS[0];
}

/**
 * Generates initial mockup shifts for all 3 doctors in the system
 * spans from past 7 days to next 30 days
 */
export function generateInitialDoctorShifts(): DoctorShift[] {
  const shifts: DoctorShift[] = [];
  const today = new Date();
  
  // Define routine template for each doctor
  const templates = [
    {
      doc: SYSTEM_DOCTORS[0], // พญ.สุดา (สูตินรีเวช)
      routines: [
        { day: 1, type: 'General Consultation' as const, time: ['08:00', '16:00'], room: 'ห้องตรวจ 1 (สูตินรีเวช)', max: 20, booked: 14, note: 'ตรวจครรภ์และสูตินรีเวชทั่วไป' },
        { day: 2, type: 'Minor Procedure' as const, time: ['13:00', '16:30'], room: 'ห้องหัตถการสูติ 1', max: 6, booked: 4, note: 'อัลตราซาวด์ 4 มิติ และหัตถการพิเศษ' },
        { day: 3, type: 'General Consultation' as const, time: ['08:00', '16:00'], room: 'ห้องตรวจ 1 (สูตินรีเวช)', max: 20, booked: 18, note: 'คลินิกฝากครรภ์พิเศษ (ANC Clinic)' },
        { day: 4, type: 'Academic / Meeting' as const, time: ['08:30', '12:00'], room: 'ห้องประชุมวิชาการ 2', max: 0, booked: 0, note: 'ประชุมวิชาการสูตินรีแพทย์ประจำเดือน' },
        { day: 5, type: 'General Consultation' as const, time: ['08:00', '16:00'], room: 'ห้องตรวจ 1 (สูตินรีเวช)', max: 20, booked: 15, note: 'ตรวจรักษาโรคสตรีและวางแผนครอบครัว' },
        { day: 6, type: 'After-hours' as const, time: ['08:30', '12:30'], room: 'ห้องตรวจ 1 (สูตินรีเวช)', max: 12, booked: 9, note: 'คลินิกนอกเวลาราชการ (วันเสาร์)' },
      ]
    },
    {
      doc: SYSTEM_DOCTORS[1], // นพ.วิชัย (อายุรกรรม)
      routines: [
        { day: 1, type: 'After-hours' as const, time: ['16:00', '00:00'], room: 'ห้องตรวจ 2 (อายุรกรรม)', max: 15, booked: 11, note: 'เวรตรวจอายุรกรรมช่วงบ่าย-ค่ำ' },
        { day: 2, type: 'General Consultation' as const, time: ['08:00', '16:00'], room: 'ห้องตรวจ 2 (อายุรกรรม)', max: 25, booked: 22, note: 'คลินิกเบาหวาน ความดันโลหิตสูง และหัวใจ' },
        { day: 3, type: 'Health Check-up' as const, time: ['08:30', '12:00'], room: 'ศูนย์ตรวจสุขภาพ (Check-up Center)', max: 15, booked: 12, note: 'ตรวจสุขภาพประจำปีกลุ่มเสี่ยงโรคหัวใจ' },
        { day: 4, type: 'General Consultation' as const, time: ['08:00', '16:00'], room: 'ห้องตรวจ 2 (อายุรกรรม)', max: 25, booked: 19, note: 'ตรวจรักษาโรคอายุรกรรมทั่วไป' },
        { day: 5, type: 'General Consultation' as const, time: ['08:00', '16:00'], room: 'ห้องตรวจ 2 (อายุรกรรม)', max: 25, booked: 20, note: 'ตรวจผู้ป่วยนอกอายุรกรรมประจำวันศุกร์' },
        { day: 0, type: 'After-hours' as const, time: ['13:00', '18:00'], room: 'ห้องตรวจ 2 (อายุรกรรม)', max: 12, booked: 8, note: 'เวรตรวจนอกเวลาประจำวันอาทิตย์' },
      ]
    },
    {
      doc: SYSTEM_DOCTORS[2], // พญ.เกศรา (กุมารเวชกรรม)
      routines: [
        { day: 1, type: 'General Consultation' as const, time: ['08:00', '16:00'], room: 'ห้องตรวจ 3 (กุมารเวชกรรม)', max: 20, booked: 16, note: 'ตรวจรักษาโรคเด็กทั่วไปและทางเดินหายใจ' },
        { day: 2, type: 'Health Check-up' as const, time: ['08:30', '12:00'], room: 'คลินิกวัคซีนและพัฒนาการเด็ก', max: 15, booked: 14, note: 'คลินิกฉีดวัคซีนเด็กและประเมินพัฒนาการ' },
        { day: 3, type: 'General Consultation' as const, time: ['08:00', '16:00'], room: 'ห้องตรวจ 3 (กุมารเวชกรรม)', max: 20, booked: 15, note: 'คลินิกโรคภูมิแพ้และหอบหืดในเด็ก' },
        { day: 4, type: 'After-hours' as const, time: ['16:00', '20:00'], room: 'ห้องตรวจ 3 (กุมารเวชกรรม)', max: 10, booked: 7, note: 'คลินิกกุมารเวชกรรมนอกเวลาช่วงเย็น' },
        { day: 5, type: 'General Consultation' as const, time: ['08:00', '16:00'], room: 'ห้องตรวจ 3 (กุมารเวชกรรม)', max: 20, booked: 17, note: 'ตรวจรักษาโรคเด็กประจำวันศุกร์' },
        { day: 6, type: 'General Consultation' as const, time: ['08:30', '12:30'], room: 'ห้องตรวจ 3 (กุมารเวชกรรม)', max: 15, booked: 13, note: 'ตรวจรักษาโรคเด็กวันหยุดเสาร์' },
      ]
    }
  ];

  let shiftCounter = 1;
  const todayStr = today.toISOString().split('T')[0];

  // Generate for day offset -7 to +28
  for (let offset = -7; offset <= 28; offset++) {
    const curDate = new Date(today);
    curDate.setDate(today.getDate() + offset);
    const dateStr = curDate.toISOString().split('T')[0];
    const dayOfWeek = curDate.getDay(); // 0 = Sun, 1 = Mon ...

    templates.forEach(({ doc, routines }) => {
      const match = routines.find(r => r.day === dayOfWeek);
      if (match) {
        let status: DoctorShift['status'] = 'Scheduled';
        if (dateStr < todayStr) {
          status = 'Completed';
        } else if (dateStr === todayStr) {
          status = offset === 0 && match.time[0] <= '09:00' ? 'In Progress' : 'Scheduled';
        }

        shifts.push({
          id: `shift-${doc.id.toLowerCase()}-${dateStr}-${shiftCounter++}`,
          doctorName: doc.name,
          doctorId: doc.id,
          doctorUsername: doc.username,
          department: doc.department,
          date: dateStr,
          startTime: match.time[0],
          endTime: match.time[1],
          shiftType: match.type,
          roomLocation: match.room,
          maxPatients: match.max,
          bookedPatients: match.booked,
          status: status,
          note: match.note,
        });
      }
    });
  }

  return shifts;
}

export function generateInitialOfficerSchedules(): OfficerShiftSchedule[] {
  return [
    {
      id: 'DOC-1',
      doctorCode: 'DOC-0001',
      username: 'doctor1',
      name: 'พญ.สุดา สุขสมบูรณ์',
      department: 'สูตินรีเวช',
      avatarText: 'SS',
      specialty: 'เวชศาสตร์มารดาและทารก',
      phone: '081-222-0001',
      email: 'doctor1@clinic.local',
      shifts: {
        mon: 'morning',
        tue: 'afternoon',
        wed: 'morning',
        thu: 'morning',
        fri: 'morning',
        sat: 'morning',
        sun: 'off',
      }
    },
    {
      id: 'DOC-2',
      doctorCode: 'DOC-0002',
      username: 'doctor2',
      name: 'นพ.วิชัย ชาญการแพทย์',
      department: 'อายุรกรรมทั่วไป',
      avatarText: 'WC',
      specialty: 'โรคหัวใจและหลอดเลือด',
      phone: '081-222-0002',
      email: 'doctor2@clinic.local',
      shifts: {
        mon: 'afternoon',
        tue: 'morning',
        wed: 'morning',
        thu: 'morning',
        fri: 'morning',
        sat: 'off',
        sun: 'afternoon',
      }
    },
    {
      id: 'DOC-3',
      doctorCode: 'DOC-0003',
      username: 'doctor3',
      name: 'พญ.เกศรา รักษาดี',
      department: 'กุมารเวชกรรม',
      avatarText: 'KR',
      specialty: 'กุมารเวชศาสตร์โรคภูมิแพ้',
      phone: '081-222-0003',
      email: 'doctor3@clinic.local',
      shifts: {
        mon: 'morning',
        tue: 'morning',
        wed: 'morning',
        thu: 'afternoon',
        fri: 'morning',
        sat: 'morning',
        sun: 'off',
      }
    },
  ];
}

/**
 * Retrieve all DoctorShifts from localStorage, seeding if empty
 */
export function getStoredDoctorShifts(): DoctorShift[] {
  const raw = localStorage.getItem(STORAGE_KEY_SHIFTS);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {
      // fallback
    }
  }
  const initial = generateInitialDoctorShifts();
  localStorage.setItem(STORAGE_KEY_SHIFTS, JSON.stringify(initial));
  return initial;
}

export function saveStoredDoctorShifts(shifts: DoctorShift[]) {
  localStorage.setItem(STORAGE_KEY_SHIFTS, JSON.stringify(shifts));
  notifyScheduleUpdate();
}

/**
 * Retrieve Officer calendar overrides
 */
export function getStoredCalendarOverrides(): Record<string, Record<string, 'morning' | 'afternoon' | 'night' | 'off'>> {
  const raw = localStorage.getItem(STORAGE_KEY_OVERRIDES);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return {};
}

export function saveStoredCalendarOverrides(overrides: Record<string, Record<string, 'morning' | 'afternoon' | 'night' | 'off'>>) {
  localStorage.setItem(STORAGE_KEY_OVERRIDES, JSON.stringify(overrides));
  notifyScheduleUpdate();
}

/**
 * Retrieve Officer weekly schedules
 */
export function getStoredOfficerSchedules(): OfficerShiftSchedule[] {
  const raw = localStorage.getItem(STORAGE_KEY_OFFICER_SCHEDULES);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {
      // fallback
    }
  }
  const initial = generateInitialOfficerSchedules();
  localStorage.setItem(STORAGE_KEY_OFFICER_SCHEDULES, JSON.stringify(initial));
  return initial;
}

export function saveStoredOfficerSchedules(schedules: OfficerShiftSchedule[]) {
  localStorage.setItem(STORAGE_KEY_OFFICER_SCHEDULES, JSON.stringify(schedules));
  notifyScheduleUpdate();
}

/**
 * Dispatches a custom event to notify all listening components
 */
function notifyScheduleUpdate() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('clinic_schedule_updated'));
  }
}

/**
 * Synchronize an Officer schedule update into Doctor shifts
 */
export function syncOfficerShiftToDoctorSchedule(
  doctorId: string,
  dateStr: string,
  shiftType: 'morning' | 'afternoon' | 'night' | 'off',
  customNote?: string
) {
  const doctor = findDoctorProfile(doctorId);
  const currentShifts = getStoredDoctorShifts();
  const todayStr = new Date().toISOString().split('T')[0];

  // Filter out any existing shift for this doctor on this date
  const filtered = currentShifts.filter(s => !(s.doctorName === doctor.name && s.date === dateStr));

  if (shiftType !== 'off') {
    let startTime = '08:00';
    let endTime = '16:00';
    let typeName: DoctorShift['shiftType'] = 'General Consultation';
    let room = doctor.roomLocation;
    let maxPatients = 20;
    let bookedPatients = Math.floor(Math.random() * 8) + 5;
    let note = customNote || `เวรตรวจ${shiftType === 'morning' ? 'เช้า' : shiftType === 'afternoon' ? 'บ่าย' : 'ดึก'} (อัปเดตโดยเจ้าหน้าที่ธุรการ)`;

    if (shiftType === 'morning') {
      startTime = '08:00';
      endTime = '16:00';
      typeName = 'General Consultation';
    } else if (shiftType === 'afternoon') {
      startTime = '16:00';
      endTime = '00:00';
      typeName = 'After-hours';
      maxPatients = 15;
    } else if (shiftType === 'night') {
      startTime = '00:00';
      endTime = '08:00';
      typeName = 'After-hours';
      room = 'ห้องตรวจเวรดึก/ฉุกเฉิน';
      maxPatients = 10;
    }

    let status: DoctorShift['status'] = 'Scheduled';
    if (dateStr < todayStr) status = 'Completed';
    else if (dateStr === todayStr) status = 'In Progress';

    const newShift: DoctorShift = {
      id: `shift-sync-${doctor.id.toLowerCase()}-${dateStr}-${Date.now() % 100000}`,
      doctorName: doctor.name,
      doctorId: doctor.id,
      doctorUsername: doctor.username,
      department: doctor.department,
      date: dateStr,
      startTime,
      endTime,
      shiftType: typeName,
      roomLocation: room,
      maxPatients,
      bookedPatients,
      status,
      note,
    };

    filtered.push(newShift);
  } else {
    // If 'off', we can add a Leave/Off record or cancel it
    const newOffShift: DoctorShift = {
      id: `shift-sync-${doctor.id.toLowerCase()}-${dateStr}-${Date.now() % 100000}`,
      doctorName: doctor.name,
      doctorId: doctor.id,
      doctorUsername: doctor.username,
      department: doctor.department,
      date: dateStr,
      startTime: '08:00',
      endTime: '16:00',
      shiftType: 'Leave / Off',
      roomLocation: '-',
      maxPatients: 0,
      bookedPatients: 0,
      status: 'Cancelled',
      note: customNote || 'วันหยุดตามตารางที่ธุรการกำหนด',
    };
    filtered.push(newOffShift);
  }

  saveStoredDoctorShifts(filtered);
}

/**
 * Apply batch schedule creation from Officer
 */
export function applyOfficerBatchSchedule(
  doctorId: string,
  dates: string[],
  shiftType: 'morning' | 'afternoon' | 'night'
) {
  const overrides = getStoredCalendarOverrides();
  dates.forEach(dateStr => {
    if (!overrides[dateStr]) overrides[dateStr] = {};
    overrides[dateStr][doctorId] = shiftType;
    syncOfficerShiftToDoctorSchedule(
      doctorId,
      dateStr,
      shiftType,
      `สร้างตารางงานชุด (Batch Schedule) โดยธุรการ`
    );
  });
  saveStoredCalendarOverrides(overrides);
}

/**
 * Apply daily shift edits from Officer
 */
export function applyOfficerDayEdit(
  dateStr: string,
  doctorShiftsMap: Record<string, 'morning' | 'afternoon' | 'night' | 'off'>
) {
  const overrides = getStoredCalendarOverrides();
  overrides[dateStr] = doctorShiftsMap;
  saveStoredCalendarOverrides(overrides);

  Object.entries(doctorShiftsMap).forEach(([docId, shiftType]) => {
    syncOfficerShiftToDoctorSchedule(
      docId,
      dateStr,
      shiftType,
      `ปรับเปลี่ยนเวรประจำวัน (${dateStr}) โดยธุรการ`
    );
  });
}
