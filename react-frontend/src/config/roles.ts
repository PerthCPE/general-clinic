import type { User, UserRole, NavItem } from '../types/auth';

// รายชื่อผู้ใช้ตัวอย่างตามแต่ละ Role เพื่อใช้ในการล็อกอินและทดสอบ
export const DEMO_USERS: Record<UserRole, User> = {
  registrar: {
    id: 'user-reg-01',
    username: 'registrar1',
    fullName: 'คุณสุภาพร เวชระเบียน',
    role: 'registrar',
    roleTitleTh: 'เจ้าหน้าที่เวชระเบียน',
    roleTitleEn: 'Registrar',
    department: 'แผนกเวชระเบียน',
    avatarText: 'SP',
    avatarColor: '#2563EB',
  },
  nurse: {
    id: 'user-nur-01',
    username: 'nurse1',
    fullName: 'พว. กานดา คัดกรอง',
    role: 'nurse',
    roleTitleTh: 'พยาบาลคัดกรอง',
    roleTitleEn: 'Nurse',
    department: 'แผนกคัดกรอง',
    avatarText: 'KD',
    avatarColor: '#10B981',
  },
  nurse_assistant: {
    id: 'user-asst-01',
    username: 'assistant1',
    fullName: 'คุณมาลี ช่วยพยาบาล',
    role: 'nurse_assistant',
    roleTitleTh: 'ผู้ช่วยพยาบาล',
    roleTitleEn: 'Nurse Assistant',
    department: 'แผนกคัดกรอง',
    avatarText: 'ML',
    avatarColor: '#0D9488',
  },
  pharmacist: {
    id: 'user-phar-01',
    username: 'pharmacist1',
    fullName: 'ดร.บุญ สั่งยา',
    role: 'pharmacist',
    roleTitleTh: 'เภสัชกรคลังยา',
    roleTitleEn: 'Pharmacist',
    department: 'แผนกห้องยา',
    avatarText: 'SC',
    avatarColor: '#8B5CF6',
  },
  cashier: {
    id: 'user-cash-01',
    username: 'cashier1',
    fullName: 'นส.รวย การเงิน',
    role: 'cashier',
    roleTitleTh: 'เจ้าหน้าที่การเงิน',
    roleTitleEn: 'Cashier',
    department: 'แผนกการเงิน',
    avatarText: 'AN',
    avatarColor: '#F59E0B',
  },
  doctor: {
    id: 'DOC-1',
    username: 'doctor1',
    fullName: 'พญ.สุดา สุขสมบูรณ์',
    role: 'doctor',
    roleTitleTh: 'แพทย์ผู้ตรวจ (สูตินรีเวช)',
    roleTitleEn: 'Doctor',
    department: 'แผนกสูตินรีเวช',
    avatarText: 'SS',
    avatarColor: '#DC2626',
  },
  admin: {
    id: 'user-admin-01', username: 'admin1', fullName: 'คุณอารยา ดีมาก',
    role: 'admin', roleTitleTh: 'ผู้ดูแลระบบ', roleTitleEn: 'System Admin', department: 'แผนกไอที', avatarText: 'AD', avatarColor: '#1E40AF', email: 'aranya.admin@clinic.com'
  },
  officer: {
    id: 'user-off-01',
    username: 'officer1',
    fullName: 'คุณสมจิต ดีใจ',
    role: 'officer',
    roleTitleTh: 'เจ้าหน้าที่ธุรการ',
    roleTitleEn: 'Administrative Officer',
    department: 'แผนกธุรการ',
    avatarText: 'SJ',
    avatarColor: '#EC4899',
  },
};

// รายชื่อแผนกการรักษาจริงของคลินิก — single source of truth ให้ทั้งระบบใช้ร่วมกัน
// อ้างอิงตรงจากค่า doctors.specialty จริงในฐานข้อมูล (ดู golang-backend/internal/config/db.go
// seedDoctorProfiles) ห้ามเพิ่มชื่อแผนกใหม่ที่นี่โดยไม่มี specialty จริงในตาราง doctors รองรับ
// ไม่งั้นจะย้อนกลับไปเป็นปัญหาเดิม (แต่ละหน้าคิดชื่อแผนกขึ้นเองไม่ตรงกัน)
//
// ใช้ร่วมกันใน: หน้าจัดการบัญชี (UserManagement.tsx, ตำแหน่ง "แพทย์"),
// ฟอร์มนัดหมาย (AppointmentForm.tsx), และแดชบอร์ดนัดหมาย (AppointmentDashboard.tsx)
export const TREATMENT_DEPARTMENTS = ['อายุรกรรมทั่วไป', 'เวชศาสตร์ครอบครัว', 'กุมารเวชกรรม'];

// เมนูใน Sidebar สำหรับแต่ละ Role
export const ROLE_MENUS: Record<UserRole, NavItem[]> = {
  registrar: [
    { id: 'registration', title: 'ลงทะเบียนผู้ป่วย', iconType: 'registration', path: '/registration' },
    { id: 'queue', title: 'จัดการคิว', iconType: 'queue', path: '/queue' },
    { id: 'eligibility', title: 'ตรวจสอบสิทธิ์การรักษา', iconType: 'eligibility', path: '/eligibility' },
    { id: 'appointment-dashboard', title: 'แดชบอร์ดนัดหมาย', iconType: 'dashboard', path: '/appointment-dashboard' },
  ],
  nurse: [
    { id: 'queue', title: 'จัดการคิว', iconType: 'queue', path: '/queue' },
    { id: 'vitals', title: 'บันทึกสัญญาณชีพ', iconType: 'vitals', path: '/vitals' },
    { id: 'vitals-history', title: 'ประวัติการคัดกรอง', iconType: 'history', path: '/vitals-history' },
  ],
  nurse_assistant: [
    { id: 'queue', title: 'จัดการคิว', iconType: 'queue', path: '/queue' },
    { id: 'vitals', title: 'บันทึกสัญญาณชีพ', iconType: 'vitals', path: '/vitals' },
    { id: 'vitals-history', title: 'ประวัติการคัดกรอง', iconType: 'history', path: '/vitals-history' },
  ],
  pharmacist: [
    { id: 'pharmacy-dispense', title: 'บันทึกและจ่ายยา', iconType: 'dispense', path: '/pharmacy-dispense' },
    { id: 'pharmacy-stock', title: 'คลังยา', iconType: 'stock', path: '/pharmacy-stock' },
    { id: 'pharmacy-history', title: 'ประวัติการรับยา', iconType: 'history', path: '/pharmacy-history' },
  ],
  cashier: [
    { id: 'billing-dispense', title: 'ชำระค่ายา', iconType: 'dispense', path: '/billing-dispense' },
    { id: 'billing-invoice', title: 'ออกใบแจ้งหนี้', iconType: 'invoice', path: '/billing-invoice' },
    { id: 'billing-dashboard', title: 'แดชบอร์ด', iconType: 'dashboard', path: '/billing-dashboard' },
  ],
  doctor: [
    { id: 'doctor-queue', title: 'คิวผู้ป่วย', iconType: 'queue', path: '/doctor-queue' },
    { id: 'doctor-examination', title: 'บันทึกการตรวจ', iconType: 'examination', path: '/doctor-examination' },
    { id: 'doctor-schedule', title: 'ตารางเวร', iconType: 'schedule', path: '/doctor-schedule' },
    { id: 'doctor-records', title: 'ประวัติเวชระเบียน', iconType: 'records', path: '/doctor-records' },
    { id: 'appointment-form', title: 'สร้างนัดหมาย', iconType: 'calendar', path: '/appointment-form' },
    { id: 'appointment-dashboard', title: 'แดชบอร์ดนัดหมาย', iconType: 'dashboard', path: '/appointment-dashboard' },
  ],
  admin: [
    { id: 'admin-users', title: 'จัดการบัญชีผู้ใช้งาน', iconType: 'admin-users', path: '/admin-users' },
    { id: 'admin-access', title: 'จัดการสิทธิ์การใช้งานระบบ', iconType: 'admin-access', path: '/admin-access' },
  ],
  officer: [
    { id: 'dms-documents', title: 'การจัดการเอกสาร', iconType: 'document', path: '/dms-documents' },
    { id: 'dms-forward', title: 'ส่งต่อเอกสาร', iconType: 'forward', path: '/dms-forward' },
    { id: 'dms-schedule', title: 'จัดการตารางงานแพทย์', iconType: 'calendar', path: '/dms-schedule' },
  ],
};

// หน้าเริ่มต้นเมื่อ Login เข้าสู่ระบบตาม Role
export const ROLE_DEFAULT_PAGES: Record<UserRole, string> = {
  registrar: 'registration',
  nurse: 'queue',
  nurse_assistant: 'queue',
  pharmacist: 'pharmacy-dispense',
  cashier: 'billing-dispense',
  doctor: 'doctor-queue',
  admin: 'admin-users',
  officer: 'dms-documents',
};

// กำหนดว่าแต่ละหน้าอนุญาตให้ Role ใดเข้าถึงได้บ้าง (Role-based Route Permissions)
export const PAGE_PERMISSIONS: Record<string, UserRole[]> = {
  'dms-documents': ['officer'],
  'dms-schedule': ['officer'],
  'dms-forward': ['officer'],
  'registration': ['registrar'],
  'queue': ['registrar', 'nurse', 'nurse_assistant'],
  'eligibility': ['registrar'],
  'vitals': ['nurse', 'nurse_assistant'],
  'vitals-history': ['nurse', 'nurse_assistant'],
  'pharmacy-dispense': ['pharmacist'],
  'pharmacy-stock': ['pharmacist'],
  'pharmacy-history': ['pharmacist'],
  'billing-dispense': ['cashier'],
  'billing-invoice': ['cashier'],
  'billing-dashboard': ['cashier'],
  'appointment-form': ['doctor'],
  'appointment-dashboard': ['doctor', 'registrar'],
  'admin-users': ['admin'],
  'admin-access': ['admin'],
  'doctor-dashboard': ['doctor'],
  'doctor-queue': ['doctor'],
  'doctor-examination': ['doctor'],
  'doctor-schedule': ['doctor'],
  'doctor-records': ['doctor'],
};

// สร้างจาก PAGE_PERMISSIONS อัตโนมัติ (reverse index: role -> รายชื่อหน้าที่เข้าถึงได้)
// ไม่ต้อง maintain แยกอีกชุด — ใช้ใน GrantAccess.tsx เพื่อแสดงสิทธิ์จริงตาม role แบบอ่านอย่างเดียว
// สะท้อนสิ่งที่ hasAccess()/PAGE_PERMISSIONS บังคับใช้จริงในแอปโดยตรง จึงไม่มีทางเพี้ยนไปจากของจริง
export const ROLE_PAGE_ACCESS: Record<UserRole, string[]> = (() => {
  const result: Record<UserRole, string[]> = {
    registrar: [], nurse: [], nurse_assistant: [], pharmacist: [],
    cashier: [], doctor: [], admin: [], officer: [],
  };
  for (const [pageId, roles] of Object.entries(PAGE_PERMISSIONS)) {
    roles.forEach((role) => {
      result[role].push(pageId);
    });
  }
  return result;
})();

// ชื่อหน้าที่อ่านง่ายสำหรับแสดงผล — ดึงจาก title ที่ประกาศไว้แล้วใน ROLE_MENUS ทุก role มารวมกัน
// (pageId ไหนไม่มีอยู่ใน ROLE_MENUS เลย เช่น 'doctor-dashboard' ที่ไม่มีลิงก์ sidebar จะ fallback เป็น pageId ตรงๆ)
export const PAGE_TITLES: Record<string, string> = Object.values(ROLE_MENUS)
  .flat()
  .reduce((acc, item) => {
    acc[item.id] = item.title;
    return acc;
  }, {} as Record<string, string>);

// ตารางกำหนดสิทธิ์ระดับ API Endpoints (Backend Middleware Alignment & Parity)
// หมายเหตุ: พยาบาลและผู้ช่วยพยาบาลได้รับสิทธิ์ API-only ในการค้นหา/ดูข้อมูลผู้ป่วย (GET /api/registrar/*)
// เพื่อใช้อ้างอิงประวัติก่อนคัดกรอง แต่การลงทะเบียนและแก้ไขข้อมูล (POST/PUT) สงวนไว้ให้เจ้าหน้าที่เวชระเบียน (registrar) เท่านั้น
export const API_ROLE_PERMISSIONS = {
  registrarRead: ['registrar', 'nurse', 'nurse_assistant', 'doctor'],
  registrarWrite: ['registrar'],
  nurseRead: ['nurse', 'nurse_assistant', 'doctor', 'registrar'],
  nurseWrite: ['nurse', 'nurse_assistant'],
  queueManagement: ['registrar', 'nurse', 'nurse_assistant', 'doctor', 'pharmacist', 'cashier'],
  doctorOnly: ['doctor'],
  billing: ['cashier', 'admin'],
  admin: ['admin'],
} as const;