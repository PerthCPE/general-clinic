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

const STORAGE_KEY_DOC_MESSAGES = 'clinic_document_messages_v1';

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
    {
      id: 'MSG-2569-001',
      docId: 1001,
      title: 'ผลการตรวจเลือด CBC (ฉุกเฉิน) - ผู้ป่วยนายสมหวัง ใจดี',
      description: 'พบค่าเม็ดเลือดขาวสูงผิดปกติ (WBC 18,500) และเกล็ดเลือดต่ำ โปรดแพทย์เจ้าของไข้ตรวจสอบด่วน',
      sender: 'ธุรการ (คุณสมจิต ดีใจ)',
      senderRole: 'เจ้าหน้าที่ธุรการ/เวชระเบียน',
      recipient: 'นพ.วิชัย ชาญการแพทย์',
      recipientUsername: 'doctor2',
      recipientId: 2,
      type: 'ผลตรวจ',
      priority: 'emergency',
      createdAt: new Date(now.getTime() - 15 * 60 * 1000).toISOString(),
      timeDisplay: '15 นาทีที่แล้ว',
      isUnread: true,
    },
    {
      id: 'MSG-2569-002',
      docId: 1002,
      title: 'ใบส่งตัวผู้ป่วยส่งต่อรับการตรวจครรภ์พิเศษ (ANC)',
      description: 'ส่งตัวคุณสมหญิง มีสุข เพื่อฝากครรภ์ความเสี่ยงสูงร่วมกับตรวจอัลตราซาวด์ 4 มิติ',
      sender: 'ธุรการ (คุณสมจิต ดีใจ)',
      senderRole: 'เจ้าหน้าที่ธุรการ/เวชระเบียน',
      recipient: 'พญ.สุดา สุขสมบูรณ์',
      recipientUsername: 'doctor1',
      recipientId: 1,
      type: 'ใบส่งตัว',
      priority: 'urgent',
      createdAt: new Date(now.getTime() - 45 * 60 * 1000).toISOString(),
      timeDisplay: '45 นาทีที่แล้ว',
      isUnread: true,
    },
    {
      id: 'MSG-2569-003',
      docId: 1003,
      title: 'รายงานสรุปผลวัคซีนและพัฒนาการเด็กประจำสัปดาห์',
      description: 'สรุปรายชื่อเด็กที่นัดหมายรับวัคซีนรวม 5 โรค (DTP-HB-Hib) ประจำวันศุกร์นี้',
      sender: 'ธุรการ (คุณสมจิต ดีใจ)',
      senderRole: 'เจ้าหน้าที่ธุรการ/เวชระเบียน',
      recipient: 'พญ.เกศรา รักษาดี',
      recipientUsername: 'doctor3',
      recipientId: 3,
      type: 'รายงาน',
      priority: 'normal',
      createdAt: new Date(now.getTime() - 120 * 60 * 1000).toISOString(),
      timeDisplay: '2 ชั่วโมงที่แล้ว',
      isUnread: true,
    },
    {
      id: 'MSG-2569-004',
      docId: 1004,
      title: 'บันทึกข้อความ: ตารางการออกตรวจและประชุมวิชาการประจำเดือน',
      description: 'แจ้งแพทย์และบุคลากรทุกท่านทราบเรื่องกำหนดการประชุมวิชาการและการจัดเวรออกตรวจรอบใหม่',
      sender: 'ธุรการ (คุณสมจิต ดีใจ)',
      senderRole: 'เจ้าหน้าที่ธุรการ/เวชระเบียน',
      recipient: 'แพทย์ทั้งหมด / บุคลากรคลินิก',
      recipientUsername: 'all',
      type: 'บันทึกข้อความ',
      priority: 'normal',
      createdAt: new Date(now.getTime() - 360 * 60 * 1000).toISOString(),
      timeDisplay: '6 ชั่วโมงที่แล้ว',
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
      msg.recipientUsername === 'all' ||
      (recipientUsername && msg.recipientUsername?.toLowerCase() === recipientUsername.toLowerCase()) ||
      (recipientName && (msg.recipient.includes(recipientName) || recipientName.includes(msg.recipient)));
    return match ? { ...msg, isUnread: false } : msg;
  });
  saveStoredDocumentMessages(updated);
}

/**
 * Filter messages applicable for the current user
 */
export function getDocumentMessagesForUser(
  currentUser?: { username?: string; fullName?: string; role?: string; id?: any } | null
): DocumentMessage[] {
  const all = getStoredDocumentMessages();
  if (!currentUser) return all;

  const username = currentUser.username?.toLowerCase() || '';
  const fullName = currentUser.fullName?.toLowerCase() || '';
  const role = currentUser.role?.toLowerCase() || '';

  // Officer / Admin see all forwarded messages
  if (role === 'officer' || role === 'admin') {
    return all;
  }

  return all.filter(msg => {
    if (msg.recipientUsername === 'all') return true;
    if (msg.recipientUsername && msg.recipientUsername.toLowerCase() === username) return true;
    if (fullName && (msg.recipient.toLowerCase().includes(fullName) || fullName.includes(msg.recipient.toLowerCase()))) return true;
    // Check match for doctors
    if (username.includes('doctor1') || fullName.includes('สุดา')) {
      return msg.recipient.includes('สุดา') || msg.recipientUsername === 'doctor1';
    }
    if (username.includes('doctor2') || fullName.includes('วิชัย')) {
      return msg.recipient.includes('วิชัย') || msg.recipientUsername === 'doctor2';
    }
    if (username.includes('doctor3') || fullName.includes('เกศรา')) {
      return msg.recipient.includes('เกศรา') || msg.recipientUsername === 'doctor3';
    }
    return false;
  });
}
