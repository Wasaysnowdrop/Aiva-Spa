import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Start free trial | AivaSpa",
  description:
    "Create your AivaSpa account in 60 seconds. 14-day free trial, no credit card, live on your med spa website in under 10 minutes.",
};

export default function SignupPage() {
  return (
    <AuthShell side="signup">
      <SignupForm />
    </AuthShell>
  );
}
