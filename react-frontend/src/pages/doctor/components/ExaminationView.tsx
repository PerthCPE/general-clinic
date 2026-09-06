import React, { useState, useEffect } from 'react';
import type { Patient, QueueStatus, PrescriptionItem, LabOrderItem, ImagingOrderItem, DiagnosisItem, IssuedDocument } from '../types';
import { CopyableText } from './CopyableText';
import { useLanguage } from '../context/LanguageContext';
import { translateClinicalText } from '../utils/clinicalTranslation';
import { displayVN } from '../utils/vnGenerator';
import { formatNationalId, rawNationalId } from '../utils/nationalId';
import { findAllergyConflicts, describeConflict } from '../utils/allergyCheck';
import {
  Stethoscope,
  HeartPulse,
  Thermometer,
  Pill,
  Activity,
  Weight,
  Ruler,
  Clock,
  AlertTriangle,
  Search,
  Plus,
  Trash2,
  Save,
  CheckCircle,
  Printer,
  FileText,
  Send,
  XCircle,
  Calendar,
  User,
  FileSpreadsheet,
  ArrowLeft,
  ChevronRight,
  ChevronDown,
  Info,
  Check,
  Building,
  History,
  FolderOpen,
  Sparkles,
  ClipboardCheck,
  UserCheck,
  ArrowUp,
  ArrowDown,
  Star,
  X,
  AlertCircle,
  Edit3,
  Phone,
  Shield,
  Heart
} from 'lucide-react';

/**
 * ==============================================================================
 * Patient Examination & Medical Record View (ExaminationView.tsx)
 * ==============================================================================
 * หน้าจอบันทึกการตรวจผู้ป่วย (หน้าห้องตรวจแพทย์):
 * ประกอบด้วย 4 แท็บหลัก:
 * 1. TAB 1: อาการสำคัญ & สัญญาณชีพ (Chief Complaint & Vital Signs / Physical Exam)
 * 2. TAB 2: การวินิจฉัยโรค (Diagnosis - ICD-10 Search & Selection)
 * 3. TAB 3: การสั่งยาและสั่งตรวจทางห้องปฏิบัติการ (Prescription & Orders: Meds, Lab, X-Ray)
 * 4. TAB 4: สรุปบันทึกการตรวจและสั่งการรักษา (Treatment Summary & Certificate Print)
 *
 * 📍 จุดที่ใช้แก้ไข/ปรับแต่ง (Customization Guide):
 * - ICD10_DATABASE: รายชื่อรหัสโรค ICD-10 สำหรับค้นหา
 * - COMMON_MEDICATIONS: รายการยาในคลังสำหรับจ่ายยา
 * - COMMON_LABS / COMMON_IMAGING: รายการส่งตรวจ Lab / X-Ray
 * - handleSaveAndComplete: ฟังก์ชันบันทึกข้อมูลการตรวจและเปลี่ยนสถานะคิวเป็น Completed
 */
/**
 * id ของกล่องข้อมูลที่ต้องกรอกก่อนปิดการตรวจ
 * ใช้คู่กับ focusIssue() เพื่อเลื่อนจอไปหาช่องที่ยังขาด
 */
/*
 * สี/ชื่อระดับการคัดแยกผู้ป่วย (Triage) ย้ายไปอยู่ที่ ../utils/triage.ts แล้ว
 * เพราะตอนนี้แสดงระดับความรุนแรงที่ตารางคิวผู้ป่วยแทน ไม่ได้แสดงในหน้านี้
 */

/**
 * แปลงเวลาที่พยาบาลคัดกรอง ให้อ่านง่ายบนหน้าจอแพทย์
 *
 * backend ส่งมาเป็น ISO timestamp เต็ม (เช่น 2026-09-05T18:28:41Z)
 * ถ้าคัดกรองวันนี้ แสดงแค่เวลา เพราะแพทย์สนใจว่า "วัดไว้กี่โมง" เป็นหลัก
 * ถ้าเป็นวันก่อนหน้า ต้องมีวันที่กำกับด้วย ไม่งั้นจะเข้าใจผิดว่าเพิ่งวัดเมื่อกี้
 *
 * คืนค่าว่างถ้าแปลงไม่ได้ ฝั่งเรียกใช้เช็คก่อนแสดงอยู่แล้ว
 */
function formatScreenedAt(value: string | undefined): string {
  if (!value) return '';

  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return '';

  const time = at.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

  const today = new Date();
  const sameDay =
    at.getFullYear() === today.getFullYear() &&
    at.getMonth() === today.getMonth() &&
    at.getDate() === today.getDate();

  if (sameDay) return time;

  return `${at.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit' })} ${time}`;
}

/**
 * ข้อความแทนค่าที่จุดคัดกรองยังไม่ได้วัด
 *
 * ต้องเขียนให้ชัดว่า "ยังไม่ได้วัด" ไม่ใช่แค่ขีด - หรือ 0
 * เพราะช่องว่างในใบสัญญาณชีพถูกอ่านได้สองแบบ คือ "วัดแล้วปกติ" กับ "ยังไม่ได้วัด"
 * ซึ่งนำไปสู่การตัดสินใจคนละทางโดยสิ้นเชิง
 */
const NOT_MEASURED = { th: 'ยังไม่ได้วัด', en: 'Not measured' };

/**
 * ==============================================================================
 * ปัดค่าสัญญาณชีพให้ตรงกับความละเอียดของเครื่องมือวัดจริง
 * ==============================================================================
 * เคยเจอในฐานข้อมูลจริง: อุณหภูมิ 36.89750419129597 °C
 *                        น้ำหนัก 76.06828326560182 กก.
 *                        ส่วนสูง 171.91949858478532 ซม.
 * มาจากตัวจำลองคิว (AutoSimulator) ที่สุ่มเป็นเลขทศนิยมดิบแล้วเขียนลงตาราง
 * screenings ตรงๆ แต่ปัญหาไม่ได้อยู่ที่ตัวจำลองอย่างเดียว
 *
 * ไม่มีเครื่องมือแพทย์เครื่องไหนวัดได้ละเอียดขนาดนั้น
 *   เทอร์โมมิเตอร์  ทศนิยม 1 ตำแหน่ง
 *   เครื่องชั่ง      ทศนิยม 1 ตำแหน่ง
 *   ที่วัดส่วนสูง    จำนวนเต็ม
 *   ชีพจร/หายใจ/SpO2 จำนวนเต็ม
 *
 * หน้าจอจึงควรคุมรูปแบบการแสดงผลของตัวเอง ไม่ว่าข้อมูลต้นทางจะมาแบบไหน
 * ปัดเฉพาะ "ตอนแสดงผล" เท่านั้น ค่าที่เก็บในฐานข้อมูลยังเป็นค่าเดิมไม่ถูกแตะ
 *
 * ใช้ Number() ครอบอีกชั้นเพื่อตัดศูนย์ท้ายทิ้ง
 * toFixed(1) ของ 36 จะได้ "36.0" ซึ่งอ่านแปลกกว่า "36"
 */
function fmtVital(value: number | undefined, decimals = 0): string {
  if (value === undefined || Number.isNaN(value)) return '';
  return String(Number(value.toFixed(decimals)));
}

/**
 * ==============================================================================
 * ผลคัดกรองความเสี่ยงแบบ 3 สถานะ (มี / ไม่มี / ยังไม่ได้ประเมิน)
 * ==============================================================================
 * ใช้กับข้อที่จุดคัดกรองตอบได้แค่ "มี" หรือ "ไม่มี" เช่น
 *   URI                  อาการติดเชื้อทางเดินหายใจส่วนบน (แยกผู้ป่วยกลุ่มติดเชื้อ)
 *   วัณโรค                โรคติดต่อทางอากาศ ต้องแยกออกจากคิวรวมและให้ใส่หน้ากาก
 *   ยาละลายลิ่มเลือด      เสี่ยงเลือดออกไม่หยุด และตีกับยาหลายตัว ต้องรู้ก่อนสั่งยา
 *   ตั้งครรภ์             ยาหลายกลุ่มทำให้ทารกพิการ (เฉพาะผู้ป่วยหญิง)
 *   ให้นมบุตร             ยาบางตัวผ่านน้ำนมไปถึงทารก (เฉพาะผู้ป่วยหญิง)
 *
 * เหตุผลที่ต้องมี 3 สถานะ ไม่ใช่ 2:
 * "ยังไม่ได้ประเมิน" กับ "ประเมินแล้วไม่มี" มีความหมายทางคลินิกคนละอย่างสิ้นเชิง
 * ถ้ายุบเหลือมี/ไม่มี เคสที่ยังไม่มีใครถามจะแสดงเป็น "ไม่มี" แล้วแพทย์จะข้ามการซักไป
 * ซึ่งอันตรายที่สุดกับข้อยาละลายลิ่มเลือดและข้อตั้งครรภ์
 * เพราะจบที่การสั่งยาที่ทำให้เลือดออก หรือยาที่ทำให้ทารกพิการ
 *
 * สีของป้ายสื่อ "ต้องระวัง" ไม่ใช่ "ดี/ไม่ดี"
 * ผลบวกทุกข้อล้วนแปลว่าแพทย์ต้องทำอะไรเพิ่ม จึงใช้สีเหลืองเตือน
 */
const TriageFlag: React.FC<{
  label: string;
  value?: boolean;
  language: string;
  presentTh?: string;
  absentTh?: string;
  presentEn?: string;
  absentEn?: string;
}> = ({
  label,
  value,
  language,
  presentTh = 'มีอาการ',
  absentTh = 'ไม่มีอาการ',
  presentEn = 'Present',
  absentEn = 'Absent',
}) => {
  const isTh = language === 'th';

  return (
    <div className="space-y-1.5">
      <label className="text-[13px] font-bold text-slate-800 block">{label}</label>
      <div className="w-full min-h-[44px] px-3.5 py-2.5 bg-[#f8fafc] border border-slate-200 rounded-xl flex items-center">
        {value === true ? (
          <span className="text-sm font-bold text-amber-800 bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-lg">
            {isTh ? presentTh : presentEn}
          </span>
        ) : value === false ? (
          <span className="text-sm font-bold text-emerald-800 bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg">
            {isTh ? absentTh : absentEn}
          </span>
        ) : (
          <span className="text-sm font-normal text-slate-400">
            {isTh ? 'จุดคัดกรองยังไม่ได้ประเมิน' : 'Not assessed at triage'}
          </span>
        )}
      </div>
    </div>
  );
};

/**
 * ข้อควรระวังในการดูแลผู้ป่วย (Isolation Precaution)
 * ----------------------------------------------------------------------------
 * บอกว่าเชื้อของผู้ป่วยรายนี้แพร่ทางไหน เจ้าหน้าที่ต้องป้องกันตัวแบบไหน
 * ไม่ใช่ "ห้ามทำ" แต่เป็น "ทำได้ แต่ต้องระวังแบบนี้"
 *
 * key ต้องตรงกับ models.Screening.PrecautionType ฝั่ง backend เป๊ะๆ
 * ถ้าเพิ่มประเภทใหม่ ต้องเพิ่มทั้งสองที่
 */
const PRECAUTION_OPTIONS: Record<
  string,
  { th: string; en: string; noteTh: string; noteEn: string; box: string; chip: string }
> = {
  Standard: {
    th: 'Standard',
    en: 'Standard',
    noteTh: 'ข้อปฏิบัติมาตรฐาน ล้างมือ ใส่ถุงมือเมื่อสัมผัสสารคัดหลั่ง',
    noteEn: 'Standard practice: hand hygiene, gloves for body fluids',
    box: 'bg-[#f8fafc] border-slate-200',
    chip: 'text-slate-700 bg-slate-100 border-slate-300',
  },
  Contact: {
    th: 'Contact',
    en: 'Contact',
    noteTh: 'แพร่ทางการสัมผัส ต้องใส่ถุงมือและเสื้อกาวน์',
    noteEn: 'Contact spread: gloves and gown required',
    box: 'bg-amber-50/70 border-amber-200/80',
    chip: 'text-amber-900 bg-amber-100 border-amber-300',
  },
  Droplet: {
    th: 'Droplet',
    en: 'Droplet',
    noteTh: 'แพร่ทางละอองฝอย ต้องใส่หน้ากากอนามัย เว้นระยะ 1-2 เมตร',
    noteEn: 'Droplet spread: surgical mask, keep 1-2 m distance',
    box: 'bg-orange-50/70 border-orange-200/80',
    chip: 'text-orange-900 bg-orange-100 border-orange-300',
  },
  Airborne: {
    th: 'Airborne',
    en: 'Airborne',
    noteTh: 'แพร่ทางอากาศ ต้องใส่ N95 และแยกผู้ป่วยออกจากคิวรวมทันที',
    noteEn: 'Airborne spread: N95 required, isolate from waiting area',
    box: 'bg-rose-50/70 border-rose-200/80',
    chip: 'text-rose-900 bg-rose-100 border-rose-300',
  },
};

const PrecautionCard: React.FC<{ value?: string; language: string }> = ({ value, language }) => {
  const isTh = language === 'th';
  const key = (value || '').trim();
  const option = PRECAUTION_OPTIONS[key];

  return (
    <div className="space-y-1.5">
      <label className="text-[13px] font-bold text-slate-800 block">
        {isTh ? 'ข้อควรระวัง (Precaution)' : 'Precaution'}
      </label>
      <div
        className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border flex flex-col justify-center gap-1 ${
          option ? option.box : 'bg-[#f8fafc] border-slate-200'
        }`}
      >
        {option ? (
          <>
            <span
              className={`self-start text-sm font-bold px-2.5 py-1 rounded-lg border ${option.chip}`}
            >
              {isTh ? option.th : option.en}
            </span>
            <span className="text-[11px] text-slate-500 leading-snug">
              {isTh ? option.noteTh : option.noteEn}
            </span>
          </>
        ) : (
          <span className="text-sm font-normal text-slate-400">
            {/* ค่าที่ backend ส่งมาแต่ไม่รู้จัก ให้แสดงตรงๆ จะได้รู้ว่ามีค่าแปลกปลอม
                ไม่ใช่กลบเป็น "ยังไม่ได้ระบุ" ซึ่งทำให้ข้อมูลผิดหายไปเงียบๆ */}
            {key || (isTh ? 'จุดคัดกรองยังไม่ได้ระบุ' : 'Not specified at triage')}
          </span>
        )}
      </div>
    </div>
  );
};

/**
 * คัดกรองเฉพาะผู้ป่วยหญิง — รวมสามค่าไว้ในหัวข้อเดียว
 * ----------------------------------------------------------------------------
 * ตั้งครรภ์ / ให้นมบุตร / ประจำเดือนครั้งสุดท้าย เป็นเรื่องเดียวกันในทางคลินิก
 * คือ "สั่งยาตัวนี้ให้ผู้ป่วยรายนี้ได้ไหม" จึงรวมเป็นการ์ดเดียว
 * แยกเป็นสามหัวข้อทำให้ตารางยาวโดยไม่ได้ข้อมูลเพิ่ม
 *
 * แต่ละค่ายังเป็น 3 สถานะเหมือนเดิม (nil / false / true)
 * ป้ายสีเหลือง = ต้องระวังตอนสั่งยา, เขียว = ถามแล้วไม่ใช่, เทา = ยังไม่ได้ถาม
 */
const FemaleScreeningCard: React.FC<{
  isPregnant?: boolean;
  isBreastfeeding?: boolean;
  lastMenstrualPeriod?: string;
  language: string;
}> = ({ isPregnant, isBreastfeeding, lastMenstrualPeriod, language }) => {
  const isTh = language === 'th';
  const lmp = (lastMenstrualPeriod || '').trim();

  // ถ้ามีข้อใดข้อหนึ่งเป็นบวก ให้กล่องทั้งใบเป็นสีเตือน
  // แพทย์จะได้เห็นตั้งแต่กวาดตาผ่าน ไม่ต้องอ่านป้ายทีละอัน
  const needsCaution = isPregnant === true || isBreastfeeding === true;

  // ยังไม่มีค่าไหนถูกประเมินเลย ให้ขึ้นข้อความเดียวแบบเดียวกับช่องอื่นในกลุ่มนี้
  // ดีกว่าโชว์ป้าย "ยังไม่ประเมิน" เรียงกันหลายอัน ซึ่งรกและอ่านแล้วไม่ได้อะไรเพิ่ม
  const nothingAssessed =
    isPregnant === undefined && isBreastfeeding === undefined && lmp === '';

  // ค่าที่ยังไม่ได้ประเมินไม่ต้องขึ้นป้าย (คืน null) แสดงเฉพาะข้อที่พยาบาลตอบมาแล้ว
  const chip = (value: boolean | undefined, onTh: string, offTh: string, onEn: string, offEn: string) => {
    if (value === undefined) return null;

    if (value === true) {
      return (
        <span className="text-xs font-bold text-amber-800 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-lg">
          {isTh ? onTh : onEn}
        </span>
      );
    }
    return (
      <span className="text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-lg">
        {isTh ? offTh : offEn}
      </span>
    );
  };

  return (
    <div className="space-y-1.5">
      <label className="text-[13px] font-bold text-slate-800 block">
        {isTh ? 'เพศหญิง' : 'Female Screening'}
      </label>
      <div
        className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border flex flex-wrap items-center gap-1.5 ${
          needsCaution ? 'bg-amber-50/60 border-amber-200/80' : 'bg-[#f8fafc] border-slate-200'
        }`}
      >
        {nothingAssessed ? (
          <span className="text-sm font-normal text-slate-400">
            {isTh ? 'จุดคัดกรองยังไม่ได้ระบุ' : 'Not specified at triage'}
          </span>
        ) : (
          <>
            {chip(isPregnant, 'ตั้งครรภ์', 'ไม่ตั้งครรภ์', 'Pregnant', 'Not pregnant')}
            {chip(isBreastfeeding, 'ให้นมบุตร', 'ไม่ให้นมบุตร', 'Breastfeeding', 'Not breastfeeding')}

            {/* ประจำเดือนครั้งสุดท้าย แสดงเฉพาะเมื่อมีค่าจริง */}
            {lmp && <span className="text-xs font-semibold text-slate-600">{`LMP: ${lmp}`}</span>}
          </>
        )}
      </div>
    </div>
  );
};

/**
 * ข้อความปฏิเสธ เช่น "ปฏิเสธการแพ้ยา" / "ไม่มี" / "No known allergy"
 * นับเป็น "ไม่มี" ไม่ใช่ "มี" ถึงจะเป็นข้อความที่ไม่ว่างก็ตาม
 *
 * จำเป็นเพราะจุดคัดกรองเก็บเป็นข้อความอิสระ พยาบาลพิมพ์คำปฏิเสธลงในช่องเดียวกัน
 * ถ้าเช็คแค่ "มีข้อความไหม" กล่องประวัติแพ้ยาจะขึ้นสีแดงเตือน
 * ทั้งที่ผู้ป่วยบอกว่าไม่แพ้ยา ซึ่งอ่านผิดไปคนละทางกับความจริง
 */
function hasRealValue(text: string | undefined): boolean {
  const value = (text || '').trim();
  if (value === '') return false;
  return !/ไม่|ปฏิเสธ|no known|^none$|^no$|nka/i.test(value);
}

/** ต่อค่าหลักกับรายละเอียดเป็นบรรทัดเดียว ข้ามส่วนที่ว่าง */
function joinDetail(main: string | undefined, detail: string | undefined): string {
  const a = (main || '').trim();
  const b = (detail || '').trim();
  if (a && b) return `${a} — ${b}`;
  return a || b;
}

/**
 * กล่องแสดงข้อมูลจากจุดคัดกรอง หนึ่งหัวข้อ หนึ่งช่อง
 *
 * เดิมแบ่งเป็นสองช่องบน-ล่าง (ค่าหลัก / รายละเอียด) แต่ช่องล่างส่วนใหญ่
 * เป็นข้อความคงที่ที่เขียนตายไว้ในโค้ด เช่น "ติดตามอาการต่อเนื่อง"
 * "ทานตามแพทย์สั่ง" ซึ่งไม่ใช่ข้อมูลจริงจากพยาบาล และขึ้น "--" เมื่อไม่มีข้อมูล
 * กลายเป็นกล่องที่สูงเป็นสองเท่าโดยได้ข้อมูลเท่าเดิม
 */
const InfoCard: React.FC<{ label: string; value?: string; danger?: boolean }> = ({
  label,
  value,
  danger = false,
}) => {
  const text = (value || '').trim();

  return (
    <div className="space-y-1.5">
      <label className="text-[13px] font-bold text-slate-800 block">{label}</label>
      <div
        className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border flex items-center ${
          danger ? 'bg-rose-50/70 border-rose-200/80' : 'bg-[#f8fafc] border-slate-200'
        }`}
      >
        {text ? (
          <span className={`text-sm font-bold ${danger ? 'text-rose-900' : 'text-slate-900'}`}>
            {text}
          </span>
        ) : (
          <span className="text-sm font-normal text-slate-400">-</span>
        )}
      </div>
    </div>
  );
};

/**
 * ==============================================================================
 * การ์ดขอออกเอกสาร (ติ๊ก -> ระบุจำนวน -> พิมพ์)
 * ==============================================================================
 * ปุ่มพิมพ์ถูกปิดไว้จนกว่าจะติ๊กว่าต้องการ เจตนากันการกดพลาด
 * เอกสารเหล่านี้มีผลทางกฎหมาย (ใช้ลาป่วย ใช้เบิกจ่าย) ไม่ควรออกโดยไม่ตั้งใจ
 *
 * ช่องจำนวนโผล่มาหลังติ๊กเท่านั้น เพราะถ้าโชว์ตลอดเวลาจะดูเหมือนต้องกรอก
 * ทั้งที่ยังไม่ได้ตัดสินใจว่าจะออกเอกสารหรือเปล่า
 */
const DocumentRequestCard: React.FC<{
  label: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  quantity: number;
  onQuantityChange: (value: number) => void;
  onPrint: () => void;
  /** เวลาที่กดพิมพ์ครั้งล่าสุด ว่าง = ยังไม่เคยพิมพ์ */
  printedAt?: string;
  language: string;
}> = ({ label, checked, onCheckedChange, quantity, onQuantityChange, onPrint, printedAt, language }) => {
  const isTh = language === 'th';

  return (
    <div
      className={`rounded-2xl border p-4 transition-colors ${
        checked ? 'bg-blue-50/40 border-blue-200' : 'bg-white border-slate-200'
      }`}
    >
      {/* ชื่อเอกสารกับช่องจำนวน/ปุ่มพิมพ์อยู่บรรทัดเดียวกัน
          การ์ดจะสูงเท่ากันทั้งสองใบไม่ว่าติ๊กหรือไม่ติ๊ก
          ถ้าแยกคนละบรรทัด ใบที่ติ๊กจะสูงกว่าจนแถวดูไม่สมดุล
          จอแคบ flex-wrap จะดันลงบรรทัดใหม่ให้เอง */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 min-h-9">
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onCheckedChange(e.target.checked)}
            className="w-4 h-4 shrink-0 accent-blue-600 cursor-pointer"
          />
          <span className="text-sm font-bold text-slate-900">{label}</span>
        </label>

        {checked && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-[11px] font-bold text-slate-600 shrink-0">
              {isTh ? 'จำนวน' : 'Copies'}
            </span>

            <input
              type="number"
              min={1}
              max={20}
              value={quantity}
              /* หนีบค่าไว้ 1-20 เพราะลบหรือศูนย์แล้วพิมพ์ไม่ได้อะไรเลย
                 และการพิมพ์ทีละหลายสิบฉบับมักเป็นการพิมพ์เลขผิด ไม่ใช่ความตั้งใจ
                 ปล่อยว่างชั่วคราวได้ระหว่างพิมพ์ตัวเลข ค่อยเด้งกลับเป็น 1 */
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === '') return;
                const next = Number(raw);
                if (Number.isNaN(next)) return;
                onQuantityChange(Math.min(20, Math.max(1, Math.trunc(next))));
              }}
              onBlur={(e) => {
                if (e.target.value === '') onQuantityChange(1);
              }}
              className="w-16 h-9 px-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold font-mono text-slate-800 text-center focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 focus:outline-hidden transition-all"
            />

            <span className="text-[11px] text-slate-500 shrink-0">{isTh ? 'ฉบับ' : ''}</span>

            {/* ใส่ชื่อเอกสารบนปุ่มด้วย ปุ่มจะได้ไม่เล็กจนกดยาก
                และตอนกดก็ยืนยันในตัวว่ากำลังพิมพ์เอกสารใบไหน */}
            <button
              type="button"
              onClick={onPrint}
              className="h-9 px-4 rounded-xl bg-[#2563eb] hover:bg-blue-700 text-white text-xs font-bold shadow-2xs active:scale-95 transition-all inline-flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5 shrink-0" />
              {isTh ? `พิมพ์ ${label}` : `Print ${label}`}
            </button>
          </div>
        )}
      </div>

      {/* บอกว่าเคยพิมพ์ไปแล้วเมื่อไหร่
          ต่างจาก "ติ๊กไว้เฉยๆ" ตรงที่เอกสารถึงมือผู้ป่วยแล้วจริง
          ถ้ายังไม่เคยพิมพ์จะไม่ขึ้นบรรทัดนี้เลย ไม่ใช่ขึ้นว่า "ยังไม่ได้พิมพ์" */}
      {checked && printedAt && (
        <p className="text-[11px] text-slate-500 text-right mt-2">
          {isTh ? 'พิมพ์ล่าสุด ' : 'Last printed '}
          {formatScreenedAt(printedAt)}
        </p>
      )}
    </div>
  );
};

const DocumentCheckRow: React.FC<{
  label: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
}> = ({ label, checked, onCheckedChange }) => (
  <label className="flex items-center gap-2.5 cursor-pointer select-none">
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange(e.target.checked)}
      className="w-4 h-4 shrink-0 accent-blue-600 cursor-pointer"
    />
    <span className={`text-sm font-semibold ${checked ? 'text-slate-900' : 'text-slate-700'}`}>
      {label}
    </span>
  </label>
);

const EXAM_ANCHOR = {
  chiefComplaint: 'exam-anchor-chief-complaint',
  vitals: 'exam-anchor-vitals',
  assessment: 'exam-anchor-assessment',
  diagnosis: 'exam-anchor-diagnosis',
  prescription: 'exam-anchor-prescription',
} as const;

interface ExaminationViewProps {
  patient: Patient;

  /**
   * ออกจากหน้าตรวจกลับไปหน้าคิว
   *
   * nextStatus บอกว่าจะให้คิวของผู้ป่วยคนนี้เป็นสถานะอะไรต่อ
   *   'Waiting'   = คืนคิว ผู้ป่วยกลับไปรอตรวจตามเดิม (แพทย์เรียกผิดคน/ต้องออกไปก่อน)
   *   'Cancelled' = ยกเลิกการรับบริการ ผู้ป่วยหลุดออกจากคิววันนี้ไปเลย
   *   ไม่ส่งมา     = แค่เปลี่ยนหน้า ไม่แตะสถานะ (ใช้ตอนบันทึกเสร็จแล้ว)
   *
   * ต้องมีพารามิเตอร์นี้เพราะตอนกดเรียกผู้ป่วยเข้าตรวจ ระบบเปลี่ยนสถานะใน
   * ฐานข้อมูลเป็น "กำลังตรวจ" ไปแล้ว ถ้าออกจากหน้านี้โดยไม่คืนสถานะ
   * ผู้ป่วยจะค้างเป็น "กำลังตรวจ" ตลอดไปทั้งที่ไม่มีใครตรวจอยู่
   */
  onBackToQueue: (nextStatus?: 'Waiting' | 'Cancelled', note?: string) => void;
  /** บันทึกลงฐานข้อมูล คืน false ถ้า backend ปฏิเสธ
   *  ต้องรอผลก่อนขึ้นกล่อง "บันทึกสำเร็จ" ไม่งั้นจะบอกว่าสำเร็จทั้งที่ยังไม่ได้บันทึก */
  onSavePatient: (updatedPatient: Patient) => void | boolean | Promise<void | boolean>;
}

// ICD-10 Diagnoses Database with Thai & English names
interface ExpandedDiagnosisItem {
  code: string;
  name: string;
  localName: string;
}

const ICD10_DATABASE: ExpandedDiagnosisItem[] = [
  { code: 'J02.9', name: 'Acute pharyngitis, unspecified', localName: 'คออักเสบเฉียบพลัน' },
  { code: 'J06.9', name: 'Acute upper respiratory infection, unspecified', localName: 'ติดเชื้อทางเดินหายใจส่วนบนเฉียบพลัน (ไข้หวัด)' },
  { code: 'J00', name: 'Acute nasopharyngitis (common cold)', localName: 'ไข้หวัดธรรมดา' },
  { code: 'I10', name: 'Essential (primary) hypertension', localName: 'โรคความดันโลหิตสูง' },
  { code: 'E11.9', name: 'Type 2 diabetes mellitus without complications', localName: 'โรคเบาหวานชนิดที่ 2' },
  { code: 'G43.9', name: 'Migraine, unspecified', localName: 'โรคไมเกรน' },
  { code: 'M54.5', name: 'Low back pain', localName: 'อาการปวดหลังส่วนล่าง' },
  { code: 'L23.9', name: 'Allergic contact dermatitis, unspecified', localName: 'ผื่นผิวหนังอักเสบจากการแพ้' },
  { code: 'R50.9', name: 'Fever, unspecified', localName: 'ไข้ ไม่ระบุสาเหตุ' },
  { code: 'K21.9', name: 'Gastro-esophageal reflux disease without esophagitis', localName: 'โรคกรดไหลย้อน (GERD)' },
  { code: 'E78.5', name: 'Hyperlipidemia, unspecified', localName: 'ภาวะไขมันในเลือดสูง' },
  { code: 'J20.9', name: 'Acute bronchitis, unspecified', localName: 'หลอดลมอักเสบเฉียบพลัน' },
  { code: 'A09.9', name: 'Gastroenteritis and colitis of unspecified origin', localName: 'ลำไส้อักเสบ / ท้องเสียเฉียบพลัน' },
  { code: 'M79.1', name: 'Myalgia', localName: 'อาการปวดกล้ามเนื้อ' },
  { code: 'H10.9', name: 'Conjunctivitis, unspecified', localName: 'เยื่อตาอักเสบ (ตาแดง)' },
  { code: 'N39.0', name: 'Urinary tract infection, site not specified', localName: 'การติดเชื้อทางเดินปัสสาวะ (UTI)' },
  { code: 'K29.7', name: 'Gastritis, unspecified', localName: 'กระเพาะอาหารอักเสบ' },
  { code: 'R05', name: 'Cough', localName: 'อาการไอ' },
  { code: 'R51', name: 'Headache', localName: 'อาการปวดศีรษะ' },
  { code: 'J30.4', name: 'Allergic rhinitis, unspecified', localName: 'โรคภูมิแพ้อากาศ / จมูกอักเสบภูมิแพ้' }
];

const DEFAULT_RECENT_DIAGNOSES: DiagnosisItem[] = [
  { code: 'J02.9', name: 'คออักเสบเฉียบพลัน' },
  { code: 'J06.9', name: 'ติดเชื้อทางเดินหายใจส่วนบนเฉียบพลัน (ไข้หวัด)' },
  { code: 'I10', name: 'โรคความดันโลหิตสูง' },
  { code: 'E11.9', name: 'โรคเบาหวานชนิดที่ 2' },
  { code: 'R50.9', name: 'ไข้ ไม่ระบุสาเหตุ' }
];

// Common Medicines Database with Thai Hospital Standard Defaults
const MEDICINE_DATABASE = [
  {
    name: 'Paracetamol 500mg tab',
    category: 'Analgesic/Antipyretic (ยาแก้ปวดลดไข้)',
    defaultDosage: { th: '1 เม็ด', en: '1 tablet' },
    defaultFreq: { th: 'ทุก 6 ชั่วโมง', en: 'Every 6 hours' },
    defaultDuration: { th: '3 วัน', en: '3 days' },
    defaultQty: 10,
    defaultRoute: { th: 'รับประทาน', en: 'Oral' },
    defaultTiming: { th: 'เมื่อมีอาการ', en: 'As Needed' },
    defaultInstructions: {
      th: 'รับประทานเมื่อมีอาการปวดหรือมีไข้ ห้ามเกิน 8 เม็ด/วัน',
      en: 'Take for pain or fever. Do not exceed 8 tablets/day.'
    }
  },
  {
    name: 'Amoxicillin 500mg cap',
    category: 'Antibiotic (ยาฆ่าเชื้อแก้อักเสบ)',
    defaultDosage: { th: '1 แคปซูล', en: '1 capsule' },
    defaultFreq: { th: 'วันละ 3 ครั้ง', en: '3 times daily' },
    defaultDuration: { th: '7 วัน', en: '7 days' },
    defaultQty: 21,
    defaultRoute: { th: 'รับประทาน', en: 'Oral' },
    defaultTiming: { th: 'หลังอาหาร', en: 'After Meal' },
    defaultInstructions: {
      th: 'รับประทานหลังอาหาร วันละ 3 ครั้ง ติดต่อกันจนหมด',
      en: 'Take after meals 3 times daily until finished.'
    }
  },
  {
    name: 'Ibuprofen 400mg tab',
    category: 'NSAID / Anti-inflammatory (ยาแก้ปวดอักเสบ)',
    defaultDosage: { th: '1 เม็ด', en: '1 tablet' },
    defaultFreq: { th: 'วันละ 3 ครั้ง', en: '3 times daily' },
    defaultDuration: { th: '5 วัน', en: '5 days' },
    defaultQty: 15,
    defaultRoute: { th: 'รับประทาน', en: 'Oral' },
    defaultTiming: { th: 'หลังอาหาร', en: 'After Meal' },
    defaultInstructions: {
      th: 'รับประทานหลังอาหารทันที ดื่มน้ำตามมากๆ',
      en: 'Take immediately after meals with plenty of water.'
    }
  },
  {
    name: 'Amlodipine 5mg tab',
    category: 'Antihypertensive (ยาลดความดัน)',
    defaultDosage: { th: '1 เม็ด', en: '1 tablet' },
    defaultFreq: { th: 'วันละ 1 ครั้ง', en: 'Once daily' },
    defaultDuration: { th: '30 วัน', en: '30 days' },
    defaultQty: 30,
    defaultRoute: { th: 'รับประทาน', en: 'Oral' },
    defaultTiming: { th: 'หลังอาหาร', en: 'After Meal' },
    defaultInstructions: {
      th: 'รับประทานวันละ 1 ครั้ง หลังอาหารเช้า',
      en: 'Take once daily after breakfast.'
    }
  },
  {
    name: 'Omeprazole 20mg cap',
    category: 'Proton Pump Inhibitor (ยาลดกรดกระเพาะอาหาร)',
    defaultDosage: { th: '1 แคปซูล', en: '1 capsule' },
    defaultFreq: { th: 'วันละ 1 ครั้ง', en: 'Once daily' },
    defaultDuration: { th: '14 วัน', en: '14 days' },
    defaultQty: 14,
    defaultRoute: { th: 'รับประทาน', en: 'Oral' },
    defaultTiming: { th: 'ก่อนอาหาร', en: 'Before Meal' },
    defaultInstructions: {
      th: 'รับประทานก่อนอาหารเช้า 30 นาที',
      en: 'Take 30 minutes before breakfast.'
    }
  },
  {
    name: 'Cetirizine 10mg tab',
    category: 'Antihistamine (ยาแก้แพ้ ลดน้ำมูก)',
    defaultDosage: { th: '1 เม็ด', en: '1 tablet' },
    defaultFreq: { th: 'วันละ 1 ครั้ง', en: 'Once daily' },
    defaultDuration: { th: '7 วัน', en: '7 days' },
    defaultQty: 10,
    defaultRoute: { th: 'รับประทาน', en: 'Oral' },
    defaultTiming: { th: 'ก่อนนอน', en: 'Before Bed' },
    defaultInstructions: {
      th: 'รับประทานวันละ 1 ครั้ง ก่อนนอน (อาจทำให้ง่วง)',
      en: 'Take once daily at bedtime (may cause drowsiness).'
    }
  },
  {
    name: 'Metformin 500mg tab',
    category: 'Antidiabetic (ยาเบาหวาน)',
    defaultDosage: { th: '1 เม็ด', en: '1 tablet' },
    defaultFreq: { th: 'วันละ 2 ครั้ง', en: 'Twice daily' },
    defaultDuration: { th: '30 วัน', en: '30 days' },
    defaultQty: 60,
    defaultRoute: { th: 'รับประทาน', en: 'Oral' },
    defaultTiming: { th: 'พร้อมอาหาร', en: 'With Meal' },
    defaultInstructions: {
      th: 'รับประทานพร้อมหรือหลังอาหารทันที',
      en: 'Take with or immediately after meals.'
    }
  },
  {
    name: 'Atorvastatin 20mg tab',
    category: 'Statin (ยาลดไขมันในเลือด)',
    defaultDosage: { th: '1 เม็ด', en: '1 tablet' },
    defaultFreq: { th: 'วันละ 1 ครั้ง', en: 'Once daily' },
    defaultDuration: { th: '30 วัน', en: '30 days' },
    defaultQty: 30,
    defaultRoute: { th: 'รับประทาน', en: 'Oral' },
    defaultTiming: { th: 'ก่อนนอน', en: 'Before Bed' },
    defaultInstructions: {
      th: 'รับประทานวันละ 1 ครั้ง ก่อนนอน',
      en: 'Take once daily at bedtime.'
    }
  },
  {
    name: 'Dextromethorphan 15mg tab',
    category: 'Antitussive (ยาแก้ไอ)',
    defaultDosage: { th: '1 เม็ด', en: '1 tablet' },
    defaultFreq: { th: 'วันละ 3 ครั้ง', en: '3 times daily' },
    defaultDuration: { th: '5 วัน', en: '5 days' },
    defaultQty: 15,
    defaultRoute: { th: 'รับประทาน', en: 'Oral' },
    defaultTiming: { th: 'หลังอาหาร', en: 'After Meal' },
    defaultInstructions: {
      th: 'รับประทานเมื่อมีอาการไอ',
      en: 'Take when coughing.'
    }
  },
  {
    name: 'Salbutamol Inhaler (100mcg)',
    category: 'Bronchodilator (ยาพ่นขยายหลอดลม)',
    defaultDosage: { th: '2 พ่นสูด', en: '2 puffs' },
    defaultFreq: { th: 'ทุก 6 ชั่วโมง', en: 'Every 6 hours' },
    defaultDuration: { th: '30 วัน', en: '30 days' },
    defaultQty: 1,
    defaultRoute: { th: 'พ่นสูด', en: 'Inhalation' },
    defaultTiming: { th: 'เมื่อมีอาการ', en: 'As Needed' },
    defaultInstructions: {
      th: 'พ่นสูดเมื่อมีอาการหอบหืดหรือหายใจขัด',
      en: 'Inhale when experiencing wheezing or shortness of breath.'
    }
  },
  {
    name: 'ORS Electrolyte Powder',
    category: 'Rehydration (เกลือแร่ผงชงดื่ม)',
    defaultDosage: { th: '1 ซอง', en: '1 sachet' },
    defaultFreq: { th: 'เมื่อมีอาการ', en: 'As Needed' },
    defaultDuration: { th: '3 วัน', en: '3 days' },
    defaultQty: 5,
    defaultRoute: { th: 'รับประทาน', en: 'Oral' },
    defaultTiming: { th: 'เมื่อมีอาการ', en: 'As Needed' },
    defaultInstructions: {
      th: 'ละลายน้ำสุก 250 มล. จิบเมื่อถ่ายเหลว',
      en: 'Dissolve in 250ml water, sip when having watery stool.'
    }
  }
];

// Common Lab Tests
const LAB_TEST_DATABASE = [
  { name: 'Complete Blood Count (CBC)', category: 'Hematology' },
  { name: 'Fasting Blood Sugar (FBS)', category: 'Biochemistry' },
  { name: 'HbA1c (Glycated Hemoglobin)', category: 'Biochemistry' },
  { name: 'Lipid Profile (Chol, Trig, HDL, LDL)', category: 'Biochemistry' },
  { name: 'Liver Function Test (LFT)', category: 'Biochemistry' },
  { name: 'Renal Function Test (BUN/Cr)', category: 'Biochemistry' },
  { name: 'Urinalysis (UA)', category: 'Microbiology' },
  { name: 'Electrolytes (Na, K, Cl, CO2)', category: 'Biochemistry' }
];

export const ExaminationView: React.FC<ExaminationViewProps> = ({
  patient,
  onBackToQueue,
  onSavePatient
}) => {
  const { language, t } = useLanguage();
  // Active Examination Tab (Clinical Notes, Diagnosis, Prescription, Referral & Counseling, Follow-up)
  const [activeTab, setActiveTab] = useState<'notes' | 'diagnosis' | 'prescription' | 'referral' | 'followup'>('notes');

  // Status State
  const [status, setStatus] = useState<QueueStatus>(patient.status === 'Waiting' ? 'Examining' : patient.status);

  // History & Complaints State
  const [chiefComplaint, setChiefComplaint] = useState(patient.chiefComplaint || '');
  // ห้ามใส่ค่าเริ่มต้นสมมติในช่องนี้เด็ดขาด
  //
  // เดิมเป็น useState(patient.chiefComplaintDuration || '2 days') ซึ่งแปลว่า
  // เวชระเบียนทุกใบถูกบันทึกลงฐานข้อมูลว่า "เป็นมา 2 วัน" เท่ากันหมด
  // ทั้งที่ไม่เคยมีแพทย์คนไหนกรอก และตอนนั้นก็ไม่มีช่องให้กรอกด้วยซ้ำ
  // เป็นข้อมูลที่ระบบแต่งขึ้นเองแล้วเขียนลงเวชระเบียนจริง
  // อันตรายกว่าช่องว่าง เพราะอ่านแล้วดูเหมือนข้อมูลที่แพทย์ซักมา
  const [chiefComplaintDuration, setChiefComplaintDuration] = useState(patient.chiefComplaintDuration || '');
  const [presentIllness, setPresentIllness] = useState(patient.presentIllness || '');
  const [pastMedicalHistory, setPastMedicalHistory] = useState(patient.pastMedicalHistory || '');
  const [chronicDiseasesText, setChronicDiseasesText] = useState((patient.chronicDiseases || []).join(', '));
  const [noChronicDisease, setNoChronicDisease] = useState(!patient.chronicDiseases || patient.chronicDiseases.length === 0);
  const [currentMedicationsText, setCurrentMedicationsText] = useState((patient.currentMedications || []).join(', '));
  const [hospitalAdmissionHistory, setHospitalAdmissionHistory] = useState(patient.hospitalAdmissionHistory || '');
  const [pastSurgery, setPastSurgery] = useState(patient.pastSurgery || '');
  const [drugAllergiesText, setDrugAllergiesText] = useState((patient.drugAllergies || []).join(', '));
  const [noDrugAllergy, setNoDrugAllergy] = useState(!patient.drugAllergies || patient.drugAllergies.length === 0);
  const [drugAllergySymptoms, setDrugAllergiesSymptoms] = useState(patient.drugAllergySymptoms || '');
  const [foodAllergiesText, setFoodAllergiesText] = useState((patient.foodAllergies || []).join(', '));
  const [noFoodAllergy, setNoFoodAllergy] = useState(!patient.foodAllergies || patient.foodAllergies.length === 0);
  const [foodAllergySymptoms, setFoodAllergySymptoms] = useState('');
  const [familyHistory, setFamilyHistory] = useState(patient.familyHistory || '');
  const [socialHistory, setSocialHistory] = useState(patient.socialHistory || '');
  const [nationalId, setNationalId] = useState(patient.nationalId || '');
  
  // Triage State
  const [triageLevel, setTriageLevel] = useState(patient.triage?.level || '');
  const [priorityLevel, setPriorityLevel] = useState(patient.triage?.priority || '');
  const [triageNotes, setTriageNotes] = useState(patient.triage?.notes || '');

  // Additional Notes
  const [nurseNotes, setNurseNotes] = useState(patient.nurseNotes || '');
  const [importantInfoForDoctor, setImportantInfoForDoctor] = useState(patient.importantInfoForDoctor || '');
  // ไฟล์แนบ 2 รายการที่เคยใส่ไว้ตรงนี้เป็นไฟล์สมมติทั้งคู่
  // (Referral_Document_2026.pdf / Clinical_Photo_2026.jpg)
  // ไม่มีไฟล์จริงในระบบ กดเปิดก็ไม่ได้ และไม่มี endpoint สำหรับแนบไฟล์เลย
  // ถ้าโชว์ไว้ แพทย์จะเข้าใจว่ามีเอกสารส่งตัวรออ่านอยู่ ทั้งที่ไม่มี
  const [attachments, setAttachments] = useState<any[]>(patient.attachments || []);

  // Nursing Physical Assessment State
  const [nurseGenAppearance, setNurseGenAppearance] = useState(patient.nursingAssessment?.generalAppearance || 'Good consciousness, non-toxic appearance');
  // ระดับความรู้สึกตัวยังไม่มีคอลัมน์ในตาราง screenings จุดคัดกรองจึงยังส่งมาไม่ได้
  // เว้นว่างไว้แทนการเดาว่า "Alert" เพราะเป็นค่าที่ใช้แยกเคสฉุกเฉิน เดาผิดแล้วอันตราย
  const [nurseConsciousness, setNurseConsciousness] = useState(patient.nursingAssessment?.consciousness || '');
  const [nurseMobility, setNurseMobility] = useState(patient.nursingAssessment?.mobility || '');
  const [nurseRespiratory, setNurseRespiratory] = useState(patient.nursingAssessment?.respiratoryCondition || '');
  const [nurseBleeding, setNurseBleeding] = useState(patient.nursingAssessment?.bleeding || '');
  const [nurseOtherFindings, setNurseOtherFindings] = useState(patient.nursingAssessment?.otherFindings || '');

  // ==========================================================================
  // สัญญาณชีพ: ห้ามมีค่าเริ่มต้นสมมติเด็ดขาด
  // ==========================================================================
  // ทุกช่องในกลุ่มนี้เป็นค่าที่พยาบาลวัดมาจากจุดคัดกรอง แพทย์แก้ไม่ได้ (อ่านอย่างเดียว)
  // เดิมใส่ค่าไว้เผื่อตอนทำหน้าจอก่อนต่อ API เช่น bp '120/80', temp 36.8, spo2 98
  // พอต่อ API จริงแล้วค่าพวกนี้กลายเป็นตัวหลอก: เคสที่พยาบาลยังไม่ได้วัด
  // หน้าจอจะขึ้นตัวเลขที่ดูเหมือนวัดมาแล้ว แพทย์แยกไม่ออกว่าอันไหนของจริง
  //
  // เปลี่ยนเป็น undefined เพื่อให้หน้าจอแสดง "ยังไม่ได้วัด" ได้อย่างตรงไปตรงมา
  // ค่าสัญญาณชีพที่ระบบแต่งขึ้นเองอันตรายกว่าช่องว่างเสมอ
  // โดยเฉพาะอุณหภูมิกับความดัน ซึ่งใช้ตัดสินว่าเคสนี้ฉุกเฉินหรือไม่
  const [bp, setBp] = useState(patient.vitals?.bp || '');
  const [pulse, setPulse] = useState<number | undefined>(patient.vitals?.pulse);
  const [respiratoryRate, setRespiratoryRate] = useState<number | undefined>(patient.vitals?.respiratoryRate);
  const [temp, setTemp] = useState<number | undefined>(patient.vitals?.temp);
  const [spo2, setSpo2] = useState<number | undefined>(patient.vitals?.spo2);
  const [weight, setWeight] = useState<number | undefined>(patient.vitals?.weight);
  const [height, setHeight] = useState<number | undefined>(patient.vitals?.height);
  // ปล่อยเป็น undefined เมื่อจุดคัดกรองไม่ได้กรอก จะได้แสดงว่า "ไม่มีข้อมูล"
  // แทนการเดาค่าให้ ค่าสัญญาณชีพที่ระบบแต่งขึ้นเองอันตรายกว่าช่องว่าง
  const [painScore, setPainScore] = useState<number | undefined>(patient.vitals?.painScore);
  const [bloodSugar, setBloodSugar] = useState<number | undefined>(patient.vitals?.bloodSugar);

  // Auto calculated BMI
  // คำนวณจากน้ำหนักและส่วนสูงที่พยาบาลวัดมาเท่านั้น
  // ถ้าขาดตัวใดตัวหนึ่งคืน 0 แล้วหน้าจอจะแสดงว่ายังไม่ได้วัด
  // ห้ามคืนค่ากลางๆ อย่าง 22.9 เพราะจะกลายเป็น "ผู้ป่วยรูปร่างปกติ" ที่ระบบแต่งขึ้นเอง
  const bmi = React.useMemo(() => {
    if (weight && height && weight > 0 && height > 0) {
      const hMeter = height / 100;
      return Number((weight / (hMeter * hMeter)).toFixed(1));
    }
    return 0;
  }, [weight, height]);

  // Physical Exam - Initial empty string so placeholder example text shows up clean
  const [generalAppearance, setGeneralAppearance] = useState('');
  const [heent, setHeent] = useState('');
  const [cardiovascular, setCardiovascular] = useState('');
  const [respiratory, setRespiratory] = useState('');
  const [abdomen, setAbdomen] = useState('');
  const [musculoskeletal, setMusculoskeletal] = useState('');
  const [neurological, setNeurological] = useState('');
  const [skin, setSkin] = useState('');

  // Assessment & Diagnosis State
  const [primaryDiag, setPrimaryDiag] = useState<DiagnosisItem | null>(
    patient.primaryDiagnosis || { code: 'J02.9', name: 'Acute pharyngitis, unspecified (คออักเสบเฉียบพลัน)' }
  );
  const [secondaryDiags, setSecondaryDiags] = useState<DiagnosisItem[]>(patient.secondaryDiagnoses || []);
  const [diagSearch, setDiagSearch] = useState('');
  const [showDiagDropdown, setShowDiagDropdown] = useState(false);
  const [diagWarning, setDiagWarning] = useState('');
  const [editingDiagTarget, setEditingDiagTarget] = useState<'primary' | number | null>(null);
  const [editDiagText, setEditDiagText] = useState('');

  // Recent Diagnoses stored in localStorage for currently logged-in doctor
  const [recentDiagnoses, setRecentDiagnoses] = useState<DiagnosisItem[]>(() => {
    try {
      const saved = localStorage.getItem('recent_icd10_diagnoses');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_RECENT_DIAGNOSES;
  });

  // Save diagnoses to doctor's Recent Diagnosis history
  const saveToRecentDiagnoses = (itemsToSave: DiagnosisItem[]) => {
    if (!itemsToSave || itemsToSave.length === 0) return;
    setRecentDiagnoses(prev => {
      const validItems = itemsToSave.filter(item => item && item.code);
      const combined = [...validItems, ...prev];
      const uniqueMap = new Map<string, DiagnosisItem>();
      combined.forEach(item => {
        if (item.code && !uniqueMap.has(item.code)) {
          uniqueMap.set(item.code, item);
        }
      });
      const updatedList = Array.from(uniqueMap.values()).slice(0, 10);
      try {
        localStorage.setItem('recent_icd10_diagnoses', JSON.stringify(updatedList));
      } catch (e) {
        console.error(e);
      }
      return updatedList;
    });
  };

  // Check if code is already selected
  const isCodeSelected = (code: string) => {
    if (primaryDiag?.code === code) return true;
    return secondaryDiags.some(d => d.code === code);
  };

  // Add diagnosis from search or recent
  const handleSelectDiagnosis = (item: { code: string; name: string; localName?: string }, forceSecondary = false) => {
    setDiagWarning('');
    if (isCodeSelected(item.code)) {
      setDiagWarning(`รหัส ICD-10 (${item.code}) ถูกเลือกไว้ในรายการแล้ว (Prevent Duplicate ICD-10 Code)`);
      return;
    }

    const displayName = item.localName || item.name;
    const diagObj: DiagnosisItem = { code: item.code, name: displayName };

    if (!primaryDiag && !forceSecondary) {
      setPrimaryDiag(diagObj);
    } else {
      setSecondaryDiags(prev => [...prev, diagObj]);
    }

    setDiagSearch('');
    setShowDiagDropdown(false);
  };

  // Promote secondary diagnosis to Primary
  const handlePromoteToPrimary = (index: number) => {
    const target = secondaryDiags[index];
    if (!target) return;

    const newSecondaryList = [...secondaryDiags];
    newSecondaryList.splice(index, 1);

    if (primaryDiag) {
      newSecondaryList.unshift(primaryDiag);
    }

    setPrimaryDiag(target);
    setSecondaryDiags(newSecondaryList);
    setDiagWarning('');
  };

  // Demote primary diagnosis to Secondary
  const handleDemotePrimary = () => {
    if (!primaryDiag) return;
    setSecondaryDiags(prev => [primaryDiag, ...prev]);
    setPrimaryDiag(null);
  };

  // Remove primary diagnosis
  const handleRemovePrimary = () => {
    if (secondaryDiags.length > 0) {
      const [first, ...rest] = secondaryDiags;
      setPrimaryDiag(first);
      setSecondaryDiags(rest);
    } else {
      setPrimaryDiag(null);
    }
    setDiagWarning('');
  };

  // Remove secondary diagnosis
  const handleRemoveSecondary = (index: number) => {
    setSecondaryDiags(prev => prev.filter((_, i) => i !== index));
    setDiagWarning('');
  };

  // Reorder secondary diagnoses
  const handleMoveSecondaryUp = (index: number) => {
    if (index <= 0) return;
    setSecondaryDiags(prev => {
      const updated = [...prev];
      const temp = updated[index - 1];
      updated[index - 1] = updated[index];
      updated[index] = temp;
      return updated;
    });
  };

  const handleMoveSecondaryDown = (index: number) => {
    if (index >= secondaryDiags.length - 1) return;
    setSecondaryDiags(prev => {
      const updated = [...prev];
      const temp = updated[index + 1];
      updated[index + 1] = updated[index];
      updated[index] = temp;
      return updated;
    });
  };

  // Edit diagnosis text
  const startEditDiagnosis = (target: 'primary' | number, currentName: string) => {
    setEditingDiagTarget(target);
    setEditDiagText(currentName);
  };

  const saveEditDiagnosis = () => {
    if (editingDiagTarget === 'primary' && primaryDiag) {
      setPrimaryDiag({ ...primaryDiag, name: editDiagText });
    } else if (typeof editingDiagTarget === 'number' && secondaryDiags[editingDiagTarget]) {
      setSecondaryDiags(prev => {
        const updated = [...prev];
        updated[editingDiagTarget] = { ...updated[editingDiagTarget], name: editDiagText };
        return updated;
      });
    }
    setEditingDiagTarget(null);
    setEditDiagText('');
  };

  // Filter ICD-10 database for search dropdown
  const filteredICD10 = ICD10_DATABASE.filter(item => {
    const q = diagSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      item.code.toLowerCase().includes(q) ||
      item.name.toLowerCase().includes(q) ||
      (item.localName && item.localName.toLowerCase().includes(q))
    );
  });

  const [assessmentNotes, setAssessmentNotes] = useState(patient.assessmentNotes || '');
  const [clinicalNotes, setClinicalNotes] = useState(patient.clinicalNotes || '');
  const [treatmentPlan, setTreatmentPlan] = useState(patient.treatmentPlan || '');
  const [proceduresPerformed, setProceduresPerformed] = useState(patient.proceduresPerformed || '');

  // Prescriptions State
  const [prescriptions, setPrescriptions] = useState<PrescriptionItem[]>(
    patient.prescriptions && patient.prescriptions.length > 0
      ? patient.prescriptions
      : []
  );

  // New Prescription Form state
  const [medSearch, setMedSearch] = useState('');
  const [isMedDropdownOpen, setIsMedDropdownOpen] = useState(false);
  const medDropdownRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (medDropdownRef.current && !medDropdownRef.current.contains(event.target as Node)) {
        setIsMedDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const [medicinesList, setMedicinesList] = useState<any[]>(MEDICINE_DATABASE);

  /**
   * โหลดรายการยาจริงจากคลังของห้องยาสำเร็จแล้วหรือยัง
   *
   * ตัวแปรนี้เป็นสวิตช์ของกฎ "ห้ามสั่งยาที่ไม่มีในคลัง"
   * ถ้าโหลดสำเร็จ = บังคับให้แพทย์เลือกยาจากรายการเท่านั้น
   * ถ้าโหลดไม่สำเร็จ (backend ล่ม / ไม่มีสิทธิ์) = ปล่อยให้พิมพ์เองได้เหมือนเดิม
   *
   * ทำไมต้องมีเงื่อนไขนี้: ค่าเริ่มต้นของ medicinesList คือ MEDICINE_DATABASE
   * ซึ่งเป็นรายการฮาร์ดโค้ดในไฟล์ ไม่มีเลข id ของคลังจริง
   * ถ้าบังคับกฎโดยไม่ดูว่าโหลดสำเร็จหรือยัง เวลา backend ล่ม
   * แพทย์จะสั่งยาไม่ได้เลยสักตัว ซึ่งอันตรายกว่าปัญหาที่กำลังแก้อยู่
   */
  const [medicinesLoaded, setMedicinesLoaded] = useState(false);

  useEffect(() => {
    // Fetch live medicines database from backend
    const fetchMeds = async () => {
      try {
        const token = localStorage.getItem('token') || localStorage.getItem('clinic_auth_token');
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        let res = await fetch('/api/pharmacy/medicines', { headers });
        if (!res.ok) {
          res = await fetch('/api/system/medicines');
        }
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'success' && Array.isArray(data.medicines) && data.medicines.length > 0) {
            const mapped = data.medicines.map((m: any) => {
              // ================================================================
              // ค่าตั้งต้นของยาแต่ละตัว
              // ================================================================
              // ลำดับ: ใช้ค่าที่ห้องยากรอกไว้ตอนเพิ่มยาเข้าคลังก่อนเสมอ
              //        ถ้ายังไม่ได้กรอก ค่อยตกมาใช้ค่าที่เดาจากชื่อ/สรรพคุณ
              //
              // ทำไมต้องมีลำดับนี้:
              // ของเดิมเดาค่าตั้งต้นจากการหาคำในชื่อยาและสรรพคุณล้วนๆ
              // (เห็นคำว่า cap = 1 แคปซูล, เห็นคำว่า ความดัน = วันละ 1 ครั้ง 30 วัน)
              // ซึ่งเดาผิดได้ง่ายมาก เช่นยาที่ชื่อมีคำว่า "cap" แต่เป็นยาน้ำ
              // หรือยาลดความดันที่ชื่อไม่มีคำว่าความดันและสรรพคุณเขียนคนละแบบ
              // แพทย์ต้องมานั่งแก้เองทุกครั้ง และถ้าเผลอไม่แก้ก็ได้ค่าผิดไปเลย
              //
              // พอห้องยากรอกค่าตั้งต้นจริงไว้ในตาราง medicines ก็ไม่ต้องเดาอีก
              // แพทย์ยังแก้ทับได้ทุกช่องเหมือนเดิม ค่าที่แก้จะไม่ย้อนกลับไปแตะคลังยา
              //
              // ชื่อคอลัมน์ที่รองรับ (ห้องยาเพิ่มเมื่อไรก็ทำงานทันที ไม่ต้องแก้โค้ดนี้อีก)
              //   default_dosage / default_frequency / default_duration
              //   default_quantity / default_route / default_timing / default_instructions
              const pick = (...vals: any[]) => {
                for (const v of vals) {
                  if (typeof v === 'string' && v.trim()) return v.trim();
                }
                return '';
              };

              const isLiquid = (m.name || '').toLowerCase().includes('syrup') || (m.name || '').toLowerCase().includes('liquid') || (m.name || '').toLowerCase().includes('sol');
              const isCap = (m.name || '').toLowerCase().includes('cap');
              const isLongTerm = (m.properties || '').includes('ความดัน') || (m.properties || '').includes('เบาหวาน');

              const defaultDosageStr = pick(
                m.default_dosage, m.defaultDosage,
                isLiquid ? '10 มล.' : (isCap ? '1 แคปซูล' : '1 เม็ด'),
              );
              const defaultFreqStr = pick(
                m.default_frequency, m.default_freq, m.defaultFrequency,
                isLongTerm || (m.name || '').includes('Amlodipine') || (m.name || '').includes('Omeprazole') ? 'วันละ 1 ครั้ง' : 'วันละ 3 ครั้ง',
              );
              const defaultTimingStr = pick(
                m.default_timing, m.defaultTiming,
                (m.name || '').includes('Omeprazole') ? 'ก่อนอาหาร' : ((m.properties || '').includes('ลดไข้') || (m.name || '').includes('Paracetamol') ? 'เมื่อมีอาการ' : 'หลังอาหาร'),
              );
              const defaultDurationStr = pick(
                m.default_duration, m.defaultDuration,
                isLongTerm ? '30 วัน' : '5 วัน',
              );
              const defaultRouteStr = pick(m.default_route, m.route, m.defaultRoute, 'รับประทาน');

              // จำนวนเป็นตัวเลข ต้องเช็คแยก เพราะ 0 กับค่าว่างมีความหมายต่างกัน
              // ห้องยาใส่ 0 ไว้ = ยังไม่ได้กำหนด ให้ตกไปใช้ค่าเดาตามเดิม
              const rawQty = Number(m.default_quantity ?? m.defaultQty);
              const defaultQtyNum = Number.isFinite(rawQty) && rawQty > 0
                ? rawQty
                : (isLongTerm ? 30 : 10);

              const defaultLabelStr = pick(
                m.default_instructions, m.label_instructions, m.defaultInstructions,
                m.properties,
                'รับประทานยาตามแพทย์สั่งอย่างเคร่งครัด',
              );

              return {
                id: m.id,
                code: m.medicine_code,
                name: m.name,
                genericName: m.generic_name,
                category: m.category,
                properties: m.properties,
                price: m.unit_price || m.price,
                stock: m.stock_quantity || m.stock,
                defaultDosage: { th: defaultDosageStr, en: defaultDosageStr },
                defaultFreq: { th: defaultFreqStr, en: defaultFreqStr },
                defaultDuration: { th: defaultDurationStr, en: defaultDurationStr },
                defaultQty: defaultQtyNum,
                defaultRoute: { th: defaultRouteStr, en: defaultRouteStr === 'รับประทาน' ? 'Oral' : defaultRouteStr },
                defaultTiming: { th: defaultTimingStr, en: defaultTimingStr },
                defaultInstructions: {
                  th: defaultLabelStr,
                  en: m.generic_name ? `Generic: ${m.generic_name}` : 'Take as directed by physician.'
                }
              };
            });
            setMedicinesList(mapped);
            setMedicinesLoaded(true);
          }
        }
      } catch (err) {
        console.error('Failed to fetch medicines for doctor prescription:', err);
      }
    };
    fetchMeds();
  }, []);

  const filteredMedicines = React.useMemo(() => {
    if (!medSearch.trim()) {
      return medicinesList;
    }
    const q = medSearch.trim().toLowerCase();
    return medicinesList.filter(m =>
      (m.name || '').toLowerCase().includes(q) ||
      (m.code || '').toLowerCase().includes(q) ||
      (m.genericName || '').toLowerCase().includes(q) ||
      (m.category || '').toLowerCase().includes(q)
    );
  }, [medSearch, medicinesList]);

  const [newMedName, setNewMedName] = useState('');

  /**
   * รหัสของยาที่แพทย์เพิ่งเลือกจากรายการ (มาจากตาราง medicines ของห้องยาโดยตรง)
   *
   * ทำไมต้องเก็บ: เดิมตอนกดเลือกยา โค้ดเก็บแค่ "ชื่อ" ไปใส่ในใบสั่งยา
   * แล้วปล่อยให้ backend ไปค้นหายาในคลังจากชื่อนั้นอีกทีตอนบันทึก
   * ซึ่งเสี่ยงมาก เพราะการค้นด้วยชื่อมีขั้นที่จับแบบขึ้นต้นเหมือนกัน
   * ยาคนละตัวที่ชื่อขึ้นต้นเหมือนกันจึงสลับกันได้ (เช่น Amoxicillin 500mg / 500mg cap)
   *
   * พอเก็บ id ตั้งแต่ตอนเลือก backend ก็ไม่ต้องเดาอีกเลย ใช้ id ตรงๆ
   * เป็น null เมื่อแพทย์พิมพ์ชื่อยาเองโดยไม่ได้เลือกจากรายการ
   * (กรณีนั้น backend จะค้นจากชื่อตามเดิม และเตือนกลับมาถ้าหาไม่เจอ)
   */
  const [selectedMedicine, setSelectedMedicine] = useState<{
    id?: number;
    code?: string;
    price?: number;
  } | null>(null);

  const [newMedDosage, setNewMedDosage] = useState('');
  const [newMedFreq, setNewMedFreq] = useState('');
  const [newMedDuration, setNewMedDuration] = useState('');
  const [newMedQty, setNewMedQty] = useState<number | ''>('');
  const [newMedRoute, setNewMedRoute] = useState('');
  const [newMedTiming, setNewMedTiming] = useState('');
  const [newMedInstructions, setNewMedInstructions] = useState('');

  // Lab Orders State
  const [labOrders, setLabOrders] = useState<LabOrderItem[]>(patient.labOrders || []);
  const [selectedLabTest, setSelectedLabTest] = useState(LAB_TEST_DATABASE[0].name);
  const [labIndication, setLabIndication] = useState('');
  const [labIsUrgent, setLabIsUrgent] = useState(false);

  // Imaging Orders State
  const [imagingOrders, setImagingOrders] = useState<ImagingOrderItem[]>(patient.imagingOrders || []);
  const [imgType, setImgType] = useState<'X-Ray' | 'Ultrasound' | 'CT Scan' | 'MRI' | 'ECG' | 'Other'>('X-Ray');
  const [imgBodyPart, setImgBodyPart] = useState('Chest PA Upright');
  const [imgIndication, setImgIndication] = useState('');
  const [imgIsUrgent, setImgIsUrgent] = useState(false);

  // Referral State
  const [refDept, setRefDept] = useState(patient.referral?.department || '');
  const [refDoctor, setRefDoctor] = useState(patient.referral?.doctor || '');
  const [refReason, setRefReason] = useState(patient.referral?.reason || '');
  const [refNotes, setRefNotes] = useState(patient.referral?.notes || '');

  // Counseling State
  const [counselMed, setCounselMed] = useState(patient.counseling?.medicationAdvice || '');
  const [counselDiet, setCounselDiet] = useState(patient.counseling?.dietAdvice || 'Warm fluid intake, avoid cold drinks.');
  const [counselExercise, setCounselExercise] = useState(patient.counseling?.exerciseAdvice || 'Rest adequately.');
  const [counselLifestyle, setCounselLifestyle] = useState(patient.counseling?.lifestyleAdvice || '');

  /**
   * ============================================================================
   * เอกสารทั่วไปที่แพทย์ออกให้ผู้ป่วย [role แพทย์]
   * ============================================================================
   * ติ๊กว่าต้องการเอกสารไหน ติ๊กแล้วถึงกรอกจำนวนและกดพิมพ์ได้
   * ค่าเริ่มต้นของจำนวนคือ 1 ฉบับ ซึ่งเป็นกรณีที่พบบ่อยที่สุด แก้เป็นเลขอื่นได้
   *
   * หมายเหตุ: ตอนนี้ยังเก็บอยู่ในหน้าจอเท่านั้น ยังไม่ได้บันทึกลงฐานข้อมูล
   * เพราะตาราง examinations ยังไม่มีคอลัมน์รองรับ ถ้าต้องการเก็บประวัติ
   * ว่าเคยออกเอกสารอะไรให้ใครไปบ้าง ต้องเพิ่มคอลัมน์ที่ backend ก่อน
   */
  const savedDoc = (type: string) => (patient.issuedDocuments || []).find((d) => d.type === type);

  const [wantMedicalCert, setWantMedicalCert] = useState(!!savedDoc('medical-certificate'));
  const [medicalCertQty, setMedicalCertQty] = useState(savedDoc('medical-certificate')?.quantity || 1);
  const [wantNonFormularyCert, setWantNonFormularyCert] = useState(!!savedDoc('non-formulary'));
  const [nonFormularyQty, setNonFormularyQty] = useState(savedDoc('non-formulary')?.quantity || 1);

  // เวลาที่กดพิมพ์ครั้งล่าสุดของแต่ละชนิด เก็บไว้เพื่อแยกให้ออกว่า
  // "ติ๊กไว้แต่ยังไม่ได้พิมพ์" กับ "พิมพ์ให้ผู้ป่วยไปแล้ว" ซึ่งไม่เหมือนกัน
  // เคสที่ติ๊กแล้วเครื่องพิมพ์เสีย ต้องรู้ว่ายังไม่ได้ให้เอกสารผู้ป่วยไป
  const [medicalCertPrintedAt, setMedicalCertPrintedAt] = useState(
    savedDoc('medical-certificate')?.printedAt || ''
  );
  const [nonFormularyPrintedAt, setNonFormularyPrintedAt] = useState(
    savedDoc('non-formulary')?.printedAt || ''
  );

  /**
   * เอกสารอื่นๆ ที่ติ๊กอย่างเดียว ไม่มีจำนวนและไม่มีปุ่มพิมพ์
   * เพราะยังไม่มีแบบฟอร์มมาตรฐานในระบบ แพทย์ใช้แบบฟอร์มกระดาษของคลินิก
   * การติ๊กตรงนี้คือการ "บันทึกว่าออกเอกสารอะไรให้ผู้ป่วยไปบ้าง" เท่านั้น
   */
  const [wantInsuranceClaim, setWantInsuranceClaim] = useState(!!savedDoc('insurance-claim'));
  const [wantReferralOpinion, setWantReferralOpinion] = useState(!!savedDoc('referral-opinion'));
  const [wantDental, setWantDental] = useState(!!savedDoc('dental'));
  const [wantOtherDoc, setWantOtherDoc] = useState(!!savedDoc('other'));

  /** สถานะผู้ป่วยหลังตรวจเสร็จ '' = ยังไม่ระบุ | 'home' = กลับบ้าน | 'refer' = ส่งต่อ */
  const [disposition, setDisposition] = useState(patient.disposition || '');
  const [otherDocName, setOtherDocName] = useState(savedDoc('other')?.name || '');

  /** รวมสถานะเอกสารทั้งหมดเป็น array เดียว สำหรับส่งไปบันทึก */
  const collectIssuedDocuments = (): IssuedDocument[] => {
    const docs: IssuedDocument[] = [];
    if (wantMedicalCert) {
      docs.push({
        type: 'medical-certificate',
        quantity: medicalCertQty,
        printedAt: medicalCertPrintedAt || undefined,
      });
    }
    if (wantNonFormularyCert) {
      docs.push({
        type: 'non-formulary',
        quantity: nonFormularyQty,
        printedAt: nonFormularyPrintedAt || undefined,
      });
    }

    // เอกสารกลุ่มติ๊กอย่างเดียว quantity เป็น 1 เสมอ
    // (backend หนีบค่าให้อย่างน้อย 1 อยู่แล้ว แต่ส่งให้ชัดเจนดีกว่าปล่อยเป็น 0)
    if (wantInsuranceClaim) docs.push({ type: 'insurance-claim', quantity: 1 });
    if (wantReferralOpinion) docs.push({ type: 'referral-opinion', quantity: 1 });
    if (wantDental) docs.push({ type: 'dental', quantity: 1 });

    // เอกสารที่แพทย์ระบุชื่อเอง ถ้ายังไม่พิมพ์ชื่อจะไม่ส่งไป
    // เพราะบันทึกไปก็ไม่รู้ว่าเอกสารอะไร (backend ก็กรองซ้ำอีกชั้น)
    if (wantOtherDoc && otherDocName.trim() !== '') {
      docs.push({ type: 'other', quantity: 1, name: otherDocName.trim() });
    }

    return docs;
  };

  /**
   * เปิดหน้าต่างพิมพ์เอกสาร
   * --------------------------------------------------------------------------
   * สร้างเอกสารเป็นหน้าต่างใหม่แล้วสั่งพิมพ์ ไม่ใช้ window.print() ของหน้าหลัก
   * เพราะจะพิมพ์ทั้งหน้าจอออกมารวมทั้งเมนูและแท็บ ซึ่งใช้เป็นเอกสารไม่ได้
   *
   * เอกสารที่ออกมาเว้นช่องลงชื่อแพทย์ไว้ให้เซ็นเอง ไม่ได้พิมพ์ชื่อแพทย์ลงไปให้
   * เพราะเอกสารพวกนี้มีผลทางกฎหมาย ต้องมีลายมือชื่อจริงของผู้ออกเสมอ
   */
  const printClinicDocument = (kind: 'medical-certificate' | 'non-formulary', copies: number) => {
    const isTh = language === 'th';
    const win = window.open('', '_blank', 'width=900,height=1000');

    if (!win) {
      // เบราว์เซอร์บล็อกป๊อปอัป ต้องบอกผู้ใช้ ไม่ใช่เงียบแล้วให้งงว่าทำไมกดแล้วไม่มีอะไรเกิด
      alert(
        isTh
          ? 'เบราว์เซอร์บล็อกหน้าต่างพิมพ์ กรุณาอนุญาตป๊อปอัปของเว็บนี้แล้วลองใหม่'
          : 'The browser blocked the print window. Please allow pop-ups for this site and try again.'
      );
      return;
    }

    // กันข้อความจากฐานข้อมูลไปแตก HTML (ชื่อผู้ป่วยอาจมีอักขระพิเศษ)
    const esc = (value: string | undefined) =>
      (value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    const title =
      kind === 'medical-certificate'
        ? isTh ? 'ใบรับรองแพทย์' : 'Medical Certificate'
        : isTh ? 'ใบรับรองยานอกบัญชียาหลักแห่งชาติ' : 'Non-Formulary Drug Certificate';

    const today = new Date().toLocaleDateString(isTh ? 'th-TH' : 'en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const diagText = primaryDiag ? `${primaryDiag.code} ${primaryDiag.name}` : '';

    // ใบรับรองยานอกบัญชีต้องระบุว่าเป็นยาตัวไหน จึงแนบรายการยาที่สั่งในครั้งนี้
    const drugRows = prescriptions
      .map(
        (item, index) => `<tr>
            <td style="text-align:center">${index + 1}</td>
            <td>${esc(item.medicineName)}</td>
            <td>${esc(item.dosage)} ${esc(item.frequency)}</td>
            <td style="text-align:center">${esc(item.duration)}</td>
          </tr>`
      )
      .join('');

    const bodyByKind =
      kind === 'medical-certificate'
        ? `
          <div class="row"><span class="lbl">${isTh ? 'การวินิจฉัย' : 'Diagnosis'}</span><span class="val">${esc(diagText) || '&nbsp;'}</span></div>
          <div class="row"><span class="lbl">${isTh ? 'ความเห็นแพทย์' : "Doctor's opinion"}</span><span class="val line"></span></div>
          <div class="row"><span class="lbl">&nbsp;</span><span class="val line"></span></div>
          <div class="row"><span class="lbl">${isTh ? 'ควรหยุดพักงาน' : 'Recommended rest'}</span><span class="val">${isTh ? '............ วัน ตั้งแต่วันที่ ................ ถึงวันที่ ................' : '........ days, from ............ to ............'}</span></div>
        `
        : `
          <div class="row"><span class="lbl">${isTh ? 'การวินิจฉัย' : 'Diagnosis'}</span><span class="val">${esc(diagText) || '&nbsp;'}</span></div>
          <p class="note">${isTh
            ? 'ขอรับรองว่ายาต่อไปนี้เป็นยานอกบัญชียาหลักแห่งชาติ ซึ่งมีความจำเป็นต่อการรักษาของผู้ป่วยรายนี้'
            : 'This certifies that the following non-formulary medicines are necessary for this patient.'}</p>
          <table>
            <thead>
              <tr>
                <th style="width:8%">${isTh ? 'ลำดับ' : 'No.'}</th>
                <th style="width:42%">${isTh ? 'รายการยา' : 'Medicine'}</th>
                <th style="width:32%">${isTh ? 'ขนาด / ความถี่' : 'Dose / Frequency'}</th>
                <th style="width:18%">${isTh ? 'ระยะเวลา' : 'Duration'}</th>
              </tr>
            </thead>
            <tbody>${drugRows || `<tr><td colspan="4" style="text-align:center;color:#64748b">${isTh ? '- ยังไม่ได้สั่งยาในการตรวจครั้งนี้ -' : '- No medicines ordered -'}</td></tr>`}</tbody>
          </table>
          <div class="row"><span class="lbl">${isTh ? 'เหตุผลที่ใช้ยานอกบัญชี' : 'Justification'}</span><span class="val line"></span></div>
        `;

    // พิมพ์หลายฉบับ = วนสร้างหน้าเดิมซ้ำ คั่นด้วย page-break
    const pages = Array.from({ length: Math.max(1, copies) })
      .map(
        (_, index) => `
        <section class="doc">
          <header>
            <h1>General Clinic</h1>
            <p class="sub">${isTh ? 'คลินิกเวชกรรมทั่วไป' : 'General Medical Clinic'}</p>
            <h2>${title}</h2>
          </header>

          <div class="row"><span class="lbl">${isTh ? 'ชื่อ-นามสกุล' : 'Patient name'}</span><span class="val">${esc(patient.name)}</span></div>
          <div class="row"><span class="lbl">${isTh ? 'เลขบัตรประชาชน' : 'National ID'}</span><span class="val">${esc(formatNationalId(nationalId))}</span></div>
          <div class="row"><span class="lbl">HN / VN</span><span class="val">${esc(patient.hn)} / ${esc(displayVN(patient.vn))}</span></div>
          <div class="row"><span class="lbl">${isTh ? 'วันที่ตรวจ' : 'Date of visit'}</span><span class="val">${today}</span></div>

          ${bodyByKind}

          <div class="sign">
            <div class="sign-line"></div>
            <p>${isTh ? 'ลงชื่อ แพทย์ผู้ตรวจ' : 'Signature, examining physician'}</p>
            <p class="muted">${isTh ? 'เลขที่ใบอนุญาตประกอบวิชาชีพเวชกรรม ............................' : 'Medical license no. ............................'}</p>
          </div>

          <p class="copy-no">${isTh ? `ฉบับที่ ${index + 1} จาก ${Math.max(1, copies)}` : `Copy ${index + 1} of ${Math.max(1, copies)}`}</p>
        </section>`
      )
      .join('');

    win.document.write(`<!doctype html>
<html lang="${isTh ? 'th' : 'en'}">
<head>
<meta charset="utf-8">
<title>${title} - ${esc(patient.name)}</title>
<style>
  @page { size: A4; margin: 18mm; }
  * { box-sizing: border-box; }
  body { font-family: "Sarabun", "TH Sarabun New", system-ui, sans-serif; color: #0f172a; margin: 0; }
  .doc { page-break-after: always; padding-bottom: 8mm; }
  .doc:last-child { page-break-after: auto; }
  header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 22px; }
  h1 { font-size: 22px; margin: 0; letter-spacing: .5px; }
  .sub { font-size: 13px; margin: 2px 0 14px; color: #475569; }
  h2 { font-size: 18px; margin: 0; }
  .row { display: flex; gap: 10px; margin-bottom: 12px; font-size: 14px; align-items: flex-end; }
  .lbl { width: 170px; flex: none; color: #475569; }
  .val { flex: 1; border-bottom: 1px dotted #94a3b8; padding-bottom: 2px; min-height: 20px; }
  .val.line { min-height: 24px; }
  .note { font-size: 14px; margin: 18px 0 10px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 16px; }
  th, td { border: 1px solid #94a3b8; padding: 6px 8px; }
  th { background: #f1f5f9; text-align: left; }
  .sign { margin-top: 48px; text-align: right; }
  .sign-line { width: 260px; border-bottom: 1px solid #0f172a; margin-left: auto; margin-bottom: 6px; }
  .sign p { margin: 2px 0; font-size: 13px; }
  .muted { color: #64748b; font-size: 12px; }
  .copy-no { text-align: right; color: #94a3b8; font-size: 11px; margin-top: 24px; }
</style>
</head>
<body>${pages}</body>
</html>`);

    win.document.close();
    win.focus();

    // รอให้เบราว์เซอร์จัดหน้าเสร็จก่อนเรียกกล่องพิมพ์ ไม่งั้นบางเครื่องได้หน้าว่าง
    setTimeout(() => win.print(), 300);

    // จดเวลาที่กดพิมพ์ไว้ จะถูกบันทึกลงฐานข้อมูลตอนกดบันทึกการตรวจ
    // หมายเหตุ: บันทึกตอน "กดปุ่มพิมพ์" ไม่ใช่ตอน "พิมพ์ออกมาสำเร็จ"
    // เพราะเบราว์เซอร์ไม่บอกกลับมาว่าผู้ใช้กดพิมพ์จริงหรือกดยกเลิกในกล่องพิมพ์
    const stamp = new Date().toISOString();
    if (kind === 'medical-certificate') setMedicalCertPrintedAt(stamp);
    else setNonFormularyPrintedAt(stamp);
  };
  // ค่าเริ่มต้นเดิมเป็นข้อความอังกฤษที่เขียนตายไว้ ('Viral pharyngitis self-care guidance.')
  // ซึ่งขึ้นกับผู้ป่วยทุกคนไม่ว่าเป็นโรคอะไร เป็นค่าปลอม จึงล้างออก
  const [counselEducation, setCounselEducation] = useState(patient.counseling?.diseaseEducation || '');

  // Follow Up State
  const [hasFollowUp, setHasFollowUp] = useState<boolean>(Boolean(patient.followUp && patient.followUp.followUpDate));
  const [followUpDate, setFollowUpDate] = useState(patient.followUp?.followUpDate || '');
  const [followUpReason, setFollowUpReason] = useState(patient.followUp?.reason || '');
  const [followUpInstructions, setFollowUpInstructions] = useState(patient.followUp?.instructions || '');

  // Validation Warnings
  /**
   * รายการที่ยังกรอกไม่ครบก่อนปิดการตรวจ
   *
   * เก็บ tab กับ anchor ไว้ด้วย เพื่อให้เลื่อนจอไปยังจุดที่ขาดได้
   * (anchor คือ id ของกล่องข้อมูลในหน้าจอ ดูที่ ExamAnchor ด้านล่าง)
   */
  type ValidationIssue = {
    message: string;
    tab: 'notes' | 'diagnosis' | 'prescription' | 'referral' | 'followup';
    anchor: string;
  };
  const [showHistoryModal, setShowHistoryModal] = useState<string | null>(null);

  // Success Feedback Modal State
  const [successNotice, setSuccessNotice] = useState<{
    isOpen: boolean;
    title: string;
    /** ประโยคเดียวสั้นๆ บอกว่าเกิดอะไรขึ้น */
    message: string;
    /** ข้อมูลผู้ป่วย แยกออกมาเป็นการ์ดของตัวเอง อ่านง่ายกว่าปนอยู่ในประโยค */
    patient?: { name: string; hn: string; vn?: string };
    /** สิ่งที่ต้องทำต่อ หรือผลข้างเคียงที่ควรรู้ แสดงเป็นกล่องแยกด้านล่าง */
    note?: string;
    onConfirm?: () => void;
  } | null>(null);

  // Shared Confirmation Modal State
  // ใช้ร่วมกันทั้ง 3 ปุ่ม (ยกเลิกการตรวจ / บันทึกฉบับร่าง / บันทึกและเสร็จสิ้น)
  // เพื่อให้หน้าตาและลำดับการทำงานเหมือนกันทุกปุ่ม: กด -> ยืนยัน -> ทำงาน -> แจ้งผลสำเร็จ
  const [confirmDialog, setConfirmDialog] = useState<{
    tone: 'danger' | 'primary';
    title: string;
    /** ประโยคเดียวสั้นๆ บอกว่ากดยืนยันแล้วจะเกิดอะไร */
    message: string;
    /** ข้อมูลผู้ป่วย แยกเป็นการ์ดของตัวเอง ไม่ยัดไว้ในวงเล็บกลางประโยค */
    patient?: { name: string; hn: string; vn?: string };
    /** ข้อควรรู้เพิ่มเติม แสดงเป็นกล่องมีไอคอนด้านล่าง */
    hint?: string;

    /**
     * สรุปสิ่งที่แพทย์บันทึกไว้ทั้งหมด ให้ตรวจทานก่อนกดยืนยัน
     *
     * ทำไมต้องมี: การกดปิดการตรวจเป็นการเซ็นรับรอง แก้ย้อนหลังไม่ได้
     * แต่ข้อมูลกระจายอยู่ 5 แท็บ แพทย์ต้องกดไล่ดูทีละแท็บถึงจะรู้ว่ากรอกครบไหม
     * ซึ่งไม่มีใครทำจริง สุดท้ายก็กดยืนยันไปเลย
     * เอามาสรุปหน้าเดียวตรงนี้ ตรวจครั้งเดียวจบ
     *
     * items ว่าง = ยังไม่ได้บันทึกอะไรในหัวข้อนั้น จะขึ้นเป็น "-" สีเทา
     * ไม่ซ่อนหัวข้อทิ้ง เพราะการเห็นว่า "ไม่มี" คือข้อมูลที่ต้องตรวจเหมือนกัน
     */
    summary?: { section: string; items: string[] }[];

    confirmLabel: string;

    /**
     * ให้กล่องยืนยันถามเหตุผลก่อนกดยืนยัน (ตอนนี้ใช้กับการยกเลิกการรับบริการ)
     *
     * ทำไมต้องถาม: ตาราง queues มีช่อง note รองรับอยู่แล้ว และ API
     * PUT /visits/:id/status ก็รับ note ได้ แต่หน้าจอไม่เคยส่งอะไรไป
     * ฐานข้อมูลจึงบันทึกได้แค่ว่า "ยกเลิก" โดยไม่มีใครรู้ว่าเพราะอะไร
     * ในเวชระเบียนจริงต้องตอบได้ว่าผู้ป่วยกลับเองหรือปฏิเสธการรักษา
     *
     * options = ตัวเลือกสำเร็จรูป กดปุ๊บได้เลย ไม่ต้องพิมพ์
     * แพทย์ยังพิมพ์เองได้ในช่องด้านล่างถ้าไม่ตรงกับตัวเลือกไหน
     */
    reason?: {
      label: string;
      options: string[];
      placeholder: string;
    };

    onConfirm: (reason?: string) => void;
  } | null>(null);

  /** เหตุผลที่แพทย์เลือกหรือพิมพ์ในกล่องยืนยัน ล้างทุกครั้งที่เปิดกล่องใหม่ */
  const [confirmReason, setConfirmReason] = useState('');

  // ล้างเหตุผลเดิมทิ้งทุกครั้งที่กล่องยืนยันถูกเปิด/ปิด
  // ไม่งั้นเหตุผลที่เคยพิมพ์ไว้ของผู้ป่วยคนก่อนจะติดค้างมาให้คนถัดไป
  useEffect(() => {
    setConfirmReason('');
  }, [confirmDialog]);

  /**
   * เลื่อนจอไปยังช่องที่ยังกรอกไม่ครบ พร้อมสลับแท็บให้ถ้าอยู่คนละแท็บ
   *
   * ต้องหน่วงด้วย requestAnimationFrame เพราะการสลับแท็บทำให้ React วาดใหม่
   * ถ้าเรียก scrollIntoView ทันทีจะยังหา element ไม่เจอ
   */
  const focusIssue = (issue: ValidationIssue) => {
    if (activeTab !== issue.tab) {
      setActiveTab(issue.tab);
    }

    requestAnimationFrame(() => {
      window.setTimeout(() => {
        const el = document.getElementById(issue.anchor);
        if (!el) return;

        el.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // ไม่ไฮไลต์กรอบสีเหลืองแล้ว
        // กรอบวิ่งรอบทั้งกลุ่มทำให้ดูเหมือนทั้งกลุ่มผิด ทั้งที่ขาดแค่ช่องเดียว
        // และค้างอยู่ 2.4 วินาทีจนกวนตอนเริ่มพิมพ์
        // แค่เลื่อนไปหาช่องแล้ววางเคอร์เซอร์ให้ ก็รู้แล้วว่าต้องกรอกตรงไหน
        // (ข้อความเตือนด้านบนยังบอกอยู่ว่าขาดอะไร)

        // ถ้าในกล่องนั้นมีช่องกรอกได้ ให้เคอร์เซอร์ไปรออยู่ที่ช่องแรกเลย
        const input = el.querySelector<HTMLElement>('input, textarea, select');
        if (input) {
          input.focus({ preventScroll: true });
        }
      }, 60);
    });
  };

  /**
   * ข้อมูลจากจุดคัดกรองที่ยังไม่ครบ
   *
   * อาการสำคัญกับสัญญาณชีพเป็นช่องอ่านอย่างเดียว พยาบาลเป็นคนบันทึกตอนคัดกรอง
   * แพทย์แก้เองไม่ได้ จึงไม่ควรเอามาเป็นเงื่อนไขห้ามปิดการตรวจ
   * แค่แจ้งให้ทราบว่าข้อมูลไม่ครบ เพื่อจะได้ประสานกับพยาบาล
   */
  const triageGaps = React.useMemo(() => {
    const gaps: string[] = [];
    if (!chiefComplaint.trim()) {
      gaps.push(language === 'th' ? 'อาการสำคัญ (Chief Complaint)' : 'Chief Complaint (CC)');
    }
    if (!bp.trim() || !pulse || !temp) {
      gaps.push(language === 'th' ? 'สัญญาณชีพ (ความดัน / ชีพจร / อุณหภูมิ)' : 'Vital Signs (BP / Pulse / Temp)');
    }
    return gaps;
  }, [chiefComplaint, bp, pulse, temp, language]);

  /**
   * ตรวจใบสั่งยากับประวัติแพ้ยาของผู้ป่วย (ดูวิธีเทียบใน utils/allergyCheck.ts)
   *
   * แยกผลเป็น 2 กอง เพราะผลทางการแพทย์ไม่เท่ากัน
   *   blocking = ยาตัวเดียวกับที่แพ้ ห้ามปิดเคสจนกว่าจะเอาออก
   *   crossGroup = คนละตัวแต่กลุ่มเดียวกัน เตือนให้ตัดสินใจ แล้วสั่งต่อได้
   */
  const allergyConflicts = React.useMemo(
    () => findAllergyConflicts(drugAllergiesText, prescriptions),
    [drugAllergiesText, prescriptions],
  );
  const blockingAllergies = allergyConflicts.filter((c) => c.kind === 'exact');
  const crossGroupAllergies = allergyConflicts.filter((c) => c.kind === 'group');

  /** ชื่อยาที่ชนประวัติแพ้ ใช้ระบายสีแถวในตารางรายการสั่งยา */
  const conflictByMedicine = React.useMemo(() => {
    const map = new Map<string, 'exact' | 'group'>();
    for (const c of allergyConflicts) {
      // exact สำคัญกว่า ห้ามให้ group มาเขียนทับ
      if (map.get(c.medicineName) !== 'exact') map.set(c.medicineName, c.kind);
    }
    return map;
  }, [allergyConflicts]);

  /**
   * แพทย์รับทราบเรื่องแพ้ข้ามกลุ่มแล้ว ยืนยันจะสั่งยาตัวนี้ต่อ
   *
   * ต้องรีเซ็ตทุกครั้งที่รายการยาเปลี่ยน ไม่งั้นแพทย์ที่กดยืนยันไปแล้วรอบหนึ่ง
   * แล้วเพิ่มยาตัวใหม่เข้ามาทีหลัง จะไม่โดนเตือนอีกเลยทั้งที่เป็นคนละตัว
   */
  const [crossGroupAcknowledged, setCrossGroupAcknowledged] = useState(false);
  useEffect(() => {
    setCrossGroupAcknowledged(false);
  }, [prescriptions, drugAllergiesText]);

  // Construct updated patient object
  const buildUpdatedPatient = (newStatus?: QueueStatus): Patient => {
    return {
      ...patient,
      status: newStatus || status,
      nationalId,
      chiefComplaint,
      chiefComplaintDuration,
      presentIllness,
      pastMedicalHistory,
      chronicDiseases: chronicDiseasesText.split(',').map(s => s.trim()).filter(Boolean),
      currentMedications: currentMedicationsText.split(',').map(s => s.trim()).filter(Boolean),
      pastSurgery,
      hospitalAdmissionHistory,
      drugAllergies: drugAllergiesText.split(',').map(s => s.trim()).filter(Boolean),
      foodAllergies: foodAllergiesText.split(',').map(s => s.trim()).filter(Boolean),
      familyHistory,
      socialHistory,
      nurseNotes,
      importantInfoForDoctor,
      attachments,
      // ไม่ส่ง triage ขึ้นไปถ้าจุดคัดกรองยังไม่ได้ประเมิน
      // เดิมช่องพวกนี้มีค่าเริ่มต้นสมมติ ('Level 4: Less Urgent' / 'Medium')
      // ทำให้เคสที่ยังไม่ถูกประเมินถูกส่งไปเป็น "ไม่ฉุกเฉิน" โดยอัตโนมัติ
      triage: triageLevel
        ? {
            level: triageLevel as NonNullable<Patient['triage']>['level'],
            priority: (priorityLevel || 'Medium') as NonNullable<Patient['triage']>['priority'],
            notes: triageNotes,
          }
        : undefined,
      nursingAssessment: {
        generalAppearance: nurseGenAppearance,
        consciousness: nurseConsciousness,
        mobility: nurseMobility,
        respiratoryCondition: nurseRespiratory,
        bleeding: nurseBleeding,
        otherFindings: nurseOtherFindings
      },
      vitals: {
        bp,
        pulse: Number(pulse),
        respiratoryRate: Number(respiratoryRate),
        temp: Number(temp),
        spo2: Number(spo2),
        weight: Number(weight),
        height: Number(height),
        bmi,
        painScore: painScore !== undefined ? Number(painScore) : undefined,
        bloodSugar: bloodSugar !== undefined ? Number(bloodSugar) : undefined
      },
      physicalExam: {
        generalAppearance,
        heent,
        cardiovascular,
        respiratory,
        abdomen,
        musculoskeletal,
        neurological,
        skin
      },
      primaryDiagnosis: primaryDiag ?? undefined,
      secondaryDiagnoses: secondaryDiags,
      assessmentNotes,
      clinicalNotes,
      treatmentPlan,
      proceduresPerformed,
      prescriptions,
      disposition,
      issuedDocuments: collectIssuedDocuments(),
      labOrders,
      imagingOrders,
      referral: {
        department: refDept,
        doctor: refDoctor,
        reason: refReason,
        notes: refNotes
      },
      counseling: {
        medicationAdvice: counselMed,
        dietAdvice: counselDiet,
        exerciseAdvice: counselExercise,
        lifestyleAdvice: counselLifestyle,
        diseaseEducation: counselEducation
      },
      followUp: hasFollowUp && followUpDate ? {
        followUpDate,
        reason: followUpReason,
        instructions: followUpInstructions
      } : undefined,
      diagnosis: primaryDiag ? `${primaryDiag.code} - ${primaryDiag.name}` : '',
      prescription: prescriptions.map(p => `${p.medicineName} (${p.dosage}, ${p.frequency})`).join('; '),
      activityLog: {
        createdAt: patient.activityLog?.createdAt || new Date().toISOString(),
        createdBy: 'Dr. Anong S.',
        updatedAt: new Date().toISOString(),
        updatedBy: 'Dr. Anong S.'
      }
    };
  };

  // Save Draft — งานจริง (เรียกหลังผู้ใช้กดยืนยันในโมดัล)
  const runSaveDraft = async () => {
    const activeDiags = [...(primaryDiag ? [primaryDiag] : []), ...secondaryDiags];
    saveToRecentDiagnoses(activeDiags);
    const updated = buildUpdatedPatient('Examining');

    // รอผลจริงจากฐานข้อมูลก่อน ถ้าบันทึกไม่ผ่านจะไม่ขึ้นกล่อง "บันทึกแล้ว"
    // เหตุผลที่ล้มเหลวจะแสดงเป็นแถบสีแดงด้านบนของหน้า
    const saved = await onSavePatient(updated);
    if (saved === false) return;

    setSuccessNotice({
      isOpen: true,
      title: language === 'th' ? 'บันทึกฉบับร่างแล้ว' : 'Draft Saved',
      message: language === 'th'
        ? 'เก็บข้อมูลการตรวจไว้เรียบร้อยแล้ว'
        : 'The examination data has been saved.',
      patient: {
        name: patient.name,
        hn: patient.hn,
        vn: displayVN(patient.vn),
      },
      note: language === 'th'
        ? 'สถานะยังเป็น "กำลังตรวจ" กดปุ่ม "ตรวจต่อ" ในหน้าคิวผู้ป่วยเพื่อกลับมาทำต่อได้ทุกเมื่อ'
        : 'The visit remains "Examining". Use the "Continue Exam" button in the patient queue to resume.',
      // กลับไปหน้าคิวผู้ป่วยเหมือนตอนกดบันทึกผลการตรวจ
      // เพื่อให้แพทย์เรียกคิวถัดไปได้ทันที แล้วค่อยกด "ตรวจต่อ" กลับมาทีหลัง
      onConfirm: () => {
        onBackToQueue();
      }
    });
  };

  // Save Draft — เปิดโมดัลยืนยัน
  const handleSaveDraft = () => {
    setConfirmDialog({
      tone: 'primary',
      title: language === 'th' ? 'บันทึกฉบับร่าง?' : 'Save Draft?',
      message: language === 'th'
        ? 'เก็บข้อมูลที่กรอกไว้ทั้งหมด แต่ยังไม่ปิดการตรวจ'
        : 'Saves everything you have entered without closing the visit.',
      patient: {
        name: patient.name,
        hn: patient.hn,
        vn: displayVN(patient.vn),
      },
      hint: language === 'th'
        ? 'ยังไม่ส่งรายการสั่งยาไปห้องยา จนกว่าจะกด "บันทึกและเสร็จสิ้นการตรวจ"'
        : 'Prescriptions are not sent to the pharmacy until you use "Save & Complete Visit".',
      confirmLabel: language === 'th' ? 'บันทึกฉบับร่าง' : 'Save Draft',
      onConfirm: runSaveDraft
    });
  };

  /**
   * ==========================================================================
   * ออกจากหน้าตรวจ 2 แบบ ผลต่อคิวไม่เหมือนกัน จึงต้องเป็นคนละปุ่ม
   * ==========================================================================
   * เดิมมีปุ่มเดียวชื่อ "ยกเลิกการตรวจรับบริการ" ซึ่งทำแค่เปลี่ยนหน้ากลับไปหน้าคิว
   * ไม่ได้แตะฐานข้อมูลเลย ชื่อปุ่มกับสิ่งที่มันทำจึงไม่ตรงกัน
   *
   * และเมื่อระบบเปลี่ยนสถานะเป็น "กำลังตรวจ" ตั้งแต่ตอนกดเรียกผู้ป่วยเข้าตรวจ
   * การออกจากหน้านี้โดยไม่คืนสถานะจะทำให้ผู้ป่วยค้างเป็น "กำลังตรวจ" ถาวร
   * คิวนั้นจะไม่มีใครหยิบไปตรวจอีกเลยเพราะดูเหมือนมีคนดูแลอยู่แล้ว
   */

  /** ออกจากหน้าตรวจแบบคืนคิว ผู้ป่วยกลับไปต่อแถวรอตรวจตามเดิม */
  const handleExitExamination = () => {
    setConfirmDialog({
      tone: 'primary',
      title: language === 'th' ? 'ออกจากหน้าตรวจ?' : 'Leave examination?',
      message: language === 'th'
        ? 'ผู้ป่วยจะกลับไปอยู่ในคิว "รอตรวจ" ตามเดิม ข้อมูลที่กรอกไว้แต่ยังไม่ได้บันทึกจะหายทั้งหมด'
        : 'The patient returns to the waiting queue. Anything not yet saved will be lost.',
      patient: {
        name: patient.name,
        hn: patient.hn,
        vn: displayVN(patient.vn),
      },
      hint: language === 'th'
        ? 'หากยังต้องการเก็บข้อมูลไว้ ให้กด "บันทึกฉบับร่าง" แทน แล้วกลับมาทำต่อได้ทุกเมื่อ'
        : 'To keep your work, use "Save Draft" instead.',
      confirmLabel: language === 'th' ? 'ออกและคืนคิว' : 'Leave and requeue',
      onConfirm: () => onBackToQueue('Waiting')
    });
  };

  /** ยกเลิกการรับบริการจริง ผู้ป่วยหลุดออกจากคิววันนี้ ไม่กลับมาอีก */
  const handleCancelVisit = () => {
    setConfirmDialog({
      tone: 'danger',
      title: language === 'th' ? 'ยกเลิกการรับบริการ?' : 'Cancel this visit?',
      message: language === 'th'
        ? 'ผู้ป่วยจะถูกนำออกจากคิววันนี้ และจะไม่ปรากฏในรายการรอตรวจอีก'
        : 'The patient is removed from today\'s queue and will no longer appear in the waiting list.',
      patient: {
        name: patient.name,
        hn: patient.hn,
        vn: displayVN(patient.vn),
      },
      hint: language === 'th'
        ? 'ใช้เมื่อผู้ป่วยกลับบ้านก่อนหรือไม่ประสงค์รับการรักษา หากแค่ต้องการออกจากหน้านี้ ให้กด "ออกจากหน้าตรวจ" แทน'
        : 'Use this only when the patient has left or declined treatment. To simply leave this page, use "Leave examination".',
      confirmLabel: language === 'th' ? 'ยืนยันยกเลิกการรับบริการ' : 'Confirm cancellation',
      reason: {
        label: language === 'th' ? 'เหตุผลการยกเลิก' : 'Reason for cancellation',
        options: language === 'th'
          ? ['ผู้ป่วยกลับก่อนพบแพทย์', 'ผู้ป่วยปฏิเสธการรักษา', 'ส่งต่อโรงพยาบาลอื่นทันที', 'ข้อมูลคิวซ้ำซ้อน']
          : ['Patient left before consultation', 'Patient declined treatment', 'Referred out immediately', 'Duplicate queue entry'],
        placeholder: language === 'th' ? 'ระบุเหตุผลอื่น...' : 'Other reason...',
      },
      onConfirm: (reason) => onBackToQueue('Cancelled', reason)
    });
  };

  // Complete Visit Validation & Execution
  /**
   * รวมสิ่งที่แพทย์บันทึกไว้ทั้ง 4 แท็บ เป็นรายการสรุปสำหรับกล่องยืนยัน
   * เรียงตามลำดับแท็บบนหน้าจอ เพื่อให้แพทย์ไล่ตรวจได้ตรงกับที่เพิ่งกรอกมา
   */
  const buildVisitSummary = (): { section: string; items: string[] }[] => {
    const isTh = language === 'th';
    const docLabel: Record<string, string> = {
      'medical-certificate': isTh ? 'ใบรับรองแพทย์' : 'Medical Certificate',
      'non-formulary': isTh ? 'ใบรับรองยานอกบัญชี' : 'Non-Formulary Certificate',
      'insurance-claim': isTh ? 'ใบเคลมประกัน' : 'Insurance Claim',
      'referral-opinion': isTh ? 'ใบรับรองความเห็นแพทย์เพื่อการส่งต่อ' : 'Referral Opinion',
      dental: isTh ? 'ใบรักษาโรคฟันและโรคเหงือก' : 'Dental Treatment Form',
    };

    // --- การวินิจฉัย ---
    const diagItems: string[] = [];
    if (primaryDiag?.code) {
      diagItems.push(`${primaryDiag.code} ${primaryDiag.localName || primaryDiag.name}`);
    }
    secondaryDiags.forEach((d) => {
      if (d.code) diagItems.push(`${d.code} ${d.localName || d.name}`);
    });

    // --- การสั่งยา ---
    // ใส่ขนาดกับความถี่ต่อท้ายด้วย เพราะจุดที่พลาดบ่อยคือสั่งยาถูกตัวแต่ผิดขนาด
    // ถ้าโชว์แต่ชื่อยา การตรวจทานตรงนี้ก็แทบไม่ได้ช่วยอะไร
    const rxItems = prescriptions.map((rx) =>
      [rx.medicineName, rx.dosage, rx.frequency].filter(Boolean).join(' · ')
    );

    // --- เอกสาร & การส่งต่อ ---
    const docItems = collectIssuedDocuments().map((doc) => {
      const name = doc.type === 'other' ? doc.name || '' : docLabel[doc.type] || doc.type;
      // ใส่จำนวนเฉพาะเอกสารที่พิมพ์ได้และสั่งมากกว่า 1 ฉบับ
      return doc.quantity > 1 ? `${name} × ${doc.quantity}` : name;
    });
    if (disposition === 'home') docItems.push(isTh ? 'สถานะ: กลับบ้าน' : 'Disposition: Discharge home');
    if (disposition === 'refer') docItems.push(isTh ? 'สถานะ: Refer' : 'Disposition: Refer');

    // --- นัดหมายติดตามอาการ ---
    const followUpItems: string[] = [];
    if (hasFollowUp && followUpDate) {
      followUpItems.push(
        [
          isTh ? `วันนัด ${followUpDate}` : `Date ${followUpDate}`,
          followUpReason,
        ].filter(Boolean).join(' · ')
      );
      if (followUpInstructions) followUpItems.push(followUpInstructions);
    }

    // --- ผลการตรวจร่างกาย 8 ระบบ ---
    // แสดงเฉพาะระบบที่แพทย์กรอกไว้จริง ไม่ต้องขึ้นทั้ง 8 ระบบให้รก
    // ระบบที่ไม่ได้กรอก = ไม่ได้ตรวจ ซึ่งเป็นเรื่องปกติในคลินิกทั่วไป
    const peFields: { label: string; value: string }[] = [
      { label: isTh ? 'สภาพทั่วไป' : 'General', value: generalAppearance },
      { label: isTh ? 'ศีรษะ ตา หู คอ จมูก' : 'HEENT', value: heent },
      { label: isTh ? 'หัวใจและหลอดเลือด' : 'Cardiovascular', value: cardiovascular },
      { label: isTh ? 'ระบบหายใจ' : 'Respiratory', value: respiratory },
      { label: isTh ? 'ช่องท้อง' : 'Abdomen', value: abdomen },
      { label: isTh ? 'กล้ามเนื้อและกระดูก' : 'Musculoskeletal', value: musculoskeletal },
      { label: isTh ? 'ระบบประสาท' : 'Neurological', value: neurological },
      { label: isTh ? 'ผิวหนัง' : 'Skin', value: skin },
    ];
    const peItems = peFields
      .filter((f) => (f.value || '').trim() !== '')
      .map((f) => `${f.label}: ${f.value.trim()}`);

    // --- สรุปผลการตรวจ ---
    const conclusionItems: string[] = [];
    if (assessmentNotes.trim()) {
      conclusionItems.push(
        `${isTh ? 'การประเมินและวินิจฉัยเบื้องต้น' : 'Assessment'}: ${assessmentNotes.trim()}`
      );
    }
    if (treatmentPlan.trim()) {
      conclusionItems.push(
        `${isTh ? 'แผนการรักษาและหัตถการ' : 'Treatment plan'}: ${treatmentPlan.trim()}`
      );
    }

    // เรียงตามลำดับที่แพทย์กรอกจริงในแต่ละแท็บ ไล่ตรวจได้ตรงกับที่เพิ่งทำมา
    return [
      { section: isTh ? 'การตรวจร่างกาย' : 'Physical Examination', items: peItems },
      { section: isTh ? 'สรุปผลการตรวจ' : 'Visit Conclusion', items: conclusionItems },
      { section: isTh ? 'การวินิจฉัยโรค' : 'Diagnosis', items: diagItems },
      { section: isTh ? 'การสั่งยา' : 'Prescription', items: rxItems },
      { section: isTh ? 'เอกสาร & การส่งต่อ' : 'Documents & Referral', items: docItems },
      { section: isTh ? 'นัดหมายติดตามอาการ' : 'Follow-Up', items: followUpItems },
    ];
  };

  /**
   * @param ackCrossGroup แพทย์เพิ่งกดรับทราบเรื่องแพ้ข้ามกลุ่มมาจากกล่องเตือน
   *   ต้องรับเป็นพารามิเตอร์ ไม่อ่านจาก state เพราะ setState ยังไม่ทันมีผล
   *   ในจังหวะที่ฟังก์ชันนี้ถูกเรียกต่อทันทีจาก onConfirm
   */
  const handleCompleteVisit = (ackCrossGroup = false) => {
    const warnings: ValidationIssue[] = [];

    // เช็คเฉพาะสิ่งที่ "แพทย์กรอกเองได้" เท่านั้น
    // ข้อมูลจากจุดคัดกรอง (อาการสำคัญ, สัญญาณชีพ) แสดงเป็นหมายเหตุแทน
    // เพราะเป็นช่องอ่านอย่างเดียว แพทย์แก้ไม่ได้ ดู triageGaps ด้านบน
    if (!primaryDiag || !primaryDiag.code) {
      warnings.push({
        message: language === 'th' ? 'กรุณาระบุการวินิจฉัยโรคหลัก (ICD-10) อย่างน้อย 1 รายการ' : 'Required Field Missing: Require at least one Primary Diagnosis (ICD-10) before completing the visit.',
        tab: 'diagnosis',
        anchor: EXAM_ANCHOR.diagnosis,
      });
    }
    // การประเมินและวินิจฉัยเบื้องต้น เป็นเหตุผลทางการแพทย์ที่อธิบายว่า
    // ทำไมถึงวินิจฉัยแบบนี้และรักษาแบบนี้ ถ้าไม่มี เวชระเบียนจะมีแต่รหัสโรค
    // แต่ไม่มีใครรู้ว่าแพทย์คิดจากอะไร ซึ่งเป็นปัญหาเวลาผู้ป่วยกลับมาตรวจซ้ำ
    // หรือเวลาต้องใช้เวชระเบียนอ้างอิงย้อนหลัง
    if (!assessmentNotes.trim()) {
      warnings.push({
        message: language === 'th'
          ? 'กรุณากรอก "การประเมินและวินิจฉัยเบื้องต้น" ก่อนเสร็จสิ้นการตรวจ'
          : 'Required Field Missing: Please fill in the Assessment Notes before completing the visit.',
        tab: 'diagnosis',
        anchor: EXAM_ANCHOR.assessment,
      });
    }
    // แพ้ยาเช็คก่อนเรื่องอื่นทั้งหมด เพราะเป็นความปลอดภัยของผู้ป่วยโดยตรง
    // ไม่ใช่แค่ "กรอกไม่ครบ" และแสดงเป็นกล่องกลางจอ ไม่ใช่แบนเนอร์ที่ค้างไว้เฉยๆ
    if (blockingAllergies.length > 0) {
      setConfirmDialog({
        tone: 'danger',
        title: language === 'th' ? 'พบยาที่ผู้ป่วยแพ้!' : 'Drug Allergy Detected!',
        message: language === 'th'
          ? 'รายการสั่งยามียาที่ผู้ป่วยมีประวัติแพ้ ปิดการตรวจไม่ได้จนกว่าจะแก้ไข'
          : 'The prescription contains a medicine this patient is allergic to. The visit cannot be completed until this is resolved.',
        patient: {
          name: patient.name,
          hn: patient.hn,
          vn: displayVN(patient.vn),
        },
        hint: blockingAllergies.map((c) => describeConflict(c, language)).join('\n'),
        confirmLabel: language === 'th' ? 'ไปแก้ไขรายการยา' : 'Go to prescription',
        onConfirm: () =>
          focusIssue({
            message: '',
            tab: 'prescription',
            anchor: EXAM_ANCHOR.prescription,
          }),
      });
      return;
    }

    /**
     * แพ้ข้ามกลุ่ม เตือนแต่ไม่บล็อก
     *
     * เช่นผู้ป่วยแพ้ Penicillin แล้วแพทย์สั่ง Amoxicillin ซึ่งอยู่กลุ่มเดียวกัน
     * ทางการแพทย์เป็น "ความเสี่ยง" ไม่ใช่ข้อห้ามเด็ดขาด แพทย์เป็นคนตัดสินใจ
     * แต่ต้องบังคับให้เห็นก่อนหนึ่งครั้ง ไม่ใช่ปล่อยผ่านไปเงียบๆ แบบเดิม
     */
    if (crossGroupAllergies.length > 0 && !crossGroupAcknowledged && !ackCrossGroup) {
      setConfirmDialog({
        tone: 'danger',
        title: language === 'th' ? 'ยากลุ่มเดียวกับที่ผู้ป่วยแพ้' : 'Same Drug Class as Recorded Allergy',
        message: language === 'th'
          ? 'ยาที่สั่งอยู่ในกลุ่มเดียวกับยาที่ผู้ป่วยมีประวัติแพ้ อาจเกิดการแพ้ข้ามตัวได้'
          : 'A prescribed medicine belongs to the same class as a recorded allergy. Cross-reactivity is possible.',
        patient: {
          name: patient.name,
          hn: patient.hn,
          vn: displayVN(patient.vn),
        },
        hint: crossGroupAllergies.map((c) => describeConflict(c, language)).join('\n'),
        confirmLabel: language === 'th' ? 'รับทราบ สั่งยานี้ต่อ' : 'Acknowledge and continue',
        onConfirm: () => {
          setCrossGroupAcknowledged(true);
          // ไปต่อที่หน้าสรุปทันที ไม่ต้องให้แพทย์กดปุ่มบันทึกซ้ำอีกรอบ
          handleCompleteVisit(true);
        },
      });
      return;
    }

    // แผนการรักษาและหัตถการ บอกว่าจะทำอะไรต่อกับผู้ป่วย
    // คู่กับการประเมินด้านบนคือ "คิดว่าเป็นอะไร" กับ "แล้วจะทำอย่างไร"
    // ขาดข้อใดข้อหนึ่งไป เวชระเบียนก็ตอบคำถามได้ไม่ครบ
    if (!treatmentPlan.trim()) {
      warnings.push({
        message: language === 'th'
          ? 'กรุณากรอก "แผนการรักษาและหัตถการ" ก่อนเสร็จสิ้นการตรวจ'
          : 'Required Field Missing: Please fill in the Treatment Plan before completing the visit.',
        tab: 'diagnosis',
        anchor: EXAM_ANCHOR.assessment,
      });
    }
    if (warnings.length > 0) {
      // ไม่มีแผงเตือนสีเหลืองด้านบนแล้ว ใช้วิธีพาไปที่ช่องแรกที่ยังขาดแทน
      // แล้ววางเคอร์เซอร์ให้พร้อมพิมพ์ทันที (ดู focusIssue)
      // ช่องที่บังคับกรอกมีดาวแดงกำกับไว้อยู่แล้ว จึงรู้ได้ตั้งแต่ก่อนกดบันทึก
      focusIssue(warnings[0]);
      return;
    }

    setConfirmDialog({
      tone: 'primary',
      title: language === 'th' ? 'บันทึกและเสร็จสิ้นการตรวจ?' : 'Save & Complete Visit?',
      message: language === 'th'
        ? 'ปิดการตรวจและเปลี่ยนสถานะเป็น "ตรวจเสร็จสิ้น" แก้ไขย้อนหลังไม่ได้'
        : 'This closes the visit and sets the status to "Completed". It cannot be edited afterwards.',
      patient: {
        name: patient.name,
        hn: patient.hn,
        vn: displayVN(patient.vn),
      },
      hint: [
        prescriptions.length > 0
          ? (language === 'th'
              ? `ระบบจะส่งรายการสั่งยา ${prescriptions.length} รายการไปยังห้องยาโดยอัตโนมัติ`
              : `${prescriptions.length} prescription item(s) will be sent to the pharmacy queue automatically.`)
          : (language === 'th'
              ? 'การตรวจนี้ไม่มีรายการสั่งยา'
              : 'No prescription items in this visit.'),
        // เตือนอีกรอบตอนจะปิดเคส ถ้าข้อมูลจากจุดคัดกรองยังไม่ครบ
        triageGaps.length > 0
          ? (language === 'th'
              ? `หมายเหตุ: ยังไม่ได้รับ ${triageGaps.join(' และ ')} จากจุดคัดกรอง`
              : `Note: ${triageGaps.join(' and ')} not received from triage.`)
          : '',
      ].filter(Boolean).join('\n'),
      summary: buildVisitSummary(),
      confirmLabel: language === 'th' ? 'ยืนยันบันทึก' : 'Confirm & Complete',
      onConfirm: runCompleteVisit
    });
  };

  // Complete Visit — งานจริง (เรียกหลังผู้ใช้กดยืนยันในโมดัล)
  const runCompleteVisit = async () => {
    const activeDiags = [...(primaryDiag ? [primaryDiag] : []), ...secondaryDiags];
    saveToRecentDiagnoses(activeDiags);
    const updated = buildUpdatedPatient('Completed');

    // ปิดเคสเป็นการเซ็นรับรองผลการตรวจ ยิ่งต้องรอให้ฐานข้อมูลยืนยันก่อน
    // ถ้าขึ้นว่าสำเร็จแล้วแต่จริงๆ ไม่ได้บันทึก แพทย์จะเดินไปเรียกคิวถัดไปโดยไม่รู้ตัว
    const saved = await onSavePatient(updated);
    if (saved === false) return;

    setSuccessNotice({
      isOpen: true,
      title: language === 'th' ? 'ปิดการตรวจเรียบร้อย' : 'Visit Completed',
      message: language === 'th'
        ? 'บันทึกผลการตรวจและเปลี่ยนสถานะเป็น "ตรวจเสร็จสิ้น" แล้ว'
        : 'The examination has been signed and marked as completed.',
      patient: {
        name: patient.name,
        hn: patient.hn,
        vn: displayVN(patient.vn),
      },
      note: prescriptions.length > 0
        ? (language === 'th'
            ? `ส่งใบสั่งยา ${prescriptions.length} รายการไปยังห้องยาแล้ว`
            : `${prescriptions.length} prescription item(s) sent to the pharmacy queue.`)
        : (language === 'th'
            ? 'การตรวจครั้งนี้ไม่มีรายการสั่งยา ผู้ป่วยไปชำระเงินได้เลย'
            : 'No medication was prescribed for this visit.'),
      onConfirm: () => {
        onBackToQueue();
      }
    });
  };

  // Select medicine and auto-fill Thai hospital default fields
  const handleSelectMedicine = (nameVal: string) => {
    setNewMedName(nameVal);
    setMedSearch(nameVal);
    if (!nameVal.trim()) {
      setSelectedMedicine(null);
      setNewMedDosage('');
      setNewMedFreq('');
      setNewMedDuration('');
      setNewMedQty('');
      setNewMedRoute('');
      setNewMedTiming('');
      setNewMedInstructions('');
      return;
    }
    const found = medicinesList.find(
      m => (m.name || '').toLowerCase() === nameVal.trim().toLowerCase() ||
           (m.code && m.code.toLowerCase() === nameVal.trim().toLowerCase())
    );

    // จำรหัสยาจริงไว้ ถ้าหาไม่เจอแปลว่าแพทย์พิมพ์ชื่อเอง ต้องล้างของเดิมทิ้ง
    // ไม่งั้นรหัสของยาตัวก่อนหน้าจะติดไปกับยาตัวใหม่
    setSelectedMedicine(found ? { id: found.id, code: found.code, price: found.price } : null);

    if (found) {
      const isTh = language === 'th';
      if (found.defaultDosage) {
        setNewMedDosage(typeof found.defaultDosage === 'object' ? (isTh ? found.defaultDosage.th : found.defaultDosage.en) : found.defaultDosage);
      } else {
        setNewMedDosage('1 เม็ด');
      }
      if (found.defaultFreq) {
        setNewMedFreq(typeof found.defaultFreq === 'object' ? (isTh ? found.defaultFreq.th : found.defaultFreq.en) : found.defaultFreq);
      } else {
        setNewMedFreq('วันละ 3 ครั้ง');
      }
      if (found.defaultDuration) {
        setNewMedDuration(typeof found.defaultDuration === 'object' ? (isTh ? found.defaultDuration.th : found.defaultDuration.en) : found.defaultDuration);
      } else {
        setNewMedDuration('5 วัน');
      }
      if (found.defaultQty !== undefined) {
        setNewMedQty(found.defaultQty);
      } else {
        setNewMedQty(10);
      }
      if (found.defaultRoute) {
        setNewMedRoute(typeof found.defaultRoute === 'object' ? (isTh ? found.defaultRoute.th : found.defaultRoute.en) : found.defaultRoute);
      } else {
        setNewMedRoute(isTh ? 'รับประทาน' : 'Oral');
      }
      if (found.defaultTiming) {
        setNewMedTiming(typeof found.defaultTiming === 'object' ? (isTh ? found.defaultTiming.th : found.defaultTiming.en) : found.defaultTiming);
      } else {
        setNewMedTiming(isTh ? 'หลังอาหาร' : 'After Meal');
      }
      if (found.defaultInstructions) {
        setNewMedInstructions(typeof found.defaultInstructions === 'object' ? (isTh ? found.defaultInstructions.th : found.defaultInstructions.en) : found.defaultInstructions);
      } else if (found.properties) {
        setNewMedInstructions(found.properties);
      } else {
        setNewMedInstructions('');
      }
    }
  };

  /**
   * ==========================================================================
   * กฎความปลอดภัย: สั่งได้เฉพาะยาที่มีอยู่จริงในคลังของห้องยา
   * ==========================================================================
   * ช่องเลือกยาเป็นช่องเดียวที่ทำทั้งค้นหาและกรอกชื่อ แพทย์จึงพิมพ์ชื่อค้างไว้
   * แบบไม่ครบแล้วกดเพิ่มรายการเลยได้ (เช่นพิมพ์ "Paracetamol" แต่ในคลังชื่อ
   * "Paracetamol 500mg") ใบสั่งยาจะมีแต่ชื่อลอยๆ ไม่มีรหัสยา
   * แล้วไปจบที่ backend ต้องเดายาจากชื่ออีกที ซึ่งอาจได้ยาคนละตัว
   * หรือหาไม่เจอแล้วยาหายไปจากใบสั่งเลยโดยแพทย์ไม่ทันสังเกตคำเตือน
   *
   * ตัดปัญหาที่ต้นทาง: ถ้ายังไม่ได้เลือกยาจากรายการจริง จะกดเพิ่มไม่ได้
   * บังคับเฉพาะตอนที่โหลดคลังยาสำเร็จเท่านั้น (ดูคำอธิบาย medicinesLoaded)
   */
  const requireStockMedicine = medicinesLoaded;
  const hasStockMedicine = !!selectedMedicine?.id;
  const canAddPrescription =
    !!newMedName.trim() && (!requireStockMedicine || hasStockMedicine);

  // Add Prescription
  const handleAddPrescription = () => {
    if (!canAddPrescription) return;
    if (!newMedName.trim()) return;
    const parsedQty = typeof newMedQty === 'number' ? newMedQty : parseInt(String(newMedQty), 10);
    const newItem: PrescriptionItem = {
      id: `rx-${Date.now()}`,

      // แนบรหัสยาจากคลังไปด้วย (ถ้าแพทย์เลือกจากรายการ)
      // ค่านี้จะถูกส่งไปกับ payload ตอนบันทึก แล้ว backend ใช้มันตรงๆ ไม่ต้องค้นจากชื่อ
      medicineId: selectedMedicine?.id,
      medicineCode: selectedMedicine?.code,
      unitPrice: selectedMedicine?.price,

      medicineName: newMedName,
      dosage: newMedDosage || '1 tablet',
      frequency: newMedFreq || '3 times a day',
      duration: newMedDuration || '5 days',
      quantity: !isNaN(parsedQty) && parsedQty > 0 ? parsedQty : 10,
      route: newMedRoute || 'Oral',
      timing: newMedTiming || 'After Meal',
      specialInstructions: newMedInstructions
    };
    setPrescriptions([...prescriptions, newItem]);
    setNewMedName('');
    setSelectedMedicine(null);
    setMedSearch('');
    setNewMedDosage('');
    setNewMedFreq('');
    setNewMedDuration('');
    setNewMedQty('');
    setNewMedRoute('');
    setNewMedTiming('');
    setNewMedInstructions('');
  };

  // Add Lab Order
  const handleAddLabOrder = () => {
    const labItem: LabOrderItem = {
      id: `lab-${Date.now()}`,
      testName: selectedLabTest,
      category: LAB_TEST_DATABASE.find(l => l.name === selectedLabTest)?.category || 'General',
      indication: labIndication,
      isUrgent: labIsUrgent
    };
    setLabOrders([...labOrders, labItem]);
    setLabIndication('');
  };

  // Add Imaging Order
  const handleAddImagingOrder = () => {
    const imgItem: ImagingOrderItem = {
      id: `img-${Date.now()}`,
      type: imgType,
      bodyPart: imgBodyPart,
      clinicalIndication: imgIndication,
      isUrgent: imgIsUrgent
    };
    setImagingOrders([...imagingOrders, imgItem]);
    setImgIndication('');
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Top Navigation & Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          {/* ปุ่มลูกศรกลับด้านบน ต้องคืนคิวเหมือนปุ่ม "ออกจากหน้าตรวจ" ด้านล่าง
              ไม่งั้นแพทย์ที่กดปุ่มนี้แทนจะทิ้งผู้ป่วยค้างสถานะ "กำลังตรวจ" ไว้
              ผ่านกล่องยืนยันเดียวกัน เพื่อกันการกดพลาดแล้วข้อมูลที่กรอกหาย */}
          <button
            onClick={handleExitExamination}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors flex items-center gap-1 text-xs font-semibold cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t('backToQueue')}</span>
          </button>
          <div className="h-5 w-px bg-slate-200" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold">
              <Stethoscope className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">{t('opdExamTitle')}</h1>
              <span className="text-[11px] text-slate-500 font-mono">
                {language === 'th' ? 'การบันทึกเวชระเบียนผู้ป่วยนอก' : 'OPD Medical Record Entry'}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons Header */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleSaveDraft}
            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{language === 'th' ? 'บันทึกฉบับร่าง' : 'Save Draft'}</span>
          </button>

          <button
            onClick={() => handleCompleteVisit()}
            className="px-4 py-1.5 bg-[#2563eb] hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            <span>{t('saveExam')}</span>
          </button>
        </div>
      </div>

      {/* แบนเนอร์เตือนแพ้ยาแบบค้างอยู่บนหน้าจอถูกถอดออกแล้ว
          เปลี่ยนไปเตือนเป็นกล่องกลางจอตอนกด "บันทึกและเสร็จสิ้นการตรวจ" แทน
          (ดู handleCompleteVisit) เพราะแบนเนอร์ที่ค้างอยู่ตลอดจะถูกมองข้ามในที่สุด
          ส่วนกล่องกลางจอบังคับให้ตัดสินใจก่อนถึงจะไปต่อได้ */}

      {/* แจ้งว่าข้อมูลจากจุดคัดกรองยังไม่ครบ — ไม่ได้ห้ามปิดเคส แค่ให้รู้ */}
      {triageGaps.length > 0 && (
        <div className="bg-sky-50 border border-sky-200 p-4 rounded-2xl text-sky-900 text-xs space-y-1.5">
          <div className="font-bold flex items-center gap-1.5">
            <ClipboardCheck className="w-4 h-4 text-sky-600" />
            <span>
              {language === 'th'
                ? 'ยังไม่ได้รับข้อมูลบางส่วนจากจุดคัดกรอง'
                : 'Some triage data has not been received'}
            </span>
          </div>
          <p className="font-medium text-sky-800">
            {language === 'th'
              ? `ขาด: ${triageGaps.join(' , ')}`
              : `Missing: ${triageGaps.join(' , ')}`}
          </p>
          <p className="text-[11px] text-sky-700">
            {language === 'th'
              ? 'ช่องเหล่านี้พยาบาลเป็นผู้บันทึกตอนคัดกรอง แพทย์แก้ไขเองไม่ได้ — ยังบันทึกผลการตรวจต่อได้ตามปกติ'
              : 'These fields are recorded by the nurse during triage and cannot be edited here. You can still complete the visit.'}
          </p>
        </div>
      )}

      {/* PATIENT INFORMATION BANNER - Modern High-Legibility Light Layout */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="p-6 sm:p-7 space-y-6">
          {/* Main Patient Header Row */}
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#2563eb] text-white flex items-center justify-center font-bold text-xl shrink-0 shadow-xs">
                {patient.name.charAt(0)}
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-xl font-bold text-slate-900 tracking-tight">{patient.name}</h2>
                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {language === 'th' ? `คิว #${patient.queueNo}` : `Queue #${patient.queueNo}`}
                  </span>
                  <CopyableText label="HN" value={patient.hn} className="bg-blue-50 text-blue-700 border border-blue-200 text-xs font-mono font-bold px-2.5 py-0.5 rounded-full" />
                  <CopyableText label="VN" value={displayVN(patient.vn)} className="bg-purple-50 text-purple-700 border border-purple-200 text-xs font-mono font-bold px-2.5 py-0.5 rounded-full" />
                  {/* แสดงแบบมีขีดคั่นให้อ่านง่าย แต่คัดลอกได้เป็นตัวเลขล้วน
                      เพราะระบบอื่นที่เอาไปวางต่อรับเฉพาะตัวเลข */}
                  <CopyableText label={language === 'th' ? 'เลขบัตร' : 'ID'} value={formatNationalId(nationalId)} copyValue={rawNationalId(nationalId)} className="bg-amber-50 text-amber-800 border border-amber-200 text-xs font-mono font-bold px-2.5 py-0.5 rounded-full" />
                  <span className="bg-sky-50 text-sky-800 border border-sky-200 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                    {language === 'th'
                      ? status === 'Waiting' ? 'รอตรวจ'
                        : status === 'Examining' ? 'กำลังตรวจ'
                        : (status as string) === 'Lab' || (status as string) === 'Pending Laboratory' ? 'รอผลแล็บ'
                        : status === 'Pending Pharmacy' ? 'รอรับยา'
                        : status === 'Completed' ? 'ตรวจเสร็จแล้ว'
                        : status
                      : status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  {language === 'th'
                    ? 'ประวัติข้อมูลส่วนตัวผู้ป่วย • ระบบเวชระเบียนผู้ป่วยนอก (OPD EMR)'
                    : "Patient's Profile • OPD Electronic Medical Record"}
                </p>
              </div>
            </div>


          </div>

          {/* Single Unified Profile Card: Demographics + Insurance + Visit */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3 shadow-xs">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2.5 text-sm font-bold text-slate-900">
              <div className="p-1.5 rounded-lg bg-blue-100/80 text-blue-700">
                <User className="w-4 h-4" />
              </div>
              <span>{language === 'th' ? 'ข้อมูลพื้นฐาน' : 'Demographics'}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
              {/* Box 1: Full Name */}
              <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/80">
                <span className="text-slate-500 font-bold block text-[11px] mb-0.5">{language === 'th' ? 'ชื่อ - นามสกุล :' : 'Full Name :'}</span>
                <span className="font-bold text-slate-900 text-xs">{patient.name}</span>
              </div>

              {/* Box 2: Age & Gender */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/80">
                  <span className="text-slate-500 font-bold block text-[11px] mb-0.5">{language === 'th' ? 'อายุ :' : 'Age :'}</span>
                  <span className="font-bold text-slate-900 text-xs">{patient.age} {language === 'th' ? 'ปี' : 'yrs'}</span>
                </div>
                <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/80">
                  <span className="text-slate-500 font-bold block text-[11px] mb-0.5">{language === 'th' ? 'เพศ :' : 'Gender :'}</span>
                  <span className="font-bold text-slate-900 text-xs">
                    {patient.gender === 'Male'
                      ? (language === 'th' ? 'ชาย' : 'Male')
                      : patient.gender === 'Female'
                      ? (language === 'th' ? 'หญิง' : 'Female')
                      : patient.gender}
                  </span>
                </div>
              </div>

              {/* Box 3: Blood Group & DOB */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/80">
                  <span className="text-slate-500 font-bold block text-[11px] mb-0.5">{language === 'th' ? 'หมู่โลหิต :' : 'Blood Group :'}</span>
                  <span className="font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100 inline-block text-[11px]">
                    {patient.bloodGroup
                      ? patient.bloodGroup
                      : (language === 'th' ? 'หมู่ O (O Positive)' : 'O Positive (O+)')}
                  </span>
                </div>
                <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/80">
                  <span className="text-slate-500 font-bold block text-[11px] mb-0.5">{language === 'th' ? 'วันเกิด :' : 'Date of Birth :'}</span>
                  <span className="font-semibold text-slate-800 text-xs">{patient.dob || '1984-03-15'}</span>
                </div>
              </div>

              {/* Box 4: National ID */}
              <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/80">
                <span className="text-slate-500 font-bold block text-[11px] mb-0.5">{language === 'th' ? 'เลขบัตรประชาชน :' : 'National ID :'}</span>
                <CopyableText value={formatNationalId(nationalId)} copyValue={rawNationalId(nationalId)} />
              </div>

              {/* Box 5: Insurance Scheme */}
              <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/80">
                <span className="text-slate-500 font-bold block text-[11px] mb-0.5">{language === 'th' ? 'สิทธิการรักษา :' : 'Insurance Scheme :'}</span>
                <span className="font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/60 inline-block text-xs">
                  {patient.insuranceType
                    ? patient.insuranceType
                    : (language === 'th' ? 'บัตรทอง (หลักประกันสุขภาพถั่วหน้า UC)' : 'Universal Health Coverage (UC)')}
                </span>
              </div>

              {/* Box 6: Visit Date & Visit Time */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/80">
                  <span className="text-slate-500 font-bold block text-[11px] mb-0.5">{language === 'th' ? 'วันที่รับบริการ :' : 'Visit Date :'}</span>
                  <span className="font-bold text-slate-900 text-xs">{patient.visitDate || '2026-07-23'}</span>
                </div>
                <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/80">
                  <span className="text-slate-500 font-bold block text-[11px] mb-0.5">{language === 'th' ? 'เวลา :' : 'Visit Time :'}</span>
                  <span className="font-bold text-slate-900 text-xs">{patient.visitTime || '-'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN TABS NAVBAR */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-200 overflow-x-auto scrollbar-none px-2 pt-1.5 w-full">
          {[
            { id: 'notes', label: language === 'th' ? 'ข้อมูลคัดกรอง & ประวัติ' : 'Triage & History', icon: FileText },
            { id: 'diagnosis', label: language === 'th' ? 'การวินิจฉัยโรค' : 'Diagnosis & Assessment', icon: Stethoscope },
            { id: 'prescription', label: language === 'th' ? 'การสั่งยา' : 'Prescription', badge: prescriptions.length, icon: Pill },
            { id: 'referral', label: language === 'th' ? 'เอกสาร & การส่งต่อ' : 'Documents & Referral', icon: Send },
            { id: 'followup', label: language === 'th' ? 'นัดหมายติดตามอาการ' : 'Follow-up & Actions', icon: Calendar },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 min-w-[140px] py-3.5 px-3 text-sm font-semibold transition-all border-b-2 whitespace-nowrap flex items-center justify-center gap-2 cursor-pointer ${
                  isActive
                    ? 'border-[#2563eb] text-[#2563eb] font-bold bg-blue-50/40'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#2563eb]' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${isActive ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* TAB 1: CLINICAL NOTES & VITAL SIGNS & MEDICAL HISTORY */}
        {activeTab === 'notes' && (
          <div className="p-6 space-y-6">
            {/* Chief Complaint (CC) - Sent from Triage (Read-only for doctor) */}
            <div id={EXAM_ANCHOR.chiefComplaint} className="space-y-3 scroll-mt-28">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {/* ยกเป็นหัวข้อใหญ่เท่ากับ "สัญญาณชีพ" และหัวข้ออื่นในแท็บ
                    เดิมเป็นป้ายกำกับช่องตัวเล็ก ทั้งที่เป็นข้อมูลสำคัญที่สุดในหน้า
                    คือเหตุผลที่ผู้ป่วยมาหาหมอ ควรเด่นกว่าหรืออย่างน้อยเท่ากับหัวข้ออื่น */}
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span>{language === 'th' ? 'อาการสำคัญ' : 'Chief Complaint (CC)'}</span>
                  <Stethoscope className="w-4 h-4 text-blue-600 shrink-0" />
                </h3>

                {/* ใครคัดกรอง และคัดกรองไว้ตอนไหน
                    สองค่านี้ backend ส่งมาให้ตั้งแต่แรก (screened_by_name, screened_at)
                    วางไว้ข้างหัวข้อแรกของแท็บ เพราะกำกับข้อมูลทุกอย่างในหน้านี้
                    ที่ส่งมาจากจุดคัดกรอง ทั้งอาการสำคัญ สัญญาณชีพ และประวัติ
                    จำเป็นมาก เพราะค่าที่วัดไว้หลายชั่วโมงก่อนใช้ตัดสินใจตอนนี้ไม่ได้ ต้องวัดซ้ำ
                    ถ้ายังไม่มีผลคัดกรอง จะไม่ขึ้นแถบนี้เลย ไม่ใช่ขึ้นค่าว่าง */}
                {(patient.screenedBy || patient.screenedAt) && (
                  <span className="inline-flex items-center gap-2 pl-2 pr-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-xs">
                    <span className="inline-flex items-center gap-1.5 min-w-0">
                      <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      {/* คำว่า "คัดกรองโดย" ซ่อนบนจอแคบ เหลือแค่ไอคอนกับชื่อ
                          ความหมายยังชัดจากไอคอน และไม่ดันให้ป้ายยาวจนตกบรรทัด */}
                      <span className="text-slate-400 font-medium hidden md:inline">
                        {language === 'th' ? 'คัดกรองโดย' : 'Screened by'}
                      </span>
                      <span className="text-slate-700 font-semibold truncate">
                        {patient.screenedBy || (language === 'th' ? 'ไม่ระบุผู้คัดกรอง' : 'Unknown')}
                      </span>
                    </span>

                    {patient.screenedAt && (
                      <>
                        <span className="w-px h-3.5 bg-slate-200 shrink-0"></span>
                        <span className="inline-flex items-center gap-1 shrink-0">
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-mono font-semibold text-slate-700">
                            {formatScreenedAt(patient.screenedAt)}
                          </span>
                        </span>
                      </>
                    )}
                  </span>
                )}
              </div>
              <div className="w-full min-h-[44px] px-3.5 py-2.5 bg-[#f8fafc] border border-slate-200 rounded-xl text-sm text-slate-800 font-normal flex items-center">
                {translateClinicalText(chiefComplaint, language) || <span className="text-slate-400 font-normal">- ไม่พบข้อมูลอาการสำคัญจากจุดคัดกรอง -</span>}
              </div>
            </div>

            {/* ---- "ระยะเวลาที่เป็นมา" กับ "ประวัติการเจ็บป่วยปัจจุบัน" ถูกถอดออก ----
                 เคยเพิ่มเป็นช่องกรอกไว้ แล้วเอาออกเพราะซ้ำซ้อนกับของที่มีอยู่แล้ว

                 ระยะเวลาที่เป็นมา: พยาบาลเขียนรวมอยู่ในช่อง "อาการสำคัญ" ด้านบนแล้ว
                 (เช่น "ไข้ต่ำๆ ไอมีเสมหะ เจ็บคอ มา 3 วัน") การมีช่องแยกอีกช่อง
                 ทำให้ข้อมูลเดียวกันอยู่สองที่ แล้วไม่มีใครรู้ว่าต้องเชื่อช่องไหน

                 ประวัติการเจ็บป่วยปัจจุบัน: ซ้ำกับ "การประเมินและวินิจฉัยเบื้องต้น"
                 ในแท็บการวินิจฉัยโรค ซึ่งเป็นที่ที่แพทย์เขียนอยู่แล้วจริงๆ

                 ตัวแปร chiefComplaintDuration / presentIllness ยังคงไว้
                 เพื่อให้ค่าที่เคยบันทึกไว้ในฐานข้อมูลถูกส่งกลับไปตามเดิม ไม่ถูกล้างทิ้ง
                 ถ้าวันหลังจุดคัดกรองส่งสองค่านี้มาจริง ค่อยเอาช่องกลับมาแสดง */}

            {/* หัวข้อ "การประเมินคัดกรองผู้ป่วย" ถูกย้ายออกจากหน้านี้แล้ว
                 ระดับความรุนแรงไปแสดงที่ตารางคิวผู้ป่วย (QueueTable.tsx) ต่อจากชื่อผู้ป่วย
                 เพราะแพทย์ต้องเห็นความเร่งด่วน "ก่อน" กดเข้าตรวจ ไม่ใช่ตอนอยู่ในห้องตรวจแล้ว
                 state triageLevel / priorityLevel / triageNotes ยังคงไว้
                 เพื่อส่งค่าเดิมกลับตอนบันทึก ข้อมูลของพยาบาลจะได้ไม่ถูกล้าง */}

            {/* VITAL SIGNS (Data Display Container) */}
            <div id={EXAM_ANCHOR.vitals} className="space-y-3 pt-2 border-t border-slate-100 scroll-mt-28">
              {/* ไอคอนอยู่ "หลัง" ข้อความ ตัวอักษรจึงเริ่มชิดขอบซ้ายตรงแนวเดียว
                  กับป้ายกำกับช่องข้อมูลที่อยู่ใต้ลงไป อ่านไล่ลงมาแล้วไม่สะดุด
                  แถบ "คัดกรองโดย ... • เวลา" ย้ายไปอยู่บรรทัดหัวข้ออาการสำคัญด้านบนแล้ว
                  เพราะกำกับข้อมูลทุกอย่างที่มาจากจุดคัดกรอง ไม่ใช่แค่สัญญาณชีพ */}
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>{language === 'th' ? 'สัญญาณชีพ' : 'Vital Signs'}</span>
                <Activity className="w-4 h-4 text-blue-600" />
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3.5">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-slate-800 block">
                    {language === 'th' ? 'ความดันโลหิต' : 'BP (mmHg)'}
                  </label>
                  <div className="w-full h-10 px-3 bg-[#f8fafc] border border-slate-200 rounded-xl text-sm font-bold text-slate-800 font-mono flex items-center">
                    {bp || <span className="text-slate-400 font-normal">{NOT_MEASURED[language === 'th' ? 'th' : 'en']}</span>}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-slate-800 block">
                    {language === 'th' ? 'ชีพจร' : 'HR / Pulse (bpm)'}
                  </label>
                  <div className="w-full h-10 px-3 bg-[#f8fafc] border border-slate-200 rounded-xl text-sm font-bold text-slate-800 font-mono flex items-center">
                    {pulse !== undefined ? `${fmtVital(pulse)} ${language === 'th' ? 'ครั้ง/นาที' : 'bpm'}` : <span className="text-slate-400 font-normal">{NOT_MEASURED[language === 'th' ? 'th' : 'en']}</span>}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-slate-800 block">
                    {language === 'th' ? 'อุณหภูมิ' : 'Temp (°C)'}
                  </label>
                  <div className="w-full h-10 px-3 bg-[#f8fafc] border border-slate-200 rounded-xl text-sm font-bold text-slate-800 font-mono flex items-center">
                    {temp !== undefined ? `${fmtVital(temp, 1)}°C` : <span className="text-slate-400 font-normal">{NOT_MEASURED[language === 'th' ? 'th' : 'en']}</span>}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-slate-800 block">
                    {language === 'th' ? 'น้ำหนัก' : 'Weight (kg)'}
                  </label>
                  <div className="w-full h-10 px-3 bg-[#f8fafc] border border-slate-200 rounded-xl text-sm font-bold text-slate-800 font-mono flex items-center">
                    {weight !== undefined ? `${fmtVital(weight, 1)} ${language === 'th' ? 'กก.' : 'kg'}` : <span className="text-slate-400 font-normal">{NOT_MEASURED[language === 'th' ? 'th' : 'en']}</span>}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-slate-800 block">
                    {language === 'th' ? 'ส่วนสูง' : 'Height (cm)'}
                  </label>
                  <div className="w-full h-10 px-3 bg-[#f8fafc] border border-slate-200 rounded-xl text-sm font-bold text-slate-800 font-mono flex items-center">
                    {height !== undefined ? `${fmtVital(height)} ${language === 'th' ? 'ซม.' : 'cm'}` : <span className="text-slate-400 font-normal">{NOT_MEASURED[language === 'th' ? 'th' : 'en']}</span>}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-slate-800 block">
                    BMI
                  </label>
                  <div className="w-full h-10 px-3 bg-[#f8fafc] border border-slate-200 rounded-xl text-sm font-bold text-slate-800 font-mono flex items-center">
                    {bmi > 0 ? `${fmtVital(bmi, 1)} kg/m²` : <span className="text-slate-400 font-normal">{NOT_MEASURED[language === 'th' ? 'th' : 'en']}</span>}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-slate-800 block">
                    {language === 'th' ? 'ระดับออกซิเจนในเลือด' : 'SpO₂ (%)'}
                  </label>
                  <div className="w-full h-10 px-3 bg-[#f8fafc] border border-slate-200 rounded-xl text-sm font-bold text-slate-800 font-mono flex items-center">
                    {spo2 !== undefined ? `${fmtVital(spo2)}%` : <span className="text-slate-400 font-normal">{NOT_MEASURED[language === 'th' ? 'th' : 'en']}</span>}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-slate-800 block">
                    {language === 'th' ? 'อัตราการหายใจ' : 'Resp Rate (/min)'}
                  </label>
                  <div className="w-full h-10 px-3 bg-[#f8fafc] border border-slate-200 rounded-xl text-sm font-bold text-slate-800 font-mono flex items-center">
                    {respiratoryRate !== undefined ? `${fmtVital(respiratoryRate)} ${language === 'th' ? 'ครั้ง/นาที' : '/min'}` : <span className="text-slate-400 font-normal">{NOT_MEASURED[language === 'th' ? 'th' : 'en']}</span>}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-slate-800 block">
                    {language === 'th' ? 'ระดับความเจ็บปวด' : 'Pain Score (0-10)'}
                  </label>
                  <div className="w-full h-10 px-3 bg-[#f8fafc] border border-slate-200 rounded-xl text-sm font-bold text-slate-800 font-mono flex items-center">
                    {painScore !== undefined
                      ? `${painScore}/10`
                      : <span className="text-slate-400 font-normal">- ไม่ได้ประเมิน -</span>}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-slate-800 block">
                    {language === 'th' ? 'ระดับน้ำตาลในเลือด' : 'Blood Sugar (mg/dL)'}
                  </label>
                  <div className="w-full h-10 px-3 bg-[#f8fafc] border border-slate-200 rounded-xl text-sm font-bold text-slate-800 font-mono flex items-center">
                    {bloodSugar !== undefined
                      ? `${bloodSugar} mg/dL`
                      : <span className="text-slate-400 font-normal">- ไม่ได้ตรวจ -</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* ============================================================
                ประวัติจากจุดคัดกรอง แยกเป็น 4 หัวข้อใหญ่
                ============================================================
                เดิมยัดทุกอย่างไว้ในตารางเดียว 12-13 ช่องเรียงติดกัน
                อ่านแล้วไม่รู้ว่าอะไรสำคัญกว่าอะไร และหาของที่ต้องการไม่เจอ

                เรียงตามลำดับที่แพทย์ต้องใช้จริงในห้องตรวจ
                  1. ติดเชื้อไหม ต้องป้องกันตัวยังไง  -> รู้ก่อนแตะตัวผู้ป่วย
                  2. แพ้อะไร มีโรคอะไรอยู่            -> รู้ก่อนคิดเรื่องยา
                  3. ใช้ยา/สมุนไพรอะไรอยู่            -> รู้ตอนเลือกยาว่าตีกันไหม
                  4. พฤติกรรมสุขภาพ                  -> ใช้ตอนให้คำแนะนำ ไม่เร่งด่วน
                ============================================================ */}
            <div className="space-y-6">
              {/* --- 1. ความเสี่ยงติดเชื้อและการป้องกัน --------------------
                  สามข้อนี้ต้องอยู่ด้วยกัน เพราะ URI/TB เป็น "เหตุ"
                  และ Precaution เป็น "สิ่งที่ต้องทำ" ที่ตามมาจากสองข้อนั้น
                  เช่น TB = มี ควรมาคู่กับ Airborne เสมอ ถ้าไม่ตรงกันแปลว่ามีอะไรผิด */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span>{language === 'th' ? 'ความเสี่ยงติดเชื้อและการป้องกัน' : 'Infection Risk & Precautions'}</span>
                  <Shield className="w-4 h-4 text-sky-600" />
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  <TriageFlag
                    label={language === 'th' ? 'อาการติดเชื้อทางเดินหายใจส่วนบน (URI)' : 'Upper Respiratory Infection (URI)'}
                    value={patient.hasURI}
                    language={language}
                  />

                  <TriageFlag
                    label={language === 'th' ? 'คัดกรองวัณโรค (TB)' : 'Tuberculosis Screening (TB)'}
                    value={patient.hasTB}
                    language={language}
                  />

                  <PrecautionCard value={patient.precautionType} language={language} />
                </div>
              </div>

              {/* --- 2. การแพ้และโรคประจำตัว -------------------------------
                  สองเรื่องนี้อยู่ด้วยกันเพราะเป็น "สิ่งที่ผู้ป่วยเป็น" ซึ่งคงที่
                  ไม่เปลี่ยนตามการมาตรวจแต่ละครั้ง ต่างจากยาที่ใช้อยู่ซึ่งเปลี่ยนได้ตลอด
                  และเป็นข้อมูลที่ต้องอ่านให้จบก่อนเริ่มคิดเรื่องยา */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span>{language === 'th' ? 'การแพ้และโรคประจำตัว' : 'Allergies & Underlying Conditions'}</span>
                  <AlertTriangle className="w-4 h-4 text-rose-500" />
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {/* ประวัติแพ้ยา
                      ไฮไลต์แดงเฉพาะตอนที่ "แพ้จริง" เท่านั้น
                      เดิมเช็คแค่ว่ามีข้อความไหม พอพยาบาลพิมพ์ว่า "ปฏิเสธการแพ้ยา"
                      ระบบก็ขึ้นกล่องแดงเหมือนผู้ป่วยแพ้ยา ซึ่งอ่านผิดไปคนละทาง
                      ตอนนี้ตรวจคำปฏิเสธก่อน (ไม่ / ปฏิเสธ / no / none / NKA) */}
                  <InfoCard
                    label={language === 'th' ? 'ประวัติแพ้ยา' : 'Drug Allergies'}
                    value={joinDetail(drugAllergiesText, drugAllergySymptoms)}
                    danger={hasRealValue(drugAllergiesText) && !noDrugAllergy}
                  />

                  <InfoCard
                    label={language === 'th' ? 'ประวัติแพ้อาหาร' : 'Food Allergies'}
                    value={joinDetail(foodAllergiesText, foodAllergySymptoms)}
                    danger={hasRealValue(foodAllergiesText) && !noFoodAllergy}
                  />

                  <InfoCard
                    label={language === 'th' ? 'โรคประจำตัว' : 'Underlying Diseases'}
                    value={noChronicDisease ? '' : chronicDiseasesText}
                  />
                </div>
              </div>

              {/* --- 3. ยาที่ใช้อยู่ และข้อควรระวังก่อนสั่งยา ----------------
                  ทุกช่องในกลุ่มนี้ตอบคำถามเดียวกันคือ "สั่งยาตัวนี้ให้ได้ไหม"
                  ยาละลายลิ่มเลือดย้ายมาจากกลุ่มคัดกรองด้านบน เพราะมันคือ "ยา"
                  ควรอยู่ข้างๆ ยาประจำและสมุนไพรที่เสริมฤทธิ์กันได้
                  การตั้งครรภ์/ให้นมบุตรก็อยู่กลุ่มนี้ด้วยเหตุผลเดียวกัน */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span>{language === 'th' ? 'ยาที่ใช้อยู่ และข้อควรระวังก่อนสั่งยา' : 'Current Medications & Prescribing Cautions'}</span>
                  <Pill className="w-4 h-4 text-indigo-600" />
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  <InfoCard
                    label={language === 'th' ? 'ยาที่รับประทานประจำ' : 'Current Medications'}
                    value={currentMedicationsText}
                  />

                  <TriageFlag
                    label={language === 'th' ? 'ใช้ยาละลายลิ่มเลือด' : 'On Anticoagulant'}
                    value={patient.onAnticoagulant}
                    language={language}
                    presentTh="ใช้อยู่"
                    absentTh="ไม่ได้ใช้"
                    presentEn="Yes"
                    absentEn="No"
                  />

                  {/* สมุนไพร / อาหารเสริม แยกจากช่องยาข้างบนโดยตั้งใจ
                      ผู้ป่วยส่วนใหญ่ไม่คิดว่าสองอย่างนี้คือ "ยา" ถามรวมกันจะได้คำตอบว่า
                      "ไม่ได้กินยาอะไร" ทั้งที่กินขมิ้นชันกับน้ำมันปลาอยู่

                      ตีกับยาจริงได้ เช่น แปะก๊วย/น้ำมันปลา/ขิง เสริมฤทธิ์ยาละลายลิ่มเลือด
                      St. John's Wort ทำให้ยาหลายตัวเสื่อมฤทธิ์ วิตามินเคต้าน warfarin */}
                  <InfoCard
                    label={language === 'th' ? 'สมุนไพร' : 'Herbal Medicines'}
                    value={patient.herbalMedicines}
                  />

                  <InfoCard
                    label={language === 'th' ? 'อาหารเสริม' : 'Dietary Supplements'}
                    value={patient.dietarySupplements}
                  />

                  {/* คัดกรองเฉพาะผู้ป่วยหญิง
                      แสดงเฉพาะเมื่อเป็นเพศหญิง เพราะถ้าขึ้นกับผู้ป่วยชายด้วย
                      จะเป็นช่องที่ขึ้นว่า "ยังไม่ได้ประเมิน" ตลอดไปโดยไม่มีวันถูกกรอก
                      ทำให้แพทย์ชินกับการเห็นช่องว่าง แล้วมองข้ามตอนที่มันสำคัญจริง */}
                  {patient.gender === 'Female' && (
                    <FemaleScreeningCard
                      isPregnant={patient.isPregnant}
                      isBreastfeeding={patient.isBreastfeeding}
                      lastMenstrualPeriod={patient.lastMenstrualPeriod}
                      language={language}
                    />
                  )}
                </div>
              </div>

              {/* --- 4. พฤติกรรมสุขภาพ -------------------------------------
                  อยู่ท้ายสุดเพราะไม่ได้ใช้ตัดสินใจเร่งด่วนในห้องตรวจ
                  แต่ใช้ตอนให้คำแนะนำและวางแผนติดตามอาการ */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span>{language === 'th' ? 'พฤติกรรมสุขภาพ' : 'Social & Lifestyle History'}</span>
                  <Heart className="w-4 h-4 text-teal-600" />
                </h3>

                {/* กลุ่มนี้มีแค่ 2 ช่อง จึงใช้ 2 คอลัมน์ ไม่ใช่ 3
                    ถ้าใช้ 3 เหมือนกลุ่มอื่นจะเหลือช่องว่างค้างท้ายแถวหนึ่งช่อง
                    ดูเหมือนมีอะไรหายไป ทั้งที่ครบแล้ว */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* แสดงข้อความเดิมที่พยาบาลพิมพ์ไว้ตรงๆ ไม่ตีความใหม่
                      จุดคัดกรองเก็บเป็นข้อความอิสระช่องเดียว ไม่ได้แยกความถี่กับระยะเวลา
                      ถ้าจะแยกต้องให้จุดคัดกรองเพิ่มคอลัมน์ก่อน */}
                  <InfoCard
                    label={language === 'th' ? 'ประวัติการสูบบุหรี่' : 'Smoking History'}
                    value={patient.smokingHistory?.status}
                  />

                  <InfoCard
                    label={language === 'th' ? 'ประวัติการดื่มแอลกอฮอล์' : 'Alcohol Drinking'}
                    value={patient.alcoholHistory?.status}
                  />
                </div>
              </div>

              {/* ============================================================
                  แบบคัดกรองภาวะซึมเศร้า 2Q
                  ============================================================
                  แบบคัดกรองมาตรฐานของกรมสุขภาพจิต ถามถึงช่วง 2 สัปดาห์ที่ผ่านมา
                  รวมวันนี้ ตอบว่า "มี" แม้เพียงข้อเดียว = ผลบวก ต้องประเมินต่อด้วย 9Q

                  แยกเป็นหัวข้อใหญ่ของตัวเอง ไม่ยัดรวมกับกลุ่มประวัติด้านบน
                  เพราะเป็นแบบคัดกรองที่มีเกณฑ์แปลผลชัดเจน ไม่ใช่ข้อมูลประวัติทั่วไป
                  และผลบวกมีสิ่งที่แพทย์ต้องทำต่อทันที */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span>{language === 'th' ? '2Q (2 สัปดาห์)' : '2Q Depression Screening (2 weeks)'}</span>
                  <HeartPulse className="w-4 h-4 text-rose-500" />
                </h3>

                <p className="text-xs text-slate-500 -mt-1">
                  {language === 'th'
                    ? 'ในช่วง 2 สัปดาห์ที่ผ่านมา รวมทั้งวันนี้ ผู้ป่วยมีอาการต่อไปนี้หรือไม่'
                    : 'In the past 2 weeks, including today, has the patient experienced:'}
                </p>

                {/* สองคำถามของ 2Q ใช้ 2 คอลัมน์เต็มแถว ด้วยเหตุผลเดียวกับกลุ่มพฤติกรรมสุขภาพ */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <TriageFlag
                    label={language === 'th' ? 'หดหู่ เศร้า ท้อแท้' : 'Depressed mood'}
                    value={patient.q2Depressed}
                    language={language}
                    presentTh="มีอาการ"
                    absentTh="ไม่มีอาการ"
                    presentEn="Yes"
                    absentEn="No"
                  />

                  <TriageFlag
                    label={language === 'th' ? 'เบื่อหน่าย' : 'Anhedonia'}
                    value={patient.q2Anhedonia}
                    language={language}
                    presentTh="มีอาการ"
                    absentTh="ไม่มีอาการ"
                    presentEn="Yes"
                    absentEn="No"
                  />
                </div>
              </div>

              {/* ADDITIONAL NOTES & DOCTOR HANDOVER */}
              <div className="pt-4 border-t border-slate-100">
                {/* เหลือช่องเดียวแล้ว (กล่อง "ข้อมูลสำคัญแจ้งแพทย์" ถูกถอดออกไป)
                    จึงเลิกใช้ตาราง 2 คอลัมน์ ให้ยาวเต็มความกว้าง
                    เหมาะกับเนื้อหาด้วย เพราะเป็นข้อความยาวที่พยาบาลพิมพ์มา
                    บีบให้เหลือครึ่งจอจะขึ้นบรรทัดใหม่บ่อยโดยไม่จำเป็น */}
                <div className="grid grid-cols-1 gap-3.5">
                  {/* Nurse Notes Display */}
                  <div className="space-y-1.5">
                    {/* ไอคอนอยู่ "หลัง" ข้อความ เหมือนหัวข้อสัญญาณชีพและประวัติทางการแพทย์ */}
                    <label className="text-[13px] font-bold text-slate-800 flex items-center gap-1.5 block">
                      <span>{language === 'th' ? 'บันทึกการคัดกรองเบื้องต้น' : 'Initial Triage Notes'}</span>
                      <FileText className="w-3.5 h-3.5 text-blue-600" />
                    </label>
                    <div className="w-full min-h-[48px] p-3 bg-[#f8fafc] border border-slate-200 rounded-xl text-sm text-slate-800 leading-relaxed font-normal flex items-center">
                      {(nurseNotes || triageNotes || patient.triage?.notes) ? (
                        <p className="whitespace-pre-wrap">
                          {nurseNotes || translateClinicalText(triageNotes || patient.triage?.notes, language)}
                        </p>
                      ) : (
                        <span className="text-slate-400 font-normal">
                          {language === 'th' ? '- ไม่มีบันทึกเพิ่มเติมจากพยาบาล -' : '- No additional nurse notes -'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* กล่อง "ข้อมูลสำคัญแจ้งแพทย์" ถูกถอดออก
                      ตาราง screenings ของพยาบาลไม่มีคอลัมน์นี้ พยาบาลจึงกรอกไม่ได้
                      กล่องนี้ขึ้นว่า "ไม่มีข้อความสำคัญหรือข้อควรระวังแจ้งแพทย์" ตลอดไป
                      ซึ่งอันตราย เพราะแพทย์อ่านแล้วเข้าใจว่า "พยาบาลตรวจแล้วไม่มีอะไรต้องระวัง"
                      ทั้งที่ความจริงคือไม่มีใครเคยกรอกช่องนี้ได้เลย
                      ถ้าอยากได้กลับมา ต้องให้เจ้าของ role พยาบาลเพิ่มคอลัมน์ในตาราง screenings ก่อน
                      แล้วค่อยส่งผ่าน ScreeningBrief มาให้ (ตัวแปร importantInfoForDoctor ยังอยู่ครบ) */}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DIAGNOSIS & ASSESSMENT */}
        {activeTab === 'diagnosis' && (
          <div className="p-6 space-y-6">
            
            {/* PHYSICAL EXAMINATION SYSTEM FINDINGS */}
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>{language === 'th' ? 'การตรวจร่างกาย' : 'Physical Examination'}</span>
                <Stethoscope className="w-4 h-4 text-blue-600 shrink-0" />
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-[13px] font-bold text-slate-800 block mb-1">
                    {language === 'th' ? 'สภาพทั่วไป' : 'General Appearance'}
                  </label>
                  <textarea
                    rows={2}
                    value={generalAppearance}
                    onChange={(e) => setGeneralAppearance(e.target.value)}
                    placeholder={
                      language === 'th'
                        ? 'รู้สึกตัวดี มีอาการไม่สบายตัวเล็กน้อยจากเจ็บคอ...'
                        : 'Good consciousness, non-toxic appearance...'
                    }
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 outline-hidden transition-all resize-none leading-relaxed"
                  />
                </div>

                <div>
                  <label className="text-[13px] font-bold text-slate-800 block mb-1">
                    {language === 'th' ? 'ศีรษะ ตา หู จมูก คอ' : 'HEENT'}
                  </label>
                  <textarea
                    rows={2}
                    value={heent}
                    onChange={(e) => setHeent(e.target.value)}
                    placeholder={
                      language === 'th'
                        ? 'ผนังคอหอยแดงมากและมีคราบหนองบริเวณต่อมทอนซิล คลำพบต่อมน้ำเหลืองบริเวณลำคอโต...'
                        : 'Pharynx erythematous with tonsillar exudates, cervical lymph nodes palpable...'
                    }
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 outline-hidden transition-all resize-none leading-relaxed"
                  />
                </div>

                <div>
                  <label className="text-[13px] font-bold text-slate-800 block mb-1">
                    {language === 'th' ? 'ระบบหัวใจและหลอดเลือด' : 'Cardiovascular'}
                  </label>
                  <textarea
                    rows={2}
                    value={cardiovascular}
                    onChange={(e) => setCardiovascular(e.target.value)}
                    placeholder={
                      language === 'th'
                        ? 'เสียงหัวใจ S1, S2 ปกติ ไม่พบเสียงฟู่ (Murmur)...'
                        : 'Normal S1, S2, no murmur...'
                    }
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 outline-hidden transition-all resize-none leading-relaxed"
                  />
                </div>

                <div>
                  <label className="text-[13px] font-bold text-slate-800 block mb-1">
                    {language === 'th' ? 'ระบบทางเดินหายใจและปอด' : 'Respiratory'}
                  </label>
                  <textarea
                    rows={2}
                    value={respiratory}
                    onChange={(e) => setRespiratory(e.target.value)}
                    placeholder={
                      language === 'th'
                        ? 'ปอดฟังชัดเจนทั้งสองข้าง ไม่พบเสียงวี้ดหรือเสียงครืดคราด...'
                        : 'Clear bilaterally, no adventitious sounds, no wheezing...'
                    }
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 outline-hidden transition-all resize-none leading-relaxed"
                  />
                </div>

                <div>
                  <label className="text-[13px] font-bold text-slate-800 block mb-1">
                    {language === 'th' ? 'ระบบช่องท้อง' : 'Abdomen'}
                  </label>
                  <textarea
                    rows={2}
                    value={abdomen}
                    onChange={(e) => setAbdomen(e.target.value)}
                    placeholder={
                      language === 'th'
                        ? 'หน้าท้องนุ่ม ไม่กดเจ็บ ไม่พบตับหรือม้ามโต...'
                        : 'Soft, non-tender, active bowel sounds, no organomegaly...'
                    }
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 outline-hidden transition-all resize-none leading-relaxed"
                  />
                </div>

                <div>
                  <label className="text-[13px] font-bold text-slate-800 block mb-1">
                    {language === 'th' ? 'ระบบกล้ามเนื้อและกระดูก' : 'Musculoskeletal'}
                  </label>
                  <textarea
                    rows={2}
                    value={musculoskeletal}
                    onChange={(e) => setMusculoskeletal(e.target.value)}
                    placeholder={
                      language === 'th'
                        ? 'การเคลื่อนไหวของข้อและกล้ามเนื้อปกติ...'
                        : 'Normal range of motion, muscle power 5/5...'
                    }
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 outline-hidden transition-all resize-none leading-relaxed"
                  />
                </div>

                {/* 2 ช่องล่างนี้เพิ่มทีหลัง ตอนแรกฟอร์มมีแค่ 6 ระบบ
                    แต่ทั้งตาราง examinations, DTO และ types.ts ออกแบบไว้ 8 ระบบ
                    ตัวแปร neurological / skin มีอยู่แล้วและถูกส่งไปบันทึกทุกครั้ง
                    แค่ไม่มี textarea ผูกกับมัน ค่าที่บันทึกจึงเป็นค่าว่างเสมอ
                    ผลคือหน้าประวัติโชว์ "ระบบประสาท: -" ซึ่งอ่านได้ว่า "ตรวจแล้วปกติ"
                    ทั้งที่ความจริงคือไม่เคยมีช่องให้แพทย์ตรวจเลย */}
                <div>
                  <label className="text-[13px] font-bold text-slate-800 block mb-1">
                    {language === 'th' ? 'ระบบประสาท' : 'Neurological'}
                  </label>
                  <textarea
                    rows={2}
                    value={neurological}
                    onChange={(e) => setNeurological(e.target.value)}
                    placeholder={
                      language === 'th'
                        ? 'รู้สึกตัวดี ไม่มีอาการทางระบบประสาทเฉพาะที่...'
                        : 'Alert and oriented, no focal neurological deficit...'
                    }
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 outline-hidden transition-all resize-none leading-relaxed"
                  />
                </div>

                <div>
                  <label className="text-[13px] font-bold text-slate-800 block mb-1">
                    {language === 'th' ? 'ผิวหนัง' : 'Skin'}
                  </label>
                  <textarea
                    rows={2}
                    value={skin}
                    onChange={(e) => setSkin(e.target.value)}
                    placeholder={
                      language === 'th'
                        ? 'ผิวหนังปกติ ไม่มีผื่น ไม่มีจุดเลือดออก...'
                        : 'No rash, no petechiae, normal turgor...'
                    }
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 outline-hidden transition-all resize-none leading-relaxed"
                  />
                </div>
              </div>
            </div>
            
            {/* Assessment Notes & Treatment Plan Textareas
                วางต่อจาก "การตรวจร่างกาย" เพราะเป็นบทสรุปของสิ่งที่เพิ่งตรวจ
                แล้วค่อยไปเลือกรหัส ICD-10 ด้านล่าง */}
            <div id={EXAM_ANCHOR.assessment} className="space-y-3 pt-3 border-t border-slate-100 scroll-mt-28">
              <div className="pb-2 border-b border-slate-200/80">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span>{language === 'th' ? 'สรุปผลการตรวจ' : 'Visit Conclusion'}</span>
                  <ClipboardCheck className="w-4 h-4 text-blue-600 shrink-0" />
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[13px] font-bold text-slate-800 block mb-1">
                    {language === 'th' ? 'การประเมินและวินิจฉัยเบื้องต้น' : 'Assessment Notes'}
                    <span className="text-red-600"> *</span>
                  </label>
                  <textarea
                    rows={4}
                    value={assessmentNotes}
                    onChange={(e) => setAssessmentNotes(e.target.value)}
                    placeholder={language === 'th' ? 'ระบุเหตุผลทางการแพทย์ ข้อควรพิจารณา การประเมินความรุนแรง...' : 'Enter clinical reasoning, severity assessment, and considerations...'}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 focus:outline-hidden transition-all"
                  />
                </div>

                <div>
                  <label className="text-[13px] font-bold text-slate-800 block mb-1">
                    {language === 'th' ? 'แผนการรักษาและหัตถการ' : 'Treatment Plan & Procedures'}
                    <span className="text-red-600"> *</span>
                  </label>
                  <textarea
                    rows={4}
                    value={treatmentPlan}
                    onChange={(e) => setTreatmentPlan(e.target.value)}
                    placeholder={language === 'th' ? 'ระบุแผนการดูแล คำแนะนำที่ไม่ใช้ยา หัตถการที่ทำ...' : 'Enter care plan, non-pharmacological advice, procedures performed...'}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 focus:outline-hidden transition-all"
                  />
                </div>
              </div>
            </div>
            {/* 1. ICD-10 SEARCH & AUTOCOMPLETE */}
            <div id={EXAM_ANCHOR.diagnosis} className="space-y-4 bg-white p-5 rounded-2xl border border-slate-200 relative scroll-mt-28">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-slate-200/80">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span>{language === 'th' ? 'ค้นหารหัสโรค ICD-10' : 'Search ICD-10 Diagnosis'}</span>
                  <Search className="w-4 h-4 text-blue-600 shrink-0" />
                </h3>
                <span className="text-xs font-medium text-slate-500">
                  {language === 'th' ? 'ค้นหาจากรหัสโรค ชื่อภาษาไทย หรือภาษาอังกฤษ' : 'Search by Code, English or Thai name'}
                </span>
              </div>

              {/* Duplicate or Validation Warning Alert */}
              {diagWarning && (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs font-semibold flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>{diagWarning}</span>
                  </div>
                  <button type="button" onClick={() => setDiagWarning('')} className="text-amber-600 hover:text-amber-800 cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Search Bar Input */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={diagSearch}
                  onChange={(e) => {
                    setDiagSearch(e.target.value);
                    setShowDiagDropdown(true);
                  }}
                  onFocus={() => setShowDiagDropdown(true)}
                  placeholder={language === 'th' ? 'พิมพ์รหัส ICD-10 หรือชื่อโรค เช่น J02.9, Pharyngitis, คออักเสบ...' : 'Search ICD-10 code or disease name (e.g. J02.9, Pharyngitis)...'}
                  className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 focus:outline-none"
                />
                {diagSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setDiagSearch('');
                      setShowDiagDropdown(false);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}

                {/* Autocomplete Dropdown List */}
                {showDiagDropdown && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowDiagDropdown(false)}
                    />
                    <div className="absolute z-20 left-0 right-0 mt-1.5 max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl divide-y divide-slate-100">
                      {filteredICD10.length > 0 ? (
                        filteredICD10.map((item) => {
                          const selected = isCodeSelected(item.code);
                          return (
                            <div
                              key={item.code}
                              className={`p-3 transition-all flex items-center justify-between hover:bg-blue-50/70 ${selected ? 'bg-slate-50' : 'cursor-pointer'}`}
                            >
                              <div
                                className="flex-1 cursor-pointer"
                                onClick={() => handleSelectDiagnosis(item)}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                                    {item.code}
                                  </span>
                                  <span className="text-sm font-bold text-slate-900">{item.localName || item.name}</span>
                                </div>
                                {item.localName && (
                                  <span className="text-xs font-medium text-slate-400 block ml-0.5 mt-0.5">
                                    {item.name}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 ml-2">
                                {selected ? (
                                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 flex items-center gap-1">
                                    <Check className="w-3 h-3" /> {language === 'th' ? 'เลือกแล้ว' : 'Selected'}
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleSelectDiagnosis(item)}
                                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                                  >
                                    {!primaryDiag
                                      ? (language === 'th' ? '+ เลือกเป็นโรคหลัก' : '+ Set Primary')
                                      : (language === 'th' ? '+ เพิ่มโรควินิจฉัย' : '+ Add Diagnosis')}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="p-4 text-center text-xs text-slate-500 font-medium">
                          {language === 'th' ? `ไม่พบข้อมูล ICD-10 ที่ตรงกับ "${diagSearch}"` : `No ICD-10 diagnosis matching "${diagSearch}"`}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* โรคที่วินิจฉัยบ่อย ย้ายมาอยู่ใต้ช่องค้นหาในการ์ดเดียวกัน
                  เดิมแยกเป็นการ์ดของตัวเอง ทั้งที่ทำงานเดียวกัน
                  คือ "เลือกโรคเข้ารายการ" แค่คนละวิธี (พิมพ์หา vs กดจากรายการที่ใช้บ่อย)
                  แยกการ์ดทำให้ดูเหมือนสองขั้นตอนที่ต้องทำทั้งคู่ ทั้งที่เลือกทางไหนก็ได้

                  ใช้ป้ายกำกับตัวเล็กแทนหัวข้อใหญ่ เพราะเป็นทางลัดของช่องค้นหาด้านบน
                  ไม่ใช่หัวข้อระดับเดียวกัน */}
              <div className="pt-1">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 mb-2">
                  <span className="text-[13px] font-bold text-slate-800">
                    {language === 'th' ? 'โรคที่วินิจฉัยบ่อย' : 'Recent Diagnoses'}
                  </span>
                  <span className="text-xs font-medium text-slate-500">
                    {language === 'th' ? 'คลิกเพื่อเพิ่มลงในรายการวินิจฉัยปัจจุบัน' : 'Click to add directly to current diagnosis list'}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {recentDiagnoses.map((item) => {
                    const selected = isCodeSelected(item.code);
                    return (
                      <button
                        key={item.code}
                        type="button"
                        onClick={() => handleSelectDiagnosis(item)}
                        disabled={selected}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all flex items-center gap-1.5 ${
                          selected
                            ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-75'
                            : 'bg-white hover:bg-blue-50 text-slate-800 border-slate-200 hover:border-blue-300 hover:text-blue-900 cursor-pointer shadow-2xs'
                        }`}
                      >
                        <span className="font-mono text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                          {item.code}
                        </span>
                        <span>{item.name}</span>
                        {selected ? (
                          <Check className="w-3 h-3 text-emerald-600 ml-1" />
                        ) : (
                          <Plus className="w-3 h-3 text-slate-400 ml-0.5" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 2. SELECTED DIAGNOSIS LIST */}
            <div className="space-y-4 bg-white p-5 rounded-2xl border border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-slate-200/80">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span>
                    {language === 'th' ? 'รายการโรคที่วินิจฉัยแล้ว' : 'Selected Diagnoses List'}
                    <span className="text-red-600"> *</span>
                  </span>
                  <ClipboardCheck className="w-4 h-4 text-blue-600 shrink-0" />
                </h3>
                <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                  {language === 'th'
                    ? `รวมทั้งหมด: ${(primaryDiag ? 1 : 0) + secondaryDiags.length} รายการ`
                    : `Total: ${(primaryDiag ? 1 : 0) + secondaryDiags.length} items`}
                </span>
              </div>

              {/* No Diagnosis Selected Validation Card */}
              {!primaryDiag && secondaryDiags.length === 0 && (
                <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl text-amber-900 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>{language === 'th' ? 'ยังไม่ได้ระบุการวินิจฉัยโรค' : 'No Diagnosis Selected'}</span>
                  </div>
                  <p className="text-xs text-amber-800">
                    {language === 'th'
                      ? '* จำเป็นต้องระบุการวินิจฉัยหลักอย่างน้อย 1 รายการก่อนเสร็จสิ้นการตรวจ'
                      : "* Required: At least one Primary Diagnosis is required before completing the patient's visit."}
                  </p>
                </div>
              )}

              {/* ============================================================
                  รายการโรคที่วินิจฉัยแล้ว จัดเป็น "ตาราง" แถวเดียวต่อโรค
                  ============================================================
                  เดิมแต่ละโรคเป็นการ์ดลอยๆ สูงสองบรรทัด มีกรอบของตัวเอง
                  พอมี 4 โรคขึ้นไป จะกลายเป็นกล่องเรียงกันเต็มจอ อ่านไม่ออกว่า
                  โรคไหนเป็นหลัก โรคไหนเป็นร่วม และมีทั้งหมดกี่รายการ

                  เปลี่ยนเป็นกรอบเดียวคั่นด้วยเส้นบาง แต่ละแถวมี
                    เลขลำดับ -> รหัส ICD -> ชื่อโรค -> ปุ่มจัดการ
                  ตำแหน่งตรงกันทุกแถว กวาดตาลงมาอ่านได้ทีเดียว
                  โรคหลักใช้พื้นสีฟ้ากับดาว แทนการตีกรอบหนาทั้งใบ
                  ============================================================ */}
              {/* ยังไม่มีโรคเลย ไม่ต้องขึ้นกรอบเปล่า เพราะการ์ดเตือนสีเหลืองด้านบน
                  บอกอยู่แล้วว่ายังไม่ได้ระบุการวินิจฉัย กรอบว่างเปล่าไม่ได้เพิ่มอะไร */}
              {/* จำกัดความสูงไว้ประมาณ 5 แถว เกินกว่านั้นให้เลื่อนดูข้างใน
                  แถวหนึ่งสูงราว 66px (py-3 + ชื่อโรค 1 บรรทัด + ป้ายกำกับตัวเล็ก)
                  5 แถว = ~330px เผื่อไว้ 336px

                  ทำไมต้องจำกัด: ผู้ป่วยบางรายวินิจฉัยได้ 8-10 โรค ถ้าปล่อยยาวหมด
                  การ์ดนี้จะดันช่องอื่นในแท็บหลุดออกนอกจอ ต้องเลื่อนทั้งหน้าไปมา
                  ตัดให้เลื่อนเฉพาะในรายการ ตำแหน่งของส่วนอื่นในหน้าจะอยู่คงที่ */}
              {(primaryDiag || secondaryDiags.length > 0) && (
              <div className="rounded-2xl border border-slate-200 divide-y divide-slate-100 max-h-[336px] overflow-y-auto">
                {/* PRIMARY DIAGNOSIS ROW
                    ใช้พื้นฟ้าบอกว่าเป็นโรคหลัก ไม่มีแถบสีด้านซ้ายและไม่แยกกรอบ
                    แถวจะได้เรียงตรงกับแถวอื่นในตารางเดียวกัน */}
                {primaryDiag ? (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 bg-blue-100/70">
                    <span className="w-7 h-7 shrink-0 rounded-full bg-blue-600 text-white flex items-center justify-center">
                      <Star className="w-3.5 h-3.5 fill-current" />
                    </span>

                    <span className="shrink-0 text-xs font-mono font-bold text-blue-900 bg-white px-2 py-1 rounded-lg border border-blue-200">
                      {primaryDiag.code}
                    </span>

                    {editingDiagTarget === 'primary' ? (
                      <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                        <input
                          type="text"
                          value={editDiagText}
                          onChange={(e) => setEditDiagText(e.target.value)}
                          className="flex-1 px-3 py-1.5 bg-white border border-blue-300 rounded-xl text-xs font-medium focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 focus:outline-hidden transition-all"
                        />
                        <button
                          type="button"
                          onClick={saveEditDiagnosis}
                          className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-xl cursor-pointer shrink-0"
                        >
                          {language === 'th' ? 'บันทึก' : 'Save'}
                        </button>
                      </div>
                    ) : (
                      <div className="flex-1 min-w-[220px]">
                        <p className="text-sm font-bold text-slate-900 leading-snug">
                          {primaryDiag.name} {primaryDiag.localName ? `(${primaryDiag.localName})` : ''}
                        </p>
                        <p className="text-[11px] font-bold text-blue-700 mt-0.5">
                          {language === 'th' ? 'การวินิจฉัยหลัก' : 'Primary Diagnosis'}
                        </p>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 ml-auto shrink-0">
                      <button
                        type="button"
                        onClick={() => startEditDiagnosis('primary', primaryDiag.name)}
                        className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3" /> {language === 'th' ? 'แก้ไข' : 'Edit'}
                      </button>

                      {secondaryDiags.length > 0 && (
                        <button
                          type="button"
                          onClick={handleDemotePrimary}
                          className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
                        >
                          {language === 'th' ? 'เปลี่ยนเป็นโรครอง' : 'Set as Secondary'}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={handleRemovePrimary}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                        title={language === 'th' ? 'ลบรายการวินิจฉัยหลัก' : 'Remove Primary Diagnosis'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  secondaryDiags.length > 0 && (
                    <div className="px-4 py-3 bg-red-50 text-xs font-bold text-red-800 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                      <span>{language === 'th' ? 'ยังไม่มีการวินิจฉัยหลัก โปรดตั้งโรคใดโรคหนึ่งด้านล่างเป็นโรคหลัก' : 'Missing Primary Diagnosis! Please set one of the diagnoses below as Primary.'}</span>
                    </div>
                  )
                )}

                {/* SECONDARY DIAGNOSIS ROWS */}
                {secondaryDiags.map((diag, index) => (
                  <div
                    key={diag.code + '-' + index}
                    className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 bg-white hover:bg-slate-50/80 transition-colors"
                  >
                    {/* เลขลำดับเริ่มที่ 2 เพราะโรคหลักคือลำดับที่ 1 เสมอ
                        ให้เลขบนจอตรงกับลำดับที่บันทึกลงเวชระเบียนจริง */}
                    <span className="w-7 h-7 shrink-0 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-xs font-bold flex items-center justify-center">
                      {index + 2}
                    </span>

                    <span className="shrink-0 text-xs font-mono font-bold text-slate-800 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
                      {diag.code}
                    </span>

                    {editingDiagTarget === index ? (
                      <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                        <input
                          type="text"
                          value={editDiagText}
                          onChange={(e) => setEditDiagText(e.target.value)}
                          className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 focus:outline-hidden transition-all"
                        />
                        <button
                          type="button"
                          onClick={saveEditDiagnosis}
                          className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-xl cursor-pointer shrink-0"
                        >
                          {language === 'th' ? 'บันทึก' : 'Save'}
                        </button>
                      </div>
                    ) : (
                      <div className="flex-1 min-w-[220px]">
                        <p className="text-sm font-semibold text-slate-800 leading-snug">
                          {diag.name} {diag.localName ? `(${diag.localName})` : ''}
                        </p>
                        <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
                          {language === 'th' ? 'การวินิจฉัยร่วม' : 'Secondary'}
                        </p>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 ml-auto shrink-0">
                      {/* ปุ่มเลื่อนลำดับ ซ่อนเมื่อมีโรคร่วมแค่รายการเดียว
                          เพราะกดแล้วไม่มีอะไรเกิดขึ้น มีไว้ก็รกเปล่าๆ */}
                      {secondaryDiags.length > 1 && (
                        <div className="flex items-center border border-slate-200 rounded-lg bg-white overflow-hidden mr-1">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => handleMoveSecondaryUp(index)}
                            className="p-1 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent text-slate-600 cursor-pointer"
                            title={language === 'th' ? 'เลื่อนขึ้น' : 'Move Up'}
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={index === secondaryDiags.length - 1}
                            onClick={() => handleMoveSecondaryDown(index)}
                            className="p-1 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent text-slate-600 cursor-pointer border-l border-slate-200"
                            title={language === 'th' ? 'เลื่อนลง' : 'Move Down'}
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => handlePromoteToPrimary(index)}
                        className="px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 hover:border-blue-300 rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap"
                      >
                        {language === 'th' ? 'ตั้งเป็นโรคหลัก' : 'Set as Primary'}
                      </button>

                      <button
                        type="button"
                        onClick={() => startEditDiagnosis(index, diag.name)}
                        className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3" /> {language === 'th' ? 'แก้ไข' : 'Edit'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemoveSecondary(index)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                        title={language === 'th' ? 'ลบรายการ' : 'Remove Diagnosis'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              )}
            </div>


          </div>
        )}

        {/* TAB 3: PRESCRIPTION (PHARMACY ORDERS) */}
        {activeTab === 'prescription' && (
          <div className="p-6 space-y-6">
            {/* Add New Medicine Form */}
            <div id={EXAM_ANCHOR.prescription} className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4 scroll-mt-28">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>{language === 'th' ? 'ค้นหาและสั่งจ่ายยา' : 'Search & Prescribe Medicine'}</span>

                {/* ไอคอนอยู่หลังข้อความ เหมือนหัวข้ออื่นในหน้านี้
                    วงกลมสีเขียวรองหลังเครื่องหมายบวก เพราะ + ลอยๆ
                    ดูเหมือนสัญลักษณ์ที่ค้างมาจากที่อื่น พอมีวงกลมรอง
                    จะอ่านออกทันทีว่าเป็นไอคอน "เพิ่มรายการ" */}
                <span className="w-5 h-5 shrink-0 rounded-full bg-emerald-500 flex items-center justify-center">
                  <Plus className="w-3 h-3 text-white" strokeWidth={3.5} />
                </span>
              </h3>

              {/* Medicine Selector & Search */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2 relative" ref={medDropdownRef}>
                  <label className="text-[13px] font-bold text-slate-700 block mb-1">
                    {language === 'th' ? 'เลือก / ค้นหารายการยา * (พิมพ์ค้นหา หรือ เลือกจากรายการ)' : 'Select / Search Medicine *'}
                  </label>
                  
                  <div className="group relative flex items-center">
                    <Search className="w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors absolute left-3 pointer-events-none" />
                    <input
                      type="text"
                      value={medSearch}
                      onFocus={() => setIsMedDropdownOpen(true)}
                      onChange={(e) => {
                        const val = e.target.value;
                        setMedSearch(val);
                        setIsMedDropdownOpen(true);
                        handleSelectMedicine(val);
                      }}
                      placeholder={language === 'th' ? 'พิมพ์ค้นหาชื่อยา เช่น Paracetamol, Amoxicillin หรือคลิกเลือก...' : 'Search medicine e.g., Paracetamol, Amoxicillin or click to select...'}
                      className="w-full pl-9 pr-16 py-2.5 bg-slate-50/80 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 focus:outline-hidden shadow-inner transition-all"
                    />

                    <div className="absolute right-2 flex items-center gap-1">
                      {medSearch && (
                        <button
                          type="button"
                          onClick={() => {
                            handleSelectMedicine('');
                            setIsMedDropdownOpen(true);
                          }}
                          className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                          title={language === 'th' ? 'ล้างคำค้นหา' : 'Clear search'}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsMedDropdownOpen(!isMedDropdownOpen)}
                        className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                        title={language === 'th' ? 'แสดงรายการยาบ่อย' : 'Show frequent medicines'}
                      >
                        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isMedDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {/* Auto-suggest Popover Dropdown */}
                  {isMedDropdownOpen && (
                    <div className="absolute z-50 left-0 right-0 mt-1.5 max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl divide-y divide-slate-100 animate-in fade-in duration-150">
                      <div className="px-3 py-1.5 bg-slate-50 text-[11px] font-bold text-slate-500 tracking-wider uppercase flex justify-between items-center">
                        <span>
                          {!medSearch.trim()
                            ? (language === 'th' ? 'รายการยาโรงพยาบาล / ยาที่สั่งจ่ายบ่อย' : 'Hospital Formulary / Frequently Prescribed')
                            : (language === 'th' ? `ผลการค้นหา (${filteredMedicines.length} รายการ)` : `Search Results (${filteredMedicines.length})`)}
                        </span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          {language === 'th' ? 'คลิกเพื่อเลือก' : 'Click to select'}
                        </span>
                      </div>

                      {filteredMedicines.length > 0 ? (
                        filteredMedicines.map((med, idx) => {
                          const isSelected = newMedName.toLowerCase() === (med.name || '').toLowerCase();
                          return (
                            <button
                              key={med.code || med.id || idx}
                              type="button"
                              onClick={() => {
                                handleSelectMedicine(med.name);
                                setIsMedDropdownOpen(false);
                              }}
                              className={`w-full text-left px-3.5 py-2.5 hover:bg-blue-50/80 transition-colors flex items-center justify-between group ${
                                isSelected ? 'bg-blue-50 text-blue-900 font-semibold' : 'text-slate-700'
                              }`}
                            >
                              <div>
                                <div className="text-xs sm:text-sm font-semibold group-hover:text-blue-700 flex items-center gap-1.5 flex-wrap">
                                  {med.code && (
                                    <span className="font-mono text-[10.5px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md border border-slate-200">
                                      {med.code}
                                    </span>
                                  )}
                                  <span>{med.name}</span>
                                  {isSelected && <Check className="w-3.5 h-3.5 text-blue-600" />}
                                </div>
                                <div className="text-[11px] text-slate-500 group-hover:text-blue-600 flex items-center gap-2 mt-0.5">
                                  {med.genericName && <span>{med.genericName}</span>}
                                  {med.category && <span className="text-slate-400">• {med.category}</span>}
                                </div>
                              </div>
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-700 transition-colors shrink-0 ml-2">
                                {language === 'th' ? 'เลือกยา' : 'Select'}
                              </span>
                            </button>
                          );
                        })
                      ) : (
                        <div className="p-4 text-center text-xs text-slate-500">
                          {language === 'th'
                            ? `ไม่พบยาที่ตรงกับ "${medSearch}" ในระบบคลังยา`
                            : `No medicine matching "${medSearch}" found`}
                          {/* ปุ่ม "ใช้ชื่อตามที่พิมพ์" ใช้ได้เฉพาะตอนที่โหลดคลังยาไม่สำเร็จ
                              ถ้าคลังยาโหลดได้แล้วแต่ไม่พบยาตัวนี้ แปลว่าห้องยาไม่มียานี้จริงๆ
                              การปล่อยให้สั่งต่อไปคือการสั่งยาที่จ่ายไม่ได้ ต้องบอกให้ไปคุยกับห้องยาแทน */}
                          {requireStockMedicine ? (
                            <div className="mt-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed">
                              {language === 'th'
                                ? 'สั่งได้เฉพาะยาที่มีอยู่ในคลังของห้องยา หากต้องใช้ยาตัวนี้จริง ให้แจ้งห้องยาเพิ่มเข้าคลังก่อน'
                                : 'Only medicines available in the pharmacy stock can be prescribed. Ask the pharmacy to add this medicine first.'}
                            </div>
                          ) : (
                            <div className="mt-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setIsMedDropdownOpen(false);
                                }}
                                className="text-xs text-blue-600 hover:underline font-semibold"
                              >
                                {language === 'th' ? `ใช้ชื่อยา "${medSearch}" ตามที่พิมพ์` : `Use "${medSearch}" as custom drug name`}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* สถานะการจับคู่ยากับคลัง
                      บอกให้เห็นทันทีว่าสิ่งที่อยู่ในช่องตอนนี้ตรงกับยาในคลังแล้วหรือยัง
                      ไม่ต้องรอไปเจอตอนกดปุ่มแล้วกดไม่ได้โดยไม่รู้สาเหตุ */}
                  {hasStockMedicine ? (
                    <p className="mt-1.5 text-[11px] text-emerald-700 flex items-center gap-1.5">
                      <Check className="w-3 h-3 shrink-0" />
                      <span>
                        {language === 'th' ? 'ตรงกับยาในคลัง' : 'Matched to pharmacy stock'}
                        {selectedMedicine?.code ? ` (${selectedMedicine.code})` : ''}
                      </span>
                    </p>
                  ) : requireStockMedicine && newMedName.trim() ? (
                    <p className="mt-1.5 text-[11px] text-amber-700">
                      {language === 'th'
                        ? 'ยังไม่ได้เลือกยาจากคลัง คลิกเลือกจากรายการด้านบนก่อนจึงจะเพิ่มได้'
                        : 'Not selected from stock yet. Pick one from the list above to continue.'}
                    </p>
                  ) : null}
                </div>

                <div>
                  <label className="text-[13px] font-bold text-slate-700 block mb-1">
                    {language === 'th' ? 'ขนาดการใช้ยา' : 'Dosage'}
                  </label>
                  <select
                    value={newMedDosage}
                    onChange={(e) => setNewMedDosage(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 focus:outline-hidden text-slate-700 cursor-pointer"
                  >
                    <option value="">-- {language === 'th' ? 'เลือกขนาดการใช้' : 'Select Dosage'} --</option>
                    <option value={language === 'th' ? '1 เม็ด' : '1 tablet'}>{language === 'th' ? '1 เม็ด' : '1 tablet'}</option>
                    <option value={language === 'th' ? '2 เม็ด' : '2 tablets'}>{language === 'th' ? '2 เม็ด' : '2 tablets'}</option>
                    <option value={language === 'th' ? '1/2 เม็ด' : '1/2 tablet'}>{language === 'th' ? '1/2 เม็ด' : '1/2 tablet'}</option>
                    <option value={language === 'th' ? '1 แคปซูล' : '1 capsule'}>{language === 'th' ? '1 แคปซูล' : '1 capsule'}</option>
                    <option value={language === 'th' ? '2 แคปซูล' : '2 capsules'}>{language === 'th' ? '2 แคปซูล' : '2 capsules'}</option>
                    <option value={language === 'th' ? '10 มล.' : '10 ml'}>{language === 'th' ? '10 มล.' : '10 ml'}</option>
                    <option value={language === 'th' ? '1 ซอง' : '1 sachet'}>{language === 'th' ? '1 ซอง' : '1 sachet'}</option>
                    <option value={language === 'th' ? '2 พ่นสูด' : '2 puffs'}>{language === 'th' ? '2 พ่นสูด' : '2 puffs'}</option>
                    {newMedDosage && ![
                      '1 เม็ด', '1 tablet', '2 เม็ด', '2 tablets', '1/2 เม็ด', '1/2 tablet',
                      '1 แคปซูล', '1 capsule', '2 แคปซูล', '2 capsules', '10 มล.', '10 ml',
                      '1 ซอง', '1 sachet', '2 พ่นสูด', '2 puffs'
                    ].includes(newMedDosage) && (
                      <option value={newMedDosage}>{newMedDosage}</option>
                    )}
                  </select>
                </div>
              </div>

              {/* Dosage Details Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    {language === 'th' ? 'ความถี่' : 'Frequency'}
                  </label>
                  <select
                    value={newMedFreq}
                    onChange={(e) => setNewMedFreq(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-medium cursor-pointer focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 focus:outline-hidden transition-all"
                  >
                    <option value="">-- {language === 'th' ? 'เลือกความถี่' : 'Select Frequency'} --</option>
                    <option value={language === 'th' ? 'วันละ 3 ครั้ง' : '3 times daily'}>{language === 'th' ? 'วันละ 3 ครั้ง' : '3 times daily'}</option>
                    <option value={language === 'th' ? 'ทุก 6 ชั่วโมง' : 'Every 6 hours'}>{language === 'th' ? 'ทุก 6 ชั่วโมง' : 'Every 6 hours'}</option>
                    <option value={language === 'th' ? 'วันละ 1 ครั้ง' : 'Once daily'}>{language === 'th' ? 'วันละ 1 ครั้ง' : 'Once daily'}</option>
                    <option value={language === 'th' ? 'วันละ 2 ครั้ง' : 'Twice daily'}>{language === 'th' ? 'วันละ 2 ครั้ง' : 'Twice daily'}</option>
                    <option value={language === 'th' ? 'วันละ 4 ครั้ง' : '4 times daily'}>{language === 'th' ? 'วันละ 4 ครั้ง' : '4 times daily'}</option>
                    <option value={language === 'th' ? 'ก่อนนอน' : 'At bedtime'}>{language === 'th' ? 'ก่อนนอน' : 'At bedtime'}</option>
                    <option value={language === 'th' ? 'เมื่อมีอาการ' : 'As Needed'}>{language === 'th' ? 'เมื่อมีอาการ' : 'As Needed'}</option>
                    {newMedFreq && ![
                      'วันละ 3 ครั้ง', '3 times daily', 'ทุก 6 ชั่วโมง', 'Every 6 hours',
                      'วันละ 1 ครั้ง', 'Once daily', 'วันละ 2 ครั้ง', 'Twice daily',
                      'วันละ 4 ครั้ง', '4 times daily', 'ก่อนนอน', 'At bedtime', 'เมื่อมีอาการ', 'As Needed'
                    ].includes(newMedFreq) && (
                      <option value={newMedFreq}>{newMedFreq}</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    {language === 'th' ? 'ระยะเวลา' : 'Duration'}
                  </label>
                  <select
                    value={newMedDuration}
                    onChange={(e) => setNewMedDuration(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-medium cursor-pointer focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 focus:outline-hidden transition-all"
                  >
                    <option value="">-- {language === 'th' ? 'เลือกระยะเวลา' : 'Select Duration'} --</option>
                    <option value={language === 'th' ? '3 วัน' : '3 days'}>{language === 'th' ? '3 วัน' : '3 days'}</option>
                    <option value={language === 'th' ? '5 วัน' : '5 days'}>{language === 'th' ? '5 วัน' : '5 days'}</option>
                    <option value={language === 'th' ? '7 วัน' : '7 days'}>{language === 'th' ? '7 วัน' : '7 days'}</option>
                    <option value={language === 'th' ? '10 วัน' : '10 days'}>{language === 'th' ? '10 days' : '10 days'}</option>
                    <option value={language === 'th' ? '14 วัน' : '14 days'}>{language === 'th' ? '14 วัน' : '14 days'}</option>
                    <option value={language === 'th' ? '21 วัน' : '21 days'}>{language === 'th' ? '21 วัน' : '21 days'}</option>
                    <option value={language === 'th' ? '30 วัน' : '30 days'}>{language === 'th' ? '30 วัน' : '30 days'}</option>
                    <option value={language === 'th' ? '60 วัน' : '60 days'}>{language === 'th' ? '60 วัน' : '60 days'}</option>
                    <option value={language === 'th' ? '90 วัน' : '90 days'}>{language === 'th' ? '90 วัน' : '90 days'}</option>
                    {newMedDuration && ![
                      '3 วัน', '3 days', '5 วัน', '5 days', '7 วัน', '7 days',
                      '10 วัน', '10 days', '14 วัน', '14 days', '21 วัน', '21 days',
                      '30 วัน', '30 days', '60 วัน', '60 days', '90 วัน', '90 days'
                    ].includes(newMedDuration) && (
                      <option value={newMedDuration}>{newMedDuration}</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    {language === 'th' ? 'จำนวน' : 'Quantity'}
                  </label>
                  <select
                    value={String(newMedQty)}
                    onChange={(e) => setNewMedQty(e.target.value === '' ? '' : (isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value)) as any)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-medium cursor-pointer font-mono focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 focus:outline-hidden transition-all"
                  >
                    <option value="">-- {language === 'th' ? 'เลือกจำนวน' : 'Select Qty'} --</option>
                    <option value="1">1</option>
                    <option value="5">5</option>
                    <option value="10">10</option>
                    <option value="12">12</option>
                    <option value="14">14</option>
                    <option value="15">15</option>
                    <option value="20">20</option>
                    <option value="21">21</option>
                    <option value="28">28</option>
                    <option value="30">30</option>
                    <option value="60">60</option>
                    <option value="90">90</option>
                    <option value="100">100</option>
                    {newMedQty !== '' && ![
                      '1', '5', '10', '12', '14', '15', '20', '21', '28', '30', '60', '90', '100'
                    ].includes(String(newMedQty)) && (
                      <option value={String(newMedQty)}>{newMedQty}</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    {language === 'th' ? 'ทางให้ยา' : 'Route'}
                  </label>
                  <select
                    value={newMedRoute}
                    onChange={(e) => setNewMedRoute(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-medium cursor-pointer focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 focus:outline-hidden transition-all"
                  >
                    <option value="">-- {language === 'th' ? 'เลือกทางให้ยา' : 'Select Route'} --</option>
                    <option value={language === 'th' ? 'รับประทาน' : 'Oral'}>{language === 'th' ? 'รับประทาน' : 'Oral'}</option>
                    <option value={language === 'th' ? 'ทาภายนอก' : 'Topical'}>{language === 'th' ? 'ทาภายนอก' : 'Topical'}</option>
                    <option value={language === 'th' ? 'พ่นสูด' : 'Inhalation'}>{language === 'th' ? 'พ่นสูด' : 'Inhalation'}</option>
                    <option value={language === 'th' ? 'อมใต้ลิ้น' : 'Sublingual'}>{language === 'th' ? 'อมใต้ลิ้น' : 'Sublingual'}</option>
                    <option value={language === 'th' ? 'หยอดตา' : 'Eye drop'}>{language === 'th' ? 'หยอดตา' : 'Eye drop'}</option>
                    <option value={language === 'th' ? 'หยอดหู' : 'Ear drop'}>{language === 'th' ? 'หยอดหู' : 'Ear drop'}</option>
                    <option value={language === 'th' ? 'ฉีด' : 'Injection'}>{language === 'th' ? 'ฉีด' : 'Injection'}</option>
                    {newMedRoute && ![
                      'รับประทาน', 'Oral', 'ทาภายนอก', 'Topical', 'พ่นสูด', 'Inhalation',
                      'อมใต้ลิ้น', 'Sublingual', 'หยอดตา', 'Eye drop', 'หยอดหู', 'Ear drop', 'ฉีด', 'Injection'
                    ].includes(newMedRoute) && (
                      <option value={newMedRoute}>{newMedRoute}</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    {language === 'th' ? 'เวลารับประทาน' : 'Meal Timing'}
                  </label>
                  <select
                    value={newMedTiming}
                    onChange={(e) => setNewMedTiming(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-medium cursor-pointer focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 focus:outline-hidden transition-all"
                  >
                    <option value="">-- {language === 'th' ? 'เลือกเวลารับประทาน' : 'Select Meal Timing'} --</option>
                    <option value={language === 'th' ? 'หลังอาหาร' : 'After Meal'}>{language === 'th' ? 'หลังอาหาร' : 'After Meal'}</option>
                    <option value={language === 'th' ? 'ก่อนอาหาร' : 'Before Meal'}>{language === 'th' ? 'ก่อนอาหาร' : 'Before Meal'}</option>
                    <option value={language === 'th' ? 'พร้อมอาหาร' : 'With Meal'}>{language === 'th' ? 'พร้อมอาหาร' : 'With Meal'}</option>
                    <option value={language === 'th' ? 'ก่อนนอน' : 'Before Bed'}>{language === 'th' ? 'ก่อนนอน' : 'Before Bed'}</option>
                    <option value={language === 'th' ? 'เมื่อมีอาการ' : 'As Needed'}>{language === 'th' ? 'เมื่อมีอาการ' : 'As Needed'}</option>
                    {newMedTiming && ![
                      'หลังอาหาร', 'After Meal', 'ก่อนอาหาร', 'Before Meal',
                      'พร้อมอาหาร', 'With Meal', 'ก่อนนอน', 'Before Bed', 'เมื่อมีอาการ', 'As Needed'
                    ].includes(newMedTiming) && (
                      <option value={newMedTiming}>{newMedTiming}</option>
                    )}
                  </select>
                </div>

                <div className="flex items-end">
                  {/* ปุ่มถูกล็อกไว้จนกว่าจะเลือกยาจากคลังจริง (ดู canAddPrescription)
                      title บอกเหตุผลตอนเอาเมาส์ไปชี้ เพราะปุ่มที่กดไม่ได้เฉยๆ ทำให้งง */}
                  <button
                    type="button"
                    onClick={handleAddPrescription}
                    disabled={!canAddPrescription}
                    title={
                      canAddPrescription
                        ? undefined
                        : language === 'th'
                          ? 'ต้องเลือกยาจากรายการในคลังก่อน'
                          : 'Select a medicine from the stock list first'
                    }
                    className={`w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 whitespace-nowrap transition-all ${
                      canAddPrescription
                        ? 'bg-[#2563eb] hover:bg-blue-700 text-white shadow-xs hover:shadow-md active:scale-95 cursor-pointer'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <Plus className="w-4 h-4 shrink-0" />
                    <span>{language === 'th' ? 'เพิ่มรายการสั่งยา' : 'Add to Order'}</span>
                  </button>
                </div>
              </div>

              {/* Special Instructions */}
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  {language === 'th' ? 'คำแนะนำพิเศษ / ฉลากยา (อัตโนมัติตามมาตรฐาน รพ.)' : 'Special Instructions / Label Note'}
                </label>
                <input
                  type="text"
                  value={newMedInstructions}
                  onChange={(e) => setNewMedInstructions(e.target.value)}
                  placeholder={language === 'th' ? 'คำแนะนำพิเศษเพิ่มเติม...' : 'Special instructions for pharmacy label...'}
                  className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 focus:outline-hidden transition-all"
                />
              </div>
            </div>

            {/* Prescribed Medicines List Table */}
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900">
                {language === 'th' ? 'รายการสั่งยาปัจจุบัน' : 'Active Prescriptions List'}
              </h3>

              {prescriptions.length === 0 ? (
                <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs">
                  {language === 'th' ? 'ยังไม่มีรายการสั่งยา เลือกรายการยาด้านบนเพื่อเพิ่ม' : 'No active prescriptions order. Select medicine above to add.'}
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 font-bold text-slate-600 uppercase">
                        <th className="p-3">{language === 'th' ? 'ชื่อยา' : 'Medicine'}</th>
                        <th className="p-3">{language === 'th' ? 'ขนาดและวิธีใช้' : 'Dosage & Frequency'}</th>
                        <th className="p-3">{language === 'th' ? 'ระยะเวลา' : 'Duration'}</th>
                        <th className="p-3">{language === 'th' ? 'จำนวน' : 'Quantity'}</th>
                        <th className="p-3">{language === 'th' ? 'เวลารับประทาน' : 'Timing'}</th>
                        <th className="p-3 text-right">{language === 'th' ? 'การจัดการ' : 'Actions'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {prescriptions.map((p) => {
                        /* ยาที่ชนประวัติแพ้ต้องเห็นได้ทันทีที่เพิ่มเข้ามา
                           ไม่ใช่รอไปโผล่ตอนกดบันทึกอย่างเดียว เพราะกว่าจะถึงตอนนั้น
                           แพทย์กรอกอย่างอื่นต่อไปหมดแล้ว การย้อนกลับมาแก้เสียเวลากว่า */
                        const conflict = conflictByMedicine.get(p.medicineName);

                        return (
                        <tr
                          key={p.id}
                          className={
                            conflict === 'exact'
                              ? 'bg-red-50 hover:bg-red-100/70'
                              : conflict === 'group'
                                ? 'bg-amber-50 hover:bg-amber-100/70'
                                : 'hover:bg-slate-50'
                          }
                        >
                          <td className="p-3 font-bold text-slate-900">
                            <div className="flex items-center gap-2">
                              <span>{p.medicineName}</span>
                              {conflict && (
                                <span
                                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border whitespace-nowrap ${
                                    conflict === 'exact'
                                      ? 'bg-red-100 text-red-800 border-red-300'
                                      : 'bg-amber-100 text-amber-900 border-amber-300'
                                  }`}
                                  title={allergyConflicts
                                    .filter((c) => c.medicineName === p.medicineName)
                                    .map((c) => describeConflict(c, language))
                                    .join('\n')}
                                >
                                  {conflict === 'exact'
                                    ? (language === 'th' ? 'ผู้ป่วยแพ้ยานี้' : 'ALLERGY')
                                    : (language === 'th' ? 'กลุ่มเดียวกับที่แพ้' : 'SAME CLASS')}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-slate-700">{p.dosage} • {p.frequency}</td>
                          <td className="p-3 text-slate-600">{p.duration}</td>
                          <td className="p-3 font-mono font-bold text-slate-800">{p.quantity}</td>
                          <td className="p-3">
                            <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium">
                              {p.timing}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => setPrescriptions(prescriptions.filter(x => x.id !== p.id))}
                              className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50 cursor-pointer"
                              title={language === 'th' ? 'ลบรายการยา' : 'Delete prescription'}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: DOCUMENTS & REFERRAL */}
        {activeTab === 'referral' && (
          <div className="p-6 space-y-6">
            {/* ============================================================
                เอกสารทั่วไป
                ============================================================
                ขั้นตอนคือ ติ๊กว่าต้องการ -> ระบุจำนวน -> กดพิมพ์
                ปุ่มพิมพ์ถูกปิดไว้จนกว่าจะติ๊ก เพื่อกันการพิมพ์เอกสารที่ไม่ได้ตั้งใจ
                ซึ่งเป็นเอกสารที่มีผลทางกฎหมาย ไม่ควรออกโดยพลาดกดปุ่ม

                ช่องส่งต่อผู้ป่วยและคำแนะนำถูกถอด UI ออกตามที่สั่ง
                แต่ตัวแปร refDept / refReason / counselMed / counselLifestyle
                ยังคงไว้ เพื่อส่งค่าเดิมกลับตอนบันทึก ข้อมูลเก่าจะได้ไม่ถูกล้าง
                ============================================================ */}
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>{language === 'th' ? 'เอกสารทั่วไป' : 'General Documents'}</span>
                <FileText className="w-4 h-4 text-blue-600" />
              </h3>

              <p className="text-xs text-slate-500 -mt-1">
                {language === 'th'
                  ? 'เลือกเอกสารที่ต้องการออกให้ผู้ป่วย ระบุจำนวนฉบับ แล้วจึงกดพิมพ์ (บันทึกลงเวชระเบียนเมื่อกดบันทึกการตรวจ)'
                  : 'Select the documents to issue, set the number of copies, then print. Saved with the examination record.'}
              </p>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                <DocumentRequestCard
                  label={language === 'th' ? 'ใบรับรองแพทย์' : 'Medical Certificate'}
                  checked={wantMedicalCert}
                  onCheckedChange={setWantMedicalCert}
                  quantity={medicalCertQty}
                  onQuantityChange={setMedicalCertQty}
                  onPrint={() => printClinicDocument('medical-certificate', medicalCertQty)}
                  printedAt={medicalCertPrintedAt}
                  language={language}
                />

                <DocumentRequestCard
                  label={language === 'th' ? 'ใบรับรองยานอกบัญชี' : 'Non-Formulary Drug Certificate'}
                  checked={wantNonFormularyCert}
                  onCheckedChange={setWantNonFormularyCert}
                  quantity={nonFormularyQty}
                  onQuantityChange={setNonFormularyQty}
                  onPrint={() => printClinicDocument('non-formulary', nonFormularyQty)}
                  printedAt={nonFormularyPrintedAt}
                  language={language}
                />
              </div>
            </div>

            {/* ============================================================
                เอกสารอื่นๆ
                ============================================================
                กลุ่มนี้ติ๊กอย่างเดียว ไม่มีจำนวนและไม่มีปุ่มพิมพ์
                เพราะยังไม่มีแบบฟอร์มมาตรฐานในระบบ แพทย์ใช้ฟอร์มกระดาษของคลินิก
                การติ๊กคือการบันทึกลงเวชระเบียนว่าออกเอกสารอะไรให้ผู้ป่วยไปบ้าง
                ซึ่งจำเป็นเวลาผู้ป่วยกลับมาถามภายหลังว่าเคยได้ใบอะไรไปแล้ว
                ============================================================ */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>{language === 'th' ? 'เอกสารอื่นๆ' : 'Other Documents'}</span>
                <FileSpreadsheet className="w-4 h-4 text-slate-600" />
              </h3>

              <p className="text-xs text-slate-500 -mt-1">
                {language === 'th'
                  ? 'ติ๊กเพื่อบันทึกว่าออกเอกสารนี้ให้ผู้ป่วยแล้ว (ยังไม่มีแบบฟอร์มพิมพ์ในระบบ)'
                  : 'Tick to record that this document was issued (no printable form in the system yet).'}
              </p>

              <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                <DocumentCheckRow
                  label={language === 'th' ? 'ใบเคลมประกัน' : 'Insurance Claim Form'}
                  checked={wantInsuranceClaim}
                  onCheckedChange={setWantInsuranceClaim}
                />

                <DocumentCheckRow
                  label={language === 'th' ? 'ใบรับรองความเห็นแพทย์เพื่อการส่งต่อ' : "Physician's Referral Opinion"}
                  checked={wantReferralOpinion}
                  onCheckedChange={setWantReferralOpinion}
                />

                <DocumentCheckRow
                  label={language === 'th' ? 'ใบรักษาโรคฟันและโรคเหงือก' : 'Dental & Periodontal Treatment Form'}
                  checked={wantDental}
                  onCheckedChange={setWantDental}
                />

                {/* ช่องสุดท้าย ติ๊กแล้วพิมพ์ชื่อเอกสารเอง
                    มีไว้เพราะเอกสารที่คลินิกออกจริงมีมากกว่าที่ลิสต์ไว้
                    ถ้าไม่มีช่องนี้ แพทย์จะไม่บันทึกเลย แล้วประวัติก็ขาดไป */}
                <div className="space-y-2">
                  <DocumentCheckRow
                    label={language === 'th' ? 'อื่นๆ (ระบุชื่อเอกสาร)' : 'Other (specify)'}
                    checked={wantOtherDoc}
                    onCheckedChange={setWantOtherDoc}
                  />

                  {wantOtherDoc && (
                    <div className="pl-6.5">
                      <input
                        type="text"
                        value={otherDocName}
                        onChange={(e) => setOtherDocName(e.target.value)}
                        placeholder={language === 'th' ? 'พิมพ์ชื่อเอกสาร' : 'Document name'}
                        className="w-full max-w-md h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 focus:outline-hidden transition-all"
                      />
                      {/* ติ๊กแล้วแต่ยังไม่พิมพ์ชื่อ = บันทึกไปก็ไม่รู้ว่าเอกสารอะไร
                          บอกให้รู้ตรงนี้เลย ดีกว่าปล่อยให้กดบันทึกแล้วข้อมูลหายเงียบๆ */}
                      {otherDocName.trim() === '' && (
                        <p className="text-[11px] text-amber-700 mt-1">
                          {language === 'th'
                            ? 'ต้องระบุชื่อเอกสาร ไม่งั้นจะไม่ถูกบันทึก'
                            : 'Enter a document name, otherwise it will not be saved.'}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: FOLLOW-UP & VISIT ACTIONS */}
        {activeTab === 'followup' && (
          <div className="p-6 space-y-6">
            {/* Follow-up Scheduler
                เอากรอบการ์ดออก และย้ายไอคอนไปหลังข้อความ
                ให้หน้าตาตรงกับหัวข้ออื่นในหน้านี้ (สัญญาณชีพ / เอกสารทั่วไป / สถานะ) */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span>{language === 'th' ? 'การนัดหมายติดตามอาการครั้งถัดไป' : 'Schedule Next Follow-Up Visit'}</span>
                  <Calendar className="w-4 h-4 text-blue-600" />
                </h3>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer bg-white px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 self-start sm:self-auto shadow-2xs">
                  <input
                    type="checkbox"
                    checked={hasFollowUp}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setHasFollowUp(checked);
                      if (checked && !followUpDate) {
                        const nextWeek = new Date();
                        nextWeek.setDate(nextWeek.getDate() + 7);
                        setFollowUpDate(nextWeek.toISOString().split('T')[0]);
                      }
                    }}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span>{language === 'th' ? 'ต้องการนัดหมายติดตามอาการ' : 'Schedule a follow-up appointment'}</span>
                </label>
              </div>

              {!hasFollowUp ? (
                <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-500 text-xs text-center font-medium">
                  {language === 'th' ? 'ไม่มีการนัดหมายติดตามอาการสำหรับเคสนี้ (หากต้องการนัดหมาย ให้ทำเครื่องหมายเลือก "ต้องการนัดหมายติดตามอาการ")' : 'No follow-up appointment scheduled for this visit. Check "Schedule a follow-up appointment" if required.'}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">
                      {language === 'th' ? 'วันนัดติดตามอาการ' : 'Follow-Up Date'}
                    </label>
                    <input
                      type="date"
                      value={followUpDate}
                      onChange={(e) => setFollowUpDate(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 focus:outline-hidden transition-all"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">
                      {language === 'th' ? 'เหตุผลในการนัดหมาย' : 'Reason for Follow-Up'}
                    </label>
                    <input
                      type="text"
                      value={followUpReason}
                      onChange={(e) => setFollowUpReason(e.target.value)}
                      placeholder={language === 'th' ? 'ระบุเหตุผลในการนัดหมาย' : 'Enter reason for follow-up'}
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 focus:outline-hidden transition-all"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">
                      {language === 'th' ? 'คำแนะนำเพิ่มเติมสำหรับผู้ป่วย' : 'Patient Instructions'}
                    </label>
                    <input
                      type="text"
                      value={followUpInstructions}
                      onChange={(e) => setFollowUpInstructions(e.target.value)}
                      placeholder={language === 'th' ? 'คำแนะนำการเตรียมตัว' : 'Patient preparation instructions'}
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 focus:outline-hidden transition-all"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ============================================================
                สถานะผู้ป่วยหลังตรวจเสร็จ (Disposition)
                ============================================================
                เลือกได้อย่างเดียว เพราะการมาตรวจหนึ่งครั้งจบได้ทางเดียว
                จะกลับบ้านและถูกส่งต่อพร้อมกันไม่ได้

                วางไว้ก่อนปุ่มบันทึก เพราะเป็นสิ่งสุดท้ายที่แพทย์ตัดสินใจ
                ก่อนปิดการตรวจ และเป็นข้อมูลที่ห้องยา/การเงินต้องรู้ต่อ
                ============================================================ */}
            <div className="space-y-3 pt-2">
              {/* หัวข้อขึ้นบรรทัดของตัวเอง ตัวเลือกอยู่บรรทัดล่าง
                  ให้โครงเหมือนหัวข้ออื่นในหน้านี้ ไม่ใช่หัวข้อเดียวที่วางเรียงแนวนอน */}
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>{language === 'th' ? 'สถานะ' : 'Disposition'}</span>
                <Send className="w-4 h-4 text-blue-600" />
              </h3>

              {/* กรอบและการเรียงลงล่าง ทำให้เหมือนกลุ่ม "เอกสารอื่นๆ" ในแท็บก่อนหน้า
                  ผู้ใช้จะได้ไม่ต้องเรียนรู้รูปแบบใหม่ในแต่ละหน้า */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                {/* ใช้ช่องติ๊กหน้าตาเหมือนกลุ่มเอกสาร แต่เลือกได้ทีละอัน
                    ติ๊กอันหนึ่งแล้วอีกอันจะถูกปลดให้เอง
                    เพราะการมาตรวจหนึ่งครั้งจบได้ทางเดียว จะกลับบ้าน
                    และถูกส่งต่อพร้อมกันไม่ได้

                    ที่ไม่ใช้ radio เพราะ radio กดออกไม่ได้เมื่อเลือกไปแล้ว
                    ถ้าแพทย์กดผิดจะติดอยู่กับค่านั้นตลอด ส่วนช่องติ๊กกดซ้ำเพื่อยกเลิกได้ */}
                <DocumentCheckRow
                  label={language === 'th' ? 'กลับบ้าน' : 'Discharge home'}
                  checked={disposition === 'home'}
                  onCheckedChange={(on) => setDisposition(on ? 'home' : '')}
                />

                <DocumentCheckRow
                  label="Refer"
                  checked={disposition === 'refer'}
                  onCheckedChange={(on) => setDisposition(on ? 'refer' : '')}
                />
              </div>
            </div>

            {/* Visit Action Center Buttons */}
            <div className="space-y-3 pt-2">
              <div className="border-b border-slate-100 pb-2">
                {/* จัดกึ่งกลาง เพราะเป็นหัวข้อปิดท้ายของทั้งหน้า
                    ไม่ใช่หัวข้อของช่องกรอกข้อมูลที่ต้องเรียงชิดซ้ายให้อ่านไล่ลงมา */}
                <h3 className="text-lg font-bold text-slate-900 text-center">
                  {/* เดิมชื่อ "สรุปการตรวจและเอกสารออกบริการ" แต่ปุ่มออกเอกสาร
                      ถูกย้ายไปแท็บ "เอกสาร & การส่งต่อ" หมดแล้ว เหลือแต่ปุ่มปิดการตรวจ
                      ชื่อเดิมจึงไม่ตรงกับสิ่งที่อยู่ข้างล่างอีกต่อไป */}
                  {language === 'th' ? 'สรุปการตรวจ' : 'Visit Summary'}
                </h3>
              </div>

              {/* แถวนี้มีแต่ปุ่ม "ยกเลิกการรับบริการ" ไม่มีปุ่มออกเฉยๆ
                  เพราะปุ่ม "กลับสู่หน้าคิวผู้ป่วย" ด้านบนสุดทำหน้าที่นั้นอยู่แล้ว
                  (เรียก handleExitExamination เหมือนกัน คืนคิวเป็น "รอตรวจ")
                  มีสองปุ่มที่ทำงานเหมือนกันคนละที่ ทำให้สับสนโดยไม่ได้อะไรเพิ่ม */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* สีแดงสงวนไว้ให้การกระทำที่เอาผู้ป่วยออกจากคิวจริงเท่านั้น */}
                <button
                  type="button"
                  onClick={handleCancelVisit}
                  className="p-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
                >
                  <XCircle className="w-4 h-4 text-white" />
                  <span>{language === 'th' ? 'ยกเลิกการรับบริการ' : 'Cancel Visit'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="p-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200/70 text-slate-800 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
                >
                  <Save className="w-4 h-4 text-slate-700" />
                  <span>{language === 'th' ? 'บันทึกฉบับร่าง' : 'Save Draft'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleCompleteVisit()}
                  className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm hover:shadow transition-all cursor-pointer"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>{language === 'th' ? 'บันทึกและเสร็จสิ้นการตรวจ' : 'Save & Complete Visit'}</span>
                </button>

                {/* ปุ่ม "ใบรับรองแพทย์" กับ "พิมพ์สรุปการตรวจ" ถูกถอดออก
                    ทั้งสองปุ่มเรียกแค่ alert() ไม่ได้ออกเอกสารอะไรจริง
                    การมีปุ่มที่กดแล้วขึ้นข้อความว่า "ออกเรียบร้อยแล้ว"
                    ทั้งที่ไม่มีเอกสารออกมา อันตรายกว่าการไม่มีปุ่ม
                    เพราะแพทย์อาจเข้าใจว่าออกให้ผู้ป่วยไปแล้ว

                    การออกใบรับรองแพทย์ของจริงอยู่ที่แท็บ "เอกสาร & การส่งต่อ"
                    ซึ่งพิมพ์ออกมาได้จริงและบันทึกลงเวชระเบียนด้วย */}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* History Preview Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-[1200] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-base text-slate-900">
                {showHistoryModal === 'visits'
                  ? (language === 'th' ? 'ประวัติการรับบริการย้อนหลัง' : 'Previous Visit Records')
                  : (language === 'th' ? 'รายงานผลการตรวจทางห้องปฏิบัติการ' : 'Uploaded Diagnostic Reports')}
              </h3>
              <button onClick={() => setShowHistoryModal(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <div className="space-y-2 text-xs text-slate-600">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="font-bold block text-slate-800">
                  {language === 'th' ? 'การรับบริการเมื่อ 10 มิ.ย. 2026 (พญ. อนงค์ ส.)' : 'Visit on 2026-06-10 (Dr. Anong S.)'}
                </span>
                <span>{language === 'th' ? 'การวินิจฉัย: โรคติดเชื้อทางเดินหายใจส่วนบนฉับพลัน' : 'Diagnosis: Acute Upper Respiratory Infection'}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="font-bold block text-slate-800">
                  {language === 'th' ? 'การรับบริการเมื่อ 22 มี.ค. 2026 (พญ. อนงค์ ส.)' : 'Visit on 2026-03-22 (Dr. Anong S.)'}
                </span>
                <span>{language === 'th' ? 'การวินิจฉัย: โรคความดันโลหิตสูงตามนัดประจำ' : 'Diagnosis: Essential Hypertension Routine Follow-Up'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Shared Confirmation Modal — ใช้ร่วมกันทั้งปุ่มยกเลิก / บันทึกฉบับร่าง / บันทึกและเสร็จสิ้น */}
      {confirmDialog && (
        <div
          className="fixed inset-0 z-[1200] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setConfirmDialog(null)}
        >
          {/* แบ่งกล่องเป็น 3 ส่วน หัว / เนื้อหา / ปุ่ม
              เลื่อนเฉพาะส่วนเนื้อหาตรงกลาง ไม่เลื่อนทั้งกล่อง

              เดิมให้ทั้งกล่องเลื่อน แถบเลื่อนจึงไปทาบขอบมนของกล่อง
              ทำให้มุมดูแหว่งและแถบเลื่อนลอยติดขอบขาว
              พอเลื่อนเฉพาะตรงกลาง หัวข้อกับปุ่มยืนยันก็อยู่กับที่ตลอด
              ไม่ต้องเลื่อนกลับขึ้นไปดูว่ากำลังยืนยันอะไรอยู่ */}
          <div
            className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ส่วนหัว อยู่กับที่ */}
            <div className="p-6 pb-4 space-y-5 shrink-0">
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ring-8 shadow-inner ${
                confirmDialog.tone === 'danger'
                  ? 'bg-red-100 text-red-600 ring-red-50'
                  : 'bg-blue-100 text-blue-600 ring-blue-50'
              }`}
            >
              {confirmDialog.tone === 'danger' ? (
                <AlertTriangle className="w-9 h-9 stroke-[2.5]" />
              ) : (
                <Save className="w-9 h-9 stroke-[2.5]" />
              )}
            </div>

            {/* หัวข้อกับประโยคสรุปสั้นๆ จัดกึ่งกลางได้เพราะไม่เกินสองบรรทัด */}
            <div className="space-y-1.5 text-center">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                {confirmDialog.title}
              </h3>
              <p className="text-sm font-medium text-slate-600 leading-relaxed">
                {confirmDialog.message}
              </p>
            </div>

            {/* ข้อมูลผู้ป่วยแยกเป็นการ์ด ใช้รูปแบบเดียวกับกล่องแจ้งผลสำเร็จ
                เพื่อให้แพทย์ยืนยันตัวคนไข้ได้ก่อนกด โดยไม่ต้องอ่านทั้งประโยค */}
            {confirmDialog.patient && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-sm font-bold text-slate-900">
                  {confirmDialog.patient.name}
                </p>
                <p className="text-xs font-mono text-slate-500 mt-1">
                  HN {confirmDialog.patient.hn}
                  {confirmDialog.patient.vn ? `  ·  VN ${confirmDialog.patient.vn}` : ''}
                </p>
              </div>
            )}
            </div>

            {/* ส่วนเนื้อหา เลื่อนได้เฉพาะตรงนี้
                px-6 ให้แถบเลื่อนอยู่ในกรอบขาว ไม่ทาบขอบมนของกล่อง */}
            <div className="px-6 pb-2 space-y-5 flex-1 overflow-y-auto min-h-0">

            {/* สรุปสิ่งที่แพทย์บันทึกไว้ ให้ตรวจทานก่อนกดยืนยัน
                เพราะกดแล้วแก้ย้อนหลังไม่ได้ */}
            {confirmDialog.summary && (
              <div className="rounded-2xl border border-slate-200 divide-y divide-slate-100 text-left overflow-hidden">
                {confirmDialog.summary.map((group) => (
                  <div key={group.section} className="px-4 py-3">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      {group.section}
                    </p>

                    {group.items.length > 0 ? (
                      <ul className="mt-1.5 space-y-1">
                        {group.items.map((item, index) => (
                          <li
                            key={`${group.section}-${index}`}
                            className="text-xs font-semibold text-slate-800 leading-relaxed flex gap-2"
                          >
                            <span className="text-slate-300 shrink-0">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      /* ไม่ซ่อนหัวข้อที่ว่าง เพราะการเห็นว่า "ไม่มี"
                         คือข้อมูลที่ต้องตรวจเหมือนกัน เช่นลืมสั่งยาหรือลืมนัด */
                      <p className="mt-1 text-xs font-normal text-slate-400">
                        {language === 'th' ? '- ไม่มี -' : '- None -'}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {confirmDialog.hint && (
              <div
                className={`rounded-2xl px-4 py-3 flex items-start gap-2.5 text-left border ${
                  confirmDialog.tone === 'danger'
                    ? 'bg-red-50 border-red-100'
                    : 'bg-blue-50 border-blue-100'
                }`}
              >
                <Info
                  className={`w-4 h-4 shrink-0 mt-0.5 ${
                    confirmDialog.tone === 'danger' ? 'text-red-600' : 'text-blue-600'
                  }`}
                />
                <span
                  className={`text-xs font-medium leading-relaxed whitespace-pre-line ${
                    confirmDialog.tone === 'danger' ? 'text-red-900' : 'text-blue-900'
                  }`}
                >
                  {confirmDialog.hint}
                </span>
              </div>
            )}

            {/* เลือกเหตุผล กดปุ่มสำเร็จรูปหรือพิมพ์เองก็ได้
                บังคับให้มีเหตุผลก่อนถึงจะกดยืนยันได้ เพราะถ้าปล่อยให้ข้าม
                สุดท้ายจะไม่มีใครกรอก แล้วฐานข้อมูลก็จะว่างเหมือนเดิม */}
            {confirmDialog.reason && (
              <div className="space-y-2 text-left">
                <label className="text-xs font-bold text-slate-700 block">
                  {confirmDialog.reason.label}
                  <span className="text-red-600"> *</span>
                </label>

                <div className="flex flex-wrap gap-1.5">
                  {confirmDialog.reason.options.map((opt) => {
                    const isActive = confirmReason === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setConfirmReason(isActive ? '' : opt)}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-red-600 border-red-600 text-white'
                            : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50 hover:border-slate-400'
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>

                <input
                  type="text"
                  value={confirmReason}
                  onChange={(e) => setConfirmReason(e.target.value)}
                  placeholder={confirmDialog.reason.placeholder}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:border-red-500 focus:ring-4 focus:ring-red-500/15 focus:outline-hidden transition-all"
                />
              </div>
            )}

            </div>

            {/* แถบปุ่มอยู่กับที่ ไม่เลื่อนหายไปกับเนื้อหา
                เส้นคั่นด้านบนบอกว่าเนื้อหายังมีต่อด้านบนถ้าเลื่อนขึ้น */}
            <div className="p-6 pt-4 shrink-0 border-t border-slate-100 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="w-full py-3 px-4 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-sm font-bold transition-all cursor-pointer"
              >
                {language === 'th' ? 'กลับไปทำต่อ' : 'Keep Working'}
              </button>
              <button
                type="button"
                disabled={!!confirmDialog.reason && !confirmReason.trim()}
                title={
                  !!confirmDialog.reason && !confirmReason.trim()
                    ? (language === 'th' ? 'กรุณาระบุเหตุผลก่อน' : 'Please give a reason first')
                    : undefined
                }
                onClick={() => {
                  const run = confirmDialog.onConfirm;
                  const reason = confirmReason.trim();
                  setConfirmDialog(null);
                  run(reason || undefined);
                }}
                className={`w-full py-3 px-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
                  !!confirmDialog.reason && !confirmReason.trim()
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : confirmDialog.tone === 'danger'
                      ? 'bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-600/20 cursor-pointer'
                      : 'bg-[#2563eb] hover:bg-blue-700 text-white shadow-md shadow-blue-600/20 cursor-pointer'
                }`}
              >
                {confirmDialog.tone === 'danger' ? (
                  <XCircle className="w-4 h-4 shrink-0 stroke-[2.5]" />
                ) : (
                  <Check className="w-4 h-4 shrink-0 stroke-[3]" />
                )}
                <span>{confirmDialog.confirmLabel}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Feedback Modal */}
      {successNotice && successNotice.isOpen && (
        <div className="fixed inset-0 z-[1200] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-slate-100 transform transition-all scale-100">
            {/* Green Checkmark Icon Container */}
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto ring-8 ring-emerald-50 shadow-inner">
              <CheckCircle className="w-10 h-10 stroke-[2.5]" />
            </div>

            {/* หัวข้อกับประโยคสรุปสั้นๆ จัดกึ่งกลางได้เพราะข้อความสั้น */}
            <div className="space-y-1.5 text-center">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                {successNotice.title}
              </h3>
              <p className="text-sm font-medium text-slate-600 leading-relaxed">
                {successNotice.message}
              </p>
            </div>

            {/* ข้อมูลผู้ป่วยแยกเป็นการ์ดของตัวเอง
                เดิมยัดชื่อ HN VN ไว้ในวงเล็บกลางประโยคยาวๆ ที่จัดกึ่งกลาง
                อ่านยากมากเพราะบรรทัดตัดคำไม่ตรงกับความหมาย
                แยกออกมาแล้วกวาดตาหาเลข HN เจอทันทีโดยไม่ต้องอ่านทั้งประโยค */}
            {successNotice.patient && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-sm font-bold text-slate-900">
                  {successNotice.patient.name}
                </p>
                <p className="text-xs font-mono text-slate-500 mt-1">
                  HN {successNotice.patient.hn}
                  {successNotice.patient.vn ? `  ·  VN ${successNotice.patient.vn}` : ''}
                </p>
              </div>
            )}

            {/* สิ่งที่ต้องทำต่อ แยกกล่องให้ชัดว่าเป็นคนละเรื่องกับผลการบันทึก */}
            {successNotice.note && (
              <div className="rounded-2xl bg-blue-50 border border-blue-100 px-4 py-3 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-xs font-medium text-blue-900 leading-relaxed">
                  {successNotice.note}
                </p>
              </div>
            )}

            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  const callback = successNotice.onConfirm;
                  setSuccessNotice(null);
                  if (callback) callback();
                }}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>{language === 'th' ? 'ตกลง' : 'OK'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
