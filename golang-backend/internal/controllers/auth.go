package controllers

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"clinic-backend/internal/config"
	"clinic-backend/internal/dto"
	"clinic-backend/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

func Login(c *gin.Context) {
	var req dto.LoginRequest

	// check frontend for sended valid json following dto
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request parameters"})
		return
	}

	if req.Username == "" || req.Password == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน"})
		return
	}

	var user models.User

	// username หรือ employee_id (รหัสพนักงาน) ก็ใช้ login ได้ — employee_id คือตัวที่พนักงาน
	// รู้จักจริงและถูกใช้เป็นรหัสผ่านเริ่มต้นด้วย (ดู CreateAccount) จึงต้อง match ตรงๆ ไม่พึ่งพาว่า
	// username จะถูกแปลงรูปแบบ (เช่น lowercase) ตรงกับ employee_id เป๊ะหรือไม่
	// (ตัด "OR email = ?" ออกแล้ว — งานลบ users.email เฟส 1: ไม่มี UI ไหนป้อน email เข้า login
	// form อยู่แล้ว คอลัมน์ email ในตารางยังไม่ถูกลบ ดู PLAN.md)
	result := config.DB.Where("username = ? OR employee_id = ?", req.Username, req.Username).First(&user)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid username or password"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error: unable to connect or query user table"})
		return
	}

	// บัญชีที่ถูกระงับ (suspended) หรือปิดใช้งาน (inactive) ห้าม login สำเร็จ แม้รหัสผ่านจะถูกต้องก็ตาม
	if user.Status == "suspended" || user.Status == "inactive" {
		c.JSON(http.StatusForbidden, gin.H{"error": "บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ"})
		return
	}

	// password checking with bcrypt
	err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid username or password"})
		return
	}

	// token generate struct setting
	claims := jwt.MapClaims {
		"user_id": user.ID,
		"role": user.Role,
		"exp": time.Now().Add(time.Hour * 24).Unix(),
	}
	
	// create jwt_token expired 24 hr
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(config.AppConfig.JWTSecret))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error" : "Failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, dto.LoginResponse{
		Token:                  tokenString,
		Role:                   user.Role,
		RequiresPasswordChange: user.RequiresPasswordChange,
		User: dto.UserInfo{
			ID:       user.ID,
			Username: user.Username,
			FullName: user.FullName,
			Role:     user.Role,
			Phone:    user.Phone,
		},
	})
}
// roleToQuickLoginEmployeeID คือ whitelist ตายตัวของบัญชี seed 8 บัญชีที่ผูกกับปุ่ม Quick Test
// Login ในหน้า login (ไม่ query by role ตรงๆ เพราะบาง role เช่น doctor มีหลายบัญชีในระบบจริง
// (doctor1/doctor2/doctor3) ปุ่ม Quick Test ต้องการแค่บัญชีเดียวที่คงที่เสมอต่อ role)
var roleToQuickLoginEmployeeID = map[string]string{
	"registrar":       "REC001",
	"nurse":           "NUR001",
	"nurse_assistant": "NUR002",
	"doctor":          "DOC001",
	"pharmacist":      "PHA001",
	"cashier":         "CAS001",
	"admin":           "ADM001",
	"officer":         "OFF001",
}

// QuickLogin คือทางลัด dev/test เท่านั้นสำหรับปุ่ม "Quick Test Login" — ไม่เช็ค password และ
// รีเซ็ต status ของบัญชี seed กลับเป็น active ให้เสมอก่อน login เพื่อให้กดใช้ได้ทุกครั้งไม่ว่า
// บัญชีนั้นจะถูกตั้ง suspended/inactive ไว้ก่อนหน้า (เช่น ระหว่างทดสอบ flow ระงับบัญชี) ต่างจาก
// Login() ปกติที่ต้องเช็ค password และ status ตามจริงทุกประการ ไม่ถูกแตะเลยในไฟล์นี้
//
// กันไว้สองชั้นไม่ให้ใช้ได้ตอน production: (1) เช็ค config.AppConfig.DevMode ตรงนี้ (2) routes.go
// ไม่ผูก route นี้เลยถ้า DevMode เป็น false ตั้งแต่แรก (endpoint ไม่มีอยู่จริงด้วยซ้ำ ไม่ใช่แค่ตอบ 403)
func QuickLogin(c *gin.Context) {
	if !config.AppConfig.DevMode {
		c.JSON(http.StatusForbidden, gin.H{"error": "Quick login is only available in dev mode"})
		return
	}

	var req dto.QuickLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request parameters"})
		return
	}

	employeeID, ok := roleToQuickLoginEmployeeID[req.Role]
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Unknown role for quick login"})
		return
	}

	var user models.User
	if err := config.DB.Where("employee_id = ?", employeeID).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Seed account not found"})
		return
	}

	// รีเซ็ต status กลับเป็น active เสมอไม่ว่าจะถูกตั้งเป็นอะไรไว้ก่อนหน้า — จุดประสงค์หลักของ
	// endpoint นี้ ทำเฉพาะบัญชี seed ที่ whitelist ไว้ข้างบนเท่านั้น ไม่กระทบบัญชีจริงอื่นใด
	if user.Status != "active" {
		if err := config.DB.Model(&user).Update("status", "active").Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reset account status"})
			return
		}
		user.Status = "active"
	}

	claims := jwt.MapClaims{
		"user_id": user.ID,
		"role":    user.Role,
		"exp":     time.Now().Add(time.Hour * 24).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(config.AppConfig.JWTSecret))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, dto.LoginResponse{
		Token: tokenString,
		Role:  user.Role,
		// Hardcode false เสมอ ไม่ส่งค่าจริงจาก DB (user.RequiresPasswordChange) เหมือน Login() ปกติ —
		// Quick Test Login ไม่เช็ค password เลยตั้งแต่ต้น (ดูคอมเมนต์บนสุดของฟังก์ชันนี้) จึงไม่มีเหตุผล
		// ต้องบังคับผู้ใช้เปลี่ยนรหัสผ่านผ่านทางลัดนี้ ไม่ว่าค่าจริงในแถว DB ของบัญชี seed นั้นจะเป็นอะไร
		// (ตรวจแล้วไม่มีกลไกในระบบที่การันตีว่าค่านี้ของบัญชี seed จะเท่ากัน/คาดเดาได้ — ดู PLAN.md ข้อ 8.2)
		RequiresPasswordChange: false,
		User: dto.UserInfo{
			ID:       user.ID,
			Username: user.Username,
			FullName: user.FullName,
			Role:     user.Role,
			Phone:    user.Phone,
		},
	})
}

func ChangePassword(c *gin.Context) {
	var req dto.ChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request parameters"})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var user models.User
	if err := config.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// บัญชีทดสอบตายตัว 10 บัญชี (ดู models.TestAccountUsernames) ห้ามเปลี่ยนรหัสผ่านเองเด็ดขาด —
	// seed script ตั้งรหัสผ่านกลับเป็น hash(employee_id) ให้อัตโนมัติทุก startup อยู่แล้ว เช็คนี้ต้อง
	// มาก่อนเช็ค old password/กฎ "ห้ามตรงกับรหัสพนักงาน" ด้านล่างเสมอ เพราะบัญชีเหล่านี้ไม่มีสิทธิ์
	// เข้าฟังก์ชันนี้เลยไม่ว่ากรณีใด
	if models.IsTestAccountUsername(user.Username) {
		c.JSON(http.StatusForbidden, gin.H{"error": "บัญชีนี้เป็นบัญชีทดสอบของระบบ ไม่สามารถเปลี่ยนรหัสผ่านเองได้ (ระบบจะตั้งรหัสผ่านกลับเป็นรหัสพนักงานให้อัตโนมัติทุกครั้งที่เปิดเซิร์ฟเวอร์)"})
		return
	}

	err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.OldPassword))
	if err != nil {
		// ตอบ 400 ไม่ใช่ 401 — ตัวจัดการกลางใน api.ts เห็น 401 บนเส้นทางที่ต้องมี token แล้วจะตีความ
		// เป็น "เซสชันหมดอายุ" เสมอ (forceReLogin(): เคลียร์ token + reload ทันที) ทำให้ error message
		// นี้ไม่มีโอกาสถูกแสดงเลยแม้แต่เสี้ยววินาที ทั้งที่นี่คือรหัสผ่านเดิมที่ผู้ใช้พิมพ์ผิด ไม่ใช่
		// ปัญหา token/session — ให้จัดกลุ่มเดียวกับ validation error อื่นด้านล่าง (ล้วนตอบ 400) แทน
		c.JSON(http.StatusBadRequest, gin.H{"error": "รหัสผ่านเดิมไม่ถูกต้อง"})
		return
	}

	// เช็คเงื่อนไขรหัสผ่านใหม่ที่ backend เอง — ห้ามพึ่งพาแค่ฝั่งหน้าเว็บ เพราะ endpoint นี้
	// เรียกตรงได้เสมอ (curl/Postman) โดยไม่ผ่านฟอร์มใดๆ เลย
	if len(req.NewPassword) < 8 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร"})
		return
	}
	if req.NewPassword == req.OldPassword {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม"})
		return
	}
	// เทียบแบบ case-insensitive เพราะ employee_id ของบางบัญชีมีตัวพิมพ์ใหญ่ล้วน (เช่น "DOC001")
	// ผู้ใช้อาจพิมพ์รหัสผ่านใหม่เป็นตัวพิมพ์เล็กแล้วคิดว่าต่างกันทั้งที่จริงคือรหัสเริ่มต้นเดิม
	if user.EmployeeID != "" && strings.EqualFold(req.NewPassword, user.EmployeeID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รหัสผ่านใหม่ต้องไม่ตรงกับรหัสพนักงาน"})
		return
	}

	hashPassword, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), 10)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	user.Password = string(hashPassword)
	user.RequiresPasswordChange = false
	if err := config.DB.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update password"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Password changed successfully"})
}
