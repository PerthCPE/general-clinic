import { useState } from 'react';
import './MedicinePage.css';

interface Medicine {
  id: string;
  name: string;
  genericName: string;
  category: string;
  properties: string;
  dosage: string;
  precautions: string;
  price: string;
  manufacturer: string;
  stock: number;
  status: 'In Stock' | 'Low Stock' | 'Out of Stock';
  dispensedToday: number;
}

const initialMedicines: Medicine[] = [
  { 
    id: 'MED-0231', 
    name: 'Paracetamol 500mg', 
    genericName: 'Paracetamol (Acetaminophen)',
    category: 'ยาลดไข้ บรรเทาปวด (Analgesic / Antipyretic)',
    properties: 'บรรเทาอาการปวดในระดับเล็กน้อยถึงปานกลาง เช่น ปวดศีรษะ ปวดฟัน ปวดกล้ามเนื้อ และลดไข้',
    dosage: 'รับประทานครั้งละ 1-2 เม็ด ทุก 4-6 ชั่วโมง เมื่อมีอาการ (ห้ามรับประทานเกินวันละ 8 เม็ด หรือ 4,000mg)',
    precautions: 'ระวังการใช้ในผู้ป่วยโรคตับ ไต หรือผู้ที่ดื่มแอลกอฮอล์เป็นประจำ ไม่ควรทานติดต่อกันเกิน 5 วันโดยไม่มีคำสั่งแพทย์',
    price: '฿ 80.00 / กล่อง (10 แผง)',
    manufacturer: 'บริษัท สยามเภสัช จำกัด (Siam Pharmaceutical)',
    stock: 342, 
    status: 'In Stock', 
    dispensedToday: 12 
  },
  { 
    id: 'MED-0187', 
    name: 'Amoxicillin 250mg', 
    genericName: 'Amoxicillin Trihydrate',
    category: 'ยาปฏิชีวนะ ฆ่าเชื้อแบคทีเรีย (Penicillin Antibiotic)',
    properties: 'รักษาการติดเชื้อแบคทีเรียในระบบทางเดินหายใจ ทางเดินปัสสาวะ หู คอ จมูก และผิวหนัง',
    dosage: 'รับประทานครั้งละ 1 แคปซูล วันละ 3 ครั้ง หลังอาหาร (ต้องรับประทานติดต่อกันจนหมดตามแพทย์สั่งอย่างเคร่งครัด)',
    precautions: 'ห้ามใช้ในผู้ที่มีประวัติแพ้ยาในกลุ่มเพนิซิลลิน (Penicillin) หากเกิดผื่นคัน แน่นหน้าอก ให้หยุดยาและพบแพทย์ทันที',
    price: '฿ 150.00 / กล่อง (10 แผง)',
    manufacturer: 'บริษัท องค์การเภสัชกรรม (GPO)',
    stock: 48, 
    status: 'Low Stock', 
    dispensedToday: 8 
  },
  { 
    id: 'MED-0402', 
    name: 'Ibuprofen 400mg', 
    genericName: 'Ibuprofen (NSAID)',
    category: 'ยาต้านการอักเสบชนิดไม่ใช่สเตียรอยด์ (NSAIDs)',
    properties: 'ลดการอักเสบ ปวดข้อ ปวดกล้ามเนื้อ ปวดฟัน และปวดประจำเดือน',
    dosage: 'รับประทานครั้งละ 1 เม็ด วันละ 2-3 ครั้ง หลังอาหารทันที แล้วดื่มน้ำตามมากๆ',
    precautions: 'ระวังในผู้ป่วยโรคกระเพาะอาหาร เป็นแผลในกระเพาะ โรคไต หรือโรคหัวใจ ห้ามทานตอนท้องว่าง',
    price: '฿ 120.00 / กล่อง (10 แผง)',
    manufacturer: 'บริษัท เบอร์ลินซัพพลาย จำกัด',
    stock: 0, 
    status: 'Out of Stock', 
    dispensedToday: 3 
  },
  { 
    id: 'MED-0119', 
    name: 'Cetirizine 10mg', 
    genericName: 'Cetirizine Dihydrochloride',
    category: 'ยาแก้อาการแพ้ ต้านฮิสตามีน (Second-Generation Antihistamine)',
    properties: 'รักษาอาการแพ้อากาศ ลมพิษ น้ำมูกไหล จาม คันตา คันผิวหนัง',
    dosage: 'รับประทานครั้งละ 1 เม็ด วันละ 1 ครั้ง ก่อนนอน หรือเมื่อมีอาการแพ้',
    precautions: 'อาจทำให้ง่วงซึมเล็กน้อย ควรระวังการขับขี่ยานพาหนะหรือทำงานเกี่ยวกับเครื่องจักร',
    price: '฿ 90.00 / กล่อง (10 แผง)',
    manufacturer: 'บริษัท เมดฮับ ฟาร์มาซูติคอล จำกัด',
    stock: 215, 
    status: 'In Stock', 
    dispensedToday: 5 
  },
  { 
    id: 'MED-0356', 
    name: 'Omeprazole 20mg', 
    genericName: 'Omeprazole Magnesium',
    category: 'ยาลดกรดในกระเพาะอาหาร (Proton Pump Inhibitor - PPI)',
    properties: 'รักษาโรคกรดไหลย้อน แผลในกระเพาะอาหาร และลดการหลั่งกรดเกินในกระเพาะ',
    dosage: 'รับประทานครั้งละ 1 เม็ด วันละ 1 ครั้ง ก่อนอาหารเช้าประมาณ 30 นาที (กลืนทั้งเม็ด ห้ามเคี้ยว)',
    precautions: 'ไม่ควรกินติดต่อกันเป็นเวลานานเกิน 8 สัปดาห์โดยไม่มีแพทย์ดูแล',
    price: '฿ 180.00 / กล่อง (14 แคปซูล)',
    manufacturer: 'บริษัท แอสตร้าเซนเนก้า จำกัด',
    stock: 76, 
    status: 'In Stock', 
    dispensedToday: 9 
  },
];

export default function MedicinePage() {
  const [medicines, setMedicines] = useState<Medicine[]>(initialMedicines);

  const [searchMedId, setSearchMedId] = useState('');
  const [searchMedName, setSearchMedName] = useState('');
  
  const [showSuccessBadge, setShowSuccessBadge] = useState(false);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(null);
  const [detailModalMed, setDetailModalMed] = useState<Medicine | null>(null);

  const [updateMode, setUpdateMode] = useState<'add' | 'reduce'>('add');
  const [quantity, setQuantity] = useState<number | ''>('');
  
  const handleUpdateClick = (medicine: Medicine) => {
    setSelectedMedicine(medicine);
    setUpdateMode('add');
    setQuantity('');
    setIsModalOpen(true);
  };
  
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedMedicine(null);
    setQuantity('');
  };
  
  const handleSaveChanges = () => {
    if (!selectedMedicine || quantity === '' || quantity <= 0) return;
    
    if (updateMode === 'reduce' && quantity > selectedMedicine.stock) {
      return;
    }
    
    const qty = Number(quantity);
    
    setMedicines(prev => prev.map(med => {
      if (med.id === selectedMedicine.id) {
        let newStock = med.stock;
        if (updateMode === 'add') newStock += qty;
        else if (updateMode === 'reduce') newStock -= qty;
        
        let newStatus: 'In Stock' | 'Low Stock' | 'Out of Stock' = 'In Stock';
        if (newStock === 0) newStatus = 'Out of Stock';
        else if (newStock < 50) newStatus = 'Low Stock';
        
        return { ...med, stock: newStock, status: newStatus };
      }
      return med;
    }));
    
    handleCloseModal();
    setShowSuccessBadge(true);
    setTimeout(() => setShowSuccessBadge(false), 3000);
  };

  const filteredMedicines = medicines.filter(med => {
    const matchId = !searchMedId.trim() || med.id.toLowerCase().includes(searchMedId.trim().toLowerCase());
    const matchName = !searchMedName.trim() || med.name.toLowerCase().includes(searchMedName.trim().toLowerCase());
    return matchId && matchName;
  });
  
  const getStatusClass = (status: string) => {
    switch (status) {
      case 'In Stock': return 'status-in-stock';
      case 'Low Stock': return 'status-low-stock';
      case 'Out of Stock': return 'status-out-stock';
      default: return '';
    }
  };

  const renderStatusText = (status: string) => {
    switch (status) {
      case 'In Stock': return 'มีในคลัง (In Stock)';
      case 'Low Stock': return 'ใกล้หมด (Low Stock)';
      case 'Out of Stock': return 'หมดคลัง (Out of Stock)';
      default: return status;
    }
  };

  const isReduceInvalid = selectedMedicine && updateMode === 'reduce' && quantity !== '' && Number(quantity) > selectedMedicine.stock;

  return (
    <div className="medicine-page-container">
      <div className="page-header">
        <div className="header-titles">
          <h1 className="page-title">รายการยา</h1>
          <p className="page-subtitle">ค้นหาและจัดการระบบสินค้าคงคลัง</p>
        </div>
      </div>

      <div className="search-card card">
        <div className="search-inputs">
          <div className="input-group">
            <label>รหัสยา</label>
            <input
              type="text"
              placeholder="เช่น MED-0231"
              value={searchMedId}
              onChange={(e) => setSearchMedId(e.target.value)}
            />
          </div>
          <div className="input-group">
            <label>ชื่อยา</label>
            <input
              type="text"
              placeholder="เช่น Paracetamol"
              value={searchMedName}
              onChange={(e) => setSearchMedName(e.target.value)}
            />
          </div>
        </div>
        <button className="search-btn">ค้นหา</button>
      </div>

      <div className="stock-table-card card">
        <div className="table-header-row">
          <h2 className="table-title">สถานะคลังยา & สรุปการจ่ายยาประจำวัน</h2>
          {showSuccessBadge && (
            <span className="success-badge">
              ✓ อัปเดตคลังยาเรียบร้อยแล้ว
            </span>
          )}
        </div>

        <div className="table-wrapper">
          <table className="stock-table">
            <thead>
              <tr>
                <th>รหัสยา (ID)</th>
                <th>ชื่อยา (คลิกเพื่อดูรายละเอียด)</th>
                <th>คงเหลือในคลัง (STOCK)</th>
                <th>สถานะ (STATUS)</th>
                <th>จ่ายวันนี้ (DISPENSED TODAY)</th>
                <th style={{ textAlign: 'right' }}>การจัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filteredMedicines.map((med) => (
                <tr key={med.id}>
                  <td className="med-id-cell">{med.id}</td>
                  <td 
                    className="med-name-cell clickable-med-name"
                    onClick={() => setDetailModalMed(med)}
                  >
                    <span className="med-name-link">💊 {med.name}</span>
                    <span className="med-hint-tag">คลิกเพื่อดูรายละเอียดสรรพคุณ 🔍</span>
                  </td>
                  <td className="stock-num-cell">{med.stock} เม็ด</td>
                  <td>
                    <span className={`status-badge ${getStatusClass(med.status)}`}>
                      {renderStatusText(med.status)}
                    </span>
                  </td>
                  <td className="dispensed-cell">{med.dispensedToday} เม็ด</td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="update-stock-btn"
                      onClick={() => handleUpdateClick(med)}
                    >
                      ปรับสต็อก
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pagination-bar">
          <span className="pagination-info">แสดง {medicines.length} รายการ</span>
          <div className="pagination-buttons">
            <button className="page-arrow" disabled>&lt;</button>
            <button className="page-num active">1</button>
            <button className="page-arrow" disabled>&gt;</button>
          </div>
        </div>
      </div>

      {/* Stock Adjustment Modal */}
      {isModalOpen && selectedMedicine && (
        <div className="modal-overlay">
          <div className="modal-card card">
            <div className="modal-header">
              <h3 className="modal-title">ปรับปรุงสต็อกยา - {selectedMedicine.name}</h3>
              <button className="close-btn" onClick={handleCloseModal}>✕</button>
            </div>

            <div className="modal-body">
              <p className="current-stock-text">
                จำนวนคงเหลือปัจจุบัน: <strong>{selectedMedicine.stock} เม็ด</strong>
              </p>

              <div className="mode-selector">
                <button
                  className={`mode-btn ${updateMode === 'add' ? 'active-add' : ''}`}
                  onClick={() => setUpdateMode('add')}
                >
                  + เพิ่มสต็อก (รับเข้า)
                </button>
                <button
                  className={`mode-btn ${updateMode === 'reduce' ? 'active-reduce' : ''}`}
                  onClick={() => setUpdateMode('reduce')}
                >
                  - ลดสต็อก (จ่าย/เบิก)
                </button>
              </div>

              <div className="input-group" style={{ marginTop: '16px' }}>
                <label>จำนวนที่ต้องการ{updateMode === 'add' ? 'เพิ่ม' : 'ลด'} (เม็ด)</label>
                <input
                  type="number"
                  min="1"
                  placeholder="กรอกจำนวนตัวเลข..."
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>

              {quantity !== '' && Number(quantity) > 0 && !isReduceInvalid && (
                <div style={{ marginTop: '12px', fontSize: '13.5px', background: 'var(--preview-bg, #F8FAFC)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--preview-border, #E2E8F0)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--preview-text, #475569)' }}>ยอดคงเหลือใหม่หลังปรับปรุง:</span>
                    <strong style={{ color: updateMode === 'add' ? '#166534' : '#B45309', fontSize: '16px' }}>
                      {updateMode === 'add' ? selectedMedicine.stock + Number(quantity) : selectedMedicine.stock - Number(quantity)} เม็ด
                    </strong>
                  </div>
                </div>
              )}

              {isReduceInvalid && (
                <p className="error-text">
                  ⚠ ไม่สามารถลดจำนวนเกินกว่าสต็อกที่มีอยู่ ({selectedMedicine.stock} เม็ด) ได้
                </p>
              )}
            </div>

            <div className="modal-footer">
              <button className="cancel-btn" onClick={handleCloseModal}>ยกเลิก</button>
              <button
                className="save-btn"
                disabled={quantity === '' || quantity <= 0 || Boolean(isReduceInvalid)}
                onClick={handleSaveChanges}
              >
                บันทึกการเปลี่ยนแปลง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Medicine Info Detail Modal */}
      {detailModalMed && (
        <div className="modal-overlay" onClick={() => setDetailModalMed(null)}>
          <div className="med-detail-modal-card card" onClick={(e) => e.stopPropagation()}>
            <div className="med-detail-header">
              <div className="med-detail-title-box">
                <span className="med-detail-badge">💊 รายละเอียดตัวยาและสรรพคุณ</span>
                <h2 className="med-detail-name">{detailModalMed.name}</h2>
                <span className="med-detail-generic">ชื่อสามัญทางยา: {detailModalMed.genericName} (รหัส: {detailModalMed.id})</span>
              </div>
              <button className="close-btn" onClick={() => setDetailModalMed(null)}>✕</button>
            </div>

            <div className="med-detail-body">
              <div className="med-info-section category-section">
                <span className="info-label">หมวดยา:</span>
                <span className="info-value category-tag">{detailModalMed.category}</span>
              </div>

              <div className="med-info-grid">
                <div className="med-info-box">
                  <h4 className="info-box-title">✨ สรรพคุณและข้อบ่งใช้</h4>
                  <p className="info-box-desc">{detailModalMed.properties}</p>
                </div>

                <div className="med-info-box">
                  <h4 className="info-box-title">📋 ขนาดและวิธีรับประทาน</h4>
                  <p className="info-box-desc">{detailModalMed.dosage}</p>
                </div>

                <div className="med-info-box warning-box">
                  <h4 className="info-box-title">⚠️ ข้อควรระวังและผลข้างเคียง</h4>
                  <p className="info-box-desc">{detailModalMed.precautions}</p>
                </div>

                <div className="med-info-box">
                  <h4 className="info-box-title">🏭 ผู้ผลิตและราคาจำหน่าย</h4>
                  <p className="info-box-desc">
                    ผู้ผลิต: {detailModalMed.manufacturer}<br />
                    ราคาจำหน่าย: <strong>{detailModalMed.price}</strong>
                  </p>
                </div>
              </div>

              <div className="med-stock-summary-bar">
                <div className="stock-stat-item">
                  <span className="stat-label">คงเหลือในคลัง:</span>
                  <span className="stat-val">{detailModalMed.stock} เม็ด</span>
                </div>
                <div className="stock-stat-item">
                  <span className="stat-label">จ่ายออกวันนี้:</span>
                  <span className="stat-val">{detailModalMed.dispensedToday} เม็ด</span>
                </div>
                <div className="stock-stat-item">
                  <span className="stat-label">สถานะสต็อก:</span>
                  <span className={`status-badge ${getStatusClass(detailModalMed.status)}`}>
                    {renderStatusText(detailModalMed.status)}
                  </span>
                </div>
              </div>
            </div>

            <div className="med-detail-footer">
              <button className="primary-btn-close" onClick={() => setDetailModalMed(null)}>
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
