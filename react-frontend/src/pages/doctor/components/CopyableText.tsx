import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface CopyableTextProps {
  /** ข้อความที่แสดงบนจอ */
  value: string;
  label?: string;
  className?: string;
  showIcon?: boolean;

  /** ข้อความที่จะคัดลอกจริง ถ้าไม่ส่งมาจะคัดลอกตามที่แสดง
   *  ใช้กับค่าที่จัดรูปแบบให้อ่านง่ายบนจอ แต่ระบบอื่นต้องการค่าดิบ
   *  เช่น เลขบัตรประชาชนที่โชว์ 1-2345-67890-12-3 แต่คัดลอกได้ 1234567890123 */
  copyValue?: string;
}

export const CopyableText: React.FC<CopyableTextProps> = ({
  value,
  label,
  className = '',
  showIcon = true,
  copyValue
}) => {
  const [copied, setCopied] = useState(false);
  const { language } = useLanguage();

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent parent clicks (e.g. card selection)
    const textToCopy = copyValue || value;
    if (!textToCopy) return;

    try {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback if clipboard API fails
      const textArea = document.createElement('textarea');
      textArea.value = textToCopy;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? (language === 'th' ? 'คัดลอกแล้ว!' : 'Copied!') : (language === 'th' ? `คลิกเพื่อคัดลอก ${label ? label + ' ' : ''}${value}` : `Click to copy ${label ? label + ' ' : ''}${value}`)}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md hover:bg-blue-100/80 hover:text-blue-700 transition-all cursor-pointer group relative ${className}`}
    >
      {label && <span className="font-medium text-slate-500 group-hover:text-blue-600">{label}:</span>}
      <span className="font-mono font-bold">{value}</span>
      {showIcon && (
        <span className="shrink-0 text-slate-400 group-hover:text-blue-600">
          {copied ? (
            <Check className="w-3.5 h-3.5 text-emerald-600 animate-in zoom-in duration-150" />
          ) : (
            <Copy className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" />
          )}
        </span>
      )}
      {copied && (
        <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-lg whitespace-nowrap animate-in fade-in slide-in-from-bottom-1 duration-150 z-50">
          {language === 'th' ? 'คัดลอกแล้ว!' : 'Copied!'}
        </span>
      )}
    </button>
  );
};
