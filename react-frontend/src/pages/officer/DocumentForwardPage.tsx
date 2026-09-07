import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  dmsApi,
  type BackendDocumentForward,
  type BackendUser,
  type BackendDocument,
} from '../../services/api';
import {
  sendDocumentMessage,
  deleteDocumentMessage,
  deleteDocumentMessageByDocId,
} from '../../services/documentMessageStorage';
import { DEMO_USERS } from '../../config/roles';
import './DocumentForwardPage.css';

export interface ForwardDoc {
  id: string;
  forwardId?: number;
  docId?: number;
  title: string;
  description?: string;
  sender: string;
  senderRole?: string;
  recipient?: string;
  recipientRole?: string;
  recipientId?: number;
  receivedDate: string;
  rawDate?: string;
  type: string;
  priority: 'normal' | 'urgent' | 'emergency';
  status: 'unread' | 'processing' | 'completed';
  acknowledgedAt?: string | null;
  fileUrl?: string;
}

const MONTH_NAMES = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

const formatThaiDate = (dateObj: Date): string => {
  const bYear = dateObj.getFullYear() + 543;
  const day = dateObj.getDate();
  const month = MONTH_NAMES[dateObj.getMonth()];
  const time = `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
  return `${day} ${month} ${bYear} ${time} น.`;
};

const getRoleLabel = (role?: string): string => {
  if (!role) return 'เจ้าหน้าที่';
  switch (role.toLowerCase()) {
    case 'doctor':
      return 'แพทย์';
    case 'nurse':
      return 'พยาบาล';
    case 'nurse_assistant':
      return 'ผู้ช่วยพยาบาล';
    case 'pharmacist':
      return 'เภสัชกร';
    case 'cashier':
      return 'การเงิน';
    case 'officer':
      return 'ธุรการ/เวชระเบียน';
    case 'registrar':
      return 'เวชระเบียน';
    case 'admin':
      return 'ผู้ดูแลระบบ';
    default:
      return role;
  }
};

const getRoleTheme = (role?: string) => {
  switch (role?.toLowerCase()) {
    case 'doctor':
      return {
        bg: '#FFE4E6',
        color: '#E11D48',
        border: '#FECDD3',
        label: 'แพทย์ (Doctor)',
        gradient: 'linear-gradient(135deg, #F43F5E 0%, #BE123C 100%)',
      };
    case 'nurse':
    case 'nurse_assistant':
      return {
        bg: '#D1FAE5',
        color: '#059669',
        border: '#A7F3D0',
        label: role?.toLowerCase() === 'nurse_assistant' ? 'ผู้ช่วยพยาบาล' : 'พยาบาล (Nurse)',
        gradient: 'linear-gradient(135deg, #10B981 0%, #047857 100%)',
      };
    case 'pharmacist':
      return {
        bg: '#EDE9FE',
        color: '#7C3AED',
        border: '#DDD6FE',
        label: 'เภสัชกร (Pharmacy)',
        gradient: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
      };
    case 'cashier':
      return {
        bg: '#FEF3C7',
        color: '#D97706',
        border: '#FDE68A',
        label: 'การเงิน (Cashier)',
        gradient: 'linear-gradient(135deg, #F59E0B 0%, #B45309 100%)',
      };
    case 'officer':
    case 'registrar':
      return {
        bg: '#FCE7F3',
        color: '#DB2777',
        border: '#FBCFE8',
        label: 'ธุรการ/เวชระเบียน',
        gradient: 'linear-gradient(135deg, #EC4899 0%, #BE185D 100%)',
      };
    case 'admin':
      return {
        bg: '#DBEAFE',
        color: '#2563EB',
        border: '#BFDBFE',
        label: 'ผู้ดูแลระบบ (Admin)',
        gradient: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
      };
    default:
      return {
        bg: '#F1F5F9',
        color: '#475569',
        border: '#CBD5E1',
        label: 'เจ้าหน้าที่',
        gradient: 'linear-gradient(135deg, #64748B 0%, #334155 100%)',
      };
  }
};

const getStaffAvatarText = (fullname?: string, username?: string): string => {
  const str = (fullname || username || 'ST').trim();
  if (str.startsWith('พญ.')) return 'พญ';
  if (str.startsWith('นพ.')) return 'นพ';
  if (str.startsWith('พว.')) return 'พว';
  if (str.startsWith('ภก.')) return 'ภก';
  if (str.startsWith('ดร.')) return 'ดร';
  if (str.startsWith('คุณ')) return str.slice(3, 5).trim() || 'คุณ';
  if (str.startsWith('นาย')) return str.slice(3, 5).trim() || 'นาย';
  if (str.startsWith('นส.')) return 'นส';
  return str.slice(0, 2).toUpperCase();
};

const STORAGE_KEY_INCOMING_DOCS = 'clinic_dms_incoming_docs_v2';
const STORAGE_KEY_FORWARDED_DOCS = 'clinic_dms_forwarded_docs_v2';

const getStoredIncomingDocs = (): ForwardDoc[] => {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(STORAGE_KEY_INCOMING_DOCS);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // ignore
    }
  }
  return [];
};

const saveStoredIncomingDocs = (docs: ForwardDoc[]) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY_INCOMING_DOCS, JSON.stringify(docs));
  }
};

const getStoredForwardedDocs = (): ForwardDoc[] => {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(STORAGE_KEY_FORWARDED_DOCS);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // ignore
    }
  }
  return [];
};

const saveStoredForwardedDocs = (docs: ForwardDoc[]) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY_FORWARDED_DOCS, JSON.stringify(docs));
  }
};

const getStoredSystemDocs = (): BackendDocument[] => {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem('clinic_dms_documents_list_v2');
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((p: any) => ({
          id: Number(p.id) || 0,
          external_doc_ref: p.externalRef || '',
          subject: p.subject || p.name || '',
          description: p.description || '',
          file_url: p.fileUrl || '',
          file_size: p.fileSize || 0,
          status: p.status || 'reviewing',
          doc_type: p.type || 'เอกสารทั่วไป',
          created_by: 1,
          created_at: p.rawDoc?.created_at || new Date().toISOString(),
          updated_at: p.rawDoc?.updated_at || new Date().toISOString(),
          creator: p.rawDoc?.creator || { full_name: p.creatorName || 'ธุรการ' },
        }));
      }
    } catch {
      // ignore
    }
  }
  return [];
};

export const DocumentForwardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'incoming' | 'forwarded'>(() => {
    const inc = getStoredIncomingDocs();
    const fwd = getStoredForwardedDocs();
    if (inc.length === 0 && fwd.length > 0) return 'forwarded';
    return 'forwarded';
  });
  const [incomingDocs, setIncomingDocs] = useState<ForwardDoc[]>(() => getStoredIncomingDocs());
  const [forwardedDocs, setForwardedDocs] = useState<ForwardDoc[]>(() => getStoredForwardedDocs());
  const [recipientsList, setRecipientsList] = useState<BackendUser[]>([]);
  const [systemDocuments, setSystemDocuments] = useState<BackendDocument[]>(() => getStoredSystemDocs());
  const [isLoading, setIsLoading] = useState(false);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | 'processing' | 'completed'>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'normal' | 'urgent' | 'emergency'>('all');

  // Modals
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<ForwardDoc | null>(null);
  // Metric Modals & Sub-filters
  const [activeMetricModal, setActiveMetricModal] = useState<'system_docs' | 'today' | 'pending' | 'completed' | 'recipients' | null>(null);
  const [modalSearchTerm, setModalSearchTerm] = useState('');
  const [modalRoleFilter, setModalRoleFilter] = useState<string>('all');

  // Send Form State (System Documents Forwarding ONLY)
  const [selectedSystemDocId, setSelectedSystemDocId] = useState<number | ''>('');
  const [newDocDescription, setNewDocDescription] = useState('');
  const [newDocRecipientId, setNewDocRecipientId] = useState<number>(6);
  const [newDocPriority, setNewDocPriority] = useState<'normal' | 'urgent' | 'emergency'>('normal');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Selected system document preview
  const selectedDocPreview = useMemo(() => {
    if (!selectedSystemDocId) return null;
    return systemDocuments.find(d => d.id === Number(selectedSystemDocId)) || null;
  }, [selectedSystemDocId, systemDocuments]);

  // Load Real Data from DMS API
  const loadData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Forwards
      const forwardsData = await dmsApi.getForwards().catch(() => null);
      if (forwardsData !== null && Array.isArray(forwardsData)) {
        const mapped: ForwardDoc[] = forwardsData.map((fwd) => {
          const createdAt = new Date(fwd.created_at || Date.now());
          const isAck = fwd.status === 'Acknowledged';
          return {
            id: `FWD-${String(fwd.id).padStart(4, '0')}`,
            forwardId: fwd.id,
            docId: fwd.doc_id,
            title: fwd.document?.subject || `เอกสารส่งต่อ #${fwd.doc_id}`,
            description: fwd.document?.description || 'เอกสารส่งต่อผ่านระบบเวชระเบียน DMS',
            sender: fwd.document?.creator?.fullname || fwd.document?.creator?.username || 'ธุรการ (คุณสมจิต ดีใจ)',
            senderRole: getRoleLabel(fwd.document?.creator?.role),
            recipient: fwd.recipient?.fullname || fwd.recipient?.username || 'เจ้าหน้าที่ปลายทาง',
            recipientRole: getRoleLabel(fwd.recipient?.role),
            recipientId: fwd.forwarded_to,
            receivedDate: formatThaiDate(createdAt),
            rawDate: fwd.created_at,
            type: fwd.document?.doc_type || 'เอกสารราชการ',
            priority: 'normal',
            status: isAck ? 'completed' : 'processing',
            acknowledgedAt: fwd.acknowledged_at,
            fileUrl: fwd.document?.file_url,
          };
        });
        setForwardedDocs(mapped);
        saveStoredForwardedDocs(mapped);
      }

      // 2. Fetch Recipients List
      const users = await dmsApi.getRecipients().catch(() => [] as BackendUser[]);
      if (users && Array.isArray(users) && users.length > 0) {
        setRecipientsList(users);
        if (!newDocRecipientId || !users.some(u => u.id === newDocRecipientId)) {
          setNewDocRecipientId(users[0].id);
        }
      }

      // 3. Fetch System Documents for Forwarding options
      const docs = await dmsApi.getDocuments().catch(() => [] as BackendDocument[]);
      if (docs && Array.isArray(docs)) {
        setSystemDocuments(docs);
      }
    } catch {
      // Keep state intact with mock fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleSyncUpdate = () => {
      // Refresh forwards when recipient acknowledges
      const fwd = getStoredForwardedDocs();
      if (fwd.length > 0) {
        setForwardedDocs(fwd);
      }
      loadData();
    };

    window.addEventListener('clinic_document_acknowledged', handleSyncUpdate);
    window.addEventListener('clinic_document_message_sent', handleSyncUpdate);
    window.addEventListener('storage', handleSyncUpdate);

    return () => {
      window.removeEventListener('clinic_document_acknowledged', handleSyncUpdate);
      window.removeEventListener('clinic_document_message_sent', handleSyncUpdate);
      window.removeEventListener('storage', handleSyncUpdate);
    };
  }, []);

  // Submit Forwarding (System Document Only)
  const handleSendDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSystemDocId) {
      toast.error('กรุณาเลือกเอกสารจากคลังระบบที่ต้องการส่งต่อ');
      return;
    }

    const selectedDocObj = systemDocuments.find(d => d.id === Number(selectedSystemDocId));
    if (!selectedDocObj) {
      toast.error('ไม่พบข้อมูลเอกสารที่เลือกในระบบ');
      return;
    }

    setIsSubmitting(true);
    const selectedRecipient = recipientsList.find(u => u.id === newDocRecipientId);
    const recipientName = selectedRecipient?.fullname || selectedRecipient?.username || 'เจ้าหน้าที่ปลายทาง';
    const recipientRole = getRoleLabel(selectedRecipient?.role);
    const docTitle = selectedDocObj.subject;
    const docType = selectedDocObj.doc_type || 'เอกสารทั่วไป';
    const finalDescription = newDocDescription.trim() || selectedDocObj.description || 'เอกสารส่งต่อผ่านระบบเวชระเบียน DMS';

    try {
      // Forward to recipient
      const fwdRes = await dmsApi.forwardDocument({
        doc_id: selectedDocObj.id,
        forwarded_to: newDocRecipientId,
      });

      const now = new Date();
      const newDoc: ForwardDoc = {
        id: `FWD-${String(fwdRes.forward.id).padStart(4, '0')}`,
        forwardId: fwdRes.forward.id,
        docId: selectedDocObj.id,
        title: docTitle,
        description: finalDescription,
        sender: 'ธุรการ (คุณสมจิต ดีใจ)',
        senderRole: 'เจ้าหน้าที่ธุรการ',
        recipient: recipientName,
        recipientRole: recipientRole,
        recipientId: newDocRecipientId,
        receivedDate: formatThaiDate(now),
        rawDate: now.toISOString(),
        type: docType,
        priority: newDocPriority,
        status: 'processing',
        fileUrl: selectedDocObj.file_url,
      };

      setForwardedDocs(prev => {
        const next = [newDoc, ...prev];
        saveStoredForwardedDocs(next);
        return next;
      });

      sendDocumentMessage({
        forwardId: fwdRes.forward.id,
        docId: selectedDocObj.id,
        title: docTitle,
        description: finalDescription,
        sender: 'ธุรการ (คุณสมจิต ดีใจ)',
        senderRole: 'เจ้าหน้าที่ธุรการ',
        recipient: recipientName,
        recipientRole: recipientRole,
        recipientId: newDocRecipientId,
        recipientUsername: selectedRecipient?.username,
        type: docType,
        priority: newDocPriority,
        fileUrl: selectedDocObj.file_url,
      });

      setIsSendModalOpen(false);
      resetSendForm();
      toast.success(`ส่งต่อเอกสาร "${docTitle}" ไปยัง ${recipientName} เรียบร้อยแล้ว`);
    } catch {
      // Fallback for offline or local preview
      const now = new Date();
      const newDoc: ForwardDoc = {
        id: `FWD-2569-${String(2000 + forwardedDocs.length + 1)}`,
        docId: selectedDocObj.id,
        title: docTitle,
        description: finalDescription,
        sender: 'ธุรการ (คุณสมจิต ดีใจ)',
        senderRole: 'เจ้าหน้าที่ธุรการ',
        recipient: recipientName,
        recipientRole: recipientRole,
        recipientId: newDocRecipientId,
        receivedDate: formatThaiDate(now),
        rawDate: now.toISOString(),
        type: docType,
        priority: newDocPriority,
        status: 'processing',
        fileUrl: selectedDocObj.file_url,
      };

      setForwardedDocs(prev => {
        const next = [newDoc, ...prev];
        saveStoredForwardedDocs(next);
        return next;
      });

      sendDocumentMessage({
        docId: selectedDocObj.id,
        title: docTitle,
        description: finalDescription,
        sender: 'ธุรการ (คุณสมจิต ดีใจ)',
        senderRole: 'เจ้าหน้าที่ธุรการ',
        recipient: recipientName,
        recipientRole: recipientRole,
        recipientId: newDocRecipientId,
        recipientUsername: selectedRecipient?.username,
        type: docType,
        priority: newDocPriority,
        fileUrl: selectedDocObj.file_url,
      });

      setIsSendModalOpen(false);
      resetSendForm();
      toast.success(`ส่งต่อเอกสาร "${docTitle}" ไปยัง ${recipientName} สำเร็จ`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetSendForm = () => {
    setSelectedSystemDocId('');
    setNewDocDescription('');
    setNewDocPriority('normal');
  };

  // View Document Details
  const handleViewDetail = async (doc: ForwardDoc) => {
    setSelectedDoc(doc);
    setIsDetailModalOpen(true);

    // Auto update unread incoming status to processing
    if (doc.status === 'unread' && activeTab === 'incoming') {
      setIncomingDocs(prev => {
        const next = prev.map(d => d.id === doc.id ? { ...d, status: 'processing' as const } : d);
        saveStoredIncomingDocs(next);
        return next;
      });
    }
  };

  // Acknowledge Forward Action
  const handleAcknowledge = async (doc: ForwardDoc) => {
    try {
      if (doc.forwardId) {
        await dmsApi.acknowledgeForward(doc.forwardId);
      }
      const updatedList = (list: ForwardDoc[]) =>
        list.map(d => (d.id === doc.id || (doc.forwardId && d.forwardId === doc.forwardId))
          ? { ...d, status: 'completed' as const, acknowledgedAt: new Date().toISOString() }
          : d
        );

      setIncomingDocs(prev => {
        const next = updatedList(prev);
        saveStoredIncomingDocs(next);
        return next;
      });
      setForwardedDocs(prev => {
        const next = updatedList(prev);
        saveStoredForwardedDocs(next);
        return next;
      });
      if (selectedDoc && (selectedDoc.id === doc.id || selectedDoc.forwardId === doc.forwardId)) {
        setSelectedDoc(prev => prev ? { ...prev, status: 'completed', acknowledgedAt: new Date().toISOString() } : null);
      }
      toast.success('บันทึกการรับทราบเอกสารเรียบร้อยแล้ว');
    } catch {
      const updatedList = (list: ForwardDoc[]) =>
        list.map(d => (d.id === doc.id)
          ? { ...d, status: 'completed' as const }
          : d
        );
      setIncomingDocs(prev => {
        const next = updatedList(prev);
        saveStoredIncomingDocs(next);
        return next;
      });
      setForwardedDocs(prev => {
        const next = updatedList(prev);
        saveStoredForwardedDocs(next);
        return next;
      });
      if (selectedDoc) {
        setSelectedDoc(prev => prev ? { ...prev, status: 'completed' } : null);
      }
      toast.success('บันทึกการรับทราบเอกสารแล้ว');
    }
  };

  // Archive incoming document
  const handleArchive = (docId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIncomingDocs(prev => {
      const next = prev.filter(d => d.id !== docId);
      saveStoredIncomingDocs(next);
      return next;
    });
    toast.success('จัดเก็บเอกสารเข้าแฟ้มถาวรเรียบร้อยแล้ว');
  };

  // Delete Forwarded Document
  const handleDeleteForward = async (doc: ForwardDoc, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`คุณต้องการลบรายการส่งต่อเอกสาร "${doc.title}" ใช่หรือไม่?`)) {
      return;
    }

    try {
      if (doc.forwardId) {
        await dmsApi.deleteForward(doc.forwardId);
      }
      if (doc.docId) {
        deleteDocumentMessageByDocId(doc.docId);
      }
      deleteDocumentMessage(doc.id);

      setForwardedDocs(prev => {
        const next = prev.filter(d => d.id !== doc.id && (!doc.forwardId || d.forwardId !== doc.forwardId));
        saveStoredForwardedDocs(next);
        return next;
      });
      if (selectedDoc && (selectedDoc.id === doc.id || (doc.forwardId && selectedDoc.forwardId === doc.forwardId))) {
        setIsDetailModalOpen(false);
        setSelectedDoc(null);
      }
      toast.success('ลบรายการส่งต่อเอกสารเรียบร้อยแล้ว');
    } catch {
      if (doc.docId) {
        deleteDocumentMessageByDocId(doc.docId);
      }
      deleteDocumentMessage(doc.id);
      setForwardedDocs(prev => {
        const next = prev.filter(d => d.id !== doc.id);
        saveStoredForwardedDocs(next);
        return next;
      });
      if (selectedDoc && selectedDoc.id === doc.id) {
        setIsDetailModalOpen(false);
        setSelectedDoc(null);
      }
      toast.success('ลบรายการเอกสารแล้ว');
    }
  };

  // Delete Incoming Document
  const handleDeleteIncoming = (docId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm('คุณต้องการลบเอกสารนี้ใช่หรือไม่?')) {
      return;
    }
    setIncomingDocs(prev => {
      const next = prev.filter(d => d.id !== docId);
      saveStoredIncomingDocs(next);
      return next;
    });
    if (selectedDoc && selectedDoc.id === docId) {
      setIsDetailModalOpen(false);
      setSelectedDoc(null);
    }
    toast.success('ลบเอกสารเรียบร้อยแล้ว');
  };

  // Print Document Delivery Slip
  const handlePrintSlip = (doc: ForwardDoc) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('กรุณาอนุญาตป๊อปอัปเพื่อพิมพ์เอกสาร');
      return;
    }
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>ใบนำส่งเอกสาร - ${doc.id}</title>
        <style>
          body { font-family: 'Sarabun', 'TH Sarabun New', sans-serif; padding: 30px; color: #1e293b; }
          .header { text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 20px; }
          .title { font-size: 20px; font-weight: bold; margin: 0; color: #1e3a8a; }
          .subtitle { font-size: 13px; color: #64748b; margin-top: 4px; }
          .info-table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          .info-table td { padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
          .label { font-weight: bold; width: 30%; color: #475569; }
          .stamp-box { margin-top: 40px; display: flex; justify-content: space-between; }
          .stamp { width: 45%; text-align: center; border-top: 1px dashed #94a3b8; padding-top: 10px; font-size: 13px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2 class="title">ใบนำส่งเอกสารคลินิก (Clinic Document Delivery Slip)</h2>
          <div class="subtitle">ระบบบริหารจัดการเอกสาร DMS Clinic Service</div>
        </div>
        <table class="info-table">
          <tr><td class="label">เลขที่เอกสาร:</td><td><strong>${doc.id}</strong></td></tr>
          <tr><td class="label">ชื่อเรื่อง/หัวข้อ:</td><td>${doc.title}</td></tr>
          <tr><td class="label">ประเภทเอกสาร:</td><td>${doc.type}</td></tr>
          <tr><td class="label">ระดับความเร่งด่วน:</td><td>${doc.priority === 'emergency' ? 'ด่วนที่สุด (Emergency)' : doc.priority === 'urgent' ? 'ด่วน (Urgent)' : 'ปกติ (Normal)'}</td></tr>
          <tr><td class="label">ต้นทาง (ผู้ส่ง):</td><td>${doc.sender} (${doc.senderRole || 'เจ้าหน้าที่'})</td></tr>
          <tr><td class="label">ปลายทาง (ผู้รับ):</td><td>${doc.recipient || '-'} (${doc.recipientRole || 'เจ้าหน้าที่'})</td></tr>
          <tr><td class="label">วันเวลาที่ส่งมอบ:</td><td>${doc.receivedDate}</td></tr>
          <tr><td class="label">รายละเอียด/บันทึก:</td><td>${doc.description || '-'}</td></tr>
          <tr><td class="label">สถานะการรับมอบ:</td><td>${doc.status === 'completed' ? 'รับทราบและส่งมอบเรียบร้อยแล้ว' : 'อยู่ระหว่างดำเนินการ'}</td></tr>
        </table>
        <div class="stamp-box">
          <div class="stamp">
            <p>ลงชื่อ....................................................</p>
            <p>( ผู้ส่งมอบเอกสาร )</p>
            <p>วันที่ ......./......./.......</p>
          </div>
          <div class="stamp">
            <p>ลงชื่อ....................................................</p>
            <p>( ผู้รับมอบเอกสาร )</p>
            <p>วันที่ ......./......./.......</p>
          </div>
        </div>
      </body>
      </html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  };

  // Filtered List Computation
  const currentList = forwardedDocs;
  const filteredList = useMemo(() => {
    return currentList.filter(doc => {
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch = !q ||
        doc.title.toLowerCase().includes(q) ||
        doc.id.toLowerCase().includes(q) ||
        doc.sender.toLowerCase().includes(q) ||
        (doc.recipient && doc.recipient.toLowerCase().includes(q)) ||
        doc.type.toLowerCase().includes(q) ||
        (doc.description && doc.description.toLowerCase().includes(q));

      const matchesStatus = statusFilter === 'all' || doc.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || doc.priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [currentList, searchTerm, statusFilter, priorityFilter]);

  // Metric Computations
  const totalPendingCount = forwardedDocs.filter(d => d.status === 'processing').length;
  const totalCompletedCount = forwardedDocs.filter(d => d.status === 'completed').length;

  // Render Metric Details Modal
  const renderMetricModal = () => {
    if (!activeMetricModal) return null;

    const handleCloseModal = () => {
      setActiveMetricModal(null);
      setModalSearchTerm('');
      setModalRoleFilter('all');
    };

    // 1. System Documents Available for Forwarding Modal
    if (activeMetricModal === 'system_docs') {
      const filteredDocs = systemDocuments.filter(doc => {
        if (!modalSearchTerm.trim()) return true;
        const q = modalSearchTerm.toLowerCase();
        return (
          doc.subject?.toLowerCase().includes(q) ||
          doc.external_doc_ref?.toLowerCase().includes(q) ||
          doc.doc_type?.toLowerCase().includes(q) ||
          doc.creator?.fullname?.toLowerCase().includes(q) ||
          doc.creator?.username?.toLowerCase().includes(q)
        );
      });

      return (
        <div className="dms-modal-backdrop" onClick={handleCloseModal}>
          <div className="dms-modal-card dms-modal-wide" onClick={e => e.stopPropagation()}>
            <div className="dms-modal-header">
              <div className="dms-modal-title-group">
                <div className="dms-modal-icon-badge blue-badge">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" width="22" height="22">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 02 2h12a2 2 0 0 02-2V8z" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M14 2v6h6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div>
                  <h3 className="dms-modal-title">เอกสารทั้งหมดในระบบที่พร้อมส่งต่อ</h3>
                  <p className="dms-modal-subtitle">
                    รายการเอกสารจากคลังหลัก (Document Management) ที่พร้อมส่งต่อให้บุคลากร &bull; ทั้งหมด {systemDocuments.length} รายการ
                  </p>
                </div>
              </div>
              <button className="dms-close-btn" onClick={handleCloseModal} aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>

            {/* Modal Search Toolbar */}
            <div className="dms-modal-toolbar">
              <div className="dms-modal-search-wrap">
                <svg className="dms-modal-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <input
                  type="text"
                  className="dms-modal-search-input"
                  placeholder="ค้นหาชื่อเรื่องเอกสาร, เลขที่อ้างอิง, ประเภท หรือผู้จัดทำ..."
                  value={modalSearchTerm}
                  onChange={e => setModalSearchTerm(e.target.value)}
                />
                {modalSearchTerm && (
                  <button type="button" className="dms-modal-search-clear" onClick={() => setModalSearchTerm('')}>✕</button>
                )}
              </div>
              <span className="dms-modal-count-badge">แสดง {filteredDocs.length} รายการ</span>
            </div>

            <div className="dms-modal-body dms-modal-scrollable">
              <div className="table-responsive">
                <table className="dms-master-table">
                  <thead>
                    <tr>
                      <th style={{ width: '150px' }}>เลขอ้างอิง / ID</th>
                      <th>ชื่อเรื่องเอกสาร</th>
                      <th style={{ width: '140px' }}>ประเภท</th>
                      <th style={{ width: '130px' }}>สถานะในคลัง</th>
                      <th style={{ width: '160px' }}>ผู้จัดทำ</th>
                      <th style={{ textAlign: 'center', width: '170px' }}>การดำเนินการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDocs.map(doc => (
                      <tr key={doc.id}>
                        <td>
                          <span className="doc-code-pill">{doc.external_doc_ref || `DOC-#${doc.id}`}</span>
                        </td>
                        <td>
                          <div className="doc-table-title-group">
                            <span className="doc-name-text font-bold">{doc.subject}</span>
                            {doc.description && <div className="doc-subtext">{doc.description}</div>}
                            {doc.file_url && <span className="doc-has-file-tag">📎 มีไฟล์แนบต้นฉบับ</span>}
                          </div>
                        </td>
                        <td>
                          <span className="doc-dept-text">{doc.doc_type || 'เอกสารทั่วไป'}</span>
                        </td>
                        <td>
                          <span className={`status-pill ${doc.status === 'approved' ? 'completed' : 'processing'}`}>
                            <span className="status-dot"></span>
                            {doc.status === 'approved' ? 'อนุมัติแล้ว' : 'รอตรวจสอบ'}
                          </span>
                        </td>
                        <td>
                          <div className="doc-creator-text">{doc.creator?.fullname || doc.creator?.username || 'ธุรการ'}</div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="dms-modal-action-forward-btn"
                            onClick={() => {
                              setSelectedSystemDocId(doc.id);
                              handleCloseModal();
                              setIsSendModalOpen(true);
                            }}
                          >
                            + ส่งต่อเอกสารนี้ ➔
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredDocs.length === 0 && (
                      <tr>
                        <td colSpan={6} className="no-data-cell">
                          <div className="no-data-content">
                            <div className="no-data-icon">📭</div>
                            <p>{modalSearchTerm ? `ไม่พบเอกสารที่ตรงกับ "${modalSearchTerm}"` : 'ไม่มีเอกสารในคลังระบบในขณะนี้'}</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="dms-modal-footer">
              <button className="dms-btn-secondary" onClick={handleCloseModal}>
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      );
    }

    // 2. Staff Directory / Recipients Modal
    if (activeMetricModal === 'recipients') {
      const allStaff = recipientsList.length > 0 ? recipientsList : [
        { id: 6, fullname: 'พญ.สุดา สุขสมบูรณ์', username: 'doctor1', role: 'doctor' },
        { id: 7, fullname: 'นพ.วิชัย ชาญการแพทย์', username: 'doctor2', role: 'doctor' },
        { id: 8, fullname: 'พญ.เกศรา รักษาดี', username: 'doctor3', role: 'doctor' },
        { id: 3, fullname: 'พว.กานดา คัดกรอง', username: 'nurse1', role: 'nurse' },
        { id: 4, fullname: 'พว.สมหญิง ดูแลดี', username: 'nurse2', role: 'nurse' },
        { id: 5, fullname: 'ภก.บุญชู เภสัชกร', username: 'pharmacist1', role: 'pharmacist' },
        { id: 9, fullname: 'นส.รวย การเงิน', username: 'cashier1', role: 'cashier' },
        { id: 2, fullname: 'คุณสมจิต ดีใจ', username: 'officer1', role: 'officer' },
      ];

      const filteredStaff = allStaff.filter(staff => {
        // Role filter
        if (modalRoleFilter !== 'all') {
          if (modalRoleFilter === 'doctor' && staff.role?.toLowerCase() !== 'doctor') return false;
          if (modalRoleFilter === 'nurse' && !staff.role?.toLowerCase().includes('nurse')) return false;
          if (modalRoleFilter === 'pharmacist' && staff.role?.toLowerCase() !== 'pharmacist') return false;
          if (modalRoleFilter === 'cashier' && staff.role?.toLowerCase() !== 'cashier') return false;
          if (modalRoleFilter === 'officer' && staff.role?.toLowerCase() !== 'officer' && staff.role?.toLowerCase() !== 'registrar') return false;
        }
        // Search term
        if (modalSearchTerm.trim()) {
          const q = modalSearchTerm.toLowerCase();
          const matchName = staff.fullname?.toLowerCase().includes(q);
          const matchUser = staff.username?.toLowerCase().includes(q);
          const matchRole = getRoleLabel(staff.role).toLowerCase().includes(q);
          if (!matchName && !matchUser && !matchRole) return false;
        }
        return true;
      });

      return (
        <div className="dms-modal-backdrop" onClick={handleCloseModal}>
          <div className="dms-modal-card dms-modal-wide" onClick={e => e.stopPropagation()}>
            <div className="dms-modal-header">
              <div className="dms-modal-title-group">
                <div className="dms-modal-icon-badge purple-badge">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                  </svg>
                </div>
                <div>
                  <h3 className="dms-modal-title">รายชื่อบุคลากรและแผนกปลายทาง</h3>
                  <p className="dms-modal-subtitle">
                    เลือกบุคลากรหรือแผนกที่ต้องการส่งต่อเอกสาร &bull; ทั้งหมด {allStaff.length} ท่าน
                  </p>
                </div>
              </div>
              <button className="dms-close-btn" onClick={handleCloseModal} aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>

            {/* Filter & Search Toolbar */}
            <div className="dms-modal-toolbar staff-toolbar">
              <div className="dms-modal-search-wrap">
                <svg className="dms-modal-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <input
                  type="text"
                  className="dms-modal-search-input"
                  placeholder="ค้นหาชื่อแพทย์, พยาบาล, เภสัชกร, เจ้าหน้าที่ หรือ username..."
                  value={modalSearchTerm}
                  onChange={e => setModalSearchTerm(e.target.value)}
                />
                {modalSearchTerm && (
                  <button type="button" className="dms-modal-search-clear" onClick={() => setModalSearchTerm('')}>✕</button>
                )}
              </div>

              {/* Role Filter Chips */}
              <div className="dms-modal-role-tabs">
                <button
                  type="button"
                  className={`dms-modal-role-chip ${modalRoleFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setModalRoleFilter('all')}
                >
                  ทั้งหมด ({allStaff.length})
                </button>
                <button
                  type="button"
                  className={`dms-modal-role-chip ${modalRoleFilter === 'doctor' ? 'active' : ''}`}
                  onClick={() => setModalRoleFilter('doctor')}
                >
                  🩺 แพทย์
                </button>
                <button
                  type="button"
                  className={`dms-modal-role-chip ${modalRoleFilter === 'nurse' ? 'active' : ''}`}
                  onClick={() => setModalRoleFilter('nurse')}
                >
                  💉 พยาบาล
                </button>
                <button
                  type="button"
                  className={`dms-modal-role-chip ${modalRoleFilter === 'pharmacist' ? 'active' : ''}`}
                  onClick={() => setModalRoleFilter('pharmacist')}
                >
                  💊 เภสัชกร
                </button>
                <button
                  type="button"
                  className={`dms-modal-role-chip ${modalRoleFilter === 'cashier' ? 'active' : ''}`}
                  onClick={() => setModalRoleFilter('cashier')}
                >
                  💰 การเงิน
                </button>
                <button
                  type="button"
                  className={`dms-modal-role-chip ${modalRoleFilter === 'officer' ? 'active' : ''}`}
                  onClick={() => setModalRoleFilter('officer')}
                >
                  📋 ธุรการ
                </button>
              </div>
            </div>

            <div className="dms-modal-body dms-modal-scrollable">
              {filteredStaff.length === 0 ? (
                <div className="dms-modal-empty-state">
                  <div className="empty-icon">👥</div>
                  <h4>ไม่พบบุคลากรที่ตรงกับเงื่อนไขการค้นหา</h4>
                  <p>กรุณาลองเปลี่ยนคำค้นหาหรือเลือกแผนกอื่น</p>
                </div>
              ) : (
                <div className="staff-grid-list">
                  {filteredStaff.map(staff => {
                    const theme = getRoleTheme(staff.role);
                    const avatarInitials = getStaffAvatarText(staff.fullname, staff.username);
                    return (
                      <div key={staff.id} className="staff-card-item">
                        <div className="staff-card-top">
                          <div
                            className="staff-avatar-box"
                            style={{ background: theme.gradient }}
                          >
                            {avatarInitials}
                          </div>
                          <div className="staff-info-box">
                            <h4 className="staff-name">{staff.fullname || staff.username}</h4>
                            <div className="staff-meta-row">
                              <span
                                className="staff-role-pill"
                                style={{
                                  backgroundColor: theme.bg,
                                  color: theme.color,
                                  borderColor: theme.border,
                                }}
                              >
                                {getRoleLabel(staff.role)}
                              </span>
                              <span className="staff-username-tag">@{staff.username}</span>
                            </div>
                          </div>
                        </div>

                        <div className="staff-card-bottom">
                          <button
                            type="button"
                            className="staff-forward-action-btn"
                            onClick={() => {
                              setNewDocRecipientId(staff.id);
                              handleCloseModal();
                              setIsSendModalOpen(true);
                            }}
                          >
                            <span>+ ส่งต่อเอกสารถึงท่านนี้</span>
                            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="dms-modal-footer">
              <button className="dms-btn-secondary" onClick={handleCloseModal}>
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      );
    }

    // 3. Pending / Completed / Today Modals
    let title = '';
    let subtitle = '';
    let dataList: ForwardDoc[] = [];

    if (activeMetricModal === 'pending') {
      title = `รายการส่งต่อที่รอดำเนินการ (${totalPendingCount} รายการ)`;
      subtitle = 'เอกสารที่ส่งต่อแล้วและอยู่ระหว่างรอปลายทางรับทราบ';
      dataList = forwardedDocs.filter(d => d.status === 'processing');
    } else if (activeMetricModal === 'completed') {
      title = `ส่งต่อและรับทราบสำเร็จ (${totalCompletedCount} รายการ)`;
      subtitle = 'รายการเอกสารที่ปลายทางรับทราบและประมวลผลเสร็จสิ้น';
      dataList = forwardedDocs.filter(d => d.status === 'completed');
    } else {
      title = `รายการเอกสารทั้งหมด`;
      subtitle = 'ประวัติการส่งต่อเอกสาร';
      dataList = forwardedDocs;
    }

    const filteredDataList = dataList.filter(d => {
      if (!modalSearchTerm.trim()) return true;
      const q = modalSearchTerm.toLowerCase();
      return (
        d.title?.toLowerCase().includes(q) ||
        d.id?.toLowerCase().includes(q) ||
        d.sender?.toLowerCase().includes(q) ||
        d.recipient?.toLowerCase().includes(q) ||
        d.type?.toLowerCase().includes(q)
      );
    });

    return (
      <div className="dms-modal-backdrop" onClick={handleCloseModal}>
        <div className="dms-modal-card dms-modal-wide" onClick={e => e.stopPropagation()}>
          <div className="dms-modal-header">
            <div className="dms-modal-title-group">
              <div className="dms-modal-icon-badge">
                <svg viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" width="22" height="22">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 02 2h12a2 2 0 0 02-2V8z" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M14 2v6h6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <h3 className="dms-modal-title">{title}</h3>
                <p className="dms-modal-subtitle">{subtitle}</p>
              </div>
            </div>
            <button className="dms-close-btn" onClick={handleCloseModal} aria-label="Close">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>

          {/* Search Toolbar */}
          <div className="dms-modal-toolbar">
            <div className="dms-modal-search-wrap">
              <svg className="dms-modal-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <input
                type="text"
                className="dms-modal-search-input"
                placeholder="ค้นหารหัสเอกสาร, ชื่อเรื่อง, ผู้ส่ง หรือผู้รับ..."
                value={modalSearchTerm}
                onChange={e => setModalSearchTerm(e.target.value)}
              />
              {modalSearchTerm && (
                <button type="button" className="dms-modal-search-clear" onClick={() => setModalSearchTerm('')}>✕</button>
              )}
            </div>
            <span className="dms-modal-count-badge">แสดง {filteredDataList.length} รายการ</span>
          </div>

          <div className="dms-modal-body dms-modal-scrollable">
            <div className="table-responsive">
              <table className="dms-master-table">
                <thead>
                  <tr>
                    <th style={{ width: '130px' }}>รหัสเอกสาร</th>
                    <th>ชื่อเอกสาร</th>
                    <th>{activeMetricModal === 'completed' ? 'ผู้รับมอบ' : 'ผู้ส่งมอบ'}</th>
                    <th style={{ width: '150px' }}>วันที่ส่งมอบ</th>
                    <th style={{ width: '140px' }}>สถานะ</th>
                    <th style={{ textAlign: 'center', width: '130px' }}>ดูรายละเอียด</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDataList.map(doc => (
                    <tr key={doc.id} className="dms-clickable-row" onClick={() => { handleCloseModal(); handleViewDetail(doc); }}>
                      <td className="doc-code-text">
                        <span className="doc-code-pill">{doc.id}</span>
                      </td>
                      <td>
                        <span className="doc-name-text font-bold">{doc.title}</span>
                        {doc.description && <div className="doc-subtext">{doc.description}</div>}
                      </td>
                      <td>
                        <span className="doc-dept-text font-semibold">{activeMetricModal === 'completed' ? (doc.recipient || doc.sender) : doc.sender}</span>
                      </td>
                      <td className="doc-date-text">{doc.receivedDate}</td>
                      <td>
                        <span className={`status-pill ${doc.status}`}>
                          <span className="status-dot"></span>
                          {doc.status === 'unread' && 'ยังไม่อ่าน'}
                          {doc.status === 'processing' && 'รอปลายทางรับทราบ'}
                          {doc.status === 'completed' && 'ได้รับแล้ว'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="dms-action-view-btn"
                          title="ดูรายละเอียดเอกสาร"
                          aria-label="ดูรายละเอียดเอกสาร"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCloseModal();
                            handleViewDetail(doc);
                          }}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeLinecap="round" strokeLinejoin="round"/>
                            <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredDataList.length === 0 && (
                    <tr>
                      <td colSpan={6} className="no-data-cell">
                        <div className="no-data-content">
                          <div className="no-data-icon">📭</div>
                          <p>{modalSearchTerm ? `ไม่พบข้อมูลที่ตรงกับ "${modalSearchTerm}"` : 'ไม่มีข้อมูลเอกสารในหมวดหมู่นี้'}</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="dms-modal-footer">
            <button className="dms-btn-secondary" onClick={handleCloseModal}>
              ปิดหน้าต่าง
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="forward-container">
      {/* 1. Page Header */}
      <div className="page-header-container">
        <div className="page-title-group">
          <div className="page-icon-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" width="24" height="24">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <div className="page-badge-label">ระบบบริหารจัดการเอกสาร DMS</div>
            <h1 className="page-main-title">ส่งต่อเอกสาร (Document Forwarding)</h1>
            <p className="page-sub-title">ระบบรับเข้าและส่งต่อเอกสาร บันทึกข้อความ ใบสั่งยา และผลตรวจระหว่างแผนกคลินิก</p>
          </div>
        </div>

        <div className="page-header-actions">
          <button
            type="button"
            className="dms-btn-secondary dms-sync-btn"
            onClick={() => {
              loadData();
              toast.success('อัปเดตข้อมูลเอกสารล่าสุดเรียบร้อยแล้ว');
            }}
            disabled={isLoading}
            title="รีเฟรชข้อมูลจาก Database"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              width="16"
              height="16"
              className={isLoading ? 'spinning-icon' : ''}
            >
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>ซิงค์ข้อมูล</span>
          </button>

          <button
            type="button"
            className="dms-btn-primary action-btn-send"
            onClick={() => setIsSendModalOpen(true)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span>ส่งต่อเอกสารใหม่</span>
          </button>
        </div>
      </div>

      {/* 2. Interactive Metrics Cards Grid */}
      <div className="dms-metrics-grid">
        <div
          className="dms-card metric-card interactive"
          onClick={() => setActiveMetricModal('system_docs')}
          title="คลิกเพื่อดูเอกสารทั้งหมดในระบบที่พร้อมส่งต่อ"
        >
          <div className="metric-icon-wrapper blue-bg">
            <svg viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" width="24" height="24">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 02 2h12a2 2 0 0 02-2V8z" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>
          </div>
          <div className="metric-info">
            <div className="metric-label-row">
              <span className="metric-label">เอกสารทั้งหมดในระบบ (พร้อมส่งต่อ)</span>
            </div>
            <span className="metric-value">{systemDocuments.length}</span>
            <span className="metric-subtext blue-text">
              คลิกเพื่อเลือกส่งต่อเอกสาร →
            </span>
          </div>
        </div>

        <div
          className="dms-card metric-card interactive"
          onClick={() => setActiveMetricModal('pending')}
          title="คลิกเพื่อดูรายการที่รอปลายทางรับทราบ"
        >
          <div className="metric-icon-wrapper amber-bg">
            <svg viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" width="24" height="24">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <div className="metric-info">
            <span className="metric-label">รอปลายทางรับทราบ</span>
            <span className="metric-value">{totalPendingCount}</span>
            <span className="metric-subtext amber-text">
              อยู่ระหว่างรอปลายทางรับมอบ →
            </span>
          </div>
        </div>

        <div
          className="dms-card metric-card interactive"
          onClick={() => setActiveMetricModal('completed')}
          title="คลิกเพื่อดูเอกสารที่ปลายทางได้รับแล้ว"
        >
          <div className="metric-icon-wrapper green-bg">
            <svg viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" width="24" height="24">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          <div className="metric-info">
            <span className="metric-label">ได้รับแล้ว (รับทราบสำเร็จ)</span>
            <span className="metric-value">{totalCompletedCount}</span>
            <span className="metric-subtext green-text">
              ปลายทางรับทราบเรียบร้อย →
            </span>
          </div>
        </div>

        <div
          className="dms-card metric-card interactive"
          onClick={() => setActiveMetricModal('recipients')}
          title="คลิกเพื่อดูรายชื่อบุคลากรและแผนก"
        >
          <div className="metric-icon-wrapper purple-bg">
            <svg viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" width="24" height="24">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </div>
          <div className="metric-info">
            <span className="metric-label">บุคลากรปลายทางในระบบ</span>
            <span className="metric-value">{recipientsList.length > 0 ? recipientsList.length : 8}</span>
            <span className="metric-subtext purple-text">
              ดูรายชื่อแผนกและผู้รับ →
            </span>
          </div>
        </div>
      </div>

      {/* 3. Main Master Card & Tabs */}
      <div className="dms-card forward-main-card">
        <div className="forward-tabs-bar">
          {/* Main Segmented Control */}
          <div className="forward-tab-buttons">
            <button
              type="button"
              className="forward-tab-btn active"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>เอกสารที่ส่งต่อแล้ว (Forwarded)</span>
              <span className="tab-counter-badge">{forwardedDocs.length}</span>
            </button>
          </div>

          {/* Filtering and Search Controls */}
          <div className="forward-filter-controls">
            {/* Status Filter Chips */}
            <div className="filter-chips-row">
              <button
                type="button"
                className={`filter-chip ${statusFilter === 'all' ? 'active' : ''}`}
                onClick={() => setStatusFilter('all')}
              >
                ทั้งหมด
              </button>
              <button
                type="button"
                className={`filter-chip ${statusFilter === 'processing' ? 'active' : ''}`}
                onClick={() => setStatusFilter('processing')}
              >
                รอปลายทางรับทราบ
              </button>
              <button
                type="button"
                className={`filter-chip ${statusFilter === 'completed' ? 'active' : ''}`}
                onClick={() => setStatusFilter('completed')}
              >
                ได้รับแล้ว
              </button>
            </div>

            {/* Priority Filter */}
            <select
              className="dms-select-filter"
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value as any)}
              title="กรองตามระดับความเร่งด่วน"
            >
              <option value="all">ความสำคัญ: ทั้งหมด</option>
              <option value="normal">ระดับ: ปกติ</option>
              <option value="urgent">ระดับ: ด่วน ⚡</option>
              <option value="emergency">ระดับ: ด่วนที่สุด 🚨</option>
            </select>

            {/* Search Input Bar */}
            <div className="search-input-wrapper">
              <svg viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" className="search-icon">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                placeholder="ค้นหาชื่อเอกสาร, รหัส, แผนก..."
                className="search-input-field"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => setSearchTerm('')}
                  aria-label="Clear Search"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                    <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Master Table */}
        <div className="table-responsive">
          <table className="dms-master-table">
            <thead>
              <tr>
                <th style={{ width: '140px' }}>รหัสเอกสาร</th>
                <th>ชื่อเรื่องเอกสาร</th>
                <th style={{ width: '220px' }}>ส่งถึง (ปลายทาง)</th>
                <th style={{ width: '170px' }}>วันที่และเวลา</th>
                <th style={{ width: '120px' }}>ประเภท</th>
                <th style={{ width: '100px' }}>ความเร่งด่วน</th>
                <th style={{ width: '140px' }}>สถานะ</th>
                <th style={{ width: '90px', textAlign: 'center' }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filteredList.map(doc => (
                <tr
                  key={doc.id}
                  className="dms-clickable-row"
                  onClick={() => handleViewDetail(doc)}
                >
                  {/* Document Code */}
                  <td className="doc-code-text">
                    <span className="code-pill">{doc.id}</span>
                  </td>

                  {/* Document Title (Clean, NO heavy description block) */}
                  <td>
                    <div className="doc-title-wrapper">
                      <span className="doc-name-text">{doc.title}</span>
                    </div>
                  </td>

                  {/* Sender / Recipient (Clean concise department/person name) */}
                  <td>
                    <span className="doc-dept-text">{doc.recipient || '-'}</span>
                  </td>

                  {/* Date & Time */}
                  <td className="doc-date-text">{doc.receivedDate}</td>

                  {/* Document Type */}
                  <td>
                    <span className="doc-type-tag">{doc.type}</span>
                  </td>

                  {/* Priority Tag */}
                  <td>
                    <span className={`priority-badge ${doc.priority}`}>
                      {doc.priority === 'emergency' && 'ด่วนที่สุด'}
                      {doc.priority === 'urgent' && 'ด่วน'}
                      {doc.priority === 'normal' && 'ปกติ'}
                    </span>
                  </td>

                  {/* Status Pill */}
                  <td>
                    <span className={`status-pill ${doc.status}`}>
                      <span className="status-dot"></span>
                      {doc.status === 'unread' && 'ยังไม่อ่าน'}
                      {doc.status === 'processing' && 'รอปลายทางรับทราบ'}
                      {doc.status === 'completed' && 'ได้รับแล้ว'}
                    </span>
                  </td>

                  {/* Action Buttons (Eye-only icon button) */}
                  <td style={{ textAlign: 'center' }}>
                    <div className="table-actions-cell" onClick={e => e.stopPropagation()}>
                      <button
                        type="button"
                        className="dms-action-view-btn"
                        onClick={() => handleViewDetail(doc)}
                        title="ดูรายละเอียดเอกสาร"
                        aria-label="ดูรายละเอียดเอกสาร"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeLinecap="round" strokeLinejoin="round"/>
                          <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>

                      <button
                        type="button"
                        className="dms-action-icon-btn delete-btn"
                        onClick={(e) => activeTab === 'forwarded' ? handleDeleteForward(doc, e) : handleDeleteIncoming(doc.id, e)}
                        title="ลบเอกสารนี้"
                        aria-label="ลบเอกสารนี้"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredList.length === 0 && (
                <tr>
                  <td colSpan={8} className="no-data-cell">
                    <div className="no-data-content">
                      <svg viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.5" width="48" height="48">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M14 2v6h6" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <p className="no-data-title">ไม่พบข้อมูลเอกสารที่ตรงกับเงื่อนไขการค้นหา</p>
                      <span className="no-data-subtitle">ลองปรับเปลี่ยนตัวกรอง หรือส่งต่อเอกสารใหม่เข้าสู่ระบบ</span>
                      {(searchTerm || statusFilter !== 'all' || priorityFilter !== 'all') && (
                        <button
                          type="button"
                          className="dms-btn-secondary dms-btn-small"
                          style={{ marginTop: '8px' }}
                          onClick={() => {
                            setSearchTerm('');
                            setStatusFilter('all');
                            setPriorityFilter('all');
                          }}
                        >
                          ล้างตัวกรองทั้งหมด
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Send Forward Modal */}
      {isSendModalOpen && (
        <div className="dms-modal-backdrop" onClick={() => !isSubmitting && setIsSendModalOpen(false)}>
          <div className="dms-modal-card dms-modal-send" onClick={e => e.stopPropagation()}>
            <div className="dms-modal-header">
              <div className="dms-modal-title-group">
                <div className="dms-modal-icon-badge">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" width="20" height="20">
                    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div>
                  <h3 className="dms-modal-title">ส่งต่อเอกสารจากคลังระบบ</h3>
                  <p className="dms-modal-subtitle">เลือกเอกสารที่มีในระบบเพื่อส่งมอบต่อให้บุคลากรหรือแผนกปลายทาง</p>
                </div>
              </div>
              <button
                className="dms-close-btn"
                onClick={() => !isSubmitting && setIsSendModalOpen(false)}
                aria-label="Close"
                disabled={isSubmitting}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>

            <form onSubmit={handleSendDocument}>
              <div className="dms-modal-body">
                {/* Check if system documents exist */}
                {systemDocuments.length === 0 ? (
                  <div className="dms-empty-system-notice">
                    <div className="empty-notice-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" width="24" height="24">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                      </svg>
                    </div>
                    <div className="empty-notice-text">
                      <div className="notice-title">ยังไม่มีเอกสารในคลังระบบที่พร้อมส่งต่อ</div>
                      <div className="notice-sub">กรุณาเพิ่มหรืออัปโหลดเอกสารใหม่ในหน้า <strong>"จัดการเอกสาร (Document Management)"</strong> ก่อน จึงจะสามารถเลือกส่งต่อได้</div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Document Selector */}
                    <div className="dms-form-group">
                      <label className="dms-form-label">
                        เลือกเอกสารในระบบที่ต้องการส่งต่อ <span className="text-required">*</span>
                      </label>
                      <select
                        className="dms-form-input"
                        value={selectedSystemDocId}
                        required
                        onChange={e => setSelectedSystemDocId(e.target.value ? Number(e.target.value) : '')}
                      >
                        <option value="">-- กรุณาเลือกเอกสารจากคลัง ({systemDocuments.length} รายการ) --</option>
                        {systemDocuments.map(doc => (
                          <option key={doc.id} value={doc.id}>
                            [{doc.external_doc_ref || `DOC-#${doc.id}`}] {doc.subject} ({doc.doc_type || 'ทั่วไป'})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Selected Document Info Preview Card */}
                    {selectedDocPreview && (
                      <div className="selected-doc-preview-card">
                        <div className="preview-header">
                          <span className="code-pill">{selectedDocPreview.external_doc_ref || `DOC-#${selectedDocPreview.id}`}</span>
                          <span className="doc-type-tag">{selectedDocPreview.doc_type || 'เอกสารทั่วไป'}</span>
                        </div>
                        <div className="preview-title">{selectedDocPreview.subject}</div>
                        {selectedDocPreview.description && (
                          <div className="preview-desc">{selectedDocPreview.description}</div>
                        )}
                        <div className="preview-meta">
                          <span>ผู้จัดทำ: {selectedDocPreview.creator?.fullname || selectedDocPreview.creator?.username || 'ธุรการ'}</span>
                          {selectedDocPreview.file_url && (
                            <span className="has-file-badge">📎 มีไฟล์แนบต้นฉบับ</span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Recipient Dropdown */}
                    <div className="dms-form-group">
                      <label className="dms-form-label">
                        บุคลากรหรือแผนกปลายทาง (ผู้รับ) <span className="text-required">*</span>
                      </label>
                      <select
                        className="dms-form-input"
                        value={newDocRecipientId}
                        onChange={e => setNewDocRecipientId(Number(e.target.value))}
                        required
                      >
                        {recipientsList.length > 0 ? (
                          recipientsList.map(u => (
                            <option key={u.id} value={u.id}>
                              {u.fullname || u.username} — {getRoleLabel(u.role)} (@{u.username})
                            </option>
                          ))
                        ) : (
                          <>
                            {/* ปรับชื่อตาม DEMO_USERS อัตโนมัติ (Fallback) */}
                            <option value="6">{DEMO_USERS.doctor?.fullName || 'พญ.สุดา สุขสมบูรณ์'} — แพทย์ (doctor1)</option>
                            <option value="7">นพ.วิชัย ชาญการแพทย์ — แพทย์ (doctor2)</option>
                            <option value="8">พญ.เกศรา รักษาดี — แพทย์ (doctor3)</option>
                            <option value="3">{DEMO_USERS.nurse?.fullName || 'พว. กานดา คัดกรอง'} — พยาบาล (nurse1)</option>
                            <option value="5">{DEMO_USERS.pharmacist?.fullName || 'ดร.บุญ สั่งยา'} — ห้องยา/เภสัชกร (pharmacist1)</option>
                            <option value="9">{DEMO_USERS.cashier?.fullName || 'นส.รวย การเงิน'} — การเงิน (cashier1)</option>
                            <option value="2">{DEMO_USERS.officer?.fullName || 'คุณสมจิต ดีใจ'} — ธุรการ (officer1)</option>
                          </>
                        )}
                      </select>
                    </div>

                    {/* Priority */}
                    <div className="dms-form-group">
                      <label className="dms-form-label">ระดับความเร่งด่วน</label>
                      <select
                        className="dms-form-input"
                        value={newDocPriority}
                        onChange={e => setNewDocPriority(e.target.value as any)}
                      >
                        <option value="normal">ปกติ (Normal)</option>
                        <option value="urgent">ด่วน (Urgent ⚡)</option>
                        <option value="emergency">ด่วนที่สุด (Emergency 🚨)</option>
                      </select>
                    </div>

                    {/* Description & Note */}
                    <div className="dms-form-group">
                      <label className="dms-form-label">
                        บันทึกข้อความ / คำสั่งเพิ่มเติมถึงผู้รับ (ไม่บังคับ)
                      </label>
                      <textarea
                        className="dms-form-textarea"
                        rows={3}
                        placeholder="ระบุข้อความคำสั่ง บันทึกส่งมอบ หรือรายละเอียดเพิ่มเติม..."
                        value={newDocDescription}
                        onChange={e => setNewDocDescription(e.target.value)}
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="dms-modal-footer">
                <button
                  type="button"
                  className="dms-btn-secondary"
                  onClick={() => setIsSendModalOpen(false)}
                  disabled={isSubmitting}
                >
                  ยกเลิก
                </button>
                {systemDocuments.length > 0 && (
                  <button
                    type="submit"
                    className="dms-btn-primary"
                    disabled={isSubmitting || !selectedSystemDocId}
                  >
                    {isSubmitting ? (
                      <span>กำลังส่งต่อ...</span>
                    ) : (
                      <>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                          <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <span>ยืนยันการส่งต่อเอกสาร</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Detail & Status Modal (Sender Audit View) */}
      {isDetailModalOpen && selectedDoc && (
        <div className="dms-modal-backdrop" onClick={() => setIsDetailModalOpen(false)}>
          <div className="dms-modal-card dms-modal-detail" onClick={e => e.stopPropagation()}>
            <div className="dms-modal-header">
              <div className="dms-modal-title-group">
                <div className="dms-modal-icon-badge">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" width="20" height="20">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 02 2h12a2 2 0 0 02-2V8z" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M14 2v6h6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div>
                  <div className="modal-title-top-tag">
                    <span className="code-pill">{selectedDoc.id}</span>
                    <span className={`priority-badge ${selectedDoc.priority}`}>
                      {selectedDoc.priority === 'emergency' && 'ด่วนที่สุด'}
                      {selectedDoc.priority === 'urgent' && 'ด่วน'}
                      {selectedDoc.priority === 'normal' && 'ปกติ'}
                    </span>
                    <span className={`status-pill ${selectedDoc.status}`}>
                      <span className="status-dot"></span>
                      {selectedDoc.status === 'completed' ? 'ได้รับแล้ว' : 'รอปลายทางรับทราบ'}
                    </span>
                  </div>
                  <h3 className="dms-modal-title">{selectedDoc.title}</h3>
                </div>
              </div>
              <button className="dms-close-btn" onClick={() => setIsDetailModalOpen(false)} aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>

            <div className="dms-modal-body dms-modal-scrollable">
              {/* Delivery Overview Route Box */}
              <div className="detail-route-card">
                <div className="route-person-box">
                  <span className="route-role-label">ต้นทาง (ผู้ส่งมอบ)</span>
                  <div className="route-person-name">{selectedDoc.sender}</div>
                  <span className="route-sub-badge">{selectedDoc.senderRole || 'เจ้าหน้าที่'}</span>
                </div>

                <div className="route-arrow-box">
                  <div className="route-line"></div>
                  <div className="route-arrow-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" width="18" height="18">
                      <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>

                <div className="route-person-box">
                  <span className="route-role-label">ปลายทาง (ผู้รับมอบ)</span>
                  <div className="route-person-name">{selectedDoc.recipient || 'เจ้าหน้าที่ธุรการ'}</div>
                  <span className="route-sub-badge">{selectedDoc.recipientRole || 'ผู้รับ'}</span>
                </div>
              </div>

              {/* Status Timeline */}
              <div className="detail-timeline-section">
                <h4 className="detail-section-heading">สถานะการส่งต่อ (Timeline)</h4>
                <div className="timeline-steps-container">
                  <div className="timeline-step done">
                    <div className="timeline-step-circle">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    </div>
                    <div className="timeline-step-content">
                      <div className="step-title">สร้างรายการและส่งต่อ</div>
                      <div className="step-time">{selectedDoc.receivedDate}</div>
                    </div>
                  </div>

                  <div className={`timeline-step ${selectedDoc.status !== 'unread' ? 'done' : 'active'}`}>
                    <div className="timeline-step-circle">
                      {selectedDoc.status !== 'unread' ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      ) : (
                        <span className="step-pulse-dot"></span>
                      )}
                    </div>
                    <div className="timeline-step-content">
                      <div className="step-title">เข้าสู่กล่องข้อความปลายทาง</div>
                      <div className="step-time">{selectedDoc.status === 'unread' ? 'รอเปิดอ่าน' : 'เปิดอ่านแล้ว'}</div>
                    </div>
                  </div>

                  <div className={`timeline-step ${selectedDoc.status === 'completed' ? 'done' : ''}`}>
                    <div className="timeline-step-circle">
                      {selectedDoc.status === 'completed' ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      ) : (
                        <span>3</span>
                      )}
                    </div>
                    <div className="timeline-step-content">
                      <div className="step-title">
                        {selectedDoc.status === 'completed' ? 'ปลายทางรับทราบแล้ว (ได้รับแล้ว)' : 'รอการตอบรับจากปลายทาง'}
                      </div>
                      <div className="step-time">
                        {selectedDoc.status === 'completed'
                          ? (selectedDoc.acknowledgedAt ? formatThaiDate(new Date(selectedDoc.acknowledgedAt)) : 'ได้รับและรับทราบเรียบร้อยแล้ว')
                          : 'อยู่ระหว่างรอปลายทางรับมอบและกดยืนยัน'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Information Grid */}
              <div className="detail-info-grid">
                <div className="detail-info-item">
                  <span className="info-item-label">ประเภทเอกสาร:</span>
                  <span className="info-item-value">
                    <span className="doc-type-tag">{selectedDoc.type}</span>
                  </span>
                </div>

                <div className="detail-info-item">
                  <span className="info-item-label">วันเวลาที่ส่งมอบ:</span>
                  <span className="info-item-value">{selectedDoc.receivedDate}</span>
                </div>

                <div className="detail-info-item full-width">
                  <span className="info-item-label">บันทึกข้อความ / รายละเอียด:</span>
                  <div className="info-item-desc-box">
                    {selectedDoc.description || 'ไม่มีบันทึกข้อความเพิ่มเติม'}
                  </div>
                </div>

                {selectedDoc.fileUrl && (
                  <div className="detail-info-item full-width">
                    <span className="info-item-label">ไฟล์แนบ:</span>
                    <a
                      href={selectedDoc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="dms-file-download-link"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span>เปิดดูเอกสารแนบต้นฉบับ</span>
                    </a>
                  </div>
                )}
              </div>
            </div>

            <div className="dms-modal-footer detail-modal-footer">
              <div className="footer-left-buttons">
                <button
                  type="button"
                  className="dms-btn-secondary"
                  onClick={() => handlePrintSlip(selectedDoc)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                    <polyline points="6 9 6 2 18 2 18 9"></polyline>
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                    <rect x="6" y="14" width="12" height="8"></rect>
                  </svg>
                  <span>พิมพ์ใบนำส่ง</span>
                </button>
                <button
                  type="button"
                  className="dms-btn-danger"
                  onClick={(e) => activeTab === 'forwarded' || selectedDoc.forwardId ? handleDeleteForward(selectedDoc, e) : handleDeleteIncoming(selectedDoc.id, e)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                  <span>ลบเอกสารนี้</span>
                </button>
              </div>

              <div className="footer-right-buttons">
                <button
                  type="button"
                  className="dms-btn-primary"
                  onClick={() => setIsDetailModalOpen(false)}
                >
                  ปิดหน้าต่าง
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Metric List Modals */}
      {renderMetricModal()}
    </div>
  );
};

export default DocumentForwardPage;
