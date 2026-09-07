//go:build ignore

package main

import (
	"fmt"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	dsn := "host=aws-0-ap-southeast-1.pooler.supabase.com user=postgres.kcazbnexepowjvuhmwkl password=SACLINICDATABASEPASSWORD dbname=postgres port=6543 sslmode=require"
	db, _ := gorm.Open(postgres.Open(dsn), &gorm.Config{})

	var count int64
	db.Table("appointments").Count(&count)
	fmt.Println("Existing appointments count:", count)
}
