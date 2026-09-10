package main

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"clinic-backend/internal/config"
)

func main() {
	config.LoadConfig()
	config.ConnectDB()
	db := config.DB

	log.Println("=======================================================")
	log.Println("General Clinic Migration Runner")
	log.Println("=======================================================")

	// 1. Ensure schema_migrations table exists
	createTableSQL := "CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(255) PRIMARY KEY, applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());"
	if err := db.Exec(createTableSQL).Error; err != nil {
		log.Fatalf("Failed to create schema_migrations table: %v", err)
	}

	// 2. Locate migrations directory
	searchPaths := []string{
		"migrations",
		"golang-backend/migrations",
		"../migrations",
		"../../migrations",
	}

	var migrationDir string
	for _, p := range searchPaths {
		if stat, err := os.Stat(p); err == nil && stat.IsDir() {
			migrationDir = p
			break
		}
	}

	if migrationDir == "" {
		log.Fatalf("Migrations directory not found in any search path: %v", searchPaths)
	}

	log.Printf("Found migrations directory: %s", migrationDir)

	// 3. Read and sort all .sql files
	files, err := os.ReadDir(migrationDir)
	if err != nil {
		log.Fatalf("Failed to read migrations directory: %v", err)
	}

	var sqlFiles []string
	for _, f := range files {
		if !f.IsDir() && strings.HasSuffix(f.Name(), ".sql") {
			sqlFiles = append(sqlFiles, f.Name())
		}
	}
	sort.Strings(sqlFiles)

	if len(sqlFiles) == 0 {
		log.Println("No .sql migration files found.")
		return
	}

	// 4. Fetch already applied migration versions
	var appliedVersions []string
	if err := db.Raw("SELECT version FROM schema_migrations ORDER BY version ASC").Scan(&appliedVersions).Error; err != nil {
		log.Fatalf("Failed to query schema_migrations: %v", err)
	}

	appliedMap := make(map[string]bool)
	for _, v := range appliedVersions {
		appliedMap[v] = true
	}

	// 5. Execute pending migrations sequentially
	appliedCount := 0
	for _, file := range sqlFiles {
		if appliedMap[file] {
			log.Printf("[SKIPPED] %s (already applied)", file)
			continue
		}

		filePath := filepath.Join(migrationDir, file)
		content, err := os.ReadFile(filePath)
		if err != nil {
			log.Fatalf("Failed to read migration file %s: %v", file, err)
		}

		log.Printf("[APPLYING] %s ...", file)
		sqlStr := strings.TrimSpace(string(content))
		if sqlStr == "" {
			log.Printf("[WARNING] %s is empty, marking as applied.", file)
		} else {
			sqlDB, err := db.DB()
			if err != nil {
				log.Fatalf("Failed to retrieve underlying database connection: %v", err)
			}
			if _, err := sqlDB.Exec(sqlStr); err != nil {
				log.Fatalf("[FAILED] Migration %s failed: %v", file, err)
			}
		}

		// Record applied version
		if err := db.Exec("INSERT INTO schema_migrations (version, applied_at) VALUES (?, NOW())", file).Error; err != nil {
			log.Fatalf("Failed to record migration version %s: %v", file, err)
		}

		log.Printf("[SUCCESS] %s applied successfully.", file)
		appliedCount++
	}

	log.Println("=======================================================")
	if appliedCount > 0 {
		fmt.Printf("Successfully applied %d pending migration(s)!\n", appliedCount)
	} else {
		fmt.Println("Database schema is completely up to date. No pending migrations.")
	}
	log.Println("=======================================================")
}
