import React from 'react';
import { Users, Clock, CheckCircle } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number;
  iconType: 'users' | 'clock' | 'check';
  activeFilter?: string;
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  iconType,
  activeFilter,
  onClick
}) => {
  const getIcon = () => {
    switch (iconType) {
      case 'users':
        return <Users className="w-6 h-6 text-blue-600" />;
      case 'clock':
        return <Clock className="w-6 h-6 text-blue-600" />;
      case 'check':
        return <CheckCircle className="w-6 h-6 text-blue-600" />;
      default:
        return <Users className="w-6 h-6 text-blue-600" />;
    }
  };

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs hover:shadow-md transition-all cursor-pointer flex items-center justify-between ${
        activeFilter ? 'ring-2 ring-blue-500 border-transparent' : ''
      }`}
    >
      <div className="space-y-2">
        <span className="text-sm font-medium text-slate-600 block">
          {title}
        </span>
        <span className="text-4xl font-bold text-slate-900 tracking-tight block">
          {value}
        </span>
      </div>

      <div className="w-12 h-12 rounded-2xl bg-[#e8f0fe] flex items-center justify-center shrink-0">
        {getIcon()}
      </div>
    </div>
  );
};
