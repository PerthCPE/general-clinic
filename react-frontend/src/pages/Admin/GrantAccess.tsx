import React, { useState, useEffect } from 'react';
import './GrantAccess.css';

interface SystemUser {
  id: string;
  name: string;
  role: string;
  avatar: string;
  status: 'รอการยืนยัน' | 'กำลังใช้งาน';
  currentLevel: number; 
}

interface UserPermissions {
  level: number;
  menus: { dashboard: boolean; appointment: boolean; pharmacy: boolean; stock: boolean; finance: boolean; security: boolean; };
  data: {
    emr: { read: boolean; write: boolean; del: boolean; export: boolean };
    hr: { read: boolean; write: boolean; del: boolean; export: boolean };
    inventory: { read: boolean; write: boolean; del: boolean; export: boolean };
  };
}

const GrantAccess: React.FC = () => {
  const [personnel, setPersonnel] = useState<SystemUser[]>([
    { id: 'DOC-2026-001', name: 'นพ. วีรยุทธ อารีใจ', role: 'แพทย์', avatar: '#4F46E5', status: 'กำลังใช้งาน', currentLevel: 4 }, 
    { id: 'REG-2026-001', name: 'คุณ กรุณา ดีดี', role: 'เจ้าหน้าที่เวชระเบียน', avatar: '#10B981', status: 'รอการยืนยัน', currentLevel: 1 }, // 🟡 ยังไม่ให้สิทธิ์
    { id: 'NUR-2026-001', name: 'พว. รังสิมา สุขใจ', role: 'พยาบาลวิชาชีพ', avatar: '#F59E0B', status: 'กำลังใช้งาน', currentLevel: 5 }, // 🚨 สูงไป
    { id: 'TEC-2026-001', name: 'คุณ สมชาย มั่นคง', role: 'ช่างเทคนิคการแพทย์', avatar: '#6B7280', status: 'กำลังใช้งาน', currentLevel: 1 } // ⚠️ ต่ำไป (เทคนิคควรได้ Lv2)
  ]);

  const [activeUserId, setActiveUserId] = useState<string>(personnel[1].id); 
  const [searchTerm, setSearchTerm] = useState('');
  
  // === ปรับปรุง State ตัวกรองให้มี 'pending' (รอให้สิทธิ์) แบบแยกชัดเจน ===
  const [auditFilter, setAuditFilter] = useState<'all' | 'pending' | 'match' | 'high' | 'low'>('all');

  const [perms, setPerms] = useState<UserPermissions>({
    level: 1,
    menus: { dashboard: true, appointment: false, pharmacy: false, stock: false, finance: false, security: false },
    data: { emr: { read: false, write: false, del: false, export: false }, hr: { read: false, write: false, del: false, export: false }, inventory: { read: false, write: false, del: false, export: false } }
  });

  const getRecommendedLevel = (role: string) => {
    if (role.includes('ระบบ')) return 5;
    if (role.includes('แพทย์')) return 4;
    if (role.includes('พยาบาล') || role.includes('เภสัช')) return 3;
    if (role.includes('เงิน') || role.includes('ระเบียน') || role.includes('เทคนิค')) return 2;
    return 1;
  };

  // === คำนวณสถิติแยกตาม 5 หมวด ===
  const auditStats = {
    all: personnel.length,
    pending: personnel.filter(p => p.status === 'รอการยืนยัน').length,
    match: personnel.filter(p => p.currentLevel === getRecommendedLevel(p.role) && p.status === 'กำลังใช้งาน').length,
    high: personnel.filter(p => p.currentLevel > getRecommendedLevel(p.role) && p.status === 'กำลังใช้งาน').length,
    low: personnel.filter(p => p.currentLevel < getRecommendedLevel(p.role) && p.status === 'กำลังใช้งาน').length,
  };

  // === กรองข้อมูลตามที่เลือก ===
  const filteredPersonnel = personnel.filter(p => {
    const matchesSearch = p.name.includes(searchTerm) || p.role.includes(searchTerm);
    if (!matchesSearch) return false;

    const recLvl = getRecommendedLevel(p.role);
    if (auditFilter === 'pending') return p.status === 'รอการยืนยัน';
    if (auditFilter === 'match') return p.currentLevel === recLvl && p.status === 'กำลังใช้งาน';
    if (auditFilter === 'high') return p.currentLevel > recLvl && p.status === 'กำลังใช้งาน';
    if (auditFilter === 'low') return p.currentLevel < recLvl && p.status === 'กำลังใช้งาน';
    return true; 
  });

  const activeUser = personnel.find(p => p.id === activeUserId) || personnel[0];
  const recommendedLvl = getRecommendedLevel(activeUser.role);
  
  const isLevelTooLow = perms.level < recommendedLvl;
  const isLevelTooHigh = perms.level > recommendedLvl;

  const handleLevelChange = (level: number) => {
    let newPerms: UserPermissions = { ...perms, level };

    switch (level) {
      case 5:
        newPerms.menus = { dashboard: true, appointment: true, pharmacy: true, stock: true, finance: true, security: true };
        newPerms.data = { emr: { read: true, write: true, del: true, export: true }, hr: { read: true, write: true, del: true, export: true }, inventory: { read: true, write: true, del: true, export: true } };
        break;
      case 4:
        newPerms.menus = { dashboard: true, appointment: true, pharmacy: true, stock: false, finance: false, security: false };
        newPerms.data = { emr: { read: true, write: true, del: false, export: true }, hr: { read: true, write: false, del: false, export: false }, inventory: { read: true, write: false, del: false, export: false } };
        break;
      case 3:
        newPerms.menus = { dashboard: true, appointment: true, pharmacy: true, stock: true, finance: false, security: false };
        newPerms.data = { emr: { read: true, write: true, del: false, export: false }, hr: { read: false, write: false, del: false, export: false }, inventory: { read: true, write: true, del: false, export: false } };
        break;
      case 2:
        newPerms.menus = { dashboard: true, appointment: true, pharmacy: false, stock: false, finance: true, security: false };
        newPerms.data = { emr: { read: true, write: false, del: false, export: false }, hr: { read: false, write: false, del: false, export: false }, inventory: { read: false, write: false, del: false, export: false } };
        break;
      case 1:
        newPerms.menus = { dashboard: true, appointment: false, pharmacy: false, stock: false, finance: false, security: false };
        newPerms.data = { emr: { read: false, write: false, del: false, export: false }, hr: { read: false, write: false, del: false, export: false }, inventory: { read: false, write: false, del: false, export: false } };
        break;
    }
    setPerms(newPerms);
  };

  useEffect(() => {
    if (activeUser.status === 'รอการยืนยัน') {
      handleLevelChange(1);
    } else {
      handleLevelChange(activeUser.currentLevel);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUserId]);

  const toggleMenu = (menuKey: keyof UserPermissions['menus']) => {
    setPerms(prev => ({ ...prev, menus: { ...prev.menus, [menuKey]: !prev.menus[menuKey] } }));
  };
  const toggleData = (category: keyof UserPermissions['data'], action: keyof UserPermissions['data']['emr']) => {
    setPerms(prev => ({ ...prev, data: { ...prev.data, [category]: { ...prev.data[category], [action]: !prev.data[category][action] } } }));
  };

  const handleSave = () => {
    if (isLevelTooLow) {
      if (!window.confirm(`⚠️ ระดับสิทธิ์ต่ำกว่ามาตรฐานของ "${activeUser.role}" คุณแน่ใจหรือไม่ว่าต้องการบันทึกสิทธิ์นี้?`)) return;
    }
    if (isLevelTooHigh) {
      if (!window.confirm(`🚨 คำเตือนความปลอดภัย: คุณกำลังมอบสิทธิ์ที่สูงเกินความจำเป็นให้กับตำแหน่ง "${activeUser.role}" ยืนยันการดำเนินการหรือไม่?`)) return;
    }
    
    setPersonnel(prev => prev.map(p => p.id === activeUser.id ? { ...p, status: 'กำลังใช้งาน', currentLevel: perms.level } : p));
    alert(`✅ บันทึกสิทธิ์ของ "${activeUser.name}" สำเร็จ! (Level ${perms.level})`);
  };

  const handleReset = () => {
    if (window.confirm(`⚠️ คุณต้องการเพิกถอนสิทธิ์ของ "${activeUser.name}" และเปลี่ยนสถานะกลับเป็น "รอการยืนยัน" ใช่หรือไม่?`)) {
      handleLevelChange(1); 
      setPersonnel(prev => prev.map(p => p.id === activeUser.id ? { ...p, status: 'รอการยืนยัน', currentLevel: 1 } : p));
      alert(`🔄 เพิกถอนสิทธิ์สำเร็จ สถานะกลับเป็น "รอการยืนยัน"`);
    }
  };

  return (
    <div className="access-page-container">
      <div className="access-layout">
        
        {/* === Left Sidebar === */}
        <div className="access-sidebar">
          <h3>รายชื่อบุคลากร</h3>
          <p className="sidebar-sub">เลือกบุคลากรเพื่อจัดการกำหนดสิทธิ์การเข้าใช้บริการระบบ</p>
          
          <div className="search-box">
            <input type="text" placeholder="ค้นหาชื่อ หรือ ตำแหน่ง..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>

          {/* === แผงตรวจสอบความปลอดภัย (เพิ่ม 🟡 รอให้สิทธิ์ เข้ามาแล้ว) === */}
          <div className="audit-filters">
            <div className={`audit-chip ${auditFilter === 'all' ? 'active' : ''}`} onClick={() => setAuditFilter('all')}>
              ทั้งหมด ({auditStats.all})
            </div>
            <div className={`audit-chip pending ${auditFilter === 'pending' ? 'active' : ''}`} onClick={() => setAuditFilter('pending')} title="บัญชีใหม่ที่ยังไม่ได้กำหนดสิทธิ์">
              🟡 รอให้สิทธิ์ ({auditStats.pending})
            </div>
            <div className={`audit-chip match ${auditFilter === 'match' ? 'active' : ''}`} onClick={() => setAuditFilter('match')} title="สิทธิ์ตรงตามตำแหน่งมาตรฐาน">
              ✅ ตรงระดับ ({auditStats.match})
            </div>
            <div className={`audit-chip high ${auditFilter === 'high' ? 'active' : ''}`} onClick={() => setAuditFilter('high')} title="สิทธิ์สูงกว่ามาตรฐาน (เสี่ยง)">
              🚨 สูงไป ({auditStats.high})
            </div>
            <div className={`audit-chip low ${auditFilter === 'low' ? 'active' : ''}`} onClick={() => setAuditFilter('low')} title="สิทธิ์ต่ำกว่ามาตรฐาน (แต่ใช้งานอยู่)">
              ⚠️ ต่ำไป ({auditStats.low})
            </div>
          </div>

          <div className="personnel-list">
            {filteredPersonnel.length === 0 ? (
              <div style={{textAlign: 'center', padding: '12px', fontSize: '12px', color: '#6b7280'}}>ไม่พบบัญชีที่ตรงกับเงื่อนไข</div>
            ) : (
              filteredPersonnel.map(p => (
                <div key={p.id} onClick={() => setActiveUserId(p.id)} className={`personnel-item ${p.id === activeUserId ? 'active' : ''}`}>
                  <div className="avatar" style={{ backgroundColor: p.avatar }}>
                    {p.name.split(' ')[1]?.charAt(0) || p.name.charAt(0)}
                  </div>
                  <div className="info">
                    <div className="name">
                      {p.name} 
                      {p.status === 'กำลังใช้งาน' ? <span className="status-dot green" title="กำลังใช้งาน"></span> : <span className="status-dot orange" title="รอการยืนยันสิทธิ์"></span>}
                    </div>
                    {/* ถ้ายังรอการยืนยัน จะไม่โชว์ Level ให้สับสน */}
                    <div className="role">
                      {p.role} 
                      {p.status === 'กำลังใช้งาน' && <span className="list-level-badge">LVL {p.currentLevel}</span>}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* === Right Content === */}
        <div className="access-content">
          <div className="content-header">
            <div className="user-title">
              <div className="avatar-large" style={{ backgroundColor: activeUser.avatar }}>
                {activeUser.name.split(' ')[1]?.charAt(0) || activeUser.name.charAt(0)}
              </div>
              <div>
                <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                  <h2>สิทธิ์การเข้าถึง: {activeUser.name}</h2>
                  <span className={`status-badge-lg ${activeUser.status === 'กำลังใช้งาน' ? 'badge-active' : 'badge-pending'}`}>
                    {activeUser.status === 'กำลังใช้งาน' ? '🟢 กำลังใช้งาน' : '🟡 รอการยืนยันสิทธิ์'}
                  </span>
                </div>
                <p>ID: {activeUser.id} | ตำแหน่ง: {activeUser.role} (แนะนำ Level {recommendedLvl})</p>
              </div>
            </div>
            <div className="header-actions">
              <button className="btn-cancel" onClick={handleReset} title="ล้างค่าและกลับไปรอการยืนยัน" disabled={activeUser.status === 'รอการยืนยัน'}>เพิกถอนสิทธิ์ (Reset)</button>
              <button className="btn-save" onClick={handleSave}>บันทึกการเปลี่ยนแปลง</button>
            </div>
          </div>

          <div className="permissions-grid">
            
            <div className="perm-card security-level">
              <div className="sec-header">
                SECURITY LEVEL 
                <span className="info-badge">เลือกระดับเพื่อกำหนดสิทธิ์อัตโนมัติ</span>
              </div>
              
              <div className="level-selector">
                {[1, 2, 3, 4, 5].map(lvl => (
                  <button 
                    key={lvl} 
                    className={`level-btn ${perms.level === lvl ? 'active' : ''}`}
                    onClick={() => handleLevelChange(lvl)}
                  >
                    {lvl}
                  </button>
                ))}
              </div>

              <div className="level-badge">
                <span className="lvl-text">Current Level</span>
                <span className="lvl-num">{perms.level}</span>
                <span className="lvl-desc">
                  {perms.level === 5 ? 'Admin (Full Access)' :
                   perms.level === 4 ? 'Doctor (High Privileges)' :
                   perms.level === 3 ? 'Nurse/Pharm (Medium Privileges)' :
                   perms.level === 2 ? 'Staff (Basic Privileges)' : 'Restricted (View Only)'}
                </span>
              </div>
              
              {activeUser.status === 'รอการยืนยัน' ? (
                 <div className="level-warning" style={{backgroundColor: '#eff6ff', borderColor: '#93c5fd', color: '#1d4ed8'}}>
                   <strong>💡 บัญชีใหม่:</strong> กรุณาเลือกระดับ Level ที่เหมาะสม (ระบบแนะนำ Level {recommendedLvl}) แล้วกดบันทึกเพื่อเปิดใช้งาน
                 </div>
              ) : isLevelTooLow ? (
                <div className="level-warning low-warning">
                  <strong>⚠️ สิทธิ์ต่ำเกินไป:</strong> ระดับสิทธิ์ Level {perms.level} อาจไม่เพียงพอต่อการทำงานของ <strong>"{activeUser.role}"</strong> (แนะนำ Level {recommendedLvl})
                </div>
              ) : isLevelTooHigh ? (
                <div className="level-warning high-warning">
                  <strong>🚨 เสี่ยงความปลอดภัย:</strong> การให้สิทธิ์ Level {perms.level} กับ <strong>"{activeUser.role}"</strong> สูงเกินความจำเป็นและอาจขัดต่อนโยบาย (แนะนำ Level {recommendedLvl})
                </div>
              ) : (
                <p>ระดับสิทธิ์นี้เหมาะสมกับตำแหน่งงานแล้ว (สามารถปรับแต่งรายข้อได้ที่ตารางด้านล่าง)</p>
              )}
            </div>

            <div className="perm-card menu-access">
              <h4>สิทธิ์การเข้าถึงเมนูระบบ</h4>
              <div className="checkbox-grid">
                <label><input type="checkbox" checked={perms.menus.dashboard} onChange={() => toggleMenu('dashboard')} /> แดชบอร์ดสรุปผล</label>
                <label><input type="checkbox" checked={perms.menus.appointment} onChange={() => toggleMenu('appointment')} /> จัดการคิวและนัดหมาย</label>
                <label><input type="checkbox" checked={perms.menus.pharmacy} onChange={() => toggleMenu('pharmacy')} /> ระบบห้องยา (สั่งยา)</label>
                <label><input type="checkbox" checked={perms.menus.stock} onChange={() => toggleMenu('stock')} /> สต็อกเวชภัณฑ์</label>
                <label><input type="checkbox" checked={perms.menus.finance} onChange={() => toggleMenu('finance')} /> รายงานการเงิน / ชำระเงิน</label>
                <label><input type="checkbox" checked={perms.menus.security} onChange={() => toggleMenu('security')} /> การตั้งค่าระบบจัดการสิทธิ์</label>
              </div>
            </div>

          </div>

          <div className="perm-card data-access">
            <div className="data-header">
              <h4>สิทธิ์การจัดการฐานข้อมูลเชิงลึก</h4>
              <span className="info-text">ข้อมูลอัปเดตอัตโนมัติตาม Level ที่เลือก</span>
            </div>
            <table className="perm-table">
              <thead>
                <tr>
                  <th>หมวดหมู่ข้อมูล</th>
                  <th>ดูข้อมูล<br/>(Read)</th>
                  <th>แก้ไข<br/>(Write)</th>
                  <th>ลบ<br/>(Delete)</th>
                  <th>ส่งออก<br/>(Export)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <strong>ประวัติสุขภาพผู้ป่วย (EMR)</strong>
                    <p>ข้อมูลโรคประจำตัว การแพ้ยา ผลตรวจ Lab</p>
                  </td>
                  <td><input type="checkbox" checked={perms.data.emr.read} onChange={() => toggleData('emr', 'read')} /></td>
                  <td><input type="checkbox" checked={perms.data.emr.write} onChange={() => toggleData('emr', 'write')} /></td>
                  <td><input type="checkbox" checked={perms.data.emr.del} onChange={() => toggleData('emr', 'del')} /></td>
                  <td><input type="checkbox" checked={perms.data.emr.export} onChange={() => toggleData('emr', 'export')} /></td>
                </tr>
                <tr>
                  <td>
                    <strong>ข้อมูลบุคลากรและค่าตอบแทน</strong>
                    <p>เงินเดือน ข้อมูลส่วนตัว และวันลาพักร้อน</p>
                  </td>
                  <td><input type="checkbox" checked={perms.data.hr.read} onChange={() => toggleData('hr', 'read')} /></td>
                  <td><input type="checkbox" checked={perms.data.hr.write} onChange={() => toggleData('hr', 'write')} /></td>
                  <td><input type="checkbox" checked={perms.data.hr.del} onChange={() => toggleData('hr', 'del')} /></td>
                  <td><input type="checkbox" checked={perms.data.hr.export} onChange={() => toggleData('hr', 'export')} /></td>
                </tr>
                <tr>
                  <td>
                    <strong>รายการสต็อกยาและเวชภัณฑ์</strong>
                    <p>การเบิกจ่าย ล็อตการผลิต และวันหมดอายุ</p>
                  </td>
                  <td><input type="checkbox" checked={perms.data.inventory.read} onChange={() => toggleData('inventory', 'read')} /></td>
                  <td><input type="checkbox" checked={perms.data.inventory.write} onChange={() => toggleData('inventory', 'write')} /></td>
                  <td><input type="checkbox" checked={perms.data.inventory.del} onChange={() => toggleData('inventory', 'del')} /></td>
                  <td><input type="checkbox" checked={perms.data.inventory.export} onChange={() => toggleData('inventory', 'export')} /></td>
                </tr>
              </tbody>
            </table>
          </div>

        </div>
      </div>
    </div>
  );
};

export default GrantAccess;