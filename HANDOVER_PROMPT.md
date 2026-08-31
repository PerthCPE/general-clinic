# 🏥 เอกสารและพรอทม์ส่งต่องาน (Handover Prompt & System Documentation)
> **ระบบหลักที่รับผิดชอบ**: 
> 💊 **ระบบย่อยที่ 1: คลังยาและการจ่ายยา (Pharmacy & Dispensing Subsystem)**
> 💳 **ระบบย่อยที่ 2: การเงินและการชำระเงิน (Billing & Payment Subsystem)**
> **ผู้พัฒนา**: Boonkum (B6741990)

---

## 📌 1. ภาพรวมระบบ (System Overview)
โครงการนี้เน้นพัฒนา **ระบบจัดการคลังยา จ่ายยา และระบบการเงินชำระเงิน** สำหรับคลินิกทั่วไป โดยเชื่อมต่อกับระบบคิวและเวชระเบียนแบบครบวงจร 

---

## 💊 2. ระบบย่อยที่ 1: ระบบจัดการคลังยาและจ่ายยา (Pharmacy Subsystem)

### **ฟีเจอร์หลัก (Key Features)**
1. **บันทึกและจ่ายยา (Medicine Dispensing)**:
   - ดึงรายการยาตามใบสั่งยาจากห้องตรวจแพทย์
   - บันทึกการจ่ายยาและตัดสต็อกยาอัตโนมัติ
   - แสดงประวัติการจ่ายยาของผู้ป่วยย้อนหลัง
2. **คลังยาและสต็อก (Medicine Inventory & Stock)**:
   - ค้นหายาตามรหัสยา (Code) หรือชื่อยา (Name)
   - ปรับปรุงจำนวนสต็อกยา (Stock In / Stock Out / Update Stock)
   - ระบบเตือนยาใกล้หมดสต็อก (Low Stock Alerts)
3. **ประวัติการรับยาของผู้ป่วย (Dispensing History)**:
   - ค้นหาประวัติการรับยาตาม HN ผู้ป่วย หรือ Visit ID

### **API Endpoints (Pharmacy)**
- `GET /api/pharmacy/medicines` - ดึงรายการยาทั้งหมดในคลัง
- `GET /api/pharmacy/medicines/:code` - ค้นหายาตามรหัสยา
- `POST /api/pharmacy/medicines/stock` - อัปเดต/เติมสต็อกยา
- `GET /api/pharmacy/dispensing/:visit_id` - ดึงประวัติการจ่ายยาตาม Visit ID
- `POST /api/pharmacy/dispensing` - บันทึกการตัดสต็อกและจ่ายยา

---

## 💳 3. ระบบย่อยที่ 2: ระบบจัดการการเงินและการชำระเงิน (Billing Subsystem)

### **ฟีเจอร์หลัก (Key Features)**
1. **คำนวณค่ายาและค่าบริการ (Billing Calculation)**:
   - สรุปรายการค่ายา ค่าตรวจ และค่าบริการทางการแพทย์
   - คำนวณส่วนลดตามสิทธิ์การรักษา (เช่น บัตรทอง, ประกันสังคม, ข้าราชการ)
2. **ชำระเงินและออกใบเสร็จ (Payment & Invoice)**:
   - บันทึกการชำระเงิน (เงินสด, โอนเงิน, PromptPay)
   - พิมพ์ใบแจ้งหนี้ / ใบเสร็จรับเงิน (Invoice Generation)
   - แดชบอร์ดสรุปรายได้และการเงินประจำวัน
3. **ระบบสแกนจ่ายคิวอาร์โค้ด (PromptPay QR Code)**:
   - เจนเนอเรท PromptPay QR Code อัตโนมัติตามยอดเงินที่ต้องชำระ

### **API Endpoints (Billing)**
- `GET /api/billing/visit/:visit_id` - ดึงข้อมูลใบชำระเงินตาม Visit ID
- `POST /api/billing/calculate` - คำนวณยอดเงินและส่วนลดตามสิทธิ์
- `POST /api/billing/qr/generate` - สร้าง PromptPay QR Code
- `POST /api/billing/confirm` - ยืนยันการชำระเงินและปิดยอด

---

## 🛠️ 4. เทคโนโลยีที่ใช้ (Tech Stack)

### **Backend (Golang)**
- **Framework**: Go + Gin Web Framework
- **Database ORM**: GORM (`gorm.io/gorm`)
- **Database**: Supabase PostgreSQL Cloud Database (`aws-0-ap-south-1.pooler.supabase.com:5432`, `sslmode=require`)
- **Authentication**: JWT Auth (`github.com/golang-jwt/jwt/v5`)

### **Frontend (React)**
- **Framework**: React 18 + TypeScript + Vite
- **Styling**: Vanilla CSS + TailwindCSS (สำหรับ Medical Components)
- **State/Notifications**: React Context API + `react-hot-toast`

---

## 👥 5. บัญชีสำหรับทดสอบระบบ (Test Accounts)

| Role | Username | Password | หน้าที่ทดสอบหลัก |
| :--- | :--- | :--- | :--- |
| **`pharmacist`** | `pharmacist1` | `password` | ทดสอบระบบคลังยาและการจ่ายยา |
| **`cashier`** | `cashier1` | `password` | ทดสอบระบบการเงิน ใบแจ้งหนี้ และ QR Code |
| **`doctor`** | `doctor1` | `password` | ทดสอบการสั่งยาและส่งเคสมาห้องยา/การเงิน |
| **`registrar`** | `registrar1` | `password` | ทดสอบลงทะเบียนและส่งคิวเข้าแผนก |

---

## 🤖 6. Prompt สำหรับส่งต่องาน (Handover Prompt for AI / Developer)

```markdown
คุณคือ AI Coding Assistant ที่รับช่วงต่อในโครงการพัฒนา "ระบบจัดการคลังยา การจ่ายยา และระบบการเงิน (Pharmacy & Billing Management System)"

### 📋 ข้อมูลระบบและขอบเขตงาน:
1. **ผู้พัฒนาและขอบเขตงาน**: 
   - พัฒนาโดย Boonkum (B6741990)
   - รับผิดชอบหลัก 2 ระบบย่อย:
     1) **ระบบคลังยาและการจ่ายยา (Pharmacy Subsystem)**: ตัดสต็อกยา, ค้นหายา, ประวัติจ่ายยา
     2) **ระบบการเงินและชำระเงิน (Billing Subsystem)**: คำนวณค่ายา/บริการตามสิทธิ์, ออกใบแจ้งหนี้, PromptPay QR Code

2. **โครงสร้างโค้ด**:
   - Backend: Go (Gin, GORM) ในโฟลเดอร์ `golang-backend/`
     - Controller: `golang-backend/internal/controllers/pharmacy.go`, `billing.go`
     - Model: `models.Medicine`, `models.Dispensing`, `models.Billing`, `models.QRPayment`
   - Frontend: React + TypeScript ในโฟลเดอร์ `react-frontend/`
     - หน้าห้องยา: `src/pages/pharmacy/` (`DetailPage`, `MedicinePage`, `PatientHistoryPage`)
     - หน้าการเงิน: `src/pages/billing/` (`BillingDashboardPage`, `BillingDispensePage`, `BillingInvoicePage`)

3. **บัญชีทดสอบหลัก (Password: `password`)**:
   - เภสัชกร: `username: pharmacist1`
   - การเงิน: `username: cashier1`

4. **เงื่อนไขสำคัญ**:
   - ห้ามกระทบต่อโครงสร้างฐานข้อมูลที่มีอยู่เดิม
   - รักษารูปแบบ UI/UX ให้เป็นมาตรฐาน Modern Medical Clean UI
   - เมื่อทำการแก้ไขโค้ดต้องทดสอบ build ก่อนส่งงานเสมอ

โปรดรับทราบขอบเขตงานและพร้อมปฏิบัติตามคำสั่งถัดไปครับ
```
