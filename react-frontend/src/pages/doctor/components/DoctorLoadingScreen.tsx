import React from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
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

interface DoctorLoadingScreenProps {
  /** ข้อความบอกว่ากำลังโหลดอะไรอยู่ ไม่ส่งมาก็ได้ จะใช้ข้อความกลางๆ */
  message?: string;
}

export const DoctorLoadingScreen: React.FC<DoctorLoadingScreenProps> = ({ message }) => {
  const { language } = useLanguage();

  return (
    <div
      role="status"
      aria-live="polite"
      className="min-h-[calc(100vh-134px)] flex flex-col items-center justify-center -translate-y-12 gap-4 text-center px-6"
    >
      <div className="relative">
        {/* วงแหวนจางด้านหลัง ทำให้เห็นว่าเป็นวงกลมเต็มวงขณะที่ตัวหมุนวิ่งอยู่ */}
        <div className="w-14 h-14 rounded-full border-4 border-slate-200" />
        <Loader2 className="w-14 h-14 text-blue-600 animate-spin absolute inset-0" />
      </div>

      <div className="space-y-1">
        <p className="text-base font-bold text-slate-800">
          {message || (language === 'th' ? 'กำลังโหลดข้อมูลจากฐานข้อมูล' : 'Loading data from the database')}
        </p>
        <p className="text-xs text-slate-500">
          {language === 'th' ? 'กรุณารอสักครู่' : 'Please wait'}
        </p>
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
  onRetry?: () => void;
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
  const isTh = language === 'th';
  const { title, detail } = toHumanMessage(message, isTh);

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
          onClick={onRetry}
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
