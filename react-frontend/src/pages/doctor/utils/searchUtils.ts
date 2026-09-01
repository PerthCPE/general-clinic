import type { Patient } from '../types';

/**
 * Returns the national ID of a patient, or a fallback format if not explicitly set.
 */
export function getPatientNationalId(patient: { id?: string; nationalId?: string }): string {
  if (patient.nationalId) return patient.nationalId;
  const suffix = patient.id ? patient.id.replace(/\D/g, '') : '0';
  const num = parseInt(suffix || '0', 10);
  return `1-1002-34567-89-${num}`;
}

/**
 * Utility to match search queries against Patient fields including:
 * - Full Name
 * - HN (Hospital Number)
 * - VN (Visit Number)
 * - Queue Number
 * - Phone Number
 * - National ID (เลขบัตรประชาชน)
 * - Chief Complaint / Diagnosis
 * Supports raw string matching, dashes/spaces stripped matching, and digit-only matching.
 */
export function matchPatientSearch(patient: Patient, searchQuery: string): boolean {
  if (!searchQuery || !searchQuery.trim()) return true;

  const rawTerm = searchQuery.trim().toLowerCase();
  const cleanTerm = rawTerm.replace(/[-_ :,.]/g, '');
  const digitsOnlyTerm = rawTerm.replace(/\D/g, '');

  const name = (patient.name || '').toLowerCase();
  const hn = (patient.hn || '').toLowerCase();
  const cleanHn = hn.replace(/\D/g, '');

  const vn = (patient.vn || '').toLowerCase();
  const cleanVn = vn.replace(/\D/g, '');

  const queueNo = (patient.queueNo || '').toLowerCase();

  const phone = (patient.phone || '').toLowerCase();
  const cleanPhone = phone.replace(/\D/g, '');

  const nationalId = getPatientNationalId(patient).toLowerCase();
  const cleanNationalId = nationalId.replace(/\D/g, '');

  const chiefComplaint = (patient.chiefComplaint || '').toLowerCase();
  const diagnosis = (patient.diagnosis || '').toLowerCase();

  // 1. Direct raw substring match
  if (
    name.includes(rawTerm) ||
    hn.includes(rawTerm) ||
    vn.includes(rawTerm) ||
    queueNo.includes(rawTerm) ||
    phone.includes(rawTerm) ||
    nationalId.includes(rawTerm) ||
    chiefComplaint.includes(rawTerm) ||
    diagnosis.includes(rawTerm)
  ) {
    return true;
  }

  // 2. Clean alphanumeric match (ignoring dashes, spaces, symbols)
  if (cleanTerm) {
    if (
      name.replace(/[-_ :,.]/g, '').includes(cleanTerm) ||
      hn.replace(/[-_ :,.]/g, '').includes(cleanTerm) ||
      vn.replace(/[-_ :,.]/g, '').includes(cleanTerm) ||
      phone.replace(/[-_ :,.]/g, '').includes(cleanTerm) ||
      nationalId.replace(/[-_ :,.]/g, '').includes(cleanTerm)
    ) {
      return true;
    }
  }

  // 3. Digits-only match (for National ID, HN, VN, Phone)
  if (digitsOnlyTerm.length >= 2) {
    if (
      cleanNationalId.includes(digitsOnlyTerm) ||
      (cleanHn && cleanHn.includes(digitsOnlyTerm)) ||
      (cleanVn && cleanVn.includes(digitsOnlyTerm)) ||
      (cleanPhone && cleanPhone.includes(digitsOnlyTerm))
    ) {
      return true;
    }
  }

  return false;
}
