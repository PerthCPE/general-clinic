import React, { useEffect } from 'react';
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
  const {
    activeExamPatient,
    setActiveExamPatient,
    handleSavePatient,
    handleUpdateStatus,
    isExamLoading,
    isSaving,
    saveError,
  } = useDoctorData();

  /**
   * เปิดหน้านี้ขึ้นมาแล้วเจอเคสที่ปิดการตรวจไปแล้ว ให้ล้างทิ้ง
   *
   * เดิมผู้ป่วยที่เพิ่งตรวจจบยังค้างอยู่ในหน้านี้ พอแพทย์กดเมนู "บันทึกการตรวจ"
   * อีกครั้งจะเห็นฟอร์มของคนเดิมเต็มไปหมด แยกไม่ออกว่าตรวจไปแล้วหรือยัง
   * และถ้าเผลอกดบันทึกซ้ำจะเจอ error ว่าเคสถูกเซ็นปิดไปแล้ว
   *
   * ตั้งใจให้ทำงานตอน mount เท่านั้น (dependency ว่าง) เพราะถ้าคอยเช็คตลอดเวลา
   * กล่อง "บันทึกสำเร็จ" จะถูกถอดออกจากจอทันทีที่บันทึกเสร็จ ก่อนแพทย์ทันอ่าน
   */
  useEffect(() => {
    if (activeExamPatient?.status === 'Completed') {
      setActiveExamPatient(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  /**
   * ═══════════════════════════════════════════════════════════════════════
   * หมายเหตุ: กล่อง "กำลังบันทึก" ต้องอยู่นอก <div className="... space-y-4">
   * ═══════════════════════════════════════════════════════════════════════
   * space-y-4 ใส่ margin ล่าง 16px ให้ลูก "ทุกตัว" ที่ไม่ใช่ตัวสุดท้าย
   * กล่องที่ตรึงจอด้วย fixed inset-0 ยึดทั้งขอบบนและขอบล่างเป็น 0 อยู่แล้ว
   * margin ล่างจึงไปดันขอบล่างขึ้นมา 16px เท่ากับความสูงหายไป 16px
   *
   * อาการที่เห็น: ฉากหลังมืดไม่สุด เหลือแถบสว่างบางๆ ที่ขอบล่างจอ
   * หาสาเหตุยากมากเพราะคลาสบนตัวกล่องถูกต้องทุกอย่าง ปัญหาอยู่ที่กล่องแม่
   *
   * เทียบได้จากกล่องยืนยันกับกล่องบันทึกสำเร็จใน ExaminationView
   * ที่ใช้คลาสเหมือนกันเป๊ะแต่ไม่มีปัญหา เพราะซ้อนอยู่ลึกกว่า
   * ไม่ได้เป็นลูกโดยตรงของ space-y-4
   *
   * เจอปัญหากล่องเต็มจอเพี้ยนที่อื่นอีก ให้ไล่เช็คสองอย่างนี้ก่อน
   *   1. กล่องแม่มี space-y-* หรือ gap ที่ใส่ margin ให้ลูกหรือเปล่า
   *   2. z-index สูงพอไหม (แถบบน 99, เมนูผู้ใช้ 1000, โมดัลของแพทย์ 1200)
   *
   * ดูคำอธิบายต้นเหตุเพิ่มเติมได้ที่ src/index.css ตรงบล็อก .doctor-module .space-y-*
   * ═══════════════════════════════════════════════════════════════════════
   */
  return (
    <>
      {/* กล่องกลางจอตอนกำลังบันทึก อ่านหมายเหตุเรื่อง space-y เหนือ return */}
      {isSaving && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-[1200] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center space-y-4">
            <div className="w-20 h-20 mx-auto rounded-full bg-blue-50 flex items-center justify-center">
              <span className="block w-9 h-9 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">กำลังบันทึกลงฐานข้อมูล</h3>
            <p className="text-sm text-slate-500">
              กรุณารอสักครู่ ระบบกำลังบันทึกผลการตรวจของผู้ป่วย
            </p>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto space-y-4">
        {/*
          แถบแจ้งเมื่อบันทึกไม่ผ่าน
          เป็นแถบด้านบนไม่ใช่กล่องกลางจอ เพราะต้องค้างให้อ่านระหว่างที่แพทย์แก้ข้อมูล
          ถ้าเป็นกล่องกลางจอจะบังฟอร์มที่กำลังจะแก้พอดี
        */}
        {!isSaving && saveError && (
          <div className="bg-red-50 border-2 border-red-300 text-red-900 px-4 py-3 rounded-2xl space-y-1">
            <p className="text-xs font-bold">เกิดข้อผิดพลาดกับข้อมูลการตรวจของเคสนี้</p>
            <p className="text-xs font-medium text-red-800">{saveError}</p>
          </div>
        )}

        <ExaminationView
          key={activeExamPatient.visitId ?? activeExamPatient.id}
          patient={activeExamPatient}
          onBackToQueue={(nextStatus, note) => {
            /**
             * ออกจากหน้าตรวจ พร้อมจัดการสถานะคิวให้ถูกต้อง
             *
             * ทำไมต้องมี nextStatus: ตอนแพทย์กด "ตรวจผู้ป่วย" ในหน้าคิว
             * ระบบเปลี่ยนสถานะในฐานข้อมูลเป็น "กำลังตรวจ" ไปแล้ว
             * ถ้าออกจากหน้านี้เฉยๆ ผู้ป่วยจะค้างเป็น "กำลังตรวจ" ตลอดไป
             * ทั้งที่ไม่มีใครตรวจอยู่ และไม่มีแพทย์คนไหนกล้าหยิบเคสนั้นไปทำต่อ
             *
             *   'Waiting'   = กด "ออกจากหน้าตรวจ" คืนคิวให้ผู้ป่วยรอตรวจตามเดิม
             *   'Cancelled' = กด "ยกเลิกการรับบริการ" เอาผู้ป่วยออกจากคิววันนี้
             *   undefined   = บันทึกเสร็จแล้วออกเอง สถานะถูกตั้งโดยการบันทึกไปแล้ว
             *                 ห้ามเขียนทับ ไม่งั้นเคสที่เพิ่งปิดจะเด้งกลับเข้าคิว
             */
            if (nextStatus) {
              // note = เหตุผลการยกเลิก ที่แพทย์เลือกในกล่องยืนยัน
              // ไปลงช่อง note ของคิว จะได้ตอบได้ทีหลังว่าทำไมเคสนี้ถูกยกเลิก
              handleUpdateStatus(activeExamPatient.id, nextStatus, note);
            }

            // ปิดเคสแล้วไม่ต้องค้างผู้ป่วยคนเดิมไว้ในหน้าตรวจ
            // (ฉบับร่างยังเก็บไว้ เพราะแพทย์ต้องกลับมาทำต่อ)
            // ออกแบบคืนคิวหรือยกเลิกก็ต้องล้างเช่นกัน ไม่งั้นกดเมนูกลับมาจะเจอฟอร์มเดิมค้าง
            if (activeExamPatient.status === 'Completed' || nextStatus) {
              setActiveExamPatient(null);
            }
            onNavigate('doctor-queue');
          }}
          onSavePatient={handleSavePatient}
        />
      </div>
    </>
  );
};

export default DoctorExaminationPage;
