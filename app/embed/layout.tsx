import type { Metadata, Viewport } from "next"

export const metadata: Metadata = {
  title: "Chat",
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#08090A",
}

export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen w-full">{children}</div>
}
