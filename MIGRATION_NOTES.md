# SPRINT 1 Migration & Integration Notes (Student ID: B6706265)

## 📌 ภาพรวม (Overview)
บันทึกการปรับปรุงระบบฐานข้อมูล สัญญา API (Data Contracts) และความสมบูรณ์ของข้อมูล (Data Integrity) สำหรับ **Subsystem 1 (Registration/Queue/Eligibility)** และ **Subsystem 2 (Screening & Vitals)**

> [!IMPORTANT]
> **Database Requirement**: ระบบฐานข้อมูลรองรับ **PostgreSQL 12+ only, SQLite not supported** เนื่องจากใช้งาน Atomic Upsert (`INSERT ... ON CONFLICT DO UPDATE RETURNING`), Partial Unique Index, และ TimeZone conversions (`Asia/Bangkok`)

---

## 🏥 1. Triage Canonical Value: แปลงค่า Triage เป็นตัวเลขอ้างอิงมาตรฐาน (Integer 1–4)

### การเปลี่ยนแปลง (Changes)
- **Database Schema**: ตาราง `screenings` เปลี่ยนฟิลด์ `triage_level` จาก `VARCHAR` เป็น `INTEGER NOT NULL` พร้อม Check Constraint `BETWEEN 1 AND 4`
- **Migration Script**: `golang-backend/migrations/001_triage_to_int.sql`
- **Canonical Values & Scale Mapping**:
  | Value | ระดับความฉุกเฉิน (TH) | Triage Level (EN) | ระดับสี (UI Badge) |
  | :---: | :--- | :--- | :--- |
  | `1` | ฉุกเฉินวิกฤต | Resuscitation | แดง (`#EF4444` / `bg-rose-900/30`) |
  | `2` | ฉุกเฉินเร่งด่วน | Emergency-Urgent | ส้ม (`#F97316` / `bg-amber-900/30`) |
  | `3` | กึ่งฉุกเฉิน | Semi-Urgent | เหลือง (`#EAB308` / `bg-yellow-900/30`) |
  | `4` | ปกติ | Non-Urgent (Normal) | เขียว (`#10B981` / `bg-emerald-900/30`) |

### ความเข้ากันได้ย้อนหลัง (Backward Compatibility)
- `VitalsController` รองรับทั้ง payload แบบตัวเลข `1..4` และ string ภาษาไทยเดิม โดยจะแปลงเป็น integer เสมอ
- Doctor DTO (`toScreeningBrief`) และ API endpoints ส่งข้อมูล canonical integer พร้อมรองรับ label แสดงผล

---

## 🔢 2. Queue Number Daily Sequence & Unique Constraint: ลำดับคิวรายวันฐาน 16

### การเปลี่ยนแปลง (Changes)
- **Format**: รูปแบบ `Q` + เลขฐานสิบหก 4 หลัก (`%04X`) เริ่มจาก `Q0001` ถึง `QFFFF` (รองรับสูงสุด 65,535 คิว/วัน)
- **Daily Reset**: รีเซ็ตลำดับคิวทุกวัน ณ เวลา 00:00:00 น. ตามเขตเวลาประเทศไทย (`Asia/Bangkok` UTC+7)
- **Atomic Counter**: สร้างตาราง `queue_counters (service_date DATE PRIMARY KEY, last_number INT)` (คอลัมน์ระบุ `last_number` ไม่ใช่ `last_seq`) พร้อม atomic `INSERT ... ON CONFLICT DO UPDATE RETURNING` ใน `internal/services/queue_number.go`
- **Unique Constraint**: Unique Index `idx_queue_daily` บน `queues(service_date, queue_number)`
- **Migration Script**: `golang-backend/migrations/002_queue_daily_sequence.sql` & `golang-backend/migrations/004_seed_queue_counters.sql`

---

## 🔒 3. Idempotency & Concurrency Guard for VisitRecord

### การเปลี่ยนแปลง (Changes)
- **Row-Level Locking**: ดึงคิวด้วย `SELECT ... FOR UPDATE` ภายใน Transaction ป้องกัน Race Condition
- **Idempotency Guard**:
  - **Identical Payload Replay**: หากส่งข้อมูลชุดเดิมซ้ำ จะคืน HTTP `200 OK` พร้อม `"idempotent_replay": true` โดยไม่สร้างแถวซ้ำและไม่ broadcast ซ้ำ
  - **Modified Payload Collision**: หากพยายามบันทึกซ้ำบนคิวเดิมด้วยข้อมูลที่ต่างออกไป จะคืน HTTP `409 Conflict` (`QUEUE_ALREADY_SCREENED`)
- **Unique Partial Index**: สร้างดัชนี `idx_visit_queue_unique` บน `visit_records(queue_id) WHERE queue_id IS NOT NULL`
- **Deferred WebSocket Broadcast**: ย้ายการส่ง WebSocket Event ออกมาอยู่นอก Transaction และส่งหลังจาก Commit สำเร็จเท่านั้น
- **Migration Script**: `golang-backend/migrations/003_visit_idempotency.sql`

---

## 🔗 4. Traceability from Screening to Queue: ความสามารถในการสืบย้อนข้อมูลคิว

### การเปลี่ยนแปลง (Changes)
- **Snapshot Fields**: เพิ่ม `queue_id` (Foreign Key ชี้ไปยัง `queues`) และ `queue_number` (`VARCHAR(10)`) ในตาราง `visit_records`
- **Preload & Data Exposure**: Endpoint สำหรับประวัติการคัดกรอง (`/api/screenings`) ทำการ preload `VisitRecord` เพื่อส่ง `queue_number` ให้แก่ UI
- **Frontend Integration**: หน้ารายการประวัติการตรวจ (`ScreeningHistoryPage`) และ Modal รายละเอียด (`ScreeningDetailModal`) แสดงหมายเลขคิวต้นทาง (`Q0001` ฯลฯ) ครบถ้วน

---

## 📋 5. Column Naming Contract for SpO2 (Data Contract)
- **Schema Decision**: ทางเลือก B (คงชื่อฟิลด์ฐานข้อมูลตาม GORM naming convention)
- **Contract Specification**:
  - **JSON Payload / DTO Field**: `spo2` (ทั้ง Request และ Response ใน REST API)
  - **Database Column (Supabase PostgreSQL)**: `sp_o2` (BIGINT / INTEGER)
  - **Go Struct Field**: `SpO2 int` (GORM แมป snake_case อัตโนมัติไปยัง `sp_o2`)

---

## 👥 คำแนะนำสำหรับทีม Doctor, Pharmacy และ Billing (Teammate Notes)
1. **Doctor Module (`toScreeningBrief`)**: มีการปรับฟิลด์ `triage_level` จากเดิม `string` เป็น `int` (1–4) โดยฟังก์ชัน `toScreeningBrief` ใน `doctor_controller.go` ได้แมปค่าตัวเลขเป็น Label ภาษาไทยให้เรียบร้อยแล้ว หากโมดูลหมอต้องการค่าตัวเลขตรงๆ สามารถอ่านจาก struct `Screening.TriageLevel` (int) ได้ทันที
2. **Queue Number**: หมายเลขคิวในตาราง `queues` และ `visit_records` จะมีรูปแบบ `Q` + 4-digit hex (เช่น `Q0001`, `Q000A`, `Q0010`)
3. **Visit Records**: สามารถเชื่อมโยงและสืบค้นกลับไปยังคิวต้นทางได้โดยตรงผ่านฟิลด์ `queue_id` และ `queue_number` บน `VisitRecord`
4. **Billing & Registrar RBAC Guard**: สิทธิ์การเข้าถึง `/api/billing/*` ถูกจำกัดให้เฉพาะ `cashier` และ `admin` เท่านั้น และ `/api/registrar/*` แยกสิทธิ์การเขียน (`POST /api/registrar/*`) ให้เฉพาะ `registrar` เท่านั้น (พยาบาลสามารถ `GET` เพื่อดูประวัติผู้ป่วยได้)
