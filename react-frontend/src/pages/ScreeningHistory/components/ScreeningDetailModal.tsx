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

  const isCrisisTriage = record.triageLevel.includes('วิกฤต');
  const isSemiTriage = record.triageLevel.includes('กึ่ง');
  const isUrgentTriage = (record.triageLevel.includes('เร่งด่วน') || record.triageLevel.includes('ฉุกเฉิน')) && !isSemiTriage && !isCrisisTriage;

  const triageClass = isCrisisTriage
    ? 'modal-triage-red'
    : isUrgentTriage
    ? 'modal-triage-orange'
    : isSemiTriage
    ? 'modal-triage-yellow'
    : 'modal-triage-green';

  // 2Q Depression Calculation
  const isQ2Positive = record.q2Depressed === true || record.q2Anhedonia === true;

  // Active Alerts for Positive Screening Banner
  const activeAlerts: string[] = [];
  if (record.hasTB === true) {
    activeAlerts.push('สงสัยวัณโรค (TB Positive) — แนะนำแยกผู้ป่วยและสวมหน้ากาก N95');
  }
  if (record.hasURI === true) {
    activeAlerts.push('มีอาการติดเชื้อทางเดินหายใจส่วนบน (URI Positive) — สวมหน้ากากอนามัย');
  }
  if (record.onAnticoagulant === true) {
    activeAlerts.push('ผู้ป่วยรับประทานยาละลายลิ่มเลือด (On Anticoagulant)');
  }
  if (record.gender === 'หญิง' && record.isPregnant === true) {
    activeAlerts.push('ผู้ป่วยตั้งครรภ์ (Pregnancy)');
  }
  if (record.gender === 'หญิง' && record.isBreastfeeding === true) {
    activeAlerts.push('ผู้ป่วยกำลังให้นมบุตร (Breastfeeding)');
  }
  if (isQ2Positive) {
    activeAlerts.push('ผลคัดกรอง 2Q เป็นบวก (เสี่ยงภาวะซึมเศร้า — ต้องส่งต่อประเมิน 9Q)');
  }
  if (
    record.precautionType &&
    record.precautionType.trim() !== '' &&
    record.precautionType !== 'Standard' &&
    record.precautionType !== 'ไม่มี' &&
    record.precautionType !== '- ไม่ได้ประเมิน -'
  ) {
    activeAlerts.push(`มาตรการป้องกันการแพร่กระจายเชื้อ: ${record.precautionType}`);
  }

  const isScreeningPositive = record.screeningPositive === true || activeAlerts.length > 0;

  // Helper: Render 3-State Boolean Badge (true, false, null/undefined)
  const renderTriStateBadge = (
    val: boolean | null | undefined,
    positiveLabel: string = 'มีอาการ (Positive)',
    negativeLabel: string = 'ไม่มี (Negative)',
    isDangerousPositive: boolean = false
  ) => {
    if (val === true) {
      return (
        <span className={`clinical-tag ${isDangerousPositive ? 'tag-danger' : 'tag-warning'}`}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }}>
            <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {positiveLabel}
        </span>
      );
    }
    if (val === false) {
      return (
        <span className="clinical-tag tag-safe">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }}>
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {negativeLabel}
        </span>
      );
    }
    return <span className="clinical-tag tag-unassessed">- ไม่ได้ประเมิน -</span>;
  };

  // Helper: Render Text value or unassessed fallback
  const renderTextValue = (val: string | undefined | null, fallback: string = '- ไม่ได้ประเมิน -') => {
    if (!val || val.trim() === '') {
      return <span className="clinical-unassessed-text">{fallback}</span>;
    }
    return <span className="clinical-assessed-text">{val}</span>;
  };

  const handleCopySummary = () => {
    const fmtTri = (val: boolean | null | undefined, pos: string, neg: string) =>
      val === true ? pos : val === false ? neg : '- ไม่ได้ประเมิน -';

    const q2ResultText = isQ2Positive
      ? '2Q Positive (เสี่ยงภาวะซึมเศร้า — ต้องประเมิน 9Q ต่อ)'
      : record.q2Depressed === false && record.q2Anhedonia === false
      ? '2Q Negative (ปกติ)'
      : '- ไม่ได้ประเมิน -';

    const womenHealthText =
      record.gender === 'หญิง'
        ? `
----------------------------------------
คัดกรองสุขภาพสตรี (Women's Health):
- การตั้งครรภ์ (Pregnancy): ${fmtTri(record.isPregnant, 'ตั้งครรภ์ (Pregnant)', 'ไม่ได้ตั้งครรภ์')}
- การให้นมบุตร (Breastfeeding): ${fmtTri(record.isBreastfeeding, 'ให้นมบุตร (Breastfeeding)', 'ไม่ได้ให้นมบุตร')}
- ประจำเดือนครั้งสุดท้าย (LMP): ${record.lastMenstrualPeriod || '- ไม่ได้ประเมิน -'}`
        : '';

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
- ยาสมุนไพร (Herbal Medicines): ${record.herbalMedicines || '- ไม่ได้ประเมิน -'}
- ผลิตภัณฑ์เสริมอาหาร (Dietary Supplements): ${record.dietarySupplements || '- ไม่ได้ประเมิน -'}
- ประวัติการสูบบุหรี่ (Smoking History): ${record.smokingHistory || 'ไม่สูบ'}
- ประวัติการดื่มแอลกอฮอล์ (Alcohol History): ${record.alcoholHistory || 'ไม่ดื่ม'}
----------------------------------------
การคัดกรองการติดเชื้อและข้อควรระวัง:
- อาการติดเชื้อทางเดินหายใจ (URI): ${fmtTri(record.hasURI, 'มีอาการ (Positive)', 'ไม่มีอาการ (Negative)')}
- คัดกรองวัณโรค (TB): ${fmtTri(record.hasTB, 'สงสัยวัณโรค (Positive)', 'ไม่มีอาการสงสัย (Negative)')}
- ยาละลายลิ่มเลือด (Anticoagulant): ${fmtTri(record.onAnticoagulant, 'ใช้ยาละลายลิ่มเลือด', 'ไม่ได้รับประทาน')}
- ข้อควรระวัง (Isolation Precaution): ${record.precautionType || '- ไม่ได้ประเมิน -'}${womenHealthText}
----------------------------------------
แบบคัดกรองภาวะซึมเศร้า 2Q:
- ข้อ 1 รู้สึกเศร้า หดหู่ หรือท้อแท้: ${fmtTri(record.q2Depressed, 'มี', 'ไม่มี')}
- ข้อ 2 รู้สึกเบื่อ ไม่เพลิดเพลิน: ${fmtTri(record.q2Anhedonia, 'มี', 'ไม่มี')}
- สรุปผลการประเมิน 2Q: ${q2ResultText}
----------------------------------------
บันทึกเพิ่มเติมของพยาบาล (Nurse Notes): ${record.nurseNotes || '- ไม่ได้ประเมิน -'}
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
          {/* 1. Patient Identity Strip */}
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

          {/* 2. Clinical Alert / Positive Screening Warning Banner */}
          {isScreeningPositive && activeAlerts.length > 0 && (
            <div className="scr-modal-alert-banner">
              <div className="modal-alert-icon-box">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div className="modal-alert-content">
                <h4 className="modal-alert-heading">ข้อควรระวังทางคลินิก (Clinical Precautions / Positive Screening)</h4>
                <div className="modal-alert-chips">
                  {activeAlerts.map((alertText, idx) => (
                    <span key={idx} className="modal-alert-chip">
                      <span className="alert-chip-dot"></span>
                      {alertText}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 3. Vitals Grid Cards */}
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

          {/* 4. Clinical Symptoms & Medical History */}
          <div className="modal-section-title">
            <span>อาการสำคัญและประวัติทางการแพทย์ (Clinical History & Allergies)</span>
          </div>

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
          </div>

          {/* 5. Herbal Medicines & Dietary Supplements */}
          <div className="modal-section-title">
            <span>ยาสมุนไพรและผลิตภัณฑ์เสริมอาหาร (Herbal Medicines & Supplements)</span>
          </div>

          <div className="modal-clinical-details-grid">
            <div className="clinical-detail-box">
              <span className="box-title">ยาสมุนไพรที่ใช้ (Herbal Medicines)</span>
              <div className="box-content">
                {renderTextValue(record.herbalMedicines)}
              </div>
            </div>

            <div className="clinical-detail-box">
              <span className="box-title">ผลิตภัณฑ์เสริมอาหาร (Dietary Supplements)</span>
              <div className="box-content">
                {renderTextValue(record.dietarySupplements)}
              </div>
            </div>
          </div>

          {/* 6. Infection Screening & Clinical Precautions */}
          <div className="modal-section-title">
            <span>การคัดกรองการติดเชื้อและข้อควรระวัง (Infection Screening & Precautions)</span>
          </div>

          <div className="modal-clinical-details-grid">
            <div className="clinical-detail-box">
              <span className="box-title">อาการติดเชื้อทางเดินหายใจส่วนบน (URI Screening)</span>
              <div className="box-content">
                {renderTriStateBadge(record.hasURI, 'มีอาการ (Positive)', 'ไม่มีอาการ (Negative)', false)}
              </div>
            </div>

            <div className="clinical-detail-box">
              <span className="box-title">การคัดกรองวัณโรค (TB Screening)</span>
              <div className="box-content">
                {renderTriStateBadge(record.hasTB, 'สงสัยวัณโรค (Positive)', 'ไม่มีอาการสงสัย (Negative)', true)}
              </div>
            </div>

            <div className="clinical-detail-box">
              <span className="box-title">การใช้ยาละลายลิ่มเลือด (Anticoagulant Precaution)</span>
              <div className="box-content">
                {renderTriStateBadge(record.onAnticoagulant, 'ใช้ยาละลายลิ่มเลือด', 'ไม่ได้รับประทาน', false)}
              </div>
            </div>

            <div className="clinical-detail-box">
              <span className="box-title">ข้อควรระวังในการดูแลผู้ป่วย (Isolation Precaution)</span>
              <div className="box-content">
                {record.precautionType && record.precautionType.trim() ? (
                  <span className="clinical-tag tag-precaution">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }}>
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {record.precautionType}
                  </span>
                ) : (
                  <span className="clinical-tag tag-unassessed">- ไม่ได้ประเมิน -</span>
                )}
              </div>
            </div>
          </div>

          {/* 7. Women's Health Screening (Only rendered for Female patients) */}
          {record.gender === 'หญิง' && (
            <>
              <div className="modal-section-title">
                <span>คัดกรองสุขภาพสตรี (Women's Health Screening)</span>
              </div>

              <div className="modal-clinical-details-grid">
                <div className="clinical-detail-box">
                  <span className="box-title">ภาวะตั้งครรภ์ (Pregnancy Status)</span>
                  <div className="box-content">
                    {renderTriStateBadge(record.isPregnant, 'ตั้งครรภ์ (Pregnant)', 'ไม่ได้ตั้งครรภ์', true)}
                  </div>
                </div>

                <div className="clinical-detail-box">
                  <span className="box-title">ภาวะให้นมบุตร (Breastfeeding Status)</span>
                  <div className="box-content">
                    {renderTriStateBadge(record.isBreastfeeding, 'ให้นมบุตร (Breastfeeding)', 'ไม่ได้ให้นมบุตร', false)}
                  </div>
                </div>

                <div className="clinical-detail-box full-width">
                  <span className="box-title">ประจำเดือนครั้งสุดท้าย (Last Menstrual Period / LMP)</span>
                  <div className="box-content">
                    {renderTextValue(record.lastMenstrualPeriod)}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* 8. 2Q Depression Screening */}
          <div className="modal-section-title">
            <span>แบบคัดกรองภาวะซึมเศร้า 2 คำถาม (2Q Depression Screening)</span>
          </div>

          <div className="modal-clinical-details-grid">
            <div className="clinical-detail-box">
              <span className="box-title">ข้อ 1 รู้สึกเศร้า หดหู่ หรือท้อแท้ (Depressed Mood)</span>
              <div className="box-content">
                {renderTriStateBadge(record.q2Depressed, 'มี', 'ไม่มี', false)}
              </div>
            </div>

            <div className="clinical-detail-box">
              <span className="box-title">ข้อ 2 รู้สึกเบื่อ ไม่เพลิดเพลิน (Anhedonia)</span>
              <div className="box-content">
                {renderTriStateBadge(record.q2Anhedonia, 'มี', 'ไม่มี', false)}
              </div>
            </div>

            <div className="clinical-detail-box full-width">
              <span className="box-title">สรุปผลการคัดกรอง 2Q (2Q Screening Assessment)</span>
              <div className="box-content">
                {isQ2Positive ? (
                  <span className="clinical-tag tag-danger">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '5px' }}>
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    2Q Positive (ผลเป็นบวก — เสี่ยงภาวะซึมเศร้า แนะนำส่งต่อประเมิน 9Q)
                  </span>
                ) : record.q2Depressed === false && record.q2Anhedonia === false ? (
                  <span className="clinical-tag tag-safe">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '5px' }}>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    2Q Negative (ปกติ — ไม่มีความเสี่ยงภาวะซึมเศร้า)
                  </span>
                ) : (
                  <span className="clinical-tag tag-unassessed">- ไม่ได้ประเมิน -</span>
                )}
              </div>
            </div>
          </div>

          {/* 9. Nurse Notes & Doctor Transfer Assignment */}
          <div className="modal-section-title">
            <span>บันทึกทางการพยาบาลและการส่งต่อห้องตรวจ (Nurse Observations & Transfer)</span>
          </div>

          <div className="modal-clinical-details-grid">
            <div className="clinical-detail-box full-width">
              <span className="box-title">บันทึกเพิ่มเติมของพยาบาล (Nurse Notes & Observations)</span>
              <p className="box-content">{record.nurseNotes && record.nurseNotes.trim() ? record.nurseNotes : '- ไม่ได้ประเมิน -'}</p>
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
