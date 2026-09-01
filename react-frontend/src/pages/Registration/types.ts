export type SchemeType =
  | 'บัตรทอง (สปสช.)'
  | 'ประกันสังคม (ม.33)'
  | 'สิทธิ์ข้าราชการ'
  | 'ประกันสุขภาพเอกชน'
  | 'ชำระเงินเอง';

export interface Patient {
  id?: number;
  hn: string;
  fullName: string;
  nationalId: string;
  dob: string;
  age: number;
  gender: 'ชาย' | 'หญิง' | 'อื่นๆ';
  phone: string;
  emergencyContact: string;
  address: string;
  schemeType: SchemeType;
  chronicDiseases?: string;
  allergies?: string;
  registeredAt: string;
}
