import { useEffect } from 'react';
import { useWebSocket } from '../../context/WebSocketContext';
import { useAuth } from '../../context/AuthContext';
import { playPharmacyNotification, playBillingNotification } from '../../utils/audioQueue';

// ตัวฟัง WebSocket กลาง ทำงานทุกหน้า (mount ไว้ที่ App.tsx)
//
// หน้าที่: เล่น "เสียงแจ้งเตือน 1 ครั้ง" เท่านั้น
// ส่วน toast/แจ้งเตือนที่มองเห็น ให้แต่ละหน้าจัดการเอง (มี toast สีเขียวอยู่แล้ว)
//
// WebSocket ยิง event ไปหา client ทุกตัวที่เชื่อมต่อ (ทุกแท็บ/ทุก role)
// จึงต้องกรองตาม role ไม่งั้นจอหมอ/ห้องยา/การเงิน จะมีเสียงพร้อมกันหมด
//   - ใบสั่งยาใหม่ (หมอส่งมา)        → เฉพาะ role เภสัชกร
//   - รายการชำระเงินใหม่ (ห้องยาส่งมา) → เฉพาะ role การเงิน
export function GlobalAudioListener() {
  const { subscribe } = useWebSocket();
  const { currentUser } = useAuth();
  const role = currentUser?.role;

  useEffect(() => {
    const isPharmacy = role === 'pharmacist' || role === 'admin';
    const isCashier = role === 'cashier' || role === 'admin';

    const unsubVisit = subscribe('MEDICINE_QUEUE_CREATED', () => {
      if (isPharmacy) playPharmacyNotification();
    });

    const unsubBill = subscribe('BILLING_CREATED', () => {
      if (isCashier) playBillingNotification();
    });

    return () => {
      unsubVisit();
      unsubBill();
    };
  }, [subscribe, role]);

  return null;
}
