import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar/Sidebar';
import Topbar from './components/Topbar/Topbar';
import RegistrationPage from './pages/Registration/RegistrationPage';
import QueuePage from './pages/Queue/QueuePage';
import EligibilityPage from './pages/Eligibility/EligibilityPage';
import LoginPage from './pages/Login/LoginPage';
import UnauthorizedPage from './pages/Unauthorized/UnauthorizedPage';
import PageShowcase from './pages/Common/PageShowcase';
import { ROLE_DEFAULT_PAGES } from './config/roles';
import './App.css';

function MainApp() {
  const { currentUser, isAuthenticated, hasAccess } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('isDarkMode') === 'true';
  });
  const [activePage, setActivePage] = useState<string>(() => {
    return localStorage.getItem('activePage') || 'registration';
  });

  // บันทึก Tab ปัจจุบันลง localStorage เมื่อมีการเปลี่ยน Tab
  useEffect(() => {
    localStorage.setItem('activePage', activePage);
  }, [activePage]);

  // บันทึกโหมดสี และใส่/ถอด class dark-mode บน body
  useEffect(() => {
    localStorage.setItem('isDarkMode', String(isDarkMode));
    if (isDarkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [isDarkMode]);

  // เมื่อสลับ Role: ถ้าหน้าที่เปิดอยู่ไม่มีสิทธิ์ ให้ Redirect ไปที่หน้าเริ่มต้นของ Role นั้นอัตโนมัติ
  useEffect(() => {
    if (currentUser) {
      if (!hasAccess(activePage)) {
        setActivePage(ROLE_DEFAULT_PAGES[currentUser.role]);
      }
    }
  }, [currentUser, activePage, hasAccess]);

  const toggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

  // หากยังไม่ได้ Login ให้แสดงหน้า LoginPage
  if (!isAuthenticated) {
    return (
      <LoginPage
        onLoginSuccess={() => {
          if (currentUser) {
            setActivePage(ROLE_DEFAULT_PAGES[currentUser.role]);
          }
        }}
      />
    );
  }

  // Router & Route Guard Component
  const renderContent = () => {
    // ตรวจสอบสิทธิ์ Role-Based Access Control (RBAC)
    if (!hasAccess(activePage)) {
      return (
        <UnauthorizedPage
          attemptedPage={activePage}
          onNavigateHome={() => {
            if (currentUser) {
              setActivePage(ROLE_DEFAULT_PAGES[currentUser.role]);
            }
          }}
        />
      );
    }

    switch (activePage) {
      // ===== Shared & Registrar Pages =====
      case 'registration':
        return <RegistrationPage />;

      case 'queue':
        return <QueuePage />;

      case 'eligibility':
        return <EligibilityPage />;

      // ===== Nurse Pages =====
      case 'vitals':
        return (
          <PageShowcase
            roleBadge="Nurse"
            roleBadgeColor="#10B981"
            title="บันทึกสัญญาณชีพ & คัดกรอง (Vitals & Triage)"
            subtitle="บันทึกค่าความดันโลหิต อุณหภูมิ ชีพจร อัตราการหายใจ และอาการสำคัญ"
            description="ฟอร์มบันทึกสัญญาณชีพและคัดกรองอาการเบื้องต้นเพื่อประเมินความเร่งด่วนก่อนส่งพบแพทย์"
            features={[
              'บันทึกค่าความดัน (BP), ชีพจร (PR), อุณหภูมิ (Temp), น้ำหนัก, ส่วนสูง, BMI',
              'ประเมินระดับความรุนแรงและฉุกเฉิน (Triage Classification)',
              'บันทึกอาการสำคัญ (Chief Complaint) และประวัติแพ้ยา',
              'ส่งต่อไปยังคิวห้องตรวจแพทย์ที่พร้อมให้บริการ',
            ]}
          />
        );

      case 'vitals-history':
        return (
          <PageShowcase
            roleBadge="Nurse"
            roleBadgeColor="#10B981"
            title="ประวัติการคัดกรอง (Screening History)"
            subtitle="ดูประวัติการตรวจวัดสัญญาณชีพย้อนหลังของผู้ป่วยแต่ละราย"
            description="ค้นหาและตรวจสอบประวัติการวัดสัญญาณชีพในแต่ละครั้งที่ผู้ป่วยมารับบริการ"
            features={[
              'ค้นหาประวัติการคัดกรองด้วยเลขบัตรประชาชนหรือชื่อคนไข้',
              'ดูกราฟแนวโน้มความดันโลหิตและน้ำหนักตัวย้อนหลัง',
              'พิมพ์ใบคัดกรองประวัติสัญญาณชีพ',
            ]}
          />
        );

      default:
        return <RegistrationPage />;
    }
  };

  return (
    <div className="app-layout">
      {/* 1. Left Sidebar - Menu filtered dynamically for Registrar & Nurse */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        activePage={activePage}
        onNavigate={setActivePage}
      />

      {/* 2. Top Navigation Bar */}
      <Topbar
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen(true)}
        isDarkMode={isDarkMode}
        onToggleTheme={toggleTheme}
      />

      {/* 3. Main Body Content */}
      <main className={`body-content ${isSidebarOpen ? 'body-with-sidebar' : 'body-full'}`}>
        {renderContent()}
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

export default App;
