import React, { useState, useRef, useEffect } from 'react';
import { Search, Bell, ChevronDown, Stethoscope, User, ChevronRight, X } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { Patient } from '../../types';
import { StatusBadge } from './StatusBadge';
import { generateVN } from '../../utils/vnGenerator';
import { matchPatientSearch } from '../../utils/searchUtils';

interface HeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  patients?: Patient[];
  onSelectPatientRecord?: (patient: Patient) => void;
  activeDoctorName?: string;
  onOpenSettings?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  setSearchQuery,
  patients = [],
  onSelectPatientRecord,
  activeDoctorName = 'Dr. Anong S.',
  onOpenSettings
}) => {
  const { language, t } = useLanguage();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Filter matching patients based on search query
  const matchingPatients = React.useMemo(() => {
    if (!searchQuery.trim()) return [];
    return patients.filter((p) => matchPatientSearch(p, searchQuery));
  }, [patients, searchQuery]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectPatient = (patient: Patient) => {
    setIsDropdownOpen(false);
    setSearchQuery('');
    if (onSelectPatientRecord) {
      onSelectPatientRecord(patient);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (matchingPatients.length > 0) {
        handleSelectPatient(matchingPatients[0]);
      }
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false);
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 px-8 flex items-center justify-between sticky top-0 z-20 shadow-xs shrink-0">
      {/* Search Input matching Figma pill design */}
      <div ref={searchContainerRef} className="relative w-full max-w-md flex items-center gap-3 z-30">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsDropdownOpen(true);
            }}
            onFocus={() => {
              if (searchQuery.trim()) setIsDropdownOpen(true);
            }}
            onKeyDown={handleKeyDown}
            placeholder={t('searchPlaceholder')}
            className="w-full pl-10 pr-8 py-2 bg-[#f4f7fa] text-slate-700 text-sm rounded-2xl border border-slate-200/90 hover:border-slate-300 focus:border-blue-400 focus:bg-white focus:outline-hidden transition-all placeholder:text-slate-400 font-sans shadow-2xs"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setIsDropdownOpen(false);
              }}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Search Results Dropdown Overlay */}
        {isDropdownOpen && searchQuery.trim() !== '' && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-200/90 overflow-hidden z-50 max-h-96 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150">
            <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between text-xs font-bold text-slate-500">
              <span>
                {language === 'th' ? `ผลการค้นหา (${matchingPatients.length})` : `Search Results (${matchingPatients.length})`}
              </span>
              <span className="text-[10px] font-normal text-slate-400">
                {language === 'th' ? 'คลิกเพื่อดูประวัติการรักษา' : 'Click to view medical history'}
              </span>
            </div>

            {matchingPatients.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {matchingPatients.slice(0, 6).map((patient) => {
                  const vnCode = patient.vn || generateVN(patient.visitDate, patient.visitTime, 1);
                  return (
                    <div
                      key={patient.id}
                      onClick={() => handleSelectPatient(patient)}
                      className="p-3 px-4 hover:bg-blue-50/70 transition-colors cursor-pointer flex items-center justify-between gap-3 group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform text-sm">
                          {patient.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-slate-900 group-hover:text-blue-700 transition-colors truncate">
                              {patient.name}
                            </span>
                            <StatusBadge status={patient.status} size="sm" />
                          </div>
                          <div className="text-xs font-mono text-slate-500 flex items-center gap-2 mt-0.5">
                            <span>HN: <strong>{patient.hn}</strong></span>
                            <span>•</span>
                            <span>VN: <strong>{vnCode}</strong></span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 text-xs font-bold text-blue-600 group-hover:translate-x-0.5 transition-transform shrink-0 bg-blue-50 group-hover:bg-blue-100 px-2.5 py-1 rounded-lg border border-blue-200/60">
                        <span>{language === 'th' ? 'ดูประวัติ' : 'View EMR'}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 text-center text-slate-400 space-y-1">
                <User className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs font-medium">
                  {language === 'th' ? `ไม่พบข้อมูลผู้ป่วยที่ตรงกับ "${searchQuery}"` : `No patients found matching "${searchQuery}"`}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Controls: Language Badge, Settings Button, Notifications & Profile */}
      <div className="flex items-center gap-3">
        {/* Bell Notification Icon */}
        <button className="relative p-2 rounded-full text-slate-500 hover:bg-slate-100 transition-colors focus:outline-hidden">
          <Bell className="w-5 h-5 text-slate-600" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"></span>
        </button>

        {/* Doctor Avatar & Profile */}
        <div className="flex items-center gap-3 pl-2 border-l border-slate-200">
          <div className="relative w-10 h-10 rounded-full bg-slate-100 overflow-hidden border border-slate-200 shrink-0">
            <img
              src="https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80&w=200"
              alt="Doctor Avatar"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <div className="absolute inset-0 bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs">
              <Stethoscope className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          
          <div className="text-left hidden sm:block">
            <div className="text-sm font-bold text-slate-800 leading-tight">
              {activeDoctorName}
            </div>
            <div className="text-[12px] text-slate-500 font-medium">
              {t('doctorTitle')}
            </div>
          </div>

          <ChevronDown className="w-4 h-4 text-slate-400 cursor-pointer hidden sm:block" />
        </div>
      </div>
    </header>
  );
};

