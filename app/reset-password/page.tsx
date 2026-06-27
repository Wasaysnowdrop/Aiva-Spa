import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";


import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Set new password | AivaSpa",
  description: "Set a new password for your AivaSpa account.",
};

type SearchParams = Promise<{ code?: string | string[]; error?: string | string[] }>;

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const codeParam = params.code;
  const code = typeof codeParam === "string" ? codeParam : Array.isArray(codeParam) ? codeParam[0] : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (code) {
      redirect(
        `/auth/callback?code=${encodeURIComponent(code)}&next=${encodeURIComponent("/reset-password")}`,
      );
    }
    redirect("/forgot-password");
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#08090A] text-[#F7F8F8]">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-[#E2E54B]/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 bottom-1/4 h-96 w-96 rounded-full bg-[#5E6AD2]/15 blur-3xl"
      />

      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5" aria-label="AivaSpa home">
          <Logo />
        </Link>
        <Link
          href="/login"
          className="text-sm text-[#8A8F98] transition hover:text-[#F7F8F8]"
        >
          Remembered it?{" "}
          <span className="font-semibold text-[#E2E54B]">Log in</span>
        </Link>
      </header>

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-80px)] max-w-md items-start px-5 py-10 lg:px-8 lg:py-16">
        <Suspense fallback={null}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
