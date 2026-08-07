import React from 'react';
import {
  LayoutDashboard,
  Users,
  Stethoscope,
  Calendar,
  FileText,
  FileSpreadsheet
} from 'lucide-react';
import { ActiveTab } from '../../types';
import { useLanguage } from '../../context/LanguageContext';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenAddModal: () => void;
  waitingCount: number;
  examiningCount?: number;
  onOpenSettings?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  onOpenAddModal,
  waitingCount,
  examiningCount = 1,
  onOpenSettings
}) => {
  const { language, t } = useLanguage();

  const navItems = [
    { id: 'dashboard' as ActiveTab, label: t('navDashboard'), icon: LayoutDashboard },
    { id: 'queue' as ActiveTab, label: t('navQueue'), icon: Users, badge: waitingCount > 0 ? waitingCount : undefined },
    { id: 'examination' as ActiveTab, label: t('navExamination'), icon: Stethoscope, badge: examiningCount > 0 ? examiningCount : undefined },
    { id: 'schedule' as ActiveTab, label: t('navSchedule'), icon: Calendar },
    { id: 'records' as ActiveTab, label: t('navRecords'), icon: FileText }
  ];

  return (
    <aside className="w-64 bg-[#162a4a] text-white flex flex-col shrink-0 h-screen sticky top-0 select-none transition-all overflow-hidden border-r border-slate-800/40">
      {/* App Logo */}
      <div className="h-16 px-6 flex items-center gap-3 border-b border-slate-700/40 shrink-0">
        <div className="w-9 h-9 rounded-lg bg-[#22c55e] flex items-center justify-center text-white shadow-sm shrink-0">
          <FileSpreadsheet className="w-5 h-5 stroke-[2.2]" />
        </div>
        <span className="text-xl font-bold tracking-tight text-white font-sans">
          ClinicMS
        </span>
      </div>

      {/* Navigation List - Independent scroll if viewport height is small */}
      <div className="flex-1 px-3 py-6 space-y-1 overflow-y-auto scrollbar-thin">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-3 rounded-xl font-medium text-[15px] transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#2b446e] text-white shadow-inner font-semibold'
                  : 'text-slate-300 hover:bg-[#1f355c] hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-300'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span className="bg-emerald-500/20 text-emerald-300 text-xs px-2 py-0.5 rounded-full font-semibold">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>


    </aside>
  );
};

