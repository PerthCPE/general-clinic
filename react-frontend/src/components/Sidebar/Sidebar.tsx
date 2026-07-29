import './Sidebar.css';
import homeIcon from '../../assets/home.svg' ;// ใช้ import homeIcon from '../../assets/home.svg'
import A1 from '../../assets/A1.svg';
import A2 from '../../assets/A2.svg';

function Sidebar() {
  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">🏥</div>
        <span className="sidebar-logo-text">Clinic MS</span>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <a href="#" className="sidebar-nav-item active">
          <span className="sidebar-nav-icon"><img src={homeIcon} alt="home" width="20" height="20" /></span>
          <span>หน้าหลัก</span>
        </a>
        <a href="#" className="sidebar-nav-item">
          <span className="sidebar-nav-icon"><img src={A1} alt="medication" width="20" height="20" /></span>
          <span>รายการยา</span>
        </a>
        <a href="#" className="sidebar-nav-item">
          <span className="sidebar-nav-icon"><img src={A2} alt="patient" width="20" height="20" /></span>
          <span>ประวัติผู้ป่วย</span>
        </a>
      </nav>

      {/* Bottom section */}
      <div className="sidebar-bottom">
        <div className="sidebar-mode-toggle">
          <label className="mode-label">
            <span>White Mode</span>
            <input type="checkbox" className="mode-checkbox" />
            <span className="mode-slider"></span>
          </label>
          <label className="mode-label">
            <span>Dark Mode</span>
            <input type="checkbox" className="mode-checkbox" defaultChecked />
            <span className="mode-slider active"></span>
          </label>
        </div>
        <button className="sidebar-setting-btn">SETTING</button>
      </div>
    </aside>
  );
}

export default Sidebar;
