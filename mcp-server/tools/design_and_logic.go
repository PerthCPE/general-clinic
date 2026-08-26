package tools

import (
	"fmt"
	"strings"
)

func (r *ToolRegistry) handleModernUISystem(componentType string) (string, error) {
	cLower := strings.ToLower(componentType)
	sb := strings.Builder{}

	sb.WriteString("# Modern Clinic Frontend Design System & UI/UX Standards\n\n")
	sb.WriteString("**Design Philosophy**: *Clean Clinical Modernism* — Design for readability, clear data hierarchy, and ease of use for medical staff. (High Contrast, Intuitive Hierarchy, Zero Visual Clutter)\n\n")

	if cLower == "" || cLower == "all" || strings.Contains(cLower, "theme") || strings.Contains(cLower, "color") {
		sb.WriteString("### 1. Color Palette & Design Tokens\n")
		sb.WriteString("- **Primary (Clinic Blue)**: `#2563EB` (Blue 600) | Dark: `#3B82F6` — Professionalism and trust\n")
		sb.WriteString("- **Success / Triage Normal**: `#10B981` (Emerald 500) | Background: `#ECFDF5`\n")
		sb.WriteString("- **Warning / Triage Semi-Urgent**: `#F59E0B` (Amber 500) | Background: `#FFFBEB`\n")
		sb.WriteString("- **Danger / Triage Urgent**: `#EF4444` (Rose 500) | Background: `#FEF2F2`\n")
		sb.WriteString("- **Critical / Resuscitation**: `#7C3AED` (Purple 600) | Pulsing Badge Indicator\n")
		sb.WriteString("- **Surface & Cards**: Background `#F8FAFC` (Slate 50), Card White `#FFFFFF`, Border `#E2E8F0` with subtle `box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05)`\n\n")
	}

	if cLower == "" || cLower == "all" || strings.Contains(cLower, "card") || strings.Contains(cLower, "widget") {
		sb.WriteString("### 2. Modern Component Patterns\n")
		sb.WriteString("- **KPI & Stats Metric Cards**:\n")
		sb.WriteString("  - Card with circular pastel icon on the left + large stat number (28-32px Font-Bold) + trend badge/percentage\n")
		sb.WriteString("- **Triage Priority Badges**:\n")
		sb.WriteString("  - Display urgency levels with dedicated colors + glowing pulse animation for emergency cases\n")
		sb.WriteString("- **Data Table & Queue Lists**:\n")
		sb.WriteString("  - Sticky Header, subtle Zebra striping (`#F8FAFC`), Live Debounce Search box, Quick Action Buttons (Examine, Call Queue, View History)\n")
		sb.WriteString("- **Interactive Vitals Widget**:\n")
		sb.WriteString("  - Real-time auto-calculation BMI Calculator with Color Bar status indicator (Underweight/Normal/Overweight/Obese)\n")
		sb.WriteString("  - Blood Pressure Indicator showing warning bar when Systolic > 140 mmHg\n\n")
	}

	if cLower == "" || cLower == "all" || strings.Contains(cLower, "react") || strings.Contains(cLower, "ux") {
		sb.WriteString("### 3. React 19 & Frontend Performance Best Practices\n")
		sb.WriteString("- **Optimistic Updates**: When changing queue status (e.g., calling patient into exam room), update UI immediately without waiting for API response\n")
		sb.WriteString("- **Skeleton Loading States**: Use Skeleton Loader instead of spinning circles for perceived performance improvement\n")
		sb.WriteString("- **Toast Feedback System**: Top-right corner notifications on successful actions (e.g., 'Vitals recorded successfully') with 3-second auto-dismiss\n")
		sb.WriteString("- **Keyboard Navigation**: Support Enter to submit forms or search National ID immediately without mouse clicks\n")
	}

	return sb.String(), nil
}

func (r *ToolRegistry) handleBackendLogicGuide(topic string) (string, error) {
	tLower := strings.ToLower(topic)
	sb := strings.Builder{}

	sb.WriteString("# Go Backend Architecture & Clinical API Standards\n\n")

	if tLower == "" || tLower == "all" || strings.Contains(tLower, "arch") || strings.Contains(tLower, "clean") {
		sb.WriteString("### 1. Clean Layered Architecture (Gin + GORM)\n")
		sb.WriteString("```text\n")
		sb.WriteString("Controllers (HTTP JSON Parsing, Validation) \n")
		sb.WriteString("     -> Services / Logic (Business Rules, State Transitions) \n")
		sb.WriteString("           -> GORM Models / Repositories (Database CRUD, Transactions)\n")
		sb.WriteString("```\n\n")
	}

	if tLower == "" || tLower == "all" || strings.Contains(tLower, "tx") || strings.Contains(tLower, "transaction") {
		sb.WriteString("### 2. GORM Transaction Pattern for Atomic Clinical Operations\n")
		sb.WriteString("For functions modifying multiple tables simultaneously (e.g., register patient + create queue + open visit record):\n")
		sb.WriteString("```go\n")
		sb.WriteString("err := db.Transaction(func(tx *gorm.DB) error {\n")
		sb.WriteString("    // 1. Save patient\n")
		sb.WriteString("    if err := tx.Create(&patient).Error; err != nil {\n")
		sb.WriteString("        return err // Auto rollback\n")
		sb.WriteString("    }\n")
		sb.WriteString("    // 2. Create Visit Record\n")
		sb.WriteString("    visit := models.VisitRecord{PatientID: patient.ID, Status: \"waiting_screening\"}\n")
		sb.WriteString("    if err := tx.Create(&visit).Error; err != nil {\n")
		sb.WriteString("        return err\n")
		sb.WriteString("    }\n")
		sb.WriteString("    // 3. Reserve Queue\n")
		sb.WriteString("    queue := models.Queue{VisitID: visit.ID, Status: \"in_queue\"}\n")
		sb.WriteString("    return tx.Create(&queue).Error\n")
		sb.WriteString("})\n")
		sb.WriteString("```\n\n")
	}

	if tLower == "" || tLower == "all" || strings.Contains(tLower, "error") || strings.Contains(tLower, "response") {
		sb.WriteString("### 3. Standardized JSON Response Envelope\n")
		sb.WriteString("Standard API response format for all endpoints:\n")
		sb.WriteString("```json\n")
		sb.WriteString("{\n")
		sb.WriteString("  \"success\": true,\n")
		sb.WriteString("  \"message\": \"Patient registered successfully\",\n")
		sb.WriteString("  \"data\": { ... }\n")
		sb.WriteString("}\n")
		sb.WriteString("```\n")
		sb.WriteString("Error case:\n")
		sb.WriteString("```json\n")
		sb.WriteString("{\n")
		sb.WriteString("  \"success\": false,\n")
		sb.WriteString("  \"error\": {\n")
		sb.WriteString("    \"code\": \"DUPLICATE_NATIONAL_ID\",\n")
		sb.WriteString("    \"message\": \"This National ID already exists in the system\"\n")
		sb.WriteString("  }\n")
		sb.WriteString("}\n")
		sb.WriteString("```\n\n")
	}

	if tLower == "" || tLower == "all" || strings.Contains(tLower, "rbac") || strings.Contains(tLower, "auth") {
		sb.WriteString("### 4. JWT & Role-Based Middleware Chaining\n")
		sb.WriteString("- Extract `user_id` and `role` from JWT Claims via `c.Get(\"userRole\")`\n")
		sb.WriteString("- Protect endpoints with middleware chain: `middleware.AuthRequired()` -> `middleware.RoleRequired(\"nurse\", \"doctor\")`\n")
	}

	return sb.String(), nil
}

func (r *ToolRegistry) handleDomainWorkflow(domain string) (string, error) {
	dLower := strings.ToLower(domain)
	sb := strings.Builder{}

	switch {
	case strings.Contains(dLower, "patient") || strings.Contains(dLower, "regis") || strings.Contains(dLower, "life"):
		sb.WriteString("# Patient Clinical Lifecycle (State Machine)\n\n")
		sb.WriteString("```mermaid\n")
		sb.WriteString("graph TD\n")
		sb.WriteString("    A[\"1. Registration\"] -->|Register / Verify Eligibility| B[\"2. Waiting Triage\"]\n")
		sb.WriteString("    B -->|Nurse measures vitals / Triage| C[\"3. Waiting Doctor\"]\n")
		sb.WriteString("    C -->|Doctor examines / Diagnoses| D{\"Prescribe medication?\"}\n")
		sb.WriteString("    D -->|Yes| E[\"4. Pharmacy\"]\n")
		sb.WriteString("    D -->|No| F[\"5. Billing\"]\n")
		sb.WriteString("    E -->|Pharmacist sends total| F\n")
		sb.WriteString("    F -->|Payment / Receipt| G[\"6. Completed\"]\n")
		sb.WriteString("```\n\n")
		sb.WriteString("### Key Validations:\n")
		sb.WriteString("1. **National ID**: Must be 13 digits with valid checksum\n")
		sb.WriteString("2. **Phone Number**: 10 digits starting with 0\n")
		sb.WriteString("3. **Eligibility**: Must have at least 1 treatment scheme (UC Gold Card, Social Security, Government Officer, Self-pay)\n")

	case strings.Contains(dLower, "vital") || strings.Contains(dLower, "triage") || strings.Contains(dLower, "nurse"):
		sb.WriteString("# Triage & Vital Signs Clinical Logic\n\n")
		sb.WriteString("### 1. Triage Classification Rules:\n")
		sb.WriteString("| Triage Level | Criteria / Vital Signs | Color | Action |\n")
		sb.WriteString("| :--- | :--- | :--- | :--- |\n")
		sb.WriteString("| **Resuscitation** | Unconscious, can't breathe, Pulse < 40 or > 140, SpO2 < 90% | Red/Purple | Send to ER immediately |\n")
		sb.WriteString("| **Emergency** | High fever > 39C, BP > 180/110, severe chest pain | Orange | See doctor within 15 min |\n")
		sb.WriteString("| **Semi-Urgent** | Moderate abdominal pain, fever 38-38.9C, wound suture | Yellow | See doctor within 30 min |\n")
		sb.WriteString("| **Normal** | Health checkup, medication refill, mild cold | Green | Wait in queue order |\n\n")
		sb.WriteString("### 2. Auto BMI Formula:\n")
		sb.WriteString("`BMI = Weight (kg) / (Height (m) ^ 2)`\n")
		sb.WriteString("- `< 18.5`: Underweight | `18.5 - 22.9`: Normal | `23.0 - 24.9`: Overweight | `25.0 - 29.9`: Obese Level 1 | `>= 30.0`: Obese Level 2\n")

	case strings.Contains(dLower, "pharm") || strings.Contains(dLower, "med") || strings.Contains(dLower, "dispens"):
		sb.WriteString("# Pharmacy & Medicine Dispensing Logic\n\n")
		sb.WriteString("### Workflow & Rules:\n")
		sb.WriteString("1. **Prescription Status**: `Pending` -> `Preparing` -> `Dispensed`\n")
		sb.WriteString("2. **Stock Deduction**: When status changes to `Dispensed`, deduct medicine stock in `Medicine` table with atomic transaction\n")
		sb.WriteString("3. **Allergy Alert**: System must cross-check patient allergy history with prescribed medicines. If match found, display red warning banner immediately.\n")

	case strings.Contains(dLower, "bill") || strings.Contains(dLower, "pay") || strings.Contains(dLower, "cash"):
		sb.WriteString("# Billing & Payment Logic\n\n")
		sb.WriteString("### Workflow & Rules:\n")
		sb.WriteString("1. **Invoice Total**: Calculated from (Doctor service fee + Medicine cost + Procedure cost) - Treatment scheme discount\n")
		sb.WriteString("2. **Payment Channels**: Cash, PromptPay QR Transfer, Credit Card\n")
		sb.WriteString("3. **Invoice Lifecycle**: `Unpaid` -> `Paid` -> `Receipt_Generated`\n")

	default:
		sb.WriteString(fmt.Sprintf("Domain '%s' not found. Available domains: `patient_flow`, `triage_rules`, `pharmacy_flow`, `billing_flow`\n", domain))
	}

	return sb.String(), nil
}
