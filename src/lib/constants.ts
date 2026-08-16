// The dashboard lives on a separate subdomain from the marketing site (see
// src/proxy.ts) -- marketing pages must link to it with an absolute URL
// rather than a relative path, since a relative Link would resolve against
// the marketing domain instead of crossing over.
export const APP_URL = "https://app.verlab.io";

// Paths that stay "light" (marketing/auth chrome) even when served from
// app.verlab.io -- everything else on that host is dashboard/admin UI and
// gets dark-mode support. Mirrors the passthrough list in src/proxy.ts,
// minus /admin and /app, which ARE themed. Shared with the no-flash inline
// script in src/app/layout.tsx -- keep the two in sync.
export const UNTHEMED_APP_HOST_PREFIXES = [
  "/login",
  "/signup",
  "/checkout",
  "/oauth",
  "/auth",
  "/api",
  "/legal",
  "/pricing",
  "/affiliates",
  "/script-bending",
  "/dev-preview-script-modal",
  "/.well-known",
];
