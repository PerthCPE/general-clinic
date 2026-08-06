import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { DEMO_USERS } from '../../config/roles';
import type { UserRole } from '../../types/auth';
import './LoginPage.css';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleManualLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('กรุณากรอกชื่อผู้ใช้งาน');
      return;
    }

    const success = login(username.trim(), password);
    if (success) {
      setError('');
      onLoginSuccess();
    } else {
      setError('ไม่พบชื่อผู้ใช้งานนี้ในระบบ (ลองใช้ registrar1, nurse1 หรือ assistant1)');
    }
  };

  const handleQuickLogin = (role: UserRole) => {
    const success = login(role);
    if (success) {
      setError('');
      onLoginSuccess();
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        {/* Logo & Header */}
        <div className="login-header">
          <div className="login-logo-icon">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M18 14H14V18H10V14H6V10H10V6H14V10H18M20 2H4C2.9 2 2 2.9 2 4V20C2 21.1 2.9 22 4 22H20C21.1 22 22 21.1 22 20V4C22 2.9 21.1 2 20 2M20 20H4V4H20V20Z"
                fill="#FFFFFF"
              />
            </svg>
          </div>
          <h1 className="login-clinic-name">General Clinic</h1>
          <p className="login-tagline">ระบบบริหารจัดการคลินิกเวชกรรมและบริการผู้ป่วย</p>
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
        </div>

        <div className="login-divider">
          <span>หรือเข้าสู่ระบบด้วยบัญชี</span>
        </div>

        {/* Standard Form */}
        <form className="login-form" onSubmit={handleManualLogin}>
          {error && <div className="login-error-msg">{error}</div>}

          <div className="login-form-group">
            <label className="login-form-label">ชื่อผู้ใช้งาน (Username)</label>
            <input
              type="text"
              className="login-form-input"
              placeholder="เช่น registrar1, nurse1, assistant1"
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
