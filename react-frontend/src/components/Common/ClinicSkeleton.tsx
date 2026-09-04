import React from 'react';

/**
 * =========================================================================
 * CLINIC SKELETON UI PRIMITIVES (>60 FPS GPU ACCELERATED)
 * =========================================================================
 */

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
  style?: React.CSSProperties;
}

export const SkeletonBox: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '20px',
  borderRadius = '8px',
  className = '',
  style = {},
}) => {
  return (
    <div
      className={`clinic-skeleton-item ${className}`}
      style={{
        width,
        height,
        borderRadius,
        ...style,
      }}
    />
  );
};

export const SkeletonCircle: React.FC<{ size?: number | string; className?: string; style?: React.CSSProperties }> = ({
  size = 40,
  className = '',
  style = {},
}) => {
  return (
    <SkeletonBox
      width={size}
      height={size}
      borderRadius="50%"
      className={className}
      style={{ flexShrink: 0, ...style }}
    />
  );
};

export const SkeletonText: React.FC<{
  lines?: number;
  height?: string | number;
  gap?: number;
  lastLineWidth?: string;
}> = ({ lines = 2, height = '14px', gap = 8, lastLineWidth = '60%' }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: `${gap}px`, width: '100%' }}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBox
          key={i}
          height={height}
          width={i === lines - 1 && lines > 1 ? lastLineWidth : '100%'}
        />
      ))}
    </div>
  );
};

export const SkeletonStatusPill: React.FC<{ message?: string }> = ({
  message = 'กำลังโหลดข้อมูลจากฐานข้อมูล... กรุณารอสักครู่',
}) => {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', width: '100%', margin: '8px 0 20px 0' }}>
      <div className="clinic-loading-status-pill">
        <div className="clinic-loading-spinner-ring" />
        <span>{message}</span>
      </div>
    </div>
  );
};

/**
 * =========================================================================
 * 1. PHARMACY DETAIL SKELETON (ห้องยา - จัดยา & ส่งต่อการเงิน)
 * =========================================================================
 */
export const PharmacyDetailSkeleton: React.FC = () => {
  return (
    <div className="detail-page-container" style={{ animation: 'clinicFadeInGPU 0.25s ease' }}>
      <SkeletonStatusPill message="กำลังโหลดข้อมูลคิวจ่ายยาและประวัติจากฐานข้อมูล... กรุณารอสักครู่" />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <SkeletonBox width="260px" height="32px" style={{ marginBottom: '8px' }} />
          <SkeletonBox width="380px" height="18px" />
        </div>
        <SkeletonBox width="140px" height="36px" borderRadius="20px" />
      </div>

      {/* 2-Column Main Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '24px' }}>
        {/* Left Column: Queue List */}
        <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <SkeletonBox width="120px" height="22px" />
            <SkeletonBox width="60px" height="24px" borderRadius="12px" />
          </div>
          <SkeletonBox width="100%" height="40px" borderRadius="10px" />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[1, 2, 3, 4].map(idx => (
              <div
                key={idx}
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  border: '1px solid #F1F5F9',
                  background: idx === 1 ? '#F8FAFC' : '#FFFFFF',
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'center',
                }}
              >
                <SkeletonCircle size={44} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <SkeletonBox width="80px" height="18px" />
                    <SkeletonBox width="60px" height="18px" borderRadius="10px" />
                  </div>
                  <SkeletonBox width="140px" height="16px" />
                  <SkeletonBox width="100px" height="12px" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Dispense Detail */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Patient Header Card */}
          <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '24px' }}>
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '20px' }}>
              <SkeletonCircle size={64} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <SkeletonBox width="200px" height="24px" />
                  <SkeletonBox width="90px" height="24px" borderRadius="12px" />
                </div>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <SkeletonBox width="100px" height="16px" />
                  <SkeletonBox width="80px" height="16px" />
                  <SkeletonBox width="120px" height="16px" />
                </div>
              </div>
            </div>

            {/* Vitals Grid Skeleton */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', padding: '16px', background: '#F8FAFC', borderRadius: '12px' }}>
              {[1, 2, 3, 4].map(v => (
                <div key={v} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <SkeletonBox width="60px" height="12px" />
                  <SkeletonBox width="90px" height="18px" />
                </div>
              ))}
            </div>
          </div>

          {/* Medications Table Card */}
          <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <SkeletonBox width="180px" height="22px" />
              <SkeletonBox width="80px" height="20px" borderRadius="10px" />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[1, 2, 3].map(m => (
                <div key={m} style={{ display: 'grid', gridTemplateColumns: '60px 2fr 1.5fr 80px 100px', gap: '12px', alignItems: 'center', padding: '14px', borderBottom: '1px solid #F1F5F9' }}>
                  <SkeletonBox width="50px" height="16px" />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <SkeletonBox width="160px" height="18px" />
                    <SkeletonBox width="100px" height="12px" />
                  </div>
                  <SkeletonBox width="140px" height="16px" />
                  <SkeletonBox width="50px" height="16px" />
                  <SkeletonBox width="70px" height="18px" />
                </div>
              ))}
            </div>

            {/* Total and Action Button Skeleton */}
            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px', borderTop: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <SkeletonBox width="80px" height="18px" />
                <SkeletonBox width="120px" height="28px" />
              </div>
              <SkeletonBox width="260px" height="48px" borderRadius="12px" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * =========================================================================
 * 2. PHARMACY MEDICINE SKELETON (ระบบจัดการคลังยา)
 * =========================================================================
 */
export const PharmacyMedicineSkeleton: React.FC = () => {
  return (
    <div className="medicine-page-container" style={{ animation: 'clinicFadeInGPU 0.25s ease' }}>
      <SkeletonStatusPill message="กำลังโหลดข้อมูลรายการคลังยาจากฐานข้อมูล... กรุณารอสักครู่" />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <SkeletonBox width="240px" height="32px" style={{ marginBottom: '8px' }} />
          <SkeletonBox width="360px" height="18px" />
        </div>
        <SkeletonBox width="150px" height="44px" borderRadius="10px" />
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '24px' }}>
        {[1, 2, 3].map(card => (
          <div key={card} style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <SkeletonBox width="110px" height="14px" />
              <SkeletonBox width="80px" height="32px" />
              <SkeletonBox width="140px" height="12px" />
            </div>
            <SkeletonCircle size={48} />
          </div>
        ))}
      </div>

      {/* Filter and Search Bar */}
      <div style={{ background: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '16px 20px', marginBottom: '24px', display: 'flex', gap: '16px' }}>
        <SkeletonBox width="320px" height="42px" borderRadius="10px" />
        <SkeletonBox width="180px" height="42px" borderRadius="10px" />
        <SkeletonBox width="140px" height="42px" borderRadius="10px" />
      </div>

      {/* Medicine Grid/Table Skeleton */}
      <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {[1, 2, 3, 4, 5, 6].map(row => (
            <div key={row} style={{ display: 'grid', gridTemplateColumns: '80px 2fr 1.5fr 1fr 1fr 100px', gap: '16px', alignItems: 'center', padding: '14px', borderBottom: '1px solid #F1F5F9' }}>
              <SkeletonBox width="70px" height="20px" borderRadius="6px" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <SkeletonBox width="180px" height="18px" />
                <SkeletonBox width="120px" height="12px" />
              </div>
              <SkeletonBox width="120px" height="24px" borderRadius="12px" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <SkeletonBox width="80px" height="14px" />
                <SkeletonBox width="100px" height="8px" borderRadius="4px" />
              </div>
              <SkeletonBox width="80px" height="18px" />
              <div style={{ display: 'flex', gap: '8px' }}>
                <SkeletonBox width="36px" height="36px" borderRadius="8px" />
                <SkeletonBox width="36px" height="36px" borderRadius="8px" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * =========================================================================
 * 3. PHARMACY HISTORY SKELETON (หน้าประวัติรับยา / ประวัติผู้ป่วย)
 * =========================================================================
 */
export const PharmacyHistorySkeleton: React.FC = () => {
  return (
    <div className="patient-history-container" style={{ animation: 'clinicFadeInGPU 0.25s ease' }}>
      <SkeletonStatusPill message="กำลังโหลดข้อมูลประวัติการรับยาของผู้ป่วยจากฐานข้อมูล... กรุณารอสักครู่" />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <SkeletonBox width="260px" height="32px" style={{ marginBottom: '8px' }} />
          <SkeletonBox width="420px" height="18px" />
        </div>
        <SkeletonBox width="160px" height="40px" borderRadius="10px" />
      </div>

      {/* Filter Card Skeleton */}
      <div style={{ background: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '20px 24px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '16px' }}>
          <SkeletonBox width="100%" height="42px" borderRadius="10px" />
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {[1, 2, 3, 4].map(btn => (
            <SkeletonBox key={btn} width="110px" height="32px" borderRadius="8px" />
          ))}
        </div>
      </div>

      {/* Table Card */}
      <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <SkeletonBox width="220px" height="22px" />
          <SkeletonBox width="120px" height="24px" borderRadius="12px" />
        </div>

        <div style={{ padding: '12px 24px' }}>
          {[1, 2, 3, 4, 5, 6, 7].map(r => (
            <div key={r} style={{ display: 'grid', gridTemplateColumns: '10% 22% 8% 8% 18% 12% 12% 10%', gap: '10px', alignItems: 'center', padding: '16px 0', borderBottom: '1px solid #F1F5F9' }}>
              <SkeletonBox width="60px" height="18px" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <SkeletonBox width="150px" height="18px" />
                <SkeletonBox width="70px" height="12px" borderRadius="4px" />
              </div>
              <SkeletonBox width="45px" height="16px" />
              <SkeletonBox width="40px" height="22px" borderRadius="6px" />
              <SkeletonBox width="120px" height="22px" borderRadius="12px" />
              <SkeletonBox width="50px" height="16px" />
              <SkeletonBox width="90px" height="20px" borderRadius="10px" />
              <SkeletonBox width="70px" height="32px" borderRadius="8px" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * =========================================================================
 * 4. BILLING DISPENSE SKELETON (ห้องการเงิน - ดึงคิว & ออกบิล)
 * =========================================================================
 */
export const BillingDispenseSkeleton: React.FC = () => {
  return (
    <div className="billing-dispense-container" style={{ animation: 'clinicFadeInGPU 0.25s ease' }}>
      <SkeletonStatusPill message="กำลังโหลดข้อมูลคิวการเงินรอออกบิลจากฐานข้อมูล... กรุณารอสักครู่" />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <SkeletonBox width="240px" height="32px" style={{ marginBottom: '8px' }} />
          <SkeletonBox width="360px" height="18px" />
        </div>
        <SkeletonBox width="130px" height="36px" borderRadius="20px" />
      </div>

      {/* 2-Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '24px' }}>
        {/* Left Column: Queues */}
        <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <SkeletonBox width="140px" height="22px" />
            <SkeletonBox width="60px" height="24px" borderRadius="12px" />
          </div>
          <SkeletonBox width="100%" height="40px" borderRadius="10px" />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[1, 2, 3, 4].map(q => (
              <div key={q} style={{ padding: '16px', borderRadius: '12px', border: '1px solid #F1F5F9', display: 'flex', gap: '12px', alignItems: 'center' }}>
                <SkeletonCircle size={44} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <SkeletonBox width="70px" height="18px" />
                    <SkeletonBox width="50px" height="18px" borderRadius="10px" />
                  </div>
                  <SkeletonBox width="130px" height="16px" />
                  <SkeletonBox width="90px" height="12px" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Billing Preview Card */}
        <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <SkeletonCircle size={56} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <SkeletonBox width="180px" height="22px" />
                <SkeletonBox width="100px" height="14px" />
              </div>
            </div>
            <SkeletonBox width="100px" height="28px" borderRadius="14px" />
          </div>

          <div style={{ padding: '16px', background: '#F8FAFC', borderRadius: '12px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            {[1, 2, 3].map(item => (
              <div key={item} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <SkeletonBox width="70px" height="12px" />
                <SkeletonBox width="110px" height="18px" />
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <SkeletonBox width="160px" height="20px" />
            {[1, 2, 3].map(line => (
              <div key={line} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #F1F5F9' }}>
                <SkeletonBox width="200px" height="16px" />
                <SkeletonBox width="80px" height="16px" />
              </div>
            ))}
          </div>

          <div style={{ marginTop: 'auto', paddingTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
            <SkeletonBox width="220px" height="48px" borderRadius="12px" />
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * =========================================================================
 * 5. BILLING INVOICE SKELETON (ห้องการเงิน - รายละเอียดใบเสร็จ & รับเงิน)
 * =========================================================================
 */
export const BillingInvoiceSkeleton: React.FC = () => {
  return (
    <div className="billing-invoice-container" style={{ animation: 'clinicFadeInGPU 0.25s ease' }}>
      <SkeletonStatusPill message="กำลังโหลดรายละเอียดใบแจ้งหนี้จากฐานข้อมูล... กรุณารอสักครู่" />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <SkeletonBox width="280px" height="32px" style={{ marginBottom: '8px' }} />
          <SkeletonBox width="380px" height="18px" />
        </div>
        <SkeletonBox width="120px" height="40px" borderRadius="10px" />
      </div>

      {/* Invoice Card */}
      <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Invoice Top Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '20px', borderBottom: '1px solid #E2E8F0' }}>
          <div>
            <SkeletonBox width="160px" height="26px" style={{ marginBottom: '6px' }} />
            <SkeletonBox width="110px" height="14px" />
          </div>
          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
            <SkeletonBox width="100px" height="24px" borderRadius="12px" />
            <SkeletonBox width="140px" height="14px" />
          </div>
        </div>

        {/* Patient Info Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', padding: '16px', background: '#F8FAFC', borderRadius: '12px' }}>
          {[1, 2, 3, 4].map(p => (
            <div key={p} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <SkeletonBox width="60px" height="12px" />
              <SkeletonBox width="100px" height="18px" />
            </div>
          ))}
        </div>

        {/* Fees Breakdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <SkeletonBox width="140px" height="20px" />
          {[1, 2, 3, 4].map(f => (
            <div key={f} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #F1F5F9' }}>
              <SkeletonBox width="240px" height="16px" />
              <SkeletonBox width="90px" height="16px" />
            </div>
          ))}
        </div>

        {/* Summary and Payment Buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '20px', borderTop: '1px solid #E2E8F0' }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <SkeletonBox width="120px" height="42px" borderRadius="10px" />
            <SkeletonBox width="120px" height="42px" borderRadius="10px" />
          </div>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div style={{ textAlign: 'right' }}>
              <SkeletonBox width="80px" height="14px" style={{ marginBottom: '4px' }} />
              <SkeletonBox width="140px" height="28px" />
            </div>
            <SkeletonBox width="200px" height="48px" borderRadius="12px" />
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * =========================================================================
 * 6. BILLING DASHBOARD SKELETON (ประวัติการชำระเงินของพนักงานการเงิน)
 * =========================================================================
 */
export const BillingDashboardSkeleton: React.FC = () => {
  return (
    <div className="billing-dashboard-container" style={{ animation: 'clinicFadeInGPU 0.25s ease' }}>
      <SkeletonStatusPill message="กำลังโหลดข้อมูลประวัติการชำระเงินและสถิติรายวันจากฐานข้อมูล... กรุณารอสักครู่" />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <SkeletonBox width="280px" height="32px" style={{ marginBottom: '8px' }} />
          <SkeletonBox width="400px" height="18px" />
        </div>
        <SkeletonBox width="150px" height="40px" borderRadius="10px" />
      </div>

      {/* 4 Metric Cards Skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '24px' }}>
        {[1, 2, 3, 4].map(c => (
          <div key={c} style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <SkeletonBox width="90px" height="14px" />
              <SkeletonBox width="110px" height="28px" />
              <SkeletonBox width="120px" height="12px" />
            </div>
            <SkeletonCircle size={48} />
          </div>
        ))}
      </div>

      {/* Search & Filter Card */}
      <div style={{ background: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '20px 24px', marginBottom: '24px', display: 'flex', gap: '16px' }}>
        <SkeletonBox width="40%" height="42px" borderRadius="10px" />
        <SkeletonBox width="25%" height="42px" borderRadius="10px" />
        <SkeletonBox width="25%" height="42px" borderRadius="10px" />
        <SkeletonBox width="10%" height="42px" borderRadius="10px" />
      </div>

      {/* History Table Card */}
      <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <SkeletonBox width="260px" height="22px" />
          <SkeletonBox width="100px" height="24px" borderRadius="12px" />
        </div>

        <div style={{ padding: '12px 24px' }}>
          {[1, 2, 3, 4, 5, 6].map(row => (
            <div key={row} style={{ display: 'grid', gridTemplateColumns: '14% 12% 22% 16% 14% 12% 10%', gap: '12px', alignItems: 'center', padding: '16px 0', borderBottom: '1px solid #F1F5F9' }}>
              <SkeletonBox width="90px" height="18px" />
              <SkeletonBox width="70px" height="18px" />
              <SkeletonBox width="160px" height="18px" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <SkeletonBox width="80px" height="14px" />
                <SkeletonBox width="60px" height="12px" />
              </div>
              <SkeletonBox width="80px" height="20px" />
              <SkeletonBox width="75px" height="22px" borderRadius="10px" />
              <div style={{ display: 'flex', gap: '8px' }}>
                <SkeletonBox width="32px" height="32px" borderRadius="8px" />
                <SkeletonBox width="32px" height="32px" borderRadius="8px" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
