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
    id: 'user-doc-01',
    username: 'doctor1',
    fullName: 'นพ. สมเกียรติ รักษาดี',
    role: 'doctor',
    roleTitleTh: 'แพทย์ประจำคลินิก',
    roleTitleEn: 'Doctor',
    department: 'แผนกตรวจโรคทั่วไป',
    avatarText: 'SK',
    avatarColor: '#EF4444',
  },
  admin: {
    id: 'user-admin-01', username: 'admin1', fullName: 'คุณอารยา ดีมาก',
    role: 'admin', roleTitleTh: 'ผู้ดูแลระบบ', roleTitleEn: 'System Admin', department: 'แผนกไอที', avatarText: 'AD', avatarColor: '#1E40AF', email: 'aranya.admin@clinic.com'
  }
};

// เมนูใน Sidebar สำหรับแต่ละ Role
export const ROLE_MENUS: Record<UserRole, NavItem[]> = {
  registrar: [
    { id: 'registration', title: 'ลงทะเบียนผู้ป่วย', iconType: 'registration', path: '/registration' },
    { id: 'queue', title: 'จัดการคิว', iconType: 'queue', path: '/queue' },
    { id: 'eligibility', title: 'ตรวจสอบสิทธิ์การรักษา', iconType: 'eligibility', path: '/eligibility' },
    { id: 'appointment-dashboard', title: 'แดชบอร์ดนัดหมาย', iconType: 'dashboard', path: '/appointment-dashboard' }, // เพิ่มให้ registrar
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
    { id: 'appointment-dashboard', title: 'แดชบอร์ดนัดหมาย', iconType: 'dashboard', path: '/appointment-dashboard' },
    { id: 'appointment-form', title: 'สร้างนัดหมายใหม่', iconType: 'appointment', path: '/appointment-form' },
  ],
  admin: [
    { id: 'admin-users', title: 'จัดการบัญชีผู้ใช้งาน', iconType: 'admin-users', path: '/admin-users' },
    { id: 'admin-access', title: 'จัดการสิทธิ์การใช้งานระบบ', iconType: 'admin-access', path: '/admin-access' },
  ]
};

// หน้าเริ่มต้นเมื่อ Login เข้าสู่ระบบตาม Role
export const ROLE_DEFAULT_PAGES: Record<UserRole, string> = {
  registrar: 'registration',
  nurse: 'queue',
  nurse_assistant: 'queue',
  pharmacist: 'pharmacy-dispense',
  cashier: 'billing-dispense',
  doctor: 'appointment-dashboard',
  admin: 'admin-users',
};

// กำหนดว่าแต่ละหน้าอนุญาตให้ Role ใดเข้าถึงได้บ้าง (Role-based Route Permissions)
export const PAGE_PERMISSIONS: Record<string, UserRole[]> = {
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
  'appointment-dashboard': ['registrar', 'doctor', 'nurse', 'nurse_assistant', 'pharmacist', 'cashier'], 
  'admin-users': ['admin'],
  'admin-access': ['admin'],
};