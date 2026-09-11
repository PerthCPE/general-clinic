import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Eye, EyeOff } from 'lucide-react'; // ไอคอนจาก library ที่โปรเจกต์ใช้อยู่แล้ว (ดู LoginPage.tsx)
import './ChangePasswordModal.css';

// ไฟล์ใหม่ทั้งไฟล์ — ไม่มีเจ้าของเดิม ไม่กระทบใคร
//
// ใช้ 2 โหมด:
// 1. forced=true — จาก App.tsx เมื่อ currentUser.requiresPasswordChange เป็น true บังคับเปลี่ยนก่อนเข้าหน้าอื่น
//    ปิด/คลิกนอกกรอบไม่ได้ ทางออกเดียวคือเปลี่ยนรหัสผ่านสำเร็จ หรือออกจากระบบ
// 2. forced=false (default) — จากปุ่ม "ตั้งค่าโปรไฟล์ผู้ใช้" ใน Topbar.tsx เปลี่ยนได้ตลอดเวลาที่ล็อกอินอยู่
//    ปิดได้ปกติ (คลิกนอกกรอบ/ปุ่มยกเลิก)
interface ChangePasswordModalProps {
  open: boolean;
  forced?: boolean;
  onClose?: () => void;
  onSuccess?: () => void;
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ open, forced = false, onClose, onSuccess }) => {
  const { changePassword, logout } = useAuth();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // ปุ่มตากดดู/ซ่อนรหัสผ่าน แยกสถานะต่อช่อง (คนละช่องต้องกดดูอิสระกัน)
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  if (!open) return null;

  const resetForm = () => {
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
  };

  const handleClose = () => {
    if (forced) return; // บังคับอยู่ ปิดไม่ได้
    resetForm();
    onClose?.();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // ฝั่งหน้าเว็บเช็คแค่รูปแบบที่ไม่ต้องรู้รหัสผ่านเดิมจริง (ช่องว่าง/ความยาว/สองช่องตรงกัน) — ไม่เช็ค
    // "ซ้ำรหัสเดิม" ที่นี่อีกต่อไป (เคยเป็นบั๊ก: ถ้าผู้ใช้พิมพ์รหัสเดิมผิด แล้วรหัสใหม่ที่ตั้งใจไว้ดัน
    // ไปตรงกับรหัสเดิมที่พิมพ์ผิดนั้นพอดี จะขึ้น "ซ้ำรหัสเดิม" ทั้งที่ควรขึ้น "รหัสผ่านเดิมไม่ถูกต้อง"
    // มากกว่า — เงื่อนไขที่ต้องรู้ว่ารหัสเดิม "ถูกต้อง" จริงก่อนถึงจะเช็คซ้ำได้อย่างมีความหมาย ต้องปล่อย
    // ให้ backend ตรวจรหัสเดิมให้ถูกก่อนเสมอ แล้วค่อยเช็คซ้ำรหัสเดิม/ตรงกับ employee_id ต่อ (ดู auth.go)
    if (!oldPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      setError('กรุณากรอกรหัสผ่านให้ครบทุกช่อง');
      return;
    }
    if (newPassword.length < 8) {
      setError('รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await changePassword(oldPassword, newPassword);
      if (result.success) {
        resetForm();
        onSuccess?.();
        if (!forced) {
          onClose?.();
        }
      } else {
        setError(result.error || 'เปลี่ยนรหัสผ่านไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="cpw-overlay" onClick={handleClose}>
      <div className="cpw-box" onClick={(e) => e.stopPropagation()}>
        <h2 className="cpw-title">{forced ? 'ต้องเปลี่ยนรหัสผ่านก่อนใช้งานต่อ' : 'เปลี่ยนรหัสผ่าน'}</h2>
        {forced && (
          <p className="cpw-subtitle">
            บัญชีนี้ถูกตั้งให้ต้องเปลี่ยนรหัสผ่านก่อนเข้าใช้งานหน้าอื่น (เช่น เพิ่งสร้างบัญชีใหม่ หรือแอดมินเพิ่งรีเซ็ตรหัสผ่านให้)
            กรุณาตั้งรหัสผ่านใหม่ของตัวเองก่อน
          </p>
        )}
        <form className="cpw-form" onSubmit={handleSubmit}>
          {error && <div className="cpw-error">{error}</div>}
          <div className="cpw-field">
            <label>รหัสผ่านเดิม</label>
            <div className="cpw-input-wrapper">
              <input
                type={showOld ? 'text' : 'password'}
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                required
                disabled={isSubmitting}
                autoFocus
              />
              <button type="button" className="cpw-toggle-btn" onClick={() => setShowOld((v) => !v)} tabIndex={-1}>
                {showOld ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <div className="cpw-field">
            <label>รหัสผ่านใหม่</label>
            <div className="cpw-input-wrapper">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                disabled={isSubmitting}
                placeholder="อย่างน้อย 8 ตัวอักษร"
              />
              <button type="button" className="cpw-toggle-btn" onClick={() => setShowNew((v) => !v)} tabIndex={-1}>
                {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <div className="cpw-field">
            <label>ยืนยันรหัสผ่านใหม่</label>
            <div className="cpw-input-wrapper">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isSubmitting}
              />
              <button type="button" className="cpw-toggle-btn" onClick={() => setShowConfirm((v) => !v)} tabIndex={-1}>
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <div className="cpw-actions">
            <button type="submit" className="cpw-submit-btn" disabled={isSubmitting}>
              {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกรหัสผ่านใหม่'}
            </button>
            {!forced && (
              <button type="button" className="cpw-cancel-btn" disabled={isSubmitting} onClick={handleClose}>
                ยกเลิก
              </button>
            )}
            {forced && (
              <button type="button" className="cpw-cancel-btn" disabled={isSubmitting} onClick={() => logout()}>
                ออกจากระบบแทน
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordModal;
