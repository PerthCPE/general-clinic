import type { DiagnosisItem, PastVisitRecord, Patient, PrescriptionItem, QueueStatus } from '../types';
import type {
  BackendDoctorQueueItem,
  BackendDoctorScreening,
  BackendExaminationDetail,
  BackendPastVisit,
  BackendPatientHistory,
  BackendSubstanceHistory,
  SaveExaminationPayload,
} from '../../../services/api';

/**
 * ==============================================================================
 * แปลงข้อมูลจาก backend เป็นรูปแบบ Patient ที่หน้าจอแพทย์ใช้
 * ==============================================================================
 * backend จัดรูปแบบมาให้ตรงกับ types.ts อยู่แล้ว (status, bp, triage, id)
 * ไฟล์นี้จึงทำแค่จับคู่ชื่อฟิลด์ กับแตกสตริงที่เก็บรวมกันมาเป็น array
 *
 * ฟิลด์ที่หน้าจอมีแต่ backend ยังไม่มี (ผลตรวจ, วินิจฉัย, ใบสั่งยา ฯลฯ)
 * จะเป็น undefined ไปก่อน แล้วเติมในเฟส 2 เมื่อตาราง examinations พร้อม
 */

const QUEUE_STATUSES: QueueStatus[] = [
  'Waiting',
  'Screened',
  'Examining',
  'Pending Pharmacy',
  'Completed',
  'Cancelled',
];

function toQueueStatus(value: string | undefined): QueueStatus {
  return QUEUE_STATUSES.includes(value as QueueStatus) ? (value as QueueStatus) : 'Waiting';
}

function toGender(value: string | undefined): Patient['gender'] {
  if (!value) return 'Other';
  if (value.includes('หญิง') || /^female$/i.test(value)) return 'Female';
  if (value.includes('ชาย') || /^male$/i.test(value)) return 'Male';
  return 'Other';
}

/** แตกข้อความที่คั่นด้วย , ; หรือขึ้นบรรทัดใหม่ เป็น array (คืน undefined ถ้าว่าง) */
function toList(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  const items = value
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

/** ตัดส่วนเวลาออกจาก ISO timestamp ให้เหลือ 1995-11-22 */
function toDateOnly(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.slice(0, 10);
}

function mapVitals(screening: BackendDoctorScreening): Patient['vitals'] {
  return {
    bp: screening.bp,
    pulse: screening.heart_rate,
    respiratoryRate: screening.respiratory_rate,
    temp: screening.temperature,
    spo2: screening.spo2,
    weight: screening.weight,
    height: screening.height,
    bmi: screening.bmi,

    // 0 = พยาบาลไม่ได้กรอก ต่างจาก 0 ที่แปลว่า "ไม่ปวดเลย" ไม่ได้ในระดับ API
    // จึงปล่อยเป็น undefined ให้หน้าจอแสดงว่ายังไม่มีข้อมูล ดีกว่าโชว์ 0/10 ลอยๆ
    painScore: screening.pain_score > 0 ? screening.pain_score : undefined,
    bloodSugar: screening.blood_sugar > 0 ? screening.blood_sugar : undefined,
  };
}

/** แปลงข้อความประวัติการสูบบุหรี่ / ดื่มสุรา ที่พยาบาลบันทึกเป็นข้อความอิสระ
 *
 *  หน้าจอแพทย์เก็บเป็นอ็อบเจกต์ { isUser, status } จึงต้องเดาจากคำที่พบ
 *  ถ้าเจอคำปฏิเสธ ("ไม่", "ปฏิเสธ", "no", "non", "never") ถือว่าไม่ได้ใช้
 *  ส่วนข้อความเต็มยังเก็บไว้ใน status ให้แพทย์อ่านคำเดิมของพยาบาลได้
 */
function toSubstanceFromText(
  text: string | undefined
): { isUser: boolean; status: string } | undefined {
  const value = (text || '').trim();
  if (value === '') return undefined;

  const denies = /ไม่|ปฏิเสธ|เลิก|no|non|never|deny/i.test(value);
  return { isUser: !denies, status: value };
}

function mapTriage(screening: BackendDoctorScreening): Patient['triage'] {
  if (!screening.triage_code) return undefined;

  return {
    level: screening.triage_code as NonNullable<Patient['triage']>['level'],
    priority: (screening.triage_priority || 'Low') as NonNullable<Patient['triage']>['priority'],
    // เก็บข้อความไทยที่พยาบาลบันทึกไว้ด้วย เผื่อแพทย์อยากเห็นคำเดิม
    notes: screening.triage_level,
  };
}

export function mapQueueItemToPatient(item: BackendDoctorQueueItem): Patient {
  const { patient, screening } = item;

  const mapped: Patient = {
    id: item.id,
    visitId: item.visit_id || undefined,
    queueId: item.queue_id || undefined,
    patientId: patient.id || undefined,
    visitCount: item.visit_count ?? 0,

    queueNo: item.queue_number,
    hn: patient.hn,
    vn: item.vn,
    name: patient.fullname,
    gender: toGender(patient.gender),
    age: patient.age,
    dob: toDateOnly(patient.birthdate),
    nationalId: patient.national_id,
    phone: patient.phone_number,
    insuranceType: patient.scheme_type,

    visitDate: item.visit_date,
    visitTime: item.visit_time,
    status: toQueueStatus(item.status),
    waitingTimeMinutes: item.waiting_minutes,

    // ข้อมูลติดตัวผู้ป่วยที่เก็บเป็นสตริงเดียวในตาราง patients
    chronicDiseases: toList(patient.chronic_diseases),
    drugAllergies: toList(patient.allergies),
  };

  if (screening) {
    mapped.screeningCompleted = true;
    mapped.screenedAt = screening.screened_at;
    mapped.screenedBy = screening.screened_by_name;
    mapped.chiefComplaint = screening.chief_complaint;
    mapped.nurseNotes = screening.nurse_notes;
    mapped.pastMedicalHistory = screening.medical_history;
    mapped.vitals = mapVitals(screening);
    mapped.triage = mapTriage(screening);

    // ประวัติแพ้ยาที่พยาบาลบันทึกตอนคัดกรอง ละเอียดกว่าที่อยู่ในแฟ้มผู้ป่วย
    const screeningAllergies = toList(screening.allergies);
    if (screeningAllergies) {
      mapped.drugAllergies = screeningAllergies;
    }

    // ประวัติที่จุดคัดกรองเพิ่งเริ่มเก็บให้ ทั้งหมดเว้นว่างได้
    const foodAllergies = toList(screening.food_allergies);
    if (foodAllergies) {
      mapped.foodAllergies = foodAllergies;
    }

    const medications = toList(screening.current_medications);
    if (medications) {
      mapped.currentMedications = medications;
    }

    mapped.smokingHistory = toSubstanceFromText(screening.smoking_history);
    mapped.alcoholHistory = toSubstanceFromText(screening.alcohol_history);
  } else {
    mapped.screeningCompleted = false;
  }

  // การวินิจฉัยหลัก — backend ส่งมาเฉพาะรายการที่แพทย์บันทึกผลตรวจแล้ว
  // (ใช้ในหน้าประวัติเวชระเบียน คิวที่ยังไม่ตรวจจะไม่มีค่านี้)
  if (item.diagnosis) {
    mapped.diagnosis = item.diagnosis;
    mapped.primaryDiagnosis = {
      code: item.icd_code || '',
      name: item.diagnosis,
      localName: item.diagnosis,
    };
  }

  return mapped;
}

/**
 * ==============================================================================
 * ส่วนที่ 2: ผลการตรวจและวินิจฉัยโรค (เฟส 2)
 * ==============================================================================
 * applyExaminationDetail  - เอาผลตรวจที่บันทึกไว้จาก backend มาเติมลงใน Patient
 * buildExaminationRequest - แปลง Patient ที่หน้าจอแก้แล้ว กลับเป็น body ของ API
 *
 * หลักการ: ถ้าฝั่ง backend ยังว่าง (ยังไม่เคยบันทึกการตรวจ) จะไม่เขียนทับค่าที่
 * มีอยู่แล้วใน Patient (ซึ่งมาจากการคัดกรองของพยาบาล) เพื่อไม่ให้ข้อมูลหาย
 */

/** คืนค่าเดิมถ้าค่าใหม่เป็นสตริงว่าง (กันข้อมูลจากพยาบาลโดนล้าง) */
function keep(next: string | undefined, prev: string | undefined): string | undefined {
  const trimmed = (next || '').trim();
  return trimmed !== '' ? trimmed : prev;
}

/** true เมื่อมีอย่างน้อยหนึ่งฟิลด์ในอ็อบเจกต์ที่ไม่ว่าง */
function hasContent(obj: object): boolean {
  return Object.values(obj).some(
    (value) => typeof value === 'string' && value.trim() !== ''
  );
}

function toDiagnosisItem(item: { code: string; name: string; localName: string }): DiagnosisItem {
  return {
    code: item.code,
    name: item.name,
    localName: item.localName || undefined,
  };
}

function toSubstanceHistory(
  next: BackendSubstanceHistory | null,
  prev: Patient['smokingHistory']
): Patient['smokingHistory'] {
  if (!next) return prev;
  if (!next.isUser && !(next.status || '').trim()) return prev;

  return {
    isUser: next.isUser,
    status: next.status,
    frequency: next.frequency || undefined,
    duration: next.duration || undefined,
  };
}

function applyPatientHistory(base: Patient, history: BackendPatientHistory | null): void {
  if (!history) return;

  base.pastMedicalHistory = keep(history.pastMedicalHistory, base.pastMedicalHistory);
  base.pastSurgery = keep(history.pastSurgery, base.pastSurgery);
  base.hospitalAdmissionHistory = keep(history.hospitalAdmissionHistory, base.hospitalAdmissionHistory);
  base.familyHistory = keep(history.familyHistory, base.familyHistory);
  base.socialHistory = keep(history.socialHistory, base.socialHistory);

  base.smokingHistory = toSubstanceHistory(history.smokingHistory, base.smokingHistory);
  base.alcoholHistory = toSubstanceHistory(history.alcoholHistory, base.alcoholHistory);

  if (history.currentMedications && history.currentMedications.length > 0) {
    base.currentMedications = history.currentMedications;
  }
}

/** รวมผลการตรวจจาก GET /visits/:id/examination เข้ากับ Patient ที่มาจากคิว */
export function applyExaminationDetail(base: Patient, detail: BackendExaminationDetail): Patient {
  const merged: Patient = { ...base };

  merged.vn = detail.vn || merged.vn;
  // ใบสั่งยาที่เคยบันทึกไว้ ให้แสดงกลับตอนเปิดเคสเดิมมาแก้ต่อ
  // ถ้ายังไม่เคยบันทึกยาเลย จะไม่เขียนทับรายการที่แพทย์เพิ่งพิมพ์ค้างไว้บนหน้าจอ
  //
  // ตาราง dispensings เก็บวิธีใช้ยารวมเป็นข้อความเดียวในช่อง instructions
  // (ตอนบันทึกรวม route + timing + specialInstructions เข้าด้วยกัน)
  // อ่านกลับจึงคืนลง specialInstructions ช่องเดียว แพทย์แก้ต่อได้ตามปกติ
  if (detail.prescriptions && detail.prescriptions.length > 0) {
    merged.prescriptions = detail.prescriptions.map((item, index) => ({
      id: item.id || `rx-${index + 1}`,
      medicineName: item.medicineName || '',
      dosage: item.dosage || '',
      frequency: item.frequency || '',
      duration: item.duration || '',
      quantity: Number(item.quantity) || 0,
      route: '',
      timing: '',
      specialInstructions: item.instructions || '',
    }));
  }

  merged.presentIllness = keep(detail.presentIllness, merged.presentIllness);
  merged.chiefComplaintDuration = keep(detail.chiefComplaintDuration, merged.chiefComplaintDuration);
  merged.assessmentNotes = keep(detail.assessmentNotes, merged.assessmentNotes);
  merged.clinicalNotes = keep(detail.clinicalNotes, merged.clinicalNotes);
  merged.treatmentPlan = keep(detail.treatmentPlan, merged.treatmentPlan);
  merged.proceduresPerformed = keep(detail.proceduresPerformed, merged.proceduresPerformed);

  if (detail.physicalExam && hasContent(detail.physicalExam)) {
    merged.physicalExam = { ...detail.physicalExam };
  }
  if (detail.counseling && hasContent(detail.counseling)) {
    merged.counseling = { ...detail.counseling };
  }
  if (detail.followUp && hasContent(detail.followUp)) {
    merged.followUp = { ...detail.followUp };
  }

  if (detail.primaryDiagnosis) {
    merged.primaryDiagnosis = toDiagnosisItem(detail.primaryDiagnosis);
    // ฟิลด์เดิมของหน้าจอที่เก็บชื่อโรคเป็นข้อความเดียว
    merged.diagnosis =
      detail.primaryDiagnosis.localName || detail.primaryDiagnosis.name || merged.diagnosis;
  }
  if (detail.secondaryDiagnoses && detail.secondaryDiagnoses.length > 0) {
    merged.secondaryDiagnoses = detail.secondaryDiagnoses.map(toDiagnosisItem);
  }

  applyPatientHistory(merged, detail.patientHistory);

  if (detail.signed_at) {
    merged.activityLog = {
      ...merged.activityLog,
      updatedAt: detail.signed_at,
      updatedBy: detail.doctor_name || merged.activityLog?.updatedBy,
    };
  }

  return merged;
}

/** แปลง Patient ที่แพทย์แก้ในหน้าจอ เป็น body สำหรับ PUT /visits/:id/examination */
export function buildExaminationRequest(
  patient: Patient,
  action: 'draft' | 'sign'
): SaveExaminationPayload {
  const exam = patient.physicalExam || {};
  const advice = patient.counseling || {};
  const followUp = patient.followUp || {};

  return {
    action,

    presentIllness: patient.presentIllness || '',
    chiefComplaintDuration: patient.chiefComplaintDuration || '',
    physicalExam: {
      generalAppearance: exam.generalAppearance || '',
      heent: exam.heent || '',
      cardiovascular: exam.cardiovascular || '',
      respiratory: exam.respiratory || '',
      abdomen: exam.abdomen || '',
      musculoskeletal: exam.musculoskeletal || '',
      neurological: exam.neurological || '',
      skin: exam.skin || '',
    },
    assessmentNotes: patient.assessmentNotes || '',
    clinicalNotes: patient.clinicalNotes || '',
    treatmentPlan: patient.treatmentPlan || '',
    proceduresPerformed: patient.proceduresPerformed || '',
    counseling: {
      medicationAdvice: advice.medicationAdvice || '',
      dietAdvice: advice.dietAdvice || '',
      exerciseAdvice: advice.exerciseAdvice || '',
      lifestyleAdvice: advice.lifestyleAdvice || '',
      diseaseEducation: advice.diseaseEducation || '',
    },
    followUp: {
      // backend รับเป็น YYYY-MM-DD เท่านั้น
      followUpDate: (followUp.followUpDate || '').slice(0, 10),
      reason: followUp.reason || '',
      instructions: followUp.instructions || '',
    },

    primaryDiagnosis: patient.primaryDiagnosis
      ? {
          code: patient.primaryDiagnosis.code || '',
          name: patient.primaryDiagnosis.name || '',
          localName: patient.primaryDiagnosis.localName || '',
        }
      : null,
    secondaryDiagnoses: (patient.secondaryDiagnoses || []).map((item) => ({
      code: item.code || '',
      name: item.name || '',
      localName: item.localName || '',
    })),

    patientHistory: {
      pastMedicalHistory: patient.pastMedicalHistory || '',
      pastSurgery: patient.pastSurgery || '',
      hospitalAdmissionHistory: patient.hospitalAdmissionHistory || '',
      familyHistory: patient.familyHistory || '',
      socialHistory: patient.socialHistory || '',
      smokingHistory: patient.smokingHistory
        ? {
            isUser: patient.smokingHistory.isUser,
            status: patient.smokingHistory.status || '',
            frequency: patient.smokingHistory.frequency || '',
            duration: patient.smokingHistory.duration || '',
          }
        : null,
      alcoholHistory: patient.alcoholHistory
        ? {
            isUser: patient.alcoholHistory.isUser,
            status: patient.alcoholHistory.status || '',
            frequency: patient.alcoholHistory.frequency || '',
            duration: patient.alcoholHistory.duration || '',
          }
        : null,
      currentMedications: patient.currentMedications || [],
    },
    prescriptions: (patient.prescriptions || []).map((p: PrescriptionItem) => ({
      id: p.id,
      medicineName: p.medicineName,
      dosage: p.dosage,
      frequency: p.frequency,
      duration: p.duration,
      quantity: Number(p.quantity) || 1,
      instructions: [p.route, p.timing, p.specialInstructions].filter(Boolean).join(' - ') || 'รับประทานตามแพทย์สั่ง',
      status: 'Active'
    })),
    allergies: Array.isArray(patient.drugAllergies) ? patient.drugAllergies.join(', ') : '',
    chronicDiseases: Array.isArray(patient.chronicDiseases) ? patient.chronicDiseases.join(', ') : '',
  };
}

/** แปลงประวัติการมาตรวจย้อนหลัง 1 รายการ ให้เป็นรูปแบบที่หน้าเวชระเบียนใช้ */
export function mapPastVisit(item: BackendPastVisit): PastVisitRecord {
  return {
    id: `v-${item.id}`,
    vn: item.vn,
    visitDate: item.visitDate,
    visitTime: item.visitTime || undefined,
    doctorName: item.doctorName || undefined,
    department: item.department || undefined,
    // endpoint ประวัติยังไม่ส่งอาการสำคัญของครั้งนั้นมา จึงเว้นว่างไว้ก่อน
    chiefComplaint: '',
    diagnosis: item.diagnosis || '',
    icdCode: item.icdCode || undefined,
    vitals: item.vitals || undefined,
    followUpDate: item.followUpDate || undefined,
    status: item.status || undefined,
  };
}
