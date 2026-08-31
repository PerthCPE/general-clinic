import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, UserRole } from '../types/auth';
import { DEMO_USERS, ROLE_DEFAULT_PAGES, PAGE_PERMISSIONS } from '../config/roles';

import { authApi } from '../services/api';

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  login: (roleOrUsername: string, password?: string) => Promise<boolean>;
  switchRole: (role: UserRole) => Promise<void>;
  logout: () => void;
  hasAccess: (pageId: string) => boolean;
  defaultPage: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'clinic_auth_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // ค่าเริ่มต้น: เริ่มต้นที่ null เสมอ เพื่อให้เปิดเข้ามาที่หน้า Login เป็น Default
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

  const isAuthenticated = currentUser !== null;

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }, [currentUser]);

  // ฟังก์ชัน Login: เชื่อมต่อ Golang Backend จริงผ่าน authApi
  const login = async (roleOrUsername: string, password?: string): Promise<boolean> => {
    try {
      let usernameToSend = roleOrUsername;
      // หากส่งมาเป็น role ล้วนๆ ให้แปลงเป็น username เริ่มต้น
      if (roleOrUsername === 'registrar') usernameToSend = 'registrar1';
      else if (roleOrUsername === 'nurse') usernameToSend = 'nurse1';
      else if (roleOrUsername === 'nurse_assistant') usernameToSend = 'assistant1';
      else if (roleOrUsername === 'doctor') usernameToSend = 'doctor1';

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

    // Fallback: รองรับการเลือก Quick Role Switcher ในกรณีทดสอบ
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

  // ฟังก์ชันสลับ Role อย่างรวดเร็ว (สำหรับทดสอบ)
  const switchRole = async (role: UserRole) => {
    let username = 'registrar1';
    if (role === 'nurse') username = 'nurse1';
    else if (role === 'nurse_assistant') username = 'assistant1';
    else if (role === 'doctor') username = 'doctor1';

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

  // ฟังก์ชันออกจากระบบ
  const logout = () => {
    authApi.logout();
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
