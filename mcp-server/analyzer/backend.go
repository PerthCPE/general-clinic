package analyzer

import (
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"reflect"
	"strings"
)

type FieldInfo struct {
	Name     string `json:"name"`
	Type     string `json:"type"`
	Tag      string `json:"tag,omitempty"`
	JSONTag  string `json:"json_tag,omitempty"`
	GORMTag  string `json:"gorm_tag,omitempty"`
	Comment  string `json:"comment,omitempty"`
}

type StructInfo struct {
	Name    string      `json:"name"`
	Doc     string      `json:"doc,omitempty"`
	File    string      `json:"file"`
	Fields  []FieldInfo `json:"fields"`
}

type RouteInfo struct {
	Method      string   `json:"method"`
	Path        string   `json:"path"`
	Handler     string   `json:"handler"`
	Roles       []string `json:"roles"`
	Group       string   `json:"group"`
	Description string   `json:"description,omitempty"`
}

type BackendAnalyzer struct {
	RootPath string
	Models   map[string]StructInfo
	DTOs     map[string]StructInfo
	Routes   []RouteInfo
}

func NewBackendAnalyzer(rootPath string) *BackendAnalyzer {
	return &BackendAnalyzer{
		RootPath: rootPath,
		Models:   make(map[string]StructInfo),
		DTOs:     make(map[string]StructInfo),
		Routes:   make([]RouteInfo, 0),
	}
}

func (b *BackendAnalyzer) Analyze() error {
	modelsDir := filepath.Join(b.RootPath, "golang-backend", "internal", "models")
	if err := b.parseStructsInDir(modelsDir, b.Models); err != nil {
		// Log or ignore if path not found
	}

	dtoDir := filepath.Join(b.RootPath, "golang-backend", "internal", "dto")
	if err := b.parseStructsInDir(dtoDir, b.DTOs); err != nil {
		// Log or ignore
	}

	routesFile := filepath.Join(b.RootPath, "golang-backend", "internal", "routes", "routes.go")
	b.parseRoutes(routesFile)

	return nil
}

func (b *BackendAnalyzer) parseStructsInDir(dir string, dest map[string]StructInfo) error {
	fset := token.NewFileSet()
	entries, err := os.ReadDir(dir)
	if err != nil {
		return err
	}

	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".go") {
			continue
		}

		filePath := filepath.Join(dir, entry.Name())
		node, err := parser.ParseFile(fset, filePath, nil, parser.ParseComments)
		if err != nil {
			continue
		}

		for _, decl := range node.Decls {
			genDecl, ok := decl.(*ast.GenDecl)
			if !ok || genDecl.Tok != token.TYPE {
				continue
			}

			doc := ""
			if genDecl.Doc != nil {
				doc = strings.TrimSpace(genDecl.Doc.Text())
			}

			for _, spec := range genDecl.Specs {
				typeSpec, ok := spec.(*ast.TypeSpec)
				if !ok {
					continue
				}

				structType, ok := typeSpec.Type.(*ast.StructType)
				if !ok {
					continue
				}

				info := StructInfo{
					Name:   typeSpec.Name.Name,
					Doc:    doc,
					File:   entry.Name(),
					Fields: make([]FieldInfo, 0),
				}

				if typeSpec.Doc != nil && info.Doc == "" {
					info.Doc = strings.TrimSpace(typeSpec.Doc.Text())
				}

				for _, field := range structType.Fields.List {
					typeName := exprToString(field.Type)
					tagVal := ""
					jsonTag := ""
					gormTag := ""
					if field.Tag != nil {
						rawTag := strings.Trim(field.Tag.Value, "`")
						tagVal = rawTag
						sTag := reflect.StructTag(rawTag)
						jsonTag = sTag.Get("json")
						gormTag = sTag.Get("gorm")
					}

					comment := ""
					if field.Comment != nil {
						comment = strings.TrimSpace(field.Comment.Text())
					}

					if len(field.Names) == 0 {
						// Embedded struct
						info.Fields = append(info.Fields, FieldInfo{
							Name:    typeName,
							Type:    typeName,
							Tag:     tagVal,
							JSONTag: jsonTag,
							GORMTag: gormTag,
							Comment: comment,
						})
					} else {
						for _, fieldName := range field.Names {
							info.Fields = append(info.Fields, FieldInfo{
								Name:    fieldName.Name,
								Type:    typeName,
								Tag:     tagVal,
								JSONTag: jsonTag,
								GORMTag: gormTag,
								Comment: comment,
							})
						}
					}
				}

				dest[info.Name] = info
			}
		}
	}
	return nil
}

func (b *BackendAnalyzer) parseRoutes(routesFile string) {
	content, err := os.ReadFile(routesFile)
	if err != nil {
		return
	}

	lines := strings.Split(string(content), "\n")
	var currentGroup string
	var currentRoles []string

	for i, line := range lines {
		trimmed := strings.TrimSpace(line)

		// Group detection e.g. registrarRoutes := api.Group("/registrar")
		if strings.Contains(trimmed, ".Group(") {
			parts := strings.Split(trimmed, ".Group(")
			if len(parts) == 2 {
				grp := strings.Trim(parts[1], ")\" ")
				currentGroup = grp
				currentRoles = nil
			}
		}

		// RoleRequired detection e.g. RoleRequired("nurse", "nurse_assistant")
		if strings.Contains(trimmed, "RoleRequired(") {
			idx := strings.Index(trimmed, "RoleRequired(")
			if idx != -1 {
				sub := trimmed[idx+len("RoleRequired("):]
				endIdx := strings.Index(sub, ")")
				if endIdx != -1 {
					roleArg := sub[:endIdx]
					rawRoles := strings.Split(roleArg, ",")
					currentRoles = make([]string, 0)
					for _, r := range rawRoles {
						cleaned := strings.Trim(strings.TrimSpace(r), "\"")
						if cleaned != "" {
							currentRoles = append(currentRoles, cleaned)
						}
					}
				}
			}
		}

		// Route mapping e.g. registrarRoutes.POST("/patients", controllers.RegisterPatient)
		for _, method := range []string{"POST", "GET", "PUT", "DELETE", "PATCH"} {
			pattern := fmt.Sprintf(".%s(", method)
			if strings.Contains(trimmed, pattern) {
				idx := strings.Index(trimmed, pattern)
				sub := trimmed[idx+len(pattern):]
				endIdx := strings.LastIndex(sub, ")")
				if endIdx != -1 {
					argsStr := sub[:endIdx]
					args := strings.SplitN(argsStr, ",", 2)
					path := strings.Trim(strings.TrimSpace(args[0]), "\"")
					handler := ""
					if len(args) > 1 {
						handler = strings.TrimSpace(args[1])
					}

					fullPath := path
					if currentGroup != "" && !strings.HasPrefix(path, currentGroup) && !strings.HasPrefix(path, "/api"+currentGroup) {
						fullPath = "/api" + currentGroup + path
					} else if !strings.HasPrefix(fullPath, "/api") && fullPath != "/login" {
						fullPath = "/api" + fullPath
					}

					desc := ""
					if i+1 < len(lines) && strings.HasPrefix(strings.TrimSpace(lines[i+1]), "//") {
						desc = strings.TrimPrefix(strings.TrimSpace(lines[i+1]), "//")
						desc = strings.TrimSpace(desc)
					}

					rolesCopy := make([]string, len(currentRoles))
					copy(rolesCopy, currentRoles)

					b.Routes = append(b.Routes, RouteInfo{
						Method:      method,
						Path:        fullPath,
						Handler:     handler,
						Roles:       rolesCopy,
						Group:       currentGroup,
						Description: desc,
					})
				}
			}
		}
	}
}

func exprToString(expr ast.Expr) string {
	switch t := expr.(type) {
	case *ast.Ident:
		return t.Name
	case *ast.SelectorExpr:
		return exprToString(t.X) + "." + t.Sel.Name
	case *ast.StarExpr:
		return "*" + exprToString(t.X)
	case *ast.ArrayType:
		return "[]" + exprToString(t.Elt)
	case *ast.MapType:
		return "map[" + exprToString(t.Key) + "]" + exprToString(t.Value)
	default:
		return fmt.Sprintf("%T", expr)
	}
}
