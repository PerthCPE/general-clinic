package tools

import (
	"fmt"
)

type PromptDefinition struct {
	Name        string           `json:"name"`
	Description string           `json:"description"`
	Arguments   []PromptArgument `json:"arguments,omitempty"`
}

type PromptArgument struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Required    bool   `json:"required"`
}

type PromptResult struct {
	Description string          `json:"description"`
	Messages    []PromptMessage `json:"messages"`
}

type PromptMessage struct {
	Role    string        `json:"role"`
	Content PromptContent `json:"content"`
}

type PromptContent struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

func (tr *ToolRegistry) GetPrompts() []PromptDefinition {
	return []PromptDefinition{
		{
			Name:        "debug_api_error",
			Description: "Analyze a backend API error and suggest fixes based on the clinic codebase architecture",
			Arguments: []PromptArgument{
				{Name: "error_message", Description: "The error message to debug", Required: true},
				{Name: "endpoint", Description: "The endpoint where the error occurred", Required: false},
			},
		},
		{
			Name:        "add_new_feature",
			Description: "Generate a full-stack implementation checklist for adding a new feature to the clinic system",
			Arguments: []PromptArgument{
				{Name: "feature_name", Description: "The name of the feature to add", Required: true},
				{Name: "role", Description: "The role the feature is for (e.g. registrar/nurse/pharmacist/cashier)", Required: true},
			},
		},
		{
			Name:        "review_contract",
			Description: "Review and validate the data contract between a Go backend model and its TypeScript frontend interface",
			Arguments: []PromptArgument{
				{Name: "model_name", Description: "The name of the model to review", Required: true},
			},
		},
		{
			Name:        "optimize_query",
			Description: "Analyze a GORM database query in a controller and suggest performance optimizations",
			Arguments: []PromptArgument{
				{Name: "controller_name", Description: "The name of the controller to optimize", Required: true},
			},
		},
	}
}

func (tr *ToolRegistry) GetPrompt(name string, args map[string]interface{}) (*PromptResult, error) {
	switch name {
	case "debug_api_error":
		errMsg, ok := args["error_message"].(string)
		if !ok || errMsg == "" {
			return nil, fmt.Errorf("missing required argument: error_message")
		}

		endpointStr := ""
		if ep, ok := args["endpoint"].(string); ok && ep != "" {
			endpointStr = fmt.Sprintf("\nat endpoint: %s\n", ep)
		}

		text := fmt.Sprintf(`You are debugging the General Clinic backend (Go + Gin + GORM on localhost:8080).
The following error occurred: %s%s

Analyze this error by:
1. Identifying which controller and model are involved
2. Checking the route definition in routes.go
3. Examining the GORM query pattern
4. Suggesting a specific fix with code

Project structure: golang-backend/internal/{controllers,models,routes,middleware}
Database: PostgreSQL via Supabase (Transaction Pooler on port 6543)
Key issue: PreferSimpleProtocol must be true for PgBouncer compatibility`, errMsg, endpointStr)

		return &PromptResult{
			Description: "Debug API error prompt",
			Messages: []PromptMessage{
				{
					Role: "user",
					Content: PromptContent{
						Type: "text",
						Text: text,
					},
				},
			},
		}, nil

	case "add_new_feature":
		featureName, ok := args["feature_name"].(string)
		if !ok || featureName == "" {
			return nil, fmt.Errorf("missing required argument: feature_name")
		}
		role, ok := args["role"].(string)
		if !ok || role == "" {
			return nil, fmt.Errorf("missing required argument: role")
		}

		text := fmt.Sprintf(`Generate a complete implementation plan for adding '%s' to the General Clinic system for the '%s' role.

Include:
1. Backend: New model fields (if needed), controller function, route registration with RoleRequired middleware
2. Frontend: New page component, types/interfaces, API service function, sidebar menu entry in config/roles.ts
3. Database: Migration via GORM AutoMigrate
4. Testing: API endpoint test commands

Existing architecture:
- Backend routes: golang-backend/internal/routes/routes.go
- Controllers: golang-backend/internal/controllers/
- Models: golang-backend/internal/models/
- Frontend pages: react-frontend/src/pages/
- API service: react-frontend/src/services/api.ts
- Role config: react-frontend/src/config/roles.ts`, featureName, role)

		return &PromptResult{
			Description: "Add new feature prompt",
			Messages: []PromptMessage{
				{
					Role: "user",
					Content: PromptContent{
						Type: "text",
						Text: text,
					},
				},
			},
		}, nil

	case "review_contract":
		modelName, ok := args["model_name"].(string)
		if !ok || modelName == "" {
			return nil, fmt.Errorf("missing required argument: model_name")
		}

		text := fmt.Sprintf(`Review and validate the data contract between the Go backend model '%s' and its corresponding TypeScript frontend interface.

1. Verify that all fields in the Go struct are represented in the TypeScript interface.
2. Check that the types match (e.g. Go int to TS number, Go time.Time to TS string).
3. Ensure JSON tags in Go match the property names in TS.
4. Note any missing fields or type mismatches.`, modelName)

		return &PromptResult{
			Description: "Review contract prompt",
			Messages: []PromptMessage{
				{
					Role: "user",
					Content: PromptContent{
						Type: "text",
						Text: text,
					},
				},
			},
		}, nil

	case "optimize_query":
		controllerName, ok := args["controller_name"].(string)
		if !ok || controllerName == "" {
			return nil, fmt.Errorf("missing required argument: controller_name")
		}

		text := fmt.Sprintf(`Analyze the GORM database queries in the '%s' controller and suggest performance optimizations.

1. Identify N+1 query problems and suggest using Preload or Joins.
2. Check for missing indexes on frequently queried fields.
3. Review the use of Select to fetch only needed columns instead of entire rows.
4. Look for opportunities to use batch inserts or updates.`, controllerName)

		return &PromptResult{
			Description: "Optimize query prompt",
			Messages: []PromptMessage{
				{
					Role: "user",
					Content: PromptContent{
						Type: "text",
						Text: text,
					},
				},
			},
		}, nil

	default:
		return nil, fmt.Errorf("unknown prompt name: %s", name)
	}
}
