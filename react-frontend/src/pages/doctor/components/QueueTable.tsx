import React, { useState } from 'react';
import type { Patient, QueueStatus } from '../types';
import { StatusBadge } from './StatusBadge';
import { CopyableText } from './CopyableText';
import { Stethoscope, Clock, AlertCircle, Search, X, Edit3 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { translateClinicalText } from '../utils/clinicalTranslation';
import { displayVN } from '../utils/vnGenerator';
import { StatusFilterTabs } from './StatusFilterTabs';
import { matchPatientSearch } from '../utils/searchUtils';

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

  const displayedPatients = patients
    .filter((patient) => {
      if (!queueSearch.trim()) return true;
      return matchPatientSearch(patient, queueSearch);
    })
    // ผู้ป่วยที่ตรวจเสร็จแล้วให้ตกไปอยู่ท้ายตาราง เพื่อให้คิวที่ยังต้องทำงานอยู่บนสุดเสมอ
    // .filter() คืน array ใหม่อยู่แล้ว จึง .sort() ได้โดยไม่กระทบ props เดิม
    // และ sort ของ JS เป็น stable ลำดับคิวเดิมภายในกลุ่มเดียวกันจึงไม่เปลี่ยน
    .sort((a, b) => Number(a.status === 'Completed') - Number(b.status === 'Completed'));

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
      {/* Header section with Title, Search Bar, and Filters */}
      <div className="p-6 pb-4 flex flex-col md:flex-row md:items-center gap-4 border-b border-slate-100">
        {/* คอลัมน์หัวข้อกว้างคงที่
            ถ้าปล่อยให้กว้างตามข้อความ พอค้นหาแล้วจำนวนรายการเปลี่ยนจาก 22 เป็น 1
            ความกว้างจะหดลง แล้วช่องค้นหาที่อยู่ถัดไปจะขยับตามทุกครั้งที่พิมพ์
            ซึ่งกวนสายตามากเพราะเป็นช่องที่ผู้ใช้กำลังมองอยู่พอดี */}
        <div className="shrink-0 md:w-60">
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

        {/* ช่องค้นหาชิดซ้ายต่อจากหัวข้อ ยืดหดตามพื้นที่ว่าง
            แถบกรองสถานะถูกดันไปชิดขวาด้วย ml-auto และไม่ยอมให้หด (shrink-0)
            ถ้าปล่อยให้หด ปุ่มจะถูกบีบจนต้องมีแถบเลื่อนซึ่งผู้ใช้มักมองไม่เห็น */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={queueSearch}
              onChange={(e) => setQueueSearch(e.target.value)}
              placeholder={language === 'th' ? 'ค้นหาชื่อผู้ป่วย, เลข HN, เลข VN, เลขบัตรประชาชน, ลำดับคิว...' : 'Search Patient Name, HN, VN, National ID, Queue...'}
              className="w-full pl-10 pr-8 py-2 bg-slate-50 hover:bg-slate-100/80 focus:bg-white text-slate-800 text-xs rounded-xl border border-slate-200 focus:outline-hidden transition-all shadow-2xs font-sans placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15"
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

      {/* Patients Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200/80 text-xs font-semibold text-slate-500 tracking-wider">
              <th className="py-5 px-6 w-28 text-center">{t('colQueueNo')}</th>
              <th className="py-5 px-6 w-32">{t('colHN')}</th>
              <th className="py-5 px-6 w-36">{t('colVN')}</th>
              <th className="py-5 px-6">{t('colPatientName')}</th>
              <th className="py-5 px-6 w-40 text-center">{t('colStatus')}</th>
              <th className="py-5 px-6 w-36 text-center">{t('colWaitingTime')}</th>
              <th className="py-5 px-6 w-40 text-center">{t('colAction')}</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 text-sm">
            {displayedPatients.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400">
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
              displayedPatients.map((patient) => (
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
    </div>
  );
};

