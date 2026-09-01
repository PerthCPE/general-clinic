import React, { useState } from 'react';
import type { Patient, PastVisitRecord } from '../types';
import { matchPatientSearch } from '../utils/searchUtils';
import {
  Search,
  Stethoscope,
  ChevronRight,
  Calendar,
  Clock,
  Pill,
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
import { displayVN } from '../utils/vnGenerator';

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

export const PatientRecordsView: React.FC<PatientRecordsViewProps> = ({
  patients,
  onExamine,
  selectedPatient: selectedPatientProp,
  onSelectPatient
}) => {
  const [search, setSearch] = useState('');
  // Filter status: 'in_progress' | 'waiting' | 'all'
  const [statusFilter, setStatusFilter] = useState<'in_progress' | 'waiting' | 'completed' | 'all'>('all');
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
  const isCompletedPatient = (p: Patient) =>
    p.status === 'Completed' || p.status === 'Pending Pharmacy';

  const isActivePatient = (p: Patient) =>
    p.status === 'Waiting' ||
    p.status === 'Screened' ||
    (p.status as string) === 'In Progress' ||
    p.status === 'Examining';

  const inProgressCount = patients.filter(p => (p.status as string) === 'In Progress' || p.status === 'Examining').length;
  const waitingCount = patients.filter(p => p.status === 'Waiting').length;
  const completedCount = patients.filter(isCompletedPatient).length;
  const activePatientsCount = patients.length;

  const filteredPatients = patients.filter(p => {
    if (statusFilter === 'in_progress') {
      if ((p.status as string) !== 'In Progress' && p.status !== 'Examining') return false;
    } else if (statusFilter === 'waiting') {
      if (p.status !== 'Waiting') return false;
    } else if (statusFilter === 'completed') {
      if (!isCompletedPatient(p)) return false;
    } else if (statusFilter === 'all') {
      // ทั้งหมด = ทุกคนที่โหลดมา ทั้งที่ยังรอตรวจและที่ตรวจจบไปแล้ว
      // (เดิมกรองเฉพาะคนที่ยัง active ทำให้ผู้ป่วยที่ตรวจเสร็จแล้วหายไป)
      if (!isActivePatient(p) && !isCompletedPatient(p) && !search.trim()) return false;
    }

    if (!search.trim()) return true;

    return matchPatientSearch(p, search);
  });

  // Combine current visit (if has diagnosis or chief complaint) with past visits list
  const getCombinedHistory = (patient: Patient): PastVisitRecord[] => {
    const list: PastVisitRecord[] = [];

    // Add current visit if available
    if (patient.chiefComplaint || patient.diagnosis || patient.primaryDiagnosis) {
      list.push({
        id: `current-${patient.id}`,
        vn: displayVN(patient.vn),
        visitDate: patient.visitDate || '2026-07-23',
        visitTime: patient.visitTime || '08:45 AM',
        doctorName: language === 'th' ? 'แพทย์ประจำคลินิก (Current Session)' : 'Attending Physician (Current)',
        department: language === 'th' ? 'แผนกผู้ป่วยนอก (OPD)' : 'Outpatient Department (OPD)',
        chiefComplaint: patient.chiefComplaint || (language === 'th' ? 'ไม่ระบุ' : 'N/A'),
        diagnosis: patient.primaryDiagnosis?.name || patient.diagnosis || (language === 'th' ? 'กำลังตรวจวินิจฉัย' : 'In Examination'),
        icdCode: patient.primaryDiagnosis?.code || '',
        vitals: patient.vitals ? {
          bp: patient.vitals.bp,
          pulse: patient.vitals.pulse,
          temp: patient.vitals.temp,
          weight: patient.vitals.weight,
          spo2: patient.vitals.spo2
        } : undefined,
        prescription: patient.prescription || (patient.prescriptions && patient.prescriptions.length > 0
          ? patient.prescriptions.map(p => p.medicineName).join(', ')
          : undefined),
        prescriptionsList: patient.prescriptions,
        doctorNotes: patient.assessmentNotes || patient.clinicalNotes || patient.treatmentPlan,
        followUpDate: patient.followUp?.followUpDate,
        status: patient.status
      });
    }

    // Add past visits
    if (patient.pastVisits && patient.pastVisits.length > 0) {
      list.push(...patient.pastVisits);
    }

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
                      : (language === 'th' ? 'รายชื่อผู้ป่วยทั้งหมด' : 'All Patients')
                    }
                  </span>
                  <span className="text-xs font-mono font-bold bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-lg">
                    {filteredPatients.length}
                  </span>
                </h2>
              </div>

              {/* Status Filter Toggle Tabs: กำลังตรวจ, รอตรวจ, ทั้งหมด */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold border border-slate-200/80 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setStatusFilter('in_progress')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    statusFilter === 'in_progress'
                      ? 'bg-blue-600 text-white shadow-2xs font-extrabold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>{language === 'th' ? 'กำลังตรวจ' : 'In Progress'}</span>
                  <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
                    statusFilter === 'in_progress' ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {inProgressCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter('waiting')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    statusFilter === 'waiting'
                      ? 'bg-blue-600 text-white shadow-2xs font-extrabold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>{language === 'th' ? 'รอตรวจ' : 'Waiting'}</span>
                  <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
                    statusFilter === 'waiting' ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {waitingCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter('completed')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    statusFilter === 'completed'
                      ? 'bg-blue-600 text-white shadow-2xs font-extrabold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>{language === 'th' ? 'ตรวจเสร็จแล้ว' : 'Completed'}</span>
                  <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
                    statusFilter === 'completed' ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {completedCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    statusFilter === 'all'
                      ? 'bg-blue-600 text-white shadow-2xs font-extrabold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>{language === 'th' ? 'ทั้งหมด' : 'All'}</span>
                  <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
                    statusFilter === 'all' ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {activePatientsCount}
                  </span>
                </button>
              </div>
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
                          <StatusBadge status={patient.status} />
                        </div>

                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs space-y-1 font-mono text-slate-600">
                          <div className="flex flex-wrap items-center gap-2">
                            <CopyableText label="VN" value={vnCode} />
                            <span>•</span>
                            <CopyableText label={language === 'th' ? 'เลขบัตร' : 'ID'} value={patient.nationalId || '1-1002-34567-89-0'} />
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
                    <CopyableText label={language === 'th' ? 'เลขบัตร' : 'ID'} value={selectedPatient.nationalId || '1-1002-34567-89-0'} />
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
                  {/* Sub-search bar inside History */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200">
                    <div className="relative flex-1 w-full">
                      <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        value={historySearch}
                        onChange={(e) => setHistorySearch(e.target.value)}
                        placeholder={language === 'th' ? 'ค้นหาในประวัติรักษา (โรค, วันที่, ชื่อแพทย์, ยา)...' : 'Filter visits by diagnosis, date, doctor, medicine...'}
                        className="w-full pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 focus:outline-hidden"
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

                                {/* Prescriptions List */}
                                {(visit.prescription || (visit.prescriptionsList && visit.prescriptionsList.length > 0)) && (
                                  <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-100 space-y-2">
                                    <span className="font-bold text-emerald-900 block text-[11px] uppercase tracking-wide flex items-center gap-1.5">
                                      <Pill className="w-3.5 h-3.5 text-emerald-600" />
                                      <span>{language === 'th' ? 'รายการยาที่สั่งจ่าย (MEDICATIONS PRESCRIBED)' : 'MEDICATIONS PRESCRIBED'}</span>
                                    </span>
                                    {visit.prescriptionsList && visit.prescriptionsList.length > 0 ? (
                                      <div className="space-y-1.5 pt-1">
                                        {visit.prescriptionsList.map((item, idx) => (
                                          <div key={idx} className="bg-white p-2.5 rounded-lg border border-emerald-200/80 flex items-center justify-between text-xs">
                                            <div>
                                              <span className="font-bold text-slate-900">{item.medicineName}</span>
                                              <div className="text-[11px] text-slate-500">{item.dosage} • {item.frequency}</div>
                                            </div>
                                            <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                              x{item.quantity}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-emerald-950 font-semibold">{visit.prescription}</p>
                                    )}
                                  </div>
                                )}

                                {/* Doctor Notes & Follow-Up */}
                                {visit.doctorNotes && (
                                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                                    <span className="font-bold text-slate-700 block text-[11px] uppercase tracking-wide">
                                      {language === 'th' ? 'คำแนะนำและบันทึกแพทย์ (DOCTOR NOTES)' : 'DOCTOR NOTES'}
                                    </span>
                                    <p className="text-slate-800 leading-relaxed font-medium">{visit.doctorNotes}</p>
                                  </div>
                                )}

                                {visit.followUpDate && (
                                  <div className="flex items-center gap-2 text-xs font-semibold text-blue-900 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-200 w-fit">
                                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                                    <span>{language === 'th' ? `นัดหมายติดตามอาการครั้งถัดไป: ${visit.followUpDate}` : `Next Follow-up Appointment: ${visit.followUpDate}`}</span>
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
                          <CopyableText value={selectedPatient.nationalId || '1-1002-34567-89-0'} />
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
