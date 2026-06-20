import { Suspense } from "react";
import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { CheckEmailView } from "@/components/auth/check-email-view";

export const metadata: Metadata = {
  title: "Check your email | AivaSpa",
  description:
    "Confirm your email to activate your AivaSpa account and finish onboarding.",
};

type SearchParams = Promise<{ email?: string | string[] }>;

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const raw = params.email;
  const email = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : null;

  return (
    <AuthShell side="signup">
      <Suspense fallback={null}>
        <CheckEmailView email={email ?? null} />
      </Suspense>
    </AuthShell>
  );
}
