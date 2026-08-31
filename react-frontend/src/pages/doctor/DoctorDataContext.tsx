import React, { createContext, useContext, useState } from 'react';
import { LanguageProvider } from './context/LanguageContext';
import type { Patient, QueueStatus } from './types';
import { INITIAL_PATIENTS } from './data/initialData';

/**
 * ==============================================================================
 * Doctor Module Shared Data Context (DoctorDataContext.tsx)
 * ==============================================================================
 * เก็บ state ของคิวผู้ป่วยที่ใช้ร่วมกันระหว่างหน้าจอต่างๆ ของแพทย์
 * (แดชบอร์ด, บันทึกการตรวจ, ประวัติเวชระเบียน) เพื่อให้ข้อมูลผู้ป่วย
 * ที่กำลังตรวจ/เลือกดูอยู่ ยังคงอยู่แม้จะสลับเมนูไปมาผ่าน Sidebar เดิม
 *
 * หมายเหตุ: ข้อมูลตอนนี้เป็น mock data (INITIAL_PATIENTS) ที่ยกมาจากระบบต้นแบบ
 * ยังไม่ได้เชื่อมกับ backend จริง — เป็นจุดที่ต่อ API ในอนาคตได้
 */
interface DoctorDataContextType {
  patients: Patient[];
  setPatients: React.Dispatch<React.SetStateAction<Patient[]>>;
  activeExamPatient: Patient | null;
  setActiveExamPatient: React.Dispatch<React.SetStateAction<Patient | null>>;
  selectedRecordPatient: Patient | null;
  setSelectedRecordPatient: React.Dispatch<React.SetStateAction<Patient | null>>;
  statusFilter: string;
  setStatusFilter: React.Dispatch<React.SetStateAction<string>>;
  handleSavePatient: (updatedPatient: Patient) => void;
  handleUpdateStatus: (patientId: string, newStatus: QueueStatus) => void;
}

const DoctorDataContext = createContext<DoctorDataContextType | undefined>(undefined);

export const DoctorDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [patients, setPatients] = useState<Patient[]>(INITIAL_PATIENTS);
  const [activeExamPatient, setActiveExamPatient] = useState<Patient | null>(null);
  const [selectedRecordPatient, setSelectedRecordPatient] = useState<Patient | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // บันทึกผลตรวจ/แก้ไขข้อมูลผู้ป่วยกลับเข้า state รวม
  const handleSavePatient = (updatedPatient: Patient) => {
    setPatients((prev) => prev.map((p) => (p.id === updatedPatient.id ? updatedPatient : p)));
    setActiveExamPatient((prev) => (prev?.id === updatedPatient.id ? updatedPatient : prev));
  };

  // เปลี่ยนสถานะคิวผู้ป่วยแบบรวดเร็วจากตารางคิว
  const handleUpdateStatus = (patientId: string, newStatus: QueueStatus) => {
    setPatients((prev) => prev.map((p) => (p.id === patientId ? { ...p, status: newStatus } : p)));
  };

  return (
    <DoctorDataContext.Provider
      value={{
        patients,
        setPatients,
        activeExamPatient,
        setActiveExamPatient,
        selectedRecordPatient,
        setSelectedRecordPatient,
        statusFilter,
        setStatusFilter,
        handleSavePatient,
        handleUpdateStatus,
      }}
    >
      <LanguageProvider>{children}</LanguageProvider>
    </DoctorDataContext.Provider>
  );
};

export const useDoctorData = (): DoctorDataContextType => {
  const ctx = useContext(DoctorDataContext);
  if (!ctx) {
    throw new Error('useDoctorData must be used within a DoctorDataProvider');
  }
  return ctx;
};
