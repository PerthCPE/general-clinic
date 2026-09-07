import React, { useEffect, useMemo } from 'react';
import { PatientRecordsView } from './components/PatientRecordsView';
import { useDoctorData } from './DoctorDataContext';
import { DoctorLoadingScreen, DoctorErrorScreen } from './components/DoctorLoadingScreen';
import { useUnlockPageScroll } from './utils/scrollLockGuard';
import type { Patient } from './types';

/**
 * หน้าประวัติเวชระเบียนผู้ป่วยของแพทย์
 *
 * รวมผู้ป่วย 2 ชุดเข้าด้วยกัน
 *   1. patients       — คิวของวันนี้ที่ยังเดินอยู่ (สถานะสดใหม่ ใช้กดเข้าตรวจต่อได้)
 *   2. recordPatients — ผู้ป่วยที่เคยมาตรวจ ไม่จำกัดวัน (รวมคนที่ตรวจเสร็จแล้ว)
 *
 * ถ้าคนเดียวกันอยู่ทั้งสองชุด ให้ยึดของชุดแรก เพราะสถานะเป็นปัจจุบันกว่า
 */
interface DoctorRecordsPageProps {
  onNavigate: (page: string) => void;
}

const DoctorRecordsPage: React.FC<DoctorRecordsPageProps> = ({ onNavigate }) => {
  /* ปลดล็อกการเลื่อนหน้าจอที่อาจค้างมาจากกล่องของโมดูลอื่น
     (ดูคำอธิบายเต็มใน utils/scrollLockGuard.ts) */
  useUnlockPageScroll();

  const {
    patients,
    recordPatients,
    refreshRecords,
    isRecordsLoading,
    recordsError,
    selectedRecordPatient,
    setSelectedRecordPatient,
    setActiveExamPatient,
    isInitialLoading,
    error,
    refresh,
  } = useDoctorData();

  // โหลดใหม่ทุกครั้งที่เข้าหน้านี้ เผื่อเพิ่งปิดเคสไปแล้วอยากเห็นในประวัติทันที
  useEffect(() => {
    void refreshRecords();
  }, [refreshRecords]);

  const mergedPatients = useMemo(() => {
    const merged = [...patients];
    // ใช้เลข HN เป็นตัวจับคู่ เพราะ id ของสองชุดคนละรูปแบบ (q-2 กับ p-2)
    const seen = new Set(patients.map((p) => p.hn));

    for (const p of recordPatients) {
      if (!seen.has(p.hn)) {
        seen.add(p.hn);
        merged.push(p);
      }
    }

    return merged;
  }, [patients, recordPatients]);

  const handleExamine = (patient: Patient) => {
    setActiveExamPatient(patient);
    onNavigate('doctor-examination');
  };

  /**
   * ═══════════════════════════════════════════════════════════════════════
   * ต่อเซิร์ฟเวอร์ไม่ได้ ต้องขึ้นจอเดียวกันทุกหน้าของ role แพทย์
   * ═══════════════════════════════════════════════════════════════════════
   * หน้านี้กินข้อมูล 2 ชุดจากคนละ endpoint
   *   patients       จาก /api/doctor/queue           (error)
   *   recordPatients จาก /api/doctor/patient-records (recordsError)
   * ถ้าพังทั้งคู่และไม่มีข้อมูลเหลือเลย = ต่อเซิร์ฟเวอร์ไม่ได้ ต้องขึ้นจอ error เต็มหน้า
   *
   * เคยพลาดตรงนี้: หน้านี้เคยขึ้นแค่แถบเหลืองเล็กๆ ว่า "โหลดประวัติไม่สำเร็จ"
   * แล้ววาดหน้าค้นหาผู้ป่วยกับ "ไม่พบข้อมูลผู้ป่วยตามเงื่อนไขการค้นหา" ต่อตามปกติ
   * ซึ่งอ่านได้ว่า "ค้นแล้วไม่เจอคนไข้" ทั้งที่ความจริงคือเซิร์ฟเวอร์ไม่ทำงาน
   * แถบเหลืองยังบอกให้ "รีสตาร์ต backend" ซึ่งเป็นการเดาสาเหตุที่ผิดบ่อยกว่าถูก
   *
   * แถบเหลืองยังเก็บไว้สำหรับกรณีที่ประวัติพังฝ่ายเดียวแต่คิววันนี้ยังใช้ได้
   * (เห็นผู้ป่วยในคิวได้ แค่ไม่มีประวัติย้อนหลัง) ซึ่งเป็นคนละเรื่องกับเซิร์ฟเวอร์ดับ
   * ═══════════════════════════════════════════════════════════════════════
   */
  const hasNoData = patients.length === 0 && recordPatients.length === 0;

  if (isInitialLoading || (isRecordsLoading && hasNoData)) {
    return <DoctorLoadingScreen />;
  }

  if ((error || recordsError) && hasNoData) {
    return (
      <DoctorErrorScreen
        message={error || recordsError || ''}
        onRetry={() => {
          void refresh();
          void refreshRecords();
        }}
      />
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {/* ประวัติย้อนหลังพังฝ่ายเดียว แต่คิววันนี้ยังใช้ได้ตามปกติ
          ไม่ใช่กรณีเซิร์ฟเวอร์ดับ จึงเตือนเป็นแถบเล็กๆ พอ ไม่ต้องล้างทั้งหน้า */}
      {!isRecordsLoading && recordsError && (
        <div className="bg-amber-50 border border-amber-300 text-amber-900 px-4 py-3 rounded-2xl space-y-1">
          <p className="text-xs font-bold">โหลดประวัติผู้ป่วยย้อนหลังไม่สำเร็จ</p>
          <p className="text-xs font-medium text-amber-800">{recordsError}</p>
          <p className="text-[11px] text-amber-700">
            ตอนนี้จะเห็นเฉพาะผู้ป่วยในคิวของวันนี้ กดเมนูอื่นแล้วกลับมาเพื่อลองโหลดใหม่ได้
          </p>
        </div>
      )}

      <PatientRecordsView
        patients={mergedPatients}
        onExamine={handleExamine}
        selectedPatient={selectedRecordPatient}
        onSelectPatient={setSelectedRecordPatient}
      />
    </div>
  );
};

export default DoctorRecordsPage;
