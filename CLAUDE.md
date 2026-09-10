# CLAUDE.md — สถานะโปรเจกต์ (อัปเดตล่าสุด: session แก้ไข appointment/login/admin)

บันทึกนี้ครอบคลุมงานที่ทำในสาขา `fix/appointment-admin-login-followups` ซึ่งรับผิดชอบ 4 ส่วน:
**ระบบนัดหมาย (appointment), แดชบอร์ดนัดหมาย, ระบบล็อกอิน, และจัดการบัญชี/สิทธิ์ (UserManagement + GrantAccess)**

ไม่ครอบคลุมงานฝั่ง pharmacy/billing/doctor/DMS ของเพื่อนร่วมทีม (อ่านจาก README.md หลักแทน)

---

## 1. งานที่ทำเสร็จในรอบนี้

### ระบบล็อกอิน (Login)
- เปลี่ยนมา login ด้วย `employee_id` แทน username/email เดิม — แต่ละบัญชี seed มี `employee_id` เป็นรหัสผ่านเริ่มต้นของตัวเอง ไม่มี default password กลางที่ใช้ร่วมกันอีกต่อไป (`d45f677`)
- `Login()` ฝั่ง backend เช็คสถานะบัญชีที่ถูกระงับ (`suspended`/`inactive`) และปฏิเสธด้วย error message จริงก่อนเช็ค password (`cafeb63`)
- **แก้บั๊ก infinite reload loop วิกฤต** (`10f4ed2`, `9c6e281`): สาเหตุจริงไม่ใช่ที่ `api.ts` (401-gating ถูกต้องอยู่แล้ว) แต่อยู่ที่ `AuthContext.login()`/`switchRole()` — เดิม catch error จาก backend (รวม 401/403 ที่ถูกต้อง) แล้ว fallback ไป local demo login แบบปลอม ทำให้ได้ user ที่ไม่มี token จริง พอเรียก API ถัดไปก็ชน "ไม่มี token" แล้ว reload วนซ้ำ แก้ด้วยการเพิ่ม `ApiRequestError` class (เก็บ HTTP status จริง) ให้ AuthContext แยก "backend ปฏิเสธจริง" ออกจาก "ติดต่อ backend ไม่ได้"
- **เพิ่ม `/api/dev/quick-login`** (`6e91f2d`) — ทางลัด dev/test เท่านั้นสำหรับปุ่ม Quick Test Login 8 ปุ่ม รับแค่ `role` แล้ว reset status บัญชี seed ที่ตายตัวกลับเป็น `active` ให้อัตโนมัติก่อน login เสมอ ไม่เช็ค password เลย — คุมด้วย `DEV_MODE` env var (default `false`, fail-closed) route ไม่ถูกผูกเข้า router เลยถ้าไม่ใช่ dev mode (404 ไม่ใช่แค่ 403) **`Login()` ปกติไม่ถูกแตะ ยังเช็ค password/status ตามจริงทุกประการ**
- แก้ dev server host `127.0.0.1` → `localhost` ใน `vite.config.ts` (`bd5ea17`) — ป้องกัน localStorage แยก origin กันเงียบๆ ระหว่างสอง hostname
- ปรับ Quick Test Login buttons ให้ใช้ credential จริง (`f80ff8d`), ปรับ design tokens (`1e0598e`)

### ระบบนัดหมาย (Appointment) + แดชบอร์ด
- ล็อก dropdown เลือกหมอในฟอร์มสร้างนัดหมายให้เป็น currentUser เท่านั้น — หมอสร้างนัดในชื่อหมอคนอื่นไม่ได้ (`ed8cf95`)
- รวมคำศัพท์ "แผนก" ให้อ้างอิง `doctors.specialty` เป็นคอลัมน์จริงคอลัมน์เดียว ไม่มี department string แยกลอยอีก (`db7ddb4`)
- **นโยบายสิทธิ์เข้าถึง AppointmentDashboard ชุดใหม่** (`367e118`): ตัด registrar ออก, เพิ่ม nurse_assistant (แก้ไขได้เต็มสิทธิ์), เพิ่ม nurse (ดูได้อย่างเดียว) — แยก backend routes เป็น 3 tier (read/edit/write) รองรับ role ที่มีสิทธิ์ไม่เท่ากัน
- style/loading/error state ปรับปรุงทั้ง AppointmentForm และ AppointmentDashboard (`7587782`, `2e2f25c`)

### จัดการบัญชี/สิทธิ์ (UserManagement / GrantAccess)
- ค้นหาตามชื่อ/employee_id และเรียงลำดับได้ (`e993871`), แก้ pagination ที่แสดงผลผิด + deterministic ordering (`449b68b`, `b612a15`)
- เปลี่ยน UX รีเซ็ตรหัสผ่านจาก `alert()` เป็น modal ที่คัดลอกได้ (`b612a15`), เพิ่ม admin-assisted password reset แบบไม่ผ่านอีเมล (`58ae867`)
- แก้ endpoint account-edit ให้ครบ (department, full account edit) (`cca1560`, `3d29cc4`, `e04d55d`)
- **ปรับ GrantAccess เป็นมุมมอง role-based read-only ก่อน** (`2fc9eb7`) แล้วขยายเป็น per-user editable checklist พร้อม role-default auto-fill (`271bf4c`) — **ดูข้อจำกัดสำคัญข้อ 3.1 ด้านล่าง ก่อนแก้ต่อ**
- ลบบัญชีทดสอบ 9 บัญชี + นัดหมายทดสอบ 1 รายการที่ระบุไว้ชัดเจน (ไม่แตะบัญชี seed เดิม 10 บัญชี)

### Git / Repo hygiene
- เปิด `admin1` กลับเป็น `status = active` (เคยถูก suspend ไว้ระหว่างทดสอบ)
- Sync กับ `origin/main` 2 รอบระหว่างทาง (merge commit `2c928ea`, `5f08824`) — ไม่มี conflict ทั้งสองรอบ เพราะงานฝั่งเราไม่ทับไฟล์เดียวกับเพื่อน (ยกเว้น `routes.go` ที่ merge อัตโนมัติสำเร็จ)
- **Rewrite author/committer ของ 30 commits ในสาขานี้** เป็น `bps889 <bps889@users.noreply.github.com>` ด้วย `git filter-branch` (scope เฉพาะ `origin/main..HEAD` + เช็ค email เดิมตรงก่อนเปลี่ยน กันไม่ให้แตะ commit ของเพื่อนที่ merge เข้ามา) แล้ว force-push ทับ — เนื้อหาไฟล์ไม่เปลี่ยนแม้แต่ byte เดียว (tree hash เท่าเดิม)

---

## 2. โครงสร้างระบบคร่าวๆ

**Stack**: Go + Gin + GORM (backend) / React + TypeScript + Vite + MUI (frontend) / PostgreSQL บน Supabase / JWT auth / WebSocket สำหรับ real-time sync

```
golang-backend/
  cmd/                  entrypoints (main, migrate, seed, reset_db, ฯลฯ)
  internal/
    config/             โหลด .env, connect DB, seed ข้อมูลเริ่มต้น (seedDatabase ใน db.go)
    controllers/        handler ต่อโมดูล (auth, appointment, admin, pharmacy, billing, ...)
    dto/                request/response shape
    middleware/         AuthRequired (เช็ค JWT), RoleRequired(...roles) (เช็คสิทธิ์ต่อ route group)
    models/              GORM models
    routes/routes.go     ผูก route ทั้งหมด — จุดเดียวที่กำหนดว่า role ไหนเข้าอะไรได้ (ฝั่ง backend)
    ws/                  WebSocket hub

react-frontend/src/
  config/roles.ts        PAGE_PERMISSIONS (page-id -> allowed roles), ROLE_PAGE_ACCESS (reverse index อัตโนมัติ), ROLE_MENUS, DEMO_USERS
  context/AuthContext.tsx  auth state, login()/quickDevLogin()/switchRole()/hasAccess()
  services/api.ts         HTTP client กลาง — ทุก role ใช้ร่วมกัน (มีคำเตือนในไฟล์ห้ามเขียนทับทั้งไฟล์)
  pages/Login/            LoginPage (manual login + Quick Test Login)
  pages/Appointment/      AppointmentForm, AppointmentDashboard
  pages/Admin/            UserManagement, GrantAccess
```

**Auth flow**: JWT เก็บใน localStorage (`clinic_auth_token` + legacy `token`) → `request()` ใน api.ts แนบ `Authorization: Bearer` อัตโนมัติ → เจอ 401 (ไม่มี token/token หมดอายุ) เท่านั้นที่ `forceReLogin()` (เคลียร์ session + reload) → 403 (สิทธิ์ไม่พอ/บัญชีถูกระงับ) โชว์ error message เฉยๆ ไม่ reload

**สิทธิ์การเข้าถึงหน้า ณ ตอนนี้ตัดสินจากที่เดียว**: role ใน JWT → เทียบกับ `PAGE_PERMISSIONS` (frontend routing) และ `middleware.RoleRequired(...)` ต่อ route group (backend) — **ไม่ใช่จาก GrantAccess/system_accesses** (ดูข้อ 3.1)

---

## 3. บั๊ก/ข้อจำกัดที่รู้อยู่แล้ว

### 3.1 GrantAccess ยังไม่ถูกบังคับใช้จริง ⚠️ (สำคัญที่สุด)
หน้า GrantAccess ติ๊กสิทธิ์ "รายเมนู" ต่อ "รายบุคคล" แล้วบันทึกลง `system_accesses` จริงผ่าน `bulkUpdateSystemAccess` — แต่ค่าที่บันทึกไว้ **ไม่ถูกนำไปเช็คที่ไหนเลย** ทั้ง frontend routing (`hasAccess()` อ่านจาก `PAGE_PERMISSIONS`/role เท่านั้น) และ backend (`RoleRequired` เช็ค role เท่านั้น ไม่เช็ค `system_accesses`) ผลคือ:
- ติ๊ก/ยกเลิกติ๊กในหน้านี้ **ไม่มีผลกับสิทธิ์การเข้าถึงจริง ณ ตอนนี้**
- เป็นการเตรียมข้อมูลไว้ล่วงหน้าสำหรับวันที่ระบบจะเปลี่ยนไปใช้สิทธิ์ระดับ user จริง (ไม่ใช่แค่ระดับ role)
- คอมเมนต์เตือนเรื่องนี้มีอยู่แล้วที่ต้นไฟล์ `GrantAccess.tsx`

### 3.2 `admin1` ผ่าน normal login ด้วย `ADM001` อาจไม่ผ่านแล้ว
`status` เป็น `active` แน่นอน (ยืนยันด้วย query ตรง DB) แต่รหัสผ่านจริงอาจไม่ใช่ `ADM001` อีกต่อไป (drift จากการทดสอบเปลี่ยนรหัสผ่านรอบก่อนๆ ใน session) — ไม่กระทบ Quick Test Login เพราะ endpoint นั้นไม่เช็ค password

### 3.3 `/api/dev/quick-login` เปิดอยู่ในเครื่อง dev ปัจจุบัน
`DEV_MODE=true` ใน `.env` local (gitignored ไม่ขึ้น git) — **ต้องแน่ใจว่า production deploy ไม่ตั้ง `DEV_MODE=true`** ไม่งั้นใครก็ auto-login เป็น role ไหนก็ได้โดยไม่ต้องรู้รหัสผ่านเลย (ดีไซน์ตั้งใจให้ fail-closed เป็น default `false` แล้ว แต่ต้องเช็คตอน deploy จริงด้วย)

### 3.4 ไม่มีการทดสอบคลิกจริงในเบราว์เซอร์ตลอด session นี้
Chrome extension ถูกปฏิเสธการติดตั้งไว้ก่อนหน้า — ทุกการทดสอบทำผ่าน `curl` ตรงกับ backend ที่รันจริงเท่านั้น ยังไม่เคยเห็นพฤติกรรมจริงในเบราว์เซอร์ (เช่น `window.location.reload()` ทำงานจริงตามที่คาด) ด้วยตา

### 3.5 local branch `main` ค้างเก่ากว่า `origin/main`
เคยเจอปัญหานี้ครั้งหนึ่งแล้วตอนเช็คว่า merge เสี่ยงชนไฟล์ไหน — ถ้าใช้ local `main` เทียบแทน `origin/main` จะได้ผลเพี้ยน ควร `git fetch` แล้วอ้างอิง `origin/main` เสมอเวลาต้องเทียบ

### 3.6 บัญชีทดสอบที่เพิ่งลบ
ลบไปแล้ว 9 บัญชี + นัดหมายทดสอบ 1 รายการที่ระบุชัดเจนในตอนนั้น — ยังไม่ได้สำรวจซ้ำว่ามีข้อมูลทดสอบอื่นตกค้างอีกหรือไม่ (เช่นจากการทดสอบ quick-login/reload loop รอบนี้ที่ยิง API จริงหลายรอบ ควรเป็นแค่ read + status update ไม่สร้างข้อมูลใหม่ แต่ยังไม่ได้ตรวจซ้ำอย่างละเอียด)

---

## 4. สิ่งที่ควรทำต่อถ้ามีเวลา

1. **ตัดสินใจเรื่อง GrantAccess**: จะทำสิทธิ์ระดับ user จริง (เช็ค `system_accesses` ทั้ง frontend + backend middleware) หรือจะคงไว้แค่ระดับ role แล้วลดหน้า GrantAccess ให้ตรงกับที่ทำได้จริง (ไม่ใช่ให้ติ๊กแล้วดูเหมือนมีผลทั้งที่ไม่มี)
2. **ทดสอบคลิกจริงในเบราว์เซอร์** อย่างน้อย flow หลัก: login ปกติ/บัญชีถูกระงับ, Quick Test Login ทั้ง 8 ปุ่ม, appointment dashboard ตาม role (nurse read-only, nurse_assistant full edit)
3. **audit บัญชี/รหัสผ่านที่ drift ไปจาก seed เดิม** (เช่น admin1 ในข้อ 3.2) — ตัดสินใจว่าจะ reset ให้ตรง seed หรือปล่อยไว้
4. เช็คว่า production deploy config ปิด `DEV_MODE` แน่นอนก่อน merge เข้า main จริง
5. เคลียร์ local branch `main` ให้ตรงกับ `origin/main` (แค่ `git fetch` + `git checkout main && git merge --ff-only origin/main`) กันงงรอบหน้า
6. รีวิว PR ของสาขานี้ (`fix/appointment-admin-login-followups` → `main`) แล้ว merge เข้า main จริงเมื่อพร้อม — อัปเดต description ของ PR ให้รวมงาน quick-login/merge sync รอบหลังด้วย ถ้ายังไม่ได้อัปเดต
