import React, { useState, useEffect, useCallback } from 'react';
import { queueApi, type BackendQueue } from '../../services/api';
import { useWebSocket } from '../../context/WebSocketContext';
import { formatQueueNo, formatNationalId } from '../../utils/formatters';
import { callQueueAudio, getSpokenDepartmentText } from '../../utils/audioQueue';
import toast from 'react-hot-toast';
import './QueuePage.css';

export { formatQueueNo };

export type QueueStatus =
  | 'รอคัดกรอง'
  | 'รอพบแพทย์'
  | 'กำลังตรวจ'
  | 'รอทำหัตถการ'
  | 'รอชำระเงิน'
  | 'รอรับยา'
  | 'เสร็จสิ้น'
  | 'ยกเลิกคิว';

export interface QueueItem {
  id: string;
  queueNo: string;
  patientName: string;
  idCard: string;
  status: QueueStatus;
  department: string;
  time: string;
  note?: string;
}

export interface ClinicDepartment {
  id: string;
  name: string;
  category: 'screening' | 'doctor' | 'treatment' | 'billing' | 'pharmacy';
  defaultNote: string;
}

export const CLINIC_DEPARTMENTS: ClinicDepartment[] = [
  {
    id: 'triage',
    name: 'จุดคัดกรอง',
    category: 'screening',
    defaultNote: 'รอซักประวัติและวัดสัญญาณชีพ',
  },
  {
    id: 'room1',
    name: 'ห้องตรวจ 1 (พญ.สุดา)',
    category: 'doctor',
    defaultNote: 'คัดกรองแล้ว รอเรียกเข้าห้องตรวจ',
  },
  {
    id: 'room2',
    name: 'ห้องตรวจ 2 (นพ.วิชัย)',
    category: 'doctor',
    defaultNote: 'คัดกรองแล้ว รอเรียกเข้าห้องตรวจ',
  },
  {
    id: 'room3',
    name: 'ห้องตรวจ 3 (พญ.เกศรา)',
    category: 'doctor',
    defaultNote: 'คัดกรองแล้ว รอเรียกเข้าห้องตรวจ',
  },
  {
    id: 'treatment',
    name: 'ห้องหัตถการ (ทำแผล/ฉีดยา)',
    category: 'treatment',
    defaultNote: 'ส่งทำแผล / ฉีดยา / พ่นยา ตามคำสั่งแพทย์',
  },
  {
    id: 'billing',
    name: 'ห้องการเงิน (แคชเชียร์)',
    category: 'billing',
    defaultNote: 'ตรวจเสร็จสิ้น รอชำระค่ารักษาพยาบาล',
  },
  {
    id: 'pharmacy',
    name: 'ห้องจ่ายยาและเภสัชกรรม',
    category: 'pharmacy',
    defaultNote: 'ชำระเงินแล้ว รอจัดยาและรับคำแนะนำการใช้ยา',
  },
];

const mapBackendQueueToUI = (q: BackendQueue): QueueItem => {
  let timeStr = 'วันนี้';
  if (q.created_at) {
    try {
      const d = new Date(q.created_at);
      if (!isNaN(d.getTime())) {
        timeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')} น.`;
      }
    } catch {
      timeStr = q.created_at;
    }
  }

  const queueFormatted = formatQueueNo(q.queue_number || q.id);

  let defaultDept = 'จุดคัดกรอง';
  if (q.department) {
    defaultDept = q.department;
  } else if (q.status === 'รอพบแพทย์') {
    defaultDept = 'ห้องตรวจ 1 (พญ.สุดา)';
  } else if (q.status === 'รอทำหัตถการ') {
    defaultDept = 'ห้องหัตถการ (ทำแผล/ฉีดยา)';
  } else if (q.status === 'รอชำระเงิน') {
    defaultDept = 'ห้องการเงิน (แคชเชียร์)';
  } else if (q.status === 'รอรับยา') {
    defaultDept = 'ห้องจ่ายยาและเภสัชกรรม';
  }

  return {
    id: String(q.id),
    queueNo: queueFormatted,
    patientName: q.patient?.fullname || `ผู้ป่วยคิว ${queueFormatted}`,
    idCard: formatNationalId(q.patient?.national_id),
    status: (q.status as QueueStatus) || 'รอคัดกรอง',
    department: defaultDept,
    time: timeStr,
    note: q.note || '',
  };
};

const STATUS_OPTIONS: { value: QueueStatus; labelTh: string; desc: string }[] = [
  { value: 'รอคัดกรอง', labelTh: 'รอคัดกรอง', desc: 'ผู้ป่วยลงทะเบียนแล้ว รอวัดสัญญาณชีพและประเมิน Triage' },
  { value: 'รอพบแพทย์', labelTh: 'รอพบแพทย์', desc: 'คัดกรองเสร็จสิ้น รอเรียกเข้าห้องตรวจแพทย์' },
  { value: 'กำลังตรวจ', labelTh: 'กำลังตรวจ', desc: 'ผู้ป่วยอยู่ในห้องตรวจกับแพทย์' },
  { value: 'รอทำหัตถการ', labelTh: 'รอทำหัตถการ', desc: 'รอทำแผล ฉีดยา พ่นยา หรือให้น้ำเกลือ' },
  { value: 'รอชำระเงิน', labelTh: 'รอชำระเงิน', desc: 'ตรวจเสร็จสิ้น รอคิดเงินและชำระค่าบริการ' },
  { value: 'รอรับยา', labelTh: 'รอรับยา', desc: 'ชำระเงินแล้ว รอจัดยาและเรียกรับยาที่ห้องยา' },
  { value: 'เสร็จสิ้น', labelTh: 'เสร็จสิ้น', desc: 'ตรวจรักษา ชำระเงิน และรับยาเรียบร้อย' },
  { value: 'ยกเลิกคิว', labelTh: 'ยกเลิกคิว', desc: 'ผู้ป่วยสละสิทธิ์หรือไม่มารับบริการ' },
];

const QueuePage: React.FC = () => {
  const [queueList, setQueueList] = useState<QueueItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'in_service' | 'cash_pharmacy' | 'completed_cancelled'>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 8;

  // State สำหรับ Modal Edit Status
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedQueue, setSelectedQueue] = useState<QueueItem | null>(null);
  const [newStatus, setNewStatus] = useState<QueueStatus>('รอคัดกรอง');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [statusNote, setStatusNote] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // State สำหรับดูข้อความเต็มของจุดบริการ & การคัดกรอง
  const [detailModalQueue, setDetailModalQueue] = useState<QueueItem | null>(null);

  const { subscribe } = useWebSocket();

  // ดึงรายการคิวจริงจาก Backend DB
  const fetchQueues = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await queueApi.getList();
      if (Array.isArray(data)) {
        if (data.length > 0) {
          setQueueList(data.map(mapBackendQueueToUI));
        } else {
          setQueueList([]);
        }
      }
    } catch (err) {
      console.warn('Could not fetch queue list from backend:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueues();

    // ดักฟังเหตุการณ์ Real-time WebSocket จากเครื่องอื่น
    const unsubCreated = subscribe('QUEUE_CREATED', () => {
      fetchQueues();
    });
    const unsubUpdated = subscribe('QUEUE_UPDATED', () => {
      fetchQueues();
    });

    // Fallback polling ทุก 30 วินาที
    const interval = setInterval(fetchQueues, 30000);
    return () => {
      unsubCreated();
      unsubUpdated();
      clearInterval(interval);
    };
  }, [fetchQueues, subscribe]);

  // คำนวณสรุปสถิติจำนวนคิวแต่ละสถานะ
  const stats = {
    total: queueList.length,
    active: queueList.filter((q) => !['เสร็จสิ้น', 'ยกเลิกคิว'].includes(q.status)).length,
    waitingScreening: queueList.filter((q) => q.status === 'รอคัดกรอง').length,
    waitingDoctor: queueList.filter((q) => q.status === 'รอพบแพทย์').length,
    inExamination: queueList.filter((q) => q.status === 'กำลังตรวจ').length,
    waitingTreatment: queueList.filter((q) => q.status === 'รอทำหัตถการ').length,
    waitingBilling: queueList.filter((q) => q.status === 'รอชำระเงิน').length,
    waitingPharmacy: queueList.filter((q) => q.status === 'รอรับยา').length,
    completed: queueList.filter((q) => q.status === 'เสร็จสิ้น').length,
    cancelled: queueList.filter((q) => q.status === 'ยกเลิกคิว').length,
  };

  // กรองข้อมูลตาม Search และ Status Filter (เรียงลำดับคิวตามลำดับการให้บริการ)
  const filteredQueue = React.useMemo(() => {
    return queueList.filter((item) => {
      const matchSearch =
        item.queueNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.idCard.includes(searchQuery);

      let matchStatus = true;
      if (selectedCategory === 'all') {
        if (statusFilter === 'all') {
          // คิวรอรับบริการทั้งหมด (แยกเสร็จสิ้นและยกเลิกออก)
          matchStatus = !['เสร็จสิ้น', 'ยกเลิกคิว'].includes(item.status);
        } else {
          matchStatus = item.status === statusFilter;
        }
      } else if (selectedCategory === 'in_service') {
        if (statusFilter === 'in_service_all') {
          matchStatus = ['รอคัดกรอง', 'รอพบแพทย์', 'กำลังตรวจ', 'รอทำหัตถการ'].includes(item.status);
        } else {
          matchStatus = item.status === statusFilter;
        }
      } else if (selectedCategory === 'cash_pharmacy') {
        if (statusFilter === 'cash_pharmacy_all') {
          matchStatus = ['รอชำระเงิน', 'รอรับยา'].includes(item.status);
        } else {
          matchStatus = item.status === statusFilter;
        }
      } else if (selectedCategory === 'completed_cancelled') {
        if (statusFilter === 'completed_cancelled_all') {
          // รวมเสร็จสิ้นและยกเลิกคิวมาอยู่ด้วยกัน
          matchStatus = ['เสร็จสิ้น', 'ยกเลิกคิว'].includes(item.status);
        } else {
          matchStatus = item.status === statusFilter;
        }
      } else {
        matchStatus = statusFilter === 'all' ? true : item.status === statusFilter;
      }

      return matchSearch && matchStatus;
    });
  }, [queueList, searchQuery, statusFilter, selectedCategory]);

  // การตัดหน้า (Pagination)
  const totalPages = Math.ceil(filteredQueue.length / itemsPerPage) || 1;
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (validCurrentPage - 1) * itemsPerPage;
  const currentItems = filteredQueue.slice(startIndex, startIndex + itemsPerPage);

  // เปิด Modal เพื่อแก้ไขสถานะ
  const handleOpenEditModal = (item: QueueItem) => {
    setSelectedQueue(item);
    setNewStatus(item.status);
    setSelectedDepartment(item.department || 'จุดคัดกรอง');
    setStatusNote(item.note || '');
    setIsModalOpen(true);
  };

  // ระบบเปลี่ยนจุดบริการอัตโนมัติตามขั้นตอนคลินิก (Smart Clinical Auto-Transition)
  const handleStatusChange = (status: QueueStatus) => {
    setNewStatus(status);

    if (status === 'รอคัดกรอง') {
      setSelectedDepartment('จุดคัดกรอง');
      if (!statusNote || statusNote.includes('ตรวจ') || statusNote.includes('ยา') || statusNote.includes('หัตถการ') || statusNote.includes('ชำระ')) {
        setStatusNote('รอซักประวัติและวัดสัญญาณชีพ');
      }
    } else if (status === 'รอพบแพทย์') {
      if (!selectedDepartment.includes('ห้องตรวจ')) {
        setSelectedDepartment('ห้องตรวจ 1 (พญ.สุดา)');
      }
      setStatusNote('คัดกรองแล้ว รอเรียกเข้าห้องตรวจ');
    } else if (status === 'กำลังตรวจ') {
      if (!selectedDepartment.includes('ห้องตรวจ')) {
        setSelectedDepartment('ห้องตรวจ 1 (พญ.สุดา)');
      }
      setStatusNote('กำลังรับการตรวจกับแพทย์');
    } else if (status === 'รอทำหัตถการ') {
      setSelectedDepartment('ห้องหัตถการ (ทำแผล/ฉีดยา)');
      setStatusNote('ส่งทำแผล / ฉีดยา / พ่นยา');
    } else if (status === 'รอชำระเงิน') {
      setSelectedDepartment('ห้องการเงิน (แคชเชียร์)');
      setStatusNote('ตรวจเสร็จสิ้น รอชำระค่ารักษาพยาบาล');
    } else if (status === 'รอรับยา') {
      setSelectedDepartment('ห้องจ่ายยาและเภสัชกรรม');
      setStatusNote('ชำระเงินแล้ว รอจัดยาและรับคำแนะนำ');
    } else if (status === 'เสร็จสิ้น') {
      setSelectedDepartment('ห้องจ่ายยาและเภสัชกรรม');
      setStatusNote('ตรวจรักษา ชำระเงิน และรับยาเรียบร้อย');
    } else if (status === 'ยกเลิกคิว') {
      setStatusNote('ผู้ป่วยยกเลิกคิว / ไม่มารับบริการ');
    }
  };

  // เมื่อผู้ใช้เปลี่ยนจุดบริการเองโดยตรง
  const handleDepartmentChange = (deptName: string) => {
    setSelectedDepartment(deptName);
    const foundDept = CLINIC_DEPARTMENTS.find((d) => d.name === deptName);
    if (foundDept && (!statusNote || statusNote === 'รอรับบริการ')) {
      setStatusNote(foundDept.defaultNote);
    }
  };

  // บันทึกการแก้ไขสถานะลง Backend DB
  const handleSaveStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQueue) return;

    try {
      await queueApi.updateStatus(selectedQueue.id, newStatus, selectedDepartment, statusNote.trim() || selectedQueue.note);
      fetchQueues();
    } catch (err) {
      console.warn('Update queue status error:', err);
    }

    setQueueList((prev) =>
      prev.map((item) =>
        item.id === selectedQueue.id
          ? {
              ...item,
              status: newStatus,
              department: selectedDepartment,
              note: statusNote.trim() || item.note,
            }
          : item
      )
    );

    setIsModalOpen(false);
    const shortDept = selectedDepartment.split(' (')[0];
    showToast(`อัปเดตสถานะคิว ${selectedQueue.queueNo} เป็น "${newStatus}" (${shortDept}) เรียบร้อยแล้ว`);
  };

  const handleCallQueue = (item: QueueItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    callQueueAudio(item.queueNo, item.department, item.status);
    const spokenDept = getSpokenDepartmentText(item.department, item.status).replace('ค่ะ', '').trim();
    toast.success(`กำลังเรียกคิว ${item.queueNo} (${item.patientName}) ${spokenDept}`);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    toast.success(msg, { id: msg });
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // คืนค่า class สีของ Status Pill
  const getStatusBadgeClass = (status: QueueStatus) => {
    switch (status) {
      case 'รอคัดกรอง':
        return 'badge-screening';
      case 'รอพบแพทย์':
        return 'badge-doctor';
      case 'กำลังตรวจ':
        return 'badge-examination';
      case 'รอทำหัตถการ':
        return 'badge-treatment';
      case 'รอชำระเงิน':
        return 'badge-billing';
      case 'รอรับยา':
        return 'badge-pharmacy';
      case 'เสร็จสิ้น':
        return 'badge-completed';
      case 'ยกเลิกคิว':
        return 'badge-cancelled';
      default:
        return 'badge-screening';
    }
  };

  return (
    <div className="queue-page">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="queue-toast">
          <svg className="toast-icon" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="queue-page-header">
        <div className="queue-header-left">
          <h1 className="queue-title">จัดการคิวผู้ป่วย (Queue Management)</h1>
          <p className="queue-subtitle">ระบบจัดการและติดตามลำดับคิวผู้ป่วยแบบ Real-time (สำหรับเจ้าหน้าที่เวชระเบียนและพยาบาล)</p>
        </div>
      </div>

      {/* 4 Executive KPI Overview Cards */}
      <div className="queue-stats-grid">
        <div
          className={`stat-card stat-total ${selectedCategory === 'all' ? 'active' : ''}`}
          onClick={() => {
            setSelectedCategory('all');
            setStatusFilter('all');
            setCurrentPage(1);
          }}
        >
          <div className="stat-card-header">
            <span className="stat-label">คิวรอรับบริการทั้งหมด</span>
            <div className="stat-icon-wrap icon-blue">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
          </div>
          <div className="stat-value">{stats.active}</div>
          <div className="stat-sub-text">กำลังรับบริการในระบบทั้งหมด</div>
        </div>

        <div
          className={`stat-card stat-in-service ${selectedCategory === 'in_service' ? 'active' : ''}`}
          onClick={() => {
            setSelectedCategory('in_service');
            setStatusFilter('in_service_all');
            setCurrentPage(1);
          }}
        >
          <div className="stat-card-header">
            <span className="stat-label">กำลังรับบริการ / รอตรวจ</span>
            <div className="stat-icon-wrap icon-amber">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
          </div>
          <div className="stat-value">{stats.waitingScreening + stats.waitingDoctor + stats.inExamination + stats.waitingTreatment}</div>
          <div className="stat-sub-text">
            คัดกรอง {stats.waitingScreening} • รอตรวจ {stats.waitingDoctor} • ตรวจ {stats.inExamination} • หัตถการ {stats.waitingTreatment}
          </div>
        </div>

        <div
          className={`stat-card stat-cash-pharmacy ${selectedCategory === 'cash_pharmacy' ? 'active' : ''}`}
          onClick={() => {
            setSelectedCategory('cash_pharmacy');
            setStatusFilter('cash_pharmacy_all');
            setCurrentPage(1);
          }}
        >
          <div className="stat-card-header">
            <span className="stat-label">การเงิน & เภสัชกรรม</span>
            <div className="stat-icon-wrap icon-teal">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <line x1="6" y1="8" x2="6" y2="8" />
                <line x1="10" y1="8" x2="18" y2="8" />
                <line x1="6" y1="12" x2="6" y2="12" />
                <line x1="10" y1="12" x2="18" y2="12" />
                <line x1="6" y1="16" x2="6" y2="16" />
                <line x1="10" y1="16" x2="18" y2="16" />
              </svg>
            </div>
          </div>
          <div className="stat-value">{stats.waitingBilling + stats.waitingPharmacy}</div>
          <div className="stat-sub-text">
            รอชำระเงิน {stats.waitingBilling} • รอรับยา {stats.waitingPharmacy}
          </div>
        </div>

        <div
          className={`stat-card stat-completed ${selectedCategory === 'completed_cancelled' ? 'active' : ''}`}
          onClick={() => {
            setSelectedCategory('completed_cancelled');
            setStatusFilter('completed_cancelled_all');
            setCurrentPage(1);
          }}
        >
          <div className="stat-card-header">
            <span className="stat-label">เสร็จสิ้น & ยกเลิกคิว</span>
            <div className="stat-icon-wrap icon-green">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
          </div>
          <div className="stat-value">{stats.completed + stats.cancelled}</div>
          <div className="stat-sub-text">
            เสร็จสิ้น {stats.completed} • ยกเลิกคิว {stats.cancelled}
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="queue-table-card">
        {/* Table Controls (Search & Status Filter Pills) */}
        <div className="table-controls">
          <div className="search-bar-wrap">
            <svg className="table-search-icon" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M9 17A8 8 0 109 1a8 8 0 000 16zM19 19l-4.35-4.35"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <input
              type="text"
              className="table-search-input"
              placeholder="ค้นหาด้วยหมายเลขคิว หรือ ชื่อคนไข้..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
            {searchQuery && (
              <button className="clear-search-btn" onClick={() => setSearchQuery('')} aria-label="Clear search">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            )}
          </div>

          <div className="status-filter-pills-bar">
            {selectedCategory === 'all' && (
              <>
                <button
                  type="button"
                  className={`filter-pill-btn ${statusFilter === 'all' ? 'active' : ''}`}
                  onClick={() => {
                    setStatusFilter('all');
                    setCurrentPage(1);
                  }}
                >
                  <span>ทั้งหมดในระบบ</span>
                  <span className="pill-count">{stats.active}</span>
                </button>

                <button
                  type="button"
                  className={`filter-pill-btn pill-screening ${statusFilter === 'รอคัดกรอง' ? 'active' : ''}`}
                  onClick={() => {
                    setStatusFilter('รอคัดกรอง');
                    setCurrentPage(1);
                  }}
                >
                  <span className="pill-dot dot-screening"></span>
                  <span>รอคัดกรอง</span>
                  <span className="pill-count">{stats.waitingScreening}</span>
                </button>

                <button
                  type="button"
                  className={`filter-pill-btn pill-doctor ${statusFilter === 'รอพบแพทย์' ? 'active' : ''}`}
                  onClick={() => {
                    setStatusFilter('รอพบแพทย์');
                    setCurrentPage(1);
                  }}
                >
                  <span className="pill-dot dot-doctor"></span>
                  <span>รอพบแพทย์</span>
                  <span className="pill-count">{stats.waitingDoctor}</span>
                </button>

                <button
                  type="button"
                  className={`filter-pill-btn pill-examination ${statusFilter === 'กำลังตรวจ' ? 'active' : ''}`}
                  onClick={() => {
                    setStatusFilter('กำลังตรวจ');
                    setCurrentPage(1);
                  }}
                >
                  <span className="pill-dot dot-examination"></span>
                  <span>กำลังตรวจ</span>
                  <span className="pill-count">{stats.inExamination}</span>
                </button>

                <button
                  type="button"
                  className={`filter-pill-btn pill-treatment ${statusFilter === 'รอทำหัตถการ' ? 'active' : ''}`}
                  onClick={() => {
                    setStatusFilter('รอทำหัตถการ');
                    setCurrentPage(1);
                  }}
                >
                  <span className="pill-dot dot-treatment"></span>
                  <span>รอทำหัตถการ</span>
                  <span className="pill-count">{stats.waitingTreatment}</span>
                </button>

                <button
                  type="button"
                  className={`filter-pill-btn pill-billing ${statusFilter === 'รอชำระเงิน' ? 'active' : ''}`}
                  onClick={() => {
                    setStatusFilter('รอชำระเงิน');
                    setCurrentPage(1);
                  }}
                >
                  <span className="pill-dot dot-billing"></span>
                  <span>รอชำระเงิน</span>
                  <span className="pill-count">{stats.waitingBilling}</span>
                </button>

                <button
                  type="button"
                  className={`filter-pill-btn pill-pharmacy ${statusFilter === 'รอรับยา' ? 'active' : ''}`}
                  onClick={() => {
                    setStatusFilter('รอรับยา');
                    setCurrentPage(1);
                  }}
                >
                  <span className="pill-dot dot-pharmacy"></span>
                  <span>รอรับยา</span>
                  <span className="pill-count">{stats.waitingPharmacy}</span>
                </button>
              </>
            )}

            {selectedCategory === 'in_service' && (
              <>
                <button
                  type="button"
                  className={`filter-pill-btn ${statusFilter === 'in_service_all' ? 'active' : ''}`}
                  onClick={() => {
                    setStatusFilter('in_service_all');
                    setCurrentPage(1);
                  }}
                >
                  <span>ทั้งหมดในกลุ่มนี้</span>
                  <span className="pill-count">
                    {stats.waitingScreening + stats.waitingDoctor + stats.inExamination + stats.waitingTreatment}
                  </span>
                </button>

                <button
                  type="button"
                  className={`filter-pill-btn pill-screening ${statusFilter === 'รอคัดกรอง' ? 'active' : ''}`}
                  onClick={() => {
                    setStatusFilter('รอคัดกรอง');
                    setCurrentPage(1);
                  }}
                >
                  <span className="pill-dot dot-screening"></span>
                  <span>รอคัดกรอง</span>
                  <span className="pill-count">{stats.waitingScreening}</span>
                </button>

                <button
                  type="button"
                  className={`filter-pill-btn pill-doctor ${statusFilter === 'รอพบแพทย์' ? 'active' : ''}`}
                  onClick={() => {
                    setStatusFilter('รอพบแพทย์');
                    setCurrentPage(1);
                  }}
                >
                  <span className="pill-dot dot-doctor"></span>
                  <span>รอพบแพทย์</span>
                  <span className="pill-count">{stats.waitingDoctor}</span>
                </button>

                <button
                  type="button"
                  className={`filter-pill-btn pill-examination ${statusFilter === 'กำลังตรวจ' ? 'active' : ''}`}
                  onClick={() => {
                    setStatusFilter('กำลังตรวจ');
                    setCurrentPage(1);
                  }}
                >
                  <span className="pill-dot dot-examination"></span>
                  <span>กำลังตรวจ</span>
                  <span className="pill-count">{stats.inExamination}</span>
                </button>

                <button
                  type="button"
                  className={`filter-pill-btn pill-treatment ${statusFilter === 'รอทำหัตถการ' ? 'active' : ''}`}
                  onClick={() => {
                    setStatusFilter('รอทำหัตถการ');
                    setCurrentPage(1);
                  }}
                >
                  <span className="pill-dot dot-treatment"></span>
                  <span>รอทำหัตถการ</span>
                  <span className="pill-count">{stats.waitingTreatment}</span>
                </button>
              </>
            )}

            {selectedCategory === 'cash_pharmacy' && (
              <>
                <button
                  type="button"
                  className={`filter-pill-btn ${statusFilter === 'cash_pharmacy_all' ? 'active' : ''}`}
                  onClick={() => {
                    setStatusFilter('cash_pharmacy_all');
                    setCurrentPage(1);
                  }}
                >
                  <span>ทั้งหมดในกลุ่มนี้</span>
                  <span className="pill-count">{stats.waitingBilling + stats.waitingPharmacy}</span>
                </button>

                <button
                  type="button"
                  className={`filter-pill-btn pill-billing ${statusFilter === 'รอชำระเงิน' ? 'active' : ''}`}
                  onClick={() => {
                    setStatusFilter('รอชำระเงิน');
                    setCurrentPage(1);
                  }}
                >
                  <span className="pill-dot dot-billing"></span>
                  <span>รอชำระเงิน</span>
                  <span className="pill-count">{stats.waitingBilling}</span>
                </button>

                <button
                  type="button"
                  className={`filter-pill-btn pill-pharmacy ${statusFilter === 'รอรับยา' ? 'active' : ''}`}
                  onClick={() => {
                    setStatusFilter('รอรับยา');
                    setCurrentPage(1);
                  }}
                >
                  <span className="pill-dot dot-pharmacy"></span>
                  <span>รอรับยา</span>
                  <span className="pill-count">{stats.waitingPharmacy}</span>
                </button>
              </>
            )}

            {selectedCategory === 'completed_cancelled' && (
              <>
                <button
                  type="button"
                  className={`filter-pill-btn ${statusFilter === 'completed_cancelled_all' ? 'active' : ''}`}
                  onClick={() => {
                    setStatusFilter('completed_cancelled_all');
                    setCurrentPage(1);
                  }}
                >
                  <span>ทั้งหมดในกลุ่มนี้</span>
                  <span className="pill-count">{stats.completed + stats.cancelled}</span>
                </button>

                <button
                  type="button"
                  className={`filter-pill-btn pill-completed ${statusFilter === 'เสร็จสิ้น' ? 'active' : ''}`}
                  onClick={() => {
                    setStatusFilter('เสร็จสิ้น');
                    setCurrentPage(1);
                  }}
                >
                  <span className="pill-dot dot-completed"></span>
                  <span>เสร็จสิ้นการบริการ</span>
                  <span className="pill-count">{stats.completed}</span>
                </button>

                <button
                  type="button"
                  className={`filter-pill-btn pill-cancelled ${statusFilter === 'ยกเลิกคิว' ? 'active' : ''}`}
                  onClick={() => {
                    setStatusFilter('ยกเลิกคิว');
                    setCurrentPage(1);
                  }}
                >
                  <span className="pill-dot dot-cancelled"></span>
                  <span>ยกเลิกคิว</span>
                  <span className="pill-count">{stats.cancelled}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Responsive Queue Table */}
        <div className="table-responsive">
          <table className="modern-queue-table">
            <thead>
              <tr>
                <th className="col-queue-no">หมายเลขคิว</th>
                <th className="col-patient-name">ชื่อ-นามสกุล</th>
                <th className="col-department">จุดบริการ / ห้องตรวจ</th>
                <th className="col-status">สถานะ</th>
                <th className="col-action">การดำเนินการ</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.length > 0 ? (
                currentItems.map((item) => (
                  <tr key={item.id} className="queue-table-row">
                    <td className="col-queue-no">
                      <div className="queue-locked-wrapper">
                        <span className="queue-mono-tag">{item.queueNo}</span>
                        {/* ไม่แสดงปุ่มเรียกคิวในสถานะ: กำลังตรวจ, เสร็จสิ้น, ยกเลิกคิว */}
                        {!['กำลังตรวจ', 'เสร็จสิ้น', 'ยกเลิกคิว'].includes(item.status) ? (
                          <button
                            type="button"
                            className="btn-call-audio"
                            title={`ประกาศเรียกคิว ${item.queueNo} (${item.patientName}) ด้วยเสียงภาษาไทย`}
                            aria-label={`ประกาศเรียกคิว ${item.queueNo}`}
                            onClick={(e) => handleCallQueue(item, e)}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                            </svg>
                          </button>
                        ) : (
                          <span className="call-audio-placeholder" />
                        )}
                      </div>
                    </td>
                    <td className="col-patient-name">
                      <div className="patient-info-cell">
                        <span className="patient-name-text" title={item.patientName}>
                          {item.patientName}
                        </span>
                        <span className="patient-sub-text" title={`${item.idCard} • เวลา ${item.time}`}>
                          {item.idCard} • เวลา {item.time}
                        </span>
                      </div>
                    </td>
                    <td
                      className="col-department"
                      onClick={() => setDetailModalQueue(item)}
                      title="คลิกเพื่อดูรายละเอียดและผลการคัดกรองฉบับเต็ม"
                    >
                      <div className="dept-info-cell clickable">
                        <span className="dept-room-text" title={item.department}>
                          {item.department}
                        </span>
                        <span className="dept-note-text" title={item.note || 'รอรับบริการ'}>
                          {item.note || 'รอรับบริการ'}
                        </span>
                      </div>
                    </td>
                    <td className="col-status">
                      <div className={`status-pill ${getStatusBadgeClass(item.status)}`}>
                        <span className="status-text">{item.status}</span>
                      </div>
                    </td>
                    <td className="col-action">
                      <button
                        type="button"
                        className="btn-edit-status"
                        onClick={() => handleOpenEditModal(item)}
                      >
                        <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path
                            d="M11.333 2A1.886 1.886 0 0114 4.667l-9 9-3.667 1 1-3.667 9-9z"
                            stroke="currentColor"
                            strokeWidth="1.33"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <span>แก้ไขสถานะ</span>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="empty-table-cell">
                    <div className="empty-state">
                      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
                        <path d="M9 10h.01M15 10h.01M9.5 15a3.5 3.5 0 005 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                      <p>ไม่พบคิวที่ตรงกับเงื่อนไขการค้นหา</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="table-pagination-footer">
          <div className="pagination-info">
            แสดง {filteredQueue.length > 0 ? startIndex + 1 : 0} ถึง{' '}
            {Math.min(startIndex + itemsPerPage, filteredQueue.length)} จาก {filteredQueue.length} รายการ
          </div>
          <div className="pagination-controls">
            <button
              type="button"
              className="pagination-btn pagination-prev"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            >
              ย้อนกลับ
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
              <button
                key={pageNum}
                type="button"
                className={`pagination-btn pagination-num ${currentPage === pageNum ? 'active' : ''}`}
                onClick={() => setCurrentPage(pageNum)}
              >
                {pageNum}
              </button>
            ))}
            <button
              type="button"
              className="pagination-btn pagination-next"
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
            >
              ถัดไป
            </button>
          </div>
        </div>
      </div>

      {/* Modern Modal for Editing Status */}
      {isModalOpen && selectedQueue && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-group">
                <h3 className="modal-title">แก้ไขสถานะคิวผู้ป่วย</h3>
                <p className="modal-subtitle">
                  คิว {selectedQueue.queueNo} : {selectedQueue.patientName}
                </p>
              </div>
              <button className="modal-close-btn" onClick={() => setIsModalOpen(false)} aria-label="Close modal">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <form onSubmit={handleSaveStatus}>
              <div className="modal-body">
                {/* Current Info Card */}
                <div className="modal-info-card">
                  <div className="modal-info-item">
                    <span className="info-label">หมายเลขคิว:</span>
                    <span className="info-val queue-highlight">{selectedQueue.queueNo}</span>
                  </div>
                  <div className="modal-info-item">
                    <span className="info-label">ชื่อคนไข้:</span>
                    <span className="info-val">{selectedQueue.patientName}</span>
                  </div>
                  <div className="modal-info-item">
                    <span className="info-label">จุดบริการปัจจุบัน:</span>
                    <span className="info-val dept-highlight">{selectedQueue.department}</span>
                  </div>
                  <div className="modal-info-item">
                    <span className="info-label">สถานะปัจจุบัน:</span>
                    <span className={`status-pill ${getStatusBadgeClass(selectedQueue.status)}`}>
                      <span>{selectedQueue.status}</span>
                    </span>
                  </div>
                </div>

                {/* 1. Status Selection Dropdown */}
                <div className="modal-form-group">
                  <label className="modal-label" htmlFor="select-modal-status">
                    1. เลือกสถานะใหม่ (จะปรับห้องตรวจให้อัตโนมัติ):
                  </label>
                  <select
                    id="select-modal-status"
                    className="modal-select"
                    value={newStatus}
                    onChange={(e) => handleStatusChange(e.target.value as QueueStatus)}
                  >
                    <optgroup label="จุดคัดกรอง & ตรวจรักษา">
                      <option value="รอคัดกรอง">
                        รอคัดกรอง — ผู้ป่วยลงทะเบียนแล้ว รอวัดสัญญาณชีพและประเมิน Triage
                      </option>
                      <option value="รอพบแพทย์">
                        รอพบแพทย์ — คัดกรองเสร็จสิ้น รอเรียกเข้าห้องตรวจแพทย์
                      </option>
                      <option value="กำลังตรวจ">
                        กำลังตรวจ — ผู้ป่วยอยู่ในห้องตรวจกับแพทย์
                      </option>
                      <option value="รอทำหัตถการ">
                        รอทำหัตถการ — รอทำแผล ฉีดยา พ่นยา หรือให้น้ำเกลือ
                      </option>
                    </optgroup>
                    <optgroup label="การเงิน & เภสัชกรรม">
                      <option value="รอชำระเงิน">
                        รอชำระเงิน — ตรวจเสร็จสิ้น รอคิดเงินและชำระค่าบริการ
                      </option>
                      <option value="รอรับยา">
                        รอรับยา — ชำระเงินแล้ว รอจัดยาและเรียกรับยาที่ห้องยา
                      </option>
                    </optgroup>
                    <optgroup label="สิ้นสุดกระบวนการ & ยกเลิก">
                      <option value="เสร็จสิ้น">
                        เสร็จสิ้น — ตรวจรักษา ชำระเงิน และรับยาเรียบร้อย
                      </option>
                      <option value="ยกเลิกคิว">
                        ยกเลิกคิว — ผู้ป่วยสละสิทธิ์หรือไม่มารับบริการ
                      </option>
                    </optgroup>
                  </select>
                </div>

                {/* 2. Target Department / Room Selector */}
                <div className="modal-form-group">
                  <label className="modal-label" htmlFor="select-modal-department">
                    2. จุดบริการ / ห้องตรวจที่ส่งต่อ (Target Room):
                  </label>
                  <select
                    id="select-modal-department"
                    className="modal-select"
                    value={selectedDepartment}
                    onChange={(e) => handleDepartmentChange(e.target.value)}
                  >
                    <optgroup label="จุดคัดกรอง">
                      <option value="จุดคัดกรอง">
                        จุดคัดกรอง
                      </option>
                    </optgroup>
                    <optgroup label="ห้องตรวจแพทย์">
                      <option value="ห้องตรวจ 1 (พญ.สุดา)">
                        ห้องตรวจ 1 (พญ.สุดา)
                      </option>
                      <option value="ห้องตรวจ 2 (นพ.วิชัย)">
                        ห้องตรวจ 2 (นพ.วิชัย)
                      </option>
                      <option value="ห้องตรวจ 3 (พญ.เกศรา)">
                        ห้องตรวจ 3 (พญ.เกศรา)
                      </option>
                    </optgroup>
                    <optgroup label="หัตถการ & สนับสนุน">
                      <option value="ห้องหัตถการ (ทำแผล/ฉีดยา)">
                        ห้องหัตถการ (ทำแผล/ฉีดยา)
                      </option>
                    </optgroup>
                    <optgroup label="การเงิน & เภสัชกรรม">
                      <option value="ห้องการเงิน (แคชเชียร์)">
                        ห้องการเงิน (แคชเชียร์)
                      </option>
                      <option value="ห้องจ่ายยาและเภสัชกรรม">
                        ห้องจ่ายยาและเภสัชกรรม
                      </option>
                    </optgroup>
                  </select>
                </div>

                {/* 3. Note / Clinical Instruction Input */}
                <div className="modal-form-group">
                  <label className="modal-label">3. หมายเหตุอาการ / คำสั่งการส่งต่อ:</label>
                  <input
                    type="text"
                    className="modal-input"
                    placeholder="เช่น ส่งห้องตรวจ 1, วัดความดันซ้ำ, รอรับยา..."
                    value={statusNote}
                    onChange={(e) => setStatusNote(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="modal-btn-cancel"
                  onClick={() => setIsModalOpen(false)}
                >
                  ยกเลิก
                </button>
                <button type="submit" className="modal-btn-save">
                  บันทึกการเปลี่ยนแปลง
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modern Modal for Viewing Full Department & Screening Details */}
      {detailModalQueue && (
        <div className="modal-backdrop" onClick={() => setDetailModalQueue(null)}>
          <div className="modal-content detail-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-group">
                <h3 className="modal-title">รายละเอียดจุดบริการ & การคัดกรอง</h3>
                <p className="modal-subtitle">
                  หมายเลขคิว {detailModalQueue.queueNo} • {detailModalQueue.patientName}
                </p>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setDetailModalQueue(null)}
                aria-label="Close modal"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <div className="modal-body">
              {/* Quick Info Grid */}
              <div className="modal-info-card">
                <div className="modal-info-item">
                  <span className="info-label">หมายเลขคิว:</span>
                  <span className="info-val queue-highlight">{detailModalQueue.queueNo}</span>
                </div>
                <div className="modal-info-item">
                  <span className="info-label">ชื่อคนไข้:</span>
                  <span className="info-val">{detailModalQueue.patientName}</span>
                </div>
                <div className="modal-info-item">
                  <span className="info-label">เลขบัตรประชาชน / HN:</span>
                  <span className="info-val">{detailModalQueue.idCard}</span>
                </div>
                <div className="modal-info-item">
                  <span className="info-label">เวลารับคิว:</span>
                  <span className="info-val">{detailModalQueue.time} น.</span>
                </div>
                <div className="modal-info-item">
                  <span className="info-label">สถานะปัจจุบัน:</span>
                  <span className="info-val">
                    <span className={`status-pill ${getStatusBadgeClass(detailModalQueue.status)}`} style={{ height: '30px', fontSize: '13px', padding: '0 12px' }}>
                      <span className="status-text">{detailModalQueue.status}</span>
                    </span>
                  </span>
                </div>
              </div>

              {/* Full Details Cards */}
              <div className="detail-section">
                <div className="detail-field-group">
                  <span className="detail-field-label">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                      <polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                    จุดบริการ / ห้องตรวจ:
                  </span>
                  <div className="detail-field-box room-box">
                    {detailModalQueue.department}
                  </div>
                </div>

                <div className="detail-field-group">
                  <span className="detail-field-label">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                      <line x1="16" y1="13" x2="8" y2="13"></line>
                      <line x1="16" y1="17" x2="8" y2="17"></line>
                      <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                    หมายเหตุอาการ / ผลการคัดกรอง Triage / คำสั่งการส่งต่อ (ฉบับเต็ม):
                  </span>
                  <div className="detail-field-box note-box">
                    {detailModalQueue.note ? (
                      <p className="detail-note-full-text">{detailModalQueue.note}</p>
                    ) : (
                      <span className="detail-empty-text">ไม่มีข้อความเพิ่มเติม (รอรับบริการตามลำดับ)</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="modal-btn-cancel"
                onClick={() => setDetailModalQueue(null)}
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QueuePage;
