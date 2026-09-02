import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WebSocketProvider } from './context/WebSocketContext';
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
import VitalsScreeningPage from './pages/nurse/VitalsScreeningPage';
import { DoctorDataProvider } from './pages/doctor/DoctorDataContext';
import DoctorDashboardPage from './pages/doctor/DoctorDashboardPage';
import DoctorQueuePage from './pages/doctor/DoctorQueuePage';
import DoctorExaminationPage from './pages/doctor/DoctorExaminationPage';
import DoctorSchedulePage from './pages/doctor/DoctorSchedulePage';
import DoctorRecordsPage from './pages/doctor/DoctorRecordsPage';
import { DocumentManagementPage } from './pages/officer/DocumentManagementPage';
import { ScheduleManagementPage } from './pages/officer/ScheduleManagementPage';
import { DocumentForwardPage } from './pages/officer/DocumentForwardPage';
import { ROLE_DEFAULT_PAGES } from './config/roles';

// โค้ดฝั่งของคุณ
import AppointmentForm from './pages/Appointment/AppointmentForm';
import AppointmentDashboard from './pages/Appointment/AppointmentDashboard';
import UserManagement from './pages/Admin/UserManagement'; 
import GrantAccess from './pages/Admin/GrantAccess';

// โค้ดฝั่งของเพื่อน
import { Toaster } from 'react-hot-toast';
import './App.css';

function MainApp() {
  const { currentUser, isAuthenticated, hasAccess } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('isDarkMode') === 'true';
  });
  const [activePage, setActivePage] = useState<string>(() => {
    return localStorage.getItem('activePage') || 'registration';
  });

  const [selectedPatientId, setSelectedPatientId] = useState<string>('HN0045');
  const [patientRightsMap, setPatientRightsMap] = useState<Record<string, string>>({});
  const handleUpdatePatientRights = (patientId: string, rights: string) => {
    setPatientRightsMap(prev => ({ ...prev, [patientId]: rights }));
  };

  useEffect(() => {
    localStorage.setItem('activePage', activePage);
  }, [activePage]);

  useEffect(() => {
    localStorage.setItem('isDarkMode', String(isDarkMode));
    if (isDarkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [isDarkMode]);

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

  const renderContent = () => {
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
      case 'registration':
        return <RegistrationPage />;
      case 'queue':
        return <QueuePage />;
      case 'eligibility':
        return <EligibilityPage />;
      case 'vitals':
        return <VitalsPage />;
      case 'vitals-history':
        return <ScreeningHistoryPage />;
      case 'pharmacy-dispense':
        return <DetailPage 
          selectedPatientId={selectedPatientId}
          onSelectPatientId={setSelectedPatientId}
          patientRightsMap={patientRightsMap}
          onUpdatePatientRights={handleUpdatePatientRights}
        />;
      case 'pharmacy-stock':
        return <MedicinePage />;
      case 'pharmacy-history':
        return <PatientHistoryPage />;
      case 'billing-dispense':
        return <BillingDispensePage 
          selectedPatientId={selectedPatientId}
          onSelectPatientId={setSelectedPatientId}
          patientRightsMap={patientRightsMap}
          onUpdatePatientRights={handleUpdatePatientRights}
          onNavigateToBilling={() => setActivePage('billing-invoice')}
        />;
      case 'billing-invoice':
        return <BillingInvoicePage 
          selectedPatientId={selectedPatientId}
          onSelectPatientId={setSelectedPatientId}
          patientRightsMap={patientRightsMap}
          onUpdatePatientRights={handleUpdatePatientRights}
          onNavigateToDashboard={() => setActivePage('billing-dashboard')}
        />;
      case 'billing-dashboard':
        return <BillingDashboardPage />;

      // ===== Appointment Pages (ของคุณ) =====
      case 'appointment-form':
        return <AppointmentForm />;
      case 'appointment-dashboard':
        return <AppointmentDashboard />;

      // ===== Admin Pages (ของคุณ) =====
      case 'admin-users':
        return <UserManagement />;
      case 'admin-access':
        return <GrantAccess />;

      // ===== Doctor Pages (ของเพื่อน) =====
      case 'doctor-dashboard':
        return <DoctorDashboardPage onNavigate={setActivePage} />;
      case 'doctor-queue':
        return <DoctorQueuePage onNavigate={setActivePage} />;
      case 'doctor-examination':
        return <DoctorExaminationPage onNavigate={setActivePage} />;
      case 'doctor-schedule':
        return <DoctorSchedulePage />;
      case 'doctor-records':
        return <DoctorRecordsPage onNavigate={setActivePage} />;

      // ===== Officer & DMS Pages =====
      case 'dms-documents':
        return <DocumentManagementPage />;
      case 'dms-schedule':
        return <ScheduleManagementPage />;
      case 'dms-forward':
        return <DocumentForwardPage />;

      default:
        return <PageShowcase roleBadge="System" roleBadgeColor="#6B7280" title="หน้าแรก" subtitle="ยินดีต้อนรับ" description="กรุณาเลือกเมนูจากแถบด้านซ้าย" features={[]} />;
    }
  };

  return (
    <DoctorDataProvider>
      <div className="app-layout">
        {/* 1. Left Sidebar */}
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
          onNavigate={setActivePage}
        />

        {/* 3. Main Body Content */}
        <main
          className={`body-content ${isSidebarOpen ? 'body-with-sidebar' : 'body-full'}${
            activePage.startsWith('doctor-') ? ' doctor-module' : ''
          }`}
        >
          {renderContent()}
        </main>

        {/* Global Clinical Toast Notifications (ของเพื่อน) */}
        <Toaster
          position="top-right"
          gutter={10}
          toastOptions={{
            duration: 4000,
            style: {
              background: isDarkMode ? '#212836' : '#FFFFFF',
              color: isDarkMode ? '#F8FAFC' : '#0F172A',
              border: isDarkMode ? '1px solid #333F53' : '1px solid #E2E8F0',
              borderRadius: '10px',
              padding: '12px 18px',
              fontSize: '14.5px',
              fontWeight: 600,
              fontFamily: "'IBM Plex Sans Thai', 'Plus Jakarta Sans', sans-serif",
              boxShadow: isDarkMode
                ? '0 0 0 1px #333F53, 0 10px 25px -5px rgba(0, 0, 0, 0.5)'
                : '0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',
            },
            success: {
              iconTheme: {
                primary: '#10B981',
                secondary: '#FFFFFF',
              },
            },
            error: {
              iconTheme: {
                primary: '#EF4444',
                secondary: '#FFFFFF',
              },
            },
          }}
        />
      </div>
    </DoctorDataProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <WebSocketProvider>
        <MainApp />
      </WebSocketProvider>
    </AuthProvider>
  );
}

export default App;