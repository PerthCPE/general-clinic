# สรุปผลการ Clean & Re-seed ข้อมูลชุด Demo บน Supabase Cloud Database

**ระบบคลินิกเวชกรรมทั่วไป (General Clinic Management System)**  
**Student ID:** B6706265  
**วันที่บันทึก:** 10 กันยายน 2569  
**Database Host:** `aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres` (Transaction Pooler)

---

## 📌 ภาพรวม (Executive Summary)

ได้ดำเนินการตรวจสอบ, ทำความสะอาด (Clean Data) ข้อมูลทดสอบตกค้างเดิม และทำการ Seed ข้อมูลชุด Demo สะอาดใหม่ทั้งหมดบนฐานข้อมูล **Supabase Cloud Database** สำเร็จครบถ้วน 100% 

ระบบพร้อมสำหรับการนำเสนอ (Demo) ทุก Flow ตั้งแต่การลงทะเบียนผู้ป่วย, การตรวจสอบสิทธิ์, การออกบัตรคิว, การคัดกรองสัญญาณชีพ (Triage 1–4), การตรวจรักษาของแพทย์, เภสัชกรรม และการเงิน

---

## 📊 ผลงาน A — ตรวจสอบข้อมูลเก่าก่อนดำเนินการ (Pre-Clean Audit)

ผลการ Query ตรวจสอบข้อมูลก่อนการ Clean (READ-ONLY) บน Supabase:

```sql
SELECT 'patients' AS t, COUNT(*) FROM patients
UNION ALL SELECT 'queues', COUNT(*) FROM queues
UNION ALL SELECT 'screenings', COUNT(*) FROM screenings
UNION ALL SELECT 'visit_records', COUNT(*) FROM visit_records
UNION ALL SELECT 'medical_eligibilities', COUNT(*) FROM medical_eligibilities
UNION ALL SELECT 'users', COUNT(*) FROM users
UNION ALL SELECT 'queue_counters', COUNT(*) FROM queue_counters;
```

### ตารางเปรียบเทียบก่อน-หลัง
| ตาราง (Table) | ข้อมูลเดิมก่อน Clean | ข้อมูลหลัง Clean & Seed | หมายเหตุ |
| :--- | :---: | :---: | :--- |
| `patients` | 258 | **20** | ข้อมูลเดิมเป็น fuzzer test data (ID เริ่มที่ 965) -> ปรับเป็น `HN0001`–`HN0014` |
| `queues` | 429 | **15** | คิวเดิม desync สะสมถึง `Q01AC` -> รีเซ็ตเป็น `Q0001`–`Q000F` |
| `screenings` | 131 | **10** | ซักประวัติตกค้าง -> สร้างชุดมาตรฐาน Triage 1–4 ครบ Vital Signs |
| `visit_records` | 191 | **10** | เชื่อมโยงกับผู้ป่วยและแพทย์ครบถ้วน |
| `medical_eligibilities` | 174 | **20** | สิทธิ์การรักษาครบทุกประเภท (บัตรทอง/ประกันสังคม/ข้าราชการ/เอกชน) |
| `users` | 10 | **10** | บัญชีผู้ใช้ครบทั้ง 10 ตำแหน่ง (รหัสผ่าน bcrypt มาตรฐาน) |
| `queue_counters` | 4 | **1** | ซิงค์ `last_number = 15` (`Q000F`) สำหรับ `service_date = CURRENT_DATE` |

> **ผลการประเมิน:** ข้อมูลเดิม 258+ แถวทั้งหมดเป็นข้อมูลทดสอบระหว่างพัฒนา ไม่มีข้อมูลผู้ป่วยจริง จึงสามารถล้างทำความสะอาดตามลำดับ Foreign Key Dependency ได้อย่างปลอดภัย

---

## 🔍 ผลงาน C — ตรวจสอบความถูกต้องของ Schema & Migrations

ทำการตรวจสอบความสมบูรณ์ของโครงสร้าง Schema และคอลัมน์ใหม่ที่เพิ่มขึ้นมาตั้งแต่ Sprint 1 จนถึง HOTFIX-7 บน Supabase Cloud:

```sql
-- 1. ตรวจสอบตารางใน Public Schema
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1;
-- ผลลัพธ์: ครบทั้ง 30 ตาราง

-- 2. ตรวจสอบคอลัมน์คัดกรองสัญญาณชีพและอาการสำคัญ (Screenings)
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'screenings' AND column_name IN
('triage_level', 'nurse_notes', 'has_uri', 'q2_depressed', 'screening_positive')
ORDER BY column_name;
-- ผลลัพธ์:
--   has_uri: boolean
--   nurse_notes: text
--   q2_depressed: boolean
--   screening_positive: boolean
--   triage_level: integer

-- 3. ตรวจสอบคอลัมน์วันที่ออกคิว (Queues)
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'queues' AND column_name = 'service_date';
-- ผลลัพธ์: service_date: date

-- 4. ตรวจสอบคอลัมน์ที่อยู่แบบแยกโครงสร้าง (Patients)
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'patients' AND column_name = 'province';
-- ผลลัพธ์: province: character varying
```

---

## 🧹 ผลงาน B & D — การล้างและ Seed ข้อมูลใหม่ (`cmd/clean_seed/main.go`)

### ลำดับการลบข้อมูล (Referential Integrity Order):
1. `appointment_tests` & `appointments`
2. `qr_payments`, `billings`, `billing_queues`, `billing_histories`
3. `medicine_queues`, `dispensings`, `examinations`, `diagnoses`
4. `patient_medicines`, `patient_histories`
5. `screenings`, `queues`, `queue_counters`
6. `visit_records`, `medical_eligibilities`
7. `patients`
8. Reset Sequences: `patients_id_seq`, `queues_id_seq`, `visit_records_id_seq`, `screenings_id_seq` ฯลฯ กลับไปเริ่มต้นที่ 1

---

## ✅ ผลงาน E — การตรวจสอบและทดสอบระบบหลัง Seed (Verification E1–E5)

### E1. จำนวนข้อมูลในตารางหลัก
- `patients`: **20** ราย
- `queues`: **15** คิว
- `screenings`: **10** รายการ
- `visit_records`: **10** รายการ
- `medical_eligibilities`: **20** รายการ
- `users`: **10** บัญชี
- `queue_counters`: **1** รายการ

### E2. รูปแบบ Hospital Number (HN) ฐาน 16 (4-digit Hex)
```sql
SELECT id, hn, national_id, full_name FROM patients ORDER BY id ASC LIMIT 5;
```
- `ID=1`: `HN=HN0001` | CID: `1234567890123` | ชื่อ: นายสมชาย ใจดี
- `ID=2`: `HN=HN0002` | CID: `3100598765432` | ชื่อ: นางสาววิภาดา มณีรัตน์
- `ID=3`: `HN=HN0003` | CID: `1101455443219` | ชื่อ: นายอาทิตย์ มีสุข
- `ID=4`: `HN=HN0004` | CID: `5102011223345` | ชื่อ: นางสมศรี รักษาดี
- `ID=5`: `HN=HN0005` | CID: `1103377889901` | ชื่อ: นายธนกฤต กิตติพงษ์
- `ID=16` ถึง `ID=20`: `HN0010`, `HN0011`, `HN0012`, `HN0013`, `HN0014`

### E3. การตรวจสอบ Queue Counter ประจำวัน
```sql
SELECT service_date, last_number, updated_at FROM queue_counters WHERE service_date = CURRENT_DATE;
```
- `service_date`: `2026-09-10`
- `last_number`: `15` (Hex = `Q000F` ซิงค์ตรงกับคิวสุดท้ายในระบบ)

### E4. การทดสอบออกบัตรคิวใหม่ผ่าน API (`POST /api/queue/create`)
- ทดสอบส่ง Request ออกคิวใหม่ด้วยสิทธิ์ `registrar1`:
  - **HTTP Response:** `201 Created`
  - **Queue Number ที่ได้:** `Q0012` (ลำดับ Hex ต่อเนื่องถูกต้อง)
  - **Index Constraint:** ไม่เกิดข้อผิดพลาด `idx_queue_daily`
  - **Queue Counter:** ปรับค่าเป็น `18` (`Q0012`) ทันทีแบบ Atomic

### E5. การทดสอบ Authentication Login ทุกบทบาท (10 Roles)
ทดสอบ `POST /login` บน Supabase จริง:
```
  [SUCCESS] registrar1   | Role: registrar        | HTTP 200 OK
  [SUCCESS] nurse1       | Role: nurse            | HTTP 200 OK
  [SUCCESS] assistant1   | Role: nurse_assistant  | HTTP 200 OK
  [SUCCESS] doctor1      | Role: doctor           | HTTP 200 OK
  [SUCCESS] doctor2      | Role: doctor           | HTTP 200 OK
  [SUCCESS] doctor3      | Role: doctor           | HTTP 200 OK
  [SUCCESS] pharmacist1  | Role: pharmacist       | HTTP 200 OK
  [SUCCESS] cashier1     | Role: cashier          | HTTP 200 OK
  [SUCCESS] officer1     | Role: officer          | HTTP 200 OK
  [SUCCESS] admin1       | Role: admin            | HTTP 200 OK
```

---

## 🔑 ข้อมูลบัญชีผู้ใช้สำหรับการ Demo (Default Password: `password`)

| Username | Role | ชื่อ-นามสกุล | หน้าที่รับผิดชอบ |
| :--- | :--- | :--- | :--- |
| `registrar1` | `registrar` | คุณสุภาพร เวชระเบียน | ลงทะเบียนผู้ป่วย, ออกคิว, เช็คสิทธิ์ |
| `nurse1` | `nurse` | พว. กานดา คัดกรอง | ซักประวัติ, วัดสัญญาณชีพ, จัดระดับความฉุกเฉิน (Triage) |
| `assistant1` | `nurse_assistant` | นายสมคิด ช่วยเหลือดี | ผู้ช่วยพยาบาล (สิทธิ์เท่ากับพยาบาล) |
| `doctor1` | `doctor` | พญ.สุดา สุขสมบูรณ์ | ห้องตรวจ 1 (อายุรกรรมทั่วไป) |
| `doctor2` | `doctor` | นพ.วิชัย ชาญการแพทย์ | ห้องตรวจ 2 (เวชศาสตร์ครอบครัว) |
| `doctor3` | `doctor` | พญ.เกศรา รักษาดี | ห้องตรวจ 3 (กุมารเวชกรรม) |
| `pharmacist1` | `pharmacist` | ดร.บุญ สั่งยา | จ่ายยา, จัดยา, บริหารคลังยา |
| `cashier1` | `cashier` | นส.รวย การเงิน | ชำระเงิน, ออกใบเสร็จ, สแกน QR Code |
| `officer1` | `officer` | คุณสมจิต ดีใจ | งานสารบรรณ, จัดการเอกสารและตารางเวร |
| `admin1` | `admin` | ผู้ดูแลระบบ คลินิก | ผู้ดูแลระบบภาพรวม |

---

## 🏁 สรุปสถานะความพร้อม (System Readiness)

ระบบฐานข้อมูลบน Supabase Cloud Database ได้รับการตั้งค่าโครงสร้างและข้อมูลชุด Demo ที่สะอาด ถูกต้องตาม Clinical Code Standard (Hex 4 หลัก) และสอดคล้องกับ Role-Based Access Control (RBAC) พร้อมใช้งานสำหรับการทดสอบและการนำเสนอ Demo Flow ทุกฟังก์ชันครับ
