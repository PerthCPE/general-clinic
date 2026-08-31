# คู่มือมาตรฐานการออกแบบส่วนติดต่อผู้ใช้ (Frontend Design System & Architecture Guide)
### ระบบบริหารจัดการคลินิกเวชกรรมทั่วไป (General Clinic Management System)
**Student ID:** `B6706265` | **Team:** T08 | **Version:** 2.0 (Master Standard)

---

## 📌 บทนำและวัตถุประสงค์ (Purpose of this Document)

เอกสารฉบับนี้จัดทำขึ้นเพื่อเป็น **Single Source of Truth (SSOT)** และแนวทางปฏิบัติเชิงวิเคราะห์ (Analytical & Design Specification) ในการปรับปรุงและควบคุมมาตรฐานการออกแบบส่วนติดต่อผู้ใช้ (Frontend UI/UX) ของ **ทุกระบบในโปรเจกต์ (ทั้ง 5 โมดูลของ B6706265 และโมดูลของเพื่อนร่วมทีม เช่น Doctor, Pharmacy, Billing, DMS)** ให้มีหน้าตา โทนสี ฟอนต์ การจัดวาง และประสบการณ์การใช้งาน (Look & Feel) เป็นอันหนึ่งอันเดียวกัน 100% ตามมาตรฐานสากลของระบบสารสนเทศทางการแพทย์ (Medical-Grade Enterprise Software)

---

## 1. 🔍 การวิเคราะห์ปัญหา Frontend ในระบบของเพื่อนร่วมทีม (Design Discrepancies & Root Causes)

จากการตรวจสอบหน้าจอของแต่ละโมดูลในระบบ พบความไม่สอดคล้อง (Inconsistencies) และปัญหาเชิงสถาปัตยกรรม UI หลัก 4 ประการ:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        ปัญหาที่พบใน Frontend แต่ละระบบ                                    │
├──────────────────────┬─────────────────────────────────────────────────────────────────┤
│ 1. ฟอนต์ & ตัวอักษร   │ ❌ ใช้ฟอนต์คนละตระกูล, ตัวหนังสือเล็กเกินไป (11-12px), ขาดน้ำหนัก   │
│ (Typography)         │ ❌ มีการใส่ Emoji ปะปนในปุ่มและหัวข้อ ดูไม่เป็นมืออาชีพทางการแพทย์   │
├──────────────────────┼─────────────────────────────────────────────────────────────────┤
│ 2. สีโหมดสว่าง/มืด   │ ❌ Dark Mode ใช้สีดำสนิท (#000000) หรือเทาแบน ขาดมิติความลึก (Elevation) │
│ (Theme & Color)      │ ❌ เส้นขอบและพื้นหลังใน Dark Mode กลืนกันจนมองไม่ออก               │
│                      │ ❌ ปุ่ม Primary Blue ใช้รหัสสีไม่ตรงกัน (#007bff, #1890ff, #3b82f6) │
├──────────────────────┼─────────────────────────────────────────────────────────────────┤
│ 3. การจัดวาง Element │ ❌ Layout ไม่เป็นระเบียบ บางหน้ากว้างเต็มจอ บางหน้าแคบจนอึดอัด       │
│ (Layout & Grid)      │ ❌ ฟอร์มกรอกข้อมูลความสูงไม่เท่ากัน (32px บ้าง 40px บ้าง 50px บ้าง)  │
│                      │ ❌ ตารางข้อมูล (Table) ไม่มี Header คงที่ และ Badge สถานะรูปทรงต่างกัน │
├──────────────────────┼─────────────────────────────────────────────────────────────────┤
│ 4. การตอบสนอง & สถานะ │ ❌ ไม่มี Focus Ring เมื่อกดเลือกช่อง Input ทำให้ผู้ใช้สับสน           │
│ (State & Feedback)   │ ❌ ข้อความแจ้งเตือน Error/Success ใช้ Alert ดั้งเดิมของเบราว์เซอร์    │
└──────────────────────┴─────────────────────────────────────────────────────────────────┘
```

---

## 2. 🔤 มาตรฐานฟอนต์และระดับตัวอักษร (Typography & Typography Scale)

### 2.1 ตระกูลฟอนต์มาตรฐาน (Font Family Stack)
กำหนดให้ทุก Component, Class, และ Element ใช้ Font Stack มาตรฐานเดียวกัน:

```css
:root {
  --font-base: 'Inter', 'Sarabun', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-heading: 'Prompt', 'Kanit', 'Inter', 'Sarabun', sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
}
```

### 2.2 ลำดับชั้นขนาดตัวอักษรทางการแพทย์ (Scaled-Up Clinical Typography Hierarchy)
เพื่อให้บุคลากรทางการแพทย์มองเห็นชัดเจนในระยะห่าง 50–70 ซม. หน้าจอทุกระบบต้องใช้ Hierarchy ดังนี้:

| ระดับ Element | ขนาด Font Size | น้ำหนัก (Weight) | Line Height | ตัวอย่างการใช้งาน |
| :--- | :--- | :--- | :--- | :--- |
| **Page Title (H1)** | `28px – 30px` | `700 (Bold)` | `1.25` | หัวข้อหลักของหน้า (เช่น *บันทึกสัญญาณชีพ & คัดกรอง*) |
| **KPI Big Number** | `32px – 34px` | `800 (ExtraBold)` | `1.1` | ตัวเลขสถิติสรุปบนการ์ด Dashboard (เช่น `128 คน`) |
| **Section Header (H2)** | `19px – 20px` | `700 (Bold)` | `1.3` | หัวข้อส่วน/การ์ดฟอร์ม (เช่น *1. เลือกคิวผู้ป่วย*) |
| **Card Header (H3)** | `17px – 18px` | `600 (SemiBold)` | `1.35` | หัวข้อการ์ดย่อย หรือ Modal Title |
| **Workflow Step Number** | `17px` | `700 (Bold)` | `1.0` | ตัวเลขในวงกลมสเต็ป `1`, `2`, `3` |
| **Form Field Label** | `15px` | `600 (SemiBold)` | `1.4` | ป้ายกำกับช่องกรอก (เช่น *ความดันโลหิต (Systolic)*) |
| **Input / Select Text** | `15.5px` | `500 (Medium)` | `1.4` | ข้อความที่ผู้ใช้พิมพ์ลงใน Input หรือเลือกใน Dropdown |
| **Primary CTA Button** | `16px` | `700 (Bold)` | `1.0` | ข้อความบนปุ่มบันทึก/ยืนยันหลัก (ความสูงปุ่ม `50px`) |
| **Master Table Header** | `15.5px` | `700 (Bold)` | `1.2` | หัวตารางคอลัมน์ (เช่น *หมายเลขคิว*, *HN*, *ชื่อ-นามสกุล*) |
| **Table Cell Body** | `14.5px – 15px` | `500 (Medium)` | `1.4` | ข้อมูลแถวในตาราง |
| **Status Badge / Pill** | `13.5px – 14.5px` | `700 (Bold)` | `1.0` | ป้ายสถานะคิว/Triage (เช่น `รอพบแพทย์`, `ปกติ`) |
| **Helper / Caption Text**| `13px – 13.5px` | `500 (Medium)` | `1.4` | ข้อความอธิบายประกอบด้านล่างช่องกรอก |

### 2.3 กฎเหล็ก: ห้ามใช้ Raw Unicode Emoji ใน UI เด็ดขาด (Strict Zero Emojis)
* ❌ **ห้ามใช้:** 🩺, 💉, 🏥, 👨‍⚕️, 📋, ⚡, ✨, 🟢, 🔴 ในปุ่ม หัวข้อ หรือตาราง
* ✅ **ต้องใช้:** **Medical SVG Icons** แบบลายเส้น (Stroke 1.5–2.0px, `currentColor`, `viewBox="0 0 24 24"` หรือ `20 20`) ที่เปลี่ยนสีตาม Theme อัตโนมัติ

---

## 3. 🎨 มาตรฐานชุดสีโหมดสว่างและโหมดมืด (Color Palette & Theming Standard)

### 3.1 สีหลักของแบรนด์ (Primary Brand Blue)
* **Primary Blue:** `#2563EB` (`rgb(37, 99, 235)`) — ใช้กับปุ่ม CTA หลัก, ลิงก์ที่ Active, Focus Ring, และหัวข้อสำคัญ
* **Primary Hover / Active:** `#1D4ED8` (`rgb(29, 78, 216)`)
* **Primary Tint (Light Background):** `#EFF6FF` (`rgba(37, 99, 235, 0.08)`)

---

### 3.2 ตารางเปรียบเทียบโทนสี Light Mode vs Dark Mode (Elevated Dark Slate)

```
┌──────────────────────────┬─────────────────────────────┬─────────────────────────────┐
│ หมวดหมู่สี (Color Category)│ โหมดสว่าง (Light Mode)       │ โหมดมืด (Elevated Dark Slate)│
├──────────────────────────┼─────────────────────────────┼─────────────────────────────┤
│ Canvas / App Background  │ #F8FAFC (Slate-50)          │ #0F172A (Slate-900 / Deep)  │
│ Surface / Card Container │ #FFFFFF (Pure White)        │ #212836 (Elevated Card Slate)│
│ Header / Topbar / Modal  │ #FFFFFF (White Elevation)   │ #1C2230 (Header Dark Slate) │
│ Border / Divider         │ #E2E8F0 (Slate-200)         │ #333F53 / #2F3B4E (Slate-700)│
│ Input Background         │ #FFFFFF                     │ #1C2230                     │
│ Input Border             │ #CBD5E1 (Slate-300)         │ #333F53 (Slate-700)         │
│ Input Focus Border & Ring│ #2563EB (Ring 3px Alpha 15%)│ #2563EB (Ring 3px Alpha 25%)│
│ Text Primary (Heading)   │ #0F172A (Slate-900)         │ #F8FAFC (Slate-50)          │
│ Text Secondary (Sub/Label)│ #475569 (Slate-600)        │ #94A3B8 (Slate-400)         │
│ Text Muted / Hint        │ #64748B (Slate-500)         │ #64748B (Slate-500)         │
│ Table Header Background  │ #F8FAFC                     │ #1C2230                     │
│ Table Row Hover          │ #F1F5F9 (Slate-100)         │ #283143                     │
└──────────────────────────┴─────────────────────────────┴─────────────────────────────┘
```

---

### 3.3 สีระบุสถานะทางการแพทย์ (Clinical Status & Semantic Colors)

| สถานะทางการแพทย์ | รหัสสีหลัก (Hex) | พื้นหลัง Light Mode | พื้นหลัง Dark Mode | ตัวอย่างการใช้งาน |
| :--- | :--- | :--- | :--- | :--- |
| **Normal / Success** | `#10B981` (Emerald) | `#ECFDF5` (`text: #047857`) | `rgba(16,185,129,0.15)` | สัญญาณชีพปกติ, เสร็จสิ้น, จ่ายยาแล้ว |
| **Urgent / Warning** | `#F59E0B` (Amber) | `#FFFBEB` (`text: #B45309`) | `rgba(245,158,11,0.15)` | กึ่งฉุกเฉิน, รอเรียกคิว, รอพบแพทย์ |
| **Critical / Emergency**| `#EF4444` (Red) | `#FEF2F2` (`text: #B91C1C`) | `rgba(239,68,68,0.18)` | วิกฤต Resuscitation, แพ้ยารุนแรง |
| **Info / Primary Action**| `#2563EB` (Blue) | `#EFF6FF` (`text: #1D4ED8`) | `rgba(37,99,235,0.18)` | รอคัดกรอง, กำลังตรวจ, ข้อมูลสิทธิ |
| **Purple / Special** | `#8B5CF6` (Violet) | `#F5F3FF` (`text: #6D28D9`) | `rgba(139,92,246,0.18)` | หัตถการพิเศษ, สิทธิ์ข้าราชการ |

---

## 4. 📐 มาตรฐานการจัดวาง Element และ Layout (Layout & Component Structure)

### 4.1 ความกว้างสูงสุดของหน้าจอ (Standard Viewport Constraints)
* **หน้า Dense / 2 คอลัมน์ (เช่น `/vitals` คัดกรอง):** `max-width: 1600px; padding: 24px;`
* **หน้าฟอร์มบันทึกข้อมูล (เช่น `/registration`, `/eligibility`):** `max-width: 1440px; padding: 24px;`
* **หน้าตาราง Dashboard / ประวัติ (เช่น `/queue`, `/vitals-history`):** `max-width: 1240px; padding: 24px;`

---

### 4.2 โครงสร้างส่วนหัวของหน้า (Page Header & Topbar Pattern)
ทุกหน้าต้องมีแถบส่วนหัวที่มีโครงสร้างเดียวกัน:

```html
<div className="page-header-container">
  <div className="page-title-group">
    <!-- Icon Box: 40x40px, Rounded 12px, Background #2563EB -->
    <div className="page-icon-box">
      <svg className="icon-svg">...</svg>
    </div>
    <div>
      <h1 className="page-main-title">ชื่อระบบภาษาไทย (English System Name)</h1>
      <p className="page-sub-title">คำอธิบายสั้นๆ เกี่ยวกับหน้าที่ของระบบนี้</p>
    </div>
  </div>
  <div className="page-actions-group">
    <!-- ปุ่ม Action เสริม เช่น รีเฟรช, สลับหมวดหมู่, ตัวกรอง -->
  </div>
</div>
```

---

### 4.3 โครงสร้างการ์ดฟอร์มพร้อมสเต็ปเลขกำกับ (Numbered Form Sections)
ฟอร์มที่ต้องกรอกเป็นขั้นตอน ต้องใช้ตัวเลขสเต็ปสีน้ำเงินกำกับเสมอ:

```html
<div className="form-section-header">
  <span className="section-step-num">1</span>
  <span className="section-step-title">เลือกคิวผู้ป่วยเพื่อคัดกรอง (Select Patient Queue)</span>
  <span className="text-required">*</span>
</div>
```

* **สไตล์ของ `.section-step-num`:**
  * กว้าง `32px`, สูง `32px`, `border-radius: 50%`
  * พื้นหลัง: `#2563EB`, ตัวหนังสือสีขาว `#FFFFFF`
  * ฟอนต์: `17px`, น้ำหนัก `700`

---

### 4.4 ขนาดและมิติของช่องกรอกข้อมูล (Form Field Ergonomics)
* **ความสูง Input & Select:** `48px` (ไม่เล็กและไม่ใหญ่เกินไป เหมาะกับเมาส์และหน้าจอสัมผัส)
* **ขอบมน (Border Radius):** `8px – 10px`
* **Padding ภายใน:** `10px 16px`
* **Focus State:** `border-color: #2563EB; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15); outline: none;`
* **Disabled State:** พื้นหลัง `#F1F5F9` (Light) / `#1E293B` (Dark), เคอร์เซอร์ `not-allowed`

---

### 4.5 ลำดับชั้นของปุ่ม (Button Hierarchy & Dimensions)

```
┌───────────────────────┬────────────┬─────────────────────────────┬───────────────────────────┐
│ ชนิดของปุ่ม (Button)   │ ความสูง     │ สีพื้นหลัง / เส้นขอบ (Theme) │ การใช้งาน                  │
├───────────────────────┼────────────┼─────────────────────────────┼───────────────────────────┤
│ **Primary CTA**       │ `50px`     │ Solid `#2563EB` (Text #FFF) │ บันทึกข้อมูล, ยืนยัน, ส่งต่อ│
├───────────────────────┼────────────┼─────────────────────────────┼───────────────────────────┤
│ **Secondary / Outline**│ `48px`    │ พื้นใส, เส้นขอบ `#CBD5E1`   │ ยกเลิก, ล้างฟอร์ม, ย้อนกลับ │
├───────────────────────┼────────────┼─────────────────────────────┼───────────────────────────┤
│ **Action / Icon Button**│ `40px`   │ สีอ่อนตามสถานะ (Tint)        │ เรียกคิว, ดูรายละเอียด, แก้ไข│
├───────────────────────┼────────────┼─────────────────────────────┼───────────────────────────┤
│ **Filter Chip Pill**  │ `36px`     │ สลับ Active (#2563EB) / ปิด │ กรองข้อมูล (วันนี้, ฉุกเฉิน)│
└───────────────────────┴────────────┴─────────────────────────────┴───────────────────────────┘
```

---

### 4.6 มาตรฐานตารางข้อมูล (Master Data Table Standard)
* **Container:** ขอบมน `12px – 14px`, เส้นขอบ `1px solid var(--border-color)`, มี `overflow-x: auto;`
* **Header (`<th>`):** ความสูง `52px`, ตัวหนา `700`, พื้นหลัง `#F8FAFC` (Light) / `#1C2230` (Dark)
* **Row (`<tr>`):** ความสูงอย่างน้อย `58px – 60px`, มีเส้นคั่นล่าง `#E2E8F0` (Light) / `#333F53` (Dark)
* **Hover Effect:** ไฮไลท์พื้นหลังเป็น `#F1F5F9` (Light) / `#283143` (Dark) แบบ Smooth Transition
* **Status Badges (Pills):**
  * ขนาดคงที่ `min-width: 120px; height: 36px;`
  * มีจุดวงกลมกะพริบ (Pulsing Indicator Dot `8x8px`) อยู่หน้าข้อความสถานะ

---

### 4.7 แถบค้นหาและตัวกรองด่วน (Search & Quick Filter Toolbar)
* **Search Input:** มีไอคอนแว่นขยาย SVG ด้านซ้าย, ปุ่มล้างคำค้น (`✕`) ด้านขวาเมื่อมีข้อความ, และปุ่มกดค้นหาในตัว
* **Filter Chips:** ปุ่มรูปวงรี (Pill) ที่สามารถคลิกสลับเงื่อนไขได้ทันที เช่น `ทั้งหมด`, `วันนี้`, `เดือนนี้`, `ฉุกเฉิน / วิกฤต` โดยสถานะที่เลือก (Active) จะเปลี่ยนเป็นสี `#2563EB` ตัวหนังสือสีขาวทันที

---

### 4.8 หน้าต่างป๊อปอัป (Modal Dialog Standard)
* **Backdrop:** พื้นหลังมืดโปร่งแสง `rgba(15, 23, 42, 0.65)` พร้อม `backdrop-filter: blur(6px);`
* **Modal Card:** ขอบมน `16px`, พื้นหลัง `#FFFFFF` (Light) / `#212836` (Dark), ขอบ `#333F53`
* **Animation:** Fade-in และ Scale-up จาก `0.95` ไป `1.0` ภายใน `0.2s ease-out`
* **Fixed Header & Actions Footer:** ส่วนหัวและส่วนปุ่มกดยึดติดคงที่ เนื้อหาตรงกลางมี Scrollbar แบบ Custom

---

## 5. 📋 สรุป Checklist สำหรับทุกคนในทีมก่อนส่งงาน (Definition of Done)

ก่อนรวมโค้ดเข้าสู่ Repository กลาง ทุกคนต้องตรวจสอบ Checklist 8 ข้อนี้:
1. [ ] **Zero Emojis:** ไม่มีการใช้รูปอีโมจิ Unicode ใดๆ ในโค้ด ให้ใช้ Medical SVG ทั้งหมด
2. [ ] **Typography Scale:** ใช้ขนาดตัวหนังสือตามตาราง Section 2 (ไม่ใช้ฟอนต์เล็กกว่า 13px ในเนื้อหาหลัก)
3. [ ] **Primary Blue:** ใช้รหัสสี `#2563EB` เป็นสีหลักของปุ่มและลิงก์ Active ทั้งหมด
4. [ ] **Elevated Dark Mode:** ตรวจสอบในโหมดมืดแล้วว่าการ์ดใช้สี `#212836`, ขอบใช้ `#333F53`, และพื้นหลังใช้ `#0F172A`
5. [ ] **Form Height:** ช่อง Input และ Dropdown มีความสูง `48px` และปุ่ม CTA มีความสูง `50px`
6. [ ] **Clinical Format:** รหัสคิวขึ้นต้นด้วย `Q` + Hex 4 หลัก (`Q0001`–`QFFFF`) และ HN ขึ้นต้นด้วย `HN` + Hex 4 หลัก (`HN0001`–`HNFFFF`)
7. [ ] **Dynamic Dates:** ไม่มีการล็อกวันที่ตายตัว (Hardcoded Date) ในตัวกรอง ให้คำนวณตามเวลาจริง
8. [ ] **No Build Errors:** รัน `npm run build` และ `go build ./cmd/main.go` ผ่าน 0 errors

---
*เอกสารนี้จัดทำและควบคุมคุณภาพโดย: นายสรยุทธ ปัทนาถา (B6706265)*
