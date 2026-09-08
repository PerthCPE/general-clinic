package config

import (
	"log"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

// struct ของ Config ในการ login database
type Config struct {
	Port                   string
	DBHost                 string
	DBUser                 string
	DBPassword             string
	DBName                 string
	DBPort                 string
	DBSSLMode              string
	DBPrepareStmt          bool
	DBPreferSimpleProtocol bool
	JWTSecret              string
}

// define Config เป็น Global
var AppConfig *Config

// Load data from .env / .env.local for database
func LoadConfig() {
	// ค้นหาและโหลดไฟล์ .env / .env.local จากหลายตำแหน่งที่อาจรันคำสั่ง พร้อมตัด UTF-8 BOM
	loadEnvFile := func(path string) bool {
		data, err := os.ReadFile(path)
		if err != nil {
			return false
		}
		content := string(data)
		if len(content) >= 3 && content[0] == 0xEF && content[1] == 0xBB && content[2] == 0xBF {
			content = content[3:]
		}
		envMap, err := godotenv.Unmarshal(content)
		if err != nil {
			return false
		}
		for k, v := range envMap {
			if os.Getenv(k) == "" {
				os.Setenv(k, v)
			}
		}
		return true
	}

	loaded := loadEnvFile(".env.local") ||
		loadEnvFile(".env") ||
		loadEnvFile("golang-backend/.env.local") ||
		loadEnvFile("golang-backend/.env") ||
		loadEnvFile("../.env.local") ||
		loadEnvFile("../.env") ||
		loadEnvFile("../../.env.local") ||
		loadEnvFile("../../.env") ||
		loadEnvFile("../../golang-backend/.env.local") ||
		loadEnvFile("../../golang-backend/.env")

	if !loaded {
		log.Println("Notice: No .env file found in default paths, checking environment variables or fallback defaults.")
	}

	sslMode := getEnv("DB_SSLMODE", "disable")

	// Docker (sslmode=disable): PrepareStmt = true, PreferSimpleProtocol = false
	// Supabase (sslmode=require): PrepareStmt = false, PreferSimpleProtocol = true
	prepareDefault := "true"
	simpleDefault := "false"
	if strings.ToLower(sslMode) == "require" {
		prepareDefault = "false"
		simpleDefault = "true"
	}

	prepareStmtVal := getEnv("DB_PREPARE_STMT", prepareDefault)
	simpleProtocolVal := getEnv("DB_PREFER_SIMPLE_PROTOCOL", simpleDefault)

	AppConfig = &Config{
		Port:                   getEnv("PORT", "8080"),
		DBHost:                 getEnv("DB_HOST", "localhost"),
		DBUser:                 getEnv("DB_USER", "clinic"),
		DBPassword:             getEnv("DB_PASSWORD", "clinic_dev_2569"),
		DBName:                 getEnv("DB_NAME", "clinic"),
		DBPort:                 getEnv("DB_PORT", "5433"),
		DBSSLMode:              sslMode,
		DBPrepareStmt:          prepareStmtVal == "true" || prepareStmtVal == "1",
		DBPreferSimpleProtocol: simpleProtocolVal == "true" || simpleProtocolVal == "1",
		JWTSecret:              getEnv("JWT_SECRET", "supersecretclinicjwtkey2026"),
	}
	log.Printf("Configuration Loaded Successfully (Host: %s, Port: %s, SSLMode: %s, PrepareStmt: %v, SimpleProto: %v)",
		AppConfig.DBHost, AppConfig.DBPort, AppConfig.DBSSLMode, AppConfig.DBPrepareStmt, AppConfig.DBPreferSimpleProtocol)
}

// getting data from .env function return as string
func getEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}
