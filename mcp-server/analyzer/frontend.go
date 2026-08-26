package analyzer

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

type RolePermission struct {
	Role         string   `json:"role"`
	TitleTh      string   `json:"title_th"`
	TitleEn      string   `json:"title_en"`
	Department   string   `json:"department"`
	AllowedPages []string `json:"allowed_pages"`
	SidebarMenus []string `json:"sidebar_menus"`
	DefaultPage  string   `json:"default_page"`
}

type FrontendInterface struct {
	Name   string            `json:"name"`
	File   string            `json:"file"`
	Fields map[string]string `json:"fields"`
}

type FrontendAnalyzer struct {
	RootPath    string
	Roles       map[string]*RolePermission
	Interfaces  map[string]FrontendInterface
	PageConfigs map[string][]string
}

func NewFrontendAnalyzer(rootPath string) *FrontendAnalyzer {
	return &FrontendAnalyzer{
		RootPath:    rootPath,
		Roles:       make(map[string]*RolePermission),
		Interfaces:  make(map[string]FrontendInterface),
		PageConfigs: make(map[string][]string),
	}
}

func (f *FrontendAnalyzer) Analyze() error {
	rolesFile := filepath.Join(f.RootPath, "react-frontend", "src", "config", "roles.ts")
	f.parseRolesConfig(rolesFile)

	srcDir := filepath.Join(f.RootPath, "react-frontend", "src")
	f.scanTypeScriptInterfaces(srcDir)
	return nil
}

func (f *FrontendAnalyzer) parseRolesConfig(rolesFile string) {
	content, err := os.ReadFile(rolesFile)
	if err != nil {
		return
	}

	text := string(content)

	// Roles default list
	roleKeys := []string{"registrar", "nurse", "nurse_assistant", "pharmacist", "cashier"}
	for _, r := range roleKeys {
		f.Roles[r] = &RolePermission{
			Role:         r,
			AllowedPages: make([]string, 0),
			SidebarMenus: make([]string, 0),
		}
	}

	// Parse DEMO_USERS roleTitleTh, roleTitleEn, department
	userBlockRe := regexp.MustCompile(`(?s)(\w+):\s*\{\s*id:\s*'[^']+',\s*username:\s*'[^']+',\s*fullName:\s*'([^']+)',\s*role:\s*'(\w+)',\s*roleTitleTh:\s*'([^']+)',\s*roleTitleEn:\s*'([^']+)',\s*department:\s*'([^']+)'`)
	matches := userBlockRe.FindAllStringSubmatch(text, -1)
	for _, m := range matches {
		roleName := m[3]
		if rp, exists := f.Roles[roleName]; exists {
			rp.TitleTh = m[4]
			rp.TitleEn = m[5]
			rp.Department = m[6]
		}
	}

	// Parse PAGE_PERMISSIONS e.g. 'registration': ['registrar']
	pagePermRe := regexp.MustCompile(`'([a-zA-Z0-9_-]+)':\s*\[([^\]]+)\]`)
	pagePermMatches := pagePermRe.FindAllStringSubmatch(text, -1)
	for _, m := range pagePermMatches {
		page := m[1]
		rolesRaw := m[2]
		rolesList := strings.Split(rolesRaw, ",")
		var allowedRoles []string
		for _, r := range rolesList {
			rClean := strings.Trim(strings.TrimSpace(r), "'\"")
			if rClean != "" {
				allowedRoles = append(allowedRoles, rClean)
				if rp, exists := f.Roles[rClean]; exists {
					rp.AllowedPages = append(rp.AllowedPages, page)
				}
			}
		}
		f.PageConfigs[page] = allowedRoles
	}

	// Parse ROLE_DEFAULT_PAGES e.g. registrar: 'registration'
	defPageRe := regexp.MustCompile(`(\w+):\s*'([a-zA-Z0-9_-]+)'`)
	defMatches := defPageRe.FindAllStringSubmatch(text, -1)
	for _, m := range defMatches {
		roleName := m[1]
		defPage := m[2]
		if rp, exists := f.Roles[roleName]; exists {
			rp.DefaultPage = defPage
		}
	}

	// Parse ROLE_MENUS e.g. title: 'ลงทะเบียนผู้ป่วย'
	menuBlockRe := regexp.MustCompile(`(?s)(\w+):\s*\[(.*?)\]\s*,`)
	menuMatches := menuBlockRe.FindAllStringSubmatch(text, -1)
	titleRe := regexp.MustCompile(`title:\s*'([^']+)'`)
	for _, m := range menuMatches {
		roleName := m[1]
		menuItems := m[2]
		titles := titleRe.FindAllStringSubmatch(menuItems, -1)
		for _, t := range titles {
			if rp, exists := f.Roles[roleName]; exists {
				rp.SidebarMenus = append(rp.SidebarMenus, t[1])
			}
		}
	}
}

func (f *FrontendAnalyzer) scanTypeScriptInterfaces(dir string) {
	_ = filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() || (!strings.HasSuffix(path, ".ts") && !strings.HasSuffix(path, ".tsx")) {
			return nil
		}

		content, err := os.ReadFile(path)
		if err != nil {
			return nil
		}

		relPath, _ := filepath.Rel(f.RootPath, path)
		text := string(content)

		// Regex for interface Foo { ... }
		ifaceRe := regexp.MustCompile(`(?s)export\s+interface\s+(\w+)\s*\{([^}]+)\}`)
		matches := ifaceRe.FindAllStringSubmatch(text, -1)
		for _, m := range matches {
			ifName := m[1]
			body := m[2]
			fields := make(map[string]string)

			lines := strings.Split(body, "\n")
			for _, line := range lines {
				line = strings.TrimSpace(line)
				if line == "" || strings.HasPrefix(line, "//") || strings.HasPrefix(line, "/*") {
					continue
				}
				parts := strings.SplitN(line, ":", 2)
				if len(parts) == 2 {
					fName := strings.Trim(strings.TrimSpace(parts[0]), "?")
					fType := strings.Trim(strings.TrimSpace(parts[1]), ";,")
					if fName != "" {
						fields[fName] = fType
					}
				}
			}

			f.Interfaces[ifName] = FrontendInterface{
				Name:   ifName,
				File:   relPath,
				Fields: fields,
			}
		}

		return nil
	})
}
