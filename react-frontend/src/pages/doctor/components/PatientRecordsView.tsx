import React, { useState } from 'react';
import type { Patient, PastVisitRecord, PrescriptionItem } from '../types';
import { matchPatientSearch } from '../utils/searchUtils';
import {
  Search,
  Stethoscope,
  ChevronRight,
  Calendar,
  Clock,
  FileText,
  Printer,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Activity,
  HeartPulse,
  History,
  User,
  X,
  FileCheck,
  ArrowLeft,
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
const HistoryField: React.FC<{ label: string; value?: string }> = ({ label, value }) => {
  const text = (value || '').trim();
  return (
    <div>
      <span className="block text-[11px] font-bold text-slate-700 mb-1">{label}</span>
      <div
        className={`p-2.5 bg-slate-50 border border-slate-200 rounded-xl leading-relaxed whitespace-pre-line min-h-[38px] ${
          text ? 'text-slate-800 font-medium' : 'text-slate-400'
        }`}
      >
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

  if (visit.progress === 'completed') {
    return (
      <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-md">
        {isTh ? 'เสร็จสิ้น' : 'Completed'}
      </span>
    );
  }

  if (visit.progress === 'in_progress') {
    return (
      <span className="text-[10px] font-extrabold text-amber-800 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-md">
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
    <span className="text-[10px] font-extrabold text-rose-800 bg-rose-100 border border-rose-200 px-2 py-0.5 rounded-md">
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
  <div className="space-y-2">
    <h5 className="text-sm font-bold text-slate-900">{title}</h5>
    {children}
  </div>
);

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
        visitDate: patient.visitDate || '2026-07-23',
        visitTime: patient.visitTime || '08:45 AM',
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
                  const pastCount = (patient.pastVisits?.length || 0) + (patient.chiefComplaint || patient.diagnosis ? 1 : 0);
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
                          {isNewPatient(patient) ? (
                              <span className="bg-slate-100 text-slate-600 border border-slate-200 text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap">
                                {language === 'th' ? 'ผู้ป่วยใหม่' : 'New Patient'}
                              </span>
                            ) : (
                              <StatusBadge status={patient.status} />
                            )}
                        </div>

                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs space-y-1 font-mono text-slate-600">
                          <div className="flex flex-wrap items-center gap-2">
                            <CopyableText label="VN" value={vnCode} />
                            <span>•</span>
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 px-5 rounded-2xl border border-slate-200/90 shadow-2xs">
            <button
              onClick={() => handleSelectPatient(null)}
              className="flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 px-3.5 py-2 rounded-xl transition-all border border-slate-200 hover:border-blue-200 cursor-pointer w-fit"
            >
              <ArrowLeft className="w-4 h-4 text-blue-600" />
              <span>{language === 'th' ? 'กลับไปหน้าค้นหาผู้ป่วย' : 'Back to Patient Search'}</span>
            </button>

            {/* Quick Switch Patient Search */}
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={language === 'th' ? 'ค้นหาผู้ป่วยคนอื่น...' : 'Search another patient...'}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 focus:outline-hidden"
              />
            </div>
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
                    <StatusBadge status={selectedPatient.status} />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-mono mt-1.5 flex-wrap">
                    <CopyableText label="HN" value={selectedPatient.hn} />
                    <span>•</span>
                    <CopyableText label="VN" value={displayVN(selectedPatient.vn)} />
                    <span>•</span>
                    <CopyableText label={language === 'th' ? 'เลขบัตร' : 'ID'} value={formatNationalId(selectedPatient.nationalId)} copyValue={rawNationalId(selectedPatient.nationalId)} />
                    <span>•</span>
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
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Stethoscope className="w-4 h-4" />
                  <span>{t('examineBtn')}</span>
                </button>
              </div>
            </div>

            {/* Patient Information Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80">
                <span className="text-[11px] text-slate-400 font-medium block mb-0.5">{language === 'th' ? 'วันเกิด / อายุ' : 'DOB / Age'}</span>
                <span className="font-semibold text-slate-800">{selectedPatient.dob || '1984-03-15'} ({selectedPatient.age} {language === 'th' ? 'ปี' : 'yrs'})</span>
              </div>
              <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80">
                <span className="text-[11px] text-slate-400 font-medium block mb-0.5">{language === 'th' ? 'หมู่เลือด' : 'Blood Group'}</span>
                <span className="font-bold text-rose-600">{selectedPatient.bloodGroup || 'หมู่ O (O Positive)'}</span>
              </div>
              <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80">
                <span className="text-[11px] text-slate-400 font-medium block mb-0.5">{language === 'th' ? 'เบอร์โทรศัพท์' : 'Phone'}</span>
                <span className="font-mono font-semibold text-slate-800">{selectedPatient.phone || '081-234-5678'}</span>
              </div>
              <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80">
                <span className="text-[11px] text-slate-400 font-medium block mb-0.5">{language === 'th' ? 'สิทธิการรักษา' : 'Insurance'}</span>
                <span className="font-semibold text-slate-800 truncate block">{selectedPatient.insuranceType || (language === 'th' ? 'Universal Health Coverage (UC)' : 'UC')}</span>
              </div>
            </div>
          </div>

          {/* Navigation Tabs (History vs Profile) */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 px-6 pt-2.5 bg-slate-50/50 gap-3 overflow-x-auto">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('history')}
                  className={`px-5 py-3 text-xs font-extrabold rounded-t-2xl transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
                    activeTab === 'history'
                      ? 'bg-white text-blue-700 border-blue-600 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 border-transparent'
                  }`}
                >
                  <History className="w-4 h-4 text-blue-600" />
                  <span>{language === 'th' ? 'ประวัติการตรวจรักษาย้อนหลัง' : 'Past Treatment History'}</span>
                  <span className="ml-1 bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">
                    {currentHistory.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('profile')}
                  className={`px-5 py-3 text-xs font-extrabold rounded-t-2xl transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
                    activeTab === 'profile'
                      ? 'bg-white text-blue-700 border-blue-600 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 border-transparent'
                  }`}
                >
                  <User className="w-4 h-4 text-blue-600" />
                  <span>{language === 'th' ? 'ข้อมูลสุขภาพและประวัติส่วนตัว' : 'Health Profile & Medical Background'}</span>
                </button>
              </div>

              {/* Right Side Composition Details */}
              <div className="hidden md:flex items-center gap-2.5 pb-2 text-xs font-medium text-slate-600 shrink-0">
                <span className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-700 font-mono text-xs shadow-2xs flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  <span>HN: <strong className="text-slate-900">{selectedPatient.hn}</strong></span>
                </span>
                <span className="px-3 py-1.5 bg-blue-50/90 border border-blue-200/80 rounded-xl text-blue-900 text-xs font-bold flex items-center gap-2 shadow-2xs">
                  <Activity className="w-3.5 h-3.5 text-blue-600" />
                  <span>{language === 'th' ? `ประวัติย้อนหลังทั้งหมด ${currentHistory.length} รายการ` : `Total ${currentHistory.length} Records`}</span>
                </span>
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
                                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none hover:bg-slate-100/50 transition-colors rounded-t-2xl"
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-bold text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200/80 font-mono">
                                      {visit.visitDate} {visit.visitTime ? `• ${visit.visitTime}` : ''}
                                    </span>
                                    {isCurrentSession && (
                                      <span className="text-[10px] font-extrabold text-blue-800 bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-md uppercase">
                                        {language === 'th' ? 'การรับบริการวันนี้' : 'Today Visit'}
                                      </span>
                                    )}
                                    <CopyableText label="VN" value={visit.vn} />
                                    <VisitProgressBadge visit={visit} language={language} />
                                  </div>

                                  <h4 className="text-sm font-bold text-blue-900 mt-1">
                                    {translateClinicalText(visit.diagnosis, language)}
                                    {visit.icdCode && (
                                      <span className="ml-2 font-mono text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200/80">
                                        {visit.icdCode}
                                      </span>
                                    )}
                                  </h4>

                                  <div className="text-xs text-slate-600 font-medium">
                                    <span>{visit.doctorName || (language === 'th' ? 'แพทย์ประจำคลินิก' : 'Attending Doctor')}</span>
                                    {visit.department && <span className="text-slate-400"> ({visit.department})</span>}
                                  </div>
                                </div>

                                <div className="flex items-center gap-3 shrink-0">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedVisitId(isExpanded ? 'none' : visit.id);
                                    }}
                                    className="p-1.5 rounded-lg hover:bg-slate-200/70 text-slate-500 transition-colors cursor-pointer"
                                  >
                                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                  </button>
                                </div>
                              </div>

                              {/* Expanded Visit Details Body */}
                              {isExpanded && (
                                <div className="px-4 pb-5 pt-2 border-t border-slate-100 space-y-4 text-xs">
                                {/* Chief Complaint */}
                                <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-1">
                                  <span className="font-bold text-slate-700 block text-[11px] uppercase tracking-wide">
                                    {language === 'th' ? 'อาการสำคัญ (CHIEF COMPLAINT)' : 'CHIEF COMPLAINT'}
                                  </span>
                                  <p className="text-slate-800 font-medium leading-relaxed">
                                    {translateClinicalText(visit.chiefComplaint, language)}
                                  </p>
                                </div>

                                {/* Vitals Snapshot */}
                                {visit.vitals && (
                                  <div className="space-y-1.5">
                                    <span className="font-bold text-slate-700 block text-[11px] uppercase tracking-wide">
                                      {language === 'th' ? 'สัญญาณชีพประจำครั้งนี้ (VITALS RECORDED)' : 'VITALS RECORDED'}
                                    </span>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                      <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                                        <span className="text-[10px] text-slate-400 block">{t('bloodPressure')}</span>
                                        <span className="font-mono font-bold text-slate-800 text-xs">{visit.vitals.bp || '-'}</span>
                                      </div>
                                      <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                                        <span className="text-[10px] text-slate-400 block">{t('pulseRate')}</span>
                                        <span className="font-mono font-bold text-slate-800 text-xs">{visit.vitals.pulse ? `${visit.vitals.pulse} bpm` : '-'}</span>
                                      </div>
                                      <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                                        <span className="text-[10px] text-slate-400 block">{t('temperature')}</span>
                                        <span className="font-mono font-bold text-slate-800 text-xs">{visit.vitals.temp ? `${visit.vitals.temp} °C` : '-'}</span>
                                      </div>
                                      <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                                        <span className="text-[10px] text-slate-400 block">{t('weight')}</span>
                                        <span className="font-mono font-bold text-slate-800 text-xs">{visit.vitals.weight ? `${visit.vitals.weight} kg` : '-'}</span>
                                      </div>
                                    </div>
                                  </div>
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
                <div className="space-y-6 text-xs">
                  {/* Full Structured Patient Profile Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Block 1: Demographics */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3 shadow-xs">
                      <div className="flex items-center gap-2 border-b border-slate-200 pb-2.5 text-sm font-bold text-slate-900">
                        <div className="p-1.5 rounded-lg bg-blue-100/80 text-blue-700">
                          <User className="w-4 h-4" />
                        </div>
                        <span>{language === 'th' ? 'ข้อมูลพื้นฐาน' : 'Demographics'}</span>
                      </div>
                      <div className="space-y-2 text-xs">
                        <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/80">
                          <span className="text-slate-500 font-bold block text-[11px] mb-0.5">{language === 'th' ? 'ชื่อ - นามสกุล :' : 'Full Name :'}</span>
                          <span className="font-bold text-slate-900 text-xs">{selectedPatient.name}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/80">
                            <span className="text-slate-500 font-bold block text-[11px] mb-0.5">{language === 'th' ? 'อายุ :' : 'Age :'}</span>
                            <span className="font-bold text-slate-900 text-xs">{selectedPatient.age} {language === 'th' ? 'ปี' : 'yrs'}</span>
                          </div>
                          <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/80">
                            <span className="text-slate-500 font-bold block text-[11px] mb-0.5">{language === 'th' ? 'เพศ :' : 'Gender :'}</span>
                            <span className="font-bold text-slate-900 text-xs">
                              {selectedPatient.gender === 'Male'
                                ? (language === 'th' ? 'ชาย' : 'Male')
                                : selectedPatient.gender === 'Female'
                                ? (language === 'th' ? 'หญิง' : 'Female')
                                : selectedPatient.gender}
                            </span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/80">
                            <span className="text-slate-500 font-bold block text-[11px] mb-0.5">{language === 'th' ? 'หมู่โลหิต :' : 'Blood Group :'}</span>
                            <span className="font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100 inline-block text-[11px]">
                              {selectedPatient.bloodGroup
                                ? selectedPatient.bloodGroup
                                : (language === 'th' ? 'หมู่ O (O Positive)' : 'O Positive (O+)')}
                            </span>
                          </div>
                          <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/80">
                            <span className="text-slate-500 font-bold block text-[11px] mb-0.5">{language === 'th' ? 'วันเกิด :' : 'Date of Birth :'}</span>
                            <span className="font-semibold text-slate-800 text-xs">{selectedPatient.dob || '1984-03-15'}</span>
                          </div>
                        </div>
                        <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/80">
                          <span className="text-slate-500 font-bold block text-[11px] mb-0.5">{language === 'th' ? 'เลขบัตรประชาชน :' : 'National ID :'}</span>
                          <CopyableText value={formatNationalId(selectedPatient.nationalId)} copyValue={rawNationalId(selectedPatient.nationalId)} />
                        </div>
                      </div>
                    </div>

                    {/* Block 2: Address & Phone */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3 shadow-xs">
                      <div className="flex items-center gap-2 border-b border-slate-200 pb-2.5 text-sm font-bold text-slate-900">
                        <div className="p-1.5 rounded-lg bg-emerald-100/80 text-emerald-700">
                          <Phone className="w-4 h-4" />
                        </div>
                        <span>{language === 'th' ? 'การติดต่อ & ที่อยู่' : 'Contact & Address'}</span>
                      </div>
                      <div className="space-y-2 text-xs">
                        <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/80">
                          <span className="text-slate-500 font-bold block text-[11px] mb-0.5">{language === 'th' ? 'เบอร์โทรศัพท์ :' : 'Patient Phone :'}</span>
                          <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60 inline-block text-xs">
                            {selectedPatient.phone || '081-234-5678'}
                          </span>
                        </div>
                        <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/80">
                          <span className="text-slate-500 font-bold block text-[11px] mb-0.5">{language === 'th' ? 'อาชีพ :' : 'Occupation :'}</span>
                          <span className="font-bold text-slate-900 text-xs">{selectedPatient.occupation || (language === 'th' ? 'วิศวกรซอฟต์แวร์' : 'Software Engineer')}</span>
                        </div>
                        <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/80">
                          <span className="text-slate-500 font-bold block text-[11px] mb-0.5">{language === 'th' ? 'ที่อยู่ผู้ป่วย :' : 'Patient Address :'}</span>
                          <p className="font-semibold text-slate-800 text-xs leading-relaxed">
                            {selectedPatient.address || '123/45 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Block 3: Insurance & Visit Info */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3 shadow-xs">
                      <div className="flex items-center gap-2 border-b border-slate-200 pb-2.5 text-sm font-bold text-slate-900">
                        <div className="p-1.5 rounded-lg bg-amber-100/80 text-amber-700">
                          <Shield className="w-4 h-4" />
                        </div>
                        <span>{language === 'th' ? 'สิทธิการรักษา & รับบริการ' : 'Insurance Scheme & Visit'}</span>
                      </div>
                      <div className="space-y-2 text-xs">
                        <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/80">
                          <span className="text-slate-500 font-bold block text-[11px] mb-0.5">{language === 'th' ? 'สิทธิการรักษา :' : 'Insurance Scheme :'}</span>
                          <span className="font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/60 inline-block text-xs">
                            {selectedPatient.insuranceType
                              ? selectedPatient.insuranceType
                              : (language === 'th' ? 'บัตรทอง (หลักประกันสุขภาพถั่วหน้า UC)' : 'Universal Health Coverage (UC)')}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/80">
                            <span className="text-slate-500 font-bold block text-[11px] mb-0.5">{language === 'th' ? 'วันที่รับบริการ :' : 'Visit Date :'}</span>
                            <span className="font-bold text-slate-900 text-xs">{selectedPatient.visitDate || '2026-07-23'}</span>
                          </div>
                          <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/80">
                            <span className="text-slate-500 font-bold block text-[11px] mb-0.5">{language === 'th' ? 'เวลา :' : 'Visit Time :'}</span>
                            <span className="font-bold text-slate-900 text-xs">{selectedPatient.visitTime || (language === 'th' ? '08:45 น.' : '08:45 AM')}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Chronic Diseases */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                    <div className="flex items-center gap-2 border-b border-slate-200 pb-2 text-xs font-extrabold text-slate-800">
                      <div className="p-1.5 rounded-lg bg-rose-100/80 text-rose-700">
                        <HeartPulse className="w-4 h-4" />
                      </div>
                      <span>{language === 'th' ? 'โรคประจำตัวและภาวะเรื้อรัง' : 'Chronic Diseases & Conditions'}</span>
                    </div>
                    {selectedPatient.chronicDiseases && selectedPatient.chronicDiseases.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {selectedPatient.chronicDiseases.map((d, i) => (
                          <span key={i} className="px-3 py-1 bg-blue-100 text-blue-900 font-bold rounded-lg border border-blue-200 text-xs">
                            • {d}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-500 font-medium">{language === 'th' ? 'ไม่มีโรคประจำตัว' : 'No chronic diseases recorded.'}</span>
                    )}
                  </div>

                  {/* Allergies Section */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-rose-50/60 rounded-2xl border border-rose-200 space-y-2">
                      <span className="font-bold text-rose-900 text-xs block border-b border-rose-200/80 pb-1.5 flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-rose-100/80 text-rose-700">
                          <AlertTriangle className="w-4 h-4" />
                        </div>
                        <span>{language === 'th' ? 'ประวัติการแพ้ยา (Drug Allergies)' : 'Drug Allergies'}</span>
                      </span>
                      {selectedPatient.drugAllergies && selectedPatient.drugAllergies.length > 0 ? (
                        <div className="space-y-1">
                          {selectedPatient.drugAllergies.map((drug, i) => (
                            <span key={i} className="inline-block px-2.5 py-1 bg-rose-100 text-rose-900 font-bold rounded-lg border border-rose-200 text-xs mr-1.5 mb-1">
                              ⚠️ {drug}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-emerald-800 font-semibold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 inline-block">
                          ✓ {language === 'th' ? 'ปฏิเสธประวัติแพ้ยา (NKDA)' : 'No Known Drug Allergies (NKDA)'}
                        </span>
                      )}
                    </div>

                    <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200 space-y-2">
                      <span className="font-bold text-amber-900 text-xs block border-b border-amber-200/80 pb-1.5 flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-amber-100/80 text-amber-700">
                          <AlertTriangle className="w-4 h-4" />
                        </div>
                        <span>{language === 'th' ? 'ประวัติการแพ้อาหาร (Food Allergies)' : 'Food Allergies'}</span>
                      </span>
                      {selectedPatient.foodAllergies && selectedPatient.foodAllergies.length > 0 ? (
                        <div className="space-y-1">
                          {selectedPatient.foodAllergies.map((food, i) => (
                            <span key={i} className="inline-block px-2.5 py-1 bg-amber-100 text-amber-900 font-bold rounded-lg border border-amber-200 text-xs mr-1.5 mb-1">
                              ⚠️ {food}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-600 font-medium">
                          ✓ {language === 'th' ? 'ไม่มีประวัติแพ้อาหาร' : 'No food allergies recorded.'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Personal Lifestyle & Surgery */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                      <span className="font-bold text-slate-800 text-xs block border-b border-slate-200 pb-1.5">
                        {language === 'th' ? 'ประวัติพฤติกรรมสุขภาพ' : 'Social & Behavioral History'}
                      </span>
                      <div className="space-y-1.5 text-slate-700">
                        <div>
                          <strong className="text-slate-900">{language === 'th' ? 'การสูบบุหรี่:' : 'Smoking:'}</strong>{' '}
                          {selectedPatient.smokingHistory?.status || (language === 'th' ? 'ไม่สูบบุหรี่' : 'Non-smoker')}
                        </div>
                        <div>
                          <strong className="text-slate-900">{language === 'th' ? 'การดื่มแอลกอฮอล์:' : 'Alcohol:'}</strong>{' '}
                          {selectedPatient.alcoholHistory?.status || (language === 'th' ? 'ไม่ดื่มแอลกอฮอล์' : 'Non-drinker')}
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                      <span className="font-bold text-slate-800 text-xs block border-b border-slate-200 pb-1.5">
                        {language === 'th' ? 'ประวัติการผ่าตัดและประวัติครอบครัว' : 'Surgical & Family History'}
                      </span>
                      <div className="space-y-1.5 text-slate-700">
                        <div>
                          <strong className="text-slate-900">{language === 'th' ? 'การผ่าตัดเดิม:' : 'Past Surgery:'}</strong>{' '}
                          {selectedPatient.pastSurgery || (language === 'th' ? 'ไม่มี' : 'None')}
                        </div>
                        <div>
                          <strong className="text-slate-900">{language === 'th' ? 'ประวัติครอบครัว:' : 'Family History:'}</strong>{' '}
                          {selectedPatient.familyHistory || (language === 'th' ? 'ไม่มี' : 'None')}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Current Regular Medications */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                    <span className="font-bold text-slate-800 text-xs block border-b border-slate-200 pb-1.5">
                      {language === 'th' ? 'ยาที่รับประทานประจำในปัจจุบัน (Current Long-term Medications)' : 'Current Long-term Medications'}
                    </span>
                    {selectedPatient.currentMedications && selectedPatient.currentMedications.length > 0 ? (
                      <div className="space-y-1">
                        {selectedPatient.currentMedications.map((med, i) => (
                          <div key={i} className="p-2 bg-white rounded-lg border border-slate-200 font-medium text-slate-800">
                            • {med}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-500 font-medium">{language === 'th' ? 'ไม่มีรายการยาประจำ' : 'No long-term medications listed.'}</span>
                    )}
                  </div>
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
