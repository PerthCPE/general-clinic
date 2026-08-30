# Frontend Design System & UI/UX Guidelines — General Clinic MS
### Team T08 | ENG23 3031 System Analysis and Design | Student ID: B6706265

> **Document Purpose:** This document serves as the **Single Source of Truth (SSOT)** for Frontend Architecture, Design Tokens, Typography Scales, Theme Palettes, Layout Containers, and UI/UX Standards across the **General Clinic Management System**. Every screen and component created (by human developers or AI assistants) must strictly adhere to the standards and tokens specified in this document to ensure consistent, medical-grade, and production-ready code.

---

## 0. Non-Negotiable Core Rules

1. **Strict Zero Raw Emojis in UI:**
   - Never use raw unicode emojis (e.g. ⚡, ✨, 🏥, 🩺, 💊, 📋, 👨‍⚕️) in UI text, buttons, labels, headings, toasts, alert banners, cards, or modal dialogs under any circumstance.
   - Use clean, standardized **Medical SVG Icons** (stroke width 1.5–2px, `currentColor`, `viewBox="0 0 24 24"` or `20 20`).
   - Always propose the SVG design pattern before introducing or modifying icons on any screen.
2. **No Hardcoded Colors, Fonts, or Duplicate Spacing:**
   - Always reference predefined CSS Variables / Design Tokens documented below.
3. **High-Legibility Clinical Typography (Accessible Scale):**
   - Design with large, clear, comfortable font sizing so medical personnel can view, read, and enter clinical data quickly and without eye fatigue.
4. **Full Light & Dark Mode Parity from Day One:**
   - A component is only considered complete once verified and pixel-perfect in both **Light Mode** and **Dark Mode (Elevated Dark Slate Palette)**.
5. **Scope Isolation & RBAC Parity:**
   - Role-Based Access Control (RBAC) must be strictly enforced.
   - The default initial route must always be `LoginPage`.
   - `nurse_assistant` must always possess identical access permissions to `nurse` (`/queue`, `/vitals`, `/vitals-history`).
   - Work strictly within assigned modules. Never modify or delete teammate modules (`pages/doctor/`, `pages/pharmacy/`, `pages/billing/`).
6. **Self-Contained & Simulation Ready:**
   - Maintain self-contained, in-memory state and mock data on all UI pages for 100% standalone simulation capability without backend dependencies.

---

## 0.1 Global Frontend Directives & Prompt Specification (Part 1: UI/UX & System Standards)

> **Prompt Directive for AI Agents & Developers:** When generating, reviewing, or modifying any frontend component, view, stylesheet, or modal within this clinic management system, you MUST strictly enforce the following 6 global architectural pillars:

### 1. Typography Scale-Up & Accessibility Standard
All interfaces must use the **Scaled-Up Clinical Typography Hierarchy** to guarantee effortless readability in hospital lighting conditions:
- **Page Titles:** `28px – 30px` (Font Weight `700`, line-height `1.2`)
- **KPI Summary / Stat Big Numbers:** `32px – 34px` (Font Weight `700`, tabular figures)
- **Card & Section Headers:** `19px` (Font Weight `700`)
- **Workflow Step Indicators (e.g. Step 1, 2, 3):** `17px` (Font Weight `700`)
- **Form Field Labels:** `15px` (Font Weight `600`, high contrast)
- **Interactive Inputs & Select Dropdowns:** `15.5px` (Height `48px`, padding `10px 14px`)
- **Primary CTA Buttons:** `16px` (Height `50px`, Font Weight `700`, border-radius `8px–10px`)
- **Master Table Headers:** `15.5px` (Font Weight `700`, uppercase tracking)
- **Table Cell Contents:** `14.5px – 15px` (Font Weight `500`, tabular alignment)
- **Clinical Badges & Status Pills:** `13.5px – 14.5px` (Font Weight `700`, padding `4px 10px`)

### 2. Elevated Dark Slate Theming Standard
Dark mode must strictly use the **Elevated Dark Slate Palette** (`#212836` surface, `#1C2230` topbar/header, `#333F53` border, `#0F172A` background, `#2563EB` brand blue). Never use pure `#000000` pitch black backgrounds or washed-out grays. Every card, table, modal, and input must maintain crisp, distinct elevation layers with identical visual hierarchy in both themes.

### 3. Strict Zero-Emoji & Medical SVG Policy
Never introduce raw unicode emojis anywhere in code or markup. Every visual cue must use clean, standardized, vector-based **Medical SVG Icons** (Stroke 1.5–2px, `currentColor`, responsive `viewBox="0 0 24 24"` or `20 20`) styled via CSS variables.

### 4. Workstation Container Dimensions & Ergonomic Form Spacing
Workstation viewports are designed for dense, multi-parameter clinical workflows:
- **Vitals & Screening (`/vitals`):** `max-width: 1600px` (2-column layout: Form `minmax(0, 1fr)` + Live Widgets `360px`).
- **Registration (`/registration`) & Eligibility (`/eligibility`):** `max-width: 1440px`.
- **Master Queue (`/queue`) & Screening History (`/vitals-history`):** `max-width: 1240px`.
- **Form Spacing:** Step gap `30px`, section gap `18px`, grid input gap `14px–16px`.

### 5. Hexadecimal 4-Digit Clinical Formatting
- **Queue Number:** Strictly format as `Q` + 4-digit uppercase hexadecimal (`Q0001` through `QFFFF`, e.g. `Q0001` $\rightarrow$ `Q0009` $\rightarrow$ `Q000A` $\rightarrow$ `Q0010` $\rightarrow$ `QFFFF`).
- **Hospital Number (HN):** Strictly format as `HN` + 4-digit uppercase hexadecimal (`HN0001` through `HNFFFF`, e.g. `HN0001` $\rightarrow$ `HN0009` $\rightarrow$ `HN000A` $\rightarrow$ `HNFFFF`), with no hyphen separator.

### 6. Minimalist Transparent Patient Summary Strip
When displaying active patient context across clinical screens, use a streamlined **Transparent Inline Summary Strip** (`.patient-compact-strip`) showing `[Queue No] • Full Name • HN • Gender/Age • Coverage Scheme` with integrated quick action buttons, avoiding heavy, opaque, space-wasting container boxes.

---

## 0.2 Comprehensive Prompt Specification: System-by-System UI/UX Reference Architecture

> **Prompt Directive for AI Agents & Developers:** When building or restyling any screen across the clinic system, you MUST reference the exact architectural patterns, widgets, components, and layout styling established in the **5 Core Assigned Modules (Student ID: B6706265)** detailed below:

### System 1: Patient Registration Module (`/registration` — `RegistrationPage.tsx`, `PatientFormCard.tsx`, `PatientSearchCard.tsx`)
- **Layout Container:** `max-width: 1440px`, centered with `24px` horizontal padding.
- **Numbered Workflow Headers:** Use `.section-num` with blue circular badge (`width: 32px`, `height: 32px`, background `#2563EB`, text `#FFFFFF`, font weight `700`, font size `17px`) followed by `.section-title` (`19px` font weight `700`).
- **Live Search & Autocomplete Card:** Real-time search bar with Search Lens SVG (`20x20`), clear button (`✕`), and instant dropdown results highlighting matched text in `#2563EB`.
- **Form Ergonomics:**
  - Standard input field height: `48px`, border radius `8px–10px`, font size `15.5px`.
  - Focused input styling: `border-color: #2563EB`, `box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15)`.
  - Required field indicator: Red asterisk `<span className="text-required">*</span>` (`#EF4444`, font weight `700`).
- **Input Data Masking:**
  - Thai National ID: `X-XXXX-XXXXX-XX-X` with real-time Modulo 11 checksum indicator badge (`✓ ถูกต้อง` in `#10B981` or `✕ ไม่ถูกต้อง` in `#EF4444`).
  - Thai Phone: `0XX-XXX-XXXX` with auto-hyphenation.
- **Form Action Footer:** Primary CTA Button (`height: 50px`, `#2563EB` solid blue with SVG icon, font weight `700`, font size `16px`) paired with a neutral Reset Button (`#64748B` outline).

### System 2: Master Queue Management Module (`/queue` — `QueuePage.tsx`)
- **Layout Container:** `max-width: 1240px`, high-density table optimization.
- **Top KPI Stat Cards Grid:** 4-column metric cards (`grid-template-columns: repeat(4, 1fr)`):
  - Metric big numbers: `34px`, font weight `800`, `var(--font-heading)`.
  - Metric labels: `14.5px`, font weight `600`, `#64748B`.
  - Icon container: `44x44px`, rounded-xl, tint background matching status category (`rgba(37,99,235,0.1)` for blue, `rgba(16,185,129,0.1)` for green, etc.).
- **Master Table Design:**
  - Table header (`th`): Height `52px`, background `#F8FAFC` (Light) / `#1C2230` (Dark), font weight `700`, font size `15.5px`, uppercase tracking.
  - Table row (`tr`): Height `60px`, border bottom `#E2E8F0` / `#333F53`, hover background `#F1F5F9` / `#2D3748`.
  - Table cell (`td`): Font size `15px`, tabular number alignment.
- **Queue Status Badges (Pills):**
  - Dimensions: Fixed width `130px`, height `38px`, border radius `9999px`.
  - Status dot: `8x8px` glowing circle with CSS animation pulse (`@keyframes pulse`).
  - Color coding: Waiting (`#EFF6FF` / `#2563EB`), In-Progress (`#FFFBEB` / `#D97706`), Completed (`#ECFDF5` / `#059669`), Cancelled (`#FEF2F2` / `#DC2626`).
- **Audio Queue Trigger Button:** Call Button with Speaker SVG (`16x16px`) triggering the Dual-Engine Natural Thai Female Voice (`audioQueue.ts`).
- **Identifier Formatting:** Strict `Q0001`–`QFFFF` Hexadecimal progression.

### System 3: Eligibility Verification Module (`/eligibility` — `EligibilityPage.tsx`)
- **Layout Container:** `max-width: 1440px`.
- **Smart Verification Header:** Prominent National ID search box with auto-fill from active queue.
- **Coverage Rights Result Card:**
  - Rights Badge: Large pill with verified shield SVG (`สิทธิ 30 บาท (บัตรทอง / สปสช.)`, `สิทธิประกันสังคม`, `สิทธิข้าราชการ / จ่ายตรง`).
  - Primary Hospital Tag: Solid badge showing registered main hospital (`โรงพยาบาลมหาราชนครราชสีมา`).
  - Sub-Hospital Tag: Secondary pill showing affiliated primary care clinic (`ศูนย์แพทย์ชุมชนเมือง`).
- **Verification Timestamp & Status Indicator:** Formatted Thai date (`27 สิงหาคม 2569 • 14:30 น.`) with verified green checkmark badge (`Active / สิทธิพร้อมใช้งาน`).

### System 4: Screening & Vital Signs Workstation (`/vitals` — `VitalsPage.tsx`, `VitalsFormCard.tsx`, `BMIWidget.tsx`, `TriageWidget.tsx`, `WaitingQueueList.tsx`)
- **Layout Container:** `max-width: 1600px`, 2-Column Asynchronous Grid (`minmax(0, 1fr) 360px`).
- **Minimalist Transparent Patient Strip (`.patient-compact-strip`):**
  - Background: `rgba(37, 99, 235, 0.04)` (Light) / `rgba(37, 99, 235, 0.12)` (Dark), border `1px solid rgba(37, 99, 235, 0.18)`, border radius `12px`, padding `12px 18px`.
  - Content: `[Queue Badge Q0001] • Full Name • HN0001 • Gender, Age • Coverage Scheme • [Allergy Alert Pill] • [🔊 Audio Call Queue Button]`.
- **Vital Signs Input Grid:** 3-column responsive grid with permanent physical unit suffix labels (e.g. `kg`, `cm`, `°C`, `mmHg`, `bpm`, `%`) positioned inside inputs, with browser spinner buttons strictly removed via CSS.
- **Real-Time BMI Gauge Widget (WHO Asian Standard):**
  - Live calculations on height/weight input change.
  - Semicircular SVG Needle Gauge with 4 color-coded zones (`<18.5` Blue Underweight, `18.5–22.9` Green Normal, `23.0–24.9` Orange Overweight, `≥25.0` Red Obese).
  - Target weight delta calculation (e.g. `น้ำหนักเกินเกณฑ์มาตรฐาน 4.5 กก.`).
- **Triage Level 1–5 Classification Widget:**
  - Emergency Triage scale: Level 1 (Resuscitation - Red), Level 2 (Emergency - Orange), Level 3 (Urgent - Yellow), Level 4 (Semi-Urgent - Green), Level 5 (Non-Urgent - Blue).
  - One-click interactive selector chips with visual clinical urgency descriptions.
- **Clinical Decision Support (CDS) Early Warning Alerts:**
  - Automated detection of Crisis/Elevated BP, High Fever (`≥38.5°C`), Low SpO2 (`<95%`), and Tachycardia/Bradycardia.
  - Flashing amber/red alert pill tags with pulsating warning icon.
- **Form Auto-Draft Recovery Banner:** LocalStorage automatic saving with blue recovery bar (`พบข้อมูลร่างที่บันทึกไว้เมื่อ 14:25 น. [กู้คืนข้อมูลร่าง] [ละทิ้ง]`).

### System 5: Screening History & Clinical Analytics (`/vitals-history` — `ScreeningHistoryPage.tsx`, `PatientVitalsTrendCard.tsx`, `ScreeningDetailModal.tsx`)
- **Layout Container:** `max-width: 1240px`.
- **Analytics Top Banner:** Historical summary statistics (Total Screened, Average BP, Normal BMI Rate, Critical Triage Count).
- **Interactive Vitals Trend Graph (`PatientVitalsTrendCard.tsx`):** Multi-visit timeline chart plotting Blood Pressure (Systolic/Diastolic), Pulse, and Weight trends over time.
- **Screening History Table:** Filterable by date range, patient name, HN, or triage level, with clickable rows opening the Detail Modal.
- **Screening Detail Modal (`ScreeningDetailModal.tsx`):**
  - Surface: `#FFFFFF` (Light) / `#2A3441` (Elevated Slate Dark Mode), border `#333F53`, shadow `0 20px 25px -5px rgba(0, 0, 0, 0.5)`.
  - Comprehensive clinical summary: Full Vitals Grid with units, BMI gauge, Triage badge, Nurse notes, and Print Certificate button.

---

## 0.3 Master Prompt Engineering Blueprint: Tables, Identifiers, Gaps & Dual-Theming Standards

> **Master Execution Directive for All Frontend Tasks:** Every component, table, card, input, and badge must strictly comply with the exact specifications, gap sizes, typography measurements, and dual-theming color rules detailed below:

### 1. Master Clinical Table Specification (Light & Dark Theme)

All clinical data tables across Queue, History, Doctor, Pharmacy, and Billing must implement the **Master Clinical Table Structure**:

| Table Property | Light Mode Spec | Dark Mode Spec (Elevated Slate) | CSS Implementation Rule |
| :--- | :--- | :--- | :--- |
| **Table Container Wrapper** | `border: 1px solid #E2E8F0`, `background: #FFFFFF`, `border-radius: 12px`, `box-shadow: 0 1px 3px rgba(0,0,0,0.04)` | `border: 1px solid #333F53`, `background: #212836`, `border-radius: 12px`, `box-shadow: 0 4px 12px rgba(0,0,0,0.35)` | `.table-wrapper { overflow: hidden; border-radius: 12px; }` |
| **Header Row (`th`)** | Height `52px`, `background: #F8FAFC`, `color: #475569`, Font `15.5px` (Weight `700`), `border-bottom: 2px solid #E2E8F0`, tracking `0.5px` | Height `52px`, `background: #1C2230`, `color: #94A3B8`, Font `15.5px` (Weight `700`), `border-bottom: 2px solid #333F53`, tracking `0.5px` | `th { height: 52px; font-weight: 700; font-size: 15.5px; text-transform: uppercase; letter-spacing: 0.5px; }` |
| **Data Rows (`tr`)** | Height `60px`, `background: #FFFFFF`, `border-bottom: 1px solid #E2E8F0`, transition `background 0.15s ease` | Height `60px`, `background: #212836`, `border-bottom: 1px solid #2F3B4E`, transition `background 0.15s ease` | `tbody tr { height: 60px; transition: background 0.15s ease; }` |
| **Row Hover State** | `background: #F1F5F9` (Light Slate Hover) | `background: #2D3748` (Elevated Slate Hover) | `tbody tr:hover { background: var(--table-row-hover); }` |
| **Data Cell (`td`)** | Font `15px` (Weight `500`), `color: #0F172A`, padding `14px 20px` | Font `15px` (Weight `500`), `color: #F8FAFC`, padding `14px 20px` | `td { padding: 14px 20px; font-size: 15px; vertical-align: middle; }` |
| **Numeric & Code Cells** | `font-family: var(--font-mono)`, `font-weight: 700`, `letter-spacing: 0.5px` | `font-family: var(--font-mono)`, `font-weight: 700`, `letter-spacing: 0.5px` | `.cell-mono { font-family: var(--font-mono); font-weight: 700; }` |
| **Action Buttons Cell** | Flex alignment, `gap: 8px`, justify right | Flex alignment, `gap: 8px`, justify right | `td.actions-cell { display: flex; align-items: center; justify-content: flex-end; gap: 8px; }` |
| **Empty Table State** | Centered box, padding `48px 24px`, `#64748B` with `40x40px` Medical SVG | Centered box, padding `48px 24px`, `#94A3B8` with `40x40px` Medical SVG | `.table-empty-box { display: flex; flex-direction: column; align-items: center; gap: 12px; }` |

```css
/* Master Table CSS Architecture */
.master-table-wrapper {
  background: var(--color-surface-card);
  border: 1px solid var(--color-border-card);
  border-radius: var(--radius-xl);
  overflow: hidden;
  box-shadow: var(--shadow-card);
}

.master-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

.master-table th {
  height: 52px;
  padding: 0 20px;
  background: var(--color-surface-header);
  color: var(--color-text-secondary);
  font-size: 15.5px;
  font-weight: 700;
  letter-spacing: 0.5px;
  border-bottom: 2px solid var(--color-border-card);
}

.master-table td {
  height: 60px;
  padding: 12px 20px;
  font-size: 15px;
  color: var(--color-text-primary);
  border-bottom: 1px solid var(--color-border-card);
}

.master-table tbody tr:hover {
  background: var(--color-surface-hover);
}
```

---

### 2. Master Queue Badge & Clinical Identifier Display (`Q0001` & `HN0001`)

Every patient identifier must be visually distinct and rendered with fixed dimensions and dedicated styling:

#### A. Queue Status Badges (`Q0001`–`QFFFF`)
- **Dimensions:** Fixed width `130px`, Height `38px`, Border-radius `9999px` (Pill shape).
- **Typography:** `font-family: var(--font-mono)`, Font Size `14.5px`, Font Weight `700`.
- **Glowing Indicator Dot:** Circle `8px × 8px`, border-radius `50%`, with keyframe pulse animation (`animation: pulseDot 2s infinite`).

| Queue State | Light Mode Visual Spec | Dark Mode Visual Spec (Elevated Slate) | Dot Color & Animation |
| :--- | :--- | :--- | :--- |
| **Waiting (รอรับบริการ)** | `bg: #EFF6FF`, `border: 1px solid #BFDBFE`, `text: #2563EB` | `bg: rgba(37,99,235,0.15)`, `border: 1px solid #2563EB`, `text: #60A5FA` | `#2563EB` with Blue Glow Pulse |
| **In-Progress (กำลังตรวจ)** | `bg: #FFFBEB`, `border: 1px solid #FDE68A`, `text: #D97706` | `bg: rgba(217,119,6,0.15)`, `border: 1px solid #D97706`, `text: #FBBF24` | `#D97706` with Amber Glow Pulse |
| **Completed (เสร็จสิ้น)** | `bg: #ECFDF5`, `border: 1px solid #A7F3D0`, `text: #059669` | `bg: rgba(16,185,129,0.15)`, `border: 1px solid #10B981`, `text: #34D399` | `#10B981` with Green Static/Slow Pulse |
| **Cancelled (ยกเลิก)** | `bg: #FEF2F2`, `border: 1px solid #FECACA`, `text: #DC2626` | `bg: rgba(239,68,68,0.15)`, `border: 1px solid #EF4444`, `text: #F87171` | `#EF4444` Static Dot |

```css
/* Glowing Pulse Animation */
@keyframes pulseDot {
  0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.7); }
  70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(37, 99, 235, 0); }
  100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(37, 99, 235, 0); }
}

.queue-badge-pill {
  width: 130px;
  height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: var(--radius-full);
  font-family: var(--font-mono);
  font-size: 14.5px;
  font-weight: 700;
  box-sizing: border-box;
}

.queue-badge-pill .status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  animation: pulseDot 2s infinite ease-in-out;
}
```

#### B. Hospital Number (HN) Tag (`HN0001`–`HNFFFF`)
- **Format:** `HN` + 4-digit hexadecimal (`HN0001` through `HNFFFF`), no hyphen.
- **Visual Container:** Height `28px`, padding `3px 10px`, border-radius `6px`.
- **Light Mode:** `background: #EFF6FF`, `color: #1E40AF`, `border: 1px solid #BFDBFE`.
- **Dark Mode:** `background: rgba(37,99,235,0.15)`, `color: #93C5FD`, `border: 1px solid rgba(59,130,246,0.3)`.
- **Typography:** `font-family: var(--font-mono)`, Font Size `13.5px`, Font Weight `700`, `letter-spacing: 0.5px`.

---

### 3. Master National ID & Phone Number Standards

| Field Type | Input Mask Format | Modulo 11 & Validation Badges | Typography & Alignment |
| :--- | :--- | :--- | :--- |
| **Thai National ID** | `X-XXXX-XXXXX-XX-X` (13 digits with 4 hyphens) | • Valid: Badge `✓ ถูกต้อง` (`#10B981`, weight 700)<br>• Invalid: Badge `✕ ไม่ถูกต้อง` (`#EF4444`, weight 700) | `font-family: var(--font-mono)`, font size `15.5px`, height `48px`, `letter-spacing: 0.5px` |
| **Thai Phone Number** | Mobile: `0XX-XXX-XXXX` (10 digits)<br>Landline: `02-XXX-XXXX` (9 digits) | Auto-hyphenation on typing, stripped non-digits | `font-family: var(--font-primary)`, font size `15.5px`, height `48px` |

---

### 4. Master Ergonomic Spacing, Radius & Grid Gaps Scale

Workstation interfaces require precise mathematical spacing to eliminate visual clutter while maintaining high data density:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        LAYOUT CONTAINER & GAP SCALE SPECIFICATION                      │
├─────────────────────┬───────────────────┬──────────────────────────────────────────────┤
│ Layout Level        │ Exact Pixel Value │ Applied Locations                            │
├─────────────────────┼───────────────────┼──────────────────────────────────────────────┤
│ 1. Container Widths │ • 1600px          │ Screening & Vitals Workstation (/vitals)     │
│                     │ • 1440px          │ Registration (/registration), Rights (/elig) │
│                     │ • 1240px          │ Master Queue (/queue), History (/vitals-hist)│
├─────────────────────┼───────────────────┼──────────────────────────────────────────────┤
│ 2. Page Outer Pad   │ 24px 32px         │ Workspace wrapper padding (Desktop)          │
│                     │ 16px 20px         │ Workspace wrapper padding (Tablet / Compact) │
├─────────────────────┼───────────────────┼──────────────────────────────────────────────┤
│ 3. Form Step Gap    │ 30px              │ Vertical gap between Step 1, Step 2, Step 3  │
├─────────────────────┼───────────────────┼──────────────────────────────────────────────┤
│ 4. Section Head Gap │ 18px              │ Gap between section title and form inputs    │
├─────────────────────┼───────────────────┼──────────────────────────────────────────────┤
│ 5. Form Grid Gap    │ 16px × 16px       │ Row & Column gap inside input grids          │
├─────────────────────┼───────────────────┼──────────────────────────────────────────────┤
│ 6. Card Padding     │ 28px 36px         │ Main card internal body padding (Desktop)    │
│                     │ 20px 24px         │ Compact card internal padding (Sidebar/Table)│
├─────────────────────┼───────────────────┼──────────────────────────────────────────────┤
│ 7. Modal Padding    │ 24px 32px         │ Detail modal header and body padding         │
├─────────────────────┼───────────────────┼──────────────────────────────────────────────┤
│ 8. Button Bar Gap   │ 12px              │ Gap between Save, Cancel, Reset, Call buttons│
├─────────────────────┼───────────────────┼──────────────────────────────────────────────┤
│ 9. Border Radius    │ • 16px (radius-xl)│ Main Cards, Metric Widgets, Table Wrappers   │
│                     │ • 10px (radius-lg)│ Primary Action Buttons, Search Bars          │
│                     │ • 8px (radius-md) │ Input Fields, Select Dropdowns, Datepickers  │
│                     │ • 6px (radius-sm) │ Filter Chips, Sub-hospital Tags, HN Badges   │
│                     │ • 9999px (full)   │ Queue Status Pills, Avatar Circles, Triage   │
└─────────────────────┴───────────────────┴──────────────────────────────────────────────┘
```

---

### 5. Master Typography Hierarchy Scale (10-Tier Clinical Standard)

| Tier | UI Element / Component | Font Size | Font Weight | Line Height | Font Family | Example Usage |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Page Title** | `30px` | `700` (Bold) | `1.2` | `--font-heading` | "ระบบจัดการคิวผู้ป่วยส่วนกลาง" |
| **2** | **KPI Stat Big Number**| `34px` | `800` (ExtraBold) | `1.1` | `--font-heading` | `142 คิว`, `฿ 8,450.00` |
| **3** | **Card / Section Header**| `19px` | `700` (Bold) | `1.3` | `--font-heading` | "ข้อมูลสัญญาณชีพและดัชนีมวลกาย" |
| **4** | **Step Workflow Number**| `17px` | `700` (Bold) | `1.3` | `--font-primary` | "1. ข้อมูลผู้ป่วยและประวัติแพ้ยา" |
| **5** | **Primary CTA Button** | `16px` | `700` (Bold) | `1.0` | `--font-primary` | "บันทึกข้อมูลและส่งต่อห้องตรวจ" |
| **6** | **Interactive Input**  | `15.5px` | `500` / `600` | `1.4` | `--font-primary` | Height `48px`, padding `10px 14px` |
| **7** | **Master Table Header**| `15.5px` | `700` (Bold) | `1.3` | `--font-primary` | "หมายเลขคิว", "ชื่อ-นามสกุล" |
| **8** | **Form Field Label**   | `15.0px` | `600` (SemiBold) | `1.3` | `--font-primary` | "ความดันโลหิตตัวบน (Systolic)" |
| **9** | **Table Cell Data**    | `15.0px` | `500` (Medium) | `1.4` | `--font-primary` | "นายบุญค้ำ โยลัย (อายุ 24 ปี)" |
| **10**| **Clinical Badge / Pill**| `13.5px`–`14.5px`| `700` (Bold) | `1.0` | `--font-mono` / `--font-primary` | `Q0001`, `HN0001`, `Triage L2` |

---

### 6. Master Dual-Theming Color Mapping Token Reference

| Color Role | Light Mode Value | Dark Mode Value (Elevated Slate) | CSS Token Name |
| :--- | :--- | :--- | :--- |
| **Canvas Background** | `#F8FAFC` (Slate 50) | `#0F172A` / `#22272E` | `--color-bg-canvas` |
| **Surface Cards** | `#FFFFFF` (Pure White) | `#212836` (Elevated Slate) | `--color-surface-card` |
| **Topbar & Table Header**| `#F8FAFC` (Slate 50) | `#1C2230` (Deep Topbar Slate) | `--color-surface-header` |
| **Modal & Popovers** | `#FFFFFF` | `#2A3441` (High Elevation Slate) | `--color-surface-modal` |
| **Borders & Dividers** | `#E2E8F0` (Slate 200) | `#333F53` / `#2F3B4E` (Slate Border)| `--color-border-card` |
| **Primary Brand Blue** | `#2563EB` (`rgb(37,99,235)`)| `#3B82F6` (Electric Blue) | `--color-brand-primary` |
| **Brand Blue Hover** | `#1D4ED8` | `#60A5FA` | `--color-brand-primary-hover` |
| **Text Primary (High)** | `#0F172A` (Slate 900) | `#F8FAFC` (Slate 50) | `--color-text-primary` |
| **Text Secondary (Med)** | `#475569` (Slate 600) | `#94A3B8` (Slate 400) | `--color-text-secondary` |
| **Text Muted (Low)** | `#94A3B8` (Slate 400) | `#64748B` (Slate 500) | `--color-text-muted` |
| **Row Hover Surface** | `#F1F5F9` | `#2D3748` | `--color-surface-hover` |

---

## 0.4 Master Visual Component Blueprint & UI Layout Patterns (Extracted from Production Modules)

> **Visual Design Directive for All Future Prompts & Screens:** To maintain 100% aesthetic unity with the existing systems developed for the General Clinic Management System (Student ID: B6706265), every component, layout, card, table, and button MUST follow the exact visual anatomy detailed below:

### 1. Master 4-Column KPI Metric Cards Grid (`QueuePage.tsx` Layout)

The top section of overview dashboards and queue screens must feature a **4-Column Metric Grid** with individual category icon containers:

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [คิวทั้งหมดวันนี้]       [🏷️]  │ [กำลังรับบริการ / รอตรวจ] [⏰] │ [การเงิน & เภสัชกรรม]  [🧾]  │ [เสร็จสิ้นการบริการ]    [✓]  │
│ 19                          │ 16                          │ 0                            │ 1                            │
│ ลงทะเบียนในระบบทั้งหมด      │ คัดกรอง 14 • รอตรวจ 0...    │ รอชำระเงิน 0 • รอรับยา 0     │ รับบริการครบถ้วนเรียบร้อย    │
└─────────────────────────────┴─────────────────────────────┴──────────────────────────────┴──────────────────────────────┘
```

- **Grid Structure:** `display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px;`
- **Card Container:** `background: var(--color-surface-card); border-radius: 16px; padding: 22px 24px; border: 1px solid var(--color-border-card); box-shadow: var(--shadow-card);`
- **Active / Highlighted Card:** `border: 2px solid #2563EB; box-shadow: 0 0 0 1px #2563EB;`
- **Metric Title:** `font-size: 14.5px; font-weight: 600; color: var(--color-text-secondary); margin-bottom: 8px;`
- **Metric Big Number:** `font-size: 34px; font-weight: 800; font-family: var(--font-heading); color: var(--color-text-primary); line-height: 1.1;`
- **Metric Subtitle Breakdown:** `font-size: 13px; color: var(--color-text-muted); margin-top: 6px;`
- **Category Icon Container (Top-Right):**
  - Dimensions: `40px × 40px`, `border-radius: 10px`, `display: flex; align-items: center; justify-content: center;`
  - Blue Tint (Total Queue): `background: rgba(37, 99, 235, 0.1); color: #2563EB;`
  - Amber Tint (In-Progress/Waiting): `background: rgba(217, 119, 6, 0.1); color: #D97706;`
  - Green Tint (Completed/Financial): `background: rgba(16, 185, 129, 0.1); color: #059669;`

---

### 2. Smart Search & Multi-Row Filter Chips Bar (`ScreeningHistoryPage.tsx`, `QueuePage.tsx`)

A unified search and filtering toolbar providing multi-dimensional triage and clinical risk filtering:

- **Search Bar Input:**
  - Height: `46px`, `border-radius: 10px`, `background: var(--color-surface-card)`, `border: 1px solid var(--color-border-card)`.
  - Icon: Left-aligned Search SVG (`18x18px`, `color: #94A3B8`).
  - Search CTA Button: Solid Blue `#2563EB` button on right with text `ค้นหา (Search)`.
- **Multi-Row Filter Chip Groups:**
  - **Group Row Layout:** `display: flex; align-items: center; gap: 10px; margin-top: 12px;`
  - **Group Label:** `font-size: 13.5px; font-weight: 700; color: var(--color-text-secondary); min-width: 140px;`
  - **Active Filter Chip:** `background: #0F172A; color: #FFFFFF; font-weight: 700; border-radius: 8px; padding: 6px 14px; font-size: 13px;` (Dark Mode: `background: #2563EB; color: #FFFFFF;`)
  - **Inactive Filter Chip:** `background: var(--color-surface-header); color: var(--color-text-secondary); border: 1px solid var(--color-border-card); border-radius: 8px; padding: 6px 14px; font-size: 13px; cursor: pointer; transition: all 0.15s ease;`
  - **Counter Badges inside Chips:** Blue pill for total `คิวทั้งหมด 19`, Red dot pill for cancelled `ยกเลิกคิว 2`.

---

### 3. Master 2-Line Table Cell Typography & Layout (`QueuePage.tsx`, `EligibilityPage.tsx`, `ScreeningHistoryPage.tsx`)

Every table row provides rich, structured clinical data across clean primary and secondary hierarchy lines:

| Column Target | Line 1: Primary Data (Bold) | Line 2: Secondary Metadata (Muted) | CSS Typography Rules |
| :--- | :--- | :--- | :--- |
| **Queue Column** | `Q0001`, `Q0002`... | — | `color: #2563EB; font-family: var(--font-mono); font-size: 15.5px; font-weight: 700;` |
| **Patient Name** | `นาย รักดี สีสมจิตร` | `1-1002-00123-45-6 • เวลา 21:03 น.` | Line 1: `font-size: 15px; font-weight: 700; color: var(--color-text-primary);`<br>Line 2: `font-size: 13px; font-family: var(--font-mono); color: var(--color-text-muted); margin-top: 3px;` |
| **Service Point**| `ห้องจ่ายยาและการเงิน` | `ผู้ป่วยขอยกเลิกคิว / ไม่มารับบริการ` | Line 1: `font-size: 14.5px; font-weight: 600; color: var(--color-text-primary);`<br>Line 2: `font-size: 12.5px; color: var(--color-text-muted); margin-top: 2px;` |
| **Vital Signs BP**| Systolic: `120 mmHg` (Green Pill)<br>Diastolic: `80 mmHg` (Green Pill) | Elevated BP: `148 mmHg` (Amber Pill)<br>Crisis BP: `180 mmHg` (Red Pill) | BP Pills: `padding: 4px 10px; border-radius: 6px; font-weight: 700; font-family: var(--font-mono); font-size: 13.5px;` |
| **Triage / Urgency**| `ปกติ` (Soft Green Pill) | `กึ่งฉุกเฉิน` (Soft Amber Pill)<br>`ฉุกเฉินวิกฤต` (Soft Red Pill) | Triage Pills: `padding: 4px 12px; border-radius: 6px; font-weight: 700; font-size: 13.5px;` |

---

### 4. Master Action Column Button Pairs (`QueuePage.tsx`, `EligibilityPage.tsx`, `ScreeningHistoryPage.tsx`)

Every table row includes streamlined, high-contrast action controls:

#### Pattern A: Queue Actions Pair (`QueuePage.tsx`)
1. **Audio Call Queue Button (`🔊 เรียกคิว`):**
   - Dimensions: Height `36px`, Padding `0 14px`, Border-radius `8px`.
   - Styling: `background: #EFF6FF; color: #2563EB; border: 1px solid #BFDBFE; font-weight: 700; font-size: 13px;` (Dark: `background: rgba(37,99,235,0.15); color: #60A5FA; border-color: rgba(37,99,235,0.4);`)
   - Icon: Speaker SVG (`15x15px`).
2. **Edit Status Button (`✏️ แก้ไขสถานะ`):**
   - Dimensions: Height `36px`, Padding `0 14px`, Border-radius `8px`.
   - Styling: `background: #2563EB; color: #FFFFFF; border: none; font-weight: 700; font-size: 13px;`
   - Icon: Edit Pencil SVG (`14x14px`).

#### Pattern B: Detail Modal View Button (`EligibilityPage.tsx`, `ScreeningHistoryPage.tsx`)
- **View Details Button (`👁️ รายละเอียด` / `ดูรายละเอียด`):**
  - Dimensions: Height `34px`, Padding `0 16px`, Border-radius `9999px` (Pill Shape).
  - Styling: `background: var(--color-surface-header); color: var(--color-text-secondary); border: 1px solid var(--color-border-card); font-weight: 600; font-size: 13px;`
  - Icon: Eye SVG (`14x14px`).

---

### 5. Patient Eligibility Verification Result Card (`EligibilityPage.tsx`)

When displaying insurance coverage verification details, use the structured **Verification Metadata Card**:

- **Status Banner Bar:** Green checkmark card with title `พบสิทธิการรักษาพยาบาล`, subtitle `สิทธิการรักษาพร้อมใช้งานสำหรับรับบริการ`, and right-aligned badge `สถานะ: ใช้งานได้` (`bg: #ECFDF5; color: #059669; border-radius: 6px; padding: 4px 10px; font-weight: 700;`).
- **2-Column Metadata Grid:**
  - `ชื่อ-นามสกุล คนไข้:` **นายสมหมี** (`16px`, weight `700`)
  - `เลขบัตรประชาชน:` `0-1234-56789-12-3` (`var(--font-mono)`, weight `600`)
  - `ประเภทสิทธิการรักษา:` Badge pill `บัตรทอง (สปสช.)` (`bg: #FEF3C7; color: #D97706; font-weight: 700;`)
  - `สถานพยาบาลหลัก / สาขา:` **โรงพยาบาลคลินิกเวชกรรมชุมชน**
  - `รายละเอียดความคุ้มครอง:` ครอบคลุมการรักษาโรคทั่วไป ยกเว้นค่ายานอกบัญชีและบริการพิเศษ
  - `วัน-เวลาที่ตรวจสอบ:` `27/08/2569 18:31 น.` | `วันหมดอายุสิทธิ:` `31/12/2026`
- **Bottom Action Buttons Bar:**
  - Primary Confirm CTA: `ยืนยันและบันทึกสิทธิ์ (Confirm & Save)` (Green `#10B981` / `#059669` button, Height `48px`, SVG Checkmark, Weight `700`).
  - Cancel Button: `ยกเลิก (Cancel)` (Neutral Slate `#475569`, Height `48px`, Weight `600`).

---

### 6. Standard Table Pagination Bar Component

All master tables must include the standard pagination bar at the bottom:
- **Left Info Text:** `แสดง 1 ถึง 3 จาก 3 รายการ` (`font-size: 13.5px; color: var(--color-text-muted);`)
- **Right Page Controls:**
  - `ย้อนกลับ (Previous)`: Text button, disabled when on page 1.
  - Active Page Pill `[1]`: `background: #2563EB; color: #FFFFFF; border-radius: 6px; width: 32px; height: 32px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center;`
  - `ถัดไป (Next)`: Text button.

---

## 1. Theme Switching Mechanism

The system manages Light / Dark mode switching via the `dark-mode` class on the `<body>` element combined with the `data-theme` attribute on the root element:

```html
<!-- Light Mode -->
<body class="light-mode" data-theme="light">
  <div id="root">...</div>
</body>

<!-- Dark Mode (Elevated Dark Slate) -->
<body class="dark-mode" data-theme="dark">
  <div id="root">...</div>
</body>
```

- **Persistence:** Save settings via `localStorage.getItem('clinic_theme')`.
- **System Preference Fallback:** Detect `window.matchMedia('(prefers-color-scheme: dark)')` on initial launch.

---

## 2. Color Tokens & Design Palettes

### 2.1 Primary Brand Blue & Accents

| Token | Light Mode | Dark Mode | Usage |
| :--- | :--- | :--- | :--- |
| `--color-brand-primary` | `#2563EB` (`rgb(37,99,235)`) | `#3B82F6` | Primary action buttons, active tabs, active borders, focus rings |
| `--color-brand-primary-hover` | `#1D4ED8` | `#60A5FA` | Primary button hover / active states |
| `--color-brand-on-primary` | `#FFFFFF` | `#FFFFFF` | Text and icons on primary background |
| `--color-brand-secondary` | `#0284C7` (Sky) | `#38BDF8` | Secondary buttons, auxiliary info, visual accents |
| `--color-brand-secondary-hover`| `#0369A1` | `#7DD3FC` | Secondary button hover states |
| `--color-brand-subtle-bg` | `#EFF6FF` | `rgba(37,99,235,0.15)` | Highlight banner backgrounds, blue badge tags |

### 2.2 Elevated Dark Slate Surface Palette

To prevent ocular fatigue for healthcare staff in low-light clinical environments, the system utilizes the **Elevated Dark Slate Palette** instead of pure `#000000`:

| Token | Light Mode | Dark Mode (Elevated Slate) | Usage |
| :--- | :--- | :--- | :--- |
| `--color-bg-base` | `#F8FAFC` (Slate 50) | `#0F172A` / `#22272E` | Application canvas & page layout background |
| `--color-bg-surface` | `#FFFFFF` | `#212836` | Surface cards, form containers, table rows |
| `--color-bg-header` | `#FFFFFF` | `#1C2230` | Card headers, topbar, sidebar background |
| `--color-bg-elevated` | `#FFFFFF` | `#2A3441` | Modal dialogs, popovers, dropdown menus |
| `--color-bg-subtle` | `#F1F5F9` (Slate 100) | `#2D3748` | Table row hover, input element background |

### 2.3 Text & Typography Colors

| Token | Light Mode | Dark Mode | Usage |
| :--- | :--- | :--- | :--- |
| `--color-text-primary` | `#0F172A` (Slate 900) | `#F8FAFC` (Slate 50) | Main headings, critical patient info, test results |
| `--color-text-secondary` | `#334155` (Slate 700) | `#CBD5E1` (Slate 300) | Body text, form field labels |
| `--color-text-tertiary` | `#64748B` (Slate 500) | `#94A3B8` (Slate 400) | Placeholders, subtitles, measurement units, timestamps |
| `--color-text-disabled` | `#94A3B8` | `#64748B` | Disabled text or inactive elements |

### 2.4 Borders & Dividers

| Token | Light Mode | Dark Mode | Usage |
| :--- | :--- | :--- | :--- |
| `--color-border-default` | `#E2E8F0` (Slate 200) | `#333F53` / `#2F3B4E` | Section dividers, card borders, standard input borders |
| `--color-border-strong` | `#CBD5E1` (Slate 300) | `#475569` | Table borders, secondary button outlines |
| `--color-border-focus` | `#2563EB` | `#3B82F6` | Active / focused input and control borders |

### 2.5 Clinical Status & Triage Tokens

| Status Level | Solid Light | Tint Bg Light | Solid Dark | Tint Bg Dark | Clinical Meaning |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Normal / Success** | `#10B981` | `#ECFDF5` | `#34D399` | `#064E3B` | Normal vitals, completed queue, valid eligibility |
| **Warning / Elevated** | `#F59E0B` | `#FFFBEB` | `#FBBF24` | `#451A03` | Low-grade fever, elevated BP, in-progress queue |
| **Danger / Crisis** | `#EF4444` | `#FEF2F2` | `#F87171` | `#450A0A` | High fever, crisis BP, severe drug allergy alert |
| **Info / Waiting** | `#2563EB` | `#EFF6FF` | `#60A5FA` | `#172554` | Waiting for screening/doctor, system notifications |

### 2.6 User Role Palette

```css
--color-role-registrar:       #2563EB; /* Registration (Blue) */
--color-role-nurse:           #10B981; /* Nurse (Emerald) */
--color-role-nurse-assistant: #0D9488; /* Nurse Assistant (Teal) */
--color-role-doctor:          #DC2626; /* Doctor (Red) */
--color-role-pharmacist:      #8B5CF6; /* Pharmacist (Purple) */
--color-role-cashier:         #F59E0B; /* Cashier (Amber) */
```

---

## 3. High-Legibility Clinical Typography System

The typography system is engineered for **seamless bilingual support (Thai & English)** with high contrast, open letterforms, and excellent visual legibility for high-traffic clinical usage.

### 3.1 Font Pairing Stack

```css
:root {
  /* 1. Primary Font (Body & Forms): Highly legible with open Thai vowels and clear metrics */
  --font-primary: 'IBM Plex Sans Thai', 'Plus Jakarta Sans', 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;

  /* 2. Heading Font (Titles & Action Elements): Modern, bold, confident */
  --font-heading: 'Plus Jakarta Sans', 'Prompt', 'Kanit', sans-serif;

  /* 3. Monospace Font (Identifiers & Codes): For HN, National ID, Queue No, Blood Pressure */
  --font-mono: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
}
```

### 3.2 Accessible Type Scale Standards

| Role / Element | Size | Weight | Font Family | Example Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Page Main Titles** | `28px` – `30px` | `700` / `800` | `--font-heading` | Main page titles (e.g., "Queue Management", "Screening History") |
| **Page Subtitles** | `15px` | `400` / `500` | `--font-primary` | Subtitles below page titles (`#64748B`) |
| **KPI Stat Numbers** | `32px` – `34px` | `800` | `--font-heading` | Summary metric numbers in top stat cards |
| **KPI Stat Labels** | `15px` | `600` | `--font-heading` | Metric labels (e.g., "Waiting Screening", "In Consultation") |
| **Card / Accordion Titles** | `19px` | `600` / `700` | `--font-heading` | Form card headers, table card headers |
| **Form Section Steps** | `17px` | `700` | `--font-heading` | Numbered section headers (1, 2, 3) |
| **Form Labels** | `15px` | `600` | `--font-primary` | Input field labels (`#334155`) |
| **Form Inputs & Selects** | `15.5px` (Height `48px`) | `500` | `--font-primary` | Inputs, selects, textareas |
| **Primary Action Buttons** | `15.5px` – `16.5px` (Height `50px`) | `700` | `--font-heading` | "Save Vitals", "Register Patient", "Verify Eligibility" |
| **Table Column Headers (`th`)** | `15.5px` | `600` | `--font-heading` | All table column headers (padding `14px 18px`) |
| **Table Primary Cells (`td`)** | `15.5px` – `16px` | `600` / `700` | `--font-primary` / `--font-heading` | Patient full names, Queue numbers (`Q0001`), HN |
| **Status Pills & Badges** | `13.5px` – `14.5px` | `600` / `700` | `--font-heading` | Queue status pills (`130px` x `38px`), Triage badges (`126px`) |
| **Input Unit Suffixes** | `14px` | `600` | `--font-primary` | Vitals suffix labels (`kg`, `cm`, `°C`, `mmHg`, `bpm`, `%`) |

---

## 4. Module Layout Architecture & Container Standards

To prevent cramped or cluttered views across clinical workstations, adhere to these container widths:

### 4.1 Module Max-Width Standards

```css
/* 1. Screening & Vitals Module */
.vitals-page-container {
  max-width: 1600px; /* Spacious width to accommodate 3-column inputs + live widgets */
  margin: 0 auto;
  padding: 10px 0 40px;
}

/* 2. Registration & Eligibility Verification Modules */
.registration-container,
.eligibility-container {
  max-width: 1440px;
  margin: 0 auto;
  padding: 10px 0 40px;
}

/* 3. Queue Management & Screening History Modules */
.queue-page,
.screening-history-container {
  max-width: 1240px; /* Focused, optimal width for full-width data tables */
  margin: 0 auto;
  padding: 10px 0 40px;
}
```

### 4.2 2-Column Workstation Grid Layout

```css
.vitals-main-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px; /* Left: Primary form (>1,150px), Right: Live BMI & Triage (360px) */
  gap: 24px;
  align-items: start;
  width: 100%;
}

@media (max-width: 1180px) {
  .vitals-main-grid {
    grid-template-columns: 1fr; /* Responsive single-column stacking */
  }
}
```

---

## 5. Form Ergonomics & Spacing Standards

For effortless reading and reduced input error rates:

1. **Form Step Spacing:**
   - `.vitals-form { gap: 30px; }` — Clear separation between Step 1, Step 2, and Step 3.
   - `.vitals-form-section { gap: 18px; }` — Comfortable spacing between section headers and field grids.
   - `.vitals-section-header { padding-bottom: 10px; border-bottom: 1px solid #F1F5F9; }`
2. **3-Column Vitals Input Grid:**
   ```css
   .vitals-grid-3 {
     display: grid;
     grid-template-columns: repeat(3, 1fr);
     gap: 16px;
   }
   ```
3. **Card Body Padding:**
   - `.vitals-card-body.expanded { padding: 28px 36px 36px; }` — Generous internal breathing room around forms.

---

## 6. Polished UI Patterns

### 6.1 Minimalist Transparent Patient Summary Strip
When a patient queue is selected, display summary details inline **without bulky background boxes or heavy borders**:

```css
.patient-compact-strip,
.vitals-patient-compact-banner {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
  padding: 6px 2px 2px;
  margin-top: 4px;
  margin-bottom: 2px;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  flex-wrap: wrap;
}

.patient-compact-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 15px;
}

.patient-compact-badge {
  padding: 3px 10px;
  background: #2563EB;
  color: #FFFFFF;
  border-radius: 6px;
  font-weight: 700;
  font-size: 13.5px;
  font-family: var(--font-heading);
}

.patient-compact-name {
  font-weight: 700;
  color: #0F172A;
  font-size: 16px;
}

.patient-compact-divider {
  color: #CBD5E1;
  font-size: 13px;
  user-select: none;
}

.patient-compact-scheme {
  padding: 2px 10px;
  background: #ECFDF5;
  color: #059669;
  border: 1px solid #A7F3D0;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
}
```

### 6.2 Modal Status Dropdown Categorization (`<optgroup>`)
When status options are numerous, group them using `<optgroup>` with bold primary blue category labels to avoid visual clutter:

```html
<select className="status-modal-select" value={selectedStatus} onChange={...}>
  <optgroup label="จุดคัดกรอง & ตรวจรักษา">
    <option value="รอคัดกรอง">รอคัดกรอง (ห้องคัดกรอง)</option>
    <option value="กำลังคัดกรอง">กำลังคัดกรอง (ห้องคัดกรอง)</option>
    <option value="รอตรวจ">รอตรวจ (ห้องตรวจแพทย์ 1)</option>
    <option value="กำลังตรวจ">กำลังตรวจ (ห้องตรวจแพทย์ 1)</option>
  </optgroup>
  <optgroup label="การเงิน & เภสัชกรรม">
    <option value="รอชำระเงิน">รอชำระเงิน (ห้องการเงิน)</option>
    <option value="รอรับยา">รอรับยา (ห้องจ่ายยา)</option>
  </optgroup>
  <optgroup label="สิ้นสุดกระบวนการ & ยกเลิก">
    <option value="เสร็จสิ้น">เสร็จสิ้น (สิ้นสุดกระบวนการ)</option>
    <option value="ยกเลิก">ยกเลิก (ยกเลิกคิว)</option>
  </optgroup>
</select>
```

```css
.status-modal-select optgroup {
  font-weight: 700;
  color: #2563EB;
  background: #F1F5F9;
  padding: 6px 4px;
}

.status-modal-select option {
  font-weight: 500;
  color: #0F172A;
  background: #FFFFFF;
  padding: 8px 12px;
}
```

### 6.3 BMI Vertical Hero Stack Pattern
To prevent badge overflow, structure the BMI display vertically: large value on top, status badge below:

```tsx
<div className="bmi-hero-display">
  <div className="bmi-big-value">
    <span className="bmi-num">{bmiValue}</span>
    <span className="bmi-unit">kg/m²</span>
  </div>
  <div className={`bmi-status-pill ${statusClass}`}>
    <span className="bmi-status-dot" />
    <span>{statusLabel}</span>
  </div>
</div>
```

```css
.bmi-hero-display {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.bmi-num {
  font-size: 34px;
  font-weight: 800;
  color: #0F172A;
  line-height: 1;
}

.bmi-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 13.5px;
  font-weight: 700;
  width: fit-content;
}
```

### 6.4 Single-Row Table Controls & Filter Toolbar
Search inputs and filter pills must be arranged in a single row without premature line wrapping:

```css
.queue-table-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.search-bar-wrap {
  flex: 0 1 360px;
  min-width: 240px;
}

.status-filter-pills {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.filter-pill {
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 13.5px;
  font-weight: 600;
}
```

---

## 7. Medical SVG Icon Standards

- **Strict Zero Raw Emojis**: Always use Inline SVG or React SVG Components.
- **SVG Specifications:**
  - `viewBox="0 0 24 24"` (or `0 0 20 20`)
  - `stroke="currentColor"`, `stroke-width="2"` (or `1.75`), `fill="none"`
  - `stroke-linecap="round"`, `stroke-linejoin="round"`
- **Standard Dimensions:**
  - Compact action buttons: `14px` x `14px` or `16px` x `16px`
  - Form inputs / navigation menu items: `18px` x `18px` or `20px` x `20px`
  - Card & header icon boxes: `22px` x `22px` or `24px` x `24px`

---

## 8. Clinical Identifier & Code Formatting System

To maintain architectural precision and ensure database scalability, clinical identifiers must use the **Fixed 4-Digit Hexadecimal System (`0-9, A-F`)**:

### 8.1 Queue Number Format (`Q` + 4-Digit Hexadecimal)
- **Structure:** `Q` followed by 4 uppercase hexadecimal characters (`Q0001` through `QFFFF`).
- **Sequence Progression:**
  - `Q0001` $\rightarrow$ `Q0002` $\rightarrow$ ... $\rightarrow$ `Q0009` $\rightarrow$ `Q000A` $\rightarrow$ `Q000B` $\rightarrow$ `Q000C` $\rightarrow$ `Q000D` $\rightarrow$ `Q000E` $\rightarrow$ `Q000F` $\rightarrow$ `Q0010` $\rightarrow$ ... $\rightarrow$ `QFFFF` (supports up to 65,535 queues/day).
- **TypeScript Helper Function:**
  ```ts
  export const formatQueueNo = (seq: number | string): string => {
    if (typeof seq === 'string' && /^Q[0-9A-Fa-f]{4}$/i.test(seq)) {
      return seq.toUpperCase();
    }
    const num = parseInt(String(seq).replace(/\D/g, ''), 10);
    if (!isNaN(num) && num > 0) {
      return 'Q' + num.toString(16).toUpperCase().padStart(4, '0');
    }
    return 'Q0001';
  };
  ```

### 8.2 Hospital Number Format (`HN` + 4-Digit Hexadecimal)
- **Structure:** `HN` followed by 4 uppercase hexadecimal characters (`HN0001` through `HNFFFF`) with no hyphen separator.
- **Sequence Progression:**
  - `HN0001` $\rightarrow$ `HN0002` $\rightarrow$ ... $\rightarrow$ `HN0009` $\rightarrow$ `HN000A` $\rightarrow$ `HN000B` $\rightarrow$ `HN000C` $\rightarrow$ `HN000D` $\rightarrow$ `HN000E` $\rightarrow$ `HN000F` $\rightarrow$ `HN0010` $\rightarrow$ ... $\rightarrow$ `HNFFFF`
- **TypeScript Helper Function:**
  ```ts
  export const formatHN = (seq: number | string): string => {
    if (typeof seq === 'string' && /^HN[0-9A-Fa-f]{4}$/i.test(seq)) {
      return seq.toUpperCase();
    }
    const num = parseInt(String(seq).replace(/\D/g, ''), 10);
    if (!isNaN(num) && num > 0) {
      return 'HN' + num.toString(16).toUpperCase().padStart(4, '0');
    }
    return 'HN0001';
  };
  ```

### 8.3 Thai National ID Masking & Modulo 11 Validation
- **Display Mask:** `X-XXXX-XXXXX-XX-X` (13 digits grouped with hyphens, e.g. `1-1002-00345-67-8`).
- **Typography Rule:** Always render using `--font-mono` with `letter-spacing: 0.5px` and `font-variant-numeric: tabular-nums` to ensure exact column alignment.
- **TypeScript Formatting & Validation Helper:**
  ```ts
  export const formatNationalId = (val: string): string => {
    const digits = val.replace(/\D/g, '').slice(0, 13);
    if (digits.length <= 1) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 1)}-${digits.slice(1)}`;
    if (digits.length <= 10) return `${digits.slice(0, 1)}-${digits.slice(1, 5)}-${digits.slice(5)}`;
    if (digits.length <= 12) return `${digits.slice(0, 1)}-${digits.slice(1, 5)}-${digits.slice(5, 10)}-${digits.slice(10)}`;
    return `${digits.slice(0, 1)}-${digits.slice(1, 5)}-${digits.slice(5, 10)}-${digits.slice(10, 12)}-${digits.slice(12, 13)}`;
  };

  export const validateThaiNationalId = (id: string): boolean => {
    const cleanId = id.replace(/\D/g, '');
    if (cleanId.length !== 13) return false;
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(cleanId.charAt(i), 10) * (13 - i);
    }
    const checkDigit = (11 - (sum % 11)) % 10;
    return checkDigit === parseInt(cleanId.charAt(12), 10);
  };
  ```

### 8.4 Thai Phone Number Auto-Hyphenation
- **Mobile Format (10 digits):** `0XX-XXX-XXXX` (e.g. `081-234-5678`).
- **Landline Format (9 digits):** `02-XXX-XXXX` or `0X-XXX-XXXX`.
- **TypeScript Formatting Helper:**
  ```ts
  export const formatPhoneNumber = (val: string): string => {
    const digits = val.replace(/\D/g, '').slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };
  ```

### 8.5 Clinical Vitals & Physical Measurements Formatting
All vital signs must be displayed with explicit physical unit suffixes and formatted to standard medical precision (no raw floating numbers):

| Clinical Parameter | Standard Precision | Unit Suffix | Target Value Range | Example Render | Typography |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Body Temperature** | `1 decimal place` | `°C` | `35.5 – 37.5` | `36.8 °C` | `--font-primary`, weight `700` |
| **Blood Pressure** | `Integer / Integer` | `mmHg` | `90–120 / 60–80` | `120/80 mmHg` | `--font-mono`, weight `700` |
| **Heart Rate / Pulse** | `Integer` | `bpm` | `60 – 100` | `76 bpm` | `--font-primary`, weight `700` |
| **Respiratory Rate** | `Integer` | `/min` | `12 – 20` | `16 /min` | `--font-primary`, weight `700` |
| **Oxygen Saturation** | `Integer` | `%` | `95 – 100` | `98 %` | `--font-primary`, weight `700` |
| **Body Weight** | `1 decimal place` | `kg` | `—` | `65.5 kg` | `--font-primary`, weight `700` |
| **Body Height** | `1 decimal place` | `cm` | `—` | `172.0 cm` | `--font-primary`, weight `700` |
| **BMI Index** | `2 decimal places` | `kg/m²` | `18.5 – 22.9` (Asian) | `22.14 kg/m²` | `--font-heading`, weight `700` |

### 8.6 Thai Buddhist Era (`พ.ศ.`) & Clinical Timestamp Standards
- **Short Clinical Date:** `DD/MM/YYYY` (Thai Buddhist Year, e.g. `27/08/2569` or CE `27/08/2026`).
- **Long Clinical Date:** `DD MMMM YYYY` in Thai (e.g. `27 สิงหาคม 2569`).
- **24-Hour Time Format:** `HH:mm น.` with leading zero (e.g. `09:15 น.`, `14:30 น.`).
- **TypeScript Date/Time Formatting Helper:**
  ```ts
  export const formatThaiDate = (dateStr: string | Date): string => {
    const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    if (isNaN(d.getTime())) return '-';
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const yearBE = d.getFullYear() + 543;
    return `${day}/${month}/${yearBE}`;
  };

  export const formatThaiTime = (dateStr: string | Date): string => {
    const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    if (isNaN(d.getTime())) return '-';
    const hours = d.getHours().toString().padStart(2, '0');
    const mins = d.getMinutes().toString().padStart(2, '0');
    return `${hours}:${mins} น.`;
  };
  ```

### 8.7 Thai Baht Currency & Financial Precision
- **Display Prefix:** `฿` followed by space.
- **Thousand Separator:** Comma separated with optional 2 decimal places for financial receipts: `฿ 1,175.00` or integer badge `฿ 800`.
- **TypeScript Helper:**
  ```ts
  export const formatCurrency = (amount: number, includeDecimals = true): string => {
    return '฿ ' + amount.toLocaleString('th-TH', {
      minimumFractionDigits: includeDecimals ? 2 : 0,
      maximumFractionDigits: 2,
    });
  };
  ```

### 8.8 Monospace Font Enforcement Rule (`--font-mono`)
To prevent visual layout jitter and guarantee that numerical data aligns cleanly in master tables, search dropdowns, and KPI widgets, the following elements **MUST** apply `--font-mono` (`font-family: var(--font-mono)`):
1. **Hospital Numbers (HN):** e.g. `HN0001`
2. **Queue Numbers:** e.g. `Q0001`
3. **National ID Numbers:** e.g. `1-1002-00345-67-8`
4. **Blood Pressure Readings:** e.g. `120/80`
5. **Visit Timestamps & Stopwatches:** e.g. `10:15:30 น.`
6. **Financial Figures / Invoice Totals:** e.g. `฿ 8,450.00`

### 8.9 Mandatory Hexadecimal 4-Digit Clinical Identifier Conversion Rules (Mock Data & UI Standardization)
> **Mandatory Data Standard:** All legacy identifiers across mock data fixtures, database seeds, configuration files, and UI displays MUST be converted and normalized to the canonical Hexadecimal 4-digit format:

#### 1. Queue Number Canonical Rules
- **Prefix:** `Q` (Uppercase only).
- **Format:** `Q` + 4-digit hexadecimal zero-padded (`Q0001` through `QFFFF`).
- **Legacy Conversion Mapping:**
  - `'001'`, `'01'`, `'1'`, `'Q01'`, `'Q-001'`, `'Q1'` $\rightarrow$ **`Q0001`**
  - `'002'`, `'2'`, `'Q02'` $\rightarrow$ **`Q0002`**
  - `'009'`, `'9'` $\rightarrow$ **`Q0009`**
  - `'010'`, `'10'` $\rightarrow$ **`Q000A`**
  - `'015'`, `'15'` $\rightarrow$ **`Q000F`**
  - `'016'`, `'16'` $\rightarrow$ **`Q0010`**
- **Strict Prohibition:** Never display 3-digit queues (e.g. `Q001`), integer queues without prefix (e.g. `1`), or hyphenated queues (e.g. `Q-001`).

#### 2. Hospital Number (HN) Canonical Rules
- **Prefix:** `HN` (Uppercase only).
- **Separator:** **NO HYPHEN** under any circumstance.
- **Format:** `HN` + 4-digit hexadecimal zero-padded (`HN0001` through `HNFFFF`).
- **Legacy Conversion Mapping:**
  - `'HN-2023-045'`, `'HN-001'`, `'10234'`, `'HN49201'` $\rightarrow$ **`HN0001`**
  - `'HN-2023-112'`, `'HN-002'` $\rightarrow$ **`HN0002`**
  - `'HN-2024-018'`, `'HN-003'` $\rightarrow$ **`HN0003`**
  - `'HN-2022-884'`, `'HN-004'` $\rightarrow$ **`HN0004`**
  - `'HN-2024-105'`, `'HN-005'` $\rightarrow$ **`HN0005`**
  - `'HN-2023-309'`, `'HN-006'` $\rightarrow$ **`HN0006`**
  - `'HN-2023-512'`, `'HN-007'` $\rightarrow$ **`HN0007`**
  - `'HN-2023-640'`, `'HN-008'` $\rightarrow$ **`HN0008`**
  - `'HN-2023-789'`, `'HN-009'` $\rightarrow$ **`HN0009`**
- **Strict Prohibition:** Never use hyphenated years (e.g. `HN-2023-045`), 5-digit raw numbers (e.g. `10234`), or lowercase prefixes (`hn0001`).

#### 3. Automatic Normalization & Display Guarantee
Every component rendering HN or Queue Number must pass the identifier through `formatHN()` and `formatQueueNo()` from `@utils/formatters` or `@utils/vnGenerator` before displaying in tables, badges, summary strips, or voice announcements:
```tsx
import { formatHN, formatQueueNo } from '../../utils/formatters';

// Rendering Queue Badge:
<span className="patient-compact-badge">{formatQueueNo(patient.queueNumber || patient.queueNo)}</span>

// Rendering Hospital Number:
<span className="patient-compact-hn">HN: {formatHN(patient.hn || patient.id)}</span>
```

---

## 9. Spacing, Radius & Shadows Scale

```css
/* Spacing Scale (4px Base Grid) */
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-7: 30px;
--space-8: 48px;

/* Border Radius Scale */
--radius-xs:   4px;    /* Micro status badges */
--radius-sm:   6px;    /* Filter chips, small buttons */
--radius-md:   8px;    /* Input fields, select controls */
--radius-lg:   10px;   /* Primary action buttons, search bars */
--radius-xl:   16px;   /* Main cards, dashboard widgets */
--radius-full: 9999px; /* Avatars, status dots, pills */

/* Elevation & Shadows */
/* Light Mode */
body[data-theme="light"] {
  --shadow-card: 0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02);
  --shadow-modal: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
}

/* Dark Mode */
body[data-theme="dark"],
body.dark-mode {
  --shadow-card: 0 0 0 1px #333F53, 0 4px 12px rgba(0, 0, 0, 0.35);
  --shadow-modal: 0 0 0 1px #475569, 0 20px 25px -5px rgba(0, 0, 0, 0.5);
}
```

---

## 10. Pre-Delivery Checklist for Team Members

- [ ] **Zero Emojis:** Verified zero unicode emojis in UI code; all icons use standard medical SVGs.
- [ ] **Accessible Type Scale:** Page title `30px`, KPI stats `34px`, card title `19px`, section steps `17px`, labels `15px`, inputs `15.5px` (height `48px`), buttons `16px` (height `50px`).
- [ ] **Container Max-Width:** Configured correct `max-width` (`1600px` for Vitals, `1240px` for Queue/History, `1440px` for Reg/Eligibility).
- [ ] **Form Ergonomics:** Form step gap `30px`, section gap `18px`, card body padding `28px 36px`.
- [ ] **Clean Summary Strip:** Selected patient summary uses transparent styling (`background: transparent !important; border: none;`).
- [ ] **Dropdown Optgroups:** Status selection dropdowns with multiple options use grouped `<optgroup>` elements.
- [ ] **Hex 4-Digit Formatting:** Queue numbers follow `Q0001`–`QFFFF` and Hospital Numbers follow `HN0001`–`HNFFFF`.
- [ ] **Theme Parity:** Verified 100% aesthetic and contrast parity across both Light Mode and Dark Mode (Elevated Dark Slate).
- [ ] **WCAG AA Contrast:** Foreground text contrast relative to background meets WCAG AA (≥ 4.5:1).
- [ ] **Teammate Isolation:** No modification or deletion of files in teammate modules (`pages/doctor/`, `pages/pharmacy/`, `pages/billing/`).
- [ ] **Self-Contained Simulation:** All pages run stand-alone with built-in in-memory state and mock data.

---
*Authored for the General Clinic Management System (Team T08)*