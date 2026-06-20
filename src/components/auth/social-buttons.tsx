"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { signInWithOAuth } from "@/app/actions/auth";

type Provider = {
  id: "google";
  label: string;
  icon: (props: { className?: string }) => React.ReactElement;
};

const providers: Provider[] = [
  {
    id: "google",
    label: "Google",
    icon: GoogleIcon,
  },
];

export function SocialButtons({
  label = "Continue with",
  redirectTo,
}: {
  label?: string;
  redirectTo?: string;
}) {
  const [busy, setBusy] = useState<Provider["id"] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handle = async (provider: Provider) => {
    setError(null);
    setBusy(provider.id);
    try {
      const result = await signInWithOAuth(provider.id, redirectTo);
      if (result?.ok && result.url) {
        window.location.assign(result.url);
        return;
      }
      if (result && !result.ok) {
        setError(result.error ?? "Could not start social sign-in. Please try again.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : null;
      if (message && message.toLowerCase().includes("redirect")) {
        return;
      }
      setError(message ?? "Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3">
        {providers.map(({ id, label: name, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => handle({ id, label: name, icon: Icon })}
            disabled={busy !== null}
            className="inline-flex h-11 items-center justify-center gap-2.5 rounded-xl border border-[#23252A] bg-[#0B0C0E] px-4 text-sm font-semibold text-[#F7F8F8] transition hover:border-[#3A3D44] hover:bg-[#121316] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy === id ? (
              <Loader2 className="size-4 animate-spin text-[#8A8F98]" />
            ) : (
              <Icon className="size-4" />
            )}
            {label} {name}
          </button>
        ))}
      </div>
      {error ? (
        <p className="text-xs text-[#8A8F98]">{error}</p>
      ) : null}
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#F7F8F8"
        d="M21.6 12.227c0-.709-.064-1.39-.182-2.045H12v3.868h5.382a4.6 4.6 0 0 1-1.996 3.018v2.51h3.232c1.89-1.74 2.982-4.305 2.982-7.351z"
      />
      <path
        fill="#8A8F98"
        d="M12 22c2.7 0 4.964-.895 6.618-2.422l-3.232-2.51c-.895.6-2.04.955-3.386.955-2.605 0-4.81-1.76-5.595-4.122H3.064v2.59A9.996 9.996 0 0 0 12 22z"
      />
      <path
        fill="#F7F8F8"
        d="M6.405 13.9A6.003 6.003 0 0 1 6.09 12c0-.66.114-1.302.314-1.9V7.51H3.065A9.996 9.996 0 0 0 2 12c0 1.614.386 3.14 1.065 4.49L6.405 13.9z"
      />
      <path
        fill="#E2E54B"
        d="M12 5.977c1.468 0 2.786.505 3.823 1.495l2.868-2.868C16.96 2.99 14.695 2 12 2A9.996 9.996 0 0 0 3.065 7.51L6.405 10.1C7.19 7.737 9.395 5.977 12 5.977z"
      />
    </svg>
  );
}
