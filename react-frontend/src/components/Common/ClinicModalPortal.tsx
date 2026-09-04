import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ClinicModalPortalProps {
  children: React.ReactNode;
  isOpen?: boolean;
  onClose?: () => void;
  closeOnBackdropClick?: boolean;
  zIndex?: number;
  className?: string;
}

export const ClinicModalPortal: React.FC<ClinicModalPortalProps> = ({
  children,
  isOpen = true,
  onClose,
  closeOnBackdropClick = true,
  zIndex = 999999,
  className = ''
}) => {
  // ล็อก Body Scroll 100% ไม่ให้ฉากหลังเลื่อนได้ขณะเปิด Modal
  useEffect(() => {
    if (!isOpen) return;

    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalBodyPaddingRight = document.body.style.paddingRight;

    // คำนวณความกว้าง scrollbar เพื่อป้องกันหน้าจอขยับ
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.paddingRight = originalBodyPaddingRight;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className={`clinic-modal-portal-backdrop ${className}`}
      onClick={(e) => {
        if (e.target === e.currentTarget && closeOnBackdropClick && onClose) {
          onClose();
        }
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box',
        animation: 'clinicPortalFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards'
      }}
    >
      <style>{`
        @keyframes clinicPortalFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes clinicModalZoom {
          0% { opacity: 0; transform: scale3d(0.96, 0.96, 1); }
          100% { opacity: 1; transform: scale3d(1, 1, 1); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        body.dark-mode .clinic-modal-portal-backdrop {
          background-color: rgba(0, 0, 0, 0.65) !important;
        }
        body.dark-mode .clinic-action-loading-card {
          background-color: #1E293B !important;
          border: 1px solid #334155 !important;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5) !important;
        }
        body.dark-mode .clinic-action-loading-card h3 {
          color: #F8FAFC !important;
        }
        body.dark-mode .clinic-action-loading-card p {
          color: #94A3B8 !important;
        }
        body.dark-mode .clinic-action-loading-card .loading-spinner-wrapper {
          background-color: #1E3A5F !important;
        }
      `}</style>
      {children}
    </div>,
    document.body
  );
};

interface ClinicActionLoadingModalProps {
  title?: string;
  subtitle?: string;
  isOpen?: boolean;
}

export const ClinicActionLoadingModal: React.FC<ClinicActionLoadingModalProps> = ({
  title = 'กำลังบันทึกลงฐานข้อมูล',
  subtitle = 'กรุณารอสักครู่ ระบบกำลังประมวลผลข้อมูล...',
  isOpen = true
}) => {
  if (!isOpen) return null;

  return (
    <ClinicModalPortal isOpen={isOpen} closeOnBackdropClick={false} zIndex={9999999}>
      <div
        role="status"
        aria-live="polite"
        className="clinic-action-loading-card"
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '24px',
          padding: '32px 28px',
          textAlign: 'center',
          maxWidth: '384px',
          width: '92%',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          animation: 'clinicModalZoom 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          userSelect: 'none'
        }}
      >
        {/* อนิเมชั่น Spinner รูปแบบเดียวกับแผนกแพทย์ (Doctor Module) */}
        <div
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            backgroundColor: '#EFF6FF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto'
          }}
        >
          <span
            style={{
              display: 'block',
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              border: '4px solid #BFDBFE',
              borderTopColor: '#2563EB',
              animation: 'spin 1s linear infinite'
            }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: '6px', width: '100%' }}>
          <h3 style={{ fontSize: '19px', fontWeight: '700', color: '#0F172A', margin: 0, fontFamily: 'var(--font-heading, "Kanit", sans-serif)', textAlign: 'center' }}>
            {title}
          </h3>
          <p style={{ fontSize: '13.5px', color: '#64748B', margin: 0, lineHeight: '1.6', textAlign: 'center', maxWidth: '300px', fontFamily: 'var(--font-primary, "IBM Plex Sans Thai", sans-serif)' }}>
            {subtitle}
          </p>
        </div>
      </div>
    </ClinicModalPortal>
  );
};

export default ClinicModalPortal;
