import React, { useState } from 'react';
import type { ScreeningHistoryItem } from '../types';

interface ScreeningDetailModalProps {
  record: ScreeningHistoryItem | null;
  onClose: () => void;
}

export const ScreeningDetailModal: React.FC<ScreeningDetailModalProps> = ({ record, onClose }) => {
  const [copied, setCopied] = useState<boolean>(false);

  if (!record) return null;

  const isHighBP = record.systolicBP >= 140 || record.diastolicBP >= 90;
  const isCrisisBP = record.systolicBP >= 180 || record.diastolicBP >= 110;
  const isFever = record.temperature >= 37.5;
  const isHighFever = record.temperature >= 38.5;
  const isTachycardia = record.heartRate > 100;
  const hasAllergy = record.allergies && record.allergies !== 'ปฏิเสธการแพ้ยา' && record.allergies !== 'ไม่มี';

  const triageClass =
    record.triageLevel.includes('วิกฤต')
      ? 'modal-triage-red'
      : record.triageLevel.includes('เร่งด่วน')
      ? 'modal-triage-orange'
      : record.triageLevel.includes('กึ่ง')
      ? 'modal-triage-yellow'
      : 'modal-triage-green';

  const handleCopySummary = () => {
    const text = `[ใบคัดกรองสัญญาณชีพ คลินิกเวชกรรม]
วันที่: ${record.visitDate}
ผู้ป่วย: ${record.patientName} (อายุ ${record.age} ปี, ${record.gender})
เลขบัตรประชาชน: ${record.nationalId}
สิทธิการรักษา: ${record.schemeType}
ระดับความเร่งด่วน (Triage): ${record.triageLevel}
----------------------------------------
สัญญาณชีพ (Vital Signs):
- ความดันโลหิต (BP): ${record.systolicBP}/${record.diastolicBP} mmHg
- ชีพจร (Pulse): ${record.heartRate} bpm
- อุณหภูมิ (Temp): ${record.temperature} °C
- น้ำหนัก/ส่วนสูง: ${record.weight} kg / ${record.height} cm (BMI: ${record.bmi} - ${record.bmiCategory})
- ออกซิเจนในเลือด (SpO2): ${record.spo2 || '-'}%
- อัตราการหายใจ (RR): ${record.respiratoryRate || '-'} ครั้ง/นาที
----------------------------------------
อาการสำคัญ (Chief Complaint): ${record.chiefComplaint}
ประวัติการแพ้ยา: ${record.allergies}
โรคประจำตัว: ${record.medicalHistory}
ผู้คัดกรอง: ${record.screenedByUserName} (${record.screenedByRole})
ส่งต่อห้องตรวจ: ${record.assignedRoom} (${record.assignedDoctorName})`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="scr-modal-backdrop" onClick={onClose}>
      <div className="scr-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="scr-modal-header">
          <div className="scr-modal-header-left">
            <div className="scr-modal-icon-box">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
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
              <div className="scr-modal-title-row">
                <h3 className="scr-modal-title">รายละเอียดผลการคัดกรองสัญญาณชีพ</h3>
                <span className={`modal-triage-badge ${triageClass}`}>{record.triageLevel}</span>
              </div>
              <p className="scr-modal-subtitle">
                บันทึกการตรวจวัดวันที่ {record.visitDate} • คิว {record.queueNo} (Visit #{record.visitId})
              </p>
            </div>
          </div>

          <button type="button" className="scr-modal-close-btn" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        {/* Modal Content */}
        <div className="scr-modal-body">
          {/* Patient Identity Strip */}
          <div className="modal-patient-strip">
            <div className="modal-pt-item">
              <span className="pt-lbl">ชื่อ-นามสกุล</span>
              <span className="pt-val name">{record.patientName}</span>
            </div>
            <div className="modal-pt-divider"></div>
            <div className="modal-pt-item">
              <span className="pt-lbl">อายุ / เพศ</span>
              <span className="pt-val">{record.age} ปี ({record.gender})</span>
            </div>
            <div className="modal-pt-divider"></div>
            <div className="modal-pt-item">
              <span className="pt-lbl">เลขบัตรประชาชน</span>
              <span className="pt-val code">{record.nationalId}</span>
            </div>
            <div className="modal-pt-divider"></div>
            <div className="modal-pt-item">
              <span className="pt-lbl">สิทธิการรักษา</span>
              <span className="pt-val scheme">{record.schemeType}</span>
            </div>
          </div>

          {/* Vitals Grid Cards */}
          <div className="modal-section-title">
            <span>🩺 ค่าสัญญาณชีพและสรีรวิทยา (Vital Signs Measurements)</span>
          </div>

          <div className="modal-vitals-grid">
            {/* Blood Pressure */}
            <div className={`modal-vital-card ${isCrisisBP ? 'vital-danger' : isHighBP ? 'vital-warning' : 'vital-normal'}`}>
              <div className="vital-card-header">
                <span className="vital-card-title">ความดันโลหิต (BP)</span>
                {isCrisisBP ? (
                  <span className="vital-status-pill pill-danger">วิกฤต!</span>
                ) : isHighBP ? (
                  <span className="vital-status-pill pill-warning">สูง</span>
                ) : (
                  <span className="vital-status-pill pill-normal">ปกติ</span>
                )}
              </div>
              <div className="vital-card-val-row">
                <span className="vital-big-num">{record.systolicBP}/{record.diastolicBP}</span>
                <span className="vital-unit-text">mmHg</span>
              </div>
              <span className="vital-standard-note">เกณฑ์ปกติ: &lt; 120/80 mmHg</span>
            </div>

            {/* Heart Rate */}
            <div className={`modal-vital-card ${isTachycardia ? 'vital-warning' : 'vital-normal'}`}>
              <div className="vital-card-header">
                <span className="vital-card-title">ชีพจร (Heart Rate)</span>
                {isTachycardia ? (
                  <span className="vital-status-pill pill-warning">เต้นเร็ว</span>
                ) : (
                  <span className="vital-status-pill pill-normal">ปกติ</span>
                )}
              </div>
              <div className="vital-card-val-row">
                <span className="vital-big-num">{record.heartRate}</span>
                <span className="vital-unit-text">bpm</span>
              </div>
              <span className="vital-standard-note">เกณฑ์ปกติ: 60 - 100 ครั้ง/นาที</span>
            </div>

            {/* Temperature */}
            <div className={`modal-vital-card ${isHighFever ? 'vital-danger' : isFever ? 'vital-warning' : 'vital-normal'}`}>
              <div className="vital-card-header">
                <span className="vital-card-title">อุณหภูมิ (Temp)</span>
                {isHighFever ? (
                  <span className="vital-status-pill pill-danger">ไข้สูง!</span>
                ) : isFever ? (
                  <span className="vital-status-pill pill-warning">มีไข้</span>
                ) : (
                  <span className="vital-status-pill pill-normal">ปกติ</span>
                )}
              </div>
              <div className="vital-card-val-row">
                <span className="vital-big-num">{record.temperature.toFixed(1)}</span>
                <span className="vital-unit-text">°C</span>
              </div>
              <span className="vital-standard-note">เกณฑ์ปกติ: 36.5 - 37.4 °C</span>
            </div>

            {/* BMI & Measurements */}
            <div className="modal-vital-card vital-normal">
              <div className="vital-card-header">
                <span className="vital-card-title">ดัชนีมวลกาย (BMI)</span>
                <span className="vital-status-pill pill-info">{record.bmiCategory}</span>
              </div>
              <div className="vital-card-val-row">
                <span className="vital-big-num">{record.bmi}</span>
                <span className="vital-unit-text">kg/m²</span>
              </div>
              <span className="vital-standard-note">น้ำหนัก {record.weight} kg | สูง {record.height} cm</span>
            </div>

            {/* Optional SpO2 */}
            <div className="modal-vital-card vital-normal">
              <div className="vital-card-header">
                <span className="vital-card-title">ออกซิเจนในเลือด (SpO2)</span>
                <span className="vital-status-pill pill-normal">ปกติ</span>
              </div>
              <div className="vital-card-val-row">
                <span className="vital-big-num">{record.spo2 || 98}</span>
                <span className="vital-unit-text">%</span>
              </div>
              <span className="vital-standard-note">เกณฑ์ปกติ: 95 - 100%</span>
            </div>

            {/* Optional RR */}
            <div className="modal-vital-card vital-normal">
              <div className="vital-card-header">
                <span className="vital-card-title">อัตราการหายใจ (RR)</span>
                <span className="vital-status-pill pill-normal">ปกติ</span>
              </div>
              <div className="vital-card-val-row">
                <span className="vital-big-num">{record.respiratoryRate || 18}</span>
                <span className="vital-unit-text">ครั้ง/นาที</span>
              </div>
              <span className="vital-standard-note">เกณฑ์ปกติ: 12 - 20 ครั้ง/นาที</span>
            </div>
          </div>

          {/* Clinical Symptoms & Medical History */}
          <div className="modal-clinical-details-grid">
            <div className="clinical-detail-box">
              <span className="box-title">📝 อาการสำคัญ ณ วันที่เข้ารับบริการ (Chief Complaint)</span>
              <p className="box-content cc-text">{record.chiefComplaint}</p>
            </div>

            <div className="clinical-detail-box">
              <span className="box-title">⚠️ ประวัติการแพ้ยา (Allergies)</span>
              <div className="box-content">
                {hasAllergy ? (
                  <span className="allergy-alert-tag">⚠️ {record.allergies}</span>
                ) : (
                  <span className="allergy-safe-tag">✓ ปฏิเสธการแพ้ยา</span>
                )}
              </div>
            </div>

            <div className="clinical-detail-box">
              <span className="box-title">🩺 โรคประจำตัว (Medical History)</span>
              <p className="box-content">{record.medicalHistory || 'ไม่มี'}</p>
            </div>

            <div className="clinical-detail-box doc-transfer-box">
              <span className="box-title">👨‍⚕️ แพทย์และห้องตรวจที่ส่งต่อ</span>
              <p className="box-content doc-name">
                <strong>{record.assignedRoom}</strong> — {record.assignedDoctorName}
              </p>
              <span className="screened-by-sub">
                ผู้คัดกรอง: {record.screenedByUserName} ({record.screenedByRole})
              </span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="scr-modal-footer">
          <div className="scr-footer-left">
            <button
              type="button"
              className={`btn-modal-action btn-copy ${copied ? 'copied' : ''}`}
              onClick={handleCopySummary}
            >
              {copied ? '✓ คัดลอกแล้ว' : '📋 คัดลอกข้อมูลสรุป'}
            </button>
            <button
              type="button"
              className="btn-modal-action btn-print"
              onClick={handlePrint}
            >
              🖨️ พิมพ์ใบคัดกรอง
            </button>
          </div>

          <button type="button" className="btn-modal-action btn-close" onClick={onClose}>
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
