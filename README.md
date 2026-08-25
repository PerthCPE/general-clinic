<<<<<<< HEAD
# 🏥 Clinic Management System (ระบบจัดการคลินิกทั่วไป)
### ENG23 3031 System Analysis and Design | Team T08

ระบบจัดการข้อมูลสารสนเทศภายในคลินิกเวชกรรมรักษาทั่วไป เพื่ออำนวยความสะดวกในการบริหารจัดการงาน ตั้งแต่การลงทะเบียนคนไข้ ซักประวัติ ตรวจรักษาของแพทย์ จ่ายยา การเงิน การนัดหมาย และการจัดการตารางงานธุรการ

---

## 🛠️ Tech Stack (เทคโนโลยีที่ใช้)

### Backend (หลังบ้าน)
*   **Language**: Go (Golang) `v1.26.4`
*   **Web Framework**: Gin Web Framework `v1.12.0`
*   **ORM**: GORM `v1.31.2`
*   **Database**: PostgreSQL (Hosted on Supabase Cloud DB via transaction pooler)
*   **Authentication**: JWT (JSON Web Token) & Role-Based Access Control (RBAC)

### Frontend (หน้าบ้าน)
*   **Framework**: React `v19` + TypeScript (TS)
*   **Build Tool**: Vite `v8`
*   **UI Library**: Material-UI (MUI v6)

---

## 📂 Project Structure (โครงสร้างโฟลเดอร์)

```text
general-clinic/
├── golang-backend/               # โฟลเดอร์ระบบหลังบ้าน (Go)
│   ├── cmd/
│   │   └── main.go               # ไฟล์หลักสำหรับรันระบบ
│   ├── internal/
│   │   ├── config/               # การตั้งค่าแอปพลิเคชันและการเชื่อมต่อฐานข้อมูล
│   │   ├── controllers/          # ลอจิกการทำงานและ API Endpoints
│   │   ├── dto/                  # Data Transfer Objects (ตัวรับส่งข้อมูล JSON)
│   │   ├── middleware/           # ด่านตรวจความปลอดภัย (Auth, Roles)
│   │   ├── models/               # โครงสร้างตารางฐานข้อมูล (Schema)
│   │   ├── routes/               # จดทะเบียนจัดการเส้นทางระบบ
│   │   └── utils/                # ฟังก์ชันอำนวยความสะดวกทั่วไป
│   ├── .env                      # ไฟล์เก็บรหัสผ่าน (ไม่ได้อัปโหลดขึ้น GitHub)
│   └── go.mod
│
└── react-frontend/               # โฟลเดอร์ระบบหน้าบ้าน (React + Vite)
    ├── src/
    │   ├── components/           # ส่วนประกอบหน้าจอที่ใช้ซ้ำได้ (Reusable Components)
    │   ├── pages/                # หน้าจอการทำงานหลักแต่ละหน้า
    │   ├── context/              # ตัวจัดการข้อมูลล็อกอินและสิทธิ์ระบบ (Auth Context)
    │   ├── services/             # ตัวเรียกใช้และรับส่ง API คุยหลังบ้าน
    │   ├── assets/               # ไฟล์รูปภาพและสื่อประกอบ
    │   └── main.tsx
    └── package.json
```

---

## 🚀 Getting Started (วิธีการเปิดใช้งานโปรเจกต์)

### 1. การติดตั้งและเปิดฝั่งหลังบ้าน (Backend)
1.  เข้าไปที่โฟลเดอร์หลังบ้าน:
    ```bash
    cd golang-backend
    ```
2.  ติดตั้งและจัดระเบียบไลบรารี:
    ```bash
    go mod tidy
    ```
3.  สร้างไฟล์ `.env` ในโฟลเดอร์ `golang-backend/` และใส่ค่าคอนฟิกเชื่อมฐานข้อมูล Supabase ที่ได้ตกลงกันไว้ในทีม
4.  สั่งเปิดเซิร์ฟเวอร์หลังบ้าน:
    ```bash
    go run ./cmd/main.go
    ```
    *ระบบหลังบ้านจะรันสำเร็จบนพอร์ต `http://localhost:8080`*

### 2. การติดตั้งและเปิดฝั่งหน้าบ้าน (Frontend)
1.  เข้าไปที่โฟลเดอร์หน้าบ้าน:
    ```bash
    cd react-frontend
    ```
2.  ติดตั้งโมดูลหน้าบ้านทั้งหมด:
    ```bash
    npm install
    ```
3.  เปิดโปรเจกต์สำหรับรันเทสบนเครื่อง:
    ```bash
    npm run dev
    ```

---

## 🔒 Security & Roles (ระบบบทบาทและสิทธิ์)
ระบบมีการตรวจตั๋ว JWT และกรองสิทธิ์ในการเข้าถึงเมนูย่อยของแต่ละหน้าที่:
1.  **Registrar** (เจ้าหน้าที่เวชระเบียน): เข้าถึงข้อมูลคนไข้ การลงทะเบียน และคิวได้
2.  **Nurse** (พยาบาล): เข้าถึงข้อมูลสัญญาณชีพและคิวตรวจได้
3.  **Doctor** (แพทย์): เข้าถึงการบันทึกตรวจและสั่งยารักษาโรคได้
4.  **Admin** (ธุรการระดับสูง): จัดการตารางงานและสิทธิ์สมาชิกได้
=======
# Team08
>>>>>>> cd5486204ea16b8ce6d2201d879a4d436f96ec68
