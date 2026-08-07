import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, UserRole } from '../types/auth';
import { DEMO_USERS, ROLE_DEFAULT_PAGES, PAGE_PERMISSIONS } from '../config/roles';

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  login: (roleOrUsername: string, password?: string) => boolean;
  switchRole: (role: UserRole) => void;
  logout: () => void;
  hasAccess: (pageId: string) => boolean;
  defaultPage: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'clinic_auth_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // ค่าเริ่มต้น: เริ่มต้นที่ null เสมอ เพื่อให้เปิดเข้ามาที่หน้า Login เป็น Default
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const isAuthenticated = currentUser !== null;

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }, [currentUser]);

  // ฟังก์ชัน Login: รับ username หรือ role
  const login = (roleOrUsername: string, _password?: string): boolean => {
    let matchedUser: User | undefined;

    // เช็คกรณีส่ง role ตรงๆ เช่น "registrar", "nurse"
    if (roleOrUsername in DEMO_USERS) {
      matchedUser = DEMO_USERS[roleOrUsername as UserRole];
    } else {
      // เช็คตาม username เช่น "registrar1", "nurse1"
      matchedUser = Object.values(DEMO_USERS).find((u) => u.username === roleOrUsername);
    }

    if (matchedUser) {
      setCurrentUser(matchedUser);
      return true;
    }
    return false;
  };

  // ฟังก์ชันสลับ Role อย่างรวดเร็ว (สำหรับทดสอบ)
  const switchRole = (role: UserRole) => {
    const targetUser = DEMO_USERS[role];
    if (targetUser) {
      setCurrentUser(targetUser);
    }
  };

  // ฟังก์ชันออกจากระบบ
  const logout = () => {
    setCurrentUser(null);
  };

  // ฟังก์ชันตรวจสอบสิทธิ์การเข้าถึงหน้าเพจ (RBAC Check)
  const hasAccess = (pageId: string): boolean => {
    if (!currentUser) return false;
    const allowedRoles = PAGE_PERMISSIONS[pageId];
    if (!allowedRoles) return true; // หากไม่มีการกำหนดสิทธิ์ แปลว่าเป็นหน้าสาธารณะ
    return allowedRoles.includes(currentUser.role);
  };

  const defaultPage = currentUser ? ROLE_DEFAULT_PAGES[currentUser.role] : 'login';

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated,
        login,
        switchRole,
        logout,
        hasAccess,
        defaultPage,
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
