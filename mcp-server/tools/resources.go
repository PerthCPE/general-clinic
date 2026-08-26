package tools

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type ResourceDefinition struct {
	URI         string `json:"uri"`
	Name        string `json:"name"`
	Description string `json:"description"`
	MimeType    string `json:"mimeType"`
}

type ResourceTemplateDefinition struct {
	URITemplate string `json:"uriTemplate"`
	Name        string `json:"name"`
	Description string `json:"description"`
	MimeType    string `json:"mimeType"`
}

func (r *ToolRegistry) GetResources() []ResourceDefinition {
	return []ResourceDefinition{
		{
			URI:         "clinic://schema/models",
			Name:        "Database Models Overview",
			Description: "Database Models Overview",
			MimeType:    "text/markdown",
		},
		{
			URI:         "clinic://routes",
			Name:        "API Routes Table",
			Description: "API Routes Table",
			MimeType:    "text/markdown",
		},
		{
			URI:         "clinic://config/env",
			Name:        "Environment Configuration Template",
			Description: "Environment Configuration Template",
			MimeType:    "text/plain",
		},
		{
			URI:         "clinic://structure",
			Name:        "Project File Tree",
			Description: "Project File Tree",
			MimeType:    "text/plain",
		},
		{
			URI:         "clinic://rbac",
			Name:        "RBAC Access Matrix",
			Description: "RBAC Access Matrix",
			MimeType:    "text/markdown",
		},
	}
}

func (r *ToolRegistry) GetResourceTemplates() []ResourceTemplateDefinition {
	return []ResourceTemplateDefinition{
		{
			URITemplate: "clinic://schema/{model_name}",
			Name:        "Database Model Detail",
			Description: "Database Model Detail",
			MimeType:    "text/markdown",
		},
		{
			URITemplate: "clinic://controller/{name}",
			Name:        "Controller Source Summary",
			Description: "Controller Source Summary",
			MimeType:    "text/markdown",
		},
	}
}

func (r *ToolRegistry) ReadResource(uri string) (string, string, error) {
	// Ensure latest dynamic content
	r.Refresh()

	switch {
	case uri == "clinic://schema/models":
		content, err := r.handleGetSchema("")
		if err != nil {
			return "", "", err
		}
		return content, "text/markdown", nil

	case strings.HasPrefix(uri, "clinic://schema/"):
		modelName := strings.TrimPrefix(uri, "clinic://schema/")
		if modelName != "" && !strings.Contains(modelName, "/") {
			content, err := r.handleGetSchema(modelName)
			if err != nil {
				return "", "", err
			}
			return content, "text/markdown", nil
		}

	case uri == "clinic://routes":
		content, err := r.handleGetRoutes("")
		if err != nil {
			return "", "", err
		}
		return content, "text/markdown", nil

	case uri == "clinic://config/env":
		envPath := filepath.Join(r.RootPath, "golang-backend", ".env.example")
		content, err := os.ReadFile(envPath)
		if err != nil {
			return "DEFAULT_ENV=true\n", "text/plain", nil
		}
		return string(content), "text/plain", nil

	case uri == "clinic://structure":
		tree, err := r.getProjectTree(r.RootPath, 4)
		if err != nil {
			return "", "", fmt.Errorf("failed to generate structure: %v", err)
		}
		return tree, "text/plain", nil

	case uri == "clinic://rbac":
		content, err := r.handleGetRBACMatrix()
		if err != nil {
			return "", "", err
		}
		return content, "text/markdown", nil

	case strings.HasPrefix(uri, "clinic://controller/"):
		name := strings.TrimPrefix(uri, "clinic://controller/")
		if name != "" && !strings.Contains(name, "/") {
			content, err := r.readController(name)
			if err != nil {
				return "", "", fmt.Errorf("controller not found: %v", err)
			}
			return content, "text/markdown", nil
		}
	}

	return "", "", fmt.Errorf("resource not found: %s", uri)
}

func (r *ToolRegistry) getProjectTree(root string, maxDepth int) (string, error) {
	var builder strings.Builder

	skipDirs := map[string]bool{
		"node_modules": true,
		".git":         true,
		"dist":         true,
		"__pycache__":  true,
		".next":        true,
		"vendor":       true,
	}

	err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		relPath, err := filepath.Rel(root, path)
		if err != nil {
			return nil
		}

		if relPath == "." {
			builder.WriteString(filepath.Base(root) + "\n")
			return nil
		}

		parts := strings.Split(relPath, string(filepath.Separator))
		depth := len(parts)

		if info.IsDir() {
			if skipDirs[info.Name()] {
				return filepath.SkipDir
			}
			if depth > maxDepth {
				return filepath.SkipDir
			}
		}

		if depth > maxDepth {
			return nil
		}

		indent := strings.Repeat("  ", depth)
		builder.WriteString(indent + info.Name() + "\n")
		return nil
	})

	return builder.String(), err
}

func (r *ToolRegistry) readController(name string) (string, error) {
	paths := []string{
		filepath.Join(r.RootPath, "golang-backend", "internal", "controllers", fmt.Sprintf("%s_controller.go", name)),
		filepath.Join(r.RootPath, "golang-backend", "internal", "controllers", fmt.Sprintf("%s.go", name)),
	}

	for _, p := range paths {
		content, err := os.ReadFile(p)
		if err == nil {
			return string(content), nil
		}
	}
	return "", fmt.Errorf("controller %s not found", name)
}
