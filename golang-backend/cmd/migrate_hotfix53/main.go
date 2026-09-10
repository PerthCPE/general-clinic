package main

import (
	"fmt"
	"log"

	"clinic-backend/internal/config"
)

type StatusDeptCount struct {
	Status     string `gorm:"column:status"`
	Department string `gorm:"column:department"`
	Count      int64  `gorm:"column:count"`
}

func main() {
	config.LoadConfig()
	config.ConnectDB()
	db := config.DB

	fmt.Println("================================================================================")
	fmt.Println("HOTFIX-5.3: Running Approved Database Migration")
	fmt.Println("================================================================================")

	// Task B: Run 3 Approved Migration Statements
	// Query 1: รอรับยา -> ห้องจ่ายยาและเภสัชกรรม
	q1 := "UPDATE queues SET department = 'ห้องจ่ายยาและเภสัชกรรม', updated_at = NOW() WHERE status = 'รอรับยา' AND department != 'ห้องจ่ายยาและเภสัชกรรม';"
	res1 := db.Exec(q1)
	if res1.Error != nil {
		log.Fatalf("Error executing Query 1: %v", res1.Error)
	}
	fmt.Printf("[Query 1 - รอรับยา -> ห้องจ่ายยาและเภสัชกรรม]\nRows affected: %d\n\n", res1.RowsAffected)

	// Query 2: เสร็จสิ้น -> เสร็จสิ้นขั้นตอนการรักษา
	q2 := "UPDATE queues SET department = 'เสร็จสิ้นขั้นตอนการรักษา', updated_at = NOW() WHERE status = 'เสร็จสิ้น' AND department != 'เสร็จสิ้นขั้นตอนการรักษา';"
	res2 := db.Exec(q2)
	if res2.Error != nil {
		log.Fatalf("Error executing Query 2: %v", res2.Error)
	}
	fmt.Printf("[Query 2 - เสร็จสิ้น -> เสร็จสิ้นขั้นตอนการรักษา]\nRows affected: %d\n\n", res2.RowsAffected)

	// Query 3: รอคัดกรอง -> จุดคัดกรอง
	q3 := "UPDATE queues SET department = 'จุดคัดกรอง', updated_at = NOW() WHERE status = 'รอคัดกรอง' AND (department IS NULL OR department = '' OR department = 'แผนกคัดกรอง');"
	res3 := db.Exec(q3)
	if res3.Error != nil {
		log.Fatalf("Error executing Query 3: %v", res3.Error)
	}
	fmt.Printf("[Query 3 - รอคัดกรอง -> จุดคัดกรอง]\nRows affected: %d\n\n", res3.RowsAffected)

	// Task C: Verification Query
	fmt.Println("================================================================================")
	fmt.Println("HOTFIX-5.3: Task C Verification Results")
	fmt.Println("SELECT status, department, COUNT(*) as count FROM queues GROUP BY status, department ORDER BY status;")
	fmt.Println("================================================================================")

	var results []StatusDeptCount
	err := db.Raw("SELECT status, department, COUNT(*) as count FROM queues GROUP BY status, department ORDER BY status ASC, department ASC").Scan(&results).Error
	if err != nil {
		log.Fatalf("Error running verification query: %v", err)
	}

	fmt.Printf("%-20s | %-40s | %-10s\n", "Status", "Department", "Count")
	fmt.Println("---------------------+------------------------------------------+-----------")
	for _, r := range results {
		fmt.Printf("%-20s | %-40s | %-10d\n", r.Status, r.Department, r.Count)
	}
	fmt.Println("================================================================================")
}
