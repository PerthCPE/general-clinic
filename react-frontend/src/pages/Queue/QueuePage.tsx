import React, { useState } from 'react';
import './QueuePage.css';

export type QueueStatus =
  | 'รอคัดกรอง'
  | 'รอพบแพทย์'
  | 'กำลังตรวจ'
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

const INITIAL_QUEUE_DATA: QueueItem[] = [
  {
    id: 'q-1',
    queueNo: 'Q001',
    patientName: 'นายสมชาย ใจดี',
    idCard: '1-1002-34567-89-0',
    status: 'รอคัดกรอง',
    department: 'แผนกคัดกรอง',
    time: '08:30 น.',
    note: 'รอวัดความดันโลหิต',
  },
  {
    id: 'q-2',
    queueNo: 'Q002',
    patientName: 'นางสาววิภาดา มณีรัตน์',
    idCard: '3-1005-98765-43-2',
    status: 'รอพบแพทย์',
    department: 'ห้องตรวจ 1 (พญ.สุดา)',
    time: '08:45 น.',
    note: 'คัดกรองแล้ว สัญญาณชีพปกติ',
  },
  {
    id: 'q-3',
    queueNo: 'Q003',
    patientName: 'นายอาทิตย์ มีสุข',
    idCard: '1-1014-55443-21-9',
    status: 'รอคัดกรอง',
    department: 'แผนกคัดกรอง',
    time: '08:50 น.',
    note: 'ผู้ป่วย Walk-in ปวดศีรษะ',
  },
  {
    id: 'q-4',
    queueNo: 'Q004',
    patientName: 'นางสมศรี รักษาดี',
    idCard: '5-1020-11223-34-5',
    status: 'รอพบแพทย์',
    department: 'ห้องตรวจ 2 (นพ.วิชัย)',
    time: '09:05 น.',
    note: 'นัดติดตามผลความดัน',
  },
  {
    id: 'q-5',
    queueNo: 'Q005',
    patientName: 'นายธนกฤต กิตติพงษ์',
    idCard: '1-1033-77889-90-1',
    status: 'รอคัดกรอง',
    department: 'แผนกคัดกรอง',
    time: '09:15 น.',
    note: 'มีไข้สูง 38.5 C',
  },
  {
    id: 'q-6',
    queueNo: 'Q006',
    patientName: 'นางสาวพิมพา ชื่นชม',
    idCard: '3-1044-66554-43-2',
    status: 'กำลังตรวจ',
    department: 'ห้องตรวจ 1 (พญ.สุดา)',
    time: '09:20 น.',
    note: 'กำลังเข้าตรวจ',
  },
  {
    id: 'q-7',
    queueNo: 'Q007',
    patientName: 'นายณัฐวุฒิ สิทธิชัย',
    idCard: '1-1055-44332-21-0',
    status: 'รอคัดกรอง',
    department: 'แผนกคัดกรอง',
    time: '09:30 น.',
    note: 'ขอใบรับรองแพทย์',
  },
  {
    id: 'q-8',
    queueNo: 'Q008',
    patientName: 'นางสาวกนกวรรณ รัตนา',
    idCard: '3-1066-88990-01-2',
    status: 'รอพบแพทย์',
    department: 'ห้องตรวจ 2 (นพ.วิชัย)',
    time: '09:40 น.',
    note: 'รอผลแล็บเบื้องต้น',
  },
  {
    id: 'q-9',
    queueNo: 'Q009',
    patientName: 'นายประเสริฐ ยอดเยี่ยม',
    idCard: '1-1077-22334-45-6',
    status: 'รอคัดกรอง',
    department: 'แผนกคัดกรอง',
    time: '09:50 น.',
    note: 'แผลถลอก ทำแผลเบื้องต้น',
  },
  {
    id: 'q-10',
    queueNo: 'Q010',
    patientName: 'นางประภา เจริญผล',
    idCard: '5-1088-33445-56-7',
    status: 'เสร็จสิ้น',
    department: 'ห้องจ่ายยา',
    time: '09:55 น.',
    note: 'รับยากลับบ้านเรียบร้อย',
  },
];

const STATUS_OPTIONS: { value: QueueStatus; labelTh: string; desc: string }[] = [
  { value: 'รอคัดกรอง', labelTh: 'รอคัดกรอง', desc: 'ผู้ป่วยลงทะเบียนแล้ว รอวัดสัญญาณชีพ' },
  { value: 'รอพบแพทย์', labelTh: 'รอพบแพทย์', desc: 'คัดกรองเสร็จสิ้น รอเรียกเข้าห้องตรวจ' },
  { value: 'กำลังตรวจ', labelTh: 'กำลังตรวจ', desc: 'ผู้ป่วยอยู่ในห้องตรวจกับแพทย์' },
  { value: 'เสร็จสิ้น', labelTh: 'เสร็จสิ้น', desc: 'ตรวจและรับยา/ชำระเงินเรียบร้อย' },
  { value: 'ยกเลิกคิว', labelTh: 'ยกเลิกคิว', desc: 'ผู้ป่วยสละสิทธิ์หรือไม่มารับบริการ' },
];

const QueuePage: React.FC = () => {
  const [queueList, setQueueList] = useState<QueueItem[]>(INITIAL_QUEUE_DATA);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 8;

  // State สำหรับ Modal Edit Status
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedQueue, setSelectedQueue] = useState<QueueItem | null>(null);
  const [newStatus, setNewStatus] = useState<QueueStatus>('รอคัดกรอง');
  const [statusNote, setStatusNote] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // คำนวณสรุปสถิติจำนวนคิวแต่ละสถานะ
  const stats = {
    total: queueList.length,
    waitingScreening: queueList.filter((q) => q.status === 'รอคัดกรอง').length,
    waitingDoctor: queueList.filter((q) => q.status === 'รอพบแพทย์').length,
    inExamination: queueList.filter((q) => q.status === 'กำลังตรวจ').length,
    completed: queueList.filter((q) => q.status === 'เสร็จสิ้น').length,
  };

  // กรองข้อมูลตาม Search และ Status Filter พร้อมเรียงข้อมูลล่าสุดขึ้นก่อนเสมอ
  const filteredQueue = queueList
    .filter((item) => {
      const matchSearch =
        item.queueNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.idCard.includes(searchQuery);

      const matchStatus = statusFilter === 'all' || item.status === statusFilter;
      return matchSearch && matchStatus;
    })
    .reverse(); // สลับให้ข้อมูลล่าสุด (ท้าย Array) ขึ้นมาอยู่บนสุด

  // การตัดหน้า (Pagination)
  const totalPages = Math.ceil(filteredQueue.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentItems = filteredQueue.slice(startIndex, startIndex + itemsPerPage);

  // เปิด Modal เพื่อแก้ไขสถานะ
  const handleOpenEditModal = (item: QueueItem) => {
    setSelectedQueue(item);
    setNewStatus(item.status);
    setStatusNote(item.note || '');
    setIsModalOpen(true);
  };

  // บันทึกการแก้ไขสถานะ
  const handleSaveStatus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQueue) return;

    setQueueList((prev) =>
      prev.map((item) =>
        item.id === selectedQueue.id
          ? {
              ...item,
              status: newStatus,
              note: statusNote.trim() || item.note,
            }
          : item
      )
    );

    setIsModalOpen(false);
    showToast(`อัปเดตสถานะคิว ${selectedQueue.queueNo} เป็น "${newStatus}" เรียบร้อยแล้ว`);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
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

      {/* Quick Summary Stat Cards */}
      <div className="queue-stats-grid">
        <div
          className={`stat-card ${statusFilter === 'all' ? 'active' : ''}`}
          onClick={() => {
            setStatusFilter('all');
            setCurrentPage(1);
          }}
        >
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">คิวทั้งหมด</div>
        </div>

        <div
          className={`stat-card stat-screening ${statusFilter === 'รอคัดกรอง' ? 'active' : ''}`}
          onClick={() => {
            setStatusFilter('รอคัดกรอง');
            setCurrentPage(1);
          }}
        >
          <div className="stat-value">{stats.waitingScreening}</div>
          <div className="stat-label">รอคัดกรอง</div>
        </div>

        <div
          className={`stat-card stat-doctor ${statusFilter === 'รอพบแพทย์' ? 'active' : ''}`}
          onClick={() => {
            setStatusFilter('รอพบแพทย์');
            setCurrentPage(1);
          }}
        >
          <div className="stat-value">{stats.waitingDoctor}</div>
          <div className="stat-label">รอพบแพทย์</div>
        </div>

        <div
          className={`stat-card stat-examination ${statusFilter === 'กำลังตรวจ' ? 'active' : ''}`}
          onClick={() => {
            setStatusFilter('กำลังตรวจ');
            setCurrentPage(1);
          }}
        >
          <div className="stat-value">{stats.inExamination}</div>
          <div className="stat-label">กำลังตรวจ</div>
        </div>

        <div
          className={`stat-card stat-completed ${statusFilter === 'เสร็จสิ้น' ? 'active' : ''}`}
          onClick={() => {
            setStatusFilter('เสร็จสิ้น');
            setCurrentPage(1);
          }}
        >
          <div className="stat-value">{stats.completed}</div>
          <div className="stat-label">เสร็จสิ้น</div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="queue-table-card">
        {/* Table Controls (Search & Filter) */}
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
              <button className="clear-search-btn" onClick={() => setSearchQuery('')}>
                ✕
              </button>
            )}
          </div>

          {/* Status Filter Dropdown */}
          <div className="filter-dropdown-wrap">
            <select
              className="status-select-filter"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="all">สถานะทั้งหมด ({stats.total})</option>
              <option value="รอคัดกรอง">รอคัดกรอง ({stats.waitingScreening})</option>
              <option value="รอพบแพทย์">รอพบแพทย์ ({stats.waitingDoctor})</option>
              <option value="กำลังตรวจ">กำลังตรวจ ({stats.inExamination})</option>
              <option value="เสร็จสิ้น">เสร็จสิ้น ({stats.completed})</option>
              <option value="ยกเลิกคิว">ยกเลิกคิว</option>
            </select>
          </div>
        </div>

        {/* Responsive Queue Table */}
        <div className="table-responsive">
          <table className="modern-queue-table">
            <thead>
              <tr>
                <th className="col-queue-no">หมายเลขคิว</th>
                <th className="col-patient-name">ชื่อ-นามสกุล คนไข้</th>
                <th className="col-status">สถานะ</th>
                <th className="col-action">การดำเนินการ</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.length > 0 ? (
                currentItems.map((item) => (
                  <tr key={item.id} className="queue-table-row">
                    <td className="col-queue-no">
                      <span className="queue-number-badge">{item.queueNo}</span>
                    </td>
                    <td className="col-patient-name">
                      <div className="patient-info-cell">
                        <span className="patient-name-text">{item.patientName}</span>
                        <span className="patient-sub-text">
                          {item.idCard} • เวลา {item.time}
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
                  <td colSpan={4} className="empty-table-cell">
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
              <button className="modal-close-btn" onClick={() => setIsModalOpen(false)}>
                ✕
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
                    <span className="info-label">สถานะปัจจุบัน:</span>
                    <span className={`status-pill ${getStatusBadgeClass(selectedQueue.status)}`}>
                      <span>{selectedQueue.status}</span>
                    </span>
                  </div>
                </div>

                {/* Status Selection List */}
                <div className="modal-form-group">
                  <label className="modal-label">เลือกสถานะใหม่:</label>
                  <div className="status-options-grid">
                    {STATUS_OPTIONS.map((opt) => (
                      <label
                        key={opt.value}
                        className={`status-option-card ${newStatus === opt.value ? 'selected' : ''}`}
                      >
                        <input
                          type="radio"
                          name="queueStatus"
                          value={opt.value}
                          checked={newStatus === opt.value}
                          onChange={() => setNewStatus(opt.value)}
                        />
                        <div className="option-content">
                          <div className={`status-pill ${getStatusBadgeClass(opt.value)}`}>
                            <span className="status-text">{opt.value}</span>
                          </div>
                          <span className="option-desc-th">{opt.desc}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Note / Assignment Input */}
                <div className="modal-form-group">
                  <label className="modal-label">หมายเหตุเพิ่มเติม / แผนกที่ส่งต่อ:</label>
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
    </div>
  );
};

export default QueuePage;
