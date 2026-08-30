# Pak-tel.com — Customer Management Portal

> **Internal Staff Customer 360 & eSIM Management System**

A production-ready, high-performance staff CRM built with **React**, **Cloudflare Workers (Hono)**, and **Cloudflare D1 (Relational SQLite Database)** for managing Callbite eSIM customers, multiple eSIM assignments, manual renewals, purchase ledgers, support requests, and full chronological activity history.

---

## Key Features

- **Customer 360 Profile**: Complete unified view with contact details, multiple eSIM profiles, transaction ledger, support tickets, contact history, scheduled tasks, internal notes, and chronological timeline.
- **Multiple eSIMs per Customer**: Seamlessly attach, manage, and renew multiple eSIM packages per customer.
- **Manual Renewals Operations**: 1-click renewal workflow that extends eSIM dates, records transactions, calculates profit margins, logs audit events, and updates activity timelines.
- **WhatsApp Integration & Predefined Messages**: Direct WhatsApp link generation with predefined message templates (Renewal Reminder, Expiry Notification, Confirmation, Support Response) and automatic interaction logging.
- **Customer Referral Tracking**: Dedicated Referrals page to track which existing customers refer new clients and measure word-of-mouth conversion revenue.
- **Actionable Staff Dashboard**: Real-time calculated KPIs for Customers, eSIMs, Renewals, Support, and Finances, plus actionable tables for Overdue Tasks, Expiring eSIMs, and Urgent Tickets.
- **Global Rapid Search (`Ctrl+K`)**: Lightning-fast lookup across Customer Names, WhatsApp numbers, Phone numbers, Emails, Customer IDs, ICCIDs, eSIM IDs, and Support Tickets.
- **Real Scannable QR Codes**: Canvas-rendered LPA activation QR codes with copy-to-clipboard functionality.
- **Role-based Staff Management**: Admin vs Support Staff roles with audit logs tracking every change.

---

## Pre-seeded Admin Credentials

Staff accounts are pre-seeded in the database:

| Email | Password | Role |
|---|---|---|
| `Admin@callbite.com` | `Touch@11223` | ADMIN |
| `Naeem@callbite.com` | `Touch@11223` | ADMIN |
| `aaa@callbite.com` | `Touch@786` | ADMIN |

*(Note: Credentials are not shown on the public login page for security).*

---

## Quick Start (Local Development)

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Server
```bash
npm run dev
```
Open **http://localhost:3000** in your browser. The app runs with an embedded persistent local SQLite database that mirrors Cloudflare D1 with automatic schema and seed data loading.

---

## Cloudflare Deployment

### 1. Configuration
The project is pre-configured with `wrangler.jsonc`:
```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "esimadmin",
  "main": "worker/index.ts",
  "compatibility_date": "2026-08-23",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": "./dist",
    "binding": "ASSETS",
    "not_found_handling": "single-page-application"
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "callbite-crm",
      "database_id": "b5cc4a69-ed71-4e98-a9cd-7ccc95126900",
      "migrations_dir": "migrations"
    }
  ],
  "vars": {
    "APP_NAME": "callbite-crm"
  }
}
```

### 2. Execute Migrations on Cloudflare D1
```bash
npx wrangler d1 execute callbite-crm --remote --file=migrations/0001_initial_schema.sql
npx wrangler d1 execute callbite-crm --remote --file=migrations/0002_seed_data.sql
```

### 3. Build & Deploy
```bash
npm run build
npx wrangler deploy
```

---

## Comprehensive Technical Documentation

For the full detailed breakdown of database relationships, foreign keys, SQL schema, manual staff workflows, state machines, and code architecture, please refer to:

👉 **[`WORKFLOW.md`](./WORKFLOW.md)**
