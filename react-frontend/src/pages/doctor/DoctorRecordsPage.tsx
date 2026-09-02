import React, { useEffect, useMemo } from 'react';
import { PatientRecordsView } from './components/PatientRecordsView';
import { useDoctorData } from './DoctorDataContext';
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
  const {
    patients,
    recordPatients,
    refreshRecords,
    isRecordsLoading,
    recordsError,
    selectedRecordPatient,
    setSelectedRecordPatient,
    setActiveExamPatient,
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

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {isRecordsLoading && recordPatients.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold px-4 py-3 rounded-2xl">
          กำลังโหลดประวัติผู้ป่วย...
        </div>
      )}

      {!isRecordsLoading && recordsError && (
        <div className="bg-amber-50 border border-amber-300 text-amber-900 px-4 py-3 rounded-2xl space-y-1">
          <p className="text-xs font-bold">โหลดประวัติผู้ป่วยย้อนหลังไม่สำเร็จ</p>
          <p className="text-xs font-medium text-amber-800">{recordsError}</p>
          <p className="text-[11px] text-amber-700">
            ถ้าขึ้น 404 แปลว่าเซิร์ฟเวอร์ยังไม่มี endpoint นี้ ให้รีสตาร์ต backend ใหม่อีกครั้ง
            (ตอนนี้จะเห็นเฉพาะผู้ป่วยในคิวของวันนี้)
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
