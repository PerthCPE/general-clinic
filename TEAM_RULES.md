# Project Guidelines & Master Team Rules
### ระบบบริหารจัดการคลินิกเวชกรรมทั่วไป (General Clinic Management System - Team T08)
> **Master Reference & Single Source of Truth (SSOT):**  
> กฎและแนวทางปฏิบัตินี้ถูกจัดทำและอ้างอิงจาก **ระบบมาตรฐานของนักศึกษา รหัส B6706265** (Registration, Master Queue, Eligibility, Screening & Vitals, Screening History) ซึ่งเป็นแม่แบบมาตรฐานกลางทางการแพทย์ (Medical-Grade Enterprise Standard) ที่นักพัฒนาและ AI ทุกคนในทีมต้องปฏิบัติตามอย่างเคร่งครัด 100%

---

## 1. 🚫 กฎเหล็ก UI Icon และ Typography (Strict Prohibition of Raw Emojis)
* **Zero Raw Emojis in UI 100%:** ห้ามใส่รูปอีโมจิ Unicode ดั้งเดิม (เช่น 🩺, 💉, 🏥, 👨‍⚕️, 💊, 📋, ⚡, ✨, 🟢, 🔴, 🔔, 🏷️, 🔍, ⚠️, ❌, ✅, 🔊) ในข้อความ, ป้ายกำกับ (Label), ปุ่ม (Button), หัวข้อ (Heading), Toast, Alert Banner, ตารางข้อมูล (Table), หรือ Modal Dialog ในระบบเด็ดขาด
* **Medical SVG Icons Only:** ทุกไอคอนต้องใช้ **Clean Stroke-Based Medical SVG Icons** เท่านั้น:
  * ความหนาเส้น: `stroke-width="1.8–2.0px"` (หรือ `1.5px` สำหรับไอคอนขนาดเล็ก)
  * สีของไอคอน: ใช้ `currentColor` เสมอ เพื่อให้ปรับสีตามสถานะและ Theme อัตโนมัติ
  * ViewBox: `viewBox="0 0 24 24"` หรือ `viewBox="0 0 20 20"`
  * รูปทรง: สไตล์มินิมอลทางการแพทย์ (Feather / Lucide / Heroicons Standard)
* **Typography Hierarchy:** ใช้ฟอนต์หลัก `Plus Jakarta Sans`, `IBM Plex Sans Thai`, `Prompt`, `Inter`, `Kanit` โดยกำหนดขนาดตัวอักษรอย่างเข้มงวด:
  * Page Title: `26–28px` (Font Weight 700)
  * Card / Section Title: `16–18px` (Font Weight 700)
  * Body & Input Text: `15–15.5px` (Font Weight 500/600)
  * Field Labels: `14–14.5px` (Font Weight 600)
  * Table Content: `14.5–15px` (Line Height 20–22px)

---

## 2. 🎨 มาตรฐานสีและ Theming (Elevated Dark Slate & Brand Palette)
* **Primary Brand Blue:** ใช้สี `#2563EB` (`rgb(37, 99, 235)`) เป็นสีหลักสำหรับปุ่ม Primary CTA, Active State, Focus Ring, และหัวข้อสำคัญทั่วทั้งระบบ
* **Elevated Dark Slate Palette (Dark Mode):** ในโหมดมืด ต้องใช้ระบบสี Dark Slate ที่มีมิติและความลึก (Elevated Hierarchy) เสมอ — *ห้ามใช้สีดำสนิท #000000 หรือเทาแบน:*
  * **Canvas / App Background:** `#0F172A` (Slate Deep) หรือ `#22272E`
  * **Surface / Card / Table Background:** `#212836` (Elevated Dark Slate) หรือ `#2D333B`
  * **Header / Topbar / Modal Header:** `#1C2230`
  * **Border / Divider:** `#333F53` หรือ `#2F3B4E` (ต้องมองเห็นชัดเจน ไม่กลืนกับพื้นหลัง)
  * **Text Luminance ใน Dark Mode:**
    * Heading Text: `#F8FAFC` หรือ `#FFFFFF` (ความสว่างสูงสุด)
    * Body / Value Text: `#CBD5E1` หรือ `#E2E8F0`
    * Label / Muted Text: `#94A3B8` หรือ `#A0AEC0`
  * **Glowing Status Badges:** ป้ายสถานะใน Dark Mode ต้องใช้สีเรืองแสง เช่น สถานะใช้งานได้/ปกติ `background: rgba(22, 163, 74, 0.3); color: #86EFAC; border: 1.5px solid #4ADE80; box-shadow: 0 2px 8px rgba(34, 197, 94, 0.25);`

---

## 3. 🔢 มาตรฐานรหัสและข้อมูลทางการแพทย์ (Hexadecimal 4-Digit Standard)
เพื่อให้ข้อมูลของทุกระบบเชื่อมโยงและค้นหากันได้อย่างแม่นยำ ทุกโมดูลต้องใช้รูปแบบเดียวกัน:
* **Queue Number (หมายเลขคิว):** ต้องขึ้นต้นด้วย `Q` ตามด้วยเลขฐานสิบหกตัวพิมพ์ใหญ่ 4 หลักเสมอ (`Q0001` ถึง `QFFFF` เช่น `Q0001` -> `Q0009` -> `Q000A` -> `Q000F` -> `Q0010` -> `QFFFF`)
* **Hospital Number (HN):** ต้องขึ้นต้นด้วย `HN` ตามด้วยเลขฐานสิบหกตัวพิมพ์ใหญ่ 4 หลักเสมอ (`HN0001` ถึง `HNFFFF` เช่น `HN0001` -> `HN0009` -> `HN000A` -> `HNFFFF`) โดย**ไม่มีเครื่องหมายขีด `-` คั่น**
* **เลขบัตรประจำตัวประชาชน (National ID):** ต้องตรวจสอบความถูกต้องตามสูตร Modulo 11 ของกระทรวงมหาดไทย 13 หลัก และจัดรูปแบบแสดงผล `x-xxxx-xxxxx-xx-x`

---

## 4. 🩺 มาตรฐานการคัดแยกความเร่งด่วน (Triage Level 1–5 Classification)
อ้างอิงตามเกณฑ์มาตรฐานการแพทย์ฉุกเฉินและระบบ Vitals & Screening:
1. **ระดับ 1: ฉุกเฉินวิกฤต (Resuscitation - Level 1):** สีแดง `#DC2626` / พื้นหลัง `#FEF2F2` (Dark: `rgba(220, 38, 38, 0.25)`)
2. **ระดับ 2: ฉุกเฉินเร่งด่วน (Emergency / Urgent - Level 2):** สีส้มแสด `#EA580C` / พื้นหลัง `#FFF7ED` (Dark: `rgba(234, 88, 12, 0.25)`)
3. **ระดับ 3: กึ่งฉุกเฉิน (Semi-Urgent - Level 3):** สีเหลืองอำพัน `#D97706` / พื้นหลัง `#FFFBEB` (Dark: `rgba(217, 119, 6, 0.25)`)
4. **ระดับ 4: ไม่ฉุกเฉิน / ปกติ (Non-Urgent - Level 4):** สีเขียว `#16A34A` / พื้นหลัง `#F0FDF4` (Dark: `rgba(22, 163, 74, 0.25)`)
5. **ระดับ 5: ตรวจสุขภาพทั่วไป (General - Level 5):** สีน้ำเงิน `#2563EB` / พื้นหลัง `#EFF6FF` (Dark: `rgba(37, 99, 235, 0.25)`)

---

## 5. 🗄️ มาตรฐาน Go Backend และ PostgreSQL GORM (Relational Integrity)
1. **Surrogate Primary Key Standard:** ทุก Model Struct ใน `internal/models/` ต้องใช้ Primary Key เป็น `ID uint `gorm:"primaryKey" json:"id"`` เสมอ (ห้ามตั้งชื่อเฉพาะ เช่น `DoctorID` หรือ `DispenseID`)
2. **Explicit Foreign Key Tags:** เมื่อมีความสัมพันธ์ BelongsTo ให้ระบุ `references:ID` เสมอ เช่น:
   ```go
   DoctorID uint   `json:"doctor_id"`
   Doctor   Doctor `gorm:"foreignKey:DoctorID;references:ID" json:"doctor"`
   ```
3. **Gin Binding Rules:** ห้ามใส่ `binding:"required"` กับฟิลด์ตัวเลข (`int`, `float64`) ใน DTO Request Struct เนื่องจาก Gin Validator จะมองค่า `0` เป็น Zero Value และปฏิเสธ Request
4. **Foreign Key Pre-Check:** ก่อนการ Insert ข้อมูลลงตารางลูก ต้องตรวจสอบเสมอว่า Parent ID มีอยู่จริงในฐานข้อมูล

---

## 6. 🔐 มาตรฐานสิทธิ์และการนำทาง (RBAC & Routing Standards)
* **Initial Route:** หน้าเริ่มต้นของระบบเมื่อเปิดแอปพลิเคชันต้องเป็น **`LoginPage`** เสมอ
* **RBAC & Role Parity:** กำหนดสิทธิ์ให้ `nurse_assistant` มีสิทธิ์เข้าถึงหน้าจอและ API เทียบเท่ากับ `nurse` อย่างสมบูรณ์ (`/queue`, `/vitals`, `/vitals-history`)

---

## 7. 🧪 ความพร้อมในการจำลองระบบ (Simulation Ready 100%)
* ทุกหน้าจอใน Frontend ต้องมี State ภายในและ Mock Data สำรอง (In-Memory Fallback) เพื่อให้ระบบสามารถทดสอบ รันเดโม และพรีเซนต์งานได้ 100% แม้ในกรณีที่เซิร์ฟเวอร์ Backend ออฟไลน์

---

## 8. 🛠️ วินัยการพัฒนา การทดสอบ และ Git Boundary (Quality Assurance)
* **No Unrequested Git Push:** **ห้าม Push โค้ดขึ้น branch `main` เด็ดขาด** หากไม่ได้รับคำสั่งโดยตรงจากเจ้าของโปรเจกต์
* **Targeted & Minimal Edits:** แก้ไขเฉพาะจุดและบรรทัดที่ได้รับมอบหมายเท่านั้น ห้ามเขียนทับส่วนอื่น
* **Strict Build Verification:** ต้องรันคำสั่งตรวจสอบการ Build ผ่านทั้ง 2 ฝั่ง 0 errors เสมอ:
  ```powershell
  # ตรวจสอบ Frontend Build
  npm run build
  
  # ตรวจสอบ Backend Build
  go build ./cmd/main.go
  ```

---
*Team T08 | General Clinic Management System (Master Reference: B6706265)*
