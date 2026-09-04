// Central API Service Client for Clinic Management System
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

const TOKEN_KEY = 'clinic_auth_token';

export const tokenStorage = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  remove: () => localStorage.removeItem(TOKEN_KEY),
};

// Helper to ensure valid token from server
async function ensureToken(): Promise<string | null> {
  let token = tokenStorage.get();
  if (!token) {
    try {
      const savedUserStr = localStorage.getItem('clinic_auth_user');
      let username = 'registrar1';
      if (savedUserStr) {
        try {
          const savedUser = JSON.parse(savedUserStr);
          if (savedUser.role === 'nurse') username = 'nurse1';
          else if (savedUser.role === 'nurse_assistant') username = 'assistant1';
          else if (savedUser.role === 'doctor') username = 'doctor1';
          else if (savedUser.username) username = savedUser.username;
        } catch {
          // ignore
        }
      }
      const res = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password: 'password' }),
      });
      const data = await res.json().catch(() => null);
      if (data && data.token) {
        token = data.token;
        tokenStorage.set(data.token);
      }
    } catch {
      // ignore
    }
  }
  return token;
}

// Generic HTTP Request Handler
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  let token = tokenStorage.get();
  if (!token && endpoint !== '/login') {
    token = await ensureToken();
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}${endpoint}`;
  let response = await fetch(url, {
    ...options,
    headers,
  });

  // If 401 Unauthorized, try refreshing token once
  if (response.status === 401 && endpoint !== '/login') {
    tokenStorage.remove();
    token = await ensureToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      response = await fetch(url, {
        ...options,
        headers,
      });
    }
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = data?.error || data?.message || `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return data as T;
}

// 1. Auth API
export const authApi = {
  login: async (username: string, password?: string) => {
    const res = await request<{
      token: string;
      role: string;
      user: {
        id: number;
        username: string;
        fullname: string;
        role: string;
        phone: string;
      };
    }>('/login', {
      method: 'POST',
      body: JSON.stringify({ username, password: password || 'password' }),
    });

    if (res.token) {
      tokenStorage.set(res.token);
    }
    return res;
  },
  logout: () => {
    tokenStorage.remove();
  },
};

// 2. Patient API (Registration & Search)
export interface BackendPatient {
  id: number;
  hn: string;
  national_id: string;
  fullname: string;
  gender: string;
  birthdate: string;
  address: string;
  phone_number: string;
  emergency_contact: string;
  scheme_type: string;
  allergies: string;
  chronic_diseases: string;
  created_at: string;
  updated_at: string;
}

export const patientApi = {
  getAll: () => request<BackendPatient[]>('/api/registrar/patients'),
  register: (payload: {
    hn?: string;
    national_id: string;
    fullname: string;
    gender: string;
    birthdate: string;
    address: string;
    phone_number: string;
    emergency_contact: string;
    scheme_type?: string;
    allergies?: string;
    chronic_diseases?: string;
  }) =>
    request<{ message: string; patient: BackendPatient }>('/api/registrar/patients', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  search: (query: string) => {
    const clean = query.trim();
    return request<BackendPatient | BackendPatient[]>(`/api/registrar/patients/search?q=${encodeURIComponent(clean)}`);
  },
};

// 3. Queue API
export interface BackendQueue {
  id: number;
  patient_id: number;
  created_by_user_id: number;
  queue_number: string;
  status: string;
  department: string;
  note: string;
  created_at: string;
  updated_at: string;
  patient?: BackendPatient;
  created_by?: {
    id: number;
    username: string;
    fullname: string;
    role: string;
  };
}

export const queueApi = {
  getList: () => request<BackendQueue[]>('/api/queue/list'),
  create: (patientId: number, department?: string, note?: string) =>
    request<{ message: string; queue: BackendQueue }>('/api/queue/create', {
      method: 'POST',
      body: JSON.stringify({ patient_id: patientId, department, note }),
    }),
  updateStatus: (queueId: number | string, status: string, department?: string, note?: string) =>
    request<{ message: string; queue: BackendQueue }>(`/api/queue/${queueId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, department, note }),
    }),
};

// 4. Eligibility API (U2)
export interface BackendEligibility {
  id: number;
  patient_id: number;
  user_id?: number;
  scheme_type: string;
  coverage_details: string;
  hospital_name: string;
  status: string;
  expire_date: string;
  verified_at: string;
  patient?: BackendPatient;
}

export const eligibilityApi = {
  check: (nationalId: string) =>
    request<{
      patient_id: number;
      fullname: string;
      national_id: string;
      scheme_type: string;
      coverage_details: string;
      verified_at: string;
    }>(`/api/registrar/eligibility/check/${nationalId.replace(/[-\s]/g, '')}`),
  save: (payload: {
    patient_id: number;
    scheme_type: string;
    coverage_details?: string;
    hospital_name?: string;
    status?: string;
    expire_date?: string;
  }) =>
    request<{ message: string }>('/api/registrar/eligibility/save', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getHistory: () => request<BackendEligibility[]>('/api/registrar/eligibility/history'),
};

// 5. Vitals & Screening API
export interface BackendScreening {
  id: number;
  visit_id: number;
  screened_by_user_id: number;
  assigned_doctor_id?: number;
  triage_level: string;
  chief_complaint: string;
  allergies: string;
  medical_history: string;
  nurse_notes: string;
  weight: number;
  height: number;
  bmi: number;
  temperature: number;
  systolic_bp: number;
  diastolic_bp: number;
  heart_rate: number;
  respiratory_rate: number;
  spo2: number;
  pain_score?: number;
  blood_sugar?: number;
  food_allergies?: string;
  current_medications?: string;
  smoking_history?: string;
  alcohol_history?: string;
  created_at: string;
  updated_at: string;
  visit_record?: {
    id: number;
    patient_id: number;
    doctor_id: number;
    visit_date: string;
    patient?: BackendPatient;
  };
  screened_by?: {
    id: number;
    username: string;
    fullname: string;
    role: string;
  };
  assigned_doctor?: {
    id: number;
    username: string;
    fullname: string;
    role: string;
  };
}

export interface BackendDoctor {
  id: number;
  username: string;
  fullname: string;
  role: string;
  phone: string;
}

export const vitalsApi = {
  getDoctors: () => request<BackendDoctor[]>('/api/doctors'),
  record: (payload: {
    queue_id?: number;
    patient_id: number;
    queue_number?: string;
    chief_complaint: string;
    weight: number;
    height: number;
    temperature: number;
    systolic_bp: number;
    diastolic_bp: number;
    heart_rate: number;
    respiratory_rate?: number;
    spo2?: number;
    pain_score?: number;
    blood_sugar?: number;
    food_allergies?: string;
    current_medications?: string;
    smoking_history?: string;
    alcohol_history?: string;
    allergies?: string;
    medical_history?: string;
    nurse_notes?: string;
    assigned_doctor_id?: number;
    triage_level?: string;
  }) =>
    request<{
      message: string;
      screening_id: number;
      bmi: number;
      triage_level: string;
    }>('/api/nurse/vitals', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getAllHistory: () => request<BackendScreening[]>('/api/nurse/vitals/history'),
  getPatientHistory: (patientId: number | string) =>
    request<{ patient_id: string; history: BackendScreening[] }>(`/api/nurse/vitals/history/${patientId}`),
};

// ==============================================================================
// 6. Officer DMS (Document Management & Forwarding) API
// ==============================================================================
export interface BackendUser {
  id: number;
  username: string;
  fullname?: string;
  full_name?: string;
  role: string;
  phone?: string;
}

export interface BackendDocument {
  id: number;
  external_doc_ref: string;
  subject: string;
  file_url: string;
  status?: 'reviewing' | 'approved' | 'draft' | string;
  doc_type?: string;
  created_by: number;
  approved_by?: number | null;
  created_at: string;
  updated_at: string;
  creator?: BackendUser;
  approver?: BackendUser;
}

export interface BackendDocumentForward {
  id: number;
  doc_id: number;
  forwarded_to: number;
  status: 'Pending' | 'Acknowledged';
  acknowledged_at?: string | null;
  created_at: string;
  updated_at: string;
  document?: BackendDocument;
  recipient?: BackendUser;
}

export const dmsApi = {
  getDocuments: () => request<BackendDocument[]>('/api/officer/documents'),
  getDocumentById: (id: number | string) => request<BackendDocument>(`/api/officer/documents/${id}`),
  createDocument: (payload: {
    external_doc_ref?: string;
    subject: string;
    file_url?: string;
    doc_type?: string;
    status?: string;
  }) =>
    request<{ message: string; document: BackendDocument }>('/api/officer/documents', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  approveDocument: (id: number | string) =>
    request<{ message: string; document: BackendDocument }>(`/api/officer/documents/${id}/approve`, {
      method: 'PUT',
    }),
  updateDocumentStatus: (id: number | string, status: 'approved' | 'reviewing' | 'draft') =>
    request<{ message: string; document: BackendDocument }>(`/api/officer/documents/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),
  getForwards: () => request<BackendDocumentForward[]>('/api/officer/documents/forwards'),
  forwardDocument: (payload: {
    doc_id: number;
    forwarded_to: number;
  }) =>
    request<{ message: string; forward: BackendDocumentForward }>('/api/officer/documents/forward', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  acknowledgeForward: (id: number | string) =>
    request<{ message: string; forward: BackendDocumentForward }>(`/api/officer/documents/forwards/${id}/ack`, {
      method: 'PUT',
    }),
  getRecipients: () => request<BackendUser[]>('/api/officer/recipients'),
};

// ==============================================================================
// 7. Doctor API - คิวตรวจของแพทย์, รายละเอียดเคส, เปลี่ยนสถานะการตรวจ
// ==============================================================================
// รูปแบบที่ backend ส่งมาถูกจัดให้ตรงกับ types.ts ของโมดูลแพทย์แล้ว
// (status เป็นชุด QueueStatus, id เป็น string, bp เป็น "120/80",
//  triage เป็น Level 1-5) จึงแทบไม่ต้องแปลงอะไรเพิ่มที่ฝั่งนี้

export interface BackendDoctorPatient {
  id: number;
  hn: string;
  national_id: string;
  fullname: string;
  gender: string;
  birthdate: string;
  age: number;
  phone_number: string;
  scheme_type: string;
  allergies: string;
  chronic_diseases: string;
}

export interface BackendDoctorScreening {
  id: number;
  chief_complaint: string;
  allergies: string;
  medical_history: string;
  nurse_notes: string;
  triage_level: string;
  triage_code: string;
  triage_priority: string;
  bp: string;
  systolic_bp: number;
  diastolic_bp: number;
  weight: number;
  height: number;
  bmi: number;
  temperature: number;
  heart_rate: number;
  respiratory_rate: number;
  spo2: number;

  // คอลัมน์ที่จุดคัดกรองเพิ่งเพิ่มให้ ค่าเป็น 0 หรือสตริงว่างได้ถ้าพยาบาลไม่ได้กรอก
  pain_score: number;
  blood_sugar: number;
  food_allergies: string;
  current_medications: string;
  smoking_history: string;
  alcohol_history: string;

  screened_by_name: string;
  screened_at: string;
}

export interface BackendDoctorQueueItem {
  id: string;
  status: string;
  queue_id: number;
  queue_number: string;
  queue_status: string;
  department: string;
  note: string;
  queued_at: string;
  visit_date: string;
  visit_time: string;
  waiting_minutes: number;
  visit_id: number;
  vn: string;
  assigned_doctor_id: number;
  assigned_doctor_name: string;
  patient: BackendDoctorPatient;
  screening: BackendDoctorScreening | null;

  // การวินิจฉัยหลักของครั้งนั้น — มีเฉพาะรายการที่แพทย์บันทึกผลตรวจแล้ว
  diagnosis?: string;
  icd_code?: string;

  // จำนวนครั้งที่เคยมาตรวจ 0 = เพิ่งลงทะเบียน ยังไม่เคยเข้าตรวจ
  visit_count?: number;
}

export interface BackendDoctorQueueSummary {
  total_today: number;
  waiting: number;
  examining: number;
  completed_today: number;
  avg_wait_minutes: number;
}

export interface BackendDoctorQueueResponse {
  doctor_id: number;
  doctor_name: string;
  summary: BackendDoctorQueueSummary;
  items: BackendDoctorQueueItem[];
}

export interface BackendDoctorVisitDetail {
  id: string;
  status: string;
  visit_id: number;
  vn: string;
  visit_date: string;
  visit_time: string;
  visit_at: string;
  visit_type: string;
  department: string;
  started_at: string | null;
  ended_at: string | null;
  doctor_id: number;
  doctor_name: string;
  queue_id: number;
  queue_number: string;
  queue_status: string;
  patient: BackendDoctorPatient;
  eligibility: {
    scheme_type: string;
    coverage_details: string;
    hospital_name: string;
    status: string;
    expire_date: string;
  } | null;
  screening: BackendDoctorScreening | null;
}

export interface BackendPatientRecordsResponse {
  query: string;
  total: number;
  items: BackendDoctorQueueItem[];
}

export interface BackendDoctorProfile {
  user_id: number;
  username: string;
  fullname: string;
  phone: string;
  role: string;
  doctor_id?: number;
  license_number?: string;
  specialty?: string;
  room?: string;
  email?: string;
  is_active?: boolean;
}

export const doctorApi = {
  getProfile: () => request<BackendDoctorProfile>('/api/doctor/me'),

  // scope 'all' = ดูคิวของแพทย์ทุกคน (ค่าเริ่มต้นคือเฉพาะคิวของตัวเอง)
  getQueue: (scope?: 'all') =>
    request<BackendDoctorQueueResponse>(`/api/doctor/queue${scope ? `?scope=${scope}` : ''}`),

  getVisit: (visitId: number | string) =>
    request<BackendDoctorVisitDetail>(`/api/doctor/visits/${visitId}`),

  // ประวัติเวชระเบียน: ไม่จำกัดวันและสถานะ จึงเจอผู้ป่วยที่ตรวจเสร็จไปแล้วด้วย
  // ต่างจาก getQueue ที่คืนเฉพาะคิวที่ยังเดินอยู่ กับคิวที่ปิดไปแล้ววันนี้
  getPatientRecords: (query?: string, limit = 200) => {
    const params = new URLSearchParams();
    if (query && query.trim()) params.set('q', query.trim());
    params.set('limit', String(limit));
    return request<BackendPatientRecordsResponse>(`/api/doctor/patient-records?${params.toString()}`);
  },

  // status ใช้ค่าเดียวกับ QueueStatus: Waiting | Examining | Pending Pharmacy | Completed | Cancelled
  updateVisitStatus: (visitId: number | string, status: string, note?: string) =>
    request<{ message: string; status: string; vn: string }>(
      `/api/doctor/visits/${visitId}/status`,
      {
        method: 'PUT',
        body: JSON.stringify({ status, note: note ?? '' }),
      }
    ),
};


// ==============================================================================
// 7. Examination API - บันทึกผลการตรวจและวินิจฉัยโรค (ระบบย่อยที่ 1 ของแพทย์)
// ==============================================================================
// object ย่อย (physicalExam, counseling, followUp, diagnosis, patientHistory)
// backend ตั้งชื่อฟิลด์ให้ตรงกับ types.ts ของโมดูลแพทย์แล้ว จึงนำไปใส่ Patient
// ได้เกือบตรงๆ ส่วนฟิลด์ระดับบนสุดยังเป็น snake_case เหมือน endpoint อื่น

export interface BackendPhysicalExam {
  generalAppearance: string;
  heent: string;
  cardiovascular: string;
  respiratory: string;
  abdomen: string;
  musculoskeletal: string;
  neurological: string;
  skin: string;
}

export interface BackendCounseling {
  medicationAdvice: string;
  dietAdvice: string;
  exerciseAdvice: string;
  lifestyleAdvice: string;
  diseaseEducation: string;
}

export interface BackendFollowUp {
  followUpDate: string;
  reason: string;
  instructions: string;
}

export interface BackendDiagnosisItem {
  code: string;
  name: string;
  localName: string;
}

export interface BackendSubstanceHistory {
  isUser: boolean;
  status: string;
  frequency: string;
  duration: string;
}

export interface BackendPatientHistory {
  pastMedicalHistory: string;
  pastSurgery: string;
  hospitalAdmissionHistory: string;
  familyHistory: string;
  socialHistory: string;
  smokingHistory: BackendSubstanceHistory | null;
  alcoholHistory: BackendSubstanceHistory | null;
  currentMedications: string[] | null;
}

export interface BackendExaminationDetail {
  visit_id: number;
  vn: string;

  // Draft = ยังแก้ไขได้, Signed = เซ็นปิดการตรวจแล้ว, "" = ยังไม่เคยบันทึก
  status: string;
  signed_at: string;
  editable: boolean;

  doctor_id: number;
  doctor_name: string;

  presentIllness: string;
  chiefComplaintDuration: string;
  physicalExam: BackendPhysicalExam;
  assessmentNotes: string;
  clinicalNotes: string;
  treatmentPlan: string;
  proceduresPerformed: string;
  counseling: BackendCounseling;
  followUp: BackendFollowUp;

  primaryDiagnosis: BackendDiagnosisItem | null;
  secondaryDiagnoses: BackendDiagnosisItem[] | null;

  // ใบสั่งยาที่บันทึกไว้ อ่านกลับจากตาราง dispensings
  prescriptions: BackendPrescriptionItem[] | null;

  patient: BackendDoctorPatient;
  screening: BackendDoctorScreening | null;
  patientHistory: BackendPatientHistory | null;
}

export interface BackendPrescriptionItem {
  id?: string;
  medicineId?: number;
  medicineCode?: string;
  medicineName: string;
  genericName?: string;
  category?: string;
  dosage: string;
  frequency?: string;
  duration?: string;
  quantity: number;
  unitPrice?: number;
  totalPrice?: number;
  instructions?: string;
  notes?: string;
  status?: string;
}

export interface SaveExaminationPayload {
  // draft = บันทึกร่าง (แก้ต่อได้), sign = เซ็นปิดการตรวจ (ต้องมีวินิจฉัยหลัก)
  action: 'draft' | 'sign';

  presentIllness: string;
  chiefComplaintDuration: string;
  physicalExam: BackendPhysicalExam;
  assessmentNotes: string;
  clinicalNotes: string;
  treatmentPlan: string;
  proceduresPerformed: string;
  counseling: BackendCounseling;
  followUp: BackendFollowUp;

  primaryDiagnosis: BackendDiagnosisItem | null;
  secondaryDiagnoses: BackendDiagnosisItem[];

  patientHistory: BackendPatientHistory | null;
  prescriptions?: BackendPrescriptionItem[];
  allergies?: string;
  chronicDiseases?: string;
}

export interface SaveExaminationResult {
  message: string;
  examination_id: number;
  status: string;
  visit_status: string;
  diagnosis_count: number;

  // จำนวนยาที่ส่งต่อห้องยาได้จริง
  prescription_count?: number;

  // ชื่อยาที่ไม่มีในคลังของห้องยา จึงส่งต่อไม่ได้ ต้องเตือนแพทย์
  unmatched_medicines?: string[];
}

export interface BackendPastVisit {
  id: number;
  vn: string;
  visitDate: string;
  visitTime: string;
  doctorName: string;
  department: string;
  diagnosis: string;
  icdCode: string;
  vitals?: {
    bp?: string;
    pulse?: number;
    temp?: number;
    weight?: number;
    spo2?: number;
  } | null;
  followUpDate: string;
  status: string;
}

export const examinationApi = {
  get: (visitId: number | string) =>
    request<BackendExaminationDetail>(`/api/doctor/visits/${visitId}/examination`),

  save: (visitId: number | string, payload: SaveExaminationPayload) =>
    request<SaveExaminationResult>(`/api/doctor/visits/${visitId}/examination`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  getPatientVisits: (patientId: number | string) =>
    request<{ patient_id: number; history: BackendPastVisit[] }>(
      `/api/doctor/patients/${patientId}/visits`
    ),
};
