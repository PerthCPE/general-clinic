import React, { useState } from 'react';
import { Patient } from '../../types';
import { X, UserPlus } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { generateVN } from '../../utils/vnGenerator';

interface AddPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (newPatient: Omit<Patient, 'id'>) => void;
  nextQueueNo: string;
  nextHN: string;
  nextVN?: string;
}

export const AddPatientModal: React.FC<AddPatientModalProps> = ({
  isOpen,
  onClose,
  onAdd,
  nextQueueNo,
  nextHN,
  nextVN
}) => {
  const { language, t } = useLanguage();
  if (!isOpen) return null;

  const [name, setName] = useState('');
  const [nationalIdInput, setNationalIdInput] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [age, setAge] = useState<number>(30);
  const [chiefComplaint, setChiefComplaint] = useState('');

  const currentVN = nextVN || generateVN();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onAdd({
      queueNo: nextQueueNo,
      hn: nextHN,
      vn: currentVN,
      nationalId: nationalIdInput.trim() || `1-1002-${Math.floor(10000 + Math.random() * 90000)}-89-0`,
      name,
      gender,
      age,
      status: 'Waiting',
      waitingTimeMinutes: 5,
      chiefComplaint,
      vitals: {
        bp: '120/80',
        pulse: 75,
        temp: 36.6,
        weight: 65
      }
    });

    setName('');
    setNationalIdInput('');
    setChiefComplaint('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-[#162a4a] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500 flex items-center justify-center text-white">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">{t('newQueueReg')}</h3>
              <p className="text-xs text-slate-300">{t('issueQueueToken')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-300 hover:text-white p-1.5 rounded-lg hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase block">{t('colQueueNo')}</span>
              <span className="text-lg font-bold font-mono text-emerald-600">{nextQueueNo}</span>
            </div>
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase block">{t('colHN')}</span>
              <span className="text-xs font-semibold font-mono text-slate-700 block">{nextHN}</span>
            </div>
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase block">VN</span>
              <span className="text-xs font-semibold font-mono text-purple-700 truncate block">{currentVN}</span>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">{t('fullName')} *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={language === 'th' ? 'เช่น สมชาย ใจดี' : 'e.g. Alex Turner'}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">{language === 'th' ? 'เลขบัตรประชาชน' : 'National ID'}</label>
            <input
              type="text"
              value={nationalIdInput}
              onChange={(e) => setNationalIdInput(e.target.value)}
              placeholder="1-1002-34567-89-0"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">{t('gender')}</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              >
                <option value="Male">{t('genderMale')}</option>
                <option value="Female">{t('genderFemale')}</option>
                <option value="Other">{t('genderOther')}</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">{t('ageYears')}</label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">{t('chiefComplaintLabel')}</label>
            <textarea
              rows={2}
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
              placeholder={language === 'th' ? 'อาการหรือสาเหตุที่มาโรงพยาบาล...' : 'Reason for visit or chief symptoms...'}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-100 cursor-pointer"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm cursor-pointer"
            >
              {t('issueTicket')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
