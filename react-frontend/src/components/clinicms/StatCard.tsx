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
      className={`doctor-stat-card ${activeFilter ? 'active' : ''}`}
    >
      <div className="doctor-stat-info">
        <span className="doctor-stat-label">
          {title}
        </span>
        <span className="doctor-stat-value">
          {value}
        </span>
      </div>

      <div className="doctor-stat-icon-wrap">
        {getIcon()}
      </div>
    </div>
  );
};
