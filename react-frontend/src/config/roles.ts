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
};

// เมนูใน Sidebar สำหรับแต่ละ Role
export const ROLE_MENUS: Record<UserRole, NavItem[]> = {
  registrar: [
    { id: 'registration', title: 'ลงทะเบียนผู้ป่วย', iconType: 'registration', path: '/registration' },
    { id: 'queue', title: 'จัดการคิว', iconType: 'queue', path: '/queue' },
    { id: 'eligibility', title: 'ตรวจสอบสิทธิ์การรักษา', iconType: 'eligibility', path: '/eligibility' },
  ],
  nurse: [
    { id: 'queue', title: 'จัดการคิว', iconType: 'queue', path: '/queue' },
    { id: 'vitals', title: 'บันทึกสัญญาณชีพ', iconType: 'vitals', path: '/vitals' },
    { id: 'vitals-history', title: 'ประวัติการคัดกรอง', iconType: 'history', path: '/vitals-history' },
  ],
};

// หน้าเริ่มต้นเมื่อ Login เข้าสู่ระบบตาม Role
export const ROLE_DEFAULT_PAGES: Record<UserRole, string> = {
  registrar: 'registration',
  nurse: 'queue',
};

// กำหนดว่าแต่ละหน้าอนุญาตให้ Role ใดเข้าถึงได้บ้าง (Role-based Route Permissions)
export const PAGE_PERMISSIONS: Record<string, UserRole[]> = {
  'registration': ['registrar'],
  'queue': ['registrar', 'nurse'],
  'eligibility': ['registrar'],
  'vitals': ['nurse'],
  'vitals-history': ['nurse'],
};