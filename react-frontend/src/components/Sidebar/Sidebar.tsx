import React from 'react';
import './Sidebar.css';
import { useAuth } from '../../context/AuthContext';
import { ROLE_MENUS } from '../../config/roles';
import type { NavItem } from '../../types/auth';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activePage: string;
  onNavigate: (page: string) => void;
}

// Icon helper function for rendering crisp SVGs
const renderNavIcon = (iconType: NavItem['iconType']) => {
  switch (iconType) {
    case 'registration':
      return (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4-4v2m5.5-6a4 4 0 100-8 4 4 0 000 8zM20 8v6m3-3h-6" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    case 'queue':
      return (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    case 'eligibility':
      return (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    case 'vitals':
      return (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    case 'history':
      return (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    default:
      return null;
  }
};

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, activePage, onNavigate }) => {
  const { currentUser } = useAuth();

  // ดึงเมนูที่ตรงกับ Role ของผู้ใช้ปัจจุบัน (registrar หรือ nurse)
  const currentRole = currentUser?.role || 'registrar';
  const menuItems = ROLE_MENUS[currentRole] || [];

  return (
    <aside className={`sidebar ${isOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      {/* TOP Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M18 14H14V18H10V14H6V10H10V6H14V10H18M20 2H4C2.9 2 2 2.9 2 4V20C2 21.1 2.9 22 4 22H20C21.1 22 22 21.1 22 20V4C22 2.9 21.1 2 20 2M20 20H4V4H20V20Z"
              fill="#FFFFFF"
            />
          </svg>
        </div>
        <span className="sidebar-logo-text">General Clinic</span>
        {/* ปุ่มกากบาทปิด Sidebar */}
        <button className="sidebar-close-btn" onClick={onClose} aria-label="Close Sidebar">
          <svg viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 1l10 10M11 1L1 11" stroke="#959595" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Navigation dynamically filtered by Role */}
      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className={`sidebar-nav-item ${activePage === item.id ? 'active' : ''}`}
            onClick={(e) => {
              e.preventDefault();
              onNavigate(item.id);
            }}
          >
            <span className="sidebar-nav-icon">
              {renderNavIcon(item.iconType)}
            </span>
            <span>{item.title}</span>
          </a>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
