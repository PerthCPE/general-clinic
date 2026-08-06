export type UserRole = 'registrar' | 'nurse' | 'nurse_assistant';

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
  iconType: 'registration' | 'queue' | 'eligibility' | 'vitals' | 'history';
  path: string;
}
