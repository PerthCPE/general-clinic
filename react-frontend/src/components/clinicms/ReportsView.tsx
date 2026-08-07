import React from 'react';
import { TrendingUp, BarChart3 } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export const ReportsView: React.FC = () => {
  const { language, t } = useLanguage();

  return (
    <div className="doctor-reports-section">
      <div className="doctor-reports-header">
        <div className="doctor-reports-header-icon">
          <BarChart3 className="w-6 h-6" />
        </div>
        <div className="doctor-reports-title-wrap">
          <h2>{t('reportsTitle')}</h2>
          <p>{t('reportsSubtitle')}</p>
        </div>
      </div>

      <div className="doctor-reports-metrics-grid">
        <div className="doctor-metric-card">
          <span className="doctor-metric-label">{t('avgWaitTime')}</span>
          <div className="doctor-metric-value">14.2 {language === 'th' ? 'นาที' : 'min'}</div>
          <span className="doctor-metric-subtext green">
            <TrendingUp className="w-4 h-4" />
            <span>{t('avgWaitFaster')}</span>
          </span>
        </div>

        <div className="doctor-metric-card">
          <span className="doctor-metric-label">{t('avgExamDuration')}</span>
          <div className="doctor-metric-value">12.8 {language === 'th' ? 'นาที' : 'min'}</div>
          <span className="doctor-metric-subtext blue">{t('optimalPace')}</span>
        </div>

        <div className="doctor-metric-card">
          <span className="doctor-metric-label">{t('completionRate')}</span>
          <div className="doctor-metric-value">92.5%</div>
          <span className="doctor-metric-subtext green">{t('highSatisfaction')}</span>
        </div>
      </div>

      <div className="doctor-chart-card">
        <h3 className="doctor-chart-title">
          {t('dailyArrivalVolume')}
        </h3>
        <div className="doctor-chart-container">
          {[
            { hour: '8 AM', count: 4 },
            { hour: '9 AM', count: 9 },
            { hour: '10 AM', count: 12 },
            { hour: '11 AM', count: 8 },
            { hour: '12 PM', count: 3 },
            { hour: '1 PM', count: 6 },
            { hour: '2 PM', count: 10 },
            { hour: '3 PM', count: 7 },
            { hour: '4 PM', count: 5 },
          ].map((bar, i) => (
            <div key={i} className="doctor-chart-bar-wrap">
              <span className="doctor-chart-count">{bar.count}</span>
              <div
                style={{ height: `${(bar.count / 12) * 100}%` }}
                className="doctor-chart-bar"
              />
              <span className="doctor-chart-hour">{bar.hour}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
