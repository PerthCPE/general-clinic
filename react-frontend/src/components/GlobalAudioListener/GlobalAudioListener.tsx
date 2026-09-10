import { useEffect } from 'react';
import { useWebSocket } from '../../context/WebSocketContext';
import { useAuth } from '../../context/AuthContext';
import {
  playPharmacyNotification,
  playBillingNotification,
  playDoctorNotification,
} from '../../utils/audioQueue';

// ตัวฟัง WebSocket กลาง ทำงานทุกหน้า (mount ไว้ที่ App.tsx)
//
// หน้าที่: เล่น "เสียงแจ้งเตือนคิวเข้าใหม่ 1 ครั้ง" (เสียงดึงๆ จาก /audio/pin_a1.mp3)
// ส่วน toast/แจ้งเตือนที่มองเห็น ให้แต่ละหน้า + Topbar จัดการเอง
//
// WebSocket ยิง event ไปหา client ทุกตัว (ทุกแท็บ/ทุก role) จึงต้องกรองตาม role
// ไม่งั้นจอหมอ/ห้องยา/การเงิน จะมีเสียงพร้อมกันหมด
//   - พยาบาลคัดกรองเสร็จ (VITALS_RECORDED)    → เฉพาะ role แพทย์
//   - ใบสั่งยาใหม่ (หมอส่งมา, MEDICINE_QUEUE_CREATED) → เฉพาะ role เภสัชกร
//   - รายการชำระเงินใหม่ (ห้องยาส่งมา, BILLING_CREATED) → เฉพาะ role การเงิน
export function GlobalAudioListener() {
  const { subscribe } = useWebSocket();
  const { currentUser } = useAuth();
  const role = currentUser?.role;

  useEffect(() => {
    const isDoctor = role === 'doctor' || role === 'admin';
    const isPharmacy = role === 'pharmacist' || role === 'admin';
    const isCashier = role === 'cashier' || role === 'admin';

    // คิวจากพยาบาลคัดกรอง เข้าห้องตรวจแพทย์
    const unsubVitals = subscribe('VITALS_RECORDED', () => {
      if (isDoctor) playDoctorNotification();
    });
    const unsubScreening = subscribe('SCREENING_RECORDED', () => {
      if (isDoctor) playDoctorNotification();
    });

    // ใบสั่งยาใหม่จากห้องตรวจแพทย์ เข้าห้องยา
    const unsubMedQ = subscribe('MEDICINE_QUEUE_CREATED', () => {
      if (isPharmacy) playPharmacyNotification();
    });

    // รายการรอชำระเงินใหม่จากห้องยา เข้าการเงิน
    const unsubBill = subscribe('BILLING_CREATED', () => {
      if (isCashier) playBillingNotification();
    });

    return () => {
      unsubVitals();
      unsubScreening();
      unsubMedQ();
      unsubBill();
    };
  }, [subscribe, role]);

  return null;
}
