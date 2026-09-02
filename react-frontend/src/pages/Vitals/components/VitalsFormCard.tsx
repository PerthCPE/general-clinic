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
  assignedDoctorId: number;
  doctorOptions: DoctorOption[];
  isAccordionOpen: boolean;
  onToggleAccordion: () => void;
  onChangeField: (field: string, value: string | number) => void;
  onSubmit: (e: React.FormEvent) => void;
  onReset: () => void;
  isSaving: boolean;
  savedDraftTime?: string | null;
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
  assignedDoctorId,
  doctorOptions,
  isAccordionOpen,
  onToggleAccordion,
  onChangeField,
  onSubmit,
  onReset,
  isSaving,
  savedDraftTime,
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
                    <path
                      d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <input
                  id="queue-select-input"
                  name="queue_patient_search_no_autofill"
                  type="text"
                  className="combobox-input"
                  placeholder="พิมพ์ค้นหาด้วยเลขคิว (เช่น Q0001), ชื่อผู้ป่วย, HN (เช่น HN0001), หรือเลขบัตรประชาชน..."
                  value={searchQuery}
                  onFocus={() => onToggleQueueDropdown(true)}
                  onClick={() => onToggleQueueDropdown(true)}
                  onChange={(e) => onSearchQueryChange(e.target.value)}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                  data-form-type="other"
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="combobox-clear-btn"
                    onClick={() => {
                      onSearchQueryChange('');
                      onResetSelection();
                      onToggleQueueDropdown(true);
                    }}
                    title="ล้างการค้นหา"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
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
                    {searchQuery && <span className="search-hint">คลิกเลือกผู้ป่วย</span>}
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
                      <div className="combobox-empty-item">
                        <span>ไม่พบคิวผู้ป่วยที่ตรงกับคำค้นหา "{searchQuery}"</span>
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
            <div className="vitals-section-header">
              <span className="vitals-section-num">2</span>
              <span className="vitals-section-title">สรีรวิทยาและสัญญาณชีพพื้นฐาน (Physical & Vitals)</span>
            </div>

            <div className="vitals-grid-3">
              {/* Weight */}
              <div className="vitals-form-group">
                <label className="vitals-form-label">
                  <span className="vitals-label-title">น้ำหนัก (Weight) <span className="text-required">*</span></span>
                </label>
                <div className="vitals-input-suffix-wrap">
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="300"
                    className="vitals-input"
                    placeholder="เช่น 65.5"
                    value={weight}
                    onChange={(e) => onChangeField('weight', e.target.value)}
                    required
                  />
                  <span className="vitals-input-suffix">kg</span>
                </div>
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
                    className="vitals-input"
                    placeholder="เช่น 170"
                    value={height}
                    onChange={(e) => onChangeField('height', e.target.value)}
                    required
                  />
                  <span className="vitals-input-suffix">cm</span>
                </div>
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
                    type="number"
                    step="0.1"
                    min="30"
                    max="45"
                    className={`vitals-input ${isHighFever ? 'input-danger' : isFever ? 'input-warning' : ''}`}
                    placeholder="เช่น 36.8"
                    value={temperature}
                    onChange={(e) => onChangeField('temperature', e.target.value)}
                    required
                  />
                  <span className="vitals-input-suffix">°C</span>
                </div>
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
                    type="number"
                    min="50"
                    max="300"
                    className={`vitals-input ${isCrisisBP ? 'input-danger' : isHighBP ? 'input-warning' : ''}`}
                    placeholder="เช่น 120"
                    value={systolicBP}
                    onChange={(e) => onChangeField('systolicBP', e.target.value)}
                    required
                  />
                  <span className="vitals-input-suffix">mmHg</span>
                </div>
              </div>

              {/* Diastolic BP */}
              <div className="vitals-form-group">
                <label className="vitals-form-label">
                  <span className="vitals-label-title">ความดันตัวล่าง (Diastolic) <span className="text-required">*</span></span>
                </label>
                <div className="vitals-input-suffix-wrap">
                  <input
                    type="number"
                    min="30"
                    max="200"
                    className={`vitals-input ${isCrisisBP ? 'input-danger' : isHighBP ? 'input-warning' : ''}`}
                    placeholder="เช่น 80"
                    value={diastolicBP}
                    onChange={(e) => onChangeField('diastolicBP', e.target.value)}
                    required
                  />
                  <span className="vitals-input-suffix">mmHg</span>
                </div>
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
                    type="number"
                    min="30"
                    max="220"
                    className={`vitals-input ${isTachycardia ? 'input-warning' : ''}`}
                    placeholder="เช่น 75"
                    value={heartRate}
                    onChange={(e) => onChangeField('heartRate', e.target.value)}
                    required
                  />
                  <span className="vitals-input-suffix">bpm</span>
                </div>
              </div>
            </div>

            {/* Row 3: Optional Clinical Metrics (SpO2, Respiratory Rate) */}
            <div className="vitals-grid-2">
              <div className="vitals-form-group">
                <label className="vitals-form-label">
                  <span className="vitals-label-title">ออกซิเจนในเลือด (SpO2)</span>
                </label>
                <div className="vitals-input-suffix-wrap">
                  <input
                    type="number"
                    min="50"
                    max="100"
                    className="vitals-input"
                    placeholder="เช่น 98"
                    value={spo2}
                    onChange={(e) => onChangeField('spo2', e.target.value)}
                  />
                  <span className="vitals-input-suffix">%</span>
                </div>
              </div>

              <div className="vitals-form-group">
                <label className="vitals-form-label">
                  <span className="vitals-label-title">อัตราการหายใจ (Respiratory Rate)</span>
                </label>
                <div className="vitals-input-suffix-wrap">
                  <input
                    type="number"
                    min="8"
                    max="60"
                    className="vitals-input"
                    placeholder="เช่น 18"
                    value={respiratoryRate}
                    onChange={(e) => onChangeField('respiratoryRate', e.target.value)}
                  />
                  <span className="vitals-input-suffix">ครั้ง/นาที</span>
                </div>
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
                    type="number"
                    min="0"
                    max="10"
                    className="vitals-input"
                    placeholder="เช่น 0 - 10"
                    value={painScore}
                    onChange={(e) => onChangeField('painScore', e.target.value)}
                  />
                  <span className="vitals-input-suffix">/10</span>
                </div>
              </div>

              <div className="vitals-form-group">
                <label className="vitals-form-label">
                  <span className="vitals-label-title">ระดับน้ำตาลในเลือด (Blood Sugar / DTX)</span>
                </label>
                <div className="vitals-input-suffix-wrap">
                  <input
                    type="number"
                    min="20"
                    max="600"
                    className="vitals-input"
                    placeholder="เช่น 105"
                    value={bloodSugar}
                    onChange={(e) => onChangeField('bloodSugar', e.target.value)}
                  />
                  <span className="vitals-input-suffix">mg/dL</span>
                </div>
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

          {/* Section 4: Destination Routing */}
          <div className="vitals-form-section">
            <div className="vitals-section-header">
              <span className="vitals-section-num">4</span>
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
              >
                {doctorOptions.map((doc) => (
                  <option key={doc.doctorId} value={doc.doctorId}>
                    {doc.roomName} — {doc.fullName} ({doc.specialty})
                  </option>
                ))}
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
