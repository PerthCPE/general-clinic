import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar/Sidebar';
import Topbar from './components/Topbar/Topbar';

import LoginPage from './pages/Login/LoginPage';
import UnauthorizedPage from './pages/Unauthorized/UnauthorizedPage';
import { VitalsPage } from './pages/Vitals/VitalsPage';
import { ScreeningHistoryPage } from './pages/ScreeningHistory/ScreeningHistoryPage';
import RegistrationPage from './pages/Registration/RegistrationPage';
import QueuePage from './pages/Queue/QueuePage';
import EligibilityPage from './pages/Eligibility/EligibilityPage';
import PageShowcase from './pages/Common/PageShowcase';
import DetailPage from './pages/pharmacy/DetailPage';
import MedicinePage from './pages/pharmacy/MedicinePage';
import PatientHistoryPage from './pages/pharmacy/PatientHistoryPage';
import BillingDashboardPage from './pages/billing/BillingDashboardPage';
import BillingDispensePage from './pages/billing/BillingDispensePage';
import BillingInvoicePage from './pages/billing/BillingInvoicePage';
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

  const [patientRightsMap, setPatientRightsMap] = useState<Record<string, string>>({});
  const handleUpdatePatientRights = (patientId: string, rights: string) => {
    setPatientRightsMap(prev => ({ ...prev, [patientId]: rights }));
  };

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
        return <VitalsPage />;

      case 'vitals-history':
        return <ScreeningHistoryPage />;

      // ===== Pharmacist Pages =====
      case 'pharmacy-dispense':
        return <DetailPage 
          patientRightsMap={patientRightsMap}
          onUpdatePatientRights={handleUpdatePatientRights}
        />;
      case 'pharmacy-stock':
        return <MedicinePage />;
      case 'pharmacy-history':
        return <PatientHistoryPage />;

      // ===== Cashier Pages =====
      case 'billing-dispense':
        return <BillingDispensePage 
          patientRightsMap={patientRightsMap}
          onUpdatePatientRights={handleUpdatePatientRights}
        />;
      case 'billing-invoice':
        return <BillingInvoicePage 
          patientRightsMap={patientRightsMap}
          onUpdatePatientRights={handleUpdatePatientRights}
        />;
      case 'billing-dashboard':
        return <BillingDashboardPage />;

      default:
        return <PageShowcase roleBadge="System" roleBadgeColor="#6B7280" title="หน้าแรก" subtitle="ยินดีต้อนรับ" description="กรุณาเลือกเมนูจากแถบด้านซ้าย" features={[]} />;
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
