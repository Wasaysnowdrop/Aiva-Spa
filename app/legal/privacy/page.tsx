import type { Metadata } from "next";
import {
  BulletList,
  Callout,
  LegalPageShell,
  SectionHeading,
  SubHeading,
} from "@/components/legal/legal-page-shell";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How AivaSpa collects, uses, stores, and protects data for our AI receptionist SaaS built for med spas. Includes deletion requests and a no-medical-advice notice.",
  alternates: { canonical: "/legal/privacy" },
};

const dataWeCollect = [
  "Account information: name, email, password (hashed), business name, and team members you invite.",
  "Visitor lead information collected by the chat widget: name, email, phone number, service interest, preferred appointment time, and the URL the conversation started on.",
  "Chat transcripts between website visitors and the AivaSpa AI receptionist, used to improve reply quality and provide your team with full context.",
  "Knowledge-base content you upload: services, FAQs, pricing guardrails, working hours, and brand assets.",
  "Calendar and booking data when you connect a calendar, including the events created on your behalf.",
  "Billing metadata managed by our payment processor (plan, billing email, last four digits of the card). AivaSpa never sees or stores full card numbers.",
  "Product analytics: page views, feature usage, and aggregated performance metrics.",
  "Standard technical data: IP address, browser type, device type, and timestamps for security and abuse prevention.",
];

const howWeUse = [
  "To operate the AI receptionist and deliver chat responses from your approved knowledge base.",
  "To capture, deduplicate, and route consultation leads to your dashboard, email, and SMS.",
  "To send you notifications about new leads, system updates, billing, and security alerts.",
  "To keep your account, workspace, and visitor data secure.",
  "To improve retrieval quality, monitor for abuse, and provide customer support.",
  "To meet legal, tax, and accounting obligations.",
];

const howWeShare = [
  "With subprocessors that help us run the service — for example our hosting provider, our AI model provider, our email and SMS providers, and our payment processor. A current list is available on request.",
  "With your team members and other authorized users inside your workspace.",
  "With your connected integrations when you explicitly enable them (for example Google Calendar).",
  "If we are legally required to do so, or to protect the rights, property, or safety of AivaSpa, our customers, or others.",
  "We do not sell personal data, and we do not share visitor chat content with advertisers.",
];

export default function PrivacyPolicyPage() {
  return (
    <LegalPageShell
      eyebrow="Legal · Privacy"
      title="Privacy Policy"
      description="AivaSpa is an AI receptionist SaaS for med spas. This policy explains what data we collect, why we collect it, how we protect it, and the choices you have."
      updated="June 21, 2026"
    >
      <Callout tone="warning" title="AivaSpa is not medical advice">
        AivaSpa is a lead-capture and customer-communication tool. It does not provide medical
        advice, does not diagnose conditions, does not recommend treatments, and does not
        guarantee outcomes. Treatment suitability and pricing are always confirmed by a
        licensed provider during an in-person consultation.
      </Callout>

      <section className="space-y-3">
        <SectionHeading>1. Who we are</SectionHeading>
        <p>
          AivaSpa (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) provides an AI chat receptionist that
          helps med spas answer common questions, capture consultation leads, and notify
          staff. We are the data controller for the personal information described in this
          policy. If you have any questions, contact us at{" "}
          <a className="text-[#E2E54B] hover:underline" href="mailto:hello@aivaspa.online">
            hello@aivaspa.online
          </a>
          .
        </p>
      </section>

      <section className="space-y-3">
        <SectionHeading>2. Information we collect</SectionHeading>
        <p>We collect information in three ways: data you give us, data collected by the widget on your behalf, and data collected automatically.</p>
        <SubHeading>Data you give us</SubHeading>
        <BulletList items={dataWeCollect} />
        <SubHeading>Data collected automatically</SubHeading>
        <p>
          When visitors, customers, or team members use AivaSpa, we log timestamps, IP
          addresses, browser and device metadata, and referrer URLs. We use this information
          to keep the service secure, diagnose outages, and prevent abuse.
        </p>
      </section>

      <section className="space-y-3">
        <SectionHeading>3. How we use information</SectionHeading>
        <BulletList items={howWeUse} />
        <p>
          We rely on the following legal bases under GDPR and similar laws: performance of
          our contract with you, our legitimate interest in operating a safe and reliable
          service, your consent (where required), and compliance with legal obligations.
        </p>
      </section>

      <section className="space-y-3">
        <SectionHeading>4. How we share information</SectionHeading>
        <BulletList items={howWeShare} />
      </section>

      <section className="space-y-3">
        <SectionHeading>5. How we protect data</SectionHeading>
        <p>
          Data is encrypted in transit using TLS 1.2+ and encrypted at rest using
          industry-standard AES-256. Access to production systems is restricted to authorized
          personnel with role-based access and audit logging. We perform regular vulnerability
          scans and keep backups in encrypted, access-controlled storage.
        </p>
        <p>
          No method of transmission over the internet, however, is 100% secure. While we
          strive to protect your information, we cannot guarantee absolute security.
        </p>
      </section>

      <section className="space-y-3">
        <SectionHeading>6. Data retention</SectionHeading>
        <p>
          We keep your account data for as long as your workspace is active. Lead records and
          chat transcripts are retained according to the plan you are on (Starter 30 days,
          Growth 90 days, Pro 1 year) and can be exported or deleted from the dashboard at any
          time. When you delete a workspace, we permanently delete associated personal data
          within 30 days, except where retention is required for legal, tax, or audit purposes.
        </p>
      </section>

      <section className="space-y-3">
        <SectionHeading>7. Your rights and choices</SectionHeading>
        <p>
          Depending on where you live, you may have the right to access, correct, port, or
          delete the personal data we hold about you, and to object to or restrict certain
          processing. You can do most of this directly from your AivaSpa dashboard.
        </p>
        <SubHeading>How to request deletion</SubHeading>
        <p>
          Account owners can email{" "}
          <a className="text-[#E2E54B] hover:underline" href="mailto:hello@aivaspa.online">
            hello@aivaspa.online
          </a>{" "}
          from the address associated with the workspace and request deletion. We will confirm
          the request, verify your identity, and complete the deletion within 30 days.
        </p>
      </section>

      <section className="space-y-3">
        <SectionHeading>8. Cookies</SectionHeading>
        <p>
          The AivaSpa dashboard uses first-party cookies and local storage to keep you
          signed in. The chat widget does not set advertising cookies and does not track
          visitors across other websites. You can clear cookies and local storage from your
          browser at any time.
        </p>
      </section>

      <section className="space-y-3">
        <SectionHeading>9. International transfers</SectionHeading>
        <p>
          AivaSpa is operated from the United States. If you use our service from outside the
          U.S., your information will be transferred to and processed in the U.S. We rely on
          Standard Contractual Clauses or equivalent safeguards where required for
          cross-border transfers.
        </p>
      </section>

      <section className="space-y-3">
        <SectionHeading>10. Children&rsquo;s privacy</SectionHeading>
        <p>
          AivaSpa is a business tool intended for adults. We do not knowingly collect personal
          information from anyone under the age of 16. If you believe a child has provided us
          personal information, please contact us so we can delete it.
        </p>
      </section>

      <section className="space-y-3">
        <SectionHeading>11. Changes to this policy</SectionHeading>
        <p>
          We may update this policy from time to time. When we do, we will revise the
          &ldquo;Last updated&rdquo; date at the top of this page and, if the changes are material,
          notify you by email or in-product. Continued use of AivaSpa after a change
          indicates that you accept the updated policy.
        </p>
      </section>

      <section className="space-y-3">
        <SectionHeading>12. Contact</SectionHeading>
        <p>
          Questions, requests, or concerns? Email us at{" "}
          <a className="text-[#E2E54B] hover:underline" href="mailto:hello@aivaspa.online">
            hello@aivaspa.online
          </a>
          . We respond to all verified privacy requests within 30 days.
        </p>
      </section>
    </LegalPageShell>
  );
}