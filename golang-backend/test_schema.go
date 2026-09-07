//go:build ignore

package main

import (
	"fmt"
	"gorm.io/gorm/schema"
	"clinic-backend/internal/models"
	"sync"
)

func main() {
	cacheStore := &sync.Map{}
	sch, _ := schema.Parse(&models.Doctor{}, cacheStore, schema.NamingStrategy{})
	sch2, _ := schema.Parse(&models.Appointment{}, cacheStore, schema.NamingStrategy{})

	for _, rel := range sch.Relationships.Relations {
		fmt.Printf("Doctor Rel: %s, Type: %s, FK: %s -> %s\n", rel.Name, rel.Type, rel.References[0].ForeignKey.Name, rel.References[0].PrimaryKey.Name)
	}
	for _, rel := range sch2.Relationships.Relations {
		fmt.Printf("Appointment Rel: %s, Type: %s, FK: %s -> %s\n", rel.Name, rel.Type, rel.References[0].ForeignKey.Name, rel.References[0].PrimaryKey.Name)
	}
}
