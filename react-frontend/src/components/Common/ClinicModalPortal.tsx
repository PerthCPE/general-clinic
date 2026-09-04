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
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(12px) saturate(180%)',
        WebkitBackdropFilter: 'blur(12px) saturate(180%)',
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
        @keyframes clinicScaleInGPU {
          0% { opacity: 0; transform: scale3d(0.92, 0.92, 1); }
          100% { opacity: 1; transform: scale3d(1, 1, 1); }
        }
        @keyframes clinicSpinGPU {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
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
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '24px',
          padding: '40px 36px',
          textAlign: 'center',
          maxWidth: '420px',
          width: '92%',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.8)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '20px',
          animation: 'clinicScaleInGPU 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          userSelect: 'none'
        }}
      >
        <div
          style={{
            width: '84px',
            height: '84px',
            borderRadius: '50%',
            backgroundColor: '#EFF6FF',
            border: '2px solid #DBEAFE',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 16px -4px rgba(37, 99, 235, 0.15)'
          }}
        >
          <span
            style={{
              display: 'block',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              border: '4px solid #BFDBFE',
              borderTopColor: '#2563EB',
              animation: 'clinicSpinGPU 0.8s linear infinite'
            }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: '8px', width: '100%' }}>
          <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#0F172A', margin: 0, fontFamily: 'var(--font-primary, "IBM Plex Sans Thai", sans-serif)', textAlign: 'center' }}>
            {title}
          </h3>
          <p style={{ fontSize: '14.5px', color: '#64748B', margin: 0, lineHeight: '1.6', textAlign: 'center', maxWidth: '320px' }}>
            {subtitle}
          </p>
        </div>
      </div>
    </ClinicModalPortal>
  );
};

export default ClinicModalPortal;
