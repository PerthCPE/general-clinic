import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Users, CheckCircle, Clock, Ban, Edit2, Trash2, RotateCcw, UserPlus, Copy, Check, Search } from 'lucide-react';
import { Snackbar, Alert } from '@mui/material';
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
  // ผู้ช่วยพยาบาล (role: nurse_assistant) แยกจาก 'พยาบาลและผู้ช่วยพยาบาล' (role: nurse) ข้างบน —
  // ใช้แผนกชุดเดียวกันเพราะทำงานในพื้นที่เดียวกันจริง แต่ต้องเป็นคนละ key เพื่อไม่ให้ role-mapping ชนกัน
  'ผู้ช่วยพยาบาล': ['จุดคัดกรองผู้ป่วย (Triage)', 'แผนกอุบัติเหตุและฉุกเฉิน (ER)', 'ห้องตรวจโรคทั่วไป (OPD)'],
  'พนักงานเวชระเบียน': ['จุดคัดกรองผู้ป่วย (Triage)', 'ห้องตรวจโรคทั่วไป (OPD)'],
  'เภสัชกร': ['แผนกเภสัชกรรมห้องยา (Pharmacy)'],
  'พนักงานธุรการต้อนรับ': ['ห้องทะเบียนประวัติและคิว (Reception)'],
  'พนักงานธุรการการเงิน': ['ห้องชำระเงินและออกใบเสร็จ (Cashier)'],
  // เจ้าหน้าที่ธุรการ (role: officer จริง — งาน DMS เอกสาร) แยกจาก 'พนักงานธุรการต้อนรับ'
  // (role: registrar) ข้างบน — คนละ role กันจริง ใช้ชื่อแผนกตรงกับ DEMO_USERS.officer.department
  // ใน config/roles.ts ('แผนกธุรการ') ไม่ใช่แผนก Reception ของ registrar ที่ officer ไม่ได้ทำงานด้วย
  'เจ้าหน้าที่ธุรการ': ['แผนกธุรการ'],
  'นักเทคนิคการแพทย์': ['แผนกเจาะเลือดและห้องปฏิบัติการ (Lab)'],
  'ผู้ดูแลระบบ': ['ศูนย์คอมพิวเตอร์และระบบสารสนเทศ (Admin/IT)']
};

const roleToEnglish: Record<string, string> = {
  'แพทย์': 'doctor', 'พยาบาล': 'nurse', 'ผู้ช่วยพยาบาล': 'nurse_assistant',
  'พยาบาลและผู้ช่วยพยาบาล': 'nurse', 'เภสัชกร': 'pharmacist',
  'พนักงานเวชระเบียน': 'registrar', 'พนักงานธุรการต้อนรับ': 'registrar',
  'พนักงานธุรการการเงิน': 'cashier', 'นักเทคนิคการแพทย์': 'lab_technician',
  'ผู้ดูแลระบบ': 'admin', 'เจ้าหน้าที่ธุรการ': 'officer'
};

// englishToRole ต้องเป็นค่าผกผัน (inverse) ของ roleToEnglish แบบตรงตัวสำหรับทุก role จริงที่ backend
// ส่งมาได้ — ห้าม map role ที่ต่างกันไปเป็น Thai label เดียวกันโดยไม่มี roleToEnglish คู่กันแบบ 1:1
// (เคย map 'officer'/'nurse_assistant' ไปชนป้ายของ role อื่นมาก่อน ทำให้กด "บันทึกการแก้ไข" แล้ว
// role ถูกเปลี่ยนเงียบๆ ไปเป็น role อื่นที่ไม่ตรงกับที่ backend ส่งมาจริง — ดู CLAUDE.md/PLAN.md 3.1)
const englishToRole: Record<string, string> = {
  'doctor': 'แพทย์', 'nurse': 'พยาบาลและผู้ช่วยพยาบาล', 'nurse_assistant': 'ผู้ช่วยพยาบาล',
  'pharmacist': 'เภสัชกร', 'registrar': 'พนักงานเวชระเบียน', 'cashier': 'พนักงานธุรการการเงิน',
  'lab_technician': 'นักเทคนิคการแพทย์', 'admin': 'ผู้ดูแลระบบ', 'officer': 'เจ้าหน้าที่ธุรการ'
};

// เบอร์โทรของบัญชีพนักงานต้องเป็นตัวเลขล้วน 10 หลักพอดี ขึ้นต้นด้วย 0 (เช่น 0812345678) — ตรงกับ
// validatePhone() ฝั่ง golang-backend/internal/controllers/admin_controller.go เป๊ะ ห้ามแก้ที่นี่
// โดยไม่แก้ที่ backend คู่กัน ไม่งั้นข้อความ "กรอกผิด" ฝั่งนี้จะไม่ตรงกับที่ backend ปฏิเสธจริง
const PHONE_REGEX = /^0\d{9}$/;

// เรียงตามรหัสพนักงาน (employee_id) — ใช้ localeCompare พร้อม numeric:true ให้ "DOC002" มาก่อน
// "DOC010" ตามลำดับตัวเลขจริง ไม่ใช่เรียงตามตัวอักษร ดึงออกมาเป็นฟังก์ชันแยกเพราะต้องใช้ทั้งใน
// filteredUsers (เรียงเพื่อแสดงผล) และตอนสร้างบัญชีใหม่ (คำนวณว่าบัญชีใหม่ตกหน้าไหนหลัง sort)
// ต้องใช้ comparator ตัวเดียวกันเป๊ะ ไม่งั้นเลขหน้าที่คำนวณได้จะไม่ตรงกับหน้าที่ตารางแสดงจริง
const sortByEmployeeId = (list: SystemUser[]): SystemUser[] =>
  [...list].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' }));

const mapBackendToSystemUser = (u: BackendUser): SystemUser => {
  const colors = ['#4F46E5', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6'];
  const randomColor = colors[u.id % colors.length];

  // role ที่ englishToRole ไม่รู้จัก (ยังไม่เคยเกิดกับ role ปัจจุบันทั้งหมด แต่กันไว้กรณี backend
  // เพิ่ม role ใหม่ในอนาคต) ต้องโชว์ค่าดิบตรงๆ ห้าม fallback ไปเป็น label ของ role อื่นแบบเงียบๆ
  // เหมือนเดิม เพราะจะพา user ไปกด "บันทึกการแก้ไข" แล้วโดนเปลี่ยน role จริงโดยไม่ได้ตั้งใจ (ดูข้อ 3.1)
  const thaiRole = englishToRole[u.role] || u.role;
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

  // แจ้งเตือนหลังสร้างบัญชีสำเร็จ (ชื่อ/username/ตำแหน่ง) ผ่าน MUI Snackbar
  const [createdBanner, setCreatedBanner] = useState<{ username: string; name: string; role: string } | null>(null);
  // หน้า pagination ที่ต้อง "จั๊มพ์" ไปหาหลังสร้างบัญชีใหม่ — เก็บผ่าน ref แยกจาก currentPage
  // เพราะ useEffect รีเซ็ตหน้ากลับเป็น 1 ทุกครั้งที่ตัวกรองเปลี่ยน (ด้านล่าง) ถ้าไม่มี ref นี้ไว้บอก
  // เป้าหมาย การรีเซ็ตตัวกรองในขั้นตอนสร้างบัญชี (ดู handleSubmit) จะไปทับหน้าที่ตั้งใจ jump ไปกลับเป็น 1
  const pendingPageRef = useRef<number | null>(null);

  const [formData, setFormData] = useState<SystemUser>({
    internalId: 0, id: '', name: '', email: '', phone: '', role: 'แพทย์', department: ROLE_DEPARTMENTS['แพทย์'][0], licenseId: '', status: 'รอการยืนยัน', avatar: '', createdAt: '', password: '', username: ''
  });

  // คืนค่ารายชื่อที่โหลดมาล่าสุดด้วย (นอกเหนือจากการ setUsers) — ให้ผู้เรียกที่ต้องคำนวณอะไรต่อจาก
  // ข้อมูลสดๆ ทันที (เช่น handleSubmit หาว่าบัญชีใหม่ตกหน้าไหน) ไม่ต้องรอ re-render แล้วอ่าน state
  // `users` ที่อาจยังเป็นค่าเก่าจาก closure (React ไม่รับประกันว่า setUsers จะสะท้อนใน users ทันที)
  const fetchUsers = async (): Promise<SystemUser[]> => {
    try {
      setLoading(true);
      const data = await adminApi.getAccounts();
      if (data) {
        const mapped = data.map(mapBackendToSystemUser);
        setUsers(mapped);
        setErrorMsg(null);
        return mapped;
      }
      return [];
    } catch (err) {
      console.error("Failed to fetch accounts", err);
      setErrorMsg('ไม่สามารถโหลดรายชื่อบุคลากรได้ กรุณาลองรีเฟรชหน้านี้ใหม่อีกครั้ง');
      return [];
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
    const filtered = users.filter(user => {
      const matchStatus = activeFilter === 'ทั้งหมด' || user.status === activeFilter;
      const matchDept = deptFilter === 'ทั้งหมด' || user.department === deptFilter;
      const matchSearch = term === '' ||
        user.name.toLowerCase().includes(term) ||
        user.id.toLowerCase().includes(term);
      return matchStatus && matchDept && matchSearch;
    });
    return sortByEmployeeId(filtered);
  }, [users, activeFilter, deptFilter, searchTerm]);

  // เดิมตารางตัดแสดงแค่ filteredUsers.slice(0, itemsPerPage) แถวแรกเสมอ โดยไม่มีปุ่มไปหน้าถัดไป
  // เลย — บัญชีที่อยู่เกินแถวที่ itemsPerPage กำหนด (เช่นตอนนี้มี 19+ บัญชี แต่ itemsPerPage
  // default = 10) จึงมองไม่เห็นเลยไม่ว่า backend จะเรียงลำดับมาแบบไหนก็ตาม เพิ่ม pagination จริง
  // ให้เข้าถึงได้ครบทุกบัญชี และรีเซ็ตกลับหน้า 1 ทุกครั้งที่ตัวกรอง/itemsPerPage เปลี่ยน — ยกเว้นตอน
  // สร้างบัญชีใหม่ (handleSubmit) ที่ตั้ง pendingPageRef ไว้ล่วงหน้าเพื่อ "จั๊มพ์" ไปหน้าที่มีบัญชีใหม่แทน
  useEffect(() => {
    setCurrentPage(pendingPageRef.current ?? 1);
    pendingPageRef.current = null;
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
    // แยก prefix ของ nurse_assistant ออกจาก nurse ให้เป็นคนละแบบ (เดิมใช้ 'NUR' ร่วมกัน จน
    // เลขรันชนกันเห็นได้จาก seed เอง: nurse1=NUR001, assistant1=NUR002) — เปลี่ยนเฉพาะบัญชีใหม่ที่
    // จะสร้างต่อจากนี้เท่านั้น ไม่แตะ employee_id ของบัญชีเดิม (assistant1 ยังเป็น NUR002 เหมือนเดิม
    // เพราะการเปลี่ยนของเดิมกระทบ seed script/QuickLogin/AuthContext.tsx ที่ hardcode ค่านี้ไว้
    // หลายจุด — ดู PLAN.md ส่วนที่ 2)
    else if (roleEn === 'nurse_assistant' || roleTh === 'ผู้ช่วยพยาบาล') prefix = 'NAS';
    else if (roleEn === 'nurse' || roleTh === 'พยาบาล') prefix = 'NUR';
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
    // บัญชี seed เดิม 10 บัญชีเก็บเบอร์แบบมีขีด (เช่น "081-555-0001") มาจากก่อนที่จะบังคับรูปแบบ
    // ตัวเลขล้วน — ล้างขีด/ช่องว่างออกอัตโนมัติตอนเปิดฟอร์มแก้ไข กัน validation ฟ้อง "กรอกผิด"
    // ทันทีที่เปิดฟอร์มทั้งที่ admin อาจไม่ได้ตั้งใจแก้เบอร์เลยด้วยซ้ำ (ค่าดิบใน DB ไม่ถูกแตะ
    // จนกว่าจะกดบันทึกจริง)
    const cleanedPhone = (user.phone || '').replace(/\D/g, '').slice(0, 10);
    setFormData({ ...user, department: validDepartment, phone: cleanedPhone });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // กันสำรอง — ปุ่มบันทึกถูก disable ไว้แล้วเมื่อเบอร์ไม่ตรงรูปแบบ (ดู JSX) แต่เช็คซ้ำตรงนี้ด้วย
    // เผื่อ state หลุด sync (เช่น submit ผ่านการกด Enter ก่อน re-render อัปเดต disabled ทัน)
    if (!PHONE_REGEX.test(formData.phone)) {
      return;
    }
    if (modalMode === 'add') {
      try {
        const created = await adminApi.createAccount({
          username: formData.username,
          password: formData.password,
          role: roleToEnglish[formData.role] || 'officer',
          fullname: formData.name,
          employee_id: formData.id,
          phone: formData.phone,
          department: formData.department,
        });
        // แทน alert('สร้างบัญชีสำเร็จ') เดิมที่ไม่บอกว่าสร้างใครไปด้วย MUI Snackbar/Alert
        // (แพทเทิร์นเดียวกับที่ AppointmentForm.tsx ใช้อยู่แล้ว) ที่บอก username/ชื่อ/ตำแหน่งจริง
        const newInternalId = created.user.id;
        setCreatedBanner({ username: formData.username, name: formData.name, role: formData.role });

        const freshUsers = await fetchUsers();

        // บัญชีใหม่ backend สร้างเป็นสถานะ "pending" (รอการยืนยัน) เสมอจริงตอนนี้ (ดู admin_controller.go
        // CreateAccount) จึงตั้งตัวกรองสถานะเป็น 'รอการยืนยัน' ตรงๆ ให้เห็นบัญชีที่เพิ่งสร้างแน่นอน — เคลียร์
        // ตัวกรองแผนก/คำค้นหาทิ้งด้วยเพราะอาจกรองบัญชีใหม่ออกไปได้เหมือนกัน (ค่าตัวกรองตอนเปิดหน้าครั้งแรก
        // ไม่เปลี่ยน ยังเป็น 'ทั้งหมด' เหมือนเดิม — โค้ดนี้รันเฉพาะ "หลังสร้างบัญชีสำเร็จ" เท่านั้น)
        const sorted = sortByEmployeeId(freshUsers.filter(u => u.status === 'รอการยืนยัน'));
        const targetIndex = sorted.findIndex(u => u.internalId === newInternalId);
        const targetPage = targetIndex >= 0 ? Math.floor(targetIndex / itemsPerPage) + 1 : 1;

        pendingPageRef.current = targetPage;
        setActiveFilter('รอการยืนยัน');
        setDeptFilter('ทั้งหมด');
        setSearchTerm('');
        // ตั้งตรงๆ ด้วย เผื่อตัวกรองข้างบนไม่มีค่าไหนเปลี่ยนเลย (เช่นเปิดหน้ามาแล้วกรองค้างที่ 'รอการยืนยัน'
        // อยู่ก่อนแล้ว) ซึ่งกรณีนั้น useEffect ที่ผูกกับ [activeFilter, deptFilter, searchTerm, itemsPerPage]
        // จะไม่ยิง เลยไม่มีใครไปอ่าน pendingPageRef ให้
        setCurrentPage(targetPage);
      } catch (err: any) {
        alert('เกิดข้อผิดพลาด: ' + err.message);
      }
    } else {
      // แก้ไขบัญชีทั้งใบ (ชื่อ/อีเมล/เบอร์โทร/ตำแหน่ง/แผนก/สถานะ) ผ่าน endpoint เดียว
      try {
        const backendStatus = formData.status === 'กำลังใช้งาน' ? 'active' : (formData.status === 'ระงับใช้งาน' ? 'suspended' : 'pending');
        const payload: { fullname?: string; email?: string; phone?: string; role?: string; department?: string; status?: string } = {
          fullname: formData.name,
          email: formData.email,
          phone: formData.phone,
          department: formData.department,
          status: backendStatus,
        };
        // formData.role มาจาก <option> จริงใน dropdown เสมอ "ยกเว้น" กรณี role ดิบที่ englishToRole
        // ไม่รู้จัก (เติมเป็น <option> พิเศษ disabled ไว้ — ดู JSX ด้านล่าง) กรณีนั้นห้ามส่ง field
        // `role` เข้า payload เด็ดขาด เพราะ roleToEnglish[formData.role] จะหาไม่เจอและ mask ปัญหา
        // ด้วยการ fallback เป็น 'officer' เงียบๆ เหมือนบั๊กเดิม — backend เว้นฟิลด์ที่ไม่ส่งไว้อยู่แล้ว
        // จึงไม่ส่งเลยปลอดภัยกว่า
        if (Object.prototype.hasOwnProperty.call(ROLE_DEPARTMENTS, formData.role)) {
          payload.role = roleToEnglish[formData.role];
        }
        await adminApi.updateAccount(formData.internalId, payload);
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
                    // role ดิบจาก backend ที่ englishToRole ไม่รู้จัก (ยังไม่เคยเกิดกับ role ปัจจุบัน
                    // แต่กันไว้กรณีมี role ใหม่ในอนาคต) ต้อง disable ช่องนี้ — ถ้าปล่อยให้เลือกได้
                    // <select> จะ auto-snap ไปที่ option แรกในลิสต์แบบเงียบๆ (สาเหตุเดิมของบั๊ก 3.1)
                    disabled={!Object.prototype.hasOwnProperty.call(ROLE_DEPARTMENTS, formData.role)}
                  >
                    {!Object.prototype.hasOwnProperty.call(ROLE_DEPARTMENTS, formData.role) && (
                      <option value={formData.role}>{formData.role} (ตำแหน่งที่ระบบไม่รู้จัก — ติดต่อผู้ดูแลระบบก่อนแก้ไข)</option>
                    )}
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
                    disabled={!Object.prototype.hasOwnProperty.call(ROLE_DEPARTMENTS, formData.role)}
                  >
                    {/* ถ้าแผนกปัจจุบันไม่อยู่ในลิสต์ของตำแหน่งนี้ (เช่น role ดิบที่ยังไม่รู้จัก) ให้
                        โชว์ค่าดิบเป็น option เพิ่มไว้ก่อน กัน <select> auto-snap ไปเลือก option แรก
                        แบบเงียบๆ เหมือนบั๊กเดิม (ดูคอมเมนต์ช่องตำแหน่งงานด้านบน) */}
                    {formData.department && !(ROLE_DEPARTMENTS[formData.role] || []).includes(formData.department) && (
                      <option value={formData.department}>{formData.department}</option>
                    )}
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
                  <input
                    required
                    type="text"
                    inputMode="numeric"
                    placeholder="0812345678"
                    value={formData.phone}
                    // รับเฉพาะตัวเลข ตัดอักขระอื่น (ขีด/วงเล็บ/ช่องว่าง) ทิ้งทันทีที่พิมพ์ และจำกัด
                    // ไม่เกิน 10 หลัก — ตรงกับ PHONE_REGEX/validatePhone() ฝั่ง backend
                    onChange={e => setFormData({...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10)})}
                  />
                  {formData.phone.length > 0 && !PHONE_REGEX.test(formData.phone) && (
                    // ใช้ inline style แทนการเพิ่ม class ใหม่ใน UserManagement.css — งานนี้จำกัดขอบเขต
                    // ไว้แค่ UserManagement.tsx กับ admin_controller.go เท่านั้น
                    <span style={{ color: '#DC2626', fontSize: '0.8rem', marginTop: '4px', display: 'block' }}>
                      กรอกผิด — เบอร์โทรศัพท์ต้องเป็นตัวเลข 10 หลักและขึ้นต้นด้วย 0 เท่านั้น
                    </span>
                  )}
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
                <button type="submit" className="btn-primary" disabled={!PHONE_REGEX.test(formData.phone)}>
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

      <Snackbar open={!!createdBanner} autoHideDuration={4000} onClose={() => setCreatedBanner(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert onClose={() => setCreatedBanner(null)} severity="success" sx={{ width: '100%', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          {createdBanner && `สร้างบัญชี ${createdBanner.username} — ${createdBanner.name} (${createdBanner.role}) สำเร็จ`}
        </Alert>
      </Snackbar>
    </div>
  );
};

export default UserManagement;