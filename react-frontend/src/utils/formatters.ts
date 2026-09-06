/**
 * Clinical Code & Identifier Formatters for General Clinic System
 * Strictly enforces Hexadecimal 4-digit standard for HN/Queue,
 * and 13-digit Thai National ID / 10-digit Phone formats.
 */

// 1. Hospital Number (HN) Formatter: HN + 4-digit Decimal (HN0001 - HN9999)
export const formatHN = (raw: string | number | undefined | null): string => {
  if (!raw) return 'HN0001';
  if (typeof raw === 'number' && raw > 0) {
    return 'HN' + String(raw).padStart(4, '0');
  }
  const str = String(raw).trim();
  if (/^HN\d{4,}$/i.test(str)) {
    return str.toUpperCase();
  }
  const digits = str.replace(/\D/g, '');
  if (digits.length > 0) {
    return 'HN' + digits.padStart(4, '0');
  }
  const clean = str.replace(/^HN-?/i, '');
  if (clean.length > 0) {
    return 'HN' + clean.toUpperCase();
  }
  return 'HN0001';
};

// 2. Queue Number Formatter: Q + 4-digit Uppercase Hex (Q0001 - QFFFF)
export const formatQueueNo = (raw: string | number | undefined | null): string => {
  if (!raw) return 'Q0001';
  if (typeof raw === 'string' && /^Q[0-9A-Fa-f]{4}$/i.test(raw)) {
    return raw.toUpperCase();
  }
  const num = parseInt(String(raw).replace(/\D/g, ''), 10);
  if (!isNaN(num) && num > 0) {
    return 'Q' + num.toString(16).toUpperCase().padStart(4, '0');
  }
  return String(raw || 'Q0001');
};

// 3. National ID Formatter: 13-digit Thai standard with hyphens: X-XXXX-XXXXX-XX-X
export const formatNationalId = (raw: string | number | undefined | null): string => {
  if (!raw) return '-';
  const clean = String(raw).replace(/\D/g, '');
  if (clean.length === 13) {
    return `${clean[0]}-${clean.slice(1, 5)}-${clean.slice(5, 10)}-${clean.slice(10, 12)}-${clean[12]}`;
  }
  return String(raw);
};

// 4. Phone Number Formatter: 10-digit standard (XXX-XXX-XXXX) or 9-digit landline (02-XXX-XXXX)
export const formatPhone = (raw: string | number | undefined | null): string => {
  if (!raw) return '-';
  const clean = String(raw).replace(/\D/g, '');
  if (clean.length === 10) {
    return `${clean.slice(0, 3)}-${clean.slice(3, 6)}-${clean.slice(6, 10)}`;
  }
  if (clean.length === 9) {
    if (clean.startsWith('02')) {
      return `${clean.slice(0, 2)}-${clean.slice(2, 5)}-${clean.slice(5, 9)}`;
    }
    return `${clean.slice(0, 3)}-${clean.slice(3, 6)}-${clean.slice(6, 9)}`;
  }
  return String(raw);
};
