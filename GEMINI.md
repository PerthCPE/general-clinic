# Project Guidelines & Rules

## 1. UI Icon & Typography Guidelines (Strict Prohibition of Raw Emojis)
- **Zero Raw Emojis in UI**: Never use raw unicode emojis (e.g. ⚡, ✨, 🏥, 🩺, 💊, 📋, 👨‍⚕️) in UI text, buttons, labels, headings, toasts, alert banners, cards, or modal dialogs under any circumstance.
- **Medical SVG Icons Only**: Always use clean, standardized medical SVG icons (stroke-based 1.5–2px, `currentColor`, `viewBox="0 0 24 24"` or `20 20`).
- **Propose & Confirm First**: Always propose the SVG design pattern to the user for confirmation before introducing or modifying icons on any screen.

## 2. Color Palette & Theming
- **Primary Brand Blue**: Use `#2563EB` (`rgb(37, 99, 235)`) as the primary brand color across all active states, primary buttons, and focus highlights.
- **Dark Mode Standard**: Strictly adhere to the **Elevated Dark Slate Palette** for dark mode (`#212836` for surface cards, `#1C2230` for headers/topbar, `#333F53` / `#2F3B4E` for borders, and `#0F172A` / `#22272E` for canvas background).

## 3. Anti-Loop & Smart Modification Rules (Prevent Redundancy & Regressions)
- **No Redundant Repetition**: When the user indicates that a solution is incorrect or requests a revision, never repeat the previous code or make superficial tweaks. Thoroughly analyze the root cause and provide a genuine structural fix.
- **Strict Negative Constraints**: When the user specifies "do not do X", "never use Y", or cancels a previous direction, adhere 100% to the negative constraint and never reintroduce it.
- **Targeted & Minimal Edits**: Edit strictly the lines and components directly requested. Never overwrite or refactor unrelated working logic.
- **Structural Summary Before Coding**: Provide a concise 1–2 line summary explaining the structural change before editing files, ensuring alignment with user expectations.

## 4. Strict Scope Boundary & No Unrequested Changes
- **Deep Requirement Understanding**: Thoroughly inspect and understand the user's intent, context, and exact target before writing code.
- **Strict Scope Isolation / Zero Side Effects**: Modify ONLY what was explicitly requested (100% targeted scope). Never alter colors, adjust global styles, or touch unrelated components without explicit user instruction.

## 5. Visual Inspection & Circled Area Understanding
- **Deep Circled Area & DevTools Analysis**: When the user uploads a screenshot with circled or highlighted areas, inspect the circled region with pixel-level precision. Examine element hierarchy, wrappers, borders, backgrounds, spacing, typography, and any visible DevTools / Inspect panel properties.
- **Pinpoint Fix Only**: Fix strictly the element indicated within the circle without altering adjacent, parent, or sibling styles unless directly causing the bug.

## 6. Project Scope & Architecture Boundaries (Student ID: B6706265)
- **Assigned Modules Only**:
  1. **Registration, Queue & Eligibility (U2)**: Patient registration, real-time search, queue management, and eligibility verification.
  2. **Screening & Vitals**: Vital signs recording (no spinner text inputs with unit suffixes), real-time BMI gauge widget (WHO Asian Standard), Triage Level 1–5 classification, and screening history dashboard.
- **Clinical Code Formatting (Hexadecimal 4-digit Standard)**:
  - **Queue Number**: Must strictly follow `Q` + 4-digit hexadecimal format (`Q0001` through `QFFFF`, e.g. `Q0001` -> `Q0009` -> `Q000A` -> `Q000F` -> `Q0010` -> `QFFFF`).
  - **Hospital Number (HN)**: Must strictly follow `HN` + 4-digit hexadecimal format (`HN0001` through `HNFFFF`, e.g. `HN0001` -> `HN0009` -> `HN000A` -> `HN000F` -> `HN0010` -> `HNFFFF`), with no hyphen separator.
- **Teammate Scope Isolation**: Do not modify or delete teammate modules (`pages/doctor/`, `pages/pharmacy/`, `pages/billing/`).
- **RBAC & Role Parity**: `nurse_assistant` must always possess identical access permissions to `nurse` (`/queue`, `/vitals`, `/vitals-history`). The default initial route must always be `LoginPage`.
- **Simulation Ready**: Maintain self-contained, in-memory state and mock data on all UI pages for 100% standalone simulation capability without backend dependencies.

