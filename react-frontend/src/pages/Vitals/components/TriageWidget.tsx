import React from 'react';
import type { TriageLevelKey, TriageLevelInfo } from '../types';

export const TRIAGE_LEVELS: TriageLevelInfo[] = [
  {
    key: 'ฉุกเฉินวิกฤต (Resuscitation)',
    levelNum: 1,
    labelTh: 'ฉุกเฉินวิกฤต (Level 1)',
    labelEn: 'Resuscitation / Critical',
    badgeClass: 'triage-badge-red',
    color: '#EF4444',
    bgLight: '#FEE2E2',
    bgDark: 'rgba(239, 68, 68, 0.15)',
    description: 'หมดสติ, หยุดหายใจ, ช็อก, หัวใจหยุดเต้น ต้องช่วยชีวิตทันที',
  },
  {
    key: 'ฉุกเฉินเร่งด่วน (Urgent)',
    levelNum: 2,
    labelTh: 'ฉุกเฉินเร่งด่วน (Level 2)',
    labelEn: 'Emergency / Urgent',
    badgeClass: 'triage-badge-orange',
    color: '#F97316',
    bgLight: '#FFEDD5',
    bgDark: 'rgba(249, 115, 22, 0.15)',
    description: 'เจ็บหน้าอกรุนแรง, หอบเหนื่อยมาก, ไข้สูงชัก, ความดันวิกฤต',
  },
  {
    key: 'กึ่งฉุกเฉิน (Semi-Urgent)',
    levelNum: 3,
    labelTh: 'กึ่งฉุกเฉิน (Level 3)',
    labelEn: 'Semi-Urgent / Priority',
    badgeClass: 'triage-badge-yellow',
    color: '#EAB308',
    bgLight: '#FEF9C3',
    bgDark: 'rgba(234, 179, 8, 0.15)',
    description: 'ปวดท้องเฉียบพลัน, มีไข้ > 38.5°C, บาดแผลเลือดออกปานกลาง',
  },
  {
    key: 'ปกติ (Normal)',
    levelNum: 4,
    labelTh: 'ไม่ฉุกเฉิน / ปกติ (Level 4)',
    labelEn: 'Non-Urgent / Routine',
    badgeClass: 'triage-badge-green',
    color: '#10B981',
    bgLight: '#D1FAE5',
    bgDark: 'rgba(16, 185, 129, 0.15)',
    description: 'อาการทั่วไป, มาตามนัด, ขอใบรับรองแพทย์, ตรวจสุขภาพทั่วไป',
  },
];

interface TriageWidgetProps {
  selectedTriage: TriageLevelKey;
  onSelectTriage: (level: TriageLevelKey) => void;
  suggestedLevel?: TriageLevelKey;
}

export const TriageWidget: React.FC<TriageWidgetProps> = ({
  selectedTriage,
  onSelectTriage,
  suggestedLevel,
}) => {
  return (
    <div className="vitals-widget-card">
      <div className="vitals-widget-header">
        <div className="vitals-widget-title-wrap">
          <div className="vitals-widget-icon-box green-box">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <h3 className="vitals-widget-title">ระดับการคัดแยก (Triage Level)</h3>
            <p className="vitals-widget-subtitle">Emergency Acuity Classification</p>
          </div>
        </div>
      </div>

      <div className="vitals-widget-body">

        {/* Suggestion notice if vitals trigger high priority */}
        {suggestedLevel && suggestedLevel !== 'ปกติ (Normal)' && (
          <div className="triage-suggest-notice">
            <svg className="suggest-alert-icon" viewBox="0 0 20 20" width="16" height="16" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>
              ระบบตรวจพบค่าสัญญาณชีพผิดปกติ แนะนำ: <strong>{suggestedLevel}</strong>
            </span>
          </div>
        )}

        {/* 4 Level Selection Grid */}
        <div className="triage-level-options">
          {TRIAGE_LEVELS.map((lvl) => {
            const isSelected = selectedTriage === lvl.key;
            return (
              <button
                key={lvl.key}
                type="button"
                className={`triage-option-btn ${lvl.badgeClass} ${isSelected ? 'active' : ''}`}
                onClick={() => onSelectTriage(lvl.key)}
              >
                <div className="triage-opt-indicator"></div>
                <div className="triage-opt-content">
                  <div className="triage-opt-header">
                    <span className="triage-opt-title">{lvl.labelTh}</span>
                    {isSelected && <span className="triage-opt-badge-tag">เลือกอยู่</span>}
                  </div>
                  <p className="triage-opt-desc">{lvl.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
