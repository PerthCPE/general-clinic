# 🏥 General Clinic - Frontend Application

ระบบเว็บแอปพลิเคชันสำหรับคลินิกทั่วไป (**General Clinic Management System**) พัฒนาด้วย **React 19 + TypeScript + Vite** โดยเน้นการออกแบบ UI/UX ตามสเปกจาก Figma อย่างแม่นยำ พร้อมระบบแอนิเมชันที่ลื่นไหล รองรับการแสดงผลหน้าจอมาตรฐานความละเอียดสูง (1920x1080 และ Responsive Layout)

---

## 🛠️ Technology Stack

- **Framework / Library:** React 19.x + TypeScript
- **Bundler / Dev Server:** Vite 8.x
- **Styling:** Vanilla CSS (Custom Modular CSS / No Tailwind CSS)
- **Typography:** Inter (Google Fonts), Segoe UI
- **Icons & Graphics:** Custom Inline SVG Vector Graphics & SVG Assets

---

## 📁 โครงสร้างโฟลเดอร์ (Project Structure)

```text
react-frontend/
├── src/
│   ├── assets/                     # ไฟล์รูปภาพและ SVG assets ต่างๆ
│   │   ├── hospital-box-outline.svg
│   │   └── ...
│   ├── components/                 # คอมโพเนนต์หลักของระบบ
│   │   ├── Sidebar/                # เมนูแถบข้าง (Navigation Sidebar)
│   │   │   ├── Sidebar.tsx
│   │   │   └── Sidebar.css
│   │   ├── Topbar/                 # แถบนำทางด้านบน (Sticky Header & Profile)
│   │   │   ├── Topbar.tsx
│   │   │   └── Topbar.css
│   │   └── Body/                   # พื้นที่เนื้อหาหลัก (Main Content Area)
│   │       ├── Body.tsx
│   │       └── Body.css
│   ├── App.tsx                     # คอมโพเนนต์หลักที่จัดการ Layout & Sidebar State
│   ├── App.css                     # สไตล์เลย์เอาต์หลักของแอปพลิเคชัน
│   ├── index.css                   # Global CSS Reset & Base Typography
│   └── main.tsx                    # React Root Entry Point
├── index.html                      # HTML Entry
├── package.json                    # Dependencies และ Scripts
├── tsconfig.json                   # การตั้งค่า TypeScript
└── vite.config.ts                  # การตั้งค่า Vite
```

---

## 🌟 ฟีเจอร์หลักของ Frontend (Core Features)

### 1. 📂 Responsive Sidebar (แถบเมนูด้านข้าง)
- ความกว้างมาตรฐาน **256px** พื้นหลังสี `#192943`
- โลโก้ **General Clinic** พร้อมไอคอนกล่องโรงพยาบาลสีเขียว `#4ADE80`
- รายการเมนู:
  - 🏠 **หน้าหลัก** (Active State: ไฮไลท์พื้นหลังโปร่งแสงและไอคอนสีเขียว `#4ADE80`)
  - 👥 **จัดการบัญชีผู้ใช้งาน**
  - 📊 **แดชบอร์ด**
- **ระบบเปิด-ปิด Sidebar (Collapsible):**
  - กดปุ่ม **✕** เพื่อซ่อน Sidebar เลื่อนออกทางซ้ายแบบ Smooth Transition (`0.3s ease`)
  - เมื่อปิด Sidebar ปุ่ม Hamburger วงกลมสีเขียว (`#24D282`) จะปรากฏบน Topbar เพื่อให้กดเปิดกลับมาได้

### 2. 🔝 Top Navigation Bar (แถบด้านบน)
- ความสูง **80px** ติดตรึงด้านบน (Sticky Header) พร้อมเงา `box-shadow` สไตล์โมเดิร์น
- **ช่องค้นหา (Search Bar):**
  - ขนาดความกว้างสูงสุด **848px** พื้นหลังสี `#F0F4F8` มุมมน **35px**
  - ไอคอนค้นหาและข้อความ Placeholder สี `#90A1B9`
- **ระบบการแจ้งเตือน (Notifications):**
  - ปุ่มกระดิ่งแจ้งเตือนสี `#45556C` พร้อมจุด Red Badge (`#FB2C36`) มีกรอบเงาสีขาว
- **User Profile & Staggered Dropdown Menu:**
  - รูปโปรไฟล์ Avatar ในกรอบวงกลม พร้อมชื่อ **Dr. Anong S.** และตำแหน่ง **General Practitioner**
  - ลูกศร Dropdown Arrow หมุน 180 องศาแบบนุ่มนวลเมื่อเปิดเมนู
  - **เมนู Dropdown:**
    - **ตั้งค่าโปรไฟล์**
    - **ออกจากระบบ**
  - **Staggered Cascade Animation:** เมนูจะคลี่และเลื่อนลงมาทีละรายการอย่างต่อเนื่อง นุ่มนวลสวยงาม
  - รองรับระบบ **Click Outside to Close** (คลิกพื้นที่อื่นเพื่อปิดเมนูอัตโนมัติ)
  - ตำแหน่งกล่องเมนูจัดวางใต้ขอบล่างของ Navbar พอดี ไม่ซ้อนทับบาร์

### 3. 🖥️ Layout & Frame Scaling
- ออกแบบโดยอิงโครงสร้าง Frame 1920x1080 และยืดหยุ่นตามความกว้างของหน้าจอ
- พื้นหลังระบบใช้โทนสี Slate อ่อนสบายตา `#F8FAFC`
- ปรับขนาด `margin-left` ของ Body และ Topbar แบบ Real-time ตามสถานะของ Sidebar

---

## 🎨 Design Tokens & Palette

| หมวดหมู่ | สี / ค่า | การใช้งาน |
|---|---|---|
| **Sidebar BG** | `#192943` | พื้นหลังของแถบ Sidebar |
| **Accent Green** | `#4ADE80` | สีพื้นหลังโลโก้ และ Active Icon |
| **Toggle Green** | `#24D282` | ปุ่ม Hamburger เมนูกลมสีเขียว |
| **Main Background** | `#F8FAFC` | พื้นหลังหลักของหน้าเว็บและ Body |
| **Card / Bar BG** | `#FFFFFF` | พื้นหลัง Topbar และ Dropdown Menu |
| **Search Bar BG** | `#F0F4F8` | พื้นหลังช่องค้นหา |
| **Badge Red** | `#FB2C36` | จุดแจ้งเตือน Notification Badge |
| **Text Primary** | `#1D293D` / `#1E293B` | ข้อความหลัก เช่น ชื่อผู้ใช้, หัวข้อเมนู |
| **Text Secondary** | `#62748E` / `#90A1B9` | ข้อความรอง ตำแหน่ง, Placeholder |
| **Border / Divider** | `#E2E8F0` / `#F1F5F9` | เส้นขอบและเส้นแบ่งเมนู |

---

## 🚀 การติดตั้งและรันโปรเจกต์ (Getting Started)

### ความต้องการขั้นต่ำ (Prerequisites)
- **Node.js** เวอร์ชัน 18.x ขึ้นไป
- **npm** หรือ **yarn** / **pnpm**

### 1. เข้าสู่โฟลเดอร์โปรเจกต์
```bash
cd general-clinic/react-frontend
```

### 2. ติดตั้ง Dependencies
```bash
npm install
```

### 3. เริ่มต้น Development Server
```bash
npm run dev
```
ระบบจะรันบน Local Server โดยปกติที่ `http://localhost:5173/`

### 4. Build สำหรับ Production
```bash
npm run build
```

### 5. Preview Production Build
```bash
npm run preview
```

---

## 👥 บันทึกการพัฒนา (Development Notes)
- พัฒนาโดยเน้นการใช้ **CSS Transitions & Keyframes Animations** โดยไม่พึ่งพา External UI Library เพื่อประสิทธิภาพสูงสุดและความแม่นยำตามดีไซน์
- โค้ดคอมโพเนนต์ทุกส่วนถูกแยกแบบ Modular และมี TypeScript Interface กำกับชัดเจน
