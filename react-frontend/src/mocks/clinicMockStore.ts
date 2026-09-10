import { formatHN, formatQueueNo, formatNationalId, formatPhone } from '../utils/formatters';

export interface MockPatient {
  id: number;
  hn: string;
  nationalId: string;
  fullName: string;
  gender: 'ชาย' | 'หญิง' | 'อื่นๆ';
  birthdate: string;
  dob: string;
  age: number;
  phone: string;
  emergencyContact: string;
  // Structured Address Fields (Sprint 3)
  houseNo?: string;
  villageNo?: string;
  villageName?: string;
  alley?: string;
  road?: string;
  subDistrict?: string;
  district?: string;
  province?: string;
  postalCode?: string;
  address: string;
  schemeType: 'บัตรทอง (สปสช.)' | 'ประกันสังคม (ม.33)' | 'สิทธิ์ข้าราชการ' | 'ประกันสุขภาพเอกชน' | 'ชำระเงินเอง';
  chronicDiseases: string;
  allergies: string;
  registeredAt: string;
}

export interface MockQueue {
  id: number;
  patientId: number;
  queueNo: string;
  serviceDate: string;
  status: 'รอคัดกรอง' | 'รอพบแพทย์' | 'กำลังตรวจ' | 'รอทำหัตถการ' | 'รอชำระเงิน' | 'รอรับยา' | 'เสร็จสิ้น' | 'ยกเลิกคิว';
  department: string;
  note?: string;
  createdAt: string;
  patient?: MockPatient;
}

export interface MockEligibility {
  id: number;
  patientId: number;
  nationalId: string;
  patientName: string;
  schemeType: 'บัตรทอง (สปสช.)' | 'ประกันสังคม (ม.33)' | 'สิทธิ์ข้าราชการ' | 'ประกันสุขภาพเอกชน' | 'ชำระเงินเอง';
  coverageDetails: string;
  hospitalName: string;
  status: 'ใช้งานได้' | 'หมดอายุ' | 'รอตรวจสอบ';
  expireDate: string;
  verifiedAt: string;
}

export interface MockScreening {
  id: number;
  visitId: number;
  patientId: number;
  queueNo: string;
  weight: number;
  height: number;
  bmi: number;
  temperature: number;
  systolicBP: number;
  diastolicBP: number;
  heartRate: number;
  respiratoryRate: number;
  spo2: number;
  painScore: number;
  bloodSugar: number;
  triageLevel: 'ฉุกเฉินวิกฤต (Resuscitation)' | 'ฉุกเฉินเร่งด่วน (Urgent)' | 'กึ่งฉุกเฉิน (Semi-Urgent)' | 'ปกติ (Normal)';
  chiefComplaint: string;
  allergies: string;
  nurseNotes: string;
  assignedDoctorId: number;
  assignedDoctorName: string;
  assignedRoom: string;
  screenedByUserName: string;
  screenedByRole: string;
  dateOnly: string;
  timeOnly: string;
  visitDate: string;
}

// -------------------------------------------------------------------------
// Initial Seed Data: 12 Patients, 8 Active Queues, 12 Eligibilities
// -------------------------------------------------------------------------

const INITIAL_PATIENTS: MockPatient[] = [
  {
    id: 1,
    hn: 'HN0001',
    nationalId: '1-1001-00123-45-1',
    fullName: 'นายสมชาย มั่นคง',
    gender: 'ชาย',
    birthdate: '1985-05-12',
    dob: '12/05/2528',
    age: 41,
    phone: '081-234-5678',
    emergencyContact: 'นางสมศรี มั่นคง (ภรรยา) 081-999-8888',
    houseNo: '123/45',
    road: 'มิตรภาพ',
    subDistrict: 'ในเมือง',
    district: 'เมืองนครราชสีมา',
    province: 'นครราชสีมา',
    postalCode: '30000',
    address: '123/45 ถ.มิตรภาพ ต.ในเมือง อ.เมืองนครราชสีมา จ.นครราชสีมา 30000',
    schemeType: 'บัตรทอง (สปสช.)',
    chronicDiseases: 'ความดันโลหิตสูง',
    allergies: 'ปฏิเสธการแพ้ยา',
    registeredAt: '04/09/2569 08:00 น.',
  },
  {
    id: 2,
    hn: 'HN0002',
    nationalId: '1-1002-00234-56-2',
    fullName: 'นางสาวสมหญิง สดใส',
    gender: 'หญิง',
    birthdate: '1992-08-24',
    dob: '24/08/2535',
    age: 34,
    phone: '082-345-6789',
    emergencyContact: 'นายบุญเลิศ สดใส (บิดา) 082-888-7777',
    houseNo: '456',
    villageNo: '2',
    subDistrict: 'สุรนารี',
    district: 'เมืองนครราชสีมา',
    province: 'นครราชสีมา',
    postalCode: '30000',
    address: '456 หมู่ 2 ต.สุรนารี อ.เมืองนครราชสีมา จ.นครราชสีมา 30000',
    schemeType: 'ประกันสังคม (ม.33)',
    chronicDiseases: 'ไม่มี',
    allergies: 'Penicillin',
    registeredAt: '04/09/2569 08:15 น.',
  },
  {
    id: 3,
    hn: 'HN0003',
    nationalId: '1-1003-00345-67-3',
    fullName: 'นายสมศักดิ์ รักชาติ',
    gender: 'ชาย',
    birthdate: '1968-11-03',
    dob: '03/11/2511',
    age: 58,
    phone: '083-456-7890',
    emergencyContact: 'นางวรรณา รักชาติ (บุตร) 083-777-6666',
    houseNo: '789',
    villageNo: '5',
    subDistrict: 'หนองจะบก',
    district: 'เมืองนครราชสีมา',
    province: 'นครราชสีมา',
    postalCode: '30000',
    address: '789 หมู่ 5 ต.หนองจะบก อ.เมืองนครราชสีมา จ.นครราชสีมา 30000',
    schemeType: 'สิทธิ์ข้าราชการ',
    chronicDiseases: 'เบาหวานชนิดที่ 2, ไขมันในเลือดสูง',
    allergies: 'Sulfa',
    registeredAt: '04/09/2569 08:20 น.',
  },
  {
    id: 4,
    hn: 'HN0004',
    nationalId: '1-1004-00456-78-4',
    fullName: 'นางสาวกานดา ใจดี',
    gender: 'หญิง',
    birthdate: '1998-02-17',
    dob: '17/02/2541',
    age: 28,
    phone: '084-567-8901',
    emergencyContact: 'นางกรรณิการ์ ใจดี (มารดา) 084-666-5555',
    houseNo: '12/3',
    alley: '4',
    subDistrict: 'โพธิ์กลาง',
    district: 'เมืองนครราชสีมา',
    province: 'นครราชสีมา',
    postalCode: '30000',
    address: '12/3 ซ.4 ต.โพธิ์กลาง อ.เมืองนครราชสีมา จ.นครราชสีมา 30000',
    schemeType: 'บัตรทอง (สปสช.)',
    chronicDiseases: 'ไม่มี',
    allergies: 'ปฏิเสธการแพ้ยา',
    registeredAt: '04/09/2569 08:30 น.',
  },
  {
    id: 5,
    hn: 'HN0005',
    nationalId: '1-1005-00567-89-5',
    fullName: 'นายประสิทธิ์ มั่งคั่ง',
    gender: 'ชาย',
    birthdate: '1975-09-30',
    dob: '30/09/2518',
    age: 51,
    phone: '085-678-9012',
    emergencyContact: 'นางสุภา มั่งคั่ง (ภรรยา) 085-555-4444',
    houseNo: '88/9',
    subDistrict: 'หัวทะเล',
    district: 'เมืองนครราชสีมา',
    province: 'นครราชสีมา',
    postalCode: '30000',
    address: '88/9 ต.หัวทะเล อ.เมืองนครราชสีมา จ.นครราชสีมา 30000',
    schemeType: 'ประกันสังคม (ม.33)',
    chronicDiseases: 'โรคเกาต์',
    allergies: 'Aspirin',
    registeredAt: '04/09/2569 08:45 น.',
  },
  {
    id: 6,
    hn: 'HN0006',
    nationalId: '1-1006-00678-90-6',
    fullName: 'นางปราณี มีสุข',
    gender: 'หญิง',
    birthdate: '1960-04-05',
    dob: '05/04/2503',
    age: 66,
    phone: '086-789-0123',
    emergencyContact: 'นายประวิทย์ มีสุข (บุตร) 086-444-3333',
    houseNo: '99/1',
    subDistrict: 'ปรุใหญ่',
    district: 'เมืองนครราชสีมา',
    province: 'นครราชสีมา',
    postalCode: '30000',
    address: '99/1 ต.ปรุใหญ่ อ.เมืองนครราชสีมา จ.นครราชสีมา 30000',
    schemeType: 'สิทธิ์ข้าราชการ',
    chronicDiseases: 'ความดันโลหิตสูง, ไตวายเรื้อรังระยะ 3',
    allergies: 'ปฏิเสธการแพ้ยา',
    registeredAt: '04/09/2569 09:00 น.',
  },
  {
    id: 7,
    hn: 'HN0007',
    nationalId: '1-1007-00789-01-7',
    fullName: 'นายวิชาญ เชี่ยวชาญ',
    gender: 'ชาย',
    birthdate: '1990-12-12',
    dob: '12/12/2533',
    age: 36,
    phone: '087-890-1234',
    emergencyContact: 'นางสาวรุ่งทิพย์ (เพื่อน) 087-333-2222',
    houseNo: '44/5',
    subDistrict: 'บ้านเกาะ',
    district: 'เมืองนครราชสีมา',
    province: 'นครราชสีมา',
    postalCode: '30000',
    address: '44/5 ต.บ้านเกาะ อ.เมืองนครราชสีมา จ.นครราชสีมา 30000',
    schemeType: 'บัตรทอง (สปสช.)',
    chronicDiseases: 'ไม่มี',
    allergies: 'ปฏิเสธการแพ้ยา',
    registeredAt: '04/09/2569 09:10 น.',
  },
  {
    id: 8,
    hn: 'HN0008',
    nationalId: '1-1008-00890-12-8',
    fullName: 'นางสาวรัตนา สว่างศรี',
    gender: 'หญิง',
    birthdate: '1988-06-20',
    dob: '20/06/2531',
    age: 38,
    phone: '088-901-2345',
    emergencyContact: 'นายมนตรี สว่างศรี (สามี) 088-222-1111',
    houseNo: '159',
    villageNo: '7',
    subDistrict: 'หนองกระทุ่ม',
    district: 'เมืองนครราชสีมา',
    province: 'นครราชสีมา',
    postalCode: '30000',
    address: '159 หมู่ 7 ต.หนองกระทุ่ม อ.เมืองนครราชสีมา จ.นครราชสีมา 30000',
    schemeType: 'ประกันสังคม (ม.33)',
    chronicDiseases: 'ไมเกรน',
    allergies: 'Ibuprofen',
    registeredAt: '04/09/2569 09:15 น.',
  },
  {
    id: 9,
    hn: 'HN0009',
    nationalId: '1-1009-00901-23-9',
    fullName: 'นายชูเกียรติ ยิ่งเจริญ',
    gender: 'ชาย',
    birthdate: '1982-03-15',
    dob: '15/03/2525',
    age: 44,
    phone: '089-012-3456',
    emergencyContact: 'นางชุติมา ยิ่งเจริญ (ภรรยา) 089-111-0000',
    houseNo: '267',
    villageNo: '3',
    subDistrict: 'หมื่นไวย',
    district: 'เมืองนครราชสีมา',
    province: 'นครราชสีมา',
    postalCode: '30000',
    address: '267 หมู่ 3 ต.หมื่นไวย อ.เมืองนครราชสีมา จ.นครราชสีมา 30000',
    schemeType: 'บัตรทอง (สปสช.)',
    chronicDiseases: 'ไม่มี',
    allergies: 'ปฏิเสธการแพ้ยา',
    registeredAt: '04/09/2569 09:20 น.',
  },
  {
    id: 10,
    hn: 'HN000A',
    nationalId: '1-1010-01012-34-0',
    fullName: 'นางสาวจินตนา พาเพลิน',
    gender: 'หญิง',
    birthdate: '1995-10-10',
    dob: '10/10/2538',
    age: 31,
    phone: '090-123-4567',
    emergencyContact: 'นายอนุรักษ์ พาเพลิน (บิดา) 090-999-1111',
    houseNo: '38/2',
    subDistrict: 'หนองไผ่ล้อม',
    district: 'เมืองนครราชสีมา',
    province: 'นครราชสีมา',
    postalCode: '30000',
    address: '38/2 ต.หนองไผ่ล้อม อ.เมืองนครราชสีมา จ.นครราชสีมา 30000',
    schemeType: 'สิทธิ์ข้าราชการ',
    chronicDiseases: 'หอบหืด (Asthma)',
    allergies: 'ปฏิเสธการแพ้ยา',
    registeredAt: '04/09/2569 09:30 น.',
  },
  {
    id: 11,
    hn: 'HN000B',
    nationalId: '1-1011-01123-45-1',
    fullName: 'นายธีรภัทร เจริญสุข',
    gender: 'ชาย',
    birthdate: '1994-01-05',
    dob: '05/01/2537',
    age: 32,
    phone: '091-234-5678',
    emergencyContact: 'นางสาวพรทิพย์ (ภรรยา) 091-888-2222',
    houseNo: '77',
    subDistrict: 'โคกกรวด',
    district: 'เมืองนครราชสีมา',
    province: 'นครราชสีมา',
    postalCode: '30000',
    address: '77 ต.โคกกรวด อ.เมืองนครราชสีมา จ.นครราชสีมา 30000',
    schemeType: 'บัตรทอง (สปสช.)',
    chronicDiseases: 'ไม่มี',
    allergies: 'ปฏิเสธการแพ้ยา',
    registeredAt: '04/09/2569 09:40 น.',
  },
  {
    id: 12,
    hn: 'HN000C',
    nationalId: '1-1012-01234-56-2',
    fullName: 'นางสาวสุภาภรณ์ ศรีทอง',
    gender: 'หญิง',
    birthdate: '1987-07-22',
    dob: '22/07/2530',
    age: 39,
    phone: '092-345-6789',
    emergencyContact: 'นายสมพงษ์ ศรีทอง (บิดา) 092-777-3333',
    houseNo: '501',
    villageNo: '4',
    subDistrict: 'จอหอ',
    district: 'เมืองนครราชสีมา',
    province: 'นครราชสีมา',
    postalCode: '30000',
    address: '501 หมู่ 4 ต.จอหอ อ.เมืองนครราชสีมา จ.นครราชสีมา 30000',
    schemeType: 'ประกันสังคม (ม.33)',
    chronicDiseases: 'ไม่มี',
    allergies: 'Amoxicillin',
    registeredAt: '04/09/2569 09:45 น.',
  },
];

const INITIAL_QUEUES: MockQueue[] = [
  {
    id: 1,
    patientId: 1,
    queueNo: 'Q0001',
    serviceDate: '2026-09-07',
    status: 'รอคัดกรอง',
    department: 'จุดคัดกรอง',
    note: 'มีไข้สูง ปวดศีรษะ 2 วัน',
    createdAt: '08:30 น.',
    patient: INITIAL_PATIENTS[0],
  },
  {
    id: 2,
    patientId: 2,
    queueNo: 'Q0002',
    serviceDate: '2026-09-07',
    status: 'รอคัดกรอง',
    department: 'จุดคัดกรอง',
    note: 'ปวดท้อง เจียน คลื่นไส้',
    createdAt: '08:40 น.',
    patient: INITIAL_PATIENTS[1],
  },
  {
    id: 3,
    patientId: 3,
    queueNo: 'Q0003',
    serviceDate: '2026-09-07',
    status: 'รอพบแพทย์',
    department: 'ห้องตรวจ 1 (พญ.สุดา)',
    note: 'คัดกรองแล้ว ความดันสูงเล็กน้อย',
    createdAt: '08:45 น.',
    patient: INITIAL_PATIENTS[2],
  },
  {
    id: 4,
    patientId: 4,
    queueNo: 'Q0004',
    serviceDate: '2026-09-07',
    status: 'กำลังตรวจ',
    department: 'ห้องตรวจ 2 (นพ.วิชัย)',
    note: 'กำลังตรวจในห้องตรวจ 2',
    createdAt: '08:50 น.',
    patient: INITIAL_PATIENTS[3],
  },
  {
    id: 5,
    patientId: 5,
    queueNo: 'Q0005',
    serviceDate: '2026-09-07',
    status: 'รอคัดกรอง',
    department: 'จุดคัดกรอง',
    note: 'แผลที่เท้า ปวด บวม',
    createdAt: '08:55 น.',
    patient: INITIAL_PATIENTS[4],
  },
  {
    id: 6,
    patientId: 6,
    queueNo: 'Q0006',
    serviceDate: '2026-09-07',
    status: 'รอคัดกรอง',
    department: 'จุดคัดกรอง',
    note: 'มารับยาต่อเนื่อง ความดันโลหิตสูง',
    createdAt: '09:00 น.',
    patient: INITIAL_PATIENTS[5],
  },
  {
    id: 7,
    patientId: 7,
    queueNo: 'Q0007',
    serviceDate: '2026-09-07',
    status: 'รอพบแพทย์',
    department: 'ห้องตรวจ 3 (พญ.เกศรา)',
    note: 'คัดกรองเสร็จสิ้น Triage ระดับ 3',
    createdAt: '09:05 น.',
    patient: INITIAL_PATIENTS[6],
  },
  {
    id: 8,
    patientId: 8,
    queueNo: 'Q0008',
    serviceDate: '2026-09-07',
    status: 'เสร็จสิ้น',
    department: 'ห้องจ่ายยาและเภสัชกรรม',
    note: 'ตรวจรักษาและรับยาเรียบร้อย',
    createdAt: '09:10 น.',
    patient: INITIAL_PATIENTS[7],
  },
];

// In-memory singletons
let mockPatientsStore: MockPatient[] = [...INITIAL_PATIENTS];
let mockQueuesStore: MockQueue[] = [...INITIAL_QUEUES];

// -------------------------------------------------------------------------
// Central Store Accessors & Mutators
// -------------------------------------------------------------------------

export const clinicMockStore = {
  // Patients
  getPatients: (): MockPatient[] => [...mockPatientsStore],
  addPatient: (p: MockPatient): MockPatient => {
    mockPatientsStore = [p, ...mockPatientsStore.filter((item) => item.hn !== p.hn && item.id !== p.id)];
    return p;
  },
  getUnqueuedPatients: (): MockPatient[] => {
    const queuedIds = new Set(
      mockQueuesStore.filter((q) => q.status !== 'เสร็จสิ้น' && q.status !== 'ยกเลิกคิว').map((q) => q.patientId)
    );
    return mockPatientsStore.filter((p) => !queuedIds.has(p.id));
  },

  // Queues
  getQueues: (): MockQueue[] => [...mockQueuesStore],
  addQueue: (q: MockQueue): MockQueue => {
    mockQueuesStore = [q, ...mockQueuesStore.filter((item) => item.queueNo !== q.queueNo && item.id !== q.id)];
    return q;
  },
  updateQueueStatus: (queueId: number | string, status: MockQueue['status'], department?: string, note?: string) => {
    mockQueuesStore = mockQueuesStore.map((q) => {
      if (String(q.id) === String(queueId) || q.queueNo === String(queueId)) {
        return {
          ...q,
          status,
          department: department || q.department,
          note: note !== undefined ? note : q.note,
        };
      }
      return q;
    });
  },

  // Cross-Page Consistent Stats
  getSummaryStats: () => {
    const patients = mockPatientsStore;
    const queues = mockQueuesStore;

    const totalPatients = patients.length;
    const goldCount = patients.filter((p) => p.schemeType === 'บัตรทอง (สปสช.)').length;
    const socialCount = patients.filter((p) => p.schemeType === 'ประกันสังคม (ม.33)').length;
    const govCount = patients.filter((p) => p.schemeType === 'สิทธิ์ข้าราชการ').length;
    const otherCount = patients.filter(
      (p) => p.schemeType !== 'บัตรทอง (สปสช.)' && p.schemeType !== 'ประกันสังคม (ม.33)' && p.schemeType !== 'สิทธิ์ข้าราชการ'
    ).length;

    const waitingScreening = queues.filter((q) => q.status === 'รอคัดกรอง').length;
    const waitingDoctor = queues.filter((q) => q.status === 'รอพบแพทย์').length;
    const inExamination = queues.filter((q) => q.status === 'กำลังตรวจ').length;
    const waitingTreatment = queues.filter((q) => q.status === 'รอทำหัตถการ').length;
    const waitingBilling = queues.filter((q) => q.status === 'รอชำระเงิน').length;
    const waitingPharmacy = queues.filter((q) => q.status === 'รอรับยา').length;
    const completed = queues.filter((q) => q.status === 'เสร็จสิ้น').length;
    const cancelled = queues.filter((q) => q.status === 'ยกเลิกคิว').length;
    const activeQueues = queues.filter((q) => q.status !== 'เสร็จสิ้น' && q.status !== 'ยกเลิกคิว').length;

    const unqueuedPatients = clinicMockStore.getUnqueuedPatients().length;

    return {
      totalPatients,
      schemeStats: {
        gold: goldCount,
        social: socialCount,
        gov: govCount,
        other: otherCount,
      },
      queueStats: {
        active: activeQueues,
        waitingScreening,
        waitingDoctor,
        inExamination,
        waitingTreatment,
        waitingBilling,
        waitingPharmacy,
        completed,
        cancelled,
        unqueuedPatients,
      },
    };
  },
};
