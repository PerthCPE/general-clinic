package controllers

import (
	"clinic-backend/internal/dto"
	"clinic-backend/internal/models"
	crand "crypto/rand"
	"fmt"
	"math/big"
	"net/http"
	"regexp"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// เบอร์โทรของบัญชีพนักงานต้องเป็นตัวเลขล้วน 10 หลักพอดี ขึ้นต้นด้วย 0 (เช่น 0812345678) —
// ไม่รับขีด/วงเล็บ/ช่องว่าง เช็คซ้ำที่นี่แม้ frontend (UserManagement.tsx) จะบังคับรูปแบบเดียวกัน
// อยู่แล้ว เพราะยิง API ตรงข้าม frontend (เช่น curl/Postman) ต้องโดนปฏิเสธเหมือนกัน
var phoneRegex = regexp.MustCompile(`^0\d{9}$`)

func validatePhone(phone string) error {
	if !phoneRegex.MatchString(phone) {
		return fmt.Errorf("เบอร์โทรศัพท์ต้องเป็นตัวเลข 10 หลักและขึ้นต้นด้วย 0 เท่านั้น (ได้รับ: %q)", phone)
	}
	return nil
}

// countActiveAdmins นับจำนวนบัญชี role=admin ที่สถานะยัง active อยู่ในระบบ ใช้เช็คก่อนระงับ/
// เปลี่ยน role/ลบบัญชี admin ว่าจะทำให้ระบบเหลือ admin ที่ใช้งานได้จริง 0 คนหรือไม่
func countActiveAdmins(db *gorm.DB) (int64, error) {
	var count int64
	err := db.Model(&models.User{}).Where("role = ? AND status = ?", "admin", "active").Count(&count).Error
	return count, err
}

// currentUserID ดึง user id ของผู้ที่ยิง request นี้จาก JWT claims (ตั้งไว้โดย
// middleware.AuthRequired ผ่าน c.Set("userID", claims["user_id"])) — claims ที่ผ่าน jwt.MapClaims
// จะ decode ตัวเลขทุกตัวเป็น float64 เสมอ (พฤติกรรมมาตรฐานของ encoding/json ตอน unmarshal ใส่
// interface{}) ต้องแปลงกลับเป็น uint เองก่อนเทียบกับ models.User.ID
func currentUserID(c *gin.Context) (uint, bool) {
	raw, exists := c.Get("userID")
	if !exists {
		return 0, false
	}
	switch v := raw.(type) {
	case float64:
		return uint(v), true
	case uint:
		return v, true
	case int:
		return uint(v), true
	default:
		return 0, false
	}
}

// AdminController จัดการระบบสิทธิ์และบัญชี
type AdminController struct {
	DB *gorm.DB
}

func NewAdminController(db *gorm.DB) *AdminController {
	return &AdminController{DB: db}
}

// --- Accounts ---

func (ctrl *AdminController) GetAccounts(c *gin.Context) {
	var users []models.User
	// Order("id asc") ให้ผลลัพธ์มาตามลำดับคงที่เสมอ — เดิมไม่มี ORDER BY เลย ทำให้ Postgres
	// คืนแถวตามลำดับที่ไม่รับประกัน (โดยเฉพาะหลัง UPDATE แถวใดแถวหนึ่ง ตำแหน่งจริงในผลลัพธ์อาจ
	// เปลี่ยนได้) ฝั่ง UserManagement.tsx ตัดแสดงแค่ itemsPerPage แถวแรกโดยไม่มีปุ่มไปหน้าถัดไป
	// ผู้ใช้ที่เพิ่งถูก UPDATE (เช่น รีเซ็ตรหัสผ่าน) จึงเสี่ยงเด้งหลุดออกจากรายการที่มองเห็นได้
	if err := ctrl.DB.Preload("SystemAccesses").Order("id asc").Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch accounts"})
		return
	}
	c.JSON(http.StatusOK, users)
}

func (ctrl *AdminController) CreateAccount(c *gin.Context) {
	var req dto.CreateAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := validatePhone(req.Phone); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Auto-generate employee_id if not provided
	if req.EmployeeID == "" {
		var count int64
		ctrl.DB.Model(&models.User{}).Count(&count)
		req.EmployeeID = fmt.Sprintf("EMP%04d", count+1)
	}

	// Auto-generate username if not provided
	if req.Username == "" {
		req.Username = req.EmployeeID
	}

	// Auto-generate password if not provided
	tempPassword := req.Password
	if tempPassword == "" {
		tempPassword = req.EmployeeID // temp password = employee_id
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(tempPassword), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	user := models.User{
		Username:               req.Username,
		Email:                  req.Username + "@clinic.com",
		Password:               string(hashed),
		Role:                   req.Role,
		FullName:               req.FullName,
		EmployeeID:             req.EmployeeID,
		Phone:                  req.Phone,
		Department:             req.Department,
		// บัญชีที่ admin สร้างใหม่ผ่านหน้า UserManagement ต้องเริ่มที่ "รอการยืนยัน" (pending) จริง
		// ตามที่ UI แจ้งไว้ (เดิม hardcode เป็น active ทำให้ข้อความในฟอร์มไม่ตรงกับสถานะจริง) —
		// ไม่กระทบ Login()/QuickLogin() ใน auth.go เพราะจุดนั้นบล็อกแค่ suspended/inactive อยู่แล้ว
		// ไม่เคยบล็อก pending — และไม่มีจุดไหนในระบบ (GetDoctors, GetAccounts, appointment/queue
		// controllers) กรองรายชื่อด้วย status == active เลย จึงไม่ทำให้บัญชีใหม่หายจาก list ไหน
		Status:                 "pending",
		RequiresPasswordChange: true,
	}

	if err := ctrl.DB.Create(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create account"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"user": user, "temporary_password": tempPassword})
}

func (ctrl *AdminController) UpdateAccountStatus(c *gin.Context) {
	id := c.Param("id")
	var req dto.UpdateAccountStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// ต้องโหลดบัญชีเป้าหมายมาก่อนเสมอ (เดิมไม่โหลดเลย ยิง UPDATE ตรงๆ ด้วย id ที่อาจไม่มีจริงก็ได้
	// แบบเงียบๆ) เพราะ guard ด้านล่างต้องรู้ role/status ปัจจุบันของบัญชีนี้ก่อนอนุญาตเปลี่ยนสถานะ
	var user models.User
	if err := ctrl.DB.First(&user, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// ห้าม admin ระงับ/เปลี่ยนสถานะบัญชีของตัวเอง (ไม่ว่าจะเป็น admin คนสุดท้ายหรือไม่ก็ตาม) —
	// endpoint นี้อยู่หลัง RoleRequired("admin") เสมอ ผู้ยิง request จึงเป็น admin แน่นอน
	if selfID, ok := currentUserID(c); ok && selfID == user.ID && req.Status != "active" {
		c.JSON(http.StatusForbidden, gin.H{"error": "ไม่สามารถระงับบัญชีของตัวเองได้"})
		return
	}

	// ห้ามระงับ/เปลี่ยนสถานะผู้ดูแลระบบ (admin) ที่ active อยู่คนสุดท้ายของระบบ — กันไม่ให้ระบบเหลือ
	// admin ที่ใช้งานได้จริง 0 คน (กฎ "admin คนสุดท้าย")
	if user.Role == "admin" && user.Status == "active" && req.Status != "active" {
		count, err := countActiveAdmins(ctrl.DB)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify admin count"})
			return
		}
		if count <= 1 {
			c.JSON(http.StatusConflict, gin.H{"error": "ไม่สามารถระงับบัญชีผู้ดูแลระบบคนสุดท้ายที่ใช้งานอยู่ได้"})
			return
		}
	}

	if err := ctrl.DB.Model(&user).Update("status", req.Status).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update status"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Status updated successfully"})
}

// UpdateAccount แก้ไขบัญชีทั้งใบ (ชื่อ/เบอร์โทร/ตำแหน่ง/แผนก/สถานะ)
// ต่างจาก UpdateAccountStatus ที่แก้ได้แค่ status อย่างเดียว
// (ตัดฟิลด์ email ออกจากงานนี้แล้ว — งานลบ users.email เฟส 1 ดู PLAN.md)
func (ctrl *AdminController) UpdateAccount(c *gin.Context) {
	id := c.Param("id")
	var req dto.UpdateAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// ต้องโหลดบัญชีเป้าหมายมาก่อนเสมอ (เดิมไม่โหลดเลยจนกว่าจะ UPDATE เสร็จแล้ว) เพราะ guard ด้านล่าง
	// ต้องรู้ role/status ปัจจุบันก่อนอนุญาตเปลี่ยน role/status
	var user models.User
	if err := ctrl.DB.First(&user, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// ห้าม admin แก้ role ตัวเองให้หลุดจาก admin หรือ suspend ตัวเองผ่าน endpoint นี้ (เหมือนกับ
	// UpdateAccountStatus) — ไม่บล็อกการแก้ฟิลด์อื่น (ชื่อ/อีเมล/เบอร์/แผนก) ของตัวเอง
	if selfID, ok := currentUserID(c); ok && selfID == user.ID {
		if req.Role != "" && req.Role != "admin" {
			c.JSON(http.StatusForbidden, gin.H{"error": "ไม่สามารถเปลี่ยนตำแหน่ง (role) ของบัญชีตัวเองได้"})
			return
		}
		if req.Status != "" && req.Status != "active" {
			c.JSON(http.StatusForbidden, gin.H{"error": "ไม่สามารถระงับบัญชีของตัวเองได้"})
			return
		}
	}

	// ห้ามเปลี่ยน role ออกจาก admin หรือระงับสถานะของผู้ดูแลระบบ (admin) ที่ active อยู่คนสุดท้าย
	// ของระบบ — กันไม่ให้ระบบเหลือ admin ที่ใช้งานได้จริง 0 คน
	roleLeavingAdmin := req.Role != "" && req.Role != "admin"
	statusLeavingActive := req.Status != "" && req.Status != "active"
	if user.Role == "admin" && user.Status == "active" && (roleLeavingAdmin || statusLeavingActive) {
		count, err := countActiveAdmins(ctrl.DB)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify admin count"})
			return
		}
		if count <= 1 {
			c.JSON(http.StatusConflict, gin.H{"error": "ไม่สามารถเปลี่ยนตำแหน่งหรือระงับบัญชีผู้ดูแลระบบคนสุดท้ายที่ใช้งานอยู่ได้"})
			return
		}
	}

	// ส่งเฉพาะฟิลด์ที่ไม่ว่าง เพื่อรองรับการแก้แบบ partial ไม่ให้ฟิลด์ที่ไม่ได้ส่งมาถูกเคลียร์ทิ้ง
	updates := map[string]interface{}{}
	if req.FullName != "" {
		updates["full_name"] = req.FullName
	}
	if req.Phone != "" {
		if err := validatePhone(req.Phone); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		updates["phone"] = req.Phone
	}
	if req.Role != "" {
		updates["role"] = req.Role
	}
	if req.Department != "" {
		updates["department"] = req.Department
	}
	if req.Status != "" {
		updates["status"] = req.Status
	}

	if len(updates) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No fields to update"})
		return
	}

	// อัปเดตผ่าน &user ที่โหลดไว้แล้วข้างบน (แทน &models.User{} ตัวเปล่า) — GORM จะ sync ค่าที่
	// เปลี่ยนกลับเข้า struct user ให้อัตโนมัติ จึงไม่ต้อง query ซ้ำรอบสองเพื่อเอาข้อมูลล่าสุดไปตอบกลับ
	if err := ctrl.DB.Model(&user).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update account"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Account updated successfully", "user": user})
}

// DeleteAccount ลบบัญชีถาวร (hard delete จริง — models.User ไม่มี soft delete ของ GORM เลย
// ไม่มีฟิลด์ DeletedAt เลยไม่มีอะไรกันไว้ ลบแล้ว username/employee_id เดิมสร้างซ้ำได้ทันที)
// อนุญาตเฉพาะบัญชีที่สถานะ "suspended" และไม่มีข้อมูลอื่นผูกอยู่ในตารางธุรกิจใดๆ เท่านั้น
// ห้ามลบตัวเอง ห้ามลบจน admin ที่ active เหลือ 0 คนในระบบ (ปกติกฎ "ห้ามระงับ admin คนสุดท้าย" ใน
// UpdateAccountStatus/UpdateAccount กันไว้ตั้งแต่ต้นทางแล้ว จุดนี้เช็คซ้ำเป็นด่านสุดท้ายเผื่อมีทางอ้อม)
func (ctrl *AdminController) DeleteAccount(c *gin.Context) {
	id := c.Param("id")

	var user models.User
	if err := ctrl.DB.First(&user, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	if user.Status != "suspended" {
		c.JSON(http.StatusConflict, gin.H{"error": "ลบได้เฉพาะบัญชีที่ถูกระงับใช้งาน (suspended) เท่านั้น"})
		return
	}

	if selfID, ok := currentUserID(c); ok && selfID == user.ID {
		c.JSON(http.StatusForbidden, gin.H{"error": "ไม่สามารถลบบัญชีของตัวเองได้"})
		return
	}

	if user.Role == "admin" {
		count, err := countActiveAdmins(ctrl.DB)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify admin count"})
			return
		}
		// user ที่กำลังจะลบสถานะ suspended อยู่แล้ว (เช็คผ่านมาแล้วข้างบน) จึงไม่ถูกนับใน count นี้
		// อยู่แล้ว (countActiveAdmins กรองเฉพาะ status=active) — เงื่อนไขนี้จึงกันเฉพาะกรณี "ระบบไม่
		// เหลือ admin ที่ active อยู่เลยสักคน" ไม่ใช่กันไม่ให้ระงับ admin คนสุดท้าย (ขั้นตอนนั้นถูก
		// กันไว้ที่ UpdateAccountStatus/UpdateAccount ไปแล้วก่อนจะมาถึงจุดที่ลบได้จริง)
		if count == 0 {
			c.JSON(http.StatusConflict, gin.H{"error": "ไม่สามารถลบบัญชีผู้ดูแลระบบนี้ได้ เนื่องจากระบบไม่มีผู้ดูแลระบบที่ใช้งานอยู่เหลืออยู่เลย"})
			return
		}
	}

	// เช็คว่ามีข้อมูลอื่นผูกกับบัญชีนี้อยู่หรือไม่ — ครอบคลุมทุกตารางที่มี FK ชี้ไปที่ users.id
	// (ไม่ใช่แค่ตัวอย่าง "นัดหมาย/ประวัติการตรวจ/ใบเสร็จ" ที่คุยกัน — ใบเสร็จ (Billing) ไม่มี FK
	// ชี้ไปที่ users.id ตรงๆ เชื่อมผ่าน visit_records.doctor_id อีกทีเท่านั้น จึงครอบคลุมอยู่แล้วใน
	// เช็ค visit_records ด้านล่าง) system_accesses ไม่อยู่ในลิสต์นี้เพราะเป็นแค่ config สิทธิ์ ไม่ใช่
	// ข้อมูลผู้ป่วย/ธุรกิจ ลบทิ้งอัตโนมัติได้เลยด้านล่าง
	uid := user.ID
	relatedChecks := []struct {
		label string
		query func() *gorm.DB
	}{
		{"นัดหมายที่เป็นแพทย์ผู้ตรวจ", func() *gorm.DB { return ctrl.DB.Model(&models.Appointment{}).Where("doctor_id = ?", uid) }},
		{"นัดหมายที่เป็นผู้รับนัด (เวชระเบียน)", func() *gorm.DB { return ctrl.DB.Model(&models.Appointment{}).Where("register_id = ?", uid) }},
		{"เอกสารที่สร้างไว้ (DMS)", func() *gorm.DB { return ctrl.DB.Model(&models.Document{}).Where("created_by = ?", uid) }},
		{"เอกสารที่เคยอนุมัติ (DMS)", func() *gorm.DB { return ctrl.DB.Model(&models.Document{}).Where("approved_by = ?", uid) }},
		{"เอกสารที่ถูกส่งต่อให้ (DMS)", func() *gorm.DB { return ctrl.DB.Model(&models.DocumentForward{}).Where("forwarded_to = ?", uid) }},
		{"ตารางเวรที่สร้างไว้", func() *gorm.DB { return ctrl.DB.Model(&models.DoctorSchedule{}).Where("created_by = ?", uid) }},
		{"คำขอลาที่เคยอนุมัติ", func() *gorm.DB { return ctrl.DB.Model(&models.LeaveRequest{}).Where("approved_by = ?", uid) }},
		{"คำขอแลกเวรที่ยื่นไว้", func() *gorm.DB { return ctrl.DB.Model(&models.ShiftSwapRequest{}).Where("requester_id = ?", uid) }},
		{"คำขอแลกเวรที่ถูกขอ", func() *gorm.DB { return ctrl.DB.Model(&models.ShiftSwapRequest{}).Where("receiver_id = ?", uid) }},
		{"คิวที่ลงทะเบียนไว้", func() *gorm.DB { return ctrl.DB.Model(&models.Queue{}).Where("created_by_user_id = ?", uid) }},
		{"คิวที่มอบหมายเป็นแพทย์เจ้าของคิว", func() *gorm.DB { return ctrl.DB.Model(&models.Queue{}).Where("assigned_doctor_id = ?", uid) }},
		{"ประวัติการตรวจ (Visit Records)", func() *gorm.DB { return ctrl.DB.Model(&models.VisitRecord{}).Where("doctor_id = ?", uid) }},
		{"ประวัติการคัดกรองที่ทำไว้", func() *gorm.DB { return ctrl.DB.Model(&models.Screening{}).Where("screened_by_user_id = ?", uid) }},
		{"ประวัติการคัดกรองที่มอบหมายเป็นแพทย์", func() *gorm.DB { return ctrl.DB.Model(&models.Screening{}).Where("assigned_doctor_id = ?", uid) }},
		{"ประวัติผู้ป่วยที่เคยแก้ไขล่าสุด", func() *gorm.DB { return ctrl.DB.Model(&models.PatientHistory{}).Where("updated_by_user_id = ?", uid) }},
		{"สิทธิการรักษาที่บันทึกไว้", func() *gorm.DB { return ctrl.DB.Model(&models.MedicalEligibility{}).Where("user_id = ?", uid) }},
		{"โปรไฟล์แพทย์", func() *gorm.DB { return ctrl.DB.Model(&models.Doctor{}).Where("user_id = ?", uid) }},
	}

	for _, chk := range relatedChecks {
		var count int64
		if err := chk.query().Count(&count).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify related records"})
			return
		}
		if count > 0 {
			c.JSON(http.StatusConflict, gin.H{"error": fmt.Sprintf("ไม่สามารถลบบัญชีนี้ได้ เนื่องจากยังมีข้อมูล%sผูกอยู่ (%d รายการ)", chk.label, count)})
			return
		}
	}

	tx := ctrl.DB.Begin()
	if err := tx.Where("user_id = ?", uid).Delete(&models.SystemAccess{}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to clear system access records"})
		return
	}
	if err := tx.Delete(&user).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete account"})
		return
	}
	tx.Commit()

	c.JSON(http.StatusOK, gin.H{"message": "Account deleted successfully"})
}

// ResetPassword ตั้งรหัสผ่านชั่วคราวใหม่ให้บัญชี (admin-assisted, ไม่มีระบบส่งอีเมล)
// สุ่มรหัสผ่านใหม่, บังคับ RequiresPasswordChange=true (ใช้ flow เดิมที่มีอยู่แล้ว
// ตอน login ครั้งถัดไปผู้ใช้จะถูกบังคับให้ตั้งรหัสผ่านของตัวเองใหม่ทันที — ดู ChangePassword)
// แล้วส่งรหัสผ่านชั่วคราวนี้กลับไปให้ admin นำไปแจ้งพนักงานเอง (ทางวาจา/แชท ฯลฯ)
func (ctrl *AdminController) ResetPassword(c *gin.Context) {
	id := c.Param("id")

	var user models.User
	if err := ctrl.DB.First(&user, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	tempPassword, err := generateTempPassword(10)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate temporary password"})
		return
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(tempPassword), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	if err := ctrl.DB.Model(&models.User{}).Where("id = ?", id).Updates(map[string]interface{}{
		"password":                 string(hashed),
		"requires_password_change": true,
	}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reset password"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":             "Password reset successfully",
		"temporary_password":  tempPassword,
		"requires_password_change": true,
	})
}

// generateTempPassword สุ่มรหัสผ่านชั่วคราวจาก charset ที่ตัดตัวอักษรที่สับสนง่ายออก
// (ไม่มี 0/O, 1/l/I) เพราะ admin ต้องอ่านออกเสียง/พิมพ์บอกพนักงานเอง
func generateTempPassword(length int) (string, error) {
	const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"
	result := make([]byte, length)
	for i := range result {
		n, err := crand.Int(crand.Reader, big.NewInt(int64(len(charset))))
		if err != nil {
			return "", err
		}
		result[i] = charset[n.Int64()]
	}
	return string(result), nil
}

// --- System Access ---

func (ctrl *AdminController) CreateSystemAccess(c *gin.Context) {
	var req dto.CreateSystemAccessRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	access := models.SystemAccess{
		UserID:      req.UserID,
		AccessLevel: req.AccessLevel,
		ModuleName:  req.ModuleName,
	}

	if err := ctrl.DB.Create(&access).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to assign access"})
		return
	}
	c.JSON(http.StatusCreated, access)
}

func (ctrl *AdminController) BulkUpdateSystemAccess(c *gin.Context) {
	var req struct {
		UserID   uint `json:"user_id"`
		Accesses []struct {
			ModuleName  string `json:"module_name"`
			AccessLevel int    `json:"access_level"`
		} `json:"accesses"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tx := ctrl.DB.Begin()
	// Clear existing access
	if err := tx.Where("user_id = ?", req.UserID).Delete(&models.SystemAccess{}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to clear existing access"})
		return
	}

	// Insert new access
	for _, acc := range req.Accesses {
		if acc.AccessLevel > 0 {
			newAcc := models.SystemAccess{
				UserID:      req.UserID,
				ModuleName:  acc.ModuleName,
				AccessLevel: acc.AccessLevel,
			}
			if err := tx.Create(&newAcc).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to assign access"})
				return
			}
		}
	}
	tx.Commit()
	c.JSON(http.StatusOK, gin.H{"message": "System access updated successfully"})
}
