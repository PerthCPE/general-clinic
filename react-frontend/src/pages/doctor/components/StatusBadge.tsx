import React from 'react';
import type { QueueStatus } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface StatusBadgeProps {
  status: QueueStatus;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const { t } = useLanguage();

  const getStyles = () => {
    switch (status) {
      case 'Waiting':
        return 'bg-[#dcfce7] text-[#15803d] border border-emerald-200/60';
      case 'Examining':
        return 'bg-[#dbeafe] text-[#1e40af] border border-blue-200/60';
      case 'Pending Pharmacy':
        return 'bg-purple-100 text-purple-800 border border-purple-200/60';
      case 'Completed':
        return 'bg-slate-100 text-slate-700 border border-slate-200/60';
      case 'Cancelled':
        return 'bg-red-100 text-red-700 border border-red-200/60';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const getLabel = () => {
    switch (status) {
      case 'Waiting':
        return t('stWaiting');
      case 'Examining':
        return t('stExamining');
      case 'Pending Pharmacy':
        return t('stPharmacy');
      case 'Completed':
        return t('stCompleted');
      case 'Cancelled':
        return t('stCancelled');
      default:
        return status;
    }
  };

  const sizeStyles = size === 'sm' ? 'px-2.5 py-0.5 text-xs font-semibold' : 'px-3 py-1 text-xs font-semibold';

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full tracking-wide ${getStyles()} ${sizeStyles}`}
    >
      {getLabel()}
    </span>
  );
};
