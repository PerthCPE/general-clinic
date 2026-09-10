// ===== Central Clinic System Configuration =====
// ปรับเปลี่ยนชื่อระบบ, ชื่อเจ้าหน้าที่ตามบทบาท และข้อมูลผู้ป่วยค้นหาได้ 2 คน (B6741990, B6741991)
import { DEMO_USERS } from './roles';

export interface PatientConfig {
  id: string;
  visitId?: number;
  hn: string;
  nationalId: string;
  queueNumber: string;
  ticket: string;
  receiptNumber?: string;
  vn?: string;
  name: string;
  shortName: string;
  age: number;
  gender: string;
  dob?: string;
  phone?: string;
  occupation?: string;
  treatmentRights: string;
  registeredRights?: string;
  patientType: 'ผู้ป่วยนอก (OPD)' | 'ผู้ป่วยใน (IPD)';
  allergies: string[];
  chronicDiseases: string;
  vitals: string;
  visitStatus: string;
  status?: 'pending' | 'dispensed' | 'completed';
  dispensedAt?: string;
  visitDate: string;
  visitTime: string;
  doctorAdvice: string;
  medications: {
    medId: string;
    name: string;
    dosage: string;
    instructions: string;
    expiry_date?: string;
    stock: number;
    stockStatus: 'in-stock' | 'low-stock' | 'out-stock';
    quantity?: number;
    price: number;
    properties: string;
  }[];
  createdAt?: string;
}

export const normalizeScheme = (r?: string): string => {
  if (!r) return '30baht';
  const s = r.toLowerCase();
  if (s.includes('30') || s.includes('บัตรทอง') || s.includes('สปสช')) return '30baht';
  if (s.includes('ประกันสังคม') || s.includes('social')) return 'sso';
  if (s.includes('ข้าราชการ') || s.includes('กรมบัญชีกลาง') || s.includes('gov')) return 'gov';
  if (s.includes('ประกันสุขภาพ') || s.includes('เอกชน') || s.includes('insurance')) return 'private';
  if (s.includes('จ่ายตรง') || s.includes('เงินสด') || s.includes('ชำระ') || s.includes('cash') || s.includes('self')) return 'cash';
  return '30baht';
};

export const SCHEME_LABELS: Record<string, string> = {
  '30baht': 'สิทธิ 30 บาท (บัตรทอง / สปสช.)',
  'sso': 'สิทธิประกันสังคม (Social Security)',
  'gov': 'สิทธิข้าราชการ / จ่ายตรงกรมบัญชีกลาง',
  'private': 'ประกันสุขภาพเอกชน (Private Insurance)',
  'cash': 'จ่ายตรง / เงินสด (Self Pay / Cash)',
};

export interface BenefitCalculationResult {
  grossTotal: number;
  discountAmount: number;
  netTotal: number;
  discountDescription: string;
  schemeLabel: string;
}

export const calculateBenefitAmounts = (
  rawTotal: number,
  scheme: string
): BenefitCalculationResult => {
  const key = normalizeScheme(scheme);
  let discount = 0;
  let net = rawTotal;
  let desc = '';

  switch (key) {
    case '30baht':
      if (rawTotal <= 30) {
        discount = 0;
        net = rawTotal;
        desc = 'สิทธิ 30 บาท (สปสช.): ผู้ป่วยร่วมจ่ายตามจริง (ไม่เกิน 30 บาท)';
      } else {
        discount = rawTotal - 30;
        net = 30;
        desc = `สิทธิ 30 บาท (สปสช.): ผู้ป่วยร่วมจ่าย 30 บาท (หักส่วนลดสิทธิ ฿${discount.toLocaleString()})`;
      }
      break;

    case 'sso':
      discount = rawTotal;
      net = 0;
      desc = `สิทธิประกันสังคม: คลินิกคู่สัญญาครอบคลุม 100% (หักส่วนลดสิทธิ ฿${discount.toLocaleString()} จ่าย ฿0)`;
      break;

    case 'gov':
      discount = rawTotal;
      net = 0;
      desc = `สิทธิข้าราชการ: เบิกจ่ายตรงกรมบัญชีกลาง 100% (หักส่วนลดสิทธิ ฿${discount.toLocaleString()} จ่าย ฿0)`;
      break;

    case 'private':
      discount = Math.round(rawTotal * 0.8);
      net = rawTotal - discount;
      desc = `ประกันสุขภาพเอกชน: ประกันคุ้มครอง 80% ผู้ป่วยร่วมจ่าย 20% (หักส่วนลดสิทธิ ฿${discount.toLocaleString()} จ่าย ฿${net.toLocaleString()})`;
      break;

    case 'cash':
    default:
      discount = 0;
      net = rawTotal;
      desc = 'จ่ายตรง / เงินสด: ชำระเองเต็มจำนวน (ไม่มีส่วนลดสิทธิ)';
      break;
  }

  return {
    grossTotal: rawTotal,
    discountAmount: discount,
    netTotal: net,
    discountDescription: desc,
    schemeLabel: SCHEME_LABELS[key] || 'จ่ายตรง / เงินสด (Self Pay / Cash)',
  };
};

export const CLINIC_CONFIG = {
  appName: 'General Clinic',
  appSubTitle: 'ระบบบริหารจัดการคลินิกเวชกรรมและบริการผู้ป่วย',
// ====================================
  // ข้อมูลบัญชีรับโอนเงิน PromptPay (QR Code)
  paymentAccount: {
    accountName: 'นาย บุญค้ำ โยลัย',
    phone: '088-587-5682',
    accountNumber: '020300456462',
    qrImagePath: '/thai_qr_bunkham.png',
  },
// ====================================
  staff: {
    pharmacist: {
      name: DEMO_USERS.pharmacist?.fullName || 'ดร.บุญ สั่งยา',
      roleTitle: DEMO_USERS.pharmacist?.roleTitleTh || 'เจ้าหน้าที่คลังยา',
      roleBadge: 'PH',
      roleCode: 'pharmacist' as const,
    },
    cashier: {
      name: DEMO_USERS.cashier?.fullName || 'นส.รวย การเงิน',
      roleTitle: DEMO_USERS.cashier?.roleTitleTh || 'เจ้าหน้าที่การเงิน',
      roleBadge: 'FN',
      roleCode: 'cashier' as const,
    },
  },

  // ข้อมูลผู้ป่วยตัวอย่าง 2 คนที่ค้นหาได้ในระบบ
  patients: [
    {
      id: 'HN0045',
      hn: 'HN0045',
      nationalId: '1101800234567',
      queueNumber: 'Q0001',
      ticket: 'Ticket: 4931',
      name: 'นายบุญค้ำ โยลัย',
      shortName: 'บุญค้ำ',
      age: 24,
      gender: 'ชาย',
      dob: '1984-03-15',
      phone: '081-234-5678',
      occupation: 'วิศวกรซอฟต์แวร์',
      treatmentRights: 'สิทธิ 30 บาท',
      patientType: 'ผู้ป่วยนอก (OPD)',
      allergies: ['เพนิซิลลิน (Penicillin)'],
      chronicDiseases: 'โรคความดันโลหิตสูง',
      vitals: 'ความดัน 120/80 | ชีพจร 78',
      visitStatus: 'กำลังตรวจรักษา',
      visitDate: '2026-07-23',
      visitTime: '08:45 น.',
      doctorAdvice: 'พักผ่อนให้เพียงพอ ดื่มน้ำมากๆ ทานยาติดต่อกันจนหมดตามแพทย์สั่งอย่างเคร่งครัด หากมีอาการผื่นคันหรือแน่นหน้าอกให้รีบกลับมาพบแพทย์ทันที',
      medications: [
        {
          medId: 'MED-0187',
          name: 'Amoxicillin 250mg',
          dosage: '1 แคปซูล, 3 ครั้ง/วัน, หลังอาหาร',
          instructions: 'ทานติดต่อกันจนหมด 7 วัน เพื่อการรักษาที่เห็นผล',
          stock: 48,
          stockStatus: 'in-stock',
          price: 150,
          properties: 'ยาปฏิชีวนะกลุ่ม Penicillin ใช้รักษาการติดเชื้อแบคทีเรีย เช่น การติดเชื้อของหู คอ ปอด ผิวหนัง และทางเดินปัสสาวะ ออกฤทธิ์โดยยับยั้งการสร้างผนังเซลล์ของแบคทีเรีย ควรระวังในผู้ที่แพ้เพนิซิลลิน'
        },
        {
          medId: 'MED-0231',
          name: 'Paracetamol 500mg',
          dosage: '2 เม็ด, ทุกๆ 4-6 ชั่วโมง',
          instructions: 'เตือนทานยาทุกๆ 4-6 ชั่วโมง เมื่อมีอาการปวดหรือไข้',
          stock: 342,
          stockStatus: 'in-stock',
          price: 80,
          properties: 'ยาแก้ปวดและลดไข้ ทำงานโดยยับยั้งการสร้าง Prostaglandin ในสมอง บรรเทาอาการปวดศีรษะ ปวดกล้ามเนื้อ ปวดฟัน และปวดทั่วไป ไม่มีฤทธิ์ต้านการอักเสบ ใช้ได้อย่างปลอดภัยในผู้สูงอายุและสตรีมีครรภ์ ห้ามใช้เกินขนาดที่กำหนดเพราะอาจเป็นอันตรายต่อตับ'
        },
        {
          medId: 'MED-0402',
          name: 'Ibuprofen 400mg',
          dosage: '1 เม็ด, 2 ครั้ง/วัน, หลังอาหารทันที',
          instructions: 'ทานหลังอาหารทันทีและดื่มน้ำตามมากๆ',
          stock: 0,
          stockStatus: 'out-stock',
          price: 120,
          properties: 'ยาต้านการอักเสบกลุ่ม NSAIDs มีฤทธิ์แก้ปวด ลดไข้ และลดอาการบวม ใช้รักษาอาการปวดกล้ามเนื้อ ปวดประจำเดือน ปวดหลัง ควรทานหลังอาหารเสมอ ห้ามใช้ในผู้ที่แพ้อาหารหรือมีโรคไตเสีย'
        }
      ]
    },
    {
      id: 'HN0112',
      hn: 'HN0112',
      nationalId: '1101800234568',
      queueNumber: 'Q0002',
      ticket: 'Ticket: 4932',
      name: 'นางสาวกานดา มณีรัตน์',
      shortName: 'กานดา',
      age: 30,
      gender: 'หญิง',
      dob: '1996-05-20',
      phone: '089-987-6543',
      occupation: 'ผู้จัดการฝ่ายการตลาด',
      treatmentRights: 'ประกันสุขภาพเอกชน',
      patientType: 'ผู้ป่วยใน (IPD)',
      allergies: ['แอสไพริน (Aspirin)'],
      chronicDiseases: 'โรคหอบหืด',
      vitals: 'ความดัน 118/75 | ชีพจร 72',
      visitStatus: 'กำลังตรวจรักษา',
      visitDate: '2026-07-23',
      visitTime: '09:15 น.',
      doctorAdvice: 'หลีกเลี่ยงปัจจัยกระตุ้นภูมิแพ้และฝุ่นควัน ทานยาตามเวลาที่กำหนด หากอาการหอบหืดกำเริบให้ใช้ยาพ่นฉุกเฉินและมาพบแพทย์',
      medications: [
        {
          medId: 'MED-0119',
          name: 'Cetirizine 10mg',
          dosage: '1 เม็ด, วันละ 1 ครั้ง, ก่อนนอน',
          instructions: 'ทานก่อนนอน อาการง่วงนอนอาจเกิดขึ้นได้',
          stock: 120,
          stockStatus: 'in-stock',
          price: 90,
          properties: 'ยาต้านหยัดสะแดงรุ่น H1-Antihistamine รุ่นใหม่ บรรเทาอาการภูมิแพ้ อาการรินอูเสบ มีน้ำมูกไหล อาการคันเนื่องจากแมลง และอาการสะเก็บในตา ทำให้ง่วงนอนน้อยกว่ายารุ่นเก่า'
        },
        {
          medId: 'MED-0356',
          name: 'Omeprazole 20mg',
          dosage: '1 แคปซูล, วันละ 1 ครั้ง, ก่อนอาหารเช้า',
          instructions: 'ทานก่อนอาหารเช้า 30 นาที',
          stock: 65,
          stockStatus: 'in-stock',
          price: 180,
          properties: 'ยาลดการสร้างกรดในกระเพาะอาหาร (Proton Pump Inhibitor) ใช้รักษาโรคกรดไหลย้อน แผลในหลอดอาหาร และเนื้อเยื่อหลอดอาหารอักเสบ ช่วยป้องกันการสึกหรอกของกรดจากกระเพาะเข้าสู่หลอดอาหาร'
        },
        {
          medId: 'MED-0231',
          name: 'Paracetamol 500mg',
          dosage: '1 เม็ด, ทุกๆ 6 ชั่วโมง',
          instructions: 'เมื่อมีอาการปวดหรือมีไข้',
          stock: 342,
          stockStatus: 'in-stock',
          price: 80,
          properties: 'ยาแก้ปวดและลดไข้ ทำงานโดยยับยั้งการสร้าง Prostaglandin ในสมอง บรรเทาอาการปวดและลดไข้ เหมาะสำหรับสตรีมีครรภ์และเด็ก ห้ามกินเกิน 4g/วัน'
        }
      ]
    }
  ] as PatientConfig[]
};
