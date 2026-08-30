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

## 7. Smart Adaptive MCP Routing (Auto Mode Selection)

Before processing each user request, **classify the task into one of three modes** and follow the corresponding MCP strategy. This ensures maximum token efficiency — simple tasks skip MCP entirely, while complex tasks get full context enrichment.

### Step 1: Auto-Classify the Task

```
USER REQUEST
     │
     ▼
┌─────────────────────────────────────────────────┐
│  Is it a simple CSS/UI tweak, typo fix,         │
│  formatting, or single-file cosmetic edit?       │──YES──▶ MODE: LIGHT (No MCP)
│  (no backend, no schema, no cross-file logic)    │
└────────────────────┬────────────────────────────┘
                     │ NO
                     ▼
┌─────────────────────────────────────────────────┐
│  Does it involve backend, schema, API routes,    │
│  type contracts, clinical logic, or design       │──YES──▶ MODE: STANDARD (Clinic MCP)
│  system tokens?                                  │
└────────────────────┬────────────────────────────┘
                     │ NO
                     ▼
┌─────────────────────────────────────────────────┐
│  Does the user mention saving progress,          │
│  resuming, recalling past decisions, or          │──YES──▶ MODE: DEEP (Clinic + WSE)
│  checkpointing?                                  │
└────────────────────┬────────────────────────────┘
                     │ NO
                     ▼
               MODE: LIGHT (No MCP)
```

### Step 2: Execute Based on Mode

**LIGHT MODE** — Native tools only, zero MCP calls:
- Use for: CSS fixes, spacing adjustments, font changes, single-component edits, text corrections, simple questions
- Cost: ~1,053 tokens/turn (baseline)

**STANDARD MODE** — Invoke `general-clinic` MCP tools as needed:
- **Database / Schema / Models** (keywords: schema, model, struct, GORM, table, migration, column, relation, foreign key) → call `clinic_context` with query `schema` or `schema:<ModelName>`
- **API Routes / Endpoints / Middleware** (keywords: route, endpoint, API, middleware, RBAC, guard, handler, REST, GET, POST, PUT, DELETE) → call `clinic_context` with query `routes` or `routes:<role>`
- **Project Architecture / Overview** (keywords: architecture, overview, summary, project structure, how does the system work) → call `clinic_context` with query `summary`
- **Go Backend Patterns** (keywords: controller, service, transaction, GORM query, response format, error handling, Go backend) → call `clinic_backend`
- **UI Design System / Tokens** (keywords: design system, color token, theme, dark mode palette, component pattern, card style) → call `clinic_design`
- **Clinical Domain Logic** (keywords: patient flow, triage rules, queue lifecycle, pharmacy flow, billing flow, clinical workflow) → call `clinic_workflow`
- **Type Contracts / DTO Validation** (keywords: type mismatch, DTO, contract, frontend-backend sync, API health) → call `clinic_validate`
- **Symbol Search** (keywords: find struct, find handler, find interface, where is `<Name>` defined) → call `clinic_search`
- **Memory & Decisions** (keywords: what did we decide, memory, recall, agreed rules) → call `clinic_context` with query `memory` or `memory:decisions`
- **Task Tracking & Progress** (keywords: progress, task status, what is left, tracking) → call `clinic_context` with query `memory:tasks` or `memory:save_task:<ID>|<Title>|<Status>|<Notes>`
- **Record Decision** (keywords: remember this, save decision, note this rule) → call `clinic_context` with query `memory:save_decision:<Topic>|<Decision>|<Context>`

**DEEP MODE** — Invoke both `general-clinic` + `world-state-engine` MCP tools:
- All STANDARD MODE triggers apply, plus:
- **Save Progress / Checkpoint** (keywords: save progress, checkpoint, save state, remember where we are, snapshot) → call `wse_save_task_checkpoint`
- **Resume / Continue** (keywords: resume, continue from last, load checkpoint, pick up where we left off) → call `wse_load_task_checkpoint`
- **Record Decision / Memory** (keywords: remember this, record decision, log this, note this for later, save this context) → call `wse_record_memory` or `clinic_context(query: "memory:save_decision:...")`
- **Recall / Previous Context** (keywords: what did we decide, recall, previous context, what was the plan, remind me) → call `wse_query_context` or `clinic_context(query: "memory")`

