"use client";

import { useState } from "react";
import { z } from "zod";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SocialButtons } from "@/components/auth/social-buttons";
import { signUpWithPassword } from "@/app/actions/auth";

const signupSchema = z
  .object({
    name: z.string().min(2, "Please enter your full name"),
    email: z.string().min(1, "Email is required").email("Enter a valid email address"),
    spaName: z.string().min(2, "Tell us your med spa name").optional().or(z.literal("")),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Add at least one uppercase letter")
      .regex(/[0-9]/, "Add at least one number"),
    confirmPassword: z.string(),
    terms: z.boolean().refine((v) => v === true, {
      message: "You must accept the terms",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

type SignupValues = z.infer<typeof signupSchema>;

function getPasswordScore(password: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  const labels = ["Too weak", "Weak", "Fair", "Good", "Strong"] as const;
  return { score: score as 0 | 1 | 2 | 3 | 4, label: labels[score] };
}

export function SignupForm({ redirectTo, initialEmail = "" }: { redirectTo?: string; initialEmail?: string }) {
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      email: initialEmail,
      spaName: "",
      password: "",
      confirmPassword: "",
      terms: false,
    },
  });

  const password = useWatch({ control, name: "password" }) ?? "";
  const strength = getPasswordScore(password);
  const strengthColors = ["#EB5757", "#EB5757", "#FB923C", "#E2E54B", "#34D399"] as const;

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    setSubmitting(true);
    try {
      const result = await signUpWithPassword(
        values.email,
        values.password,
        values.name,
        values.spaName || undefined,
        redirectTo,
      );
      if (result && !result.ok) {
        setServerError(result.error ?? "Could not create your account. Please try again.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : null;
      if (message && message.toLowerCase().includes("redirect")) {
        return;
      }
      setServerError(message ?? "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-[#F7F8F8]">
          Start your 7-day free trial on Growth
        </h1>
        <p className="text-sm leading-6 text-[#8A8F98]">
          No credit card required. Be live on your med spa website in under 10 minutes.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="name"
          label="Full name"
          placeholder="Alex Morgan"
          autoComplete="name"
          error={errors.name?.message}
          registration={register("name")}
        />
        <Field
          id="spaName"
          label="Med spa name"
          placeholder="Glow Med Spa"
          autoComplete="organization"
          error={errors.spaName?.message}
          registration={register("spaName")}
          optional
        />
      </div>

      <Field
        id="email"
        label="Work email"
        type="email"
        placeholder="you@medspa.com"
        autoComplete="email"
        error={errors.email?.message}
        registration={register("email")}
      />

      <div className="space-y-2">
        <Label htmlFor="password" className="text-[#F7F8F8]">
          Password
        </Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="At least 8 characters"
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

        {password.length > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#62666D]">Password strength</span>
              <span className="font-semibold" style={{ color: strengthColors[strength.score] }}>
                {strength.label}
              </span>
            </div>
            <div className="flex gap-1.5">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-1 flex-1 rounded-full transition-colors"
                  style={{
                    backgroundColor:
                      i < strength.score ? strengthColors[strength.score] : "#23252A",
                  }}
                />
              ))}
            </div>
            <ul className="grid grid-cols-1 gap-1 pt-1 text-xs sm:grid-cols-2">
              <Requirement met={password.length >= 8} label="8+ characters" />
              <Requirement met={/[A-Z]/.test(password)} label="1 uppercase letter" />
              <Requirement met={/[0-9]/.test(password)} label="1 number" />
              <Requirement met={/[^A-Za-z0-9]/.test(password)} label="1 symbol (optional)" />
            </ul>
          </div>
        ) : null}
        {errors.password ? (
          <p className="text-xs text-[#EB5757]">{errors.password.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword" className="text-[#F7F8F8]">
          Confirm password
        </Label>
        <Input
          id="confirmPassword"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Re-enter your password"
          aria-invalid={!!errors.confirmPassword}
          className="h-11 border-[#23252A] bg-[#0B0C0E] text-[#F7F8F8] placeholder:text-[#62666D] focus-visible:border-[#E2E54B] focus-visible:ring-[#E2E54B]/30"
          {...register("confirmPassword")}
        />
        {errors.confirmPassword ? (
          <p className="text-xs text-[#EB5757]">{errors.confirmPassword.message}</p>
        ) : null}
      </div>

      <label className="flex cursor-pointer items-start gap-2.5 text-sm leading-6 text-[#8A8F98]">
        <input
          type="checkbox"
          className="mt-0.5 size-4 rounded border-[#23252A] bg-[#0B0C0E] text-[#E2E54B] accent-[#E2E54B] focus:ring-[#E2E54B]/40"
          {...register("terms")}
        />
        <span>
          I agree to AivaSpa&apos;s{" "}
          <a href="/terms" className="text-[#F7F8F8] underline-offset-4 hover:underline">
            Terms of Service
          </a>
          ,{" "}
          <a href="/privacy" className="text-[#F7F8F8] underline-offset-4 hover:underline">
            Privacy Policy
          </a>
          , and consent to receiving product and billing emails.
        </span>
      </label>
      {errors.terms ? (
        <p className="-mt-4 text-xs text-[#EB5757]">{errors.terms.message}</p>
      ) : null}

      {serverError ? (
        <div className="rounded-xl border border-[#EB5757]/40 bg-[#EB5757]/10 px-4 py-3 text-sm text-[#EB5757]">
          {serverError}
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
            Creating your account…
          </>
        ) : (
          "Create account"
        )}
      </Button>

      <Divider />

      <SocialButtons label="Sign up with" redirectTo={redirectTo || "/onboarding"} />

      <p className="text-center text-xs text-[#62666D]">
        Already have an account?{" "}
        <a
          href={redirectTo ? "/login?redirectTo=" + encodeURIComponent(redirectTo) : "/login"}
          className="font-semibold text-[#E2E54B] transition hover:text-[#E2E54B]/80"
        >
          Log in
        </a>
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

function Requirement({ met, label }: { met: boolean; label: string }) {
  return (
    <li
      className={`flex items-center gap-1.5 ${met ? "text-[#34D399]" : "text-[#62666D]"
        }`}
    >
      {met ? <Check className="size-3" /> : <X className="size-3" />}
      {label}
    </li>
  );
}

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  error?: string;
  registration: ReturnType<ReturnType<typeof useForm<SignupValues>>["register"]>;
  optional?: boolean;
};

function Field({ id, label, error, registration, optional, className, ...rest }: FieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-[#F7F8F8]">
        {label}
        {optional ? (
          <span className="ml-1.5 text-xs font-normal text-[#62666D]">Optional</span>
        ) : null}
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
