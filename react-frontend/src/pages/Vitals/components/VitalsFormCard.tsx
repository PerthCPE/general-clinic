import React from 'react';
import type { DoctorOption, QueuePatientItem } from '../types';

interface VitalsFormCardProps {
  selectedPatient: QueuePatientItem | null;
  weight: string;
  height: string;
  temperature: string;
  systolicBP: string;
  diastolicBP: string;
  heartRate: string;
  respiratoryRate: string;
  spo2: string;
  chiefComplaint: string;
  allergies: string;
  medicalHistory: string;
  assignedDoctorId: number;
  doctorOptions: DoctorOption[];
  isAccordionOpen: boolean;
  onToggleAccordion: () => void;
  onChangeField: (field: string, value: string | number) => void;
  onSubmit: (e: React.FormEvent) => void;
  onReset: () => void;
  isSaving: boolean;
}

export const VitalsFormCard: React.FC<VitalsFormCardProps> = ({
  selectedPatient,
  weight,
  height,
  temperature,
  systolicBP,
  diastolicBP,
  heartRate,
  respiratoryRate,
  spo2,
  chiefComplaint,
  allergies,
  medicalHistory,
  assignedDoctorId,
  doctorOptions,
  isAccordionOpen,
  onToggleAccordion,
  onChangeField,
  onSubmit,
  onReset,
  isSaving,
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

  return (
    <div className="vitals-card">
      <div className="vitals-card-header" onClick={onToggleAccordion}>
        <div className="vitals-header-title-wrap">
          <div className="vitals-header-icon-box green-box">
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
            <h2 className="vitals-card-title">Record Vital Signs (บันทึกสัญญาณชีพ)</h2>
            <p className="vitals-card-subtitle">
              กรอกข้อมูลการตรวจวัดสัญญาณชีพและประวัติอาการสำคัญของผู้ป่วย
            </p>
          </div>
        </div>

        <div className="vitals-header-actions">
          {selectedPatient ? (
            <span className="vitals-status-pill green-pill">
              <span className="pulse-dot"></span>
              คิว {selectedPatient.queueNo} ({selectedPatient.fullName})
            </span>
          ) : (
            <span className="vitals-status-pill yellow-pill">
              โปรดเลือกคิวคนไข้
            </span>
          )}

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
          {/* Section 1: Physical Measurements */}
          <div className="vitals-form-section">
            <div className="vitals-section-header">
              <span className="vitals-section-num">1</span>
              <span className="vitals-section-title">สรีรวิทยาและสัญญาณชีพพื้นฐาน (Physical & Vitals)</span>
            </div>

            <div className="vitals-grid-3">
              {/* Weight */}
              <div className="vitals-form-group">
                <label className="vitals-form-label">
                  น้ำหนัก (Weight) <span className="text-required">*</span>
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
                  ส่วนสูง (Height) <span className="text-required">*</span>
                </label>
                <div className="vitals-input-suffix-wrap">
                  <input
                    type="number"
                    step="0.5"
                    min="30"
                    max="250"
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
                  อุณหภูมิร่างกาย (Temp) <span className="text-required">*</span>
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
                  ความดันโลหิตตัวบน (Systolic) <span className="text-required">*</span>
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
                  ความดันโลหิตตัวล่าง (Diastolic) <span className="text-required">*</span>
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
                  ชีพจร (Heart Rate / Pulse) <span className="text-required">*</span>
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
                <label className="vitals-form-label">ออกซิเจนในเลือด (SpO2)</label>
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
                <label className="vitals-form-label">อัตราการหายใจ (Respiratory Rate)</label>
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
          </div>

          {/* Section 2: Clinical Symptoms & Medical History */}
          <div className="vitals-form-section">
            <div className="vitals-section-header">
              <span className="vitals-section-num">2</span>
              <span className="vitals-section-title">อาการสำคัญและประวัติทางการแพทย์ (Clinical History)</span>
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

            {/* Allergies & Chronic Diseases Grid */}
            <div className="vitals-grid-2">
              <div className="vitals-form-group">
                <label className="vitals-form-label">
                  ประวัติการแพ้ยา (Allergies)
                  {hasAllergy && <span className="clinical-badge badge-allergy-alert">⚠️ มีประวัติแพ้ยา</span>}
                </label>
                <input
                  type="text"
                  className={`vitals-input ${hasAllergy ? 'input-allergy' : ''}`}
                  placeholder="เช่น แพ้ยา Penicillin, Sulfa หรือ ปฏิเสธการแพ้ยา"
                  value={allergies}
                  onChange={(e) => onChangeField('allergies', e.target.value)}
                />
              </div>

              <div className="vitals-form-group">
                <label className="vitals-form-label">โรคประจำตัว (Medical History / Chronic Diseases)</label>
                <input
                  type="text"
                  className="vitals-input"
                  placeholder="เช่น ความดันโลหิตสูง, เบาหวาน, โรคหัวใจ หรือ ไม่มี"
                  value={medicalHistory}
                  onChange={(e) => onChangeField('medicalHistory', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Section 3: Destination Routing */}
          <div className="vitals-form-section">
            <div className="vitals-section-header">
              <span className="vitals-section-num">3</span>
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
