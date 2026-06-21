import type { Metadata } from "next";
import {
  BulletList,
  Callout,
  LegalPageShell,
  SectionHeading,
  SubHeading,
} from "@/components/legal/legal-page-shell";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms that govern your use of AivaSpa, the AI receptionist SaaS for med spas. Covers accounts, billing, acceptable use, liability, and cancellation.",
  alternates: { canonical: "/legal/terms" },
};

const acceptableUse = [
  "Use the service only for lawful med-spa lead capture and customer communication.",
  "Provide accurate account, billing, and knowledge-base information.",
  "Keep your sign-in credentials secure and limit dashboard access to authorized team members.",
  "Comply with all applicable laws, including HIPAA, FTC advertising guidelines, TCPA, CAN-SPAM, and CAN-SPAM-equivalent SMS rules, in your jurisdiction.",
  "Make sure any consent text shown to visitors meets the requirements of your jurisdiction.",
  "Do not upload knowledge-base content that contains protected health information (PHI) unless you have a signed Business Associate Agreement with AivaSpa in place.",
  "Do not attempt to reverse-engineer, resell, or white-label the service outside the terms of your plan.",
  "Do not use AivaSpa to send spam, harass visitors, or impersonate any person or entity.",
];

const billingSummary = [
  "Plans are billed monthly or annually in advance. The Growth plan includes a 7-day free trial that does not require a credit card.",
  "Upgrades take effect immediately and are pro-rated. Downgrades take effect at the start of the next billing cycle.",
  "If you exceed your monthly conversation limit, we will email you a heads-up and add additional conversation packs. You can set a hard cap from your dashboard.",
  "Fees are non-refundable except where required by law. If you cancel mid-cycle, your plan stays active until the end of the period.",
];

export default function TermsOfServicePage() {
  return (
    <LegalPageShell
      eyebrow="Legal · Terms"
      title="Terms of Service"
      description="These Terms govern your use of AivaSpa. By creating an account or using the service, you agree to these Terms on behalf of yourself and the med spa you represent."
      updated="June 21, 2026"
    >
      <Callout tone="warning" title="AivaSpa is not medical advice">
        AivaSpa is a software tool that helps med spas communicate with website visitors.
        It does not provide medical, clinical, or treatment advice, does not diagnose
        conditions, and does not guarantee outcomes. Treatment suitability, pricing, and
        clinical claims must always be confirmed by a licensed provider during an in-person
        consultation.
      </Callout>

      <section className="space-y-3">
        <SectionHeading>1. Agreement</SectionHeading>
        <p>
          These Terms of Service (the &ldquo;Terms&rdquo;) form a binding agreement between you
          (the customer) and AivaSpa, Inc. (&ldquo;AivaSpa&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;). They apply to
          your use of our website, the AivaSpa chat widget, our dashboard, our APIs, and any
          related services we make available (collectively, the &ldquo;Service&rdquo;). If you do not
          agree, do not use the Service.
        </p>
      </section>

      <section className="space-y-3">
        <SectionHeading>2. Accounts and eligibility</SectionHeading>
        <p>
          You must be at least 18 years old and authorized to act on behalf of the med spa
          you represent. You are responsible for everything that happens under your account,
          including activity by team members you invite. Keep your credentials secure and
          tell us promptly at{" "}
          <a className="text-[#E2E54B] hover:underline" href="mailto:hello@aivaspa.online">
            hello@aivaspa.online
          </a>{" "}
          if you suspect any unauthorized access.
        </p>
      </section>

      <section className="space-y-3">
        <SectionHeading>3. Subscriptions, billing, and trials</SectionHeading>
        <BulletList items={billingSummary} />
        <p>
          Prices may change for future billing cycles, but we will always give you at least
          30 days&rsquo; notice before any price change takes effect on your existing plan.
        </p>
      </section>

      <section className="space-y-3">
        <SectionHeading>4. Acceptable use</SectionHeading>
        <p>When using AivaSpa, you agree to the following:</p>
        <BulletList items={acceptableUse} />
        <p>
          We may suspend or terminate accounts that violate this section, or that we
          reasonably believe are being used to harm visitors, customers, or our service.
        </p>
      </section>

      <section className="space-y-3">
        <SectionHeading>5. Your content and your visitors</SectionHeading>
        <p>
          You retain ownership of the content you upload to AivaSpa — your services, FAQs,
          brand assets, and chat transcripts. You grant us a limited, worldwide,
          non-exclusive license to host, process, transmit, and display that content solely
          as needed to provide the Service to you and your authorized team.
        </p>
        <p>
          You are responsible for the legality of the content you upload and the data you
          collect through the widget. AivaSpa does not monitor, review, or curate your
          knowledge base.
        </p>
      </section>

      <section className="space-y-3">
        <SectionHeading>6. Compliance and healthcare responsibility</SectionHeading>
        <p>
          You are solely responsible for determining whether your use of AivaSpa triggers
          obligations under HIPAA, state medical privacy laws, FTC advertising rules, TCPA,
          CAN-SPAM, or any other regulation. AivaSpa provides reasonable safeguards
          (encryption, role-based access, audit logs) but does not represent that the
          Service is, by itself, HIPAA-compliant for every use case. Read our{" "}
          <a className="text-[#E2E54B] hover:underline" href="/legal/hipaa">
            HIPAA Notice
          </a>{" "}
          for details.
        </p>
        <p>
          In particular: do not configure the widget to collect Protected Health Information
          unless you have a signed Business Associate Agreement (BAA) with AivaSpa and have
          enabled the corresponding safeguards in your workspace.
        </p>
      </section>

      <section className="space-y-3">
        <SectionHeading>7. Third-party services</SectionHeading>
        <p>
          AivaSpa integrates with third-party services such as OpenAI-compatible AI
          providers, Google Calendar, Resend (email), and Twilio (SMS). Your use of those
          services is subject to their own terms. We are not responsible for outages,
          changes, or behavior of third-party services.
        </p>
      </section>

      <section className="space-y-3">
        <SectionHeading>8. Cancellation and termination</SectionHeading>
        <p>
          You can cancel your subscription at any time from the dashboard. Cancellation
          takes effect at the end of your current billing cycle; you keep access to paid
          features until then. We may suspend or terminate accounts that violate these
          Terms, fail to pay, or pose a security risk, with or without notice depending on
          the severity of the issue.
        </p>
      </section>

      <section className="space-y-3">
        <SectionHeading>9. Service availability</SectionHeading>
        <p>
          We work hard to keep AivaSpa available 24/7. While we target 99.9% uptime on
          Starter and Growth and 99.95% on Pro, the Service is provided &ldquo;as available&rdquo;
          and may be interrupted by maintenance, upgrades, or events outside our control.
          Live system status is always available at{" "}
          <a className="text-[#E2E54B] hover:underline" href="/status">
            /status
          </a>
          .
        </p>
      </section>

      <section className="space-y-3">
        <SectionHeading>10. Disclaimers</SectionHeading>
        <p>
          THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE,&rdquo; WITHOUT WARRANTIES OF
          ANY KIND, EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION IMPLIED WARRANTIES OF
          MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO
          NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR THAT IT WILL
          MEET YOUR SPECIFIC REQUIREMENTS.
        </p>
        <p>
          <strong>No medical advice.</strong> AivaSpa is a software service, not a
          healthcare provider. Nothing the AI says or displays constitutes medical advice,
          a diagnosis, a recommendation, or a guarantee of outcome.
        </p>
      </section>

      <section className="space-y-3">
        <SectionHeading>11. Limitation of liability</SectionHeading>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, AIVASPA SHALL NOT BE LIABLE FOR ANY
          INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING
          LOST PROFITS, LOST REVENUE, LOST LEADS, OR LOSS OF GOODWILL, ARISING OUT OF OR
          RELATED TO YOUR USE OF THE SERVICE.
        </p>
        <p>
          OUR TOTAL AGGREGATE LIABILITY FOR ANY CLAIM ARISING OUT OF OR RELATED TO THE
          SERVICE SHALL NOT EXCEED THE GREATER OF (A) THE AMOUNTS PAID BY YOU TO AIVASPA
          IN THE TWELVE (12) MONTHS BEFORE THE CLAIM, OR (B) ONE HUNDRED U.S. DOLLARS
          (US$100).
        </p>
      </section>

      <section className="space-y-3">
        <SectionHeading>12. Indemnification</SectionHeading>
        <p>
          You agree to indemnify and hold AivaSpa harmless from any claim brought by a
          third party (including your visitors, patients, or regulators) that arises out of
          your content, your configuration of the Service, or your breach of these Terms.
        </p>
      </section>

      <section className="space-y-3">
        <SectionHeading>13. Governing law</SectionHeading>
        <p>
          These Terms are governed by the laws of the State of Delaware, United States,
          without regard to its conflict-of-laws rules. Any dispute will be resolved in the
          state or federal courts located in Delaware, and you consent to the personal
          jurisdiction of those courts.
        </p>
      </section>

      <section className="space-y-3">
        <SectionHeading>14. Changes to these Terms</SectionHeading>
        <p>
          We may update these Terms from time to time. If the change is material, we will
          notify you by email or in-product at least 14 days before it takes effect.
          Continued use of the Service after the effective date constitutes acceptance of
          the updated Terms.
        </p>
      </section>

      <section className="space-y-3">
        <SectionHeading>15. Contact</SectionHeading>
        <p>
          Questions about these Terms? Email us at{" "}
          <a className="text-[#E2E54B] hover:underline" href="mailto:hello@aivaspa.online">
            hello@aivaspa.online
          </a>
          .
        </p>
        <SubHeading>AivaSpa, Inc.</SubHeading>
        <p>hello@aivaspa.online</p>
      </section>
    </LegalPageShell>
  );
}