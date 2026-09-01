import React, { useState } from 'react';
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

// Generate 125 mock documents
const generateMockDocs = (): DocumentItem[] => {
  const docs: DocumentItem[] = [];
  const types = ['รายงาน', 'สัญญา', 'สเปรดชีต', 'นโยบาย', 'ใบเบิก', 'ผลตรวจ'];
  const statuses: ('approved' | 'reviewing' | 'draft')[] = ['approved', 'reviewing', 'draft'];
  const baseNames = ['Q3_Patient_Report', 'Dr_Smith_Contract', 'Inventory_Log', 'Policy_Update', 'Lab_Results', 'Weekly_Meeting_Notes'];
  const exts = ['.pdf', '.docx', '.xlsx'];
  
  for (let i = 1; i <= 125; i++) {
    const type = types[Math.floor(Math.random() * types.length)];
    const status = i <= 42 ? 'reviewing' : statuses[Math.floor(Math.random() * statuses.length)];
    const baseName = baseNames[Math.floor(Math.random() * baseNames.length)];
    const ext = exts[Math.floor(Math.random() * exts.length)];
    
    docs.push({
      id: String(i),
      name: `${baseName}_${i}${ext}`,
      type: type,
      modifiedDate: `Oct ${Math.floor(Math.random() * 28) + 1}, 2023`,
      status: status
    });
  }
  return docs;
};

export const DocumentManagementPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
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

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      // Open the upload form modal instead of uploading directly
      setActiveModal('upload');
    }
    // Reset input so the same file can be selected again if needed
    e.target.value = '';
  };

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setUploading(true);
    setActiveModal(null); // Hide modal while uploading

    setTimeout(() => {
      const newDoc: DocumentItem = {
        id: String(docs.length + 1),
        name: selectedFile.name,
        type: selectedFile.name.split('.').pop()?.toUpperCase() || 'ไฟล์ทั่วไป',
        modifiedDate: new Date().toLocaleDateString('th-TH', { month: 'short', day: 'numeric', year: 'numeric' }),
        status: 'reviewing',
        subject: uploadForm.subject,
        senderName: uploadForm.senderName,
        externalRef: uploadForm.externalRef
      };
      
      setDocs([newDoc, ...docs]);
      setSelectedFile(null);
      setUploading(false);
      setUploadForm({ subject: '', senderName: '', externalRef: '' });
      alert('อัปโหลดไฟล์และบันทึกข้อมูลเรียบร้อยแล้ว!');
    }, 1500);
  };

  const filteredDocs = docs.filter(doc =>
    doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.type.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Sliced for the main page to show only latest 5
  const recentDocs = docs.slice(0, 5);
  const reviewingDocs = docs.filter(d => d.status === 'reviewing');
  const addedRecentlyDocs = docs.slice(0, 15);

  const openFolderModal = (title: string) => {
    setActiveFolderTitle(title);
    setActiveModal('folder');
  };

  const renderModalContent = () => {
    if (activeModal === 'upload') {
      return (
        <div className="modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="dms-card modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>รายละเอียดการอัปโหลดเอกสาร</h3>
              <button className="close-modal-btn" onClick={() => setActiveModal(null)}>×</button>
            </div>
            <form onSubmit={handleUploadSubmit}>
              <div className="modal-body">
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--title-color)' }}>ไฟล์ที่เลือก</label>
                  <div style={{ padding: '10px 14px', backgroundColor: 'var(--table-th-bg)', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '13px', color: 'var(--text-color)' }}>
                    📄 {selectedFile?.name}
                  </div>
                </div>
                
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--title-color)' }}>
                    ชื่อเรื่อง / หัวข้อเอกสาร (Subject) <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input type="text" className="search-input" style={{ width: '100%', boxSizing: 'border-box' }} required 
                    value={uploadForm.subject} onChange={e => setUploadForm({...uploadForm, subject: e.target.value})} 
                    placeholder="เช่น รายงานประจำเดือน ตุลาคม" />
                </div>
                
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--title-color)' }}>
                    ชื่อผู้ส่ง / หน่วยงาน (Sender Name)
                  </label>
                  <input type="text" className="search-input" style={{ width: '100%', boxSizing: 'border-box' }} 
                    value={uploadForm.senderName} onChange={e => setUploadForm({...uploadForm, senderName: e.target.value})} 
                    placeholder="เช่น แผนกการเงิน, นพ.สมชาย" />
                </div>
                
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--title-color)' }}>
                    เลขที่อ้างอิงภายนอก (External Ref)
                  </label>
                  <input type="text" className="search-input" style={{ width: '100%', boxSizing: 'border-box' }} 
                    value={uploadForm.externalRef} onChange={e => setUploadForm({...uploadForm, externalRef: e.target.value})} 
                    placeholder="เช่น EXP-2023-001" />
                </div>
              </div>
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                <button type="button" onClick={() => setActiveModal(null)}
                  style={{ padding: '8px 16px', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'transparent', color: 'var(--text-color)', cursor: 'pointer', fontWeight: 600 }}>
                  ยกเลิก
                </button>
                <button type="submit" 
                  style={{ padding: '8px 16px', backgroundColor: '#2563eb', color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
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
        <div className="modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="dms-card modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>รายละเอียดพื้นที่จัดเก็บ</h3>
              <button className="close-modal-btn" onClick={() => setActiveModal(null)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '13px', color: 'var(--subtitle-color)', fontWeight: 500 }}>ใช้งานแล้ว:</span>
                <span style={{ fontSize: '13px', color: 'var(--title-color)', fontWeight: 'bold' }}>640 GB (64%)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '13px', color: 'var(--subtitle-color)', fontWeight: 500 }}>พื้นที่ทั้งหมด:</span>
                <span style={{ fontSize: '13px', color: 'var(--title-color)' }}>1,000 GB</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '13px', color: 'var(--subtitle-color)', fontWeight: 500 }}>ไฟล์รูปภาพ/PDF:</span>
                <span style={{ fontSize: '13px', color: 'var(--title-color)' }}>320 GB</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '13px', color: 'var(--subtitle-color)', fontWeight: 500 }}>ไฟล์เอกสารทั่วไป:</span>
                <span style={{ fontSize: '13px', color: 'var(--title-color)' }}>200 GB</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0' }}>
                <span style={{ fontSize: '13px', color: 'var(--subtitle-color)', fontWeight: 500 }}>ฐานข้อมูล:</span>
                <span style={{ fontSize: '13px', color: 'var(--title-color)' }}>120 GB</span>
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button style={{ padding: '8px 16px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }} onClick={() => setActiveModal(null)}>ปิด</button>
            </div>
          </div>
        </div>
      );
    }

    // other modals like 'all', 'reviewing', etc...
    let title = '';
    let dataList: DocumentItem[] = [];
    
    if (activeModal === 'all') { title = 'เอกสารทั้งหมด (125)'; dataList = docs; }
    if (activeModal === 'reviewing') { title = 'เอกสารรอตรวจสอบ (42)'; dataList = reviewingDocs; }
    if (activeModal === 'recent') { title = 'เอกสารเพิ่มล่าสุด (15)'; dataList = addedRecentlyDocs; }
    if (activeModal === 'folder') { title = `แฟ้ม: ${activeFolderTitle}`; dataList = docs.slice(0, 20); }

    if (!activeModal || !title) return null;

    return (
      <div className="modal-backdrop" onClick={() => setActiveModal(null)}>
        <div className="dms-card modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
          <div className="modal-header">
            <h3>{title}</h3>
            <button className="close-modal-btn" onClick={() => setActiveModal(null)}>×</button>
          </div>
          <div className="modal-body" style={{ overflowY: 'auto', flex: 1, paddingRight: '8px' }}>
            <table className="dms-table">
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
                        <span className={`doc-icon-indicator ${doc.name.split('.').pop()}`}>📄</span>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span className="doc-name">{doc.name}</span>
                          {doc.subject && <span style={{ fontSize: '11px', color: 'var(--subtitle-color)' }}>เรื่อง: {doc.subject}</span>}
                        </div>
                      </div>
                    </td>
                    <td>{doc.type}</td>
                    <td>{doc.modifiedDate}</td>
                    <td>
                      <span className={`status-badge ${doc.status}`}>
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
      </div>
    );
  };

  return (
    <div className="dms-container">
      {/* Title & Subtitle */}
      <div className="dms-header">
        <h1 className="dms-title">การจัดการเอกสาร</h1>
        <p className="dms-subtitle">จัดการและจัดระเบียบเอกสารและบันทึกของคลินิก</p>
      </div>

      {/* Metrics Cards */}
      <div className="dms-metrics-grid">
        <div className="dms-card metric-card interactive" onClick={() => setActiveModal('all')}>
          <div className="metric-icon-wrapper blue-bg">
            <svg className="metric-icon" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2">
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
            </svg>
          </div>
          <div className="metric-info">
            <span className="metric-label">จำนวนเอกสารทั้งหมด</span>
            <span className="metric-value">{docs.length}</span>
            <span className="metric-subtext green-text">คลิกเพื่อดูทั้งหมด</span>
          </div>
        </div>

        <div className="dms-card metric-card interactive" onClick={() => setActiveModal('reviewing')}>
          <div className="metric-icon-wrapper red-bg">
            <svg className="metric-icon" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
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
            <svg className="metric-icon" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2">
              <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
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
            <svg className="metric-icon" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
              <path d="M4 7v10c0 2.21 3.58 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.58 4 8 4s8-1.79 8-4M4 7c0-2.21 3.58-4 8-4s8 1.79 8 4m0 5c0 2.21-3.58 4-8 4s-8-1.79-8-4"/>
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

      {/* Main Layout Area */}
      <div className="dms-main-grid">
        {/* Left Side: Recent Documents Table */}
        <div className="dms-card docs-table-section">
          <div className="docs-table-header">
            <h2 className="section-title">เอกสารล่าสุด</h2>
            <div className="table-actions">
              <input
                type="text"
                placeholder="ค้นหาเอกสาร..."
                className="search-input"
                value={searchTerm}
                onChange={handleSearchChange}
              />
              <button className="view-all-link" onClick={() => setActiveModal('all')}>ดูทั้งหมด &gt;</button>
            </div>
          </div>

          <div className="table-responsive">
            <table className="dms-table">
              <thead>
                <tr>
                  <th>ชื่อเอกสาร</th>
                  <th>ประเภท</th>
                  <th>วันที่แก้ไข</th>
                  <th>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {(searchTerm ? filteredDocs : recentDocs).map((doc) => (
                  <tr key={doc.id}>
                    <td>
                      <div className="doc-name-cell">
                        <span className={`doc-icon-indicator ${doc.name.split('.').pop()}`}>📄</span>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span className="doc-name">{doc.name}</span>
                          {doc.subject && <span style={{ fontSize: '11px', color: 'var(--subtitle-color)' }}>เรื่อง: {doc.subject}</span>}
                        </div>
                      </div>
                    </td>
                    <td>{doc.type}</td>
                    <td>{doc.modifiedDate}</td>
                    <td>
                      <span className={`status-badge ${doc.status}`}>
                        {doc.status === 'approved' && 'อนุมัติแล้ว'}
                        {doc.status === 'reviewing' && 'กำลังตรวจสอบ'}
                        {doc.status === 'draft' && 'ฉบับร่าง'}
                      </span>
                    </td>
                  </tr>
                ))}
                {(searchTerm ? filteredDocs : recentDocs).length === 0 && (
                  <tr>
                    <td colSpan={4} className="no-data">ไม่พบข้อมูลเอกสาร</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Side: Upload Box & Quick Menu */}
        <div className="dms-sidebar-actions">
          {/* Upload Area */}
          <div className="dms-card upload-card">
            <label className="upload-dropzone" style={uploading ? { opacity: 0.5, cursor: 'not-allowed' } : {}}>
              <input type="file" onChange={handleFileChange} style={{ display: 'none' }} disabled={uploading} />
              <div className="upload-icon-wrapper">
                <svg viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2">
                  <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                </svg>
              </div>
              <p className="upload-main-text">
                {uploading ? 'กำลังอัปโหลด...' : 'อัปโหลดเอกสารใหม่'}
              </p>
              <p className="upload-sub-text">คลิกเพื่อเลือกไฟล์และกรอกข้อมูล</p>
            </label>
          </div>

          {/* Quick Menu */}
          <div className="dms-card quick-menu-card">
            <h3 className="sidebar-section-title">เมนูด่วน</h3>
            <ul className="quick-menu-list">
              <li className="quick-menu-item" onClick={() => openFolderModal('ประวัติผู้ป่วย')}>
                <div className="menu-left">
                  <span className="folder-icon">📂</span>
                  <span>ประวัติผู้ป่วย</span>
                </div>
                <span className="menu-badge">45</span>
              </li>
              <li className="quick-menu-item" onClick={() => openFolderModal('ฝ่ายบุคคลและกำลังพล')}>
                <div className="menu-left">
                  <span className="folder-icon">📂</span>
                  <span>ฝ่ายบุคคลและกำลังพล</span>
                </div>
                <span className="menu-badge">18</span>
              </li>
              <li className="quick-menu-item" onClick={() => openFolderModal('รายงานการเงิน')}>
                <div className="menu-left">
                  <span className="folder-icon">📂</span>
                  <span>รายงานการเงิน</span>
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
