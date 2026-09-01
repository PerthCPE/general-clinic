/**
 * Thai National ID (13 Digits) Modulo 11 Checksum Validator
 * Based on official Department of Provincial Administration (DOPA) & NHSO (สปสช.) standard algorithm.
 */

export interface ThaiIdValidationResult {
  isValid: boolean;
  isComplete: boolean;
  message: string;
  formatted: string;
  raw: string;
}

/**
 * Validate a Thai National ID string using Modulo 11 Checksum
 * @param idStr Thai ID string (with or without dashes)
 */
export function validateThaiNationalID(idStr: string): ThaiIdValidationResult {
  // Strip non-digits
  const raw = (idStr || '').replace(/\D/g, '');

  // Format as X-XXXX-XXXXX-XX-X for display
  let formatted = raw;
  if (raw.length > 0) {
    const parts = [
      raw.substring(0, 1),
      raw.substring(1, 5),
      raw.substring(5, 10),
      raw.substring(10, 12),
      raw.substring(12, 13),
    ].filter(Boolean);
    formatted = parts.join('-');
  }

  if (raw.length === 0) {
    return {
      isValid: false,
      isComplete: false,
      message: 'กรุณาระบุเลขบัตรประชาชน 13 หลัก',
      formatted: '',
      raw: '',
    };
  }

  if (raw.length < 13) {
    return {
      isValid: false,
      isComplete: false,
      message: `ระบุแล้ว ${raw.length}/13 หลัก`,
      formatted,
      raw,
    };
  }

  if (raw.length > 13) {
    return {
      isValid: false,
      isComplete: false,
      message: 'เลขบัตรประชาชนเกิน 13 หลัก',
      formatted,
      raw: raw.substring(0, 13),
    };
  }

  // First digit cannot be 0 in standard Thai ID
  if (raw[0] === '0') {
    return {
      isValid: false,
      isComplete: true,
      message: 'เลขหลักแรกต้องไม่เป็น 0',
      formatted,
      raw,
    };
  }

  // Modulo 11 Checksum Calculation
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(raw.charAt(i), 10) * (13 - i);
  }

  const checkDigit = (11 - (sum % 11)) % 10;
  const lastDigit = parseInt(raw.charAt(12), 10);

  if (checkDigit === lastDigit) {
    return {
      isValid: true,
      isComplete: true,
      message: 'เลขบัตรประชาชนถูกต้องตามมาตรฐาน สปสช.',
      formatted,
      raw,
    };
  } else {
    return {
      isValid: false,
      isComplete: true,
      message: 'เลขบัตรประชาชนไม่ถูกต้อง (Checksum ไม่ตรง)',
      formatted,
      raw,
    };
  }
}
