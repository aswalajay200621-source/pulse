# Pulse — Application Health & Security Monitoring

> **Tagline:** Keep your app alive and safe after launch, in plain language.

Pulse is a modern SaaS application health monitoring platform built with Next.js (App Router), TypeScript, and Tailwind CSS. The design system is inspired by Linear, Railway, Vercel, and Stripe, focusing on minimal layouts, neutral backgrounds, subtle borders, restrained animations, and dark/light themes.

---

## 🚀 How to Run the Project

### Prerequisites
- Node.js 18+ (tested on Node v24.15.0)
- npm 9+

### Commands

1. **Install dependencies** (if not already installed):
   ```bash
   npm install
   ```

2. **Start the local development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

3. **Build for production**:
   ```bash
   npm run build
   ```

4. **Run the production build**:
   ```bash
   npm run start
   ```

---

## 🔐 Phase 2: Authentication & User Management (Supabase)

Pulse integrates real authentication using the official `@supabase/ssr` library with Next.js App Router.

### 1. Configure Environment Variables
Create or update `.env.local`:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```
*(Never include the service_role key in client-accessible code).*

### 2. Run Database Migration in Supabase
Run the SQL script located in [`supabase/migrations/01_profiles.sql`](file:///c:/Users/aswal/PULSE/supabase/migrations/01_profiles.sql) in your Supabase project's **SQL Editor**.

This script sets up:
- The `public.profiles` table with `id`, `full_name`, `email`, `created_at`, `updated_at`.
- Strict **Row Level Security (RLS)** ensuring users only access their own profile (`auth.uid() = id`).
- An automated PostgreSQL trigger `handle_new_user()` syncing new signups from `auth.users` directly to `public.profiles`.

### 3. Auth Features Implemented
- **Email & Password Registration:** With name metadata and optional email verification.
- **Login & Logout:** Real session management via cookies, with immediate header and dropdown state sync.
- **Password Recovery & Reset:** Email password recovery flow (`/forgot-password` -> `/auth/callback` -> `/reset-password`).
- **Google OAuth:** Ready out-of-the-box if configured in Supabase Authentication -> Providers -> Google.
- **Route Protection:** Server-side `middleware.ts` validates sessions using `supabase.auth.getUser()`. Unauthenticated requests to `/dashboard/*` redirect to `/login?redirect=...`. Authenticated users visiting `/login` or `/register` are redirected to `/dashboard`.
- **Form Enhancements:** Validation, loading indicators, error alerts, success confirmations, and password visibility toggles.
- **Graceful Unconfigured Mode:** If environment variables are not set yet, an informative notice guide is displayed without breaking navigation.

---

## 📁 Folder Structure

```text
c:\Users\aswal\PULSE
├── src/
│   ├── app/
│   │   ├── layout.tsx                     # Root layout with next-themes provider
│   │   ├── globals.css                    # Tailwind base, CSS variables (dark & light tokens)
│   │   ├── page.tsx                       # Public marketing landing page
│   │   ├── login/page.tsx                 # Public sign in page
│   │   ├── register/page.tsx              # Public registration page
│   │   ├── forgot-password/page.tsx       # Password recovery page
│   │   ├── privacy/page.tsx               # Privacy policy page
│   │   ├── terms/page.tsx                 # Terms of service page
│   │   └── dashboard/
│   │       ├── layout.tsx                 # Dashboard route wrapper
│   │       ├── page.tsx                   # OVERVIEW dashboard (KPIs, latency, SLA, apps table)
│   │       ├── applications/
│   │       │   ├── page.tsx               # MY APPLICATIONS (list, filtering, add modal, empty state)
│   │       │   └── [id]/page.tsx          # APPLICATION DETAILS (uptime history, security summary, alerts)
│   │       ├── monitoring/page.tsx        # MONITORING (global edge network, probe latency, incidents)
│   │       ├── security/page.tsx          # SECURITY SCANS (vulnerability findings, severity, scan logs)
│   │       ├── alerts/page.tsx            # ALERTS (incident stream, severity flags, read/unread filters)
│   │       ├── reports/page.tsx           # REPORTS (weekly digest, executive brief, MTTR, SLA)
│   │       └── settings/page.tsx          # SETTINGS (profile, notification webhooks, account preferences)
│   ├── components/
│   │   ├── brand/
│   │   │   └── logo.tsx                   # Pulse heartbeat icon & logo component
│   │   ├── dashboard/
│   │   │   └── dashboard-layout-client.tsx# Collapsible sidebar, topbar, Cmd+K search, notifications
│   │   ├── shared/
│   │   │   ├── stat-card.tsx              # Reusable KPI statistic cards
│   │   │   ├── status-badge.tsx           # Reusable status badges (online/degraded/down/severity)
│   │   │   ├── empty-state.tsx            # Clean empty state placeholder component
│   │   │   └── simple-charts.tsx          # Responsive SVG area & bar uptime charts
│   │   ├── ui/                            # Minimal design system primitives
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── skeleton.tsx
│   │   │   └── theme-toggle.tsx
│   │   └── theme-provider.tsx             # next-themes wrapper
│   ├── data/
│   │   └── mock-data.ts                   # Isolated sample data (applications, alerts, findings, scans)
│   └── lib/
│       └── utils.ts                       # Classnames (clsx + tailwind-merge) helper
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.js
└── next.config.ts
```

---

## 🎨 Design System & Highlights

- **Palette:** Neutral, high-contrast dark mode (`#090a0f` / zinc) and clean paper-like light mode.
- **Typography:** Crisp sans-serif with monospace accents for metrics, IPs, latency numbers, and dates.
- **Accessibility & UX:**
  - Collapsible sidebar with quick environment indicators.
  - Quick Search dialog with `Cmd+K` / `Ctrl+K` and `Escape` support.
  - Interactive read/unread state handling for alerts.
  - Add Application modal dialog with form validation.
  - Empty state toggle simulation on the Applications page.
- **Restrictions Respected:** Strictly frontend only; all mock data is separated in `src/data/mock-data.ts`.
