# AivaSpa — Production Deployment

## Required env vars

Set these in your hosting provider (Vercel → Project → Settings → Environment Variables):

| Var | Scope | Required | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Yes | https://xxx.supabase.co |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Yes | Anon key, RLS-protected |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Yes | Service role, never expose |
| `NEXT_PUBLIC_SITE_URL` | Public | Yes | https://your-domain.com |
| `OPENAI_API_KEY` | Server | Optional | Empty = canned response engine |
| `OPENAI_BASE_URL` | Server | Optional | Default: https://api.openai.com/v1 |
| `OPENAI_MODEL` | Server | Optional | Default: gpt-4o-mini |
| `RESEND_API_KEY` | Server | Optional | Empty = console.log emails |
| `EMAIL_FROM` | Server | Optional | Default: AivaSpa <alerts@your-domain.com> |
| `TWILIO_ACCOUNT_SID` | Server | Optional | Empty = console.log SMS |
| `TWILIO_AUTH_TOKEN` | Server | Optional | |
| `TWILIO_FROM_NUMBER` | Server | Optional | E.164, e.g. +15551234567 |
| `GOOGLE_OAUTH_CLIENT_ID` | Server | Optional | Required for Google Calendar |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Server | Optional | Required for Google Calendar |
| `GOOGLE_OAUTH_REDIRECT_URI` | Server | Optional | e.g. https://your-domain.com |
| `CORS_ALLOWED_ORIGINS` | Server | Optional | Comma-separated list. Production: REQUIRED |
| `EMBED_ALLOWED_ORIGINS` | Server | Optional | Comma-separated list. Production: REQUIRED |
| `STRIPE_SECRET_KEY` | Server | Optional | When wiring real billing |
| `STRIPE_WEBHOOK_SECRET` | Server | Optional | When wiring real billing |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Public | Optional | When wiring real billing |

> **Production must set** `CORS_ALLOWED_ORIGINS` and `EMBED_ALLOWED_ORIGINS` to the
> domain(s) that may embed the widget / call the public APIs. If unset in
> production, the embed will be locked and public APIs will reject cross-origin
> calls.

## Deploy to Vercel

```bash
npm install -g vercel
vercel link
vercel env add NEXT_PUBLIC_SUPABASE_URL production
# ... add the rest
npx supabase db push   # apply migrations to hosted Supabase
vercel --prod
```

## Subdomain routing (aivaspa.online → admin.aivaspa.online)

The app already routes by hostname in `proxy.ts`:

| Host | Serves |
| --- | --- |
| `aivaspa.online` (and `www.`) | Marketing landing, signup, login, customer `/dashboard` |
| `admin.aivaspa.online` | Internal `/admin` panel (system health, all spas, audit log, etc.) — transparent rewrite, URL stays on the subdomain |
| `<spa>.aivaspa.online` | That spa's white-label widget (resolved via `custom_domains` table) |
| `chat.<customer-domain>` | Per-spa custom domain (Pro/Agency plan) |

So once you add the apex and the `admin.` subdomain (or the wildcard) in Vercel, everything just works — no code changes needed beyond what's already shipped.

### One-command setup (recommended)

```bash
# 1. Get a Vercel API token: https://vercel.com/account/tokens
export VERCEL_TOKEN=…
export VERCEL_PROJECT_ID=…   # or run `vercel link` first; the script reads .vercel/project.json

# 2. Add aivaspa.online, www., admin., and *.aivaspa.online to the project
npm run domains:setup
```

The script will:
- Create the four domains on the Vercel project (apex, `www`, `admin`, wildcard).
- Print the exact DNS records to add at your registrar (A + CNAMEs).
- Print per-domain TXT verification records.

```bash
# 3. Add the DNS records at your registrar, wait 1-10 min, then verify:
npm run domains:verify
```

When `--no-wildcard` is passed, the `*.aivaspa.online` entry is skipped (useful if you're on the Vercel Hobby plan — wildcards require Pro).

You can target a different apex by passing `--apex=example.com` or setting `APEX_DOMAIN`.

### Manual setup (if you'd rather click)

1. **Vercel → Project → Settings → Domains**, add each of:
   - `aivaspa.online` (apex)
   - `www.aivaspa.online`
   - `admin.aivaspa.online`
   - `*.aivaspa.online` (Pro plan only — enables per-spa white-label subdomains)
2. Vercel will show the DNS records for each. At your registrar:
   - Apex `aivaspa.online` → **A** record `76.76.21.21`
   - `www`, `admin`, `*` → **CNAME** to `cname.vercel-dns.com`
3. Wait for the green "Valid Configuration" badge in Vercel.
4. Set the env var `NEXT_PUBLIC_SITE_URL=https://aivaspa.online` in Vercel.
5. Redeploy (`vercel --prod` or push to your default branch).

### Local testing of subdomains

To preview `admin.aivaspa.online` locally, add to your hosts file:

```
127.0.0.1   aivaspa.local
127.0.0.1   admin.aivaspa.local
```

Then run `npm run dev` and visit `http://admin.aivaspa.local:3000` (the proxy will detect the `admin.` host and rewrite to `/admin`).

## Post-deploy checklist

1. `npx supabase db push` — apply all 12 migrations to your hosted project.
2. In Supabase → Authentication → URL Configuration, set:
   - Site URL: `https://your-domain.com`
   - Redirect URLs: `https://your-domain.com/auth/callback`
3. In Supabase → Settings → API, copy anon + service_role keys.
4. In Google Cloud Console (if using Google Calendar):
   - Add `{GOOGLE_OAUTH_REDIRECT_URI}/api/google-calendar/callback` to Authorized redirect URIs.
5. Smoke test:
   - `GET /` (landing) returns 200
   - `GET /api/widget/config?spaId=…` returns 200 + `locked: false`
   - `POST /api/chat` with a sample spaId returns 200
   - Sign in via `/login`, reach `/dashboard`
   - `GET https://admin.aivaspa.online/` returns 200 (or 302 to `/login`) — confirms the subdomain rewrite works.
6. Confirm RLS is on for every table:
   ```sql
   select schemaname, tablename, rowsecurity
   from pg_tables
   where schemaname = 'public' and rowsecurity = false;
   ```
   (should return 0 rows)

## CORS / embed allow-list

Both vars accept a comma-separated list:

```
CORS_ALLOWED_ORIGINS=https://spa-one.com,https://www.spa-one.com
EMBED_ALLOWED_ORIGINS=https://spa-one.com
```

- `CORS_ALLOWED_ORIGINS` gates public API endpoints (`/api/chat`, `/api/leads`, `/api/widget/config`, `/api/google-calendar/slots`, `/api/v1/leads`).
- `EMBED_ALLOWED_ORIGINS` sets the `frame-ancestors` and `X-Frame-Options` for `/embed/*` and `/embed-demo/*`. In production, leaving this empty locks the embed (it can only be loaded by your own domain or iframed from sites you trust).

In development, both default to `http://localhost:3000` and `http://127.0.0.1:3000`.

## Smoke tests

```bash
# Public widget config (replace <spaid> with a widget key from the dashboard)
curl -i "https://your-domain.com/api/widget/config?spaId=<spaid>"

# Direct lead POST
curl -i -X POST https://your-domain.com/api/leads \
  -H 'content-type: application/json' \
  -d '{"spaId":"<spaid>","sessionId":"sess_1","name":"Test","phone":"+15551234567","service":"Botox","preferredTime":"Tomorrow 3pm","consentGiven":true}'
```
