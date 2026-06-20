import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://aivaspa.online").replace(/\/$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "AivaSpa | 24/7 AI Receptionist for Med Spas",
    template: "%s | AivaSpa",
  },
  description:
    "A premium AI chat receptionist for med spa websites that answers approved questions, captures consultation leads, and notifies staff instantly.",
  keywords: [
    "AI receptionist",
    "med spa chatbot",
    "medspa AI",
    "lead capture",
    "website chat",
    "aesthetic clinic",
    "consultation booking",
  ],
  applicationName: "AivaSpa",
  authors: [{ name: "AivaSpa" }],
  creator: "AivaSpa",
  publisher: "AivaSpa",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "AivaSpa",
    title: "AivaSpa | 24/7 AI Receptionist for Med Spas",
    description:
      "An AI chat receptionist for med spa websites that answers from your approved knowledge base, captures leads, and notifies your team instantly.",
    images: [
      {
        url: "/og",
        width: 1200,
        height: 630,
        alt: "AivaSpa — 24/7 AI Receptionist for Med Spas",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AivaSpa | 24/7 AI Receptionist for Med Spas",
    description:
      "An AI chat receptionist for med spa websites that captures consultation leads and notifies your team instantly.",
    images: ["/og"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} h-full scroll-smooth antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#08090A] text-[#F7F8F8] selection:bg-[#E2E54B]/40">
        {children}
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#0B0C0E",
              border: "1px solid #23252A",
              color: "#F7F8F8",
            },
          }}
        />
      </body>
    </html>
  );
}
