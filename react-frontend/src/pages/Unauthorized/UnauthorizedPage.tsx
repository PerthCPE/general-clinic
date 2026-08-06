import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { PAGE_PERMISSIONS } from '../../config/roles';
import './UnauthorizedPage.css';

interface UnauthorizedPageProps {
  attemptedPage: string;
  onNavigateHome: () => void;
}

const UnauthorizedPage: React.FC<UnauthorizedPageProps> = ({ attemptedPage, onNavigateHome }) => {
  const { currentUser } = useAuth();
  const allowedRoles = PAGE_PERMISSIONS[attemptedPage] || [];

  return (
    <div className="unauthorized-container">
      <div className="unauthorized-card">
        <div className="unauthorized-icon-badge">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M12 15v2m0-8V5a2 2 0 00-2-2H8a2 2 0 00-2 2v4M5 9h14a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2v-9a2 2 0 012-2z"
              stroke="#EF4444"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <span className="unauthorized-code">403 Access Denied</span>
        <h1 className="unauthorized-title">ไม่มีสิทธิ์เข้าถึงหน้านี้</h1>
        <p className="unauthorized-desc">
          บัญชีของคุณอยู่ในบทบาท <strong>"{currentUser?.roleTitleTh} ({currentUser?.role})"</strong> ซึ่งไม่มีสิทธิ์เข้าใช้งานหน้านี้
        </p>

        {allowedRoles.length > 0 && (
          <div className="unauthorized-role-info">
            <span className="info-label">บทบาทที่ได้รับอนุญาต:</span>
            <div className="role-tags">
              {allowedRoles.map((role) => (
                <span key={role} className="role-tag">
                  {role}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="unauthorized-actions">
          <button className="unauth-btn-primary" onClick={onNavigateHome}>
            กลับสู่หน้าหลักของคุณ
          </button>
        </div>
      </div>
    </div>
  );
};

export default UnauthorizedPage;
