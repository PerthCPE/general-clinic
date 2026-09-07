import { useEffect } from 'react';
import { useWebSocket } from '../../context/WebSocketContext';
import { playPharmacyNotification, playBillingNotification } from '../../utils/audioQueue';

export function GlobalAudioListener() {
  const { subscribe } = useWebSocket();

  useEffect(() => {
    // 1. รับคิวห้องยา (แพทย์ส่งมา)
    const unsubVisit = subscribe('MEDICINE_QUEUE_CREATED', (data: any) => {
      const pName = data?.patient_name ? `ของคุณ ${data.patient_name} ` : '';
      playPharmacyNotification(`มีรายการสั่งยาใหม่ ${pName}ส่งมาที่ห้องยาค่ะ`);
    });

    // 2. รับคิวการเงิน (ห้องยาส่งมา หรือแพทย์ส่งตรง)
    const unsubBill = subscribe('BILLING_CREATED', (data: any) => {
      const pName = data?.patient_name ? `ของคุณ ${data.patient_name} ` : '';
      playBillingNotification(`มีรายการชำระเงินใหม่ ${pName}ส่งมาที่ห้องการเงินค่ะ`);
    });

    return () => {
      unsubVisit();
      unsubBill();
    };
  }, [subscribe]);

  return null;
}
