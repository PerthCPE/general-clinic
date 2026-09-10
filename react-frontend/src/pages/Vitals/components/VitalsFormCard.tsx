import React from 'react';
import type { DoctorOption, QueuePatientItem } from '../types';

interface VitalsFormCardProps {
  selectedPatient: QueuePatientItem | null;
  // Queue Selector Props
  queueList: QueuePatientItem[];
  filteredWaitingQueues: QueuePatientItem[];
  searchQuery: string;
  isQueueDropdownOpen: boolean;
  onSearchQueryChange: (val: string) => void;
  onToggleQueueDropdown: (open?: boolean) => void;
  onSelectPatient: (patient: QueuePatientItem) => void;
  onResetSelection: () => void;
  queueDropdownRef: React.RefObject<HTMLDivElement | null>;
  // Form fields
  weight: string;
  height: string;
  temperature: string;
  systolicBP: string;
  diastolicBP: string;
  heartRate: string;
  respiratoryRate: string;
  spo2: string;
  painScore: string;
  bloodSugar: string;
  chiefComplaint: string;
  allergies: string;
  foodAllergies: string;
  medicalHistory: string;
  currentMedications: string;
  smokingHistory: string;
  alcoholHistory: string;
  // Advanced screening fields (EXPAND-1)
  nurseNotes: string;
  herbalMedicines: string;
  dietarySupplements: string;
  hasURI: boolean | null;
  hasTB: boolean | null;
  onAnticoagulant: boolean | null;
  precautionType: string;
  isPregnant: boolean | null;
  isBreastfeeding: boolean | null;
  lastMenstrualPeriod: string;
  q2Depressed: boolean | null;
  q2Anhedonia: boolean | null;
  assignedDoctorId: number;
  doctorOptions: DoctorOption[];
  isAccordionOpen: boolean;
  onToggleAccordion: () => void;
  onChangeField: (field: string, value: any) => void;
  onRandomVitals?: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onReset: () => void;
  isSaving: boolean;
  savedDraftTime?: string | null;
  formErrors?: Record<string, string>;
}

export const VitalsFormCard: React.FC<VitalsFormCardProps> = ({
  selectedPatient,
  queueList,
  filteredWaitingQueues,
  searchQuery,
  isQueueDropdownOpen,
  onSearchQueryChange,
  onToggleQueueDropdown,
  onSelectPatient,
  onResetSelection,
  queueDropdownRef,
  weight,
  height,
  temperature,
  systolicBP,
  diastolicBP,
  heartRate,
  respiratoryRate,
  spo2,
  painScore,
  bloodSugar,
  chiefComplaint,
  allergies,
  foodAllergies,
  medicalHistory,
  currentMedications,
  smokingHistory,
  alcoholHistory,
  nurseNotes,
  herbalMedicines,
  dietarySupplements,
  hasURI,
  hasTB,
  onAnticoagulant,
  precautionType,
  isPregnant,
  isBreastfeeding,
  lastMenstrualPeriod,
  q2Depressed,
  q2Anhedonia,
  assignedDoctorId,
  doctorOptions,
  isAccordionOpen,
  onToggleAccordion,
  onChangeField,
  onRandomVitals,
  onSubmit,
  onReset,
  isSaving,
  savedDraftTime,
  formErrors = {},
}) => {
  // Clinical flags
  const tempNum = parseFloat(temperature);
  const isFever = !isNaN(tempNum) && tempNum >= 37.5;
  const isHighFever = !isNaN(tempNum) && tempNum >= 38.5;

  const sysNum = parseInt(systolicBP, 10);
  const diaNum = parseInt(diastolicBP, 10);
  const isHighBP = (!isNaN(sysNum) && sysNum >= 140) || (!isNaN(diaNum) && diaNum >= 90);
  const isCrisisBP = (!isNaN(sysNum) && sysNum >= 180) || (!isNaN(diaNum) && diaNum >= 110);

  const hrNum = parseInt(heartRate, 10);
  const isTachycardia = !isNaN(hrNum) && hrNum > 100;
  const isBradycardia = !isNaN(hrNum) && hrNum < 60 && hrNum > 0;

  const hasAllergy = allergies.trim().length > 0 && allergies.trim() !== 'ปฏิเสธการแพ้ยา' && allergies.trim() !== 'ไม่มี';
  const isQ2Positive = q2Depressed === true || q2Anhedonia === true;
  const waitingCount = queueList.filter((p) => p.queueStatus === 'รอคัดกรอง').length;

  return (
    <div className="vitals-card">
      <div className="vitals-card-header" onClick={onToggleAccordion}>
        <div className="vitals-header-title-wrap">
          <div className="vitals-header-icon-box blue-box">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <h2 className="vitals-card-title">บันทึกสัญญาณชีพ & คัดกรองผู้ป่วย (Vital Signs & Screening)</h2>
            <p className="vitals-card-subtitle">
              เลือกคิวผู้ป่วย บันทึกสัญญาณชีพ ประเมิน Triage และส่งต่อห้องตรวจแพทย์
            </p>
          </div>
        </div>

        <div className="vitals-header-actions">
          <button
            type="button"
            className={`vitals-card-toggle ${isAccordionOpen ? 'open' : ''}`}
            aria-label="Toggle Accordion"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>

      <div className={`vitals-card-body ${isAccordionOpen ? 'expanded' : ''}`}>
        <form onSubmit={onSubmit} className="vitals-form">
          {/* Section 1: Queue Selection & Search (Integrated Step 1) */}
          <div className="vitals-form-section">
            <div className="vitals-section-header">
              <span className="vitals-section-num">1</span>
              <span className="vitals-section-title">เลือกคิวผู้ป่วยเพื่อคัดกรอง (Select Patient Queue)</span>
              <span className="text-required">*</span>
              <span className="vitals-queue-blue-box">
                {waitingCount} คิว
              </span>
            </div>

            <div className="vitals-queue-selector-box" ref={queueDropdownRef}>
              <div className="combobox-input-wrap">
                <span className="combobox-search-icon">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                    <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </span>
                <input
                  type="text"
                  className="combobox-input"
                  placeholder="ค้นหาด้วยชื่อ, นามสกุล, HN, เลขคิว หรือคลิกลูกศรเพื่อเลือกผู้ป่วย..."
                  value={searchQuery}
                  onClick={() => onToggleQueueDropdown(true)}
                  onChange={(e) => {
                    onSearchQueryChange(e.target.value);
                    if (!isQueueDropdownOpen) onToggleQueueDropdown(true);
                  }}
                  onFocus={(e) => {
                    onToggleQueueDropdown(true);
                    if (searchQuery.includes(' - ') || searchQuery.includes('HN:') || searchQuery.includes('มาถึง')) {
                      e.target.select();
                    }
                  }}
                  aria-label="ค้นหาคิวผู้ป่วย"
                />
                {(searchQuery || selectedPatient) && (
                  <button
                    type="button"
                    className="combobox-clear-btn"
                    onClick={() => {
                      onSearchQueryChange('');
                      onResetSelection();
                      onToggleQueueDropdown(true);
                    }}
                    title="ล้างคำค้นหา / ดูคิวทั้งหมด"
                  >
                    ✕
                  </button>
                )}
                <button
                  type="button"
                  className={`combobox-toggle-btn ${isQueueDropdownOpen ? 'open' : ''}`}
                  onClick={() => onToggleQueueDropdown(!isQueueDropdownOpen)}
                  title="เปิด/ปิด รายการคิว"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>

              {/* Dropdown Options Menu */}
              {isQueueDropdownOpen && (
                <div className="combobox-dropdown-menu">
                  <div className="combobox-menu-header">
                    <span>ผู้ป่วยที่รอคัดกรอง ({filteredWaitingQueues.length} คิว)</span>
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSearchQueryChange('');
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#2563EB',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          padding: 0
                        }}
                      >
                        แสดงคิวทั้งหมด ({waitingCount} คิว)
                      </button>
                    )}
                  </div>
                  <div className="combobox-options-list">
                    {filteredWaitingQueues.length > 0 ? (
                      filteredWaitingQueues.map((patient) => {
                        const isSelected = selectedPatient?.id === patient.id;
                        return (
                          <div
                            key={patient.id}
                            className={`combobox-option-item ${isSelected ? 'selected' : ''}`}
                            onClick={() => onSelectPatient(patient)}
                          >
                            <div className="option-item-left">
                              <span className="option-queue-badge">{patient.queueNo}</span>
                              <div className="option-patient-info">
                                <span className="option-patient-name">{patient.fullName}</span>
                                <span className="option-patient-meta">
                                  HN: {patient.hn} • {patient.gender}, {patient.age} ปี • {patient.schemeType}
                                </span>
                              </div>
                            </div>
                            <div className="option-item-right">
                              <span className="option-arrival-time">{patient.registeredTime}</span>
                              {isSelected ? (
                                <span className="option-selected-tag">
                                  <svg width="11" height="11" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                  เลือกอยู่
                                </span>
                              ) : (
                                <span className="option-select-action">เลือก</span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="combobox-empty-item" style={{ padding: '20px 16px', textAlign: 'center' }}>
                        {searchQuery ? (
                          <>
                            <div style={{ color: '#64748B', fontSize: '13px', marginBottom: '10px' }}>
                              ไม่พบคิวผู้ป่วยที่ตรงกับคำค้นหา "{searchQuery}"
                            </div>
                            <button
                              type="button"
                              onClick={() => onSearchQueryChange('')}
                              style={{
                                background: '#EFF6FF',
                                color: '#2563EB',
                                border: '1px solid #BFDBFE',
                                borderRadius: '8px',
                                padding: '6px 16px',
                                fontSize: '13px',
                                fontWeight: '700',
                                cursor: 'pointer'
                              }}
                            >
                              คลิกดูคิวที่รอคัดกรองทั้งหมด ({waitingCount} คิว)
                            </button>
                          </>
                        ) : (
                          <div style={{ color: '#64748B', fontSize: '13px', padding: '8px 0' }}>
                            ไม่มีคิวรอรับบริการในขณะนี้
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Selected Patient Compact Summary */}
            {selectedPatient && (
              <div className="patient-compact-strip">
                <div className="patient-compact-left">
                  <span className="patient-compact-badge">{selectedPatient.queueNo}</span>
                  <span className="patient-compact-name">{selectedPatient.fullName}</span>
                  <span className="patient-compact-divider">•</span>
                  <span className="patient-compact-hn">HN: {selectedPatient.hn}</span>
                  <span className="patient-compact-divider">•</span>
                  <span className="patient-compact-meta">เพศ {selectedPatient.gender}, {selectedPatient.age} ปี</span>
                  <span className="patient-compact-divider">•</span>
                  <span className="patient-compact-scheme">{selectedPatient.schemeType}</span>
                </div>
              </div>
            )}
          </div>
          {/* Section 2: Physical Measurements */}
          <div className="vitals-form-section">
            <div className="vitals-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="vitals-section-num">2</span>
                <span className="vitals-section-title">สรีรวิทยาและสัญญาณชีพพื้นฐาน (Physical & Vitals)</span>
              </div>
              {onRandomVitals && (
                <button
                  type="button"
                  className="vitals-random-btn"
                  onClick={onRandomVitals}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: '#EFF6FF',
                    color: '#2563EB',
                    border: '1px solid #BFDBFE',
                    padding: '6px 14px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  title="สุ่มกรอกข้อมูลสัญญาณชีพและอาการสำคัญสำหรับการทดสอบ"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"></circle>
                    <circle cx="15.5" cy="8.5" r="1.5" fill="currentColor"></circle>
                    <circle cx="15.5" cy="15.5" r="1.5" fill="currentColor"></circle>
                    <circle cx="8.5" cy="15.5" r="1.5" fill="currentColor"></circle>
                    <circle cx="12" cy="12" r="1.5" fill="currentColor"></circle>
                  </svg>
                  <span>สุ่มข้อมูลสัญญาณชีพ</span>
                </button>
              )}
            </div>

            <div className="vitals-grid-3">
              {/* Weight */}
              <div className="vitals-form-group">
                <label className="vitals-form-label">
                  <span className="vitals-label-title">น้ำหนัก (Weight) <span className="text-required">*</span></span>
                </label>
                <div className="vitals-input-suffix-wrap">
                  <input
                    type="text"
                    inputMode="decimal"
                    className={`vitals-input ${formErrors.weight ? 'input-danger' : ''}`}
                    placeholder="เช่น 65.5"
                    value={weight}
                    onChange={(e) => onChangeField('weight', e.target.value)}
                  />
                  <span className="vitals-input-suffix">kg</span>
                </div>
                {formErrors.weight && (
                  <span className="input-error-hint" style={{ color: '#DC2626', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                    {formErrors.weight}
                  </span>
                )}
              </div>

              {/* Height */}
              <div className="vitals-form-group">
                <label className="vitals-form-label">
                  <span className="vitals-label-title">ส่วนสูง (Height) <span className="text-required">*</span></span>
                </label>
                <div className="vitals-input-suffix-wrap">
                  <input
                    type="text"
                    inputMode="decimal"
                    className={`vitals-input ${formErrors.height ? 'input-danger' : ''}`}
                    placeholder="เช่น 170"
                    value={height}
                    onChange={(e) => onChangeField('height', e.target.value)}
                  />
                  <span className="vitals-input-suffix">cm</span>
                </div>
                {formErrors.height && (
                  <span className="input-error-hint" style={{ color: '#DC2626', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                    {formErrors.height}
                  </span>
                )}
              </div>

              {/* Body Temperature */}
              <div className="vitals-form-group">
                <label className="vitals-form-label">
                  <span className="vitals-label-title">อุณหภูมิ (Temp) <span className="text-required">*</span></span>
                  {isHighFever && <span className="clinical-badge badge-high-fever">ไข้สูง!</span>}
                  {isFever && !isHighFever && <span className="clinical-badge badge-fever">มีไข้</span>}
                </label>
                <div className="vitals-input-suffix-wrap">
                  <input
                    type="text"
                    inputMode="decimal"
                    className={`vitals-input ${formErrors.temperature ? 'input-danger' : isHighFever ? 'input-danger' : isFever ? 'input-warning' : ''}`}
                    placeholder="เช่น 36.8"
                    value={temperature}
                    onChange={(e) => onChangeField('temperature', e.target.value)}
                  />
                  <span className="vitals-input-suffix">°C</span>
                </div>
                {formErrors.temperature && (
                  <span className="input-error-hint" style={{ color: '#DC2626', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                    {formErrors.temperature}
                  </span>
                )}
              </div>
            </div>

            {/* Row 2: Blood Pressure & Heart Rate */}
            <div className="vitals-grid-3">
              {/* Systolic BP */}
              <div className="vitals-form-group">
                <label className="vitals-form-label">
                  <span className="vitals-label-title">ความดันตัวบน (Systolic) <span className="text-required">*</span></span>
                  {isCrisisBP ? (
                    <span className="clinical-badge badge-crisis">วิกฤต!</span>
                  ) : isHighBP ? (
                    <span className="clinical-badge badge-warning">ความดันสูง</span>
                  ) : null}
                </label>
                <div className="vitals-input-suffix-wrap">
                  <input
                    type="text"
                    inputMode="numeric"
                    className={`vitals-input ${formErrors.systolicBP ? 'input-danger' : isCrisisBP ? 'input-danger' : isHighBP ? 'input-warning' : ''}`}
                    placeholder="เช่น 120"
                    value={systolicBP}
                    onChange={(e) => onChangeField('systolicBP', e.target.value)}
                  />
                  <span className="vitals-input-suffix">mmHg</span>
                </div>
                {formErrors.systolicBP && (
                  <span className="input-error-hint" style={{ color: '#DC2626', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                    {formErrors.systolicBP}
                  </span>
                )}
              </div>

              {/* Diastolic BP */}
              <div className="vitals-form-group">
                <label className="vitals-form-label">
                  <span className="vitals-label-title">ความดันตัวล่าง (Diastolic) <span className="text-required">*</span></span>
                </label>
                <div className="vitals-input-suffix-wrap">
                  <input
                    type="text"
                    inputMode="numeric"
                    className={`vitals-input ${formErrors.diastolicBP ? 'input-danger' : isCrisisBP ? 'input-danger' : isHighBP ? 'input-warning' : ''}`}
                    placeholder="เช่น 80"
                    value={diastolicBP}
                    onChange={(e) => onChangeField('diastolicBP', e.target.value)}
                  />
                  <span className="vitals-input-suffix">mmHg</span>
                </div>
                {formErrors.diastolicBP && (
                  <span className="input-error-hint" style={{ color: '#DC2626', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                    {formErrors.diastolicBP}
                  </span>
                )}
              </div>

              {/* Heart Rate / Pulse */}
              <div className="vitals-form-group">
                <label className="vitals-form-label">
                  <span className="vitals-label-title">ชีพจร (Pulse) <span className="text-required">*</span></span>
                  {isTachycardia && <span className="clinical-badge badge-warning">เต้นเร็ว</span>}
                  {isBradycardia && <span className="clinical-badge badge-info">เต้นช้า</span>}
                </label>
                <div className="vitals-input-suffix-wrap">
                  <input
                    type="text"
                    inputMode="numeric"
                    className={`vitals-input ${formErrors.heartRate ? 'input-danger' : isTachycardia ? 'input-warning' : ''}`}
                    placeholder="เช่น 75"
                    value={heartRate}
                    onChange={(e) => onChangeField('heartRate', e.target.value)}
                  />
                  <span className="vitals-input-suffix">bpm</span>
                </div>
                {formErrors.heartRate && (
                  <span className="input-error-hint" style={{ color: '#DC2626', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                    {formErrors.heartRate}
                  </span>
                )}
              </div>
            </div>

            {/* Row 3: Required SpO2 & Optional Respiratory Rate */}
            <div className="vitals-grid-2">
              <div className="vitals-form-group">
                <label className="vitals-form-label">
                  <span className="vitals-label-title">ออกซิเจนในเลือด (SpO2) <span className="text-required">*</span></span>
                </label>
                <div className="vitals-input-suffix-wrap">
                  <input
                    type="text"
                    inputMode="numeric"
                    className={`vitals-input ${formErrors.spo2 ? 'input-danger' : ''}`}
                    placeholder="เช่น 98"
                    value={spo2}
                    onChange={(e) => onChangeField('spo2', e.target.value)}
                  />
                  <span className="vitals-input-suffix">%</span>
                </div>
                {formErrors.spo2 && (
                  <span className="input-error-hint" style={{ color: '#DC2626', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                    {formErrors.spo2}
                  </span>
                )}
              </div>

              <div className="vitals-form-group">
                <label className="vitals-form-label">
                  <span className="vitals-label-title">อัตราการหายใจ (Respiratory Rate)</span>
                </label>
                <div className="vitals-input-suffix-wrap">
                  <input
                    type="text"
                    inputMode="numeric"
                    className={`vitals-input ${formErrors.respiratoryRate ? 'input-danger' : ''}`}
                    placeholder="เช่น 18"
                    value={respiratoryRate}
                    onChange={(e) => onChangeField('respiratoryRate', e.target.value)}
                  />
                  <span className="vitals-input-suffix">ครั้ง/นาที</span>
                </div>
                {formErrors.respiratoryRate && (
                  <span className="input-error-hint" style={{ color: '#DC2626', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                    {formErrors.respiratoryRate}
                  </span>
                )}
              </div>
            </div>

            {/* Row 4: Pain Score & Blood Sugar (DTX) */}
            <div className="vitals-grid-2">
              <div className="vitals-form-group">
                <label className="vitals-form-label">
                  <span className="vitals-label-title">ระดับความเจ็บปวด (Pain Score)</span>
                </label>
                <div className="vitals-input-suffix-wrap">
                  <input
                    type="text"
                    inputMode="numeric"
                    className={`vitals-input ${formErrors.painScore ? 'input-danger' : ''}`}
                    placeholder="เช่น 0 - 10"
                    value={painScore}
                    onChange={(e) => onChangeField('painScore', e.target.value)}
                  />
                  <span className="vitals-input-suffix">/10</span>
                </div>
                {formErrors.painScore && (
                  <span className="input-error-hint" style={{ color: '#DC2626', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                    {formErrors.painScore}
                  </span>
                )}
              </div>

              <div className="vitals-form-group">
                <label className="vitals-form-label">
                  <span className="vitals-label-title">ระดับน้ำตาลในเลือด (Blood Sugar / DTX)</span>
                </label>
                <div className="vitals-input-suffix-wrap">
                  <input
                    type="text"
                    inputMode="numeric"
                    className={`vitals-input ${formErrors.bloodSugar ? 'input-danger' : ''}`}
                    placeholder="เช่น 100"
                    value={bloodSugar}
                    onChange={(e) => onChangeField('bloodSugar', e.target.value)}
                  />
                  <span className="vitals-input-suffix">mg/dL</span>
                </div>
                {formErrors.bloodSugar && (
                  <span className="input-error-hint" style={{ color: '#DC2626', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                    {formErrors.bloodSugar}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Clinical Symptoms & Medical History */}
          <div className="vitals-form-section">
            <div className="vitals-section-header">
              <span className="vitals-section-num">3</span>
              <span className="vitals-section-title">ประวัติทางการแพทย์ แพ้ยา และพฤติกรรมสุขภาพ (Clinical & Social History)</span>
            </div>

            {/* Chief Complaint */}
            <div className="vitals-form-group">
              <label className="vitals-form-label">
                อาการสำคัญ ณ วันที่เข้ารับบริการ (Chief Complaint) <span className="text-required">*</span>
              </label>
              <textarea
                className="vitals-textarea"
                rows={3}
                placeholder="ระบุอาการสำคัญ เช่น ปวดศีรษะข้างขวามา 2 วัน มีไข้ หนาวสั่น หรือมาตามนัดติดตามอาการ..."
                value={chiefComplaint}
                onChange={(e) => onChangeField('chiefComplaint', e.target.value)}
                required
              ></textarea>
            </div>

            {/* Allergies: Drug & Food Allergies Grid */}
            <div className="vitals-grid-2">
              <div className="vitals-form-group">
                <label className="vitals-form-label">
                  ประวัติการแพ้ยา (Drug Allergies)
                  {hasAllergy && (
                    <span className="clinical-badge badge-allergy-alert">
                      <svg viewBox="0 0 20 20" width="12" height="12" fill="currentColor" style={{ marginRight: '4px' }}>
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      มีประวัติแพ้ยา
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  className={`vitals-input ${hasAllergy ? 'input-allergy' : ''}`}
                  placeholder="เช่น แพ้ยา Penicillin (ผื่นคัน, ลมพิษ) หรือ ปฏิเสธการแพ้ยา"
                  value={allergies}
                  onChange={(e) => onChangeField('allergies', e.target.value)}
                />
              </div>

              <div className="vitals-form-group">
                <label className="vitals-form-label">
                  ประวัติการแพ้อาหาร (Food Allergies)
                </label>
                <input
                  type="text"
                  className="vitals-input"
                  placeholder="เช่น กุ้ง, อาหารทะเล, ถั่วลิสง หรือ ปฏิเสธการแพ้อาหาร"
                  value={foodAllergies}
                  onChange={(e) => onChangeField('foodAllergies', e.target.value)}
                />
              </div>
            </div>

            {/* Chronic Diseases & Current Medications Grid */}
            <div className="vitals-grid-2" style={{ marginTop: '12px' }}>
              <div className="vitals-form-group">
                <label className="vitals-form-label">โรคประจำตัว (Chronic / Underlying Diseases)</label>
                <input
                  type="text"
                  className="vitals-input"
                  placeholder="เช่น ความดันโลหิตสูง, เบาหวาน, โรคหัวใจ หรือ ไม่มี"
                  value={medicalHistory}
                  onChange={(e) => onChangeField('medicalHistory', e.target.value)}
                />
              </div>

              <div className="vitals-form-group">
                <label className="vitals-form-label">ยาที่รับประทานประจำ (Current Medications)</label>
                <input
                  type="text"
                  className="vitals-input"
                  placeholder="เช่น Amlodipine 5mg tab 1x daily (Morning) หรือ ไม่มี"
                  value={currentMedications}
                  onChange={(e) => onChangeField('currentMedications', e.target.value)}
                />
              </div>
            </div>

            {/* Social Habits: Smoking & Alcohol History Grid */}
            <div className="vitals-grid-2" style={{ marginTop: '12px' }}>
              <div className="vitals-form-group">
                <label className="vitals-form-label">ประวัติการสูบบุหรี่ (Smoking History)</label>
                <input
                  type="text"
                  className="vitals-input"
                  placeholder="เช่น ไม่สูบ, สูบบุหรี่ (10 มวน/วัน 5 ปี) หรือ เลิกสูบแล้ว"
                  value={smokingHistory}
                  onChange={(e) => onChangeField('smokingHistory', e.target.value)}
                />
              </div>

              <div className="vitals-form-group">
                <label className="vitals-form-label">ประวัติการดื่มแอลกอฮอล์ (Alcohol History)</label>
                <input
                  type="text"
                  className="vitals-input"
                  placeholder="เช่น ไม่ดื่ม, ดื่มแอลกอฮอล์ (2-3 ครั้ง/สัปดาห์ 8 ปี) หรือ เลิกดื่มแล้ว"
                  value={alcoholHistory}
                  onChange={(e) => onChangeField('alcoholHistory', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Section 4: Additional Screening (EXPAND-1) */}
          <div className="vitals-form-section">
            <div className="vitals-section-header">
              <span className="vitals-section-num">4</span>
              <span className="vitals-section-title">ข้อมูลคัดกรองเพิ่มเติม (Additional Screening)</span>
            </div>

            <div className="vitals-advanced-screening-wrap">
              {/* A1. บันทึกพยาบาล */}
              <div className="vitals-form-group">
                <label className="vitals-form-label">
                  บันทึกการคัดกรองเบื้องต้นจากพยาบาล (Nurse Notes)
                </label>
                <textarea
                  className="vitals-input"
                  style={{ minHeight: '64px', resize: 'vertical' }}
                  rows={2}
                  placeholder="บันทึกข้อสังเกตเพิ่มเติม หรือข้อมูลสำคัญที่ต้องการแจ้งแพทย์..."
                  value={nurseNotes}
                  onChange={(e) => onChangeField('nurseNotes', e.target.value)}
                />
              </div>

              {/* A2. สมุนไพรและอาหารเสริม */}
              <div className="vitals-grid-2">
                <div className="vitals-form-group">
                  <label className="vitals-form-label">สมุนไพรที่ใช้อยู่ (Herbal Medicines)</label>
                  <input
                    type="text"
                    className="vitals-input"
                    placeholder="เช่น ขมิ้นชัน, น้ำมันปลา, โสม, ฟ้าทะลายโจร"
                    value={herbalMedicines}
                    onChange={(e) => onChangeField('herbalMedicines', e.target.value)}
                  />
                </div>
                <div className="vitals-form-group">
                  <label className="vitals-form-label">ผลิตภัณฑ์เสริมอาหาร (Dietary Supplements)</label>
                  <input
                    type="text"
                    className="vitals-input"
                    placeholder="เช่น วิตามิน C, แคลเซียม, คอลลาเจน, วิตามินรวม"
                    value={dietarySupplements}
                    onChange={(e) => onChangeField('dietarySupplements', e.target.value)}
                  />
                </div>
              </div>

              {/* A3. ความเสี่ยงติดเชื้อและการป้องกัน */}
              <div className="vitals-screening-subcard">
                <div className="vitals-subcard-header">
                  <div className="vitals-subcard-title">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="vitals-subcard-icon">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>ความเสี่ยงติดเชื้อ & มาตรการป้องกัน (Infection Risk & Precautions)</span>
                  </div>
                </div>

                <div className="vitals-grid-2">
                  <div className="vitals-form-group">
                    <label className="vitals-form-label">ติดเชื้อทางเดินหายใจส่วนบน (URI)</label>
                    <div className="vitals-tristate-group">
                      <button
                        type="button"
                        className={`vitals-tristate-btn ${hasURI === null ? 'active unassessed' : ''}`}
                        onClick={() => onChangeField('hasURI', null)}
                      >
                        ยังไม่ประเมิน
                      </button>
                      <button
                        type="button"
                        className={`vitals-tristate-btn ${hasURI === true ? 'active yes' : ''}`}
                        onClick={() => onChangeField('hasURI', true)}
                      >
                        มีอาการ
                      </button>
                      <button
                        type="button"
                        className={`vitals-tristate-btn ${hasURI === false ? 'active no' : ''}`}
                        onClick={() => onChangeField('hasURI', false)}
                      >
                        ไม่มีอาการ
                      </button>
                    </div>
                  </div>

                  <div className="vitals-form-group">
                    <label className="vitals-form-label">คัดกรองวัณโรค (TB)</label>
                    <div className="vitals-tristate-group">
                      <button
                        type="button"
                        className={`vitals-tristate-btn ${hasTB === null ? 'active unassessed' : ''}`}
                        onClick={() => onChangeField('hasTB', null)}
                      >
                        ยังไม่ประเมิน
                      </button>
                      <button
                        type="button"
                        className={`vitals-tristate-btn ${hasTB === true ? 'active yes' : ''}`}
                        onClick={() => onChangeField('hasTB', true)}
                      >
                        มีอาการ
                      </button>
                      <button
                        type="button"
                        className={`vitals-tristate-btn ${hasTB === false ? 'active no' : ''}`}
                        onClick={() => onChangeField('hasTB', false)}
                      >
                        ไม่มีอาการ
                      </button>
                    </div>
                  </div>
                </div>

                <div className="vitals-form-group" style={{ marginTop: '2px' }}>
                  <label className="vitals-form-label">ระดับการแยกโรค (Isolation Precaution)</label>
                  <select
                    className="vitals-select"
                    value={precautionType}
                    onChange={(e) => onChangeField('precautionType', e.target.value)}
                  >
                    <option value="">ยังไม่ระบุ (None)</option>
                    <option value="Standard">Standard — ปฏิบัติมาตรฐานทั่วไป</option>
                    <option value="Contact">Contact — สัมผัส (ถุงมือ/เสื้อกาวน์)</option>
                    <option value="Droplet">Droplet — ละอองฝอย (หน้ากากอนามัย)</option>
                    <option value="Airborne">Airborne — ทางอากาศ (N95 แยกห้อง)</option>
                  </select>
                </div>
              </div>

              {/* A4. ยาละลายลิ่มเลือด */}
              <div className="vitals-screening-subcard">
                <div className="vitals-subcard-header">
                  <div className="vitals-subcard-title">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="vitals-subcard-icon">
                      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0016.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 002 8.5c0 2.3 1.5 4.05 3 5.5l7 7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>การใช้ยาละลายลิ่มเลือด / ยาต้านเกล็ดเลือด (On Anticoagulant)</span>
                  </div>
                </div>

                <div style={{ maxWidth: '340px' }}>
                  <div className="vitals-tristate-group">
                    <button
                      type="button"
                      className={`vitals-tristate-btn ${onAnticoagulant === null ? 'active unassessed' : ''}`}
                      onClick={() => onChangeField('onAnticoagulant', null)}
                    >
                      ยังไม่ประเมิน
                    </button>
                    <button
                      type="button"
                      className={`vitals-tristate-btn ${onAnticoagulant === true ? 'active custom-anticoag' : ''}`}
                      onClick={() => onChangeField('onAnticoagulant', true)}
                    >
                      ใช้อยู่
                    </button>
                    <button
                      type="button"
                      className={`vitals-tristate-btn ${onAnticoagulant === false ? 'active no' : ''}`}
                      onClick={() => onChangeField('onAnticoagulant', false)}
                    >
                      ไม่ได้ใช้
                    </button>
                  </div>
                </div>

                {onAnticoagulant === true && (
                  <div className="vitals-banner-warning">
                    <svg className="vitals-banner-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <div>
                      <strong>ข้อควรระวัง:</strong> ผู้ป่วยใช้ยาละลายลิ่มเลือด โปรดระวังการเจาะเลือดและหัตถการที่มีเลือดออก
                    </div>
                  </div>
                )}
              </div>

              {/* A5. คัดกรองเพศหญิง (Female Screening) */}
              {selectedPatient?.gender === 'หญิง' && (
                <div className="vitals-screening-subcard">
                  <div className="vitals-subcard-header">
                    <div className="vitals-subcard-title">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="vitals-subcard-icon">
                        <path d="M12 14a5 5 0 100-10 5 5 0 000 10zm0 0v7m-3-3h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span>คัดกรองเฉพาะผู้ป่วยหญิง (Female Screening)</span>
                    </div>
                  </div>

                  <div className="vitals-grid-2">
                    <div className="vitals-form-group">
                      <label className="vitals-form-label">ภาวะตั้งครรภ์ (Pregnancy)</label>
                      <div className="vitals-tristate-group">
                        <button
                          type="button"
                          className={`vitals-tristate-btn ${isPregnant === null ? 'active unassessed' : ''}`}
                          onClick={() => onChangeField('isPregnant', null)}
                        >
                          ยังไม่ประเมิน
                        </button>
                        <button
                          type="button"
                          className={`vitals-tristate-btn ${isPregnant === true ? 'active custom-pregnant' : ''}`}
                          onClick={() => onChangeField('isPregnant', true)}
                        >
                          ตั้งครรภ์
                        </button>
                        <button
                          type="button"
                          className={`vitals-tristate-btn ${isPregnant === false ? 'active no' : ''}`}
                          onClick={() => onChangeField('isPregnant', false)}
                        >
                          ไม่ตั้งครรภ์
                        </button>
                      </div>
                    </div>

                    <div className="vitals-form-group">
                      <label className="vitals-form-label">การให้นมบุตร (Breastfeeding)</label>
                      <div className="vitals-tristate-group">
                        <button
                          type="button"
                          className={`vitals-tristate-btn ${isBreastfeeding === null ? 'active unassessed' : ''}`}
                          onClick={() => onChangeField('isBreastfeeding', null)}
                        >
                          ยังไม่ประเมิน
                        </button>
                        <button
                          type="button"
                          className={`vitals-tristate-btn ${isBreastfeeding === true ? 'active custom-pregnant' : ''}`}
                          onClick={() => onChangeField('isBreastfeeding', true)}
                        >
                          ให้นมบุตร
                        </button>
                        <button
                          type="button"
                          className={`vitals-tristate-btn ${isBreastfeeding === false ? 'active no' : ''}`}
                          onClick={() => onChangeField('isBreastfeeding', false)}
                        >
                          ไม่ให้นมบุตร
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="vitals-form-group" style={{ maxWidth: '340px', marginTop: '2px' }}>
                    <label className="vitals-form-label">ประจำเดือนครั้งสุดท้าย (LMP)</label>
                    <input
                      type="date"
                      className="vitals-input vitals-date-input"
                      value={lastMenstrualPeriod}
                      onChange={(e) => onChangeField('lastMenstrualPeriod', e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* A6. แบบคัดกรองภาวะซึมเศร้า 2Q */}
              <div className={`vitals-screening-subcard vitals-2q-card ${isQ2Positive ? 'positive-alert' : ''}`}>
                <div className="vitals-subcard-header">
                  <div className="vitals-subcard-title">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="vitals-subcard-icon">
                      <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>แบบคัดกรองภาวะซึมเศร้า 2 คำถาม (2Q Depression Screening)</span>
                  </div>
                </div>

                <p className="vitals-2q-desc">
                  มาตรฐานกรมสุขภาพจิต: ในช่วง 2 สัปดาห์ที่ผ่านมารวมวันนี้ ท่านมีอาการเหล่านี้หรือไม่
                </p>

                <div className="vitals-grid-2">
                  {/* ข้อ 1 */}
                  <div className="vitals-2q-item">
                    <div className="vitals-2q-question-text">
                      1. ท่านรู้สึกหดหู่ เศร้า หรือท้อแท้สิ้นหวัง หรือไม่
                    </div>
                    <div className="vitals-tristate-group">
                      <button
                        type="button"
                        className={`vitals-tristate-btn ${q2Depressed === null ? 'active unassessed' : ''}`}
                        onClick={() => onChangeField('q2Depressed', null)}
                      >
                        ยังไม่ประเมิน
                      </button>
                      <button
                        type="button"
                        className={`vitals-tristate-btn ${q2Depressed === true ? 'active yes' : ''}`}
                        onClick={() => onChangeField('q2Depressed', true)}
                      >
                        ใช่ / มี
                      </button>
                      <button
                        type="button"
                        className={`vitals-tristate-btn ${q2Depressed === false ? 'active no' : ''}`}
                        onClick={() => onChangeField('q2Depressed', false)}
                      >
                        ไม่ใช่ / ไม่มี
                      </button>
                    </div>
                  </div>

                  {/* ข้อ 2 */}
                  <div className="vitals-2q-item">
                    <div className="vitals-2q-question-text">
                      2. ท่านรู้สึกเบื่อ ทำอะไรก็ไม่เพลิดเพลิน หรือไม่
                    </div>
                    <div className="vitals-tristate-group">
                      <button
                        type="button"
                        className={`vitals-tristate-btn ${q2Anhedonia === null ? 'active unassessed' : ''}`}
                        onClick={() => onChangeField('q2Anhedonia', null)}
                      >
                        ยังไม่ประเมิน
                      </button>
                      <button
                        type="button"
                        className={`vitals-tristate-btn ${q2Anhedonia === true ? 'active yes' : ''}`}
                        onClick={() => onChangeField('q2Anhedonia', true)}
                      >
                        ใช่ / มี
                      </button>
                      <button
                        type="button"
                        className={`vitals-tristate-btn ${q2Anhedonia === false ? 'active no' : ''}`}
                        onClick={() => onChangeField('q2Anhedonia', false)}
                      >
                        ไม่ใช่ / ไม่มี
                      </button>
                    </div>
                  </div>
                </div>

                {isQ2Positive && (
                  <div className="vitals-banner-positive">
                    <svg className="vitals-banner-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <div>
                      <strong>ผลการคัดกรอง 2Q เป็นบวก (Positive):</strong> พบความเสี่ยงภาวะซึมเศร้า แนะนำให้แพทย์ประเมินเพิ่มเติม (แบบประเมิน 9Q)
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 5: Destination Routing */}
          <div className="vitals-form-section">
            <div className="vitals-section-header">
              <span className="vitals-section-num">5</span>
              <span className="vitals-section-title">ส่งต่อห้องตรวจแพทย์ (Forward to Doctor Room)</span>
            </div>

            <div className="vitals-form-group">
              <label className="vitals-form-label">
                เลือกห้องตรวจ / แพทย์ผู้รับตรวจ <span className="text-required">*</span>
              </label>
              <select
                className="vitals-select"
                value={assignedDoctorId}
                onChange={(e) => onChangeField('assignedDoctorId', Number(e.target.value))}
                required
                disabled={doctorOptions.length === 0}
              >
                {doctorOptions.length === 0 ? (
                  <option value="">กำลังโหลดรายชื่อแพทย์...</option>
                ) : (
                  doctorOptions.map((doc) => (
                    <option key={doc.doctorId} value={doc.doctorId}>
                      {doc.roomName} — {doc.fullName} ({doc.specialty})
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* Form Actions */}
          <div className="vitals-form-actions">
            <button
              type="submit"
              className="vitals-btn-submit"
              disabled={isSaving || !selectedPatient}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M5 13l4 4L19 7"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {isSaving ? 'กำลังบันทึกข้อมูล...' : 'บันทึกข้อมูลการคัดกรอง (Save & Forward)'}
            </button>

            <button
              type="button"
              className="vitals-btn-reset"
              onClick={onReset}
              disabled={isSaving}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              ล้างฟอร์ม (Reset)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
