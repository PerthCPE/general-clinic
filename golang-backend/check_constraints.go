package main

import (
	"fmt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	dsn := "host=aws-0-ap-southeast-1.pooler.supabase.com user=postgres.kcazbnexepowjvuhmwkl password=SACLINICDATABASEPASSWORD dbname=postgres port=6543 sslmode=require"
	db, _ := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	
	type Constraint struct {
		Conname string
	}
	var constraints []Constraint
	db.Raw("SELECT conname FROM pg_constraint WHERE conrelid = 'appointment_tests'::regclass").Scan(&constraints)
	for _, c := range constraints {
		fmt.Println("Constraint:", c.Conname)
	}
}
