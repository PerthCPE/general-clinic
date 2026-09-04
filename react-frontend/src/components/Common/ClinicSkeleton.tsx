import React from 'react';
import { ClinicActionLoadingModal } from './ClinicModalPortal';

interface SkeletonProps {
  rows?: number;
  type?: 'table' | 'cards' | 'detail' | 'billing';
  showLoadingPopup?: boolean;
  popupTitle?: string;
  popupSubtitle?: string;
}

export const ClinicSkeleton: React.FC<SkeletonProps> = ({ 
  rows = 5, 
  type = 'table',
  showLoadingPopup = true,
  popupTitle = 'กำลังโหลดข้อมูลจากฐานข้อมูล',
  popupSubtitle = 'กรุณารอสักครู่ ระบบกำลังดึงข้อมูล...'
}) => {
  return (
    <div className="clinic-skeleton-container" style={{ width: '100%', padding: '16px 0', animation: 'fadeIn 0.3s ease-out' }}>
      <style>{`
        @keyframes shimmerGPU {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes doctorPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .skel-bone {
          background: linear-gradient(90deg, #F1F5F9 25%, #E2E8F0 50%, #F1F5F9 75%);
          background-size: 200% 100%;
          animation: shimmerGPU 1.5s infinite, doctorPulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          border-radius: 8px;
        }
        body.dark-mode .skel-bone {
          background: linear-gradient(90deg, #1E293B 25%, #334155 50%, #1E293B 75%);
          background-size: 200% 100%;
        }
      `}</style>

      {/* ป๊อกอัพโหลดข้อมูลตรงกลางจอพร้อมฉากหลังเบลอสวยงาม และล็อก Scroll สไตล์แผนกแพทย์ */}
      {showLoadingPopup && (
        <ClinicActionLoadingModal
          isOpen={true}
          title={popupTitle}
          subtitle={popupSubtitle}
        />
      )}

      {type === 'cards' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ background: '#FFFFFF', padding: '20px', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
              <div className="skel-bone" style={{ height: '16px', width: '50%', marginBottom: '12px' }}></div>
              <div className="skel-bone" style={{ height: '32px', width: '70%', marginBottom: '8px' }}></div>
              <div className="skel-bone" style={{ height: '14px', width: '40%' }}></div>
            </div>
          ))}
        </div>
      )}

      {/* Table Skeleton */}
      <div style={{ background: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '20px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #F1F5F9' }}>
          <div className="skel-bone" style={{ height: '20px', width: '15%' }}></div>
          <div className="skel-bone" style={{ height: '20px', width: '25%' }}></div>
          <div className="skel-bone" style={{ height: '20px', width: '20%' }}></div>
          <div className="skel-bone" style={{ height: '20px', width: '20%' }}></div>
          <div className="skel-bone" style={{ height: '20px', width: '20%' }}></div>
        </div>
        {Array.from({ length: rows }).map((_, idx) => (
          <div key={idx} style={{ display: 'flex', gap: '16px', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid #F8FAFC' }}>
            <div className="skel-bone" style={{ height: '28px', width: '15%', borderRadius: '6px' }}></div>
            <div className="skel-bone" style={{ height: '20px', width: '25%' }}></div>
            <div className="skel-bone" style={{ height: '16px', width: '20%' }}></div>
            <div className="skel-bone" style={{ height: '24px', width: '20%', borderRadius: '999px' }}></div>
            <div className="skel-bone" style={{ height: '32px', width: '20%', borderRadius: '8px' }}></div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const PharmacyMedicineSkeleton: React.FC = () => (
  <ClinicSkeleton 
    type="cards" 
    rows={5} 
    popupTitle="กำลังโหลดข้อมูลคลังยา"
    popupSubtitle="กรุณารอสักครู่ ระบบกำลังดึงรายการยาและจำนวนสต็อกจากฐานข้อมูล..." 
  />
);

export const PharmacyDetailSkeleton: React.FC = () => (
  <ClinicSkeleton 
    type="table" 
    rows={4} 
    popupTitle="กำลังโหลดคิวจ่ายยา"
    popupSubtitle="กรุณารอสักครู่ ระบบกำลังดึงรายการสั่งยาและประวัติผู้ป่วย..." 
  />
);

export const PharmacyHistorySkeleton: React.FC = () => (
  <ClinicSkeleton 
    type="table" 
    rows={6} 
    popupTitle="กำลังโหลดประวัติการรับยา"
    popupSubtitle="กรุณารอสักครู่ ระบบกำลังดึงข้อมูลประวัติการจ่ายยาย้อนหลัง..." 
  />
);

export const BillingDashboardSkeleton: React.FC = () => (
  <ClinicSkeleton 
    type="cards" 
    rows={6} 
    popupTitle="กำลังโหลดแดชบอร์ดการเงิน"
    popupSubtitle="กรุณารอสักครู่ ระบบกำลังคำนวณยอดรายรับและประวัติการชำระเงิน..." 
  />
);

export const BillingInvoiceSkeleton: React.FC = () => (
  <ClinicSkeleton 
    type="table" 
    rows={4} 
    popupTitle="กำลังโหลดข้อมูลใบแจ้งหนี้"
    popupSubtitle="กรุณารอสักครู่ ระบบกำลังเตรียมรายละเอียดการชำระเงิน..." 
  />
);

export const BillingDispenseSkeleton: React.FC = () => (
  <ClinicSkeleton 
    type="table" 
    rows={5} 
    popupTitle="กำลังโหลดคิวชำระเงิน"
    popupSubtitle="กรุณารอสักครู่ ระบบกำลังดึงข้อมูลผู้ป่วยรอชำระเงิน..." 
  />
);

export default ClinicSkeleton;
