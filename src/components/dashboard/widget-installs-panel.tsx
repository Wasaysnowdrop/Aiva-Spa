"use client";

import * as React from "react";
import { Check, Copy, ExternalLink, Globe, Loader2, Plus, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addWidgetInstallAction,
  removeWidgetInstallAction,
} from "@/app/actions/widget-installs";
import { cn } from "@/lib/utils";
import type { WidgetInstall } from "@/lib/widget/installs";

type Props = {
  initialInstalls: WidgetInstall[];
  planName: string;
  maxWidgets: number;
  usedCount: number;
  unlimited: boolean;
  siteUrl: string;
};

export function WidgetInstallsPanel({
  initialInstalls,
  planName,
  maxWidgets,
  usedCount,
  unlimited,
  siteUrl,
}: Props) {
  const [installs, setInstalls] = React.useState<WidgetInstall[]>(initialInstalls);
  const [showAdd, setShowAdd] = React.useState(false);
  const [domain, setDomain] = React.useState("");
  const [label, setLabel] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);
  const [removingId, setRemovingId] = React.useState<string | null>(null);

  const atLimit = !unlimited && usedCount >= maxWidgets;
  const remaining = unlimited ? null : Math.max(0, maxWidgets - usedCount);

  async function handleAdd(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("domain", domain);
      formData.set("label", label);
      const result = await addWidgetInstallAction(formData);
      if (!result.ok) {
        toast.error(result.error ?? "Could not add install.");
        return;
      }
      setDomain("");
      setLabel("");
      setShowAdd(false);
      // Refresh the page so server data + sidebar counts update cleanly
      window.location.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add install.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(id: string) {
    if (removingId) return;
    setRemovingId(id);
    try {
      const result = await removeWidgetInstallAction(id);
      if (!result.ok) {
        toast.error(result.error ?? "Could not remove install.");
        return;
      }
      setInstalls((list) => list.filter((i) => i.id !== id));
      toast.success("Install removed.");
    } finally {
      setRemovingId(null);
    }
  }

  async function copySnippet(widgetKey: string) {
    const snippet = buildSnippet(siteUrl, widgetKey);
    try {
      await navigator.clipboard.writeText(snippet);
      setCopiedKey(widgetKey);
      setTimeout(() => setCopiedKey((k) => (k === widgetKey ? null : k)), 1500);
    } catch {
      toast.error("Could not copy to clipboard.");
    }
  }

  return (
    <section className="rounded-2xl border border-[#23252A] bg-[#121316] p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Globe className="size-4 text-[#E2E54B]" />
            <h2 className="text-base font-semibold text-[#F7F8F8]">Your widget installs</h2>
          </div>
          <p className="mt-1 text-xs text-[#8A8F98]">
            Each install is tied to one website. Your <span className="font-semibold text-[#F7F8F8]">{planName}</span> plan
            allows <span className="font-semibold text-[#F7F8F8]">{unlimited ? "unlimited" : maxWidgets}</span> active
            install{unlimited || maxWidgets === 1 ? "" : "s"}.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <UsagePill used={usedCount} max={maxWidgets} unlimited={unlimited} />
          {!showAdd ? (
            <Button
              type="button"
              size="sm"
              onClick={() => setShowAdd(true)}
              disabled={atLimit}
              className="h-9 rounded-lg bg-[#E2E54B] px-3 text-xs font-semibold text-[#08090A] hover:bg-[#E2E54B]/90 disabled:opacity-50"
            >
              <Plus className="size-3.5" />
              Add install
            </Button>
          ) : null}
        </div>
      </div>

      {atLimit ? (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-[#F59E0B]/30 bg-[#F59E0B]/10 p-3 text-xs text-[#F7F8F8]">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-[#F59E0B]" />
          <p>
            You&apos;ve hit the widget limit on the {planName} plan. Remove an existing
            install or{" "}
            <a href="/pricing" className="font-semibold text-[#E2E54B] underline-offset-4 hover:underline">
              upgrade
            </a>{" "}
            to add more.
          </p>
        </div>
      ) : null}

      {showAdd ? (
        <form
          onSubmit={handleAdd}
          className="mt-4 grid gap-3 rounded-xl border border-[#23252A] bg-[#0B0C0E] p-4 sm:grid-cols-[1fr_1fr_auto]"
        >
          <div className="space-y-1.5">
            <Label htmlFor="install-domain" className="text-[10px] uppercase tracking-wider text-[#62666D]">
              Website domain
            </Label>
            <Input
              id="install-domain"
              name="domain"
              required
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="yourmedspa.com"
              className="h-10 border-[#23252A] bg-[#121316] text-sm text-[#F7F8F8] placeholder:text-[#62666D] focus-visible:border-[#E2E54B] focus-visible:ring-[#E2E54B]/30"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="install-label" className="text-[10px] uppercase tracking-wider text-[#62666D]">
              Label (optional)
            </Label>
            <Input
              id="install-label"
              name="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Main site"
              className="h-10 border-[#23252A] bg-[#121316] text-sm text-[#F7F8F8] placeholder:text-[#62666D] focus-visible:border-[#E2E54B] focus-visible:ring-[#E2E54B]/30"
            />
          </div>
          <div className="flex items-end gap-2">
            <Button
              type="submit"
              disabled={submitting || atLimit}
              className="h-10 rounded-lg bg-[#E2E54B] px-4 text-xs font-semibold text-[#08090A] hover:bg-[#E2E54B]/90 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Adding…
                </>
              ) : (
                <>
                  <Plus className="size-3.5" />
                  Add
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowAdd(false);
                setDomain("");
                setLabel("");
              }}
              className="h-10 rounded-lg border-[#23252A] bg-[#121316] text-xs font-semibold text-[#F7F8F8] hover:bg-[#1A1B1E]"
            >
              <X className="size-3.5" />
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      <div className="mt-4 space-y-2">
        {installs.length === 0 ? (
          <div className="flex min-h-[80px] items-center justify-center rounded-xl border border-dashed border-[#23252A] bg-[#0B0C0E] p-4 text-center text-xs text-[#8A8F98]">
            No widget installs yet. Add your first domain above to get the install snippet.
          </div>
        ) : (
          installs.map((install) => (
            <InstallRow
              key={install.id}
              install={install}
              siteUrl={siteUrl}
              copied={copiedKey === install.widgetKey}
              removing={removingId === install.id}
              onCopy={() => void copySnippet(install.widgetKey)}
              onRemove={() => void handleRemove(install.id)}
            />
          ))
        )}
      </div>

      {remaining !== null && remaining > 0 && !showAdd ? (
        <p className="mt-3 text-[11px] text-[#62666D]">
          You can add {remaining} more install{remaining === 1 ? "" : "s"} on this plan.
        </p>
      ) : null}
    </section>
  );
}

function buildSnippet(siteUrl: string, widgetKey: string) {
  return `<script
  src="${siteUrl}/embed/${widgetKey}/loader"
  data-spa-id="${widgetKey}"
  defer
></script>`;
}

function UsagePill({
  used,
  max,
  unlimited,
}: {
  used: number;
  max: number;
  unlimited: boolean;
}) {
  if (unlimited) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-[#22D3EE]/30 bg-[#22D3EE]/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#22D3EE]">
        {used} active · unlimited
      </span>
    );
  }
  const pct = Math.min(100, Math.round((used / Math.max(1, max)) * 100))
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider",
        pct >= 100
          ? "border-[#F59E0B]/30 bg-[#F59E0B]/10 text-[#F59E0B]"
          : "border-[#4CB782]/30 bg-[#4CB782]/10 text-[#4CB782]",
      )}
    >
      {used} / {max} used
    </span>
  );
}

function InstallRow({
  install,
  siteUrl,
  copied,
  removing,
  onCopy,
  onRemove,
}: {
  install: WidgetInstall;
  siteUrl: string;
  copied: boolean;
  removing: boolean;
  onCopy: () => void;
  onRemove: () => void;
}) {
  const snippet = buildSnippet(siteUrl, install.widgetKey);
  const lastSeen = install.lastSeenAt
    ? new Date(install.lastSeenAt).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Never seen";
  return (
    <div className="rounded-xl border border-[#23252A] bg-[#0B0C0E] p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "size-2 shrink-0 rounded-full",
                install.active ? "bg-[#4CB782]" : "bg-[#62666D]",
              )}
            />
            <p className="truncate text-sm font-semibold text-[#F7F8F8]">
              {install.label || install.domain}
            </p>
            <span className="truncate text-xs text-[#8A8F98]">· {install.domain}</span>
          </div>
          <p className="mt-0.5 text-[10px] text-[#62666D]">
            Key: <span className="font-mono text-[#8A8F98]">{install.widgetKey}</span> · Last seen {lastSeen}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCopy}
            className="h-8 rounded-lg border-[#23252A] bg-[#121316] px-2 text-[11px] font-semibold text-[#F7F8F8] hover:bg-[#1A1B1E]"
          >
            {copied ? <Check className="size-3 text-[#4CB782]" /> : <Copy className="size-3" />}
            {copied ? "Copied" : "Copy snippet"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            asChild
            className="h-8 rounded-lg border-[#23252A] bg-[#121316] px-2 text-[11px] font-semibold text-[#F7F8F8] hover:bg-[#1A1B1E]"
          >
            <a href={`/embed-demo?spaId=${encodeURIComponent(install.widgetKey)}`} target="_blank" rel="noreferrer">
              <ExternalLink className="size-3" />
              Test
            </a>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRemove}
            disabled={removing}
            className="h-8 rounded-lg border-[#23252A] bg-[#121316] px-2 text-[11px] font-semibold text-[#EB5757] hover:bg-[#1A1B1E] disabled:opacity-50"
          >
            {removing ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
          </Button>
        </div>
      </div>
      <div className="mt-2 overflow-hidden rounded-lg border border-[#23252A] bg-[#08090A]">
        <pre className="overflow-x-auto p-2 text-[10px] leading-5 text-[#8A8F98]">
          <code>{snippet}</code>
        </pre>
      </div>
    </div>
  );
}
