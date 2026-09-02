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
  const { activeExamPatient, handleSavePatient, isExamLoading, isSaving, saveError } = useDoctorData();

  if (!activeExamPatient) {
    return (
      // จัดให้อยู่กลางหน้าจอตามแนวตั้ง แทนที่จะลอยอยู่ติดขอบบน
      // (ลบความสูงของ Topbar 94px กับ padding ล่าง 40px ออกจาก 100vh)
      //
      // -translate-y-12 คือยกขึ้นจากจุดกึ่งกลางอีก 48px ให้ดูสมดุลกว่าอยู่กลางเป๊ะ
      // อยากขยับมากน้อยกว่านี้ปรับเลขตรงนี้ได้ (-translate-y-8 / -16 / -24)
      <div className="min-h-[calc(100vh-134px)] flex flex-col items-center justify-center -translate-y-12 text-center space-y-4 max-w-2xl mx-auto">
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

  // ฟอร์มตรวจอ่านค่าเริ่มต้นจาก prop ตอน mount ครั้งเดียว จึงต้องรอผลตรวจเดิม
  // โหลดเสร็จก่อน แล้วค่อย mount (key = visitId เพื่อ mount ใหม่เมื่อเปลี่ยนเคส)
  if (isExamLoading) {
    return (
      <div className="min-h-[calc(100vh-134px)] flex items-center justify-center -translate-y-12 text-center max-w-2xl mx-auto">
        <p className="text-slate-500 text-sm">กำลังโหลดผลการตรวจของผู้ป่วย...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {/*
        แถบสถานะการบันทึกลงฐานข้อมูล
        ตัวฟอร์มจะขึ้นกล่อง "บันทึกสำเร็จ" ทันทีที่กดยืนยัน โดยไม่รอผลจาก backend
        ถ้าเซิร์ฟเวอร์ปฏิเสธ (เช่น ยังไม่ได้ระบุการวินิจฉัยหลัก หรือเคสถูกเซ็นปิดไปแล้ว)
        จะเห็นเหตุผลจริงที่แถบนี้ ไม่ใช่เงียบหายไปเฉยๆ
      */}
      {isSaving && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold px-4 py-3 rounded-2xl">
          กำลังบันทึกลงฐานข้อมูล...
        </div>
      )}

      {!isSaving && saveError && (
        <div className="bg-red-50 border-2 border-red-300 text-red-900 px-4 py-3 rounded-2xl space-y-1">
          <p className="text-xs font-bold">เกิดข้อผิดพลาดกับข้อมูลการตรวจของเคสนี้</p>
          <p className="text-xs font-medium text-red-800">{saveError}</p>
        </div>
      )}

      <ExaminationView
        key={activeExamPatient.visitId ?? activeExamPatient.id}
        patient={activeExamPatient}
        onBackToQueue={() => onNavigate('doctor-queue')}
        onSavePatient={handleSavePatient}
      />
    </div>
  );
};

export default DoctorExaminationPage;
