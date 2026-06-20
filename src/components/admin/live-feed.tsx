"use client"

import * as React from "react"
import { Pause, Play, RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useAdminFeed, type AdminEvent } from "./admin-realtime-provider"
import { cn } from "@/lib/utils"

const severityStyles: Record<AdminEvent["severity"], string> = {
  info: "text-[#5E6AD2]",
  success: "text-[#4CB782]",
  warn: "text-[#F2C94C]",
  error: "text-[#EB5757]",
}

const sourceLabel: Record<AdminEvent["source"], string> = {
  "lead.created": "Lead",
  "lead.updated": "Lead",
  "conversation.started": "Chat",
  "conversation.completed": "Chat",
  "webhook.delivered": "Webhook",
  "webhook.failed": "Webhook",
  "notification.delivered": "Notify",
  "notification.failed": "Notify",
  "api_key.used": "API",
  "user.signed_up": "Auth",
  "subscription.changed": "Sub",
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 5_000) return "just now"
  if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`
  return `${Math.round(diff / 86_400_000)}d ago`
}

export function LiveFeed({ maxHeight = 480 }: { maxHeight?: number }) {
  const { events, isPaused, pause, resume, clear, totalCount, lastEventAt } =
    useAdminFeed()
  const [pulse, setPulse] = React.useState(false)
  const lastEventAtRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    if (lastEventAt && lastEventAt !== lastEventAtRef.current) {
      lastEventAtRef.current = lastEventAt
      setPulse(true)
      const t = setTimeout(() => setPulse(false), 800)
      return () => clearTimeout(t)
    }
    return undefined
  }, [lastEventAt])

  return (
    <div className="rounded-2xl border border-[#23252A] bg-[#0B0C0E]">
      <div className="flex items-center justify-between border-b border-[#23252A] p-4">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "size-2 rounded-full",
              isPaused ? "bg-[#F2C94C]" : "bg-[#4CB782]",
              !isPaused && pulse && "animate-ping",
            )}
          />
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8A8F98]">
            {isPaused ? "Paused" : "Live"}
          </span>
          <span className="text-xs text-[#62666D]">
            · {totalCount} event{totalCount === 1 ? "" : "s"} since {isPaused ? "pause" : "session start"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {isPaused ? (
            <Button
              size="icon-sm"
              variant="outline"
              onClick={resume}
              className="size-7 border-[#23252A] bg-[#121316] text-[#8A8F98] hover:text-[#F7F8F8]"
              title="Resume"
            >
              <Play className="size-3" />
            </Button>
          ) : (
            <Button
              size="icon-sm"
              variant="outline"
              onClick={pause}
              className="size-7 border-[#23252A] bg-[#121316] text-[#8A8F98] hover:text-[#F7F8F8]"
              title="Pause"
            >
              <Pause className="size-3" />
            </Button>
          )}
          <Button
            size="icon-sm"
            variant="outline"
            onClick={clear}
            className="size-7 border-[#23252A] bg-[#121316] text-[#8A8F98] hover:text-[#F7F8F8]"
            title="Clear"
          >
            <RotateCcw className="size-3" />
          </Button>
        </div>
      </div>
      <ul
        className="divide-y divide-[#1A1B1E] overflow-y-auto"
        style={{ maxHeight }}
      >
        {events.length === 0 ? (
          <li className="p-6 text-center text-xs text-[#62666D]">
            Listening for events… lead captures, chat sessions, webhooks, and notifications will appear here in real time.
          </li>
        ) : (
          events.map((event) => (
            <li
              key={event.id}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 px-4 py-3 text-xs"
            >
              <span
                className={cn(
                  "mt-0.5 inline-flex size-5 items-center justify-center rounded-md border border-[#23252A] bg-[#121316] text-[9px] font-bold uppercase",
                  severityStyles[event.severity],
                )}
              >
                {sourceLabel[event.source].slice(0, 1)}
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold text-[#F7F8F8]">
                  {event.title}
                </p>
                {event.detail ? (
                  <p className="truncate text-[10px] text-[#8A8F98]">
                    {event.detail}
                  </p>
                ) : null}
              </div>
              <span className="whitespace-nowrap text-[10px] text-[#62666D]">
                {timeAgo(event.occurredAt)}
              </span>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}
