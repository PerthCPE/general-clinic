import React, { useState } from 'react';
import type { Patient } from '../types';

interface PatientSearchCardProps {
  onSearch: (query: string) => void;
  searchResult: Patient | null;
  notFoundQuery: string | null;
  onAssignQueue: (patient: Patient) => void;
  onViewMoreInfo: (patient: Patient) => void;
  onClearSearch: () => void;
  onScrollToForm: () => void;
}

const PatientSearchCard: React.FC<PatientSearchCardProps> = ({
  onSearch,
  searchResult,
  notFoundQuery,
  onAssignQueue,
  onViewMoreInfo,
  onClearSearch,
  onScrollToForm,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchClick = () => {
    if (searchQuery.trim()) {
      onSearch(searchQuery.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearchClick();
  };

  const handleQuickChip = (id: string) => {
    setSearchQuery(id);
    onSearch(id);
  };

  const getSchemeClass = (scheme: string) => {
    if (scheme.includes('บัตรทอง')) return 'badge-scheme-gold';
    if (scheme.includes('ประกันสังคม')) return 'badge-scheme-social';
    if (scheme.includes('ข้าราชการ')) return 'badge-scheme-gov';
    return 'badge-scheme-private';
  };

  return (
    <div className="reg-card">
      <div className="reg-card-header" onClick={() => setIsOpen(!isOpen)}>
        <div className="reg-header-title-wrap">
          <div className="reg-header-icon-box blue-box">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M21 21l-4.35-4.35M19 11a8 8 0 11-16 0 8 8 0 0116 0z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <h2 className="reg-card-title">ค้นหาข้อมูลคนไข้เดิม (Patient Lookup)</h2>
            <p className="reg-card-subtitle">ค้นหาด้วยเลขประจำตัวประชาชน 13 หลัก หรือ ชื่อ-นามสกุล เพื่อส่งต่อเข้าคิว</p>
          </div>
        </div>
        <button className={`reg-card-toggle ${isOpen ? 'open' : ''}`} aria-label="Toggle Accordion">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19.5 8.25l-7.5 7.5-7.5-7.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      <div className={`reg-card-body ${isOpen ? 'expanded' : ''}`}>
        {/* Search Bar Row */}
        <div className="reg-search-section">
          <div className="reg-search-row">
            <div className="reg-search-input-wrap">
              <svg className="reg-search-icon-inside" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                  clipRule="evenodd"
                />
              </svg>
              <input
                type="text"
                className="reg-search-input"
                placeholder="ระบุเลขบัตรประชาชน 13 หลัก หรือ ชื่อ-นามสกุล..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="reg-clear-search-btn"
                  onClick={() => {
                    setSearchQuery('');
                    onClearSearch();
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            <button type="button" className="reg-search-btn" onClick={handleSearchClick}>
              <svg viewBox="0 0 20 20" fill="currentColor" className="btn-icon-svg">
                <path
                  fillRule="evenodd"
                  d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                  clipRule="evenodd"
                />
              </svg>
              <span>ค้นหาคนไข้</span>
            </button>
          </div>

          {/* Quick Demo Chips */}
          <div className="reg-quick-chips">
            <span className="reg-chips-label">ทดสอบค้นหาด่วน:</span>
            <button
              type="button"
              className="reg-chip-btn"
              onClick={() => handleQuickChip('0123456789012')}
            >
              0123456789012 (สมชาย)
            </button>
            <button
              type="button"
              className="reg-chip-btn"
              onClick={() => handleQuickChip('3100598765432')}
            >
              3100598765432 (วิภาดา)
            </button>
            <button
              type="button"
              className="reg-chip-btn"
              onClick={() => handleQuickChip('1101455443219')}
            >
              1101455443219 (อาทิตย์)
            </button>
          </div>
        </div>

        {/* Search Result - Found Patient Profile */}
        {searchResult && (
          <div className="reg-search-result-card">
            <div className="reg-result-header">
              <div className="reg-patient-avatar">
                {searchResult.fullName.slice(0, 2)}
              </div>
              <div className="reg-patient-main-info">
                <div className="reg-patient-name-row">
                  <h3 className="reg-patient-name">{searchResult.fullName}</h3>
                  <span className="reg-hn-badge">HN: {searchResult.hn}</span>
                  <span className={`scheme-pill ${getSchemeClass(searchResult.schemeType)}`}>
                    {searchResult.schemeType}
                  </span>
                </div>
                <p className="reg-patient-sub-meta">
                  เพศ {searchResult.gender} • อายุ {searchResult.age} ปี • เกิดเมื่อ {searchResult.dob}
                </p>
              </div>
            </div>

            <div className="reg-patient-detail-grid">
              <div className="reg-detail-item">
                <span className="reg-detail-label">เลขประจำตัวประชาชน</span>
                <span className="reg-detail-val font-mono">{searchResult.nationalId}</span>
              </div>
              <div className="reg-detail-item">
                <span className="reg-detail-label">เบอร์โทรติดต่อ</span>
                <span className="reg-detail-val font-phone">{searchResult.phone}</span>
              </div>
              <div className="reg-detail-item">
                <span className="reg-detail-label">เบอร์ติดต่อฉุกเฉิน</span>
                <span className="reg-detail-val">{searchResult.emergencyContact || '-'}</span>
              </div>
              <div className="reg-detail-item">
                <span className="reg-detail-label">สิทธิการรักษา</span>
                <span className="reg-detail-val">{searchResult.schemeType}</span>
              </div>
              <div className="reg-detail-item full-width">
                <span className="reg-detail-label">ที่อยู่ปัจจุบัน</span>
                <span className="reg-detail-val">{searchResult.address}</span>
              </div>
            </div>

            <div className="reg-result-actions">
              <button
                type="button"
                className="reg-btn-assign-queue"
                onClick={() => onAssignQueue(searchResult)}
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="btn-icon-svg">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>เพิ่มผู้ป่วยเข้าคิวตรวจ (Assign Queue)</span>
              </button>

              <button
                type="button"
                className="reg-btn-more-info"
                onClick={() => onViewMoreInfo(searchResult)}
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="btn-icon-svg">
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                  <path
                    fillRule="evenodd"
                    d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>ดูประวัติเต็ม</span>
              </button>
            </div>
          </div>
        )}

        {/* Not Found State */}
        {notFoundQuery && !searchResult && (
          <div className="reg-not-found-box">
            <div className="not-found-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
                <path d="M9 9l6 6m0-6l-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </div>
            <div className="not-found-text-wrap">
              <h4 className="not-found-title">ไม่พบข้อมูลผู้ป่วย "{notFoundQuery}"</h4>
              <p className="not-found-desc">
                ยังไม่มีข้อมูลประวัติผู้ป่วยรายนี้ในระบบ สามารถกรอกแบบฟอร์มด้านล่างเพื่อลงทะเบียนผู้ป่วยใหม่ได้ทันที
              </p>
            </div>
            <button type="button" className="reg-btn-scroll-form" onClick={onScrollToForm}>
              <span>+ ไปที่ฟอร์มลงทะเบียน</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientSearchCard;
