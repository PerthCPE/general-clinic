import React from 'react';
import { ExaminationView } from './components/ExaminationView';
import { useDoctorData } from './DoctorDataContext';

/**
 * หน้าบันทึกการตรวจผู้ป่วยของแพทย์ ใช้ผู้ป่วยที่ถูกเลือกจากหน้าคิวผู้ป่วย/ประวัติ
 * (activeExamPatient) หากยังไม่มีผู้ป่วยที่เลือกไว้ จะแสดงข้อความให้กลับไปเลือกคิวก่อน
 */
interface DoctorExaminationPageProps {
  onNavigate: (page: string) => void;
}

const DoctorExaminationPage: React.FC<DoctorExaminationPageProps> = ({ onNavigate }) => {
  const { activeExamPatient, handleSavePatient } = useDoctorData();

  if (!activeExamPatient) {
    return (
      <div className="max-w-2xl mx-auto text-center space-y-4 py-10">
        <h1 className="text-xl font-bold text-slate-900">ยังไม่ได้เลือกผู้ป่วย</h1>
        <p className="text-slate-500 text-sm">
          กรุณาเลือกผู้ป่วยจากตารางคิวในหน้าคิวผู้ป่วยก่อน เพื่อเริ่มบันทึกการตรวจ
        </p>
        <button
          onClick={() => onNavigate('doctor-queue')}
          className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          ไปที่หน้าคิวผู้ป่วย
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <ExaminationView
        patient={activeExamPatient}
        onBackToQueue={() => onNavigate('doctor-queue')}
        onSavePatient={handleSavePatient}
      />
    </div>
  );
};

export default DoctorExaminationPage;
