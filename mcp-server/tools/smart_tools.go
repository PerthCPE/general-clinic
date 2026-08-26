package tools

import (
	"fmt"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

// handleDiagnoseError Analyzes a Go backend error message and maps it to the relevant controller, model, and likely cause.
func (r *ToolRegistry) handleDiagnoseError(errorMessage string) (string, error) {
	var classification, rootCause, affectedFiles, suggestedFix string

	lowerMsg := strings.ToLower(errorMessage)

	switch {
	case strings.Contains(lowerMsg, "prepared statement") || strings.Contains(lowerMsg, "sqlstate 26000"):
		classification = "Database Connection Pool Issue"
		rootCause = "PgBouncer/Supabase pooler doesn't support prepared statements in transaction mode."
		affectedFiles = "db.go"
		suggestedFix = "Add PreferSimpleProtocol: true in your database configuration."
	case strings.Contains(lowerMsg, "connection refused") || strings.Contains(lowerMsg, "dial tcp"):
		classification = "Network / Connectivity Error"
		rootCause = "Backend server not running or DB not accessible."
		affectedFiles = "cmd/main.go or docker-compose.yml"
		suggestedFix = "Ensure the backend or database server is running."
	case strings.Contains(lowerMsg, "401") || strings.Contains(lowerMsg, "unauthorized"):
		classification = "Authentication Error"
		rootCause = "JWT token expired or missing."
		affectedFiles = "middleware/auth.go"
		suggestedFix = "Check if the token is passed correctly in the Authorization header."
	case strings.Contains(lowerMsg, "404") || strings.Contains(lowerMsg, "not found"):
		classification = "Not Found Error"
		rootCause = "Wrong endpoint path."
		affectedFiles = "routes/routes.go"
		suggestedFix = "Check the requested URL matches a registered route."
	case strings.Contains(lowerMsg, "binding") || strings.Contains(lowerMsg, "required"):
		classification = "Validation Error"
		rootCause = "Request body validation failed."
		affectedFiles = "Controllers (Request struct definitions)"
		suggestedFix = "Ensure the request payload matches the controller struct tags."
	case strings.Contains(lowerMsg, "duplicate") || strings.Contains(lowerMsg, "conflict") || strings.Contains(lowerMsg, "unique"):
		classification = "Database Constraint Violation"
		rootCause = "Duplicate key constraint."
		affectedFiles = "Models / Database Schema"
		suggestedFix = "Check for uniqueness of fields like national_id or HN."
	case strings.Contains(lowerMsg, "slow sql"):
		classification = "Performance Issue"
		rootCause = "Query performance issue."
		affectedFiles = "Repository / Database Queries"
		suggestedFix = "Consider adding an index or limiting the result set."
	default:
		classification = "Unknown Error"
		rootCause = "Could not map to a specific common issue."
		affectedFiles = "Unknown"
		suggestedFix = "Investigate the stack trace or log for more details."
	}

	var matchedRoutes []string
	if r.Backend != nil && r.Backend.Routes != nil {
		for _, route := range r.Backend.Routes {
			if strings.Contains(lowerMsg, route.Path) {
				matchedRoutes = append(matchedRoutes, fmt.Sprintf("%s %s -> %s", route.Method, route.Path, route.Handler))
			}
		}
	}

	var matchedModels []string
	if r.Backend != nil && r.Backend.Models != nil {
		for modelName := range r.Backend.Models {
			if strings.Contains(lowerMsg, strings.ToLower(modelName)) {
				matchedModels = append(matchedModels, modelName)
			}
		}
	}

	report := fmt.Sprintf(`### Error Analysis Report

**Error Classification:** %s
**Root Cause:** %s
**Affected Files:** %s
**Suggested Fix:** %s
`, classification, rootCause, affectedFiles, suggestedFix)

	if len(matchedRoutes) > 0 {
		report += "\n**Matched Routes:**\n"
		for _, m := range matchedRoutes {
			report += fmt.Sprintf("- %s\n", m)
		}
	}

	if len(matchedModels) > 0 {
		report += "\n**Matched Models:**\n"
		for _, m := range matchedModels {
			report += fmt.Sprintf("- %s\n", m)
		}
	}

	return report, nil
}

// handleGetFileTree Returns a directory tree of the project.
func (r *ToolRegistry) handleGetFileTree(directory string) (string, error) {
	if directory == "" {
		directory = r.RootPath
	}

	var builder strings.Builder

	skipDirs := map[string]bool{
		"node_modules":      true,
		".git":              true,
		"dist":              true,
		"__pycache__":       true,
		".next":             true,
		"vendor":            true,
		".system_generated": true,
		".user_uploaded":    true,
	}

	baseDepth := strings.Count(filepath.ToSlash(directory), "/")

	err := filepath.WalkDir(directory, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil
		}

		if d.IsDir() {
			if skipDirs[d.Name()] {
				return filepath.SkipDir
			}
		}

		depth := strings.Count(filepath.ToSlash(path), "/") - baseDepth
		if depth > 4 {
			if d.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}

		if path == directory {
			builder.WriteString(fmt.Sprintf("%s\n", d.Name()))
			return nil
		}

		prefix := strings.Repeat("│   ", depth-1)
		if depth > 0 {
			prefix += "├── "
		}

		if d.IsDir() {
			builder.WriteString(fmt.Sprintf("%s%s/\n", prefix, d.Name()))
		} else {
			info, err := d.Info()
			sizeStr := ""
			if err == nil {
				sizeStr = fmt.Sprintf(" (%d B)", info.Size())
			}
			builder.WriteString(fmt.Sprintf("%s%s%s\n", prefix, d.Name(), sizeStr))
		}

		return nil
	})

	if err != nil {
		return "", fmt.Errorf("failed to walk directory: %v", err)
	}

	return builder.String(), nil
}

// handleCheckAPIHealth Checks if the Go backend server is running on localhost:8080.
func (r *ToolRegistry) handleCheckAPIHealth() (string, error) {
	client := &http.Client{
		Timeout: 3 * time.Second,
	}

	resp, err := client.Get("http://localhost:8080/login")
	var result strings.Builder

	if err != nil {
		result.WriteString(fmt.Sprintf("Backend is OFFLINE: %v\n\n", err))
		result.WriteString("To start the backend:\n")
		result.WriteString("```\n")
		result.WriteString("cd golang-backend\n")
		result.WriteString("go run ./cmd/main.go\n")
		result.WriteString("```\n")
	} else {
		defer resp.Body.Close()
		result.WriteString(fmt.Sprintf("Backend is ONLINE on :8080 (Status: %d)\n", resp.StatusCode))
	}

	envPath := filepath.Join(r.RootPath, "golang-backend", ".env")
	if _, err := os.Stat(envPath); err == nil {
		result.WriteString("\nNote: .env file found in backend directory.")
	} else {
		result.WriteString("\nNote: .env file NOT found in backend directory.")
	}

	return result.String(), nil
}

// handleGetControllerLogic Reads and summarizes a specific controller file.
func (r *ToolRegistry) handleGetControllerLogic(controllerName string) (string, error) {
	basePath := filepath.Join(r.RootPath, "golang-backend", "internal", "controllers")
	filePath := filepath.Join(basePath, fmt.Sprintf("%s_controller.go", controllerName))

	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		filePath = filepath.Join(basePath, fmt.Sprintf("%s.go", controllerName))
		if _, err := os.Stat(filePath); os.IsNotExist(err) {
			return "", fmt.Errorf("controller file not found for %s", controllerName)
		}
	}

	contentBytes, err := os.ReadFile(filePath)
	if err != nil {
		return "", fmt.Errorf("failed to read controller file: %v", err)
	}
	content := string(contentBytes)

	var funcs []string
	var structs []string
	var dbOps []string
	var responses []string

	lines := strings.Split(content, "\n")

	funcRegex := regexp.MustCompile(`^func\s+(?:\([^)]+\)\s+)?([A-Z][a-zA-Z0-9_]*)\(`)
	structRegex := regexp.MustCompile(`type\s+([a-zA-Z0-9_]+Req)\s+struct`)
	dbRegex := regexp.MustCompile(`config\.DB\.[A-Za-z0-9_.]+`)
	respRegex := regexp.MustCompile(`c\.JSON\(`)

	inStruct := false
	var currentStruct strings.Builder

	for _, line := range lines {
		trimLine := strings.TrimSpace(line)

		if matches := funcRegex.FindStringSubmatch(line); len(matches) > 1 {
			funcs = append(funcs, matches[1])
		}

		if matches := structRegex.FindStringSubmatch(trimLine); len(matches) > 1 {
			inStruct = true
			currentStruct.WriteString(line + "\n")
			continue
		}

		if inStruct {
			currentStruct.WriteString(line + "\n")
			if strings.HasPrefix(trimLine, "}") {
				inStruct = false
				structs = append(structs, currentStruct.String())
				currentStruct.Reset()
			}
			continue
		}

		if dbRegex.MatchString(line) {
			dbOps = append(dbOps, strings.TrimSpace(line))
		}

		if respRegex.MatchString(line) {
			responses = append(responses, strings.TrimSpace(line))
		}
	}

	var report strings.Builder
	report.WriteString(fmt.Sprintf("### Controller Analysis: %s\n\n", filepath.Base(filePath)))

	report.WriteString("**Handler Functions:**\n")
	if len(funcs) == 0 {
		report.WriteString("None found.\n")
	}
	for _, f := range funcs {
		report.WriteString(fmt.Sprintf("- %s\n", f))
	}
	report.WriteString("\n")

	report.WriteString("**Request Structs:**\n")
	if len(structs) == 0 {
		report.WriteString("None found.\n")
	}
	for _, s := range structs {
		report.WriteString(fmt.Sprintf("```go\n%s```\n", s))
	}
	report.WriteString("\n")

	report.WriteString("**Database Operations:**\n")
	if len(dbOps) == 0 {
		report.WriteString("None found.\n")
	}
	for _, op := range dbOps {
		report.WriteString(fmt.Sprintf("- `%s`\n", op))
	}
	report.WriteString("\n")

	report.WriteString("**Responses:**\n")
	if len(responses) == 0 {
		report.WriteString("None found.\n")
	}
	for _, resp := range responses {
		report.WriteString(fmt.Sprintf("- `%s`\n", resp))
	}

	return report.String(), nil
}
