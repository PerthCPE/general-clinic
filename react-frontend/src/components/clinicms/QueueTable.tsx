import React, { useState } from 'react';
import { Patient, QueueStatus } from '../../types';
import { StatusBadge } from './StatusBadge';
import { CopyableText } from './CopyableText';
import { Stethoscope, Clock, AlertCircle, Search, X } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { translateClinicalText } from '../../utils/clinicalTranslation';
import { generateVN } from '../../utils/vnGenerator';
import { matchPatientSearch } from '../../utils/searchUtils';

interface QueueTableProps {
  patients: Patient[];
  onExamine: (patient: Patient) => void;
  onUpdateStatus: (patientId: string, status: QueueStatus) => void;
  statusFilter?: string;
  setStatusFilter?: (status: string) => void;
}

export const QueueTable: React.FC<QueueTableProps> = ({
  patients,
  onExamine,
  onUpdateStatus,
  statusFilter = 'All',
  setStatusFilter
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

  const displayedPatients = patients.filter((patient) => {
    if (!queueSearch.trim()) return true;
    return matchPatientSearch(patient, queueSearch);
  });

  return (
    <div className="doctor-table-card">
      {/* Header section with Title, Search Bar, and Filters */}
      <div className="doctor-table-header">
        <div className="doctor-table-title-group">
          <h2>{t('todaysQueue')}</h2>
          <p>
            {language === 'th'
              ? `แสดง ${displayedPatients.length} รายการคิวผู้ป่วย${queueSearch ? ` (จากผลการค้นหา "${queueSearch}")` : ''}`
              : `Showing ${displayedPatients.length} patient${displayedPatients.length !== 1 ? 's' : ''} in queue`}
          </p>
        </div>

        <div className="doctor-table-controls">
          {/* Patient Search Input */}
          <div className="doctor-search-box">
            <Search className="doctor-search-icon" />
            <input
              type="text"
              value={queueSearch}
              onChange={(e) => setQueueSearch(e.target.value)}
              placeholder={language === 'th' ? 'ค้นหาชื่อผู้ป่วย, เลข HN, เลข VN, เลขบัตรประชาชน, ลำดับคิว...' : 'Search Patient Name, HN, VN...'}
              className="doctor-search-input"
            />
            {queueSearch && (
              <button
                type="button"
                onClick={() => setQueueSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Status Quick Filters */}
          {setStatusFilter && (
            <div className="doctor-filter-tabs">
              {['All', 'Waiting', 'Examining', 'Completed'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`doctor-filter-btn ${statusFilter === st ? 'active' : ''}`}
                >
                  {getFilterLabel(st)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Patients Table */}
      <div className="overflow-x-auto">
        <table className="doctor-data-table">
          <thead>
            <tr>
              <th style={{ width: '120px' }}>{t('colQueueNo')}</th>
              <th style={{ width: '140px' }}>{t('colHN')}</th>
              <th style={{ width: '160px' }}>{t('colVN')}</th>
              <th>{t('colPatientName')}</th>
              <th style={{ width: '140px' }}>{t('colStatus')}</th>
              <th style={{ width: '140px' }}>{t('colWaitingTime')}</th>
              <th style={{ width: '140px', textAlign: 'right' }}>{t('colAction')}</th>
            </tr>
          </thead>

          <tbody>
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
                <tr key={patient.id}>
                  {/* Queue No */}
                  <td className="font-bold text-slate-900 font-mono" style={{ fontSize: '15px' }}>
                    {patient.queueNo}
                  </td>

                  {/* HN */}
                  <td className="font-bold text-slate-800">
                    <CopyableText value={patient.hn} />
                  </td>

                  {/* VN */}
                  <td className="font-bold text-slate-800">
                    <CopyableText value={patient.vn || generateVN(patient.visitDate, patient.visitTime, 1)} />
                  </td>

                  {/* Patient Name */}
                  <td>
                    <div className="patient-name-cell">
                      <span className="patient-name-text">
                        {patient.name}
                      </span>
                      {patient.chiefComplaint && (
                        <span className="patient-complaint-text">
                          {translateClinicalText(patient.chiefComplaint, language)}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Status */}
                  <td>
                    <StatusBadge status={patient.status} />
                  </td>

                  {/* Waiting Time */}
                  <td className="font-semibold text-slate-700">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-slate-400" />
                      <span>{patient.waitingTimeMinutes} {language === 'th' ? 'นาที' : 'min'}</span>
                    </div>
                  </td>

                  {/* Action Button */}
                  <td style={{ textAlign: 'right' }}>
                    <button
                      onClick={() => onExamine(patient)}
                      className="btn-examine-action"
                    >
                      <Stethoscope className="w-4 h-4" />
                      <span>{t('examineBtn')}</span>
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
