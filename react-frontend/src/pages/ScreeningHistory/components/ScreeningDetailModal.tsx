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
    const text = `[ใบคัดกรองสัญญาณชีพและประวัติ คลินิกเวชกรรม]
วันที่-เวลา: ${record.visitDate}
คิว: ${record.queueNo} (Visit #${record.visitId})
HN: ${record.hn || `HN${String(record.patientId).padStart(4, '0')}`}
ผู้ป่วย: ${record.patientName} (อายุ ${record.age} ปี, ${record.gender})
เลขบัตรประชาชน: ${record.nationalId}
เบอร์โทรศัพท์: ${record.phoneNumber || '-'}
สิทธิการรักษา: ${record.schemeType}
ระดับความเร่งด่วน (Triage): ${record.triageLevel}
----------------------------------------
สัญญาณชีพ (Vital Signs):
- ความดันโลหิต (BP): ${record.systolicBP}/${record.diastolicBP} mmHg
- ชีพจร (Heart Rate): ${record.heartRate} bpm
- อุณหภูมิร่างกาย (Temp): ${record.temperature.toFixed(1)} °C
- น้ำหนัก / ส่วนสูง: ${record.weight} kg / ${record.height} cm (BMI: ${record.bmi} - ${record.bmiCategory})
- ออกซิเจนในเลือด (SpO2): ${record.spo2 || '-'}%
- อัตราการหายใจ (RR): ${record.respiratoryRate || '-'} ครั้ง/นาที
- ระดับความเจ็บปวด (Pain Score): ${record.painScore !== undefined ? record.painScore : 0}/10
- ระดับน้ำตาลในเลือด (Blood Sugar / DTX): ${record.bloodSugar ? `${record.bloodSugar} mg/dL` : '-'}
----------------------------------------
ประวัติทางการแพทย์และพฤติกรรมสุขภาพ:
- อาการสำคัญ (Chief Complaint): ${record.chiefComplaint}
- ประวัติการแพ้ยา (Drug Allergies): ${record.allergies || 'ปฏิเสธการแพ้ยา'}
- ประวัติการแพ้อาหาร (Food Allergies): ${record.foodAllergies || 'ปฏิเสธการแพ้อาหาร'}
- โรคประจำตัว (Chronic Diseases): ${record.medicalHistory || 'ไม่มี'}
- ยาที่รับประทานประจำ (Current Medications): ${record.currentMedications || 'ไม่มี'}
- ประวัติการสูบบุหรี่ (Smoking History): ${record.smokingHistory || 'ไม่สูบ'}
- ประวัติการดื่มแอลกอฮอล์ (Alcohol History): ${record.alcoholHistory || 'ไม่ดื่ม'}
- บันทึกเพิ่มเติมของพยาบาล (Nurse Notes): ${record.nurseNotes || '-'}
----------------------------------------
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Modal Content */}
        <div className="scr-modal-body">
          {/* Patient Identity Strip */}
          <div className="modal-patient-strip">
            <div className="modal-pt-item">
              <span className="pt-lbl">HN</span>
              <span className="pt-val hn-code">{record.hn || `HN${String(record.patientId).padStart(4, '0')}`}</span>
            </div>
            <div className="modal-pt-divider"></div>
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
              <span className="pt-lbl">เบอร์โทรศัพท์</span>
              <span className="pt-val">{record.phoneNumber || '-'}</span>
            </div>
            <div className="modal-pt-divider"></div>
            <div className="modal-pt-item">
              <span className="pt-lbl">สิทธิการรักษา</span>
              <span className="pt-val scheme">{record.schemeType}</span>
            </div>
          </div>

          {/* Vitals Grid Cards */}
          <div className="modal-section-title">
            <span>ค่าสัญญาณชีพและสรีรวิทยา (Vital Signs Measurements)</span>
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

            {/* Pain Score */}
            <div className="modal-vital-card vital-normal">
              <div className="vital-card-header">
                <span className="vital-card-title">ระดับความเจ็บปวด (Pain Score)</span>
                <span className="vital-status-pill pill-normal">{record.painScore !== undefined ? `${record.painScore}/10` : '0/10'}</span>
              </div>
              <div className="vital-card-val-row">
                <span className="vital-big-num">{record.painScore !== undefined ? record.painScore : 0}</span>
                <span className="vital-unit-text">/10</span>
              </div>
              <span className="vital-standard-note">คะแนนความเจ็บปวด (0-10)</span>
            </div>

            {/* Blood Sugar (DTX) */}
            <div className="modal-vital-card vital-normal">
              <div className="vital-card-header">
                <span className="vital-card-title">ระดับน้ำตาลในเลือด (DTX)</span>
                <span className="vital-status-pill pill-normal">
                  {record.bloodSugar && record.bloodSugar > 140 ? 'สูง' : 'ปกติ'}
                </span>
              </div>
              <div className="vital-card-val-row">
                <span className="vital-big-num">{record.bloodSugar || '-'}</span>
                <span className="vital-unit-text">mg/dL</span>
              </div>
              <span className="vital-standard-note">เกณฑ์ปกติ: 70 - 140 mg/dL</span>
            </div>
          </div>

          {/* Clinical Symptoms & Medical History */}
          <div className="modal-clinical-details-grid">
            <div className="clinical-detail-box full-width">
              <span className="box-title">อาการสำคัญ ณ วันที่เข้ารับบริการ (Chief Complaint)</span>
              <p className="box-content cc-text">{record.chiefComplaint}</p>
            </div>

            <div className="clinical-detail-box">
              <span className="box-title">ประวัติการแพ้ยา (Drug Allergies)</span>
              <div className="box-content">
                {hasAllergy ? (
                  <span className="allergy-alert-tag">{record.allergies}</span>
                ) : (
                  <span className="allergy-safe-tag">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }}>
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    ปฏิเสธการแพ้ยา
                  </span>
                )}
              </div>
            </div>

            <div className="clinical-detail-box">
              <span className="box-title">ประวัติการแพ้อาหาร (Food Allergies)</span>
              <p className="box-content">{record.foodAllergies || 'ปฏิเสธการแพ้อาหาร'}</p>
            </div>

            <div className="clinical-detail-box">
              <span className="box-title">โรคประจำตัว (Chronic Diseases)</span>
              <p className="box-content">{record.medicalHistory || 'ไม่มี'}</p>
            </div>

            <div className="clinical-detail-box">
              <span className="box-title">ยาที่รับประทานประจำ (Current Medications)</span>
              <p className="box-content">{record.currentMedications || 'ไม่มี'}</p>
            </div>

            <div className="clinical-detail-box">
              <span className="box-title">ประวัติการสูบบุหรี่ (Smoking History)</span>
              <p className="box-content">{record.smokingHistory || 'ไม่สูบ'}</p>
            </div>

            <div className="clinical-detail-box">
              <span className="box-title">ประวัติการดื่มแอลกอฮอล์ (Alcohol History)</span>
              <p className="box-content">{record.alcoholHistory || 'ไม่ดื่ม'}</p>
            </div>

            <div className="clinical-detail-box full-width">
              <span className="box-title">บันทึกเพิ่มเติมของพยาบาล (Nurse Notes & Observations)</span>
              <p className="box-content">{record.nurseNotes || 'สัญญาณชีพและประวัติได้รับการบันทึกเรียบร้อย'}</p>
            </div>

            <div className="clinical-detail-box doc-transfer-box full-width">
              <span className="box-title">แพทย์และห้องตรวจที่ส่งต่อ</span>
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
              {copied && (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }}>
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              )}
              {copied ? 'คัดลอกแล้ว' : 'คัดลอกข้อมูลสรุป'}
            </button>
            <button
              type="button"
              className="btn-modal-action btn-print"
              onClick={handlePrint}
            >
              พิมพ์ใบคัดกรอง
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
