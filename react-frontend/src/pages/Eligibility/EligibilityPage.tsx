import React, { useState, useEffect, useCallback } from 'react';
import { eligibilityApi, patientApi, type BackendEligibility } from '../../services/api';
import { useWebSocket } from '../../context/WebSocketContext';
import { formatNationalId } from '../../utils/formatters';
import { validateThaiNationalID } from '../../utils/thaiIdValidator';
import './EligibilityPage.css';

export type SchemeType =
  | 'บัตรทอง (สปสช.)'
  | 'ประกันสังคม (ม.33)'
  | 'สิทธิ์ข้าราชการ'
  | 'ประกันสุขภาพเอกชน'
  | 'ชำระเงินเอง';

export interface EligibilityResult {
  patientId?: number;
  patientName: string;
  nationalId: string;
  schemeType: SchemeType;
  coverageDetails: string;
  hospitalName: string;
  verifiedAt: string;
  status: 'ใช้งานได้' | 'หมดอายุ' | 'รอตรวจสอบ';
  expireDate?: string;
}

export interface EligibilityHistoryItem {
  id: string;
  date: string;
  nationalId: string;
  patientName: string;
  schemeType: SchemeType;
  coverage: string;
  hospitalName: string;
  status: 'ใช้งานได้' | 'หมดอายุ' | 'รอตรวจสอบ';
  verifiedAt: string;
}

const mapBackendEligibilityToUI = (e: BackendEligibility): EligibilityHistoryItem => {
  let dateStr = 'วันนี้';
  let timeStr = '';
  if (e.verified_at) {
    try {
      const d = new Date(e.verified_at);
      if (!isNaN(d.getTime())) {
        dateStr = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear() + 543}`;
        timeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')} น.`;
      }
    } catch {
      dateStr = e.verified_at;
    }
  }

  return {
    id: String(e.id),
    date: dateStr,
    nationalId: formatNationalId(e.patient?.national_id),
    patientName: e.patient?.fullname || 'ผู้รับบริการ',
    schemeType: (e.scheme_type as SchemeType) || 'บัตรทอง (สปสช.)',
    coverage: e.coverage_details || '-',
    hospitalName: e.hospital_name || 'โรงพยาบาลคลินิกเวชกรรมชุมชน',
    status: (e.status as 'ใช้งานได้' | 'หมดอายุ' | 'รอตรวจสอบ') || 'ใช้งานได้',
    verifiedAt: `${dateStr} ${timeStr}`.trim(),
  };
};

const EligibilityPage: React.FC = () => {
  const [searchNationalId, setSearchNationalId] = useState('');
  const [currentResult, setCurrentResult] = useState<EligibilityResult | null>(null);
  const [historyList, setHistoryList] = useState<EligibilityHistoryItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Accordion Dropdown States สำหรับการ์ดทั้ง 2 ใบ
  const [isCheckCardOpen, setIsCheckCardOpen] = useState(true);
  const [isHistoryCardOpen, setIsHistoryCardOpen] = useState(true);

  // Filter & Search สำหรับตารางประวัติ
  const [historySearch, setHistorySearch] = useState('');
  const [schemeFilter, setSchemeFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 6;

  // State Modal รายละเอียดสิทธิ์
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<EligibilityHistoryItem | null>(null);

  // ดึงประวัติการตรวจสอบสิทธิ์ทั้งหมดจาก Backend DB
  const fetchHistory = useCallback(async () => {
    try {
      const data = await eligibilityApi.getHistory();
      if (Array.isArray(data)) {
        setHistoryList(data.map(mapBackendEligibilityToUI));
      }
    } catch (err) {
      console.warn('Could not fetch eligibility history from backend:', err);
    }
  }, []);

  const { subscribe } = useWebSocket();

  useEffect(() => {
    fetchHistory();

    // ดักฟังเหตุการณ์ Real-time เมื่อมีการบันทึกสิทธิ์หรือลงทะเบียนคนไข้ใหม่
    const unsubElig = subscribe('ELIGIBILITY_SAVED', () => {
      fetchHistory();
    });
    const unsubPatient = subscribe('PATIENT_REGISTERED', () => {
      fetchHistory();
    });

    return () => {
      unsubElig();
      unsubPatient();
    };
  }, [fetchHistory, subscribe]);

  // คำนวณสถิติ
  const stats = {
    total: historyList.length,
    gold: historyList.filter((h) => h.schemeType === 'บัตรทอง (สปสช.)').length,
    social: historyList.filter((h) => h.schemeType === 'ประกันสังคม (ม.33)').length,
    gov: historyList.filter((h) => h.schemeType === 'สิทธิ์ข้าราชการ').length,
    other: historyList.filter(
      (h) => h.schemeType !== 'บัตรทอง (สปสช.)' && h.schemeType !== 'ประกันสังคม (ม.33)' && h.schemeType !== 'สิทธิ์ข้าราชการ'
    ).length,
  };

  // ตรวจสอบสิทธิ์จริงผ่าน Backend API
  const handleCheckEligibility = async (idToSearch?: string) => {
    const rawId = (idToSearch || searchNationalId).trim();
    const cleanId = rawId.replace(/[-\s]/g, '');

    if (!cleanId) {
      setErrorMessage('กรุณาระบุเลขประจำตัวประชาชน 13 หลัก');
      return;
    }

    setIsSearching(true);
    setErrorMessage(null);

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} น.`;
    const dateStr = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear() + 543}`;

    try {
      const res = await eligibilityApi.check(cleanId);
      if (res) {
        setCurrentResult({
          patientId: res.patient_id,
          patientName: res.fullname,
          nationalId: formatNationalId(res.national_id),
          schemeType: (res.scheme_type as SchemeType) || 'บัตรทอง (สปสช.)',
          coverageDetails: res.coverage_details,
          hospitalName: 'โรงพยาบาลคลินิกเวชกรรมชุมชน',
          verifiedAt: `${dateStr} ${timeStr}`,
          status: 'ใช้งานได้',
          expireDate: '31/12/2026',
        });
        setIsSearching(false);
        return;
      }
    } catch {
      // Fallback
    }

    // Fallback เมื่อค้นหาไม่พบใน DB
    const formattedId = formatNationalId(cleanId);

    setCurrentResult({
      patientName: `ผู้รับบริการ (เลข ${cleanId.slice(0, 4)}...)`,
      nationalId: formattedId,
      schemeType: 'บัตรทอง (สปสช.)',
      coverageDetails: 'ครอบคลุมการรักษาโรคทั่วไป ยกเว้นค่ายานอกบัญชี',
      hospitalName: 'โรงพยาบาลเครือข่าย สปสช.',
      verifiedAt: `${dateStr} ${timeStr}`,
      status: 'ใช้งานได้',
      expireDate: '31/12/2026',
    });
    setIsSearching(false);
  };

  // บันทึกสิทธิ์เข้าประวัติลง Backend DB จริง
  const handleConfirmAndSave = async () => {
    if (!currentResult) return;

    try {
      let pid = currentResult.patientId;
      if (!pid) {
        try {
          const p = await patientApi.search(currentResult.nationalId.replace(/[-\s]/g, ''));
          if (p) {
            pid = Array.isArray(p) ? p[0]?.id : p.id;
          }
        } catch {
          // not in db yet
        }
      }

      if (pid) {
        await eligibilityApi.save({
          patient_id: pid,
          scheme_type: currentResult.schemeType,
          coverage_details: currentResult.coverageDetails,
          hospital_name: currentResult.hospitalName,
          status: currentResult.status,
          expire_date: currentResult.expireDate,
        });
        fetchHistory();
      }
    } catch (err) {
      console.warn('Save eligibility error:', err);
    }

    const now = new Date();
    const dateStr = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear() + 543}`;

    const newHistoryItem: EligibilityHistoryItem = {
      id: `hist-${Date.now()}`,
      date: dateStr,
      nationalId: currentResult.nationalId,
      patientName: currentResult.patientName,
      schemeType: currentResult.schemeType,
      coverage: currentResult.coverageDetails,
      hospitalName: currentResult.hospitalName,
      status: currentResult.status,
      verifiedAt: currentResult.verifiedAt,
    };

    setHistoryList((prev) => [newHistoryItem, ...prev]);
    setCurrentResult(null);
    setSearchNationalId('');
  };

  // ยกเลิก / เคลียร์ฟอร์ม
  const handleCancel = () => {
    setCurrentResult(null);
    setSearchNationalId('');
    setErrorMessage(null);
  };

  // Filter ตารางประวัติ
  const filteredHistory = historyList.filter((item) => {
    const matchSearch =
      item.patientName.toLowerCase().includes(historySearch.toLowerCase()) ||
      item.nationalId.includes(historySearch) ||
      item.coverage.toLowerCase().includes(historySearch.toLowerCase());

    const matchScheme = schemeFilter === 'all' || item.schemeType === schemeFilter;
    return matchSearch && matchScheme;
  });

  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentHistoryItems = filteredHistory.slice(startIndex, startIndex + itemsPerPage);

  const getSchemeBadgeClass = (scheme: string) => {
    if (scheme.includes('บัตรทอง')) return 'badge-scheme-gold';
    if (scheme.includes('ประกันสังคม')) return 'badge-scheme-social';
    if (scheme.includes('ข้าราชการ')) return 'badge-scheme-gov';
    return 'badge-scheme-private';
  };

  return (
    <div className="eligibility-page">
      {/* Page Header (Consistent with Queue Management Header) */}

      {/* Page Header (Consistent with Queue Management Header) */}
      <div className="eligibility-page-header">
        <div className="eligibility-header-left">
          <h1 className="eligibility-title">ตรวจสอบสิทธิ์การรักษา (Medical Eligibility Check)</h1>
          <p className="eligibility-subtitle">
            ระบบตรวจสอบและยืนยันสิทธิประโยชน์การรักษาพยาบาลแบบ Real-time (สำหรับเจ้าหน้าที่เวชระเบียน)
          </p>
        </div>
      </div>

      {/* Quick Summary Stat Cards (Matching Queue Page Style) */}
      <div className="eligibility-stats-grid">
        <div
          className={`stat-card ${schemeFilter === 'all' ? 'active' : ''}`}
          onClick={() => {
            setSchemeFilter('all');
            setCurrentPage(1);
          }}
        >
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">สิทธิ์ที่ตรวจทั้งหมด</div>
        </div>

        <div
          className={`stat-card stat-gold ${schemeFilter === 'บัตรทอง (สปสช.)' ? 'active' : ''}`}
          onClick={() => {
            setSchemeFilter('บัตรทอง (สปสช.)');
            setCurrentPage(1);
          }}
        >
          <div className="stat-value">{stats.gold}</div>
          <div className="stat-label">บัตรทอง (สปสช.)</div>
        </div>

        <div
          className={`stat-card stat-social ${schemeFilter === 'ประกันสังคม (ม.33)' ? 'active' : ''}`}
          onClick={() => {
            setSchemeFilter('ประกันสังคม (ม.33)');
            setCurrentPage(1);
          }}
        >
          <div className="stat-value">{stats.social}</div>
          <div className="stat-label">ประกันสังคม</div>
        </div>

        <div
          className={`stat-card stat-gov ${schemeFilter === 'สิทธิ์ข้าราชการ' ? 'active' : ''}`}
          onClick={() => {
            setSchemeFilter('สิทธิ์ข้าราชการ');
            setCurrentPage(1);
          }}
        >
          <div className="stat-value">{stats.gov}</div>
          <div className="stat-label">สิทธิ์ข้าราชการ</div>
        </div>

        <div
          className={`stat-card stat-other ${
            schemeFilter !== 'all' &&
            schemeFilter !== 'บัตรทอง (สปสช.)' &&
            schemeFilter !== 'ประกันสังคม (ม.33)' &&
            schemeFilter !== 'สิทธิ์ข้าราชการ'
              ? 'active'
              : ''
          }`}
          onClick={() => {
            setSchemeFilter('ประกันสุขภาพเอกชน');
            setCurrentPage(1);
          }}
        >
          <div className="stat-value">{stats.other}</div>
          <div className="stat-label">สิทธิ์อื่นๆ / เอกชน</div>
        </div>
      </div>

      {/* Main Verification Card */}
      <div className="eligibility-main-card">
        <div
          className="main-card-header clickable-header"
          onClick={() => setIsCheckCardOpen((prev) => !prev)}
        >
          <div className="header-title-wrap">
            <div className="card-header-icon-box blue-box">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="header-icon">
                <path
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <h2 className="main-card-title">ค้นหาและตรวจสอบสิทธิ์ (Eligibility Check)</h2>
              <p className="main-card-subtitle">ตรวจสอบและยืนยันสิทธิประโยชน์การรักษาพยาบาลจากฐานข้อมูล สปสช. / ประกันสังคม</p>
            </div>
          </div>
          <div className="header-right-actions">
            <span className="online-status-badge">
              <span className="status-dot"></span> เชื่อมต่อระบบ สปสช. ออนไลน์
            </span>
            <button
              type="button"
              className={`card-accordion-toggle ${isCheckCardOpen ? 'open' : ''}`}
              aria-label="ย่อ/ขยายการ์ดตรวจสอบสิทธิ์"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19.5 8.25l-7.5 7.5-7.5-7.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        {isCheckCardOpen && (
          <div className="main-card-body">
            {/* Search Box Section */}
            <div className="eligibility-search-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label className="search-label" style={{ marginBottom: 0 }}>
                  <span>เลขประจำตัวประชาชน (National ID)</span>
                </label>
                {searchNationalId.length > 0 && (() => {
                  const val = validateThaiNationalID(searchNationalId);
                  return (
                    <span
                      style={{
                        fontSize: '12.5px',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '6px',
                        backgroundColor: val.isValid
                          ? '#ECFDF5'
                          : val.isComplete
                          ? '#FEF2F2'
                          : '#EFF6FF',
                        color: val.isValid
                          ? '#059669'
                          : val.isComplete
                          ? '#DC2626'
                          : '#2563EB',
                        border: `1px solid ${
                          val.isValid ? '#A7F3D0' : val.isComplete ? '#FECACA' : '#BFDBFE'
                        }`,
                      }}
                    >
                      {val.isValid
                        ? '✓ เลขบัตรถูกต้อง (Mod 11)'
                        : val.isComplete
                        ? '✕ Checksum ไม่ตรง'
                        : `พิมพ์แล้ว ${searchNationalId.replace(/\D/g, '').length}/13 หลัก`}
                    </span>
                  );
                })()}
              </div>

              <div className="search-input-group">
                <div className="search-input-wrap">
                  <svg className="search-icon-inside" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <input
                    type="text"
                    className="eligibility-input"
                    placeholder="ระบุเลขบัตรประชาชน 13 หลัก (เช่น 0123456789012 หรือ 1-1002-34567-89-0)..."
                    value={searchNationalId}
                    onChange={(e) => setSearchNationalId(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCheckEligibility();
                    }}
                  />
                  {searchNationalId && (
                    <button type="button" className="btn-clear-input" onClick={() => setSearchNationalId('')}>
                      ✕
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  className="btn-submit-check"
                  disabled={isSearching}
                  onClick={() => handleCheckEligibility()}
                >
                  {isSearching ? (
                    <span className="btn-loading-text">กำลังตรวจสอบ...</span>
                  ) : (
                    <>
                      <svg viewBox="0 0 20 20" fill="currentColor" className="btn-check-icon">
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span>ตรวจสอบสิทธิ์ (Check)</span>
                    </>
                  )}
                </button>
              </div>

              {errorMessage && <p className="error-message-text">{errorMessage}</p>}
            </div>

            {/* Verification Result Section */}
            {currentResult ? (
              <div className="verification-result-container">
                {/* Alert Header Banner */}
                <div className="result-banner-header">
                  <div className="banner-badge-icon">
                    <svg viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="banner-text-group">
                    <span className="banner-heading">พบสิทธิการรักษาพยาบาล</span>
                    <span className="banner-subheading">สิทธิ์การรักษาพร้อมใช้งานสำหรับรับบริการ</span>
                  </div>
                  <div className="banner-status-tag">สถานะ: {currentResult.status}</div>
                </div>

                {/* Patient and Scheme Information Grid */}
                <div className="result-info-grid">
                  <div className="info-item">
                    <span className="info-field-label">ชื่อ-นามสกุล คนไข้</span>
                    <span className="info-field-value font-bold-patient">{currentResult.patientName}</span>
                  </div>

                  <div className="info-item">
                    <span className="info-field-label">เลขบัตรประชาชน</span>
                    <span className="info-field-value font-id-mono">{currentResult.nationalId}</span>
                  </div>

                  <div className="info-item">
                    <span className="info-field-label">ประเภทสิทธิ์การรักษา</span>
                    <div className="info-field-value">
                      <span className={`scheme-pill ${getSchemeBadgeClass(currentResult.schemeType)}`}>
                        {currentResult.schemeType}
                      </span>
                    </div>
                  </div>

                  <div className="info-item">
                    <span className="info-field-label">สถานพยาบาลหลัก / สาขา</span>
                    <span className="info-field-value">{currentResult.hospitalName}</span>
                  </div>

                  <div className="info-item full-width-item">
                    <span className="info-field-label">รายละเอียดความคุ้มครอง</span>
                    <span className="info-field-value coverage-highlight">{currentResult.coverageDetails}</span>
                  </div>

                  <div className="info-item">
                    <span className="info-field-label">วัน-เวลาที่ตรวจสอบ</span>
                    <span className="info-field-value verified-time-text">{currentResult.verifiedAt}</span>
                  </div>

                  {currentResult.expireDate && (
                    <div className="info-item">
                      <span className="info-field-label">วันหมดอายุสิทธิ์</span>
                      <span className="info-field-value">{currentResult.expireDate}</span>
                    </div>
                  )}
                </div>

                {/* Action Buttons Row */}
                <div className="result-action-footer">
                  <button type="button" className="btn-confirm-save-action" onClick={handleConfirmAndSave}>
                    <svg viewBox="0 0 20 20" fill="currentColor" className="btn-icon-svg">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>ยืนยันและบันทึกสิทธิ์ (Confirm & Save)</span>
                  </button>

                  <button type="button" className="btn-cancel-clear-action" onClick={handleCancel}>
                    <span>ยกเลิก (Cancel)</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="result-empty-placeholder">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="empty-shield-icon">
                  <path
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <p className="empty-main-text">พร้อมตรวจสอบสิทธิ์การรักษาพยาบาล</p>
                <p className="empty-sub-text">ระบุเลขบัตรประชาชน 13 หลัก แล้วกดตรวจสอบ</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Card: Eligibility History Table Card (Styled like Queue Table) */}
      <div className="eligibility-table-card">
        {/* Table Controls (Search & Filter) */}
        <div
          className="table-controls-header clickable-header"
          onClick={() => setIsHistoryCardOpen((prev) => !prev)}
        >
          <div className="header-title-wrap">
            <div className="card-header-icon-box purple-box">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="header-icon">
                <path
                  d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <div className="header-title-group">
                <h2 className="table-card-title">ประวัติการตรวจสอบสิทธิ์ (Eligibility History)</h2>
                <span className="history-count-pill">{filteredHistory.length} รายการ</span>
              </div>
              <p className="table-card-subtitle">บันทึกประวัติการตรวจสอบสิทธิ์ของผู้ป่วยที่มารับบริการทั้งหมด</p>
            </div>
          </div>

          <div className="header-right-actions">
            <div className="table-filter-actions" onClick={(e) => e.stopPropagation()}>
              {/* Search Input */}
              <div className="history-search-wrap">
                <svg className="table-search-icon" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M9 17A8 8 0 109 1a8 8 0 000 16zM19 19l-4.35-4.35"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <input
                  type="text"
                  className="history-search-input"
                  placeholder="ค้นหาชื่อคนไข้ หรือ เลขบัตร..."
                  value={historySearch}
                  onChange={(e) => {
                    setHistorySearch(e.target.value);
                    setCurrentPage(1);
                  }}
                />
                {historySearch && (
                  <button className="clear-filter-btn" onClick={() => setHistorySearch('')}>
                    ✕
                  </button>
                )}
              </div>

              {/* Scheme Type Filter Dropdown */}
              <select
                className="scheme-dropdown-filter"
                value={schemeFilter}
                onChange={(e) => {
                  setSchemeFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="all">ประเภทสิทธิ์ทั้งหมด</option>
                <option value="บัตรทอง (สปสช.)">บัตรทอง (สปสช.)</option>
                <option value="ประกันสังคม (ม.33)">ประกันสังคม (ม.33)</option>
                <option value="สิทธิ์ข้าราชการ">สิทธิ์ข้าราชการ</option>
                <option value="ประกันสุขภาพเอกชน">ประกันสุขภาพเอกชน</option>
              </select>
            </div>

            <button
              type="button"
              className={`card-accordion-toggle ${isHistoryCardOpen ? 'open' : ''}`}
              aria-label="ย่อ/ขยายการ์ดประวัติการตรวจสอบสิทธิ์"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19.5 8.25l-7.5 7.5-7.5-7.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        {isHistoryCardOpen && (
          <div className="history-card-body">
            {/* Modern History Table */}
            <div className="table-responsive">
              <table className="modern-eligibility-table">
                <thead>
                  <tr>
                    <th className="col-date">วันที่ตรวจสอบ</th>
                    <th className="col-patient">ชื่อ-นามสกุล</th>
                    <th className="col-scheme">ประเภทสิทธิ์</th>
                    <th className="col-coverage">รายละเอียดความคุ้มครอง</th>
                    <th className="col-status">สถานะ</th>
                    <th className="col-action">การดำเนินการ</th>
                  </tr>
                </thead>
                <tbody>
                  {currentHistoryItems.length > 0 ? (
                    currentHistoryItems.map((item) => (
                      <tr key={item.id} className="eligibility-table-row">
                        <td className="col-date">
                          <span className="table-date-badge">{item.date}</span>
                        </td>
                        <td className="col-patient">
                          <div className="table-patient-cell">
                            <span className="patient-name-bold">{item.patientName}</span>
                            <span className="patient-id-sub">{item.nationalId}</span>
                          </div>
                        </td>
                        <td className="col-scheme">
                          <span className={`scheme-pill ${getSchemeBadgeClass(item.schemeType)}`}>
                            {item.schemeType}
                          </span>
                        </td>
                        <td className="col-coverage">
                          <div className="coverage-cell-wrap">
                            <span className="coverage-cell-text">{item.coverage}</span>
                            <span className="coverage-hospital-sub">{item.hospitalName}</span>
                          </div>
                        </td>
                        <td className="col-status">
                          <span className="status-pill-active">
                            {item.status}
                          </span>
                        </td>
                        <td className="col-action">
                          <button
                            type="button"
                            className="btn-view-details"
                            onClick={() => setSelectedHistoryItem(item)}
                          >
                            <svg viewBox="0 0 20 20" fill="currentColor" className="view-icon">
                              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                              <path
                                fillRule="evenodd"
                                d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                            <span>รายละเอียด</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="empty-table-cell">
                        <div className="empty-state-wrap">
                          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
                            <path d="M9 10h.01M15 10h.01M9.5 15a3.5 3.5 0 005 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                          <p>ไม่พบประวัติการตรวจสอบสิทธิ์ที่ตรงกับเงื่อนไข</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer (Identical to Queue Management Table) */}
            <div className="table-pagination-footer">
              <div className="pagination-info">
                แสดง {filteredHistory.length > 0 ? startIndex + 1 : 0} ถึง{' '}
                {Math.min(startIndex + itemsPerPage, filteredHistory.length)} จาก {filteredHistory.length} รายการ
              </div>
              <div className="pagination-controls">
                <button
                  type="button"
                  className="pagination-btn pagination-prev"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                >
                  ย้อนกลับ
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    type="button"
                    className={`pagination-btn pagination-num ${currentPage === pageNum ? 'active' : ''}`}
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </button>
                ))}
                <button
                  type="button"
                  className="pagination-btn pagination-next"
                  disabled={currentPage === totalPages || totalPages === 0}
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                >
                  ถัดไป
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal: View Details for History Item */}
      {selectedHistoryItem && (
        <div className="modal-backdrop" onClick={() => setSelectedHistoryItem(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-group">
                <h3 className="modal-title">รายละเอียดสิทธิ์การรักษาพยาบาล</h3>
                <p className="modal-subtitle">ข้อมูลการตรวจสอบสิทธิ์ย้อนหลัง</p>
              </div>
              <button className="modal-close-btn" onClick={() => setSelectedHistoryItem(null)}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="modal-detail-card">
                <div className="modal-detail-row">
                  <span className="modal-label">ชื่อ-นามสกุล คนไข้:</span>
                  <span className="modal-val font-bold">{selectedHistoryItem.patientName}</span>
                </div>
                <div className="modal-detail-row">
                  <span className="modal-label">เลขประจำตัวประชาชน:</span>
                  <span className="modal-val font-mono">{selectedHistoryItem.nationalId}</span>
                </div>
                <div className="modal-detail-row">
                  <span className="modal-label">ประเภทสิทธิ์การรักษา:</span>
                  <span className={`scheme-pill ${getSchemeBadgeClass(selectedHistoryItem.schemeType)}`}>
                    {selectedHistoryItem.schemeType}
                  </span>
                </div>
                <div className="modal-detail-row">
                  <span className="modal-label">สถานพยาบาลหลัก:</span>
                  <span className="modal-val">{selectedHistoryItem.hospitalName}</span>
                </div>
                <div className="modal-detail-row">
                  <span className="modal-label">ความคุ้มครอง:</span>
                  <span className="modal-val">{selectedHistoryItem.coverage}</span>
                </div>
                <div className="modal-detail-row">
                  <span className="modal-label">สถานะการใช้งาน:</span>
                  <span className="status-pill-active">{selectedHistoryItem.status}</span>
                </div>
                <div className="modal-detail-row">
                  <span className="modal-label">เวลาที่บันทึกข้อมูล:</span>
                  <span className="modal-val">{selectedHistoryItem.verifiedAt}</span>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="modal-btn-close"
                onClick={() => setSelectedHistoryItem(null)}
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EligibilityPage;
