import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import type { UserRole } from '../../types/auth';
import './LoginPage.css';
import clinicLogo from '../../assets/logo.png';
import { Eye, EyeOff, Loader2 } from 'lucide-react'; // Make sure lucide-react is available
import ChangePasswordModal from '../../components/ChangePasswordModal/ChangePasswordModal';

const LoginPage: React.FC = () => {
  const { login, quickDevLogin } = useAuth();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [showChangePassword, setShowChangePassword] = useState(false);

  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !password) {
      setError('กรุณากรอกรหัสพนักงาน/อีเมล และรหัสผ่าน');
      return;
    }
    
    setIsLoading(true);
    try {
      const result = await login(username, password);
      if (result && result.success) {
        if (result.requiresPasswordChange) {
          setShowChangePassword(true);
        } else {
          window.location.reload();
        }
      } else {
        // ใช้ error message จริงจาก backend ถ้ามี (เช่น "บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อ
        // ผู้ดูแลระบบ") แทนข้อความทั่วไป — ผู้ใช้จะได้รู้เหตุผลจริงแทนที่จะเดาว่าพิมพ์ผิด
        setError(result?.error || 'ไม่สามารถเข้าสู่ระบบได้ กรุณาตรวจสอบข้อมูลเข้าสู่ระบบอีกครั้ง');
      }
    } catch (err) {
      setError('ไม่สามารถเข้าสู่ระบบได้ กรุณาตรวจสอบข้อมูลเข้าสู่ระบบอีกครั้ง');
    } finally {
      setIsLoading(false);
    }
  };

  // ปุ่ม "Quick Test Login" — ทางลัด dev/test เท่านั้น เรียก backend endpoint พิเศษที่ reset
  // status บัญชี seed กลับเป็น active ให้ก่อน login เสมอ ไม่ว่าบัญชีนั้นจะถูกตั้ง suspended
  // ไว้ก่อนหน้าหรือไม่ก็ตาม (ต่างจาก handleManualLogin ด้านบนที่ยังเช็ค password/status ตามจริง
  // ทุกประการ ไม่ถูกแตะเลย) ถ้า backend ปิด dev mode ไว้ (production) จะเห็น error message จริง
  // ไม่ใช่ fake success
  const handleQuickTestLogin = async (role: UserRole) => {
    setError(null);
    setIsLoading(true);
    try {
      const result = await quickDevLogin(role);
      if (result && result.success) {
        if (result.requiresPasswordChange) {
          setShowChangePassword(true);
        } else {
          window.location.reload();
        }
      } else {
        setError(result?.error || 'Quick Test Login ใช้งานไม่ได้ในขณะนี้');
      }
    } catch (err) {
      setError('Quick Test Login ใช้งานไม่ได้ในขณะนี้');
    } finally {
      setIsLoading(false);
    }
  };

  // เดิมจุดนี้มี handleChangePassword() + JSX ของตัวเองแยกจาก ChangePasswordModal ทั้งหมด — ปัญหาคือ
  // helper เปลี่ยนรหัสผ่านของตัวเองทิ้ง error message จริงจาก backend เสมอ (catch แล้ว return false
  // เฉยๆ) ทำให้ error ที่โชว์ไม่ตรงกับเหตุผลจริง (เช่น รหัสเดิมผิด/สั้นไป/ซ้ำของเดิม) ต่างจาก Topbar
  // ที่ใช้ ChangePasswordModal ผ่าน AuthContext.changePassword() ซึ่งส่ง error จริงกลับมา — รวมให้ใช้
  // component เดียวกันแทน ไม่มี logic ซ้ำซ้อนให้ error หลุดหายอีก (ดู PLAN.md ข้อ 9 สำหรับรายละเอียด)
  if (showChangePassword) {
    return <ChangePasswordModal open forced onSuccess={() => window.location.reload()} />;
  }

  return (
    <div className="login-container">
      <div className="login-box">
        {/* Logo & Header */}
        <div className="login-header">
          <div className="login-logo-icon">
            <img src={clinicLogo} alt="General Clinic Logo" className="login-logo-img" />
          </div>
          <p className="login-tagline">ระบบบริหารจัดการคลินิกเวชกรรม</p>

        </div>

        {/* Standard Form */}
        <form className="login-form" onSubmit={handleManualLogin}>
          {error && <div className="login-error-msg">{error}</div>}

          <div className="login-form-group">
            <label className="login-form-label">รหัสพนักงาน / อีเมล</label>
            <input
              type="text"
              className="login-form-input"
              placeholder="กรอกรหัสพนักงาน หรือ อีเมล"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
              autoFocus
            />
          </div>

          <div className="login-form-group">
            <label className="login-form-label">รหัสผ่าน</label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                className="login-form-input"
                placeholder="กรอกรหัสผ่าน"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
              <button type="button" className="password-toggle-btn" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button type="submit" className="login-submit-btn" disabled={isLoading || !username || !password}>
            {isLoading ? <span className="flex-center"><Loader2 className="spinner" size={18} /> กำลังเข้าสู่ระบบ...</span> : 'เข้าสู่ระบบ'}
          </button>
        </form>
      </div>

      <div className="test-login-box">
        <h4 style={{margin: '0 0 10px 0', fontSize: '13px', color: '#64748B'}}>Quick Test Login</h4>
        <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center'}}>
          <button type="button" className="test-login-btn" disabled={isLoading} onClick={() => handleQuickTestLogin('doctor')}>Doctor</button>
          <button type="button" className="test-login-btn" disabled={isLoading} onClick={() => handleQuickTestLogin('nurse')}>Nurse</button>
          <button type="button" className="test-login-btn" disabled={isLoading} onClick={() => handleQuickTestLogin('nurse_assistant')}>Nurse Assistant</button>
          <button type="button" className="test-login-btn" disabled={isLoading} onClick={() => handleQuickTestLogin('registrar')}>Registrar</button>
          <button type="button" className="test-login-btn" disabled={isLoading} onClick={() => handleQuickTestLogin('pharmacist')}>Pharmacist</button>
          <button type="button" className="test-login-btn" disabled={isLoading} onClick={() => handleQuickTestLogin('cashier')}>Cashier</button>
          <button type="button" className="test-login-btn" disabled={isLoading} onClick={() => handleQuickTestLogin('officer')}>Officer</button>
          <button type="button" className="test-login-btn" disabled={isLoading} onClick={() => handleQuickTestLogin('admin')}>Admin</button>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
