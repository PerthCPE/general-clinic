import React, { useState, useEffect, useRef, useMemo } from 'react';

export interface AddressValues {
  houseNo: string;
  villageNo: string;
  villageName: string;
  alley: string;
  road: string;
  subDistrict: string;
  district: string;
  province: string;
  postalCode: string;
  address?: string;
}

export interface AddressErrors {
  houseNo?: string;
  villageNo?: string;
  villageName?: string;
  alley?: string;
  road?: string;
  subDistrict?: string;
  district?: string;
  province?: string;
  postalCode?: string;
  [key: string]: string | undefined;
}

interface ProvinceItem {
  id: number;
  code: number;
  name_th: string;
  name_en: string;
}

interface DistrictItem {
  id: number;
  code: number;
  name_th: string;
  name_en: string;
  province_code: number;
}

interface SubDistrictItem {
  id: number;
  code: number;
  name_th: string;
  name_en: string;
  postal_code: string;
  district_code: number;
}

interface AddressFormSectionProps {
  values: AddressValues;
  errors: AddressErrors;
  onChange: (field: keyof AddressValues, value: string) => void;
  legacyAddress?: string;
}

// Helper: Compose Thai address string cleanly
export function composeAddressPreview(v: AddressValues): string {
  const parts: string[] = [];
  const h = (v.houseNo || '').trim();
  if (h) parts.push(h);

  const vNo = (v.villageNo || '').trim();
  if (vNo) {
    parts.push(vNo.startsWith('หมู่') ? vNo : `หมู่ ${vNo}`);
  }

  const vName = (v.villageName || '').trim();
  if (vName) parts.push(vName);

  const a = (v.alley || '').trim();
  if (a) {
    parts.push(a.startsWith('ซ.') || a.startsWith('ซอย') || a.startsWith('ตรอก') ? a : `ซ.${a}`);
  }

  const r = (v.road || '').trim();
  if (r) {
    parts.push(r.startsWith('ถ.') || r.startsWith('ถนน') ? r : `ถ.${r}`);
  }

  const sd = (v.subDistrict || '').trim();
  if (sd) {
    parts.push(sd.startsWith('ต.') || sd.startsWith('ตำบล') || sd.startsWith('แขวง') ? sd : `ต.${sd}`);
  }

  const d = (v.district || '').trim();
  if (d) {
    parts.push(d.startsWith('อ.') || d.startsWith('อำเภอ') || d.startsWith('เขต') ? d : `อ.${d}`);
  }

  const p = (v.province || '').trim();
  if (p) {
    if (p.startsWith('จ.') || p.startsWith('จังหวัด') || p === 'กรุงเทพมหานคร' || p === 'กทม.') {
      parts.push(p);
    } else {
      parts.push(`จ.${p}`);
    }
  }

  const pc = (v.postalCode || '').trim();
  if (pc) parts.push(pc);

  return parts.join(' ');
}

// Searchable Dropdown Component
interface SearchableSelectProps {
  id?: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  value: string;
  options: { label: string; value: string; extra?: string }[];
  disabled?: boolean;
  hasError?: boolean;
  errorMessage?: string;
  onSelect: (val: string, extra?: string) => void;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  id,
  label,
  required,
  placeholder = 'เลือก...',
  value,
  options,
  disabled = false,
  hasError = false,
  errorMessage,
  onSelect,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleDocClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleDocClick);
    return () => document.removeEventListener('mousedown', handleDocClick);
  }, []);

  // Focus search input on open
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const q = searchQuery.toLowerCase().trim();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.extra && opt.extra.toLowerCase().includes(q))
    );
  }, [options, searchQuery]);

  return (
    <div className="reg-form-group" ref={wrapperRef} style={{ position: 'relative' }}>
      <label className="reg-form-label" htmlFor={id}>
        {label} {required && <span className="text-required">*</span>}
      </label>

      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen);
            setSearchQuery('');
          }
        }}
        className={`reg-form-select ${hasError ? 'has-error' : ''} ${disabled ? 'select-disabled' : ''}`}
        style={{
          textAlign: 'left',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          minHeight: '44px',
        }}
      >
        <span style={{ color: value ? 'inherit' : '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value || placeholder}
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
            flexShrink: 0,
            marginLeft: '8px',
            color: '#64748B',
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {hasError && errorMessage && <span className="input-error-hint">{errorMessage}</span>}

      {isOpen && (
        <div
          className="address-dropdown-menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 50,
            background: 'var(--surface-card, #FFFFFF)',
            border: '1px solid var(--border-color, #CBD5E1)',
            borderRadius: '10px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            maxHeight: '260px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '8px', borderBottom: '1px solid var(--border-subtle, #E2E8F0)' }}>
            <div style={{ position: 'relative' }}>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="พิมพ์ค้นหา..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 10px 6px 30px',
                  fontSize: '13.5px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  background: 'var(--input-bg, #F8FAFC)',
                  color: 'inherit',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#94A3B8"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ position: 'absolute', left: '9px', top: '9px' }}
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
          </div>

          <div style={{ overflowY: 'auto', flex: 1, padding: '4px 0' }}>
            {filteredOptions.length === 0 ? (
              <div style={{ padding: '12px', textAlign: 'center', fontSize: '13px', color: '#94A3B8' }}>
                ไม่พบผลลัพธ์
              </div>
            ) : (
              filteredOptions.map((opt) => (
                <div
                  key={opt.value + (opt.extra || '')}
                  onClick={() => {
                    onSelect(opt.value, opt.extra);
                    setIsOpen(false);
                    setSearchQuery('');
                  }}
                  className="address-dropdown-item"
                  style={{
                    padding: '8px 12px',
                    fontSize: '14px',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: opt.value === value ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                    color: opt.value === value ? '#2563EB' : 'inherit',
                    fontWeight: opt.value === value ? 600 : 400,
                  }}
                  onMouseEnter={(e) => {
                    if (opt.value !== value) {
                      e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.04)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (opt.value !== value) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <span>{opt.label}</span>
                  {opt.extra && (
                    <span style={{ fontSize: '12px', color: '#94A3B8', marginLeft: '8px' }}>
                      {opt.extra}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const AddressFormSection: React.FC<AddressFormSectionProps> = ({
  values,
  errors,
  onChange,
  legacyAddress,
}) => {
  const [provinces, setProvinces] = useState<ProvinceItem[]>([]);
  const [districts, setDistricts] = useState<DistrictItem[]>([]);
  const [subDistricts, setSubDistricts] = useState<SubDistrictItem[]>([]);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingSubDistricts, setLoadingSubDistricts] = useState(false);

  // 1. Fetch Provinces once on mount
  useEffect(() => {
    fetch('/data/provinces.json')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load provinces');
        return res.json();
      })
      .then((data: ProvinceItem[]) => {
        setProvinces(data);
      })
      .catch((err) => {
        console.warn('Could not load provinces.json:', err);
      });
  }, []);

  // 2. Load districts when province changes
  useEffect(() => {
    if (!values.province) {
      setDistricts([]);
      setSubDistricts([]);
      return;
    }

    const cleanP = values.province.replace(/^จ\./, '').replace(/^จังหวัด/, '').trim();
    const matchedP = provinces.find(
      (p) => p.name_th === cleanP || p.name_th === values.province || p.name_en.toLowerCase() === values.province.toLowerCase()
    );

    if (matchedP) {
      setLoadingDistricts(true);
      fetch(`/data/districts/${matchedP.code}.json`)
        .then((res) => {
          if (!res.ok) throw new Error('Districts not found');
          return res.json();
        })
        .then((data: DistrictItem[]) => {
          setDistricts(data);
        })
        .catch((err) => {
          console.warn(`Could not load districts for ${matchedP.name_th}:`, err);
          setDistricts([]);
        })
        .finally(() => setLoadingDistricts(false));
    }
  }, [values.province, provinces]);

  // 3. Load subdistricts when district changes
  useEffect(() => {
    if (!values.district || districts.length === 0) {
      setSubDistricts([]);
      return;
    }

    const cleanD = values.district.replace(/^อ\./, '').replace(/^อำเภอ/, '').replace(/^เขต/, '').trim();
    const matchedD = districts.find(
      (d) => d.name_th === cleanD || d.name_th === values.district || d.name_en.toLowerCase() === values.district.toLowerCase()
    );

    if (matchedD) {
      setLoadingSubDistricts(true);
      fetch(`/data/subdistricts/${matchedD.code}.json`)
        .then((res) => {
          if (!res.ok) throw new Error('Subdistricts not found');
          return res.json();
        })
        .then((data: SubDistrictItem[]) => {
          setSubDistricts(data);
        })
        .catch((err) => {
          console.warn(`Could not load subdistricts for ${matchedD.name_th}:`, err);
          setSubDistricts([]);
        })
        .finally(() => setLoadingSubDistricts(false));
    }
  }, [values.district, districts]);

  // Handlers for dropdown changes
  const handleProvinceSelect = (selectedProv: string) => {
    onChange('province', selectedProv);
    onChange('district', '');
    onChange('subDistrict', '');
    onChange('postalCode', '');
  };

  const handleDistrictSelect = (selectedDist: string) => {
    onChange('district', selectedDist);
    onChange('subDistrict', '');
    onChange('postalCode', '');
  };

  const handleSubDistrictSelect = (selectedSub: string, postalCode?: string) => {
    onChange('subDistrict', selectedSub);
    if (postalCode) {
      onChange('postalCode', postalCode);
    }
  };

  const previewText = useMemo(() => composeAddressPreview(values), [values]);

  const provinceOptions = useMemo(
    () => provinces.map((p) => ({ label: p.name_th, value: p.name_th, extra: p.name_en })),
    [provinces]
  );

  const districtOptions = useMemo(
    () => districts.map((d) => ({ label: d.name_th, value: d.name_th, extra: d.name_en })),
    [districts]
  );

  const subDistrictOptions = useMemo(
    () => subDistricts.map((s) => ({ label: s.name_th, value: s.name_th, extra: s.postal_code })),
    [subDistricts]
  );

  return (
    <div className="address-form-section" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Legacy Address Info Banner (if present and distinct) */}
      {legacyAddress && legacyAddress.trim() !== '' && legacyAddress !== previewText && (
        <div
          className="reg-legacy-address-banner"
          style={{
            padding: '10px 14px',
            borderRadius: '8px',
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '13.5px',
            color: '#B45309',
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flexShrink: 0 }}
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <div>
            <strong>ข้อมูลที่อยู่เดิม (Legacy): </strong>
            <span>{legacyAddress}</span>
          </div>
        </div>
      )}

      {/* Row 1: บ้านเลขที่ | หมู่ที่ | ชื่อหมู่บ้าน/อาคาร */}
      <div className="reg-form-grid" style={{ marginBottom: 0 }}>
        <div className="reg-form-group">
          <label className="reg-form-label" htmlFor="addr-house-no">
            บ้านเลขที่
          </label>
          <input
            id="addr-house-no"
            type="text"
            className="reg-form-input"
            placeholder="เช่น 123/45"
            value={values.houseNo}
            onChange={(e) => onChange('houseNo', e.target.value)}
          />
        </div>

        <div className="reg-form-group">
          <label className="reg-form-label" htmlFor="addr-village-no">
            หมู่ที่
          </label>
          <input
            id="addr-village-no"
            type="text"
            className="reg-form-input"
            placeholder="เช่น 3 หรือ หมู่ 3"
            value={values.villageNo}
            onChange={(e) => onChange('villageNo', e.target.value)}
          />
        </div>

        <div className="reg-form-group">
          <label className="reg-form-label" htmlFor="addr-village-name">
            ชื่อหมู่บ้าน / อาคาร / คอนโด
          </label>
          <input
            id="addr-village-name"
            type="text"
            className="reg-form-input"
            placeholder="เช่น หมู่บ้านร่มรื่น"
            value={values.villageName}
            onChange={(e) => onChange('villageName', e.target.value)}
          />
        </div>
      </div>

      {/* Row 2: ซอย/ตรอก | ถนน */}
      <div className="reg-form-grid" style={{ marginBottom: 0 }}>
        <div className="reg-form-group span-1">
          <label className="reg-form-label" htmlFor="addr-alley">
            ตรอก / ซอย
          </label>
          <input
            id="addr-alley"
            type="text"
            className="reg-form-input"
            placeholder="เช่น สุขใจ 5"
            value={values.alley}
            onChange={(e) => onChange('alley', e.target.value)}
          />
        </div>

        <div className="reg-form-group span-2">
          <label className="reg-form-label" htmlFor="addr-road">
            ถนน
          </label>
          <input
            id="addr-road"
            type="text"
            className="reg-form-input"
            placeholder="เช่น มิตรภาพ หรือ พหลโยธิน"
            value={values.road}
            onChange={(e) => onChange('road', e.target.value)}
          />
        </div>
      </div>

      {/* Row 3: จังหวัด* | อำเภอ/เขต* | ตำบล/แขวง */}
      <div className="reg-form-grid" style={{ marginBottom: 0 }}>
        <SearchableSelect
          id="addr-province-select"
          label="จังหวัด"
          required
          placeholder="เลือกจังหวัด..."
          value={values.province}
          options={provinceOptions}
          hasError={Boolean(errors.province)}
          errorMessage={errors.province}
          onSelect={handleProvinceSelect}
        />

        <SearchableSelect
          id="addr-district-select"
          label="อำเภอ / เขต"
          required
          placeholder={
            loadingDistricts
              ? 'กำลังโหลด...'
              : values.province
              ? 'เลือกอำเภอ/เขต...'
              : 'กรุณาเลือกจังหวัดก่อน'
          }
          value={values.district}
          options={districtOptions}
          disabled={!values.province || loadingDistricts}
          hasError={Boolean(errors.district)}
          errorMessage={errors.district}
          onSelect={handleDistrictSelect}
        />

        <SearchableSelect
          id="addr-subdistrict-select"
          label="ตำบล / แขวง"
          placeholder={
            loadingSubDistricts
              ? 'กำลังโหลด...'
              : values.district
              ? 'เลือกตำบล/แขวง...'
              : 'กรุณาเลือกอำเภอก่อน'
          }
          value={values.subDistrict}
          options={subDistrictOptions}
          disabled={!values.district || loadingSubDistricts}
          hasError={Boolean(errors.subDistrict)}
          errorMessage={errors.subDistrict}
          onSelect={handleSubDistrictSelect}
        />
      </div>

      {/* Row 4: รหัสไปรษณีย์ */}
      <div className="reg-form-grid" style={{ marginBottom: 0 }}>
        <div className="reg-form-group span-1">
          <label className="reg-form-label" htmlFor="addr-postal-code">
            รหัสไปรษณีย์
          </label>
          <input
            id="addr-postal-code"
            type="text"
            maxLength={5}
            className={`reg-form-input ${errors.postalCode ? 'has-error' : ''}`}
            placeholder="เช่น 10200"
            value={values.postalCode}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, '').slice(0, 5);
              onChange('postalCode', digits);
            }}
          />
          {errors.postalCode && <span className="input-error-hint">{errors.postalCode}</span>}
        </div>
      </div>

      {/* Real-time Address Preview */}
      <div
        className="address-preview-box"
        style={{
          padding: '12px 16px',
          borderRadius: '10px',
          background: 'var(--card-hover-bg, #F8FAFC)',
          border: '1px dashed var(--border-color, #CBD5E1)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
        }}
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'rgba(37, 99, 235, 0.1)',
            color: '#2563EB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginTop: '2px',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            ตัวอย่างข้อความที่อยู่รวม (Auto-Composed Preview)
          </div>
          <div
            style={{
              fontSize: '14px',
              fontWeight: 500,
              color: previewText ? 'var(--text-primary, #0F172A)' : '#94A3B8',
              marginTop: '4px',
              lineHeight: '1.5',
            }}
          >
            {previewText || 'กรุณาระบุจังหวัดและอำเภอเพื่อสร้างที่อยู่อัตโนมัติ'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddressFormSection;
