import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://aivaspa.online";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/pricing", "/signup", "/login", "/forgot-password"],
        disallow: [
          "/dashboard",
          "/dashboard/*",
          "/admin",
          "/admin/*",
          "/onboarding",
          "/onboarding/*",
          "/api",
          "/api/*",
          "/embed",
          "/embed/*",
          "/embed-demo",
          "/checkout",
          "/checkout/*",
          "/reset-password",
          "/check-email",
          "/auth",
          "/auth/*",
        ],
      },
    ],
    sitemap: `${siteUrl.replace(/\/$/, "")}/sitemap.xml`,
    host: siteUrl,
  };
}