package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

// struct ของ Config ในการ login database
type Config struct {
	Port       string
	DBHost     string
	DBUser     string
	DBPassword string
	DBName     string
	DBPort     string
	DBSSLMode  string
	JWTSecret  string
}

// define Config เป็น Global
var AppConfig *Config

// Load data from .env for database
func LoadConfig() {
	// ค้นหาและโหลดไฟล์ .env จากหลายตำแหน่งที่อาจรันคำสั่ง
	loadEnvFile := func(path string) bool {
		data, err := os.ReadFile(path)
		if err != nil {
			return false
		}
		// Strip UTF-8 BOM if present
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

	loaded := loadEnvFile(".env") ||
		loadEnvFile("golang-backend/.env") ||
		loadEnvFile("../.env") ||
		loadEnvFile("../../.env") ||
		loadEnvFile("../../golang-backend/.env")

	if !loaded {
		log.Println("Notice: No .env file found in default paths, checking environment variables or fallback defaults.")
	}

	AppConfig = &Config{

		Port:       getEnv("PORT", "8080"),
		DBHost:     getEnv("DB_HOST", "localhost"),
		DBUser:     getEnv("DB_USER", "postgres"),
		DBPassword: getEnv("DB_PASSWORD", ""),
		DBName:     getEnv("DB_NAME", "postgres"),
		DBPort:     getEnv("DB_PORT", "5432"),
		DBSSLMode:  getEnv("DB_SSLMODE", "disable"),
		JWTSecret:  getEnv("JWT_SECRET", "supersecretclinicjwtkey2026"),
	}
	log.Println("Configuration Loaded Successfully.")
}

// getting data from .env fucntion return as string
func getEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}
