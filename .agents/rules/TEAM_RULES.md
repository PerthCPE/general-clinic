# Project Guidelines & Universal Development Rules
### ระบบบริหารจัดการคลินิกเวชกรรมทั่วไป (General Clinic Management System - Team T08)

> **วัตถุประสงค์ของเอกสารนี้:** กฎและแนวทางปฏิบัตินี้เป็น **มาตรฐานกลางของทีม (Team-Wide Development Standard)** ที่นักพัฒนาและ AI ทุกคนในทีมต้องปฏิบัติตามอย่างเคร่งครัด 100% เพื่อให้โค้ดทั้งฝั่ง Frontend และ Backend ทำงานร่วมกันได้อย่างราบรื่น ปราศจากบั๊กความขัดแย้งเชิงสถาปัตยกรรม (Zero Integration Regressions)

---

## 1. 🚫 มาตรฐาน UI Icon และ Typography (ห้ามใช้ Raw Emoji เด็ดขาด)
* **Zero Raw Emojis in UI:** ห้ามใส่รูปอีโมจิ Unicode ดั้งเดิม (เช่น 🩺, 💉, 🏥, 👨‍⚕️, 💊, 📋, ⚡, ✨, 🟢, 🔴) ในข้อความ, ป้ายกำกับ (Label), ปุ่ม (Button), หัวข้อ (Heading), Toast, Alert, หรือ Modal Dialog ในระบบเด็ดขาด
* **Medical SVG Icons Only:** ทุกไอคอนต้องใช้ **Medical SVG Icons** แบบลายเส้นมาตรฐาน (Stroke Width 1.5–2.0px, ใช้สี `currentColor`, และ `viewBox="0 0 24 24"` หรือ `20 20`) ที่ปรับสีตาม Theme อัตโนมัติ
* **Typography Scale:** ใช้ขนาดตัวอักษรทางการแพทย์ตามมาตรฐาน `frontend.md` (Page Title `28–30px`, Input `15.5px`, Button `16px`, Table Cell `14.5–15px`)

---

## 2. 🎨 มาตรฐานสีและ Theming (Light Mode & Elevated Dark Slate Palette)
* **Primary Brand Blue:** ใช้สี `#2563EB` (`rgb(37, 99, 235)`) เป็นสีหลักสำหรับปุ่ม Primary CTA, Active State, Focus Ring, และหัวข้อสำคัญทั่วทั้งระบบ
* **Elevated Dark Slate Standard:** ในโหมดมืด (Dark Mode) ต้องใช้ **Elevated Dark Slate Palette** เสมอ:
  * **Canvas / Background:** `#0F172A` (Slate Deep) — *ห้ามใช้สีดำสนิท #000000*
  * **Surface / Card:** `#212836` (Elevated Slate)
  * **Header / Topbar / Modal:** `#1C2230`
  * **Border / Divider:** `#333F53` หรือ `#2F3B4E`
  * **Text Primary:** `#F8FAFC`, **Text Secondary:** `#94A3B8`, **Text Muted:** `#64748B`

---

## 3. 🔢 มาตรฐานรหัสทางการแพทย์ (Hexadecimal 4-Digit Standard)
เพื่อให้ข้อมูลของทุกระบบเชื่อมโยงและค้นหากันได้อย่างถูกต้อง ให้ใช้รูปแบบ Hexadecimal 4 หลัก:
* **Queue Number (หมายเลขคิว):** ต้องขึ้นต้นด้วย `Q` ตามด้วยเลขฐานสิบหกตัวพิมพ์ใหญ่ 4 หลักเสมอ (`Q0001` ถึง `QFFFF` เช่น `Q0001` $\rightarrow$ `Q0009` $\rightarrow$ `Q000A` $\rightarrow$ `Q000F` $\rightarrow$ `Q0010` $\rightarrow$ `QFFFF`)
* **Hospital Number (HN):** ต้องขึ้นต้นด้วย `HN` ตามด้วยเลขฐานสิบหกตัวพิมพ์ใหญ่ 4 หลักเสมอ (`HN0001` ถึง `HNFFFF` เช่น `HN0001` $\rightarrow$ `HN0009` $\rightarrow$ `HN000A` $\rightarrow$ `HNFFFF`) โดย**ไม่มีเครื่องหมายขีด `-` คั่น**

---

## 4. 🗄️ มาตรฐาน Go Backend และ PostgreSQL GORM (Relational Integrity)
เพื่อป้องกันปัญหา Foreign Key Violation และ Schema Migration Failed:
1. **Surrogate Primary Key Standard:** ทุก Model Struct ในโฟลเดอร์ `internal/models/` ต้องใช้ Primary Key เป็น `ID uint `gorm:"primaryKey" json:"id"`` เสมอ (ห้ามตั้งชื่อเฉพาะ เช่น `DoctorID` หรือ `DocID` เพราะจะทำให้ GORM สับสนทิศทาง Foreign Key)
2. **Explicit Foreign Key Tags:** เมื่อมีความสัมพันธ์ BelongsTo ให้ระบุ `references:ID` เสมอ เช่น:
   ```go
   DoctorID uint   `json:"doctor_id"`
   Doctor   Doctor `gorm:"foreignKey:DoctorID;references:ID" json:"doctor"`
   ```
3. **Gin Binding Rules:** ห้ามใส่ `binding:"required"` กับฟิลด์ตัวเลข (`int`, `float64`) ใน DTO Request Struct เนื่องจาก Gin Validator จะมองค่า `0` เป็น Zero Value และปฏิเสธ Request (ให้ตรวจสอบค่าใน Handler Logic แทน)
4. **Foreign Key Pre-Check:** ก่อนการ Insert ข้อมูลลงตารางลูก (เช่น `visit_records`, `screenings`, `dispensings`, `doctor_schedules`) ต้องตรวจสอบเสมอว่า User ID หรือ Doctor ID นั้นมีอยู่จริงในฐานข้อมูล

---

## 5. 🔐 มาตรฐานสิทธิ์การเข้าถึงและการนำทาง (RBAC & Routing Standards)
* **Initial Route:** หน้าเริ่มต้นของระบบเมื่อเปิดแอปพลิเคชันต้องเป็น **`LoginPage`** เสมอ
* **RBAC & Role Parity:** กำหนดสิทธิ์ให้ `nurse_assistant` มีสิทธิ์เข้าถึงหน้าจอและ API เทียบเท่ากับ `nurse` อย่างสมบูรณ์ (`/queue`, `/vitals`, `/vitals-history`)

---

## 6. 🧪 ความพร้อมในการจำลองระบบ (Simulation Ready)
* ทุกหน้าจอใน Frontend ต้องมี State ภายในและ Mock Data สำรอง (In-Memory Fallback) เพื่อให้ระบบสามารถทดสอบ รันเดโม และพรีเซนต์งานได้ 100% แม้ในกรณีที่เซิร์ฟเวอร์ Backend ออฟไลน์

---

## 7. 🛠️ วินัยการพัฒนาและตรวจสอบโค้ด (Quality Assurance & Definition of Done)
* **No Redundant / Broken Code:** ตรวจสอบโค้ดทุกครั้งก่อน Commit และห้ามแก้ไขโค้ดในโมดูลของเพื่อนร่วมทีมโดยไม่จำเป็น
* **Strict Build Verification:** ต้องรันคำสั่งตรวจสอบการ Build ผ่านทั้ง 2 ฝั่ง 0 errors เสมอ:
  ```powershell
  # ตรวจสอบ Frontend Build
  npm run build
  
  # ตรวจสอบ Backend Build
  go build ./cmd/main.go
  ```

---
*Team T08 | General Clinic Management System*
