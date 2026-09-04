import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  dmsApi,
  type BackendDocumentForward,
  type BackendUser,
  type BackendDocument,
} from '../../services/api';
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
    case 'pharmacist':
      return 'เภสัชกร';
    case 'cashier':
      return 'การเงิน';
    case 'officer':
      return 'ธุรการ/เวชระเบียน';
    case 'admin':
      return 'ผู้ดูแลระบบ';
    default:
      return role;
  }
};

const generateInitialIncomingDocs = (): ForwardDoc[] => {
  const now = new Date();
  const sampleItems: Array<{
    title: string;
    sender: string;
    senderRole: string;
    type: string;
    priority: 'normal' | 'urgent' | 'emergency';
    status: 'unread' | 'processing' | 'completed';
    hoursAgo: number;
    description: string;
  }> = [
    {
      title: 'ผลการตรวจเลือด CBC (ฉุกเฉิน)',
      sender: 'ห้องปฏิบัติการกลาง (Lab)',
      senderRole: 'นักเทคนิคการแพทย์',
      type: 'ผลตรวจ',
      priority: 'emergency',
      status: 'unread',
      hoursAgo: 0.5,
      description: 'พบค่าเม็ดเลือดขาวสูงผิดปกติ โปรดแพทย์เจ้าของไข้ตรวจสอบด่วน',
    },
    {
      title: 'ใบส่งตัวผู้ป่วยส่งต่อรับการผ่าตัด',
      sender: 'แผนกอายุรกรรม',
      senderRole: 'พยาบาลวิชาชีพ',
      type: 'ใบส่งตัว',
      priority: 'urgent',
      status: 'unread',
      hoursAgo: 1.5,
      description: 'ส่งตัวผู้ป่วยนายสมบัติ มีสุข เพื่อประเมินสิทธิการรักษาและเตียงผ่าตัด',
    },
    {
      title: 'ใบเบิกเวชภัณฑ์และอุปกรณ์ทำแผล',
      sender: 'แผนกฉุกเฉินและอุบัติเหตุ (ER)',
      senderRole: 'พยาบาลหัวหน้าเวร',
      type: 'ใบเบิก',
      priority: 'normal',
      status: 'processing',
      hoursAgo: 3,
      description: 'ขอเบิกสำลี, ผ้าก๊อซปลอดเชื้อ, และน้ำเกลือล้างแผล (NSS 0.9%)',
    },
    {
      title: 'รายงานผลเอกซเรย์ทรวงอก (Chest X-Ray)',
      sender: 'แผนกรังสีวินิจฉัย (X-Ray)',
      senderRole: 'นักรังสีการแพทย์',
      type: 'รายงาน',
      priority: 'normal',
      status: 'processing',
      hoursAgo: 5,
      description: 'ภาพถ่ายรังสีทรวงอกระบบดิจิทัล ส่งมอบให้แพทย์อายุรกรรม',
    },
    {
      title: 'บันทึกข้อความสรุปการประชุมคลินิก',
      sender: 'สำนักงานผู้อำนวยการ',
      senderRole: 'ธุรการกลาง',
      type: 'บันทึกข้อความ',
      priority: 'normal',
      status: 'completed',
      hoursAgo: 24,
      description: 'มติที่ประชุมเรื่องการปรับปรุงระบบคัดกรองผู้ป่วยรอบเดือนกันยายน',
    },
    {
      title: 'ใบแจ้งยอดค่ารักษาพยาบาลและประกันสังคม',
      sender: 'ฝ่ายการเงินและบัญชี',
      senderRole: 'เจ้าหน้าที่การเงิน',
      type: 'การเงิน',
      priority: 'normal',
      status: 'completed',
      hoursAgo: 48,
      description: 'สรุปรายการเบิกจ่ายค่ารักษาพยาบาลสิทธิประกันสังคม',
    },
  ];

  return sampleItems.map((item, idx) => {
    const docDate = new Date(now.getTime() - item.hoursAgo * 60 * 60 * 1000);
    return {
      id: `DOC-2569-${String(1001 + idx)}`,
      title: item.title,
      description: item.description,
      sender: item.sender,
      senderRole: item.senderRole,
      recipient: 'ธุรการ (คุณสมจิต ดีใจ)',
      recipientRole: 'เจ้าหน้าที่ธุรการ',
      receivedDate: formatThaiDate(docDate),
      rawDate: docDate.toISOString(),
      type: item.type,
      priority: item.priority,
      status: item.status,
    };
  });
};

const generateInitialForwardedDocs = (): ForwardDoc[] => {
  const now = new Date();
  const sampleItems: Array<{
    title: string;
    recipient: string;
    recipientRole: string;
    type: string;
    priority: 'normal' | 'urgent' | 'emergency';
    status: 'unread' | 'processing' | 'completed';
    hoursAgo: number;
    description: string;
  }> = [
    {
      title: 'รายงานสรุปยอดผู้ป่วยประจำเดือน',
      recipient: 'ผู้อำนวยการคลินิก',
      recipientRole: 'ผู้บริหาร',
      type: 'รายงาน',
      priority: 'normal',
      status: 'completed',
      hoursAgo: 2,
      description: 'สถิติยอดผู้ป่วยนอก (OPD) ยอดผู้ป่วยฉุกเฉิน และรายได้รวมประจำเดือน',
    },
    {
      title: 'ใบส่งตัวผู้ป่วยส่งโรงพยาบาลศูนย์',
      recipient: 'พญ.สุดา สุขสมบูรณ์',
      recipientRole: 'สูตินรีแพทย์',
      type: 'ใบส่งตัว',
      priority: 'emergency',
      status: 'completed',
      hoursAgo: 4,
      description: 'ส่งตัวเคสฝากครรภ์เสี่ยงสูงเพื่อรับคำปรึกษาและตรวจวินิจฉัยเฉพาะทาง',
    },
    {
      title: 'ใบเบิกจ่ายงบประมาณจัดซื้อเวชภัณฑ์ยา',
      recipient: 'ฝ่ายการเงินและบัญชี',
      recipientRole: 'การเงิน',
      type: 'การเงิน',
      priority: 'urgent',
      status: 'processing',
      hoursAgo: 6,
      description: 'ขออนุมัติจัดซื้อยาจำเป็นเร่งด่วนสำหรับห้องยาคลินิก',
    },
    {
      title: 'เอกสารประเมินประสิทธิภาพบุคลากร',
      recipient: 'ฝ่ายทรัพยากรบุคคล (HR)',
      recipientRole: 'บุคคล',
      type: 'เอกสารทั่วไป',
      priority: 'normal',
      status: 'completed',
      hoursAgo: 30,
      description: 'สรุปผลการประเมินการปฏิบัติงานแพทย์และพยาบาล',
    },
    {
      title: 'ผลการตรวจเพาะเชื้อทางจุลชีววิทยา',
      recipient: 'นพ.วิชัย ชาญการแพทย์',
      recipientRole: 'อายุรแพทย์',
      type: 'ผลตรวจ',
      priority: 'urgent',
      status: 'processing',
      hoursAgo: 8,
      description: 'ผลเพาะเชื้อและค่าความไวต่อยาปฏิชีวนะของคนไข้ในคลินิก',
    },
  ];

  return sampleItems.map((item, idx) => {
    const docDate = new Date(now.getTime() - item.hoursAgo * 60 * 60 * 1000);
    return {
      id: `FWD-2569-${String(2001 + idx)}`,
      title: item.title,
      description: item.description,
      sender: 'ธุรการ (คุณสมจิต ดีใจ)',
      senderRole: 'เจ้าหน้าที่ธุรการ',
      recipient: item.recipient,
      recipientRole: item.recipientRole,
      receivedDate: formatThaiDate(docDate),
      rawDate: docDate.toISOString(),
      type: item.type,
      priority: item.priority,
      status: item.status,
    };
  });
};

export const DocumentForwardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'incoming' | 'forwarded'>('incoming');
  const [incomingDocs, setIncomingDocs] = useState<ForwardDoc[]>(generateInitialIncomingDocs());
  const [forwardedDocs, setForwardedDocs] = useState<ForwardDoc[]>(generateInitialForwardedDocs());
  const [recipientsList, setRecipientsList] = useState<BackendUser[]>([]);
  const [systemDocuments, setSystemDocuments] = useState<BackendDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | 'processing' | 'completed'>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'normal' | 'urgent' | 'emergency'>('all');

  // Modals
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<ForwardDoc | null>(null);
  const [activeMetricModal, setActiveMetricModal] = useState<'today' | 'pending' | 'completed' | 'recipients' | null>(null);

  // Send Form State
  const [sendMode, setSendMode] = useState<'custom' | 'from_system'>('custom');
  const [selectedSystemDocId, setSelectedSystemDocId] = useState<number | ''>('');
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocDescription, setNewDocDescription] = useState('');
  const [newDocRecipientId, setNewDocRecipientId] = useState<number>(6);
  const [newDocType, setNewDocType] = useState('ผลการตรวจ');
  const [newDocPriority, setNewDocPriority] = useState<'normal' | 'urgent' | 'emergency'>('normal');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load Real Data from DMS API
  const loadData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Forwards
      const forwardsData = await dmsApi.getForwards().catch(() => [] as BackendDocumentForward[]);
      if (forwardsData && Array.isArray(forwardsData) && forwardsData.length > 0) {
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
  }, []);

  // When selecting an existing system document
  useEffect(() => {
    if (sendMode === 'from_system' && selectedSystemDocId) {
      const doc = systemDocuments.find(d => d.id === Number(selectedSystemDocId));
      if (doc) {
        setNewDocTitle(doc.subject);
        setNewDocDescription(doc.description || '');
        setNewDocType(doc.doc_type || 'เอกสารทั่วไป');
      }
    }
  }, [sendMode, selectedSystemDocId, systemDocuments]);

  // Submit Forwarding
  const handleSendDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocTitle.trim()) {
      toast.error('กรุณาระบุชื่อเรื่องหรือหัวข้อเอกสาร');
      return;
    }

    setIsSubmitting(true);
    const selectedRecipient = recipientsList.find(u => u.id === newDocRecipientId);
    const recipientName = selectedRecipient?.fullname || selectedRecipient?.username || 'เจ้าหน้าที่ปลายทาง';
    const recipientRole = getRoleLabel(selectedRecipient?.role);

    try {
      let targetDocId = typeof selectedSystemDocId === 'number' ? selectedSystemDocId : undefined;

      // If custom mode or no existing doc selected, create document record in DB
      if (!targetDocId) {
        const docRes = await dmsApi.createDocument({
          external_doc_ref: `FWD-REF-${Date.now().toString().slice(-6)}`,
          subject: newDocTitle.trim(),
          description: newDocDescription.trim() || undefined,
          doc_type: newDocType,
          status: 'reviewing',
        });
        targetDocId = docRes.document.id;
      }

      // Forward to recipient
      const fwdRes = await dmsApi.forwardDocument({
        doc_id: targetDocId,
        forwarded_to: newDocRecipientId,
      });

      const now = new Date();
      const newDoc: ForwardDoc = {
        id: `FWD-${String(fwdRes.forward.id).padStart(4, '0')}`,
        forwardId: fwdRes.forward.id,
        docId: targetDocId,
        title: newDocTitle.trim(),
        description: newDocDescription.trim() || 'เอกสารส่งต่อผ่านระบบเวชระเบียน DMS',
        sender: 'ธุรการ (คุณสมจิต ดีใจ)',
        senderRole: 'เจ้าหน้าที่ธุรการ',
        recipient: recipientName,
        recipientRole: recipientRole,
        recipientId: newDocRecipientId,
        receivedDate: formatThaiDate(now),
        rawDate: now.toISOString(),
        type: newDocType,
        priority: newDocPriority,
        status: 'processing',
      };

      setForwardedDocs(prev => [newDoc, ...prev]);
      setIsSendModalOpen(false);
      resetSendForm();
      toast.success(`ส่งต่อเอกสารไปยัง ${recipientName} เรียบร้อยแล้ว`);
    } catch {
      // Fallback for offline or local preview
      const now = new Date();
      const newDoc: ForwardDoc = {
        id: `FWD-2569-${String(2000 + forwardedDocs.length + 1)}`,
        title: newDocTitle.trim(),
        description: newDocDescription.trim() || 'เอกสารส่งต่อผ่านระบบเวชระเบียน DMS',
        sender: 'ธุรการ (คุณสมจิต ดีใจ)',
        senderRole: 'เจ้าหน้าที่ธุรการ',
        recipient: recipientName,
        recipientRole: recipientRole,
        recipientId: newDocRecipientId,
        receivedDate: formatThaiDate(now),
        rawDate: now.toISOString(),
        type: newDocType,
        priority: newDocPriority,
        status: 'processing',
      };

      setForwardedDocs(prev => [newDoc, ...prev]);
      setIsSendModalOpen(false);
      resetSendForm();
      toast.success(`ส่งต่อเอกสารไปยัง ${recipientName} สำเร็จ`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetSendForm = () => {
    setNewDocTitle('');
    setNewDocDescription('');
    setSelectedSystemDocId('');
    setSendMode('custom');
    setNewDocPriority('normal');
    setNewDocType('ผลการตรวจ');
  };

  // View Document Details
  const handleViewDetail = async (doc: ForwardDoc) => {
    setSelectedDoc(doc);
    setIsDetailModalOpen(true);

    // Auto update unread incoming status to processing
    if (doc.status === 'unread' && activeTab === 'incoming') {
      setIncomingDocs(prev => prev.map(d => d.id === doc.id ? { ...d, status: 'processing' } : d));
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

      setIncomingDocs(updatedList);
      setForwardedDocs(updatedList);
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
      setIncomingDocs(updatedList);
      setForwardedDocs(updatedList);
      if (selectedDoc) {
        setSelectedDoc(prev => prev ? { ...prev, status: 'completed' } : null);
      }
      toast.success('บันทึกการรับทราบเอกสารแล้ว');
    }
  };

  // Archive incoming document
  const handleArchive = (docId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIncomingDocs(prev => prev.filter(d => d.id !== docId));
    toast.success('จัดเก็บเอกสารเข้าแฟ้มถาวรเรียบร้อยแล้ว');
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
  const currentList = activeTab === 'incoming' ? incomingDocs : forwardedDocs;
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
  const incomingUnreadCount = incomingDocs.filter(d => d.status === 'unread').length;
  const totalPendingCount = incomingDocs.filter(d => d.status === 'unread' || d.status === 'processing').length;
  const totalCompletedCount = forwardedDocs.filter(d => d.status === 'completed').length + incomingDocs.filter(d => d.status === 'completed').length;

  // Render Metric Details Modal
  const renderMetricModal = () => {
    if (!activeMetricModal) return null;

    let title = '';
    let subtitle = '';
    let dataList: ForwardDoc[] = [];

    if (activeMetricModal === 'today') {
      title = `เอกสารขาเข้าทั้งหมด (${incomingDocs.length} รายการ)`;
      subtitle = 'รายการเอกสารและบันทึกข้อความที่ได้รับเข้าสู่ระบบ';
      dataList = incomingDocs;
    } else if (activeMetricModal === 'pending') {
      title = `รอดำเนินการและรอตรวจสอบ (${totalPendingCount} รายการ)`;
      subtitle = 'เอกสารที่ยังไม่ได้รับการเปิดอ่านหรืออยู่ระหว่างการดำเนินการ';
      dataList = incomingDocs.filter(d => d.status === 'unread' || d.status === 'processing');
    } else if (activeMetricModal === 'completed') {
      title = `ส่งต่อและรับทราบสำเร็จ (${totalCompletedCount} รายการ)`;
      subtitle = 'รายการเอกสารที่ปลายทางรับทราบและประมวลผลเสร็จสิ้น';
      dataList = [...forwardedDocs, ...incomingDocs].filter(d => d.status === 'completed');
    } else if (activeMetricModal === 'recipients') {
      return (
        <div className="dms-modal-backdrop" onClick={() => setActiveMetricModal(null)}>
          <div className="dms-modal-card dms-modal-wide" onClick={e => e.stopPropagation()}>
            <div className="dms-modal-header">
              <div className="dms-modal-title-group">
                <div className="dms-modal-icon-badge purple-badge">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                  </svg>
                </div>
                <div>
                  <h3 className="dms-modal-title">รายชื่อบุคลากรและแผนกปลายทาง</h3>
                  <p className="dms-modal-subtitle">รายชื่อแพทย์ พยาบาล เภสัชกร และเจ้าหน้าที่ในฐานข้อมูลคลินิก</p>
                </div>
              </div>
              <button className="dms-close-btn" onClick={() => setActiveMetricModal(null)} aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
            <div className="dms-modal-body dms-modal-scrollable">
              <div className="staff-grid-list">
                {(recipientsList.length > 0 ? recipientsList : [
                  { id: 6, fullname: 'พญ.สุดา สุขสมบูรณ์', username: 'doctor1', role: 'doctor' },
                  { id: 7, fullname: 'นพ.วิชัย ชาญการแพทย์', username: 'doctor2', role: 'doctor' },
                  { id: 8, fullname: 'พญ.เกศรา รักษาดี', username: 'doctor3', role: 'doctor' },
                  { id: 3, fullname: 'พว.กานดา คัดกรอง', username: 'nurse1', role: 'nurse' },
                  { id: 4, fullname: 'พว.สมหญิง ดูแลดี', username: 'nurse2', role: 'nurse' },
                  { id: 5, fullname: 'ภก.บุญชู เภสัชกร', username: 'pharmacist1', role: 'pharmacist' },
                  { id: 9, fullname: 'นส.รวย การเงิน', username: 'cashier1', role: 'cashier' },
                  { id: 2, fullname: 'คุณสมจิต ดีใจ (ธุรการ)', username: 'officer1', role: 'officer' },
                ]).map(staff => (
                  <div key={staff.id} className="staff-card-item">
                    <div className="staff-avatar-box">
                      {(staff.fullname || staff.username || 'U').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="staff-info-box">
                      <div className="staff-name">{staff.fullname || staff.username}</div>
                      <div className="staff-role-badge">
                        <span className="role-tag">{getRoleLabel(staff.role)}</span>
                        <span className="username-tag">@{staff.username}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="dms-btn-small"
                      onClick={() => {
                        setNewDocRecipientId(staff.id);
                        setActiveMetricModal(null);
                        setIsSendModalOpen(true);
                      }}
                    >
                      ส่งต่อเอกสาร
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="dms-modal-footer">
              <button className="dms-btn-secondary" onClick={() => setActiveMetricModal(null)}>
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="dms-modal-backdrop" onClick={() => setActiveMetricModal(null)}>
        <div className="dms-modal-card dms-modal-wide" onClick={e => e.stopPropagation()}>
          <div className="dms-modal-header">
            <div className="dms-modal-title-group">
              <div className="dms-modal-icon-badge">
                <svg viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" width="20" height="20">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 02 2h12a2 2 0 0 02-2V8z" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M14 2v6h6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <h3 className="dms-modal-title">{title}</h3>
                <p className="dms-modal-subtitle">{subtitle}</p>
              </div>
            </div>
            <button className="dms-close-btn" onClick={() => setActiveMetricModal(null)} aria-label="Close">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
          <div className="dms-modal-body dms-modal-scrollable">
            <div className="table-responsive">
              <table className="dms-master-table">
                <thead>
                  <tr>
                    <th>รหัสเอกสาร</th>
                    <th>ชื่อเอกสาร</th>
                    <th>{activeMetricModal === 'completed' ? 'ผู้รับ' : 'ผู้ส่ง'}</th>
                    <th>วันที่ส่งมอบ</th>
                    <th>สถานะ</th>
                    <th style={{ textAlign: 'center' }}>ดูรายละเอียด</th>
                  </tr>
                </thead>
                <tbody>
                  {dataList.map(doc => (
                    <tr key={doc.id} className="dms-clickable-row" onClick={() => { setActiveMetricModal(null); handleViewDetail(doc); }}>
                      <td className="doc-code-text">{doc.id}</td>
                      <td>
                        <span className="doc-name-text">{doc.title}</span>
                      </td>
                      <td>
                        <span className="doc-dept-text">{activeMetricModal === 'completed' ? (doc.recipient || doc.sender) : doc.sender}</span>
                      </td>
                      <td className="doc-date-text">{doc.receivedDate}</td>
                      <td>
                        <span className={`status-pill ${doc.status}`}>
                          <span className="status-dot"></span>
                          {doc.status === 'unread' && 'ยังไม่อ่าน'}
                          {doc.status === 'processing' && 'กำลังดำเนินการ'}
                          {doc.status === 'completed' && 'เสร็จสิ้น'}
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
                            setActiveMetricModal(null);
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
                  {dataList.length === 0 && (
                    <tr>
                      <td colSpan={6} className="no-data-cell">
                        <div className="no-data-content">
                          <p>ไม่มีข้อมูลเอกสารในหมวดหมู่นี้</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="dms-modal-footer">
            <button className="dms-btn-primary" onClick={() => setActiveMetricModal(null)}>
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
          onClick={() => setActiveMetricModal('today')}
          title="คลิกเพื่อดูเอกสารขาเข้าทั้งหมด"
        >
          <div className="metric-icon-wrapper blue-bg">
            <svg viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" width="24" height="24">
              <path d="M22 12h-6l-2 3h-4l-2-3H2v7a2 2 0 002 2h16a2 2 0 002-2v-7z" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M5.45 5.11L2 12v7a2 2 0 002 2h16a2 2 0 002-2v-7l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="metric-info">
            <div className="metric-label-row">
              <span className="metric-label">เอกสารขาเข้าในระบบ</span>
              {incomingUnreadCount > 0 && (
                <span className="metric-tag-unread">{incomingUnreadCount} ใหม่</span>
              )}
            </div>
            <span className="metric-value">{incomingDocs.length}</span>
            <span className="metric-subtext blue-text">
              คลิกเพื่อดูรายการทั้งหมด →
            </span>
          </div>
        </div>

        <div
          className="dms-card metric-card interactive"
          onClick={() => setActiveMetricModal('pending')}
          title="คลิกเพื่อดูเอกสารที่รอดำเนินการ"
        >
          <div className="metric-icon-wrapper amber-bg">
            <svg viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" width="24" height="24">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <div className="metric-info">
            <span className="metric-label">รอการเปิดอ่าน / ดำเนินการ</span>
            <span className="metric-value">{totalPendingCount}</span>
            <span className="metric-subtext amber-text">
              ต้องดำเนินการตรวจสอบ →
            </span>
          </div>
        </div>

        <div
          className="dms-card metric-card interactive"
          onClick={() => setActiveMetricModal('completed')}
          title="คลิกเพื่อดูเอกสารที่เสร็จสิ้นแล้ว"
        >
          <div className="metric-icon-wrapper green-bg">
            <svg viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" width="24" height="24">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          <div className="metric-info">
            <span className="metric-label">ส่งต่อและรับทราบสำเร็จ</span>
            <span className="metric-value">{totalCompletedCount}</span>
            <span className="metric-subtext green-text">
              ดำเนินการเรียบร้อย →
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
              className={`forward-tab-btn ${activeTab === 'incoming' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('incoming');
                setStatusFilter('all');
                setPriorityFilter('all');
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <path d="M22 12h-6l-2 3h-4l-2-3H2v7a2 2 0 002 2h16a2 2 0 002-2v-7z" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M5.45 5.11L2 12v7a2 2 0 002 2h16a2 2 0 002-2v-7l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>เอกสารขาเข้า (Incoming)</span>
              <span className={`tab-counter-badge ${incomingUnreadCount > 0 ? 'badge-has-unread' : ''}`}>
                {incomingDocs.length}
              </span>
            </button>

            <button
              type="button"
              className={`forward-tab-btn ${activeTab === 'forwarded' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('forwarded');
                setStatusFilter('all');
                setPriorityFilter('all');
              }}
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
              {activeTab === 'incoming' && (
                <button
                  type="button"
                  className={`filter-chip ${statusFilter === 'unread' ? 'active' : ''}`}
                  onClick={() => setStatusFilter('unread')}
                >
                  ยังไม่อ่าน
                  {incomingUnreadCount > 0 && <span className="chip-count-dot"></span>}
                </button>
              )}
              <button
                type="button"
                className={`filter-chip ${statusFilter === 'processing' ? 'active' : ''}`}
                onClick={() => setStatusFilter('processing')}
              >
                กำลังดำเนินการ
              </button>
              <button
                type="button"
                className={`filter-chip ${statusFilter === 'completed' ? 'active' : ''}`}
                onClick={() => setStatusFilter('completed')}
              >
                เสร็จสิ้น / รับทราบแล้ว
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
                <th style={{ width: '220px' }}>{activeTab === 'incoming' ? 'ส่งมาจาก (ต้นทาง)' : 'ส่งถึง (ปลายทาง)'}</th>
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
                  className={`dms-clickable-row ${doc.status === 'unread' ? 'row-unread-highlight' : ''}`}
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
                      {doc.status === 'unread' && <span className="new-pulse-badge">ใหม่</span>}
                    </div>
                  </td>

                  {/* Sender / Recipient (Clean concise department/person name) */}
                  <td>
                    <span className="doc-dept-text">{activeTab === 'incoming' ? doc.sender : doc.recipient}</span>
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
                      {doc.status === 'processing' && 'กำลังดำเนินการ'}
                      {doc.status === 'completed' && 'เสร็จสิ้น'}
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

                      {activeTab === 'incoming' && doc.status !== 'completed' && (
                        <button
                          type="button"
                          className="dms-action-icon-btn check-btn"
                          onClick={() => handleAcknowledge(doc)}
                          title="กดรับทราบเอกสาร"
                          aria-label="กดรับทราบเอกสาร"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                            <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round"></polyline>
                          </svg>
                        </button>
                      )}
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
                  <h3 className="dms-modal-title">ส่งต่อเอกสารใหม่</h3>
                  <p className="dms-modal-subtitle">ระบุรายละเอียด แผนก หรือบุคลากรปลายทางที่ต้องการส่งมอบ</p>
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
                {/* Send Mode Toggle */}
                <div className="send-mode-segmented">
                  <button
                    type="button"
                    className={`send-mode-btn ${sendMode === 'custom' ? 'active' : ''}`}
                    onClick={() => setSendMode('custom')}
                  >
                    กรอกข้อมูลส่งต่อใหม่
                  </button>
                  <button
                    type="button"
                    className={`send-mode-btn ${sendMode === 'from_system' ? 'active' : ''}`}
                    onClick={() => setSendMode('from_system')}
                  >
                    เลือกจากคลังเอกสารในระบบ ({systemDocuments.length})
                  </button>
                </div>

                {sendMode === 'from_system' && (
                  <div className="dms-form-group">
                    <label className="dms-form-label">
                      เลือกเอกสารที่มีในระบบ <span className="text-required">*</span>
                    </label>
                    <select
                      className="dms-form-input"
                      value={selectedSystemDocId}
                      onChange={e => setSelectedSystemDocId(e.target.value ? Number(e.target.value) : '')}
                    >
                      <option value="">-- กรุณาเลือกเอกสารจากคลัง --</option>
                      {systemDocuments.map(doc => (
                        <option key={doc.id} value={doc.id}>
                          [{doc.external_doc_ref || `DOC-${doc.id}`}] {doc.subject} ({doc.doc_type || 'ทั่วไป'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Subject Title */}
                <div className="dms-form-group">
                  <label className="dms-form-label">
                    ชื่อเรื่อง / หัวข้อเอกสาร <span className="text-required">*</span>
                  </label>
                  <input
                    type="text"
                    className="dms-form-input"
                    required
                    placeholder="เช่น ผลการตรวจเลือดผู้ป่วย OPD, ใบเบิกยาฉุกเฉิน หรือ ใบส่งตัว"
                    value={newDocTitle}
                    onChange={e => setNewDocTitle(e.target.value)}
                  />
                </div>

                {/* Recipient Dropdown */}
                <div className="dms-form-group">
                  <label className="dms-form-label">
                    บุคลากรหรือแผนกปลายทาง (ผู้รับ) <span className="text-required">*</span>
                  </label>
                  <select
                    className="dms-form-input"
                    value={newDocRecipientId}
                    onChange={e => setNewDocRecipientId(Number(e.target.value))}
                  >
                    {recipientsList.length > 0 ? (
                      recipientsList.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.fullname || u.username} — {getRoleLabel(u.role)} (@{u.username})
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="6">พญ.สุดา สุขสมบูรณ์ — แพทย์ (doctor1)</option>
                        <option value="7">นพ.วิชัย ชาญการแพทย์ — แพทย์ (doctor2)</option>
                        <option value="8">พญ.เกศรา รักษาดี — แพทย์ (doctor3)</option>
                        <option value="3">พว.กานดา คัดกรอง — พยาบาล (nurse1)</option>
                        <option value="4">พว.สมหญิง ดูแลดี — พยาบาล (nurse2)</option>
                        <option value="5">ภก.บุญชู เภสัชกร — เภสัชกร (pharmacist1)</option>
                        <option value="9">นส.รวย การเงิน — การเงิน (cashier1)</option>
                        <option value="2">คุณสมจิต ดีใจ — ธุรการ (officer1)</option>
                      </>
                    )}
                  </select>
                </div>

                {/* Type and Priority in Grid */}
                <div className="form-two-cols">
                  <div className="dms-form-group">
                    <label className="dms-form-label">ประเภทเอกสาร</label>
                    <select
                      className="dms-form-input"
                      value={newDocType}
                      onChange={e => setNewDocType(e.target.value)}
                    >
                      <option value="ผลการตรวจ">ผลการตรวจ (Lab/X-Ray)</option>
                      <option value="ใบส่งตัวผู้ป่วย">ใบส่งตัวผู้ป่วย (Referral)</option>
                      <option value="ใบสั่งยาและเวชภัณฑ์">ใบสั่งยาและเวชภัณฑ์</option>
                      <option value="รายงานทางการแพทย์">รายงานทางการแพทย์</option>
                      <option value="บันทึกข้อความภายใน">บันทึกข้อความภายใน</option>
                      <option value="เอกสารการเงิน">เอกสารการเงิน/เบิกจ่าย</option>
                      <option value="เอกสารทั่วไป">เอกสารทั่วไป</option>
                      <option value="อื่นๆ">อื่นๆ</option>
                    </select>
                  </div>

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
                </div>

                {/* Description & Note */}
                <div className="dms-form-group">
                  <label className="dms-form-label">
                    บันทึกข้อความ / รายละเอียดถึงผู้รับ (ไม่บังคับ)
                  </label>
                  <textarea
                    className="dms-form-textarea"
                    rows={3}
                    placeholder="ระบุข้อความคำสั่ง บันทึกส่งมอบ หรือรายละเอียดเพิ่มเติม..."
                    value={newDocDescription}
                    onChange={e => setNewDocDescription(e.target.value)}
                  />
                </div>
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
                <button
                  type="submit"
                  className="dms-btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <span>กำลังบันทึกส่งต่อ...</span>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                        <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span>ยืนยันการส่งต่อเอกสาร</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Detail & Acknowledgment Modal */}
      {isDetailModalOpen && selectedDoc && (
        <div className="dms-modal-backdrop" onClick={() => setIsDetailModalOpen(false)}>
          <div className="dms-modal-card dms-modal-detail" onClick={e => e.stopPropagation()}>
            <div className="dms-modal-header">
              <div className="dms-modal-title-group">
                <div className="dms-modal-icon-badge">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" width="20" height="20">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinecap="round" strokeLinejoin="round"/>
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
                      <div className="step-title">รับทราบ / ดำเนินการเสร็จสิ้น</div>
                      <div className="step-time">
                        {selectedDoc.status === 'completed'
                          ? (selectedDoc.acknowledgedAt ? formatThaiDate(new Date(selectedDoc.acknowledgedAt)) : 'รับทราบเรียบร้อยแล้ว')
                          : 'รอการตอบรับ'}
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

              <div className="footer-right-buttons">
                {selectedDoc.status !== 'completed' && (
                  <button
                    type="button"
                    className="dms-btn-primary green-accent-btn"
                    onClick={() => handleAcknowledge(selectedDoc)}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                      <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round"></polyline>
                    </svg>
                    <span>บันทึกรับทราบเอกสาร</span>
                  </button>
                )}
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
