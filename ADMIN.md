# AivaSpa · Admin Panel (`admin.<your-domain>`)

Real-time, single-tenant admin control room. Locked behind a Supabase auth user
with `app_metadata.is_admin = true` and served only on the `admin.*` subdomain.

## Pages

| Path | Purpose |
| --- | --- |
| `/admin` | System overview: live KPIs, sparklines, integrations, row counts, latency histogram, webhook fail rate |
| `/admin/live` | Real-time event feed (leads, chats, webhooks, notifications, API keys) via Supabase Realtime |
| `/admin/leads` | All leads across the platform, paginated + searchable |
| `/admin/conversations` | All chat sessions with lead-capture state |
| `/admin/users` | Signed-up users + onboarding state |
| `/admin/spas` | Widget installs (`widget_installs`) + active flag |
| `/admin/webhooks` | Recent webhook delivery attempts (status, duration, error) |
| `/admin/api-keys` | All API keys across all users (prefix, scopes, last used) |
| `/admin/notifications` | Email / SMS delivery log |
| `/admin/llm` | Per-60m message intervals, token usage, cost estimate, provider status |
| `/admin/audit` | System audit log (with `user_id` column) |
| `/admin/database` | Row counts per table + query errors |
| `/admin/settings` | Feature flags, kill switches, LLM caps (editable JSON) |

## Setup

### 1. Set the admin flag on a user

Sign up the user normally, then from the project root:

```powershell
node scripts/grant-admin.mjs you@example.com
```

The script updates `auth.users.app_metadata.is_admin = true` for that user.
They must sign out and back in for the new JWT to take effect.

### 2. Configure the subdomain in DNS

Point `admin.aivaspa.online` (CNAME) at your deployment:
- Vercel: add an `admin` subdomain in the project's Domains panel.
- Cloudflare / other: CNAME `admin` → `<your-deployment>.vercel.app`.

### 3. Configure Vercel

Vercel does not yet have a separate domain for `admin.*`, but the app detects
the subdomain via the `host` header in `proxy.ts`. The current rules:

- On the main domain (`aivaspa.online`): `/admin/*` returns 404 for non-admins.
- On the admin subdomain (`admin.aivaspa.online`):
  - Only `/admin/*` is served.
  - All other paths redirect to the main domain.
  - Non-admin authenticated users get a hard 403.
  - Unauthenticated users get redirected to `/login?redirectTo=/admin`.

### 4. Realtime

Realtime is enabled on the most-watched tables in migration `00013_admin_panel.sql`:

- `leads`, `chat_sessions`, `webhook_deliveries`, `notification_logs`,
  `api_keys`, `webhooks`, `subscriptions`.

If you need additional tables in the live feed, run:

```sql
alter publication supabase_realtime add table <table>;
```

## Architecture

```
proxy.ts                       Subdomain detection + admin gate
src/app/admin/*                Server components, requireAdmin() in each layout
src/app/api/admin/*            API routes, requireAdminApi() → 401/403
src/lib/admin/auth.ts          requireAdmin, requireAdminApi, isAdminUser
src/lib/admin/queries.ts       getSystemHealth, getUserList, getDatabaseHealth
src/components/admin/
  admin-realtime-provider.tsx  Realtime channel + event reducer + dedup
  admin-shell.tsx              Sidebar + topbar nav
  kpi-card.tsx, sparkline.tsx  Inline metric UI (no extra deps)
  latency-histogram.tsx        LLM interval histogram (inline SVG)
  error-rate-chart.tsx         Webhook fail rate (inline SVG)
  live-feed.tsx, live-ticker.tsx  Animated feed
  data-table.tsx               Searchable, paginated table
  status-pill.tsx              Coloured status indicators
src/app/admin/settings/        Server actions for feature flags + kill switches
src/app/api/admin/system-health/route.ts  Health endpoint for live polling
scripts/grant-admin.mjs        CLI helper
supabase/migrations/00013_admin_panel.sql  Tables + RLS + Realtime + defaults
```

## Security

- Every page calls `requireAdmin()` server-side; non-admins are redirected.
- Every API route calls `requireAdminApi()` and returns 401 / 403.
- The admin subdomain only serves `/admin/*`; everything else redirects to the
  main domain.
- On the main domain, `/admin/*` returns 404 for non-admins (even if the path
  leaks into search results or other users' bookmarks).
- The settings page writes are wrapped in server actions that:
  - Re-check the admin flag (defence in depth).
  - Write an entry to `admin_audit_log` (immutable, with admin email + IP/UA).
  - Call `revalidatePath("/admin/settings")` so the change is visible on next load.
- All queries use the service-role admin client (necessary for cross-tenant
  reads in this single-tenant deployment).

## Adding a new admin page

1. Add a route: `src/app/admin/<feature>/page.tsx`
2. Add it to `ADMIN_NAV` in `src/components/admin/admin-shell.tsx`
3. For data, add a helper to `src/lib/admin/queries.ts` (use `createAdminClient()`)
4. If it needs real-time updates, extend `TABLE_TO_EVENT` in
   `admin-realtime-provider.tsx`
