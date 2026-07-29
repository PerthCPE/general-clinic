import './Topbar.css';
import notify_nothave from '../../assets/notify_nothave.svg';
import notify_have from '../../assets/notify_haves.svg';
import { useState } from 'react';



function Topbar() {
    const [hasNotification, setHasNotification] = useState(false);  //บุญสร้างให้มี state  
  return (
    <header className="topbar">
      {/* Left: Brand label */}
      {/* <div className="topbar-brand">
        <div className="topbar-brand-icon">🏥</div>
        <span className="topbar-brand-text">Clinic MS</span>
      </div> */}

      {/* Center: Search */}
      <div className="topbar-search">
        <span className="topbar-search-icon">🔍</span>
        <input
          type="text"
          className="topbar-search-input"
          placeholder="Search patients, records..."
        />
      </div>

      {/* Right: Actions */}
      <div className="topbar-actions">
        <button className="topbar-chat-btn">
          💬 Chat Block
        </button>

        {/*=============================== Notifications ===============================*/}

        <button className="topbar-icon-btn" aria-label="Notifications">
      <img 
        src={hasNotification ? notify_have : notify_nothave} 
        alt="notification" 
        width="20" 
        height="20" 
      />
    </button>
        {/*=============================== Notifications ===============================*/}
        <div className="topbar-user">
          <div className="topbar-user-info">
            <span className="topbar-user-name">Dr.Bunkham Y.</span>
            <span className="topbar-user-role">Pharmacist</span>
          </div>
          <div className="topbar-avatar">👨‍⚕️</div>
        </div>
      </div>
    </header>
    
  );
  
}

export default Topbar;
