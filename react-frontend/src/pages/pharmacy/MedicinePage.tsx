import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import './MedicinePage.css';
import { useWebSocket } from '../../context/WebSocketContext';
import CopyableText from '../../components/Common/CopyableText';

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

// Custom Modern Category Dropdown that ALWAYS opens downwards with modern UI and high-contrast typography
function ModernCategoryDropdown({
  value,
  onChange,
  categories,
  onAddNewCategory,
  placeholder = 'เลือกชนิด / หมวดหมู่ยา'
}: {
  value: string;
  onChange: (cat: string) => void;
  categories: string[];
  onAddNewCategory: (newCat: string) => void;
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsAddingNew(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (cat: string) => {
    onChange(cat);
    setIsOpen(false);
    setIsAddingNew(false);
  };

  const handleConfirmAddNew = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newCatName.trim();
    if (trimmed) {
      onAddNewCategory(trimmed);
      onChange(trimmed);
      setNewCatName('');
      setIsAddingNew(false);
      setIsOpen(false);
    }
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative', width: '100%', userSelect: 'none' }}>
      {/* Modern Trigger Button */}
      <div
        onClick={() => {
          setIsOpen(!isOpen);
          setIsAddingNew(false);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '9px 14px',
          background: '#FFFFFF',
          border: isOpen ? '1.5px solid #2563EB' : '1.5px solid #CBD5E1',
          boxShadow: isOpen ? '0 0 0 3px rgba(37, 99, 235, 0.12)' : 'none',
          borderRadius: '9px',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          fontSize: '13.5px',
          color: value ? '#0F172A' : '#64748B',
          fontWeight: value ? '600' : '400',
          boxSizing: 'border-box'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
            <line x1="7" y1="7" x2="7.01" y2="7"></line>
          </svg>
          <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            {value || placeholder}
          </span>
        </div>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#475569"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
            flexShrink: 0,
            marginLeft: '8px'
          }}
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>

      {/* Downward Dropdown Menu - Always drops below */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            background: '#FFFFFF',
            borderRadius: '10px',
            border: '1.5px solid #CBD5E1',
            boxShadow: '0 12px 28px -4px rgba(15, 23, 42, 0.18), 0 4px 12px rgba(15, 23, 42, 0.08)',
            zIndex: 9999,
            overflow: 'hidden'
          }}
        >
          {/* Header of Dropdown with clear font */}
          <div
            style={{
              padding: '8px 14px',
              background: '#F1F5F9',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#1E293B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              หมวดหมู่ยาในระบบ (คลิกเลือก)
            </span>
            {!isAddingNew && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsAddingNew(true);
                }}
                style={{
                  background: '#EFF6FF',
                  border: '1px solid #BFDBFE',
                  color: '#2563EB',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  transition: 'all 0.15s ease'
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                + เพิ่มหมวดใหม่
              </button>
            )}
          </div>

          {/* Add New Category Inline Form */}
          {isAddingNew && (
            <div style={{ padding: '10px 12px', background: '#EFF6FF', borderBottom: '1px solid #BFDBFE' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#1D4ED8', marginBottom: '6px' }}>
                พิมพ์ชื่อหมวดหมู่ยาใหม่:
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  type="text"
                  placeholder="เช่น ยาเพิ่มพลัง..."
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleConfirmAddNew();
                    }
                  }}
                  autoFocus
                  style={{
                    flex: 1,
                    padding: '7px 10px',
                    borderRadius: '6px',
                    border: '1.5px solid #2563EB',
                    fontSize: '13px',
                    background: '#FFFFFF',
                    color: '#0F172A',
                    fontWeight: '600',
                    outline: 'none'
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleConfirmAddNew()}
                  style={{
                    padding: '0 14px',
                    background: '#2563EB',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: '700',
                    fontSize: '12.5px',
                    cursor: 'pointer'
                  }}
                >
                  บันทึก
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingNew(false)}
                  style={{
                    padding: '0 8px',
                    background: '#E2E8F0',
                    color: '#475569',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  ยกเลิก
                </button>
              </div>
            </div>
          )}

          {/* Category List Items - Scrollable */}
          <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
            {categories.map((cat: string, idx: number) => {
              const isSelected = cat === value;
              return (
                <div
                  key={idx}
                  onClick={() => handleSelect(cat)}
                  style={{
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    background: isSelected ? '#EFF6FF' : '#FFFFFF',
                    color: isSelected ? '#1D4ED8' : '#0F172A',
                    fontWeight: isSelected ? '700' : '600',
                    fontSize: '13.5px',
                    borderBottom: '1px solid #F1F5F9',
                    transition: 'all 0.12s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = '#F8FAFC';
                      e.currentTarget.style.color = '#2563EB';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = '#FFFFFF';
                      e.currentTarget.style.color = '#0F172A';
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        background: isSelected ? '#2563EB' : '#94A3B8',
                        flexShrink: 0
                      }}
                    />
                    <span>{cat}</span>
                  </div>
                  {isSelected && (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Modern Dropdown to select/search medicine to edit by Code or Name
function MedicineSelectorDropdown({
  medicines,
  currentMed,
  onSelect
}: {
  medicines: Medicine[];
  currentMed: Medicine;
  onSelect: (med: Medicine) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return medicines;
    return medicines.filter(m =>
      (m.id && m.id.toLowerCase().includes(q)) ||
      (m.medicine_code && m.medicine_code.toLowerCase().includes(q)) ||
      (m.name && m.name.toLowerCase().includes(q)) ||
      (m.genericName && m.genericName.toLowerCase().includes(q))
    );
  }, [medicines, search]);

  return (
    <div ref={dropdownRef} style={{ position: 'relative', width: '100%', marginBottom: '14px' }}>
      <label style={{ fontSize: '13px', fontWeight: '700', color: '#1E293B', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        เลือกหรือค้นหายาที่ต้องการแก้ไข (ตามรหัสยา / ชื่อยา)
      </label>

      {/* Selector Trigger Button */}
      <div
        onClick={() => setIsOpen(prev => !prev)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '9px 14px',
          background: '#F8FAFC',
          border: '1.5px solid #2563EB',
          borderRadius: '8px',
          cursor: 'pointer',
          boxShadow: isOpen ? '0 0 0 3px rgba(37, 99, 235, 0.15)' : 'none',
          transition: 'all 0.15s ease'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
          <span style={{ 
            background: '#2563EB', color: '#FFFFFF', fontSize: '11.5px', fontWeight: '800', 
            padding: '2px 8px', borderRadius: '6px', fontFamily: 'monospace', letterSpacing: '0.5px' 
          }}>
            {currentMed.medicine_code || currentMed.id}
          </span>
          <span style={{ fontSize: '14px', fontWeight: '700', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {currentMed.name}
          </span>
          {currentMed.category && (
            <span style={{ fontSize: '12px', color: '#64748B' }}>
              ({currentMed.category.replace(/\s*\([^)]*\)/g, '').trim()})
            </span>
          )}
        </div>

        <svg 
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2.5" 
          strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease', flexShrink: 0 }}
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>

      {/* Downward Dropdown Menu */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            background: '#FFFFFF',
            borderRadius: '10px',
            border: '1.5px solid #CBD5E1',
            boxShadow: '0 12px 28px -4px rgba(15, 23, 42, 0.18), 0 4px 10px -2px rgba(15, 23, 42, 0.08)',
            zIndex: 99999,
            overflow: 'hidden'
          }}
        >
          {/* Search Box */}
          <div style={{ padding: '8px 10px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2.5" style={{ position: 'absolute', left: '10px' }}>
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input
                type="text"
                placeholder="พิมพ์ค้นหารหัสยา (เช่น MED-001) หรือชื่อยา..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: '100%', padding: '7px 10px 7px 32px', borderRadius: '6px',
                  border: '1.5px solid #CBD5E1', fontSize: '13px', outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              {search && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setSearch(''); }}
                  style={{ position: 'absolute', right: '8px', background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: '14px' }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Medicines List */}
          <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
                ไม่พบรายการยาที่ตรงกับ "{search}"
              </div>
            ) : (
              filtered.map((med) => {
                const isSelected = med.id === currentMed.id;
                return (
                  <div
                    key={med.id}
                    onClick={() => {
                      onSelect(med);
                      setIsOpen(false);
                      setSearch('');
                    }}
                    style={{
                      padding: '9px 14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: isSelected ? '#EFF6FF' : '#FFFFFF',
                      borderBottom: '1px solid #F1F5F9',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = '#F8FAFC';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = '#FFFFFF';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        background: isSelected ? '#1D4ED8' : '#F1F5F9',
                        color: isSelected ? '#FFFFFF' : '#334155',
                        fontSize: '11px',
                        fontWeight: '800',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontFamily: 'monospace'
                      }}>
                        {med.medicine_code || med.id}
                      </span>
                      <span style={{ fontSize: '13.5px', fontWeight: isSelected ? '700' : '600', color: isSelected ? '#1D4ED8' : '#0F172A' }}>
                        {med.name}
                      </span>
                      {med.category && (
                        <span style={{ fontSize: '12px', color: '#64748B' }}>
                          • {med.category.replace(/\s*\([^)]*\)/g, '').trim()}
                        </span>
                      )}
                    </div>

                    {isSelected && (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1D4ED8" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function MedicinePage() {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const { isConnected, subscribe } = useWebSocket();

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'in-stock' | 'low-stock' | 'out-of-stock'>('all');
  
  const [showSuccessBadge, setShowSuccessBadge] = useState(false);
  const [successBadgeText, setSuccessBadgeText] = useState('✓ อัปเดตคลังยาเรียบร้อยแล้ว');
  const [isStockTableExpanded, setIsStockTableExpanded] = useState(true);

  const triggerSuccessBadge = (msg: string) => {
    setSuccessBadgeText(msg);
    setShowSuccessBadge(true);
    setTimeout(() => setShowSuccessBadge(false), 3500);
  };

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

  // Custom Categories state with localStorage persistence
  const [customCategories, setCustomCategories] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('clinic_custom_categories');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const allAvailableCategories: string[] = useMemo<string[]>(() => {
    const fromMeds = medicines.map(m => m.category).filter(Boolean);
    const defaults = [
      'ยารักษาโรคทั่วไป',
      'ยาปฏิชีวนะ ฆ่าเชื้อแบคทีเรีย',
      'ยาลดไข้ บรรเทาปวด',
      'ยาแก้แพ้ ลดน้ำมูก',
      'ยาลดกรด เคลือบกระเพาะ',
      'ยาแก้อักเสบ กล้ามเนื้อ',
      'ยาวิตามินและอาหารเสริม'
    ];
    return Array.from(new Set([...fromMeds, ...customCategories, ...defaults]));
  }, [medicines, customCategories]);

  const handleAddNewCategory = (newCat: string) => {
    const trimmed = newCat.trim();
    if (!trimmed) return;
    setCustomCategories(prev => {
      if (prev.includes(trimmed)) return prev;
      const updated = [...prev, trimmed];
      try {
        localStorage.setItem('clinic_custom_categories', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(null);
  const [detailModalMed, setDetailModalMed] = useState<Medicine | null>(null);

  // Edit Detail Modal state
  const [isEditingDetailMed, setIsEditingDetailMed] = useState(false);
  const [detailEditForm, setDetailEditForm] = useState({
    name: '',
    genericName: '',
    category: '',
    properties: '',
    dosage: '',
    precautions: '',
    manufacturer: '',
    unitPrice: 0,
    stock: 0
  });
  const [isSavingDetailMed, setIsSavingDetailMed] = useState(false);

  const handleOpenEditDetailMed = () => {
    if (!detailModalMed) return;
    const cleanPrice = typeof detailModalMed.unit_price === 'number' 
      ? detailModalMed.unit_price 
      : (parseFloat(String(detailModalMed.price).replace(/[^0-9.]/g, '')) || 0);

    setDetailEditForm({
      name: detailModalMed.name,
      genericName: detailModalMed.genericName,
      category: detailModalMed.category,
      properties: detailModalMed.properties,
      dosage: detailModalMed.dosage,
      precautions: detailModalMed.precautions || 'ระวังการใช้ในผู้แพ้ยาหรือมีโรคประจำตัว',
      manufacturer: detailModalMed.manufacturer,
      unitPrice: cleanPrice,
      stock: detailModalMed.stock
    });
    setIsEditingDetailMed(true);
  };

  const handleOpenEditDetailMedDirect = (med: Medicine) => {
    const cleanPrice = typeof med.unit_price === 'number' 
      ? med.unit_price 
      : (parseFloat(String(med.price).replace(/[^0-9.]/g, '')) || 0);

    setDetailModalMed(med);
    setDetailEditForm({
      name: med.name,
      genericName: med.genericName,
      category: med.category || 'ยารักษาโรคทั่วไป',
      properties: med.properties || '',
      dosage: med.dosage || '',
      precautions: med.precautions || 'ระวังการใช้ในผู้แพ้ยาหรือมีโรคประจำตัว',
      manufacturer: med.manufacturer || 'บริษัท เภสัชกรรม จำกัด',
      unitPrice: cleanPrice,
      stock: med.stock
    });
    setIsEditingDetailMed(true);
  };

  const handleSaveDetailMedEdit = async () => {
    if (!detailModalMed) return;
    setIsSavingDetailMed(true);

    const payload = {
      name: detailEditForm.name.trim(),
      generic_name: detailEditForm.genericName.trim(),
      category: detailEditForm.category.trim(),
      properties: detailEditForm.properties.trim(),
      dosage: detailEditForm.dosage.trim(),
      manufacturer: detailEditForm.manufacturer.trim(),
      unit_price: Number(detailEditForm.unitPrice),
      stock_quantity: Number(detailEditForm.stock)
    };

    try {
      const token = localStorage.getItem('token') || localStorage.getItem('clinic_auth_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const targetId = detailModalMed.medicine_code || detailModalMed.id;
      let res = await fetch(`/api/pharmacy/medicines/${encodeURIComponent(targetId)}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        res = await fetch(`/api/system/medicines/${encodeURIComponent(targetId)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (res.ok) {
        const newStock = Number(detailEditForm.stock);
        let newStatus: 'In Stock' | 'Low Stock' | 'Out of Stock' = 'In Stock';
        if (newStock === 0) newStatus = 'Out of Stock';
        else if (newStock <= 20) newStatus = 'Low Stock';

        const updatedItem: Medicine = {
          ...detailModalMed,
          name: detailEditForm.name.trim(),
          genericName: detailEditForm.genericName.trim(),
          category: detailEditForm.category.trim(),
          properties: detailEditForm.properties.trim(),
          dosage: detailEditForm.dosage.trim(),
          precautions: detailEditForm.precautions.trim(),
          manufacturer: detailEditForm.manufacturer.trim(),
          price: `฿ ${Number(detailEditForm.unitPrice).toFixed(2)}`,
          unit_price: Number(detailEditForm.unitPrice),
          stock: newStock,
          stock_quantity: newStock,
          status: newStatus
        };

        setMedicines(prev => prev.map(m => (m.id === detailModalMed.id || m.medicine_code === detailModalMed.medicine_code) ? updatedItem : m));
        setDetailModalMed(updatedItem);
        setIsEditingDetailMed(false);
        triggerSuccessBadge(`✓ บันทึกข้อมูลยา "${detailEditForm.name}" ลงฐานข้อมูลเรียบร้อยแล้ว`);
      } else {
        alert('ไม่สามารถบันทึกข้อมูลยาได้ กรุณาลองใหม่อีกครั้ง');
      }
    } catch (err) {
      console.error('Failed to save medicine edit:', err);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    } finally {
      setIsSavingDetailMed(false);
    }
  };

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
    const q = searchQuery.trim().toLowerCase();
    
    let matchSearch = !q;
    if (q) {
      const codeStr = (med.medicine_code || med.id).toLowerCase();
      const codeDigits = codeStr.replace(/\D/g, '');
      const queryDigits = q.replace(/\D/g, '');

      const matchId = codeStr.includes(q) || 
        (queryDigits !== '' && (
          codeDigits.includes(queryDigits) || 
          (parseInt(codeDigits, 10) > 0 && parseInt(codeDigits, 10) === parseInt(queryDigits, 10))
        ));

      const searchTerms = q.split(/\s+/).filter(Boolean);
      const nameStr = (med.name || '').toLowerCase();
      const genericStr = (med.genericName || '').toLowerCase();

      const matchName = searchTerms.length > 0 && searchTerms.every(term => 
        nameStr.includes(term) || genericStr.includes(term)
      );
        
      matchSearch = matchId || matchName;
    }
      
    let matchCategory = true;
    if (categoryFilter !== 'all') {
      matchCategory = med.category.toLowerCase().includes(categoryFilter.toLowerCase());
    }

    let matchStatus = true;
    if (stockStatusFilter === 'in-stock') matchStatus = med.status === 'In Stock';
    else if (stockStatusFilter === 'low-stock') matchStatus = med.status === 'Low Stock';
    else if (stockStatusFilter === 'out-of-stock') matchStatus = med.status === 'Out of Stock';

    return matchSearch && matchCategory && matchStatus;
  });

  const ITEMS_PER_PAGE = 10;
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, categoryFilter, stockStatusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredMedicines.length / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, filteredMedicines.length);
  const paginatedMedicines = filteredMedicines.slice(startIndex, endIndex);
  
  const handleResetFilters = () => {
    setSearchQuery('');
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
      <div className="page-header" style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', width: '100%' }}>
        <div className="header-titles" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', width: '100%' }}>
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
          <div className="input-group" style={{ flex: 2 }}>
            <label>ค้นหายา (รหัสยา หรือ ชื่อยา)</label>
            <input
              type="text"
              placeholder="เช่น 001, MED-0231, หรือ Paracetamol"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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
              {allAvailableCategories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="search-btn" type="button">ค้นหา</button>
          {(searchQuery || stockStatusFilter !== 'all') && (
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsAddModalOpen(true);
              }}
              style={{
                padding: '6px 14px', borderRadius: '8px',
                background: '#16A34A', color: '#FFFFFF', border: 'none',
                fontSize: '13px', fontWeight: '700', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                boxShadow: '0 2px 6px rgba(22, 163, 74, 0.25)', transition: 'all 0.2s ease'
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              เพิ่มรายการยาใหม่
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (filteredMedicines.length > 0) {
                  handleOpenEditDetailMedDirect(filteredMedicines[0]);
                } else if (medicines.length > 0) {
                  handleOpenEditDetailMedDirect(medicines[0]);
                }
              }}
              style={{
                padding: '6px 14px', borderRadius: '8px',
                background: '#EFF6FF', color: '#2563EB', border: '1.5px solid #BFDBFE',
                fontSize: '13px', fontWeight: '700', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                boxShadow: '0 2px 4px rgba(37, 99, 235, 0.1)', transition: 'all 0.2s ease'
              }}
              title="แก้ไขข้อมูลยา"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
              แก้ไขข้อมูลยา
            </button>
            {showSuccessBadge && (
              <span className="success-badge" style={{ background: '#DCFCE7', color: '#166534', fontWeight: 'bold', padding: '4px 12px', borderRadius: '16px', fontSize: '13px' }}>
                {successBadgeText}
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
            <div className="table-wrapper" style={{ overflowX: 'hidden', width: '100%' }}>
              <table className="stock-table" style={{ width: '100%', tableLayout: 'fixed' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'center', width: '12%', padding: '12px 6px' }}>รหัสยา</th>
                    <th style={{ textAlign: 'center', width: '23%', padding: '12px 8px' }}>ชื่อยา</th>
                    <th style={{ textAlign: 'center', width: '18%', padding: '12px 6px' }}>ชนิด / หมวดหมู่ยา</th>
                    <th style={{ textAlign: 'center', width: '11%', padding: '12px 6px' }}>คงเหลือในคลัง</th>
                    <th style={{ textAlign: 'center', width: '11%', padding: '12px 4px' }}>สถานะคลังยา</th>
                    <th style={{ textAlign: 'center', width: '9%', padding: '12px 6px' }}>จ่ายวันนี้</th>
                    <th style={{ textAlign: 'center', width: '16%', padding: '12px 6px' }}>การจัดการ</th>
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
                    paginatedMedicines.map((med) => (
                      <tr key={med.id}>
                        <td style={{ padding: '10px 6px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <CopyableText value={med.id} color="#2563EB" />
                        </td>
                        <td className="med-name-cell" style={{ textAlign: 'center', padding: '10px 8px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                            <div 
                              onClick={() => { setDetailModalMed(med); setIsEditingDetailMed(false); }}
                              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px', whiteSpace: 'nowrap', cursor: 'pointer' }}
                              title="คลิกเพื่อดูรายละเอียดตัวยาและสรรพคุณ"
                            >
                              <CopyableText value={med.name} mono={false} color="#0F172A" />
                            </div>
                            <span 
                              className="med-hint-tag" 
                              onClick={() => { setDetailModalMed(med); setIsEditingDetailMed(false); }}
                              style={{ 
                                cursor: 'pointer', 
                                margin: 0, 
                                fontSize: '11px',
                                color: '#2563EB',
                                background: '#EFF6FF',
                                padding: '1px 8px',
                                borderRadius: '4px',
                                border: '1px solid #DBEAFE',
                                fontWeight: '500',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                whiteSpace: 'nowrap'
                              }}
                              title="คลิกเพื่อดูรายละเอียดและสรรพคุณยา"
                            >
                              (คลิกดูสรรพคุณ)
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '10px 6px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <span style={{ 
                              fontSize: '12px', 
                              padding: '3px 8px', 
                              borderRadius: '6px', 
                              background: 'var(--bg-card, #F1F5F9)', 
                              color: 'var(--text-primary, #334155)',
                              fontWeight: '500',
                              display: 'inline-block',
                              whiteSpace: 'nowrap'
                            }}>
                              {med.category ? med.category.replace(/\s*\([^)]*\)/g, '').trim() : 'ยารักษาโรคทั่วไป'}
                            </span>
                          </div>
                        </td>
                        <td className="stock-num-cell" style={{ textAlign: 'center', padding: '10px 6px', whiteSpace: 'nowrap', fontSize: '13.5px' }}>{med.stock} เม็ด</td>
                        <td style={{ textAlign: 'center', padding: '10px 4px' }}>
                          <span className={`status-badge ${getStatusClass(med.status)}`} style={{ display: 'inline-flex', justifyContent: 'center', alignItems: 'center', minWidth: '76px', padding: '3px 8px', fontSize: '11.5px', textAlign: 'center' }}>
                            {renderStatusText(med.status)}
                          </span>
                        </td>
                        <td className="dispensed-cell" style={{ textAlign: 'center', padding: '10px 6px', whiteSpace: 'nowrap', fontSize: '13.5px' }}>{med.dispensedToday} เม็ด</td>
                        <td style={{ textAlign: 'center', padding: '10px 6px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'inline-flex', gap: '4px', justifyContent: 'center', alignItems: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleOpenEditDetailMedDirect(med)}
                              style={{
                                padding: '5px 8px', borderRadius: '6px',
                                background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE',
                                fontSize: '12px', fontWeight: '700', cursor: 'pointer',
                                display: 'inline-flex', alignItems: 'center', gap: '3px',
                                whiteSpace: 'nowrap', transition: 'all 0.15s ease'
                              }}
                              title="แก้ไขข้อมูลยาตัวนี้"
                            >
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                              </svg>
                              แก้ไขยา
                            </button>
                            <button
                              className="update-stock-btn"
                              onClick={() => handleUpdateClick(med)}
                              style={{ padding: '5px 8px', fontSize: '12px', whiteSpace: 'nowrap' }}
                            >
                              ปรับสต็อก
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmMed(med)}
                              style={{
                                padding: '5px 8px', borderRadius: '6px',
                                background: '#FEF2F2', color: '#DC2626', border: '1px solid #FCA5A5',
                                fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                                whiteSpace: 'nowrap', transition: 'all 0.2s ease'
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
                แสดง {filteredMedicines.length === 0 ? 0 : startIndex + 1} - {endIndex} จากทั้งหมด <strong>{filteredMedicines.length}</strong> รายการ
              </span>
              <div className="pagination-buttons">
                <button 
                  className="page-arrow" 
                  disabled={safeCurrentPage <= 1} 
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  title="หน้าก่อนหน้า"
                >
                  ‹
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                  <button 
                    key={pageNum}
                    className={`page-num ${safeCurrentPage === pageNum ? 'active' : ''}`}
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </button>
                ))}
                <button 
                  className="page-arrow" 
                  disabled={safeCurrentPage >= totalPages} 
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  title="หน้าถัดไป"
                >
                  ›
                </button>
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
                <p className="error-text" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                    <line x1="12" y1="9" x2="12" y2="13"></line>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                  </svg>
                  ไม่สามารถลดจำนวนเกินกว่าสต็อกที่มีอยู่ ({selectedMedicine.stock} เม็ด) ได้
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

      {/* Medicine Info Detail Modal (รองรับทั้งดูรายละเอียด และแก้ไขลง DB ทันที) */}
      {detailModalMed && (
        <div className="modal-overlay" onClick={() => { setDetailModalMed(null); setIsEditingDetailMed(false); }}>
          <div className="med-detail-modal-card card" style={{ maxWidth: '680px', width: '92%' }} onClick={(e) => e.stopPropagation()}>
            <div className="med-detail-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #E2E8F0', paddingBottom: '16px', marginBottom: '18px' }}>
              <div className="med-detail-title-box" style={{ flex: 1, minWidth: 0, paddingRight: '20px' }}>
                <div style={{ marginBottom: '8px' }}>
                  <span className="med-detail-badge" style={{ background: isEditingDetailMed ? '#FEF3C7' : undefined, color: isEditingDetailMed ? '#92400E' : undefined, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    {isEditingDetailMed && (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                    )}
                    {isEditingDetailMed ? 'โหมดแก้ไขข้อมูลตัวยาและสรรพคุณ' : 'รายละเอียดตัวยาและสรรพคุณ'}
                  </span>
                </div>

                {!isEditingDetailMed ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <h2 className="med-detail-name" style={{ margin: 0 }}>{detailModalMed.name}</h2>
                      <CopyableText value={detailModalMed.name} mono={false} showIcon={true} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '6px' }}>
                      <span className="med-detail-generic">ชื่อสามัญทางยา: <strong style={{ color: '#1E293B' }}>{detailModalMed.genericName}</strong></span>
                      <CopyableText label="รหัสยา" value={detailModalMed.id} color="#2563EB" />
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '6px' }}>
                    <MedicineSelectorDropdown
                      medicines={medicines}
                      currentMed={detailModalMed}
                      onSelect={(med) => handleOpenEditDetailMedDirect(med)}
                    />
                    <div>
                      <label style={{ fontSize: '13.5px', fontWeight: '700', color: '#1E293B', display: 'block', marginBottom: '4px' }}>ชื่อยา * (Trade Name)</label>
                      <input 
                        type="text" 
                        value={detailEditForm.name} 
                        onChange={(e) => setDetailEditForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="เช่น Amoxicillin 500mg"
                        style={{ width: '100%', padding: '9px 12px', fontSize: '15px', fontWeight: 'bold', border: '1.5px solid #2563EB', borderRadius: '8px', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={{ fontSize: '12.5px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>ชื่อสามัญทางยา (Generic Name)</label>
                        <input 
                          type="text" 
                          value={detailEditForm.genericName} 
                          onChange={(e) => setDetailEditForm(prev => ({ ...prev, genericName: e.target.value }))}
                          placeholder="เช่น Amoxicillin Trihydrate"
                          style={{ width: '100%', padding: '8px 12px', fontSize: '13px', border: '1.5px solid #CBD5E1', borderRadius: '6px', boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '12.5px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>รหัสยา (Medicine Code)</label>
                        <input 
                          type="text" 
                          value={detailModalMed.medicine_code || detailModalMed.id} 
                          disabled
                          style={{ width: '100%', padding: '8px 12px', fontSize: '13px', background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '6px', color: '#64748B', boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Action container with clean gap between edit and close button */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
                {!isEditingDetailMed && (
                  <button
                    onClick={handleOpenEditDetailMed}
                    style={{
                      padding: '7px 16px',
                      background: '#EFF6FF',
                      color: '#2563EB',
                      border: '1.5px solid #BFDBFE',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: '700',
                      fontSize: '13px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease'
                    }}
                    title="คลิกเพื่อแก้ไขข้อมูลยาและบันทึกลงฐานข้อมูลทันที"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                    แก้ไขข้อมูลยา
                  </button>
                )}
                <button 
                  className="close-btn" 
                  onClick={() => { setDetailModalMed(null); setIsEditingDetailMed(false); }}
                  title="ปิดหน้าต่าง"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="med-detail-body">
              {!isEditingDetailMed ? (
                <>
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
                      <h4 className="info-box-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                          <line x1="12" y1="9" x2="12" y2="13"></line>
                          <line x1="12" y1="17" x2="12.01" y2="17"></line>
                        </svg>
                        ข้อควรระวังและผลข้างเคียง
                      </h4>
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
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Modern Downward Dropdown */}
                  <div>
                    <label style={{ fontSize: '13.5px', fontWeight: '700', color: '#1E293B', marginBottom: '6px', display: 'block' }}>
                      ชนิด / หมวดหมู่ยา
                    </label>
                    <ModernCategoryDropdown
                      value={detailEditForm.category}
                      onChange={(cat) => setDetailEditForm(prev => ({ ...prev, category: cat }))}
                      categories={allAvailableCategories}
                      onAddNewCategory={handleAddNewCategory}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div>
                      <label style={{ fontSize: '13px', fontWeight: '700', color: '#1E293B', marginBottom: '4px', display: 'block' }}>สรรพคุณและข้อบ่งใช้</label>
                      <textarea 
                        rows={3}
                        value={detailEditForm.properties} 
                        onChange={(e) => setDetailEditForm(prev => ({ ...prev, properties: e.target.value }))}
                        placeholder="ระบุสรรพคุณและอาการที่ใช้รักษา..."
                        style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #CBD5E1', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box', resize: 'vertical' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '13px', fontWeight: '700', color: '#1E293B', marginBottom: '4px', display: 'block' }}>ขนาดและวิธีรับประทาน</label>
                      <textarea 
                        rows={3}
                        value={detailEditForm.dosage} 
                        onChange={(e) => setDetailEditForm(prev => ({ ...prev, dosage: e.target.value }))}
                        placeholder="เช่น ครั้งละ 1 แคปซูล วันละ 3 ครั้ง หลังอาหาร..."
                        style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #CBD5E1', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box', resize: 'vertical' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '13px', fontWeight: '700', color: '#DC2626', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                        <line x1="12" y1="9" x2="12" y2="13"></line>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                      </svg>
                      ข้อควรระวังและผลข้างเคียง
                    </label>
                    <textarea 
                      rows={2}
                      value={detailEditForm.precautions} 
                      onChange={(e) => setDetailEditForm(prev => ({ ...prev, precautions: e.target.value }))}
                      placeholder="เช่น ระวังการใช้ในผู้แพ้ยาหรือมีโรคประจำตัว..."
                      style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #FCA5A5', borderRadius: '8px', fontSize: '13px', background: '#FEF2F2', boxSizing: 'border-box', resize: 'vertical' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: '14px' }}>
                    <div>
                      <label style={{ fontSize: '13px', fontWeight: '700', color: '#1E293B', marginBottom: '4px', display: 'block' }}>ผู้ผลิต / บริษัท</label>
                      <input 
                        type="text" 
                        value={detailEditForm.manufacturer} 
                        onChange={(e) => setDetailEditForm(prev => ({ ...prev, manufacturer: e.target.value }))}
                        placeholder="เช่น องค์การเภสัชกรรม (GPO)"
                        style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #CBD5E1', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '13px', fontWeight: '700', color: '#1E293B', marginBottom: '4px', display: 'block' }}>ราคาต่อหน่วย (฿)</label>
                      <input 
                        type="number" 
                        step="0.5"
                        min="0"
                        value={detailEditForm.unitPrice} 
                        onChange={(e) => setDetailEditForm(prev => ({ ...prev, unitPrice: e.target.value === '' ? 0 : Number(e.target.value) }))}
                        style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #CBD5E1', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '13px', fontWeight: '700', color: '#1E293B', marginBottom: '4px', display: 'block' }}>สต็อกคงเหลือ (เม็ด)</label>
                      <input 
                        type="number" 
                        min="0"
                        value={detailEditForm.stock} 
                        onChange={(e) => setDetailEditForm(prev => ({ ...prev, stock: e.target.value === '' ? 0 : Number(e.target.value) }))}
                        style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #CBD5E1', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="med-detail-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              {!isEditingDetailMed ? (
                <>
                  <button 
                    onClick={handleOpenEditDetailMed}
                    style={{
                      padding: '8px 18px',
                      background: '#EFF6FF',
                      color: '#2563EB',
                      border: '1.5px solid #BFDBFE',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: '700',
                      fontSize: '13.5px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                    แก้ไขข้อมูลยานี้
                  </button>
                  <button className="primary-btn-close" onClick={() => { setDetailModalMed(null); setIsEditingDetailMed(false); }}>
                    ปิดหน้าต่าง
                  </button>
                </>
              ) : (
                <>
                  <button 
                    onClick={() => setIsEditingDetailMed(false)}
                    style={{
                      padding: '8px 18px',
                      background: '#F1F5F9',
                      color: '#475569',
                      border: '1px solid #CBD5E1',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '13.5px'
                    }}
                  >
                    ยกเลิก
                  </button>
                  <button 
                    onClick={handleSaveDetailMedEdit}
                    disabled={isSavingDetailMed || !detailEditForm.name.trim()}
                    style={{
                      padding: '8px 22px',
                      background: isSavingDetailMed ? '#94A3B8' : '#16A34A',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: isSavingDetailMed ? 'not-allowed' : 'pointer',
                      fontWeight: '700',
                      fontSize: '13.5px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 6px rgba(22, 163, 74, 0.3)'
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                      <polyline points="17 21 17 13 7 13 7 21"></polyline>
                      <polyline points="7 3 7 8 15 8"></polyline>
                    </svg>
                    {isSavingDetailMed ? 'กำลังบันทึกลง DB...' : 'บันทึกลงฐานข้อมูลทันที'}
                  </button>
                </>
              )}
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
                  <label style={{ fontSize: '13px', fontWeight: '700', color: '#1E293B', marginBottom: '6px', display: 'block' }}>ชนิด / หมวดหมู่ยา</label>
                  <ModernCategoryDropdown
                    value={addCategory}
                    onChange={setAddCategory}
                    categories={allAvailableCategories}
                    onAddNewCategory={handleAddNewCategory}
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="input-group">
                  <label style={{ fontSize: '13.5px', fontWeight: '600', color: '#334155' }}>จำนวนสต็อกรับเข้าแรกเริ่ม (เม็ด)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="100"
                    value={addStock}
                    onChange={(e) => setAddStock(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </div>
                <div className="input-group">
                  <label style={{ fontSize: '13.5px', fontWeight: '600', color: '#334155' }}>ราคาจำหน่ายต่อหน่วย (บาท)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="20"
                    value={addUnitPrice}
                    onChange={(e) => setAddUnitPrice(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="input-group">
                <label style={{ fontSize: '13.5px', fontWeight: '600', color: '#334155' }}>บริษัทผู้ผลิต / ผู้จัดจำหน่าย (Manufacturer)</label>
                <input
                  type="text"
                  placeholder="เช่น บริษัท สยามเภสัช จำกัด, องค์การเภสัชกรรม (GPO)"
                  value={addManufacturer}
                  onChange={(e) => setAddManufacturer(e.target.value)}
                />
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
