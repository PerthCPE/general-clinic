import React, { useState, useEffect } from 'react';
import type { Patient, SchemeType } from '../types';
import { validateThaiNationalID } from '../../../utils/thaiIdValidator';

interface PatientFormCardProps {
  onSubmit: (formData: Partial<Patient>) => void;
  formRef?: React.RefObject<HTMLDivElement | null>;
}

const STORAGE_KEY = 'clinic_patient_reg_draft';

const PatientFormCard: React.FC<PatientFormCardProps> = ({ onSubmit, formRef }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [formData, setFormData] = useState({
    title: 'นาย',
    fullName: '',
    nationalId: '',
    gender: 'ชาย' as 'ชาย' | 'หญิง' | 'อื่นๆ',
    dob: '',
    age: '',
    phone: '',
    emergencyContact: '',
    address: '',
    schemeType: 'บัตรทอง (สปสช.)' as SchemeType,
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [hasDraft, setHasDraft] = useState(false);
  const [draftTime, setDraftTime] = useState<string | null>(null);

  // Check for saved draft on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.data && (parsed.data.fullName || parsed.data.nationalId || parsed.data.phone)) {
          setHasDraft(true);
          setDraftTime(parsed.savedAt || '');
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Save draft whenever formData changes
  useEffect(() => {
    if (formData.fullName || formData.nationalId || formData.phone || formData.address) {
      const timer = setTimeout(() => {
        try {
          const payload = {
            data: formData,
            savedAt: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        } catch {
          // ignore
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [formData]);

  const handleRestoreDraft = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.data) {
          setFormData(parsed.data);
          setHasDraft(false);
        }
      }
    } catch {
      // ignore
    }
  };

  const handleDismissDraft = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setHasDraft(false);
  };

  const formatNationalIdInput = (val: string): string => {
    const digits = val.replace(/\D/g, '').slice(0, 13);
    if (digits.length <= 1) return digits;
    if (digits.length <= 5) return `${digits[0]}-${digits.slice(1)}`;
    if (digits.length <= 10) return `${digits[0]}-${digits.slice(1, 5)}-${digits.slice(5)}`;
    if (digits.length <= 12) return `${digits[0]}-${digits.slice(1, 5)}-${digits.slice(5, 10)}-${digits.slice(10)}`;
    return `${digits[0]}-${digits.slice(1, 5)}-${digits.slice(5, 10)}-${digits.slice(10, 12)}-${digits[12]}`;
  };

  const formatPhoneInput = (val: string): string => {
    const digits = val.replace(/\D/g, '').slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  const thaiIdValidation = validateThaiNationalID(formData.nationalId);

  const parseDateAndCalculateAge = (val: string): { ageStr: string; valid: boolean; birthdateISO: string } => {
    if (!val || !val.trim()) return { ageStr: '', valid: false, birthdateISO: '' };
    const str = val.trim();
    let y = 0, m = 0, d = 0;

    if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(str)) {
      const p = str.split(/[-/]/).map((n) => parseInt(n, 10));
      y = p[0];
      m = p[1];
      d = p[2];
    } else if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/.test(str)) {
      const p = str.split(/[-/]/).map((n) => parseInt(n, 10));
      d = p[0];
      m = p[1];
      y = p[2];
    } else {
      return { ageStr: '', valid: false, birthdateISO: '' };
    }

    // หากกรอกเป็น พ.ศ. (>= 2400) ให้แปลงเป็น ค.ศ.
    if (y >= 2400) {
      y = y - 543;
    }

    if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) {
      return { ageStr: '', valid: false, birthdateISO: '' };
    }

    const today = new Date();
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth() + 1;
    const todayDay = today.getDate();

    let age = todayYear - y;
    if (todayMonth < m || (todayMonth === m && todayDay < d)) {
      age--;
    }

    if (age < 0) age = 0;
    const birthdateISO = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return { ageStr: String(age), valid: true, birthdateISO };
  };

  const formatDobInput = (val: string): string => {
    // If it's an ISO date from calendar picker (YYYY-MM-DD)
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(val)) {
      const [yr, mo, dy] = val.split('-');
      const yrNum = parseInt(yr, 10);
      const beYear = yrNum >= 2400 ? yrNum : yrNum + 543;
      return `${dy.padStart(2, '0')}/${mo.padStart(2, '0')}/${beYear}`;
    }
    const digits = val.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  };

  const handleChange = (field: string, value: string) => {
    let processedValue = value;
    if (field === 'nationalId') {
      processedValue = formatNationalIdInput(value);
    } else if (field === 'phone') {
      processedValue = formatPhoneInput(value);
    } else if (field === 'dob') {
      processedValue = formatDobInput(value);
      const { ageStr, valid } = parseDateAndCalculateAge(processedValue);
      if (valid) {
        setFormData((prev) => ({ ...prev, dob: processedValue, age: ageStr }));
        if (formErrors.dob) {
          setFormErrors((prev) => {
            const next = { ...prev };
            delete next.dob;
            return next;
          });
        }
        return;
      }
    }

    setFormData((prev) => ({ ...prev, [field]: processedValue }));
    if (formErrors[field]) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!formData.fullName.trim()) errors.fullName = 'กรุณาระบุชื่อ-นามสกุล';
    if (!formData.nationalId.trim()) {
      errors.nationalId = 'กรุณาระบุเลขประจำตัวประชาชน 13 หลัก';
    } else if (formData.nationalId.replace(/[-\s]/g, '').length !== 13) {
      errors.nationalId = 'เลขบัตรประชาชนต้องมี 13 หลัก';
    }
    if (!formData.phone.trim()) errors.phone = 'กรุณาระบุเบอร์โทรศัพท์';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    const fullPatientName =
      formData.fullName.startsWith('นาย') ||
      formData.fullName.startsWith('นาง') ||
      formData.fullName.startsWith('น.ส.') ||
      formData.fullName.startsWith('นางสาว') ||
      formData.fullName.startsWith('ด.ช.') ||
      formData.fullName.startsWith('ด.ญ.')
        ? formData.fullName
        : `${formData.title}${formData.fullName}`;

    const parsed = parseDateAndCalculateAge(formData.dob);
    const birthDateISO = parsed.valid ? parsed.birthdateISO : formData.dob;
    const finalAge = parsed.valid ? parseInt(parsed.ageStr, 10) : parseInt(formData.age, 10) || 25;

    onSubmit({
      fullName: fullPatientName,
      nationalId: formData.nationalId,
      gender: formData.gender,
      dob: birthDateISO || '2000-01-01',
      age: finalAge,
      phone: formData.phone,
      emergencyContact: formData.emergencyContact,
      address: formData.address || 'กรุงเทพมหานคร',
      schemeType: formData.schemeType,
    });

    // Clear saved draft on submit
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setHasDraft(false);

    // ล้างข้อมูลที่กรอกไว้ในฟอร์มทันทีเมื่อกดบันทึก
    handleReset();
  };

  const handleReset = () => {
    setFormData({
      title: 'นาย',
      fullName: '',
      nationalId: '',
      gender: 'ชาย',
      dob: '',
      age: '',
      phone: '',
      emergencyContact: '',
      address: '',
      schemeType: 'บัตรทอง (สปสช.)',
    });
    setFormErrors({});
  };

  return (
    <div className="reg-card" ref={formRef}>
      <div className="reg-card-header" onClick={() => setIsOpen(!isOpen)}>
        <div className="reg-header-title-wrap">
          <div className="reg-header-icon-box green-box">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <h2 className="reg-card-title">แบบฟอร์มลงทะเบียนคนไข้รายใหม่ (New Patient Registration)</h2>
            <p className="reg-card-subtitle">กรอกข้อมูลผู้ป่วยรายใหม่เพื่อออกรหัส HN และบันทึกประวัติเข้าสู่ระบบ</p>
          </div>
        </div>
        <button className={`reg-card-toggle ${isOpen ? 'open' : ''}`} aria-label="Toggle Accordion">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19.5 8.25l-7.5 7.5-7.5-7.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div className={`reg-card-body ${isOpen ? 'expanded' : ''}`}>
        {/* Draft Auto-Recovery Banner */}
        {hasDraft && (
          <div className="reg-draft-banner">
            <div className="reg-draft-text-wrap">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              <span>พบข้อมูลร่างที่บันทึกค้างไว้เมื่อเวลา {draftTime} ต้องการกู้คืนหรือไม่?</span>
            </div>
            <div className="reg-draft-actions">
              <button
                type="button"
                onClick={handleRestoreDraft}
                className="reg-btn-draft-restore"
              >
                กู้คืนข้อมูล
              </button>
              <button
                type="button"
                onClick={handleDismissDraft}
                className="reg-btn-draft-dismiss"
              >
                ละทิ้ง
              </button>
            </div>
          </div>
        )}

        <div className="reg-form-section">
          <div className="reg-section-header">
            <span className="reg-section-num">1</span>
            <span className="reg-section-title">ข้อมูลส่วนตัวและประวัติทั่วไป</span>
          </div>

          <div className="reg-form-grid">
            <div className="reg-form-group">
              <label className="reg-form-label">
                คำนำหน้าชื่อ <span className="text-required">*</span>
              </label>
              <select
                className="reg-form-select"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
              >
                <option value="นาย">นาย (Mr.)</option>
                <option value="นาง">นาง (Mrs.)</option>
                <option value="นางสาว">นางสาว (Miss)</option>
                <option value="ด.ช.">ด.ช. (Master)</option>
                <option value="ด.ญ.">ด.ญ. (Miss - Child)</option>
              </select>
            </div>

            <div className="reg-form-group span-2">
              <label className="reg-form-label">
                ชื่อ - นามสกุล <span className="text-required">*</span>
              </label>
              <input
                type="text"
                className={`reg-form-input ${formErrors.fullName ? 'has-error' : ''}`}
                placeholder="เช่น สมชาย ใจดี"
                value={formData.fullName}
                onChange={(e) => handleChange('fullName', e.target.value)}
              />
              {formErrors.fullName && <span className="input-error-hint">{formErrors.fullName}</span>}
            </div>

            <div className="reg-form-group">
              <label className="reg-form-label">เพศ</label>
              <select
                className="reg-form-select"
                value={formData.gender}
                onChange={(e) => handleChange('gender', e.target.value as 'ชาย' | 'หญิง' | 'อื่นๆ')}
              >
                <option value="ชาย">ชาย (Male)</option>
                <option value="หญิง">หญิง (Female)</option>
                <option value="อื่นๆ">อื่นๆ (Other)</option>
              </select>
            </div>

            <div className="reg-form-group span-2">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="reg-form-label">
                  เลขประจำตัวประชาชน <span className="text-required">*</span>
                </label>
                {formData.nationalId.length > 0 && (
                  <span
                    style={{
                      fontSize: '12.5px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '6px',
                      backgroundColor: thaiIdValidation.isValid
                        ? '#ECFDF5'
                        : thaiIdValidation.isComplete
                        ? '#FEF2F2'
                        : '#EFF6FF',
                      color: thaiIdValidation.isValid
                        ? '#059669'
                        : thaiIdValidation.isComplete
                        ? '#DC2626'
                        : '#2563EB',
                      border: `1px solid ${
                        thaiIdValidation.isValid
                          ? '#A7F3D0'
                          : thaiIdValidation.isComplete
                          ? '#FECACA'
                          : '#BFDBFE'
                      }`,
                    }}
                  >
                    {thaiIdValidation.isValid
                      ? 'เลขบัตรถูกต้อง (Mod 11)'
                      : thaiIdValidation.isComplete
                      ? 'Checksum ไม่ตรง'
                      : `พิมพ์แล้ว ${formData.nationalId.replace(/\D/g, '').length}/13 หลัก`}
                  </span>
                )}
              </div>
              <input
                type="text"
                className={`reg-form-input ${formErrors.nationalId ? 'has-error' : ''}`}
                placeholder="ระบุเลขประจำตัวประชาชน 13 หลัก"
                value={formData.nationalId}
                onChange={(e) => handleChange('nationalId', e.target.value)}
              />
              {formErrors.nationalId && <span className="input-error-hint">{formErrors.nationalId}</span>}
            </div>

            <div className="reg-form-group span-2">
              <label className="reg-form-label">วัน/เดือน/ปีเกิด (พ.ศ. หรือ ค.ศ.)</label>
              <div className="reg-date-input-wrap" style={{ position: 'relative' }}>
                <input
                  id="dob-input"
                  type="text"
                  maxLength={10}
                  className="reg-form-input"
                  placeholder="เช่น 05/05/2549 หรือ 05/05/2000"
                  value={formData.dob}
                  onChange={(e) => handleChange('dob', e.target.value)}
                />
                <input
                  type="date"
                  style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0, bottom: 0, right: 0 }}
                  id="hidden-dob-picker"
                  onChange={(e) => {
                    if (e.target.value) {
                      const [yr, mo, dy] = e.target.value.split('-');
                      const yrNum = parseInt(yr, 10);
                      const beYear = yrNum >= 2400 ? yrNum : yrNum + 543;
                      const formattedDisplay = `${dy}/${mo}/${beYear}`;
                      handleChange('dob', formattedDisplay);
                    }
                  }}
                />
                <span
                  className="reg-calendar-svg-btn"
                  title="เลือกวันเกิดจากปฏิทิน"
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    const picker = document.getElementById('hidden-dob-picker') as HTMLInputElement;
                    if (picker) {
                      if ('showPicker' in HTMLInputElement.prototype) {
                        picker.showPicker();
                      } else {
                        picker.click();
                      }
                    }
                  }}
                >
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </span>
              </div>
            </div>

            <div className="reg-form-group">
              <label className="reg-form-label">อายุ (ปี)</label>
              <input
                type="number"
                className="reg-form-input"
                placeholder="เช่น 28"
                value={formData.age}
                onChange={(e) => handleChange('age', e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="reg-form-section">
          <div className="reg-section-header">
            <span className="reg-section-num">2</span>
            <span className="reg-section-title">ข้อมูลการติดต่อและที่อยู่</span>
          </div>

          <div className="reg-form-grid">
            <div className="reg-form-group">
              <label className="reg-form-label">
                เบอร์โทรศัพท์ติดต่อ <span className="text-required">*</span>
              </label>
              <input
                type="tel"
                className={`reg-form-input ${formErrors.phone ? 'has-error' : ''}`}
                placeholder="เช่น 081-234-5678"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
              />
              {formErrors.phone && <span className="input-error-hint">{formErrors.phone}</span>}
            </div>

            <div className="reg-form-group span-2">
              <label className="reg-form-label">เบอร์โทรติดต่อฉุกเฉิน (ชื่อผู้ติดต่อ + เบอร์)</label>
              <input
                type="text"
                className="reg-form-input"
                placeholder="เช่น นางสมศรี (มารดา) 089-987-6543"
                value={formData.emergencyContact}
                onChange={(e) => handleChange('emergencyContact', e.target.value)}
              />
            </div>

            <div className="reg-form-group span-3">
              <label className="reg-form-label">ที่อยู่ปัจจุบัน</label>
              <input
                type="text"
                className="reg-form-input"
                placeholder="บ้านเลขที่, ถนน, ตำบล/แขวง, อำเภอ/เขต, จังหวัด..."
                value={formData.address}
                onChange={(e) => handleChange('address', e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="reg-form-section">
          <div className="reg-section-header">
            <span className="reg-section-num">3</span>
            <span className="reg-section-title">สิทธิการรักษาพยาบาล</span>
          </div>

          <div className="reg-form-grid">
            <div className="reg-form-group span-3">
              <label className="reg-form-label">
                ประเภทสิทธิการรักษาพยาบาล <span className="text-required">*</span>
              </label>
              <select
                className="reg-form-select"
                value={formData.schemeType}
                onChange={(e) => handleChange('schemeType', e.target.value as SchemeType)}
              >
                <option value="บัตรทอง (สปสช.)">บัตรทอง (สปสช.) - สิทธิหลักประกันสุขภาพแห่งชาติ</option>
                <option value="ประกันสังคม (ม.33)">ประกันสังคม (ม.33 / ม.39 / ม.40)</option>
                <option value="สิทธิ์ข้าราชการ">สิทธิ์ข้าราชการ / รัฐวิสาหกิจ (CSMBS)</option>
                <option value="ประกันสุขภาพเอกชน">ประกันสุขภาพเอกชน (Private Insurance)</option>
                <option value="ชำระเงินเอง">ชำระเงินเอง (Self-Pay)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="reg-form-actions-row">
          <button
            type="button"
            className="reg-btn-submit-main"
            onClick={handleSubmit}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="btn-icon-svg">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            <span>บันทึกข้อมูลและลงทะเบียน</span>
          </button>

          <button
            type="button"
            className="reg-btn-reset-form"
            onClick={handleReset}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="btn-icon-svg">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            <span>ล้างข้อมูล</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PatientFormCard;
