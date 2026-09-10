import React from 'react';
import { AlertCircle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

/**
 * ==============================================================================
 * หน้าจอรอโหลดข้อมูลจากฐานข้อมูล (ใช้ร่วมกันทุกหน้าของ Role แพทย์)
 * ==============================================================================
 * ปัญหาเดิม: พอ log in เข้ามา React วาดหน้าเสร็จก่อนที่ข้อมูลจาก backend จะมาถึง
 * แพทย์จึงเห็นเลข 0 ทั้งสามการ์ด และตารางขึ้นว่า "ไม่พบข้อมูลผู้ป่วยตามเงื่อนไขที่เลือก"
 * อยู่ประมาณ 1 วินาที ก่อนที่ข้อมูลจริงจะเด้งเข้ามาแทน
 *
 * ในบริบทคลินิก ข้อความนั้นอันตราย เพราะมันไม่ได้แปลว่า "ยังไม่รู้"
 * แต่แปลว่า "รู้แล้วว่าวันนี้ไม่มีคิว" ซึ่งคนละความหมายกันคนละเรื่อง
 * แพทย์ที่เหลือบมองแล้วเดินออกจากห้องไป อาจพลาดคิวที่รออยู่จริง
 *
 * จอนี้จึงมาแทนที่ช่วงเวลานั้น โดยบอกตรงๆ ว่ากำลังโหลด ยังไม่ใช่คำตอบสุดท้าย
 *
 * ------------------------------------------------------------------------------
 * ข้อควรระวัง อย่าเอา isLoading มาคุมจอนี้
 * ------------------------------------------------------------------------------
 * isLoading เป็น true ทุกครั้งที่ยิง API ซึ่งรวมถึงการรีเฟรชเบื้องหลังทุก 4 วินาที
 * และทุกครั้งที่มี WebSocket event เข้ามา (simulator ยิงถี่มาก)
 * ถ้าใช้ isLoading หน้าจะกะพริบเป็นจอโหลดทุกไม่กี่วินาทีจนใช้งานไม่ได้
 * ต้องใช้ isInitialLoading ซึ่งเป็น true แค่รอบแรกรอบเดียวเท่านั้น
 *
 * ------------------------------------------------------------------------------
 * เรื่องความสูง อย่าเปลี่ยนเป็น min-h-[60vh] หรือ h-full
 * ------------------------------------------------------------------------------
 * กล่องนี้เป็นลูกโดยตรงของ main.body-content ซึ่งสูงตามเนื้อหาข้างใน
 * ถ้าไม่บังคับความสูง กล่องจะสูงเท่าข้อความ แล้วการจัดกลางแนวตั้งจะไม่มีผลอะไรเลย
 * ข้อความจะไปกองอยู่ติดขอบบนใต้ Topbar
 *
 * ค่าที่ใช้ min-h-[calc(100vh-134px)] คือความสูงจอเต็ม ลบ Topbar 94px และ padding ล่าง 40px
 * ส่วน -translate-y-12 ยกขึ้นจากจุดกึ่งกลางอีก 48px ให้ดูสมดุลกว่าอยู่กลางเป๊ะ
 * ตัวเลขชุดนี้ยกมาจากหน้า "ยังไม่ได้เลือกผู้ป่วย" ใน DoctorExaminationPage.tsx
 * เพื่อให้ทุกจอสถานะว่างของ role แพทย์อยู่ระดับความสูงเดียวกันหมด
 */

/* --------------------------------------------------------------------------
   CSS Keyframes สำหรับ loading animation
   ใส่ไว้ใน style tag เพราะ Tailwind ไม่มี keyframes เหล่านี้ในตัว
   -------------------------------------------------------------------------- */
const loadingStyles = `
@keyframes doctor-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
@keyframes doctor-skeleton-shimmer {
  0% { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}
`;

/** กล่องสี่เหลี่ยมกระพริบ shimmer ใช้เป็นโครงตัวแทนเนื้อหาที่ยังไม่โหลด */
const Bone: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className = '', style }) => (
  <div
    className={`rounded-md ${className}`}
    style={{
      background: 'linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%)',
      backgroundSize: '400px 100%',
      animation: 'doctor-skeleton-shimmer 1.6s ease-in-out infinite',
      ...style,
    }}
  />
);

/** ซ่อน scrollbar ระหว่างที่หน้ายังไม่มีข้อมูลพร้อมใช้งาน และคืนค่าเดิมเมื่อออกจากสถานะนี้ */
function usePageScrollLock(): void {
  React.useLayoutEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);
}

interface DoctorLoadingScreenProps {
  /** ข้อความบอกว่ากำลังโหลดอะไรอยู่ ไม่ส่งมาก็ได้ จะใช้ข้อความกลางๆ */
  message?: string;
}

export const DoctorLoadingScreen: React.FC<DoctorLoadingScreenProps> = ({ message }) => {
  const { language } = useLanguage();
  usePageScrollLock();

  return (
    <div role="status" aria-live="polite" className="relative">
      {/* Inject keyframes */}
      <style>{loadingStyles}</style>

      {/* --- วงกลมหมุน + ข้อความ (ซ่อนไว้ก่อนเพื่อทดสอบ) ---
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center -translate-y-12 pointer-events-none">
        <div className="flex flex-col items-center gap-4">
          <div className="relative" style={{ width: 48, height: 48 }}>
            <div
              className="absolute inset-0 rounded-full"
              style={{ border: '3.5px solid #e2e8f0' }}
            />
            <svg
              viewBox="0 0 48 48"
              className="absolute inset-0"
              style={{ width: 48, height: 48, animation: 'doctor-spin 1s linear infinite' }}
            >
              <circle
                cx="24" cy="24" r="21"
                fill="none"
                strokeWidth="3.5"
                strokeLinecap="round"
                stroke="#2563eb"
                strokeDasharray="92 132"
              />
            </svg>
          </div>
          <div className="space-y-1 text-center">
            <p className="text-base font-bold text-slate-800">
              {message || (language === 'th' ? 'กำลังโหลดข้อมูลจากฐานข้อมูล' : 'Loading data from the database')}
            </p>
            <p className="text-xs text-slate-500">
              {language === 'th' ? 'กรุณารอสักครู่' : 'Please wait'}
            </p>
          </div>
        </div>
      </div>
      */}

      <div className="max-w-7xl mx-auto space-y-8">
        {/* --- Section: Stat Cards skeleton --- */}
        <section className="space-y-4">
          <Bone className="!rounded-lg" style={{ width: 140, height: 22 }} />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs flex items-center justify-between"
              >
                <div className="space-y-3">
                  <Bone style={{ width: 100, height: 14 }} />
                  <Bone className="!rounded-lg" style={{ width: 56, height: 36 }} />
                </div>
                <Bone className="!rounded-2xl" style={{ width: 48, height: 48 }} />
              </div>
            ))}
          </div>
        </section>

        {/* --- Section: Queue Table skeleton --- */}
        <section className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            {/* Filter tabs skeleton */}
            <div className="px-6 pt-5 pb-3 flex items-center gap-3">
              {[72, 64, 80, 88].map((w, i) => (
                <Bone key={i} className="!rounded-full" style={{ width: w, height: 32 }} />
              ))}
              <div className="flex-1" />
              <Bone className="!rounded-xl" style={{ width: 200, height: 36 }} />
            </div>

            {/* Table header skeleton */}
            <div className="px-6 py-3 border-t border-slate-100 grid grid-cols-7 gap-4">
              {[48, 56, 80, 40, 60, 64, 72].map((w, i) => (
                <Bone key={i} style={{ width: w, height: 12 }} />
              ))}
            </div>

            {/* Table rows skeleton */}
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="px-6 py-4 border-t border-slate-100 grid grid-cols-7 gap-4 items-center"
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                <Bone style={{ width: 40, height: 16 }} />
                <Bone style={{ width: 48, height: 16 }} />
                <Bone style={{ width: '80%', height: 16 }} />
                <Bone style={{ width: 36, height: 16 }} />
                <Bone className="!rounded-full" style={{ width: 64, height: 24 }} />
                <Bone style={{ width: 72, height: 16 }} />
                <Bone className="!rounded-xl" style={{ width: 80, height: 32 }} />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

/**
 * หน้าจอแจ้งว่าต่อฐานข้อมูลไม่ได้
 *
 * แยกจากข้อความ "ไม่พบข้อมูลผู้ป่วย" ให้ชัดเจน เพราะสองอย่างนี้ต้องทำคนละอย่าง
 *   ไม่พบข้อมูล  = ระบบทำงานปกติ วันนี้ไม่มีคิวจริงๆ  -> ไม่ต้องทำอะไร
 *   ต่อไม่ได้    = ระบบมีปัญหา ไม่รู้ว่ามีคิวหรือเปล่า -> ต้องแจ้งคนดูแลระบบ
 */
interface DoctorErrorScreenProps {
  message: string;
  onRetry?: () => void | Promise<void>;
}

/**
 * แปลงข้อความ error ดิบ ให้เป็นภาษาที่แพทย์อ่านแล้วรู้ว่าต้องทำอะไรต่อ
 *
 * ห้ามเอาข้อความดิบขึ้นหน้าจอตรงๆ เด็ดขาด
 * ข้อความอย่าง "Failed to fetch" เป็นคำที่ JavaScript โยนออกมาให้โปรแกรมเมอร์ดีบัก
 * แพทย์อ่านแล้วไม่ได้อะไรเลย นอกจากรู้สึกว่าระบบพัง แต่ไม่รู้ว่าต้องทำยังไงต่อ
 *
 * ที่มาของแต่ละข้อความ
 *   "Failed to fetch" / "NetworkError" / "Load failed"
 *       = request ออกจากเบราว์เซอร์ไปแล้วแต่ไปไม่ถึงเซิร์ฟเวอร์เลย
 *         สาเหตุที่เจอบ่อยสุดคือ backend ยังไม่ได้เปิด รองลงมาคือเน็ตหลุด
 *   401 / 403 = token หมดอายุหรือไม่มีสิทธิ์ ต้องเข้าสู่ระบบใหม่
 *   500 / 502 / 503 = ไปถึงเซิร์ฟเวอร์แล้ว แต่เซิร์ฟเวอร์ทำงานผิดพลาด
 *                     (มักเป็นฝั่ง backend ต่อฐานข้อมูลไม่ได้)
 *
 * ถ้าไม่เข้าเคสไหนเลย จะคืน null แล้วหน้าจอจะโชว์ข้อความเดิมจาก backend
 * ซึ่งปกติเป็นภาษาไทยที่เขียนไว้แล้ว เช่น "ไม่สามารถโหลดคิวผู้ป่วยได้"
 */
function toHumanMessage(raw: string, isTh: boolean): { title: string; detail: string } {
  const m = (raw || '').toLowerCase();

  if (m.includes('failed to fetch') || m.includes('networkerror') || m.includes('load failed') || m.includes('fetch failed')) {
    return isTh
      ? { title: 'ติดต่อเซิร์ฟเวอร์ไม่ได้', detail: 'เซิร์ฟเวอร์อาจยังไม่เปิดทำงาน' }
      : { title: 'Cannot reach the server', detail: 'The server may be offline.' };
  }

  if (m.includes('401') || m.includes('403') || m.includes('unauthorized') || m.includes('forbidden')) {
    return isTh
      ? { title: 'เซสชันหมดอายุ', detail: 'กรุณาเข้าสู่ระบบใหม่' }
      : { title: 'Session expired', detail: 'Please sign in again.' };
  }

  if (m.includes('500') || m.includes('502') || m.includes('503') || m.includes('504')) {
    return isTh
      ? { title: 'เซิร์ฟเวอร์ทำงานผิดพลาด', detail: 'กรุณาแจ้งผู้ดูแลระบบ' }
      : { title: 'Server error', detail: 'Please contact your system administrator.' };
  }

  // ไม่รู้จักรูปแบบนี้ ใช้ข้อความจาก backend ตามเดิม (ปกติเป็นภาษาไทยอยู่แล้ว)
  return isTh
    ? { title: 'โหลดข้อมูลไม่สำเร็จ', detail: raw }
    : { title: 'Could not load data', detail: raw };
}

export const DoctorErrorScreen: React.FC<DoctorErrorScreenProps> = ({ message, onRetry }) => {
  const { language } = useLanguage();
  const [isRetrying, setIsRetrying] = React.useState(false);
  usePageScrollLock();
  const isTh = language === 'th';
  const { title, detail } = toHumanMessage(message, isTh);

  const handleRetry = async () => {
    if (!onRetry || isRetrying) return;

    const startedAt = Date.now();
    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      // API บางข้อผิดพลาดตอบกลับแทบจะทันที ทำให้ Skeleton กระพริบจนมองไม่เห็น
      // แสดงอย่างน้อย 800ms แต่หากโหลดจริงนานกว่านั้นจะรอจนคำขอจบตามปกติ
      const remainingDelay = Math.max(0, 800 - (Date.now() - startedAt));
      if (remainingDelay > 0) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, remainingDelay));
      }
      setIsRetrying(false);
    }
  };

  if (isRetrying) {
    return <DoctorLoadingScreen message={isTh ? 'กำลังลองเชื่อมต่ออีกครั้ง' : 'Retrying connection'} />;
  }

  return (
    <div className="min-h-[calc(100vh-134px)] flex flex-col items-center justify-center -translate-y-12 gap-4 text-center px-6">
      <div className="w-14 h-14 rounded-full bg-red-50 border border-red-200 flex items-center justify-center">
        <AlertCircle className="w-7 h-7 text-red-600" />
      </div>

      <div className="space-y-1.5 max-w-md">
        <p className="text-base font-bold text-slate-800">{title}</p>
        <p className="text-xs text-slate-500 leading-relaxed break-words">{detail}</p>
      </div>

      {onRetry && (
        <button
          type="button"
          onClick={() => { void handleRetry(); }}
          className="px-4 py-2 bg-[#2563eb] hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-md active:scale-95 transition-all cursor-pointer"
        >
          {isTh ? 'ลองใหม่อีกครั้ง' : 'Try again'}
        </button>
      )}

      {/* ข้อความดิบยังต้องเข้าถึงได้ เพราะเวลาโทรแจ้งฝ่ายไอทีเขาจะถามหาสิ่งนี้
          แต่ต้องพับเก็บไว้ ไม่ใช่โยนใส่หน้าแพทย์ตั้งแต่แรก
          แสดงเฉพาะตอนที่ข้อความดิบไม่ใช่ตัวเดียวกับที่โชว์อยู่แล้ว จะได้ไม่ซ้ำซ้อน */}
      {message && message !== detail && (
        <details className="mt-1 max-w-md w-full">
          <summary className="text-[11px] text-slate-400 hover:text-slate-600 cursor-pointer text-center transition-colors">
            {isTh ? 'รายละเอียดทางเทคนิค' : 'Technical details'}
          </summary>
          {/* ต้องใส่ text-center ที่ตัว p เอง
              กล่องนอกสุดตั้ง text-center ไว้แล้วก็จริง แต่ details/summary
              ของเบราว์เซอร์ตั้ง text-align มาเองในสไตล์เริ่มต้น ค่าจึงไม่ตกทอดลงมา */}
          <p className="mt-2 text-[11px] font-mono text-center text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 break-words">
            {message}
          </p>
        </details>
      )}
    </div>
  );
};
