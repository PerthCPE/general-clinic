package tools

import (
	"clinic-mcp/analyzer"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"
)

type ToolDefinition struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	InputSchema map[string]interface{} `json:"inputSchema"`
}

type ToolRegistry struct {
	RootPath string
	Backend  *analyzer.BackendAnalyzer
	Frontend *analyzer.FrontendAnalyzer

	lastRefresh time.Time
	cacheTTL    time.Duration
	mu          sync.RWMutex
}

func NewToolRegistry(rootPath string) *ToolRegistry {
	return &ToolRegistry{
		RootPath: rootPath,
		Backend:  analyzer.NewBackendAnalyzer(rootPath),
		Frontend: analyzer.NewFrontendAnalyzer(rootPath),
		cacheTTL: 30 * time.Second,
	}
}

func (r *ToolRegistry) Refresh() error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if time.Since(r.lastRefresh) < r.cacheTTL {
		return nil
	}
	r.Backend = analyzer.NewBackendAnalyzer(r.RootPath)
	r.Frontend = analyzer.NewFrontendAnalyzer(r.RootPath)
	if err := r.Backend.Analyze(); err != nil {
		return err
	}
	if err := r.Frontend.Analyze(); err != nil {
		return err
	}
	r.lastRefresh = time.Now()
	return nil
}

func (r *ToolRegistry) ForceRefresh() error {
	r.mu.Lock()
	r.lastRefresh = time.Time{}
	r.mu.Unlock()
	return r.Refresh()
}

// ─── 6 Consolidated Tools (optimized for minimal token overhead) ─────────────

func (r *ToolRegistry) GetToolDefinitions() []ToolDefinition {
	return []ToolDefinition{
		{
			Name:        "clinic_context",
			Description: "Query project context: schema, routes, RBAC, feature trace, file tree, or project summary. Use 'query' param.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"query": map[string]interface{}{
						"type":        "string",
						"description": "What to retrieve: 'summary', 'schema' (all models), 'schema:Patient', 'routes', 'routes:nurse', 'rbac', 'trace:vitals', 'tree', 'tree:react-frontend/src/pages', 'controller:patient'",
					},
				},
				"required": []string{"query"},
			},
		},
		{
			Name:        "clinic_validate",
			Description: "Validate frontend-backend data contracts or check API health.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"target": map[string]interface{}{
						"type":        "string",
						"description": "'contract' (TS vs Go type check), 'health' (backend server status)",
					},
				},
				"required": []string{"target"},
			},
		},
		{
			Name:        "clinic_search",
			Description: "AST search for Go structs, handlers, or TS interfaces by name.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"query": map[string]interface{}{
						"type":        "string",
						"description": "Symbol name to find (e.g. Patient, RegisterPatient, ScreeningRecord)",
					},
				},
				"required": []string{"query"},
			},
		},
		{
			Name:        "clinic_design",
			Description: "Get medical UI design system: colors, components, React 19 patterns.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"aspect": map[string]interface{}{
						"type":        "string",
						"description": "'theme', 'card', 'react', 'all'. Omit for all.",
					},
				},
			},
		},
		{
			Name:        "clinic_backend",
			Description: "Get Go backend standards: architecture, GORM transactions, response format, RBAC middleware.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"topic": map[string]interface{}{
						"type":        "string",
						"description": "'architecture', 'transaction', 'response', 'auth', 'all'. Omit for all.",
					},
				},
			},
		},
		{
			Name:        "clinic_workflow",
			Description: "Get clinical domain logic: patient lifecycle, triage rules, pharmacy, billing.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"domain": map[string]interface{}{
						"type":        "string",
						"description": "'patient_flow', 'triage_rules', 'pharmacy_flow', 'billing_flow'",
					},
				},
				"required": []string{"domain"},
			},
		},
	}
}

// ─── Unified Dispatcher ─────────────────────────────────────────────────────

func (r *ToolRegistry) ExecuteTool(name string, args map[string]interface{}) (string, error) {
	_ = r.Refresh()

	switch name {
	case "clinic_context":
		q, _ := args["query"].(string)
		return r.dispatchContext(q)
	case "clinic_validate":
		t, _ := args["target"].(string)
		return r.dispatchValidate(t)
	case "clinic_search":
		q, _ := args["query"].(string)
		return r.handleSearchSymbol(q)
	case "clinic_design":
		a, _ := args["aspect"].(string)
		return r.handleModernUISystem(a)
	case "clinic_backend":
		t, _ := args["topic"].(string)
		return r.handleBackendLogicGuide(t)
	case "clinic_workflow":
		d, _ := args["domain"].(string)
		return r.handleDomainWorkflow(d)
	default:
		return "", fmt.Errorf("unknown tool: %s", name)
	}
}

// ─── Context Dispatcher (replaces 7 separate tools) ─────────────────────────

func (r *ToolRegistry) dispatchContext(query string) (string, error) {
	q := strings.ToLower(strings.TrimSpace(query))

	switch {
	case q == "summary" || q == "":
		return r.handleProjectSummary()
	case q == "schema":
		return r.handleGetSchema("")
	case strings.HasPrefix(q, "schema:"):
		return r.handleGetSchema(strings.TrimPrefix(q, "schema:"))
	case q == "routes":
		return r.handleGetRoutes("")
	case strings.HasPrefix(q, "routes:"):
		return r.handleGetRoutes(strings.TrimPrefix(q, "routes:"))
	case q == "rbac":
		return r.handleGetRBACMatrix()
	case strings.HasPrefix(q, "trace:"):
		return r.handleTraceFeature(strings.TrimPrefix(q, "trace:"))
	case q == "tree":
		return r.handleGetFileTree("")
	case strings.HasPrefix(q, "tree:"):
		return r.handleGetFileTree(strings.TrimPrefix(q, "tree:"))
	case strings.HasPrefix(q, "controller:"):
		return r.handleGetControllerLogic(strings.TrimPrefix(q, "controller:"))
	default:
		return r.handleProjectSummary()
	}
}

func (r *ToolRegistry) dispatchValidate(target string) (string, error) {
	t := strings.ToLower(strings.TrimSpace(target))
	switch {
	case t == "health":
		return r.handleCheckAPIHealth()
	default:
		return r.handleValidateContract(t)
	}
}

// ─── Handler Functions ──────────────────────────────────────────────────────

func (r *ToolRegistry) handleProjectSummary() (string, error) {
	sb := strings.Builder{}
	sb.WriteString("# General Clinic\n")
	sb.WriteString("Backend: Go/Gin/GORM :8080 | Frontend: React19/TS/Vite/MUI :5173 | DB: PostgreSQL (Supabase) | Auth: JWT+RBAC\n\n")

	var modelNames []string
	for m := range r.Backend.Models {
		modelNames = append(modelNames, m)
	}
	sort.Strings(modelNames)
	sb.WriteString(fmt.Sprintf("Models(%d): %s\n\n", len(modelNames), strings.Join(modelNames, ", ")))

	sb.WriteString(fmt.Sprintf("Routes(%d):\n", len(r.Backend.Routes)))
	for _, route := range r.Backend.Routes {
		roles := "public"
		if len(route.Roles) > 0 {
			roles = strings.Join(route.Roles, ",")
		}
		sb.WriteString(fmt.Sprintf("  %s %s -> %s [%s]\n", route.Method, route.Path, route.Handler, roles))
	}

	sb.WriteString("\nRoles: registrar, nurse, nurse_assistant, pharmacist, cashier\n")
	return sb.String(), nil
}

func (r *ToolRegistry) handleGetSchema(modelName string) (string, error) {
	if modelName != "" {
		var found *analyzer.StructInfo
		for name, s := range r.Backend.Models {
			if strings.EqualFold(name, modelName) {
				found = &s
				break
			}
		}
		if found == nil {
			return fmt.Sprintf("Not found. Available: %s", r.listAllModelNames()), nil
		}
		sb := strings.Builder{}
		sb.WriteString(fmt.Sprintf("## %s (%s)\n", found.Name, found.File))
		if found.Doc != "" {
			sb.WriteString(fmt.Sprintf("> %s\n", found.Doc))
		}
		for _, f := range found.Fields {
			gorm := ""
			if f.GORMTag != "" {
				gorm = " gorm:" + f.GORMTag
			}
			sb.WriteString(fmt.Sprintf("  %s %s json:%s%s %s\n", f.Name, f.Type, f.JSONTag, gorm, f.Comment))
		}
		return sb.String(), nil
	}

	sb := strings.Builder{}
	sb.WriteString("## Models\n")
	var names []string
	for n := range r.Backend.Models {
		names = append(names, n)
	}
	sort.Strings(names)
	for _, name := range names {
		m := r.Backend.Models[name]
		var fields []string
		for _, f := range m.Fields {
			fields = append(fields, f.Name)
		}
		sb.WriteString(fmt.Sprintf("- %s (%s): %s\n", name, m.File, strings.Join(fields, ", ")))
	}
	return sb.String(), nil
}

func (r *ToolRegistry) listAllModelNames() string {
	var names []string
	for n := range r.Backend.Models {
		names = append(names, n)
	}
	sort.Strings(names)
	return strings.Join(names, ", ")
}

func (r *ToolRegistry) handleGetRoutes(roleFilter string) (string, error) {
	sb := strings.Builder{}
	sb.WriteString("## Routes\n")
	for _, route := range r.Backend.Routes {
		if roleFilter != "" {
			matched := false
			for _, rl := range route.Roles {
				if strings.EqualFold(rl, roleFilter) {
					matched = true
					break
				}
			}
			if !matched && len(route.Roles) > 0 {
				continue
			}
		}
		roles := "public"
		if len(route.Roles) > 0 {
			roles = strings.Join(route.Roles, ",")
		}
		sb.WriteString(fmt.Sprintf("  %s %s -> %s [%s]\n", route.Method, route.Path, route.Handler, roles))
	}
	return sb.String(), nil
}

func (r *ToolRegistry) handleGetRBACMatrix() (string, error) {
	sb := strings.Builder{}
	sb.WriteString("## RBAC\n")
	for _, rKey := range []string{"registrar", "nurse", "nurse_assistant", "pharmacist", "cashier"} {
		rp, exists := r.Frontend.Roles[rKey]
		if !exists {
			continue
		}
		sb.WriteString(fmt.Sprintf("- %s (%s/%s) dept:%s pages:[%s] default:%s\n",
			rp.Role, rp.TitleTh, rp.TitleEn, rp.Department,
			strings.Join(rp.AllowedPages, ","), rp.DefaultPage))
	}
	return sb.String(), nil
}

func (r *ToolRegistry) handleTraceFeature(feature string) (string, error) {
	fLower := strings.ToLower(feature)
	sb := strings.Builder{}
	sb.WriteString(fmt.Sprintf("# Trace: %s\n", feature))

	switch {
	case strings.Contains(fLower, "patient") || strings.Contains(fLower, "regis"):
		sb.WriteString("FE: pages/Registration/RegistrationPage.tsx -> PatientFormCard.tsx, PatientSearchCard.tsx | types: Registration/types.ts (Patient, SchemeType) | role: registrar\n")
		sb.WriteString("API: POST /api/registrar/patients -> RegisterPatient | GET /api/registrar/patients/search/:national_id -> SearchPatient | middleware: AuthRequired+RoleRequired(registrar)\n")
		sb.WriteString("BE: controllers/patient_controller.go | models/patient.go\n")
	case strings.Contains(fLower, "vital") || strings.Contains(fLower, "screen") || strings.Contains(fLower, "nurse"):
		sb.WriteString("FE: pages/Vitals/VitalsPage.tsx -> VitalsFormCard, TriageWidget, BMIWidget, WaitingQueueList | types: Vitals/types.ts (ScreeningRecord, TriageLevelKey) | roles: nurse, nurse_assistant\n")
		sb.WriteString("API: POST /api/nurse/vitals -> RecordVitalsAndTriage | GET /api/nurse/vitals/history/:patient_id -> GetScreeningHistory | middleware: AuthRequired+RoleRequired(nurse,nurse_assistant)\n")
		sb.WriteString("BE: controllers/vitals_controller.go | models/screening.go, models/visit.go\n")
	case strings.Contains(fLower, "eligib"):
		sb.WriteString("FE: pages/Eligibility/EligibilityPage.tsx | role: registrar\n")
		sb.WriteString("API: GET /api/registrar/eligibility/check/:national_id -> CheckExternalEligibility | POST /api/registrar/eligibility/save -> SavePatientEligibility\n")
		sb.WriteString("BE: controllers/eligibility_controller.go | models/eligibility.go\n")
	case strings.Contains(fLower, "queue"):
		sb.WriteString("FE: pages/Queue/QueuePage.tsx | roles: registrar, nurse, nurse_assistant\n")
		sb.WriteString("API: GET /api/queue/list -> GetQueueList | POST /api/queue/create -> CreateQueue | PUT /api/queue/:id/status -> UpdateQueueStatus\n")
		sb.WriteString("BE: controllers/queue_controller.go | models/queue.go\n")
	case strings.Contains(fLower, "pharm") || strings.Contains(fLower, "dispens") || strings.Contains(fLower, "med"):
		sb.WriteString("FE: pages/pharmacy/MedicinePage.tsx, DetailPage.tsx, PatientHistoryPage.tsx | role: pharmacist\n")
		sb.WriteString("BE: models/medicine.go, models/dispensing.go\n")
	case strings.Contains(fLower, "bill") || strings.Contains(fLower, "cash") || strings.Contains(fLower, "pay"):
		sb.WriteString("FE: pages/billing/BillingDispensePage.tsx, BillingInvoicePage.tsx, BillingDashboardPage.tsx | role: cashier\n")
		sb.WriteString("BE: models/billing.go, models/qrpayment.go\n")
	default:
		sb.WriteString("Available: registration, vitals, eligibility, queue, pharmacy, billing\n")
	}
	return sb.String(), nil
}

func (r *ToolRegistry) handleValidateContract(feature string) (string, error) {
	sb := strings.Builder{}
	sb.WriteString("## Contract Validation\n")

	if pModel, ok := r.Backend.Models["Patient"]; ok {
		if pTS, ok := r.Frontend.Interfaces["Patient"]; ok {
			sb.WriteString("Patient:\n")
			for _, f := range pModel.Fields {
				jsonTag := f.JSONTag
				if jsonTag == "" {
					jsonTag = strings.ToLower(f.Name)
				}
				status := "MISS"
				for tsField := range pTS.Fields {
					if strings.EqualFold(tsField, jsonTag) || strings.EqualFold(tsField, f.Name) ||
						(jsonTag == "national_id" && tsField == "nationalId") ||
						(jsonTag == "phone_number" && tsField == "phone") ||
						(jsonTag == "fullname" && tsField == "fullName") ||
						(jsonTag == "birthdate" && tsField == "dob") ||
						(jsonTag == "emergency_contact" && tsField == "emergencyContact") {
						status = fmt.Sprintf("OK->%s:%s", tsField, pTS.Fields[tsField])
						break
					}
				}
				sb.WriteString(fmt.Sprintf("  %s(%s) json:%s => %s\n", f.Name, f.Type, jsonTag, status))
			}
		}
	}

	if sModel, ok := r.Backend.Models["Screening"]; ok {
		if sTS, ok := r.Frontend.Interfaces["ScreeningRecord"]; ok {
			sb.WriteString("Screening vs ScreeningRecord:\n")
			for _, f := range sModel.Fields {
				jsonTag := f.JSONTag
				status := "MISS"
				for tsField := range sTS.Fields {
					if strings.EqualFold(tsField, jsonTag) || strings.EqualFold(tsField, f.Name) ||
						(jsonTag == "systolic_bp" && tsField == "systolicBP") ||
						(jsonTag == "diastolic_bp" && tsField == "diastolicBP") ||
						(jsonTag == "heart_rate" && tsField == "heartRate") ||
						(jsonTag == "chief_complaint" && tsField == "chiefComplaint") ||
						(jsonTag == "triage_level" && tsField == "triageLevel") {
						status = fmt.Sprintf("OK->%s", tsField)
						break
					}
				}
				sb.WriteString(fmt.Sprintf("  %s(%s) json:%s => %s\n", f.Name, f.Type, jsonTag, status))
			}
		}
	}
	return sb.String(), nil
}

func (r *ToolRegistry) handleSearchSymbol(query string) (string, error) {
	qLower := strings.ToLower(query)
	sb := strings.Builder{}
	sb.WriteString(fmt.Sprintf("## Search: %s\n", query))
	found := 0

	for name, m := range r.Backend.Models {
		if strings.Contains(strings.ToLower(name), qLower) {
			found++
			sb.WriteString(fmt.Sprintf("Go struct %s (models/%s):\n", name, m.File))
			for _, f := range m.Fields {
				sb.WriteString(fmt.Sprintf("  %s %s json:%s\n", f.Name, f.Type, f.JSONTag))
			}
		}
	}
	for _, route := range r.Backend.Routes {
		if strings.Contains(strings.ToLower(route.Handler), qLower) || strings.Contains(strings.ToLower(route.Path), qLower) {
			found++
			roles := ""
			if len(route.Roles) > 0 {
				roles = " [" + strings.Join(route.Roles, ",") + "]"
			}
			sb.WriteString(fmt.Sprintf("Route: %s %s -> %s%s\n", route.Method, route.Path, route.Handler, roles))
		}
	}
	for name, iface := range r.Frontend.Interfaces {
		if strings.Contains(strings.ToLower(name), qLower) {
			found++
			sb.WriteString(fmt.Sprintf("TS interface %s (%s):\n", name, iface.File))
			for fName, fType := range iface.Fields {
				sb.WriteString(fmt.Sprintf("  %s: %s\n", fName, fType))
			}
		}
	}
	if found == 0 {
		sb.WriteString(fmt.Sprintf("No results for '%s'\n", query))
	}
	return sb.String(), nil
}

func ToJSON(v interface{}) string {
	b, _ := json.MarshalIndent(v, "", "  ")
	return string(b)
}
