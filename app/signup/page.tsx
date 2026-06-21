import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Start free trial | AivaSpa",
  description:
    "Create your AivaSpa account in 60 seconds. 7-day free trial on Growth, no credit card, live on your med spa website in under 10 minutes.",
};

export default async function SignupPage() {
  const host = (await headers()).get("host") ?? "";
  if (host.split(":")[0].toLowerCase().startsWith("admin.")) {
    notFound();
  }
  return (
    <AuthShell side="signup">
      <SignupForm />
    </AuthShell>
  );
}
