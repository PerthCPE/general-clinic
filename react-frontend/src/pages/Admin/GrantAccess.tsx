import React, { useState, useEffect } from 'react';
import { Info } from 'lucide-react';
import { adminApi, type BackendUser } from '../../services/api';
import { DEMO_USERS, ROLE_PAGE_ACCESS, PAGE_TITLES } from '../../config/roles';
import type { UserRole } from '../../types/auth';
import './GrantAccess.css';

// สิทธิ์จริงในระบบนี้เป็น role-based ล้วนๆ — บังคับใช้ผ่าน PAGE_PERMISSIONS (frontend routing)
// และ RoleRequired middleware (backend) โดยอ้างอิง role ของ JWT เท่านั้น ไม่เคยมีจุดไหนอ่านค่า
// system_accesses.access_level มาใช้ตัดสินใจเปิด/ปิดสิทธิ์เลยสักที่ (grep ยืนยันแล้ว)
//
// หน้านี้เคยเป็น grid ให้ติ๊กสิทธิ์ระดับ user รายคน 18 ช่อง ซึ่งไม่เคยถูกบันทึกจริง (ก.5 ในรายงาน
// สำรวจก่อนหน้า) เปลี่ยนมาเป็นหน้าแสดงสิทธิ์ระดับ "ตำแหน่งงาน" (role) แบบอ่านอย่างเดียวแทน โดยดึง
// ข้อมูลตรงจาก PAGE_PERMISSIONS ที่มีอยู่แล้ว (single source of truth เดียวกับที่แอปใช้จริง)
// จึงไม่มีทางเพี้ยนไปจากสิทธิ์จริง และไม่ต้องสร้าง backend ใหม่

interface SystemUser {
  internalId: number;
  id: string;
  name: string;
  role: string;
  status: 'รอการยืนยัน' | 'กำลังใช้งาน' | 'ระงับใช้งาน' | string;
  avatar: string;
}

const ROLE_ORDER: UserRole[] = ['doctor', 'nurse', 'nurse_assistant', 'pharmacist', 'cashier', 'registrar', 'officer', 'admin'];

const mapBackendToSystemUser = (u: BackendUser): SystemUser => {
  const colors = ['#4F46E5', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6'];
  return {
    internalId: u.id,
    id: u.employee_id || `EMP-${u.id}`,
    name: u.fullname || u.full_name || u.username || '',
    role: u.role,
    status: u.status === 'active' ? 'กำลังใช้งาน' : (u.status === 'suspended' ? 'ระงับใช้งาน' : 'รอการยืนยัน'),
    avatar: colors[u.id % colors.length],
  };
};

const GrantAccess: React.FC = () => {
  const [personnel, setPersonnel] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('doctor');

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await adminApi.getAccounts();
      if (data) {
        setPersonnel(data.map(mapBackendToSystemUser));
        setErrorMsg(null);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('ไม่สามารถโหลดรายชื่อบุคลากรได้ กรุณาลองรีเฟรชหน้านี้ใหม่อีกครั้ง');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const usersInRole = personnel.filter((p) => p.role === selectedRole);
  const pagesForRole = ROLE_PAGE_ACCESS[selectedRole] || [];
  const roleInfo = DEMO_USERS[selectedRole];

  return (
    <div className="access-page-container">
      <div className="access-layout">

        {/* === Left Sidebar: รายชื่อตำแหน่งงาน === */}
        <div className="access-sidebar">
          <h3>ตำแหน่งงานในระบบ</h3>
          <p className="sidebar-sub">เลือกตำแหน่งเพื่อดูว่าเข้าถึงเมนู/โมดูลอะไรได้บ้าง</p>

          {errorMsg && (
            <div className="ga-error-banner">
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="personnel-list">
            {ROLE_ORDER.map((role) => {
              const info = DEMO_USERS[role];
              const count = personnel.filter((p) => p.role === role).length;
              return (
                <div
                  key={role}
                  onClick={() => setSelectedRole(role)}
                  className={`personnel-item ${role === selectedRole ? 'active' : ''}`}
                >
                  <div className="avatar" style={{ backgroundColor: info?.avatarColor || '#94A3B8' }}>
                    {info?.avatarText || role.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="info">
                    <div className="name">{info?.roleTitleTh || role}</div>
                    <div className="role">{loading ? 'กำลังโหลด...' : `${count} บัญชี`}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* === Right Content === */}
        <div className="access-content">
          <div className="content-header">
            <div className="user-title">
              <div className="avatar-large" style={{ backgroundColor: roleInfo?.avatarColor || '#94A3B8' }}>
                {roleInfo?.avatarText || selectedRole.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h2>สิทธิ์การเข้าถึงของตำแหน่ง: {roleInfo?.roleTitleTh || selectedRole}</h2>
                <p>{roleInfo?.roleTitleEn} &bull; {pagesForRole.length} เมนูที่เข้าถึงได้ &bull; {usersInRole.length} บัญชีที่ใช้ตำแหน่งนี้</p>
              </div>
            </div>
          </div>

          <div className="perm-card">
            <div className="data-header">
              <h4>เมนู/โมดูลที่เข้าถึงได้</h4>
              <span className="info-text">
                <Info size={13} strokeWidth={2} />
                อ่านอย่างเดียว — ดึงตรงจาก PAGE_PERMISSIONS ในโค้ด ซึ่งเป็นจุดเดียวที่ระบบใช้จริงในการ
                เปิด/ปิดสิทธิ์เข้าหน้าต่างๆ (ทั้งฝั่งเมนูและฝั่งกันเส้นทาง) จึงตรงกับสิทธิ์จริงเสมอ ไม่มีทางเพี้ยน
              </span>
            </div>
            {pagesForRole.length === 0 ? (
              <p style={{ color: 'var(--text-color)', opacity: 0.6, fontSize: 13 }}>ตำแหน่งนี้ยังไม่มีเมนูที่กำหนดสิทธิ์ไว้</p>
            ) : (
              <div className="page-access-grid">
                {pagesForRole.map((pageId) => (
                  <div key={pageId} className="page-access-chip">
                    {PAGE_TITLES[pageId] || pageId}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="perm-card">
            <div className="data-header">
              <h4>บัญชีที่ใช้ตำแหน่งนี้ ({usersInRole.length})</h4>
            </div>
            {loading ? (
              <div className="ga-loading-state">
                <span className="ga-spinner" />
                <span>กำลังโหลดรายชื่อบุคลากร...</span>
              </div>
            ) : usersInRole.length === 0 ? (
              <p style={{ color: 'var(--text-color)', opacity: 0.6, fontSize: 13 }}>ยังไม่มีบัญชีที่ใช้ตำแหน่งนี้</p>
            ) : (
              <div className="personnel-list" style={{ marginBottom: 0 }}>
                {usersInRole.map((u) => (
                  <div key={u.internalId} className="personnel-item" style={{ cursor: 'default' }}>
                    <div className="avatar" style={{ backgroundColor: u.avatar }}>
                      {u.name.split(' ')[1]?.charAt(0) || u.name.charAt(0)}
                    </div>
                    <div className="info">
                      <div className="name">
                        {u.name}
                        {u.status === 'กำลังใช้งาน' ? (
                          <span className="status-dot green" title="กำลังใช้งาน" />
                        ) : u.status === 'ระงับใช้งาน' ? (
                          <span className="status-dot red" title="ระงับใช้งาน" />
                        ) : (
                          <span className="status-dot orange" title="รอการยืนยันสิทธิ์" />
                        )}
                      </div>
                      <div className="role">{u.id}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GrantAccess;
