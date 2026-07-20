import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, CalendarCheck, Check, MessageCircle, MonitorSmartphone, ShieldCheck, UserRoundCheck } from "lucide-react"

import { DemoExperience } from "@/components/demo/demo-experience"
import type { PublicDemoScenario } from "@/components/demo/types"
import { Logo } from "@/components/logo"
import { DEMO_SCENARIOS, DEMO_SCENARIO_IDS, publicScenario } from "@/lib/demo/scenarios"

export const metadata: Metadata = {
  title: "Try AivaSpa Live | AI Receptionist Demo for Med Spas",
  description: "Experience AivaSpa's AI receptionist without signing up. Chat as a visitor, request a consultation, and see the captured lead inside a live demo dashboard.",
  alternates: { canonical: "/demo" },
  openGraph: {
    title: "Try AivaSpa Live | AI Receptionist Demo for Med Spas",
    description: "Chat as a med-spa visitor, request a consultation, and see the same lead in a live demo dashboard.",
    url: "/demo",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Try AivaSpa Live",
    description: "Experience the AivaSpa AI receptionist without signing up.",
  },
  robots: { index: true, follow: true },
}

const scenarios = DEMO_SCENARIO_IDS.map((id) => publicScenario(DEMO_SCENARIOS[id])) as PublicDemoScenario[]

const journey = [
  { icon: MessageCircle, title: "Chat as a visitor", text: "Ask real questions against a curated med-spa knowledge base." },
  { icon: CalendarCheck, title: "Request a consultation", text: "Complete a consent-aware test lead or contact AivaSpa." },
  { icon: UserRoundCheck, title: "See the captured lead", text: "Watch the same details appear in an isolated demo workspace." },
  { icon: MonitorSmartphone, title: "Explore the dashboard", text: "Try realistic follow-up, assignment, notes, and scheduling states." },
]

export default function DemoPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "AivaSpa Interactive Demo",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: metadata.description,
    url: "https://aivaspa.online/demo",
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#08090A] text-[#F7F8F8]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <header className="sticky top-0 z-50 border-b border-[#24282E] bg-[#08090A]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" aria-label="AivaSpa home"><Logo /></Link>
          <nav className="hidden items-center gap-6 text-sm text-[#8F969F] md:flex"><Link href="/#features" className="hover:text-white">Product</Link><Link href="/pricing" className="hover:text-white">Pricing</Link><a href="mailto:sales@aivaspa.com?subject=AivaSpa%20walkthrough" className="hover:text-white">Talk to sales</a></nav>
          <div className="flex items-center gap-2"><span className="hidden text-xs text-[#69717B] sm:inline">No signup required</span><Link href="/signup" className="inline-flex items-center gap-1.5 rounded-lg bg-[#E2E54B] px-4 py-2 text-sm font-bold text-[#08090A]">Start setup <ArrowRight className="size-3.5" /></Link></div>
        </div>
      </header>

      <section className="border-b border-[#25292F]">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-16 sm:px-6 sm:pb-20 sm:pt-24 lg:grid-cols-[1.08fr_0.92fr] lg:px-8 lg:pb-28 lg:pt-28">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#4A4D2B] bg-[#1A1C10] px-3 py-1.5 text-xs font-semibold text-[#E2E54B]"><span className="size-1.5 rounded-full bg-[#E2E54B]" /> Interactive AivaSpa demo</div>
            <h1 className="mt-7 max-w-4xl text-5xl font-semibold leading-[1.04] tracking-[-0.04em] sm:text-6xl lg:text-7xl">Experience your AI receptionist before you buy.</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#9AA1AA]">Chat with AivaSpa as a med-spa visitor, request a consultation, and watch the lead appear inside the dashboard in real time.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row"><a href="#interactive-demo" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#E2E54B] px-6 py-3 text-sm font-bold text-[#08090A]">Start live demo <ArrowRight className="size-4" /></a><a href="mailto:sales@aivaspa.com?subject=AivaSpa%20walkthrough" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[#343840] bg-[#101318] px-6 py-3 text-sm font-semibold text-[#F7F8F8] hover:border-[#E2E54B]">Book a walkthrough</a></div>
            <p className="mt-4 text-xs text-[#69717B]">No signup required - Takes about 2 minutes</p>
          </div>
          <div className="rounded-3xl border border-[#2B2F35] bg-[#101318] p-5 sm:p-7">
            <div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#E2E54B]">The journey</p><h2 className="mt-2 text-xl font-semibold">Visitor question to team follow-up</h2></div><ShieldCheck className="size-6 text-[#E2E54B]" /></div>
            <ol className="mt-6 space-y-3">{journey.map((item, index) => <li key={item.title} className="flex gap-4 rounded-2xl border border-[#292D33] bg-[#0B0D10] p-4"><span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#1B1D12] text-[#E2E54B]"><item.icon className="size-4" /></span><div><div className="flex items-center gap-2"><span className="text-[10px] font-bold text-[#676F79]">0{index + 1}</span><h3 className="text-sm font-semibold">{item.title}</h3></div><p className="mt-1 text-xs leading-5 text-[#7F8791]">{item.text}</p></div></li>)}</ol>
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#28523A] bg-[#10251A] px-4 py-3 text-xs text-[#72D39B]"><Check className="size-4" /> Demo records stay outside customer workspaces and billing.</div>
          </div>
        </div>
      </section>

      <DemoExperience scenarios={scenarios} />

      <footer className="border-t border-[#25292F] bg-[#08090A] py-10"><div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8"><div><Logo /><p className="mt-3 max-w-xl text-xs leading-5 text-[#69717B]">AivaSpa provides general business and treatment information from approved content. It does not diagnose, give personalised medical advice, or guarantee results.</p></div><div className="flex gap-5 text-xs text-[#7F8791]"><Link href="/legal/privacy" className="hover:text-white">Privacy</Link><Link href="/legal/terms" className="hover:text-white">Terms</Link><Link href="/pricing" className="hover:text-white">Pricing</Link></div></div></footer>

      <div className="pointer-events-none fixed bottom-3 left-1/2 z-40 -translate-x-1/2 whitespace-nowrap rounded-full border border-[#4A4D2B] bg-[#11130D] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#E2E54B] shadow-lg sm:bottom-5 sm:left-auto sm:right-5 sm:translate-x-0">Interactive demo - No signup required</div>
    </main>
  )
}

