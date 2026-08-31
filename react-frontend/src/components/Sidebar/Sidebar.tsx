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
    case 'dispense':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    case 'stock':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    case 'invoice':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M9 14h6m-6 4h6m2 4H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V20a2 2 0 01-2 2z" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    case 'dashboard':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 3h7v7H3V3zm11 0h7v7h-7V3zm0 11h7v7h-7v-7zm-11 0h7v7H3v-7z" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    case 'examination':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M4.5 3v6.5a5.5 5.5 0 0011 0V3M8 3H3m5 0v-.5M15.5 3H21m-5.5 0v-.5M12 14.5v3.5a3 3 0 006 0V16a3 3 0 00-2-2.83" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="18.5" cy="10.5" r="2" strokeWidth="1.66667"/>
        </svg>
      );
    case 'schedule':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 2v3m8-3v3M3.5 9h17M4 5h16a1 1 0 011 1v13a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1z" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    case 'records':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M9 12h6m-6 4h4M7 3.5h10a2 2 0 012 2V19a2 2 0 01-2 2H7a2 2 0 01-2-2V5.5a2 2 0 012-2z" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round"/>
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
