// Central API Service Client for Clinic Management System
//
// ==============================================================================
// ไฟล์นี้เป็นของกลาง ทุก role ใช้ร่วมกัน  ห้ามเขียนทับทั้งไฟล์เด็ดขาด
// ==============================================================================
// ทุกคนในทีมเพิ่ม export ของตัวเองไว้ในไฟล์นี้ เช่น
//   doctorApi / examinationApi (แพทย์)   dmsApi (งานเอกสาร)
//   pharmacyApi (ห้องยา)                  billingApi (การเงิน)
//
// เคยเกิดขึ้นจริง: มีคนแก้ไฟล์นี้โดยใช้สำเนาเก่าที่ดึงไว้ก่อนเพื่อน merge งานเข้ามา
// พอเซฟทับ export ของเพื่อนที่เพิ่งเพิ่ม (dmsApi) หายไปทั้งก้อน
// ผลคือ "ทั้งเว็บจอขาว" ทุก role ใช้งานไม่ได้เลย เพราะไฟล์ที่ import ไม่เจอ
// จะหยุดทั้งโมดูลตั้งแต่ตอนโหลด error ที่ขึ้นคือ
//
//   Uncaught SyntaxError: The requested module '/src/services/api.ts'
//   does not provide an export named 'dmsApi'
//
// อาการหลอกมาก เพราะ tsc ผ่าน build ผ่าน และหน้าจอไม่ขึ้นอะไรให้เดาเลย
// ต้องเปิด DevTools > Console ถึงจะเห็น
//
// กติกาเวลาแก้ไฟล์นี้
//   1. git pull ก่อนเสมอ ให้แน่ใจว่าถืออยู่เวอร์ชันล่าสุด
//   2. แก้เฉพาะบล็อกของตัวเอง อย่าจัดรูปแบบหรือเรียงลำดับใหม่ทั้งไฟล์
//   3. ก่อน commit เช็คว่า export ของคนอื่นยังอยู่ครบ
//      grep -c "dmsApi\|pharmacyApi\|billingApi\|doctorApi" src/services/api.ts
//   4. ถ้าขนาดไฟล์ "เล็กลง" หลังแก้ ให้สงสัยไว้ก่อนว่าลบของคนอื่นไปแล้ว
// ==============================================================================
export const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const TOKEN_KEY = 'clinic_auth_token';

export const tokenStorage = {
  get: () => localStorage.getItem(TOKEN_KEY) || localStorage.getItem('token'),
  set: (token: string) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem('token', token);
  },
  remove: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('token');
  },
};

// Helper to ensure valid token from server
async function ensureToken(): Promise<string | null> {
  let token = tokenStorage.get();
  if (!token) {
    try {
      const savedUserStr = localStorage.getItem('clinic_auth_user');
      let username = 'cashier1';
      if (savedUserStr) {
        try {
          const savedUser = JSON.parse(savedUserStr);
          if (savedUser.role === 'nurse') username = 'nurse1';
          else if (savedUser.role === 'nurse_assistant') username = 'assistant1';
          else if (savedUser.role === 'doctor') username = 'doctor1';
          else if (savedUser.role === 'pharmacist') username = 'pharmacist1';
          else if (savedUser.role === 'cashier') username = 'cashier1';
          else if (savedUser.username) username = savedUser.username;
        } catch {
          // ignore
        }
      }
      const res = await fetch(`${API_BASE_URL}/api/login`, {
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
  if (!token && endpoint !== '/api/login') {
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
  if (response.status === 401 && endpoint !== '/api/login') {
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
      requires_password_change?: boolean;
      user: {
        id: number;
        username: string;
        fullname: string;
        role: string;
        phone: string;
      };
    }>('/api/login', {
      method: 'POST',
      body: JSON.stringify({ username, password: password || 'password' }),
    });

    if (res.token) {
      tokenStorage.set(res.token);
    }
    return res;
  },
  changePassword: (payload: { old_password: string; new_password: string }) =>
    request('/api/auth/change-password', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
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
  house_no?: string;
  village_no?: string;
  village_name?: string;
  alley?: string;
  road?: string;
  sub_district?: string;
  district?: string;
  province?: string;
  postal_code?: string;
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
    house_no?: string;
    village_no?: string;
    village_name?: string;
    alley?: string;
    road?: string;
    sub_district?: string;
    district?: string;
    province?: string;
    postal_code?: string;
    address?: string;
    phone_number: string;
    emergency_contact: string;
    scheme_type?: string;
    issue_queue?: boolean;
    allergies?: string;
    chronic_diseases?: string;
  }) =>
    request<{
      message: string;
      patient: BackendPatient;
      hn?: string;
      patient_id?: number;
      queue_number?: string;
      queue_id?: number;
      queue_issued: boolean;
      queue?: BackendQueue;
    }>('/api/registrar/patients', {
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

export interface QueueStats {
  total: number;
  active: number;
  waitingScreening: number;
  waitingDoctor: number;
  inExamination: number;
  waitingTreatment: number;
  waitingBilling: number;
  waitingPharmacy: number;
  completed: number;
  cancelled: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  stats?: QueueStats;
}

export const queueApi = {
  getList: (
    params?: {
      page?: number;
      limit?: number;
      status?: string;
      search?: string;
      category?: string;
    },
    options?: { signal?: AbortSignal }
  ) => {
    const searchParams = new URLSearchParams();
    if (params) {
      if (params.page !== undefined) searchParams.set('page', String(params.page));
      if (params.limit !== undefined) searchParams.set('limit', String(params.limit));
      if (params.status) searchParams.set('status', params.status);
      if (params.search) searchParams.set('search', params.search);
      if (params.category) searchParams.set('category', params.category);
    }
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return request<BackendQueue[] | PaginatedResponse<BackendQueue>>(`/api/queue/list${query}`, {
      signal: options?.signal,
    });
  },
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
      hospital_name?: string;
      expire_date?: string;
      status?: string;
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
  triage_level: number | string;
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
    queue_id?: number;
    queue_number?: string;
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
    herbal_medicines?: string;
    dietary_supplements?: string;
    has_uri?: boolean | null;
    has_tb?: boolean | null;
    on_anticoagulant?: boolean | null;
    precaution_type?: string;
    is_pregnant?: boolean | null;
    is_breastfeeding?: boolean | null;
    last_menstrual_period?: string;
    q2_depressed?: boolean | null;
    q2_anhedonia?: boolean | null;
    assigned_doctor_id?: number;
    triage_level?: number | string;
  }) =>
    request<{
      message: string;
      screening_id: number;
      visit_id?: number;
      queue_number?: string;
      bmi: number;
      triage_level: number | string;
    }>('/api/nurse/vitals', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getAllHistory: (
    params?: {
      page?: number;
      limit?: number;
      search?: string;
      triage?: string;
      date_preset?: string;
    },
    options?: { signal?: AbortSignal }
  ) => {
    const searchParams = new URLSearchParams();
    if (params) {
      if (params.page !== undefined) searchParams.set('page', String(params.page));
      if (params.limit !== undefined) searchParams.set('limit', String(params.limit));
      if (params.search) searchParams.set('search', params.search);
      if (params.triage) searchParams.set('triage', params.triage);
      if (params.date_preset) searchParams.set('date_preset', params.date_preset);
    }
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return request<BackendScreening[] | PaginatedResponse<BackendScreening>>(`/api/nurse/vitals/history${query}`, {
      signal: options?.signal,
    });
  },
  getPatientHistory: (patientId: number | string) =>
    request<{ patient_id: string; history: BackendScreening[] }>(`/api/nurse/vitals/history/${patientId}`),
};

// ==============================================================================
// 6. Officer DMS (Document Management & Forwarding) API
// ==============================================================================
export interface StorageBreakdown {
  type: string;
  size_bytes: number;
  size_mb: number;
  count: number;
}

export interface StorageStats {
  quota_bytes: number;
  quota_mb: number;
  used_bytes: number;
  used_mb: number;
  remaining_bytes: number;
  remaining_mb: number;
  percentage: number;
  total_files: number;
  breakdown?: StorageBreakdown[];
}

export interface BackendUser {
  id: number;
  username: string;
  fullname: string;
  full_name?: string;
  role: string;
  phone?: string;
  email?: string;
  employee_id?: string;
  status?: string;
  system_accesses?: Array<{ access_level?: number | string; [key: string]: any }>;
  created_at?: string;
  updated_at?: string;
}

export interface BackendDocument {
  id: number;
  external_doc_ref: string;
  subject: string;
  description?: string;
  file_url: string;
  file_size?: number;
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
    description?: string;
    file_url?: string;
    file_size?: number;
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
  getStorageStats: () => request<StorageStats>('/api/officer/storage/stats'),
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
  triage_level_num?: number;
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

  // คัดกรองอาการติดเชื้อทางเดินหายใจส่วนบน (URI)
  //   null / undefined = พยาบาลยังไม่ได้ประเมิน
  //   false            = ประเมินแล้ว ไม่มีอาการ
  //   true             = ประเมินแล้ว มีอาการ
  // ต้องแยก 3 สถานะ ห้ามยุบเหลือ true/false เพราะ "ยังไม่ประเมิน"
  // กับ "ประเมินแล้วไม่มี" มีความหมายทางคลินิกคนละอย่าง
  has_uri?: boolean | null;

  // คัดกรองวัณโรค (แยกผู้ป่วยออกจากคิวรวม) และการใช้ยาละลายลิ่มเลือด
  // (เสี่ยงเลือดออก + ตีกับยาหลายตัว) ใช้ 3 สถานะเหมือน has_uri
  has_tb?: boolean | null;
  on_anticoagulant?: boolean | null;

  // คัดกรองเฉพาะผู้ป่วยหญิง [role แพทย์]
  // is_pregnant / is_breastfeeding ใช้ 3 สถานะเหมือน has_uri
  // (null = ยังไม่ได้ถาม, false = ถามแล้วไม่ใช่, true = ใช่)
  is_pregnant?: boolean | null;
  is_breastfeeding?: boolean | null;
  last_menstrual_period?: string;

  // ข้อควรระวังในการดูแล: '' | Standard | Contact | Droplet | Airborne
  precaution_type?: string;

  // สมุนไพร / อาหารเสริมที่ผู้ป่วยใช้อยู่ แยกจาก current_medications
  herbal_medicines?: string;
  dietary_supplements?: string;

  // แบบคัดกรองภาวะซึมเศร้า 2Q (2 สัปดาห์ที่ผ่านมา) 3 สถานะเหมือน has_uri
  q2_depressed?: boolean | null;
  q2_anhedonia?: boolean | null;

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

  // เอกสารที่แพทย์ออกให้ผู้ป่วยในการตรวจครั้งนี้ [role แพทย์]
  // backend เก็บเป็น JSON ใน examinations.issued_documents
  // เวชระเบียนเก่าที่บันทึกก่อนมีช่องนี้จะไม่มีค่า ต้องเผื่อ undefined/null เสมอ
  issuedDocuments?: BackendIssuedDocument[] | null;

  /** สถานะผู้ป่วยหลังตรวจเสร็จ: '' | 'home' | 'refer' */
  disposition?: string;

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

  // 3 ช่องนี้แพทย์กรอกแยกกันบนหน้าจอ (ทางให้ยา / เวลารับประทาน / คำแนะนำพิเศษ-ฉลากยา)
  // backend เก็บไว้ใน examinations.prescription_detail แล้วส่งกลับมาแยกช่อง
  // ตาราง dispensings ของห้องยาเก็บรวมเป็นข้อความเดียวใน instructions ด้านบน
  // เวชระเบียนเก่าที่บันทึกก่อนมีช่องนี้จะไม่มีค่าสามตัวนี้ ต้องเผื่อ undefined เสมอ
  route?: string;
  timing?: string;
  specialInstructions?: string;
}

/** เอกสารหนึ่งชนิดที่แพทย์สั่งออกให้ผู้ป่วย [role แพทย์] */
export interface BackendIssuedDocument {
  /**
   * ชนิดเอกสาร ต้องตรงกับที่ backend รู้จัก (ดู IssuedDocumentDTO ใน dto/examination.go)
   *   medical-certificate | non-formulary   มีจำนวน + พิมพ์ได้
   *   insurance-claim | referral-opinion | dental | other   ติ๊กอย่างเดียว
   */
  type: string;
  quantity: number;
  /** ชื่อเอกสารที่แพทย์พิมพ์เอง ใช้เฉพาะ type = 'other' */
  name?: string;
  /** เวลาที่กดพิมพ์ครั้งล่าสุด เว้นว่างได้ถ้าติ๊กไว้แต่ยังไม่ได้พิมพ์ */
  printedAt?: string;
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

  // ส่งมาทั้งชุดทุกครั้ง array ว่าง = ไม่ได้ออกเอกสารอะไร
  // ไม่ส่งเลย = backend จะคงค่าเดิมในฐานข้อมูลไว้
  issuedDocuments?: BackendIssuedDocument[];

  /** สถานะผู้ป่วยหลังตรวจเสร็จ: '' | 'home' | 'refer' */
  disposition?: string;
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

  /** อาการสำคัญที่พยาบาลบันทึกตอนคัดกรองครั้งนั้น */
  chiefComplaint?: string;

  // ประวัติการเจ็บป่วยและผลตรวจร่างกายที่แพทย์บันทึกในวันนั้น
  presentIllness?: string;
  complaintDuration?: string;
  physicalExam?: {
    generalAppearance?: string;
    heent?: string;
    cardiovascular?: string;
    respiratory?: string;
    abdomen?: string;
    musculoskeletal?: string;
    neurological?: string;
    skin?: string;
  } | null;

  diagnosis: string;
  icdCode: string;
  secondaryDiagnoses?: { code: string; name: string }[] | null;

  // บันทึกของแพทย์ครั้งนั้น ใช้ตอนผู้ป่วยกลับมาตรวจซ้ำ
  // ส่งแยกทีละช่องตามฟอร์มหน้าบันทึกการตรวจ ไม่รวมเป็นข้อความเดียว
  assessmentNotes?: string;
  clinicalNotes?: string;
  treatmentPlan?: string;
  proceduresPerformed?: string;
  counseling?: {
    medicationAdvice?: string;
    dietAdvice?: string;
    exerciseAdvice?: string;
    lifestyleAdvice?: string;
    diseaseEducation?: string;
  } | null;

  /** ยาที่จ่ายจริงในครั้งนั้น อ่านจากตาราง dispensings */
  prescriptions?: BackendPrescriptionItem[] | null;

  vitals?: {
    bp?: string;
    pulse?: number;
    temp?: number;
    weight?: number;
    spo2?: number;
  } | null;
  followUpDate: string;
  followUpReason?: string;
  followUpInstructions?: string;

  // สถานะรวมของการมาตรวจครั้งนั้นในมุมผู้ป่วย (คำนวณจากฝั่ง backend)
  //   progress       completed | in_progress | cancelled
  //   progressReason doctor_cancelled | expired | no_medicine | unpaid
  // ต่างจาก status ด้านล่างที่บอกแค่สถานะฝั่งแพทย์ (รอตรวจ/กำลังตรวจ/ตรวจเสร็จ)
  progress?: string;
  progressReason?: string;

  /** เหตุผลการยกเลิก มีเฉพาะ visit ที่สถานะเป็น Cancelled */
  cancelReason?: string;

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
export const adminApi = {
    getAccounts: () => request<BackendUser[]>('/api/admin/users'),
    createAccount: (payload: { username: string; password?: string; role: string; fullname: string; employee_id: string; phone: string; }) =>
      request<BackendUser>('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    updateAccountStatus: (id: number | string, status: string) =>
      request<{ message: string }>('/api/admin/users/' + id + '/status', {
        method: 'PUT',
        body: JSON.stringify({ status }),
      }),
    createSystemAccess: (payload: { user_id: number; access_level: number; module_name: string; }) =>
      request<any>('/api/admin/system-access', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  };

export interface BackendAppointment {
  id: number;
  doctor_id: number;
  patient_id: number;
  register_id: number;
  appointment_date: string;
  appointment_time: string;
  status: string;
  clinical_note: string;
  doctor?: BackendUser;
  patient?: BackendPatient;
  register?: BackendUser;
}

export const appointmentApi = {
  getList: () => request<BackendAppointment[]>('/api/appointments'),
  create: (payload: { doctor_id: number; patient_id: number; register_id: number; appointment_date: string; appointment_time: string; clinical_note: string; }) =>
    request<BackendAppointment>('/api/appointments', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateStatus: (id: number | string, payload: { status: string; clinical_note?: string; }) =>
    request<{ message: string; appointment: BackendAppointment }>('/api/appointments/' + id + '/status', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  updateSchedule: (id: number | string, payload: { appointment_date?: string; appointment_time?: string; }) =>
    request<{ message: string; appointment: BackendAppointment }>('/api/appointments/' + id + '/schedule', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
};

