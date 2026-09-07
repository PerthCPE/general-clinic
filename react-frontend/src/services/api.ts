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
      requires_password_change?: boolean;
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

// 6. Admin API (User Accounts & System Access)
export interface BackendUser {
  id: number;
  username: string;
  email: string;
  fullname: string;
  role: string;
  phone: string;
  status: string;
  employee_id: string;
  created_at: string;
  updated_at: string;
  system_accesses?: any[];
}

export const adminApi = {
  getAccounts: () => request<BackendUser[]>('/api/admin/accounts'),
  createAccount: (payload: { username: string; password?: string; role: string; fullname: string; employee_id: string; phone: string; }) =>
    request<BackendUser>('/api/admin/accounts', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateAccountStatus: (id: number | string, status: string) =>
    request<{ message: string }>(`/api/admin/accounts/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),
  createSystemAccess: (payload: { user_id: number; access_level: number; module_name: string; }) =>
    request<any>('/api/admin/system-access', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

// 7. Appointment API
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
    request<{ message: string; appointment: BackendAppointment }>(`/api/appointments/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  updateSchedule: (id: number | string, payload: { appointment_date?: string; appointment_time?: string; }) =>
    request<{ message: string; appointment: BackendAppointment }>(`/api/appointments/${id}/schedule`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
};
