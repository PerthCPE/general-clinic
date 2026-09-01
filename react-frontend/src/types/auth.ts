export type UserRole = 'registrar' | 'nurse' | 'nurse_assistant' | 'pharmacist' | 'cashier' | 'doctor' | 'officer';

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  roleTitleTh: string;
  roleTitleEn: string;
  department: string;
  avatarText?: string;
  avatarColor?: string;
}

export interface NavItem {
  id: string;
  title: string;
  iconType: 'registration' | 'queue' | 'eligibility' | 'vitals' | 'history' | 'dispense' | 'stock' | 'invoice' | 'dashboard' | 'examination' | 'schedule' | 'records' | 'document' | 'calendar' | 'forward';
  path: string;
}
