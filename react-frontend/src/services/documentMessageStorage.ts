// Service for Document Messages sent from Officer to individual recipients
// Real-time synchronization between Officer Document Forwarding and recipient's Topbar Message Box

export interface DocumentMessage {
  id: string;
  docId?: number | string;
  title: string;
  description?: string;
  sender: string;
  senderRole?: string;
  recipient: string; // Full name or role e.g. 'พญ.สุดา สุขสมบูรณ์'
  recipientRole?: string;
  recipientId?: number | string;
  recipientUsername?: string; // e.g. 'doctor1'
  type: string; // 'ผลตรวจ' | 'ใบส่งตัว' | 'ใบเบิก' | 'รายงาน' | 'บันทึกข้อความ' | etc.
  priority: 'normal' | 'urgent' | 'emergency';
  createdAt: string; // ISO string
  timeDisplay: string;
  isUnread: boolean;
  fileUrl?: string;
}

const STORAGE_KEY_DOC_MESSAGES = 'clinic_document_messages_v3';

const MONTH_NAMES = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

export const formatThaiMessageTime = (dateObj: Date): string => {
  const bYear = dateObj.getFullYear() + 543;
  const day = dateObj.getDate();
  const month = MONTH_NAMES[dateObj.getMonth()];
  const time = `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')} น.`;
  return `${day} ${month} ${bYear} ${time}`;
};

export const generateInitialDocumentMessages = (): DocumentMessage[] => {
  const now = new Date();

  return [
    // === สำหรับ แพทย์คนที่ 1: พญ.สุดา สุขสมบูรณ์ (doctor1) เท่านั้น ===
    {
      id: 'MSG-2569-D1-01',
      docId: 1001,
      title: 'ใบส่งตัวผู้ป่วยตรวจครรภ์พิเศษ (ANC) - คุณสมหญิง มีสุข',
      description: 'ส่งตัวคุณสมหญิง มีสุข เพื่อฝากครรภ์ความเสี่ยงสูงและตรวจอัลตราซาวด์ 4 มิติ',
      sender: 'ธุรการ (คุณสมจิต ดีใจ)',
      senderRole: 'เจ้าหน้าที่ธุรการ/เวชระเบียน',
      recipient: 'พญ.สุดา สุขสมบูรณ์',
      recipientUsername: 'doctor1',
      recipientId: 7,
      type: 'ใบส่งตัว',
      priority: 'urgent',
      createdAt: new Date(now.getTime() - 25 * 60 * 1000).toISOString(),
      timeDisplay: '25 นาทีที่แล้ว',
      isUnread: true,
    },
    {
      id: 'MSG-2569-D1-02',
      docId: 1002,
      title: 'รายงานผลการตรวจคัดกรองมะเร็งปากมดลูก (Pap Smear)',
      description: 'ผลตรวจเซลล์วิทยาของคนไข้สูตินรีเวชประจำวันพุธ โปรดแพทย์เจ้าของไข้ตรวจสอบและลงนาม',
      sender: 'ธุรการ (คุณสมจิต ดีใจ)',
      senderRole: 'เจ้าหน้าที่ธุรการ/เวชระเบียน',
      recipient: 'พญ.สุดา สุขสมบูรณ์',
      recipientUsername: 'doctor1',
      recipientId: 7,
      type: 'ผลตรวจ',
      priority: 'normal',
      createdAt: new Date(now.getTime() - 90 * 60 * 1000).toISOString(),
      timeDisplay: '1 ชั่วโมงที่แล้ว',
      isUnread: false,
    },

    // === สำหรับ แพทย์คนที่ 2: นพ.วิชัย ชาญการแพทย์ (doctor2) เท่านั้น ===
    {
      id: 'MSG-2569-D2-01',
      docId: 1003,
      title: 'ผลการตรวจเลือด CBC และระดับน้ำตาลสะสม (HbA1c) - นายสมหวัง ใจดี',
      description: 'พบค่าเม็ดเลือดขาวสูงผิดปกติ (WBC 18,500) โปรดแพทย์อายุรกรรมตรวจสอบและปรับแผนการรักษา',
      sender: 'ธุรการ (คุณสมจิต ดีใจ)',
      senderRole: 'เจ้าหน้าที่ธุรการ/เวชระเบียน',
      recipient: 'นพ.วิชัย ชาญการแพทย์',
      recipientUsername: 'doctor2',
      recipientId: 8,
      type: 'ผลตรวจ',
      priority: 'emergency',
      createdAt: new Date(now.getTime() - 15 * 60 * 1000).toISOString(),
      timeDisplay: '15 นาทีที่แล้ว',
      isUnread: true,
    },
    {
      id: 'MSG-2569-D2-02',
      docId: 1004,
      title: 'ผลการตรวจคลื่นไฟฟ้าหัวใจ (EKG 12 Leads) - ผู้ป่วยเคสหัวใจ',
      description: 'บันทึกภาพกราฟคลื่นไฟฟ้าหัวใจ EKG เพื่อให้อายุรแพทย์วิเคราะห์ผลก่อนนัดหมาย',
      sender: 'ธุรการ (คุณสมจิต ดีใจ)',
      senderRole: 'เจ้าหน้าที่ธุรการ/เวชระเบียน',
      recipient: 'นพ.วิชัย ชาญการแพทย์',
      recipientUsername: 'doctor2',
      recipientId: 8,
      type: 'รายงาน',
      priority: 'urgent',
      createdAt: new Date(now.getTime() - 120 * 60 * 1000).toISOString(),
      timeDisplay: '2 ชั่วโมงที่แล้ว',
      isUnread: false,
    },

    // === สำหรับ แพทย์คนที่ 3: พญ.เกศรา รักษาดี (doctor3) เท่านั้น ===
    {
      id: 'MSG-2569-D3-01',
      docId: 1005,
      title: 'รายงานสรุปผลวัคซีนและพัฒนาการเด็กประจำสัปดาห์ - ด.ช.แทนคุณ',
      description: 'สรุปรายชื่อเด็กที่นัดหมายรับวัคซีนรวม 5 โรค (DTP-HB-Hib) ประจำวันศุกร์นี้',
      sender: 'ธุรการ (คุณสมจิต ดีใจ)',
      senderRole: 'เจ้าหน้าที่ธุรการ/เวชระเบียน',
      recipient: 'พญ.เกศรา รักษาดี',
      recipientUsername: 'doctor3',
      recipientId: 9,
      type: 'รายงาน',
      priority: 'normal',
      createdAt: new Date(now.getTime() - 40 * 60 * 1000).toISOString(),
      timeDisplay: '40 นาทีที่แล้ว',
      isUnread: true,
    },
    {
      id: 'MSG-2569-D3-02',
      docId: 1006,
      title: 'ผลการตรวจภูมิแพ้ทางผิวหนัง (Skin Prick Test) ในเด็ก',
      description: 'รายงานผลการทดสอบการแพ้อาหารและสารก่อภูมิแพ้ในทางเดินหายใจของเด็กอายุ 5 ขวบ',
      sender: 'ธุรการ (คุณสมจิต ดีใจ)',
      senderRole: 'เจ้าหน้าที่ธุรการ/เวชระเบียน',
      recipient: 'พญ.เกศรา รักษาดี',
      recipientUsername: 'doctor3',
      recipientId: 9,
      type: 'ผลตรวจ',
      priority: 'normal',
      createdAt: new Date(now.getTime() - 180 * 60 * 1000).toISOString(),
      timeDisplay: '3 ชั่วโมงที่แล้ว',
      isUnread: false,
    },
  ];
};

export function getStoredDocumentMessages(): DocumentMessage[] {
  if (typeof window === 'undefined') return generateInitialDocumentMessages();
  const raw = localStorage.getItem(STORAGE_KEY_DOC_MESSAGES);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {
      // fallback
    }
  }
  const initial = generateInitialDocumentMessages();
  localStorage.setItem(STORAGE_KEY_DOC_MESSAGES, JSON.stringify(initial));
  return initial;
}

export function saveStoredDocumentMessages(messages: DocumentMessage[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY_DOC_MESSAGES, JSON.stringify(messages));
    window.dispatchEvent(new CustomEvent('clinic_document_message_sent'));
  }
}

/**
 * Send a new document message from Officer to Recipient
 */
export function sendDocumentMessage(
  payload: Omit<DocumentMessage, 'id' | 'createdAt' | 'isUnread' | 'timeDisplay'>
): DocumentMessage {
  const current = getStoredDocumentMessages();
  const now = new Date();
  const newMsg: DocumentMessage = {
    ...payload,
    id: `MSG-${Date.now().toString().slice(-6)}`,
    createdAt: now.toISOString(),
    timeDisplay: 'เมื่อสักครู่',
    isUnread: true,
  };

  const updated = [newMsg, ...current];
  saveStoredDocumentMessages(updated);
  return newMsg;
}

/**
 * Mark a single message as read
 */
export function markDocumentMessageAsRead(id: string) {
  const current = getStoredDocumentMessages();
  const updated = current.map(msg => (msg.id === id ? { ...msg, isUnread: false } : msg));
  saveStoredDocumentMessages(updated);
}

/**
 * Mark all messages as read for a specific recipient
 */
export function markAllDocumentMessagesAsRead(recipientUsername?: string, recipientName?: string) {
  const current = getStoredDocumentMessages();
  const updated = current.map(msg => {
    if (!recipientUsername && !recipientName) {
      return { ...msg, isUnread: false };
    }
    const match =
      (recipientUsername && msg.recipientUsername?.toLowerCase() === recipientUsername.toLowerCase()) ||
      (recipientName && (msg.recipient.includes(recipientName) || recipientName.includes(msg.recipient)));
    return match ? { ...msg, isUnread: false } : msg;
  });
  saveStoredDocumentMessages(updated);
}

/**
 * Filter messages applicable strictly for the current user.
 * Doctor 1 sees ONLY Doctor 1's documents.
 * Doctor 2 sees ONLY Doctor 2's documents.
 * Doctor 3 sees ONLY Doctor 3's documents.
 * Other roles cannot view another doctor's private documents.
 */
export function getDocumentMessagesForUser(
  currentUser?: { username?: string; fullName?: string; role?: string; id?: any } | null
): DocumentMessage[] {
  const all = getStoredDocumentMessages();
  if (!currentUser) return [];

  const username = currentUser.username?.toLowerCase().trim() || '';
  const fullName = currentUser.fullName?.toLowerCase().trim() || '';
  const role = currentUser.role?.toLowerCase().trim() || '';

  // Officer / Admin can see all forwarded items for administrative audit & tracking
  if (role === 'officer' || role === 'admin') {
    return all;
  }

  // Strict isolation per individual doctor / user:
  return all.filter(msg => {
    // 1. Doctor 1 (พญ.สุดา สุขสมบูรณ์) -> Strictly Doctor 1 only
    if (username === 'doctor1' || fullName.includes('สุดา')) {
      return (
        msg.recipientUsername === 'doctor1' ||
        msg.recipient.includes('สุดา') ||
        msg.recipientId === 7 ||
        msg.recipientId === 1 ||
        msg.recipientId === 'DOC-1'
      );
    }

    // 2. Doctor 2 (นพ.วิชัย ชาญการแพทย์) -> Strictly Doctor 2 only
    if (username === 'doctor2' || fullName.includes('วิชัย')) {
      return (
        msg.recipientUsername === 'doctor2' ||
        msg.recipient.includes('วิชัย') ||
        msg.recipientId === 8 ||
        msg.recipientId === 2 ||
        msg.recipientId === 'DOC-2'
      );
    }

    // 3. Doctor 3 (พญ.เกศรา รักษาดี) -> Strictly Doctor 3 only
    if (username === 'doctor3' || fullName.includes('เกศรา')) {
      return (
        msg.recipientUsername === 'doctor3' ||
        msg.recipient.includes('เกศรา') ||
        msg.recipientId === 9 ||
        msg.recipientId === 3 ||
        msg.recipientId === 'DOC-3'
      );
    }

    // 4. Nurse 1 (พว. กานดา คัดกรอง)
    if (username === 'nurse1' || fullName.includes('กานดา')) {
      return (
        msg.recipientUsername === 'nurse1' ||
        msg.recipient.includes('กานดา') ||
        msg.recipientId === 3
      );
    }

    // 5. Pharmacist 1 (ภก.บุญชู เภสัชกร)
    if (username === 'pharmacist1' || fullName.includes('บุญชู')) {
      return (
        msg.recipientUsername === 'pharmacist1' ||
        msg.recipient.includes('บุญชู') ||
        msg.recipientId === 5
      );
    }

    // 6. Cashier 1 (นส.รวย การเงิน)
    if (username === 'cashier1' || fullName.includes('รวย')) {
      return (
        msg.recipientUsername === 'cashier1' ||
        msg.recipient.includes('รวย') ||
        msg.recipientId === 6
      );
    }

    // 7. General fallback: Exact match by username or recipient fullname
    if (msg.recipientUsername && msg.recipientUsername.toLowerCase() === username) {
      return true;
    }
    if (fullName && msg.recipient.toLowerCase().includes(fullName)) {
      return true;
    }

    return false;
  });
}
