package main

import (
	"fmt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

type UserTest struct {
	ID   uint `gorm:"primaryKey"`
	Name string
}

type DoctorTest struct {
	ID           uint `gorm:"primaryKey"`
	UserID       uint
	Appointments []AppointmentTest `gorm:"foreignKey:DoctorID"`
}

type AppointmentTest struct {
	ID       uint `gorm:"primaryKey"`
	DoctorID uint
	Doctor   UserTest `gorm:"foreignKey:DoctorID"` // I change it to point to UserTest
}

func main() {
	dsn := "host=aws-0-ap-southeast-1.pooler.supabase.com user=postgres.kcazbnexepowjvuhmwkl password=SACLINICDATABASEPASSWORD dbname=postgres port=6543 sslmode=require"
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		panic(err)
	}

	// Drop tables for clean test
	db.Exec("DROP TABLE IF EXISTS appointment_tests CASCADE")
	db.Exec("DROP TABLE IF EXISTS doctor_tests CASCADE")
	db.Exec("DROP TABLE IF EXISTS user_tests CASCADE")

	// AutoMigrate
	err = db.AutoMigrate(&UserTest{}, &DoctorTest{}, &AppointmentTest{})
	if err != nil {
		fmt.Println("AutoMigrate Error:", err)
		return
	}

	fmt.Println("AutoMigrate successful")
}
