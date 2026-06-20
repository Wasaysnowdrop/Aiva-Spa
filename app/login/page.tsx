import { Suspense } from "react";
import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Log in | AivaSpa",
  description:
    "Log in to AivaSpa to review leads, update your knowledge base, and customize your med spa AI receptionist.",
};

export default function LoginPage() {
  return (
    <AuthShell side="login">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
