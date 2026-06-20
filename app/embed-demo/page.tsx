import { headers } from "next/headers"
import Script from "next/script"

import { loadKnowledge } from "@/lib/ai/conversation"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const metadata = {
  title: "Glow Med Spa — Live chat preview",
  description: "A demo med-spa site with the AivaSpa chat widget installed.",
  robots: { index: false, follow: false },
}

export default async function DemoSitePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const requestedSpaId =
    typeof sp.spaId === "string" && sp.spaId.trim().length > 0
      ? sp.spaId.trim()
      : null

  const kb = await loadKnowledge()

  // Use the spa's active widget_installs.widget_key, not the widget_config
  // row id. checkEmbedAccess looks up installs by widget_key, so this is
  // the only id that actually unlocks the chat iframe.
  const admin = createAdminClient()

  let spaId = kb.widget.id
  if (requestedSpaId) {
    const { data: install } = await admin
      .from("widget_installs")
      .select("widget_key, active")
      .eq("widget_key", requestedSpaId)
      .maybeSingle()
    if (install) {
      spaId = (install as { widget_key: string }).widget_key
    }
  } else {
    const { data: install } = await admin
      .from("widget_installs")
      .select("widget_key, active")
      .eq("active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()
    if (install) {
      spaId = (install as { widget_key: string }).widget_key
    }
  }

  const h = await headers()
  const proto = h.get("x-forwarded-proto") ?? "https"
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"
  const origin = `${proto}://${host}`
  const loaderSrc = `${origin}/embed/${spaId}/loader`

  return (
    <main className="min-h-screen bg-[#08090A] text-[#F7F8F8]">
      <Script src={loaderSrc} data-spa-id={spaId} strategy="afterInteractive" />
      <header className="border-b border-[#23252A]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 lg:px-8">
          <div className="flex items-center gap-2.5">
            <span
              className="flex size-8 items-center justify-center rounded-xl text-sm font-bold text-[#08090A]"
              style={{ backgroundColor: kb.widget.primaryColor }}
            >
              {kb.widget.logoInitial}
            </span>
            <span className="text-lg font-semibold">{kb.widget.brandName}</span>
          </div>
          <nav className="hidden items-center gap-6 text-sm text-[#8A8F98] md:flex">
            <a href="#services" className="hover:text-[#F7F8F8]">Services</a>
            <a href="#pricing" className="hover:text-[#F7F8F8]">Pricing</a>
            <a href="#book" className="hover:text-[#F7F8F8]">Book</a>
          </nav>
          <a
            href="#book"
            className="rounded-lg px-4 py-2 text-sm font-semibold text-[#08090A]"
            style={{ backgroundColor: kb.widget.primaryColor }}
          >
            Book a consult
          </a>
        </div>
      </header>

      <section className="border-b border-[#23252A]">
        <div className="mx-auto max-w-6xl px-5 py-20 text-center lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8A8F98]">
            Now with 24/7 AI receptionist
          </p>
          <h1 className="mt-4 text-5xl font-bold tracking-tight md:text-6xl">
            Treatments that meet you <span style={{ color: kb.widget.primaryColor }}>where you are</span>.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-[#8A8F98]">
            Botox, fillers, laser, facials and body contouring — bookable in chat
            with a licensed provider on your schedule.
          </p>
          <p className="mt-6 text-sm text-[#62666D]">
            👇 Look for the chat bubble at the bottom-right. It&apos;s powered by AivaSpa.
          </p>
        </div>
      </section>

      <section id="services" className="border-b border-[#23252A] py-20">
        <div className="mx-auto grid max-w-6xl gap-5 px-5 md:grid-cols-3 lg:px-8">
          {kb.services.slice(0, 6).map((s) => (
            <article
              key={s.id}
              className="rounded-2xl border border-[#23252A] bg-[#121316] p-5"
            >
              <h3 className="text-base font-semibold">{s.name}</h3>
              <p className="mt-2 text-sm text-[#8A8F98]">{s.description}</p>
              <p className="mt-3 text-xs text-[#62666D]">
                Duration: {s.duration || "varies"} · Pricing confirmed at consultation
              </p>
            </article>
          ))}
        </div>
      </section>

      <section id="book" className="py-20 text-center">
        <h2 className="text-3xl font-bold">Ready when you are</h2>
        <p className="mt-3 text-sm text-[#8A8F98]">
          Open the chat — AivaSpa is online 24/7 and can book you in.
        </p>
      </section>
    </main>
  )
}
