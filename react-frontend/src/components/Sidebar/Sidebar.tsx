import './Sidebar.css';
import { useEffect, useState } from 'react'; 
//useState = เก็บค่า
//useEffect = ทำงานหลังจากค่าเปลี่ยน
import homeIcon from '../../assets/home.svg';
import A1 from '../../assets/A1.svg';
import A2 from '../../assets/A2.svg';
import logoclinic from '../../assets/logiclinic.svg';

function Sidebar() {
  const [isDarkMode, setIsDarkMode] = useState(false);
// ===============สำหรับการสลับธีม==================
  const toggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };
 // ===============สำหรับการสลับธีมส่งไป body==================

  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [isDarkMode]);




  return (
    <aside className={`sidebar ${isDarkMode ? 'dark' : ''}`}>
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <img src={logoclinic} alt="Clinic Logo" />
        </div>
        <span className="sidebar-logo-text">Clinic MS</span>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <a href="#" className="sidebar-nav-item active">
          <span className="sidebar-nav-icon">
            <img src={homeIcon} alt="home" />
          </span>
          <span>หน้าหลัก</span>
        </a>
        <a href="#" className="sidebar-nav-item">
          <span className="sidebar-nav-icon">
            <img src={A1} alt="medication" />
          </span>
          <span>รายการยา</span>
        </a>
        <a href="#" className="sidebar-nav-item">
          <span className="sidebar-nav-icon">
            <img src={A2} alt="patient" />
          </span>
          <span>ประวัติผู้ป่วย</span>
        </a>
      </nav>

      {/* Bottom section */}
      <div className="sidebar-bottom">
        <div className="sidebar-mode-toggle">
          <label className="mode-label-single">
            <span>{isDarkMode ? ' Dark Mode' : ' Light Mode'}</span> {/*☀️🌙*/}
            <input
              type="checkbox"
              className="mode-checkbox"
              checked={isDarkMode}
              onChange={toggleTheme}
            />
            <span className={`mode-slider ${isDarkMode ? 'active' : ''}`}></span>
          </label>
        </div>

        <button className="sidebar-setting-btn">SETTING</button>
      </div>
    </aside>
  );
}

export default Sidebar;
