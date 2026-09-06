import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, UserRole } from '../types/auth';
import { DEMO_USERS, ROLE_DEFAULT_PAGES, PAGE_PERMISSIONS } from '../config/roles';

// โค้ดส่วนของเพื่อน (ระบบเชื่อม Backend)
import { authApi } from '../services/api';

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
  login: (roleOrUsername: string, password?: string) => Promise<boolean>;
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
  
  // ของเพื่อน: ดึงข้อมูล User
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem(AUTH_STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
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

  // ของเพื่อน: ระบบล็อกอิน
  const login = async (roleOrUsername: string, password?: string): Promise<boolean> => {
    try {
      let usernameToSend = roleOrUsername;
      if (roleOrUsername === 'registrar') usernameToSend = 'registrar1';
      else if (roleOrUsername === 'nurse') usernameToSend = 'nurse1';
      else if (roleOrUsername === 'nurse_assistant') usernameToSend = 'assistant1';
      else if (roleOrUsername === 'doctor') usernameToSend = 'doctor1';
      else if (roleOrUsername === 'pharmacist') usernameToSend = 'pharmacist1';
      else if (roleOrUsername === 'cashier') usernameToSend = 'cashier1';

      const res = await authApi.login(usernameToSend, password || 'password');
      if (res && res.user) {
        const userRole = res.user.role as UserRole;
        const fallback = DEMO_USERS[userRole] || DEMO_USERS['registrar'];
        const loggedInUser: User = {
          id: String(res.user.id),
          username: res.user.username,
          fullName: res.user.fullname || fallback.fullName,
          role: userRole,
          roleTitleTh: fallback.roleTitleTh,
          roleTitleEn: fallback.roleTitleEn,
          department: fallback.department,
          avatarText: fallback.avatarText,
          avatarColor: fallback.avatarColor,
        };
        setCurrentUser(loggedInUser);
        return true;
      }
    } catch (err) {
      console.warn('Backend login error, checking fallback:', err);
    }

    let matchedUser: User | undefined;
    if (roleOrUsername in DEMO_USERS) {
      matchedUser = DEMO_USERS[roleOrUsername as UserRole];
    } else {
      matchedUser = Object.values(DEMO_USERS).find((u) => u.username === roleOrUsername);
    }

    if (matchedUser) {
      setCurrentUser(matchedUser);
      return true;
    }
    return false;
  };

  const switchRole = async (role: UserRole) => {
    let username = 'cashier1';
    if (role === 'registrar') username = 'registrar1';
    else if (role === 'nurse') username = 'nurse1';
    else if (role === 'nurse_assistant') username = 'assistant1';
    else if (role === 'doctor') username = 'doctor1';
    else if (role === 'pharmacist') username = 'pharmacist1';
    else if (role === 'cashier') username = 'cashier1';

    try {
      await authApi.login(username, 'password');
    } catch {
      // ignore
    }

    const targetUser = DEMO_USERS[role];
    if (targetUser) {
      setCurrentUser(targetUser);
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