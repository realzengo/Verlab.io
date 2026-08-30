import type { MetadataRoute } from "next";

// Reinforces the per-route `robots: { index: false }` metadata already set
// on the gated layouts ((auth), /app, /admin, checkout/success,
// oauth/authorize) -- this keeps crawlers from even fetching those paths on
// verlab.io, rather than fetching and then finding a noindex tag.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/app", "/admin", "/checkout", "/oauth", "/login", "/signup", "/update-password"],
    },
    sitemap: "https://verlab.io/sitemap.xml",
  };
}
