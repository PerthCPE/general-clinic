import React from 'react';
import { ScheduleView } from './components/ScheduleView';
import { useDoctorData } from './DoctorDataContext';
import { DoctorLoadingScreen, DoctorErrorScreen } from './components/DoctorLoadingScreen';
import { useUnlockPageScroll } from './utils/scrollLockGuard';

/** หน้าตารางเวรของแพทย์ (ScheduleView จัดการ state ภายในตัวเองอยู่แล้ว) */
const DoctorSchedulePage: React.FC = () => {
  /* ปลดล็อกการเลื่อนหน้าจอที่อาจค้างมาจากกล่องของโมดูลอื่น
     (ดูคำอธิบายเต็มใน utils/scrollLockGuard.ts) */
  useUnlockPageScroll();

  const { isInitialLoading, error, patients, refresh } = useDoctorData();

  /**
   * ═══════════════════════════════════════════════════════════════════════
   * ต่อเซิร์ฟเวอร์ไม่ได้ ต้องขึ้นจอเดียวกันทุกหน้าของ role แพทย์
   * ═══════════════════════════════════════════════════════════════════════
   * หน้านี้ยังไม่ได้ต่อ API (ScheduleView ใช้ข้อมูลตัวอย่างในไฟล์)
   * ถ้าไม่เช็คตรงนี้ ตอน backend ดับหน้านี้จะแสดงตารางเวรครบถ้วนเหมือนปกติ
   * ทั้งที่หน้าอื่นขึ้น "ติดต่อเซิร์ฟเวอร์ไม่ได้" หมดแล้ว
   *
   * อันตรายกว่าที่คิด: แพทย์เห็นตารางเวรขึ้นปกติจะเข้าใจว่าระบบใช้งานได้
   * แล้วสรุปว่า "หน้าอื่นพัง" แทนที่จะรู้ว่า "เซิร์ฟเวอร์ไม่ทำงานทั้งระบบ"
   * และถ้าวันหลังหน้านี้ต่อ API จริง ตัวเลขที่เห็นจะเป็นของปลอมที่ไม่มีใครทัก
   *
   * ใช้สถานะการเชื่อมต่อชุดเดียวกับหน้าคิว เพราะเป็นตัวเดียวที่ยิง API อยู่จริง
   * ═══════════════════════════════════════════════════════════════════════
   */
  if (isInitialLoading) {
    return <DoctorLoadingScreen />;
  }

  if (error && patients.length === 0) {
    return <DoctorErrorScreen message={error} onRetry={() => { void refresh(); }} />;
  }

  return (
    <div className="max-w-7xl mx-auto">
      <ScheduleView />
    </div>
  );
};

export default DoctorSchedulePage;
