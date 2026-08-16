import React from 'react';
import { TrendingUp, BarChart3 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export const ReportsView: React.FC = () => {
  const { language, t } = useLanguage();

  return (
    <div className="space-y-6 pt-2 border-t border-slate-200/60">
      <div className="flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-blue-600" />
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            {t('reportsTitle')}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {t('reportsSubtitle')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
          <span className="text-xs font-medium text-slate-500">{t('avgWaitTime')}</span>
          <div className="text-3xl font-bold text-slate-900 font-mono">14.2 {language === 'th' ? 'นาที' : 'min'}</div>
          <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>{t('avgWaitFaster')}</span>
          </span>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
          <span className="text-xs font-medium text-slate-500">{t('avgExamDuration')}</span>
          <div className="text-3xl font-bold text-slate-900 font-mono">12.8 {language === 'th' ? 'นาที' : 'min'}</div>
          <span className="text-xs text-blue-600 font-semibold">{t('optimalPace')}</span>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
          <span className="text-xs font-medium text-slate-500">{t('completionRate')}</span>
          <div className="text-3xl font-bold text-slate-900 font-mono">92.5%</div>
          <span className="text-xs text-emerald-600 font-semibold">{t('highSatisfaction')}</span>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
        <h3 className="text-base font-bold text-slate-800">
          {t('dailyArrivalVolume')}
        </h3>
        <div className="h-48 flex items-end justify-between gap-2 pt-6 pb-2 px-4 border-b border-slate-100">
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
            <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
              <span className="text-[11px] font-bold text-slate-700">{bar.count}</span>
              <div
                style={{ height: `${(bar.count / 12) * 100}%` }}
                className="w-full bg-blue-600 rounded-t-lg transition-all hover:bg-blue-500"
              />
              <span className="text-[10px] font-mono text-slate-400">{bar.hour}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

