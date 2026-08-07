import React, { useState } from 'react';
import { X, ExternalLink, Copy, Check, Sparkles, Layers, Download, Globe, Code2 } from 'lucide-react';

interface FigmaExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  appUrl: string;
}

export const FigmaExportModal: React.FC<FigmaExportModalProps> = ({
  isOpen,
  onClose,
  appUrl
}) => {
  const [copiedType, setCopiedType] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2500);
  };

  // SVGs for instant paste into Figma
  const badgeWaitingSVG = `<svg width="84" height="26" viewBox="0 0 84 26" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="84" height="26" rx="13" fill="#DCFCE7"/>
  <rect x="0.5" y="0.5" width="83" height="25" rx="12.5" stroke="#BBF7D0" stroke-opacity="0.6"/>
  <text x="42" y="17" fill="#15803D" font-family="Inter, system-ui, sans-serif" font-size="12" font-weight="600" text-anchor="middle">Waiting</text>
</svg>`;

  const badgeExaminingSVG = `<svg width="98" height="26" viewBox="0 0 98 26" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="98" height="26" rx="13" fill="#DBEAFE"/>
  <rect x="0.5" y="0.5" width="97" height="25" rx="12.5" stroke="#BFDBFE" stroke-opacity="0.6"/>
  <text x="49" y="17" fill="#1E40AF" font-family="Inter, system-ui, sans-serif" font-size="12" font-weight="600" text-anchor="middle">Examining</text>
</svg>`;

  const examineButtonSVG = `<svg width="102" height="32" viewBox="0 0 102 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="102" height="32" rx="8" fill="#2563EB"/>
  <text x="51" y="20" fill="WHITE" font-family="Inter, system-ui, sans-serif" font-size="12" font-weight="600" text-anchor="middle">Examine</text>
</svg>`;

  const statCardSVG = `<svg width="280" height="96" viewBox="0 0 280 96" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="280" height="96" rx="16" fill="white" stroke="#E2E8F0"/>
  <text x="24" y="38" fill="#475569" font-family="Inter, system-ui, sans-serif" font-size="14" font-weight="500">Total Patients Today</text>
  <text x="24" y="74" fill="#0F172A" font-family="Inter, system-ui, sans-serif" font-size="32" font-weight="700">25</text>
  <rect x="208" y="24" width="48" height="48" rx="12" fill="#E8F0FE"/>
  <path d="M228 41C229.657 41 231 39.6569 231 38C231 36.3431 229.657 35 228 35C226.343 35 225 36.3431 225 38C225 39.6569 226.343 41 228 41Z" stroke="#2563EB" stroke-width="2"/>
  <path d="M220 53C220 49.6863 222.686 47 226 47H230C233.314 47 236 49.6863 236 53" stroke="#2563EB" stroke-width="2" stroke-linecap="round"/>
</svg>`;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#162a4a] to-[#1e3a68] text-white p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/30 border border-blue-400/30 flex items-center justify-center text-white font-bold">
              <Layers className="w-5 h-5 text-blue-300" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>นำเข้าทั้งหน้าเข้า Figma (Figma Exporter)</span>
                <span className="text-[10px] bg-emerald-500/30 text-emerald-300 px-2 py-0.5 rounded-full font-mono">
                  Recommended
                </span>
              </h3>
              <p className="text-xs text-slate-300">
                แปลงหน้าเว็บ ClinicMS นี้เป็น Figma Component & Vector Layers แบบอัตโนมัติ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-300 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Method 1: URL Import via Figma Plugin */}
          <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 text-blue-900 font-bold text-base">
                <Globe className="w-5 h-5 text-blue-600" />
                <span>วิธีที่ 1: ดึงทั้งหน้าขึ้น Figma (Auto Layout & Layers)</span>
              </div>
              <span className="text-xs font-semibold bg-blue-600 text-white px-2.5 py-0.5 rounded-full">
                เร็วที่สุด
              </span>
            </div>

            <p className="text-xs text-blue-950 leading-relaxed">
              คุณสามารถนำ URL ของหน้าเว็บนี้ไปใส่ในปลั๊กอิน Figma เพื่อแปลงทั้งหน้าจอเป็น Layer ใน Figma ได้แบบ 100%:
            </p>

            {/* URL Box */}
            <div className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-blue-200 shadow-2xs">
              <input
                type="text"
                readOnly
                value={appUrl}
                className="w-full text-xs font-mono text-slate-700 bg-transparent focus:outline-hidden"
              />
              <button
                onClick={() => handleCopy(appUrl, 'url')}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shrink-0 flex items-center gap-1.5 transition-all"
              >
                {copiedType === 'url' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedType === 'url' ? 'คัดลอกแล้ว!' : 'คัดลอก URL'}</span>
              </button>
            </div>

            {/* Steps */}
            <div className="bg-white/80 p-4 rounded-xl border border-blue-100 text-xs text-slate-700 space-y-2">
              <div className="font-bold text-slate-900 mb-1">ขั้นตอนใน Figma:</div>
              <ol className="list-decimal list-inside space-y-1.5 text-slate-600">
                <li>เปิดไฟล์ใน Figma แล้วไปที่ <strong>Plugins</strong></li>
                <li>ค้นหาปลั๊กอินชื่อ <strong><a href="https://www.figma.com/community/plugin/1159828230538028724/html-to-design" target="_blank" rel="noreferrer" className="text-blue-600 underline">html.to.design</a></strong> หรือ <strong><a href="https://www.figma.com/community/plugin/747985167520967365" target="_blank" rel="noreferrer" className="text-blue-600 underline">Builder.io</a></strong></li>
                <li>วาง URL ที่คัดลอกด้านบน แล้วกด <strong>Import</strong></li>
                <li>คุณจะได้ Frame และ Component ทั้งหมดของ ClinicMS พร้อม Auto Layout ทันที!</li>
              </ol>
            </div>
          </div>

          {/* Method 2: Instant SVG Vector Component Copy */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <Code2 className="w-4 h-4 text-emerald-600" />
              <span>วิธีที่ 2: คัดลอก SVG Component ไปวางใน Figma (Direct Paste)</span>
            </div>
            <p className="text-xs text-slate-500">
              กดปุ่มคัดลอก SVG ด้านล่าง แล้วสลับไปที่ Figma แล้วกด <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">Ctrl + V</code> (หรือ <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">Cmd + V</code>) เพื่อวางเวกเตอร์คอมโพเนนต์ได้ทันที:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Stat Card SVG */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-800">Quick Stat Tile</div>
                  <div className="text-[11px] text-slate-400">Card vector with icon</div>
                </div>
                <button
                  onClick={() => handleCopy(statCardSVG, 'statcard_svg')}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg flex items-center gap-1.5"
                >
                  {copiedType === 'statcard_svg' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedType === 'statcard_svg' ? 'Copied SVG' : 'Copy SVG'}</span>
                </button>
              </div>

              {/* Waiting Badge SVG */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-800">Status Badge (Waiting)</div>
                  <div className="text-[11px] text-slate-400">Pill vector component</div>
                </div>
                <button
                  onClick={() => handleCopy(badgeWaitingSVG, 'badge_waiting')}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg flex items-center gap-1.5"
                >
                  {copiedType === 'badge_waiting' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedType === 'badge_waiting' ? 'Copied SVG' : 'Copy SVG'}</span>
                </button>
              </div>

              {/* Examining Badge SVG */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-800">Status Badge (Examining)</div>
                  <div className="text-[11px] text-slate-400">Blue pill vector</div>
                </div>
                <button
                  onClick={() => handleCopy(badgeExaminingSVG, 'badge_examining')}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg flex items-center gap-1.5"
                >
                  {copiedType === 'badge_examining' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedType === 'badge_examining' ? 'Copied SVG' : 'Copy SVG'}</span>
                </button>
              </div>

              {/* Examine Button SVG */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-800">Examine Action Button</div>
                  <div className="text-[11px] text-slate-400">Blue primary button</div>
                </div>
                <button
                  onClick={() => handleCopy(examineButtonSVG, 'examine_btn')}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg flex items-center gap-1.5"
                >
                  {copiedType === 'examine_btn' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedType === 'examine_btn' ? 'Copied SVG' : 'Copy SVG'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Figma Compatible • Pixel-perfect auto-layout components
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
