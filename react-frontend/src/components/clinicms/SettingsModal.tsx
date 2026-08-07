import React from 'react';
import { Settings, Globe, Check, X, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { useLanguage, Language } from '../../context/LanguageContext';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { language, setLanguage, t } = useLanguage();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-6 transform transition-all scale-100">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shadow-xs">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                {t('settingsTitle')}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {language === 'th' ? 'การตั้งค่าและเลือกภาษาการแสดงผล' : 'Preferences and system display language'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content - Language Selection Section */}
        <div className="space-y-4">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  ภาษาของระบบ (Default)
                </h3>
                <p className="text-xs text-slate-500">
                  ระบบถูกตั้งค่าให้แสดงผลเป็นภาษาไทยสำหรับระบบคลินิกเวชกรรม
                </p>
              </div>
            </div>

            {/* Thai Only Info Card */}
            <div className="pt-1">
              <div className="p-3.5 rounded-xl border border-blue-500 bg-blue-50/80 ring-2 ring-blue-500/20 text-blue-900 font-bold shadow-xs flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">🇹🇭</span>
                  <div>
                    <div className="text-xs font-bold">ภาษาไทย (Thai Language)</div>
                    <div className="text-[10px] text-slate-600 font-normal">ภาษาหลักของระบบจัดการคลินิก</div>
                  </div>
                </div>
                <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              </div>
            </div>
          </div>

          {/* Additional Info Box */}
          <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-xs text-blue-900 flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              ระบบพร้อมใช้งานในรูปแบบภาษาไทยครบถ้วนตามมาตรฐานคลินิกไทย
            </span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            <span>{t('closeAndSave')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
