# 🏥 General Clinic Custom MCP Server

Custom Model Context Protocol (MCP) Server ที่พัฒนาขึ้นด้วยภาษา **Go** สำหรับโปรเจกต์ Clinic Management System โดยเฉพาะ ออกแบบมาเพื่อ:
1. **ประหยัด Tokens สูงถึง ~90-95%**: คืนค่าเฉพาะ AST และ Metadata เชิงความหมาย (High-density Semantic Context)
2. **เพิ่มความฉลาดและความเข้าใจ**: เชื่อมโยงบริบทตั้งแต่ Frontend (React + TypeScript) ข้ามมายัง Backend (Go + Gin) จนถึงฐานข้อมูล (GORM + PostgreSQL)
3. **ตรวจสอบความถูกต้อง (Contract Validation)**: ป้องกันข้อผิดพลาดของ Type ข้ามภาษาระหว่าง React และ Go

---

## 🛠️ รายการ Tools ที่มีให้ใช้งาน

| Tool Name | คำอธิบาย |
| :--- | :--- |
| `clinic_get_project_summary` | สรุปภาพรวม Architecture, Tech Stack, Ports, และ Routes ทั้งหมด |
| `clinic_get_schema` | ดึง GORM DB Model Fields, Types, JSON tags, และ Relations แบบย่อ |
| `clinic_get_routes` | ดึงตาราง API Endpoints ทั้งหมดพร้อม Middleware และ Roles ที่มีสิทธิ์ |
| `clinic_get_rbac_matrix` | ดูสิทธิ์ทั้ง 5 Roles (Registrar, Nurse, Nurse Assistant, Pharmacist, Cashier) |
| `clinic_trace_feature` | Trace การทำงานของ Feature ตั้งแต่ UI Page -> API Route -> Controller -> DB Model |
| `clinic_validate_contract` | ตรวจสอบความสอดคล้องระหว่าง TypeScript Interface และ Go Struct |
| `clinic_search_symbol` | ค้นหา Struct, Handler, หรือ Interface ในโค้ดผ่าน Go/TS AST |
| `clinic_get_modern_ui_system` | สรุปดีไซน์ซิสเต็ม UI/UX ทางการแพทย์ โมเดิร์น คลีน สี และ Best Practice ของ React 19 |
| `clinic_get_backend_logic_guide` | มาตรฐาน Go Clean Architecture, GORM Transactions, Envelope Response, และ RBAC |
| `clinic_get_domain_workflow` | State Machine และกฎทางคลินิก (Patient Lifecycle, Triage Rules, Pharmacy, Billing) |

---

## 🚀 การตั้งค่าใช้งานใน Antigravity

คัดลอกการตั้งค่านี้ไปใส่ในไฟล์ **`C:\Users\<YourUsername>\.gemini\config\mcp_config.json`**:

```json
{
  "mcpServers": {
    "general-clinic": {
      "command": "Z:\\general-clinic\\mcp-server\\clinic-mcp.exe",
      "args": ["--root=Z:\\general-clinic"]
    }
  }
}
```

---

## 🔨 การคอมไพล์ใหม่เมื่อมีการปรับแต่งโค้ดใน mcp-server

```bash
cd Z:\general-clinic\mcp-server
go build -o clinic-mcp.exe .
```
