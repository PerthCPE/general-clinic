# คู่มือมาตรฐานการออกแบบส่วนติดต่อผู้ใช้ (Frontend Design System & Master Architecture Guide)
### ระบบบริหารจัดการคลินิกเวชกรรมทั่วไป (General Clinic Management System - Team T08)
> **Master Reference & Single Source of Truth (SSOT):**  
> จัดทำและอ้างอิงจาก **ระบบมาตรฐานแม่แบบทางการแพทย์ของนักศึกษา รหัส B6706265**  
> (1. Registration & Search, 2. Master Queue Management, 3. Medical Eligibility Verification, 4. Screening & Vitals Recording, 5. Screening History Dashboard)

---

## 📌 1. ปรัชญาการออกแบบระบบ (Design Philosophy & Core Rules)

ระบบสารสนเทศทางการแพทย์ (Medical-Grade Software) ต้องการความชัดเจน ความน่าเชื่อถือ ความเร็วในการทำงาน และการลดข้อผิดพลาดของผู้ปฏิบัติงาน จึงมีกฎเหล็ก 4 ประการ:

1. **🚫 Zero Raw Emojis in UI 100% (กฎเหล็กอันดับหนึ่ง):**
   - ห้ามใช้ Raw Unicode Emoji ในส่วนใดของ UI เด็ดขาด (ปุ่ม, ข้อความ, Badge, Toast, Modal, Table Header, Mock Data)
   - ต้องใช้ **Stroke-Based Medical SVG Icons** (`stroke-width="1.8–2.0px"`, `currentColor`, `viewBox="0 0 24 24"` หรือ `20 20`) ที่ปรับสีตาม Theme อัตโนมัติ
2. **🎨 Elevated Dark Slate Architecture:**
   - Dark Mode ต้องมีระดับความลึก (Elevation) ที่ชัดเจน: Canvas `#0F172A` / Surface Card `#212836` / Modal `#1C2230` / Borders `#333F53`
   - ห้ามใช้สีดำสนิท `#000000` หรือสีเทาแบนที่กลืนกัน
3. **🟦 Brand Identity Blue (`#2563EB`):**
   - สีน้ำเงินหลัก `#2563EB` (`rgb(37, 99, 235)`) เป็นสีประจำแบรนด์ของปุ่ม Primary, Active Nav, Focus Highlight, และ KPI Cards
4. **🔢 Hexadecimal 4-Digit Clinical Codes:**
   - Queue Number: `Q0001` ถึง `QFFFF`
   - Hospital Number: `HN0001` ถึง `HNFFFF` (ไม่มีขีดคั่น)

---

## 🔤 2. ระบบตัวอักษรและน้ำหนัก (Typography & Scale Hierarchy)

### ฟอนต์มาตรฐานของระบบ (Google Fonts):
* **Heading & Brand:** `'Plus Jakarta Sans'`, `'Kanit'`, sans-serif
* **Body, Form & Labels:** `'IBM Plex Sans Thai'`, `'Prompt'`, `'Inter'`, sans-serif
* **Clinical Codes / Numeric Data:** `'JetBrains Mono'`, monospace

### ตารางขนาดตัวอักษร (Typography Scale):
| ระดับ Element | ขนาด (Font Size) | น้ำหนัก (Weight) | Line Height | สี Light Mode | สี Dark Mode | ตัวอย่างการใช้งาน |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **Page Title** | `26–28px` | Bold (`700`) | `32–34px` | `#0F172A` | `#F8FAFC` | หัวข้อหลักของแต่ละหน้า |
| **Card / Section Title** | `16–18px` | Bold (`700`) | `22–24px` | `#1E293B` | `#F1F5F9` | หัวข้อการ์ด, Section Header |
| **Subtitle / Description** | `14–15px` | Regular (`400`) | `20–22px` | `#64748B` | `#94A3B8` | คำบรรยายใต้หัวข้อ |
| **Field Label** | `14–14.5px` | SemiBold (`600`) | `18–20px` | `#334155` | `#CBD5E1` | ป้ายกำกับช่องกรอกข้อมูล |
| **Input / Select Text** | `15–15.5px` | Medium (`500`) | `22px` | `#0F172A` | `#FFFFFF` | ตัวหนังสือในช่องกรอก |
| **Button Text** | `15–16px` | SemiBold (`600`) | `20px` | `#FFFFFF` / `#2563EB` | `#FFFFFF` | ปุ่มกด Action ต่างๆ |
| **Table Header** | `14.5–15px` | SemiBold (`600`) | `20px` | `#475569` | `#94A3B8` | หัวตารางข้อมูล |
| **Table Cell Text** | `14.5–15px` | Regular (`400/500`) | `20–22px` | `#1E293B` | `#E2E8F0` | แถวข้อมูลในตาราง |
| **Badges / Meta Tags** | `13–13.5px` | SemiBold (`600`) | `16px` | หลากสีตามสถานะ | เรืองแสง Contrast สูง | ป้ายสถานะ, Triage, Role |

---

## 🎨 3. ตารางสีสากล (Color Palette Tokens)

### Light Mode vs Dark Mode Master Tokens:
| Token Name | Light Mode Value | Dark Mode Value | คำอธิบายและหน้าที่ |
| :--- | :---: | :---: | :--- |
| `--bg-canvas` | `#F8FAFC` / `#F1F5F9` | `#0F172A` / `#22272E` | พื้นหลังใหญ่ของทั้งหน้าเว็บ |
| `--bg-card` | `#FFFFFF` | `#212836` / `#2D333B` | พื้นหลังการ์ด, ตาราง, กล่องฟอร์ม |
| `--bg-header` | `#FFFFFF` / `#F8FAFC` | `#1C2230` | แถบ Topbar, Sidebar, Modal Header |
| `--border-color` | `#E2E8F0` | `#333F53` / `#2F3B4E` | เส้นขอบการ์ด, เส้นแบ่งตาราง |
| `--border-focus` | `#2563EB` | `#60A5FA` | สีเส้นขอบเมื่อกดเลือก (Focus Ring) |
| `--brand-primary` | `#2563EB` | `#3B82F6` | สีน้ำเงินแบรนด์หลัก |
| `--brand-primary-hover`| `#1D4ED8` | `#2563EB` | สีน้ำเงินเมื่อ Hover |
| `--text-primary` | `#0F172A` | `#F8FAFC` | ตัวหนังสือหลัก, หัวข้อ |
| `--text-secondary` | `#475569` | `#CBD5E1` | ตัวหนังสือทั่วไป, ค่าในตาราง |
| `--text-muted` | `#64748B` | `#94A3B8` | ป้ายหน่วย, คำอธิบายย่อย |

---

## 🩺 4. มาตรฐานวิดเจ็ตทางการแพทย์ (Medical UI Widgets Specifications)

### 4.1. เกจคำนวณ BMI อัจฉริยะ (WHO Asian Standard BMI Gauge)
* **สูตรคำนวณ:** $\text{BMI} = \frac{\text{Weight (kg)}}{(\text{Height (m)})^2}$
* **เกณฑ์มาตรฐานคนเอเชีย (Asian Standard):**
  * `< 18.5`: น้ำหนักน้อย / ผอม (Underweight) — สีฟ้า `#0EA5E9`
  * `18.5 – 22.9`: สมส่วน / น้ำหนักปกติ (Normal) — สีเขียว `#10B981`
  * `23.0 – 24.9`: น้ำหนักเกิน / ท้วม (Overweight) — สีเหลืองทอง `#F59E0B`
  * `25.0 – 29.9`: อ้วนระดับ 1 (Obese Class 1) — สีส้ม `#F97316`
  * `≥ 30.0`: อ้วนระดับ 2 / อ้วนอันตราย (Obese Class 2) — สีแดง `#EF4444`
* **แถบเกจ Visual Bar:** แถบเกจสี 5 ระดับแนวนอน พร้อมเข็ม Marker เลื่อนตามค่า BMI อัตโนมัติ

### 4.2. การ์ดคัดแยกความเร่งด่วน 5 ระดับ (Triage Level 1–5 Selector)
* **Level 1 (ฉุกเฉินวิกฤต - Resuscitation):** สีแดงเข้ม `#DC2626` | พื้นหลัง `#FEF2F2` (Dark: `rgba(220, 38, 38, 0.25)`)
* **Level 2 (ฉุกเฉินเร่งด่วน - Emergency/Urgent):** สีส้มแสด `#EA580C` | พื้นหลัง `#FFF7ED` (Dark: `rgba(234, 88, 12, 0.25)`)
* **Level 3 (กึ่งฉุกเฉิน - Semi-Urgent):** สีเหลืองอำพัน `#D97706` | พื้นหลัง `#FFFBEB` (Dark: `rgba(217, 119, 6, 0.25)`)
* **Level 4 (ไม่ฉุกเฉิน/ปกติ - Non-Urgent):** สีเขียว `#16A34A` | พื้นหลัง `#F0FDF4` (Dark: `rgba(22, 163, 74, 0.25)`)
* **Level 5 (ตรวจสุขภาพทั่วไป - General):** สีน้ำเงิน `#2563EB` | พื้นหลัง `#EFF6FF` (Dark: `rgba(37, 99, 235, 0.25)`)

### 4.3. ระบบปุ่มเรียกคิวและคอลัมน์คิวแบบล็อคตำแหน่ง (Locked Queue & Audio Caller)
* **โครงสร้างคอลัมน์หมายเลขคิว:**
  * รวมหมายเลขคิว (`Q0001`) และปุ่มเรียกคิว `(🔊)` ให้อยู่ในคอลัมน์เดียวกันด้วย `queue-locked-wrapper` (`width: 125px`)
  * ป้ายรหัสคิว: `font-size: 16px; font-weight: 700; color: #2563EB; width: 58px;`
  * ปุ่มลำโพงเรียกคิว: ขนาด `32px × 32px` วงกลม พร้อม SVG ลำโพง ปรับ Hover Animation
  * แถวที่ไม่มีปุ่มเรียกคิว (เช่น กำลังตรวจ): ใช้ `call-audio-placeholder` ขนาด `32px` เท่ากัน เพื่อให้ชื่อคนไข้ทุกแถวตรงแนวเสมอกัน 100%

### 4.4. ป้ายสถานะเรืองแสงและการแสดงผลระบบออนไลน์ (Glowing Status Badges)
* **ปุ่มเชื่อมต่อระบบ สปสช. ออนไลน์ (`.online-status-badge`):**
  * Light Mode: `background: #ECFDF5; color: #059669; border: 1px solid #A7F3D0;`
  * Dark Mode: `background: rgba(22, 163, 74, 0.3); color: #86EFAC; border: 1.5px solid #4ADE80; box-shadow: 0 2px 8px rgba(34, 197, 94, 0.25);`
  * จุดไฟสถานะ (`.status-dot`): จุดไฟสีเขียว `#4ADE80` พร้อมแอนิเมชันกระพริบ `pulseDot`

---

## 📋 5. เช็คลิสต์ตรวจสอบความสมบูรณ์สำหรับทุกโมดูล (Definition of Done Checklist)

ทุกหน้าที่พัฒนาโดยเพื่อนร่วมทีมต้องผ่านการตรวจสอบตามเกณฑ์ B6706265 ก่อนถือว่าเสร็จสมบูรณ์:

- [ ] **1. ไร้ Emoji ดั้งเดิม:** ตรวจสอบและแทนที่ Emoji ทั้งหมดด้วย Medical SVG Icon
- [ ] **2. การรองรับ Dark Mode:** ตรวจสอบว่าสีพื้นหลังเป็นการ์ด Slate `#212836` ไม่ใช่สีดำสนิท `#000000`
- [ ] **3. ตัวอักษรคมชัดสูง:** ป้าย Label, ค่าในตาราง และหน่วยทางการแพทย์ อ่านง่าย มี Contrast สูง
- [ ] **4. รหัสการแพทย์:** หมายเลขคิวใช้ `Q0001`–`QFFFF` และ HN ใช้ `HN0001`–`HNFFFF`
- [ ] **5. In-Memory Mock Data:** มีชุดข้อมูลจำลองในตัว สามารถเปิดเดโมได้ 100% แม้ไม่มี Backend
- [ ] **6. Build ผ่านสมบูรณ์:** รัน `npm run build` และ `go build ./cmd/main.go` ผ่าน 0 errors

---
*Team T08 | General Clinic Management System (Master Reference Specification: B6706265)*
