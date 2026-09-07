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

const STORAGE_KEY_DOC_MESSAGES = 'clinic_document_messages_v4';

const MONTH_NAMES = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

export const formatThaiMessageTime = (dateObj: Date): string => {
  const bYear = dateObj.getFullYear() + 543;
  const day = dateObj.getDate();
  const month = MONTH_NAMES[dateObj.getMonth()];
  const time = `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')} น.`;
  return `${day} ${month} ${bYear} ${time}`;
};

export const generateInitialDocumentMessages = (): DocumentMessage[] => {
  return [];
};

export function getStoredDocumentMessages(): DocumentMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    localStorage.removeItem('clinic_document_messages_v1');
    localStorage.removeItem('clinic_document_messages_v2');
    localStorage.removeItem('clinic_document_messages_v3');
  } catch {
    // ignore
  }
  const raw = localStorage.getItem(STORAGE_KEY_DOC_MESSAGES);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // fallback
    }
  }
  return [];
}

export function saveStoredDocumentMessages(messages: DocumentMessage[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY_DOC_MESSAGES, JSON.stringify(messages));
    window.dispatchEvent(new CustomEvent('clinic_document_message_sent'));
  }
}

/**
 * Delete a single message by ID
 */
export function deleteDocumentMessage(id: string) {
  const current = getStoredDocumentMessages();
  const updated = current.filter(msg => msg.id !== id);
  saveStoredDocumentMessages(updated);
}

/**
 * Delete a message associated with a specific Document ID
 */
export function deleteDocumentMessageByDocId(docId: number | string) {
  const current = getStoredDocumentMessages();
  const updated = current.filter(msg => String(msg.docId) !== String(docId));
  saveStoredDocumentMessages(updated);
}

/**
 * Clear all document messages
 */
export function clearAllDocumentMessages() {
  saveStoredDocumentMessages([]);
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
