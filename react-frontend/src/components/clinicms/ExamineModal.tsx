import React, { useState } from 'react';
import { Patient, QueueStatus } from '../../types';
import { X, Stethoscope, HeartPulse, Activity, Thermometer, Weight, Save } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { generateVN } from '../../utils/vnGenerator';
import { CopyableText } from './CopyableText';

interface ExamineModalProps {
  patient: Patient | null;
  onClose: () => void;
  onSave: (updatedPatient: Patient) => void;
}

export const ExamineModal: React.FC<ExamineModalProps> = ({
  patient,
  onClose,
  onSave
}) => {
  const { language, t } = useLanguage();
  if (!patient) return null;

  const [status, setStatus] = useState<QueueStatus>(patient.status);
  const [diagnosis, setDiagnosis] = useState(patient.diagnosis || '');
  const [prescription, setPrescription] = useState(patient.prescription || '');
  const [complaint, setComplaint] = useState(patient.chiefComplaint || '');

  // Vitals state
  const [bp, setBp] = useState(patient.vitals?.bp || '120/80');
  const [pulse, setPulse] = useState(patient.vitals?.pulse || 75);
  const [temp, setTemp] = useState(patient.vitals?.temp || 36.6);
  const [weight, setWeight] = useState(patient.vitals?.weight || 68);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...patient,
      status,
      chiefComplaint: complaint,
      diagnosis,
      prescription,
      vitals: {
        bp,
        pulse: Number(pulse),
        temp: Number(temp),
        weight: Number(weight)
      }
    });
    onClose();
  };

  const statusMap: Partial<Record<QueueStatus, string>> = {
    Waiting: t('stWaiting'),
    Screened: t('stWaiting'),
    Examining: t('stExamining'),
    'In Progress': t('stExamining'),
    'Pending Laboratory': t('stLab'),
    Lab: t('stLab'),
    'Pending Pharmacy': t('stPharmacy'),
    Completed: t('stCompleted'),
    Cancelled: t('stCancelled'),
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="bg-[#162a4a] text-white p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">{patient.name}</h3>
                <span className="bg-blue-500/30 text-blue-200 text-xs px-2 py-0.5 rounded font-mono font-bold">
                  {patient.queueNo}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-300 mt-1 flex-wrap">
                <CopyableText label="HN" value={patient.hn} className="hover:text-blue-300 text-slate-200" />
                <span>•</span>
                <CopyableText label="VN" value={patient.vn || generateVN(patient.visitDate, patient.visitTime, 1)} className="hover:text-blue-300 text-slate-200" />
                <span>•</span>
                <span>{patient.gender === 'Male' ? t('genderMale') : patient.gender === 'Female' ? t('genderFemale') : t('genderOther')}, {patient.age} {language === 'th' ? 'ปี' : 'years old'}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-300 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Status Switcher */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
              {t('queueStatus')}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['Waiting', 'Examining', 'Completed'] as QueueStatus[]).map((st) => (
                <button
                  type="button"
                  key={st}
                  onClick={() => setStatus(st)}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all text-center cursor-pointer ${
                    status === st
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {statusMap[st] || st}
                </button>
              ))}
            </div>
          </div>

          {/* Vitals Cards */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
              {t('patientVitals')}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                  <HeartPulse className="w-3.5 h-3.5 text-red-500" />
                  <span>{t('bpLabel')}</span>
                </div>
                <input
                  type="text"
                  value={bp}
                  onChange={(e) => setBp(e.target.value)}
                  className="w-full bg-white px-2 py-1 border border-slate-200 rounded text-sm font-semibold text-slate-800"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                  <Activity className="w-3.5 h-3.5 text-blue-500" />
                  <span>{t('pulseLabel')}</span>
                </div>
                <input
                  type="number"
                  value={pulse}
                  onChange={(e) => setPulse(Number(e.target.value))}
                  className="w-full bg-white px-2 py-1 border border-slate-200 rounded text-sm font-semibold text-slate-800"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                  <Thermometer className="w-3.5 h-3.5 text-amber-500" />
                  <span>{t('tempLabel')}</span>
                </div>
                <input
                  type="number"
                  step="0.1"
                  value={temp}
                  onChange={(e) => setTemp(Number(e.target.value))}
                  className="w-full bg-white px-2 py-1 border border-slate-200 rounded text-sm font-semibold text-slate-800"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                  <Weight className="w-3.5 h-3.5 text-emerald-500" />
                  <span>{t('weightLabel')}</span>
                </div>
                <input
                  type="number"
                  value={weight}
                  onChange={(e) => setWeight(Number(e.target.value))}
                  className="w-full bg-white px-2 py-1 border border-slate-200 rounded text-sm font-semibold text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* Chief Complaint */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
              {t('chiefComplaintLabel')}
            </label>
            <textarea
              rows={2}
              value={complaint}
              onChange={(e) => setComplaint(e.target.value)}
              placeholder={language === 'th' ? 'ระบุอาการสำคัญหรือเหตุผลในการมาตรวจ...' : 'Describe symptoms or reason for visit...'}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          {/* Diagnosis & Prescription */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                {t('medicalDiagnosis')}
              </label>
              <textarea
                rows={3}
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                placeholder={language === 'th' ? 'ผลการวินิจฉัยโรคโดยแพทย์...' : "Doctor's clinical diagnosis..."}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                {t('prescriptionMeds')}
              </label>
              <textarea
                rows={3}
                value={prescription}
                onChange={(e) => setPrescription(e.target.value)}
                placeholder={language === 'th' ? 'รายการยาที่สั่ง ขนาด และวิธีกิน...' : 'Prescribed drugs, dosage & instructions...'}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-100 transition-colors cursor-pointer"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{t('saveRecordAndUpdate')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
