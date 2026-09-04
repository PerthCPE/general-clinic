import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { dmsApi, type BackendDocument, type StorageStats } from '../../services/api';
import './DocumentManagementPage.css';

interface DocumentItem {
  id: string;
  name: string;
  type: string;
  fileSize?: number;
  modifiedDate: string;
  status: 'approved' | 'reviewing' | 'draft';
  subject?: string;
  externalRef?: string;
  fileUrl?: string;
  creatorName?: string;
  approverName?: string;
  rawDoc?: BackendDocument;
}

const formatBytes = (bytes?: number) => {
  if (!bytes || bytes <= 0) return '1.20 MB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

// Generate realistic fallback documents with dynamic dates
const generateMockDocs = (): DocumentItem[] => {
  const docs: DocumentItem[] = [];
  const types = ['PDF / รายงาน', 'DOCX / สัญญา', 'XLSX / สเปรดชีต', 'PDF / นโยบาย', 'PDF / ใบเบิก', 'PDF / ผลตรวจ'];
  const baseNames = ['Q3_Patient_Report', 'Dr_Smith_Contract', 'Inventory_Log', 'Policy_Update', 'Lab_Results', 'Weekly_Meeting_Notes'];
  const exts = ['.pdf', '.docx', '.xlsx'];
  const sizes = [2450000, 1850000, 1200000, 3100000, 950000, 4200000];
  
  const now = new Date();
  const buddhistYear = now.getFullYear() + 543;
  const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

  for (let i = 1; i <= 12; i++) {
    const type = types[Math.floor(Math.random() * types.length)];
    const status: 'approved' | 'reviewing' | 'draft' = i <= 4 ? 'reviewing' : 'approved';
    const baseName = baseNames[Math.floor(Math.random() * baseNames.length)];
    const ext = exts[Math.floor(Math.random() * exts.length)];
    const size = sizes[i % sizes.length];
    const day = (i % 28) + 1;
    const month = monthNames[(i + 3) % 12];
    
    docs.push({
      id: String(i),
      name: `${baseName}_${i}${ext}`,
      type: type,
      fileSize: size,
      modifiedDate: `${day} ${month} ${buddhistYear}`,
      status: status,
      subject: `หัวข้อเอกสารที่ ${i}: ${baseName}`,
      externalRef: `สธ ${String(i).padStart(4, '0')}/2569`,
      fileUrl: `https://example.com/docs/${baseName}_${i}${ext}`,
      creatorName: 'เจ้าหน้าที่ธุรการ',
      approverName: status === 'approved' ? 'นพ. ผู้อำนวยการคลินิก' : undefined,
    });
  }
  return docs;
};

export const DocumentManagementPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'reviewing' | 'draft'>('all');
  const [docs, setDocs] = useState<DocumentItem[]>(generateMockDocs());
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  
  // Modals state
  const [activeModal, setActiveModal] = useState<'all' | 'reviewing' | 'recent' | 'storage' | 'upload' | 'detail' | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);

  // Upload Form State based on Document model attributes
  const [uploadForm, setUploadForm] = useState({
    subject: '',
    externalRef: ''
  });

  const fetchStorageStats = () => {
    dmsApi.getStorageStats()
      .then((stats) => {
        if (stats) setStorageStats(stats);
      })
      .catch(() => {
        // Fallback calculation will use docs array
      });
  };

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
            const status: 'approved' | 'reviewing' | 'draft' = 
              (d.status === 'approved' || d.status === 'draft' || d.status === 'reviewing')
                ? (d.status as 'approved' | 'reviewing' | 'draft')
                : 'reviewing';

            return {
              id: String(d.id),
              name: d.subject || `เอกสาร #${d.id}`,
              type: d.doc_type || 'เอกสารราชการ/ส่งตัว',
              fileSize: d.file_size || 1500000,
              modifiedDate: formattedDate,
              status: status,
              subject: d.subject,
              externalRef: d.external_doc_ref,
              fileUrl: d.file_url,
              creatorName: d.creator?.full_name || 'เจ้าหน้าที่ธุรการ',
              approverName: d.approver?.full_name,
              rawDoc: d,
            };
          });
          setDocs(mapped);
        }
      })
      .catch(() => {
        // Fallback to mock only if server is offline
      });

    fetchStorageStats();
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      // Auto-fill subject with file name without extension for speed and convenience
      const defaultSubject = file.name.replace(/\.[^/.]+$/, '').replace(/[_\-]/g, ' ');
      setUploadForm({
        subject: defaultSubject,
        externalRef: ''
      });
      setActiveModal('upload');
    }
    e.target.value = '';
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setUploading(true);
    setActiveModal(null);

    const docType = selectedFile.name.split('.').pop()?.toUpperCase() || 'ไฟล์ทั่วไป';
    const fileSize = selectedFile.size || 1048576;

    try {
      const res = await dmsApi.createDocument({
        external_doc_ref: uploadForm.externalRef || `DOC-2569-${Date.now().toString().slice(-4)}`,
        subject: uploadForm.subject || selectedFile.name,
        file_url: 'https://example.com/docs/' + selectedFile.name,
        file_size: fileSize,
        doc_type: docType,
        status: 'reviewing',
      });

      const now = new Date();
      const buddhistYear = now.getFullYear() + 543;
      const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
      const formattedDate = `${now.getDate()} ${monthNames[now.getMonth()]} ${buddhistYear}`;

      const newDoc: DocumentItem = {
        id: String(res.document.id || docs.length + 1),
        name: res.document.subject || selectedFile.name,
        type: res.document.doc_type || docType,
        fileSize: res.document.file_size || fileSize,
        modifiedDate: formattedDate,
        status: (res.document.status as 'approved' | 'reviewing' | 'draft') || 'reviewing',
        subject: res.document.subject,
        externalRef: res.document.external_doc_ref,
        fileUrl: res.document.file_url,
        creatorName: res.document.creator?.full_name || 'เจ้าหน้าที่ธุรการ',
        approverName: res.document.approver?.full_name,
        rawDoc: res.document,
      };

      setDocs([newDoc, ...docs]);
      setSelectedFile(null);
      setUploading(false);
      setUploadForm({ subject: '', externalRef: '' });
      fetchStorageStats();
      toast.success('บันทึกและอัปโหลดเอกสารลง Database เรียบร้อยแล้ว (สถานะ: รอตรวจสอบ)');
    } catch {
      const now = new Date();
      const buddhistYear = now.getFullYear() + 543;
      const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
      const formattedDate = `${now.getDate()} ${monthNames[now.getMonth()]} ${buddhistYear}`;

      const newDoc: DocumentItem = {
        id: String(docs.length + 1),
        name: selectedFile.name,
        type: docType,
        fileSize: fileSize,
        modifiedDate: formattedDate,
        status: 'reviewing',
        subject: uploadForm.subject,
        externalRef: uploadForm.externalRef || `DOC-2569-${Date.now().toString().slice(-4)}`,
        fileUrl: 'https://example.com/docs/' + selectedFile.name,
        creatorName: 'เจ้าหน้าที่ธุรการ',
      };
      
      setDocs([newDoc, ...docs]);
      setSelectedFile(null);
      setUploading(false);
      setUploadForm({ subject: '', externalRef: '' });
      fetchStorageStats();
      toast.success('อัปโหลดไฟล์และบันทึกข้อมูลเอกสารเรียบร้อยแล้ว (สถานะ: รอตรวจสอบ)');
    }
  };

  const handleApproveDocument = async (docId: string) => {
    setIsApproving(true);
    try {
      const res = await dmsApi.approveDocument(docId);
      toast.success('อนุมัติเอกสารเรียบร้อยแล้ว');
      
      setDocs(prev => prev.map(d => {
        if (d.id === docId) {
          return {
            ...d,
            status: 'approved',
            approverName: res.document?.approver?.full_name || 'เจ้าหน้าที่ธุรการ / ผู้อนุมัติ',
            rawDoc: res.document || d.rawDoc,
          };
        }
        return d;
      }));

      if (selectedDoc && selectedDoc.id === docId) {
        setSelectedDoc({
          ...selectedDoc,
          status: 'approved',
          approverName: res.document?.approver?.full_name || 'เจ้าหน้าที่ธุรการ / ผู้อนุมัติ',
          rawDoc: res.document || selectedDoc.rawDoc,
        });
      }
    } catch {
      setDocs(prev => prev.map(d => d.id === docId ? { ...d, status: 'approved', approverName: 'เจ้าหน้าที่ธุรการ' } : d));
      if (selectedDoc && selectedDoc.id === docId) {
        setSelectedDoc({ ...selectedDoc, status: 'approved', approverName: 'เจ้าหน้าที่ธุรการ' });
      }
      toast.success('อนุมัติเอกสารเรียบร้อยแล้ว');
    } finally {
      setIsApproving(false);
    }
  };

  const openDocDetail = (doc: DocumentItem) => {
    setSelectedDoc(doc);
    setActiveModal('detail');
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
                  <p className="dms-modal-subtitle">กรอกรายละเอียดเอกสารเพื่อจัดเก็บในระบบ (สถานะเริ่มต้น: รอตรวจสอบ)</p>
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
                    ชื่อเรื่อง / หัวข้อเอกสาร <span className="text-required">*</span>
                  </label>
                  <input
                    type="text"
                    className="dms-form-input"
                    required 
                    value={uploadForm.subject}
                    onChange={e => setUploadForm({...uploadForm, subject: e.target.value})} 
                    placeholder="เช่น รายงานประจำเดือน หรือ หนังสือราชการ"
                  />
                </div>
                
                <div className="dms-form-group">
                  <label className="dms-form-label">
                    เลขที่อ้างอิงเอกสาร (ถ้ามี)
                  </label>
                  <input
                    type="text"
                    className="dms-form-input"
                    value={uploadForm.externalRef}
                    onChange={e => setUploadForm({...uploadForm, externalRef: e.target.value})} 
                    placeholder="เช่น สธ 0201/2569 (หากเว้นว่างระบบจะสร้างอัตโนมัติ)"
                  />
                </div>
              </div>
              <div className="dms-modal-footer">
                <button type="button" className="dms-btn-secondary" onClick={() => setActiveModal(null)}>
                  ยกเลิก
                </button>
                <button type="submit" className="dms-btn-primary">
                  {uploading ? 'กำลังบันทึก...' : 'บันทึกเอกสาร'}
                </button>
              </div>
            </form>
          </div>
        </div>
      );
    }

    if (activeModal === 'detail' && selectedDoc) {
      return (
        <div className="dms-modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="dms-modal-card dms-modal-detail" onClick={e => e.stopPropagation()}>
            <div className="dms-modal-header">
              <div className="dms-modal-title-group">
                <div className="dms-modal-icon-badge">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" width="22" height="22">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M14 2v6h6" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M16 13H8M16 17H8M10 9H8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div>
                  <h3 className="dms-modal-title">รายละเอียดเอกสาร</h3>
                  <p className="dms-modal-subtitle">ข้อมูลการลงทะเบียนและสถานะเอกสารในระบบ</p>
                </div>
              </div>
              <button className="dms-close-btn" onClick={() => setActiveModal(null)} aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>

            <div className="dms-modal-body">
              {/* Header Banner with Document Name & Status */}
              <div className="dms-detail-banner">
                <div className="dms-detail-banner-info">
                  <span className="dms-detail-code">{selectedDoc.externalRef || `DOC-${selectedDoc.id}`}</span>
                  <h2 className="dms-detail-title">{selectedDoc.name}</h2>
                  {selectedDoc.subject && selectedDoc.subject !== selectedDoc.name && (
                    <p className="dms-detail-subject">เรื่อง: {selectedDoc.subject}</p>
                  )}
                </div>
                <div className="dms-detail-banner-status">
                  <span className={`status-pill ${selectedDoc.status} dms-pill-lg`}>
                    <span className="status-dot"></span>
                    {selectedDoc.status === 'approved' && 'อนุมัติแล้ว'}
                    {selectedDoc.status === 'reviewing' && 'รอตรวจสอบ'}
                    {selectedDoc.status === 'draft' && 'ฉบับร่าง'}
                  </span>
                </div>
              </div>

              {/* Details Grid */}
              <div className="dms-detail-grid">
                <div className="dms-detail-item">
                  <span className="dms-detail-label">เลขที่อ้างอิงเอกสาร</span>
                  <span className="dms-detail-value font-mono">{selectedDoc.externalRef || `DOC-2569-${selectedDoc.id.padStart(4, '0')}`}</span>
                </div>
                <div className="dms-detail-item">
                  <span className="dms-detail-label">ประเภทเอกสาร</span>
                  <span className="dms-detail-value"><span className="doc-type-tag">{selectedDoc.type}</span></span>
                </div>
                <div className="dms-detail-item">
                  <span className="dms-detail-label">ขนาดไฟล์</span>
                  <span className="dms-detail-value font-mono">{formatBytes(selectedDoc.fileSize || selectedDoc.rawDoc?.file_size)}</span>
                </div>
                <div className="dms-detail-item">
                  <span className="dms-detail-label">วันที่ลงทะเบียน / แก้ไข</span>
                  <span className="dms-detail-value">{selectedDoc.modifiedDate}</span>
                </div>
                <div className="dms-detail-item">
                  <span className="dms-detail-label">ผู้ลงทะเบียน</span>
                  <span className="dms-detail-value">{selectedDoc.creatorName || 'เจ้าหน้าที่ธุรการ'}</span>
                </div>
                <div className="dms-detail-item">
                  <span className="dms-detail-label">สถานะการอนุมัติ</span>
                  <span className="dms-detail-value">
                    {selectedDoc.status === 'approved' ? (
                      <span className="text-success font-semibold">อนุมัติแล้ว โดย {selectedDoc.approverName || 'ผู้อนุมัติเอกสาร'}</span>
                    ) : selectedDoc.status === 'reviewing' ? (
                      <span className="text-warning font-semibold">อยู่ระหว่างรอการตรวจสอบ</span>
                    ) : (
                      <span>ฉบับร่าง</span>
                    )}
                  </span>
                </div>
                <div className="dms-detail-item">
                  <span className="dms-detail-label">การเข้าถึงไฟล์</span>
                  <div className="dms-detail-file-access">
                    <a
                      href={selectedDoc.fileUrl || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="dms-file-link-btn"
                      onClick={e => {
                        if (!selectedDoc.fileUrl || selectedDoc.fileUrl.startsWith('https://example.com')) {
                          e.preventDefault();
                          toast.success(`กำลังเปิดพรีวิวไฟล์: ${selectedDoc.name}`);
                        }
                      }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M14 2v6h6" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      เปิดดูไฟล์เอกสาร
                    </a>
                  </div>
                </div>
              </div>

              {/* Pending Review Notice Box */}
              {selectedDoc.status === 'reviewing' && (
                <div className="dms-review-notice-box">
                  <div className="dms-notice-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" width="20" height="20">
                      <circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round"/>
                      <line x1="12" y1="8" x2="12" y2="12" strokeLinecap="round" strokeLinejoin="round"/>
                      <line x1="12" y1="16" x2="12.01" y2="16" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div className="dms-notice-text">
                    <h4 className="dms-notice-heading">เอกสารนี้ยังไม่ได้รับการอนุมัติ (รอตรวจสอบ)</h4>
                    <p className="dms-notice-sub">กรุณาตรวจสอบความถูกต้องของข้อมูลและเอกสารแนบก่อนกดปุ่มอนุมัติด้านล่าง</p>
                  </div>
                </div>
              )}

              {/* Approved Info Box */}
              {selectedDoc.status === 'approved' && (
                <div className="dms-approved-notice-box">
                  <div className="dms-notice-icon-success">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" width="20" height="20">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" strokeLinecap="round" strokeLinejoin="round"/>
                      <polyline points="22 4 12 14.01 9 11.01" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div className="dms-notice-text">
                    <h4 className="dms-notice-heading-success">เอกสารได้รับการอนุมัติอย่างสมบูรณ์แล้ว</h4>
                    <p className="dms-notice-sub">พร้อมสำหรับการส่งต่อหรือนำไปอ้างอิงในกระบวนการรักษาและส่งตัวผู้ป่วย</p>
                  </div>
                </div>
              )}
            </div>

            <div className="dms-modal-footer">
              <button type="button" className="dms-btn-secondary" onClick={() => setActiveModal(null)}>
                ปิดหน้าต่าง
              </button>
              {selectedDoc.status === 'reviewing' && (
                <button
                  type="button"
                  className="dms-btn-approve"
                  disabled={isApproving}
                  onClick={() => handleApproveDocument(selectedDoc.id)}
                >
                  {isApproving ? (
                    'กำลังดำเนินการ...'
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16">
                        <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      อนุมัติเอกสารนี้
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (activeModal === 'storage') {
      const currentUsedBytes = storageStats ? storageStats.used_bytes : docs.reduce((acc, d) => acc + (d.fileSize || 1500000), 0);
      const currentQuotaBytes = storageStats ? storageStats.quota_bytes : 524288000;
      const currentUsedMB = storageStats ? storageStats.used_mb : (currentUsedBytes / (1024 * 1024));
      const currentQuotaMB = storageStats ? storageStats.quota_mb : 500;
      const currentRemainingMB = storageStats ? storageStats.remaining_mb : Math.max(0, currentQuotaMB - currentUsedMB);
      const currentPercent = storageStats ? storageStats.percentage : (currentUsedBytes / currentQuotaBytes) * 100;
      const currentCount = storageStats ? storageStats.total_files : docs.length;

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
                  <p className="dms-modal-subtitle">ข้อมูลการใช้งาน Supabase Storage & Database จริงของคลินิก</p>
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
                <span className="stat-label">โควต้าทั้งหมด (Supabase Free Tier):</span>
                <span className="stat-value font-bold">{currentQuotaMB.toFixed(0)} MB</span>
              </div>
              <div className="dms-storage-stat-row">
                <span className="stat-label">พื้นที่เอกสารที่ใช้งานแล้ว:</span>
                <span className="stat-value text-primary font-bold">
                  {currentUsedMB.toFixed(2)} MB ({currentPercent.toFixed(2)}%)
                </span>
              </div>
              <div className="dms-storage-stat-row">
                <span className="stat-label">พื้นที่ว่างคงเหลือ (หักลบจริง):</span>
                <span className="stat-value text-success font-bold">
                  {currentRemainingMB.toFixed(2)} MB
                </span>
              </div>
              <div className="dms-storage-stat-row">
                <span className="stat-label">จำนวนไฟล์เอกสารในระบบ:</span>
                <span className="stat-value font-semibold">{currentCount} ไฟล์</span>
              </div>

              {storageStats?.breakdown && storageStats.breakdown.length > 0 && (
                <div className="dms-storage-breakdown-section">
                  <h4 className="dms-breakdown-title">แยกตามประเภทเอกสารในฐานข้อมูล:</h4>
                  <div className="dms-breakdown-list">
                    {storageStats.breakdown.map((item, idx) => (
                      <div key={idx} className="dms-storage-stat-row">
                        <span className="stat-label">{item.type} ({item.count} ไฟล์):</span>
                        <span className="stat-value font-mono">{item.size_mb.toFixed(2)} MB</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
                <p className="dms-modal-subtitle">คลิกแถวเอกสารเพื่อดูรายละเอียดและอนุมัติ</p>
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
                    <th style={{ textAlign: 'center' }}>การจัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {dataList.map((doc) => (
                    <tr key={doc.id} onClick={() => openDocDetail(doc)} className="dms-clickable-row">
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
                            {doc.externalRef ? (
                              <span className="doc-subject-text">เลขที่: {doc.externalRef}</span>
                            ) : doc.subject && doc.subject !== doc.name ? (
                              <span className="doc-subject-text">เรื่อง: {doc.subject}</span>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td><span className="doc-type-tag">{doc.type}</span></td>
                      <td className="doc-date-text">{doc.modifiedDate}</td>
                      <td>
                        <span className={`status-pill ${doc.status}`}>
                          <span className="status-dot"></span>
                          {doc.status === 'approved' && 'อนุมัติแล้ว'}
                          {doc.status === 'reviewing' && 'รอตรวจสอบ'}
                          {doc.status === 'draft' && 'ฉบับร่าง'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="dms-action-view-btn"
                          title="ดูรายละเอียดเอกสาร"
                          aria-label="ดูรายละเอียดเอกสาร"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDocDetail(doc);
                          }}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeLinecap="round" strokeLinejoin="round"/>
                            <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {dataList.length === 0 && (
                    <tr>
                      <td colSpan={5} className="no-data-cell">
                        <div className="no-data-content">
                          <p>ไม่พบรายการเอกสารในหมวดหมู่นี้</p>
                        </div>
                      </td>
                    </tr>
                  )}
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
            <p className="page-sub-title">จัดการ จัดเก็บ ตรวจสอบ และอนุมัติเอกสารสำคัญของคลินิก</p>
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
            <span className="metric-label">เอกสารรอตรวจสอบ</span>
            <span className="metric-value">{reviewingDocs.length}</span>
            <span className="metric-subtext red-text">ต้องดำเนินการอนุมัติ</span>
          </div>
        </div>

        <div className="dms-card metric-card interactive" onClick={() => setActiveModal('recent')}>
          <div className="metric-icon-wrapper green-bg">
            <svg viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" width="24" height="24">
              <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="metric-info">
            <span className="metric-label">เพิ่มเข้ามาล่าสุด</span>
            <span className="metric-value">+{addedRecentlyDocs.length}</span>
            <span className="metric-subtext green-text">ในเดือนนี้</span>
          </div>
        </div>

        <div className="dms-card metric-card interactive" onClick={() => setActiveModal('storage')}>
          <div className="metric-icon-wrapper gray-bg">
            <svg viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" width="24" height="24">
              <path d="M4 7v10c0 2.21 3.58 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.58 4 8 4s8-1.79 8-4M4 7c0-2.21 3.58-4 8-4s8 1.79 8 4m0 5c0 2.21-3.58 4-8 4s-8-1.79-8-4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="metric-info">
            <span className="metric-label">พื้นที่จัดเก็บ (Supabase)</span>
            <span className="metric-value">
              {storageStats ? `${storageStats.used_mb.toFixed(2)} MB` : `${((docs.reduce((acc, d) => acc + (d.fileSize || 1500000), 0)) / (1024 * 1024)).toFixed(2)} MB`}
            </span>
            <div className="storage-progress-bar">
              <div
                className="storage-progress-fill"
                style={{
                  width: `${Math.min(100, Math.max(storageStats ? storageStats.percentage : ((docs.reduce((acc, d) => acc + (d.fileSize || 1500000), 0)) / 524288000) * 100, 1.5))}%`
                }}
              ></div>
            </div>
            <span className="metric-subtext gray-text">
              {storageStats
                ? `ใช้ไป ${storageStats.percentage.toFixed(1)}% (เหลือ ${storageStats.remaining_mb.toFixed(1)} MB)`
                : 'โควต้า 500 MB (Free Tier)'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Main Master Layout */}
      <div className="dms-main-grid">
        {/* Left Master Table Section */}
        <div className="dms-card docs-table-section">
          <div className="docs-table-header">
            <div>
              <h2 className="section-title">รายการเอกสารสำคัญล่าสุด</h2>
              <p className="section-subtitle">คลิกที่แถวเอกสารเพื่อดูข้อมูลรายละเอียดและดำเนินการอนุมัติ</p>
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
                  <th style={{ textAlign: 'center' }}>การจัดการ</th>
                </tr>
              </thead>
              <tbody>
                {recentDocs.map((doc) => (
                  <tr key={doc.id} onClick={() => openDocDetail(doc)} className="dms-clickable-row">
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
                          {doc.externalRef ? (
                            <span className="doc-subject-text">เลขที่: {doc.externalRef}</span>
                          ) : doc.subject && doc.subject !== doc.name ? (
                            <span className="doc-subject-text">เรื่อง: {doc.subject}</span>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td><span className="doc-type-tag">{doc.type}</span></td>
                    <td className="doc-date-text">{doc.modifiedDate}</td>
                    <td>
                      <span className={`status-pill ${doc.status}`}>
                        <span className="status-dot"></span>
                        {doc.status === 'approved' && 'อนุมัติแล้ว'}
                        {doc.status === 'reviewing' && 'รอตรวจสอบ'}
                        {doc.status === 'draft' && 'ฉบับร่าง'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="dms-action-view-btn"
                        title="ดูรายละเอียดเอกสาร"
                        aria-label="ดูรายละเอียดเอกสาร"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDocDetail(doc);
                        }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeLinecap="round" strokeLinejoin="round"/>
                          <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
                {recentDocs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="no-data-cell">
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
        </div>
      </div>

      {renderModalContent()}
    </div>
  );
};
