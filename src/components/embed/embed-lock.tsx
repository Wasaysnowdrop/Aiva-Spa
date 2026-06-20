import type { WidgetConfig } from "@/lib/supabase/types"

export function EmbedLock({ widget }: { widget: WidgetConfig }) {
  const accent = widget.primaryColor || "#5E6AD2"
  return (
    <div
      className="flex h-full w-full items-center justify-center bg-[#08090A] p-6"
      role="region"
      aria-label="Chat temporarily unavailable"
    >
      <div className="w-full max-w-sm text-center">
        <div
          className="mx-auto mb-5 flex size-12 items-center justify-center rounded-full"
          style={{ backgroundColor: `${accent}1F` }}
          aria-hidden
        >
          <svg
            className="size-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke={accent}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <h2 className="mb-2 text-base font-semibold text-[#F7F8F8]">
          Chat is temporarily unavailable
        </h2>
        <p className="text-sm leading-relaxed text-[#9CA0A8]">
          {widget.brandName
            ? `Please contact ${widget.brandName} directly to book an appointment.`
            : "Please contact the business directly to book an appointment."}
        </p>
      </div>
    </div>
  )
}
