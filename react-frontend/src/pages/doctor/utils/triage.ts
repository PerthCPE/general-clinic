/**
 * ==============================================================================
 * ระดับการคัดแยกผู้ป่วย (Triage) - สีและชื่อระดับ [role แพทย์]
 * ==============================================================================
 * แยกออกมาเป็นไฟล์กลาง เพราะตอนนี้ใช้ 2 ที่ (ตารางคิวผู้ป่วย และหน้าอื่นๆ)
 * ถ้าปล่อยให้ต่างคนต่างประกาศ เดี๋ยวสีกับชื่อระดับจะเพี้ยนไปคนละทาง
 *
 * ค่าสีชุดนี้ตรงกับ TRIAGE_LEVELS ใน
 * react-frontend/src/pages/Vitals/components/TriageWidget.tsx (จอพยาบาล)
 * เพื่อให้ระดับเดียวกันเป็นสีเดียวกันทั้งจอพยาบาลและจอแพทย์
 * แดง = วิกฤต, ส้ม = เร่งด่วน, เหลือง = กึ่งฉุกเฉิน, เขียว = ปกติ
 *
 * key คือค่าที่ backend ส่งมาใน screening.triage_code
 * (ดู triageInfo ใน golang-backend/internal/controllers/doctor_controller.go)
 * ถ้าเพิ่มระดับใหม่ ต้องเพิ่มทั้ง TRIAGE_TONES และ TRIAGE_LABELS ให้ตรงกัน
 */
export type TriageTone = { dot: string; bg: string; border: string; text: string };

export const TRIAGE_TONES: Record<string, TriageTone> = {
  'Level 1: Resuscitation': { dot: '#EF4444', bg: '#FEE2E2', border: '#FCA5A5', text: '#7F1D1D' },
  'Level 2: Emergency':     { dot: '#F97316', bg: '#FFEDD5', border: '#FDBA74', text: '#7C2D12' },
  'Level 3: Urgent':        { dot: '#EAB308', bg: '#FEF9C3', border: '#FDE047', text: '#713F12' },
  'Level 4: Less Urgent':   { dot: '#10B981', bg: '#D1FAE5', border: '#6EE7B7', text: '#064E3B' },
  'Level 5: Non-Urgent':    { dot: '#10B981', bg: '#D1FAE5', border: '#6EE7B7', text: '#064E3B' },
};

/** สีเทา สำหรับเคสที่ยังไม่ได้คัดกรอง หรือได้ค่าที่ไม่รู้จัก */
export const TRIAGE_TONE_UNKNOWN: TriageTone = {
  dot: '#94A3B8', bg: '#F1F5F9', border: '#CBD5E1', text: '#0F172A',
};

export function triageTone(level: string | undefined): TriageTone {
  if (!level) return TRIAGE_TONE_UNKNOWN;
  return TRIAGE_TONES[level] || TRIAGE_TONE_UNKNOWN;
}

/**
 * ชื่อระดับความรุนแรง ให้ตรงกับที่พยาบาลเห็นที่จุดคัดกรองเป๊ะๆ
 * แพทย์กับพยาบาลจะได้พูดถึงระดับเดียวกันด้วยคำเดียวกัน
 */
export const TRIAGE_LABELS: Record<string, { th: string; en: string }> = {
  'Level 1: Resuscitation': { th: 'ฉุกเฉินวิกฤต (Level 1)',     en: 'Resuscitation (Level 1)' },
  'Level 2: Emergency':     { th: 'ฉุกเฉินเร่งด่วน (Level 2)',   en: 'Emergency (Level 2)' },
  'Level 3: Urgent':        { th: 'กึ่งฉุกเฉิน (Level 3)',       en: 'Semi-Urgent (Level 3)' },
  'Level 4: Less Urgent':   { th: 'ไม่ฉุกเฉิน / ปกติ (Level 4)', en: 'Non-Urgent (Level 4)' },
  'Level 5: Non-Urgent':    { th: 'ไม่ฉุกเฉิน / ปกติ (Level 4)', en: 'Non-Urgent (Level 4)' },
};

/**
 * ชื่อระดับแบบสั้น สำหรับที่แคบๆ อย่างในตารางคิว
 * เอาแค่คำไทย ไม่ต้องมีวงเล็บ Level ต่อท้าย เพราะสีบอกระดับอยู่แล้ว
 */
export const TRIAGE_SHORT_LABELS: Record<string, { th: string; en: string }> = {
  'Level 1: Resuscitation': { th: 'ฉุกเฉินวิกฤต',   en: 'Resuscitation' },
  'Level 2: Emergency':     { th: 'ฉุกเฉินเร่งด่วน', en: 'Emergency' },
  'Level 3: Urgent':        { th: 'กึ่งฉุกเฉิน',     en: 'Semi-Urgent' },
  'Level 4: Less Urgent':   { th: 'ไม่ฉุกเฉิน',      en: 'Non-Urgent' },
  'Level 5: Non-Urgent':    { th: 'ไม่ฉุกเฉิน',      en: 'Non-Urgent' },
};

/**
 * คืนชื่อระดับที่จะแสดง ถ้ายังไม่มีการคัดกรองให้คืน undefined
 * ห้ามใส่ค่า default เป็น Level 4 เพราะจะทำให้เคสที่ยังไม่ได้ประเมิน
 * ดูเหมือนถูกประเมินแล้วว่าไม่ฉุกเฉิน
 */
export function triageLabel(level: string | undefined, lang: string): string | undefined {
  if (!level) return undefined;
  const found = TRIAGE_LABELS[level];
  if (!found) return level;
  return lang === 'th' ? found.th : found.en;
}

export function triageShortLabel(level: string | undefined, lang: string): string | undefined {
  if (!level) return undefined;
  const found = TRIAGE_SHORT_LABELS[level];
  if (!found) return level;
  return lang === 'th' ? found.th : found.en;
}

/**
 * เลขระดับ (1-5) ไว้เรียงลำดับความเร่งด่วน เลขน้อย = ด่วนกว่า
 * เคสที่ยังไม่ได้คัดกรองคืน 99 เพื่อให้ไปอยู่ท้ายสุด
 */
export function triageRank(level: string | undefined): number {
  if (!level) return 99;
  const m = level.match(/Level\s*(\d)/);
  return m ? Number(m[1]) : 99;
}
