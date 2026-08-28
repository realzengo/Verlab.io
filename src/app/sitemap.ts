import type { MetadataRoute } from "next";

// Marketing site only (verlab.io) -- the dashboard, admin, and auth pages
// all live on app.verlab.io (see ROOT_DOMAIN / APP_ONLY_PREFIXES in
// src/proxy.ts) and are gated behind login, so they have nothing to offer
// a search crawler.
const BASE_URL = "https://verlab.io";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    { url: BASE_URL, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE_URL}/pricing`, lastModified, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE_URL}/affiliates`, lastModified, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/script-bending`, lastModified, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/legal`, lastModified, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/legal/privacy`, lastModified, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/legal/terms`, lastModified, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/legal/refunds`, lastModified, changeFrequency: "yearly", priority: 0.3 },
  ];
}
