import React, { useMemo } from 'react';
import { StatCard } from './components/StatCard';
import { QueueTable } from './components/QueueTable';
import { ReportsView } from './components/ReportsView';
import { useLanguage } from './context/LanguageContext';
import { useDoctorData } from './DoctorDataContext';
import type { Patient } from './types';

/**
 * หน้าแดชบอร์ดคิวตรวจของแพทย์ (ทับซ้อนเนื้อหาเดิมของ 'dashboard' + 'queue' tab
 * จากระบบต้นแบบให้เหลือหน้าเดียว): สรุปตัวเลขคิววันนี้ + ตารางคิว + รายงานสรุป
 */
interface DoctorDashboardPageProps {
  onNavigate: (page: string) => void;
}

const DoctorDashboardPage: React.FC<DoctorDashboardPageProps> = ({ onNavigate }) => {
  const { t } = useLanguage();
  const {
    patients,
    setActiveExamPatient,
    statusFilter,
    setStatusFilter,
    handleUpdateStatus,
  } = useDoctorData();

  const filteredPatients = useMemo(
    () => patients.filter((p) => statusFilter === 'All' || p.status === statusFilter),
    [patients, statusFilter]
  );

  // จำนวนแยกตามสถานะ ส่งให้แถบกรองในตารางคิวไปแสดงเป็นตัวเลขห้อยท้ายปุ่ม
  // ต้องนับจาก patients ที่ยังไม่ถูกกรอง ไม่ใช่ filteredPatients
  const statusCounts = useMemo(
    () => ({
      All: patients.length,
      Waiting: patients.filter((p) => p.status === 'Waiting').length,
      Examining: patients.filter((p) => p.status === 'Examining').length,
      Completed: patients.filter((p) => p.status === 'Completed').length,
    }),
    [patients]
  );

  const totalToday = patients.length;
  const currentlyWaiting = patients.filter((p) => p.status === 'Waiting').length;
  const completedVisits = patients.filter((p) => p.status === 'Completed').length;

  const handleStartExamination = (patient: Patient) => {
    setActiveExamPatient(patient);
    onNavigate('doctor-examination');
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <section className="space-y-4">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">{t('quickStats')}</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard
            title={t('totalPatientsToday')}
            value={totalToday}
            iconType="users"
            activeFilter={statusFilter === 'All' ? 'All' : undefined}
            onClick={() => setStatusFilter('All')}
          />
          <StatCard
            title={t('currentlyWaiting')}
            value={currentlyWaiting}
            iconType="clock"
            activeFilter={statusFilter === 'Waiting' ? 'Waiting' : undefined}
            onClick={() => setStatusFilter(statusFilter === 'Waiting' ? 'All' : 'Waiting')}
          />
          <StatCard
            title={t('completedVisits')}
            value={completedVisits}
            iconType="check"
            activeFilter={statusFilter === 'Completed' ? 'Completed' : undefined}
            onClick={() => setStatusFilter(statusFilter === 'Completed' ? 'All' : 'Completed')}
          />
        </div>
      </section>

      <section className="space-y-4">
        <QueueTable
          patients={filteredPatients}
          onExamine={handleStartExamination}
          onUpdateStatus={handleUpdateStatus}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          statusCounts={statusCounts}
        />
      </section>

      <section className="space-y-4 pt-4">
        <ReportsView />
      </section>
    </div>
  );
};

export default DoctorDashboardPage;
