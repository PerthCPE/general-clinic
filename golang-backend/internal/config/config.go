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
	if err := godotenv.Load(); err != nil {
		if err2 := godotenv.Load("golang-backend/.env"); err2 != nil {
			if err3 := godotenv.Load("../.env"); err3 != nil {
				log.Println("Notice: No .env file found in default paths, checking environment variables or fallback defaults.")
			}
		}
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
