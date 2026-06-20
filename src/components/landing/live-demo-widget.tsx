"use client";

import * as React from "react";
import Script from "next/script";
import { MessageCircle, Sparkles, X } from "lucide-react";

import { cn } from "@/lib/utils";

type Props = {
  spaId: string;
  loaderSrc: string;
  primaryColor?: string;
  brandInitial?: string;
  brandName?: string;
};

export function LiveDemoWidget({
  spaId,
  loaderSrc,
  primaryColor = "#E2E54B",
  brandInitial = "A",
  brandName = "AivaSpa Demo",
}: Props) {
  const [ready, setReady] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (!ready) return;
    const win = window as unknown as {
      AivaSpa?: { open: () => void; close: () => void };
    };
    if (open) {
      win.AivaSpa?.open();
    } else {
      win.AivaSpa?.close();
    }
  }, [open, ready]);

  return (
    <>
      <Script
        src={loaderSrc}
        data-spa-id={spaId}
        strategy="afterInteractive"
        onLoad={() => setReady(true)}
        onReady={() => setReady(true)}
      />

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close live demo chat" : "Open live demo chat"}
        aria-expanded={open}
        className={cn(
          "fixed bottom-6 right-6 z-40 flex items-center gap-2.5 rounded-full border shadow-[0_24px_48px_rgba(0,0,0,0.45)] transition-all",
          "hover:scale-[1.03] active:scale-[0.98]",
        )}
        style={{
          backgroundColor: primaryColor,
          borderColor: `${primaryColor}80`,
          color: "#08090A",
        }}
      >
        <span
          className="flex size-12 items-center justify-center rounded-full"
          style={{ backgroundColor: primaryColor }}
        >
          {open ? (
            <X className="size-5" />
          ) : (
            <MessageCircle className="size-5" />
          )}
        </span>
        <span className="hidden pr-4 sm:flex sm:items-center sm:gap-1.5">
          <span className="text-sm font-semibold">Try live demo</span>
          <Sparkles className="size-3.5" />
        </span>
        {!open ? (
          <span className="absolute -right-1 -top-1 flex h-3 w-3">
            <span
              className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
              style={{ backgroundColor: primaryColor }}
            />
            <span
              className="relative inline-flex size-3 rounded-full"
              style={{ backgroundColor: primaryColor }}
            />
          </span>
        ) : null}
      </button>

      {!open ? (
        <div
          aria-hidden
          className="pointer-events-none fixed bottom-[88px] right-6 z-30 hidden max-w-xs rounded-2xl border border-[#23252A] bg-[#121316] p-3.5 shadow-2xl sm:block"
        >
          <div className="flex items-start gap-2.5">
            <span
              className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
              style={{ backgroundColor: primaryColor, color: "#08090A" }}
            >
              {brandInitial}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#F7F8F8]">
                {brandName}
              </p>
              <p className="mt-0.5 text-[11px] leading-4 text-[#8A8F98]">
                Hi! I&apos;m the live AI — ask me about Botox, fillers, or pricing.
              </p>
            </div>
          </div>
          <div
            className="absolute -bottom-1.5 right-8 size-3 rotate-45 border-b border-r"
            style={{ backgroundColor: "#121316", borderColor: "#23252A" }}
          />
        </div>
      ) : null}
    </>
  );
}
