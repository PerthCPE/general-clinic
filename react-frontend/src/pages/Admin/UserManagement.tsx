import React, { useState, useMemo } from 'react';
import './UserManagement.css';

interface SystemUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  department: string;
  licenseId?: string;
  status: 'กำลังใช้งาน' | 'รอการยืนยัน' | 'ระงับใช้งาน';
  avatar: string;
  createdAt: string;
}

// === สร้าง Mapping ตำแหน่งงาน ➡️ แผนกที่สอดคล้องกัน (สำหรับคลินิกขนาดกลาง) ===
const ROLE_DEPARTMENTS: Record<string, string[]> = {
  'แพทย์': ['แผนกตรวจโรคทั่วไป (OPD)', 'แผนกอายุรกรรม', 'แผนกสูตินรีเวช', 'แผนกกุมารเวช', 'แผนกศัลยกรรมทั่วไป'],
  'พยาบาลวิชาชีพ': ['จุดคัดกรองและซักประวัติ (Triage)', 'ห้องฉุกเฉินเบื้องต้น (ER)', 'แผนกตรวจโรคทั่วไป (OPD)'],
  'ผู้ช่วยพยาบาล': ['จุดคัดกรองและซักประวัติ (Triage)', 'แผนกตรวจโรคทั่วไป (OPD)'],
  'เภสัชกร': ['ห้องยาและเวชภัณฑ์ (Pharmacy)'],
  'เจ้าหน้าที่เวชระเบียน': ['แผนกเวชระเบียนและต้อนรับ (Reception)'],
  'เจ้าหน้าที่การเงิน': ['แผนกการเงินและบัญชี (Cashier)'],
  'ช่างเทคนิคการแพทย์': ['ห้องปฏิบัติการเบื้องต้น (Lab)'],
  'ผู้ดูแลระบบ': ['ฝ่ายบริหารและเทคโนโลยีสารสนเทศ (Admin/IT)']
};

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<SystemUser[]>([
    { id: 'DOC-2026-001', name: 'นพ. วีรยุทธ อารีใจ', email: 'weerayut.a@clinic.com', phone: '081-234-5678', role: 'แพทย์', department: 'แผนกอายุรกรรม', licenseId: 'ว.12345', status: 'กำลังใช้งาน', avatar: '#4F46E5', createdAt: '10/07/2026' },
    { id: 'NUR-2026-001', name: 'พว. รังสิมา สุขใจ', email: 'rangsima.s@clinic.com', phone: '082-345-6789', role: 'พยาบาลวิชาชีพ', department: 'จุดคัดกรองและซักประวัติ (Triage)', licenseId: 'พ.98765', status: 'กำลังใช้งาน', avatar: '#F59E0B', createdAt: '12/07/2026' },
    { id: 'REG-2026-001', name: 'คุณ กรุณา ดีดี', email: 'karuna.d@clinic.com', phone: '083-456-7890', role: 'เจ้าหน้าที่เวชระเบียน', department: 'แผนกเวชระเบียนและต้อนรับ (Reception)', status: 'รอการยืนยัน', avatar: '#10B981', createdAt: '08/08/2026' },
    { id: 'TEC-2026-001', name: 'คุณ สมชาย มั่นคง', email: 'somchai.m@clinic.com', phone: '084-567-8901', role: 'ช่างเทคนิคการแพทย์', department: 'ห้องปฏิบัติการเบื้องต้น (Lab)', status: 'ระงับใช้งาน', avatar: '#6B7280', createdAt: '01/05/2026' },
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  
  const [activeFilter, setActiveFilter] = useState<'ทั้งหมด' | 'กำลังใช้งาน' | 'รอการยืนยัน' | 'ระงับใช้งาน'>('ทั้งหมด');
  const [deptFilter, setDeptFilter] = useState<string>('ทั้งหมด');

  const [formData, setFormData] = useState<SystemUser>({
    id: '', name: '', email: '', phone: '', role: 'แพทย์', department: ROLE_DEPARTMENTS['แพทย์'][0], licenseId: '', status: 'รอการยืนยัน', avatar: '', createdAt: ''
  });

  const stats = useMemo(() => {
    return {
      total: users.length,
      active: users.filter(u => u.status === 'กำลังใช้งาน').length,
      pending: users.filter(u => u.status === 'รอการยืนยัน').length,
      suspended: users.filter(u => u.status === 'ระงับใช้งาน').length,
    };
  }, [users]);

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchStatus = activeFilter === 'ทั้งหมด' || user.status === activeFilter;
      const matchDept = deptFilter === 'ทั้งหมด' || user.department === deptFilter;
      return matchStatus && matchDept;
    });
  }, [users, activeFilter, deptFilter]);

  const departmentsInUse = useMemo(() => {
    const depts = new Set(users.map(u => u.department));
    return ['ทั้งหมด', ...Array.from(depts)];
  }, [users]);

  const generateNewId = (role: string) => {
    let prefix = 'EMP';
    if (role === 'แพทย์') prefix = 'DOC';
    else if (role.includes('พยาบาล')) prefix = 'NUR';
    else if (role.includes('เวชระเบียน')) prefix = 'REG';
    else if (role.includes('เภสัช')) prefix = 'PHA';
    else if (role.includes('เทคนิค')) prefix = 'TEC';
    else if (role.includes('การเงิน')) prefix = 'FIN';
    else if (role.includes('ระบบ')) prefix = 'ADM';

    const year = new Date().getFullYear();
    const existingRoleUsers = users.filter(u => u.id.startsWith(`${prefix}-${year}`));
    const nextNumber = String(existingRoleUsers.length + 1).padStart(3, '0');
    return `${prefix}-${year}-${nextNumber}`;
  };

  // === ฟังก์ชันจัดการเมื่อเปลี่ยน "ตำแหน่งงาน" ===
  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRole = e.target.value;
    const availableDepts = ROLE_DEPARTMENTS[newRole] || ['ทั่วไป'];
    
    setFormData(prev => ({
      ...prev,
      role: newRole,
      id: modalMode === 'add' ? generateNewId(newRole) : prev.id, // สร้าง ID ใหม่เฉพาะตอน Add
      department: availableDepts[0] // รีเซ็ตแผนกให้ตรงกับตำแหน่งใหม่แบบอัตโนมัติ
    }));
  };

  const openAddModal = () => {
    setModalMode('add');
    const today = new Date().toLocaleDateString('en-GB'); 
    const defaultRole = 'แพทย์';
    setFormData({ 
      id: generateNewId(defaultRole), 
      name: '', email: '', phone: '', 
      role: defaultRole, 
      department: ROLE_DEPARTMENTS[defaultRole][0], 
      licenseId: '', status: 'รอการยืนยัน', avatar: '', createdAt: today 
    });
    setIsModalOpen(true);
  };

  const openEditModal = (user: SystemUser) => {
    setModalMode('edit');
    // เช็กเผื่อข้อมูลเก่าแผนกไม่ตรงกับ Role
    let validDepartment = user.department;
    if (ROLE_DEPARTMENTS[user.role] && !ROLE_DEPARTMENTS[user.role].includes(user.department)) {
      validDepartment = ROLE_DEPARTMENTS[user.role][0];
    }
    setFormData({ ...user, department: validDepartment });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (modalMode === 'add') {
      const colors = ['#4F46E5', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      setUsers([{ ...formData, avatar: randomColor }, ...users]);
    } else {
      setUsers(users.map(u => u.id === formData.id ? formData : u));
    }
    setIsModalOpen(false);
  };

  const handleDeleteUser = (userId: string, userName: string) => {
    if (window.confirm(`⚠️ คุณแน่ใจหรือไม่ว่าต้องการลบบัญชีของ "${userName}"?`)) {
      setUsers(users.filter(user => user.id !== userId));
    }
  };

  return (
    <div className="admin-page-container">
      <div className="admin-header">
        <div className="header-title">
          <h2>จัดการบัญชีผู้ใช้งาน</h2>
          <p>บริหารจัดการข้อมูลบุคลากรและการเข้าใช้งานระบบ</p>
        </div>
        <div className="header-actions">
          <select className="dept-filter" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
            {departmentsInUse.map(dept => (
              <option key={dept} value={dept}>{dept === 'ทั้งหมด' ? 'ทุกแผนก' : dept}</option>
            ))}
          </select>
          <button className="btn-primary" onClick={openAddModal}>+ เพิ่มบัญชีใหม่</button>
        </div>
      </div>

      <div className="stats-container">
        <div className={`stat-card clickable ${activeFilter === 'ทั้งหมด' ? 'card-active-blue' : ''}`} onClick={() => setActiveFilter('ทั้งหมด')}>
          <div className="stat-value text-blue">{stats.total}</div>
          <div className="stat-label">บัญชีทั้งหมด</div>
          <div className="stat-icon bg-blue-light">👥</div>
        </div>
        <div className={`stat-card clickable ${activeFilter === 'กำลังใช้งาน' ? 'card-active-green' : ''}`} onClick={() => setActiveFilter('กำลังใช้งาน')}>
          <div className="stat-value text-green">{stats.active}</div>
          <div className="stat-label">กำลังใช้งาน</div>
          <div className="stat-icon bg-green-light">✓</div>
        </div>
        <div className={`stat-card clickable ${activeFilter === 'รอการยืนยัน' ? 'card-active-orange' : ''}`} onClick={() => setActiveFilter('รอการยืนยัน')}>
          <div className="stat-value text-orange">{stats.pending}</div>
          <div className="stat-label">รอการยืนยัน</div>
          <div className="stat-icon bg-orange-light">⋯</div>
        </div>
        <div className={`stat-card clickable ${activeFilter === 'ระงับใช้งาน' ? 'card-active-red' : ''}`} onClick={() => setActiveFilter('ระงับใช้งาน')}>
          <div className="stat-value text-red">{stats.suspended}</div>
          <div className="stat-label">ระงับการใช้งาน</div>
          <div className="stat-icon bg-red-light">⊘</div>
        </div>
      </div>

      <div className="table-card">
        <div className="table-header">
          <h3>
            รายชื่อบุคลากร 
            {activeFilter !== 'ทั้งหมด' && <span className="filter-badge"> กรอง: {activeFilter}</span>}
          </h3>
          <div className="table-actions">
            <span className="rows-per-page">
              แสดง 
              <select value={itemsPerPage} onChange={(e) => setItemsPerPage(Number(e.target.value))}>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
               รายการต่อหน้า
            </span>
            <button className="icon-btn" onClick={() => { setActiveFilter('ทั้งหมด'); setDeptFilter('ทั้งหมด'); }} title="ล้างตัวกรองทั้งหมด">↻</button>
          </div>
        </div>
        
        <div className="table-responsive" style={{ maxHeight: '500px', overflowY: 'auto' }}>
          <table className="admin-table sticky-header">
            <thead>
              <tr>
                <th>พนักงาน</th>
                <th>รหัสประจำตัว</th>
                <th>แผนก/ตำแหน่ง</th>
                <th>วันที่ลงทะเบียน</th>
                <th>สถานะ</th>
                <th>การจัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr><td colSpan={6} style={{textAlign: 'center', padding: '24px', color: '#6b7280'}}>ไม่มีข้อมูลผู้ใช้งานที่ตรงตามเงื่อนไข</td></tr>
              ) : (
                filteredUsers.slice(0, itemsPerPage).map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="user-info">
                        <div className="avatar" style={{ backgroundColor: user.avatar }}>
                          {user.name.split(' ')[1]?.charAt(0) || user.name.charAt(0)}
                        </div>
                        <div className="user-details">
                          <span className="user-name">{user.name}</span>
                          <span className="user-email">{user.email}</span>
                        </div>
                      </div>
                    </td>
                    <td>{user.id}</td>
                    <td>
                      <div className="user-details">
                        <span className="user-name">{user.department}</span>
                        <span className="user-email">{user.role}</span>
                      </div>
                    </td>
                    <td className="text-gray-500 text-sm">{user.createdAt}</td>
                    <td>
                      <span className={`status-badge ${
                        user.status === 'กำลังใช้งาน' ? 'status-active' :
                        user.status === 'รอการยืนยัน' ? 'status-pending' : 'status-suspended'
                      }`}>
                        {user.status}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button className="btn-edit" onClick={() => openEditModal(user)} title="แก้ไขข้อมูล">✎</button>
                        <button className="btn-delete" onClick={() => handleDeleteUser(user.id, user.name)} title="ลบบัญชี">🗑</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content modal-large">
            <div className="modal-header">
              <h3>{modalMode === 'add' ? 'เพิ่มบัญชีผู้ใช้งานใหม่' : 'แก้ไขข้อมูลบัญชีผู้ใช้'}</h3>
              <button className="btn-close" onClick={() => setIsModalOpen(false)}>×</button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label>ตำแหน่งงาน (เลือกเพื่อสร้างรหัสพนักงานอัตโนมัติ)</label>
                  <select 
                    value={formData.role} 
                    onChange={handleRoleChange} 
                    className="highlight-select"
                  >
                    {Object.keys(ROLE_DEPARTMENTS).map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>รหัสประจำตัวพนักงาน (Auto)</label>
                  <input required type="text" disabled value={formData.id} className="input-disabled text-blue font-bold" />
                </div>
                
                <div className="form-group">
                  <label>แผนกประจำ (เปลี่ยนตามตำแหน่งงาน)</label>
                  <select 
                    required 
                    value={formData.department} 
                    onChange={e => setFormData({...formData, department: e.target.value})}
                  >
                    {/* ดึงข้อมูลแผนกมาแสดงเฉพาะตำแหน่งที่เลือกเท่านั้น */}
                    {(ROLE_DEPARTMENTS[formData.role] || []).map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>

                <div className="form-divider">ข้อมูลส่วนบุคคล</div>

                <div className="form-group">
                  <label>ชื่อ-นามสกุล (พร้อมคำนำหน้า)</label>
                  <input required type="text" placeholder="เช่น นพ. สมชาย รักดี" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} autoFocus={modalMode === 'add'} />
                </div>
                <div className="form-group">
                  <label>อีเมลติดต่อ</label>
                  <input required type="email" placeholder="example@clinic.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>เบอร์โทรศัพท์</label>
                  <input required type="text" placeholder="08X-XXX-XXXX" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>เลขที่ใบประกอบวิชาชีพ (ถ้ามี)</label>
                  <input type="text" placeholder="เช่น ว.12345" value={formData.licenseId || ''} onChange={e => setFormData({...formData, licenseId: e.target.value})} />
                </div>

                <div className="form-divider">สถานะระบบ</div>
                
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label>สถานะบัญชี {modalMode === 'add' ? '(ล็อกค่าเริ่มต้นสำหรับผู้ใช้ใหม่)' : ''}</label>
                  
                  {modalMode === 'add' ? (
                    <input 
                      type="text" 
                      disabled 
                      value="🟡 รอการยืนยัน (รอการตั้งสิทธิ์/เข้าสู่ระบบ)" 
                      className="input-disabled text-orange font-bold" 
                    />
                  ) : (
                    <select 
                      value={formData.status} 
                      onChange={e => setFormData({...formData, status: e.target.value as any})} 
                      className={`status-select-input ${
                        formData.status === 'กำลังใช้งาน' ? 'text-green' : formData.status === 'ระงับใช้งาน' ? 'text-red' : 'text-orange'
                      }`}
                    >
                      <option value="รอการยืนยัน">🟡 รอการยืนยัน (รอการตั้งสิทธิ์/เข้าสู่ระบบ)</option>
                      <option value="กำลังใช้งาน">🟢 กำลังใช้งาน</option>
                      <option value="ระงับใช้งาน">🔴 ระงับใช้งาน (บล็อก)</option>
                    </select>
                  )}
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setIsModalOpen(false)}>ยกเลิก</button>
                <button type="submit" className="btn-primary">
                  {modalMode === 'add' ? '+ ยืนยันการสร้างบัญชี' : 'บันทึกการแก้ไข'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;