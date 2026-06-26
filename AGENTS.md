<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version (Next.js 16.2.7) has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AivaSpa — Project Guide for AI Agents

> **One-liner:** A 24/7 AI receptionist for med spas. A single `<script>` snippet embeds an AI chat widget on a spa's website; the AI answers from the spa's approved knowledge base, captures leads, and notifies the owner by email/SMS. A dashboard, lead inbox, calendar integration, API keys, and webhooks wrap it.

This file is the source of truth for any AI/agent working in this repo. Read it before touching code.

---

## 1. Tech stack (single source)

| Layer | Choice | Notes |
| --- | --- | --- |
| Framework | **Next.js 16.2.7** (App Router) | RSC + Route Handlers + `proxy.ts` (middleware). **Breaking changes vs. older Next — always check `node_modules/next/dist/docs/`.** |
| UI | **React 19.2.4** | Server Components by default; `"use client"` only where needed. |
| Styling | **Tailwind v4** + CSS vars | Theme tokens are defined in `app/globals.css` (dark, AivaSpa palette). |
| Components | **shadcn/ui** + **Radix** primitives | Local copies in `src/components/ui/`. |
| Forms | `react-hook-form` + `zod` | Validation schemas live next to the API route that uses them. |
| Animations | `framer-motion` | Used on landing-page blocks (`src/components/landing/*`). |
| Tables | `@tanstack/react-table` | Leads inbox, webhook deliveries. |
| Toasts | `sonner` | |
| Backend | **Supabase** (Postgres + Auth + Realtime + RLS) | `src/lib/supabase/{client,server,admin,types}.ts`. |
| AI | **Cloudflare Workers AI** via `src/lib/ai/llm.ts` | Uses Cloudflare Workers AI (OpenAI-compatible endpoint). Default model `@cf/meta/llama-3.2-3b-instruct`. Falls back to a canned-response engine if `CLOUDFLARE_API_TOKEN` is empty. |
| Email | **Resend** (`src/lib/notifications/email.ts`) | Logs to console if no key. |
| SMS | **Twilio** (`src/lib/notifications/sms.ts`) | Logs to console if no key. |
| Calendar | **Google Calendar OAuth2** (`src/lib/google/calendar.ts`) | Slots/booking/status/disconnect routes. |
| Auth | **Supabase Auth** (email/password + OAuth via `auth/callback`) | Server actions in `app/actions/auth.ts`. |
| Tests | **Vitest** | `tests/*.test.ts`. |
| Lint | `eslint` (next config) | `npm run lint`. |

`PRD.md` is the original product spec; treat it as historical context, not the active source of design decisions.

---

## 2. Repo map (what lives where)

```
app/                          Next.js App Router (NOT src/app)
  page.tsx                    Marketing landing
  pricing/, signup/, login/, forgot-password/, reset-password/, check-email/
  onboarding/                 AI-driven setup assistant for first-time users
  dashboard/                  Authed dashboard (layout.tsx enforces auth via proxy.ts)
    page.tsx                  Overview + KPIs + live visitors
    leads/                    Inbox + [id] detail
    conversations/            Live transcript explorer
    knowledge-base/           FAQs + services + guardrails editor
    analytics/, settings/, team/, widget/, guide/
    calendar/                 Custom calendar UI
  embed/[spaId]/              The chat widget (server-rendered iframe target)
  embed-demo/                 A demo med-spa site with the widget pre-installed
  admin/                      Internal admin panel (is_admin gated)
    layout.tsx                Enforces is_admin via requireAdmin()
    page.tsx                  Overview, KPIs, integrations, row counts
    leads/                    Cross-tenant lead view
    conversations/            Cross-tenant chat view
    webhooks/, api-keys/      System webhook & API key logs
    notifications/            System notification_logs
    audit/                    admin_audit_log + workspace events
    spas/                     All widget_installs
    database/                 Row counts across all tables
    settings/                 admin_settings (kill switches, feature flags, llm_caps)
    live/                     Realtime event feed
    llm/                      LLM KPIs + activity histogram
  api/
    chat/                     POST  → AI turn + optional lead save (widget-facing)
    leads/                    POST  → direct lead save (public, no API key)
    v1/leads/                 POST  → API-key-authed lead save (server-to-server)
    widget/                   config, verify, resolve-host
    google-calendar/          OAuth + slots + book + status + disconnect
    dashboard/live            GET   → live counters (active sessions, today's leads)
    onboarding/setup-assistant  POST → guided KB interview
    health                    GET/HEAD → DB health (no-cache, mirrors verdict on HEAD)
    admin/                    Admin-only endpoints (system-health, logout)
    calendar/                 Public calendar slots + bookings + reminders
    cron/                     Scheduled jobs (daily-summary placeholder)
    white-label/              Custom-domain management

  actions/                    Server Actions (form handlers)
    auth, settings, knowledge, leads, subscription, widget,
    widget-installs, api-keys, webhooks, setup-assistant, team

src/
  components/
    ui/                       shadcn-style primitives
    auth/, billing/, dashboard/, embed/, landing/, onboarding/, admin/
  lib/
    supabase/                 client.ts | server.ts | admin.ts | types.ts
    ai/                       conversation, llm, prompt, retrieval, validation,
                              working-hours, setup-assistant(-prompt|-schema)
    admin/                    auth, queries (system health, recent leads/chats/etc.)
    leads/                    server (createPublicLead, auto-book), dedup
    chat-sessions/server.ts   Live transcript persistence
    db/                       Per-table server-side helpers
    notifications/            email, sms, dispatch
    google/calendar.ts        Google OAuth + token refresh
    subscription/             Plan + quota logic
    webhooks/                 HMAC-signed outbound webhooks
    widget/                   access, installs, domains
    api/keys.ts               API key generation + hashing (aiva_live_…)
    hooks/                    useRealtime
    calendar/, i18n/, kb/, security/

supabase/
  migrations/                 00001..00017 — schema + chat_sessions + subscriptions
                              + widget_installs + api/webhooks + lead_dedup +
                              extended_kb + active_session_expiry +
                              bubble_logo + audit_user_id + admin_panel +
                              custom_calendar + custom_domains +
                              ensure_calendar_tables +
                              notification_owner_scope

tests/                        Vitest suites (ai, api, leads-dedup,
                              notifications, setup-assistant, webhooks)

proxy.ts                      Auth gate (Next.js middleware — note: filename is
                              `proxy.ts`, not `middleware.ts`, in Next 16)
next.config.ts                CORS for /api/*, frame-ancestors * for /embed/*
.env.example                  All env vars (Supabase, OpenAI, Resend, Twilio,
                              Google OAuth)
```
src/
  app/                      Next.js App Router
    page.tsx                Marketing landing
    pricing/, signup/, login/, forgot-password/, reset-password/, check-email/
    onboarding/             AI-driven setup assistant for first-time users
    dashboard/              Authed dashboard (layout.tsx enforces auth via proxy.ts)
      page.tsx              Overview + KPIs + live visitors
      leads/                Inbox + [id] detail
      conversations/        Live transcript explorer
      knowledge-base/       FAQs + services + guardrails editor
      analytics/, settings/, team/, widget/, guide/, integrations/
    embed/[spaId]/          The chat widget (server-rendered iframe target)
    embed-demo/             A demo med-spa site with the widget pre-installed
    checkout/[plan]/        Stripe-like checkout
    api/
      chat/                 POST  → AI turn + optional lead save (widget-facing)
      leads/                POST  → direct lead save (public, no API key)
      v1/leads/             POST  → API-key-authed lead save (server-to-server)
      widget/config         GET   → public widget config JSON
      google-calendar/*     OAuth + slots + book + status + disconnect
      dashboard/live        GET   → live counters (active sessions, today's leads)
      onboarding/setup-assistant   POST → guided KB interview
    actions/                Server Actions (form handlers)
      auth, settings, knowledge, leads, subscription, widget,
      widget-installs, api-keys, webhooks, setup-assistant
  components/
    ui/                     shadcn-style primitives
    auth/, billing/, dashboard/, embed/, landing/, onboarding/
  lib/
    supabase/               client.ts | server.ts | admin.ts | types.ts
    ai/                     conversation, llm, prompt, retrieval, validation,
                            working-hours, setup-assistant(-prompt|-schema)
    leads/                  server.ts (createPublicLead), dedup.ts, dedup-shared.ts
    chat-sessions/server.ts Live transcript persistence
    db/                     Per-table server-side helpers
    notifications/          email.ts, sms.ts, dispatch.ts
    google/calendar.ts      Google OAuth + token refresh
    subscription/           Plan + quota logic
    webhooks/               HMAC-signed outbound webhooks
    widget/                 access.ts, installs.ts
    api/keys.ts             API key generation + hashing (aiva_live_…)
    rate-limit.ts, audit.ts, utils.ts

supabase/
  migrations/               00001..00010 — full schema + Google Calendar +
                            chat_sessions + subscriptions + widget_installs +
                            api/webhooks + lead_dedup + extended_kb +
                            active_session_expiry

tests/                      Vitest suites (ai, api, leads-dedup,
                            notifications, setup-assistant)

proxy.ts                    Auth gate (Next.js middleware — note: filename is
                            `proxy.ts`, not `middleware.ts`, in Next 16)
next.config.ts              CORS for /api/*, frame-ancestors * for /embed/*
.env.example                All env vars (Supabase, OpenAI, Resend, Twilio,
                            Google OAuth)
```

---

## 3. How the system fits together (end-to-end)

### 3.1 Visitor → Lead flow

```
┌─────────────────┐   <script src=".../embed/<spaId>/loader" data-spa-id="…">
│  Med spa site   │ ───────────────────────────────────────────────────────┐
└─────────────────┘                                                         │
        │  (loader script inlines, lazy-loads <50KB)                        ▼
        ▼                                                       GET /api/widget/config?spaId=…
┌─────────────────┐   fetch /embed/<spaId> inside a sandboxed iframe         │
│  AivaSpa widget │ ◄──────────────────────────────────────────────────────┘
│  (ChatFrame)    │
└────────┬────────┘
         │ visitor types a message
         ▼
   POST /api/chat  (body: { sessionId, message, history, lead?, consentGiven, sourceUrl, spaId })
         │
         ├─► runConversationTurn()            src/lib/ai/conversation.ts
         │     ├─ loadKnowledge()             src/lib/ai/retrieval.ts   (cached, single-row KB from DB)
         │     ├─ buildSystemPrompt()         src/lib/ai/prompt.ts
         │     └─ llmChat()                   src/lib/ai/llm.ts         (OpenAI-compatible)
         │
         ├─► upsertChatSessionTurn()          src/lib/chat-sessions/server.ts
         │     (writes every turn to chat_sessions → Supabase Realtime
         │      streams it to the dashboard's "Conversations" view)
         │
         ├─► if lead.name+phone+service+consentGiven:
         │     ├─ createPublicLead()          src/lib/leads/server.ts
         │     │     └─ dedup by phone/email  src/lib/leads/dedup.ts
         │     ├─ markSessionLeadCaptured()
         │     ├─ dispatchLeadNotifications() src/lib/notifications/dispatch.ts
         │     │     ├─ sendEmail()           Resend (or console)
         │     │     └─ sendSms()             Twilio (or console)
         │     └─ recordAudit()               src/lib/audit.ts
         │
         └─► reply JSON → widget renders message

   In parallel (for any lead with a userId via /api/leads or /api/v1/leads):
         └─► fireEvent()/fireEventForAll()     src/lib/webhooks/index.ts
               (HMAC-signed POST to customer URLs; deliveries logged in
                webhook_deliveries; events: lead.created | lead.updated |
                lead.deleted | conversation.started | conversation.completed)
```

### 3.2 Widget install lifecycle

1. Owner signs up → onboarding AI assistant fills `widget_config` (single-row) and a row in `widget_installs` keyed by `widget_key` (the `spaId`).
2. Owner opens `/dashboard/widget` → see snippet, copy, paste before `</body>` on their site.
3. Loader (`app/embed/[spaId]/loader/route.ts`) returns a small JS file that:
   - Reads `data-spa-id` (or infers from its own URL).
   - Fetches `/api/widget/config?spaId=…` to get brand, color, position, proactive settings.
   - Builds a host `<div>` + sandboxed `<iframe>` pointing to `/embed/[spaId]?parent=…`.
   - On `data-spa-id` mismatch or `locked: true` from config, the widget is disabled (cancelled, no chat).
4. `checkEmbedAccess(spaId)` (in `src/lib/widget/access.ts`) gates every embed hit:
   - Reads `widget_installs.active` and the owner's `subscriptions` row.
   - Returns `not_found` / `inactive_install` / `expired` or `ok`.
   - Results are cached in-memory for 60 s.

### 3.3 Auth + middleware

- `proxy.ts` runs for every request (excluding `_next/static`, `_next/image`, `favicon.ico`, image extensions).
- Protected prefixes: `/dashboard`, `/onboarding` → redirect to `/login?redirectTo=…` if no user.
- Auth routes: `/login`, `/signup`, `/forgot-password`, `/check-email` → redirect to `/dashboard` if already signed in.
- Supabase SSR client (`@supabase/ssr`) is used to refresh cookies on every request.

### 3.4 Dashboard structure (authed)

| Path | Purpose | Key lib functions |
| --- | --- | --- |
| `/dashboard` | KPIs, today's leads, live visitor count | `getDashboardKpis`, `useRealtime` for live counter |
| `/dashboard/leads` | Inbox, status, dedup, merge | `getLeads`, `mergeLeads` |
| `/dashboard/leads/[id]` | Transcript + status change | `getLead` |
| `/dashboard/conversations` | Realtime feed of all chat sessions | `useRealtime('chat_sessions')` |
| `/dashboard/knowledge-base` | Services + FAQs + guardrails | `getKnowledgeBase`, `saveKnowledgeBase` |
| `/dashboard/widget` | Appearance, color, position, proactive | `getWidgetConfig`, `saveWidgetConfig` |
| `/dashboard/integrations/google-calendar` | OAuth + slot/booking settings | Google Calendar helpers |
| `/dashboard/team` | Roles: Owner / Manager / Staff / Receptionist | `getTeam`, `inviteMember` |
| `/dashboard/settings` | Profile, plan, API keys, webhooks, notification channels | `listApiKeys`, `listWebhooks` |
| `/dashboard/analytics` | Charts (leads/day, conversion, response) | `getAnalytics` |
| `/dashboard/guide` | **Install Guide** (`GuideView`) — copy/paste instructions | Reads `widget.id` and `spa_settings.website` |

### 3.5 Onboarding

`/onboarding` is a 9-section AI interview (`SETUP_ASSISTANT_SECTIONS` in `src/lib/ai/setup-assistant-schema.ts`):

`business → services → pricing → faqs → guardrails → hours → branding → channels → review`

- The assistant (`runSetupAssistantTurn` in `src/lib/ai/setup-assistant.ts`) is itself an LLM call with a strict JSON-draft schema.
- Each turn persists the partial `KnowledgeBase` to `auth.users.user_metadata.onboarding_kb_draft` via the admin client — so users can resume.
- On finish, the merged KB is written to `widget_config`, `knowledge_services`, `knowledge_faqs`, and `knowledge_guardrails`.

### 3.6 Subdomain routing (host-based)

`proxy.ts` is host-aware. The Host header decides what the visitor sees:

| Host | Behavior |
| --- | --- |
| `aivaspa.online` (and `www.`) | Landing, signup, login, customer `/dashboard` |
| `admin.aivaspa.online` | Transparent rewrite to `/admin/*` — URL bar stays on the subdomain, content comes from the internal admin pages (system health, all spas/users, audit, etc.). `app_metadata.is_admin` required. |
| `<spa>.aivaspa.online` | If that subdomain is in the `custom_domains` table → serve the widget for that spa (header `x-resolved-spa-id`). Otherwise fall through to the landing page. |
| `chat.<customer-domain>` (Pro plan) | White-label widget on the customer's own domain (same `custom_domains` resolution). |

The `scripts/setup-vercel-domains.mjs` script adds all of these to a Vercel project from the CLI (requires `VERCEL_TOKEN`). See `DEPLOYMENT.md` → "Subdomain routing" for the one-command flow.

---

## 4. Feature ↔ file ↔ API map

### 4.1 Public widget (no auth)
| Feature | File / Route | Notes |
| --- | --- | --- |
| Embed page (iframe target) | `app/embed/[spaId]/page.tsx` | Renders `ChatFrame`; falls back to `EmbedLock` if not entitled. |
| Loader JS | `app/embed/[spaId]/loader/route.ts` | Sets up `window.AivaSpa = { open, close, toggle, refresh, destroy }`. |
| Widget config JSON | `app/api/widget/config/route.ts` | CORS `*`; returns brand, color, position, proactive settings, faq/service counts. |
| Chat turn | `app/api/chat/route.ts` (POST) | See §3.1. Validates with `chatRequestSchema` in `src/lib/ai/validation.ts`. |
| Direct lead POST | `app/api/leads/route.ts` (POST) | Public — used when the widget pre-collects lead fields. |

### 4.2 API-key authed (server-to-server)
| Endpoint | Method | Auth | Scope required | Purpose |
| --- | --- | --- | --- | --- |
| `/api/v1/leads` | GET | `Authorization: Bearer aiva_live_…` or `x-api-key` | — | Discovery: lists supported events. |
| `/api/v1/leads` | POST | same | `leads:write` | Create a lead from any external system (e.g. webform, POS). Validates `name`, `phone`, `service`, `preferredTime`, optional `email`. Fires `lead.created` webhook scoped to that user. |

API keys are created in `/dashboard/settings` via `createApiKeyAction` (`app/actions/api-keys.ts`).
- Plaintext is shown **once** at creation, prefixed `aiva_live_` (or `aiva_test_`).
- Server stores SHA-256 hash + a `key_prefix` for display.
- Scopes: `leads:write`, `leads:read`, `webhooks:read`, `webhooks:write` (`ALL_SCOPES` in `src/lib/api/keys.ts`).

### 4.3 Internal server actions (form posts)
| Action | File | Triggered by |
| --- | --- | --- |
| Login / signup / reset | `app/actions/auth.ts` | Auth pages |
| Save widget config | `app/actions/widget.ts` | `/dashboard/widget` |
| Save KB | `app/actions/knowledge.ts` | `/dashboard/knowledge-base` |
| Save settings | `app/actions/settings.ts` | `/dashboard/settings` |
| Lead status / merge | `app/actions/leads.ts` | `/dashboard/leads` |
| Subscription / plan | `app/actions/subscription.ts` | `/pricing`, `/checkout` |
| Webhooks CRUD | `app/actions/webhooks.ts` | `/dashboard/settings` |
| Widget install toggles | `app/actions/widget-installs.ts` | `/dashboard/integrations` |
| Setup assistant save | `app/actions/setup-assistant.ts` | `/onboarding` |

### 4.4 Notifications (`src/lib/notifications/`)
- `dispatch.ts` reads `notification_channels` (rows keyed by `channel`: `email`, `sms`, `daily_summary`).
- Recipients are an array of strings; per recipient: send via Resend/Twilio, log to `notification_logs` with status `delivered`/`pending`/`failed`, retry up to 3× with exponential backoff.
- `daily_summary` is intentionally a no-op here — it's a scheduled job placeholder.
- If env keys are empty, both `email.ts` and `sms.ts` log payloads to console and return `ok: true` (dev mode).

### 4.5 Google Calendar integration
| Route | Purpose |
| --- | --- |
| `/api/google-calendar/auth` (GET) | Start OAuth. |
| `/api/google-calendar/callback` (GET) | OAuth redirect — exchanges code, stores `google_calendar_settings`. |
| `/api/google-calendar/status` (GET) | Is the spa connected? Which calendar? |
| `/api/google-calendar/disconnect` (POST) | Revoke token, clear settings. |
| `/api/google-calendar/settings` (POST) | Update booking duration, working hours, buffer, working days. |
| `/api/google-calendar/slots` (GET) | Returns free slots for a given date. |
| `/api/google-calendar/book` (POST) | Creates a calendar event for a lead; records it in `google_calendar_events`. |

The OAuth client/secret must be set in `.env`; the redirect URI is built from `GOOGLE_OAUTH_REDIRECT_URI + /api/google-calendar/callback`.

### 4.6 Webhooks (outbound, customer-facing)
- Owner registers a URL in `/dashboard/settings`. `webhooks.events` is an array of `WEBHOOK_EVENTS` (declared in `src/lib/webhooks/types.ts`).
- On `lead.created` / `lead.updated` / `lead.deleted` / `conversation.started` / `conversation.completed` we POST:
  ```
  Headers: X-AivaSpa-Event, X-AivaSpa-Signature: t=<unix>,v1=<hmac>, X-AivaSpa-Webhook-Id
  Body: { event, delivered_at, data: {...} }
  ```
- Signature: `HMAC_SHA256(secret, "<timestamp>.<rawBody>")`. `verifySignature` uses `crypto.timingSafeEqual`.
- Every attempt is logged to `webhook_deliveries` (response status, body, duration, error) and visible in the dashboard.

### 4.7 Subscriptions, quota, paywall
- `subscriptions` table holds plan, status, period, monthly quota, conversations used.
- `deriveSnapshot` in `src/lib/subscription/index.ts` returns `isLocked` (past trial/canceled/expired) and quota remaining.
- `checkEmbedAccess` blocks the embed when locked.
- `QuotaBanner`, `Paywall`, `TrialPopup` (in `src/components/billing/`) react to the snapshot.
- `/checkout/[plan]` is a placeholder Stripe-style flow; `actions/subscription.ts` is the action surface.

### 4.8 Realtime (dashboard)
- `useRealtime` in `src/lib/hooks/use-realtime.ts` subscribes to a Supabase Realtime channel.
- The dashboard's "live visitor counter" polls `/api/dashboard/live` and uses the channel to update in real time.
- `chat_sessions` row updates stream into the Conversations view.

### 4.9 Lead dedup
- `findDuplicateLead` in `src/lib/leads/dedup.ts` normalizes phone/email and matches on `phone_normalized` or `email_normalized`.
- If a duplicate is found, `mergeIncomingIntoLead` keeps the canonical row, sets `merged_into_id` on the old row, and appends transcripts.
- This means the same visitor messaging twice from different sessions never creates a parallel lead.

---

## 5. Database schema (high-level)

See `supabase/migrations/00001_initial_schema.sql` for full DDL. Tables:

| Table | Purpose |
| --- | --- |
| `spa_settings` | Single-row workspace config (name, website, owner, plan). |
| `team_members` | Roles + invite status. |
| `knowledge_services` / `knowledge_faqs` / `knowledge_guardrails` | Approved KB the AI is allowed to draw from. RLS disabled (see migration `00019`) — dashboard edits use the admin client; public widget reads are scoped by `spa_settings.allowed_origins` at the route boundary. |
| `widget_config` | Single-row widget appearance + working hours. |
| `widget_installs` | One row per install of the widget (key = `widget_key` = `spaId`); `active` flag + `user_id`. |
| `leads` | Captured leads with normalized phone/email, transcript, status, source, after_hours, consent_given. |
| `chat_sessions` | Live transcript rows; Realtime-enabled. |
| `google_calendar_settings` / `google_calendar_events` | OAuth tokens + booked events. |
| `subscriptions` | Plan, quota, trial/canceled state. |
| `notification_channels` / `notification_logs` | Recipients + delivery history. |
| `api_keys` | Hashed server keys + scopes. |
| `webhooks` / `webhook_deliveries` | Outbound endpoints + delivery log. |
| `audit_logs` | Action history (admin + widget). |
| `integrations_config` | Catalog of available integrations (currently only Google Calendar). |

Migrations `00002…00010` add Google Calendar, chat sessions, integrations-only flag, subscriptions, widget_installs, api/webhooks, lead dedup, extended KB, and active session expiry (`expire_chat_sessions` RPC).

---

## 6. Env vars

See `.env.example` for the full template. Required at minimum:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=
```

Optional (each falls back to a stub):

```bash
CLOUDFLARE_API_TOKEN=            # if empty → canned-response engine
CLOUDFLARE_MODEL=                # default @cf/meta/llama-3.2-3b-instruct
RESEND_API_KEY=                  # if empty → console.log
EMAIL_FROM=
TWILIO_ACCOUNT_SID=              # if empty → console.log
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
GOOGLE_OAUTH_CLIENT_ID=          # required to enable Google Calendar
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URI=
GOOGLE_API_KEY=                  # read-only public-data key (optional)
```

---

## 7. Local development

```bash
npm install
cp .env.example .env.local       # fill in Supabase at minimum
npx supabase start               # or link to hosted project
npx supabase db push             # apply all migrations
npm run dev                      # http://localhost:3000
npm run lint                     # eslint
npm run test                     # vitest run
```

The dev server runs the dashboard at `/dashboard` and the live widget at `/embed-demo`. The landing page at `/` is the public marketing site.

---

## 8. Conventions

- **Server vs client.** Anything that touches Supabase with the service role or reads cookies must be a server module. Mark with `"use server"` (server actions) or import from `lib/supabase/server.ts`. Never import `lib/supabase/admin.ts` from a client component.
- **API routes** live under `app/api/<feature>/route.ts` and export named HTTP methods. Always include `OPTIONS` for CORS preflight and set `runtime = "nodejs"` if you need `node:crypto` (used in `webhooks/index.ts`).
- **Validation** uses Zod schemas in `src/lib/ai/validation.ts` (chat/lead) and `src/lib/ai/setup-assistant-schema.ts` (onboarding). Wrap with `safeValidate(schema, raw)` in API routes.
- **Types.** Re-export DB row types from `src/lib/supabase/types.ts`; do not hand-write Row types.
- **Theme tokens.** Use the CSS variables defined in `app/globals.css` (`--bg-base`, `--accent-primary`, etc.). Hard-coded hex is allowed inside the dashboard's dark palette but prefer the variables.
- **No new top-level deps** without confirmation — package set is intentional.

---

## 9. Tests

```bash
npm run test          # vitest run
npm run test:watch    # vitest
```

`tests/` mirrors `src/lib/`:
- `ai.test.ts` — prompt/retrieval
- `api.test.ts` — endpoint contracts
- `leads-dedup.test.ts` — phone/email normalization + merge
- `notifications.test.ts` — dispatch + retry
- `setup-assistant.test.ts` — onboarding schema + turn flow

When you add a new feature, add a vitest spec under `tests/`.

---

## 10. Common tasks (cheat sheet)

**Add a new webhook event** → extend `WEBHOOK_EVENTS` in `src/lib/webhooks/types.ts`, fire it from the right spot in `lib/leads/server.ts` or `lib/chat-sessions/server.ts`.

**Add a new API scope** → extend `ALL_SCOPES` in `src/lib/api/keys.ts`, check it in `/api/v1/*` routes, and surface it in the dashboard settings UI.

**Add a new dashboard page** → drop it under `app/dashboard/<feature>/page.tsx` and link it in `dashboard-sidebar.tsx`. The `dashboard/layout.tsx` already enforces auth.

**Change the AI prompt** → edit `src/lib/ai/prompt.ts`. To bypass LLM and use canned responses, leave `CLOUDFLARE_API_TOKEN` empty.

**Tune widget access rules** → `src/lib/widget/access.ts` and the `widget_installs` table.

**Block a domain from embedding** → extend `checkEmbedAccess` with an origin allow-list pulled from `spa_settings.allowed_origins` (TODO if you add it).

---

## 11. Do not

- Don't write raw SQL from the app — go through Supabase client.
- Don't expose `SUPABASE_SERVICE_ROLE_KEY` to the client. It's used in `lib/supabase/admin.ts` only.
- Don't store the openai key in a client component or any file under `src/components/`.
- Don't return PII (phone/email) from `/api/widget/config` — it's public.
- Don't add a Stripe webhook handler without checking the `STRIPE_WEBHOOK_SECRET` flow (currently a stub).

---

## 12. Where to look first (new agent onboarding)

1. `PRD.md` — original product brief.
2. `proxy.ts` — auth boundary.
3. `app/api/chat/route.ts` — the central request handler.
4. `src/lib/ai/conversation.ts` — what an AI turn actually does.
5. `src/lib/leads/server.ts` — how leads are written + deduped.
6. `src/lib/notifications/dispatch.ts` — how owners are notified.
7. `supabase/migrations/` — what the DB actually looks like.
8. `app/dashboard/guide/page.tsx` + `guide-view.tsx` — the customer-facing install guide.

