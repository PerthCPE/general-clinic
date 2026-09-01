import React, { useState } from 'react';
import './DocumentForwardPage.css';

interface ForwardDoc {
  id: string;
  title: string;
  sender: string;
  recipient?: string;
  receivedDate: string;
  type: string;
  status: 'unread' | 'processing' | 'completed';
}

const generateIncomingDocs = (): ForwardDoc[] => {
  const docs: ForwardDoc[] = [];
  const senders = ['ห้องปฏิบัติการกลาง', 'แผนกฉุกเฉิน', 'แผนกอายุรกรรม', 'ฝ่ายการเงิน', 'ห้องยา'];
  const titles = ['ผลการตรวจเลือด', 'ใบเบิกอุปกรณ์การแพทย์', 'รายงานผล X-ray', 'ใบส่งตัวผู้ป่วย', 'บันทึกข้อความภายใน'];
  const types = ['ผลตรวจ', 'ใบเบิก', 'รายงาน', 'เอกสารทั่วไป'];
  
  for(let i=1; i<=40; i++) {
    const status = i <= 5 ? 'unread' : (i <= 10 ? 'processing' : 'completed');
    const today = new Date();
    today.setDate(today.getDate() - Math.floor(i / 8));
    
    docs.push({
      id: `DOC-2023-${1000 + i}`,
      title: `${titles[Math.floor(Math.random() * titles.length)]} - รหัส ${i}`,
      sender: senders[Math.floor(Math.random() * senders.length)],
      receivedDate: today.toLocaleString('th-TH', { hour12: false, dateStyle: 'medium', timeStyle: 'short' }),
      type: types[Math.floor(Math.random() * types.length)],
      status: status
    });
  }
  return docs;
};

const generateForwardedDocs = (): ForwardDoc[] => {
  const docs: ForwardDoc[] = [];
  const recipients = ['ผู้อำนวยการคลินิก', 'ห้องปฏิบัติการกลาง', 'แผนกการเงิน', 'ฝ่ายบุคคล', 'ห้องยา'];
  const titles = ['รายงานสรุปยอดผู้ป่วยรายเดือน', 'แบบฟอร์มประเมินพนักงาน', 'ใบส่งตัวไปโรงพยาบาลศูนย์', 'เอกสารเบิกจ่าย'];
  const types = ['รายงาน', 'เอกสารทั่วไป', 'ผลตรวจ', 'ใบเบิก'];
  
  for(let i=1; i<=60; i++) {
    const status = i <= 28 ? 'completed' : 'processing';
    const today = new Date();
    today.setDate(today.getDate() - Math.floor(i / 10));
    
    docs.push({
      id: `FWD-2023-${2000 + i}`,
      title: `${titles[Math.floor(Math.random() * titles.length)]} #${i}`,
      sender: 'ธุรการ (คุณ)',
      recipient: recipients[Math.floor(Math.random() * recipients.length)],
      receivedDate: today.toLocaleString('th-TH', { hour12: false, dateStyle: 'medium', timeStyle: 'short' }),
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

  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<ForwardDoc | null>(null);
  
  // Metric Modals
  const [activeMetricModal, setActiveMetricModal] = useState<'today' | 'pending' | 'completed' | null>(null);

  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocRecipient, setNewDocRecipient] = useState('ฝ่ายบุคคล');
  const [newDocType, setNewDocType] = useState('เอกสารทั่วไป');

  const handleSendDocument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocTitle.trim()) return;

    const newDoc: ForwardDoc = {
      id: `FWD-2023-00${forwardedDocs.length + 92}`,
      title: newDocTitle,
      sender: 'ธุรการ (คุณ)',
      recipient: newDocRecipient,
      receivedDate: new Date().toLocaleString('th-TH', { hour12: false, dateStyle: 'medium', timeStyle: 'short' }),
      type: newDocType,
      status: 'processing'
    };

    setForwardedDocs([newDoc, ...forwardedDocs]);
    setIsSendModalOpen(false);
    setNewDocTitle('');
    alert('ส่งต่อเอกสารเรียบร้อยแล้ว!');
  };

  const handleViewDetail = (doc: ForwardDoc) => {
    setSelectedDoc(doc);
    setIsDetailModalOpen(true);
    if (doc.status === 'unread') {
      setIncomingDocs(prev => prev.map(d => d.id === doc.id ? { ...d, status: 'processing' } : d));
    }
  };

  const handleArchive = (docId: string) => {
    setIncomingDocs(prev => prev.filter(d => d.id !== docId));
    alert('จัดเก็บเอกสารเข้าแฟ้มเรียบร้อย!');
  };

  const renderMetricModal = () => {
    if (!activeMetricModal) return null;
    
    let title = '';
    let dataList: ForwardDoc[] = [];
    
    if (activeMetricModal === 'today') {
      title = 'เอกสารใหม่วันนี้ (12)';
      dataList = incomingDocs.slice(0, 12);
    }
    if (activeMetricModal === 'pending') {
      title = 'รอการดำเนินการ (5)';
      dataList = incomingDocs.filter(d => d.status === 'unread' || d.status === 'processing').slice(0, 5);
    }
    if (activeMetricModal === 'completed') {
      title = 'ส่งต่อสำเร็จสัปดาห์นี้ (28)';
      dataList = forwardedDocs.filter(d => d.status === 'completed').slice(0, 28);
    }

    return (
      <div className="modal-backdrop" onClick={() => setActiveMetricModal(null)}>
        <div className="dms-card modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
          <div className="modal-header">
            <h3>{title}</h3>
            <button className="close-modal-btn" onClick={() => setActiveMetricModal(null)}>×</button>
          </div>
          <div className="modal-body" style={{ overflowY: 'auto', flex: 1 }}>
            <table className="forward-table">
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
                    <td className="doc-code">{doc.id}</td>
                    <td className="doc-title-cell">{doc.title}</td>
                    <td>{activeMetricModal === 'completed' ? doc.recipient : doc.sender}</td>
                    <td>
                      <span className={`status-badge-forward ${doc.status}`}>
                        {doc.status === 'unread' && 'ยังไม่ได้อ่าน'}
                        {doc.status === 'processing' && 'กำลังดำเนินการ'}
                        {doc.status === 'completed' && 'สำเร็จแล้ว'}
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
    <div className="forward-container">
      {/* Title & Subtitle */}
      <div className="forward-header">
        <div>
          <h1 className="forward-title">ส่งต่อเอกสาร</h1>
          <p className="forward-subtitle">จัดการและติดตามเอกสารภายในคลินิก</p>
        </div>
        <button className="send-doc-btn" onClick={() => setIsSendModalOpen(true)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
          </svg>
          ส่งเอกสาร
        </button>
      </div>

      {/* Metrics Cards */}
      <div className="forward-metrics-grid">
        <div className="dms-card metric-card interactive" onClick={() => setActiveMetricModal('today')}>
          <div className="metric-icon-wrapper blue-bg">
            <svg className="metric-icon" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <path d="M14 2v6h6"/>
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
            <svg className="metric-icon" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2">
              <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
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
            <svg className="metric-icon" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <div className="metric-info">
            <span className="metric-label">ส่งต่อสำเร็จ (สัปดาห์นี้)</span>
            <span className="metric-value">28</span>
            <span className="metric-subtext green-text">คลิกเพื่อดูรายการ</span>
          </div>
        </div>
      </div>

      {/* Main Forward Roster */}
      <div className="dms-card forward-roster-card">
        <div className="forward-roster-header">
          <div className="tab-buttons">
            <button className={`tab-btn ${activeTab === 'incoming' ? 'active' : ''}`} onClick={() => setActiveTab('incoming')}>
              เอกสารขาเข้า
            </button>
            <button className={`tab-btn ${activeTab === 'forwarded' ? 'active' : ''}`} onClick={() => setActiveTab('forwarded')}>
              เอกสารส่งต่อ
            </button>
          </div>
        </div>

        {activeTab === 'incoming' ? (
          <div className="table-responsive">
            <table className="forward-table">
              <thead>
                <tr>
                  <th>รหัสเอกสาร</th>
                  <th>ชื่อเอกสาร</th>
                  <th>จาก</th>
                  <th>วันที่รับ</th>
                  <th>ประเภท</th>
                  <th>สถานะ</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {incomingDocs.map(doc => (
                  <tr key={doc.id}>
                    <td className="doc-code">{doc.id}</td>
                    <td className="doc-title-cell">{doc.title}</td>
                    <td>{doc.sender}</td>
                    <td>{doc.receivedDate}</td>
                    <td>{doc.type}</td>
                    <td>
                      <span className={`status-badge-forward ${doc.status}`}>
                        {doc.status === 'unread' ? 'ยังไม่ได้อ่าน' : (doc.status === 'processing' ? 'กำลังดำเนินการ' : 'สำเร็จแล้ว')}
                      </span>
                    </td>
                    <td>
                      <div className="action-links">
                        <button className="table-action-link blue" onClick={() => handleViewDetail(doc)}>ดูรายละเอียด</button>
                        <button className="table-action-link gray" onClick={() => handleArchive(doc.id)}>จัดเก็บ</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="forward-table">
              <thead>
                <tr>
                  <th>รหัสเอกสาร</th>
                  <th>ชื่อเอกสาร</th>
                  <th>ส่งถึง</th>
                  <th>วันที่ส่ง</th>
                  <th>ประเภท</th>
                  <th>สถานะ</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {forwardedDocs.map(doc => (
                  <tr key={doc.id}>
                    <td className="doc-code">{doc.id}</td>
                    <td className="doc-title-cell">{doc.title}</td>
                    <td>{doc.recipient}</td>
                    <td>{doc.receivedDate}</td>
                    <td>{doc.type}</td>
                    <td>
                      <span className={`status-badge-forward ${doc.status}`}>
                        {doc.status === 'completed' ? 'สำเร็จแล้ว' : 'กำลังดำเนินการ'}
                      </span>
                    </td>
                    <td>
                      <button className="table-action-link blue" onClick={() => handleViewDetail(doc)}>ดูรายละเอียด</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Send Document Modal */}
      {isSendModalOpen && (
        <div className="modal-backdrop">
          <div className="dms-card modal-content">
            <div className="modal-header">
              <h3>ส่งต่อเอกสารใหม่</h3>
              <button className="close-modal-btn" onClick={() => setIsSendModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleSendDocument}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">ชื่อเอกสาร</label>
                  <input type="text" className="form-input-text" placeholder="เช่น ใบขอประวัติคนไข้..." value={newDocTitle} onChange={(e) => setNewDocTitle(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">แผนก/ผู้รับปลายทาง</label>
                  <select className="form-input-text" value={newDocRecipient} onChange={(e) => setNewDocRecipient(e.target.value)}>
                    <option value="ผู้อำนวยการคลินิก">ผู้อำนวยการคลินิก</option>
                    <option value="ห้องปฏิบัติการกลาง">ห้องปฏิบัติการกลาง</option>
                    <option value="แผนกการเงิน">แผนกการเงิน</option>
                    <option value="ฝ่ายบุคคล">ฝ่ายบุคคล</option>
                    <option value="ห้องยา">ห้องยา</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">ประเภทเอกสาร</label>
                  <select className="form-input-text" value={newDocType} onChange={(e) => setNewDocType(e.target.value)}>
                    <option value="เอกสารทั่วไป">เอกสารทั่วไป</option>
                    <option value="ผลตรวจ">ผลตรวจ</option>
                    <option value="ใบเบิก">ใบเบิก</option>
                    <option value="รายงาน">รายงาน</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="cancel-btn" onClick={() => setIsSendModalOpen(false)}>ยกเลิก</button>
                <button type="submit" className="save-btn font-bold">ยืนยันการส่ง</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {isDetailModalOpen && selectedDoc && (
        <div className="modal-backdrop">
          <div className="dms-card modal-content">
            <div className="modal-header">
              <h3>รายละเอียดเอกสาร</h3>
              <button className="close-modal-btn" onClick={() => setIsDetailModalOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="detail-item"><span className="detail-label">รหัสเอกสาร:</span><span className="detail-val">{selectedDoc.id}</span></div>
              <div className="detail-item"><span className="detail-label">ชื่อเอกสาร:</span><span className="detail-val font-bold">{selectedDoc.title}</span></div>
              <div className="detail-item"><span className="detail-label">ประเภท:</span><span className="detail-val">{selectedDoc.type}</span></div>
              <div className="detail-item"><span className="detail-label">ผู้ส่ง:</span><span className="detail-val">{selectedDoc.sender}</span></div>
              {selectedDoc.recipient && <div className="detail-item"><span className="detail-label">ผู้รับปลายทาง:</span><span className="detail-val">{selectedDoc.recipient}</span></div>}
              <div className="detail-item"><span className="detail-label">วันที่ดำเนินการ:</span><span className="detail-val">{selectedDoc.receivedDate}</span></div>
              <div className="detail-item"><span className="detail-label">สถานะ:</span>
                <span className="detail-val">
                  <span className={`status-badge-forward ${selectedDoc.status}`}>
                    {selectedDoc.status === 'unread' && 'ยังไม่ได้อ่าน'}
                    {selectedDoc.status === 'processing' && 'กำลังดำเนินการ'}
                    {selectedDoc.status === 'completed' && 'สำเร็จแล้ว'}
                  </span>
                </span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="cancel-btn" onClick={() => setIsDetailModalOpen(false)}>ปิดหน้าต่าง</button>
            </div>
          </div>
        </div>
      )}
      
      {renderMetricModal()}
    </div>
  );
};
