import './Topbar.css';
import { useState, useRef, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDoctorData } from '../../pages/doctor/DoctorDataContext';
import { matchPatientSearch } from '../../pages/doctor/utils/searchUtils';
import { displayVN } from '../../pages/doctor/utils/vnGenerator';

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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isNoticeOpen, setIsNoticeOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

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
    const merged = [...doctorPatients];
    const seen = new Set(doctorPatients.map((p) => p.hn));
    for (const p of recordPatients) {
      if (!seen.has(p.hn)) {
        seen.add(p.hn);
        merged.push(p);
      }
    }
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
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
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
      }
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

      {/* Search Bar */}
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

      {/* Actions Group (Notifications + Profile) */}
      <div className="actions-group">

        {/* Notification Icon & Dropdown Panel */}
        <div className="notice-container" ref={noticeRef}>
          <button 
            className={`notice-btn ${isNoticeOpen ? 'active' : ''}`} 
            onClick={toggleNotice}
            aria-label="Notifications"
            title="การแจ้งเตือน และอ่านข้อความด้วยเสียง"
          >
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M13.73 21a2 2 0 01-3.46 0" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {unreadCount > 0 && <span className="notice-badge" />}
          </button>

          {/* Notification Popup Menu */}
          {isNoticeOpen && (
            <div className="notice-dropdown-menu">
              <div className="notice-header">
                <div className="notice-header-title">
                  <span>การแจ้งเตือน</span>
                  {unreadCount > 0 && <span className="notice-count-tag">{unreadCount} ใหม่</span>}
                </div>
                <div className="notice-header-actions">
                  <button 
                    className={`voice-settings-toggle-btn ${showVoiceSettings ? 'active' : ''}`}
                    onClick={() => setShowVoiceSettings(!showVoiceSettings)}
                    title="เปิดแผงประกาศเรียกคิวด้วยเสียง"
                  >
                    ตั้งค่าเสียง
                  </button>
                </div>
              </div>

              {/* แผงประกาศข้อความด้วยเสียง (Speech Announcer Panel) */}
              {showVoiceSettings && (
                <div className="voice-settings-panel">
                  {/* 1. ระบบกำหนดคิวและช่องบริการ (Narakeet Queue Builder) */}
                  <div className="voice-setting-row narakeet-builder-box">
                    <label className="voice-label">กำหนดหมายเลขคิว และ ห้อง/ช่องบริการ:</label>
                    <div className="narakeet-input-group">
                      <div className="narakeet-input-field">
                        <span className="narakeet-field-label">หมายเลขคิว:</span>
                        <input 
                          type="text" 
                          value={queueInput} 
                          onChange={(e) => setQueueInput(e.target.value)}
                          placeholder="A01"
                          className="narakeet-input"
                        />
                      </div>
                      <div className="narakeet-input-field">
                        <span className="narakeet-field-label">ห้อง / ช่องบริการ:</span>
                        <input 
                          type="text" 
                          value={channelInput} 
                          onChange={(e) => setChannelInput(e.target.value)}
                          placeholder="ช่อง 1"
                          className="narakeet-input"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 2. ปุ่มกดประกาศด่วนอัตโนมัติ (1-Click Quick Auto Announce - Dynamic based on inputs) */}
                  <div className="voice-setting-row">
                    <label className="voice-label">ประกาศด่วนตามห้อง/ช่องที่ระบุข้างต้น:</label>
                    <div className="quick-auto-btn-grid">
                      <button 
                        className="quick-auto-btn"
                        onClick={() => speakText(`ขอเชิญหมายเลขคิว ${(queueInput || 'A01').toUpperCase().split('').join(' ')} ที่ช่องบริการรับยา ${channelInput || 'ช่อง 1'} ค่ะ`)}
                      >
                        คิว {queueInput || 'A01'} รับยา {channelInput || 'ช่อง 1'}
                      </button>
                      <button 
                        className="quick-auto-btn"
                        onClick={() => speakText(`ขอเชิญหมายเลขคิว ${(queueInput || 'A01').toUpperCase().split('').join(' ')} ที่ห้องตรวจ ${channelInput || 'ห้อง 1'} ค่ะ`)}
                      >
                        คิว {queueInput || 'A01'} ห้องตรวจ {channelInput || 'ห้อง 1'}
                      </button>
                      <button 
                        className="quick-auto-btn"
                        onClick={() => speakText(`ขอเชิญหมายเลขคิว ${(queueInput || 'A01').toUpperCase().split('').join(' ')} ที่ช่องชำระเงิน ${channelInput || 'ช่อง 1'} ค่ะ`)}
                      >
                        คิว {queueInput || 'A01'} ชำระเงิน {channelInput || 'ช่อง 1'}
                      </button>
                      <button 
                        className="quick-auto-btn"
                        onClick={() => speakText(`ขอเชิญหมายเลขคิว ${(queueInput || 'A01').toUpperCase().split('').join(' ')} ที่ช่องบริการ ${channelInput || 'ช่อง 1'} ค่ะ`)}
                      >
                        คิว {queueInput || 'A01'} ช่องบริการ {channelInput || 'ช่อง 1'}
                      </button>
                    </div>
                  </div>

                  {/* 3. พิมพ์ข้อความอิสระที่ต้องการประกาศ */}
                  <div className="voice-setting-row custom-text-box">
                    <label className="voice-label">พิมพ์ข้อความประกาศอิสระเพิ่มเติม:</label>
                    <div className="custom-text-input-group">
                      <input 
                        type="text" 
                        value={customTextInput} 
                        onChange={(e) => setCustomTextInput(e.target.value)}
                        placeholder="พิมพ์ข้อความที่ต้องการให้เสียงอ่านที่นี่..."
                        className="custom-text-input"
                      />
                      <button 
                        className="custom-text-speak-btn"
                        onClick={() => speakText(customTextInput)}
                      >
                        ประกาศ
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="notice-list">
                {notifications.map((item) => (
                  <div key={item.id} className={`notice-item ${item.isUnread ? 'unread' : ''}`}>
                    <div className="notice-item-content">
                      <div className="notice-item-header">
                        <span className="notice-category-badge">{item.category}</span>
                        <span className="notice-time">{item.time}</span>
                      </div>
                      <p className="notice-message">{item.message}</p>
                    </div>

                    {/* ปุ่มอ่านข้อความเฉพาะรายการ */}
                    <button 
                      className={`notice-speak-btn ${speakingId === item.id ? 'speaking' : ''}`}
                      onClick={() => speakText(item.message, item.id)}
                      title="กดเพื่อฟังเสียงอ่านข้อความนี้"
                    >
                      {speakingId === item.id ? (
                        <div className="sound-wave-icon playing">
                          <span></span><span></span><span></span>
                        </div>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M11 5L6 9H2V15H6L11 19V5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M15.54 8.46A5 5 0 0115.54 15.54" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </button>
                  </div>
                ))}
              </div>

              <div className="notice-footer">
                <button className="clear-notice-btn" onClick={markAllAsRead}>
                  ทำเครื่องหมายอ่านแล้วทั้งหมด
                </button>
                {(speakingId || isSpeakingAll) && (
                  <button className="stop-speech-footer-btn" onClick={stopSpeech}>
                    ⏹️ หยุดการอ่านเสียง
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

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
              {/* 1. ตั้งค่าโปรไฟล์ผู้ใช้ (No emoji) */}
              <button
                className="dropdown-menu-item dropdown-item-1"
                onClick={() => {
                  console.log('ตั้งค่าโปรไฟล์ผู้ใช้');
                  setIsDropdownOpen(false);
                }}
              >
                ตั้งค่าโปรไฟล์ผู้ใช้
              </button>

              {/* 2. สลับธีม */}
              <button
                className="dropdown-menu-item dropdown-item-2 theme-toggle-btn"
                onClick={() => {
                  onToggleTheme();
                }}
              >
                <span className="theme-toggle-text">
                  {isDarkMode ? 'พื้นหลังโหมดสว่าง' : 'พื้นหลังโหมดมืด'}
                </span>
                <span className="theme-toggle-icon-wrapper">
                  {isDarkMode ? (
                    <svg className="theme-icon icon-sun" width="18" height="18" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
                      <path fill="#FFC011" d="M 24.90625 3.96875 C 24.863281 3.976563 24.820313 3.988281 24.78125 4 C 24.316406 4.105469 23.988281 4.523438 24 5 L 24 11 C 23.996094 11.359375 24.183594 11.695313 24.496094 11.878906 C 24.808594 12.058594 25.191406 12.058594 25.503906 11.878906 C 25.816406 11.695313 26.003906 11.359375 26 11 L 26 5 C 26.011719 4.710938 25.894531 4.433594 25.6875 4.238281 C 25.476563 4.039063 25.191406 3.941406 24.90625 3.96875 Z M 10.65625 9.84375 C 10.28125 9.910156 9.980469 10.183594 9.875 10.546875 C 9.769531 10.914063 9.878906 11.304688 10.15625 11.5625 L 14.40625 15.8125 C 14.648438 16.109375 15.035156 16.246094 15.410156 16.160156 C 15.78125 16.074219 16.074219 15.78125 16.160156 15.410156 C 16.246094 15.035156 16.109375 14.648438 15.8125 14.40625 L 11.5625 10.15625 C 11.355469 9.933594 11.054688 9.820313 10.75 9.84375 C 10.71875 9.84375 10.6875 9.84375 10.65625 9.84375 Z M 39.03125 9.84375 C 38.804688 9.875 38.59375 9.988281 38.4375 10.15625 L 34.1875 14.40625 C 33.890625 14.648438 33.753906 15.035156 33.839844 15.410156 C 33.925781 15.78125 34.21875 16.074219 34.589844 16.160156 C 34.964844 16.246094 35.351563 16.109375 35.59375 15.8125 L 39.84375 11.5625 C 40.15625 11.265625 40.246094 10.800781 40.0625 10.410156 C 39.875 10.015625 39.460938 9.789063 39.03125 9.84375 Z M 24.90625 15 C 24.875 15.007813 24.84375 15.019531 24.8125 15.03125 C 24.75 15.035156 24.6875 15.046875 24.625 15.0625 C 24.613281 15.074219 24.605469 15.082031 24.59375 15.09375 C 19.289063 15.320313 15 19.640625 15 25 C 15 30.503906 19.496094 35 25 35 C 30.503906 35 35 30.503906 35 25 C 35 19.660156 30.746094 15.355469 25.46875 15.09375 C 25.433594 15.09375 25.410156 15.0625 25.375 15.0625 C 25.273438 15.023438 25.167969 15.003906 25.0625 15 C 25.042969 15 25.019531 15 25 15 C 24.96875 15 24.9375 15 24.90625 15 Z M 24.9375 17 C 24.957031 17 24.980469 17 25 17 C 25.03125 17 25.0625 17 25.09375 17 C 29.46875 17.050781 33 20.613281 33 25 C 33 29.421875 29.421875 33 25 33 C 20.582031 33 17 29.421875 17 25 C 17 20.601563 20.546875 17.035156 24.9375 17 Z M 4.71875 24 C 4.167969 24.078125 3.78125 24.589844 3.859375 25.140625 C 3.9375 25.691406 4.449219 26.078125 5 26 L 11 26 C 11.359375 26.003906 11.695313 25.816406 11.878906 25.503906 C 12.058594 25.191406 12.058594 24.808594 11.878906 24.496094 C 11.695313 24.183594 11.359375 23.996094 11 24 L 5 24 C 4.96875 24 4.9375 24 4.90625 24 C 4.875 24 4.84375 24 4.8125 24 C 4.78125 24 4.75 24 4.71875 24 Z M 38.71875 24 C 38.167969 24.078125 37.78125 24.589844 37.859375 25.140625 C 37.9375 25.691406 38.449219 26.078125 39 26 L 45 26 C 45.359375 26.003906 45.695313 25.816406 45.878906 25.503906 C 46.058594 25.191406 46.058594 24.808594 45.878906 24.496094 C 45.695313 24.183594 45.359375 23.996094 45 24 L 39 24 C 38.96875 24 38.9375 24 38.90625 24 C 38.875 24 38.84375 24 38.8125 24 C 38.78125 24 38.75 24 38.71875 24 Z M 15 33.875 C 14.773438 33.90625 14.5625 34.019531 14.40625 34.1875 L 10.15625 38.4375 C 9.859375 38.679688 9.722656 39.066406 9.808594 39.441406 C 9.894531 39.8125 10.1875 40.105469 10.558594 40.191406 C 10.933594 40.277344 11.320313 40.140625 11.5625 39.84375 L 15.8125 35.59375 C 16.109375 35.308594 16.199219 34.867188 16.039063 34.488281 C 15.882813 34.109375 15.503906 33.867188 15.09375 33.875 C 15.0625 33.875 15.03125 33.875 15 33.875 Z M 34.6875 33.875 C 34.3125 33.941406 34.011719 34.214844 33.90625 34.578125 C 33.800781 34.945313 33.910156 35.335938 34.1875 35.59375 L 38.4375 39.84375 C 38.679688 40.140625 39.066406 40.277344 39.441406 40.191406 C 39.8125 40.105469 40.105469 39.8125 40.191406 39.441406 C 40.277344 39.066406 40.140625 38.679688 39.84375 38.4375 L 35.59375 34.1875 C 35.40625 33.988281 35.148438 33.878906 34.875 33.875 C 34.84375 33.875 34.8125 33.875 34.78125 33.875 C 34.75 33.875 34.71875 33.875 34.6875 33.875 Z M 24.90625 37.96875 C 24.863281 37.976563 24.820313 37.988281 24.78125 38 C 24.316406 38.105469 23.988281 38.523438 24 39 L 24 45 C 23.996094 45.359375 24.183594 45.695313 24.496094 45.878906 C 24.808594 46.058594 25.191406 46.058594 25.503906 45.878906 C 25.816406 45.695313 26.003906 45.359375 26 45 L 26 39 C 26.011719 38.710938 25.894531 38.433594 25.6875 38.238281 C 25.476563 38.039063 25.191406 37.941406 24.90625 37.96875 Z"/>
                    </svg>
                  ) : (
                    <svg className="theme-icon icon-moon" width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path fill="#192943" d="M12 11.807A9.002 9.002 0 0 1 10.049 2a9.942 9.942 0 0 0-5.12 2.735c-3.905 3.905-3.905 10.237 0 14.142 3.906 3.906 10.237 3.905 14.143 0a9.946 9.946 0 0 0 2.735-5.119A9.003 9.003 0 0 1 12 11.807z"/>
                    </svg>
                  )}
                </span>
              </button>

              {/* 3. ล้างข้อมูลทดสอบในระบบ */}
              <button
                className="dropdown-menu-item dropdown-item-reset"
                onClick={async () => {
                  setIsDropdownOpen(false);
                  if (!window.confirm('คุณต้องการล้างข้อมูลทดสอบ (ผู้ป่วย คิว และการคัดกรอง) ทั้งหมดในระบบของคุณใช่หรือไม่?')) {
                    return;
                  }
                  try {
                    const token = localStorage.getItem('token');
                    const res = await fetch('/api/system/reset-db', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                      }
                    });
                    if (res.ok) {
                      window.location.reload();
                    }
                  } catch (err) {
                    console.error('Reset system error:', err);
                  }
                }}
              >
                <span>ล้างข้อมูลทดสอบในระบบ</span>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#2563EB' }}>
                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/>
                </svg>
              </button>

              {/* 4. ออกจากระบบ (Text align center, no emoji) */}
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

    </header>
  );
}

export default Topbar;
