import { useState, useEffect, useCallback } from 'react';
import './MedicinePage.css';
import { useWebSocket } from '../../context/WebSocketContext';

interface Medicine {
  id: string;
  medicine_code: string;
  name: string;
  genericName: string;
  category: string;
  properties: string;
  dosage: string;
  precautions: string;
  price: string;
  unit_price: number;
  manufacturer: string;
  stock: number;
  stock_quantity: number;
  status: 'In Stock' | 'Low Stock' | 'Out of Stock';
  dispensedToday: number;
}

export default function MedicinePage() {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const { isConnected, subscribe } = useWebSocket();

  const [searchMedId, setSearchMedId] = useState('');
  const [searchMedName, setSearchMedName] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'in-stock' | 'low-stock' | 'out-of-stock'>('all');
  
  const [showSuccessBadge, setShowSuccessBadge] = useState(false);
  const [isStockTableExpanded, setIsStockTableExpanded] = useState(true);

  // Sync with Backend API
  const fetchMedicines = useCallback(() => {
    const token = localStorage.getItem('token') || localStorage.getItem('clinic_auth_token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const processMedicinesData = (data: any) => {
      if (data?.medicines && Array.isArray(data.medicines) && data.medicines.length > 0) {
        const formatted: Medicine[] = data.medicines.map((m: any) => {
          const stock = m.stock_quantity ?? 0;
          let status: 'In Stock' | 'Low Stock' | 'Out of Stock' = 'In Stock';
          if (stock === 0) status = 'Out of Stock';
          else if (stock < 50) status = 'Low Stock';

          return {
            id: m.medicine_code || `MED-${m.id}`,
            medicine_code: m.medicine_code || `MED-${m.id}`,
            name: m.name,
            genericName: m.generic_name || m.name,
            category: m.category || 'ยารักษาโรคทั่วไป',
            properties: m.properties || 'ยารักษาโรคและบรรเทาอาการตามแพทย์สั่ง',
            dosage: m.dosage || 'ทานตามแพทย์สั่งอย่างเคร่งครัด',
            precautions: 'ระวังการใช้ในผู้แพ้ยาหรือมีโรคประจำตัว',
            price: `฿ ${(m.unit_price || 0).toFixed(2)}`,
            unit_price: m.unit_price || 0,
            manufacturer: m.manufacturer || 'บริษัท เภสัชกรรม จำกัด',
            stock: stock,
            stock_quantity: stock,
            status: status,
            dispensedToday: 0,
          };
        });
        setMedicines(formatted);
        return true;
      }
      return false;
    };

    fetch('/api/pharmacy/medicines', { headers })
      .then(res => {
        if (!res.ok) throw new Error('Auth or API error');
        return res.json();
      })
      .then(data => {
        if (!processMedicinesData(data)) {
          // Fallback to system endpoint
          fetch('/api/system/medicines')
            .then(res => res.json())
            .then(sysData => processMedicinesData(sysData))
            .catch(err => console.error('Fallback fetch medicines failed:', err));
        }
      })
      .catch(() => {
        // Fallback to system endpoint on 401 or network error
        fetch('/api/system/medicines')
          .then(res => res.json())
          .then(sysData => processMedicinesData(sysData))
          .catch(err => console.error('Fallback fetch medicines failed:', err));
      });
  }, []);

  useEffect(() => {
    fetchMedicines();

    // Real-time WebSocket Listeners
    const unsubStock = subscribe('MEDICINE_STOCK_UPDATED', () => {
      fetchMedicines();
      setShowSuccessBadge(true);
      setTimeout(() => setShowSuccessBadge(false), 3000);
    });
    const unsubDispense = subscribe('DISPENSE_RECORDED', () => {
      fetchMedicines();
    });

    return () => {
      unsubStock();
      unsubDispense();
    };
  }, [fetchMedicines, subscribe]);

  // Extract unique categories
  const categories = Array.from(new Set(medicines.map(m => m.category).filter(Boolean)));
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(null);
  const [detailModalMed, setDetailModalMed] = useState<Medicine | null>(null);

  // Add Medicine Form state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addMedCode, setAddMedCode] = useState('');
  const [addMedName, setAddMedName] = useState('');
  const [addGenericName, setAddGenericName] = useState('');
  const [addCategory, setAddCategory] = useState('ยารักษาโรคทั่วไป');
  const [addProperties, setAddProperties] = useState('');
  const [addDosage, setAddDosage] = useState('');
  const [addManufacturer, setAddManufacturer] = useState('');
  const [addStock, setAddStock] = useState<number | ''>(100);
  const [addUnitPrice, setAddUnitPrice] = useState<number | ''>(20);

  // Delete Confirmation state
  const [deleteConfirmMed, setDeleteConfirmMed] = useState<Medicine | null>(null);

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

  // Add Medicine Handler
  const handleAddMedicineSubmit = () => {
    if (!addMedName.trim()) return;

    const payload = {
      medicine_code: addMedCode.trim() || undefined,
      name: addMedName.trim(),
      generic_name: addGenericName.trim() || addMedName.trim(),
      category: addCategory.trim() || 'ยารักษาโรคทั่วไป',
      properties: addProperties.trim() || 'บรรเทาอาการตามแพทย์สั่ง',
      dosage: addDosage.trim() || 'ทานตามแพทย์สั่งอย่างเคร่งครัด',
      manufacturer: addManufacturer.trim() || 'บริษัท เภสัชกรรม จำกัด',
      stock_quantity: Number(addStock) || 0,
      unit_price: Number(addUnitPrice) || 0
    };

    const token = localStorage.getItem('token') || localStorage.getItem('clinic_auth_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    fetch('/api/pharmacy/medicines', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    })
    .then(res => {
      if (!res.ok) throw new Error('Primary API failed');
      return res.json();
    })
    .then(() => {
      fetchMedicines();
      setShowSuccessBadge(true);
      setTimeout(() => setShowSuccessBadge(false), 3000);
    })
    .catch(() => {
      // Fallback to system endpoint
      fetch('/api/system/medicines/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      .then(() => {
        fetchMedicines();
        setShowSuccessBadge(true);
        setTimeout(() => setShowSuccessBadge(false), 3000);
      });
    });

    setIsAddModalOpen(false);
    setAddMedCode('');
    setAddMedName('');
    setAddGenericName('');
    setAddCategory('ยารักษาโรคทั่วไป');
    setAddProperties('');
    setAddDosage('');
    setAddManufacturer('');
    setAddStock(100);
    setAddUnitPrice(20);
  };

  // Delete Medicine Handler
  const handleConfirmDelete = () => {
    if (!deleteConfirmMed) return;

    const targetCode = deleteConfirmMed.medicine_code || deleteConfirmMed.id;

    setMedicines(prev => prev.filter(m => m.id !== deleteConfirmMed.id && m.medicine_code !== deleteConfirmMed.medicine_code));

    const token = localStorage.getItem('token') || localStorage.getItem('clinic_auth_token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    fetch(`/api/pharmacy/medicines/${encodeURIComponent(targetCode)}`, {
      method: 'DELETE',
      headers
    })
    .then(res => {
      if (!res.ok) throw new Error('Primary delete failed');
      fetchMedicines();
    })
    .catch(() => {
      fetch(`/api/system/medicines/${encodeURIComponent(targetCode)}`, {
        method: 'DELETE'
      }).then(() => fetchMedicines());
    });

    setDeleteConfirmMed(null);
    setShowSuccessBadge(true);
    setTimeout(() => setShowSuccessBadge(false), 3000);
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
    
    // Sync update to backend API if needed
    fetch('/api/pharmacy/medicines/stock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        medicine_code: selectedMedicine.medicine_code || selectedMedicine.id,
        action: updateMode,
        quantity: qty
      })
    }).catch(() => {});

    handleCloseModal();
    setShowSuccessBadge(true);
    setTimeout(() => setShowSuccessBadge(false), 3000);
  };

  const filteredMedicines = medicines.filter(med => {
    const rawIdQuery = searchMedId.trim().toLowerCase();
    let matchId = !rawIdQuery;
    if (rawIdQuery) {
      const codeStr = (med.medicine_code || med.id).toLowerCase();
      const codeDigits = codeStr.replace(/\D/g, '');
      const queryDigits = rawIdQuery.replace(/\D/g, '');

      matchId = codeStr.includes(rawIdQuery) || 
        (queryDigits !== '' && (
          codeDigits.includes(queryDigits) || 
          (parseInt(codeDigits, 10) > 0 && parseInt(codeDigits, 10) === parseInt(queryDigits, 10))
        ));
    }

    const matchName = !searchMedName.trim() || 
      med.name.toLowerCase().includes(searchMedName.trim().toLowerCase()) ||
      med.genericName.toLowerCase().includes(searchMedName.trim().toLowerCase());
      
    let matchCategory = true;
    if (categoryFilter !== 'all') {
      matchCategory = med.category.toLowerCase().includes(categoryFilter.toLowerCase());
    }

    let matchStatus = true;
    if (stockStatusFilter === 'in-stock') matchStatus = med.status === 'In Stock';
    else if (stockStatusFilter === 'low-stock') matchStatus = med.status === 'Low Stock';
    else if (stockStatusFilter === 'out-of-stock') matchStatus = med.status === 'Out of Stock';

    return matchId && matchName && matchCategory && matchStatus;
  });
  
  const handleResetFilters = () => {
    setSearchMedId('');
    setSearchMedName('');
    setCategoryFilter('all');
    setStockStatusFilter('all');
  };

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
      case 'In Stock': return 'มีในคลัง';
      case 'Low Stock': return 'ใกล้หมด';
      case 'Out of Stock': return 'หมดคลัง';
      default: return status;
    }
  };

  const isReduceInvalid = selectedMedicine && updateMode === 'reduce' && quantity !== '' && Number(quantity) > selectedMedicine.stock;

  return (
    <div className="medicine-page-container">
      <div className="page-header" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', textAlign: 'left', width: '100%' }}>
        <div className="header-titles" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h1 className="page-title" style={{ margin: 0, fontSize: '28px', fontWeight: '800', color: 'var(--text-primary, #0F172A)', letterSpacing: '-0.5px' }}>
              รายการยา
            </h1>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '4px 12px', borderRadius: '16px', fontSize: '12px', fontWeight: '600',
              background: isConnected ? '#DCFCE7' : '#FEE2E2',
              color: isConnected ? '#15803D' : '#B91C1C'
            }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: isConnected ? '#22C55E' : '#EF4444' }}></span>
              {isConnected ? 'Real-time WebSocket Live' : 'Offline / Polling'}
            </span>
          </div>
          <p className="page-subtitle" style={{ marginTop: '6px', fontSize: '14.5px', color: 'var(--text-secondary, #64748B)', textAlign: 'left' }}>
            ค้นหาและจัดการระบบสินค้าคงคลัง คัดกรองยาใกล้หมด และเติมสต็อกยา (อัปเดตอัตโนมัติแบบ Real-time)
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          style={{
            padding: '10px 20px', borderRadius: '10px',
            background: '#16A34A', color: '#FFFFFF', border: 'none',
            fontSize: '14.5px', fontWeight: '700', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            boxShadow: '0 2px 8px rgba(22, 163, 74, 0.25)', transition: 'all 0.2s ease'
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          + เพิ่มรายการยาใหม่
        </button>
      </div>

      {/* Stock Inventory Executive Stat Block Cards (Image 2 Pattern) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div 
          className={`stat-card-box ${stockStatusFilter === 'all' ? 'active-stat' : ''}`}
          onClick={() => setStockStatusFilter('all')}
          style={{
            borderRadius: '14px', padding: '18px 20px',
            border: stockStatusFilter === 'all' ? '2px solid #2563EB' : '1.5px solid #E2E8F0',
            boxShadow: stockStatusFilter === 'all' ? '0 0 0 2px rgba(37, 99, 235, 0.16)' : '0 1px 3px rgba(0,0,0,0.04)',
            cursor: 'pointer', transition: 'all 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontWeight: '600', fontSize: '15px', color: '#475569' }}>รายการยาทั้งหมดในคลัง</span>
            <div className="stat-icon-wrap icon-blue">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
            </div>
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#0F172A', lineHeight: '38px' }}>{medicines.length} <span style={{ fontSize: '14px', color: '#64748B', fontWeight: '500' }}>ชนิด</span></div>
          <div style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>รายการยาส่งมอบคลังทั้งหมด</div>
        </div>

        <div 
          className={`stat-card-box ${stockStatusFilter === 'in-stock' ? 'active-stat' : ''}`}
          onClick={() => setStockStatusFilter('in-stock')}
          style={{
            borderRadius: '14px', padding: '18px 20px',
            border: stockStatusFilter === 'in-stock' ? '2px solid #10B981' : '1.5px solid #E2E8F0',
            boxShadow: stockStatusFilter === 'in-stock' ? '0 0 0 2px rgba(16, 185, 129, 0.16)' : '0 1px 3px rgba(0,0,0,0.04)',
            cursor: 'pointer', transition: 'all 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontWeight: '600', fontSize: '15px', color: '#475569' }}>ยาในคลังปกติ</span>
            <div className="stat-icon-wrap icon-green">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#16A34A', lineHeight: '38px' }}>
            {medicines.filter(m => m.status === 'In Stock').length} <span style={{ fontSize: '14px', color: '#64748B', fontWeight: '500' }}>ชนิด</span>
          </div>
          <div style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>มีสต็อกเพียงพอจ่ายให้ผู้ป่วย</div>
        </div>

        <div 
          className={`stat-card-box ${stockStatusFilter === 'low-stock' ? 'active-stat' : ''}`}
          onClick={() => setStockStatusFilter('low-stock')}
          style={{
            borderRadius: '14px', padding: '18px 20px',
            border: stockStatusFilter === 'low-stock' ? '2px solid #D97706' : '1.5px solid #E2E8F0',
            boxShadow: stockStatusFilter === 'low-stock' ? '0 0 0 2px rgba(217, 119, 6, 0.16)' : '0 1px 3px rgba(0,0,0,0.04)',
            cursor: 'pointer', transition: 'all 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontWeight: '600', fontSize: '15px', color: '#475569' }}>ยาใกล้หมด / เติมยา</span>
            <div className="stat-icon-wrap icon-amber">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 16 14"/></svg>
            </div>
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#D97706', lineHeight: '38px' }}>
            {medicines.filter(m => m.status === 'Low Stock').length} <span style={{ fontSize: '14px', color: '#64748B', fontWeight: '500' }}>ชนิด</span>
          </div>
          <div style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>ต้องสั่งซื้อ / เติมสต็อกเพิ่ม</div>
        </div>

        <div 
          className={`stat-card-box ${stockStatusFilter === 'out-of-stock' ? 'active-stat' : ''}`}
          onClick={() => setStockStatusFilter('out-of-stock')}
          style={{
            borderRadius: '14px', padding: '18px 20px',
            border: stockStatusFilter === 'out-of-stock' ? '2px solid #DC2626' : '1.5px solid #E2E8F0',
            boxShadow: stockStatusFilter === 'out-of-stock' ? '0 0 0 2px rgba(220, 38, 38, 0.16)' : '0 1px 3px rgba(0,0,0,0.04)',
            cursor: 'pointer', transition: 'all 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontWeight: '600', fontSize: '15px', color: '#475569' }}>ยาหมดคลัง</span>
            <div className="stat-icon-wrap icon-red">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#DC2626', lineHeight: '38px' }}>
            {medicines.filter(m => m.status === 'Out of Stock').length} <span style={{ fontSize: '14px', color: '#64748B', fontWeight: '500' }}>ชนิด</span>
          </div>
          <div style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>หมดสต็อก! งดจ่ายชั่วคราว</div>
        </div>
      </div>

      <div className="search-card card">
        <div className="search-inputs">
          <div className="input-group">
            <label>รหัสยา</label>
            <input
              type="text"
              placeholder="เช่น 001, 231 หรือ MED-0231"
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
          <div className="input-group">
            <label>ชนิด / หมวดหมู่ยา</label>
            <select
              className="filter-select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{
                padding: '10px 14px', borderRadius: '8px',
                border: '1px solid #CBD5E1', background: 'var(--bg-card, #F8FAFC)',
                color: 'var(--text-primary, #0F172A)', fontSize: '14px'
              }}
            >
              <option value="all">ทั้งหมดทุกชนิด</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="search-btn" type="button">ค้นหา</button>
          {(searchMedId || searchMedName || stockStatusFilter !== 'all') && (
            <button 
              className="search-btn" 
              type="button" 
              onClick={handleResetFilters}
              style={{ background: 'var(--bg-card, #F1F5F9)', color: 'var(--text-primary, #475569)', border: '1px solid #CBD5E1' }}
            >
              ล้างการค้นหา
            </button>
          )}
        </div>
      </div>

      <div className="stock-table-card card" style={{ display: 'flex', flexDirection: 'column', width: '100%', padding: '0', marginBottom: '24px', transition: 'all 0.3s ease', overflow: 'hidden' }}>
        <div 
          className="collapsible-card-header"
          onClick={() => setIsStockTableExpanded(!isStockTableExpanded)}
          style={{ 
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
            padding: '18px 24px', borderBottom: isStockTableExpanded ? '1px solid #E2E8F0' : 'none',
            cursor: 'pointer', userSelect: 'none' 
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h3 className="card-header-title" style={{ margin: 0, fontSize: '16.5px', fontWeight: '700' }}>
              สถานะคลังยา & สรุปการจ่ายยาประจำวัน
            </h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {showSuccessBadge && (
              <span className="success-badge" style={{ background: '#DCFCE7', color: '#166534', fontWeight: 'bold', padding: '4px 12px', borderRadius: '16px', fontSize: '13px' }}>
                ✓ อัปเดตคลังยาเรียบร้อยแล้ว
              </span>
            )}
            <span style={{ background: '#DBEAFE', color: '#1E40AF', fontWeight: 'bold', padding: '4px 12px', borderRadius: '16px', fontSize: '13px' }}>
              {filteredMedicines.length} รายการ
            </span>
            <svg 
              width="18" height="18" viewBox="0 0 24 24" fill="none" 
              style={{ color: '#64748B', transform: isStockTableExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.25s ease', flexShrink: 0 }}
            >
              <path d="M19.5 8.25l-7.5 7.5-7.5-7.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        {isStockTableExpanded && (
          <>
            <div className="table-wrapper">
              <table className="stock-table">
                <thead>
                  <tr>
                    <th style={{ textAlign: 'center' }}>รหัสยา</th>
                    <th>ชื่อยา</th>
                    <th>ชนิด / หมวดหมู่ยา</th>
                    <th style={{ textAlign: 'center' }}>คงเหลือในคลัง</th>
                    <th style={{ textAlign: 'center' }}>สถานะคลังยา</th>
                    <th style={{ textAlign: 'center' }}>จ่ายวันนี้</th>
                    <th style={{ textAlign: 'right' }}>การจัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMedicines.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary, #64748B)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                          </svg>
                          <span style={{ fontSize: '16px', fontWeight: '600' }}>ไม่พบข้อมูลยาที่ตรงกับการค้นหา</span>
                          <span style={{ fontSize: '13.5px', opacity: 0.8 }}>ลองเปลี่ยนคำค้นหา หรือกดปุ่มล้างการค้นหาด้านบน</span>
                          <button 
                            type="button" 
                            onClick={handleResetFilters}
                            style={{
                              marginTop: '8px', padding: '8px 16px', borderRadius: '8px',
                              background: '#2563EB', color: '#FFFFFF', border: 'none',
                              fontWeight: '600', cursor: 'pointer'
                            }}
                          >
                            ล้างการค้นหาทั้งหมด
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredMedicines.map((med) => (
                      <tr key={med.id}>
                        <td style={{ padding: '14px 16px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <span style={{ 
                            color: '#2563EB', 
                            fontWeight: '700', 
                            fontFamily: 'monospace', 
                            fontSize: '14.5px',
                            letterSpacing: '0.3px',
                            display: 'inline-block'
                          }}>
                            {med.id}
                          </span>
                        </td>
                        <td 
                          className="med-name-cell clickable-med-name"
                          onClick={() => setDetailModalMed(med)}
                        >
                          <span className="med-name-link">{med.name}</span>
                          <span className="med-hint-tag">คลิกเพื่อดูรายละเอียดสรรพคุณ </span>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{ 
                            fontSize: '13px', 
                            padding: '4px 10px', 
                            borderRadius: '6px', 
                            background: 'var(--bg-card, #F1F5F9)', 
                            color: 'var(--text-primary, #334155)',
                            fontWeight: '500',
                            display: 'inline-block'
                          }}>
                            {med.category ? med.category.replace(/\s*\([^)]*\)/g, '').trim() : 'ยารักษาโรคทั่วไป'}
                          </span>
                        </td>
                        <td className="stock-num-cell" style={{ textAlign: 'center' }}>{med.stock} เม็ด</td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`status-badge ${getStatusClass(med.status)}`} style={{ display: 'inline-flex', justifyContent: 'center', alignItems: 'center', minWidth: '90px', textAlign: 'center' }}>
                            {renderStatusText(med.status)}
                          </span>
                        </td>
                        <td className="dispensed-cell" style={{ textAlign: 'center' }}>{med.dispensedToday} เม็ด</td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'inline-flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button
                              className="update-stock-btn"
                              onClick={() => handleUpdateClick(med)}
                            >
                              ปรับสต็อก
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmMed(med)}
                              style={{
                                padding: '6px 12px', borderRadius: '8px',
                                background: '#FEF2F2', color: '#DC2626', border: '1px solid #FCA5A5',
                                fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                                transition: 'all 0.2s ease'
                              }}
                              title="ลบรายการยานี้ออกจากคลัง"
                            >
                              ลบยา
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="pagination-bar">
              <span className="pagination-info">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, color: '#2563EB' }}>
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                </svg>
                แสดง 1 - {filteredMedicines.length} จากทั้งหมด <strong>{medicines.length}</strong> รายการ
              </span>
              <div className="pagination-buttons">
                <button className="page-arrow" disabled title="หน้าก่อนหน้า">‹</button>
                <button className="page-num active">1</button>
                <button className="page-arrow" disabled title="หน้าถัดไป">›</button>
              </div>
            </div>
          </>
        )}
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
                <span className="med-detail-badge">รายละเอียดตัวยาและสรรพคุณ</span>
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
                  <h4 className="info-box-title">สรรพคุณและข้อบ่งใช้</h4>
                  <p className="info-box-desc">{detailModalMed.properties}</p>
                </div>

                <div className="med-info-box">
                  <h4 className="info-box-title">ขนาดและวิธีรับประทาน</h4>
                  <p className="info-box-desc">{detailModalMed.dosage}</p>
                </div>

                <div className="med-info-box warning-box">
                  <h4 className="info-box-title">⚠️ ข้อควรระวังและผลข้างเคียง</h4>
                  <p className="info-box-desc">{detailModalMed.precautions}</p>
                </div>

                <div className="med-info-box">
                  <h4 className="info-box-title">ผู้ผลิตและราคาจำหน่าย</h4>
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

      {/* Add New Medicine Modal */}
      {isAddModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card card" style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <h3 className="modal-title">+ เพิ่มรายการยาใหม่เข้าคลัง</h3>
              <button className="close-btn" onClick={() => setIsAddModalOpen(false)}>✕</button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '70vh', overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="input-group">
                  <label style={{ fontSize: '13px', fontWeight: '600' }}>รหัสยา (Medicine Code)</label>
                  <input
                    type="text"
                    placeholder="เช่น MED-013 (ว่างไว้ให้ระบบสร้างให้)"
                    value={addMedCode}
                    onChange={(e) => setAddMedCode(e.target.value)}
                  />
                </div>
                <div className="input-group">
                  <label style={{ fontSize: '13px', fontWeight: '600' }}>ชื่อยา * (Trade Name)</label>
                  <input
                    type="text"
                    placeholder="เช่น Paracetamol 500mg"
                    value={addMedName}
                    onChange={(e) => setAddMedName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="input-group">
                  <label style={{ fontSize: '13px', fontWeight: '600' }}>ชื่อสามัญทางยา (Generic Name)</label>
                  <input
                    type="text"
                    placeholder="เช่น Acetaminophen"
                    value={addGenericName}
                    onChange={(e) => setAddGenericName(e.target.value)}
                  />
                </div>
                <div className="input-group">
                  <label style={{ fontSize: '13px', fontWeight: '600' }}>ชนิด / หมวดหมู่ยา</label>
                  <input
                    type="text"
                    placeholder="เช่น ยาลดไข้ บรรเทาปวด"
                    value={addCategory}
                    onChange={(e) => setAddCategory(e.target.value)}
                  />
                </div>
              </div>

              <div className="input-group">
                <label style={{ fontSize: '13px', fontWeight: '600' }}>สรรพคุณและข้อบ่งใช้ (Properties)</label>
                <input
                  type="text"
                  placeholder="เช่น บรรเทาอาการปวดและลดไข้"
                  value={addProperties}
                  onChange={(e) => setAddProperties(e.target.value)}
                />
              </div>

              <div className="input-group">
                <label style={{ fontSize: '13px', fontWeight: '600' }}>ขนาดและวิธีรับประทาน (Dosage)</label>
                <input
                  type="text"
                  placeholder="เช่น ครั้งละ 1-2 เม็ด ทุก 4-6 ชั่วโมง"
                  value={addDosage}
                  onChange={(e) => setAddDosage(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div className="input-group">
                  <label style={{ fontSize: '13px', fontWeight: '600' }}>จำนวนรับเข้า (เม็ด)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="100"
                    value={addStock}
                    onChange={(e) => setAddStock(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </div>
                <div className="input-group">
                  <label style={{ fontSize: '13px', fontWeight: '600' }}>ราคา/หน่วย (บาท)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="20"
                    value={addUnitPrice}
                    onChange={(e) => setAddUnitPrice(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </div>
                <div className="input-group">
                  <label style={{ fontSize: '13px', fontWeight: '600' }}>ผู้ผลิต/บริษัท</label>
                  <input
                    type="text"
                    placeholder="เช่น สยามเภสัช"
                    value={addManufacturer}
                    onChange={(e) => setAddManufacturer(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ marginTop: '16px' }}>
              <button className="cancel-btn" onClick={() => setIsAddModalOpen(false)}>ยกเลิก</button>
              <button
                className="save-btn"
                disabled={!addMedName.trim()}
                onClick={handleAddMedicineSubmit}
                style={{ background: '#16A34A' }}
              >
                + เพิ่มรายการยาเข้าคลัง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmMed && (
        <div className="modal-overlay">
          <div className="modal-card card" style={{ maxWidth: '420px', textAlign: 'center' }}>
            <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#FEE2E2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0F172A' }}>
                ยืนยันการลบรายการยา
              </h3>
              <p style={{ margin: 0, fontSize: '14px', color: '#64748B', lineHeight: '1.5' }}>
                คุณต้องการลบยา <strong style={{ color: '#0F172A' }}>{deleteConfirmMed.name}</strong> ({deleteConfirmMed.medicine_code || deleteConfirmMed.id}) ออกจากฐานข้อมูลคลังยาใช่หรือไม่?
              </p>
            </div>
            <div className="modal-footer" style={{ justifyContent: 'center', gap: '12px', background: '#F8FAFC', padding: '16px 20px', borderRadius: '0 0 12px 12px' }}>
              <button className="cancel-btn" onClick={() => setDeleteConfirmMed(null)}>ยกเลิก</button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                style={{
                  padding: '10px 20px', borderRadius: '8px',
                  background: '#DC2626', color: '#FFFFFF', border: 'none',
                  fontSize: '14px', fontWeight: '700', cursor: 'pointer'
                }}
              >
                ยืนยันการลบยา
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
