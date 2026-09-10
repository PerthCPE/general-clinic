import React, { useState } from 'react';
import type { Patient, PastVisitRecord, PrescriptionItem } from '../types';
import { matchPatientSearch } from '../utils/searchUtils';
import {
  Search,
  Stethoscope,
  ChevronRight,
  Calendar,
  Clock,
  Printer,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  HeartPulse,
  History,
  User,
  X,
  FileCheck,
  ArrowLeft,
  Edit3,
  Filter,
  CheckCircle2,
  Phone,
  Shield
} from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import { CopyableText } from './CopyableText';
import { useLanguage } from '../context/LanguageContext';
import { translateClinicalText } from '../utils/clinicalTranslation';
import { StatusFilterTabs } from './StatusFilterTabs';
import { displayVN } from '../utils/vnGenerator';
import { formatNationalId, rawNationalId } from '../utils/nationalId';
import { fmtVital } from '../utils/vitals';

/**
 * ==============================================================================
 * Patient Medical Records & History View (PatientRecordsView.tsx)
 * ==============================================================================
 * หน้าจอค้นหาและดูประวัติการตรวจรักษาเวชระเบียนย้อนหลังของผู้ป่วย (EMR History):
 * 1. ค้นหาผู้ป่วยจาก ชื่อ, HN, VN, เลขบัตรประชาชน, เบอร์โทร
 * 2. แสดงประวัติการรับบริการย้อนหลัง (Past Visit Records) แยกตามวันที่
 * 3. แสดงประวัติแพ้ยา (Drug Allergies) สัญญาณชีพ และการวินิจฉัยโรคในอดีต
 * 4. พิมพ์ใบรับรองแพทย์ / ใบสรุปประวัติการตรวจรักษา
 *
 * 📍 จุดที่ใช้แก้ไข/ปรับแต่ง (Customization Guide):
 * - activeTab: สลับระหว่าง 'history' (ประวัติย้อนหลัง) และ 'profile' (ข้อมูลส่วนตัว/สิทธิการรักษา)
 * - handlePrintMedicalCertificate: ฟังก์ชันสั่งพิมพ์ใบรับรองแพทย์
 */
interface PatientRecordsViewProps {
  patients: Patient[];
  onExamine: (patient: Patient) => void;
  selectedPatient?: Patient | null;
  onSelectPatient?: (patient: Patient | null) => void;
}

/**
 * ==============================================================================
 * ช่องแสดงข้อมูลหนึ่งหัวข้อในการ์ดประวัติการรักษา
 * ==============================================================================
 * ใช้หน้าตาเดียวกับฟอร์มในหน้า "บันทึกการตรวจ" คือหัวข้อตัวหนาอยู่บน
 * แล้วมีกล่องพื้นอ่อนอยู่ล่าง เพื่อให้แพทย์ที่สลับมาดูประวัติเห็นโครงเดียวกัน
 * ไม่ต้องเรียนรู้ layout ใหม่
 *
 * ทำไมต้องโชว์ทุกหัวข้อแม้ไม่มีข้อมูล (ขึ้น "-" แทน)
 *   ถ้าซ่อนหัวข้อที่ว่าง แพทย์จะแยกไม่ออกระหว่าง "ไม่ได้บันทึก" กับ "ไม่มีหัวข้อนี้"
 *   และจำนวนช่องจะไม่เท่ากันในแต่ละครั้ง ทำให้กวาดตาเทียบข้ามครั้งไม่ได้
 *   การเห็น "-" บอกชัดว่าหัวข้อนี้มีอยู่ แต่วันนั้นแพทย์ไม่ได้กรอก
 */
/**
 * ==============================================================================
 * ป้าย "ไม่มีข้อมูล" — ใช้แทนค่าตัวอย่างที่เคยเขียนตายไว้ในโค้ด
 * ==============================================================================
 * เดิมช่องที่ backend ไม่ได้ส่งค่ามา จะ fallback เป็นข้อมูลสมมติที่ดูสมจริงมาก
 *
 *   หมู่โลหิต       -> "หมู่ O (O Positive)"
 *   ที่อยู่          -> "123/45 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110"
 *   เบอร์โทรศัพท์    -> "081-234-5678"
 *   อาชีพ           -> "วิศวกรซอฟต์แวร์"
 *   วันเกิด         -> "1984-03-15"
 *   สิทธิการรักษา    -> "บัตรทอง (UC)"
 *   วันที่/เวลารับบริการ -> "2026-07-23 08:45"
 *
 * ทุกตัวหน้าตาเหมือนข้อมูลจริงทุกประการ ไม่มีอะไรบอกว่าเป็นของปลอม
 * แพทย์ที่เปิดดูจึงไม่มีทางรู้ว่ากำลังอ่านข้อมูลของผู้ป่วยคนนี้จริง
 * หรืออ่านค่าตัวอย่างที่โปรแกรมเมอร์ใส่ไว้ตอนทำดีไซน์
 *
 * อันตรายที่สุดคือหมู่โลหิต — ขึ้น "O Positive" ให้ทุกคนที่ไม่มีข้อมูลในระบบ
 * ถ้ามีใครหยิบไปใช้อ้างอิงตอนฉุกเฉิน คือให้เลือดผิดหมู่
 * รองลงมาคือเบอร์โทรกับที่อยู่ ซึ่งใช้ตามตัวผู้ป่วยกลับมาฟังผลไม่ได้เลย
 *
 * ช่องว่างที่บอกตรงๆ ว่าไม่มีข้อมูล ทำให้คนอ่านไปหาข้อมูลจากที่อื่นต่อ
 * ส่วนข้อมูลปลอมที่ดูน่าเชื่อ ทำให้คนอ่านหยุดหา — ซึ่งแย่กว่ากันมาก
 */
const NoData: React.FC = () => {
  const { language } = useLanguage();
  return (
    <span className="font-normal text-slate-400">
      {language === 'th' ? 'ไม่มีข้อมูล' : 'No data'}
    </span>
  );
};

/**
 * ป้าย "ยังไม่ได้ซักประวัติ" สำหรับช่องที่คำตอบเป็นมี/ไม่มี
 *
 * แยกจาก NoData เพราะช่องพวกนี้เคย fallback เป็น "ไม่สูบบุหรี่" / "ไม่ดื่มแอลกอฮอล์"
 * / "ไม่มี" ซึ่งไม่ใช่แค่ข้อมูลปลอม แต่เป็นการ "ตอบแทนผู้ป่วย" ว่าไม่มีความเสี่ยง
 *
 * "ยังไม่ได้ถาม" กับ "ถามแล้วตอบว่าไม่มี" นำไปสู่การตัดสินใจคนละทาง
 * เช่นผู้ป่วยที่ยังไม่เคยถูกซักว่าสูบบุหรี่ไหม ควรถูกถามก่อนสั่งยาบางกลุ่ม
 * แต่ถ้าหน้าจอขึ้นว่า "ไม่สูบบุหรี่" ไปแล้ว จะไม่มีใครถามอีกเลย
 */
const NotAsked: React.FC = () => {
  const { language } = useLanguage();
  return (
    <span className="text-slate-400">
      {language === 'th' ? 'ยังไม่ได้ซักประวัติ' : 'Not recorded'}
    </span>
  );
};

/** ตรวจวันที่รับบริการกับวันปัจจุบันตามเวลาท้องถิ่นของเครื่องผู้ใช้ */
const isVisitToday = (visitDate?: string): boolean => {
  const value = (visitDate || '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const today = new Date();
  const todayKey = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');

  return value === todayKey;
};

const HistoryField: React.FC<{ label: string; value?: string }> = ({ label, value }) => {
  const text = (value || '').trim();
  return (
    <div className={`rounded-xl border px-3 py-2.5 min-h-[62px] ${
      text ? 'border-slate-200 bg-slate-50/70' : 'border-slate-100 bg-slate-50/40'
    }`}>
      <span className="block text-[11px] font-semibold text-slate-500 mb-1">{label}</span>
      <div className={`leading-relaxed whitespace-pre-line ${
        text ? 'text-slate-900 font-medium' : 'text-slate-400'
      }`}>
        {text || '-'}
      </div>
    </div>
  );
};

/** หัวข้อกลุ่มในการ์ดประวัติ ใช้ขนาดและน้ำหนักเดียวกับหัวข้อในหน้าบันทึกการตรวจ */
/**
 * รวมรายละเอียดการใช้ยา 1 รายการให้เป็นข้อความหลายบรรทัด
 * ใช้กับหัวข้อ "ยาที่แพทย์สั่งจ่าย" ในประวัติการมาตรวจ
 *
 * ชื่อหัวข้อแต่ละบรรทัดใช้คำเดียวกับช่องกรอกในหน้าบันทึกการตรวจ (แท็บการสั่งยา)
 * เพื่อให้แพทย์อ่านประวัติแล้วเทียบกับฟอร์มที่ตัวเองกรอกได้ทันที
 *
 * ที่มาของข้อมูล:
 * ตาราง dispensings ของห้องยามีแค่ 3 ช่อง (quantity, dosage, instructions)
 * เก็บครบ 7 ช่องที่แพทย์กรอกไม่ได้ ความถี่กับระยะเวลาเคยหายไปทั้งหมด
 * จึงเพิ่มคอลัมน์ examinations.prescription_detail เก็บใบสั่งยาฉบับเต็มเป็น JSON
 * ค่าที่อ่านมาตรงนี้จึงเป็นสิ่งที่แพทย์กรอกไว้จริงทุกช่อง
 *
 * เวชระเบียนเก่าที่บันทึกก่อนมีคอลัมน์นั้น จะได้ข้อมูลไม่ครบ (ไม่มีความถี่/ระยะเวลา)
 * บรรทัดที่ไม่มีข้อมูลจะถูกข้ามไปเลย ไม่โชว์หัวข้อเปล่าๆ ค้างไว้
 */
function buildPrescriptionDetail(item: PrescriptionItem, language: string): string {
  const isTh = language === 'th';
  const lines: string[] = [];

  const push = (label: string, value?: string | number) => {
    const text = String(value ?? '').trim();
    if (text) lines.push(`${label}: ${text}`);
  };

  push(isTh ? 'ขนาดการใช้ยา' : 'Dosage', item.dosage);
  push(isTh ? 'ความถี่' : 'Frequency', item.frequency);
  push(isTh ? 'ระยะเวลา' : 'Duration', item.duration);
  push(isTh ? 'จำนวน' : 'Quantity', item.quantity > 0 ? item.quantity : '');
  push(isTh ? 'ทางให้ยา' : 'Route', item.route);
  push(isTh ? 'เวลารับประทาน' : 'Timing', item.timing);
  push(isTh ? 'คำแนะนำพิเศษ / ฉลากยา' : 'Special Instructions', item.specialInstructions);

  return lines.join('\n');
}

/**
 * ==============================================================================
 * ป้ายสถานะรวมของการมาตรวจ 1 ครั้ง (ในมุมของผู้ป่วย ไม่ใช่มุมของแพทย์)
 * ==============================================================================
 * ต่างจากป้ายสถานะคิว (รอตรวจ / กำลังตรวจ / ตรวจเสร็จ) ซึ่งจบแค่ตอนแพทย์ปิดเคส
 * ป้ายนี้ตอบว่า "ผู้ป่วยคนนี้ได้รับบริการจนจบจริงหรือเปล่า"
 * คือต้องผ่านครบทั้งตรวจ รับยา และชำระเงิน
 *
 * แพทย์ต้องแยกออกว่าเคสไหนตกหล่นระหว่างทาง เช่นตรวจแล้วแต่ไม่ได้ไปรับยา
 * เพราะครั้งหน้าที่ผู้ป่วยกลับมา จะได้รู้ว่ายาที่สั่งไปครั้งก่อนไม่เคยถึงมือคนไข้
 *
 * ค่าคำนวณมาจาก backend (ดู computeVisitProgress) ไม่ได้คิดที่หน้าจอ
 * เพราะต้องดูตารางของห้องยาและการเงินประกอบ ซึ่งหน้าจอแพทย์ไม่ได้ดึงมา
 *
 * เวชระเบียนเก่าที่ backend ยังไม่ได้ส่ง progress มา จะไม่แสดงป้ายเลย
 * ดีกว่าเดาแล้วแสดงผิด เพราะป้ายนี้ใช้ตัดสินใจทางการรักษา
 */
const VisitProgressBadge: React.FC<{ visit: PastVisitRecord; language: string }> = ({
  visit,
  language,
}) => {
  if (!visit.progress) return null;

  const isTh = language === 'th';
  const badgeLayout = 'inline-flex min-w-[104px] items-center justify-center whitespace-nowrap text-center';

  if (visit.progress === 'completed') {
    return (
      <span className={`${badgeLayout} text-[10px] font-extrabold text-emerald-800 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-md`}>
        {isTh ? 'เสร็จสิ้น' : 'Completed'}
      </span>
    );
  }

  if (visit.progress === 'in_progress') {
    return (
      <span className={`${badgeLayout} text-[10px] font-extrabold text-amber-800 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-md`}>
        {isTh ? 'กำลังดำเนินการ' : 'In Progress'}
      </span>
    );
  }

  // ยกเลิก — ต่อท้ายด้วยสาเหตุ เพื่อให้แพทย์รู้ว่าตกหล่นที่ขั้นตอนไหน
  const reasonText: Record<string, { th: string; en: string }> = {
    no_medicine: { th: ' (ไม่ได้รับยา)', en: ' (No Medicine)' },
    unpaid: { th: ' (ยังไม่ชำระค่าบริการ)', en: ' (Unpaid)' },
  };
  const suffix = reasonText[visit.progressReason || ''];

  return (
    <span className={`${badgeLayout} text-[10px] font-extrabold text-rose-800 bg-rose-100 border border-rose-200 px-2 py-0.5 rounded-md`}>
      {isTh ? 'ยกเลิกการรับบริการ' : 'Cancelled'}
      {suffix ? (isTh ? suffix.th : suffix.en) : ''}
    </span>
  );
};

/**
 * ยา 1 รายการในประวัติ แสดงเป็นแถวพับเก็บได้
 *
 * ปกติแสดงแค่ชื่อยากับรหัสยา กดที่แถวถึงจะกางรายละเอียดออกมา
 * เหตุผล: ถ้ากางรายละเอียด 7 บรรทัดของทุกตัวไว้ตลอด
 * เคสที่สั่งยา 5-6 ตัวจะยาวเป็นหน้าจอ ต้องเลื่อนผ่านไปนานกว่าจะถึงหัวข้อถัดไป
 * ส่วนใหญ่แพทย์อยากรู้แค่ว่า "ครั้งก่อนได้ยาอะไรไปบ้าง" ชื่อยาอย่างเดียวก็พอ
 *
 * เก็บสถานะเปิด/ปิดไว้ในตัวเอง ไม่ต้องยกไปไว้ที่การ์ดแม่
 * เพราะแต่ละแถวเปิดปิดอิสระกัน และไม่มีใครอื่นต้องรู้ว่าแถวไหนเปิดอยู่
 */
const HistoryPrescriptionRow: React.FC<{
  index: number;
  item: PrescriptionItem;
  language: string;
}> = ({ index, item, language }) => {
  const [isOpen, setIsOpen] = useState(false);
  const detail = buildPrescriptionDetail(item, language);
  const name = item.medicineName || (language === 'th' ? 'ไม่ระบุชื่อยา' : 'Unnamed');

  return (
    <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-slate-50 transition-colors"
      >
        <span className="text-[13px] font-bold text-slate-800">
          {index + 1}. {name}
          {item.medicineCode ? ` (${item.medicineCode})` : ''}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="px-3 pb-3">
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] leading-relaxed whitespace-pre-line text-slate-800 font-medium">
            {detail || '-'}
          </div>
        </div>
      )}
    </div>
  );
};

const HistorySection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
    <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-3">
      <h5 className="text-sm font-bold text-slate-900">{title}</h5>
    </div>
    <div className="p-4">{children}</div>
  </section>
);

const ProfileSection: React.FC<{
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, icon, children }) => (
  <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
    <div className="flex items-center gap-2.5 border-b border-slate-100 bg-slate-50/70 px-4 py-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
        {icon}
      </span>
      <h3 className="text-sm font-bold text-slate-900">{title}</h3>
    </div>
    <div className="p-4">{children}</div>
  </section>
);

const ProfileField: React.FC<{
  label: string;
  value: React.ReactNode;
  className?: string;
}> = ({ label, value, className = '' }) => (
  <div className={`min-h-[64px] rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5 ${className}`}>
    <span className="mb-1 block text-[11px] font-semibold text-slate-500">{label}</span>
    <div className="font-semibold leading-relaxed text-slate-900">{value}</div>
  </div>
);

/** ข้อความกลุ่มนี้หมายถึง "ไม่มี" จึงไม่ควรถูกเน้นเป็นความเสี่ยง */
const isNegativeClinicalValue = (value: string): boolean =>
  /^(?:-|ไม่มี|ไม่พบ|ปฏิเสธ|ไม่ได้ใช้|ไม่ได้รับประทาน|none\b|no\b|nil\b|nkda\b|nka\b)/i.test(value.trim());

/**
 * ช่องประวัติที่ต้องเตือนแพทย์เมื่อมีข้อมูลจริง
 * ตัวข้อมูลแสดงเป็นข้อความตรง ๆ เพื่อไม่ให้เกิดกรอบซ้อนหลายชั้น
 */
const ClinicalAlertField: React.FC<{
  label: string;
  values?: string[];
  emptyText: string;
}> = ({ label, values, emptyText }) => {
  const items = (values || []).map((value) => value.trim()).filter(Boolean);
  const hasClinicalValue = items.some((value) => !isNegativeClinicalValue(value));

  return (
    <div className={`min-h-[76px] rounded-xl border p-3.5 ${
      hasClinicalValue
        ? 'border-rose-300 bg-rose-50/60'
        : 'border-slate-200 bg-slate-50/60'
    }`}>
      <span className={`mb-2 block text-[11px] font-bold ${
        hasClinicalValue ? 'text-rose-800' : 'text-slate-500'
      }`}>
        {label}
      </span>
      <div className={`font-semibold leading-relaxed ${
        hasClinicalValue ? 'text-rose-900' : 'text-slate-700'
      }`}>
        {items.length > 0 ? items.join(', ') : emptyText}
      </div>
    </div>
  );
};

export const PatientRecordsView: React.FC<PatientRecordsViewProps> = ({
  patients,
  onExamine,
  selectedPatient: selectedPatientProp,
  onSelectPatient
}) => {
  const [search, setSearch] = useState('');
  // Filter status: 'in_progress' | 'waiting' | 'all'
  // ค่าเริ่มต้นเป็น "รอตรวจ" ให้ตรงกับหน้าคิว จะได้ไม่ต้องปรับความเข้าใจตอนสลับหน้า
  const [statusFilter, setStatusFilter] = useState<'in_progress' | 'waiting' | 'completed' | 'all'>('waiting');
  const [selectedPatient, setSelectedPatientState] = useState<Patient | null>(selectedPatientProp || null);

  React.useEffect(() => {
    if (selectedPatientProp !== undefined) {
      setSelectedPatientState(selectedPatientProp);
    }
  }, [selectedPatientProp]);

  const handleSelectPatient = (patient: Patient | null) => {
    setSelectedPatientState(patient);
    setExpandedVisitId(null);
    if (onSelectPatient) {
      onSelectPatient(patient);
    }
  };

  const [activeTab, setActiveTab] = useState<'history' | 'profile'>('history');
  const [historySearch, setHistorySearch] = useState('');
  const [expandedVisitId, setExpandedVisitId] = useState<string | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);

  const { language, t } = useLanguage();

  React.useEffect(() => {
    const handleTabArrowNavigation = (event: KeyboardEvent) => {
      if (
        !selectedPatient ||
        event.defaultPrevented ||
        event.isComposing ||
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')
      ) return;

      const target = event.target;
      if (target instanceof HTMLElement && (
        target.isContentEditable ||
        target.closest('input, textarea, select, [role="textbox"], [role="combobox"], [role="listbox"], [role="slider"], [role="dialog"], dialog')
      )) return;

      const nextTab = event.key === 'ArrowRight' ? 'profile' : 'history';
      if (nextTab === activeTab) return;

      event.preventDefault();
      setActiveTab(nextTab);

      requestAnimationFrame(() => {
        document
          .querySelector<HTMLButtonElement>(`[data-record-tab="${nextTab}"]`)
          ?.focus({ preventScroll: true });
      });
    };

    window.addEventListener('keydown', handleTabArrowNavigation);
    return () => window.removeEventListener('keydown', handleTabArrowNavigation);
  }, [activeTab, selectedPatient]);

  // ผู้ป่วยที่ปิดการตรวจไปแล้ว (รวมที่ส่งต่อห้องยา) — มาจาก /patient-records
  // จึงเห็นย้อนหลังได้ทุกวัน ไม่ใช่เฉพาะคิวของวันนี้
  // ผู้ป่วยที่ลงทะเบียนไว้แล้วแต่ยังไม่เคยเข้าตรวจเลย
  // แฟ้มมีตั้งแต่วันลงทะเบียน แต่ยังไม่มีประวัติการรักษา จึงไม่นับรวมกับคิวที่รออยู่
  const isNewPatient = (p: Patient) => (p.visitCount ?? 0) === 0;

  const isCompletedPatient = (p: Patient) =>
    !isNewPatient(p) && (p.status === 'Completed' || p.status === 'Pending Pharmacy');

  const isActivePatient = (p: Patient) =>
    !isNewPatient(p) &&
    (p.status === 'Waiting' ||
      p.status === 'Screened' ||
      (p.status as string) === 'In Progress' ||
      p.status === 'Examining');

  const inProgressCount = patients.filter(p => !isNewPatient(p) && ((p.status as string) === 'In Progress' || p.status === 'Examining')).length;
  const waitingCount = patients.filter(p => !isNewPatient(p) && p.status === 'Waiting').length;
  const completedCount = patients.filter(isCompletedPatient).length;
  const newPatientCount = patients.filter(isNewPatient).length;
  const activePatientsCount = patients.length;

  const filteredPatients = patients.filter(p => {
    if (statusFilter === 'in_progress') {
      if (isNewPatient(p)) return false;
      if ((p.status as string) !== 'In Progress' && p.status !== 'Examining') return false;
    } else if (statusFilter === 'waiting') {
      if (isNewPatient(p)) return false;
      if (p.status !== 'Waiting') return false;
    } else if (statusFilter === 'completed') {
      if (!isCompletedPatient(p)) return false;
    } else if (statusFilter === 'all') {
      // ทั้งหมด = ทุกคนที่โหลดมา ทั้งที่ยังรอตรวจและที่ตรวจจบไปแล้ว
      // (เดิมกรองเฉพาะคนที่ยัง active ทำให้ผู้ป่วยที่ตรวจเสร็จแล้วหายไป)
      if (!isActivePatient(p) && !isCompletedPatient(p) && !isNewPatient(p) && !search.trim()) return false;
    }

    if (!search.trim()) return true;

    return matchPatientSearch(p, search);
  });

  /**
   * ==========================================================================
   * รวมการรับบริการครั้งปัจจุบัน เข้ากับประวัติย้อนหลังจากฐานข้อมูล
   * ==========================================================================
   * ปัญหาเดิม 2 ข้อ ที่แก้ไว้ตรงนี้
   *
   * 1) เคสวันนี้ขึ้นซ้ำสองแถว
   *    ฝั่งนี้ปั้นแถว "การรับบริการวันนี้" ขึ้นมาเองจากข้อมูลในหน่วยความจำ
   *    แต่ endpoint ประวัติก็คืน visit ของวันนี้มาให้ด้วยอยู่แล้ว
   *    เพราะมันดึงทุก visit ของผู้ป่วยโดยไม่กรองวันที่
   *    ผลคือ VN เดียวกัน เวลาเดียวกัน โผล่ติดกันสองแถว
   *
   * 2) แถวที่ปั้นเองขึ้นว่า "กำลังตรวจวินิจฉัย" ตลอดเวลา
   *    เพราะ selectedRecordPatient มาจาก /patient-records ซึ่งไม่ส่งการวินิจฉัยมา
   *    ช่อง diagnosis จึงตกไปที่ค่าสำรองเสมอ ไม่ว่าฐานข้อมูลจะบันทึกอะไรไว้
   *
   * วิธีแก้: ให้ "ฐานข้อมูลเป็นความจริง" ถ้าประวัติจากฐานข้อมูลมี VN นี้อยู่แล้ว
   * ใช้แถวนั้นเป็นหลัก แล้วเติมเฉพาะรายละเอียดที่ endpoint ประวัติไม่ได้ส่งมา
   */
  const getCombinedHistory = (patient: Patient): PastVisitRecord[] => {
    const list: PastVisitRecord[] = [];

    const pastVisits = patient.pastVisits || [];
    const currentVN = displayVN(patient.vn);

    // รายละเอียดที่มีอยู่แค่ในหน่วยความจำ endpoint ประวัติไม่ได้ส่งมา
    const liveDetails = {
      chiefComplaint: patient.chiefComplaint || '',
      prescription: patient.prescription || (patient.prescriptions && patient.prescriptions.length > 0
        ? patient.prescriptions.map(p => p.medicineName).join(', ')
        : undefined),
      prescriptionsList: patient.prescriptions,
      doctorNotes: patient.assessmentNotes || patient.clinicalNotes || patient.treatmentPlan,
    };

    const alreadyInHistory = !!currentVN && pastVisits.some((v) => v.vn === currentVN);

    // ยังไม่มีในฐานข้อมูล (เพิ่งเปิดเคส ยังไม่ได้บันทึกอะไร) ค่อยปั้นแถวขึ้นมาเอง
    if (!alreadyInHistory && (patient.chiefComplaint || patient.diagnosis || patient.primaryDiagnosis)) {
      list.push({
        id: `current-${patient.id}`,
        vn: currentVN,
        visitDate: patient.visitDate || '',
        visitTime: patient.visitTime || '',
        doctorName: language === 'th' ? 'แพทย์ประจำคลินิก (Current Session)' : 'Attending Physician (Current)',
        department: language === 'th' ? 'แผนกผู้ป่วยนอก (OPD)' : 'Outpatient Department (OPD)',
        diagnosis: patient.primaryDiagnosis?.name || patient.diagnosis || (language === 'th' ? 'ยังไม่ได้ระบุการวินิจฉัย' : 'No diagnosis recorded'),
        icdCode: patient.primaryDiagnosis?.code || '',
        vitals: patient.vitals ? {
          bp: patient.vitals.bp,
          pulse: patient.vitals.pulse,
          temp: patient.vitals.temp,
          weight: patient.vitals.weight,
          spo2: patient.vitals.spo2
        } : undefined,
        ...liveDetails,
        chiefComplaint: liveDetails.chiefComplaint || (language === 'th' ? 'ไม่ระบุ' : 'N/A'),
        followUpDate: patient.followUp?.followUpDate,
        status: patient.status
      });
    }

    // ประวัติจากฐานข้อมูล ถือเป็นความจริง
    // แถวของเคสวันนี้ให้เติมรายละเอียดที่ endpoint ไม่ได้ส่งมาเข้าไปด้วย
    list.push(
      ...pastVisits.map((v) =>
        v.vn && v.vn === currentVN
          ? {
              ...v,
              chiefComplaint: v.chiefComplaint || liveDetails.chiefComplaint,
              prescription: v.prescription || liveDetails.prescription,

              // ต้องเช็ค .length ไม่ใช่เช็คแค่ว่ามีค่าไหม
              //
              // เคยพลาดตรงนี้: mapPastVisit สร้าง prescriptionsList เป็น [] เสมอ
              // แม้ฐานข้อมูลจะไม่ได้ส่งรายการยามาเลย
              // ใน JavaScript อาร์เรย์ว่าง [] เป็นค่า truthy
              // เงื่อนไข "v.prescriptionsList || liveDetails.prescriptionsList" จึงหยุดที่ []
              // ค่าสำรองไม่เคยถูกใช้เลยแม้แต่ครั้งเดียว
              // ผลคือช่องยาในประวัติว่างเปล่า ทั้งที่หน้าจอมีรายการยาอยู่ในมือ
              prescriptionsList:
                v.prescriptionsList && v.prescriptionsList.length > 0
                  ? v.prescriptionsList
                  : liveDetails.prescriptionsList,
              doctorNotes: v.doctorNotes || liveDetails.doctorNotes,
            }
          : v
      )
    );

    // Filter history if user typed in historySearch
    if (!historySearch.trim()) return list;

    const term = historySearch.toLowerCase();
    return list.filter(item =>
      item.visitDate.includes(term) ||
      item.diagnosis.toLowerCase().includes(term) ||
      (item.icdCode && item.icdCode.toLowerCase().includes(term)) ||
      item.chiefComplaint.toLowerCase().includes(term) ||
      (item.doctorName && item.doctorName.toLowerCase().includes(term))
    );
  };

  const currentHistory = selectedPatient ? getCombinedHistory(selectedPatient) : [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* -------------------------------------------------------------
          VIEW 1: PATIENT SEARCH PAGE (Default initial state)
          ------------------------------------------------------------- */}
      {!selectedPatient ? (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Header & Prominent Search Input */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">{t('recordsTitle')}</h1>
                <p className="text-xs text-slate-500 mt-1 font-medium">
                  {t('recordsSubtitle')}
                </p>
              </div>
              <div className="flex items-center gap-2 bg-blue-50 px-3.5 py-1.5 rounded-full border border-blue-100 text-xs font-bold text-blue-700 w-fit">
                <User className="w-4 h-4 text-blue-600" />
                <span>{language === 'th' ? `ผู้ป่วยรอตรวจ / กำลังตรวจ ${activePatientsCount} คน` : `Active Patients (${activePatientsCount})`}</span>
              </div>
            </div>

            {/* Central Big Search Input Bar */}
            <div className="relative">
              <Search className="w-5 h-5 absolute left-4 top-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={language === 'th' ? 'ค้นหาด้วยชื่อ, เลข HN, เลข VN หรือ เลขบัตรประชาชน...' : 'Search by name, HN, VN, or National ID...'}
                className="w-full pl-12 pr-10 py-3 bg-slate-50/80 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-2xl text-sm font-semibold focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 focus:outline-hidden transition-all shadow-inner"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Patient Directory / Search Results List */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-3">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-600" />
                  <span>
                    {statusFilter === 'in_progress'
                      ? (language === 'th' ? 'ผู้ป่วยกำลังตรวจ' : 'In Progress Patients')
                      : statusFilter === 'waiting'
                      ? (language === 'th' ? 'ผู้ป่วยรอตรวจ' : 'Waiting Patients')
                      : statusFilter === 'completed'
                      ? (language === 'th' ? 'ผู้ป่วยที่ตรวจเสร็จแล้ว' : 'Completed Patients')
                      : (language === 'th' ? 'ผู้ป่วยในระบบทั้งหมด' : 'All Patients in System')
                    }
                  </span>
                  <span className="text-xs font-mono font-bold bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-lg">
                    {filteredPatients.length}
                  </span>
                  {statusFilter === 'all' && newPatientCount > 0 && (
                    <span className="text-[11px] font-medium text-slate-500">
                      {language === 'th'
                        ? `(ผู้ป่วยใหม่ยังไม่เคยตรวจ ${newPatientCount} คน)`
                        : `(${newPatientCount} never examined)`}
                    </span>
                  )}
                </h2>
              </div>

              {/* แถบกรองสถานะ ใช้คอมโพเนนต์เดียวกับหน้าคิวผู้ป่วย
                  ลำดับปุ่มและสีจึงตรงกันทั้งสองหน้าโดยอัตโนมัติ */}
              <StatusFilterTabs
                value={statusFilter}
                onChange={(next) =>
                  setStatusFilter(next as 'all' | 'waiting' | 'in_progress' | 'completed')
                }
                options={[
                  { value: 'all', label: language === 'th' ? 'ทั้งหมด' : 'All', count: activePatientsCount },
                  { value: 'waiting', label: language === 'th' ? 'รอตรวจ' : 'Waiting', count: waitingCount },
                  { value: 'in_progress', label: language === 'th' ? 'กำลังตรวจ' : 'In Progress', count: inProgressCount },
                  { value: 'completed', label: language === 'th' ? 'ตรวจเสร็จแล้ว' : 'Completed', count: completedCount },
                ]}
              />
            </div>

            {filteredPatients.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPatients.map((patient) => {
                  // visitCount มาจาก COUNT(*) ของ visit_records และเป็นจำนวนครั้งจริง
                  // ส่วน pastVisits จะโหลดเมื่อเปิดดูคนไข้ จึงใช้เป็นตัวเลขบนการ์ดไม่ได้
                  const pastCount = patient.visitCount ?? (patient.pastVisits?.length || 0);
                  const vnCode = displayVN(patient.vn);

                  return (
                    <div
                      key={patient.id}
                      onClick={() => handleSelectPatient(patient)}
                      className="group p-5 bg-white hover:bg-blue-50/50 border border-slate-200 hover:border-blue-300 rounded-2xl shadow-2xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-4"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white font-black text-lg flex items-center justify-center shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                              {patient.name.charAt(0)}
                            </div>
                            <div>
                              <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                                {patient.name}
                              </h3>
                              <div className="mt-0.5">
                                <CopyableText label="HN" value={patient.hn} />
                              </div>
                            </div>
                          </div>
                          <span className="inline-flex w-[104px] shrink-0 [&>span]:w-full [&>span]:justify-center">
                            {isNewPatient(patient) ? (
                              <span className="inline-flex items-center bg-slate-100 text-slate-600 border border-slate-200 text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap">
                                {language === 'th' ? 'ผู้ป่วยใหม่' : 'New Patient'}
                              </span>
                            ) : (
                              <StatusBadge status={patient.status} />
                            )}
                          </span>
                        </div>

                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs space-y-1 font-mono text-slate-600">
                          <div className="flex flex-wrap items-center gap-3">
                            <CopyableText label="VN" value={vnCode} />
                            <CopyableText label={language === 'th' ? 'เลขบัตร' : 'ID'} value={formatNationalId(patient.nationalId)} copyValue={rawNationalId(patient.nationalId)} />
                          </div>
                          <div className="px-1.5 py-0.5"><strong className="text-slate-800">{language === 'th' ? 'เพศ/อายุ:' : 'Gender/Age:'}</strong> {patient.gender}, {patient.age} {language === 'th' ? 'ปี' : 'yrs'}</div>
                        </div>

                        {patient.chiefComplaint && (
                          <div className="text-xs text-slate-600 line-clamp-2 italic bg-slate-50/50 p-2 rounded-lg border border-slate-100">
                            "{patient.chiefComplaint}"
                          </div>
                        )}
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[11px] font-semibold bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg border border-blue-100 flex items-center gap-1">
                          <History className="w-3.5 h-3.5 text-blue-600" />
                          <span>{pastCount} {language === 'th' ? 'ประวัติการรักษา' : 'records'}</span>
                        </span>

                        <span className="text-xs font-bold text-blue-600 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                          <span>{language === 'th' ? 'ดูประวัติ' : 'View EMR'}</span>
                          <ChevronRight className="w-4 h-4" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-16 text-center text-slate-400 space-y-3">
                <Search className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-xs font-medium">
                  {language === 'th' ? 'ไม่พบข้อมูลผู้ป่วยที่ตรงตามเงื่อนไขการค้นหา' : 'No patient records found.'}
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* -------------------------------------------------------------
           VIEW 2: DETAILED EMR MEDICAL HISTORY VIEW (Image 2 style)
           ------------------------------------------------------------- */
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Top Bar: Back to Search Button */}
          {/* ช่อง "ค้นหาผู้ป่วยคนอื่น" ถูกถอดออกแล้ว
              ซ้ำหน้าที่กับช่องค้นหาในหน้ารายชื่อผู้ป่วย ซึ่งอยู่ห่างไปแค่ปุ่มเดียว
              และการมีช่องค้นหาสองที่ที่ผูกกับ state ตัวเดียวกัน (search)
              ทำให้พิมพ์ค้างไว้ในหน้านี้แล้วกดย้อนกลับ จะเจอรายชื่อถูกกรองอยู่
              โดยไม่มีอะไรบอกว่าทำไม */}
          <div className="sticky top-[74px] z-40 bg-white p-3.5 px-5 rounded-2xl border border-slate-200/90 shadow-2xs">
            <button
              onClick={() => handleSelectPatient(null)}
              className="flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 px-3.5 py-2 rounded-xl transition-all border border-slate-200 hover:border-blue-200 cursor-pointer w-fit"
            >
              <ArrowLeft className="w-4 h-4 text-blue-600" />
              <span>{language === 'th' ? 'กลับไปหน้าค้นหาผู้ป่วย' : 'Back to Patient Search'}</span>
            </button>
          </div>

          {/* Header Profile Card (Exact Image 2 representation) */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs relative overflow-hidden space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-2xl font-black shadow-md shrink-0">
                  {selectedPatient.name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-xl font-bold text-slate-900">{selectedPatient.name}</h2>
                    <span className="inline-flex w-[104px] shrink-0 [&>span]:w-full">
                      <StatusBadge status={selectedPatient.status} />
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 font-mono mt-1.5 flex-wrap">
                    <CopyableText label="HN" value={selectedPatient.hn} />
                    <CopyableText label="VN" value={displayVN(selectedPatient.vn)} />
                    <CopyableText label={language === 'th' ? 'เลขบัตร' : 'ID'} value={formatNationalId(selectedPatient.nationalId)} copyValue={rawNationalId(selectedPatient.nationalId)} />
                    <span>{selectedPatient.gender}, {selectedPatient.age} {language === 'th' ? 'ปี' : 'yrs'}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  onClick={() => setShowPrintModal(true)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-2xs border border-slate-200"
                >
                  <Printer className="w-4 h-4 text-slate-600" />
                  <span>{language === 'th' ? 'พิมพ์เวชระเบียน' : 'Print EMR'}</span>
                </button>
                <button
                  onClick={() => onExamine(selectedPatient)}
                  className={`w-[116px] px-3 py-2.5 rounded-xl text-xs font-bold shadow-xs hover:shadow-sm active:scale-95 transition-all inline-grid grid-cols-[16px_1fr] items-center gap-2 whitespace-nowrap cursor-pointer ${
                    selectedPatient.status === 'Completed'
                      ? 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                      : selectedPatient.status === 'Examining' || (selectedPatient.status as string) === 'In Progress'
                        ? // เคสที่บันทึกฉบับร่างค้างไว้ ใช้สีเหลืองชุดเดียวกับปุ่ม "บันทึกฉบับร่าง"
                          // ในหน้าบันทึกการตรวจ ให้ตรงกับปุ่ม "ตรวจต่อ" ในหน้าคิวผู้ป่วย
                          'bg-amber-400 hover:bg-amber-500 text-white'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {selectedPatient.status === 'Completed' ? (
                    <Edit3 className="w-4 h-4 shrink-0" />
                  ) : (
                    <Stethoscope className="w-4 h-4 shrink-0" />
                  )}
                  <span className="text-center">
                    {selectedPatient.status === 'Completed'
                      ? t('editRecordBtn')
                      : selectedPatient.status === 'Examining' || (selectedPatient.status as string) === 'In Progress'
                        ? t('continueExamBtn')
                        : t('examineBtn')}
                  </span>
                </button>
              </div>
            </div>

            {/* Patient Information Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80">
                <span className="text-[11px] text-slate-400 font-medium block mb-0.5">{language === 'th' ? 'วันเกิด / อายุ' : 'DOB / Age'}</span>
                <span className="font-semibold text-slate-800">{selectedPatient.dob || <NoData />} ({selectedPatient.age} {language === 'th' ? 'ปี' : 'yrs'})</span>
              </div>
              <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80">
                <span className="text-[11px] text-slate-400 font-medium block mb-0.5">{language === 'th' ? 'หมู่เลือด' : 'Blood Group'}</span>
                <span className="font-bold text-rose-600">{selectedPatient.bloodGroup || <NoData />}</span>
              </div>
              <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80">
                <span className="text-[11px] text-slate-400 font-medium block mb-0.5">{language === 'th' ? 'เบอร์โทรศัพท์' : 'Phone'}</span>
                <span className="font-mono font-semibold text-slate-800">{selectedPatient.phone || <NoData />}</span>
              </div>
              <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80">
                <span className="text-[11px] text-slate-400 font-medium block mb-0.5">{language === 'th' ? 'สิทธิการรักษา' : 'Insurance'}</span>
                <span className="font-semibold text-slate-800 truncate block">{selectedPatient.insuranceType || <NoData />}</span>
              </div>
            </div>
          </div>

          {/* Navigation Tabs (History vs Profile) */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs">
            <div className="sticky top-[138px] z-30 border-b border-slate-200 px-6 pt-2.5 bg-white rounded-t-3xl overflow-x-auto shadow-2xs">
              <div
                role="tablist"
                aria-label={language === 'th' ? 'ข้อมูลเวชระเบียนผู้ป่วย' : 'Patient medical records'}
                className="grid grid-cols-2 w-full"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'history'}
                  tabIndex={activeTab === 'history' ? 0 : -1}
                  data-record-tab="history"
                  onClick={() => setActiveTab('history')}
                  className={`w-full min-w-0 px-4 py-3 text-base font-extrabold rounded-t-2xl transition-all border-b-2 flex items-center justify-center gap-2 cursor-pointer focus:outline-hidden ${
                    activeTab === 'history'
                      ? 'bg-white text-blue-700 border-blue-600 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 border-transparent'
                  }`}
                >
                  <History className="w-5 h-5 text-blue-600" />
                  <span>{language === 'th' ? 'ประวัติการตรวจรักษาย้อนหลัง' : 'Past Treatment History'}</span>
                  <span className="ml-1 bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-mono font-bold">
                    {currentHistory.length}
                  </span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'profile'}
                  tabIndex={activeTab === 'profile' ? 0 : -1}
                  data-record-tab="profile"
                  onClick={() => setActiveTab('profile')}
                  className={`w-full min-w-0 px-4 py-3 text-base font-extrabold rounded-t-2xl transition-all border-b-2 flex items-center justify-center gap-2 cursor-pointer focus:outline-hidden ${
                    activeTab === 'profile'
                      ? 'bg-white text-blue-700 border-blue-600 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 border-transparent'
                  }`}
                >
                  <User className="w-5 h-5 text-blue-600" />
                  <span>{language === 'th' ? 'ข้อมูลสุขภาพและประวัติส่วนตัว' : 'Health Profile & Medical Background'}</span>
                </button>
              </div>
            </div>

            <div className="p-6 sm:p-8">
              {/* TAB 1: PAST VISIT HISTORY */}
              {activeTab === 'history' && (
                <div className="space-y-6">
                  {/* ช่องค้นหาในประวัติ
                      เดิมมีกล่องสีเทาครอบอีกชั้นซ้อนอยู่ในการ์ดใหญ่ กลายเป็นกรอบซ้อนกรอบ
                      เอาออกให้เหลือแค่ตัวช่องค้นหา ส่วนจำนวนรายการย้ายไปอยู่ท้ายช่อง */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="relative flex-1 w-full">
                      <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={historySearch}
                        onChange={(e) => setHistorySearch(e.target.value)}
                        placeholder={language === 'th' ? 'ค้นหาในประวัติรักษา (โรค, วันที่, ชื่อแพทย์, ยา)...' : 'Filter visits by diagnosis, date, doctor, medicine...'}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-xl text-xs font-medium placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 focus:outline-hidden transition-all"
                      />
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">
                      {language === 'th' ? `พบทั้งหมด ${currentHistory.length} รายการ` : `Total ${currentHistory.length} records`}
                    </span>
                  </div>

                  {/* Timeline Cards */}
                  {currentHistory.length > 0 ? (
                    <div className="space-y-4">
                      {currentHistory.map((visit, index) => {
                        const isExpanded = expandedVisitId === null ? index === 0 : expandedVisitId === visit.id;
                        const isCurrentSession = visit.id.startsWith('current-');
                        const isToday = isCurrentSession || isVisitToday(visit.visitDate);

                        return (
                          <div key={visit.id} className="flex gap-3 sm:gap-4 items-start">
                            {/* Timeline Icon Column */}
                            <div className="flex flex-col items-center self-stretch shrink-0 pt-3">
                              <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shadow-xs z-10 transition-colors ${
                                isCurrentSession
                                  ? 'bg-blue-600 border-white text-white'
                                  : 'bg-white border-blue-500 text-blue-600'
                              }`}>
                                <Calendar className="w-3.5 h-3.5" />
                              </div>
                              {index < currentHistory.length - 1 && (
                                <div className="w-0.5 bg-slate-200 grow my-1" />
                              )}
                            </div>

                            {/* Card Content */}
                            <div className={`flex-1 min-w-0 transition-all rounded-2xl border ${
                              isCurrentSession
                                ? 'bg-blue-50/40 border-blue-200 shadow-xs'
                                : 'bg-white border-slate-200/90 shadow-2xs hover:border-slate-300'
                            }`}>
                              {/* Visit Header Bar */}
                              <div
                                onClick={() => setExpandedVisitId(isExpanded ? 'none' : visit.id)}
                                className={`p-4 flex items-start justify-between gap-4 cursor-pointer select-none transition-colors ${
                                  isExpanded ? 'bg-white rounded-t-2xl' : 'hover:bg-slate-50 rounded-2xl'
                                }`}
                              >
                                <div className="min-w-0 space-y-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200/80 font-mono">
                                      <Calendar className="w-3.5 h-3.5 text-blue-600" />
                                      {visit.visitDate}
                                    </span>
                                    {visit.visitTime && (
                                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 px-1 font-mono">
                                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                                        {visit.visitTime}
                                      </span>
                                    )}
                                    <CopyableText label="VN" value={visit.vn} />
                                    {isToday && (
                                      <span className="text-[10px] font-extrabold text-blue-800 bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-md uppercase">
                                        {language === 'th' ? 'การรับบริการวันนี้' : 'Today Visit'}
                                      </span>
                                    )}
                                  </div>

                                  <h4 className="text-sm font-bold text-slate-900 leading-relaxed">
                                    {visit.diagnosis
                                      ? translateClinicalText(visit.diagnosis, language)
                                      : (language === 'th' ? 'ยังไม่มีข้อมูลการวินิจฉัย' : 'No diagnosis recorded')}
                                    {visit.icdCode && (
                                      <span className="ml-2 font-mono text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200/80">
                                        {visit.icdCode}
                                      </span>
                                    )}
                                  </h4>

                                  <div className="text-xs text-slate-500 font-medium">
                                    <span className="text-slate-400">{language === 'th' ? 'แพทย์ผู้ตรวจ: ' : 'Doctor: '}</span>
                                    <span className="text-slate-700">{visit.doctorName || <NoData />}</span>
                                    {visit.department && <span className="text-slate-400"> ({visit.department})</span>}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <VisitProgressBadge visit={visit} language={language} />
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedVisitId(isExpanded ? 'none' : visit.id);
                                    }}
                                    className="w-8 h-8 inline-flex items-center justify-center rounded-full border border-slate-200 bg-white hover:border-blue-300 hover:text-blue-600 text-slate-500 transition-colors cursor-pointer"
                                    aria-label={isExpanded
                                      ? (language === 'th' ? 'ย่อรายละเอียด' : 'Collapse details')
                                      : (language === 'th' ? 'ดูรายละเอียด' : 'Expand details')}
                                  >
                                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                  </button>
                                </div>
                              </div>

                              {/* Expanded Visit Details Body */}
                              {isExpanded && (
                                <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50/50 space-y-4 text-xs">
                                {/* Chief Complaint */}
                                <HistorySection title={language === 'th' ? 'อาการสำคัญ' : 'Chief Complaint'}>
                                  <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-sm font-medium leading-relaxed text-slate-900">
                                    {translateClinicalText(visit.chiefComplaint, language) || '-'}
                                  </div>
                                </HistorySection>

                                {/* Vitals Snapshot */}
                                {visit.vitals && (
                                  <HistorySection title={language === 'th' ? 'สัญญาณชีพประจำครั้งนี้' : 'Vitals Recorded'}>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                      <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200">
                                        <span className="text-[10px] font-semibold text-slate-500 block mb-1">{t('bloodPressure')}</span>
                                        <span className="font-mono font-bold text-slate-900 text-sm">{visit.vitals.bp || '-'}</span>
                                      </div>
                                      <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200">
                                        <span className="text-[10px] font-semibold text-slate-500 block mb-1">{t('pulseRate')}</span>
                                        <span className="font-mono font-bold text-slate-900 text-sm">{visit.vitals.pulse ? `${fmtVital(visit.vitals.pulse)} bpm` : '-'}</span>
                                      </div>
                                      <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200">
                                        <span className="text-[10px] font-semibold text-slate-500 block mb-1">{t('temperature')}</span>
                                        <span className="font-mono font-bold text-slate-900 text-sm">{visit.vitals.temp ? `${fmtVital(visit.vitals.temp, 1)} °C` : '-'}</span>
                                      </div>
                                      <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200">
                                        <span className="text-[10px] font-semibold text-slate-500 block mb-1">{t('weight')}</span>
                                        <span className="font-mono font-bold text-slate-900 text-sm">{visit.vitals.weight ? `${fmtVital(visit.vitals.weight, 1)} kg` : '-'}</span>
                                      </div>
                                    </div>
                                  </HistorySection>
                                )}

                                {/* หมายเหตุ: กล่องเขียว "รายการยาที่สั่งจ่าย" ที่เคยอยู่ตรงนี้ถูกย้ายลงไป
                                    เป็นหัวข้อ "ยาที่แพทย์สั่งจ่าย" ด้านล่าง (แทนที่หัวข้อคำแนะนำที่ให้ผู้ป่วย)
                                    เพื่อให้ทุกหัวข้อในประวัติใช้รูปแบบช่องเดียวกันทั้งหมด
                                    ถ้าปล่อยไว้ทั้งสองที่ ข้อมูลยาจะโชว์ซ้ำสองรอบในการ์ดเดียวกัน */}

                                {/* ---- ข้อมูลการรักษาของครั้งนั้น ----
                                     จัดเป็น "ช่องหัวข้อ" แบบเดียวกับฟอร์มหน้าบันทึกการตรวจ
                                     เดิมทำเป็นกล่องสีต่างๆ (ฟ้า/เหลือง/ม่วง) ซึ่งดูไม่เข้ากับ
                                     หน้าอื่นในระบบและอ่านยากเวลามีหลายกล่องต่อกัน
                                     ทุกหัวข้อโชว์เสมอ ถ้าไม่มีข้อมูลจะขึ้น "-" (ดู HistoryField) */}

                                {/* "ประวัติการเจ็บป่วยปัจจุบัน" กับ "ระยะเวลาที่เป็นมา" ถูกถอดออก
                                    หน้าบันทึกการตรวจเอาสองช่องนี้ออกไปแล้ว เพราะซ้ำกับ
                                    "อาการสำคัญ" (ที่พยาบาลเขียนระยะเวลารวมมาด้วย)
                                    และ "การประเมินและวินิจฉัยเบื้องต้น" ตามลำดับ */}

                                <HistorySection title={language === 'th' ? 'ผลการตรวจร่างกายตามระบบ' : 'Physical Examination'}>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <HistoryField label={language === 'th' ? 'สภาพทั่วไป' : 'General Appearance'} value={visit.physicalExam?.generalAppearance} />
                                    <HistoryField label={language === 'th' ? 'ศีรษะ ตา หู จมูก คอ' : 'HEENT'} value={visit.physicalExam?.heent} />
                                    <HistoryField label={language === 'th' ? 'ระบบหัวใจและหลอดเลือด' : 'Cardiovascular'} value={visit.physicalExam?.cardiovascular} />
                                    <HistoryField label={language === 'th' ? 'ระบบทางเดินหายใจและปอด' : 'Respiratory'} value={visit.physicalExam?.respiratory} />
                                    <HistoryField label={language === 'th' ? 'ระบบช่องท้อง' : 'Abdomen'} value={visit.physicalExam?.abdomen} />
                                    <HistoryField label={language === 'th' ? 'ระบบกล้ามเนื้อและกระดูก' : 'Musculoskeletal'} value={visit.physicalExam?.musculoskeletal} />
                                    <HistoryField label={language === 'th' ? 'ระบบประสาท' : 'Neurological'} value={visit.physicalExam?.neurological} />
                                    <HistoryField label={language === 'th' ? 'ผิวหนัง' : 'Skin'} value={visit.physicalExam?.skin} />
                                  </div>
                                </HistorySection>

                                <HistorySection title={language === 'th' ? 'การวินิจฉัยโรค' : 'Diagnosis'}>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <HistoryField
                                      label={language === 'th' ? 'การวินิจฉัยหลัก' : 'Primary Diagnosis'}
                                      value={visit.diagnosis ? `${visit.diagnosis}${visit.icdCode ? `  (${visit.icdCode})` : ''}` : ''}
                                    />
                                    <HistoryField
                                      label={language === 'th' ? 'การวินิจฉัยรอง' : 'Secondary Diagnoses'}
                                      value={(visit.secondaryDiagnoses || [])
                                        .map((d) => `${d.name}${d.code ? `  (${d.code})` : ''}`)
                                        .join('\n')}
                                    />
                                  </div>
                                </HistorySection>

                                <HistorySection title={language === 'th' ? 'การประเมินและแผนการรักษา' : 'Assessment & Plan'}>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <HistoryField label={language === 'th' ? 'การประเมินและวินิจฉัยเบื้องต้น' : 'Assessment'} value={visit.assessmentNotes} />
                                    <HistoryField label={language === 'th' ? 'แผนการรักษาและหัตถการ' : 'Treatment Plan'} value={visit.treatmentPlan} />
                                    {/* "บันทึกทางคลินิกเพิ่มเติม" กับ "หัตถการที่ทำ" ถูกถอดออก
                                        ไม่มีช่องกรอกในหน้าบันทึกการตรวจ ค่าจึงว่างตลอด
                                        หัตถการที่แพทย์ทำจริงถูกเขียนรวมอยู่ในช่อง "แผนการรักษาและหัตถการ"
                                        ด้านบนอยู่แล้ว (ดูข้อความ placeholder ของช่องนั้น) */}
                                  </div>
                                </HistorySection>

                                {/* ยาที่แพทย์สั่งจ่ายในครั้งนั้น
                                    เดิมตรงนี้เป็นหัวข้อ "คำแนะนำที่ให้ผู้ป่วย" (counseling 5 ช่อง)
                                    ซึ่งไม่ค่อยได้ใช้ตอนเปิดดูประวัติย้อนหลัง
                                    สิ่งที่แพทย์อยากเห็นจริงๆ คือครั้งก่อนจ่ายยาอะไรไป
                                    ข้อมูลชุดนี้อ่านจากตาราง dispensings ของห้องยา (ยาที่จ่ายจริง)
                                    ไม่ใช่ข้อความที่พิมพ์ค้างไว้บนหน้าจอ */}
                                <HistorySection title={language === 'th' ? 'ยาที่แพทย์สั่งจ่าย' : 'Medications Prescribed'}>
                                  {visit.prescriptionsList && visit.prescriptionsList.length > 0 ? (
                                    <div className="space-y-2">
                                      {visit.prescriptionsList.map((item, idx) => (
                                        <HistoryPrescriptionRow
                                          key={item.id || idx}
                                          index={idx}
                                          item={item}
                                          language={language}
                                        />
                                      ))}
                                    </div>
                                  ) : (
                                    /* ไม่มีรายการยาในตาราง dispensings
                                       ยังโชว์ช่องเดียวไว้ให้เห็นว่า "ครั้งนั้นไม่ได้จ่ายยา"
                                       ถ้าซ่อนหัวข้อไปเลย แพทย์จะแยกไม่ออกระหว่าง
                                       "ไม่ได้จ่ายยา" กับ "ระบบดึงข้อมูลไม่มา" */
                                    <HistoryField
                                      label={language === 'th' ? 'รายการยา' : 'Medication List'}
                                      value={visit.prescription}
                                    />
                                  )}
                                </HistorySection>

                                <HistorySection title={language === 'th' ? 'การนัดหมายติดตามอาการ' : 'Follow-up'}>
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <HistoryField label={language === 'th' ? 'วันนัดครั้งถัดไป' : 'Follow-up Date'} value={visit.followUpDate} />
                                    <HistoryField label={language === 'th' ? 'เหตุผลการนัด' : 'Reason'} value={visit.followUpReason} />
                                    <HistoryField label={language === 'th' ? 'คำแนะนำเพิ่มเติม' : 'Instructions'} value={visit.followUpInstructions} />
                                  </div>
                                </HistorySection>

                                {/* เหตุผลการยกเลิก เป็นหัวข้อเดียวที่ซ่อนได้เมื่อไม่มีข้อมูล
                                    เพราะการมาตรวจปกติไม่ควรมีหัวข้อ "ยกเลิก" ขึ้นค้างไว้ให้สับสน */}
                                {visit.cancelReason && (
                                  <HistorySection title={language === 'th' ? 'ยกเลิกการรับบริการ' : 'Visit Cancelled'}>
                                    <HistoryField
                                      label={language === 'th' ? 'เหตุผลการยกเลิก' : 'Reason'}
                                      value={visit.cancelReason}
                                    />
                                  </HistorySection>
                                )}

                                {visit.followUpDate && (
                                  <div className="flex items-center gap-2 text-xs font-semibold text-blue-900 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-200 w-fit">
                                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                                    <span>
                                      {language === 'th' ? `นัดหมายติดตามอาการครั้งถัดไป: ${visit.followUpDate}` : `Next Follow-up Appointment: ${visit.followUpDate}`}
                                      {visit.followUpReason ? ` — ${visit.followUpReason}` : ''}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                      })}
                    </div>
                  ) : (
                    <div className="py-12 text-center text-slate-400 text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      {language === 'th' ? 'ไม่พบประวัติการตรวจรักษาย้อนหลังตรงตามเงื่อนไข' : 'No treatment history records matching search criteria.'}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: PERSONAL HEALTH PROFILE */}
              {activeTab === 'profile' && (
                <div className="space-y-5 text-xs">
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <ProfileSection
                      title={language === 'th' ? 'ข้อมูลส่วนตัว' : 'Personal Information'}
                      icon={<User className="w-4 h-4" />}
                    >
                      <div className="grid grid-cols-2 gap-3">
                        <ProfileField
                          className="col-span-2"
                          label={language === 'th' ? 'ชื่อ - นามสกุล' : 'Full Name'}
                          value={selectedPatient.name}
                        />
                        <ProfileField
                          label={language === 'th' ? 'อายุ' : 'Age'}
                          value={`${selectedPatient.age} ${language === 'th' ? 'ปี' : 'yrs'}`}
                        />
                        <ProfileField
                          label={language === 'th' ? 'เพศ' : 'Gender'}
                          value={selectedPatient.gender === 'Male'
                            ? (language === 'th' ? 'ชาย' : 'Male')
                            : selectedPatient.gender === 'Female'
                            ? (language === 'th' ? 'หญิง' : 'Female')
                            : selectedPatient.gender}
                        />
                        <ProfileField
                          label={language === 'th' ? 'วันเกิด' : 'Date of Birth'}
                          value={selectedPatient.dob || <NoData />}
                        />
                        <ProfileField
                          label={language === 'th' ? 'หมู่โลหิต' : 'Blood Group'}
                          value={selectedPatient.bloodGroup || <NoData />}
                        />
                        <ProfileField
                          className="col-span-2"
                          label={language === 'th' ? 'เลขบัตรประชาชน' : 'National ID'}
                          value={<CopyableText value={formatNationalId(selectedPatient.nationalId)} copyValue={rawNationalId(selectedPatient.nationalId)} />}
                        />
                      </div>
                    </ProfileSection>

                    <ProfileSection
                      title={language === 'th' ? 'การติดต่อและการรับบริการ' : 'Contact & Visit Information'}
                      icon={<Phone className="w-4 h-4" />}
                    >
                      <div className="grid grid-cols-2 gap-3">
                        <ProfileField
                          label={language === 'th' ? 'เบอร์โทรศัพท์' : 'Phone Number'}
                          value={selectedPatient.phone || <NoData />}
                        />
                        <ProfileField
                          label={language === 'th' ? 'อาชีพ' : 'Occupation'}
                          value={selectedPatient.occupation || <NoData />}
                        />
                        <ProfileField
                          className="col-span-2"
                          label={language === 'th' ? 'ที่อยู่ผู้ป่วย' : 'Patient Address'}
                          value={selectedPatient.address || <NoData />}
                        />
                        <ProfileField
                          className="col-span-2"
                          label={language === 'th' ? 'สิทธิการรักษา' : 'Insurance Scheme'}
                          value={selectedPatient.insuranceType || <NoData />}
                        />
                        <ProfileField
                          label={language === 'th' ? 'วันที่รับบริการ' : 'Visit Date'}
                          value={selectedPatient.visitDate || <NoData />}
                        />
                        <ProfileField
                          label={language === 'th' ? 'เวลา' : 'Visit Time'}
                          value={selectedPatient.visitTime || <NoData />}
                        />
                      </div>
                    </ProfileSection>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <ProfileSection
                      title={language === 'th' ? 'ข้อมูลการแพ้' : 'Allergy Information'}
                      icon={<AlertTriangle className="w-4 h-4" />}
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <ClinicalAlertField
                          label={language === 'th' ? 'ประวัติการแพ้ยา' : 'Drug Allergies'}
                          values={selectedPatient.drugAllergies}
                          emptyText={language === 'th' ? 'ปฏิเสธการแพ้ยา' : 'No Known Drug Allergies (NKDA)'}
                        />
                        <ClinicalAlertField
                          label={language === 'th' ? 'ประวัติการแพ้อาหาร' : 'Food Allergies'}
                          values={selectedPatient.foodAllergies}
                          emptyText={language === 'th' ? 'ปฏิเสธการแพ้อาหาร' : 'No known food allergies'}
                        />
                      </div>
                    </ProfileSection>

                    <ProfileSection
                      title={language === 'th' ? 'โรคประจำตัวและยาที่ใช้ประจำ' : 'Chronic Conditions & Current Medications'}
                      icon={<HeartPulse className="w-4 h-4" />}
                    >
                      <div className="space-y-3">
                        <ClinicalAlertField
                          label={language === 'th' ? 'โรคประจำตัวและภาวะเรื้อรัง' : 'Chronic Diseases & Conditions'}
                          values={selectedPatient.chronicDiseases}
                          emptyText={language === 'th' ? 'ไม่มีโรคประจำตัว' : 'No chronic diseases recorded'}
                        />
                        <ClinicalAlertField
                          label={language === 'th' ? 'ยาที่รับประทานประจำในปัจจุบัน' : 'Current Long-term Medications'}
                          values={selectedPatient.currentMedications}
                          emptyText={language === 'th' ? 'ไม่มีรายการยาประจำ' : 'No long-term medications listed'}
                        />
                      </div>
                    </ProfileSection>
                  </div>

                  <ProfileSection
                    title={language === 'th' ? 'ประวัติสุขภาพเพิ่มเติม' : 'Additional Health History'}
                    icon={<Shield className="w-4 h-4" />}
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                      <ProfileField
                        label={language === 'th' ? 'การสูบบุหรี่' : 'Smoking'}
                        value={selectedPatient.smokingHistory?.status || <NotAsked />}
                      />
                      <ProfileField
                        label={language === 'th' ? 'การดื่มแอลกอฮอล์' : 'Alcohol'}
                        value={selectedPatient.alcoholHistory?.status || <NotAsked />}
                      />
                      <ProfileField
                        label={language === 'th' ? 'ประวัติการผ่าตัด' : 'Past Surgery'}
                        value={selectedPatient.pastSurgery || <NotAsked />}
                      />
                      <ProfileField
                        label={language === 'th' ? 'ประวัติครอบครัว' : 'Family History'}
                        value={selectedPatient.familyHistory || <NotAsked />}
                      />
                    </div>
                  </ProfileSection>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PRINT EMR SUMMARY MODAL */}
      {showPrintModal && selectedPatient && (
        <div className="fixed inset-0 z-[1200] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl border border-slate-100 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-base text-slate-900">
                  {language === 'th' ? 'ใบสรุปประวัติเวชระเบียนผู้ป่วย (EMR Record Summary)' : 'Patient EMR History Summary'}
                </h3>
              </div>
              <button onClick={() => setShowPrintModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div id="emr-print-content" className="p-4 border border-slate-200 rounded-2xl space-y-4 text-xs font-sans bg-slate-50/50">
              {/* EMR Clinic Banner */}
              <div className="text-center border-b pb-3 space-y-1">
                <h2 className="text-lg font-black text-slate-900">เวชระเบียนผู้ป่วยนอก (OPD EMR SUMMARY)</h2>
                <p className="text-[11px] text-slate-500 font-mono">คลินิกเวชกรรมชุมชนมวลชน • Bangkok Medical Clinic</p>
              </div>

              {/* Patient Basic Profile */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-white p-3 rounded-xl border border-slate-200">
                <div><strong>ชื่อ-นามสกุล:</strong> {selectedPatient.name}</div>
                <div><CopyableText label="HN" value={selectedPatient.hn} /></div>
                <div><CopyableText label="VN" value={displayVN(selectedPatient.vn)} /></div>
                <div><strong>เพศ/อายุ:</strong> {selectedPatient.gender}, {selectedPatient.age} ปี</div>
                <div><strong>หมู่เลือด:</strong> {selectedPatient.bloodGroup || 'O Positive'}</div>
                <div><strong>สิทธิ:</strong> {selectedPatient.insuranceType || 'UC'}</div>
              </div>

              {/* Patient Visits Summary List */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-900 text-xs border-b pb-1">ประวัติการตรวจรักษาย้อนหลัง ({currentHistory.length} ครั้ง)</h4>
                {currentHistory.map((v, i) => (
                  <div key={i} className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                    <div className="flex justify-between font-mono font-bold text-blue-900">
                      <span>{v.visitDate} {v.visitTime ? `(${v.visitTime})` : ''}</span>
                      <CopyableText label="VN" value={v.vn} />
                    </div>
                    <div><strong>การวินิจฉัย:</strong> {v.diagnosis} {v.icdCode ? `(${v.icdCode})` : ''}</div>
                    <div><strong>อาการสำคัญ:</strong> {v.chiefComplaint}</div>
                    {v.prescription && <div><strong>ยาที่สั่งจ่าย:</strong> {v.prescription}</div>}
                    {v.doctorNotes && <div className="text-slate-600"><strong>หมายเหตุแพทย์:</strong> {v.doctorNotes}</div>}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowPrintModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                {language === 'th' ? 'ปิด' : 'Close'}
              </button>
              <button
                onClick={() => {
                  window.print();
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>{language === 'th' ? 'สั่งพิมพ์เอกสาร' : 'Print Document'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
