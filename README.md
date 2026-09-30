# 💳 NIBSS Wallet

A secure, production-ready digital wallet API built with **Node.js**, **Express**, **TypeScript**, and **MongoDB**. Designed around Nigerian financial standards (NGN currency, NIBSS compliance patterns), it provides a complete authentication flow, user management, and wallet operations with enterprise-grade security practices.

---

## ✨ Features

- 🔐 **JWT Authentication** — Access + Refresh token pair strategy with HttpOnly cookie support
- 🏦 **Wallet Management** — Auto-provisioned NGN wallet on registration with daily transfer limits
- 👤 **User Management** — Profile updates, secure password changes, and onboarding tracking
- 🛡️ **Security** — AES-256-GCM encryption for sensitive fields (NIN/BVN), bcrypt password hashing, Helmet headers
- ✅ **Input Validation** — `express-validator` powered request validation middleware
- 🧪 **Testing** — Jest + Supertest integration tests with an in-memory MongoDB server
- 📋 **Error Handling** — Centralised operational error handler with typed `AppError` class

---

## 🏗️ Project Structure

```
nibss-wallet/
├── backend/                   # Express/TypeScript REST API
│   ├── src/
│   │   ├── server.ts          # Entry point — loads env, connects DB, starts server
│   │   ├── app.ts             # Express setup — middleware, routes, error handlers
│   │   ├── config/
│   │   │   └── database.ts    # Mongoose connection
│   │   ├── models/
│   │   │   ├── user.model.ts  # User schema with pre-save hooks (hashing, encryption)
│   │   │   └── wallet.model.ts# Wallet schema with daily limit tracking
│   │   ├── types/
│   │   │   ├── user.types.ts  # User TypeScript interfaces
│   │   │   └── wallet.types.ts# Wallet TypeScript interfaces
│   │   ├── utils/
│   │   │   ├── AppError.ts    # Custom operational error class
│   │   │   ├── encryption.utils.ts  # AES-256-GCM encrypt/decrypt helpers
│   │   │   └── jwt.utils.ts   # Token generation & verification
│   │   ├── services/
│   │   │   ├── auth.service.ts    # Register, login, refresh token logic
│   │   │   ├── user.service.ts    # Get profile, update profile, change password
│   │   │   └── wallet.service.ts  # Get wallet, get balance, daily limit check
│   │   ├── controllers/
│   │   │   ├── auth.controller.ts
│   │   │   ├── user.controller.ts
│   │   │   └── wallet.controller.ts
│   │   ├── middlewares/
│   │   │   ├── auth.middleware.ts      # JWT protect guard
│   │   │   ├── error.middleware.ts     # Global error handler
│   │   │   ├── validate.middleware.ts  # express-validator result handler
│   │   │   └── validators/
│   │   │       ├── auth.validator.ts
│   │   │       └── user.validator.ts
│   │   └── routes/
│   │       ├── auth.routes.ts
│   │       ├── user.routes.ts
│   │       └── wallet.routes.ts
│   └── __tests__/
│       ├── auth.test.ts       # Auth integration tests
│       └── setup.ts           # MongoDB Memory Server setup
└── frontend/                  # (Coming soon)
```

---

## 🌐 API Reference

**Base URL:** `http://localhost:5000/api/v1`

### 🔑 Auth — `/auth`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/auth/register` | ❌ | Create account + auto-provision wallet |
| `POST` | `/auth/login` | ❌ | Authenticate and receive token pair |
| `POST` | `/auth/logout` | ❌ | Clear session cookies |
| `POST` | `/auth/refresh-token` | ❌ | Issue new token pair via refresh token |

**Register body:**
```json
{
  "firstName": "Somi",
  "lastName": "Dotun",
  "email": "somi@example.com",
  "phone": "08012345678",
  "password": "SecurePass123!"
}
```

**Login body:**
```json
{
  "email": "somi@example.com",
  "password": "SecurePass123!"
}
```

---

### 👤 Users — `/users` *(Protected)*

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/users/me` | ✅ | Get current authenticated user profile |
| `PATCH` | `/users/me` | ✅ | Update name or phone number |
| `PATCH` | `/users/me/change-password` | ✅ | Change password (validates current password) |

**Update profile body:**
```json
{
  "firstName": "Somi",
  "lastName": "Dotun",
  "phone": "08098765432"
}
```

**Change password body:**
```json
{
  "currentPassword": "OldPass123!",
  "newPassword": "NewPass456!"
}
```

---

### 💰 Wallet — `/wallet` *(Protected)*

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/wallet` | ✅ | Get full wallet details |
| `GET` | `/wallet/balance` | ✅ | Get balance, currency & daily limit status |

---

### 🏥 Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | API liveness check |

---

## 🔒 Security Architecture

| Feature | Implementation |
|---------|---------------|
| **Password hashing** | `bcryptjs` — auto-hashed on pre-save Mongoose hook |
| **Sensitive field encryption** | AES-256-GCM (12-byte IV, 16-byte auth tag) for NIN & BVN |
| **Token strategy** | Short-lived access token (15 min) + long-lived refresh token (7 days) |
| **HTTP security headers** | `helmet` middleware |
| **CORS** | Configured per `FRONTEND_URL` env variable |
| **Cookie security** | `cookie-parser` + HttpOnly cookie strategy |
| **Input validation** | `express-validator` on all mutation endpoints |

---

## 🚀 Getting Started

### Prerequisites

- Node.js `>= 20.0.0`
- MongoDB instance (local or Atlas)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/somidotun/nibss-wallet.git
cd nibss-wallet/backend

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Fill in your values (see Environment Variables section below)

# 4. Start the development server
npm run dev
```

The server will start on `http://localhost:5000`.

---

## ⚙️ Environment Variables

Create a `.env` file inside `/backend` with the following keys:

```env
PORT=5000
NODE_ENV=development

# MongoDB
MONGO_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/nibss-wallet

# JWT
JWT_ACCESS_SECRET=your_access_token_secret
JWT_REFRESH_SECRET=your_refresh_token_secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Encryption (must be a 32-byte hex string for AES-256)
ENCRYPTION_KEY=your_32_byte_hex_key

# Frontend (for CORS)
FRONTEND_URL=http://localhost:3000
```

---

## 📜 Available Scripts

From the `/backend` directory:

| Script | Command | Description |
|--------|---------|-------------|
| Development | `npm run dev` | Hot-reload server via `nodemon` + `tsx` |
| Build | `npm run build` | Compile TypeScript → `/dist` |
| Start | `npm start` | Run compiled production build |
| Type check | `npm run type-check` | `tsc --noEmit` — validate types without emitting |
| Lint | `npm run lint` | ESLint analysis |
| Lint & Fix | `npm run lint:fix` | ESLint auto-fix |
| Test | `npm test` | Jest integration tests |
| Test (watch) | `npm run test:watch` | Jest in watch mode |
| Coverage | `npm run test:coverage` | Jest with coverage report |

---

## 🌊 Request Lifecycle

```
Client Request
     │
     ▼
app.ts / server.ts     ← Security headers (Helmet), CORS, body parsers
     │
     ▼
routes/                ← URL matching (auth, users, wallet)
     │
     ▼
middlewares/           ← JWT guard (protect), input validation
     │
     ▼
controllers/           ← Parse request, call service, send response
     │
     ▼
services/              ← Business logic (auth, user, wallet rules)
     │
     ▼
models/                ← Mongoose schemas, pre-save hooks (hash/encrypt)
     │
     ▼
MongoDB                ← Persistent storage
```

---

## 🧪 Testing

Tests use **Jest** + **Supertest** with an in-memory MongoDB server (`mongodb-memory-server`) so no real database connection is required.

```bash
npm test              # Run all tests
npm run test:coverage # Run with coverage report
```

---

## 📦 Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js (ESM) |
| Framework | Express 5 |
| Language | TypeScript 5 |
| Database | MongoDB + Mongoose 9 |
| Auth | JWT (`jsonwebtoken`) |
| Hashing | `bcryptjs` |
| Encryption | Node.js `crypto` (AES-256-GCM) |
| Validation | `express-validator` |
| Security | `helmet`, `cors`, `cookie-parser` |
| Logging | `morgan` |
| Testing | Jest 30, Supertest, `mongodb-memory-server` |
| Dev Tools | `tsx`, `nodemon`, ESLint, TypeScript ESLint |

---

## 🗺️ Roadmap

- [ ] KYC verification (NIN / BVN submission & masking)
- [ ] Transaction PIN setup & verification
- [ ] Fund wallet (Paystack integration)
- [ ] Peer-to-peer transfers
- [ ] Transaction history
- [ ] Admin dashboard
- [ ] Frontend (React / Next.js)

---

## 📄 License

ISC