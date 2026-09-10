import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { StatCard } from './components/StatCard';
import { QueueTable } from './components/QueueTable';
import { useLanguage } from './context/LanguageContext';
import { useDoctorData } from './DoctorDataContext';
import { DoctorLoadingScreen, DoctorErrorScreen } from './components/DoctorLoadingScreen';
import { useUnlockPageScroll } from './utils/scrollLockGuard';
import type { Patient } from './types';

/**
 * หน้าคิวผู้ป่วยของแพทย์ (ตรงกับ tab 'queue' ในระบบต้นฉบับ): สรุปตัวเลข + ตารางคิว
 * เหมือนหน้าแดชบอร์ด แต่ไม่มีส่วนรายงานสรุป (ReportsView) — แยกเป็นเมนูของตัวเอง
 * ตามระบบต้นฉบับที่มีทั้ง "แดชบอร์ด" และ "คิวผู้ป่วย" เป็นคนละเมนู
 */
interface DoctorQueuePageProps {
  onNavigate: (page: string) => void;
}

const DoctorQueuePage: React.FC<DoctorQueuePageProps> = ({ onNavigate }) => {
  /* ปลดล็อกการเลื่อนหน้าจอที่อาจค้างมาจากกล่องของโมดูลอื่น
     (ดูคำอธิบายเต็มใน utils/scrollLockGuard.ts) */
  useUnlockPageScroll();

  const { t, language } = useLanguage();
  const [showStatCards, setShowStatCards] = useState(true);
  const {
    patients,
    setActiveExamPatient,
    statusFilter,
    setStatusFilter,
    handleUpdateStatus,
    isInitialLoading,
    error,
    refresh,
  } = useDoctorData();

  useEffect(() => {
    const statuses = ['All', 'Waiting', 'Examining', 'Completed'];
    const handleStatusArrow = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.repeat ||
          event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
          (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;

      const target = event.target;
      if (target instanceof HTMLElement && (
        target.isContentEditable ||
        target.closest('input, textarea, select, [role="textbox"], [role="combobox"], [role="slider"], [role="tablist"], [role="dialog"], dialog')
      )) return;

      const index = statuses.indexOf(statusFilter);
      if (index < 0) return;
      event.preventDefault();
      const nextIndex = Math.max(0, Math.min(statuses.length - 1,
        index + (event.key === 'ArrowRight' ? 1 : -1)));
      if (nextIndex !== index) setStatusFilter(statuses[nextIndex]);

      // Keep keyboard focus with the selected card when navigating within the cards.
      const statCards = target instanceof HTMLElement
        ? target.closest('#doctor-queue-stat-cards')
        : null;
      statCards?.querySelectorAll<HTMLElement>('[role="button"]')[nextIndex]?.focus({ preventScroll: true });
    };

    window.addEventListener('keydown', handleStatusArrow);
    return () => window.removeEventListener('keydown', handleStatusArrow);
  }, [statusFilter, setStatusFilter]);

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
  const currentlyExamining = patients.filter((p) => p.status === 'Examining').length;
  const completedVisits = patients.filter((p) => p.status === 'Completed').length;

  const handleStartExamination = (patient: Patient) => {
    /**
     * กดเรียกผู้ป่วยเข้าห้องตรวจ = ต้องเปลี่ยนสถานะในฐานข้อมูลด้วย ไม่ใช่แค่เปลี่ยนหน้า
     *
     * ปัญหาเดิม: หน้าตรวจตั้งป้ายเป็น "กำลังตรวจ" ให้เองในหน่วยความจำเบราว์เซอร์
     * (ดู ExaminationView.tsx ตรง useState ของ status) แต่ไม่มีใครบอกฐานข้อมูล
     * ตารางคิวซึ่งอ่านจากฐานข้อมูลจึงยังขึ้น "รอตรวจ" อยู่ ทั้งที่คนไข้อยู่ในห้องแล้ว
     * สถานะจะไปเปลี่ยนเอาตอนกดบันทึกฉบับร่างหรือบันทึกผลการตรวจเท่านั้น
     *
     * ในคลินิกจริงอันตราย เพราะแพทย์อีกคนเปิดคิวมาจะเห็นว่าคนนี้ยัง "รอตรวจ"
     * แล้วเรียกเข้าห้องซ้ำ ส่วนพยาบาลก็ไม่รู้ว่าคนไข้ถูกเรียกเข้าห้องไปแล้ว
     *
     * เช็ค Waiting ก่อนเสมอ ห้ามยิงทุกกรณี
     *   Examining อยู่แล้ว = กด "ตรวจต่อ" จากเคสที่บันทึกร่างค้างไว้ ไม่ต้องยิงซ้ำ
     *   Completed = กด "แก้ไขบันทึก" ของเคสที่ปิดไปแล้ว ถ้ายิงจะเป็นการเปิดเคสใหม่
     *               ทำให้ผู้ป่วยที่ตรวจจบแล้วเด้งกลับเข้าคิวโดยไม่มีใครตั้งใจ
     */
    if (patient.status === 'Waiting') {
      handleUpdateStatus(patient.id, 'Examining');
    }

    setActiveExamPatient(patient);
    onNavigate('doctor-examination');
  };


  /**
   * รอโหลดข้อมูลรอบแรกให้เสร็จก่อนค่อยวาดหน้าจริง
   *
   * ถ้าปล่อยให้วาดเลย แพทย์จะเห็นเลข 0 ทั้งสามการ์ดและข้อความ
   * "ไม่พบข้อมูลผู้ป่วยตามเงื่อนไขที่เลือก" อยู่ประมาณ 1 วินาที
   * ซึ่งอ่านได้ว่า "วันนี้ไม่มีคิว" ทั้งที่ความจริงคือ "ยังไม่รู้ กำลังถามฐานข้อมูลอยู่"
   *
   * ใช้ isInitialLoading ไม่ใช่ isLoading เพราะ isLoading เป็น true
   * ทุกครั้งที่รีเฟรชเบื้องหลัง (ทุก 4 วินาที และทุก WebSocket event)
   * ถ้าใช้ตัวนั้นหน้าจะกะพริบเป็นจอโหลดไม่หยุด
   */
  if (isInitialLoading) {
    return <DoctorLoadingScreen />;
  }

  // ต่อ backend ไม่ได้ ต้องบอกให้ชัดว่าเป็นปัญหาการเชื่อมต่อ ไม่ใช่ "วันนี้ไม่มีคิว"
  // เช็คว่า patients ว่างด้วย เพราะถ้ายังมีข้อมูลเก่าค้างอยู่บนจอ การรีเฟรชรอบหลัง
  // ที่พลาดไปรอบเดียวไม่ควรลบทั้งหน้าทิ้งแล้วขึ้น error
  if (error && patients.length === 0) {
    return <DoctorErrorScreen message={error} onRetry={refresh} />;
  }

  return (
    <div className={`max-w-7xl mx-auto ${showStatCards ? 'space-y-8' : 'space-y-2'}`}>
      <section className="-mt-4 space-y-1">
        <div className="flex justify-end">
          <button
            type="button"
            aria-expanded={showStatCards}
            aria-controls="doctor-queue-stat-cards"
            onClick={() => setShowStatCards((current) => !current)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-sm font-medium text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500/60"
          >
            {showStatCards ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {showStatCards
              ? (language === 'th' ? 'ซ่อนการ์ดสถิติ' : 'Hide statistic cards')
              : (language === 'th' ? 'แสดงการ์ดสถิติ' : 'Show statistic cards')}
          </button>
        </div>

        {showStatCards && <div id="doctor-queue-stat-cards" className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatCard
            title={t('totalPatientsToday')}
            value={totalToday}
            patients={patients}
            iconType="users"
            activeFilter={statusFilter === 'All' ? 'All' : undefined}
            onClick={() => setStatusFilter('All')}
          />
          <StatCard
            title={t('currentlyWaiting')}
            value={currentlyWaiting}
            patients={patients.filter((patient) => patient.status === 'Waiting')}
            iconType="clock"
            activeFilter={statusFilter === 'Waiting' ? 'Waiting' : undefined}
            onClick={() => setStatusFilter(statusFilter === 'Waiting' ? 'All' : 'Waiting')}
          />
          <StatCard
            title={language === 'th' ? 'ผู้ป่วยกำลังตรวจ' : 'Currently Examining'}
            value={currentlyExamining}
            patients={patients.filter((patient) => patient.status === 'Examining')}
            iconType="stethoscope"
            activeFilter={statusFilter === 'Examining' ? 'Examining' : undefined}
            onClick={() => setStatusFilter(statusFilter === 'Examining' ? 'All' : 'Examining')}
          />
          <StatCard
            title={t('completedVisits')}
            value={completedVisits}
            patients={patients.filter((patient) => patient.status === 'Completed')}
            iconType="check"
            activeFilter={statusFilter === 'Completed' ? 'Completed' : undefined}
            onClick={() => setStatusFilter(statusFilter === 'Completed' ? 'All' : 'Completed')}
          />
        </div>}
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
    </div>
  );
};

export default DoctorQueuePage;
