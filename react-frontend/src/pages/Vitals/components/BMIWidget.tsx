import React from 'react';
import type { BMICategoryInfo } from '../types';

interface BMIWidgetProps {
  weight: number | string;
  height: number | string;
  bmi: number | null;
  bmiInfo: BMICategoryInfo | null;
}

export const BMIWidget: React.FC<BMIWidgetProps> = ({
  weight,
  height,
  bmi,
  bmiInfo,
}) => {
  const hasInput = Number(weight) > 0 && Number(height) > 0;

  // Calculate percentage along a 15 to 35 scale for gauge pointer
  const gaugePercent = React.useMemo(() => {
    if (!bmi) return 0;
    const minVal = 15;
    const maxVal = 35;
    const clamped = Math.min(Math.max(bmi, minVal), maxVal);
    return ((clamped - minVal) / (maxVal - minVal)) * 100;
  }, [bmi]);

  return (
    <div className="vitals-widget-card">
      <div className="vitals-widget-header">
        <div className="vitals-widget-title-wrap">
          <div className="vitals-widget-icon-box blue-box">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M12 3v18m0-18l-4 4m4-4l4 4M3 12h18M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <h3 className="vitals-widget-title">ดัชนีมวลกาย (BMI)</h3>
            <p className="vitals-widget-subtitle">Body Mass Index Calculator</p>
          </div>
        </div>
      </div>

      <div className="vitals-widget-body">
        {hasInput && bmi && bmiInfo ? (
          <div className="bmi-display-container">
            <div className="bmi-number-row">
              <div className="bmi-big-value">
                <span className="bmi-num">{bmi.toFixed(2)}</span>
                <span className="bmi-unit">kg/m²</span>
              </div>
              <div className={`bmi-status-pill ${bmiInfo.badgeClass}`}>
                <span className="bmi-status-dot"></span>
                <span>{bmiInfo.labelTh}</span>
              </div>
            </div>

            {/* BMI Scale Visual Bar */}
            <div className="bmi-scale-bar-wrap">
              <div className="bmi-scale-bar">
                <div className="scale-seg seg-underweight" title="ผอม (< 18.5)"></div>
                <div className="scale-seg seg-normal" title="ปกติ (18.5 - 22.9)"></div>
                <div className="scale-seg seg-overweight" title="ท้วม (23 - 24.9)"></div>
                <div className="scale-seg seg-obese1" title="อ้วน 1 (25 - 29.9)"></div>
                <div className="scale-seg seg-obese2" title="อ้วน 2 (≥ 30)"></div>
              </div>
              <div
                className="bmi-scale-pointer"
                style={{ left: `${gaugePercent}%` }}
                title={`BMI: ${bmi.toFixed(2)}`}
              >
                <div className="pointer-needle"></div>
              </div>
            </div>

            <div className="bmi-scale-labels">
              <span>18.5</span>
              <span>23.0</span>
              <span>25.0</span>
              <span>30.0</span>
            </div>

            <div className="bmi-info-footer">
              <span className="bmi-info-text">
                เกณฑ์มาตรฐานคนเอเชีย: <strong>{bmiInfo.rangeText}</strong>
              </span>
            </div>
          </div>
        ) : (
          <div className="bmi-empty-state">
            <div className="bmi-empty-icon">⚖️</div>
            <p className="bmi-empty-text">กรอกน้ำหนักและส่วนสูง เพื่อคำนวณ BMI อัตโนมัติ</p>
            <div className="bmi-preview-badge">
              <span className="bmi-status-dot default-dot"></span>
              <span>รอข้อมูลน้ำหนัก/ส่วนสูง</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
