// รายชื่อ username ตายตัวของบัญชีทดสอบ 10 บัญชีที่ backend seed ให้ตั้งแต่ต้น (ดู
// golang-backend/internal/models/user.go — TestAccountUsernames คือที่มาเดียวฝั่ง backend)
// ต้องเป็นรายชื่อ "เดียวกันเป๊ะ" กับฝั่ง backend — ไฟล์นี้ใช้แค่ตกแต่ง UI (โชว์ป้าย/ซ่อนปุ่มที่ใช้
// ไม่ได้จริง) การบังคับสิทธิ์จริงอยู่ที่ backend เท่านั้น (admin_controller.go, auth.go) ยิง API
// ตรงข้าม UI ก็ยังถูกปฏิเสธเหมือนกัน
export const TEST_ACCOUNT_USERNAMES: readonly string[] = [
  'officer1',
  'registrar1',
  'nurse1',
  'assistant1',
  'pharmacist1',
  'cashier1',
  'doctor1',
  'doctor2',
  'doctor3',
  'admin1',
];

const TEST_ACCOUNT_USERNAME_SET = new Set(TEST_ACCOUNT_USERNAMES);

export const isTestAccountUsername = (username?: string | null): boolean =>
  !!username && TEST_ACCOUNT_USERNAME_SET.has(username);
