# Clinic Management System (ระบบจัดการคลินิกทั่วไป)
### ENG23 3031 System Analysis and Design | Team T08

ระบบจัดการข้อมูลสารสนเทศภายในคลินิกเวชกรรมรักษาทั่วไป เพื่ออำนวยความสะดวกในการบริหารจัดการงาน ตั้งแต่การลงทะเบียนคนไข้ ซักประวัติ ตรวจรักษาของแพทย์ จ่ายยา การเงิน การนัดหมาย และการจัดการตารางงานธุรการ

---

## Tech Stack

### Backend
* **Language**: Go (Golang) `v1.26+`
* **Web Framework**: Gin Web Framework `v1.12+`
* **ORM**: GORM `v1.31+`
* **Database**: PostgreSQL 16 (Local Docker for Dev/Test, Supabase Cloud DB for Staging/Demo)
* **Authentication**: JWT (JSON Web Token) & Role-Based Access Control (RBAC)

### Frontend
* **Framework**: React `v19` + TypeScript (TS)
* **Build Tool**: Vite `v8`
* **UI Library**: Material-UI (MUI v6)

---

## Project Structure

```text
general-clinic/
├── docker-compose.yml            # Docker Compose: PostgreSQL 16 & Adminer
├── golang-backend/               # โฟลเดอร์ระบบหลังบ้าน (Go)
│   ├── cmd/
│   │   ├── main.go               # เซิร์ฟเวอร์หลัก (API + WebSocket)
│   │   ├── migrate/main.go       # ตัวรัน Database Migration (001-006)
│   │   └── clean_seed/main.go    # ตัวล้างและเตรียม Seed Data
│   ├── migrations/               # สคริปต์ SQL Migration (001_*.sql - 006_*.sql)
│   ├── internal/
│   │   ├── config/               # การเชื่อมต่อฐานข้อมูลและการโหลด Config
│   │   ├── controllers/          # ลอจิกการทำงานและ API Endpoints
│   │   ├── dto/                  # Data Transfer Objects
│   │   ├── middleware/           # Auth, Roles, CORS Guard
│   │   ├── models/               # โครงสร้างตารางฐานข้อมูล (Schema)
│   │   ├── routes/               # เส้นทาง API
│   │   ├── testutils/            # Test Guards & Helpers
│   │   └── ws/                   # WebSocket Hub & Broadcaster
│   ├── .env.example              # ตัวอย่างไฟล์ Config สำหรับ Docker & Supabase
│   ├── .env.local                # Config สำหรับ Local Docker Dev
│   ├── .env.test                 # Config สำหรับ Unit / Integration Tests
│   └── go.mod
│
└── react-frontend/               # โฟลเดอร์ระบบหน้าบ้าน (React + Vite)
    ├── src/
    │   ├── components/           # Reusable Components (Pagination, etc.)
    │   ├── pages/                # หน้าจอการทำงานแต่ละแผนก
    │   ├── context/              # Auth & RBAC Context
    │   ├── services/             # API Client & Contracts
    │   └── main.tsx
    └── package.json
```

---

## Quick Start (วิธีการเปิดใช้งานโปรเจกต์)

> [!IMPORTANT]
> **Dev/Test Environment Policy**: การพัฒนาและการทดสอบทั้งหมด (รวมถึงการรัน `go test`) ต้องทำบน **Local Docker PostgreSQL** เท่านั้น เพื่อป้องกันปัญหา Supabase Egress Overrun โดย Supabase จะใช้เฉพาะการนำเสนอหรือ Demo จริงเท่านั้น

### Step 1: Start Database Containers (Docker Compose)

เปิด Docker Desktop และรันคำสั่ง:

```bash
docker compose up -d
```

ตรวจสอบสถานะ Containers:
* **PostgreSQL (Database)**: `localhost:5433` (Container: `clinic_postgres`)
* **Adminer (Database GUI)**: `http://localhost:8081` (Container: `clinic_adminer`)

#### ข้อมูลการเชื่อมต่อ Adminer (`http://localhost:8081`):
* **System**: `PostgreSQL`
* **Server**: `clinic_postgres` (หรือ `localhost:5433` หากต่อจากภายนอก)
* **Username**: `clinic`
* **Password**: `clinic_dev_2569`
* **Database**: `clinic`

---

### Step 2: Run Database Migrations

รันตัวจัดการ Migration อัตโนมัติ (รองรับ Idempotent และเก็บประวัติใน `schema_migrations`):

```bash
cd golang-backend
go run ./cmd/migrate/main.go
```

---

### Step 3: Seed Clean Test Data

ล้างข้อมูลเก่าและเตรียมชุดข้อมูลตั้งต้น (Users ครบทุก Role, ผู้ป่วย 20 คน, สิทธิ์การรักษา, คิว 15 คิว, การคัดกรอง):

```bash
go run ./cmd/clean_seed/main.go
```

---

### Step 4: Run Backend Server

```bash
go run ./cmd/main.go
```
*ระบบ Backend จะทำงานที่ `http://localhost:8080`*

---

### Step 5: Run Frontend Server

เปิด Terminal ใหม่:

```bash
cd react-frontend
npm install
npm run dev
```
*ระบบ Frontend จะทำงานที่ `http://localhost:5173`*

---

## Test Accounts & Credentials (บัญชีทดสอบ)

บัญชีทดสอบทั้งหมดใช้รหัสผ่านเริ่มต้น: `password`

| Username | Role | แผนก / หน้าที่ | สิทธิ์ที่เข้าถึงได้ |
| :--- | :--- | :--- | :--- |
| `registrar1` | `registrar` | เวชระเบียน | ค้นหาผู้ป่วย, ลงทะเบียนผู้ป่วยใหม่, ตรวจสอบ/บันทึกสิทธิ์, ออกบัตรคิว |
| `nurse1` | `nurse` | พยาบาลคัดกรอง | จัดการคิว, ซักประวัติ/บันทึกสัญญาณชีพ, ประวัติคัดกรอง |
| `assistant1` | `nurse_assistant` | ผู้ช่วยพยาบาล | จัดการคิว, ซักประวัติ/บันทึกสัญญาณชีพ, ประวัติคัดกรอง (Parity กับ Nurse) |
| `doctor1` | `doctor` | แพทย์ตรวจรักษา | ตารางตรวจแพทย์, บันทึกการวินิจฉัยและสั่งยา |
| `doctor2` | `doctor` | แพทย์ตรวจรักษา | ตารางตรวจแพทย์, บันทึกการวินิจฉัยและสั่งยา |
| `pharmacist1` | `pharmacist` | เภสัชกรรม | คิวจ่ายยา, ตรวจสอบและบันทึกการจ่ายยา |
| `cashier1` | `cashier` | การเงิน | คิวชำระเงิน, ออกใบเสร็จ, ตรวจสอบการชำระเงิน QR |
| `officer1` | `officer` | เจ้าหน้าที่ทั่วไป | จัดการตารางแพทย์, งานธุรการ |
| `admin1` | `admin` | ผู้ดูแลระบบ | จัดการผู้ใช้งาน, สิทธิ์ และการตั้งค่าระบบทั้งหมด |

---

## Running Tests

รัน Backend Test Suites ทั้งหมดอย่างปลอดภัยบน Local Docker:

```bash
cd golang-backend
go test -v ./...
```

> [!NOTE]
> ระบบมี **Supabase Production Guard** ใน `internal/testutils/guard.go` ซึ่งจะปฏิเสธการรัน Test ทันทีหากตรวจพบว่า `DB_HOST` ชี้ไปยัง Supabase
