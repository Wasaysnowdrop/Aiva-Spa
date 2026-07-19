"use client"

import * as React from "react"
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Code2,
  Copy,
  Globe,
  ExternalLink,
  HelpCircle,
  Lightbulb,
  Loader2,
  MessageCircle,
  MessageSquare,
  MousePointerClick,
  Radio,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { WidgetInstall } from "@/lib/widget/installs"
import type { StoredWidgetInstallCheck } from "@/lib/widget/installation-checks.server"

type PlatformId =
  | "wordpress"
  | "shopify"
  | "wix"
  | "squarespace"
  | "webflow"
  | "gtm"
  | "other"

type PlatformGuide = {
  id: PlatformId
  label: string
  hint: string
  steps: { title: string; body: string }[]
  tips: string[]
}

const PLATFORMS: PlatformGuide[] = [
  {
    id: "wordpress",
    label: "WordPress",
    hint: "For most blogs and business sites",
    steps: [
      {
        title: "Install the free WPCode plugin",
        body: "In your WordPress admin, go to Plugins → Add New, search for “WPCode”, and click Install → Activate. (If you already use Insert Headers and Footers, that works too.)",
      },
      {
        title: "Open the “Footer” snippet box",
        body: "In your WordPress sidebar, click Code Snippets → Header & Footer. Find the box called “Footer”.",
      },
      {
        title: "Paste the snippet and save",
        body: "Paste the AivaSpa code into the Footer box, click Save, and clear any cache plugin. Done — your chat bubble is live.",
      },
    ],
    tips: [
      "No plugin? You can also paste it in Appearance → Theme File Editor → footer.php, just above </body>.",
      "If you use a page builder like Elementor, paste the code in WPCode so it doesn't get stripped.",
    ],
  },
  {
    id: "shopify",
    label: "Shopify",
    hint: "For Shopify stores",
    steps: [
      {
        title: "Open the theme code editor",
        body: "From your Shopify admin, go to Online Store → Themes → click the ••• menu next to your live theme → Edit code.",
      },
      {
        title: "Open theme.liquid",
        body: "In the Layout folder, click theme.liquid. This is the main template for every page.",
      },
      {
        title: "Paste the snippet before </body>",
        body: "Scroll to the bottom, click just above the </body> tag, paste the AivaSpa code on a new line, and click Save.",
      },
    ],
    tips: [
      "If you ever switch themes, you'll need to paste the code into the new theme's theme.liquid too.",
      "The widget shows on your storefront, which is exactly where you want it.",
    ],
  },
  {
    id: "wix",
    label: "Wix",
    hint: "For Wix websites",
    steps: [
      {
        title: "Open Custom Code",
        body: "In your Wix dashboard, click Settings → Custom Code (under “Advanced”).",
      },
      {
        title: "Add a new code snippet",
        body: "Click “Add Code”, name it “AivaSpa Widget”, choose to load on All Pages, and pick “Body - end” as the position.",
      },
      {
        title: "Paste the snippet and apply",
        body: "Paste the AivaSpa code in the box, click Apply, then Publish your site.",
      },
    ],
    tips: [
      "Wix requires a paid plan to add custom code — free sites can't use this.",
    ],
  },
  {
    id: "squarespace",
    label: "Squarespace",
    hint: "For Squarespace sites",
    steps: [
      {
        title: "Open Code Injection",
        body: "While editing your site, go to Settings → Advanced → Code Injection.",
      },
      {
        title: "Paste into the Footer box",
        body: "Scroll to the Footer box, paste the AivaSpa code, and click Save.",
      },
      {
        title: "Publish your site",
        body: "Click Publish in the top-right so the change goes live.",
      },
    ],
    tips: [
      "If you have multiple Squarespace sites, repeat these steps on each one.",
    ],
  },
  {
    id: "webflow",
    label: "Webflow",
    hint: "For Webflow projects",
    steps: [
      {
        title: "Open Project Settings",
        body: "In your Webflow dashboard, click the ••• menu next to your project → Settings.",
      },
      {
        title: "Go to Custom Code → Footer Code",
        body: "Paste the AivaSpa code in the Footer Code box.",
      },
      {
        title: "Save and publish",
        body: "Click Save Changes, then publish your site.",
      },
    ],
    tips: [
      "Test on your Webflow staging domain first to make sure it looks right.",
    ],
  },
  {
    id: "gtm",
    label: "Google Tag Manager",
    hint: "If your team uses GTM",
    steps: [
      {
        title: "Create a new tag",
        body: "In your GTM container, click “Add a new tag” → choose “Custom HTML”.",
      },
      {
        title: "Paste the snippet and trigger on All Pages",
        body: "Paste the AivaSpa code as the tag HTML, then set the trigger to “All Pages”.",
      },
      {
        title: "Submit and publish",
        body: "Click Save, then Submit to publish a new version of your container.",
      },
    ],
    tips: [
      "Use GTM's Preview mode to double-check the tag fires before you publish.",
    ],
  },
  {
    id: "other",
    label: "Something else / Not sure",
    hint: "Plain HTML, custom CMS, or you don't know",
    steps: [
      {
        title: "Find the file that controls your footer",
        body: "It's usually called index.html, default.html, layout.html, or footer.html. If you use a website builder, look for a “Custom HTML in Footer” or “Site-wide code” field.",
      },
      {
        title: "Paste the snippet just before </body>",
        body: "Open the file, scroll to the very end, and paste the AivaSpa code on its own line just above the </body> tag.",
      },
      {
        title: "Save and refresh your site",
        body: "Save the file (or click Publish). Open your site in a private window to see the chat bubble.",
      },
    ],
    tips: [
    ],
  },
]

export function GuideView({
  installs,
  siteUrl,
  website,
  brandName,
  latestVerification,
}: {
  installs: WidgetInstall[]
  siteUrl: string
  website: string
  brandName: string
  spaTimezone: string
  latestVerification: StoredWidgetInstallCheck | null
}) {
  const activeInstalls = installs.filter((i) => i.active)
  const firstInstall = activeInstalls[0]

  return (
    <div className="flex flex-col gap-8">

      <HeroSection />

      {firstInstall ? (
        <SnippetCard
          install={firstInstall}
          siteUrl={siteUrl}
        />
      ) : (
        <NoInstallEmptyState brandName={brandName} />
      )}

      {firstInstall ? (
        <PlatformPicker
          install={firstInstall}
          siteUrl={siteUrl}
          website={website}
        />
      ) : null}

      {firstInstall ? (
        <SiteChecker
          install={firstInstall}
          defaultUrl={website}
          siteUrl={siteUrl}
          latestVerification={latestVerification}
        />
      ) : null}

      <QuickVerify />

      <FriendlyTroubleshoot website={website} />
    </div>
  )
}

function HeroSection() {
  return (
    <div className="rounded-2xl border border-[#23252A] bg-[#121316] p-6 sm:p-8">
      <div>
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#E2E54B]">
          <Sparkles className="size-3.5" />
          Get live in about 5 minutes
        </div>
        <h1 className="mt-2 text-2xl font-semibold text-[#F7F8F8] sm:text-3xl">
          Add the chat widget to your website
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[#8A8F98]">
          You only need to copy one small piece of code and paste it into your
          site. Most platforms need only the three steps
          below and your chat will be live before your coffee gets cold.
        </p>
        <ol className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            {
              n: 1,
              title: "Copy your code",
              body: "Use the copy button on the snippet card below.",
            },
            {
              n: 2,
              title: "Paste it on your site",
              body: "Pick your platform below for exact, click-by-click steps.",
            },
            {
              n: 3,
              title: "Check that it works",
              body: "We'll automatically test your website to confirm it's live.",
            },
          ].map((s) => (
            <li
              key={s.n}
              className="rounded-xl border border-[#23252A] bg-[#0B0C0E]/60 p-4"
            >
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-lg bg-[#E2E54B] text-[12px] font-bold text-[#0B0C0E]">
                  {s.n}
                </span>
                <p className="text-sm font-semibold text-[#F7F8F8]">{s.title}</p>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-[#8A8F98]">
                {s.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

function NoInstallEmptyState({ brandName }: { brandName: string }) {
  return (
    <div className="rounded-2xl border border-[#E2E54B]/30 bg-[#E2E54B]/5 p-5">
      <p className="text-sm font-semibold text-[#F7F8F8]">
        Add your first website to get your snippet
      </p>
      <p className="mt-1 text-sm text-[#C9CCD2]">
        AivaSpa creates a unique install key per website. Head to{" "}
        <a
          href="/dashboard/widget"
          className="font-semibold text-[#E2E54B] hover:underline"
        >
          Widget → Your widget installs
        </a>{" "}
        and add the domain where you want the chat to appear. The snippet will
        be ready to copy within seconds, and then you can come back to this
        page for click-by-click instructions.
      </p>
      <p className="mt-3 text-xs text-[#8A8F98]">
        Working on {brandName}? Add a domain like{" "}
        <code className="rounded bg-[#1A1B1E] px-1.5 py-0.5 font-mono text-[11px] text-[#F7F8F8]">
          yourmedspa.com
        </code>{" "}
        — no{" "}
        <code className="rounded bg-[#1A1B1E] px-1.5 py-0.5 font-mono text-[11px] text-[#F7F8F8]">
          https://
        </code>{" "}
        and no trailing slash needed.
      </p>
    </div>
  )
}

function buildSnippet(siteUrl: string, widgetKey: string) {
  return `<script
  src="${siteUrl.replace(/\/+$/, "")}/embed/${widgetKey}/loader"
  data-spa-id="${widgetKey}"
  defer
></script>`
}

function SnippetCard({
  install,
  siteUrl,
}: {
  install: WidgetInstall
  siteUrl: string
}) {
  const snippet = buildSnippet(siteUrl, install.widgetKey)
  const [copied, setCopied] = React.useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // ignore
    }
  }
return (
    <section className="rounded-2xl border border-[#23252A] bg-[#121316] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#62666D]">
            <Code2 className="size-3.5" />
            Step 1 · Your code
          </div>
          <h2 className="mt-1 text-lg font-semibold text-[#F7F8F8]">
            Copy this one snippet
          </h2>
          <p className="mt-1 text-sm text-[#8A8F98]">
            This is the only line of code you need. It&apos;s tiny (under 50 KB)
            and won&apos;t slow your site down.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#23252A] bg-[#0B0C0E] px-2.5 py-1 text-[11px] font-semibold text-[#8A8F98]">
            <span className="size-1.5 rounded-full bg-[#4CB782]" />
            {install.label || install.domain}
          </span>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-[#23252A] bg-[#0B0C0E]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#23252A] bg-[#121316] px-3 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#62666D]">
            AivaSpa snippet
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={copy}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#E2E54B] px-3 py-1.5 text-[11px] font-semibold text-[#0B0C0E] hover:bg-[#E2E54B]/90"
            >
              {copied ? (
                <>
                  <Check className="size-3.5" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="size-3.5" />
                  Copy code
                </>
              )}
            </button>
          </div>
        </div>
        <pre className="overflow-x-auto p-4 text-[12px] leading-6 text-[#F7F8F8] sm:text-[13px]">
          <code>{snippet}</code>
        </pre>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#8A8F98]">
        <span className="inline-flex items-center gap-1.5">
          <CheckCircle2 className="size-3.5 text-[#4CB782]" />
          Won&apos;t slow your site
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CheckCircle2 className="size-3.5 text-[#4CB782]" />
          Works on every page
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CheckCircle2 className="size-3.5 text-[#4CB782]" />
          One paste, that&apos;s it
        </span>
      </div>
    </section>
  )
}

function PlatformPicker({
  install,
  siteUrl,
  website,
}: {
  install: WidgetInstall
  siteUrl: string
  website: string
}) {
  const [selected, setSelected] = React.useState<PlatformId>(() =>
    guessPlatform(website),
  )
  const platform = PLATFORMS.find((p) => p.id === selected) ?? PLATFORMS[6]
  const snippet = buildSnippet(siteUrl, install.widgetKey)

  return (
    <section className="rounded-2xl border border-[#23252A] bg-[#121316] p-5 sm:p-6">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#62666D]">
        <MousePointerClick className="size-3.5" />
        Step 2 · Where is your website built?
      </div>
      <h2 className="mt-1 text-lg font-semibold text-[#F7F8F8]">
        Pick your platform
      </h2>
      <p className="mt-1 text-sm text-[#8A8F98]">
        We&apos;ll show click-by-click steps for the one you choose. Not sure?
        Pick &ldquo;Something else&rdquo; and we&apos;ll give you the most
        general instructions.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {PLATFORMS.map((p) => {
          const isActive = p.id === selected
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelected(p.id)}
              className={cn(
                "group flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition",
                isActive
                  ? "border-[#E2E54B]/60 bg-[#E2E54B]/10"
                  : "border-[#23252A] bg-[#0B0C0E] hover:border-[#3A3D44] hover:bg-[#15171A]",
              )}
            >
              <PlatformIcon id={p.id} active={isActive} />
              <span className="mt-1 text-[12px] font-semibold text-[#F7F8F8]">
                {p.label}
              </span>
              <span className="line-clamp-2 text-[10px] leading-snug text-[#8A8F98]">
                {p.hint}
              </span>
            </button>
          )
        })}
      </div>

      <PlatformSteps
        platform={platform}
        snippet={snippet}
      />
    </section>
  )
}

function guessPlatform(website: string): PlatformId {
  const w = (website || "").toLowerCase()
  if (!w) return "other"
  if (w.includes("wordpress") || w.includes("wp-content") || w.includes("wp-includes"))
    return "wordpress"
  if (w.includes("myshopify.com") || w.includes("shopify")) return "shopify"
  if (w.includes("wixsite.com") || w.includes(".wix.")) return "wix"
  if (w.includes("squarespace.com")) return "squarespace"
  if (w.includes("webflow.io") || w.includes(".webflow.")) return "webflow"
  return "other"
}

function PlatformIcon({ id, active }: { id: PlatformId; active: boolean }) {
  const cls = cn(
    "flex size-7 items-center justify-center rounded-md border font-mono text-[11px] font-bold",
    active
      ? "border-[#E2E54B]/40 bg-[#E2E54B]/15 text-[#E2E54B]"
      : "border-[#23252A] bg-[#0B0C0E] text-[#8A8F98] group-hover:text-[#F7F8F8]",
  )
  switch (id) {
    case "wordpress":
      return (
        <span className={cls}>
          <span aria-hidden>W</span>
        </span>
      )
    case "shopify":
      return (
        <span className={cls}>
          <span aria-hidden>S</span>
        </span>
      )
    case "wix":
      return (
        <span className={cls}>
          <span aria-hidden>Wx</span>
        </span>
      )
    case "squarespace":
      return (
        <span className={cls}>
          <span aria-hidden>Sq</span>
        </span>
      )
    case "webflow":
      return (
        <span className={cls}>
          <span aria-hidden>Wf</span>
        </span>
      )
    case "gtm":
      return (
        <span className={cls}>
          <Radio className="size-3.5" />
        </span>
      )
    case "other":
      return (
        <span className={cls}>
          <Globe className="size-3.5" />
        </span>
      )
  }
}

function PlatformSteps({
  platform,
  snippet,
}: {
  platform: PlatformGuide
  snippet: string
}) {
  const [copied, setCopied] = React.useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // ignore
    }
  }
return (
    <div className="mt-5 rounded-2xl border border-[#23252A] bg-[#0B0C0E] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[#F7F8F8]">
            {platform.label} — 3 simple steps
          </p>
          <p className="text-xs text-[#8A8F98]">
            Allow about 2–3 minutes. You don&apos;t need to touch any other
            settings.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#E2E54B]/40 bg-[#E2E54B]/10 px-2.5 py-1.5 text-[11px] font-semibold text-[#E2E54B] hover:bg-[#E2E54B]/20"
          >
            {copied ? (
              <>
                <Check className="size-3.5" />
                Copied
              </>
            ) : (
              <>
                <Copy className="size-3.5" />
                Copy code
              </>
            )}
          </button>
        </div>
      </div>

      <ol className="mt-4 space-y-3">
        {platform.steps.map((s, i) => (
          <li
            key={i}
            className="flex items-start gap-3 rounded-xl border border-[#23252A] bg-[#121316] p-3"
          >
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-[#E2E54B] text-[12px] font-bold text-[#0B0C0E]">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#F7F8F8]">{s.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-[#8A8F98]">
                {s.body}
              </p>
            </div>
          </li>
        ))}
      </ol>

      {platform.tips.length > 0 ? (
        <div className="mt-4 rounded-xl border border-[#5E6AD2]/30 bg-[#5E6AD2]/5 p-3">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#8B95E0]">
            <Lightbulb className="size-3" /> Helpful tips
          </p>
          <ul className="mt-2 space-y-1.5 text-xs text-[#8A8F98]">
            {platform.tips.map((t) => (
              <li key={t} className="flex items-start gap-2">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-[#5E6AD2]" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 rounded-xl border border-dashed border-[#3A3D44] bg-[#0B0C0E] p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#62666D]">
          The code to paste
        </p>
        <pre className="mt-2 overflow-x-auto rounded-md bg-[#050608] p-3 text-[11px] leading-5 text-[#F7F8F8] sm:text-[12px]">
          <code>{snippet}</code>
        </pre>
      </div>
    </div>
  )
}

function SiteChecker({
  install,
  defaultUrl,
  siteUrl,
  latestVerification,
}: {
  install: WidgetInstall
  defaultUrl: string
  siteUrl: string
  latestVerification: StoredWidgetInstallCheck | null
}) {
  type CheckResult = {
    success: boolean
    status: StoredWidgetInstallCheck["status"]
    scriptFound: boolean
    widgetIdMatched: boolean
    checkedUrl: string
    checkedAt: string
    message: string
  }
  const initialResult: CheckResult | null = latestVerification ? {
    success: latestVerification.status === "installed" || latestVerification.status === "not_found",
    status: latestVerification.status,
    scriptFound: latestVerification.scriptFound,
    widgetIdMatched: latestVerification.widgetIdMatched,
    checkedUrl: latestVerification.checkedUrl,
    checkedAt: latestVerification.checkedAt,
    message: latestVerification.status === "installed"
      ? "AivaSpa is installed and the widget ID matches this business."
      : latestVerification.status === "not_found"
        ? "We couldn't find the AivaSpa widget code on this page."
        : "This is the latest saved verification result.",
  } : null
  const [url, setUrl] = React.useState(defaultUrl)
  const [checking, setChecking] = React.useState(false)
  const [result, setResult] = React.useState<CheckResult | null>(initialResult)
  const [error, setError] = React.useState<string | null>(null)
  const snippet = `<script src="${siteUrl.replace(/\/$/, "")}/embed/${install.widgetKey}/loader" data-spa-id="${install.widgetKey}" defer></script>`

  const check = async () => {
    const cleaned = url.trim()
    if (!cleaned || checking) {
      if (!cleaned) setError("Please enter your website address first.")
      return
    }
    setChecking(true)
    setError(null)
    try {
      const response = await fetch("/api/widget/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ spaId: install.widgetKey, url: cleaned }),
      })
      const data = await response.json() as CheckResult & { message?: string }
      if (!response.ok && !data.status) throw new Error(data.message || "We couldn't check your site.")
      setResult({ ...data, message: data.message || "The installation check finished." })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn't check your site. Please try again.")
    } finally {
      setChecking(false)
    }
  }

  const copySnippet = async () => {
    try { await navigator.clipboard.writeText(snippet) } catch { setError("Copy failed. Select the installation code above and copy it manually.") }
  }
  const installed = result?.status === "installed"
  const warning = result?.status === "not_found" || result?.status === "mismatch"
  const incomplete = result?.status === "incomplete"
  const title = installed ? "AivaSpa is installed" : result?.status === "not_found" ? "Widget code not found" : result?.status === "mismatch" ? "Widget ID does not match" : incomplete ? "Automatic check incomplete" : "We couldn't access your website"

  return (
    <section className="rounded-2xl border border-[#23252A] bg-[#121316] p-5 sm:p-6">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#62666D]"><Search className="size-3.5" />Step 3 · Check your site</div>
      <h2 className="mt-1 text-lg font-semibold text-[#F7F8F8]">Confirm the widget is live</h2>
      <p className="mt-1 text-sm leading-6 text-[#8A8F98]">We securely fetch the public page, follow up to three safe redirects, and look for this workspace&apos;s exact loader script and widget ID.</p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <label className="flex flex-1 items-center gap-2 rounded-xl border border-[#23252A] bg-[#0B0C0E] px-3 py-2.5">
          <Globe className="size-4 shrink-0 text-[#62666D]" />
          <span className="sr-only">Website URL</span>
          <input type="url" inputMode="url" autoComplete="url" value={url} onChange={(event) => setUrl(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void check() } }} placeholder="https://yourmedspa.com" className="min-w-0 flex-1 bg-transparent text-sm text-[#F7F8F8] placeholder:text-[#62666D] focus:outline-none" />
        </label>
        <Button type="button" onClick={() => void check()} disabled={checking} className="h-auto rounded-xl px-4 py-2.5">
          {checking ? <><Loader2 className="size-4 animate-spin" />Checking your site…</> : <>Check now<ArrowRight className="size-4" /></>}
        </Button>
      </div>
      {error ? <div role="alert" className="mt-3 flex items-start gap-2 rounded-xl border border-[#EB5757]/30 bg-[#EB5757]/5 p-3 text-xs text-[#F7F8F8]"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#EB5757]" /><span>{error}</span></div> : null}
      {result ? (
        <div className={cn("mt-4 rounded-xl border p-4", installed ? "border-[#4CB782]/40 bg-[#4CB782]/10" : warning ? "border-[#E2E54B]/35 bg-[#E2E54B]/5" : incomplete ? "border-[#5E6AD2]/35 bg-[#5E6AD2]/5" : "border-[#EB5757]/30 bg-[#EB5757]/5")}>
          <div className="flex min-w-0 items-start gap-3">
            {installed ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#4CB782]" /> : warning || incomplete ? <HelpCircle className="mt-0.5 size-5 shrink-0 text-[#E2E54B]" /> : <AlertTriangle className="mt-0.5 size-5 shrink-0 text-[#EB5757]" />}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-[#F7F8F8]">{title}</p><span className="text-[10px] uppercase tracking-wider text-[#62666D]">Latest saved check</span></div>
              <p className="mt-1 text-xs leading-5 text-[#C9CCD2]">{result.message}</p>
              <p className="mt-2 break-all text-[10px] text-[#8A8F98]">{result.checkedUrl || url} · {result.checkedAt ? new Date(result.checkedAt).toLocaleString() : "just now"}</p>
              {result.status === "not_found" ? <ul className="mt-3 grid gap-1 text-[11px] text-[#8A8F98] sm:grid-cols-2"><li>• Confirm the site changes were published</li><li>• Add the code to the site-wide template</li><li>• Clear the CMS or CDN cache</li><li>• Publish your tag-manager container</li></ul> : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {result.checkedUrl?.startsWith("http") ? <Button asChild size="sm" variant="outline"><a href={result.checkedUrl} target="_blank" rel="noreferrer">Open website<ExternalLink className="size-3.5" /></a></Button> : null}
                {!installed ? <Button type="button" size="sm" variant="outline" onClick={() => void copySnippet()}><Copy className="size-3.5" />Copy installation code</Button> : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function QuickVerify() {
  return (
    <section className="rounded-2xl border border-[#23252A] bg-[#121316] p-5 sm:p-6">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#62666D]">
        <CheckCircle2 className="size-3.5" />
        Quick visual checks
      </div>
      <h2 className="mt-1 text-lg font-semibold text-[#F7F8F8]">
        How to know it&apos;s working
      </h2>
      <p className="mt-1 text-sm text-[#8A8F98]">
        Three quick things to look for once the code is in place.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        {[
          {
            icon: MessageCircle,
            t: "A chat bubble appears",
            d: "Open your site in a private/incognito window. A small chat bubble should be in the corner you chose (bottom-right by default).",
          },
          {
            icon: MessageSquare,
            t: "You can have a conversation",
            d: "Click the bubble and ask something like “Do you offer Botox?” The AI will answer, and a new lead will appear in your Leads inbox within seconds.",
          },
          {
            icon: Smartphone,
            t: "It works on phones too",
            d: "Check the site on your phone. The bubble should resize and stay out of the way of buttons and menus.",
          },
        ].map((c) => (
          <div
            key={c.t}
            className="rounded-2xl border border-[#23252A] bg-[#0B0C0E] p-4"
          >
            <c.icon className="size-5 text-[#4CB782]" />
            <p className="mt-2 text-sm font-semibold text-[#F7F8F8]">{c.t}</p>
            <p className="mt-1 text-xs text-[#8A8F98]">{c.d}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function FriendlyTroubleshoot({ website }: { website: string }) {
  return (
    <section className="rounded-2xl border border-[#23252A] bg-[#121316] p-5 sm:p-6">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#62666D]">
        <HelpCircle className="size-3.5" />
        Common hiccups
      </div>
      <h2 className="mt-1 text-lg font-semibold text-[#F7F8F8]">
        Quick fixes if it isn&apos;t working
      </h2>
      <p className="mt-1 text-sm text-[#8A8F98]">
        The same things trip up almost everyone. Try these in order.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
        {[
          {
            q: "I pasted the code but I don't see the bubble.",
            a: "Refresh the page in a private/incognito window. If you have a caching plugin or a CDN, clear its cache — old versions of the page are often the cause.",
          },
          {
            q: "It shows up on one page but not another.",
            a: "Make sure the code is in the file or template that controls every page (theme.liquid, footer.php, the “site-wide” code box), not just on the homepage.",
          },
          {
            q: "The bubble is in the wrong spot.",
            a: "Open Widget → Position in the dashboard and pick a different corner. Changes appear within a minute.",
          },
          {
            q: "I want to remove it completely.",
            a: "Delete the snippet from your site — that's the entire uninstall. You can also pause the install from the Widget page without touching your site.",
          },
        ].map((it) => (
          <details
            key={it.q}
            className="group rounded-xl border border-[#23252A] bg-[#0B0C0E] p-4"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-[#F7F8F8]">
              {it.q}
              <ChevronDown className="size-4 shrink-0 text-[#8A8F98] transition-transform group-open:rotate-180 group-open:text-[#E2E54B]" />
            </summary>
            <p className="mt-2 text-xs leading-relaxed text-[#8A8F98]">
              {it.a}
            </p>
          </details>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-start gap-3 rounded-2xl border border-[#4CB782]/30 bg-[#4CB782]/5 p-4">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[#4CB782]" />
        <div>
          <p className="text-sm font-semibold text-[#F7F8F8]">
            Still stuck? We&apos;ll help you for free.
          </p>
          <p className="mt-1 text-xs text-[#8A8F98]">
            Email{" "}
            <a
              className="text-[#E2E54B] hover:underline"
              href="mailto:support@aivaspa.com"
            >
              support@aivaspa.com
            </a>{" "}
            with a link to the page where the chat should appear. We usually
            reply within an hour.
            {website ? (
              <>
                {" "}
                Your website is{" "}
                <span className="font-mono text-[#F7F8F8]">{website}</span>.
              </>
            ) : null}
          </p>
        </div>
      </div>
    </section>
  )
}
