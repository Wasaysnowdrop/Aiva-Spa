"use client"

import * as React from "react"
import { Menu, X } from "lucide-react"

import { cn } from "@/lib/utils"

export type MobileNavLink = {
  label: string
  href: string
}

export function MobileMenu({
  links,
  brand,
  rightSlot,
  className,
}: {
  links: readonly MobileNavLink[]
  brand?: React.ReactNode
  /** Rendered on the right of the toggle bar (e.g. login + signup buttons). */
  rightSlot?: React.ReactNode
  className?: string
}) {
  const [open, setOpen] = React.useState(false)

  // Lock body scroll while the menu is open so iOS Safari users can still
  // see the address bar; close on route changes via a popstate listener.
  React.useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <>
      <div className={cn("flex items-center gap-2 md:hidden", className)}>
        {rightSlot}
        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-nav-panel"
          onClick={() => setOpen((v) => !v)}
          className="flex size-10 items-center justify-center rounded-lg border border-[#23252A] bg-[#0F1013] text-[#F7F8F8] transition hover:border-[#3A3D44] hover:bg-[#1A1B1E]"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open ? (
        <div
          id="mobile-nav-panel"
          role="dialog"
          aria-modal="true"
          aria-label="Site navigation"
          className="fixed inset-0 z-[60] md:hidden"
        >
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-[#08090A]/80 backdrop-blur-sm"
          />
          <nav className="absolute inset-x-0 top-0 max-h-[100dvh] overflow-y-auto border-b border-[#23252A] bg-[#0B0C0E] px-5 pb-8 pt-5 shadow-2xl">
            <div className="flex items-center justify-between">
              {brand ? (
                <div className="flex items-center gap-2.5">{brand}</div>
              ) : null}
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="flex size-10 items-center justify-center rounded-lg border border-[#23252A] bg-[#0F1013] text-[#F7F8F8]"
              >
                <X className="size-5" />
              </button>
            </div>
            <ul className="mt-6 flex flex-col gap-1">
              {links.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between rounded-xl border border-transparent px-4 py-3 text-base font-semibold text-[#F7F8F8] transition hover:border-[#23252A] hover:bg-[#121316]"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      ) : null}
    </>
  )
}
