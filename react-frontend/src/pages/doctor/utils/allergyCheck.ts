/**
 * ==============================================================================
 * ตรวจว่ายาที่สั่ง ชนกับประวัติแพ้ยาของผู้ป่วยหรือไม่ [role แพทย์]
 * ==============================================================================
 * ของเดิมเขียนไว้บรรทัดเดียวใน ExaminationView:
 *
 *     rx.medicineName.toLowerCase().includes(allergyText.toLowerCase())
 *
 * ซึ่งจะเจอก็ต่อเมื่อ "ข้อความแพ้ยาทั้งก้อน" เป็นส่วนหนึ่งของชื่อยาเป๊ะๆ
 * พอเจอข้อมูลจริงจากจุดคัดกรองจึงพลาดแทบทุกกรณี เพราะพยาบาลพิมพ์อิสระ เช่น
 *
 *     "Penicillin (ผื่นลมพิษ)"   -> ชื่อยา "Penicillin" ไม่มีคำว่า "(ผื่นลมพิษ)"  = ไม่เจอ
 *     "แพ้ยา Penicillin"         -> ชื่อยาไม่มีคำว่า "แพ้ยา"                      = ไม่เจอ
 *     "เพนนิซิลลิน"              -> คนละภาษากับชื่อยาในคลัง                        = ไม่เจอ
 *     "Amoxicillin"              -> สั่ง "Penicillin" ยากลุ่มเดียวกัน              = ไม่เจอ
 *
 * ทั้ง 4 กรณีคือผู้ป่วยได้ยาที่ตัวเองแพ้ โดยระบบไม่เตือนอะไรเลย
 *
 * ไฟล์นี้แก้ด้วยการเทียบ 4 ชั้น เรียงจากมั่นใจมากไปน้อย
 *   1. ตัดคำขยะออกก่อน (แพ้, ยา, ผื่น, คัน, mg, tab ฯลฯ) เหลือแต่ชื่อตัวยา
 *   2. เทียบสองทาง ชื่อยาอยู่ในข้อความแพ้ หรือข้อความแพ้อยู่ในชื่อยา ก็นับ
 *   3. แปลงคำทับศัพท์ไทยเป็นชื่อสากลก่อนเทียบ
 *   4. เทียบ "กลุ่มยา" เผื่อแพ้ข้ามตัวในกลุ่มเดียวกัน (cross-reactivity)
 *
 * ระดับการเตือนแยกเป็น 2 แบบ ไม่เท่ากัน เพราะทางการแพทย์ไม่เหมือนกัน
 *   exact = ตัวเดียวกับที่แพ้           -> ห้ามสั่ง ต้องแก้ก่อนถึงจะปิดเคสได้
 *   group = คนละตัวแต่กลุ่มเดียวกัน     -> เตือนให้ตัดสินใจ แพทย์ยืนยันสั่งต่อได้
 *
 * ทำไม group ต้องให้สั่งต่อได้: การแพ้ข้ามกลุ่มเป็นเรื่องของ "ความน่าจะเป็น"
 * ไม่ใช่ข้อห้ามเด็ดขาด เช่นแพ้ penicillin แล้วใช้ cephalosporin ได้ในหลายกรณี
 * ถ้าบล็อกตายตัว แพทย์จะสั่งยาที่ควรสั่งไม่ได้ แล้วสุดท้ายจะเลิกเชื่อคำเตือน
 */

export type AllergyMatchKind = 'exact' | 'group';

export interface AllergyConflict {
  /** ชื่อยาที่สั่งไป ตามที่แสดงในใบสั่งยา */
  medicineName: string;
  /** ข้อความประวัติแพ้ยาที่ทำให้เจอ (ข้อความดิบจากจุดคัดกรอง) */
  allergyText: string;
  kind: AllergyMatchKind;
  /** ชื่อกลุ่มยา ใช้เฉพาะ kind = 'group' */
  groupName?: string;
}

/**
 * คำที่ไม่ใช่ชื่อตัวยา ต้องตัดทิ้งก่อนเทียบ
 * ถ้าไม่ตัด คำว่า "ยา" ในข้อความแพ้จะไปแมตช์กับชื่อยาทุกตัวที่มีคำว่า "ยา"
 */
const NOISE_WORDS = new Set([
  // ไทย
  'แพ้', 'ยา', 'ประวัติ', 'อาการ', 'ผื่น', 'คัน', 'ลมพิษ', 'บวม', 'แดง',
  'หอบ', 'แน่นหน้าอก', 'คลื่นไส้', 'อาเจียน', 'ท้องเสีย', 'เม็ด', 'แคปซูล',
  'น้ำ', 'ฉีด', 'กิน', 'ทา', 'ชนิด', 'กลุ่ม', 'และ', 'กับ', 'หรือ', 'ไม่',
  'ปฏิเสธ', 'เคย', 'สงสัย',
  // อังกฤษ
  'allergy', 'allergies', 'allergic', 'drug', 'drugs', 'medicine', 'med',
  'rash', 'itching', 'itchy', 'hives', 'urticaria', 'swelling', 'edema',
  'nausea', 'vomiting', 'diarrhea', 'anaphylaxis', 'reaction', 'history',
  'tab', 'tabs', 'tablet', 'tablets', 'cap', 'caps', 'capsule', 'capsules',
  'syrup', 'susp', 'suspension', 'inj', 'injection', 'oral', 'iv', 'im',
  'mg', 'mcg', 'ml', 'gm', 'g', 'and', 'or', 'no', 'none', 'nka', 'nkda',
]);

/**
 * คำทับศัพท์ไทยที่พยาบาลพิมพ์บ่อย -> ชื่อสากล
 * เก็บเฉพาะตัวที่เจอจริงในคลังยาของคลินิก ไม่ต้องครบทุกตัวในโลก
 * สะกดได้หลายแบบจึงใส่ทุกแบบที่พบ (เพนนิซิลลิน / เพนิซิลลิน)
 */
const THAI_DRUG_ALIASES: Record<string, string> = {
  'เพนนิซิลลิน': 'penicillin',
  'เพนิซิลลิน': 'penicillin',
  'เพนนิซิลิน': 'penicillin',
  'อะม็อกซี่ซิลลิน': 'amoxicillin',
  'อะม็อกซิลลิน': 'amoxicillin',
  'อะมอกซีซิลลิน': 'amoxicillin',
  'แอมพิซิลลิน': 'ampicillin',
  'พาราเซตามอล': 'paracetamol',
  'พารา': 'paracetamol',
  'ไอบูโพรเฟน': 'ibuprofen',
  'แอสไพริน': 'aspirin',
  'ซัลฟา': 'sulfa',
  'ซัลฟาไดอะซีน': 'sulfadiazine',
  'เตตราไซคลีน': 'tetracycline',
  'ด็อกซีไซคลีน': 'doxycycline',
  'อิริโทรมัยซิน': 'erythromycin',
  'อะซิโทรมัยซิน': 'azithromycin',
  'เซฟาเลกซิน': 'cephalexin',
  'ไดโคลฟีแนค': 'diclofenac',
  'ทรามาดอล': 'tramadol',
  'มอร์ฟีน': 'morphine',
  'ไอโอดีน': 'iodine',
};

/**
 * กลุ่มยาที่แพ้ข้ามตัวกันได้ (cross-reactivity)
 * ใช้ตอบคำถามว่า "แพ้ A แล้วสั่ง B ควรเตือนไหม"
 *
 * หมายเหตุ: penicillin กับ cephalosporin แยกกลุ่มกันโดยตั้งใจ
 * เพราะอัตราการแพ้ข้ามระหว่างสองกลุ่มนี้ต่ำกว่าการแพ้ข้ามภายในกลุ่มเดียวกันมาก
 * ถ้ารวมเป็นกลุ่มเดียวจะเตือนบ่อยเกินจนแพทย์เลิกอ่าน
 */
const DRUG_GROUPS: { name: string; members: string[] }[] = [
  {
    name: 'Penicillin',
    members: [
      'penicillin', 'amoxicillin', 'ampicillin', 'cloxacillin', 'dicloxacillin',
      'piperacillin', 'augmentin', 'amoxyclav', 'coamoxiclav',
    ],
  },
  {
    name: 'Cephalosporin',
    members: [
      'cephalexin', 'cefalexin', 'cefazolin', 'ceftriaxone', 'cefixime',
      'cefdinir', 'cefuroxime', 'ceftazidime', 'cefotaxime',
    ],
  },
  {
    name: 'Sulfonamide',
    members: [
      'sulfa', 'sulfamethoxazole', 'sulfadiazine', 'cotrimoxazole',
      'trimethoprim', 'bactrim',
    ],
  },
  {
    name: 'NSAIDs',
    members: [
      'ibuprofen', 'aspirin', 'diclofenac', 'naproxen', 'mefenamic',
      'ketorolac', 'piroxicam', 'celecoxib', 'indomethacin', 'meloxicam',
    ],
  },
  {
    name: 'Quinolone',
    members: [
      'ciprofloxacin', 'norfloxacin', 'ofloxacin', 'levofloxacin', 'moxifloxacin',
    ],
  },
  {
    name: 'Macrolide',
    members: [
      'erythromycin', 'azithromycin', 'clarithromycin', 'roxithromycin',
    ],
  },
  {
    name: 'Tetracycline',
    members: ['tetracycline', 'doxycycline', 'minocycline'],
  },
];

/**
 * ข้อความปฏิเสธการแพ้ยา นับเป็น "ไม่มี" ไม่ใช่ชื่อยา
 * ต้องกันไว้ ไม่งั้น "ปฏิเสธการแพ้ยา" จะถูกซอยเป็นคำแล้วเอาไปเทียบมั่ว
 */
function isDenial(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return true;
  return /^(-|--|n\/?a|no|none|nil|nka|nkda)$/.test(t)
    || /ปฏิเสธ|ไม่มี|ไม่แพ้|no known|denies|denied/i.test(t);
}

/**
 * แปลงคำทับศัพท์ไทยเป็นชื่อสากล
 *
 * ต้องเช็คแบบ "มีคำนี้อยู่ข้างในไหม" ด้วย ไม่ใช่เทียบเท่ากันอย่างเดียว
 * เพราะภาษาไทยไม่เว้นวรรคระหว่างคำ พยาบาลพิมพ์ "แพ้ยาเพนนิซิลลิน" ติดกันหมด
 * ตัดด้วยช่องว่างแล้วจึงได้ก้อนเดียว ไม่มีทางตรงกับ key ในตารางได้เลย
 */
function resolveAlias(word: string): string {
  const exact = THAI_DRUG_ALIASES[word];
  if (exact) return exact;

  for (const [thai, english] of Object.entries(THAI_DRUG_ALIASES)) {
    if (word.includes(thai)) return english;
  }
  return word;
}

/**
 * ตัดวงเล็บ เครื่องหมาย และตัวเลขทิ้ง เหลือแต่คำ
 * เก็บทั้งอักษรไทยและอังกฤษ เพราะข้อมูลจริงปนกันสองภาษาในช่องเดียว
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')            // ตัดคำอธิบายในวงเล็บ เช่น (ผื่นลมพิษ)
    .replace(/[^a-z฀-๿]+/g, ' ') // เหลือแต่ตัวอักษรไทย/อังกฤษ ตัดตัวเลขและสัญลักษณ์
    .split(' ')
    .map((w) => w.trim())
    .filter(Boolean)
    .map(resolveAlias)
    .filter((w) => !NOISE_WORDS.has(w))
    // คำสั้นกว่า 4 ตัวอักษรไม่เอา กันแมตช์มั่ว เช่น "ยา" หรือ "gm"
    // ชื่อตัวยาจริงสั้นสุดที่เจอในคลังคือ 4 ตัวอักษร
    .filter((w) => w.length >= 4);
}

/** คำนี้อยู่ในกลุ่มยาไหน คืน null ถ้าไม่รู้จัก */
function groupOf(word: string): string | null {
  for (const group of DRUG_GROUPS) {
    for (const member of group.members) {
      // เทียบสองทาง เพราะชื่อในคลังมักมีส่วนขยายต่อท้าย
      // เช่น "amoxicillin trihydrate" ต้องจับได้ว่าเป็น amoxicillin
      if (word.includes(member) || member.includes(word)) return group.name;
    }
  }
  return null;
}

/**
 * ตรวจใบสั่งยาทั้งใบกับประวัติแพ้ยาทั้งหมด
 *
 * @param drugAllergiesText ข้อความประวัติแพ้ยาดิบ คั่นด้วย , ; หรือขึ้นบรรทัดใหม่
 * @param prescriptions     รายการยาที่แพทย์สั่งในเคสนี้
 * @returns รายการที่ชนกัน ถ้าไม่ชนเลยคืนอาร์เรย์ว่าง
 */
export function findAllergyConflicts(
  drugAllergiesText: string | undefined,
  prescriptions: { medicineName: string }[],
): AllergyConflict[] {
  const raw = (drugAllergiesText || '').trim();
  if (!raw || !prescriptions.length) return [];

  const allergyEntries = raw
    .split(/[,;\n/]/)
    .map((s) => s.trim())
    .filter((s) => s && !isDenial(s));

  if (!allergyEntries.length) return [];

  const conflicts: AllergyConflict[] = [];
  // กันเตือนซ้ำ ยาตัวเดียวที่ชนกับประวัติแพ้หลายบรรทัด ให้ขึ้นครั้งเดียว
  const seen = new Set<string>();

  for (const rx of prescriptions) {
    const medWords = tokenize(rx.medicineName);
    if (!medWords.length) continue;

    for (const entry of allergyEntries) {
      const allergyWords = tokenize(entry);
      if (!allergyWords.length) continue;

      let matched: AllergyConflict | null = null;

      // ชั้นที่ 1-3: ชื่อตัวยาตรงกัน (เทียบสองทาง เผื่อฝั่งใดฝั่งหนึ่งมีส่วนขยาย)
      outer: for (const a of allergyWords) {
        for (const m of medWords) {
          if (a === m || a.includes(m) || m.includes(a)) {
            matched = { medicineName: rx.medicineName, allergyText: entry, kind: 'exact' };
            break outer;
          }
        }
      }

      // ชั้นที่ 4: คนละตัวแต่กลุ่มเดียวกัน
      if (!matched) {
        outerGroup: for (const a of allergyWords) {
          const allergyGroup = groupOf(a);
          if (!allergyGroup) continue;
          for (const m of medWords) {
            if (groupOf(m) === allergyGroup) {
              matched = {
                medicineName: rx.medicineName,
                allergyText: entry,
                kind: 'group',
                groupName: allergyGroup,
              };
              break outerGroup;
            }
          }
        }
      }

      if (matched) {
        const key = `${matched.medicineName}|${matched.kind}`;
        if (!seen.has(key)) {
          seen.add(key);
          conflicts.push(matched);
        }
      }
    }
  }

  // ตัวที่ห้ามสั่งขึ้นก่อนเสมอ แพทย์จะได้เห็นอันที่ร้ายแรงที่สุดก่อน
  return conflicts.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'exact' ? -1 : 1));
}

/** ข้อความอธิบายหนึ่งบรรทัด ใช้ในกล่องเตือนและในสรุปก่อนบันทึก */
export function describeConflict(conflict: AllergyConflict, lang: string): string {
  const isTh = lang === 'th';

  if (conflict.kind === 'exact') {
    return isTh
      ? `${conflict.medicineName} — ผู้ป่วยมีประวัติแพ้ "${conflict.allergyText}"`
      : `${conflict.medicineName} — patient has a recorded allergy to "${conflict.allergyText}"`;
  }

  return isTh
    ? `${conflict.medicineName} — อยู่ในกลุ่ม ${conflict.groupName} เดียวกับที่ผู้ป่วยแพ้ ("${conflict.allergyText}") อาจแพ้ข้ามตัวได้`
    : `${conflict.medicineName} — same ${conflict.groupName} class as the recorded allergy ("${conflict.allergyText}"); cross-reactivity is possible`;
}
