"use client";

import * as React from "react";
import { Eye, Inbox, TrendingUp, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

type Props = {
  initialActiveSessions: number;
  initialLeadsThisWeek: number;
  leadsToday: number;
  className?: string;
};

type LiveSnapshot = {
  activeSessions: number;
  leadsThisWeek: number;
  leadsToday: number;
};

const POLL_INTERVAL_MS = 10_000;

export function LiveVisitorCounter({
  initialActiveSessions,
  initialLeadsThisWeek,
  leadsToday: initialLeadsToday,
  className,
}: Props) {
  const [snapshot, setSnapshot] = React.useState<LiveSnapshot>({
    activeSessions: Math.max(0, initialActiveSessions),
    leadsThisWeek: Math.max(0, initialLeadsThisWeek),
    leadsToday: Math.max(0, initialLeadsToday),
  });

  const fetchLive = React.useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/live", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as LiveSnapshot;
      setSnapshot({
        activeSessions: Math.max(0, data.activeSessions ?? 0),
        leadsThisWeek: Math.max(0, data.leadsThisWeek ?? 0),
        leadsToday: Math.max(0, data.leadsToday ?? 0),
      });
    } catch {
    }
  }, []);

  React.useEffect(() => {
    const id = window.setInterval(fetchLive, POLL_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchLive();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchLive]);

  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("live-visitor-counter")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_sessions" },
        () => {
          fetchLive();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads" },
        () => {
          fetchLive();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLive]);

  const displayActive = useCountUp(snapshot.activeSessions);
  const displayWeek = useCountUp(snapshot.leadsThisWeek, 600);

  const hasActiveSessions = snapshot.activeSessions > 0;
  const hasLeads = snapshot.leadsThisWeek > 0;
  const hasLeadsToday = snapshot.leadsToday > 0;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-[#23252A] bg-[#121316] p-4 sm:p-5",
        className,
      )}
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -right-12 -top-12 size-44 rounded-full blur-3xl",
          hasActiveSessions ? "bg-[#34D399]/20" : "bg-[#34D399]/5",
        )}
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -bottom-12 -left-12 size-44 rounded-full blur-3xl",
          hasLeads ? "bg-[#E2E54B]/15" : "bg-[#E2E54B]/5",
        )}
      />

      <div className="relative flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex size-2.5">
            <span
              className={cn(
                "absolute inline-flex h-full w-full rounded-full opacity-70",
                hasActiveSessions
                  ? "animate-ping bg-[#34D399]"
                  : "bg-[#34D399]/30",
              )}
            />
            <span
              className={cn(
                "relative inline-flex size-2.5 rounded-full",
                hasActiveSessions ? "bg-[#34D399]" : "bg-[#34D399]/40",
              )}
            />
          </span>
          <p
            className={cn(
              "text-[11px] font-semibold uppercase tracking-[0.18em]",
              hasActiveSessions ? "text-[#34D399]" : "text-[#62666D]",
            )}
          >
            {hasActiveSessions ? "Live right now" : "No active sessions"}
          </p>
        </div>
        <p className="flex items-center gap-1.5 text-[11px] text-[#8A8F98]">
          <Users className="size-3" />
          {hasActiveSessions
            ? "Real-time · active in the last 5 min"
            : "Visitors will appear once chats start"}
        </p>
      </div>

      <div className="relative mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-[#23252A] bg-[#0B0C0E] p-3.5">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-lg",
                hasActiveSessions
                  ? "bg-[#34D399]/15 text-[#34D399]"
                  : "bg-[#34D399]/5 text-[#34D399]/50",
              )}
            >
              <Eye className="size-3.5" />
            </span>
            <p className="text-[11px] font-medium uppercase tracking-wider text-[#62666D]">
              Viewing right now
            </p>
          </div>
          <p className="mt-2 flex items-baseline gap-1.5">
            <span
              className="text-3xl font-bold tracking-tight text-[#F7F8F8] tabular-nums"
              aria-live="polite"
            >
              {displayActive}
            </span>
            <span className="text-xs text-[#8A8F98]">
              {hasActiveSessions ? "people" : "no visitors yet"}
            </span>
          </p>
          <p className="mt-1 text-[11px] text-[#62666D]">
            {hasActiveSessions
              ? "Chatting with AivaSpa on customer sites"
              : "Install the widget on your site to see live visitors"}
          </p>
        </div>

        <div className="rounded-xl border border-[#23252A] bg-[#0B0C0E] p-3.5">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-lg",
                hasLeads
                  ? "bg-[#E2E54B]/15 text-[#E2E54B]"
                  : "bg-[#E2E54B]/5 text-[#E2E54B]/50",
              )}
            >
              <Inbox className="size-3.5" />
            </span>
            <p className="text-[11px] font-medium uppercase tracking-wider text-[#62666D]">
              Leads captured this week
            </p>
          </div>
          <p className="mt-2 flex items-baseline gap-1.5">
            <span
              className="text-3xl font-bold tracking-tight text-[#F7F8F8] tabular-nums"
              aria-live="polite"
            >
              {displayWeek}
            </span>
            <span className="text-xs text-[#8A8F98]">
              {hasLeads ? "leads" : "no leads yet"}
            </span>
          </p>
          <p
            className={cn(
              "mt-1 flex items-center gap-1 text-[11px]",
              hasLeadsToday ? "text-[#34D399]" : "text-[#62666D]",
            )}
          >
            {hasLeadsToday ? <TrendingUp className="size-3" /> : null}
            {hasLeadsToday
              ? `${snapshot.leadsToday} new today`
              : "No new leads today"}
          </p>
        </div>
      </div>
    </div>
  );
}

function useCountUp(target: number, durationMs = 450) {
  const [value, setValue] = React.useState(target);
  const previousRef = React.useRef(target);

  React.useEffect(() => {
    const from = previousRef.current;
    const to = target;
    previousRef.current = to;
    if (from === to) return;
    const startedAt = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - startedAt) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return value;
}
