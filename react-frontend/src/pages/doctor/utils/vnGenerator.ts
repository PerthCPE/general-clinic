/**
 * Generates a VN (Visit Number) based on:
 * Short Buddhist Year (e.g. 69 for 2569) + Month (e.g. 8) + Day (e.g. 1) + Time (e.g. 1255 for 12:55) + Queue Index (1, 2, 3...)
 */
export function generateVN(dateStr?: string, timeStr?: string, queueIndex: number = 1): string {
  let dateObj = dateStr ? new Date(dateStr) : new Date();
  if (isNaN(dateObj.getTime())) {
    dateObj = new Date();
  }

  // 1. Short Buddhist Year (e.g. 2026 + 543 = 2569 -> '69')
  const adYear = dateObj.getFullYear();
  const beYear = adYear + 543;
  const shortYear = beYear.toString().slice(-2);

  // 2. Month (1 - 12)
  const month = dateObj.getMonth() + 1;

  // 3. Day of Month (1 - 31)
  const day = dateObj.getDate();

  // 4. Time HHmm in 24hr format
  let hhmm = '1255';
  if (timeStr) {
    const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (match) {
      let hours = parseInt(match[1], 10);
      const minutes = match[2];
      const ampm = match[3];
      if (ampm) {
        if (ampm.toUpperCase() === 'PM' && hours < 12) hours += 12;
        if (ampm.toUpperCase() === 'AM' && hours === 12) hours = 0;
      }
      const formattedHours = hours.toString().padStart(2, '0');
      hhmm = `${formattedHours}${minutes}`;
    } else {
      hhmm = timeStr.replace(/\D/g, '').padStart(4, '0').slice(0, 4) || '1255';
    }
  } else {
    const hours = dateObj.getHours().toString().padStart(2, '0');
    const minutes = dateObj.getMinutes().toString().padStart(2, '0');
    hhmm = `${hours}${minutes}`;
  }

  // 5. Queue Index starting from 1 (1, 2, 3...)
  const seq = queueIndex < 1 ? 1 : queueIndex;
  return `${shortYear}${month}${day}${hhmm}${seq}`;
}

/**
 * ข้อความที่ใช้แทนเลข VN เมื่อผู้ป่วยยังไม่ถูกเรียกเข้าตรวจ
 *
 * เลข VN ออกจริงที่ฝั่ง backend ตอนแพทย์กด "ตรวจผู้ป่วย" (หรือบันทึกฉบับร่าง
 * ครั้งแรก) ก่อนหน้านั้นในฐานข้อมูลยังไม่มีเลขนี้
 */
export const VN_NOT_ISSUED = '—';

/**
 * เลข VN ที่เอาไปแสดงบนหน้าจอ
 *
 * เดิมหลายจุดเขียนว่า `patient.vn || generateVN(...)` ซึ่งทำให้หน้าจอ "สร้าง"
 * เลข VN ปลอมขึ้นมาเองเมื่อฐานข้อมูลยังไม่มี ผลคือ
 *   1. เลขที่เห็นไม่ตรงกับที่บันทึกไว้จริง (เป็นเลขเวชระเบียน ห้ามมั่ว)
 *   2. ค้นหาด้วยเลขนั้นไม่เจอ เพราะตัวค้นหาเทียบกับ patient.vn ที่ยังว่างอยู่
 *
 * จึงเปลี่ยนมาแสดงขีดแทน ให้รู้ชัดว่ายังไม่ออกเลข
 */
export function displayVN(vn?: string): string {
  const value = (vn || '').trim();
  return value !== '' ? value : VN_NOT_ISSUED;
}
