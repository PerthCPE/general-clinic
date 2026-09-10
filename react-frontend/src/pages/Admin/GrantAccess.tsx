import React, { useState, useEffect } from 'react';
import { Info, Search } from 'lucide-react';
import { adminApi, type BackendUser } from '../../services/api';
import { PAGE_PERMISSIONS, ROLE_PAGE_ACCESS, PAGE_TITLES } from '../../config/roles';
import type { UserRole } from '../../types/auth';
import './GrantAccess.css';

// ⚠️ ข้อจำกัดสำคัญ — อ่านก่อนแก้ต่อ:
// หน้านี้ติ๊กสิทธิ์ "รายเมนู" ต่อ "รายบุคคล" แล้วบันทึกลง system_accesses จริงผ่าน
// bulkUpdateSystemAccess (endpoint เดิมที่มีอยู่แล้ว ไม่ได้สร้างใหม่) แต่ค่าที่บันทึกไว้นี้
// "ยังไม่ถูกนำไปบังคับใช้จริงที่ไหนเลย" — สิทธิ์การเข้าถึงหน้าจริงของระบบยังคงอ้างอิงจาก
// PAGE_PERMISSIONS (role ของ JWT) เหมือนเดิมทั้ง frontend routing และ backend RoleRequired
// middleware ทุกจุด การติ๊ก/บันทึกในหน้านี้จึงเป็นการ "เตรียมข้อมูลไว้ล่วงหน้า" สำหรับวันที่ระบบ
// จะเปลี่ยนไปใช้สิทธิ์ระดับ user จริง ไม่ใช่การเปิด/ปิดสิทธิ์การเข้าถึงจริง ณ ตอนนี้
// (เจตนา — ไม่ไปแตะ middleware/route เพราะเสี่ยงเกินไปที่จะแก้ระบบตรวจสอบสิทธิ์ทั้งหมดตอนนี้)

interface SystemUser {
  internalId: number;
  id: string; // employee_id
  name: string;
  role: string;
  department: string;
  status: 'รอการยืนยัน' | 'กำลังใช้งาน' | 'ระงับใช้งาน' | string;
  avatar: string;
  grantedPages: string[]; // จาก system_accesses ที่ access_level > 0 อยู่แล้วตอนนี้
}

const ALL_PAGE_IDS = Object.keys(PAGE_PERMISSIONS);

const englishToRole: Record<string, string> = {
  'doctor': 'แพทย์', 'nurse': 'พยาบาลและผู้ช่วยพยาบาล', 'nurse_assistant': 'พยาบาลและผู้ช่วยพยาบาล',
  'pharmacist': 'เภสัชกร', 'registrar': 'พนักงานเวชระเบียน', 'cashier': 'พนักงานธุรการการเงิน',
  'admin': 'ผู้ดูแลระบบ', 'officer': 'พนักงานธุรการ',
};

const mapBackendToSystemUser = (u: BackendUser): SystemUser => {
  const colors = ['#4F46E5', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6'];
  const grantedPages = (u.system_accesses || [])
    .filter((sa) => Number(sa.access_level) > 0)
    .map((sa) => String(sa.module_name ?? ''))
    .filter(Boolean);
  return {
    internalId: u.id,
    id: u.employee_id || `EMP-${u.id}`,
    name: u.fullname || u.full_name || u.username || '',
    role: u.role,
    department: u.department || '',
    status: u.status === 'active' ? 'กำลังใช้งาน' : (u.status === 'suspended' ? 'ระงับใช้งาน' : 'รอการยืนยัน'),
    avatar: colors[u.id % colors.length],
    grantedPages,
  };
};

const GrantAccess: React.FC = () => {
  const [personnel, setPersonnel] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeUserId, setActiveUserId] = useState<string>('');
  const [checkedPages, setCheckedPages] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

  // เลือกคนแรกเป็นค่าเริ่มต้นเมื่อโหลดข้อมูลเสร็จ
  useEffect(() => {
    if (personnel.length > 0 && !activeUserId) {
      setActiveUserId(personnel[0].id);
    }
  }, [personnel, activeUserId]);

  const activeUser = personnel.find((p) => p.id === activeUserId) || personnel[0] || null;

  // สลับคนที่เลือก -> โหลดสิทธิ์ที่บันทึกไว้จริงของคนนั้นมาติ๊กให้ (ไม่ใช่เริ่มจากว่างเปล่าเสมอ)
  useEffect(() => {
    if (activeUser) {
      setCheckedPages(new Set(activeUser.grantedPages));
      setSaveMsg(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUserId, personnel.length]);

  const filteredPersonnel = personnel.filter((p) => {
    const term = searchTerm.trim().toLowerCase();
    return term === '' || p.name.toLowerCase().includes(term) || p.id.toLowerCase().includes(term);
  });

  const applyRoleDefaults = () => {
    if (!activeUser) return;
    setCheckedPages(new Set(ROLE_PAGE_ACCESS[activeUser.role as UserRole] || []));
  };

  const togglePage = (pageId: string) => {
    setCheckedPages((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) next.delete(pageId);
      else next.add(pageId);
      return next;
    });
  };

  const handleSave = async () => {
    if (!activeUser) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      await adminApi.bulkUpdateSystemAccess({
        user_id: activeUser.internalId,
        accesses: ALL_PAGE_IDS.map((pageId) => ({
          module_name: pageId,
          access_level: checkedPages.has(pageId) ? 1 : 0,
        })),
      });
      setSaveMsg({ type: 'success', text: `บันทึกสิทธิ์ของ "${activeUser.name}" สำเร็จ (${checkedPages.size} เมนู)` });
      fetchUsers();
    } catch (err: any) {
      setSaveMsg({ type: 'error', text: 'เกิดข้อผิดพลาด: ' + err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="access-page-container">
      <div className="access-layout">

        {/* === Left Sidebar: รายชื่อบุคลากร === */}
        <div className="access-sidebar">
          <h3>รายชื่อบุคลากร</h3>
          <p className="sidebar-sub">เลือกบุคลากรเพื่อกำหนดสิทธิ์การเข้าถึงเมนูเป็นรายบุคคล</p>

          {errorMsg && (
            <div className="ga-error-banner">
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="search-box">
            <Search size={14} strokeWidth={2} />
            <input
              type="text"
              placeholder="ค้นหาชื่อ หรือ รหัสพนักงาน..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="personnel-list">
            {loading ? (
              <div className="ga-loading-state">
                <span className="ga-spinner" />
                <span>กำลังโหลดรายชื่อบุคลากร...</span>
              </div>
            ) : filteredPersonnel.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '12px', fontSize: '12px', color: '#62748E' }}>ไม่พบบัญชีที่ตรงกับเงื่อนไข</div>
            ) : (
              filteredPersonnel.map((p) => (
                <div
                  key={p.internalId}
                  onClick={() => setActiveUserId(p.id)}
                  className={`personnel-item ${p.id === activeUserId ? 'active' : ''}`}
                >
                  <div className="avatar" style={{ backgroundColor: p.avatar }}>
                    {p.name.split(' ')[1]?.charAt(0) || p.name.charAt(0)}
                  </div>
                  <div className="info">
                    <div className="name">
                      {p.name}
                      {p.status === 'กำลังใช้งาน' ? (
                        <span className="status-dot green" title="กำลังใช้งาน" />
                      ) : p.status === 'ระงับใช้งาน' ? (
                        <span className="status-dot red" title="ระงับใช้งาน" />
                      ) : (
                        <span className="status-dot orange" title="รอการยืนยันสิทธิ์" />
                      )}
                    </div>
                    <div className="role">{englishToRole[p.role] || p.role} &bull; {p.grantedPages.length} เมนู</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* === Right Content === */}
        <div className="access-content">
          {activeUser && (
            <>
              <div className="content-header">
                <div className="user-title">
                  <div className="avatar-large" style={{ backgroundColor: activeUser.avatar }}>
                    {activeUser.name.split(' ')[1]?.charAt(0) || activeUser.name.charAt(0)}
                  </div>
                  <div>
                    <h2>สิทธิ์เข้าถึงของ: {activeUser.name}</h2>
                    <p>
                      {englishToRole[activeUser.role] || activeUser.role}
                      {activeUser.department ? <> &bull; {activeUser.department}</> : null}
                      {' '}&bull; รหัสพนักงาน {activeUser.id}
                    </p>
                  </div>
                </div>
                <div className="header-actions">
                  <button type="button" className="btn-cancel" onClick={applyRoleDefaults}>
                    ตั้งค่าตามค่าเริ่มต้นของตำแหน่ง
                  </button>
                  <button type="button" className="btn-save" onClick={handleSave} disabled={saving}>
                    {saving ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
                  </button>
                </div>
              </div>

              {saveMsg && (
                <div className={saveMsg.type === 'success' ? 'ga-success-banner' : 'ga-error-banner'}>
                  <span>{saveMsg.text}</span>
                </div>
              )}

              <div className="perm-card">
                <div className="data-header">
                  <h4>เมนู/โมดูลที่เข้าถึงได้</h4>
                  <span className="info-text">
                    <Info size={13} strokeWidth={2} />
                    ติ๊กเลือกเมนูที่ต้องการให้สิทธิ์ กด "ตั้งค่าตามค่าเริ่มต้นของตำแหน่ง" เพื่อเติมอัตโนมัติตาม
                    PAGE_PERMISSIONS ของตำแหน่งงานนี้ แล้วปรับเพิ่ม/ลดเองได้อิสระก่อนบันทึก — ค่าที่บันทึกยังไม่
                    ถูกนำไปบังคับใช้จริง (ดูหมายเหตุในโค้ด/สรุปท้ายบทสนทนา) ระบบยังคงเช็คสิทธิ์จาก role เหมือนเดิม
                  </span>
                </div>
                <div className="page-access-grid checkable">
                  {ALL_PAGE_IDS.map((pageId) => {
                    const checked = checkedPages.has(pageId);
                    return (
                      <label key={pageId} className={`page-access-chip checkable ${checked ? 'checked' : ''}`}>
                        <input type="checkbox" checked={checked} onChange={() => togglePage(pageId)} />
                        {PAGE_TITLES[pageId] || pageId}
                      </label>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default GrantAccess;
