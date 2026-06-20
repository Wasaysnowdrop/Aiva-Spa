import Link from "next/link";
import { AuthMarketingPanel } from "@/components/auth/auth-marketing-panel";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";

export function AuthShell({
  side,
  children,
  className,
}: {
  side: "login" | "signup";
  children: React.ReactNode;
  className?: string;
}) {
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
          href={side === "login" ? "/signup" : "/login"}
          className="text-sm text-[#8A8F98] transition hover:text-[#F7F8F8]"
        >
          {side === "login" ? "Need an account?" : "Have an account?"}{" "}
          <span className="font-semibold text-[#E2E54B]">
            {side === "login" ? "Sign up" : "Log in"}
          </span>
        </Link>
      </header>

      <div className="relative z-10 mx-auto grid min-h-[calc(100vh-80px)] max-w-7xl items-start gap-12 px-5 py-10 lg:grid-cols-[1fr_1.05fr] lg:px-8 lg:py-16">
        <section className={cn("mx-auto w-full max-w-md lg:sticky lg:top-24", className)}>{children}</section>
        <AuthMarketingPanel side={side} />
      </div>
    </main>
  );
}
