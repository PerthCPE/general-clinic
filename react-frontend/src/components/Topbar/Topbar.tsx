import './Topbar.css';
import { useState, useRef, useEffect } from 'react';

interface TopbarProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

function Topbar({ isSidebarOpen, onToggleSidebar }: TopbarProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ปิด dropdown เมื่อคลิกที่อื่นบนหน้าจอ
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const toggleDropdown = () => {
    setIsDropdownOpen((prev) => !prev);
  };

  return (
    <header className={`top-nav-header ${isSidebarOpen ? 'topbar-with-sidebar' : 'topbar-full'}`}>

      {/* ปุ่มวงกลมสีเขียว - แสดงเมื่อ Sidebar ปิด */}
      {!isSidebarOpen && (
        <button className="topbar-menu-toggle" onClick={onToggleSidebar} aria-label="Open Sidebar">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      )}

      {/* Group 82 - Search */}
      <div className="search-container">
        <div className="search-icon">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <input className="search-input" type="text" placeholder="Search" />
      </div>

      {/* Group 84 - Actions */}
      <div className="actions-group">
        {/* Notice icon */}
        <button className="notice-btn" aria-label="Notifications">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M13.73 21a2 2 0 01-3.46 0" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="notice-badge" />
        </button>

        {/* Profile with Dropdown */}
        <div className="profile-container" ref={dropdownRef}>
          <div className="profile-wrap" onClick={toggleDropdown} role="button" tabIndex={0}>
            <div className="avatar-circle">
              <div className="avatar-bg">
                <svg viewBox="0 0 24 24" fill="#323C40" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              </div>
            </div>
            <div className="user-text">
              <span className="user-name">Dr. Anong S.</span>
              <span className="user-role">General Practitioner</span>
            </div>
            <div className={`dropdown-arrow ${isDropdownOpen ? 'open' : ''}`}>
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19.5 8.25l-7.5 7.5-7.5-7.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div className="profile-dropdown-menu">
              <button
                className="dropdown-menu-item dropdown-item-1"
                onClick={() => {
                  console.log('ตั้งค่าโปรไฟล์');
                  setIsDropdownOpen(false);
                }}
              >
                ตั้งค่าโปรไฟล์
              </button>
              <button
                className="dropdown-menu-item dropdown-item-2"
                onClick={() => {
                  console.log('ออกจากระบบ');
                  setIsDropdownOpen(false);
                }}
              >
                ออกจากระบบ
              </button>
            </div>
          )}
        </div>
      </div>

    </header>
  );
}

export default Topbar;
