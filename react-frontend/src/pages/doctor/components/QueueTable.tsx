import React, { useState, useEffect } from 'react';
import type { Patient, QueueStatus } from '../types';
import { StatusBadge } from './StatusBadge';
import { CopyableText } from './CopyableText';
import { Stethoscope, Clock, AlertCircle, Search, X, Edit3, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { translateClinicalText } from '../utils/clinicalTranslation';
import { displayVN } from '../utils/vnGenerator';
import { StatusFilterTabs } from './StatusFilterTabs';
import { matchPatientSearch } from '../utils/searchUtils';
import { triageTone, triageShortLabel, TRIAGE_SHORT_LABELS } from '../utils/triage';

/**
 * ป้ายระดับความรุนแรงจากจุดคัดกรอง ใช้ในคอลัมน์ "ระดับ" ของตารางคิว
 * ----------------------------------------------------------------------------
 * ย้ายมาจากหน้าบันทึกการตรวจ เพราะแพทย์ต้องเห็นความเร่งด่วน "ก่อน" กดเข้าตรวจ
 * ไม่ใช่ตอนที่เข้าไปอยู่ในห้องตรวจแล้ว
 *
 * เคสที่พยาบาลยังไม่ได้คัดกรอง จะไม่แสดงป้ายเลย (คืน null)
 * ห้ามแสดงเป็น "ไม่ฉุกเฉิน" เพราะจะทำให้เข้าใจผิดว่าประเมินแล้วว่าไม่ด่วน
 */
const TriageChip: React.FC<{ level?: string }> = ({ level }) => {
  const { language } = useLanguage();
  const text = triageShortLabel(level, language);
  if (!text) return null;

  const tone = triageTone(level);
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-semibold whitespace-nowrap"
      style={{ backgroundColor: tone.bg, borderColor: tone.border, color: tone.text }}
      title={level}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: tone.dot }}></span>
      {text}
    </span>
  );
};

/**
 * ==============================================================================
 * Patient Queue Table Component (QueueTable.tsx)
 * ==============================================================================
 * ตารางคิวผู้ป่วยประจำวัน (Outpatient Queue Table):
 * 1. แสดงคิวผู้ป่วยเรียงตามหมายเลขคิว (Q001, Q002, ...)
 * 2. ค้นหาคิวรวดเร็ว (Quick Search) ด้วยชื่อ, HN, VN
 * 3. กรองตามสถานะคิว (ทั้งหมด, รอตรวจ, กำลังตรวจ, ตรวจเสร็จแล้ว)
 * 4. ปุ่มเข้าตรวจ (Start Exam) สำหรับเรียกผู้ป่วยเข้าห้องตรวจ
 *
 * 📍 จุดที่ใช้แก้ไข/ปรับแต่ง (Customization Guide):
 * - displayedPatients: ตารางกรองผู้ป่วยตามข้อความค้นหา
 * - onExamine: Callback เมื่อกดปุ่มตรวจผู้ป่วย
 * - onUpdateStatus: Callback เปลี่ยนสถานะคิวผู้ป่วย
 */
interface QueueTableProps {
  patients: Patient[];
  onExamine: (patient: Patient) => void;
  onUpdateStatus: (patientId: string, status: QueueStatus) => void;
  statusFilter?: string;
  setStatusFilter?: (status: string) => void;

  /** จำนวนผู้ป่วยแยกตามสถานะ ต้องนับจากรายการ "ก่อนกรอง" จึงให้หน้าเจ้าของส่งเข้ามา
   *  (patients ที่ส่งมาถูกกรองตาม statusFilter แล้ว ถ้านับจากตรงนี้ตัวเลขจะเพี้ยน) */
  statusCounts?: Record<string, number>;
}

export const QueueTable: React.FC<QueueTableProps> = ({
  patients,
  onExamine,
  onUpdateStatus,
  statusFilter = 'All',
  setStatusFilter,
  statusCounts
}) => {
  const { language, t } = useLanguage();
  const [queueSearch, setQueueSearch] = useState('');

  const getFilterLabel = (st: string) => {
    switch (st) {
      case 'All': return t('filterAll');
      case 'Waiting': return t('filterWaiting');
      case 'Examining': return t('filterExamining');
      case 'Completed': return t('filterCompleted');
      default: return st;
    }
  };

  /**
   * ตัวกรองระดับความรุนแรง (Triage Filter)
   * --------------------------------------------------------------------------
   * เก็บ state ไว้ในตารางเอง ไม่ต้องส่งขึ้นไปให้หน้าเจ้าของ
   * เพราะเป็นแค่การ "มองดู" คิวชุดเดิม ไม่ได้เปลี่ยนข้อมูลที่ดึงมาจาก backend
   *
   * ค่า 'All' = ทุกระดับ ที่เหลือเป็น triage_code ตรงๆ ตามที่ backend ส่งมา
   */
  const [triageFilter, setTriageFilter] = useState('All');

  // คิวหลังกรองด้วยคำค้นแล้ว ใช้เป็นฐานนับจำนวนของแต่ละระดับ
  // (ต้องนับ "ก่อน" กรองระดับ ไม่งั้นเลือกระดับไหนแล้วระดับอื่นจะกลายเป็น 0 หมด)
  const searchedPatients = patients.filter((patient) => {
    if (!queueSearch.trim()) return true;
    return matchPatientSearch(patient, queueSearch);
  });

  const triageCounts: Record<string, number> = { All: searchedPatients.length };
  for (const item of searchedPatients) {
    const level = item.triage?.level;
    if (level) triageCounts[level] = (triageCounts[level] || 0) + 1;
  }

  /**
   * ปุ่มกรองระดับ เรียงจากด่วนสุดไปน้อยสุด
   * Level 5 ไม่ใส่ไว้ เพราะจุดคัดกรองของพยาบาลมีแค่ 4 ระดับ
   * ถ้าวันหลังเพิ่มระดับ ให้เพิ่มที่นี่และใน utils/triage.ts ให้ตรงกัน
   */
  const TRIAGE_FILTER_LEVELS = [
    'Level 1: Resuscitation',
    'Level 2: Emergency',
    'Level 3: Urgent',
    'Level 4: Less Urgent',
  ];

  const triageFilterOptions = [
    { value: 'All', label: language === 'th' ? 'ทุกระดับ' : 'All levels', count: triageCounts.All },
    ...TRIAGE_FILTER_LEVELS.map((lv) => ({
      value: lv,
      label: (language === 'th' ? TRIAGE_SHORT_LABELS[lv]?.th : TRIAGE_SHORT_LABELS[lv]?.en) || lv,
      count: triageCounts[lv] || 0,
    })),
  ];

  const displayedPatients = searchedPatients
    .filter((patient) => {
      if (triageFilter === 'All') return true;
      return patient.triage?.level === triageFilter;
    })
    // ผู้ป่วยที่ตรวจเสร็จแล้วให้ตกไปอยู่ท้ายตาราง เพื่อให้คิวที่ยังต้องทำงานอยู่บนสุดเสมอ
    // .filter() คืน array ใหม่อยู่แล้ว จึง .sort() ได้โดยไม่กระทบ props เดิม
    // และ sort ของ JS เป็น stable ลำดับคิวเดิมภายในกลุ่มเดียวกันจึงไม่เปลี่ยน
    // (ไม่เรียงตามระดับความรุนแรง เพราะลำดับคิวคือ "ใครมาก่อน" ซึ่งต้องคงไว้
    //  ถ้าอยากดูเฉพาะเคสด่วน ให้ใช้ตัวกรองระดับด้านบนตารางแทน)
    .sort((a, b) => Number(a.status === 'Completed') - Number(b.status === 'Completed'));

  /**
   * ============================================================================
   * แบ่งหน้าตารางคิว (Pagination)
   * ============================================================================
   * คิวจริงในคลินิกมีวันละหลายสิบคน ถ้าแสดงทั้งหมดในหน้าเดียวต้องเลื่อนจอยาวมาก
   * กว่าจะถึงคนท้ายๆ และเสียจุดอ้างอิงว่าดูถึงไหนแล้ว จึงตัดเป็นหน้าละ 5 คิว
   *
   * ข้อควรระวังที่ทำให้พังบ่อย 2 จุด (แก้ไว้แล้วด้านล่าง)
   * 1. ผู้ใช้อยู่หน้า 4 แล้วพิมพ์ค้นหาจนเหลือ 2 รายการ ถ้าไม่รีเซ็ตหน้า
   *    จะเห็นตารางว่างเปล่าทั้งที่มีผลลัพธ์ -> useEffect รีเซ็ตกลับหน้า 1
   * 2. simulator หรือเพื่อนเปลี่ยนสถานะคิว ทำให้จำนวนรายการลดลงเอง
   *    โดยที่ผู้ใช้ไม่ได้แตะอะไรเลย -> ใช้ safePage หนีบค่าไว้ไม่ให้เกินหน้าสุดท้าย
   *    (หนีบตอน render ไม่ใช่ตอน setState เพื่อไม่ให้เห็นตารางว่างวาบก่อนแล้วค่อยเด้ง)
   */
  const PAGE_SIZE = 5;
  const [page, setPage] = useState(1);

  // เปลี่ยนคำค้นหรือเปลี่ยนแท็บสถานะ = ดูชุดข้อมูลใหม่ ต้องกลับไปหน้าแรกเสมอ
  useEffect(() => {
    setPage(1);
  }, [queueSearch, statusFilter, triageFilter]);

  const totalPages = Math.max(1, Math.ceil(displayedPatients.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const pagePatients = displayedPatients.slice(startIndex, startIndex + PAGE_SIZE);

  // เลขหน้าที่จะแสดงเป็นปุ่ม แสดงมากสุด 5 ปุ่มโดยให้หน้าปัจจุบันอยู่กลาง
  // ถ้ามีหลายสิบหน้าแล้วโชว์ทุกปุ่ม แถบล่างจะยาวล้นจอ
  const pageNumbers = React.useMemo(() => {
    const maxButtons = 5;
    if (totalPages <= maxButtons) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    let start = Math.max(1, safePage - 2);
    let end = start + maxButtons - 1;
    if (end > totalPages) {
      end = totalPages;
      start = end - maxButtons + 1;
    }
    return Array.from({ length: maxButtons }, (_, i) => start + i);
  }, [totalPages, safePage]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
      {/* แถวบน: หัวข้อชิดซ้าย แถบกรองสถานะชิดขวา */}
      <div className="p-6 pb-4 flex flex-col md:flex-row md:items-start gap-4 border-b border-slate-100">
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">
            {t('todaysQueue')}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {/* ไม่ต้องขึ้นคำค้นซ้ำตรงนี้ เพราะผู้ใช้เห็นสิ่งที่ตัวเองพิมพ์ในช่องค้นหาอยู่แล้ว
                และข้อความยาวไม่เท่ากันจะทำให้ความกว้างขยับ */}
            {language === 'th'
              ? `แสดง ${displayedPatients.length} รายการคิวผู้ป่วย`
              : `Showing ${displayedPatients.length} patient${displayedPatients.length !== 1 ? 's' : ''} in queue`}
          </p>
        </div>

        {/* Status Quick Filters */}
        {setStatusFilter && (
          <StatusFilterTabs
            className="md:ml-auto"
            value={statusFilter}
            onChange={setStatusFilter}
            options={['All', 'Waiting', 'Examining', 'Completed'].map((st) => ({
              value: st,
              label: getFilterLabel(st),
              count: statusCounts?.[st],
            }))}
          />
        )}
      </div>

      {/* แถวล่าง: ช่องค้นหาชิดซ้าย ตัวกรองระดับความรุนแรงชิดขวา
          อยู่บรรทัดเดียวกันเพื่อไม่ให้หัวการ์ดสูงเกินไป
          ตัวกรองระดับไม่ยอมให้หด (shrink-0) ถ้าจอแคบจะตัดลงบรรทัดใหม่แทน
          เพราะถ้าปล่อยให้หด ปุ่มจะถูกบีบจนต้องมีแถบเลื่อนซึ่งผู้ใช้มักมองไม่เห็น */}
      <div className="px-6 py-3 flex flex-wrap items-center gap-3 border-b border-slate-100 bg-slate-50/40">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={queueSearch}
            onChange={(e) => setQueueSearch(e.target.value)}
            placeholder={language === 'th' ? 'ค้นหาชื่อผู้ป่วย, เลข HN, เลข VN, เลขบัตรประชาชน, ลำดับคิว...' : 'Search Patient Name, HN, VN, National ID, Queue...'}
            className="w-full pl-10 pr-8 py-2 bg-white hover:bg-slate-50 focus:bg-white text-slate-800 text-xs rounded-xl border border-slate-200 focus:outline-hidden transition-all shadow-2xs font-sans placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15"
          />
          {queueSearch && (
            <button
              type="button"
              onClick={() => setQueueSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              title={language === 'th' ? 'ล้างการค้นหา' : 'Clear search'}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <StatusFilterTabs
          className="ml-auto"
          value={triageFilter}
          onChange={setTriageFilter}
          options={triageFilterOptions}
        />
      </div>

      {/* Patients Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200/80 text-xs font-semibold text-slate-500 tracking-wider">
              <th className="py-5 px-6 w-28 text-center">{t('colQueueNo')}</th>
              <th className="py-5 px-6 w-32">{t('colHN')}</th>
              <th className="py-5 px-6 w-36">{t('colVN')}</th>
              <th className="py-5 px-6">{t('colPatientName')}</th>
              {/* คอลัมน์ระดับความรุนแรงจากจุดคัดกรอง แยกออกมาเป็นคอลัมน์ของตัวเอง
                  เพราะถ้าต่อท้ายชื่อ ป้ายจะขยับไปมาตามความยาวชื่อ อ่านเทียบกันยาก */}
              <th className="py-5 px-6 w-36 text-center">{language === 'th' ? 'ระดับ' : 'Triage'}</th>
              <th className="py-5 px-6 w-40 text-center">{t('colStatus')}</th>
              <th className="py-5 px-6 w-36 text-center">{t('colWaitingTime')}</th>
              <th className="py-5 px-6 w-40 text-center">{t('colAction')}</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 text-sm">
            {displayedPatients.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <AlertCircle className="w-8 h-8 text-slate-300" />
                    <span>
                      {queueSearch
                        ? (language === 'th' ? `ไม่พบผู้ป่วยที่ตรงกับ "${queueSearch}"` : `No queue patient found matching "${queueSearch}"`)
                        : t('noPatientsFound')}
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              pagePatients.map((patient) => (
                <tr
                  key={patient.id}
                  className="hover:bg-slate-50/80 transition-colors group"
                >
                  {/* Queue No */}
                  <td className="py-5 px-6 font-semibold text-slate-800 font-mono text-center">
                    {patient.queueNo}
                  </td>

                  {/* HN */}
                  <td className="py-5 px-6 text-slate-600 font-medium">
                    <CopyableText value={patient.hn} />
                  </td>

                  {/* VN */}
                  <td className="py-5 px-6 text-slate-600 font-medium">
                    <CopyableText value={displayVN(patient.vn)} />
                  </td>

                  {/* Patient Name */}
                  <td className="py-5 px-6 font-medium text-slate-900">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-900">
                        {patient.name}
                      </span>
                      {patient.chiefComplaint && (
                        <span className="text-[12px] text-slate-400 font-normal truncate max-w-xs">
                          {translateClinicalText(patient.chiefComplaint, language)}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Triage Level */}
                  <td className="py-5 px-6 text-center">
                    <TriageChip level={patient.triage?.level} />
                  </td>

                  {/* Status */}
                  <td className="py-5 px-6 text-center">
                    <StatusBadge status={patient.status} />
                  </td>

                  {/* Waiting Time */}
                  <td className="py-5 px-6 text-slate-600 font-medium">
                    <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                      <Clock className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                      <span>{patient.waitingTimeMinutes} {language === 'th' ? 'นาที' : 'min'}</span>
                    </div>
                  </td>

                  {/* Action Button matching Figma primary blue button */}
                  <td className="py-5 px-6 text-center">
                    <button
                      onClick={() => onExamine(patient)}
                      className="px-4 py-1.5 bg-[#2563eb] hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-2xs hover:shadow-xs active:scale-95 transition-all inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                    >
                      {patient.status === 'Completed' ? (
                        <Edit3 className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <Stethoscope className="w-3.5 h-3.5 shrink-0" />
                      )}
                      {/*
                        เคสที่บันทึกฉบับร่างค้างไว้จะมีสถานะ "กำลังตรวจ" อยู่
                        ปุ่มจึงต้องบอกว่า "ตรวจต่อ" ไม่ใช่ "ตรวจผู้ป่วย"
                        เพื่อให้รู้ว่ากดเข้าไปแล้วข้อมูลเดิมยังอยู่ครบ
                      */}
                      <span>
                        {patient.status === 'Completed'
                          ? t('editRecordBtn')
                          : patient.status === 'Examining' || (patient.status as string) === 'In Progress'
                          ? t('continueExamBtn')
                          : t('examineBtn')}
                      </span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* แถบแบ่งหน้า ซ่อนทั้งแถบเมื่อไม่มีผลลัพธ์ เพราะข้อความ "แสดง 0-0 จาก 0" ไม่มีประโยชน์
          ส่วนปุ่มเลขหน้าซ่อนเมื่อมีหน้าเดียว แต่ยังคงข้อความบอกจำนวนไว้ */}
      {displayedPatients.length > 0 && (
        <div className="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center gap-3">
          <p className="text-xs text-slate-500 shrink-0">
            {language === 'th'
              ? `แสดง ${startIndex + 1}-${startIndex + pagePatients.length} จาก ${displayedPatients.length} คิว`
              : `Showing ${startIndex + 1}-${startIndex + pagePatients.length} of ${displayedPatients.length}`}
          </p>

          {totalPages > 1 && (
            <div className="flex items-center gap-1 sm:ml-auto">
              <button
                type="button"
                onClick={() => setPage(safePage - 1)}
                disabled={safePage === 1}
                title={language === 'th' ? 'หน้าก่อนหน้า' : 'Previous page'}
                className={`p-1.5 rounded-lg border transition-colors ${
                  safePage === 1
                    ? 'border-slate-200 text-slate-300 cursor-not-allowed'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 cursor-pointer'
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* หน้าแรกจะถูกดันหลุดกรอบ 5 ปุ่มเมื่ออยู่หน้าท้ายๆ ใส่ทางลัดกลับไว้ให้ */}
              {pageNumbers[0] > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setPage(1)}
                    className="min-w-8 px-2 py-1 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors"
                  >
                    1
                  </button>
                  <span className="px-0.5 text-slate-400 text-xs">…</span>
                </>
              )}

              {pageNumbers.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  aria-current={n === safePage ? 'page' : undefined}
                  className={`min-w-8 px-2 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    n === safePage
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {n}
                </button>
              ))}

              {pageNumbers[pageNumbers.length - 1] < totalPages && (
                <>
                  <span className="px-0.5 text-slate-400 text-xs">…</span>
                  <button
                    type="button"
                    onClick={() => setPage(totalPages)}
                    className="min-w-8 px-2 py-1 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors"
                  >
                    {totalPages}
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => setPage(safePage + 1)}
                disabled={safePage === totalPages}
                title={language === 'th' ? 'หน้าถัดไป' : 'Next page'}
                className={`p-1.5 rounded-lg border transition-colors ${
                  safePage === totalPages
                    ? 'border-slate-200 text-slate-300 cursor-not-allowed'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 cursor-pointer'
                }`}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

