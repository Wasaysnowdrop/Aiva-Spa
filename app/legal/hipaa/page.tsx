import type { Metadata } from "next";
import {
  BulletList,
  Callout,
  LegalPageShell,
  SectionHeading,
  SubHeading,
} from "@/components/legal/legal-page-shell";

export const metadata: Metadata = {
  title: "HIPAA Notice",
  description:
    "How AivaSpa handles HIPAA-style safeguards, who is responsible for PHI, what is and isn't collected by default, and how to enable HIPAA-ready safeguards in your workspace.",
  alternates: { canonical: "/legal/hipaa" },
};

const safeguards = [
  "All data is encrypted in transit (TLS 1.2+) and at rest (AES-256).",
  "Role-based access control for owner, manager, staff, and receptionist roles, with least-privilege defaults.",
  "Audit logs of administrative actions, available in the dashboard on every plan.",
  "Configurable data retention windows (30 / 90 / 365 days by plan).",
  "Signed Business Associate Agreements (BAAs) available on request.",
  "Subprocessors are vetted for security posture; a current list is available on request.",
  "Hard caps on monthly conversation volume to prevent runaway exposure.",
];

const doNotCollect = [
  "Diagnoses, conditions, or ICD/CPT codes.",
  "Mental health, substance abuse, or HIV-related information.",
  "Genetic information, biometric identifiers, or full-face photos.",
  "Insurance ID numbers, Social Security numbers, or financial account numbers.",
  "Detailed treatment notes or clinician-authored medical records.",
];

export default function HipaaNoticePage() {
  return (
    <LegalPageShell
      eyebrow="Legal · HIPAA"
      title="HIPAA Notice"
      description="How AivaSpa approaches healthcare privacy, who decides whether HIPAA applies to your use of the service, and how to enable HIPAA-ready safeguards."
      updated="June 21, 2026"
    >
      <Callout tone="warning" title="AivaSpa is not a healthcare provider">
        AivaSpa does not provide medical advice, does not diagnose conditions, and does not
        recommend treatments. AivaSpa is a software service. Whether your use of AivaSpa
        makes you a HIPAA Covered Entity or Business Associate is a question you and your
        counsel must answer.
      </Callout>

      <section className="space-y-3">
        <SectionHeading>1. The short version</SectionHeading>
        <p>
          AivaSpa is built for med spas to capture leads and answer common questions. By
          default, it is configured to collect only the minimum information needed to book a
          consultation: a visitor&rsquo;s name, contact details, service interest, and preferred
          time. The widget should not be used to collect Protected Health Information (PHI)
          unless you have a signed Business Associate Agreement (BAA) with AivaSpa in place
          and have enabled HIPAA-ready safeguards in your workspace.
        </p>
      </section>

      <section className="space-y-3">
        <SectionHeading>2. Customer responsibility</SectionHeading>
        <p>
          You — the med spa — are responsible for determining whether HIPAA, state medical
          privacy laws, or other regulations apply to your use of AivaSpa. In particular:
        </p>
        <BulletList
          items={[
            "Decide whether you are a HIPAA Covered Entity or Business Associate in your jurisdiction.",
            "Decide what data is appropriate to ask visitors for through the chat widget.",
            "Decide whether to enter into a Business Associate Agreement with AivaSpa.",
            "Configure your knowledge base, greeting, and consent text so that visitors are not asked to disclose PHI that you do not intend to safeguard.",
            "Train your staff on how to handle lead records stored in AivaSpa.",
            "Comply with all applicable breach-notification laws if an incident occurs.",
          ]}
        />
        <p>
          AivaSpa provides tools and safeguards to support HIPAA-aware workflows, but does
          not represent that any single configuration of the Service is, by itself,
          HIPAA-compliant for every use case.
        </p>
      </section>

      <section className="space-y-3">
        <SectionHeading>3. Safeguards we provide</SectionHeading>
        <p>Every AivaSpa workspace ships with the following safeguards enabled by default:</p>
        <BulletList items={safeguards} />
      </section>

      <section className="space-y-3">
        <SectionHeading>4. What AivaSpa does not collect by default</SectionHeading>
        <p>
          The default lead-capture flow in the AivaSpa widget is configured to never ask for,
          store, or transmit the following categories of information. Do not change the
          widget or your knowledge base to collect these unless you have a BAA in place:
        </p>
        <BulletList items={doNotCollect} />
      </section>

      <section className="space-y-3">
        <SectionHeading>5. Data we do process</SectionHeading>
        <p>
          To operate the Service, AivaSpa processes the lead fields described in our{" "}
          <a className="text-[#E2E54B] hover:underline" href="/legal/privacy">
            Privacy Policy
          </a>{" "}
          (name, email, phone, service interest, preferred time, chat transcript), plus
          account and billing metadata. When configured to do so, AivaSpa also processes
          calendar event details when you connect Google Calendar or use the built-in
          calendar.
        </p>
      </section>

      <section className="space-y-3">
        <SectionHeading>6. Subprocessors and AI providers</SectionHeading>
        <p>
          AI responses are generated by an OpenAI-compatible model provider. Chat messages
          are sent to that provider solely to produce a reply and are not used to train
          third-party models. A current list of subprocessors — including hosting, AI, email,
          and SMS providers — is available on request.
        </p>
      </section>

      <section className="space-y-3">
        <SectionHeading>7. Access controls inside your workspace</SectionHeading>
        <p>
          Owner accounts can invite team members with Manager, Staff, or Receptionist roles
          from the dashboard. Each role has a documented permission set. Removing a team
          member immediately revokes their access. Every administrative action is recorded
          in the audit log.
        </p>
      </section>

      <section className="space-y-3">
        <SectionHeading>8. No diagnosis, no medical advice</SectionHeading>
        <p>
          The AI receptionist is configured to answer strictly from your approved knowledge
          base. It is not a diagnostic tool, does not recommend treatments, and does not
          represent any clinical outcome. Visitors are shown a disclaimer that treatment
          suitability and pricing must be confirmed by a licensed provider during an
          in-person consultation.
        </p>
      </section>

      <section className="space-y-3">
        <SectionHeading>9. Breach notification</SectionHeading>
        <p>
          If we become aware of a security incident that materially affects your workspace,
          we will notify you by email without unreasonable delay and in any case within the
          timeframes required by applicable law. We will share what we know, what we are
          doing about it, and what we recommend you do.
        </p>
      </section>

      <section className="space-y-3">
        <SectionHeading>10. Enabling HIPAA-ready safeguards</SectionHeading>
        <SubHeading>Starter</SubHeading>
        <p>
          HIPAA-aware PII handling, encryption in transit and at rest, role-based access,
          and 30-day audit log retention.
        </p>
        <SubHeading>Growth</SubHeading>
        <p>
          Everything in Starter, plus 90-day audit log retention, advanced role-based
          access, and SLA-backed uptime.
        </p>
        <SubHeading>Pro</SubHeading>
        <p>
          Everything in Growth, plus 1-year audit log retention, a signed Business Associate
          Agreement on request, custom data residency, and compliance & HIPAA audit reports.
        </p>
      </section>

      <section className="space-y-3">
        <SectionHeading>11. Contact</SectionHeading>
        <p>
          Questions about this notice or about HIPAA in your specific use case? Email us at{" "}
          <a className="text-[#E2E54B] hover:underline" href="mailto:hello@aivaspa.online">
            hello@aivaspa.online
          </a>
          .
        </p>
      </section>
    </LegalPageShell>
  );
}