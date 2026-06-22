"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SocialButtons } from "@/components/auth/social-buttons";
import { signInWithPassword } from "@/app/actions/auth";

const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  remember: z.boolean().optional(),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const resetStatus = searchParams.get("reset");
  const oauthError = searchParams.get("error");
  const bannedError = searchParams.get("error") === "banned";
  const redirectTo = searchParams.get("redirectTo") ?? undefined;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", remember: true },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    setInfoMessage(null);
    setSubmitting(true);
    try {
      const result = await signInWithPassword(values.email, values.password, redirectTo);
      if (!result) {
        setServerError("No response from server. Please try again.");
        return;
      }
      if (!result.ok) {
        setServerError(result.error ?? "Could not sign in. Please try again.");
        return;
      }
      // Success: explicitly navigate. This bypasses any Next server-action
      // redirect quirks and guarantees the user lands on the intended page
      // (e.g. /admin) with a fresh request that carries the new session
      // cookies.
      const target = result.redirectTo || redirectTo || "/dashboard";
      window.location.assign(target);
      return;
    } catch (err) {
      const e = err as Error & { digest?: string };
      const isRedirect = e.digest?.startsWith?.("NEXT_REDIRECT") ||
        e.message?.toLowerCase().includes("redirect");
      if (isRedirect) {
        // Fallback in case the action still throws a redirect (e.g. signUp
        // flow). Force navigation to the intended target.
        window.location.assign(redirectTo || "/dashboard");
        return;
      }
      setServerError(e.message ?? "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-[#F7F8F8]">
          Welcome back
        </h1>
        <p className="text-sm leading-6 text-[#8A8F98]">
          Log in to your AivaSpa dashboard to review leads, update your knowledge base, and customize your widget.
        </p>
      </div>

      {resetStatus === "success" ? (
        <div className="rounded-xl border border-[#4CB782]/40 bg-[#4CB782]/10 px-4 py-3 text-sm text-[#4CB782]">
          Password updated successfully. You can now sign in with your new password.
        </div>
      ) : null}
      {oauthError === "oauth" ? (
        <div className="rounded-xl border border-[#EB5757]/40 bg-[#EB5757]/10 px-4 py-3 text-sm text-[#EB5757]">
          We couldn&apos;t complete the social sign-in. Please try email &amp; password.
        </div>
      ) : null}
      {bannedError ? (
        <div className="rounded-xl border border-[#EB5757]/40 bg-[#EB5757]/10 px-4 py-3 text-sm text-[#EB5757]">
          Your account has been suspended. Please contact support to restore access.
        </div>
      ) : null}

      <div className="space-y-4">
        <Field
          id="email"
          label="Work email"
          type="email"
          autoComplete="email"
          placeholder="you@medspa.com"
          error={errors.email?.message}
          registration={register("email")}
        />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-[#F7F8F8]">
              Password
            </Label>
            <a
              href="/forgot-password"
              className="text-xs font-medium text-[#E2E54B] transition hover:text-[#E2E54B]/80"
            >
              Forgot password?
            </a>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter your password"
              aria-invalid={!!errors.password}
              className="h-11 border-[#23252A] bg-[#0B0C0E] pr-11 text-[#F7F8F8] placeholder:text-[#62666D] focus-visible:border-[#E2E54B] focus-visible:ring-[#E2E54B]/30"
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-[#62666D] transition hover:bg-[#1A1B1E] hover:text-[#F7F8F8]"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {errors.password ? (
            <p className="text-xs text-[#EB5757]">{errors.password.message}</p>
          ) : null}
        </div>

        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-[#8A8F98]">
          <input
            type="checkbox"
            className="size-4 rounded border-[#23252A] bg-[#0B0C0E] text-[#E2E54B] accent-[#E2E54B] focus:ring-[#E2E54B]/40"
            {...register("remember")}
          />
          Keep me signed in on this device
        </label>
      </div>

      {serverError ? (
        <div className="rounded-xl border border-[#EB5757]/40 bg-[#EB5757]/10 px-4 py-3 text-sm text-[#EB5757]">
          {serverError}
        </div>
      ) : null}
      {infoMessage ? (
        <div className="rounded-xl border border-[#4CB782]/40 bg-[#4CB782]/10 px-4 py-3 text-sm text-[#4CB782]">
          {infoMessage}
        </div>
      ) : null}

      <Button
        type="submit"
        disabled={submitting}
        className="h-11 w-full rounded-xl bg-[#E2E54B] text-sm font-semibold text-[#08090A] hover:bg-[#E2E54B]/90"
      >
        {submitting ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Signing you in…
          </>
        ) : (
          "Log in"
        )}
      </Button>

      <Divider />

      <SocialButtons label="Log in with" redirectTo={redirectTo} />

      <p className="text-center text-xs text-[#62666D]">
        By continuing, you agree to AivaSpa&apos;s{" "}
        <a href="/terms" className="text-[#8A8F98] underline-offset-4 hover:text-[#F7F8F8] hover:underline">
          Terms
        </a>{" "}
        and{" "}
        <a href="/privacy" className="text-[#8A8F98] underline-offset-4 hover:text-[#F7F8F8] hover:underline">
          Privacy Policy
        </a>
        .
      </p>
    </form>
  );
}

function Divider() {
  return (
    <div className="relative">
      <div className="absolute inset-0 flex items-center" aria-hidden>
        <div className="w-full border-t border-[#23252A]" />
      </div>
      <div className="relative flex justify-center">
        <span className="bg-[#08090A] px-3 text-[11px] font-medium uppercase tracking-wider text-[#62666D]">
          or
        </span>
      </div>
    </div>
  );
}

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  error?: string;
  registration: ReturnType<ReturnType<typeof useForm<LoginValues>>["register"]>;
};

function Field({ id, label, error, registration, className, ...rest }: FieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-[#F7F8F8]">
        {label}
      </Label>
      <Input
        id={id}
        aria-invalid={!!error}
        className={`h-11 border-[#23252A] bg-[#0B0C0E] text-[#F7F8F8] placeholder:text-[#62666D] focus-visible:border-[#E2E54B] focus-visible:ring-[#E2E54B]/30 ${className ?? ""}`}
        {...rest}
        {...registration}
      />
      {error ? <p className="text-xs text-[#EB5757]">{error}</p> : null}
    </div>
  );
}
