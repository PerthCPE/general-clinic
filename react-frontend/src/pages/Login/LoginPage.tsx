import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { DEMO_USERS } from '../../config/roles';
import type { UserRole } from '../../types/auth';
import clinicLogo from '../../assets/logo.png';
import './LoginPage.css';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const { login, logout } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('โปรดกรอกชื่อผู้ใช้งาน');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const res = await login(username.trim(), password);
      if (res.success) {
        if (res.requiresPasswordChange) {
          setShowChangePassword(true);
        } else {
          onLoginSuccess();
        }
      } else {
        setError('ไม่พบชื่อผู้ใช้งานนี้ในระบบ (เช่น registrar1, nurse1 หรือ assistant1)');
      }
    } catch {
      setError('เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = async (role: UserRole) => {
    setIsLoading(true);
    setError('');
    try {
      const res = await login(role);
      if (res.success) {
        if (res.requiresPasswordChange) {
          setShowChangePassword(true);
        } else {
          onLoginSuccess();
        }
      }
    } catch {
      setError('เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('รหัสผ่านใหม่ไม่ตรงกัน');
      return;
    }
    if (newPassword.length < 6) {
      setError('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
      return;
    }
    setIsLoading(true);
    try {
      const { authApi } = await import('../../services/api');
      await authApi.changePassword({ old_password: password, new_password: newPassword });
      alert('เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบอีกครั้ง');
      setShowChangePassword(false);
      setPassword('');
      setNewPassword('');
      setConfirmPassword('');
      logout();
    } catch {
      setError('เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน');
    } finally {
      setIsLoading(false);
    }
  };

  if (showChangePassword) {
    return (
      <div className="login-container">
        <div className="login-box">
          <div className="login-header">
            <div className="login-logo-icon">
              <img src={clinicLogo} alt="General Clinic Logo" className="login-logo-img" />
            </div>
            <p className="login-tagline">เปลี่ยนรหัสผ่าน (บังคับเปลี่ยนเมื่อเข้าสู่ระบบครั้งแรก)</p>
          </div>
          <form className="login-form" onSubmit={handleChangePassword}>
            {error && <div className="login-error-msg">{error}</div>}
            <div className="login-input-group">
              <label>รหัสผ่านใหม่</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="กรอกรหัสผ่านใหม่"
                required
              />
            </div>
            <div className="login-input-group">
              <label>ยืนยันรหัสผ่านใหม่</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="ยืนยันรหัสผ่านใหม่อีกครั้ง"
                required
              />
            </div>
            <button type="submit" className="login-submit-btn" disabled={isLoading}>
              {isLoading ? 'กำลังเปลี่ยนรหัสผ่าน...' : 'เปลี่ยนรหัสผ่าน'}
            </button>
            <button type="button" className="login-submit-btn" style={{marginTop: '10px', backgroundColor: '#94a3b8'}} onClick={() => { setShowChangePassword(false); logout(); }}>
              ยกเลิก
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-box">
        {/* Logo & Header */}
        <div className="login-header">
          <div className="login-logo-icon">
            <img src={clinicLogo} alt="General Clinic Logo" className="login-logo-img" />
          </div>
          <p className="login-tagline">ระบบบริหารจัดการคลินิกเวชกรรมทั่วไป</p>
        </div>

        {/* Quick Role Selection */}
        <div className="login-quick-section">
          <span className="login-section-label">เข้าสู่ระบบด่วนตามบทบาท (Quick Role Login):</span>
          <div className="quick-roles-grid">
            {Object.values(DEMO_USERS).map((user) => (
              <button
                key={user.role}
                type="button"
                className="quick-role-card"
                onClick={() => handleQuickLogin(user.role)}
              >
                <div className="role-avatar-badge" style={{ backgroundColor: user.avatarColor }}>
                  {user.avatarText}
                </div>
                <div className="role-card-info">
                  <span className="role-card-name">{user.fullName}</span>
                  <span className="role-card-role">{user.roleTitleTh}</span>
                  <span className="role-card-code">role: {user.role}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Quick Doctor Accounts to test individual doctor schedules */}
          <div style={{ marginTop: '12px', padding: '10px 12px', background: '#FEF2F2', borderRadius: '12px', border: '1px solid #FECACA' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#991B1B', display: 'block', marginBottom: '6px' }}>
              🩺 เลือกแพทย์ในระบบเข้าสู่ระบบโดยตรง (ทดสอบตารางงานเฉพาะบุคคล):
            </span>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={async () => {
                  setIsLoading(true);
                  try {
                    const ok = await login('doctor1');
                    if (ok) onLoginSuccess();
                  } finally {
                    setIsLoading(false);
                  }
                }}
                style={{ padding: '5px 10px', fontSize: '11px', fontWeight: 700, background: '#FFFFFF', color: '#B91C1C', border: '1px solid #FCA5A5', borderRadius: '8px', cursor: 'pointer' }}
              >
                พญ.สุดา (doctor1 - สูติ)
              </button>
              <button
                type="button"
                onClick={async () => {
                  setIsLoading(true);
                  try {
                    const ok = await login('doctor2');
                    if (ok) onLoginSuccess();
                  } finally {
                    setIsLoading(false);
                  }
                }}
                style={{ padding: '5px 10px', fontSize: '11px', fontWeight: 700, background: '#FFFFFF', color: '#B91C1C', border: '1px solid #FCA5A5', borderRadius: '8px', cursor: 'pointer' }}
              >
                นพ.วิชัย (doctor2 - อายุรกรรม)
              </button>
              <button
                type="button"
                onClick={async () => {
                  setIsLoading(true);
                  try {
                    const ok = await login('doctor3');
                    if (ok) onLoginSuccess();
                  } finally {
                    setIsLoading(false);
                  }
                }}
                style={{ padding: '5px 10px', fontSize: '11px', fontWeight: 700, background: '#FFFFFF', color: '#B91C1C', border: '1px solid #FCA5A5', borderRadius: '8px', cursor: 'pointer' }}
              >
                พญ.เกศรา (doctor3 - กุมาร)
              </button>
            </div>
          </div>
        </div>

        <div className="login-divider">
          <span>หรือเข้าสู่ระบบด้วยบัญชี</span>
        </div>

        {/* Standard Form */}
        <form className="login-form" onSubmit={handleManualLogin}>
          {error && <div className="login-error-msg">{error}</div>}

          <div className="login-form-group">
            <label className="login-form-label">อีเมล หรือ ชื่อผู้ใช้งาน (Email / Username)</label>
            <input
              type="text"
              className="login-form-input"
              placeholder="เช่น registrar1@clinic.com หรือ registrar1"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className="login-form-group">
            <label className="login-form-label">รหัสผ่าน (Password)</label>
            <input
              type="password"
              className="login-form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button type="submit" className="login-submit-btn">
            เข้าสู่ระบบ
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
