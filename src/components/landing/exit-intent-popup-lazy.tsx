"use client"

import dynamic from "next/dynamic"

/**
 * Exit-intent popup is only shown after the visitor moves their mouse
 * toward the close button — i.e. on the verge of leaving. We never
 * need it for the first render. Code-splitting it shaves ~3 KB off
 * the initial landing-page bundle.
 */
const Inner = dynamic(
  () => import("@/components/landing/exit-intent-popup").then((m) => m.ExitIntentPopup),
  { ssr: false },
)

export const ExitIntentPopupLazy = Inner
