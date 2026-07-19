# Project Technology Specification

This document lists the framework, library, and tool versions used in the Clinic Management System project. Ensure all team members align on these versions to prevent environment conflicts.

---

## ⚙️ Backend (Golang)

- **Language Runtime**: Go `v1.26.4` (Check using `go version`)
- **Key Libraries** (from `go.mod`):
  - **Gin Web Framework**: `github.com/gin-gonic/gin v1.12.0` (REST API & Routing)
  - **GORM (ORM)**: `gorm.io/gorm v1.31.2` (Object Relational Mapping)
  - **GORM PostgreSQL Driver**: `gorm.io/driver/postgres v1.6.0` (Database Connection)
  - **GoDotEnv**: `github.com/joho/godotenv v1.5.1` (Environment configuration loader)
  - **JWT (JSON Web Token)**: `github.com/golang-jwt/jwt/v5` (Authentication token provider)
  - **Bcrypt (Crypto)**: `golang.org/x/crypto/bcrypt v0.54.0` (Password security hashing)
  - **Validator**: `github.com/go-playground/validator/v10 v10.30.3` (JSON schema checking)

---

## 🖥️ Frontend (React + TypeScript + Vite)

- **Node.js Runtime**: Recommended `v20.x` (LTS) or `v22.x`
- **Build Tool**: Vite `^8.1.1`
- **Language**: TypeScript `~6.0.2`
- **Core Framework**: React `^19.2.7` / React DOM `^19.2.7`
- **Libraries to be installed**:
  - **Material-UI (MUI)**: `@mui/material`, `@emotion/react`, `@emotion/styled` (v6)
  - **MUI Icons**: `@mui/icons-material` (v6)
  - **React Router DOM**: `react-router-dom` (Router & Route guarding)
  - **Axios**: `axios` (HTTP Client for fetching backend API)

---

## 🗄️ Database & Services

- **Database**: PostgreSQL `v15` / `v16` (Hosted on **Supabase Cloud**)
- **Version Control**: Git (with **GitHub** for remote repository & PR merge flow)
