import React, { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

export type Language = 'th' | 'en';

export const translations = {
  th: {
    // App & Header
    appTitle: 'ระบบจัดการคลินิก (ClinicMS)',
    searchPlaceholder: 'ค้นหาผู้ป่วย, เลข HN, เลข VN, ประวัติการรักษา...',
    doctorTitle: 'แพทย์ประจำคลินิก (GP)',
    settings: 'การตั้งค่า',
    settingsTitle: 'การตั้งค่าระบบ',
    languageSetting: 'ภาษาของระบบ',
    languageDesc: 'เลือกภาษาสำหรับแสดงผลหัวข้อ เมนู และข้อมูลในระบบ',
    thaiLang: 'ภาษาไทย',
    englishLang: 'English',
    closeAndSave: 'บันทึกและปิด',

    // Sidebar Nav
    navDashboard: 'แดชบอร์ด',
    navQueue: 'คิวผู้ป่วย',
    navExamination: 'บันทึกการตรวจผู้ป่วย',
    navSchedule: 'ตารางการนัดหมาย',
    navRecords: 'ประวัติผู้ป่วย',

    // Dashboard / Quick Stats
    quickStats: 'สถิติสรุปภาพรวม',
    totalPatientsToday: 'ผู้ป่วยทั้งหมดวันนี้',
    currentlyWaiting: 'ผู้ป่วยกำลังรอตรวจ',
    completedVisits: 'ตรวจเสร็จสิ้นแล้ว',

    // Queue Table
    todaysQueue: 'ลำดับคิวผู้ป่วยวันนี้',
    showingPatients: 'แสดงรายการคิวผู้ป่วย',
    filterAll: 'ทั้งหมด',
    filterWaiting: 'รอตรวจ',
    filterExamining: 'กำลังตรวจ',
    filterLab: 'รอผลแล็บ',
    filterCompleted: 'ตรวจเสร็จแล้ว',
    colQueueNo: 'ลำดับคิว',
    colHN: 'เลข HN',
    colVN: 'เลข VN',
    colPatientName: 'ชื่อ-นามสกุล',
    colStatus: 'สถานะ',
    colWaitingTime: 'เวลารอ',
    colAction: 'จัดการ',
    examineBtn: 'ตรวจผู้ป่วย',
    editRecordBtn: 'แก้ไขข้อมูล',
    addNewPatientBtn: '+ ลงทะเบียนคิวผู้ป่วยใหม่',
    noPatientsFound: 'ไม่พบข้อมูลผู้ป่วยตามเงื่อนไขที่เลือก',

    // Status Badges
    stWaiting: 'รอตรวจ',
    stExamining: 'กำลังตรวจ',
    stLab: 'รอผลแล็บ',
    stPharmacy: 'รอรับยา',
    stCompleted: 'ตรวจเสร็จแล้ว',
    stCancelled: 'ยกเลิก',

    // Reports View
    reportsTitle: 'รายงานและสถิติคลินิก',
    reportsSubtitle: 'ข้อมูลปริมาณผู้ป่วย ระยะเวลารอ และสถิติการตรวจรักษาประจำวัน',
    avgWaitTime: 'ระยะเวลารอเฉลี่ย',
    avgWaitFaster: 'เร็วกว่าเมื่อวาน 3.5 นาที',
    avgExamDuration: 'ระยะเวลาตรวจเฉลี่ย',
    optimalPace: 'ระยะเวลาตรวจอยู่ในเกณฑ์มาตรฐาน',
    completionRate: 'อัตราการตรวจเสร็จสิ้น',
    highSatisfaction: 'ระดับความพึงพอใจสูง',
    dailyArrivalVolume: 'จำนวนผู้ป่วยเข้ารับบริการตามช่วงเวลา',

    // Examination View
    opdExamTitle: 'บันทึกการตรวจผู้ป่วย OPD',
    backToQueue: 'กลับสู่หน้าคิวผู้ป่วย',
    saveExam: 'บันทึกผลการตรวจ',
    saveDraft: 'บันทึกฉบับร่าง',
    patientProfile: 'ข้อมูลผู้ป่วยและสิทธิ์การรักษา',
    chiefComplaintAndVitals: 'อาการสำคัญและสัญญาณชีพ',
    physicalExam: 'ผลการตรวจร่างกาย',
    diagnosis: 'การวินิจฉัยโรค',
    medicationPrescription: 'การสั่งยาและรายการยา',
    labOrders: 'การสั่งตรวจทางห้องปฏิบัติการ',
    imagingOrders: 'การสั่งตรวจทางรังสีวิทยา',
    referral: 'การส่งต่อผู้ป่วย',
    patientCounseling: 'คำแนะนำแพทย์',
    followUp: 'นัดหมายติดตามอาการ',
    summaryAndDocuments: 'สรุปการตรวจและใบรับรอง',

    // Patient Records
    recordsTitle: 'ประวัติและเวชระเบียนผู้ป่วย',
    recordsSubtitle: 'ค้นหาประวัติการรักษา เลข HN, เลข VN, สัญญาณชีพ และประวัติการสั่งยาเดิม',
    searchByNameOrHN: 'ค้นหาด้วยชื่อ, เลข HN หรือ เลข VN...',
    latestVitalsRecorded: 'สัญญาณชีพบันทึกล่าสุด',
    bloodPressure: 'ความดันโลหิต',
    pulseRate: 'ชีพจร',
    temperature: 'อุณหภูมิ',
    weight: 'น้ำหนัก',

    // Schedule View
    scheduleTitle: 'ตารางการนัดหมายและกะออกตรวจแพทย์',
    scheduleSubtitle: 'ดูตารางเวร กะการออกตรวจ และจัดตารางนัดหมายผู้ป่วย',
    totalScheduledShifts: 'กะออกตรวจทั้งหมด',
    myManagedShifts: 'กะการตรวจของฉัน',
    opdSessions: 'รอบตรวจทั่วไป',
    emergencyOnCall: 'กะนอกเวลา',
    monthlyView: 'รายเดือน',
    weeklyView: 'รายสัปดาห์',
    dutyList: 'รายการกะเวร',
    addShiftBtn: 'เพิ่มกะการตรวจ',
    filterDoctor: 'กรองตามแพทย์',
    filterShiftType: 'กรองตามประเภทกะ',
    allDoctors: 'แพทย์ทุกคนในคลินิก',
    allShiftTypes: 'ทุกประเภทกะ',
    todayMonthBtn: 'เดือนปัจจุบัน',

    // Registration Modal
    newQueueReg: 'ลงทะเบียนคิวผู้ป่วยใหม่',
    issueQueueToken: 'ออกบัตรคิวเข้าตรวจผู้ป่วย',
    fullName: 'ชื่อ-นามสกุล ผู้ป่วย',
    gender: 'เพศ',
    genderMale: 'ชาย',
    genderFemale: 'หญิง',
    genderOther: 'อื่นๆ',
    ageYears: 'อายุ (ปี)',
    chiefComplaintLabel: 'อาการสำคัญที่มาโรงพยาบาล',
    cancel: 'ยกเลิก',
    issueTicket: 'ออกบัตรคิว',

    // Examine Modal
    queueStatus: 'สถานะคิวผู้ป่วย',
    patientVitals: 'สัญญาณชีพผู้ป่วย',
    bpLabel: 'ความดันโลหิต (mmHg)',
    pulseLabel: 'ชีพจร (ครั้ง/นาที)',
    tempLabel: 'อุณหภูมิ (°C)',
    weightLabel: 'น้ำหนัก (กก.)',
    medicalDiagnosis: 'การวินิจฉัยโรคทางแพทย์',
    prescriptionMeds: 'รายการสั่งยาและวิธีใช้',
    saveRecordAndUpdate: 'บันทึกประวัติและปรับสถานะ',
  },
  en: {
    // App & Header
    appTitle: 'Clinic Management System (ClinicMS)',
    searchPlaceholder: 'Search patients, HN, VN, records...',
    doctorTitle: 'General Practitioner',
    settings: 'Settings',
    settingsTitle: 'System Settings',
    languageSetting: 'System Language',
    languageDesc: 'Choose language for headers, titles, and system interface',
    thaiLang: 'Thai',
    englishLang: 'English',
    closeAndSave: 'Save & Close',

    // Sidebar Nav
    navDashboard: 'Dashboard',
    navQueue: 'Patient Queue',
    navExamination: 'Patient Examination',
    navSchedule: 'Schedule',
    navRecords: 'Patient Records',

    // Dashboard / Quick Stats
    quickStats: 'Quick Stats',
    totalPatientsToday: 'Total Patients Today',
    currentlyWaiting: 'Currently Waiting',
    completedVisits: 'Completed Visits',

    // Queue Table
    todaysQueue: 'Today\'s Patient Queue',
    showingPatients: 'Showing patients in queue',
    filterAll: 'All',
    filterWaiting: 'Waiting',
    filterExamining: 'Examining',
    filterLab: 'Lab',
    filterCompleted: 'Completed',
    colQueueNo: 'Queue No.',
    colHN: 'HN',
    colVN: 'VN',
    colPatientName: 'Patient Name',
    colStatus: 'Status',
    colWaitingTime: 'Waiting Time',
    colAction: 'Action',
    examineBtn: 'Examine',
    editRecordBtn: 'Edit Record',
    addNewPatientBtn: '+ Add New Patient',
    noPatientsFound: 'No patients found matching the current criteria.',

    // Status Badges
    stWaiting: 'Waiting',
    stExamining: 'Examining',
    stLab: 'Lab Pending',
    stPharmacy: 'Pharmacy Pending',
    stCompleted: 'Completed',
    stCancelled: 'Cancelled',

    // Reports View
    reportsTitle: 'Clinic Reports & Analytics',
    reportsSubtitle: 'Daily throughput, average wait times, and clinic statistics',
    avgWaitTime: 'Average Wait Time',
    avgWaitFaster: '3.5 min faster than yesterday',
    avgExamDuration: 'Avg Exam Duration',
    optimalPace: 'Optimal clinical pace',
    completionRate: 'Completion Rate',
    highSatisfaction: 'High patient satisfaction',
    dailyArrivalVolume: 'Daily Patient Arrival Volume',

    // Examination View
    opdExamTitle: 'OPD Patient Examination',
    backToQueue: 'Back to Patient Queue',
    saveExam: 'Save Examination',
    saveDraft: 'Save Draft',
    patientProfile: 'Patient Information & Rights',
    chiefComplaintAndVitals: 'Chief Complaint & Vital Signs',
    physicalExam: 'Physical Examination',
    diagnosis: 'Diagnosis',
    medicationPrescription: 'Medication & Prescription',
    labOrders: 'Laboratory Investigations',
    imagingOrders: 'Diagnostic Imaging',
    referral: 'Specialty Referral',
    patientCounseling: 'Patient Counseling & Medical Advice',
    followUp: 'Schedule Next Follow-Up Visit',
    summaryAndDocuments: 'Visit Summary & Output Documents',

    // Patient Records
    recordsTitle: 'Patient Medical Records',
    recordsSubtitle: 'Search patient histories, HN/VN logs, vitals and historical prescriptions',
    searchByNameOrHN: 'Search by Name, HN, or VN...',
    latestVitalsRecorded: 'Latest Vitals Recorded',
    bloodPressure: 'Blood Pressure',
    pulseRate: 'Pulse Rate',
    temperature: 'Temperature',
    weight: 'Weight',

    // Schedule View
    scheduleTitle: 'Doctor Work Schedule & Duty Roster',
    scheduleSubtitle: 'View monthly calendar or weekly roster. Manage duty shifts.',
    totalScheduledShifts: 'Total Scheduled Shifts',
    myManagedShifts: 'My Managed Duties',
    opdSessions: 'Consultation Sessions',
    emergencyOnCall: 'After-hours Duties',
    monthlyView: 'Monthly',
    weeklyView: 'Weekly',
    dutyList: 'Duty List',
    addShiftBtn: 'Add Duty Shift',
    filterDoctor: 'Filter Doctor',
    filterShiftType: 'Filter Shift Type',
    allDoctors: 'All Doctors in Clinic',
    allShiftTypes: 'All Shift Types',
    todayMonthBtn: 'Current Month',

    // Registration Modal
    newQueueReg: 'New Queue Registration',
    issueQueueToken: 'Issue queue token for patient',
    fullName: 'Patient Full Name',
    gender: 'Gender',
    genderMale: 'Male',
    genderFemale: 'Female',
    genderOther: 'Other',
    ageYears: 'Age (Years)',
    chiefComplaintLabel: 'Chief Complaint / Reason for Visit',
    cancel: 'Cancel',
    issueTicket: 'Issue Ticket',

    // Examine Modal
    queueStatus: 'Queue Status',
    patientVitals: 'Patient Vitals',
    bpLabel: 'BP (mmHg)',
    pulseLabel: 'Pulse (bpm)',
    tempLabel: 'Temp (°C)',
    weightLabel: 'Weight (kg)',
    medicalDiagnosis: 'Medical Diagnosis',
    prescriptionMeds: 'Prescription & Dosage',
    saveRecordAndUpdate: 'Save Record & Update Status',
  }
};

export type TranslationKeys = keyof typeof translations['th'];

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKeys) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('th');

  const t = (key: TranslationKeys): string => {
    return translations[language][key] || translations['th'][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
