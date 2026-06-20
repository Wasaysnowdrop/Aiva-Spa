# AivaSpa

> The 24/7 AI receptionist for med spas. A `<script>` snippet embeds an AI chat
> widget on a spa's website; the AI answers from the spa's approved knowledge
> base, captures leads, and notifies the owner by email/SMS. A dashboard, lead
> inbox, calendar integration, API keys, and webhooks wrap it.

- **Live site:** [aivaspa.online](https://aivaspa.online)
- **Demo widget:** [/embed-demo](/embed-demo)
- **Source docs:** see [`AGENTS.md`](./AGENTS.md) (full agent guide) and
  [`PRD.md`](./PRD.md) (product brief).

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16.2.7 (App Router, Turbopack) |
| UI | React 19 + Tailwind v4 + shadcn/ui |
| Backend | Supabase (Postgres + Auth + Realtime + RLS) |
| AI | OpenAI-compatible chat (gpt-5.4-mini default) with canned-response fallback |
| Email / SMS | Resend, Twilio |
| Calendar | Google Calendar OAuth2 |
| Tests | Vitest |
| Deploy | Vercel (preconfigured via `vercel.json`) |

---

## Quick start (local dev)

```bash
# 1. Install
npm install

# 2. Set up env
cp .env.example .env.local
# fill in: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SITE_URL
# (everything else is optional — features gracefully fall back)

# 3. Database
npx supabase start
npx supabase db push       # apply all migrations in supabase/migrations/

# 4. Run
npm run dev                # http://localhost:3000
```

Useful commands:

```bash
npm run lint               # eslint
npm run test               # vitest run
npm run build              # production build
npm run domains:setup      # one-time: add *.aivaspa.online to Vercel
```

---

## Production deployment (Vercel)

1. **Import the repo** in the Vercel dashboard (or `vercel link` from CLI).
2. **Set environment variables** in *Project → Settings → Environment
   Variables*. At minimum:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_SITE_URL` (your production domain, no trailing slash)
   - `CRON_SECRET` (random 32+ chars; protects `/api/cron/*`)
3. **Add the custom domains** (one-time):

   ```bash
   VERCEL_TOKEN=… npm run domains:setup
   ```

   This adds `aivaspa.online`, `www.`, `admin.`, and `*.aivaspa.online`
   (wildcard for `<spa>.aivaspa.online`) to the project.
4. **Configure DNS** at your registrar — see [`DEPLOYMENT.md`](./DEPLOYMENT.md)
   for the exact A / CNAME records.
5. **Deploy.** Vercel will run `npm run build` and assign the wildcard
   certificate automatically.

Optional env to enable advanced features: `OPENAI_API_KEY`, `RESEND_API_KEY`,
Twilio vars, Google OAuth, `EMBED_ALLOWED_ORIGINS`, `CORS_ALLOWED_ORIGINS`.

### Verifying the deploy

```bash
# Public health check
curl https://aivaspa.online/api/health

# Sitemap & robots
curl https://aivaspa.online/sitemap.xml
curl https://aivaspa.online/robots.txt

# OG image (dynamic, edge-rendered)
curl -I https://aivaspa.online/og
```

---

## Environment variables

See [`.env.example`](./.env.example) for the full annotated list. Quick map:

| Var | Required? | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Server-only service role |
| `NEXT_PUBLIC_SITE_URL` | recommended | Absolute site URL for emails, OAuth, OG |
| `CRON_SECRET` | recommended | Gates `/api/cron/*` |
| `OPENAI_API_KEY` | optional | AI replies (fallback if empty) |
| `RESEND_API_KEY` | optional | Email notifications (console if empty) |
| `TWILIO_*` | optional | SMS notifications (console if empty) |
| `GOOGLE_OAUTH_*` | optional | Google Calendar integration |
| `EMBED_ALLOWED_ORIGINS` | production | Comma-separated origins that can embed the widget |
| `CORS_ALLOWED_ORIGINS` | production | Comma-separated origins for `/api/*` CORS |

---

## Project layout

```
src/
  app/                      App Router (pages + api routes)
    api/                    Public + authed HTTP endpoints
    actions/                Server actions (forms)
    embed/[spaId]/          Widget iframe target + loader JS
    dashboard/              Authed owner dashboard
    admin/                  Internal admin panel
  components/               ui, auth, billing, dashboard, embed, landing
  lib/                      supabase, ai, leads, notifications, webhooks, …
supabase/migrations/        Numbered SQL migrations
proxy.ts                    Auth gate (Next.js 16 middleware)
next.config.ts              CORS, security headers, frame-ancestors
vercel.json                 Regions, cron, default headers
```

For the full feature ↔ file map, read [`AGENTS.md`](./AGENTS.md).

---

## Security & compliance

- Service role key is **never** imported from a client component.
- All API mutations go through server actions or route handlers that verify
  the Supabase session.
- The widget iframe is `sandbox`-ed; allowed origins are restricted via
  `EMBED_ALLOWED_ORIGINS` and the `frame-ancestors` CSP header.
- Webhook payloads are HMAC-SHA256 signed; signatures are verified with
  `crypto.timingSafeEqual`.
- Lead capture dedups on normalized phone / email — no double-records.
- Strict-Transport-Security, X-Content-Type-Options, Referrer-Policy and
  Permissions-Policy are set on every response in production.

---

## License

Proprietary — © AivaSpa. All rights reserved.
