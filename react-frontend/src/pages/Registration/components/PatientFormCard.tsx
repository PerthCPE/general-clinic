import React, { useState } from 'react';
import type { Patient, SchemeType } from '../types';

interface PatientFormCardProps {
  onSubmit: (formData: Partial<Patient>) => void;
  formRef?: React.RefObject<HTMLDivElement | null>;
}

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

  const handleChange = (field: string, value: string) => {
    let processedValue = value;
    if (field === 'nationalId') {
      processedValue = formatNationalIdInput(value);
    } else if (field === 'phone') {
      processedValue = formatPhoneInput(value);
    }

    setFormData((prev) => ({ ...prev, [field]: processedValue }));
    if (formErrors[field]) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }

    // คำนวณอายุอัตโนมัติหากใส่วันเกิด
    if (field === 'dob' && value) {
      try {
        const birthDate = new Date(value);
        if (!isNaN(birthDate.getTime())) {
          const today = new Date();
          let calculatedAge = today.getFullYear() - birthDate.getFullYear();
          const m = today.getMonth() - birthDate.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            calculatedAge--;
          }
          if (calculatedAge >= 0) {
            setFormData((prev) => ({ ...prev, age: calculatedAge.toString() }));
          }
        }
      } catch {
        // ignore date parse error
      }
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

    onSubmit({
      fullName: fullPatientName,
      nationalId: formData.nationalId,
      gender: formData.gender,
      dob: formData.dob || '01/01/2000',
      age: parseInt(formData.age, 10) || 25,
      phone: formData.phone,
      emergencyContact: formData.emergencyContact,
      address: formData.address || 'กรุงเทพมหานคร',
      schemeType: formData.schemeType,
    });

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
              <label className="reg-form-label">
                เลขประจำตัวประชาชน <span className="text-required">*</span>
              </label>
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
              <input
                type="date"
                className="reg-form-input"
                value={formData.dob}
                onChange={(e) => handleChange('dob', e.target.value)}
              />
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
            <span>ล้างข้อมูล</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PatientFormCard;
