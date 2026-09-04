import React from 'react';

interface SkeletonProps {
  rows?: number;
  type?: 'table' | 'cards' | 'detail' | 'billing';
}

export const ClinicSkeleton: React.FC<SkeletonProps> = ({ rows = 5, type = 'table' }) => {
  return (
    <div className="clinic-skeleton-container" style={{ width: '100%', padding: '16px 0', animation: 'fadeIn 0.3s ease-out' }}>
      <style>{`
        @keyframes shimmerGPU {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .skel-bone {
          background: linear-gradient(90deg, #F1F5F9 25%, #E2E8F0 50%, #F1F5F9 75%);
          background-size: 200% 100%;
          animation: shimmerGPU 1.5s infinite;
          border-radius: 8px;
        }
        body.dark-mode .skel-bone {
          background: linear-gradient(90deg, #1E293B 25%, #334155 50%, #1E293B 75%);
          background-size: 200% 100%;
        }
      `}</style>

      {/* Top Status Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', padding: '10px 16px', background: '#EFF6FF', borderRadius: '10px', border: '1px solid #BFDBFE' }}>
        <div style={{ width: '14px', height: '14px', border: '2px solid #2563EB', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
        <span style={{ fontSize: '13px', fontWeight: '600', color: '#1E40AF' }}>กำลังโหลดข้อมูลจากฐานข้อมูล... กรุณารอสักครู่</span>
      </div>

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

export const PharmacyMedicineSkeleton: React.FC = () => <ClinicSkeleton type="cards" rows={5} />;
export const PharmacyDetailSkeleton: React.FC = () => <ClinicSkeleton type="table" rows={4} />;
export const BillingDashboardSkeleton: React.FC = () => <ClinicSkeleton type="cards" rows={6} />;
export const BillingInvoiceSkeleton: React.FC = () => <ClinicSkeleton type="table" rows={4} />;

export default ClinicSkeleton;
