import React from 'react';
import { Users, Clock, CheckCircle, Stethoscope } from 'lucide-react';
import type { Patient } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { TRIAGE_SHORT_LABELS, triageTone } from '../utils/triage';

const LEVELS = ['Level 1: Resuscitation', 'Level 2: Emergency', 'Level 3: Urgent', 'Level 4: Less Urgent'];

interface StatCardProps {
  title: string;
  value: number;
  iconType: 'users' | 'clock' | 'check' | 'stethoscope';
  activeFilter?: string;
  onClick?: () => void;
  patients?: Patient[];
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  iconType,
  activeFilter,
  onClick,
  patients
}) => {
  const { language } = useLanguage();
  const counts = [0, 0, 0, 0];
  for (const patient of patients ?? []) {
    const level = patient.triage?.level;
    const index = level === 'Level 5: Non-Urgent' ? 3 : LEVELS.indexOf(level ?? '');
    if (index >= 0) counts[index]++;
  }
  const getIcon = () => {
    switch (iconType) {
      case 'users':
        return <Users className="w-6 h-6 text-blue-600" />;
      case 'clock':
        return <Clock className="w-6 h-6 text-blue-600" />;
      case 'check':
        return <CheckCircle className="w-6 h-6 text-blue-600" />;
      case 'stethoscope':
        return <Stethoscope className="w-6 h-6 text-blue-600" />;
      default:
        return <Users className="w-6 h-6 text-blue-600" />;
    }
  };

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-pressed={onClick ? Boolean(activeFilter) : undefined}
      onKeyDown={onClick ? (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      } : undefined}
      className={`rounded-2xl p-6 overflow-hidden border bg-white transition-all cursor-pointer flex flex-col gap-5 focus-visible:outline-none focus-visible:border-blue-600 ${
        activeFilter
          ? 'border-blue-600 shadow-2xs hover:shadow-md'
          : 'border-slate-200/80 shadow-2xs hover:shadow-md'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-[#e8f0fe]">
          {getIcon()}
        </div>
        <span className="text-sm leading-5 font-medium text-slate-600">
          {title}
        </span>
      </div>

      <span className="text-5xl leading-none font-semibold tracking-tight tabular-nums block text-slate-900">
        {value}
      </span>
      {patients && (
        <div className="-mx-6 -mb-6 px-6 pb-6 bg-white">
          <div className="space-y-2 border-t border-slate-300/60 pt-4">
          {LEVELS.map((level, index) => (
            <div key={level} className="flex items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-2 text-slate-600">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: triageTone(level).dot }} />
                {TRIAGE_SHORT_LABELS[level][language === 'th' ? 'th' : 'en']}
              </span>
              <span className="font-semibold tabular-nums text-slate-900">{counts[index]} <span className="font-normal text-slate-500">{language === 'th' ? 'คน' : 'patients'}</span></span>
            </div>
          ))}
          </div>
        </div>
      )}
    </div>
  );
};
