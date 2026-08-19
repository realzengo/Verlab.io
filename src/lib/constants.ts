// The dashboard lives on a separate subdomain from the marketing site (see
// src/proxy.ts) -- marketing pages must link to it with an absolute URL
// rather than a relative path, since a relative Link would resolve against
// the marketing domain instead of crossing over.
//
// `next dev` (NODE_ENV=development) has no real DNS for app.<ROOT_DOMAIN>,
// but app.localhost resolves to 127.0.0.1 out of the box (RFC 6761, no
// /etc/hosts entry needed) -- proxy.ts treats it as the dev stand-in for
// the app subdomain, so it gets the exact same host split (and the same
// bare, path-free URL) production does. Without this branch, every
// marketing "Get Started"/"Try Verlab Now" link hardcoded the production
// app.verlab.io URL even in local dev, so clicking one -- and any login
// that followed -- landed on the live site instead of the local one.
// `next build`/`next start` (what preview and production deploys both run)
// keep NODE_ENV=production, so this only changes local dev's behavior.
export const APP_URL = process.env.NODE_ENV === "production" ? "https://app.verlab.io" : "http://app.localhost:3000";

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
