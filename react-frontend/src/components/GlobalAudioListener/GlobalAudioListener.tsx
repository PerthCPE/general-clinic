import { useEffect } from 'react';
import { useWebSocket } from '../../context/WebSocketContext';
import { playPharmacyNotification, playBillingNotification } from '../../utils/audioQueue';

export function GlobalAudioListener() {
  const { subscribe } = useWebSocket();

  useEffect(() => {
    const unsubExam = subscribe('EXAMINATION_SAVED', (data: any) => {
      playPharmacyNotification('มีผู้ป่วยใหม่ ส่งมาที่ห้องยาค่ะ');
    });

    const unsubVisit = subscribe('MEDICINE_QUEUE_CREATED', (data: any) => {
      playPharmacyNotification('มีรายการสั่งยาใหม่ ส่งมาที่ห้องยาค่ะ');
    });

    const unsubBill = subscribe('BILLING_CREATED', (data: any) => {
      playBillingNotification('มีรายการชำระเงินใหม่ ส่งมาที่ห้องการเงินค่ะ');
    });

    return () => {
      unsubExam();
      unsubVisit();
      unsubBill();
    };
  }, [subscribe]);

  return null;
}
