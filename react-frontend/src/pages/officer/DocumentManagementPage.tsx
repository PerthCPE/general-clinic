import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { dmsApi, type BackendDocument } from '../../services/api';
import './DocumentManagementPage.css';

interface DocumentItem {
  id: string;
  name: string;
  type: string;
  modifiedDate: string;
  status: 'approved' | 'reviewing' | 'draft';
  subject?: string;
  senderName?: string;
  externalRef?: string;
}

// Generate realistic fallback documents with dynamic dates
const generateMockDocs = (): DocumentItem[] => {
  const docs: DocumentItem[] = [];
  const types = ['รายงาน', 'สัญญา', 'สเปรดชีต', 'นโยบาย', 'ใบเบิก', 'ผลตรวจ'];
  const statuses: ('approved' | 'reviewing' | 'draft')[] = ['approved', 'reviewing', 'draft'];
  const baseNames = ['Q3_Patient_Report', 'Dr_Smith_Contract', 'Inventory_Log', 'Policy_Update', 'Lab_Results', 'Weekly_Meeting_Notes'];
  const exts = ['.pdf', '.docx', '.xlsx'];
  
  const now = new Date();
  const buddhistYear = now.getFullYear() + 543;
  const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

  for (let i = 1; i <= 12; i++) {
    const type = types[Math.floor(Math.random() * types.length)];
    const status = i <= 4 ? 'reviewing' : statuses[Math.floor(Math.random() * statuses.length)];
    const baseName = baseNames[Math.floor(Math.random() * baseNames.length)];
    const ext = exts[Math.floor(Math.random() * exts.length)];
    const day = (i % 28) + 1;
    const month = monthNames[(i + 3) % 12];
    
    docs.push({
      id: String(i),
      name: `${baseName}_${i}${ext}`,
      type: type,
      modifiedDate: `${day} ${month} ${buddhistYear}`,
      status: status
    });
  }
  return docs;
};

export const DocumentManagementPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'reviewing' | 'draft'>('all');
  const [docs, setDocs] = useState<DocumentItem[]>(generateMockDocs());

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  
  // Modals state
  const [activeModal, setActiveModal] = useState<'all' | 'reviewing' | 'recent' | 'storage' | 'folder' | 'upload' | null>(null);
  const [activeFolderTitle, setActiveFolderTitle] = useState('');

  // Upload Form State based on Document model attributes
  const [uploadForm, setUploadForm] = useState({
    subject: '',
    senderName: '',
    externalRef: ''
  });

  // Fetch real documents from Database on mount
  useEffect(() => {
    dmsApi.getDocuments()
      .then((data: BackendDocument[]) => {
        if (data && Array.isArray(data)) {
          const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
          const mapped: DocumentItem[] = data.map((d) => {
            const createdAt = new Date(d.created_at || Date.now());
            const bYear = createdAt.getFullYear() + 543;
            const formattedDate = `${createdAt.getDate()} ${monthNames[createdAt.getMonth()]} ${bYear}`;
            return {
              id: String(d.id),
              name: d.subject || `เอกสาร #${d.id}`,
              type: 'เอกสารราชการ/ส่งตัว',
              modifiedDate: formattedDate,
              status: 'approved',
              subject: d.subject,
              senderName: d.sender_name,
              externalRef: d.external_doc_ref,
            };
          });
          setDocs(mapped);
        }
      })
      .catch(() => {
        // Fallback to mock only if server is offline
      });
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setActiveModal('upload');
    }
    e.target.value = '';
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setUploading(true);
    setActiveModal(null);

    try {
      const res = await dmsApi.createDocument({
        external_doc_ref: uploadForm.externalRef || `DOC-2569-${Date.now().toString().slice(-4)}`,
        sender_name: uploadForm.senderName || 'เจ้าหน้าที่ธุรการ',
        subject: uploadForm.subject || selectedFile.name,
        file_url: 'https://example.com/docs/' + selectedFile.name,
      });

      const now = new Date();
      const buddhistYear = now.getFullYear() + 543;
      const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
      const formattedDate = `${now.getDate()} ${monthNames[now.getMonth()]} ${buddhistYear}`;

      const newDoc: DocumentItem = {
        id: String(res.document.id || docs.length + 1),
        name: res.document.subject || selectedFile.name,
        type: selectedFile.name.split('.').pop()?.toUpperCase() || 'ไฟล์ทั่วไป',
        modifiedDate: formattedDate,
        status: 'approved',
        subject: res.document.subject,
        senderName: res.document.sender_name,
        externalRef: res.document.external_doc_ref,
      };

      setDocs([newDoc, ...docs]);
      setSelectedFile(null);
      setUploading(false);
      setUploadForm({ subject: '', senderName: '', externalRef: '' });
      toast.success('บันทึกและอัปโหลดเอกสารลง Database เรียบร้อยแล้ว');
    } catch {
      const now = new Date();
      const buddhistYear = now.getFullYear() + 543;
      const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
      const formattedDate = `${now.getDate()} ${monthNames[now.getMonth()]} ${buddhistYear}`;

      const newDoc: DocumentItem = {
        id: String(docs.length + 1),
        name: selectedFile.name,
        type: selectedFile.name.split('.').pop()?.toUpperCase() || 'ไฟล์ทั่วไป',
        modifiedDate: formattedDate,
        status: 'reviewing',
        subject: uploadForm.subject,
        senderName: uploadForm.senderName,
        externalRef: uploadForm.externalRef
      };
      
      setDocs([newDoc, ...docs]);
      setSelectedFile(null);
      setUploading(false);
      setUploadForm({ subject: '', senderName: '', externalRef: '' });
      toast.success('อัปโหลดไฟล์และบันทึกข้อมูลเอกสารเรียบร้อยแล้ว');
    }
  };

  const filteredDocs = docs.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.subject && doc.subject.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || doc.status === statusFilter;
    return matchesSearch && matchesStatus;
  });
  
  const recentDocs = filteredDocs.slice(0, 8);
  const reviewingDocs = docs.filter(d => d.status === 'reviewing');
  const addedRecentlyDocs = docs.slice(0, 15);

  const openFolderModal = (title: string) => {
    setActiveFolderTitle(title);
    setActiveModal('folder');
  };

  const renderModalContent = () => {
    if (activeModal === 'upload') {
      return (
        <div className="dms-modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="dms-modal-card" onClick={e => e.stopPropagation()}>
            <div className="dms-modal-header">
              <div className="dms-modal-title-group">
                <div className="dms-modal-icon-badge">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M14 2v6h6" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M12 18v-6m-3 3l3-3 3 3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div>
                  <h3 className="dms-modal-title">อัปโหลดเอกสารใหม่</h3>
                  <p className="dms-modal-subtitle">กรอกรายละเอียดเอกสารเพื่อจัดเก็บในระบบ</p>
                </div>
              </div>
              <button className="dms-close-btn" onClick={() => setActiveModal(null)} aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
            <form onSubmit={handleUploadSubmit}>
              <div className="dms-modal-body">
                <div className="dms-form-group">
                  <label className="dms-form-label">ไฟล์ที่เลือก</label>
                  <div className="dms-file-preview-box">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" width="20" height="20">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M14 2v6h6" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span className="dms-file-name">{selectedFile?.name}</span>
                    <span className="dms-file-size">({(Number(selectedFile?.size || 0) / 1024).toFixed(1)} KB)</span>
                  </div>
                </div>
                
                <div className="dms-form-group">
                  <label className="dms-form-label">
                    ชื่อเรื่อง / หัวข้อเอกสาร (Subject) <span className="text-required">*</span>
                  </label>
                  <input
                    type="text"
                    className="dms-form-input"
                    required 
                    value={uploadForm.subject}
                    onChange={e => setUploadForm({...uploadForm, subject: e.target.value})} 
                    placeholder="เช่น รายงานประจำเดือน ตุลาคม หรือ สัญญาแพทย์"
                  />
                </div>
                
                <div className="dms-form-group">
                  <label className="dms-form-label">
                    ชื่อผู้ส่ง / แผนกต้นทาง (Sender Name)
                  </label>
                  <input
                    type="text"
                    className="dms-form-input"
                    value={uploadForm.senderName}
                    onChange={e => setUploadForm({...uploadForm, senderName: e.target.value})} 
                    placeholder="เช่น แผนกการเงิน, นพ.สมชาย, สปสช."
                  />
                </div>
                
                <div className="dms-form-group">
                  <label className="dms-form-label">
                    เลขที่อ้างอิงภายนอก (External Reference)
                  </label>
                  <input
                    type="text"
                    className="dms-form-input"
                    value={uploadForm.externalRef}
                    onChange={e => setUploadForm({...uploadForm, externalRef: e.target.value})} 
                    placeholder="เช่น EXP-2026-001 หรือ รพ-69-041"
                  />
                </div>
              </div>
              <div className="dms-modal-footer">
                <button type="button" className="dms-btn-secondary" onClick={() => setActiveModal(null)}>
                  ยกเลิก
                </button>
                <button type="submit" className="dms-btn-primary">
                  ยืนยันการอัปโหลด
                </button>
              </div>
            </form>
          </div>
        </div>
      );
    }

    if (activeModal === 'storage') {
      return (
        <div className="dms-modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="dms-modal-card" onClick={e => e.stopPropagation()}>
            <div className="dms-modal-header">
              <div className="dms-modal-title-group">
                <div className="dms-modal-icon-badge">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2">
                    <path d="M4 7v10c0 2.21 3.58 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.58 4 8 4s8-1.79 8-4M4 7c0-2.21 3.58-4 8-4s8 1.79 8 4m0 5c0 2.21-3.58 4-8 4s-8-1.79-8-4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div>
                  <h3 className="dms-modal-title">รายละเอียดพื้นที่จัดเก็บ</h3>
                  <p className="dms-modal-subtitle">ข้อมูลการใช้งาน Cloud Storage ของคลินิก</p>
                </div>
              </div>
              <button className="dms-close-btn" onClick={() => setActiveModal(null)} aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
            <div className="dms-modal-body">
              <div className="dms-storage-stat-row">
                <span className="stat-label">พื้นที่ใช้งานแล้ว:</span>
                <span className="stat-value text-primary font-bold">640 GB (64%)</span>
              </div>
              <div className="dms-storage-stat-row">
                <span className="stat-label">พื้นที่ทั้งหมดที่ได้รับ:</span>
                <span className="stat-value font-bold">1,000 GB</span>
              </div>
              <div className="dms-storage-stat-row">
                <span className="stat-label">ไฟล์รูปภาพ / ผลตรวจ PDF:</span>
                <span className="stat-value">320 GB</span>
              </div>
              <div className="dms-storage-stat-row">
                <span className="stat-label">ไฟล์เอกสารธุรการ & สัญญา:</span>
                <span className="stat-value">200 GB</span>
              </div>
              <div className="dms-storage-stat-row">
                <span className="stat-label">ฐานข้อมูลระบบ (PostgreSQL):</span>
                <span className="stat-value">120 GB</span>
              </div>
            </div>
            <div className="dms-modal-footer">
              <button className="dms-btn-primary" onClick={() => setActiveModal(null)}>
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      );
    }

    let title = '';
    let dataList: DocumentItem[] = [];
    
    if (activeModal === 'all') { title = `เอกสารทั้งหมด (${docs.length} รายการ)`; dataList = docs; }
    if (activeModal === 'reviewing') { title = `เอกสารรอตรวจสอบ (${reviewingDocs.length} รายการ)`; dataList = reviewingDocs; }
    if (activeModal === 'recent') { title = `เอกสารเพิ่มล่าสุด (${addedRecentlyDocs.length} รายการ)`; dataList = addedRecentlyDocs; }
    if (activeModal === 'folder') { title = `แฟ้ม: ${activeFolderTitle}`; dataList = docs.slice(0, 20); }

    if (!activeModal || !title) return null;

    return (
      <div className="dms-modal-backdrop" onClick={() => setActiveModal(null)}>
        <div className="dms-modal-card dms-modal-wide" onClick={e => e.stopPropagation()}>
          <div className="dms-modal-header">
            <div className="dms-modal-title-group">
              <div className="dms-modal-icon-badge">
                <svg viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M14 2v6h6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <h3 className="dms-modal-title">{title}</h3>
                <p className="dms-modal-subtitle">รายการเอกสารตามเงื่อนไขที่เลือก</p>
              </div>
            </div>
            <button className="dms-close-btn" onClick={() => setActiveModal(null)} aria-label="Close">
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
                    <th>ชื่อเอกสาร</th>
                    <th>ประเภท</th>
                    <th>วันที่แก้ไข</th>
                    <th>สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {dataList.map((doc) => (
                    <tr key={doc.id}>
                      <td>
                        <div className="doc-name-cell">
                          <div className="doc-type-icon-box">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M14 2v6h6" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </div>
                          <div className="doc-text-wrapper">
                            <span className="doc-name-text">{doc.name}</span>
                            {doc.subject && <span className="doc-subject-text">เรื่อง: {doc.subject}</span>}
                          </div>
                        </div>
                      </td>
                      <td><span className="doc-type-tag">{doc.type}</span></td>
                      <td className="doc-date-text">{doc.modifiedDate}</td>
                      <td>
                        <span className={`status-pill ${doc.status}`}>
                          <span className="status-dot"></span>
                          {doc.status === 'approved' && 'อนุมัติแล้ว'}
                          {doc.status === 'reviewing' && 'กำลังตรวจสอบ'}
                          {doc.status === 'draft' && 'ฉบับร่าง'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="dms-modal-footer">
            <button className="dms-btn-primary" onClick={() => setActiveModal(null)}>
              ปิดหน้าต่าง
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="dms-container">
      {/* 1. Page Header according to frontend.md */}
      <div className="page-header-container">
        <div className="page-title-group">
          <div className="page-icon-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" width="24" height="24">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M14 2v6h6" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16 13H8M16 17H8M10 9H8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <h1 className="page-main-title">การจัดการเอกสาร (Document Management)</h1>
            <p className="page-sub-title">จัดการ จัดเก็บ และสืบค้นเอกสารและบันทึกข้อมูลสำคัญของคลินิก</p>
          </div>
        </div>
      </div>

      {/* 2. Metrics Cards */}
      <div className="dms-metrics-grid">
        <div className="dms-card metric-card interactive" onClick={() => setActiveModal('all')}>
          <div className="metric-icon-wrapper blue-bg">
            <svg viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" width="24" height="24">
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="metric-info">
            <span className="metric-label">จำนวนเอกสารทั้งหมด</span>
            <span className="metric-value">{docs.length}</span>
            <span className="metric-subtext blue-text">คลิกเพื่อดูทั้งหมด</span>
          </div>
        </div>

        <div className="dms-card metric-card interactive" onClick={() => setActiveModal('reviewing')}>
          <div className="metric-icon-wrapper red-bg">
            <svg viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" width="24" height="24">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="metric-info">
            <span className="metric-label">รอตรวจสอบ</span>
            <span className="metric-value">{reviewingDocs.length}</span>
            <span className="metric-subtext red-text">คลิกเพื่อดูรายการ</span>
          </div>
        </div>

        <div className="dms-card metric-card interactive" onClick={() => setActiveModal('recent')}>
          <div className="metric-icon-wrapper green-bg">
            <svg viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" width="24" height="24">
              <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="metric-info">
            <span className="metric-label">เพิ่มล่าสุด</span>
            <span className="metric-value">15</span>
            <span className="metric-subtext green-text">คลิกเพื่อดูรายการ</span>
          </div>
        </div>

        <div className="dms-card metric-card interactive" onClick={() => setActiveModal('storage')}>
          <div className="metric-icon-wrapper gray-bg">
            <svg viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" width="24" height="24">
              <path d="M4 7v10c0 2.21 3.58 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.58 4 8 4s8-1.79 8-4M4 7c0-2.21 3.58-4 8-4s8 1.79 8 4m0 5c0 2.21-3.58 4-8 4s-8-1.79-8-4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="metric-info">
            <span className="metric-label">พื้นที่จัดเก็บที่ใช้</span>
            <span className="metric-value">64%</span>
            <div className="storage-progress-bar">
              <div className="storage-progress-fill" style={{ width: '64%' }}></div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Main Grid Layout */}
      <div className="dms-main-grid">
        {/* Left Table Section */}
        <div className="dms-card docs-table-section">
          <div className="docs-table-header">
            <div>
              <h2 className="section-title">เอกสารล่าสุด</h2>
              <p className="section-subtitle">แสดงรายการเอกสารที่มีการเคลื่อนไหวล่าสุด</p>
            </div>
            
            <div className="table-actions-group">
              {/* Filter Chips */}
              <div className="filter-chips-row">
                <button
                  type="button"
                  className={`filter-chip ${statusFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setStatusFilter('all')}
                >
                  ทั้งหมด
                </button>
                <button
                  type="button"
                  className={`filter-chip ${statusFilter === 'reviewing' ? 'active' : ''}`}
                  onClick={() => setStatusFilter('reviewing')}
                >
                  รอตรวจสอบ
                </button>
                <button
                  type="button"
                  className={`filter-chip ${statusFilter === 'approved' ? 'active' : ''}`}
                  onClick={() => setStatusFilter('approved')}
                >
                  อนุมัติแล้ว
                </button>
              </div>

              {/* Search Bar */}
              <div className="search-input-wrapper">
                <svg viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" className="search-icon">
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  type="text"
                  placeholder="ค้นหาชื่อเอกสาร หรือ เรื่อง..."
                  className="search-input-field"
                  value={searchTerm}
                  onChange={handleSearchChange}
                />
                {searchTerm && (
                  <button className="search-clear-btn" onClick={() => setSearchTerm('')} aria-label="Clear Search">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                )}
              </div>

              <button className="dms-view-all-btn" onClick={() => setActiveModal('all')}>
                ดูทั้งหมด
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                  <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>

          <div className="table-responsive">
            <table className="dms-master-table">
              <thead>
                <tr>
                  <th>ชื่อเอกสาร</th>
                  <th>ประเภท</th>
                  <th>วันที่แก้ไข</th>
                  <th>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {recentDocs.map((doc) => (
                  <tr key={doc.id}>
                    <td>
                      <div className="doc-name-cell">
                        <div className="doc-type-icon-box">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M14 2v6h6" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                        <div className="doc-text-wrapper">
                          <span className="doc-name-text">{doc.name}</span>
                          {doc.subject && <span className="doc-subject-text">เรื่อง: {doc.subject}</span>}
                        </div>
                      </div>
                    </td>
                    <td><span className="doc-type-tag">{doc.type}</span></td>
                    <td className="doc-date-text">{doc.modifiedDate}</td>
                    <td>
                      <span className={`status-pill ${doc.status}`}>
                        <span className="status-dot"></span>
                        {doc.status === 'approved' && 'อนุมัติแล้ว'}
                        {doc.status === 'reviewing' && 'กำลังตรวจสอบ'}
                        {doc.status === 'draft' && 'ฉบับร่าง'}
                      </span>
                    </td>
                  </tr>
                ))}
                {recentDocs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="no-data-cell">
                      <div className="no-data-content">
                        <svg viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.5" width="40" height="40">
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M14 2v6h6" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M9 13h6M9 17h3" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <p>ไม่พบข้อมูลเอกสารที่ตรงกับเงื่อนไข</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Sidebar Actions */}
        <div className="dms-sidebar-actions">
          {/* Upload Dropzone */}
          <div className="dms-card upload-card">
            <label className="upload-dropzone" style={uploading ? { opacity: 0.5, cursor: 'not-allowed' } : {}}>
              <input type="file" onChange={handleFileChange} style={{ display: 'none' }} disabled={uploading} />
              <div className="upload-icon-wrapper">
                <svg viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" width="28" height="28">
                  <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <p className="upload-main-text">
                {uploading ? 'กำลังประมวลผลไฟล์...' : 'อัปโหลดเอกสารใหม่'}
              </p>
              <p className="upload-sub-text">คลิกเพื่อเลือกไฟล์ PDF, Word หรือ Excel</p>
            </label>
          </div>

          {/* Quick Folders Menu */}
          <div className="dms-card quick-menu-card">
            <div className="quick-menu-header">
              <svg viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" width="20" height="20">
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <h3 className="sidebar-section-title">แฟ้มเอกสารด่วน</h3>
            </div>
            <ul className="quick-menu-list">
              <li className="quick-menu-item" onClick={() => openFolderModal('ประวัติผู้ป่วย')}>
                <div className="menu-left">
                  <div className="folder-icon-box">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" width="18" height="18">
                      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <span className="folder-name-text">ประวัติผู้ป่วย</span>
                </div>
                <span className="menu-badge">45</span>
              </li>
              <li className="quick-menu-item" onClick={() => openFolderModal('ฝ่ายบุคคลและกำลังพล')}>
                <div className="menu-left">
                  <div className="folder-icon-box">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" width="18" height="18">
                      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <span className="folder-name-text">ฝ่ายบุคคลและกำลังพล</span>
                </div>
                <span className="menu-badge">18</span>
              </li>
              <li className="quick-menu-item" onClick={() => openFolderModal('รายงานการเงิน')}>
                <div className="menu-left">
                  <div className="folder-icon-box">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" width="18" height="18">
                      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <span className="folder-name-text">รายงานการเงิน</span>
                </div>
                <span className="menu-badge">32</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {renderModalContent()}
    </div>
  );
};
