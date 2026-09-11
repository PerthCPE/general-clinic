import './Topbar.css';
import { useState, useRef, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { useDoctorData } from '../../pages/doctor/DoctorDataContext';
import { matchPatientSearch } from '../../pages/doctor/utils/searchUtils';
import { displayVN } from '../../pages/doctor/utils/vnGenerator';
import { dmsApi } from '../../services/api';
import {
  type DocumentMessage,
  getDocumentMessagesForUser,
  markDocumentMessageAsRead,
  markAllDocumentMessagesAsRead,
  deleteDocumentMessage,
  clearAllDocumentMessages,
  acknowledgeDocumentMessage,
} from '../../services/documentMessageStorage';
import { useWebSocket } from '../../context/WebSocketContext';
import { getSharedAudioContext } from '../../utils/audioContext';
import ChangePasswordModal from '../ChangePasswordModal/ChangePasswordModal'; // เพิ่มใหม่
import { isTestAccountUsername } from '../../config/testAccounts';

interface TopbarProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onNavigate?: (page: string) => void;
}

interface NotificationItem {
  id: string;
  category: string;
  message: string;
  time: string;
  isUnread: boolean;
}

function Topbar({ isSidebarOpen, onToggleSidebar, isDarkMode, onToggleTheme, onNavigate }: TopbarProps) {
  const { currentUser, logout } = useAuth();
  const {
    patients: doctorPatients,
    recordPatients,
    refreshRecords,
    setSelectedRecordPatient,
  } = useDoctorData();
  const isDoctor = currentUser?.role === 'doctor';
  const isOurScope = ['registrar', 'nurse', 'nurse_assistant'].includes(currentUser?.role || '');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false); // เพิ่มใหม่
  const [isNoticeOpen, setIsNoticeOpen] = useState(false);
  const [isDocMessagesOpen, setIsDocMessagesOpen] = useState(false);
  const [docMessages, setDocMessages] = useState<DocumentMessage[]>(() => getDocumentMessagesForUser(currentUser));
  const [selectedDocMessageModal, setSelectedDocMessageModal] = useState<DocumentMessage | null>(null);
  const docMessageRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const [isSoundEnabled, setIsSoundEnabled] = useState<boolean>(() => {
    return localStorage.getItem('notificationSoundEnabled') !== 'false';
  });

  const toggleNotificationSound = () => {
    setIsSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('notificationSoundEnabled', next ? 'true' : 'false');
      window.dispatchEvent(new Event('notificationSoundChanged'));
      return next;
    });
  };
  const searchRef = useRef<HTMLDivElement>(null);
  const { subscribe } = useWebSocket();

  const [isAckLoading, setIsAckLoading] = useState(false);

  useEffect(() => {
    // WebSocket ยิงหา client ทุกตัว จึงต้องกรองตาม role ไม่งั้นกระดิ่งของทุก role จะเด้งพร้อมกัน
    const role = currentUser?.role;
    const isDoctorRole = role === 'doctor' || role === 'admin';
    const isPharmacy = role === 'pharmacist' || role === 'admin';
    const isCashier = role === 'cashier' || role === 'admin';

    // คิวจากพยาบาลคัดกรอง เข้าห้องตรวจแพทย์
    const pushDoctorQueueNotice = (data: any) => {
      if (!isDoctorRole) return;
      setNotifications(prev => [{
        id: Date.now().toString() + Math.random(),
        category: 'ห้องตรวจแพทย์',
        message: `พยาบาลส่งผู้ป่วยเข้าห้องตรวจ — ${data?.patient_name || data?.patient?.fullname || 'ผู้ป่วย'}`,
        time: 'เมื่อสักครู่',
        isUnread: true,
      }, ...prev]);
    };
    const unsubVitals = subscribe('VITALS_RECORDED', pushDoctorQueueNotice);
    const unsubScreening = subscribe('SCREENING_RECORDED', pushDoctorQueueNotice);

    const unsubMedQ = subscribe('MEDICINE_QUEUE_CREATED', (data: any) => {
      if (!isPharmacy) return;
      setNotifications(prev => [{
        id: Date.now().toString() + Math.random(),
        category: 'ห้องยา',
        message: `มีใบสั่งยาใหม่ส่งมาจากห้องตรวจแพทย์ รอจัดยาสำหรับ ${data?.patient_name || 'ผู้ป่วย'}`,
        time: 'เมื่อสักครู่',
        isUnread: true,
      }, ...prev]);
    });

    const unsubBill = subscribe('BILLING_CREATED', (data: any) => {
      if (!isCashier) return;
      setNotifications(prev => [{
        id: Date.now().toString() + Math.random(),
        category: 'การชำระเงิน',
        message: `รอชำระเงินสำหรับ ${data?.patient_name || 'ผู้ป่วย'}`,
        time: 'เมื่อสักครู่',
        isUnread: true,
      }, ...prev]);
    });

    const unsubPay = subscribe('PAYMENT_CONFIRMED', () => {
      if (!isCashier) return;
      setNotifications(prev => [{
        id: Date.now().toString() + Math.random(),
        category: 'การชำระเงิน',
        message: `ชำระเงินเรียบร้อยแล้ว ออกใบเสร็จสำเร็จ`,
        time: 'เมื่อสักครู่',
        isUnread: true,
      }, ...prev]);
    });

    return () => {
      unsubVitals();
      unsubScreening();
      unsubMedQ();
      unsubBill();
      unsubPay();
    };
  }, [subscribe, currentUser?.role]);

  // Sync Document Messages from storage & events
  useEffect(() => {
    const handleMessageUpdate = () => {
      const msgs = getDocumentMessagesForUser(currentUser);
      setDocMessages(msgs);
      if (selectedDocMessageModal) {
        const currentSelected = msgs.find((m) => m.id === selectedDocMessageModal.id);
        if (currentSelected) {
          setSelectedDocMessageModal(currentSelected);
        }
      }
    };
    handleMessageUpdate();
    window.addEventListener('clinic_document_message_sent', handleMessageUpdate);
    window.addEventListener('clinic_document_acknowledged', handleMessageUpdate);
    window.addEventListener('storage', handleMessageUpdate);
    return () => {
      window.removeEventListener('clinic_document_message_sent', handleMessageUpdate);
      window.removeEventListener('clinic_document_acknowledged', handleMessageUpdate);
      window.removeEventListener('storage', handleMessageUpdate);
    };
  }, [currentUser, selectedDocMessageModal?.id]);

  const unreadDocMessageCount = useMemo(() => {
    return docMessages.filter((m) => m.isUnread).length;
  }, [docMessages]);

  const handleAcknowledgeMessage = async (msg: DocumentMessage) => {
    setIsAckLoading(true);
    try {
      if (msg.forwardId) {
        await dmsApi.acknowledgeForward(msg.forwardId).catch((err) => {
          console.warn('API acknowledge forward failed (fallback to local):', err);
        });
      }

      acknowledgeDocumentMessage({
        msgId: msg.id,
        forwardId: msg.forwardId,
        docId: msg.docId,
      });

      const nowIso = new Date().toISOString();
      const updated: DocumentMessage = {
        ...msg,
        isUnread: false,
        isAcknowledged: true,
        acknowledgedAt: nowIso,
      };
      setSelectedDocMessageModal(updated);
      setDocMessages(getDocumentMessagesForUser(currentUser));

      toast.success(`รับทราบเอกสาร "${msg.title}" เรียบร้อยแล้ว (สถานะ: ได้รับแล้ว)`);
    } catch (err) {
      console.error('Error acknowledging document:', err);
      toast.error('เกิดข้อผิดพลาดในการบันทึกรับทราบเอกสาร');
    } finally {
      setIsAckLoading(false);
    }
  };

  const handleMarkAllMessagesRead = () => {
    markAllDocumentMessagesAsRead(currentUser?.username, currentUser?.fullName);
    setDocMessages(getDocumentMessagesForUser(currentUser));
  };

  const handleOpenMessageItem = (msg: DocumentMessage) => {
    markDocumentMessageAsRead(msg.id);
    setDocMessages(getDocumentMessagesForUser(currentUser));
    setSelectedDocMessageModal(msg);
    setIsDocMessagesOpen(false);
  };

  const handleDeleteMessage = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteDocumentMessage(id);
    setDocMessages(getDocumentMessagesForUser(currentUser));
    if (selectedDocMessageModal && selectedDocMessageModal.id === id) {
      setSelectedDocMessageModal(null);
    }
  };

  const handleClearAllMessages = () => {
    if (window.confirm('คุณต้องการล้างข้อความเอกสารทั้งหมดใช่หรือไม่?')) {
      clearAllDocumentMessages();
      setDocMessages([]);
      setIsAllDocsModalOpen(false);
      setSelectedDocMessageModal(null);
    }
  };

  const [isAllDocsModalOpen, setIsAllDocsModalOpen] = useState(false);
  const [allDocsFilter, setAllDocsFilter] = useState<string>('all');
  const [allDocsSearch, setAllDocsSearch] = useState<string>('');

  const handleOpenAllDocsModal = () => {
    setIsDocMessagesOpen(false);
    setIsAllDocsModalOpen(true);
  };

  const filteredAllDocs = useMemo(() => {
    return docMessages.filter((msg) => {
      // 1. Search term
      if (allDocsSearch.trim()) {
        const q = allDocsSearch.toLowerCase();
        const matchTitle = msg.title.toLowerCase().includes(q);
        const matchDesc = msg.description?.toLowerCase().includes(q);
        const matchSender = msg.sender.toLowerCase().includes(q);
        const matchType = msg.type.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchSender && !matchType) {
          return false;
        }
      }
      // 2. Filter category (Only 'all' and 'unread')
      if (allDocsFilter === 'unread') return msg.isUnread;
      return true;
    });
  }, [docMessages, allDocsSearch, allDocsFilter]);

  // โหลดผู้ป่วยย้อนหลังไว้ให้ช่องค้นหาด้านบนใช้ด้วย ไม่งั้นจะค้นเจอเฉพาะคิววันนี้
  useEffect(() => {
    if (isDoctor) {
      void refreshRecords();
    }
  }, [isDoctor, refreshRecords]);

  // ค้นหาผู้ป่วยแบบ Live Search (เฉพาะ role หมอ)
  //
  // รวม 2 ชุด: คิวที่ยังเดินอยู่ + ผู้ป่วยที่เคยมาตรวจ (ไม่จำกัดวัน)
  // ถ้าคนเดียวกันอยู่ทั้งสองชุด ยึดของคิวเพราะสถานะเป็นปัจจุบันกว่า
  const searchablePatients = useMemo(() => {
    if (!isDoctor) return [];

    const merged: typeof doctorPatients = [];
    const seen = new Set<string>();
    const addPatient = (patient: (typeof doctorPatients)[number]) => {
      const hn = (patient.hn || '').trim().toUpperCase();
      const nationalId = (patient.nationalId || '').replace(/[-\s]/g, '');
      const identity = hn
        ? `hn:${hn}`
        : nationalId
          ? `national-id:${nationalId}`
          : patient.patientId
            ? `patient-id:${patient.patientId}`
            : `id:${patient.id}`;

      if (seen.has(identity)) return;
      seen.add(identity);
      merged.push(patient);
    };

    // ใส่คิวปัจจุบันก่อนเพื่อให้ข้อมูลสถานะล่าสุดมีสิทธิ์เหนือข้อมูลย้อนหลัง
    doctorPatients.forEach(addPatient);
    recordPatients.forEach(addPatient);
    return merged;
  }, [isDoctor, doctorPatients, recordPatients]);

  const matchingPatients = isDoctor && searchQuery.trim()
    ? searchablePatients.filter((p) => matchPatientSearch(p, searchQuery))
    : [];

  const handleSelectSearchResult = (patient: (typeof searchablePatients)[number]) => {
    setSelectedRecordPatient(patient);
    setSearchQuery('');
    setIsSearchDropdownOpen(false);
    onNavigate?.('doctor-records');
  };
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [isSpeakingAll, setIsSpeakingAll] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>('');
  const [speechRate, setSpeechRate] = useState<number>(1.0);
  const [speechPitch, setSpeechPitch] = useState<number>(1.35); // ตั้งค่าเริ่มต้นเป็นโทนเสียงผู้หญิง
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [showAllGlobalVoices, setShowAllGlobalVoices] = useState(false);
  const [voiceProfile, setVoiceProfile] = useState<'standard' | 'male' | 'female' | 'robot' | 'announcer'>('female');
  const [ttsProvider, setTtsProvider] = useState<'google_online' | 'responsive_online' | 'browser_native'>('responsive_online');

  const [queueInput, setQueueInput] = useState<string>('A01');
  const [channelInput, setChannelInput] = useState<string>('ช่อง 1');
  const [customTextInput, setCustomTextInput] = useState<string>('ขอเชิญหมายเลขคิว A01 ที่ช่องบริการรับยา ช่อง 1 ค่ะ');

  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: '1',
      category: 'ห้องยา',
      message: 'มีใบสั่งยาใหม่ส่งมาจากห้องตรวจแพทย์ รอจัดยาสำหรับ คุณสมชาย ใจดี',
      time: 'เมื่อสักครู่',
      isUnread: true,
    },
    {
      id: '2',
      category: 'จุดคัดกรอง',
      message: 'วัดสัญญาณชีพเรียบร้อย คุณสมหญิง มีสุข คิว A04 รอส่งเข้าห้องตรวจ 1',
      time: '5 นาทีที่แล้ว',
      isUnread: true,
    },
    {
      id: '3',
      category: 'การชำระเงิน',
      message: 'ชำระเงินเรียบร้อยแล้วสำหรับ คิว A03 คุณวิชัย รักดี ออกใบเสร็จสำเร็จ',
      time: '12 นาทีที่แล้ว',
      isUnread: true,
    },
    {
      id: '4',
      category: 'ผลตรวจแล็บ',
      message: 'ผลตรวจเลือดอนุมัติเรียบร้อยแล้ว พร้อมให้แพทย์สรุปผลตรวจ',
      time: '25 นาทีที่แล้ว',
      isUnread: false,
    },
    {
      id: '5',
      category: 'การคัดกรองสัญญาณชีพ',
      message: 'แจ้งเตือนบันทึกสัญญาณชีพผู้ป่วยกลุ่ม Triage ฉุกเฉินเรียบร้อย',
      time: '1 ชั่วโมงที่แล้ว',
      isUnread: false,
    },
  ]);

  // ฟังก์ชันจัดรูปแบบประโยคประกาศเรียกคิวสไตล์ Narakeet (เว้นวรรคตัวอักษรและตัวเลขเพื่อให้อ่านออกเสียงชัดเจน)
  const formatNarakeetQueueText = (queueNo: string, channel: string) => {
    const formattedQueue = queueNo.toUpperCase().split('').join(' ');
    return `ขอเชิญหมายเลขคิว ${formattedQueue} ที่ช่องบริการรับยา ${channel} ค่ะ`;
  };

  const dropdownRef = useRef<HTMLDivElement>(null);
  const noticeRef = useRef<HTMLDivElement>(null);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

  // ดึงรายการเสียงทั้งหมดในเครื่องของผู้ใช้ (Windows/Chrome/Edge)
  useEffect(() => {
    const updateVoices = () => {
      if ('speechSynthesis' in window) {
        const voices = window.speechSynthesis.getVoices();
        if (showAllGlobalVoices) {
          setAvailableVoices(voices);
        } else {
          // กรองเสียงภาษาไทยและเสียงยอดนิยม
          const thaiVoices = voices.filter(v => v.lang.includes('th') || v.lang.includes('TH'));
          setAvailableVoices(thaiVoices.length > 0 ? thaiVoices : voices);
        }

        if (voices.length > 0 && !selectedVoiceURI) {
          const naturalVoice = voices.find(v => v.lang.includes('th') && (v.name.includes('Natural') || v.name.includes('Niwat') || v.name.includes('Premwadee'))) 
            || voices.find(v => v.lang.includes('th')) 
            || voices[0];
          setSelectedVoiceURI(naturalVoice.voiceURI);
        }
      }
    };

    updateVoices();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, [showAllGlobalVoices]);

  // หยุดเสียงเมื่อปิดหน้าจอหรือเปลี่ยนคอมโพเนนต์
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
      }
    };
  }, []);

  // ปิด dropdown เมื่อคลิกที่อื่นบนหน้าจอ
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (noticeRef.current && !noticeRef.current.contains(event.target as Node)) {
        setIsNoticeOpen(false);
      }
      if (docMessageRef.current && !docMessageRef.current.contains(event.target as Node)) {
        setIsDocMessagesOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const playBeep = () => {
    try {
      // ใช้ AudioContext กลาง ห้ามสร้างใหม่ทุกครั้ง (Chrome จำกัด ~6 context ต่อแท็บ)
      const ctx = getSharedAudioContext();
      if (!ctx || ctx.state !== 'running') return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch {
      // ละเว้น
    }
  };

  // ฟังก์ชันหยุดการอ่านข้อความ
  const stopSpeech = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if ((window as unknown as { responsiveVoice?: { cancel: () => void } }).responsiveVoice) {
      (window as unknown as { responsiveVoice: { cancel: () => void } }).responsiveVoice.cancel();
    }
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current = null;
    }
    setSpeakingId(null);
    setIsSpeakingAll(false);
  };

  // ฟังก์ชันปรับข้อความให้อ่านเสียงผู้หญิงไทยได้อย่างไพเราะและชัดเจน
  const formatThaiSpeechText = (input: string) => {
    return input
      .replace(/A(\d+)/gi, (_, num) => `เอ ${num.split('').join(' ')}`)
      .replace(/B(\d+)/gi, (_, num) => `บี ${num.split('').join(' ')}`)
      .replace(/C(\d+)/gi, (_, num) => `ซี ${num.split('').join(' ')}`);
  };

  // ฟังก์ชันอ่านข้อความด้วย ResponsiveVoice SDK (เสียงผู้หญิงไทยออนไลน์ 100%)
  const speakText = (text: string, id?: string, customPitch?: number, customRate?: number) => {
    playBeep();
    stopSpeech();

    if (id && speakingId === id) {
      setSpeakingId(null);
      return;
    }

    if (id) setSpeakingId(id);

    const formattedText = formatThaiSpeechText(text);
    const rv = (window as unknown as { responsiveVoice?: { speak: (t: string, v: string, opts?: object) => void } }).responsiveVoice;

    // 1. เรียกใช้ ResponsiveVoice SDK สตรีมเสียงผู้หญิงไทย (Thai Female) โดยตรง
    if (rv && typeof rv.speak === 'function') {
      try {
        rv.speak(formattedText, 'Thai Female', {
          rate: customRate || speechRate,
          onend: () => {
            setSpeakingId(null);
            setIsSpeakingAll(false);
          },
          onerror: () => {
            speakGoogleOnlineFemale(formattedText, id, customRate);
          }
        });
        return;
      } catch {
        speakGoogleOnlineFemale(formattedText, id, customRate);
        return;
      }
    }

    // 2. สำรองออนไลน์: Google Online Female Voice (SoundOfText)
    speakGoogleOnlineFemale(formattedText, id, customRate);
  };

  // ฟังก์ชันสตรีมเสียงผู้หญิงไทยออนไลน์จาก Google Cloud (SoundOfText API)
  const speakGoogleOnlineFemale = (text: string, id?: string, customRate?: number) => {
    fetch('https://api.soundoftext.com/sounds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ engine: 'Google', data: { text: text, voice: 'th-TH' } })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success && data.id) {
        const soundUrl = `https://files.soundoftext.com/${data.id}.mp3`;
        const audio = new Audio(soundUrl);
        activeAudioRef.current = audio;
        audio.onended = () => {
          setSpeakingId(null);
          setIsSpeakingAll(false);
        };
        audio.onerror = () => {
          speakBrowserNative(text, id, 1.45, customRate);
        };
        audio.play().catch(() => {
          speakBrowserNative(text, id, 1.45, customRate);
        });
      } else {
        speakBrowserNative(text, id, 1.45, customRate);
      }
    })
    .catch(() => {
      speakBrowserNative(text, id, 1.45, customRate);
    });
  };

  // ฟังก์ชันย่อยสำหรับเล่นด้วย Browser Native Speech Synthesis (บังคับโทนเสียงผู้หญิง Pitch 1.45 เสมอ)
  const speakBrowserNative = (text: string, id?: string, customPitch?: number, customRate?: number) => {
    if (!('speechSynthesis' in window)) {
      alert('เบราว์เซอร์ของคุณไม่รองรับฟังก์ชันการอ่านข้อความด้วยเสียง (Text-to-Speech)');
      return;
    }

    window.speechSynthesis.cancel();
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }

    // บังคับระดับเสียงเป็น 1.45 (โทนเสียงผู้หญิงแจ่มใส) เสมอ
    const currentPitch = 1.45;
    const currentRate = customRate !== undefined ? customRate : speechRate;

    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'th-TH';       // ตั้งค่าเป้าหมายเป็นภาษาไทย
      utterance.rate = currentRate;   // ความเร็วเสียง
      utterance.pitch = currentPitch; // บังคับ Pitch โทนเสียงสูงผู้หญิง (Female Pitch)

      // บังคับค้นหาเสียงพากย์ผู้หญิงไทย (Female Thai Voice / Premwadee) ในเครื่องเสมอ
      const voices = window.speechSynthesis.getVoices();
      let femaleThaiVoice = voices.find(v => (v.lang.includes('th') || v.lang.includes('TH')) && (v.name.toLowerCase().includes('premwadee') || v.name.toLowerCase().includes('female')));

      if (!femaleThaiVoice) {
        femaleThaiVoice = voices.find(v => v.lang.includes('th') || v.lang.includes('TH'));
      }

      if (femaleThaiVoice) {
        utterance.voice = femaleThaiVoice;
      }

      utterance.onstart = () => {
        if (id) setSpeakingId(id);
      };

      utterance.onend = () => {
        setSpeakingId(null);
        setIsSpeakingAll(false);
      };

      utterance.onerror = (e) => {
        console.warn('SpeechSynthesis error:', e);
        setSpeakingId(null);
        setIsSpeakingAll(false);
      };

      window.speechSynthesis.speak(utterance);
    }, 50);
  };

  // เลือกแนวเสียงลัด (Preset Profile) และทดลองเล่นเสียงทันที
  const applyVoiceProfile = (profile: 'standard' | 'male' | 'female' | 'robot' | 'announcer') => {
    setVoiceProfile(profile);

    let targetPitch = 1.0;
    let targetRate = 1.0;
    let sampleMsg = 'นี่คือเสียงปกติระบบคลินิกครับ';

    switch (profile) {
      case 'male':
        targetPitch = 0.55; // ปรับโทนเสียงทุ้มต่ำผู้ชาย
        targetRate = 0.9;
        sampleMsg = 'สวัสดีครับ หมอขอเชิญผู้ป่วยรายถัดไปเข้าห้องตรวจครับ';
        break;
      case 'female':
        targetPitch = 1.4; // ปรับโทนเสียงสูงแจ่มใสผู้หญิง
        targetRate = 1.05;
        sampleMsg = 'สวัสดีค่ะ พยาบาลเตรียมวัดสัญญาณชีพเรียบร้อยแล้วค่ะ';
        break;
      case 'robot':
        targetPitch = 0.3; // ปรับโทนเสียงแบนหุ่นยนต์ AI
        targetRate = 0.85;
        sampleMsg = 'ระบบ เอไอ กำลังประมวลผลการแจ้งเตือน';
        break;
      case 'announcer':
        targetPitch = 1.15; // ปรับจังหวะกระชับสไตล์ประกาศด่วน
        targetRate = 1.35;
        sampleMsg = 'ประกาศด่วน! ขอเชิญคิว A 0 1 2 ที่ช่องชำระเงินค่ะ';
        break;
      default:
        targetPitch = 1.0;
        targetRate = 1.0;
        sampleMsg = 'นี่คือเสียงอ่านการแจ้งเตือนปกติครับ';
        break;
    }

    setSpeechPitch(targetPitch);
    setSpeechRate(targetRate);

    // เล่นเสียงตัวอย่างของสไตล์นั้นทันทีเมื่อกดปุ่ม
    speakText(sampleMsg, undefined, targetPitch, targetRate);
  };

  const toggleDropdown = () => {
    setIsDropdownOpen((prev) => !prev);
    setIsNoticeOpen(false);
  };

  const toggleNotice = () => {
    const nextState = !isNoticeOpen;
    setIsNoticeOpen(nextState);
    setIsDropdownOpen(false);
  };

  const unreadCount = notifications.filter(n => n.isUnread).length;

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isUnread: false })));
  };

  const getSearchPlaceholder = () => {
    switch (currentUser?.role) {
      case 'doctor':
        return 'ค้นหาผู้ป่วย ชื่อ, HN, VN...';
      case 'officer':
        return 'ค้นหาเอกสาร, ตารางงานแพทย์...';
      case 'registrar':
        return 'ค้นหาผู้ป่วย, HN, คิว...';
      case 'nurse':
      case 'nurse_assistant':
        return 'ค้นหาผู้ป่วย, คิว, คัดกรอง...';
      case 'pharmacist':
        return 'ค้นหาชื่อยา, รหัสยา...';
      case 'cashier':
        return 'ค้นหาใบแจ้งหนี้, คิวชำระเงิน...';
      default:
        return 'ค้นหาในระบบคลินิก...';
    }
  };

  return (
    <header className={`top-nav-header ${isSidebarOpen ? 'topbar-with-sidebar' : 'topbar-full'}`}>

      {/* ปุ่มวงกลมสีเขียว - แสดงเมื่อ Sidebar ปิด */}
      {!isSidebarOpen && (
        <button className="topbar-menu-toggle" onClick={onToggleSidebar} aria-label="Open Sidebar">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      )}

      {/* Search Bar (ซ่อนเฉพาะ role ใน scope ของเรา: registrar, nurse, nurse_assistant) */}
      {!isOurScope && (
        <div
          className="search-container search-container-interactive"
          ref={searchRef}
        >
          <div className="search-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <input
            className="search-input"
            type="text"
            placeholder={getSearchPlaceholder()}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsSearchDropdownOpen(true);
            }}
            onFocus={() => {
              if (searchQuery.trim()) setIsSearchDropdownOpen(true);
            }}
          />
          {searchQuery && (
            <button
              type="button"
              className="search-topbar-clear-btn"
              onClick={() => {
                setSearchQuery('');
                setIsSearchDropdownOpen(false);
              }}
              aria-label="Clear Search"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}

          {/* Live Search Results Dropdown (เฉพาะ role หมอ) */}
          {isDoctor && isSearchDropdownOpen && searchQuery.trim() !== '' && (
            <div className="search-results-dropdown">
              <div className="search-results-header">
                <span>ผลการค้นหา ({matchingPatients.length})</span>
                <span className="search-results-hint">คลิกเพื่อดูประวัติการรักษา</span>
              </div>
              {matchingPatients.length > 0 ? (
                <div className="search-results-list">
                  {matchingPatients.slice(0, 6).map((patient) => (
                    <div
                      key={patient.id}
                      className="search-result-item"
                      onClick={() => handleSelectSearchResult(patient)}
                    >
                      <div className="search-result-avatar">{patient.name.charAt(0)}</div>
                      <div className="search-result-info">
                        <span className="search-result-name">{patient.name}</span>
                        <span className="search-result-meta">
                          HN: {patient.hn} &bull; VN: {displayVN(patient.vn)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="search-results-empty">
                  ไม่พบข้อมูลผู้ป่วยที่ตรงกับ "{searchQuery}"
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Actions Group (Messages + Notifications + Profile) */}
      <div className="actions-group">

        {/* Document Message Box Icon & Dropdown Panel (เฉพาะผู้รับ เช่น แพทย์ พยาบาล เภสัชกร การเงิน — ซ่อนสำหรับธุรการ) */}
        {currentUser?.role !== 'officer' && (
          <div className="doc-message-container" ref={docMessageRef}>
            <button 
              className={`doc-message-btn ${isDocMessagesOpen ? 'active' : ''}`} 
              onClick={() => {
                setIsDocMessagesOpen(prev => !prev);
                setIsNoticeOpen(false);
                setIsDropdownOpen(false);
              }}
              aria-label="Document Messages"
              title="กล่องข้อความเอกสารเข้าจากธุรการ"
            >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {unreadDocMessageCount > 0 && <span className="notice-badge" />}
          </button>

          {/* Message Dropdown Menu */}
          {isDocMessagesOpen && (
            <div className="doc-message-dropdown-menu">
              <div className="doc-message-header">
                <div className="doc-message-header-title">
                  <span className="doc-message-main-title">กล่องข้อความเอกสาร</span>
                  {unreadDocMessageCount > 0 && (
                    <span className="doc-message-count-tag">{unreadDocMessageCount} ใหม่</span>
                  )}
                </div>
                <div className="doc-message-header-actions">
                  <button 
                    type="button" 
                    className="doc-message-viewall-top-btn"
                    onClick={handleOpenAllDocsModal}
                    title="ดูเอกสารทั้งหมด"
                  >
                    <span>ดูเอกสารทั้งหมด</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Sub-header info bar */}
              <div className="doc-message-info-bar">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                  เอกสารที่ส่งต่อจากเจ้าหน้าที่ธุรการ
                </span>
              </div>

              {/* Message List */}
              <div className="doc-message-list">
                {docMessages.length === 0 ? (
                  <div className="doc-message-empty">
                    <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#94A3B8" strokeWidth="1.5">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      <line x1="9" y1="10" x2="15" y2="10" />
                    </svg>
                    <p>ยังไม่มีข้อความหรือเอกสารใหม่ส่งถึงคุณ</p>
                  </div>
                ) : (
                  docMessages.map((msg) => (
                    <div 
                      key={msg.id} 
                      className={`doc-message-item ${msg.isUnread ? 'unread' : ''}`}
                      onClick={() => handleOpenMessageItem(msg)}
                    >
                      <div className="doc-message-item-icon">
                        {msg.priority === 'emergency' ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                          </svg>
                        ) : msg.priority === 'urgent' ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                          </svg>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                          </svg>
                        )}
                      </div>
                      <div className="doc-message-item-content">
                        <div className="doc-message-item-top">
                          <span className={`doc-message-tag ${msg.priority}`}>
                            {msg.type}
                          </span>
                          <div className="doc-message-top-right">
                            <span className="doc-message-time">{msg.timeDisplay}</span>
                            <button
                              type="button"
                              className="doc-message-item-delete-btn"
                              onClick={(e) => handleDeleteMessage(e, msg.id)}
                              title="ลบข้อความนี้"
                              aria-label="ลบข้อความนี้"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                        <h5 className="doc-message-item-title">{msg.title}</h5>
                        {msg.description && (
                          <p className="doc-message-item-desc">{msg.description}</p>
                        )}
                        <div className="doc-message-item-sender">
                          <span>จาก: {msg.sender}</span>
                          {msg.isAcknowledged ? (
                            <span className="doc-msg-status-pill completed">✓ ได้รับแล้ว</span>
                          ) : (
                            <span className="doc-msg-status-pill pending">รอรับทราบ</span>
                          )}
                          {msg.isUnread && <span className="doc-unread-dot" />}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Message List Footer */}
              <div className="doc-message-dropdown-footer">
                {unreadDocMessageCount > 0 && (
                  <button 
                    type="button" 
                    className="doc-message-footer-readall"
                    onClick={handleMarkAllMessagesRead}
                    title="ทำเครื่องหมายว่าอ่านแล้วทั้งหมด"
                  >
                    ✓ อ่านทั้งหมด
                  </button>
                )}
                <button 
                  type="button" 
                  className="doc-message-footer-viewall"
                  onClick={handleOpenAllDocsModal}
                >
                  เปิดคลังเอกสารทั้งหมด ({docMessages.length}) &rarr;
                </button>
              </div>
            </div>
          )}
        </div>
        )}

        {/* Profile with Dropdown */}
        <div className="profile-container" ref={dropdownRef}>
          <div className="profile-wrap" onClick={toggleDropdown} role="button" tabIndex={0}>
            <div className="avatar-circle">
              <div
                className="avatar-bg"
                style={{ backgroundColor: currentUser?.avatarColor || '#2563EB' }}
              >
                {currentUser?.avatarText ? (
                  <span className="avatar-text">{currentUser.avatarText}</span>
                ) : (
                  <svg viewBox="0 0 24 24" fill="#FFFFFF" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                )}
              </div>
            </div>
            <div className="user-text">
              <span className="user-name">{currentUser?.fullName || 'ผู้ใช้งาน'}</span>
              <span className="user-role">{currentUser?.roleTitleTh || 'เจ้าหน้าที่'}</span>
            </div>
            <div className={`dropdown-arrow ${isDropdownOpen ? 'open' : ''}`}>
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19.5 8.25l-7.5 7.5-7.5-7.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div className="profile-dropdown-menu">
              {/* 1. เปิด/ปิด เสียงแจ้งเตือนคิว */}
              <button
                className="dropdown-menu-item dropdown-item-sound"
                onClick={() => {
                  toggleNotificationSound();
                  setIsDropdownOpen(false);
                }}
              >
                <span className="theme-toggle-text">
                  {isSoundEnabled ? 'ปิดเสียงแจ้งเตือนคิว' : 'เปิดเสียงแจ้งเตือนคิว'}
                </span>
                <span className="theme-toggle-icon-wrapper" style={{ marginLeft: '4px', display: 'inline-flex', alignItems: 'center' }}>
                  {isSoundEnabled ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                      <line x1="23" y1="9" x2="17" y2="15"></line>
                      <line x1="17" y1="9" x2="23" y2="15"></line>
                    </svg>
                  )}
                </span>
              </button>

              <div className="dropdown-divider"></div>

              {/* เพิ่มใหม่: เปลี่ยนรหัสผ่าน (Text align center, no emoji) — หน้าตาแบบเดียวกับปุ่มออกจากระบบ */}
              {/* บัญชีทดสอบตายตัว 10 บัญชี (ดู config/testAccounts.ts) เปลี่ยนรหัสผ่านเองไม่ได้เลย —
                  backend (ChangePassword) ปฏิเสธเสมออยู่แล้ว แจ้งด้วย toast แทนเปิด modal ที่ยังไงก็
                  บันทึกไม่ได้ */}
              <button
                className="dropdown-menu-item dropdown-item-4"
                onClick={() => {
                  if (isTestAccountUsername(currentUser?.username)) {
                    toast.error('บัญชีทดสอบของระบบเปลี่ยนรหัสผ่านเองไม่ได้ ระบบจะตั้งรหัสผ่านกลับเป็นรหัสพนักงานให้อัตโนมัติทุกครั้งที่เปิดเซิร์ฟเวอร์');
                    setIsDropdownOpen(false);
                    return;
                  }
                  setIsChangePasswordOpen(true);
                  setIsDropdownOpen(false);
                }}
              >
                เปลี่ยนรหัสผ่าน
              </button>

              {/* ออกจากระบบ (Text align center, no emoji) */}
              <button
                className="dropdown-menu-item dropdown-item-4 dropdown-logout-btn"
                onClick={() => {
                  logout();
                  setIsDropdownOpen(false);
                }}
              >
                ออกจากระบบ
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Document Detail from Officer */}
      {selectedDocMessageModal && (
        <div className="doc-msg-modal-overlay" onClick={() => setSelectedDocMessageModal(null)}>
          <div className="doc-msg-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="doc-msg-modal-header">
              <div className="doc-msg-modal-header-left">
                <div className="doc-header-icon-badge">
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                </div>
                <div>
                  <h3 className="doc-msg-modal-title">รายละเอียดเอกสารส่งต่อ</h3>
                  <div className="doc-msg-modal-subtitle-row">
                    <span className="doc-msg-ref-label">รหัสอ้างอิง:</span>
                    <span className="doc-msg-ref-badge">{selectedDocMessageModal.id}</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="doc-modal-close-btn"
                onClick={() => setSelectedDocMessageModal(null)}
                title="ปิดหน้าต่าง"
              >
                ✕
              </button>
            </div>

            <div className="doc-msg-modal-body">
              {/* Recipient Acknowledgment Status Banner */}
              {selectedDocMessageModal.isAcknowledged ? (
                <div className="doc-msg-ack-banner completed">
                  <div className="doc-msg-ack-banner-icon">
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div className="doc-msg-ack-banner-text">
                    <div className="doc-msg-ack-title">คุณได้รับและรับทราบเอกสารนี้เรียบร้อยแล้ว</div>
                    <div className="doc-msg-ack-sub">
                      สถานะ: <span className="doc-msg-ack-pill-green">✓ ได้รับแล้ว</span>
                      {selectedDocMessageModal.acknowledgedAt && (
                        <span className="doc-msg-ack-time-info"> &bull; บันทึกเมื่อ {new Date(selectedDocMessageModal.acknowledgedAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })} น.</span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="doc-msg-ack-banner pending">
                  <div className="doc-msg-ack-banner-icon">
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  </div>
                  <div className="doc-msg-ack-banner-text">
                    <div className="doc-msg-ack-title">รอการรับทราบเอกสารจากคุณ</div>
                    <div className="doc-msg-ack-sub">
                      สถานะ: <span className="doc-msg-ack-pill-amber">รอรับทราบ</span> &bull; กรุณาตรวจสอบเอกสารและกดยืนยันรับทราบด้านล่าง
                    </div>
                  </div>
                </div>
              )}

              <div className="doc-msg-info-card">
                {/* Subject Title Card */}
                <div className="doc-msg-subject-box">
                  <span className="doc-msg-field-label">หัวข้อเรื่องเอกสาร:</span>
                  <h4 className="doc-msg-subject-title">{selectedDocMessageModal.title}</h4>
                </div>

                {/* 2x2 Details Grid */}
                <div className="doc-msg-field-grid">
                  <div className="doc-msg-grid-item">
                    <span className="doc-msg-field-label">ผู้ส่งมอบ (ธุรการ):</span>
                    <span className="doc-msg-field-value font-semibold">{selectedDocMessageModal.sender}</span>
                  </div>
                  <div className="doc-msg-grid-item">
                    <span className="doc-msg-field-label">ผู้รับมอบ:</span>
                    <span className="doc-msg-field-value font-semibold">{selectedDocMessageModal.recipient}</span>
                  </div>
                  <div className="doc-msg-grid-item">
                    <span className="doc-msg-field-label">ประเภทเอกสาร:</span>
                    <span className="doc-msg-type-pill">{selectedDocMessageModal.type}</span>
                  </div>
                  <div className="doc-msg-grid-item">
                    <span className="doc-msg-field-label">ระดับความสำคัญ:</span>
                    <span className={`doc-msg-priority-tag ${selectedDocMessageModal.priority}`}>
                      {selectedDocMessageModal.priority === 'emergency' ? '🚨 ฉุกเฉินมาก' : selectedDocMessageModal.priority === 'urgent' ? '⚡ ด่วน' : 'ปกติ'}
                    </span>
                  </div>
                </div>

                {/* Officer Note */}
                {selectedDocMessageModal.description && (
                  <div className="doc-msg-note-section">
                    <span className="doc-msg-field-label">ข้อความและรายละเอียดจากธุรการ:</span>
                    <div className="doc-msg-note-box">
                      {selectedDocMessageModal.description}
                    </div>
                  </div>
                )}

                {/* File Attachment Box */}
                {selectedDocMessageModal.fileUrl && (
                  <div className="doc-msg-attachment-section">
                    <span className="doc-msg-field-label">ไฟล์เอกสารแนบต้นฉบับ:</span>
                    <div className="doc-msg-attachment-card">
                      <div className="doc-msg-attachment-info">
                        <span className="doc-msg-attachment-icon">📎</span>
                        <div className="doc-msg-attachment-text-group">
                          <span className="doc-msg-attachment-name">ไฟล์เอกสารแนบในระบบ</span>
                          <span className="doc-msg-attachment-hint">คลิกเพื่อดูหรือดาวน์โหลดเอกสารต้นฉบับ</span>
                        </div>
                      </div>
                      <a
                        href={selectedDocMessageModal.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="doc-msg-attachment-btn"
                      >
                        👁️ เปิดดูไฟล์แนบ
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="doc-msg-modal-footer">
              <button
                type="button"
                className="doc-msg-btn-danger"
                onClick={(e) => {
                  handleDeleteMessage(e, selectedDocMessageModal.id);
                  setSelectedDocMessageModal(null);
                }}
              >
                🗑️ ลบข้อความนี้
              </button>

              <div className="doc-msg-footer-right-actions">
                {!selectedDocMessageModal.isAcknowledged ? (
                  <button
                    type="button"
                    className="doc-msg-btn-acknowledge"
                    disabled={isAckLoading}
                    onClick={() => handleAcknowledgeMessage(selectedDocMessageModal)}
                  >
                    {isAckLoading ? (
                      'กำลังบันทึก...'
                    ) : (
                      <>
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span>รับทราบเอกสาร (บันทึกว่าได้รับแล้ว)</span>
                      </>
                    )}
                  </button>
                ) : (
                  <span className="doc-msg-acknowledged-tag">
                    ✓ ได้รับแล้ว (รับทราบเรียบร้อย)
                  </span>
                )}
                <button
                  type="button"
                  className="doc-msg-btn-secondary"
                  onClick={() => setSelectedDocMessageModal(null)}
                >
                  ปิดหน้าต่าง
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: All Documents Archive (คลังเอกสารและข้อความทั้งหมด) */}
      {isAllDocsModalOpen && (
        <div className="doc-msg-modal-overlay" onClick={() => setIsAllDocsModalOpen(false)}>
          <div className="doc-all-modal-box" onClick={(e) => e.stopPropagation()}>
            {/* Header: Cohesive Clinic Modal Design */}
            <div className="doc-all-modal-header">
              <div className="doc-all-modal-header-left">
                <div className="doc-header-icon-badge">
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="doc-all-modal-title">คลังเอกสารและข้อความ</h3>
                  <p className="doc-all-modal-subtitle">
                    เอกสารที่ส่งถึงคุณ ({currentUser?.fullName || currentUser?.username}) &bull; ทั้งหมด {docMessages.length} รายการ
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="doc-modal-close-btn"
                onClick={() => setIsAllDocsModalOpen(false)}
                title="ปิดหน้าต่าง"
              >
                ✕
              </button>
            </div>

            {/* Filter & Search Toolbar (Only 2 Tabs: เอกสารทั้งหมด & ยังไม่อ่าน) */}
            <div className="doc-all-toolbar">
              <div className="doc-all-toolbar-row">
                <div className="doc-all-segment-tabs">
                  <button
                    type="button"
                    className={`doc-all-tab-btn ${allDocsFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setAllDocsFilter('all')}
                  >
                    <span>เอกสารทั้งหมด</span>
                    <span className="doc-all-tab-badge">{docMessages.length}</span>
                  </button>
                  <button
                    type="button"
                    className={`doc-all-tab-btn ${allDocsFilter === 'unread' ? 'active' : ''}`}
                    onClick={() => setAllDocsFilter('unread')}
                  >
                    <span>ยังไม่อ่าน</span>
                    {unreadDocMessageCount > 0 && (
                      <span className="doc-all-tab-badge unread">{unreadDocMessageCount}</span>
                    )}
                  </button>
                </div>

                <div className="doc-all-toolbar-actions">
                  {unreadDocMessageCount > 0 && (
                    <button
                      type="button"
                      className="doc-all-quick-readall-btn"
                      onClick={handleMarkAllMessagesRead}
                      title="ทำเครื่องหมายว่าอ่านแล้วทั้งหมด"
                    >
                      ✓ อ่านแล้วทั้งหมด
                    </button>
                  )}
                  {docMessages.length > 0 && (
                    <button
                      type="button"
                      className="doc-all-quick-clearall-btn"
                      onClick={handleClearAllMessages}
                      title="ล้างข้อความทั้งหมดในกล่องข้อความ"
                    >
                      🗑️ ล้างทั้งหมด
                    </button>
                  )}
                </div>
              </div>

              {/* Search Bar */}
              <div className="doc-all-search-wrap">
                <svg className="doc-all-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <input
                  type="text"
                  className="doc-all-search-input"
                  placeholder="ค้นหาชื่อเอกสาร, ผู้ส่ง หรือข้อความ..."
                  value={allDocsSearch}
                  onChange={(e) => setAllDocsSearch(e.target.value)}
                />
                {allDocsSearch && (
                  <button
                    type="button"
                    className="doc-all-search-clear"
                    onClick={() => setAllDocsSearch('')}
                    title="ล้างคำค้นหา"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Document List View */}
            <div className="doc-all-modal-body">
              {filteredAllDocs.length === 0 ? (
                <div className="doc-all-empty">
                  <div className="doc-all-empty-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 12h-6l-2 3h-4l-2-3H2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-7z" />
                      <path d="M5.45 5.11L2 12v0h20v0l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
                    </svg>
                  </div>
                  <h4>{allDocsFilter === 'unread' ? 'ไม่มีเอกสารที่ยังไม่ได้อ่าน' : 'ไม่พบเอกสารที่ค้นหา'}</h4>
                  <p>{allDocsFilter === 'unread' ? 'คุณได้อ่านเอกสารทั้งหมดครบถ้วนแล้ว' : 'ลองเปลี่ยนคำค้นหาใหม่อีกครั้ง'}</p>

                </div>
              ) : (
                <div className="doc-all-grid">
                  {filteredAllDocs.map((msg) => (
                    <div
                      key={msg.id}
                      className={`doc-all-card ${msg.isUnread ? 'unread' : ''}`}
                      onClick={() => handleOpenMessageItem(msg)}
                    >
                      <div className="doc-all-card-top">
                        <div className="doc-all-card-badges">
                          <span className={`doc-message-tag ${msg.priority}`}>
                            {msg.priority === 'emergency' ? 'ฉุกเฉินมาก' : msg.priority === 'urgent' ? 'ด่วน' : 'ปกติ'}
                          </span>
                          <span className="doc-all-type-tag">{msg.type}</span>
                          {msg.isAcknowledged ? (
                            <span className="doc-all-status-badge ack">✓ ได้รับแล้ว</span>
                          ) : (
                            <span className="doc-all-status-badge pending">รอรับทราบ</span>
                          )}
                          {msg.isUnread && <span className="doc-all-unread-badge">ยังไม่ได้อ่าน</span>}
                        </div>
                        <span className="doc-all-card-time">{msg.timeDisplay}</span>
                      </div>

                      <h4 className="doc-all-card-title">{msg.title}</h4>
                      
                      {msg.description && (
                        <p className="doc-all-card-desc">{msg.description}</p>
                      )}

                      <div className="doc-all-card-footer">
                        <div className="doc-all-card-sender">
                          <span className="doc-all-sender-label">จาก:</span>
                          <span className="doc-all-sender-name">{msg.sender}</span>
                        </div>
                        <div className="doc-all-card-actions">
                          <button
                            type="button"
                            className="doc-all-delete-btn"
                            title="ลบข้อความนี้"
                            aria-label="ลบข้อความนี้"
                            onClick={(e) => handleDeleteMessage(e, msg.id)}
                          >
                            🗑️
                          </button>
                          <button
                            type="button"
                            className="doc-all-view-detail-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenMessageItem(msg);
                            }}
                          >
                            เปิดดูเอกสาร &rarr;
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="doc-all-modal-footer">
              <div className="doc-all-footer-left">
                {currentUser?.role === 'officer' && onNavigate && (
                  <button
                    type="button"
                    className="doc-all-footer-nav-btn"
                    onClick={() => {
                      setIsAllDocsModalOpen(false);
                      onNavigate('dms-documents');
                    }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                    </svg>
                    ไปที่หน้าจัดการเอกสารธุรการ &rarr;
                  </button>
                )}
              </div>
              <button
                type="button"
                className="doc-all-footer-close-btn"
                onClick={() => setIsAllDocsModalOpen(false)}
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* เพิ่มใหม่: modal เปลี่ยนรหัสผ่าน เปิดจากปุ่ม "เปลี่ยนรหัสผ่าน" ด้านบน */}
      <ChangePasswordModal
        open={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />

    </header>
  );
}

export default Topbar;
