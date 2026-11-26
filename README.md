# PULSE — Application Health & Security Monitoring Platform

Pulse is a free, developer-friendly application health, uptime, expiry, and security monitoring platform built with **Next.js App Router**, **TypeScript**, **Tailwind CSS**, and **Supabase**.

---

## Key Features

- **Authentication & Isolation**: Supabase SSR authentication with email/password, password recovery, middleware route protection, and strict PostgreSQL Row Level Security (RLS).
- **Uptime & Performance Monitoring**: Background HTTP/HTTPS checks every 10 minutes with SSRF protection, 3-consecutive-failure downtime confirmation, automatic recovery detection, and 24h/7d/30d uptime & latency analytics.
- **GitHub App Integration**: Read-only (`Metadata: Read-only`, `Contents: Read-only`) GitHub App authentication with RS256 JWTs, short-lived installation tokens, and HMAC SHA-256 verified webhooks.
- **Security Scanning Engine**:
  - **Secret Detection**: Pattern-based scanner (AWS, GitHub, Google, Stripe, SendGrid, Twilio, PEM keys, DB URIs) with automatic secret masking.
  - **Dependency Vulnerability Scanning**: OSV API (`api.osv.dev`) integration for `package.json`, `requirements.txt`, `go.mod`, and `Cargo.toml`.
  - **HTTP Security Header Checks**: Non-destructive checks for HTTPS, HSTS, CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, and server banners.
- **SSL, Domain & Credential Expiry**: Native TLS certificate inspection, RDAP domain expiration lookup, and user-managed credential renewal reminders (30d, 7d, 1d, expired).
- **Rule-Based Explanation Engine**: 37 deterministic rules translating technical findings into plain-language answers (*What happened?*, *Why does it matter?*, *What could happen?*, *How can I fix it?*).
- **Unified Dashboard & Weekly Reports**: Real-time KPIs, searchable/sortable/paginated application table, and print-friendly weekly reports with duplicate-period prevention.
- **Health Score** *(new)*: Deterministic 0–100 score per application with color bands (green/yellow/red), top-3 actionable fixes, daily snapshots (90-day retention), and a sparkline trend. Computed by `src/lib/health-score.ts`.
- **Public Status Page & Badge** *(new)*: Opt-in `/status/<slug>` page and `/badge/<slug>` SVG badge per application. Only uptime, incident history, and overall status are shown — no internal URLs, error details, or account data. Rate-limited and cached.
- **First-Run Setup Checklist** *(new)*: Guided 6-step onboarding on the dashboard for new users. Skippable, dismissible, shows progress and time estimates. Existing users see only incomplete steps.
- **Bulk Import & Works-With Guide** *(new)*: Import up to 50 URLs via paste or CSV upload from the Applications page. Full SSRF validation and quota enforcement. See `/docs/works-with` for how Pulse complements UptimeRobot, Better Stack, and Sentry.

---

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React, TypeScript, Tailwind CSS, Lucide Icons
- **Backend / DB**: Supabase (PostgreSQL, Auth, RLS), Next.js Server Actions & Route Handlers
- **Deployment**: Vercel (Next.js) + Supabase + Scheduled Cron (`pg_cron` / external cron)

---

## Project Structure

```text
src/
├── app/
│   ├── actions/          # Server actions (applications, monitoring, expiry, security, dashboard, reports, github)
│   ├── api/              # Route handlers (/api/monitoring/run, /api/security/scan, /api/github/*)
│   └── dashboard/        # Unified dashboard, monitoring, security, expiry, reports, alerts, settings
├── components/           # Reusable UI, charts, and FindingExplanationCard
├── lib/
│   ├── explanations/     # 37 deterministic explanation rules & engine
│   ├── expiry/           # TLS & RDAP expiry checkers
│   ├── github/           # GitHub App JWT & webhook verification
│   ├── monitoring/       # SSRF-safe monitoring engine & uptime stats
│   ├── security/         # SSRF validator, secret scanner, OSV scanner, header checker
│   └── supabase/         # Browser, Server, Middleware, and Admin clients
supabase/migrations/      # SQL migrations 01 through 07
scripts/                  # Automated unit & security test suites
```

---

## Local Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Configure environment variables**:
   Copy `.env.example` to `.env.local` and fill in your Supabase, GitHub App, and `CRON_SECRET` values.
3. **Run Supabase migrations**:
   Execute `supabase/migrations/01_profiles.sql` through `14_onboarding_checklist.sql` in order in the Supabase SQL Editor.
   | Migration | Description |
   |-----------|-------------|
   | 01–11 | Core features (profiles, monitoring, security, expiry, GitHub, etc.) |
   | 12 | `health_score_snapshots` — daily health score with 90-day cleanup |
   | 13 | `status_pages` — opt-in public status page slugs with RLS |
   | 14 | `profiles` columns — `checklist_dismissed`, `checklist_skipped_steps` |
4. **Start the development server**:
   ```bash
   npm run dev
   ```

---

## Automated Tests

```bash
node scripts/test-url-security.mjs
node scripts/test-github-integration.mjs
node scripts/test-monitoring-engine.mjs
node scripts/test-expiry-monitoring.mjs
node scripts/test-security-scanning.mjs
node scripts/test-explanation-engine.mjs
node scripts/test-dashboard-reports.mjs
node scripts/test-health-score.mjs
node scripts/test-status-page.mjs
node scripts/test-checklist.mjs
node scripts/test-bulk-import.mjs
```

---

## Deployment Checklist (Vercel + Supabase)

1. Push repository to GitHub and import into **Vercel**.
2. Add all environment variables from `.env.example` to Vercel Project Settings (never expose `SUPABASE_SERVICE_ROLE_KEY`, `GITHUB_APP_PRIVATE_KEY`, or `CRON_SECRET` to the browser).
3. Configure Supabase Auth **Site URL** and **Redirect URLs** (`https://your-domain.com/auth/callback`).
4. Configure GitHub App **Callback URL** (`https://your-domain.com/api/github/callback`) and **Webhook URL** (`https://your-domain.com/api/github/webhook`).
5. Schedule `POST /api/monitoring/run` every 10 minutes and `POST /api/security/scan` weekly using Supabase `pg_cron` + `pg_net` (or an external cron service) with `Authorization: Bearer <CRON_SECRET>`.

---

## Troubleshooting

- **Missing monitoring data**: Ensure `04_monitoring_engine.sql` is applied and `POST /api/monitoring/run` is being triggered with `CRON_SECRET`.
- **GitHub App not connecting**: Verify `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_APP_PRIVATE_KEY` (with `\n` newlines), and `GITHUB_APP_WEBHOOK_SECRET` in `.env.local`.
