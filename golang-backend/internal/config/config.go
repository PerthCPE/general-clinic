package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

// struct ของ Config ในการ login database
type Config struct {
	Port		string
	DBHost		string
	DBUser		string
	DBPassword	string
	DBName		string
	DBPort		string
	DBSSLMode	string
	JWTSecret	string
}

// define Config เป็น Global
var AppConfig	*Config

// Load data from .env for database
func LoadConfig() {
	err := godotenv.Load()

	if err != nil {
		log.Println("Warning: No .env file found, using system environment variables.")
	}

	AppConfig = &Config {
		Port:			getEnv("PORT", "8080"),
		DBHost:			getEnv("DB_HOST", "localhost"),
		DBUser:			getEnv("DB_USER", "postgres"),
		DBPassword:		getEnv("DB_PASSWORD", ""),
		DBName:			getEnv("DB_NAME", "postgres"),
		DBPort:			getEnv("DB_PORT", "6543"),
		DBSSLMode:		getEnv("DB_SSLMODE", "disable"),
		JWTSecret:		getEnv("JWT_SECRET", "secret"),
	}
	log.Println("Configation Loaded Successfully.")
}

// getting data from .env fucntion return as string
func getEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}