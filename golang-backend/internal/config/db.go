package config

import (
	"fmt"
	"log"

	"clinic-backend/internal/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"golang.org/x/crypto/bcrypt"
)

// define global db for handler/controller
var	DB *gorm.DB

func ConnectDB() {
	// ประกอบ Data from AppConfig
	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=%s TimeZone=Asia/Bangkok",
			AppConfig.DBHost,	
			AppConfig.DBUser,	
			AppConfig.DBPassword,	
			AppConfig.DBName,	
			AppConfig.DBPort,
			AppConfig.DBSSLMode,	
	)

	// gorm connect to db

	database, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})

	if err != nil {
		log.Fatal("Failed to connect database. Error: ", err)
	}

	log.Println("Database Connection Established Successfully")

	// table create by migration (only use err for create only)
	err = database.AutoMigrate(
		&models.User{},
		&models.Patient{},
		&models.MedicalEligibility{},
		&models.VisitRecord{},
		&models.Queue{},
		&models.Screening{},
		&models.Medicine{},
		&models.Billing{},
	)

	// if error founded, notice
	if err != nil {
		log.Fatal("Database Migration Failed. Error: ", err)
	}
	log.Println("Database Migration Complete.")

	DB = database

	seedUsers()
}

func seedUsers() {
	var count int64
	// ค้นหาว่ามีข้อมูล User อยู่ในตารางไหม
	DB.Model(&models.User{}).Count(&count)
	if count == 0 {
		// แฮชพาสเวิร์ด "password" เพื่อความปลอดภัยก่อนเซฟลง DB
		hashReg, _ := bcrypt.GenerateFromPassword([]byte("password"), 10)
		registrar := models.User{
			Username: "registrar1",
			Password: string(hashReg),
			Role:     "registrar",
		}
		hashNurse, _ := bcrypt.GenerateFromPassword([]byte("password"), 10)
		nurse := models.User{
			Username: "nurse1",
			Password: string(hashNurse),
			Role:     "nurse",
		}
		// บันทึกลงฐานข้อมูล
		DB.Create(&registrar)
		DB.Create(&nurse)
		log.Println("Demo users seeded: registrar1, nurse1 (password: password)")
	}
}