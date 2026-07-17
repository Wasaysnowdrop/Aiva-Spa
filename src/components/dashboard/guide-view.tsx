"use client"

import * as React from "react"
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Clipboard,
  Code2,
  Copy,
  Globe,
  HelpCircle,
  Lightbulb,
  Link2,
  Mail,
  MessageCircle,
  MessageSquare,
  MousePointerClick,
  Plug,
  Radio,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Webhook,
  Wrench,
  Wrench as WrenchIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { WidgetInstall } from "@/lib/widget/installs"

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
  devHandoff?: boolean
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
      "Still stuck? Use the “Email my developer” button below — we'll send them the exact code and instructions.",
    ],
    devHandoff: true,
  },
]

export function GuideView({
  installs,
  siteUrl,
  website,
  brandName,
  spaTimezone,
}: {
  installs: WidgetInstall[]
  siteUrl: string
  website: string
  brandName: string
  spaTimezone: string
}) {
  const activeInstalls = installs.filter((i) => i.active)
  const isLocalSnippet = /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(siteUrl)
  const firstInstall = activeInstalls[0]
  const [showAdvanced, setShowAdvanced] = React.useState(false)

  return (
    <div className="flex flex-col gap-8">
      {isLocalSnippet ? (
        <div className="flex items-start gap-3 rounded-2xl border border-[#EB5757]/40 bg-[#EB5757]/10 p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-[#EB5757]" />
          <div>
            <p className="text-sm font-semibold text-[#F7F8F8]">
              Your snippet points to localhost — it will not work on a live site.
            </p>
            <p className="mt-1 text-xs text-[#C9CCD2]">
              Set{" "}
              <code className="rounded bg-[#1A1B1E] px-1 py-0.5 font-mono text-[11px] text-[#F7F8F8]">
                NEXT_PUBLIC_SITE_URL
              </code>{" "}
              to your deployed AivaSpa domain (e.g.{" "}
              <code className="rounded bg-[#1A1B1E] px-1 py-0.5 font-mono text-[11px] text-[#F7F8F8]">
                https://app.yourdomain.com
              </code>
              ) in{" "}
              <code className="rounded bg-[#1A1B1E] px-1 py-0.5 font-mono text-[11px] text-[#F7F8F8]">
                .env.local
              </code>
              , restart the server, and reload this page. The snippet below will
              then point at the real host.
            </p>
          </div>
        </div>
      ) : null}

      <HeroSection />

      {firstInstall ? (
        <SnippetCard
          install={firstInstall}
          siteUrl={siteUrl}
          website={website}
          brandName={brandName}
        />
      ) : (
        <NoInstallEmptyState brandName={brandName} />
      )}

      {firstInstall ? (
        <PlatformPicker
          install={firstInstall}
          siteUrl={siteUrl}
          website={website}
          brandName={brandName}
        />
      ) : null}

      {firstInstall ? (
        <SiteChecker
          install={firstInstall}
          defaultUrl={website}
        />
      ) : null}

      <QuickVerify />

      <FriendlyTroubleshoot website={website} />

      <div className="rounded-2xl border border-[#23252A] bg-[#121316] p-1">
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="flex w-full items-center justify-between gap-3 rounded-xl p-4 text-left"
          aria-expanded={showAdvanced}
        >
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg border border-[#23252A] bg-[#0B0C0E] text-[#8A8F98]">
              <WrenchIcon className="size-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-[#F7F8F8]">
                For developers & power users
              </p>
              <p className="text-xs text-[#8A8F98]">
                Architecture overview, widget controls, and webhooks.
              </p>
            </div>
          </div>
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-[#8A8F98] transition-transform",
              showAdvanced && "rotate-180 text-[#E2E54B]",
            )}
          />
        </button>
        {showAdvanced ? (
          <div className="space-y-6 p-4 pt-2">
            <ArchitectureSection spaTimezone={spaTimezone} />
            <WidgetControlsSection />
            <WebhooksSection />
            <DeepTroubleshoot website={website} />
          </div>
        ) : null}
      </div>
    </div>
  )
}

function HeroSection() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#23252A] bg-gradient-to-br from-[#1A1B1E] via-[#121316] to-[#0B0C0E] p-6 sm:p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-[#E2E54B]/10 blur-3xl"
      />
      <div className="relative">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#E2E54B]">
          <Sparkles className="size-3.5" />
          Get live in about 5 minutes
        </div>
        <h1 className="mt-2 text-2xl font-semibold text-[#F7F8F8] sm:text-3xl">
          Add the chat widget to your website
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[#8A8F98]">
          You only need to copy one small piece of code and paste it into your
          site. No developer required for most platforms. Follow the three steps
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
  website,
  brandName,
}: {
  install: WidgetInstall
  siteUrl: string
  website: string
  brandName: string
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

  const subject = encodeURIComponent(
    `Help me add the AivaSpa chat widget to ${install.domain}`,
  )
  const body = encodeURIComponent(
    `Hi,

I'd like to add the AivaSpa chat widget to our website (${website || install.domain}). The AivaSpa team gave us the snippet below — could you paste it just before the closing </body> tag on every page of the site?

— Install for: ${install.label || install.domain}
— Workspace: ${brandName}

The code to paste:

${snippet}

That single snippet is everything we need. Once it's in, a chat bubble will appear in the bottom corner of the site. No other setup is required.

Thanks!`,
  )
  const mailto = `mailto:?subject=${subject}&body=${body}`

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
            <a
              href={mailto}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#23252A] bg-[#0B0C0E] px-2.5 py-1.5 text-[11px] font-semibold text-[#C9CCD2] hover:text-[#F7F8F8]"
            >
              <Send className="size-3" />
              Email this to my developer
            </a>
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
  brandName,
}: {
  install: WidgetInstall
  siteUrl: string
  website: string
  brandName: string
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
        install={install}
        snippet={snippet}
        website={website}
        brandName={brandName}
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
  install,
  snippet,
  website,
  brandName,
}: {
  platform: PlatformGuide
  install: WidgetInstall
  snippet: string
  website: string
  brandName: string
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
  const subject = encodeURIComponent(
    `Help me add the AivaSpa chat widget to ${install.domain}`,
  )
  const body = encodeURIComponent(
    `Hi,

I'd like to add the AivaSpa chat widget to our website (${website || install.domain}). I think we're on ${platform.label}. The AivaSpa team gave us this snippet — could you paste it just before the closing </body> tag on every page?

The code to paste:

${snippet}

A friendlier version of the steps they sent me is:
${platform.steps.map((s, i) => `${i + 1}. ${s.title} — ${s.body}`).join("\n")}

Thanks!`,
  )
  const mailto = `mailto:?subject=${subject}&body=${body}`

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
          <a
            href={mailto}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#23252A] bg-[#121316] px-2.5 py-1.5 text-[11px] font-semibold text-[#C9CCD2] hover:text-[#F7F8F8]"
          >
            <Send className="size-3" />
            Email to my developer
          </a>
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

      <p className="mt-3 text-[11px] text-[#62666D]">
        Don&apos;t want to do this yourself? Use the{" "}
        <span className="text-[#F7F8F8]">Email to my developer</span> button
        above — it sends the exact code and steps. Brand context: {brandName}.
      </p>
    </div>
  )
}

function SiteChecker({
  install,
  defaultUrl,
}: {
  install: WidgetInstall
  defaultUrl: string
}) {
  const [url, setUrl] = React.useState(defaultUrl)
  const [state, setState] = React.useState<
    | { status: "idle" }
    | { status: "loading" }
    | { status: "ok"; installed: boolean; message: string; raw?: unknown }
    | { status: "error"; message: string }
  >({ status: "idle" })

  const check = async () => {
    const cleaned = url.trim()
    if (!cleaned) {
      setState({ status: "error", message: "Please enter your website address first." })
      return
    }
    setState({ status: "loading" })
    try {
      const res = await fetch(
        `/api/widget/verify?spaId=${encodeURIComponent(install.widgetKey)}&url=${encodeURIComponent(cleaned)}`,
      )
      const data = await res.json()
      if (!data.ok) {
        setState({
          status: "error",
          message: data.message ?? "We couldn't check your site.",
        })
        return
      }
      setState({
        status: "ok",
        installed: Boolean(data.installed),
        message: data.message ?? "",
        raw: data,
      })
    } catch (err) {
      setState({
        status: "error",
        message:
          err instanceof Error
            ? err.message
            : "Something went wrong while checking your site.",
      })
    }
  }

  return (
    <section className="rounded-2xl border border-[#23252A] bg-[#121316] p-5 sm:p-6">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#62666D]">
        <Search className="size-3.5" />
        Step 3 · Check your site
      </div>
      <h2 className="mt-1 text-lg font-semibold text-[#F7F8F8]">
        Did it work? We&apos;ll check for you.
      </h2>
      <p className="mt-1 text-sm text-[#8A8F98]">
        Type in your website address and click <span className="text-[#F7F8F8]">Check now</span>.
        We&apos;ll fetch the page and look for the widget code. This usually
        takes a few seconds.
      </p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-[#23252A] bg-[#0B0C0E] px-3 py-2.5">
          <Globe className="size-4 shrink-0 text-[#62666D]" />
          <input
            type="text"
            inputMode="url"
            autoComplete="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://yourmedspa.com"
            className="min-w-0 flex-1 bg-transparent text-sm text-[#F7F8F8] placeholder:text-[#62666D] focus:outline-none"
          />
        </div>
        <Button
          onClick={check}
          disabled={state.status === "loading"}
          className="h-auto rounded-xl px-4 py-2.5"
        >
          {state.status === "loading" ? (
            "Checking…"
          ) : (
            <>
              Check now
              <ArrowRight className="size-4" />
            </>
          )}
        </Button>
      </div>

      {state.status === "error" ? (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-[#EB5757]/30 bg-[#EB5757]/5 p-3 text-xs text-[#F7F8F8]">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#EB5757]" />
          <span>{state.message}</span>
        </div>
      ) : null}

      {state.status === "ok" && state.installed ? (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-[#4CB782]/40 bg-[#4CB782]/10 p-3">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#4CB782]" />
          <div>
            <p className="text-sm font-semibold text-[#F7F8F8]">
              We found the widget on your site.
            </p>
            <p className="mt-0.5 text-xs text-[#C9CCD2]">{state.message}</p>
            <p className="mt-1 text-[11px] text-[#8A8F98]">
              Open your site in a private/incognito window to see the chat
              bubble in the corner.
            </p>
          </div>
        </div>
      ) : null}

      {state.status === "ok" && !state.installed ? (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-[#E2E54B]/30 bg-[#E2E54B]/5 p-3">
          <HelpCircle className="mt-0.5 size-5 shrink-0 text-[#E2E54B]" />
          <div>
            <p className="text-sm font-semibold text-[#F7F8F8]">
              We didn&apos;t find the widget yet.
            </p>
            <p className="mt-0.5 text-xs text-[#C9CCD2]">{state.message}</p>
            <p className="mt-1 text-[11px] text-[#8A8F98]">
              A few common causes: the site is still using a cached version, or
              the code was pasted in the wrong place. Try the steps above again
              and re-check.
            </p>
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

function SectionHeader({
  id,
  icon: Icon,
  title,
  description,
}: {
  id: string
  icon: React.ComponentType<{ className?: string }>
  title: string
  description?: string
}) {
  return (
    <header id={id} className="scroll-mt-24">
      <div className="flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-lg border border-[#23252A] bg-[#0B0C0E] text-[#E2E54B]">
          <Icon className="size-4" />
        </span>
        <h2 className="text-lg font-semibold text-[#F7F8F8]">{title}</h2>
      </div>
      {description ? (
        <p className="mt-1 text-sm text-[#8A8F98]">{description}</p>
      ) : null}
    </header>
  )
}

function ArchitectureSection({ spaTimezone }: { spaTimezone: string }) {
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        id="architecture"
        icon={Radio}
        title="How AivaSpa fits together"
        description="A short tour of the moving parts so the rest of this section makes sense."
      />
      <div className="rounded-2xl border border-[#23252A] bg-[#0B0C0E] p-5">
        <p className="text-sm text-[#8A8F98]">
          Every visitor chat is a tiny conversation between three runtimes: the
          browser on the visitor&apos;s site, your dashboard, and the AivaSpa
          backend. Nothing is sent to a third party.
        </p>
        <ol className="mt-4 space-y-3 text-sm text-[#F7F8F8]">
          <FlowStep
            n={1}
            icon={Globe}
            title="Visitor&apos;s browser"
            body="Your site loads the loader script, which appends a host <div> and a sandboxed <iframe> pointing to /embed/{`<spaId>`}?parent=…"
          />
          <FlowStep
            n={2}
            icon={Link2}
            title="GET /api/widget/config?spaId=…"
            body="The loader fetches public widget config (brand, color, position, working hours). This call does not leak leads, transcripts, or PII."
          />
          <FlowStep
            n={3}
            icon={MessageSquare}
            title="POST /api/chat"
            body="Each turn the AI takes hits this route. The route re-checks access via widget_installs and runs runConversationTurn() — knowledge retrieval → system prompt → LLM. Every turn is also upserted to chat_sessions so the dashboard sees the transcript live."
          />
          <FlowStep
            n={4}
            icon={Mail}
            title="Lead capture (when consent is given)"
            body="createPublicLead() dedups by phone/email, inserts/merges into leads, dispatches email notifications through Resend, fires conversation.completed webhooks, and increments monthly usage."
          />
          <FlowStep
            n={5}
            icon={Webhook}
            title="Your tools (optional)"
            body="AivaSpa HMAC-signs outbound webhook payloads so your CRM, Zapier, or in-house service can verify the sender."
          />
        </ol>
        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
          <EndpointRow
            method="GET"
            path="/api/widget/config"
            auth="public"
            note="Brand, color, position, working hours, faq/service counts."
          />
          <EndpointRow
            method="POST"
            path="/api/chat"
            auth="public"
            note="AI turn. Optionally saves a lead. Returns reply + leadSaved flag."
          />
          <EndpointRow
            method="POST"
            path="/api/leads"
            auth="public"
            note="Direct lead save from any source. Deduped by phone/email."
          /><EndpointRow
            method="POST"
            path="/embed/{`<spaId>`}/loader"
            auth="public"
            note="Returns the small JS loader. CORS *, cache 5 min."
          />
          <EndpointRow
            method="GET"
            path="/embed/{`<spaId>`}?parent=…"
            auth="install key"
            note="The chat UI itself, rendered as the iframe target."
          />
        </div>
        <p className="mt-5 text-xs text-[#62666D]">
          The widget&apos;s working-hours timezone is{" "}
          <code className="rounded bg-[#1A1B1E] px-1 py-0.5 font-mono text-[10px] text-[#F7F8F8]">
            {spaTimezone}
          </code>
          . Change it under{" "}
          <a
            href="/dashboard/widget"
            className="text-[#E2E54B] underline-offset-4 hover:underline"
          >
            Widget → Working hours
          </a>
          . The &quot;by hour of day&quot; chart in Analytics buckets in this
          timezone, not your browser&apos;s.
        </p>
      </div>
    </section>
  )
}

function FlowStep({
  n,
  icon: Icon,
  title,
  body,
}: {
  n: number
  icon: React.ComponentType<{ className?: string }>
  title: string
  body: string
}) {
  return (
    <li className="flex items-start gap-3 rounded-xl border border-[#23252A] bg-[#0B0C0E] p-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-[#E2E54B]/30 bg-[#E2E54B]/10 text-[11px] font-bold text-[#E2E54B]">
        {n}
      </span>
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-[#F7F8F8]">
          <Icon className="size-3.5 text-[#E2E54B]" />
          {title}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-[#8A8F98]">{body}</p>
      </div>
    </li>
  )
}

function EndpointRow({
  method,
  path,
  auth,
  note,
}: {
  method: "GET" | "POST"
  path: string
  auth: string
  note: string
}) {
  const methodColor =
    method === "GET"
      ? "border-[#22D3EE]/30 bg-[#22D3EE]/10 text-[#22D3EE]"
      : "border-[#E2E54B]/30 bg-[#E2E54B]/10 text-[#E2E54B]"
  return (
    <div className="rounded-xl border border-[#23252A] bg-[#0B0C0E] p-3">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
            methodColor,
          )}
        >
          {method}
        </span>
        <code className="truncate font-mono text-[12px] text-[#F7F8F8]">
          {path}
        </code>
      </div>
      <p className="mt-1.5 text-[10px] uppercase tracking-wider text-[#62666D]">
        {auth}
      </p>
      <p className="mt-1 text-xs text-[#8A8F98]">{note}</p>
    </div>
  )
}

function WidgetControlsSection() {
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        id="widget-controls"
        icon={Wrench}
        title="Widget controls"
        description="Open, close, refresh, or destroy the widget from your own code. Mounted on the page as window.AivaSpa."
      />
      <div className="rounded-2xl border border-[#23252A] bg-[#0B0C0E] p-5">
        <p className="text-sm text-[#8A8F98]">
          Once the loader script is on the page, a global{" "}
          <code className="rounded bg-[#1A1B1E] px-1 py-0.5 font-mono text-[11px] text-[#F7F8F8]">
            window.AivaSpa
          </code>{" "}
          object is available. Use it to wire the widget to your own buttons
          and product flows.
        </p>
        <div className="mt-4 space-y-3">
          <CodeBlock
            label="Open the chat from a custom button"
            code={`document.querySelector('#book-now').addEventListener('click', () => {
  window.AivaSpa.open();
});`}
          />
          <CodeBlock
            label="Close it programmatically"
            code={`window.AivaSpa.close();`}
          />
          <CodeBlock
            label="Refresh after the user updates preferences"
            code={`window.AivaSpa.refresh();`}
          />
          <CodeBlock
            label="Remove the widget from the page entirely"
            code={`window.AivaSpa.destroy();`}
          />
        </div>
      </div>
    </section>
  )
}

function WebhooksSection() {
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        id="webhooks"
        icon={Webhook}
        title="Outbound webhooks"
        description="Send signed lead events to your CRM, Zapier, or your own backend."
      />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2"><div className="rounded-2xl border border-[#23252A] bg-[#0B0C0E] p-5">
          <div className="flex items-center gap-2">
            <Plug className="size-4 text-[#E2E54B]" />
            <h3 className="text-sm font-semibold text-[#F7F8F8]">Outbound webhooks</h3>
          </div>
          <p className="mt-2 text-xs text-[#8A8F98]">
            Register a URL and pick the events you want. AivaSpa HMAC-signs
            every payload so your endpoint can verify the sender.
          </p>
          <div className="mt-3 space-y-1.5 text-xs">
            {[
              "lead.created",
              "lead.updated",
              "lead.deleted",
              "conversation.started",
              "conversation.completed",
            ].map((evt) => (
              <div
                key={evt}
                className="flex items-center gap-2 rounded-md border border-[#23252A] bg-[#0B0C0E] px-2 py-1"
              >
                <code className="font-mono text-[11px] text-[#F7F8F8]">
                  {evt}
                </code>
              </div>
            ))}
          </div>
          <CodeBlock
            label="Request headers"
            code={`X-AivaSpa-Event: lead.created
X-AivaSpa-Signature: t=1718461200,v1=4f3a…
X-AivaSpa-Webhook-Id: wh_abc123
X-AivaSpa-Delivery: d_xyz789`}
          />
          <p className="mt-2 text-[10px] text-[#62666D]">
            Signature = HMAC_SHA256(secret, &quot;{`<timestamp>`}.{`<rawBody>`}&quot;). Use
            crypto.timingSafeEqual to compare. Every attempt (success or fail)
            is logged to webhook_deliveries.
          </p>
        </div>
      </div>
    </section>
  )
}

function DeepTroubleshoot({ website }: { website: string }) {
  const items: { q: string; a: React.ReactNode }[] = [
    {
      q: "I pasted the snippet, but the bubble does not appear.",
      a: (
        <ul className="list-disc space-y-1 pl-5">
          <li>Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R).</li>
          <li>Clear any caching plugin and CDN cache.</li>
          <li>
            Open DevTools → Network tab and look for a request to{" "}
            <code className="rounded bg-[#1A1B1E] px-1 font-mono text-[11px]">
              /embed/&lt;spaId&gt;/loader
            </code>
            . If it is blocked, your Content Security Policy is the cause.
          </li>
          <li>
            Confirm the install is active under{" "}
            <a
              href="/dashboard/widget"
              className="text-[#E2E54B] underline-offset-4 hover:underline"
            >
              Widget → Your widget installs
            </a>
            . Deactivated installs return{" "}
            <code className="rounded bg-[#1A1B1E] px-1 font-mono text-[11px]">
              locked: true
            </code>{" "}
            from /api/widget/config and the bubble never opens.
          </li>
        </ul>
      ),
    },
    {
      q: "The widget appears on staging but not on production.",
      a: (
        <p>
          The install is keyed to the{" "}
          <code className="rounded bg-[#1A1B1E] px-1 font-mono text-[11px]">
            data-spa-id
          </code>{" "}
          attribute, not to a domain. The issue is almost always a CDN or
          origin cache. Purge the cache for the affected pages and try again.
        </p>
      ),
    },
    {
      q: "My Content Security Policy is blocking the script.",
      a: (
        <p>
          Add{" "}
          <code className="rounded bg-[#1A1B1E] px-1 font-mono text-[11px]">
            script-src
          </code>{" "}
          and{" "}
          <code className="rounded bg-[#1A1B1E] px-1 font-mono text-[11px]">
            frame-src
          </code>{" "}
          entries for your AivaSpa domain, and allow{" "}
          <code className="rounded bg-[#1A1B1E] px-1 font-mono text-[11px]">
            https:
          </code>{" "}
          in{" "}
          <code className="rounded bg-[#1A1B1E] px-1 font-mono text-[11px]">
            style-src
          </code>{" "}
          for the inline styles injected by the loader.
        </p>
      ),
    },
    {
      q: "Can I run the widget on a password-protected staging site?",
      a: (
        <p>
          Yes. The widget loads client-side and is unaffected by HTTP basic
          auth. Just make sure your staging URL is reachable from your browser
          before testing.
        </p>
      ),
    },
    {
      q: "Will the widget slow down my page?",
      a: (
        <p>
          No. The loader is under 50 KB gzipped, loads with the{" "}
          <code className="rounded bg-[#1A1B1E] px-1 font-mono text-[11px]">
            defer
          </code>{" "}
          attribute, and renders the chat bubble only when the user interacts
          with the page. It is engineered to add less than 100 ms to your
          Largest Contentful Paint on a typical 4G connection.
        </p>
      ),
    },
    {
      q: "How do I uninstall it?",
      a: (
        <p>
          Remove the script tag from your site — that is the entire uninstall.
          If you want to clear any leads collected up to that point, head to{" "}
          <span className="text-[#F7F8F8]">Settings → Privacy</span> and use
          the data deletion tool. Deactivating an install from the dashboard
          also stops the loader from opening the chat.
        </p>
      ),
    },
  ]

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        id="troubleshoot"
        icon={AlertTriangle}
        title="Troubleshooting"
        description="The most common questions we get from teams installing the widget for the first time."
      />
      <div className="flex flex-col gap-2">
        {items.map((it) => (
          <details
            key={it.q}
            className="group rounded-2xl border border-[#23252A] bg-[#0B0C0E] open:bg-[#0B0C0E]"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5">
              <span className="text-sm font-semibold text-[#F7F8F8]">{it.q}</span>
              <ChevronDown className="size-4 shrink-0 text-[#8A8F98] transition-transform group-open:rotate-180 group-open:text-[#E2E54B]" />
            </summary>
            <div className="space-y-2 border-t border-[#23252A] p-5 text-sm text-[#8A8F98]">
              {it.a}
            </div>
          </details>
        ))}
      </div>
      <div className="flex items-start gap-3 rounded-2xl border border-[#4CB782]/30 bg-[#4CB782]/5 p-4">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[#4CB782]" />
        <div>
          <p className="text-sm font-semibold text-[#F7F8F8]">
            Still stuck? We are here to help.
          </p>
          <p className="mt-1 text-xs text-[#8A8F98]">
            Email{" "}
            <a
              className="text-[#E2E54B] hover:underline"
              href="mailto:support@aivaspa.com"
            >
              support@aivaspa.com
            </a>{" "}
            with a link to the page where the widget is misbehaving. We
            typically reply within one business hour.
            {website ? (
              <>
                {" "}
                Your current website is{" "}
                <span className="font-mono text-[#F7F8F8]">{website}</span>.
              </>
            ) : null}
          </p>
        </div>
      </div>
    </section>
  )
}

function CodeBlock({ label, code }: { label: string; code: string }) {
  const [copied, setCopied] = React.useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }
  return (
    <div className="overflow-hidden rounded-xl border border-[#23252A] bg-[#0B0C0E]">
      <div className="flex items-center justify-between border-b border-[#23252A] bg-[#121316] px-3 py-1.5">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#62666D]">
          <Clipboard className="size-3" /> {label}
        </span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1 rounded-md border border-[#23252A] bg-[#0B0C0E] px-2 py-1 text-[10px] font-semibold text-[#8A8F98] hover:text-[#F7F8F8]"
        >
          {copied ? (
            <Check className="size-3 text-[#4CB782]" />
          ) : (
            <Copy className="size-3" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-[12px] leading-6 text-[#F7F8F8]">
        <code>{code}</code>
      </pre>
    </div>
  )
}
