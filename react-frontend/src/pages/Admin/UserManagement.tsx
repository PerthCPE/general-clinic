import React, { useState, useMemo, useEffect } from 'react';
import { Users, CheckCircle, Clock, Ban, Edit2, Trash2, RotateCcw, UserPlus, Copy, Check, Search } from 'lucide-react';
import { adminApi, type BackendUser } from '../../services/api';
import { TREATMENT_DEPARTMENTS } from '../../config/roles';
import './UserManagement.css';

interface SystemUser {
  internalId: number; // For backend reference
  id: string; // Employee ID
  name: string;
  email: string;
  phone: string;
  role: string;
  department: string;
  licenseId?: string;
  status: 'กำลังใช้งาน' | 'รอการยืนยัน' | 'ระงับใช้งาน' | string;
  avatar: string;
  createdAt: string;
  password?: string;
  username: string; // Add username for backend
}

// === สร้าง Mapping ตำแหน่งงาน ➡️ แผนกที่สอดคล้องกัน (สำหรับคลินิกขนาดกลาง) ===
// รายชื่อแผนกของ "แพทย์" ใช้ TREATMENT_DEPARTMENTS จาก config/roles.ts เพื่อให้ตรงกับ
// doctors.specialty จริง และตรงกับแผนกที่เลือกได้ในฟอร์มนัดหมาย/แดชบอร์ดนัดหมาย (single source)
const ROLE_DEPARTMENTS: Record<string, string[]> = {
  'แพทย์': TREATMENT_DEPARTMENTS,
  'พยาบาลและผู้ช่วยพยาบาล': ['จุดคัดกรองผู้ป่วย (Triage)', 'แผนกอุบัติเหตุและฉุกเฉิน (ER)', 'ห้องตรวจโรคทั่วไป (OPD)'],
  'พนักงานเวชระเบียน': ['จุดคัดกรองผู้ป่วย (Triage)', 'ห้องตรวจโรคทั่วไป (OPD)'],
  'เภสัชกร': ['แผนกเภสัชกรรมห้องยา (Pharmacy)'],
  'พนักงานธุรการต้อนรับ': ['ห้องทะเบียนประวัติและคิว (Reception)'],
  'พนักงานธุรการการเงิน': ['ห้องชำระเงินและออกใบเสร็จ (Cashier)'],
  'นักเทคนิคการแพทย์': ['แผนกเจาะเลือดและห้องปฏิบัติการ (Lab)'],
  'ผู้ดูแลระบบ': ['ศูนย์คอมพิวเตอร์และระบบสารสนเทศ (Admin/IT)']
};

const roleToEnglish: Record<string, string> = {
  'แพทย์': 'doctor', 'พยาบาล': 'nurse', 'ผู้ช่วยพยาบาล': 'nurse_assistant',
  'พยาบาลและผู้ช่วยพยาบาล': 'nurse', 'เภสัชกร': 'pharmacist',
  'พนักงานเวชระเบียน': 'registrar', 'พนักงานธุรการต้อนรับ': 'registrar',
  'พนักงานธุรการการเงิน': 'cashier', 'นักเทคนิคการแพทย์': 'lab_technician',
  'ผู้ดูแลระบบ': 'admin'
};

const englishToRole: Record<string, string> = {
  'doctor': 'แพทย์', 'nurse': 'พยาบาลและผู้ช่วยพยาบาล', 'nurse_assistant': 'พยาบาลและผู้ช่วยพยาบาล',
  'pharmacist': 'เภสัชกร', 'registrar': 'พนักงานเวชระเบียน', 'cashier': 'พนักงานธุรการการเงิน',
  'lab_technician': 'นักเทคนิคการแพทย์', 'admin': 'ผู้ดูแลระบบ', 'officer': 'พนักงานเวชระเบียน'
};

const mapBackendToSystemUser = (u: BackendUser): SystemUser => {
  const colors = ['#4F46E5', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6'];
  const randomColor = colors[u.id % colors.length];
  
  const thaiRole = englishToRole[u.role] || 'พนักงานเวชระเบียน';
  const defaultDept = ROLE_DEPARTMENTS[thaiRole] ? ROLE_DEPARTMENTS[thaiRole][0] : 'ทั่วไป';
  
  return {
    internalId: u.id,
    id: u.employee_id || `EMP-${u.id}`,
    name: u.fullname || u.full_name || u.username || '',
    email: u.email || `${u.username}@clinic.com`,
    phone: u.phone || '-',
    role: thaiRole,
    department: defaultDept,
    status: u.status === 'active' ? 'กำลังใช้งาน' : (u.status === 'suspended' ? 'ระงับใช้งาน' : 'รอการยืนยัน'),
    avatar: randomColor,
    createdAt: u.created_at ? new Date(u.created_at).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB'),
    username: u.username,
  };
};

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<{ userName: string; tempPassword: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const [activeFilter, setActiveFilter] = useState<'ทั้งหมด' | 'กำลังใช้งาน' | 'รอการยืนยัน' | 'ระงับใช้งาน'>('ทั้งหมด');
  const [deptFilter, setDeptFilter] = useState<string>('ทั้งหมด');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const [formData, setFormData] = useState<SystemUser>({
    internalId: 0, id: '', name: '', email: '', phone: '', role: 'แพทย์', department: ROLE_DEPARTMENTS['แพทย์'][0], licenseId: '', status: 'รอการยืนยัน', avatar: '', createdAt: '', password: '', username: ''
  });

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await adminApi.getAccounts();
      if (data) {
        setUsers(data.map(mapBackendToSystemUser));
        setErrorMsg(null);
      }
    } catch (err) {
      console.error("Failed to fetch accounts", err);
      setErrorMsg('ไม่สามารถโหลดรายชื่อบุคลากรได้ กรุณาลองรีเฟรชหน้านี้ใหม่อีกครั้ง');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Auto-generate Username and Password when name changes (only in add mode)
  React.useEffect(() => {
    if (modalMode === 'add' && formData.name) {
      const parts = formData.name.split(' ').filter(Boolean);
      let usernameGen = formData.id.toLowerCase();
      setFormData(prev => ({
        ...prev,
        username: usernameGen,
        email: `${usernameGen}@clinic.com`,
        password: prev.id
      }));
    }
  }, [formData.name, modalMode, formData.id]);

  const stats = useMemo(() => {
    return {
      total: users.length,
      active: users.filter(u => u.status === 'กำลังใช้งาน').length,
      pending: users.filter(u => u.status === 'รอการยืนยัน').length,
      suspended: users.filter(u => u.status === 'ระงับใช้งาน').length,
    };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return users
      .filter(user => {
        const matchStatus = activeFilter === 'ทั้งหมด' || user.status === activeFilter;
        const matchDept = deptFilter === 'ทั้งหมด' || user.department === deptFilter;
        const matchSearch = term === '' ||
          user.name.toLowerCase().includes(term) ||
          user.id.toLowerCase().includes(term);
        return matchStatus && matchDept && matchSearch;
      })
      // เรียงตามรหัสพนักงาน (employee_id) — ใช้ localeCompare พร้อม numeric:true ให้ "DOC002"
      // มาก่อน "DOC010" ตามลำดับตัวเลขจริง ไม่ใช่เรียงตามตัวอักษร ('1' < '2' แต่ "10" < "2" ถ้าเรียง lexical)
      .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' }));
  }, [users, activeFilter, deptFilter, searchTerm]);

  // เดิมตารางตัดแสดงแค่ filteredUsers.slice(0, itemsPerPage) แถวแรกเสมอ โดยไม่มีปุ่มไปหน้าถัดไป
  // เลย — บัญชีที่อยู่เกินแถวที่ itemsPerPage กำหนด (เช่นตอนนี้มี 19+ บัญชี แต่ itemsPerPage
  // default = 10) จึงมองไม่เห็นเลยไม่ว่า backend จะเรียงลำดับมาแบบไหนก็ตาม เพิ่ม pagination จริง
  // ให้เข้าถึงได้ครบทุกบัญชี และรีเซ็ตกลับหน้า 1 ทุกครั้งที่ตัวกรอง/itemsPerPage เปลี่ยน
  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter, deptFilter, searchTerm, itemsPerPage]);

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage) || 1;
  const pageStartIndex = (currentPage - 1) * itemsPerPage;
  const currentTableData = filteredUsers.slice(pageStartIndex, pageStartIndex + itemsPerPage);

  const departmentsInUse = useMemo(() => {
    const depts = new Set(users.map(u => u.department));
    return ['ทั้งหมด', ...Array.from(depts)];
  }, [users]);

  const generateNewId = (roleTh: string, currentUsers: SystemUser[]) => {
    const roleEn = englishToRole[roleTh] ? roleTh : (roleToEnglish[roleTh] || 'officer');
    let prefix = 'EMP';
    if (roleEn === 'doctor' || roleTh === 'แพทย์') prefix = 'DOC';
    else if (roleEn === 'nurse' || roleTh === 'พยาบาล' || roleTh === 'ผู้ช่วยพยาบาล') prefix = 'NUR';
    else if (roleEn === 'pharmacist' || roleTh === 'เภสัชกร') prefix = 'PHA';
    else if (roleEn === 'cashier' || roleTh === 'เจ้าหน้าที่การเงิน') prefix = 'CAS';
    else if (roleEn === 'registrar' || roleTh === 'เจ้าหน้าที่เวชระเบียน' || roleTh === 'เจ้าหน้าที่ประชาสัมพันธ์') prefix = 'REC';
    else if (roleEn === 'admin' || roleTh === 'ผู้ดูแลระบบ') prefix = 'ADM';
    else prefix = 'OFF';

    let maxNum = 0;
    currentUsers.forEach(u => {
      if (u.id.startsWith(prefix)) {
        const numPart = parseInt(u.id.substring(prefix.length), 10);
        if (!isNaN(numPart) && numPart > maxNum) {
          maxNum = numPart;
        }
      }
    });

    const nextNum = maxNum + 1;
    return `${prefix}${nextNum.toString().padStart(3, '0')}`;
  };

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRole = e.target.value;
    const availableDepts = ROLE_DEPARTMENTS[newRole] || ['แผนกทั่วไป'];
    
    setFormData(prev => {
      const newId = modalMode === 'add' ? generateNewId(newRole, users) : prev.id;
      return {
        ...prev,
        role: newRole,
        id: newId,
        password: modalMode === 'add' ? newId : prev.password,
        department: availableDepts[0]
      };
    });
  };

  const openAddModal = () => {
    setModalMode('add');
    const today = new Date().toLocaleDateString('en-GB'); 
    const defaultRole = 'แพทย์';
    const newId = generateNewId(defaultRole, users);
    setFormData({ 
      internalId: 0,
      id: newId, 
      name: '', email: '', phone: '', username: '',
      role: defaultRole, 
      department: ROLE_DEPARTMENTS[defaultRole][0], 
      licenseId: '', status: 'กำลังใช้งาน', avatar: '', createdAt: today, password: newId 
    });
    setIsModalOpen(true);
  };

  const openEditModal = (user: SystemUser) => {
    setModalMode('edit');
    let validDepartment = user.department;
    if (ROLE_DEPARTMENTS[user.role] && !ROLE_DEPARTMENTS[user.role].includes(user.department)) {
      validDepartment = ROLE_DEPARTMENTS[user.role][0];
    }
    setFormData({ ...user, department: validDepartment });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (modalMode === 'add') {
      try {
        await adminApi.createAccount({
          username: formData.username,
          password: formData.password,
          role: roleToEnglish[formData.role] || 'officer',
          fullname: formData.name,
          employee_id: formData.id,
          phone: formData.phone,
          department: formData.department,
        });
        alert('สร้างบัญชีสำเร็จ');
        fetchUsers();
      } catch (err: any) {
        alert('เกิดข้อผิดพลาด: ' + err.message);
      }
    } else {
      // แก้ไขบัญชีทั้งใบ (ชื่อ/อีเมล/เบอร์โทร/ตำแหน่ง/แผนก/สถานะ) ผ่าน endpoint เดียว
      try {
        const backendStatus = formData.status === 'กำลังใช้งาน' ? 'active' : (formData.status === 'ระงับใช้งาน' ? 'suspended' : 'pending');
        await adminApi.updateAccount(formData.internalId, {
          fullname: formData.name,
          email: formData.email,
          phone: formData.phone,
          role: roleToEnglish[formData.role] || 'officer',
          department: formData.department,
          status: backendStatus,
        });
        alert('อัปเดตข้อมูลสำเร็จ');
        fetchUsers();
      } catch (err: any) {
        alert('เกิดข้อผิดพลาด: ' + err.message);
      }
    }
    setIsModalOpen(false);
  };

  // รีเซ็ตรหัสผ่านแบบ admin-assisted — ไม่มีระบบส่งอีเมล จึงสุ่มรหัสผ่านชั่วคราวที่ backend
  // แล้วโชว์ให้ admin เห็นตรงนี้ครั้งเดียวเพื่อนำไปแจ้งพนักงานเอง (ทางวาจา/แชท) พร้อมบังคับ
  // ให้เปลี่ยนรหัสผ่านตอน login ครั้งถัดไปผ่าน RequiresPasswordChange flow ที่มีอยู่แล้ว
  // (เหมือนตอนสร้างบัญชีใหม่ / เหมือน ChangePassword หลัง login ครั้งแรก)
  const handleResetPassword = async (userName: string, internalId: number) => {
    if (!window.confirm(`ต้องการรีเซ็ตรหัสผ่านของ "${userName}" ใช่หรือไม่? รหัสผ่านเดิมจะใช้ล็อกอินไม่ได้ทันที`)) {
      return;
    }
    try {
      const res = await adminApi.resetPassword(internalId);
      // แสดงรหัสผ่านผ่าน modal ที่ render เองแทน alert() ของเบราว์เซอร์ — alert() แบบเดิม
      // กดคัดลอกไม่ได้ และในบางเครื่องข้อความภาษาไทยขึ้นเป็น ???? (native dialog แปลง
      // encoding ตาม system codepage ไม่ใช่ UTF-8 เหมือน HTML/React render ปกติ)
      setResetResult({ userName, tempPassword: res.temporary_password });
      setCopied(false);
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + err.message);
    }
  };

  const handleCopyPassword = async () => {
    if (!resetResult) return;
    const text = resetResult.tempPassword;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback สำหรับ context ที่ไม่ secure (http ธรรมดา) ซึ่ง navigator.clipboard ใช้ไม่ได้
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy to clipboard failed', err);
      alert('คัดลอกไม่สำเร็จ กรุณาคัดลอกด้วยตนเอง');
    }
  };

  const handleDeleteUser = async (userId: string, userName: string, internalId: number) => {
    if (window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการระงับบัญชีของ "${userName}"?`)) {
      try {
        await adminApi.updateAccountStatus(internalId, 'suspended');
        fetchUsers();
      } catch (err: any) {
        alert('เกิดข้อผิดพลาด: ' + err.message);
      }
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
          <div className="um-search-box">
            <Search size={15} strokeWidth={2} />
            <input
              type="text"
              placeholder="ค้นหาชื่อ หรือ รหัสพนักงาน..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select className="dept-filter" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
            {departmentsInUse.map(dept => (
              <option key={dept} value={dept}>{dept === 'ทั้งหมด' ? 'ทุกแผนก' : dept}</option>
            ))}
          </select>
          <button className="btn-primary" onClick={openAddModal}>+ เพิ่มบัญชีใหม่</button>
        </div>
      </div>

      {errorMsg && (
        <div className="um-error-banner">
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="stats-container">
        <div className={`stat-card clickable ${activeFilter === 'ทั้งหมด' ? 'card-active-blue' : ''}`} onClick={() => setActiveFilter('ทั้งหมด')}>
          <div className="stat-value text-blue">{stats.total}</div>
          <div className="stat-label">บัญชีทั้งหมด</div>
          <div className="stat-icon bg-blue-light"><Users size={24} strokeWidth={2} /></div>
        </div>
        <div className={`stat-card clickable ${activeFilter === 'กำลังใช้งาน' ? 'card-active-green' : ''}`} onClick={() => setActiveFilter('กำลังใช้งาน')}>
          <div className="stat-value text-green">{stats.active}</div>
          <div className="stat-label">กำลังใช้งาน</div>
          <div className="stat-icon bg-green-light"><CheckCircle size={24} strokeWidth={2} /></div>
        </div>
        <div className={`stat-card clickable ${activeFilter === 'รอการยืนยัน' ? 'card-active-orange' : ''}`} onClick={() => setActiveFilter('รอการยืนยัน')}>
          <div className="stat-value text-orange">{stats.pending}</div>
          <div className="stat-label">รอการยืนยัน</div>
          <div className="stat-icon bg-orange-light"><Clock size={24} strokeWidth={2} /></div>
        </div>
        <div className={`stat-card clickable ${activeFilter === 'ระงับใช้งาน' ? 'card-active-red' : ''}`} onClick={() => setActiveFilter('ระงับใช้งาน')}>
          <div className="stat-value text-red">{stats.suspended}</div>
          <div className="stat-label">ระงับการใช้งาน</div>
          <div className="stat-icon bg-red-light"><Ban size={24} strokeWidth={2} /></div>
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
            <button className="icon-btn" onClick={() => { setActiveFilter('ทั้งหมด'); setDeptFilter('ทั้งหมด'); setSearchTerm(''); }} title="ล้างตัวกรองทั้งหมด">↻</button>
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
              {loading ? (
                <tr><td colSpan={6}>
                  <div className="um-loading-row">
                    <span className="um-spinner" />
                    <span>กำลังโหลดรายชื่อบุคลากร...</span>
                  </div>
                </td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan={6} style={{textAlign: 'center', padding: '24px', color: '#62748E'}}>ไม่มีข้อมูลผู้ใช้งานที่ตรงตามเงื่อนไข</td></tr>
              ) : (
                currentTableData.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="user-info">
                        <div className="avatar" style={{ backgroundColor: user.avatar }}>
                          {user.name.split(' ')[1]?.charAt(0) || user.name.charAt(0)}
                        </div>
                        <div className="user-details">
                          <span className="user-name">{user.name}</span>
                          <span className="user-email">{user.email}</span>
                          <span className="user-email" style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '2px' }}>
                            <span style={{ fontWeight: 600 }}>ID:</span> {user.username}
                          </span>
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
                        <button className="btn-edit" onClick={() => openEditModal(user)} title="แก้ไขข้อมูล">
                          <Edit2 size={16} strokeWidth={2} />
                        </button>
                        <button className="btn-reset" onClick={() => handleResetPassword(user.name, user.internalId)} title="รีเซ็ตรหัสผ่าน">
                          <RotateCcw size={16} strokeWidth={2} />
                        </button>
                        <button className="btn-delete" onClick={() => handleDeleteUser(user.id, user.name, user.internalId)} title="ระงับบัญชี">
                          <Trash2 size={16} strokeWidth={2} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="um-pagination">
            <span className="um-pagination-info">
              แสดงหน้า {currentPage} จาก {totalPages} (ทั้งหมด {filteredUsers.length} รายการ)
            </span>
            <div className="um-pagination-buttons">
              <button
                type="button"
                className="btn-primary"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              >
                หน้าก่อนหน้า
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              >
                หน้าถัดไป
              </button>
            </div>
          </div>
        )}
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

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label>รหัสพนักงาน (Auto)</label>
                  <input required type="text" disabled value={formData.id} className="input-disabled text-blue font-bold" />
                </div>
                
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label>ชื่อ-นามสกุล (ผู้ใช้งานระบบ)</label>
                  <input required type="text" placeholder="เช่น นพ. สมชาย ใจดี" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} autoFocus={modalMode === 'add'} />
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
                
                {modalMode === 'add' && (
                  <div className="form-group" style={{ gridColumn: 'span 2', backgroundColor: 'var(--bg-canvas)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--brand-primary)' }}>
                      <strong>ข้อมูลเข้าสู่ระบบอัตโนมัติ:</strong><br />
                      Username: <code>{formData.username || 'ระบบจะสร้างให้เมื่อกรอกชื่อ'}</code><br />
                      Password เริ่มต้น: <code>{formData.password || 'Clinic@YYYY'}</code>
                    </p>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>* ผู้ใช้งานสามารถเปลี่ยนรหัสผ่านได้ในภายหลัง</span>
                  </div>
                )}

                <div className="form-divider">สถานะระบบ</div>
                
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label>สถานะบัญชี {modalMode === 'add' ? '(ล็อกค่าเริ่มต้นสำหรับผู้ใช้ใหม่)' : ''}</label>
                  
                  {modalMode === 'add' ? (
                    <input 
                      type="text" 
                      disabled 
                      value="รอการยืนยัน (รอการตั้งสิทธิ์/เข้าสู่ระบบ)" 
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
                      <option value="รอการยืนยัน">รอการยืนยัน (รอการตั้งสิทธิ์/เข้าสู่ระบบ)</option>
                      <option value="กำลังใช้งาน">กำลังใช้งาน</option>
                      <option value="ระงับใช้งาน">ระงับใช้งาน (บล็อก)</option>
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

      {resetResult && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3>รีเซ็ตรหัสผ่านสำเร็จ</h3>
              <button className="btn-close" onClick={() => setResetResult(null)}>×</button>
            </div>
            <p style={{ fontSize: 14, color: 'var(--text-color)', lineHeight: 1.6, marginBottom: 16 }}>
              รหัสผ่านชั่วคราวของ <strong>{resetResult.userName}</strong> — กรุณาแจ้งรหัสนี้ให้พนักงานเอง
              ระบบจะบังคับให้เปลี่ยนรหัสผ่านใหม่ทันทีที่ล็อกอินครั้งถัดไป รหัสนี้จะไม่แสดงซ้ำอีก
            </p>
            <div className="reset-password-box">
              <code>{resetResult.tempPassword}</code>
              <button type="button" className="btn-copy-password" onClick={handleCopyPassword}>
                {copied ? <Check size={15} strokeWidth={2.5} /> : <Copy size={15} strokeWidth={2} />}
                {copied ? 'คัดลอกแล้ว' : 'คัดลอก'}
              </button>
            </div>
            <div className="modal-actions" style={{ gridColumn: 'auto' }}>
              <button type="button" className="btn-primary" onClick={() => setResetResult(null)}>ปิด</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;