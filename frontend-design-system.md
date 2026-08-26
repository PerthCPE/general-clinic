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