import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, UserRole } from '../types/auth';
import { DEMO_USERS, ROLE_DEFAULT_PAGES, PAGE_PERMISSIONS } from '../config/roles';

// โค้ดส่วนของเพื่อน (ระบบเชื่อม Backend)
import { authApi, ApiRequestError } from '../services/api';

// โค้ดส่วนของคุณ (ระบบคิวและนัดหมาย)
export interface PatientQueueItem {
  id: number;
  name: string;
  initial: string;
  dept: string;
  date: string;
  time: string;
  phone: string;
  status: string;
  statusColor: string;
  deptColor: string;
  notes?: string;
}

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  login: (roleOrUsername: string, password?: string) => Promise<{ success: boolean; requiresPasswordChange?: boolean; error?: string }>;
  // ทางลัด dev/test เท่านั้น สำหรับปุ่ม "Quick Test Login" ในหน้า login — เรียก backend
  // endpoint พิเศษที่ reset status บัญชี seed กลับเป็น active ให้ก่อนเสมอ ไม่เช็ค password
  // ต่างจาก login() ด้านบนที่ยังต้องผ่านการเช็ค password/status ตามจริงทุกประการเหมือนเดิม
  quickDevLogin: (role: UserRole) => Promise<{ success: boolean; requiresPasswordChange?: boolean; error?: string }>;
  switchRole: (role: UserRole) => Promise<void>;
  logout: () => void;
  hasAccess: (pageId: string) => boolean;
  defaultPage: string;
  
  patientQueue: PatientQueueItem[];
  addAppointment: (item: PatientQueueItem) => void;
  updateAppointment: (id: number, updates: Partial<PatientQueueItem>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'clinic_auth_user';
const QUEUE_STORAGE_KEY = 'clinic_queue_data_v3'; 

const getTodayDateString = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const todayStr = getTodayDateString();

const initialDefaultQueue: PatientQueueItem[] = [
  { id: 1, name: 'อนันต์ สุขสวัสดิ์', initial: 'อน', dept: 'โรคทั่วไป', date: '2026-08-08', time: '09:00', phone: '081-456-7890', status: '-', statusColor: 'default', deptColor: 'primary' },
  { id: 2, name: 'วิมล มั่นคง', initial: 'วม', dept: 'อายุรกรรม', date: '2026-08-08', time: '09:30', phone: '089-123-4567', status: '-', statusColor: 'default', deptColor: 'warning' },
  { id: 3, name: 'เกียรติศักดิ์ ศรีสุข', initial: 'กศ', dept: 'จิตวิทยา', date: '2026-08-08', time: '10:00', phone: '082-987-6543', status: '-', statusColor: 'default', deptColor: 'secondary' },
  { id: 4, name: 'พงษ์ศักดิ์ แสนดี', initial: 'พศ', dept: 'กายภาพบำบัด', date: '2026-08-08', time: '10:30', phone: '085-333-2211', status: '-', statusColor: 'default', deptColor: 'success' },
  { id: 5, name: 'สมชาย ใจดี', initial: 'สช', dept: 'โรคทั่วไป', date: '2026-08-08', time: '11:00', phone: '088-777-8899', status: '-', statusColor: 'default', deptColor: 'primary' },
  { id: 6, name: 'นภา  งามตา', initial: 'นภ', dept: 'อายุรกรรม', date: '2026-08-08', time: '13:00', phone: '086-555-4321', status: '-', statusColor: 'default', deptColor: 'warning' },
  { id: 7, name: 'ประเสริฐ เลิศพงษ์', initial: 'ปร', dept: 'โรคทั่วไป', date: '2026-08-08', time: '13:30', phone: '084-111-9988', status: '-', statusColor: 'default', deptColor: 'primary' },
  { id: 8, name: 'วรรณา รัก,ไทย', initial: 'วน', dept: 'กายภาพบำบัด', date: '2026-08-08', time: '14:00', phone: '083-666-5544', status: '-', statusColor: 'default', deptColor: 'success' },
];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  
  // ของเพื่อน: ดึงข้อมูล User (ซิงค์ชื่อและข้อมูลล่าสุดตาม DEMO_USERS เสมอ ไม่ให้ติดแคชเก่า)
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem(AUTH_STORAGE_KEY);
    if (saved) {
      try {
        const parsed: User = JSON.parse(saved);
        if (parsed && parsed.role && DEMO_USERS[parsed.role as UserRole]) {
          const latest = DEMO_USERS[parsed.role as UserRole];
          return {
            ...parsed,
            // คงชื่อจริงที่ login มา (fullName) ไว้ — ไม่ override ด้วย DEMO_USERS
            roleTitleTh: parsed.roleTitleTh || latest.roleTitleTh,
            roleTitleEn: parsed.roleTitleEn || latest.roleTitleEn,
            avatarColor: parsed.avatarColor || latest.avatarColor,
          };
        }
        return parsed;
      } catch {
        return null;
      }
    }
    return null;
  });

  const [patientQueue, setPatientQueue] = useState<PatientQueueItem[]>(() => {
    const saved = localStorage.getItem(QUEUE_STORAGE_KEY);
    return saved ? JSON.parse(saved) : initialDefaultQueue;
  });

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }, [currentUser]);

  // ของคุณ: อัปเดตคิว
  useEffect(() => {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(patientQueue));
  }, [patientQueue]);

  const addAppointment = (item: PatientQueueItem) => {
    setPatientQueue(prev => [item, ...prev]);
  };

  const updateAppointment = (id: number, updates: Partial<PatientQueueItem>) => {
    setPatientQueue(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  // ของใหม่: ระบบข้อมูลแบบ Real-time (WebSocket)
  useEffect(() => {
    if (!currentUser) return; // เฉพาะตอนล็อกอินถึงจะเชื่อมต่อ WS

    // เชื่อมต่อไปยัง Go Backend WebSocket
    const wsUrl = `ws://localhost:8080/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[WS] Connected (Real-time Sync Active)');
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        console.log('[WS] Received real-time event:', payload);

        // คุณสามารถนำข้อมูลนี้ไปอัปเดต State หรือโชว์ Notification ได้ที่นี่
        if (payload.type === 'QUEUE_CREATED') {
          // ตัวอย่าง: ถ้าเป็นข้อมูลคิวที่เพิ่มเข้ามาใหม่ สามารถเรียก addAppointment ได้
          // addAppointment({...});
        }
      } catch (err) {
        console.error('WebSocket message parse error', err);
      }
    };

    ws.onclose = () => {
      console.log('[WS] Disconnected');
    };

    return () => {
      ws.close();
    };
  }, [currentUser]);

  // ของเพื่อน: แปลง response จริงจาก backend (login ปกติ หรือ quick-login) ให้เป็น User —
  // ใช้ร่วมกันทั้ง login() และ quickDevLogin() เพื่อไม่ให้ logic การสร้าง avatar/fallback
  // ข้อมูลตกหล่นไม่ตรงกันระหว่างสองทาง
  const buildUserFromLoginResponse = (res: {
    user: { id: number; username: string; fullname: string; role: string; phone: string };
  }): User => {
    const userRole = res.user.role as UserRole;
    const fallback = DEMO_USERS[userRole] || DEMO_USERS['registrar'];

    // ใช้ชื่อจริงจาก API เสมอ — ไม่ hardcode ชื่อตาม username/role
    const fullName = res.user.fullname || res.user.username;
    // สร้าง avatar text จากชื่อจริง (2 ตัวอักษรแรก)
    const nameParts = fullName.replace(/^(นพ\.|พญ\.|นพ|พญ)\./i, '').trim();
    const avatarText = nameParts.substring(0, 2) || fallback.avatarText;

    return {
      id: String(res.user.id),
      username: res.user.username,
      fullName,
      role: userRole,
      roleTitleTh: fallback.roleTitleTh,
      roleTitleEn: fallback.roleTitleEn,
      department: fallback.department,
      avatarText,
      avatarColor: fallback.avatarColor,
    };
  };

  // ของเพื่อน: ระบบล็อกอิน
  const login = async (roleOrUsername: string, password?: string): Promise<{ success: boolean; requiresPasswordChange?: boolean; error?: string }> => {
    try {
      let usernameToSend = roleOrUsername;
      if (roleOrUsername === 'registrar') usernameToSend = 'registrar1';
      else if (roleOrUsername === 'nurse') usernameToSend = 'nurse1';
      else if (roleOrUsername === 'nurse_assistant') usernameToSend = 'assistant1';
      else if (roleOrUsername === 'doctor') usernameToSend = 'doctor1';
      else if (roleOrUsername === 'pharmacist') usernameToSend = 'pharmacist1';
      else if (roleOrUsername === 'cashier') usernameToSend = 'cashier1';

      // ไม่มี default password ที่ใช้ได้กับทุกบัญชีอีกต่อไป — แต่ละบัญชีมี employee_id ของ
      // ตัวเองเป็นรหัสผ่านเริ่มต้น ถ้าไม่ได้ส่ง password มาจริงๆ (ไม่ควรเกิดจากฟอร์ม login ปกติ
      // ที่บังคับกรอกทั้งสองช่องอยู่แล้ว) ปล่อยว่างให้ backend ตอบ 401 ตามจริงดีกว่าเดา
      const res = await authApi.login(usernameToSend, password ?? '');
      if (res && res.user) {
        setCurrentUser(buildUserFromLoginResponse(res));
        return { success: true, requiresPasswordChange: res.requires_password_change };
      }
    } catch (err) {
      // สำคัญ: ต้องแยกให้ออกว่า backend "ปฏิเสธ login จริง" (มี HTTP response กลับมา เช่น 401
      // รหัสผ่านผิด หรือ 403 บัญชีถูกระงับ) กับ backend "ติดต่อไม่ได้เลย" (เน็ตหลุด/server ล่ม)
      // เดิมโค้ดนี้ catch แล้ว fallback ไป local demo login (ด้านล่าง) ทุกกรณีแบบไม่แยก — พอ
      // backend ปฏิเสธ login ที่ถูกต้องแล้ว (เช่น บัญชีถูกระงับ) โค้ดกลับไป match DEMO_USERS ด้วย
      // username เดิม แล้ว setCurrentUser() ให้ "สำเร็จ" แบบปลอมๆ ทั้งที่ไม่เคยได้ token จริง
      // จาก backend เลย พอหน้าถัดไปเรียก API ใดๆ ก็เจอ "ไม่มี token" แล้ว reload กลับไปหน้า login
      // ทันที (ถูกต้องแล้วตามเงื่อนไข 401) — แต่ผลลัพธ์ที่ผู้ใช้เห็นคือ login ดูเหมือนสำเร็จแวบเดียว
      // แล้วจอกระพริบรีโหลดวนซ้ำทุกครั้งที่ลอง เพราะ fake login ใหม่ทุกรอบไม่เคยมี token จริงสักที
      //
      // ฉะนั้นถ้า backend ตอบกลับมาจริง (ApiRequestError มี status) ให้เชื่อคำตอบนั้นตรงๆ
      // ไม่ fallback ไป local demo เด็ดขาด — คืน failure พร้อม error message จริงจาก backend
      // (เช่น "บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ") ให้ผู้ใช้เห็นเฉยๆ ไม่มี reload
      if (err instanceof ApiRequestError) {
        console.warn('Backend rejected login (not falling back to local demo):', err.message);
        return { success: false, error: err.message };
      }
      // เคสนี้เหลือแค่ backend ติดต่อไม่ได้จริงๆ (network error) — fallback ไป local demo ต่อได้
      console.warn('Backend unreachable, checking local fallback:', err);
    }

    let matchedUser: User | undefined;
    if (roleOrUsername === 'doctor2') {
      matchedUser = {
        id: 'DOC-2',
        username: 'doctor2',
        fullName: 'นพ.วิชัย ชาญการแพทย์',
        role: 'doctor',
        roleTitleTh: 'แพทย์ผู้ตรวจ (อายุรกรรม)',
        roleTitleEn: 'Doctor',
        department: 'แผนกอายุรกรรมทั่วไป',
        avatarText: 'WC',
        avatarColor: '#DC2626',
      };
    } else if (roleOrUsername === 'doctor3') {
      matchedUser = {
        id: 'DOC-3',
        username: 'doctor3',
        fullName: 'พญ.เกศรา รักษาดี',
        role: 'doctor',
        roleTitleTh: 'แพทย์ผู้ตรวจ (กุมารเวชกรรม)',
        roleTitleEn: 'Doctor',
        department: 'แผนกกุมารเวชกรรม',
        avatarText: 'KR',
        avatarColor: '#DC2626',
      };
    } else if (roleOrUsername in DEMO_USERS) {
      matchedUser = DEMO_USERS[roleOrUsername as UserRole];
    } else {
      matchedUser = Object.values(DEMO_USERS).find((u) => u.username === roleOrUsername);
    }

    if (matchedUser) {
      setCurrentUser(matchedUser);
      return { success: true, requiresPasswordChange: false };
    }
    return { success: false };
  };

  // ทางลัด dev/test เท่านั้น สำหรับปุ่ม "Quick Test Login" — ไม่ fallback ไป local demo เลย
  // ถ้า backend ปฏิเสธ (เช่น dev mode ปิดอยู่ที่ backend ตอบ 403 "Quick login is only
  // available in dev mode") เพราะปุ่มนี้มีไว้ให้เห็นสถานะจริงของ dev mode ตรงๆ ไม่ใช่ปิดบัง
  // ด้วย fake login เหมือนบั๊กเดิมที่เพิ่งแก้ไปใน login() ด้านบน
  const quickDevLogin = async (role: UserRole): Promise<{ success: boolean; requiresPasswordChange?: boolean; error?: string }> => {
    try {
      const res = await authApi.quickLogin(role);
      if (res && res.user) {
        setCurrentUser(buildUserFromLoginResponse(res));
        return { success: true, requiresPasswordChange: res.requires_password_change };
      }
      return { success: false, error: 'ไม่พบข้อมูลผู้ใช้จาก quick login' };
    } catch (err) {
      const message = err instanceof ApiRequestError ? err.message : 'เชื่อมต่อ backend ไม่ได้';
      console.warn('quickDevLogin failed:', err);
      return { success: false, error: message };
    }
  };

  const switchRole = async (role: UserRole) => {
    // แต่ละบัญชี seed มี employee_id เป็นรหัสผ่านของตัวเอง ไม่มี 'password' กลางที่ใช้ร่วมกัน
    // ได้อีกต่อไป ต้อง map username -> password ให้ตรงกันเป็นคู่ๆ
    const credentials: Partial<Record<UserRole, { username: string; password: string }>> = {
      registrar: { username: 'registrar1', password: 'REC001' },
      nurse: { username: 'nurse1', password: 'NUR001' },
      nurse_assistant: { username: 'assistant1', password: 'NUR002' },
      doctor: { username: 'doctor1', password: 'DOC001' },
      pharmacist: { username: 'pharmacist1', password: 'PHA001' },
      cashier: { username: 'cashier1', password: 'CAS001' },
      admin: { username: 'admin1', password: 'ADM001' },
      officer: { username: 'officer1', password: 'OFF001' },
    };
    const cred = credentials[role];
    if (!cred) return;

    try {
      const res = await authApi.login(cred.username, cred.password);
      // ตั้ง currentUser เฉพาะตอนที่ backend login สำเร็จจริง (ได้ token จริงกลับมา) เท่านั้น
      // เดิมโค้ดนี้ตั้ง currentUser แบบ fake เสมอไม่ว่า login จะสำเร็จหรือไม่ (catch แล้วเงียบ)
      // ถ้า backend ปฏิเสธ (เช่นบัญชีถูกระงับ) จะได้ currentUser ที่ไม่มี token จริงรองรับ —
      // พอเรียก API ถัดไปจะชน "ไม่มี token" แล้ว reload กลับไปหน้า login ทันที (บั๊กเดียวกับที่
      // เจอใน login() ด้านบน — ดูคอมเมนต์ตรงนั้นสำหรับรายละเอียดเต็ม)
      if (res && res.user) {
        setCurrentUser(DEMO_USERS[role]);
      }
    } catch (err) {
      console.warn('switchRole: login failed, not switching role:', err);
    }
  };

  const logout = () => {
    authApi.logout();
    setCurrentUser(null);
  };

  const hasAccess = (pageId: string): boolean => {
    if (!currentUser) return false;
    const allowedRoles = PAGE_PERMISSIONS[pageId];
    if (!allowedRoles) return true;
    return allowedRoles.includes(currentUser.role);
  };

  const defaultPage = currentUser ? ROLE_DEFAULT_PAGES[currentUser.role] : 'login';

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: currentUser !== null,
        login,
        quickDevLogin,
        switchRole,
        logout,
        hasAccess,
        defaultPage,
        patientQueue,
        addAppointment,
        updateAppointment,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};