import React from 'react';
import type { PatientProfileSummary, ScreeningHistoryItem } from '../types';

interface PatientVitalsTrendCardProps {
  profile: PatientProfileSummary;
  records: ScreeningHistoryItem[];
  onClearPatientFilter: () => void;
}

export const PatientVitalsTrendCard: React.FC<PatientVitalsTrendCardProps> = ({
  profile,
  records,
  onClearPatientFilter,
}) => {
  const hasAllergy = profile.allergies && profile.allergies !== 'ปฏิเสธการแพ้ยา' && profile.allergies !== 'ไม่มี';

  // Sort chronological for trend
  const chronologicalRecords = [...records].sort(
    (a, b) => new Date(a.dateOnly.split('/').reverse().join('-')).getTime() - new Date(b.dateOnly.split('/').reverse().join('-')).getTime()
  );

  return (
    <div className="patient-trend-card">
      <div className="trend-card-top-row">
        {/* Patient Basic Info */}
        <div className="trend-patient-profile">
          <div className="trend-avatar-circle">
            <span>{profile.fullName.slice(0, 2)}</span>
          </div>

          <div className="trend-patient-details">
            <div className="trend-name-row">
              <h3 className="trend-patient-name">{profile.fullName}</h3>
              <span className="trend-gender-age">
                {profile.gender} • {profile.age} ปี
              </span>
              <span className="trend-scheme-tag">{profile.schemeType}</span>
            </div>

            <div className="trend-meta-row">
              <div className="trend-meta-item">
                <span className="meta-label">เลขประจำตัวประชาชน:</span>
                <span className="meta-val id-code">{profile.nationalId}</span>
              </div>
              <div className="trend-meta-divider">•</div>
              <div className="trend-meta-item">
                <span className="meta-label">เบอร์โทรศัพท์:</span>
                <span className="meta-val">{profile.phoneNumber}</span>
              </div>
              <div className="trend-meta-divider">•</div>
              <div className="trend-meta-item">
                <span className="meta-label">ประวัติการมารับบริการ:</span>
                <span className="meta-val highlight-val">{records.length} ครั้ง</span>
              </div>
            </div>

            {/* Allergies & Chronic Diseases Warnings */}
            <div className="trend-warning-pills">
              {hasAllergy ? (
                <div className="warning-pill pill-allergy">
                  <span className="pill-icon">⚠️</span>
                  <span><strong>แพ้ยา:</strong> {profile.allergies}</span>
                </div>
              ) : (
                <div className="warning-pill pill-safe">
                  <span className="pill-icon">✓</span>
                  <span>ปฏิเสธการแพ้ยา</span>
                </div>
              )}

              {profile.chronicDiseases && profile.chronicDiseases !== 'ไม่มี' && (
                <div className="warning-pill pill-disease">
                  <span className="pill-icon">🩺</span>
                  <span><strong>โรคประจำตัว:</strong> {profile.chronicDiseases}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Clear Filter Action */}
        <div className="trend-card-actions">
          <button
            type="button"
            className="btn-clear-patient-filter"
            onClick={onClearPatientFilter}
            title="ดูประวัติผู้ป่วยทั้งหมด"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>ดูผู้ป่วยทั้งหมด</span>
          </button>
        </div>
      </div>

      {/* Vitals History Trend Bars */}
      {chronologicalRecords.length > 1 && (
        <div className="trend-charts-section">
          <div className="trend-charts-header">
            <h4 className="trend-section-title">
              📈 แนวโน้มสัญญาณชีพย้อนหลัง ({chronologicalRecords.length} ครั้งล่าสุด)
            </h4>
            <span className="trend-section-sub">เปรียบเทียบการเปลี่ยนแปลงความดันโลหิตและน้ำหนักตัว</span>
          </div>

          <div className="trend-records-timeline">
            {chronologicalRecords.map((rec, index) => {
              const isHigh = rec.systolicBP >= 140 || rec.diastolicBP >= 90;
              const isCrisis = rec.systolicBP >= 180 || rec.diastolicBP >= 110;
              const bpClass = isCrisis ? 'bp-crisis' : isHigh ? 'bp-high' : 'bp-normal';

              return (
                <div key={rec.id} className="timeline-step-item">
                  <div className="timeline-dot-wrap">
                    <div className={`timeline-dot ${bpClass}`}></div>
                    {index < chronologicalRecords.length - 1 && <div className="timeline-line"></div>}
                  </div>

                  <div className="timeline-content-card">
                    <div className="timeline-date-row">
                      <span className="timeline-date">{rec.dateOnly}</span>
                      <span className="timeline-time">{rec.timeOnly}</span>
                    </div>

                    <div className="timeline-vitals-grid">
                      <div className="timeline-vital-box">
                        <span className="vital-lbl">ความดัน (BP)</span>
                        <span className={`vital-val-bp ${bpClass}`}>
                          {rec.systolicBP}/{rec.diastolicBP}
                        </span>
                        <span className="vital-unit">mmHg</span>
                      </div>

                      <div className="timeline-vital-box">
                        <span className="vital-lbl">น้ำหนัก</span>
                        <span className="vital-val">{rec.weight}</span>
                        <span className="vital-unit">kg</span>
                      </div>

                      <div className="timeline-vital-box">
                        <span className="vital-lbl">BMI</span>
                        <span className="vital-val">{rec.bmi}</span>
                        <span className="vital-unit">{rec.bmiCategory}</span>
                      </div>

                      <div className="timeline-vital-box">
                        <span className="vital-lbl">ชีพจร (HR)</span>
                        <span className="vital-val">{rec.heartRate}</span>
                        <span className="vital-unit">bpm</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
