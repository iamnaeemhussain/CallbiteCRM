# CALLBITE ESIM — CUSTOMER MANAGEMENT PORTAL
## Comprehensive Architecture, Workflows, Database Logics & System Guide

---

## 1. PRODUCT OVERVIEW & PHILOSOPHY

**Callbite Esim Customer Management Portal** is a production-grade, internal staff Customer 360 CRM system built specifically for Callbite's eSIM business operations.

### Core Philosophy
- **Internal Staff Operations ONLY**: No customer portal, no customer login, no customer-facing interfaces.
- **Manual Control over Automation**: All operations (customer creation, multiple eSIM assignment, package renewals, transactions, and WhatsApp contact logging) are explicitly controlled by Callbite staff.
- **Customer 360 Centric**: The central focal point of the entire application is the **Customer Profile** (`/customers/:id`). A staff member receiving a WhatsApp message can search the phone number and immediately see the customer's full history, active eSIMs, previous payments, support requests, and chronological activity.
- **Currency Standard**: **Pakistani Rupee (PKR - Rs.)** across all packages, transactions, cost prices, selling prices, profit calculations, and dashboards.
- **Zero Mock Functionality**: Every button, status change, filter, financial calculation, and timeline event is backed by real Cloudflare D1 relational database queries.

---

## 2. SYSTEM ARCHITECTURE & TECHNOLOGY STACK

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Single Page App)                      │
│   React 18 + TypeScript + Vite + Tailwind CSS + Lucide Icons           │
│   Contexts: AuthContext, ToastContext, SettingsContext                 │
│   Router: React Router v6 (Protected & Role-based routes)              │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / JSON API (Bearer Auth)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    BACKEND (Cloudflare Worker API)                     │
│   Hono Framework (`worker/index.ts`)                                   │
│   Modular Route Handlers:                                              │
│   ├── /api/auth          ├── /api/packages     ├── /api/tasks          │
│   ├── /api/dashboard     ├── /api/providers    ├── /api/referrals      │
│   ├── /api/customers     ├── /api/interactions ├── /api/staff          │
│   ├── /api/esims         ├── /api/notes        ├── /api/audit          │
│   ├── /api/renewals      ├── /api/settings     └── /api/search         │
│   └── /api/transactions                                               │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ SQL (Prepared Statements)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    DATABASE (Cloudflare D1 / SQLite)                   │
│   17 Relational Tables with Foreign Keys & Performance Indices         │
│   Migrations: `migrations/0001_initial_schema.sql`                     │
│   Seed Data: `migrations/0002_seed_data.sql`                           │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. RELATIONAL DATABASE SCHEMA & ENTITY RELATIONSHIPS

```
                    ┌─────────────────────────┐
                    │      users (Staff)      │
                    └────────────┬────────────┘
                                 │
         ┌───────────────────────┼────────────────────────┐
         │ assigned_to           │ created_by             │ staff_id
         ▼                       ▼                        ▼
┌─────────────────┐      ┌───────────────┐        ┌──────────────────┐
│    customers    │◄─────┤     esims     │◄───────┤   transactions   │
└────────┬────────┘      └───────┬───────┘        └──────────────────┘
         │                       │
         │           ┌───────────┴───────────┐
         │           ▼                       ▼
         │   ┌───────────────┐       ┌───────────────┐
         │   │   packages    │◄──────┤esim_providers │
         │   └───────────────┘       └───────────────┘
         │
         ├───────────────────────┼────────────────────────┐
         │                       │                        │
         ▼                       ▼                        ▼
┌─────────────────┐      ┌───────────────┐        ┌──────────────────┐
│ support_tickets │      │     tasks     │        │   interactions   │
└─────────────────┘      └───────────────┘        └──────────────────┘
         │
         ├───────────────────────┬────────────────────────┐
         ▼                       ▼                        ▼
┌─────────────────┐      ┌───────────────┐        ┌──────────────────┐
│      notes      │      │activity_timeln│        │    audit_logs    │
└─────────────────┘      └───────────────┘        └──────────────────┘
```

### Key Tables & Field Definitions

#### 1. `users` (Staff Accounts)
- `id` (TEXT PRIMARY KEY) — e.g. `STF-001`
- `name` (TEXT NOT NULL) — Staff member full name
- `email` (TEXT NOT NULL UNIQUE) — Case-insensitive staff email
- `password` (TEXT NOT NULL) — Plain string (min 8 chars) for direct SQL updates without hashing
- `role` (TEXT NOT NULL) — `'ADMIN'` | `'SUPPORT_STAFF'`
- `status` (TEXT NOT NULL) — `'active'` | `'inactive'`

#### 2. `packages` (eSIM Packages & Bundles)
- `id` (TEXT PRIMARY KEY) — e.g. `PKG-101`
- `country_region` (TEXT NOT NULL) — e.g. 'Pakistan', 'UAE / Dubai', 'Turkey', 'Europe'
- `package_name` (TEXT NOT NULL) — e.g. 'Pakistan 10GB Standard', 'UAE 5GB Traveler'
- `data_allowance` (TEXT NOT NULL) — e.g. '10GB', '20GB', 'Unlimited'
- `duration` (TEXT NOT NULL) — e.g. '30 Days', '15 Days'
- `provider` (TEXT NOT NULL) — Provider name
- `provider_id` (TEXT REFERENCES esim_providers(id))
- `selling_price` (REAL NOT NULL) — Predetermined selling price in PKR (e.g. `Rs. 4,500`)
- `cost_price` (REAL NOT NULL) — Predetermined supplier cost in PKR (e.g. `Rs. 2,800`)
- `profit` (REAL NOT NULL) — `selling_price - cost_price` in PKR (e.g. `+Rs. 1,700`)
- `features` (TEXT) — e.g. '5G Ultra Speed, Hotspot Allowed, Local Breakout'
- `status` (TEXT NOT NULL DEFAULT 'Active') — `'Active'` | `'Inactive'`

#### 3. `esim_providers` (eSIM Roaming Suppliers & Carriers)
- `id` (TEXT PRIMARY KEY) — e.g. `PRV-101`
- `name` (TEXT NOT NULL UNIQUE) — e.g. 'eSIMGo Wholesale', '1GLOBAL', 'Turkcell Direct', 'du / Etisalat'
- `code` (TEXT NOT NULL UNIQUE) — e.g. 'ESIMGO', '1GLOBAL', 'TURKCELL'
- `country_coverage` (TEXT NOT NULL) — Geographic coverage area
- `network_types` (TEXT NOT NULL) — e.g. '5G / 4G LTE'
- `portal_url` (TEXT) — Direct wholesale portal link

#### 4. `customers` (Master Customer Directory)
- `id` (TEXT PRIMARY KEY) — e.g. `CUST-1001`
- `full_name` (TEXT NOT NULL) — Customer full name
- `whatsapp_number` (TEXT NOT NULL) — Primary WhatsApp number
- `phone_number`, `email`, `country`, `city` (TEXT)
- `source` (TEXT NOT NULL) — `'Instagram'` | `'Facebook'` | `'TikTok'` | `'WhatsApp'` | `'Website'` | `'Referred by'` | `'Walk-in'` | `'Other'`
- `referred_by_customer_id` (TEXT REFERENCES customers(id))
- `status` (TEXT NOT NULL) — `'Active'` | `'Inactive'` | `'VIP'` | `'Blocked'`

#### 5. `esims` (eSIM Profiles — 1 Customer to Many eSIMs)
- `id` (TEXT PRIMARY KEY) — e.g. `ESIM-2001`
- `customer_id` (TEXT NOT NULL REFERENCES customers(id))
- `iccid` (TEXT NOT NULL UNIQUE) — 19-20 digit ICCID
- `country_region` (TEXT NOT NULL)
- `provider` (TEXT NOT NULL), `provider_id` (TEXT REFERENCES esim_providers(id))
- `package_name` (TEXT NOT NULL), `package_id` (TEXT REFERENCES packages(id))
- `data_allowance`, `duration` (TEXT NOT NULL)
- `start_date`, `expiry_date`, `renewal_date`, `activation_date` (TEXT)
- `status` (TEXT NOT NULL) — `'Pending'` | `'Active'` | `'Expired'` | `'Suspended'` | `'Cancelled'`
- `qr_code_data` (TEXT) — LPA string for canvas QR generation

---

## 4. PRE-SEEDED ADMIN CREDENTIALS

| Email | Password | Role |
|---|---|---|
| `Admin@callbite.com` | `Touch@11223` | ADMIN |
| `Naeem@callbite.com` | `Touch@11223` | ADMIN |
| `aaa@callbite.com` | `Touch@786` | ADMIN |

---

## 5. CLOUDFLARE PRODUCTION DEPLOYMENT

```bash
# 1. Install dependencies
npm install

# 2. Deploy remote D1 migrations
npx wrangler d1 execute callbite-crm --remote --file=migrations/0001_initial_schema.sql
npx wrangler d1 execute callbite-crm --remote --file=migrations/0002_seed_data.sql

# 3. Build & Deploy Worker
npm run build
npx wrangler deploy
```
