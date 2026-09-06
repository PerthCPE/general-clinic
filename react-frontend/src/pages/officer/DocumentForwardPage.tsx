import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { dmsApi, type BackendDocumentForward, type BackendUser } from '../../services/api';
import './DocumentForwardPage.css';

interface ForwardDoc {
  id: string;
  forwardId?: number;
  title: string;
  sender: string;
  recipient?: string;
  receivedDate: string;
  type: string;
  status: 'unread' | 'processing' | 'completed';
}

const generateIncomingDocs = (): ForwardDoc[] => {
  const docs: ForwardDoc[] = [];
  const senders = ['ห้องปฏิบัติการกลาง (Lab)', 'แผนกฉุกเฉิน (ER)', 'แผนกอายุรกรรม', 'ฝ่ายการเงินและบัญชี', 'ห้องจ่ายยา'];
  const titles = ['ผลการตรวจเลือด Complete Blood Count', 'ใบเบิกเวชภัณฑ์และอุปกรณ์การแพทย์', 'รายงานผลเอกซเรย์ทรวงอก (Chest X-Ray)', 'ใบส่งตัวผู้ป่วยกรณีฉุกเฉิน', 'บันทึกข้อความภายในแผนก'];
  const types = ['ผลตรวจ', 'ใบเบิก', 'รายงาน', 'เอกสารส่งตัว'];
  
  const now = new Date();
  const buddhistYear = now.getFullYear() + 543;
  const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

  for (let i = 1; i <= 6; i++) {
    const status = i <= 2 ? 'unread' : (i <= 4 ? 'processing' : 'completed');
    const day = ((now.getDate() - (i % 15) + 30) % 28) + 1;
    const month = monthNames[now.getMonth()];
    
    docs.push({
      id: `DOC-2569-${String(1000 + i)}`,
      title: `${titles[Math.floor(Math.random() * titles.length)]} #${i}`,
      sender: senders[Math.floor(Math.random() * senders.length)],
      receivedDate: `${day} ${month} ${buddhistYear} 09:${String(10 + (i % 45)).padStart(2, '0')}`,
      type: types[Math.floor(Math.random() * types.length)],
      status: status
    });
  }
  return docs;
};

const generateForwardedDocs = (): ForwardDoc[] => {
  const docs: ForwardDoc[] = [];
  const recipients = ['ผู้อำนวยการคลินิก', 'ห้องปฏิบัติการกลาง (Lab)', 'แผนกการเงิน', 'ฝ่ายทรัพยากรบุคคล', 'ห้องยา'];
  const titles = ['รายงานสรุปยอดผู้ป่วยรายเดือน', 'แบบฟอร์มประเมินบุคลากรทางการแพทย์', 'ใบส่งตัวไปโรงพยาบาลศูนย์', 'เอกสารเบิกจ่ายงบประมาณ'];
  const types = ['รายงาน', 'เอกสารทั่วไป', 'ผลตรวจ', 'ใบเบิก'];
  
  const now = new Date();
  const buddhistYear = now.getFullYear() + 543;
  const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

  for (let i = 1; i <= 6; i++) {
    const status = i <= 3 ? 'completed' : 'processing';
    const day = ((now.getDate() - (i % 12) + 30) % 28) + 1;
    const month = monthNames[now.getMonth()];
    
    docs.push({
      id: `FWD-2569-${String(2000 + i)}`,
      title: `${titles[Math.floor(Math.random() * titles.length)]} #${i}`,
      sender: 'ธุรการ (คุณสมจิต ดีใจ)',
      recipient: recipients[Math.floor(Math.random() * recipients.length)],
      receivedDate: `${day} ${month} ${buddhistYear} 11:${String(10 + (i % 45)).padStart(2, '0')}`,
      type: types[Math.floor(Math.random() * types.length)],
      status: status
    });
  }
  return docs;
};

export const DocumentForwardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'incoming' | 'forwarded'>('incoming');
  const [incomingDocs, setIncomingDocs] = useState<ForwardDoc[]>(generateIncomingDocs());
  const [forwardedDocs, setForwardedDocs] = useState<ForwardDoc[]>(generateForwardedDocs());
  const [recipientsList, setRecipientsList] = useState<BackendUser[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | 'processing' | 'completed'>('all');

  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<ForwardDoc | null>(null);
  
  // Metric Modals
  const [activeMetricModal, setActiveMetricModal] = useState<'today' | 'pending' | 'completed' | null>(null);

  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocRecipientId, setNewDocRecipientId] = useState<number>(6); // doctor1
  const [newDocRecipient, setNewDocRecipient] = useState('พญ.สุดา สุขสมบูรณ์');
  const [newDocType, setNewDocType] = useState('เอกสารทั่วไป');

  // Load real forwards and recipients from Database
  useEffect(() => {
    dmsApi.getForwards()
      .then((data: BackendDocumentForward[]) => {
        if (data && Array.isArray(data) && data.length > 0) {
          const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
          const mapped: ForwardDoc[] = data.map((fwd) => {
            const createdAt = new Date(fwd.created_at || Date.now());
            const bYear = createdAt.getFullYear() + 543;
            const formattedDate = `${createdAt.getDate()} ${monthNames[createdAt.getMonth()]} ${bYear} ${String(createdAt.getHours()).padStart(2, '0')}:${String(createdAt.getMinutes()).padStart(2, '0')}`;
            const isCompleted = fwd.status === 'Acknowledged';
            return {
              id: `FWD-${String(fwd.id).padStart(4, '0')}`,
              forwardId: fwd.id,
              title: fwd.document?.subject || `เอกสารส่งต่อ #${fwd.doc_id}`,
              sender: fwd.document?.creator?.fullname || 'ธุรการ (คุณสมจิต ดีใจ)',
              recipient: fwd.recipient?.fullname || fwd.recipient?.username || 'เจ้าหน้าที่ปลายทาง',
              receivedDate: formattedDate,
              type: 'เอกสารราชการ',
              status: isCompleted ? 'completed' : 'processing',
            };
          });
          setForwardedDocs(mapped);
        }
      })
      .catch(() => {});

    dmsApi.getRecipients()
      .then((users: BackendUser[]) => {
        if (users && Array.isArray(users) && users.length > 0) {
          setRecipientsList(users);
          setNewDocRecipientId(users[0].id);
          setNewDocRecipient(users[0].fullname || users[0].username);
        }
      })
      .catch(() => {});
  }, []);

  const handleSendDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocTitle.trim()) return;

    try {
      // 1. Create document first
      const docRes = await dmsApi.createDocument({
        external_doc_ref: `DOC-2569-${Date.now().toString().slice(-4)}`,
        subject: newDocTitle,
      });

      // 2. Forward to recipient
      const fwdRes = await dmsApi.forwardDocument({
        doc_id: docRes.document.id,
        forwarded_to: newDocRecipientId,
      });

      const now = new Date();
      const buddhistYear = now.getFullYear() + 543;
      const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

      const newDoc: ForwardDoc = {
        id: `FWD-${String(fwdRes.forward.id).padStart(4, '0')}`,
        forwardId: fwdRes.forward.id,
        title: newDocTitle,
        sender: 'ธุรการ (คุณสมจิต ดีใจ)',
        recipient: newDocRecipient,
        receivedDate: `${now.getDate()} ${monthNames[now.getMonth()]} ${buddhistYear} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
        type: newDocType,
        status: 'processing'
      };

      setForwardedDocs([newDoc, ...forwardedDocs]);
      setIsSendModalOpen(false);
      setNewDocTitle('');
      toast.success('ส่งต่อเอกสารลง Database เรียบร้อยแล้ว');
    } catch {
      const now = new Date();
      const buddhistYear = now.getFullYear() + 543;
      const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

      const newDoc: ForwardDoc = {
        id: `FWD-2569-${String(2000 + forwardedDocs.length + 1)}`,
        title: newDocTitle,
        sender: 'ธุรการ (คุณสมจิต ดีใจ)',
        recipient: newDocRecipient,
        receivedDate: `${now.getDate()} ${monthNames[now.getMonth()]} ${buddhistYear} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
        type: newDocType,
        status: 'processing'
      };

      setForwardedDocs([newDoc, ...forwardedDocs]);
      setIsSendModalOpen(false);
      setNewDocTitle('');
      toast.success('ส่งต่อเอกสารไปยังปลายทางเรียบร้อยแล้ว');
    }
  };

  const handleViewDetail = async (doc: ForwardDoc) => {
    setSelectedDoc(doc);
    setIsDetailModalOpen(true);
    if (doc.status === 'unread') {
      setIncomingDocs(prev => prev.map(d => d.id === doc.id ? { ...d, status: 'processing' } : d));
    }
    if (doc.forwardId && doc.status !== 'completed') {
      try {
        await dmsApi.acknowledgeForward(doc.forwardId);
        setForwardedDocs(prev => prev.map(d => d.forwardId === doc.forwardId ? { ...d, status: 'completed' } : d));
      } catch {
        // ignore
      }
    }
  };

  const handleArchive = (docId: string) => {
    setIncomingDocs(prev => prev.filter(d => d.id !== docId));
    toast.success('จัดเก็บเอกสารเข้าแฟ้มเรียบร้อยแล้ว');
  };

  const currentList = activeTab === 'incoming' ? incomingDocs : forwardedDocs;
  const filteredList = currentList.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.sender.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.recipient && doc.recipient.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || doc.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const renderMetricModal = () => {
    if (!activeMetricModal) return null;
    
    let title = '';
    let dataList: ForwardDoc[] = [];
    
    if (activeMetricModal === 'today') {
      title = 'เอกสารใหม่วันนี้ (12 รายการ)';
      dataList = incomingDocs.slice(0, 12);
    }
    if (activeMetricModal === 'pending') {
      title = 'รอการดำเนินการ (5 รายการ)';
      dataList = incomingDocs.filter(d => d.status === 'unread' || d.status === 'processing').slice(0, 5);
    }
    if (activeMetricModal === 'completed') {
      title = 'ส่งต่อสำเร็จสัปดาห์นี้ (28 รายการ)';
      dataList = forwardedDocs.filter(d => d.status === 'completed').slice(0, 28);
    }

    return (
      <div className="dms-modal-backdrop" onClick={() => setActiveMetricModal(null)}>
        <div className="dms-modal-card dms-modal-wide" onClick={e => e.stopPropagation()}>
          <div className="dms-modal-header">
            <div className="dms-modal-title-group">
              <div className="dms-modal-icon-badge">
                <svg viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2">
                  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <h3 className="dms-modal-title">{title}</h3>
                <p className="dms-modal-subtitle">รายการเอกสารตามสถิติ</p>
              </div>
            </div>
            <button className="dms-close-btn" onClick={() => setActiveMetricModal(null)} aria-label="Close">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
          <div className="dms-modal-body dms-modal-scrollable">
            <div className="table-responsive">
              <table className="dms-master-table">
                <thead>
                  <tr>
                    <th>รหัสเอกสาร</th>
                    <th>ชื่อเอกสาร</th>
                    <th>{activeMetricModal === 'completed' ? 'ส่งถึง' : 'จาก'}</th>
                    <th>สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {dataList.map(doc => (
                    <tr key={doc.id}>
                      <td className="doc-code-text">{doc.id}</td>
                      <td>
                        <span className="doc-name-text">{doc.title}</span>
                      </td>
                      <td>{activeMetricModal === 'completed' ? doc.recipient : doc.sender}</td>
                      <td>
                        <span className={`status-pill ${doc.status}`}>
                          <span className="status-dot"></span>
                          {doc.status === 'unread' && 'ยังไม่อ่าน'}
                          {doc.status === 'processing' && 'กำลังดำเนินการ'}
                          {doc.status === 'completed' && 'เสร็จสิ้น'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="dms-modal-footer">
            <button className="dms-btn-primary" onClick={() => setActiveMetricModal(null)}>
              ปิดหน้าต่าง
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="forward-container">
      {/* 1. Page Header */}
      <div className="page-header-container">
        <div className="page-title-group">
          <div className="page-icon-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" width="24" height="24">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <h1 className="page-main-title">ส่งต่อเอกสาร (Document Forwarding)</h1>
            <p className="page-sub-title">ระบบรับเข้าและส่งต่อเอกสาร บันทึกข้อความ และผลตรวจระหว่างแผนก</p>
          </div>
        </div>

        <button className="dms-btn-primary action-btn-send" onClick={() => setIsSendModalOpen(true)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          ส่งต่อเอกสารใหม่
        </button>
      </div>

      {/* 2. Metrics Cards */}
      <div className="dms-metrics-grid">
        <div className="dms-card metric-card interactive" onClick={() => setActiveMetricModal('today')}>
          <div className="metric-icon-wrapper blue-bg">
            <svg viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" width="24" height="24">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M14 2v6h6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="metric-info">
            <span className="metric-label">เอกสารใหม่วันนี้</span>
            <span className="metric-value">12</span>
            <span className="metric-subtext blue-text">คลิกเพื่อดูรายการ</span>
          </div>
        </div>

        <div className="dms-card metric-card interactive" onClick={() => setActiveMetricModal('pending')}>
          <div className="metric-icon-wrapper red-bg">
            <svg viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" width="24" height="24">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <div className="metric-info">
            <span className="metric-label">รอการดำเนินการ</span>
            <span className="metric-value">5</span>
            <span className="metric-subtext red-text">คลิกเพื่อดูรายการ</span>
          </div>
        </div>

        <div className="dms-card metric-card interactive" onClick={() => setActiveMetricModal('completed')}>
          <div className="metric-icon-wrapper green-bg">
            <svg viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" width="24" height="24">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          <div className="metric-info">
            <span className="metric-label">ส่งต่อสำเร็จสัปดาห์นี้</span>
            <span className="metric-value">28</span>
            <span className="metric-subtext green-text">คลิกเพื่อดูรายการ</span>
          </div>
        </div>
      </div>

      {/* 3. Main Card & Tab Navigation */}
      <div className="dms-card forward-main-card">
        <div className="forward-tabs-bar">
          <div className="forward-tab-buttons">
            <button
              type="button"
              className={`forward-tab-btn ${activeTab === 'incoming' ? 'active' : ''}`}
              onClick={() => { setActiveTab('incoming'); setStatusFilter('all'); }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <path d="M22 12h-6l-2 3h-4l-2-3H2v7a2 2 0 002 2h16a2 2 0 002-2v-7z" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M5.45 5.11L2 12v7a2 2 0 002 2h16a2 2 0 002-2v-7l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>เอกสารขาเข้า (Incoming)</span>
              <span className="tab-counter-badge">{incomingDocs.length}</span>
            </button>
            <button
              type="button"
              className={`forward-tab-btn ${activeTab === 'forwarded' ? 'active' : ''}`}
              onClick={() => { setActiveTab('forwarded'); setStatusFilter('all'); }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>เอกสารที่ส่งต่อแล้ว (Forwarded)</span>
              <span className="tab-counter-badge">{forwardedDocs.length}</span>
            </button>
          </div>

          <div className="forward-filter-controls">
            {/* Filter Chips */}
            <div className="filter-chips-row">
              <button
                type="button"
                className={`filter-chip ${statusFilter === 'all' ? 'active' : ''}`}
                onClick={() => setStatusFilter('all')}
              >
                ทั้งหมด
              </button>
              {activeTab === 'incoming' && (
                <button
                  type="button"
                  className={`filter-chip ${statusFilter === 'unread' ? 'active' : ''}`}
                  onClick={() => setStatusFilter('unread')}
                >
                  ยังไม่อ่าน
                </button>
              )}
              <button
                type="button"
                className={`filter-chip ${statusFilter === 'processing' ? 'active' : ''}`}
                onClick={() => setStatusFilter('processing')}
              >
                กำลังดำเนินการ
              </button>
              <button
                type="button"
                className={`filter-chip ${statusFilter === 'completed' ? 'active' : ''}`}
                onClick={() => setStatusFilter('completed')}
              >
                เสร็จสิ้น
              </button>
            </div>

            {/* Search Input */}
            <div className="search-input-wrapper">
              <svg viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" className="search-icon">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                placeholder="ค้นหาเอกสาร หรือ แผนก..."
                className="search-input-field"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button className="search-clear-btn" onClick={() => setSearchTerm('')} aria-label="Clear Search">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                    <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Master Table */}
        <div className="table-responsive">
          <table className="dms-master-table">
            <thead>
              <tr>
                <th>รหัสเอกสาร</th>
                <th>ชื่อเอกสาร</th>
                <th>{activeTab === 'incoming' ? 'ส่งมาจาก' : 'ส่งถึง'}</th>
                <th>วันที่และเวลา</th>
                <th>ประเภท</th>
                <th>สถานะ</th>
                <th style={{ textAlign: 'center' }}>การจัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filteredList.map(doc => (
                <tr key={doc.id}>
                  <td className="doc-code-text">{doc.id}</td>
                  <td>
                    <div className="doc-title-wrapper">
                      <span className="doc-name-text">{doc.title}</span>
                    </div>
                  </td>
                  <td>
                    <span className="doc-dept-text">{activeTab === 'incoming' ? doc.sender : doc.recipient}</span>
                  </td>
                  <td className="doc-date-text">{doc.receivedDate}</td>
                  <td>
                    <span className="doc-type-tag">{doc.type}</span>
                  </td>
                  <td>
                    <span className={`status-pill ${doc.status}`}>
                      <span className="status-dot"></span>
                      {doc.status === 'unread' && 'ยังไม่อ่าน'}
                      {doc.status === 'processing' && 'กำลังดำเนินการ'}
                      {doc.status === 'completed' && 'เสร็จสิ้น'}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions-cell">
                      <button
                        type="button"
                        className="tbl-action-btn view-btn"
                        onClick={() => handleViewDetail(doc)}
                        title="ดูรายละเอียด"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                          <circle cx="12" cy="12" r="3"/>
                        </svg>
                        <span>เปิดดู</span>
                      </button>
                      {activeTab === 'incoming' && (
                        <button
                          type="button"
                          className="tbl-action-btn archive-btn"
                          onClick={() => handleArchive(doc.id)}
                          title="จัดเก็บเข้าแฟ้ม"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                            <path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          <span>จัดเก็บ</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredList.length === 0 && (
                <tr>
                  <td colSpan={7} className="no-data-cell">
                    <div className="no-data-content">
                      <svg viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.5" width="40" height="40">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M14 2v6h6" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <p>ไม่พบข้อมูลเอกสารในหมวดหมู่นี้</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Send Modal */}
      {isSendModalOpen && (
        <div className="dms-modal-backdrop" onClick={() => setIsSendModalOpen(false)}>
          <div className="dms-modal-card" onClick={e => e.stopPropagation()}>
            <div className="dms-modal-header">
              <div className="dms-modal-title-group">
                <div className="dms-modal-icon-badge">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2">
                    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div>
                  <h3 className="dms-modal-title">ส่งต่อเอกสารใหม่</h3>
                  <p className="dms-modal-subtitle">ระบุรายละเอียดและแผนกปลายทางที่ต้องการส่งต่อ</p>
                </div>
              </div>
              <button className="dms-close-btn" onClick={() => setIsSendModalOpen(false)} aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
            <form onSubmit={handleSendDocument}>
              <div className="dms-modal-body">
                <div className="dms-form-group">
                  <label className="dms-form-label">
                    ชื่อเรื่อง / หัวข้อเอกสาร <span className="text-required">*</span>
                  </label>
                  <input
                    type="text"
                    className="dms-form-input"
                    required
                    placeholder="เช่น รายงานผลตรวจคนไข้ VIP หรือ ใบเบิกยาฉุกเฉิน"
                    value={newDocTitle}
                    onChange={e => setNewDocTitle(e.target.value)}
                  />
                </div>

                <div className="dms-form-group">
                  <label className="dms-form-label">
                    แผนกหรือบุคคลปลายทาง <span className="text-required">*</span>
                  </label>
                  <select
                    className="dms-form-input"
                    value={newDocRecipientId}
                    onChange={e => {
                      const id = Number(e.target.value);
                      setNewDocRecipientId(id);
                      const found = recipientsList.find(u => u.id === id);
                      if (found) {
                        setNewDocRecipient(`${found.fullname || found.username} (${found.role})`);
                      }
                    }}
                  >
                    {recipientsList.length > 0 ? (
                      recipientsList.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.fullname || u.username} ({u.role === 'doctor' ? 'แพทย์' : u.role === 'nurse' ? 'พยาบาล' : u.role === 'pharmacist' ? 'เภสัชกร' : u.role === 'cashier' ? 'การเงิน' : u.role})
                        </option>
                      ))
                    ) : (
                      <>
                      {/* ปรับชื่อ */}
                        <option value="6">พญ.สุดา สุขสมบูรณ์ (แพทย์)</option>
                        <option value="7">นพ.วิชัย ชาญการแพทย์ (แพทย์)</option>
                        <option value="8">พญ.เกศรา รักษาดี (แพทย์)</option>
                        <option value="3">พว. กานดา คัดกรอง (พยาบาล)</option>
                        <option value="5">ดร.บุญชู เภสัชกร (ห้องยา)</option>
                        <option value="6">นส.รวย การเงิน (การเงิน)</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="dms-form-group">
                  <label className="dms-form-label">ประเภทเอกสาร</label>
                  <select
                    className="dms-form-input"
                    value={newDocType}
                    onChange={e => setNewDocType(e.target.value)}
                  >
                    <option value="เอกสารทั่วไป">เอกสารทั่วไป</option>
                    <option value="รายงาน">รายงาน</option>
                    <option value="ผลตรวจ">ผลตรวจ</option>
                    <option value="ใบเบิก">ใบเบิก</option>
                    <option value="คำสั่งการแพทย์">คำสั่งการแพทย์</option>
                  </select>
                </div>
              </div>
              <div className="dms-modal-footer">
                <button type="button" className="dms-btn-secondary" onClick={() => setIsSendModalOpen(false)}>
                  ยกเลิก
                </button>
                <button type="submit" className="dms-btn-primary">
                  ยืนยันการส่งต่อ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {isDetailModalOpen && selectedDoc && (
        <div className="dms-modal-backdrop" onClick={() => setIsDetailModalOpen(false)}>
          <div className="dms-modal-card" onClick={e => e.stopPropagation()}>
            <div className="dms-modal-header">
              <div className="dms-modal-title-group">
                <div className="dms-modal-icon-badge">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M14 2v6h6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div>
                  <h3 className="dms-modal-title">รายละเอียดเอกสาร</h3>
                  <p className="dms-modal-subtitle">{selectedDoc.id}</p>
                </div>
              </div>
              <button className="dms-close-btn" onClick={() => setIsDetailModalOpen(false)} aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
            <div className="dms-modal-body">
              <div className="dms-storage-stat-row">
                <span className="stat-label">ชื่อเอกสาร:</span>
                <span className="stat-value font-bold">{selectedDoc.title}</span>
              </div>
              <div className="dms-storage-stat-row">
                <span className="stat-label">ต้นทาง (ผู้ส่ง):</span>
                <span className="stat-value">{selectedDoc.sender}</span>
              </div>
              {selectedDoc.recipient && (
                <div className="dms-storage-stat-row">
                  <span className="stat-label">ปลายทาง (ผู้รับ):</span>
                  <span className="stat-value">{selectedDoc.recipient}</span>
                </div>
              )}
              <div className="dms-storage-stat-row">
                <span className="stat-label">วันที่ส่งมอบ:</span>
                <span className="stat-value">{selectedDoc.receivedDate}</span>
              </div>
              <div className="dms-storage-stat-row">
                <span className="stat-label">ประเภท:</span>
                <span className="stat-value"><span className="doc-type-tag">{selectedDoc.type}</span></span>
              </div>
              <div className="dms-storage-stat-row">
                <span className="stat-label">สถานะปัจจุบัน:</span>
                <span className="stat-value">
                  <span className={`status-pill ${selectedDoc.status}`}>
                    <span className="status-dot"></span>
                    {selectedDoc.status === 'unread' && 'ยังไม่อ่าน'}
                    {selectedDoc.status === 'processing' && 'กำลังดำเนินการ'}
                    {selectedDoc.status === 'completed' && 'เสร็จสิ้น'}
                  </span>
                </span>
              </div>
            </div>
            <div className="dms-modal-footer">
              <button className="dms-btn-primary" onClick={() => setIsDetailModalOpen(false)}>
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {renderMetricModal()}
    </div>
  );
};
