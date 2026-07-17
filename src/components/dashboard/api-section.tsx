"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  CircleDot,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Plus,
  ShieldCheck,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createApiKeyAction,
  listApiKeys,
  revokeApiKeyAction,
  type ApiKeyRecord,
} from "@/app/actions/api-keys";
import { cn } from "@/lib/utils";
import { ALL_SCOPES, type ApiKeyScope } from "@/lib/api/keys-shared"

export type ApiSectionProps = {
  initialKeys: ApiKeyRecord[];
};

export function ApiSection({ initialKeys }: ApiSectionProps) {
  const router = useRouter();
  const [keys, setKeys] = React.useState<ApiKeyRecord[]>(initialKeys);

  const refresh = React.useCallback(async () => {
    const fresh = await listApiKeys().catch(() => null);
    if (fresh) setKeys(fresh);
    router.refresh();
  }, [router]);

  return (
    <div className="space-y-5">
      <ApiKeysCard keys={keys} onChange={setKeys} onRefresh={refresh} />
    </div>
  );
}

// ============================================================
// API KEYS
// ============================================================

function ApiKeysCard({
  keys,
  onChange,
  onRefresh,
}: {
  keys: ApiKeyRecord[];
  onChange: (next: ApiKeyRecord[]) => void;
  onRefresh: () => Promise<void> | void;
}) {
  const [showCreate, setShowCreate] = React.useState(false);
  const [revealed, setRevealed] = React.useState<{
    name: string;
    key: string;
  } | null>(null);

  async function handleRevoke(id: string) {
    if (
      !confirm(
        "Revoke this key? Any system using it will lose access immediately.",
      )
    )
      return;
    const res = await revokeApiKeyAction(id);
    if (!res.ok) {
      toast.error(res.error ?? "Could not revoke key.");
      return;
    }
    onChange(
      keys.map((k) =>
        k.id === id ? { ...k, revokedAt: new Date().toISOString() } : k,
      ),
    );
    toast.success("Key revoked.");
    await onRefresh();
  }

  return (
    <div className="rounded-2xl border border-[#23252A] bg-[#121316]">
      <div className="flex flex-col gap-3 border-b border-[#23252A] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <KeyRound className="size-4 text-[#5E6AD2]" />
            <h2 className="text-base font-semibold text-[#F7F8F8]">API keys</h2>
          </div>
          <p className="mt-1 text-xs text-[#8A8F98]">
            Use these to push leads from custom sources (forms, ads, landing
            pages) and read your data. Authenticate with{" "}
            <code className="rounded bg-[#0B0C0E] px-1 py-0.5 text-[10px] text-[#F7F8F8]">
              Authorization: Bearer aiva_live_…
            </code>
          </p>
        </div>
        {!showCreate ? (
          <Button
            size="sm"
            onClick={() => setShowCreate(true)}
            className="h-9 rounded-lg bg-[#E2E54B] px-3 text-xs font-semibold text-[#08090A] hover:bg-[#E2E54B]/90"
          >
            <Plus className="size-3.5" />
            Generate key
          </Button>
        ) : null}
      </div>

      {showCreate ? (
        <CreateKeyForm
          onCancel={() => setShowCreate(false)}
          onCreated={(key, plaintext) => {
            onChange([key, ...keys]);
            setShowCreate(false);
            setRevealed({ name: key.name, key: plaintext });
            void onRefresh();
          }}
        />
      ) : null}

      {revealed ? (
        <RevealKeyDialog
          name={revealed.name}
          plaintext={revealed.key}
          onClose={() => setRevealed(null)}
        />
      ) : null}

      <ul className="divide-y divide-[#23252A]">
        {keys.length === 0 ? (
          <li className="p-5 text-center text-xs text-[#8A8F98]">
            No API keys yet. Generate one to start pushing leads from external
            sources.
          </li>
        ) : (
          keys.map((k) => (
            <ApiKeyRow
              key={k.id}
              apiKey={k}
              onRevoke={() => void handleRevoke(k.id)}
            />
          ))
        )}
      </ul>
    </div>
  );
}

function ApiKeyRow({
  apiKey,
  onRevoke,
}: {
  apiKey: ApiKeyRecord;
  onRevoke: () => void;
}) {
  const isRevoked = !!apiKey.revokedAt;
  const lastUsed = apiKey.lastUsedAt
    ? new Date(apiKey.lastUsedAt).toLocaleString()
    : "Never used";
  const created = new Date(apiKey.createdAt).toLocaleDateString();
  return (
    <li className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-[#F7F8F8]">
            {apiKey.name}
          </p>
          <code className="rounded-md border border-[#23252A] bg-[#0B0C0E] px-1.5 py-0.5 font-mono text-[10px] text-[#8A8F98]">
            {apiKey.keyPrefix}
          </code>
          {isRevoked ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-[#EB5757]/30 bg-[#EB5757]/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#EB5757]">
              <XCircle className="size-2.5" /> Revoked
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-md border border-[#4CB782]/30 bg-[#4CB782]/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#4CB782]">
              <CircleDot className="size-2.5" /> Active
            </span>
          )}
        </div>
        <p className="mt-1 text-[10px] text-[#8A8F98]">
          Created {created} · Last used {lastUsed} · Scopes:{" "}
          {apiKey.scopes.join(", ")}
        </p>
      </div>
      {!isRevoked ? (
        <Button
          variant="outline"
          size="sm"
          onClick={onRevoke}
          className="h-8 rounded-lg border-[#23252A] bg-[#121316] text-[11px] font-semibold text-[#EB5757] hover:bg-[#1A1B1E] hover:text-[#EB5757]"
        >
          <Trash2 className="size-3" />
          Revoke
        </Button>
      ) : null}
    </li>
  );
}

function CreateKeyForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (key: ApiKeyRecord, plaintext: string) => void;
}) {
  const [name, setName] = React.useState("");
  const [scopes, setScopes] = React.useState<ApiKeyScope[]>([
    "leads:read",
    "leads:write",
  ]);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function toggleScope(s: ApiKeyScope) {
    setScopes((current) =>
      current.includes(s)
        ? current.filter((x) => x !== s)
        : [...current, s],
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("name", name);
      for (const s of scopes) formData.append("scopes", s);
      const result = await createApiKeyAction(formData);
      if (!result.ok) {
        setError(result.error ?? "Could not create key.");
        return;
      }
      onCreated(result.key, result.plaintext);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-3 border-b border-[#23252A] bg-[#0B0C0E] p-5 sm:grid-cols-[1fr_2fr_auto]"
    >
      <div className="space-y-1.5">
        <Label
          htmlFor="key-name"
          className="text-[10px] uppercase tracking-wider text-[#62666D]"
        >
          Key name
        </Label>
        <Input
          id="key-name"
          name="name"
          required
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Landing page form"
          className="h-10 border-[#23252A] bg-[#121316] text-sm text-[#F7F8F8] placeholder:text-[#62666D] focus-visible:border-[#E2E54B] focus-visible:ring-[#E2E54B]/30"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-[10px] uppercase tracking-wider text-[#62666D]">
          Scopes
        </Label>
        <div className="flex flex-wrap gap-1.5">
          {ALL_SCOPES.map((s) => {
            const on = scopes.includes(s);
            return (
              <button
                type="button"
                key={s}
                onClick={() => toggleScope(s)}
                className={cn(
                  "rounded-md border px-2 py-1 text-[11px] font-mono transition",
                  on
                    ? "border-[#E2E54B]/50 bg-[#E2E54B]/15 text-[#E2E54B]"
                    : "border-[#23252A] bg-[#121316] text-[#8A8F98] hover:text-[#F7F8F8]",
                )}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex items-end gap-2">
        <Button
          type="submit"
          disabled={submitting || !name || scopes.length === 0}
          className="h-10 rounded-lg bg-[#E2E54B] px-4 text-xs font-semibold text-[#08090A] hover:bg-[#E2E54B]/90 disabled:opacity-50"
        >
          {submitting ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <KeyRound className="size-3.5" />
          )}
          Generate
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="h-10 rounded-lg border-[#23252A] bg-[#121316] text-xs font-semibold text-[#F7F8F8] hover:bg-[#1A1B1E]"
        >
          Cancel
        </Button>
      </div>
      {error ? (
        <p className="col-span-full text-xs text-[#EB5757]">{error}</p>
      ) : null}
    </form>
  );
}

function RevealKeyDialog({
  name,
  plaintext,
  onClose,
}: {
  name: string;
  plaintext: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = React.useState(false);
  const [show, setShow] = React.useState(false);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);
  async function copy() {
    try {
      await navigator.clipboard.writeText(plaintext);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copy failed");
    }
  }
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#04050a]/85 px-4 backdrop-blur-xl"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-[#23252A] bg-[#0B0C0E] p-6 shadow-[0_30px_120px_-20px_rgba(0,0,0,0.7)]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-lg border border-[#23252A] bg-[#121316] text-[#8A8F98] transition hover:text-[#F7F8F8]"
        >
          <X className="size-4" />
        </button>
        <div className="inline-flex items-center gap-2 rounded-full border border-[#4CB782]/40 bg-[#4CB782]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#4CB782]">
          <ShieldCheck className="size-3" />
          New API key
        </div>
        <h3 className="mt-3 text-xl font-bold text-[#F7F8F8]">
          Save your key now
        </h3>
        <p className="mt-1.5 text-sm text-[#8A8F98]">
          &quot;{name}&quot; is ready. We&apos;ll only show the full secret once
          — copy it somewhere safe (e.g. your password manager). If you lose
          it, revoke this key and generate a new one.
        </p>
        <div className="mt-4 overflow-hidden rounded-xl border border-[#23252A] bg-[#08090A]">
          <div className="flex items-center gap-1 border-b border-[#23252A] bg-[#0B0C0E] px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#62666D]">
              Bearer token
            </span>
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="inline-flex items-center gap-1 rounded-md border border-[#23252A] bg-[#121316] px-2 py-1 text-[10px] font-semibold text-[#8A8F98] hover:text-[#F7F8F8]"
              >
                {show ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                {show ? "Hide" : "Show"}
              </button>
              <button
                type="button"
                onClick={copy}
                className="inline-flex items-center gap-1 rounded-md border border-[#E2E54B]/40 bg-[#E2E54B]/15 px-2 py-1 text-[10px] font-semibold text-[#E2E54B] hover:bg-[#E2E54B]/25"
              >
                {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
          <pre className="overflow-x-auto p-3 text-[11px] leading-5">
            <code className="font-mono text-[#F7F8F8]">
              {show
                ? plaintext
                : "•".repeat(Math.min(64, plaintext.length))}
            </code>
          </pre>
        </div>
        <div className="mt-5 flex items-center justify-end gap-2">
          <Button
            onClick={onClose}
            className="h-9 rounded-lg bg-[#E2E54B] px-4 text-xs font-semibold text-[#08090A] hover:bg-[#E2E54B]/90"
          >
            I&apos;ve saved it
          </Button>
        </div>
      </div>
    </div>
  );
}
