import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CopyableTextProps {
  value: string;
  displayValue?: string;
  label?: string;
  color?: string;
  mono?: boolean;
  showIcon?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const CopyableText: React.FC<CopyableTextProps> = ({
  value,
  displayValue,
  label,
  color,
  mono = true,
  showIcon = true,
  className = '',
  style = {}
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!value) return;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(value);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = value;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = value;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const textToShow = displayValue !== undefined ? displayValue : value;

  return (
    <span
      onClick={handleCopy}
      title={copied ? 'คัดลอกแล้ว!' : `คลิกเพื่อคัดลอก ${label ? label + ' ' : ''}${value}`}
      className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-md hover:bg-blue-50 transition-all cursor-pointer select-none group relative ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        cursor: 'pointer',
        padding: '2px 6px',
        borderRadius: '6px',
        transition: 'background-color 0.15s ease',
        verticalAlign: 'middle',
        ...style
      }}
    >
      {label && (
        <span style={{ fontSize: '13px', color: '#64748B', fontWeight: '500' }}>
          {label}:
        </span>
      )}
      <span
        style={{
          fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' : 'inherit',
          fontWeight: '700',
          color: color || '#0F172A',
          letterSpacing: mono ? '0.2px' : 'normal'
        }}
      >
        {textToShow}
      </span>
      {showIcon && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: copied ? '#10B981' : '#3B82F6',
            transition: 'transform 0.15s ease, color 0.15s ease',
            flexShrink: 0
          }}
        >
          {copied ? (
            <Check size={14} strokeWidth={2.5} />
          ) : (
            <Copy size={13} strokeWidth={2.2} style={{ opacity: 0.8 }} />
          )}
        </span>
      )}
      {copied && (
        <span
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 4px)',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#1E293B',
            color: '#FFFFFF',
            fontSize: '11px',
            fontWeight: '600',
            padding: '2px 8px',
            borderRadius: '4px',
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            zIndex: 9999,
            pointerEvents: 'none'
          }}
        >
          คัดลอกแล้ว!
        </span>
      )}
    </span>
  );
};

export default CopyableText;
